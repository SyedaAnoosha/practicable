"""THE GATE. Read this file before touching any of app/api/v1/content/*.

BACKEND.md §1.1/§4: the entitlements table is the single source of truth for access,
and every gated resource passes through one dependency, in this one file. No route
reads `entitlements` directly, and no response model carries a gated field "filtered
in the route" — the response models in app/api/v1/content/questions.py already do
that structurally (QuestionPreviewOut has no `body` field at all).

A product grants access to whatever its `product_contents` rows point at — a
template file or a lesson's video/reading. One entitlement row per (user, product);
resolving that into "can this user see resource X" is this file's job, not a second
entitlements table per resource type.

`ResourceType.QUESTION` is the one exception worth flagging: a question's guidance
body is never gated (DESIGN.md §21.3, owner decision 2026-08-11 — it's the free
entry point, not the paid product). `has_access_to(..., ResourceType.QUESTION, ...)`
still exists and is still called from `questions.py`, but only to decide whether to
show the "buy the related template/course" upsell card versus the owned state —
never to decide whether `body` is present in the response. `body` is unconditional.
"""
import enum
from datetime import datetime, timezone
from uuid import UUID

from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.models import Entitlement, ProductContent, Role, User
from app.db.session import get_session


class ResourceType(str, enum.Enum):
    TEMPLATE = "template"
    LESSON = "lesson"
    QUESTION = "question_set"  # matches app/db/models/product.py's content_type values


async def resolve_product_ids(*, user_id: UUID, session: AsyncSession) -> set[UUID]:
    """Every product_id this user currently holds a non-expired entitlement for."""
    now = datetime.now(timezone.utc)
    result = await session.execute(
        select(Entitlement.product_id).where(
            Entitlement.user_id == user_id,
            (Entitlement.expires_at.is_(None)) | (Entitlement.expires_at > now),
        )
    )
    return set(result.scalars().all())


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
    return result.first() is not None


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
            return resource_id  # BACKEND.md §4: no admin bypass without an audit row —
            # not written yet, since no Week 1 route needs it; add one before relying
            # on this bypass for anything real.
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
