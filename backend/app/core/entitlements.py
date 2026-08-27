"""THE GATE — read before touching any of app/api/v1/content/*.

The entitlements table is the single source of truth for access, and every gated
resource passes through one dependency here. No route reads `entitlements` directly.
A product grants whatever its `product_contents` rows point at; there is one entitlement
row per (user, product), and resolving that into "can this user see resource X" is this
file's job.

`ResourceType.QUESTION` is the exception: a question body is never gated. The check is
still called from questions.py, but only to choose between the upsell card and the owned
state — never to decide whether `body` is present.
"""
import enum
from datetime import datetime, timezone
from uuid import UUID

from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.models import Entitlement, Lesson, Module, ProductContent, Role, User
from app.db.session import get_session
from app.services.audit_service import record_admin_bypass


class ResourceType(str, enum.Enum):
    TEMPLATE = "template"
    LESSON = "lesson"
    QUESTION = "question_set"  # matches app/db/models/product.py's content_type values


async def resolve_product_ids(*, user_id: UUID, session: AsyncSession) -> set[UUID]:
    """Every product_id this user currently holds a live entitlement for — not expired,
    and not revoked, and the user is not deactivated.

    Revocation is enforced HERE, in the query every gated request already runs, not in a
    second check bolted on beside it — `Entitlement.revoked_at.is_(None)` is the entire
    diff a refund makes to the gate. Migration 011's `ix_entitlements_user_live` is a
    partial index over exactly this predicate, so this added filter costs nothing extra
    at the database level.

    Deactivated users (disabled_at IS NOT NULL) are refused here, in the same choke
    point, not by a second check bolted beside it."""
    now = datetime.now(timezone.utc)
    result = await session.execute(
        select(Entitlement.product_id)
        .join(User, User.id == Entitlement.user_id)
        .where(
            Entitlement.user_id == user_id,
            (Entitlement.expires_at.is_(None)) | (Entitlement.expires_at > now),
            Entitlement.revoked_at.is_(None),
            User.disabled_at.is_(None),
        )
    )
    return set(result.scalars().all())


def _lessons_of_granted_courses(product_ids: set[UUID]):
    """SELECT of every lesson id belonging to a course granted by `product_ids`.

    Owner rule: a lesson added after someone has purchased must be granted to them — they
    do not repurchase. Someone who has not purchased still has to buy the course.

    Membership is derived from the course structure at request time rather than from a
    frozen list of explicit `product_contents` rows of type `lesson`. A product that
    grants a course grants that course's lessons, whenever they were added. Explicit
    `lesson` rows still work exactly as before, so a product can still sell an individual
    lesson without selling its course, and the two paths union.

    Deriving rather than backfilling also means a lesson MOVED between courses follows
    its new course, and a lesson deleted stops being granted, with no rows to reconcile.
    """
    granted_course_ids = select(ProductContent.content_id).where(
        ProductContent.product_id.in_(product_ids),
        ProductContent.content_type == "course",
    )
    return (
        select(Lesson.id)
        .join(Module, Module.id == Lesson.module_id)
        .where(Module.course_id.in_(granted_course_ids))
    )


async def has_access_to(
    *, user_id: UUID, resource_type: ResourceType, resource_id: UUID, session: AsyncSession
) -> bool:
    """Does any product this user holds grant access to this specific resource?"""
    product_ids = await resolve_product_ids(user_id=user_id, session=session)
    if not product_ids:
        return False

    result = await session.execute(
        select(ProductContent.id).where(
            ProductContent.product_id.in_(product_ids),
            ProductContent.content_type == resource_type.value,
            ProductContent.content_id == resource_id,
        )
    )
    if result.first() is not None:
        return True

    # A lesson is also granted by owning the course it belongs to — see
    # `_lessons_of_granted_courses`. Checked second so the common case (an explicit row)
    # still answers in one query.
    if resource_type is ResourceType.LESSON:
        via_course = await session.execute(
            _lessons_of_granted_courses(product_ids).where(Lesson.id == resource_id)
        )
        return via_course.first() is not None

    return False


async def resolve_granted_content_ids(
    *, product_ids: set[UUID], resource_type: ResourceType, session: AsyncSession
) -> set[UUID]:
    """Every content_id of `resource_type` granted by any of `product_ids`, in ONE query.

    The bulk twin of `has_access_to`. A route that needs to check ownership across many
    resources (every lesson in a course catalogue, every related lesson on a question,
    every template on the templates page) used to call `has_access_to` once per
    resource — each call re-running `resolve_product_ids` and issuing its own
    `product_contents` query, an N+1 round trip pattern that dominates latency once a
    request crosses a network boundary to Postgres (each round trip here costs on the
    order of hundreds of ms; see the perf notes in courses.py/templates.py/questions.py).

    Callers resolve `product_ids` ONCE via `resolve_product_ids`, then call this once
    per resource type; membership after that is a Python set lookup, not a query.
    """
    if not product_ids:
        return set()
    result = await session.execute(
        select(ProductContent.content_id).where(
            ProductContent.product_id.in_(product_ids),
            ProductContent.content_type == resource_type.value,
        )
    )
    granted = set(result.scalars().all())

    # Lessons are additionally granted by owning their course, so a lesson added after
    # purchase unlocks for existing buyers without a backfill — see
    # `_lessons_of_granted_courses`. One extra query for the whole set, preserving this
    # function's fixed-query-count contract.
    if resource_type is ResourceType.LESSON:
        via_course = await session.execute(_lessons_of_granted_courses(product_ids))
        granted |= set(via_course.scalars().all())

    return granted


async def has_access_to_or_admin(
    *, user: User, resource_type: ResourceType, resource_id: UUID, session: AsyncSession
) -> bool:
    """The same admin-bypass-with-audit semantics as `require_entitlement`'s dependency
    below, for the handful of routes that resolve their entitlement check inline instead
    of through that factory — `app/api/v1/content/lessons.py`'s playback-token,
    download-url and complete routes, and `templates.py`'s download-url route.

    Those routes call `has_access_to` directly, which has no concept of role — without
    this, an admin with no purchase gets the same 403 as any unentitled member and never
    reaches the audited bypass path, since the audit write lives only inside
    `require_entitlement`'s closure. This is `BACKEND.md` §1.1's "dispersion" failure
    mode. A full migration onto the `require_entitlement` dependency factory is follow-up
    work: it expects a path parameter literally named `resource_id`, which none of these
    routes use. This closes the audit gap without that renaming.
    """
    if user.role == Role.ADMIN:
        await record_admin_bypass(session, actor=user, resource_type=resource_type.value, resource_id=resource_id)
        return True
    return await has_access_to(
        user_id=user.id, resource_type=resource_type, resource_id=resource_id, session=session
    )


def require_entitlement(resource_type: ResourceType):
    """FastAPI dependency factory. The ONLY way a gated route is protected.

    Usage:
        @router.post("/lessons/{resource_id}/playback-token")
        async def get_playback_token(
            resource_id: UUID = Depends(require_entitlement(ResourceType.LESSON)),
            ...
        ):
            ...

    Route path parameters used this way must be named `resource_id` for FastAPI to
    bind them into this dependency.
    """

    async def _dep(
        resource_id: UUID,
        user: User = Depends(get_current_user),
        session: AsyncSession = Depends(get_session),
    ) -> UUID:
        if user.role == Role.ADMIN:
            # BACKEND.md §4.3: "no admin bypass without an audit row." Runs before the
            # endpoint does anything else (§4.1), same as the entitlement check it
            # replaces — an admin reading gated content must leave a trace whether or
            # not they hold the underlying entitlement.
            await record_admin_bypass(
                session, actor=user, resource_type=resource_type.value, resource_id=resource_id
            )
            return resource_id
        if not await has_access_to(
            user_id=user.id, resource_type=resource_type, resource_id=resource_id, session=session
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": {
                        "code": "not_entitled",
                        "message": "This content is part of a product you don't have yet.",
                    }
                },
            )
        return resource_id

    return _dep
