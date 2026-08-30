from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user, get_current_user_id, require_recent_reauth
from app.core.entitlements import resolve_product_ids
from app.core.rate_limit import RateLimiter
from app.integrations.stripe_client import create_refund
from app.services.email_service import send_refund_confirmation_email
from app.services.refund_service import apply_refund
from app.services.account_service import deactivate_user
import stripe as stripe_sdk
from app.db.models import (
    Certificate,
    Course,
    CourseProgress,
    Domain,
    Entitlement,
    Lesson,
    LessonProgress,
    Module,
    Notification,
    Order,
    OrderItem,
    OrderStatus,
    ProductContent,
    Question,
    Role,
    Template,
    User,
)
from app.db.session import get_session
from app.services.audit_service import record_audit
from app.services.email_service import send_security_alert_email, send_account_closure_email
import json
import uuid

router = APIRouter()


class EntitlementsOut(BaseModel):
    product_ids: list[str]


class ProfileOut(BaseModel):
    id: str
    email: str
    name: Optional[str]
    role: str
    is_admin: bool


@router.get("/me/profile", response_model=ProfileOut)
async def get_my_profile(user: User = Depends(get_current_user)):
    """The signed-in user's own profile, including role.

    `is_admin` only tells the frontend whether to render the Admin link. It is never a
    control: every /admin/* route is independently guarded by require_admin server-side.
    """
    return ProfileOut(
        id=str(user.id), email=user.email, name=user.name,
        role=user.role.value if hasattr(user.role, "value") else str(user.role),
        is_admin=user.role == Role.ADMIN,
    )


@router.get("/me/entitlements", response_model=EntitlementsOut)
async def get_my_entitlements(
    session: AsyncSession = Depends(get_session),
    user_id: str = Depends(get_current_user_id),
):
    """Every product the user currently holds. The checkout success page polls this after
    a Stripe redirect, since the webhook can land after the user is already back."""
    product_ids = await resolve_product_ids(user_id=uuid.UUID(user_id), session=session)
    return EntitlementsOut(product_ids=[str(pid) for pid in product_ids])


# ─────────────────────────────────────────────────────────────────────────────
# My Library — purchased items across all content types, with progress and resume.
# One endpoint, not three, so the page needn't reassemble separate fetches. Derives
# from entitlements → products → product_contents.
# ─────────────────────────────────────────────────────────────────────────────


class LibraryCourseOut(BaseModel):
    kind: Literal["course"] = "course"
    slug: str
    title: str
    subtitle: Optional[str]
    total_lessons: int
    completed_lessons: int
    percentage_complete: int
    estimated_duration_minutes: Optional[int] = None
    # The next lesson to open; None means everything owned is complete. Counts only
    # entitled lessons, so a partially-owned course reports progress against what was
    # bought rather than stranding the user below 100% with no way to finish.
    resume_lesson_slug: Optional[str]
    resume_lesson_title: Optional[str]


class LibraryTemplateOut(BaseModel):
    kind: Literal["template"] = "template"
    id: str
    slug: str
    title: str
    description: str
    file_name: str


class LibraryReferenceOut(BaseModel):
    kind: Literal["reference"] = "reference"
    slug: str
    title: str
    domain: str


class LibraryOut(BaseModel):
    courses: list[LibraryCourseOut]
    templates: list[LibraryTemplateOut]
    reference: list[LibraryReferenceOut]
    # Lets the page distinguish "you haven't bought anything yet" from a load failure.
    is_empty: bool


@router.get("/me/library", response_model=LibraryOut)
async def get_my_library(
    session: AsyncSession = Depends(get_session),
    user_id: str = Depends(get_current_user_id),
):
    """Everything this user has bought, grouped by content type, with course progress
    and a resume point."""
    uid = uuid.UUID(user_id)
    product_ids = await resolve_product_ids(user_id=uid, session=session)
    if not product_ids:
        return LibraryOut(courses=[], templates=[], reference=[], is_empty=True)

    # One query for every grant across every product the user holds, then bucket by
    # content_type in Python — cheaper and simpler than three near-identical queries.
    grants = await session.execute(
        select(ProductContent.content_type, ProductContent.content_id).where(
            ProductContent.product_id.in_(product_ids)
        )
    )
    owned: dict[str, set[uuid.UUID]] = {}
    for content_type, content_id in grants.all():
        owned.setdefault(content_type, set()).add(content_id)

    # ── Courses, reached through the lessons the user owns ───────────────────────
    # A course is "in your library" when you own at least one of its lessons — products
    # grant lessons, not courses.
    courses: list[LibraryCourseOut] = []
    owned_lesson_ids = owned.get("lesson", set())
    if owned_lesson_ids:
        rows = (
            await session.execute(
                select(Lesson, Module, Course)
                .join(Module, Module.id == Lesson.module_id)
                .join(Course, Course.id == Module.course_id)
                .where(
                    Lesson.id.in_(owned_lesson_ids),
                    Lesson.published.is_(True),
                    Course.published.is_(True),
                )
                .order_by(Module.sort_order, Lesson.sort_order)
            )
        ).all()

        completed_ids = set(
            (
                await session.execute(
                    select(LessonProgress.lesson_id).where(
                        LessonProgress.user_id == uid,
                        LessonProgress.lesson_id.in_(owned_lesson_ids),
                        LessonProgress.completed.is_(True),
                    )
                )
            )
            .scalars()
            .all()
        )

        # Rows arrive already ordered by module then lesson, so the first incomplete
        # lesson encountered per course IS the resume point — no second sort needed.
        by_course: dict[uuid.UUID, dict] = {}
        for lesson, _module, course in rows:
            entry = by_course.setdefault(
                course.id,
                {"course": course, "total": 0, "done": 0, "resume": None},
            )
            entry["total"] += 1
            if lesson.id in completed_ids:
                entry["done"] += 1
            elif entry["resume"] is None:
                entry["resume"] = lesson

        for entry in by_course.values():
            course, total, done = entry["course"], entry["total"], entry["done"]
            resume = entry["resume"]
            # Estimated time remaining: authored duration × (remaining / total)
            time_left = None
            if course.estimated_duration_minutes and total:
                remaining = total - done
                time_left = max(1, course.estimated_duration_minutes * remaining // total)
            courses.append(
                LibraryCourseOut(
                    slug=course.slug,
                    title=course.title,
                    subtitle=course.subtitle,
                    total_lessons=total,
                    completed_lessons=done,
                    # Floored, so 100% is never reached by rounding.
                    percentage_complete=(done * 100 // total) if total else 0,
                    estimated_duration_minutes=course.estimated_duration_minutes,
                    resume_lesson_slug=resume.slug if resume else None,
                    resume_lesson_title=resume.title if resume else None,
                )
            )
        courses.sort(key=lambda c: c.title)

    # ── Templates ────────────────────────────────────────────────────────────────
    templates: list[LibraryTemplateOut] = []
    if owned.get("template"):
        rows = (
            (
                await session.execute(
                    select(Template)
                    .where(Template.id.in_(owned["template"]), Template.published.is_(True))
                    .order_by(Template.title)
                )
            )
            .scalars()
            .all()
        )
        templates = [
            LibraryTemplateOut(
                id=str(t.id), slug=t.slug, title=t.title,
                description=t.description, file_name=t.file_name,
            )
            for t in rows
        ]

    # ── Reference (question_set grants) ──────────────────────────────────────────
    # Question bodies are free to read for everyone, so this is not an access list —
    # it's the record of what a purchase included.
    reference: list[LibraryReferenceOut] = []
    if owned.get("question_set"):
        rows = (
            await session.execute(
                select(Question, Domain)
                .join(Domain, Domain.id == Question.domain_id)
                .where(Question.id.in_(owned["question_set"]), Question.published.is_(True))
                .order_by(Question.title)
            )
        ).all()
        reference = [
            LibraryReferenceOut(slug=q.slug, title=q.title, domain=d.name) for q, d in rows
        ]

    return LibraryOut(
        courses=courses,
        templates=templates,
        reference=reference,
        is_empty=not (courses or templates or reference),
    )


# ─────────────────────────────────────────────────────────────────────────────
# Buyer-initiated refunds
# ─────────────────────────────────────────────────────────────────────────────

REFUND_KEEP_PERCENT = Decimal('15')  # The buyer keeps 15%; we refund 85%


class OrderItemOut(BaseModel):
    product_id: str
    product_name: str
    price_amount_cents: int


class OrderOut(BaseModel):
    id: str
    created_at: datetime
    status: str
    total_amount_cents: int
    currency: str
    items: list[OrderItemOut]
    buyer_refund_amount_cents: Optional[int] = None
    buyer_refunded_at: Optional[datetime] = None


class OrdersOut(BaseModel):
    orders: list[OrderOut]
    has_more: bool
    # The cursor to request the next page with; without it has_more is not actionable.
    next_cursor: Optional[str] = None


@router.get("/me/orders", response_model=OrdersOut)
async def get_my_orders(
    session: AsyncSession = Depends(get_session),
    user_id: str = Depends(get_current_user_id),
    cursor: Optional[str] = None,
    limit: int = 20,
):
    """Buyer's own orders, keyset-paginated. Returns items + refund fields.

    The cursor is a row-value comparison `(created_at, id) < (:cursor_created_at,
    :cursor_id)` with `id` as the tiebreak, so two orders sharing a timestamp are
    ordered totally and a tied batch is never silently skipped.
    """
    uid = uuid.UUID(user_id)
    q = (
        select(Order)
        .options(selectinload(Order.items))
        .where(Order.user_id == uid)
        .order_by(Order.created_at.desc(), Order.id.desc())
        .limit(limit + 1)
    )
    if cursor:
        cursor_created_at, _, cursor_id = cursor.partition("|")
        try:
            parsed_created_at = datetime.fromisoformat(cursor_created_at)
            parsed_id = uuid.UUID(cursor_id)
        except ValueError:
            # Malformed cursor — ignore and return from the start, same graceful
            # degradation admin/orders.py uses for the same failure mode.
            parsed_created_at = None
        if parsed_created_at is not None:
            q = q.where(
                tuple_(Order.created_at, Order.id) < (parsed_created_at, parsed_id)
            )
    result = await session.execute(q)
    rows = list(result.scalars().unique().all())
    has_more = len(rows) > limit
    if has_more:
        rows = rows[:limit]

    # Resolve product names in bulk
    product_ids = set()
    for row in rows:
        for item in row.items:
            product_ids.add(item.product_id)
    product_names: dict[uuid.UUID, str] = {}
    if product_ids:
        from app.db.models import Product
        name_result = await session.execute(
            select(Product.id, Product.name).where(Product.id.in_(product_ids))
        )
        product_names = {row[0]: row[1] for row in name_result.all()}

    orders = []
    for row in rows:
        items = [
            OrderItemOut(
                product_id=str(item.product_id),
                product_name=product_names.get(item.product_id, "Unknown"),
                price_amount_cents=item.price_amount_cents,
            )
            for item in row.items
        ]
        orders.append(OrderOut(
            id=str(row.id),
            created_at=row.created_at,
            status=row.status.value if hasattr(row.status, 'value') else str(row.status),
            total_amount_cents=row.total_amount_cents,
            currency=row.currency,
            items=items,
            buyer_refund_amount_cents=row.buyer_refund_amount_cents,
            buyer_refunded_at=row.buyer_refunded_at,
        ))

    next_cursor = None
    if has_more and rows:
        last = rows[-1]
        next_cursor = f"{last.created_at.isoformat()}|{last.id}"

    return OrdersOut(orders=orders, has_more=has_more, next_cursor=next_cursor)


class ReceiptLineOut(BaseModel):
    product_name: str
    price_amount_cents: int


class ReceiptOut(BaseModel):
    """No Stripe invoice id is persisted on `orders` — it only reaches the one-shot
    receipt email (webhooks.py), never saved. This receipt is regenerated from the
    order row alone and omits invoice_number entirely rather than fabricating one."""

    order_id: str
    order_date: datetime
    status: str
    currency: str
    total_amount_cents: int
    lines: list[ReceiptLineOut]
    buyer_refund_amount_cents: Optional[int] = None
    buyer_refunded_at: Optional[datetime] = None
    seller_legal_name: Optional[str] = None


@router.get("/me/orders/{order_id}/receipt", response_model=ReceiptOut)
async def get_order_receipt(
    order_id: str,
    session: AsyncSession = Depends(get_session),
    user_id: str = Depends(get_current_user_id),
):
    """A receipt for one of the caller's own orders, regenerated from order data —
    scoped strictly to the requesting user's own order, matching every other /me/*
    row-ownership check in this file."""
    try:
        oid = uuid.UUID(order_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Order not found")

    uid = uuid.UUID(user_id)
    result = await session.execute(
        select(Order)
        .options(selectinload(Order.items))
        .where(Order.id == oid, Order.user_id == uid)
    )
    order = result.scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")

    from app.db.models import Product

    product_ids = {item.product_id for item in order.items}
    product_names: dict[uuid.UUID, str] = {}
    if product_ids:
        name_result = await session.execute(
            select(Product.id, Product.name).where(Product.id.in_(product_ids))
        )
        product_names = {row[0]: row[1] for row in name_result.all()}

    from app.core.config import settings

    return ReceiptOut(
        order_id=str(order.id),
        order_date=order.created_at,
        status=order.status.value if hasattr(order.status, "value") else str(order.status),
        currency=order.currency,
        total_amount_cents=order.total_amount_cents,
        lines=[
            ReceiptLineOut(
                product_name=product_names.get(item.product_id, "Unknown"),
                price_amount_cents=item.price_amount_cents,
            )
            for item in order.items
        ],
        buyer_refund_amount_cents=order.buyer_refund_amount_cents,
        buyer_refunded_at=order.buyer_refunded_at,
        seller_legal_name=settings.seller_legal_name or None,
    )


class RefundEligibilityOut(BaseModel):
    eligible: bool
    refund_amount_cents: Optional[int] = None
    kept_amount_cents: Optional[int] = None
    progress_percent: Optional[int] = None
    reason_code: Optional[str] = None


# Rate-limited per user, in memory, no IP stored — same RateLimiter shared by the
# account-security endpoints below in this file.
_refund_rate_limiter = RateLimiter(window_seconds=60, max_requests=5)


def _compute_refund_amount(total_cents: int) -> tuple[int, int]:
    """Compute refund and kept amounts.

    Refund = total - round_half_up(total × 15 / 100).
    Tested against non-round totals: A$9.90 keeps A$1.49, refunds A$8.41.
    """
    total = Decimal(str(total_cents))
    keep = (total * REFUND_KEEP_PERCENT / Decimal('100')).quantize(Decimal('1'), rounding=ROUND_HALF_UP)
    refund = total - keep
    return int(refund), int(keep)


async def _resolve_course_ids(session: AsyncSession, product_ids: list[uuid.UUID]) -> list[uuid.UUID]:
    """Every course reachable from these products — directly OR through their lessons.

    `product_contents` is polymorphic: a course product may enumerate its lessons
    instead of a `course` row, and on the live catalogue that is the common case. So
    resolving through `lesson -> module -> course` (the real ownership chain; `lessons`
    has no `course_id` of its own) is needed to cover both shapes.

    Returns a de-duplicated list: a product carrying BOTH a direct course row and that
    course's lessons must not count the course twice, or `func.max(progress)` would be
    computed over a multiset and any later `count`-based rule would be wrong.
    """
    if not product_ids:
        return []

    direct = await session.execute(
        select(ProductContent.content_id).where(
            ProductContent.product_id.in_(product_ids),
            ProductContent.content_type == "course",
        )
    )

    # `lessons.module_id -> modules.course_id`. There is no `lessons.course_id`.
    via_lessons = await session.execute(
        select(Module.course_id)
        .select_from(ProductContent)
        .join(Lesson, Lesson.id == ProductContent.content_id)
        .join(Module, Module.id == Lesson.module_id)
        .where(
            ProductContent.product_id.in_(product_ids),
            ProductContent.content_type == "lesson",
        )
    )

    seen: dict[uuid.UUID, None] = {}
    for course_id in list(direct.scalars().all()) + list(via_lessons.scalars().all()):
        if course_id is not None:
            seen.setdefault(course_id, None)
    return list(seen)


@router.get("/me/orders/{order_id}/refund-eligibility", response_model=RefundEligibilityOut)
async def get_refund_eligibility(
    order_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user_id: str = Depends(get_current_user_id),
):
    """Server decides eligibility. Client only renders.

    Eligible when: order is completed, not already refunded, has >= 1 course,
    and max(progress) <= 15%.
    """
    uid = uuid.UUID(user_id)
    result = await session.execute(
        select(Order).options(selectinload(Order.items)).where(
            Order.id == order_id,
            Order.user_id == uid,
        )
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found.")

    if order.status == OrderStatus.REFUNDED or order.buyer_refunded_at is not None:
        return RefundEligibilityOut(eligible=False, reason_code="already_refunded")

    if order.status != OrderStatus.COMPLETED:
        return RefundEligibilityOut(eligible=False, reason_code="order_not_completed")

    # Check if the order contains at least one course — directly or via its lessons.
    # See `_resolve_course_ids` for why the direct-row-only version was wrong for nine
    # of the ten products in the live catalogue.
    product_ids = [item.product_id for item in order.items]
    course_ids = await _resolve_course_ids(session, product_ids)
    if not course_ids:
        return RefundEligibilityOut(eligible=False, reason_code="no_course_in_order")

    # Check max progress across all courses in the order
    progress_result = await session.execute(
        select(func.max(CourseProgress.percentage_complete)).where(
            CourseProgress.user_id == uid,
            CourseProgress.course_id.in_(course_ids),
        )
    )
    max_progress = progress_result.scalar_one_or_none() or 0

    if max_progress > 15:
        return RefundEligibilityOut(
            eligible=False,
            reason_code="progress_exceeded",
            progress_percent=max_progress,
        )

    refund_amount, kept_amount = _compute_refund_amount(order.total_amount_cents)
    return RefundEligibilityOut(
        eligible=True,
        refund_amount_cents=refund_amount,
        kept_amount_cents=kept_amount,
        progress_percent=max_progress,
    )


class RefundRequestIn(BaseModel):
    reason_code: str = Field(min_length=1, max_length=50)
    reason_text: Optional[str] = Field(default=None, max_length=500)


class RefundRequestOut(BaseModel):
    order_id: str
    status: str
    refund_amount_cents: int
    kept_amount_cents: int
    message: str


@router.post("/me/orders/{order_id}/refund", response_model=RefundRequestOut)
async def request_refund(
    order_id: uuid.UUID,
    payload: RefundRequestIn,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Buyer-initiated partial refund. Single-flight: check-and-set order status
    inside one transaction before calling Stripe, so a double-clicked button
    cannot issue two refunds (the second request 409s before it reaches Stripe).

    The partial refund is issued via the same `create_refund` the admin path uses,
    then `apply_refund` runs here rather than waiting on the `charge.refunded`
    webhook round trip; the webhook replay of the same event is a no-op via
    `apply_refund`'s idempotency on `order.status`.
    """
    if not _refund_rate_limiter.allow(str(user.id), "self_serve_refund"):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many refund requests. Please try again in a minute.",
        )

    result = await session.execute(
        select(Order).options(selectinload(Order.items)).where(
            Order.id == order_id,
            Order.user_id == user.id,
        )
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found.")

    if order.status == OrderStatus.REFUNDED or order.buyer_refunded_at is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This order has already been refunded.",
        )

    if order.status != OrderStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only completed orders can be refunded.",
        )

    # Re-check eligibility server-side through the SAME resolver the GET uses, so a GET
    # saying "eligible" is never followed by a POST refusing it.
    product_ids = [item.product_id for item in order.items]
    course_ids = await _resolve_course_ids(session, product_ids)
    if not course_ids:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This order doesn't include a course. Contact us and we'll sort it out.",
        )

    progress_result = await session.execute(
        select(func.max(CourseProgress.percentage_complete)).where(
            CourseProgress.user_id == user.id,
            CourseProgress.course_id.in_(course_ids),
        )
    )
    max_progress = progress_result.scalar_one_or_none() or 0
    if max_progress > 15:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"You've completed {max_progress}% of this course — past the 15% point where change-of-mind refunds apply.",
        )

    if not order.stripe_payment_intent_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This order has no payment to refund.",
        )

    refund_amount, kept_amount = _compute_refund_amount(order.total_amount_cents)

    # Single-flight: set status BEFORE calling Stripe, and commit it — so a
    # double-clicked button's second request reads buyer_refunded_at already set
    # (the check near the top of this function) and 409s before either request
    # reaches Stripe a second time.
    now = datetime.now(timezone.utc)
    order.buyer_refund_amount_cents = refund_amount
    order.buyer_refunded_at = now
    order.buyer_refund_reason_code = payload.reason_code
    order.buyer_refund_reason_text = payload.reason_text
    # Don't set status=REFUNDED yet — apply_refund (below, or the charge.refunded
    # webhook replay of the same event) does that once the refund is confirmed.
    await session.commit()

    try:
        create_refund(payment_intent_id=order.stripe_payment_intent_id, amount=refund_amount)
    except stripe_sdk.StripeError as e:
        # Without this rollback, a declined Stripe call would leave buyer_refunded_at
        # permanently set with no refund issued — the buyer's one shot at self-serve
        # silently consumed. Undo the single-flight lock so they can retry.
        order.buyer_refund_amount_cents = None
        order.buyer_refunded_at = None
        order.buyer_refund_reason_code = None
        order.buyer_refund_reason_text = None
        await session.commit()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Stripe declined the refund: {e.user_message or str(e)}",
        )

    # Applied here rather than waiting on the webhook round trip — same pattern the
    # admin endpoint uses, so the buyer isn't left on a spinner for an event that may
    # take a moment to arrive. The webhook's own replay of charge.refunded for this
    # same event is a no-op: apply_refund is idempotent on order.status.
    result = await apply_refund(
        session, order=order, reason=f"Buyer self-serve refund: {payload.reason_code}", actor=user,
    )
    await session.commit()

    await record_audit(
        session,
        actor=user,
        action="buyer_refund_requested",
        target_type="order",
        target_id=order.id,
        context={
            "refund_amount_cents": refund_amount,
            "kept_amount_cents": kept_amount,
            "reason_code": payload.reason_code,
        },
    )
    await session.commit()

    if not result.already_refunded:
        await send_refund_confirmation_email(
            to_email=user.email,
            order_id=str(order.id),
            amount_cents=refund_amount,
            currency=order.currency,
            removed_items=[p.name for p in result.revoked_products],
        )

    return RefundRequestOut(
        order_id=str(order.id),
        status="refunded",
        refund_amount_cents=refund_amount,
        kept_amount_cents=kept_amount,
        message=f"Refunded {order.currency} {refund_amount / 100:.2f}. Access has ended.",
    )


# ─────────────────────────────────────────────────────────────────────────────
# Account management
# ─────────────────────────────────────────────────────────────────────────────

_account_rate_limiter = RateLimiter(window_seconds=60, max_requests=10)


# ── Profile (name update) ──────────────────────────────────────────────────


class ProfileUpdateIn(BaseModel):
    full_name: str = Field(min_length=1, max_length=100)


class ProfileUpdateOut(BaseModel):
    id: str
    email: str
    name: Optional[str]


@router.patch("/me/profile", response_model=ProfileUpdateOut)
async def update_my_profile(
    payload: ProfileUpdateIn,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Update the user's display name. The first PATCH in /me — follows the
    response-model conventions already established by GET /me/profile."""
    full_name = payload.full_name.strip()
    if not full_name:
        raise HTTPException(
            status_code=422,
            detail={"error": {"code": "name_required", "message": "Name cannot be empty."}},
        )

    previous_name = user.name or ""
    user.name = full_name
    await record_audit(
        session,
        actor=user,
        action="profile_name_updated",
        target_type="user",
        target_id=user.id,
        context={"name": full_name},
    )
    await session.commit()

    # The security alert fires on name, email AND password change: changing the
    # display name is an early move in an account takeover, so it gets the same
    # alert. Best-effort and after commit, the same shape the password path uses: a
    # failed side-effect email must never undo an already-committed change (BACKEND.md §6.1).
    if previous_name != full_name:
        try:
            await send_security_alert_email(
                to_email=user.email,
                action="Name changed",
                details=(
                    "Your display name was changed"
                    + (' from "' + previous_name + '"' if previous_name else "")
                    + ' to "' + full_name + '". If this wasn\'t you, contact us immediately.'
                ),
            )
        except Exception:
            pass  # Never fail the request for a side-effect email

    return ProfileUpdateOut(
        id=str(user.id),
        email=user.email,
        name=user.name,
    )


# ── Notification preferences ───────────────────────────────────────────────


class NotificationsIn(BaseModel):
    notify_marketing: bool = False
    notify_product_updates: bool = True
    notify_sound: bool = True


class NotificationPrefsOut(BaseModel):
    notify_marketing: bool
    notify_product_updates: bool
    notify_sound: bool


@router.get("/me/account/notifications", response_model=NotificationPrefsOut)
async def get_notification_preferences(
    user: User = Depends(get_current_user),
):
    """Read the current notification preferences."""
    return NotificationPrefsOut(
        notify_marketing=user.notify_marketing,
        notify_product_updates=user.notify_product_updates,
        notify_sound=getattr(user, "notify_sound", True),
    )


@router.patch("/me/account/notifications", response_model=NotificationPrefsOut)
async def update_notification_preferences(
    payload: NotificationsIn,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Update notification preferences. Transactional mail (receipt, access
    granted, password reset, security alerts) is NEVER gated by these flags."""
    user.notify_marketing = payload.notify_marketing
    user.notify_product_updates = payload.notify_product_updates
    if hasattr(user, "notify_sound"):
        user.notify_sound = payload.notify_sound
    await record_audit(
        session,
        actor=user,
        action="notification_preferences_updated",
        target_type="user",
        target_id=user.id,
        context={
            "notify_marketing": payload.notify_marketing,
            "notify_product_updates": payload.notify_product_updates,
            "notify_sound": payload.notify_sound,
        },
    )
    await session.commit()

    return NotificationPrefsOut(
        notify_marketing=user.notify_marketing,
        notify_product_updates=user.notify_product_updates,
        notify_sound=getattr(user, "notify_sound", True),
    )


# ── Password change (audit hook) ───────────────────────────────────────────


class PasswordChangeHookIn(BaseModel):
    """The frontend calls supabase.auth.updateUser({ password }) directly.
    After success, it calls this endpoint to write an audit row — the one thing
    Supabase-side changes never reach."""


@router.post("/me/account/password-change")
async def record_password_change(
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Write an audit row for a password change. The actual password update
    happens client-side via Supabase; this is the audit hook only."""
    if not _account_rate_limiter.allow(str(user.id), action="password_change"):
        raise HTTPException(
            status_code=429,
            detail={"error": {"code": "rate_limited", "message": "Too many requests. Try again in a minute."}},
        )

    await record_audit(
        session,
        actor=user,
        action="password_changed",
        target_type="user",
        target_id=user.id,
    )
    await session.commit()

    # Fire security alert email — best-effort, must not fail the request
    try:
        await send_security_alert_email(
            to_email=user.email,
            action="Password changed",
            details="If this wasn't you, contact us immediately.",
        )
    except Exception:
        pass  # Never fail the request for a side-effect email

    return {"ok": True}


# ── Email change (audit hook) ──────────────────────────────────────────────


class EmailChangeHookIn(BaseModel):
    new_email: str = Field(min_length=1)


@router.post("/me/account/email-changed")
async def record_email_change(
    payload: EmailChangeHookIn,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """After Supabase confirms the new email, the frontend calls this to:
    1. Sync users.email with the confirmed address
    2. Write an audit row
    3. Fire the security alert email"""
    if not _account_rate_limiter.allow(str(user.id), action="email_change"):
        raise HTTPException(
            status_code=429,
            detail={"error": {"code": "rate_limited", "message": "Too many requests. Try again in a minute."}},
        )

    user.email = payload.new_email
    await record_audit(
        session,
        actor=user,
        action="email_changed",
        target_type="user",
        target_id=user.id,
        context={"new_email": payload.new_email},
    )
    await session.commit()

    try:
        await send_security_alert_email(
            to_email=payload.new_email,
            action="Email address changed",
            details="If this wasn't you, contact us immediately.",
        )
    except Exception:
        pass

    return {"ok": True}


# ── Data export ────────────────────────────────────────────────────────────


@router.post("/me/account/export")
async def export_my_data(
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Build JSON of the user's own data — profile, orders, entitlements,
    lesson progress, notification preferences. Scoped strictly to the
    requester; a test asserts no foreign rows.

    This is the Privacy Act / GDPR data-subject right: it must produce a real
    file, not a stub."""
    if not _account_rate_limiter.allow(str(user.id), action="export"):
        raise HTTPException(
            status_code=429,
            detail={"error": {"code": "rate_limited", "message": "Too many requests. Try again in a minute."}},
        )

    # Profile
    profile = {
        "id": str(user.id),
        "email": user.email,
        "name": user.name,
        "role": user.role.value if hasattr(user.role, "value") else str(user.role),
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "last_sign_in_at": user.last_sign_in_at.isoformat() if user.last_sign_in_at else None,
    }

    # Orders
    orders_result = await session.execute(
        select(Order).options(selectinload(Order.items)).where(Order.user_id == user.id)
    )
    orders = []
    for order in orders_result.scalars().unique().all():
        orders.append({
            "id": str(order.id),
            "created_at": order.created_at.isoformat() if order.created_at else None,
            "status": order.status.value if hasattr(order.status, "value") else str(order.status),
            "total_amount_cents": order.total_amount_cents,
            "currency": order.currency,
            "buyer_refund_amount_cents": order.buyer_refund_amount_cents,
            "buyer_refunded_at": order.buyer_refunded_at.isoformat() if order.buyer_refunded_at else None,
            "items": [
                {
                    "product_id": str(item.product_id),
                    "price_amount_cents": item.price_amount_cents,
                }
                for item in order.items
            ],
        })

    # Entitlements
    from app.db.models import Entitlement as EntitlementModel
    ent_result = await session.execute(
        select(EntitlementModel).where(EntitlementModel.user_id == user.id)
    )
    entitlements = [
        {
            "product_id": str(e.product_id),
            "granted_at": e.created_at.isoformat() if e.created_at else None,
            "revoked_at": e.revoked_at.isoformat() if e.revoked_at else None,
        }
        for e in ent_result.scalars().all()
    ]

    # Lesson progress
    prog_result = await session.execute(
        select(LessonProgress).where(LessonProgress.user_id == user.id)
    )
    progress = [
        {
            "lesson_id": str(p.lesson_id),
            "completed": p.completed,
            "completed_at": p.completed_at.isoformat() if p.completed_at else None,
        }
        for p in prog_result.scalars().all()
    ]

    export_data = {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "profile": profile,
        "orders": orders,
        "entitlements": entitlements,
        "lesson_progress": progress,
        "notification_preferences": {
            "notify_marketing": user.notify_marketing,
            "notify_product_updates": user.notify_product_updates,
        },
    }

    await record_audit(
        session,
        actor=user,
        action="data_exported",
        target_type="user",
        target_id=user.id,
    )
    await session.commit()

    return export_data


# ── Account closure (deactivation) ─────────────────────────────────────────


class AccountCloseIn(BaseModel):
    """Closure requires the current password, verified client-side via
    supabase.auth.signInWithPassword immediately before calling this endpoint —
    require_recent_reauth then checks server-side that the JWT actually is the
    fresh one that call produces, not an older stolen/replayed token."""


@router.post("/me/account/close")
async def close_my_account(
    session: AsyncSession = Depends(get_session),
    user: User = Depends(require_recent_reauth),
):
    """Deactivate the current user's account via the shared `deactivate_user`
    service (app/services/account_service.py) — setting disabled_at, which the
    entitlements gate already filters on (core/entitlements.py:53).

    Depends on require_recent_reauth (core/deps.py) so the password gate is
    enforced server-side via the fresh `iat` Supabase's reauth call produces, not
    left to the frontend to call signInWithPassword first. admin/users.py's
    deactivation path calls the same `deactivate_user` service.

    This is deactivation, never hard delete: financial records must survive 7
    years, and orders.user_id is a non-nullable FK."""
    if not _account_rate_limiter.allow(str(user.id), action="close_account"):
        raise HTTPException(
            status_code=429,
            detail={"error": {"code": "rate_limited", "message": "Too many requests. Try again in a minute."}},
        )

    if user.disabled_at is not None:
        raise HTTPException(
            status_code=409,
            detail={"error": {"code": "already_closed", "message": "Your account is already closed."}},
        )

    await deactivate_user(session, user=user, actor=user, action="account_closed_self")
    await session.commit()

    # Confirmation email — best-effort
    try:
        await send_account_closure_email(to_email=user.email)
    except Exception:
        pass

    return {"ok": True, "message": "Your account is closed. Contact us any time to restore it."}


# ── Certificates ────────────────────────────────────────────


class CertificateOut(BaseModel):
    id: str
    course_title: str
    issued_at: str
    verification_code: str
    revoked: bool


@router.get("/me/certificates", response_model=list[CertificateOut])
async def list_certificates(
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """The learner's certificates. One query, on ix_certificates_user."""
    result = await session.execute(
        select(Certificate)
        .where(Certificate.user_id == user.id)
        .order_by(Certificate.issued_at.desc())
    )
    certs = result.scalars().all()
    return [
        CertificateOut(
            id=str(c.id),
            course_title=c.course_title_snapshot,
            issued_at=c.issued_at.isoformat() if hasattr(c.issued_at, 'isoformat') else str(c.issued_at),
            verification_code=c.verification_code,
            revoked=c.revoked_at is not None,
        )
        for c in certs
    ]


@router.get("/me/certificates/{certificate_id}/download")
async def download_certificate(
    certificate_id: str,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Download the certificate PDF. Renders on first call, then presigns.

    404, not 403, when the certificate belongs to someone else: a 403 confirms
    the id exists.
    """
    cert = (
        await session.execute(
            select(Certificate).where(Certificate.id == uuid.UUID(certificate_id))
        )
    ).scalar_one_or_none()
    if not cert or cert.user_id != user.id:
        raise HTTPException(status_code=404, detail="Certificate not found")
    if cert.revoked_at is not None:
        raise HTTPException(
            status_code=410,
            detail={"error": {"code": "revoked", "message": "This certificate has been revoked."}},
        )

    from app.services.certificate_pdf import get_certificate_pdf_url

    url = get_certificate_pdf_url(cert)
    await session.commit()  # persist pdf_storage_key if it was just set
    return {"download_url": url, "verification_code": cert.verification_code}


# ── #6: Notifications ────────────────────────────────────────────────────────


class NotificationOut(BaseModel):
    id: str
    notification_type: str
    entity_type: str
    entity_id: str
    title: str
    message: str
    read: bool
    created_at: datetime
    action_url: Optional[str] = None
    # Named `meta`, matching the column. `metadata` is reserved on SQLAlchemy's
    # declarative base and shadowing it here invited the same confusion on the API side
    # for no gain — the model already had to avoid the name for exactly this reason.
    meta: Optional[dict] = None


class NotificationsOut(BaseModel):
    notifications: list[NotificationOut]
    unread_count: int


@router.get("/me/notifications", response_model=NotificationsOut)
async def get_my_notifications(
    unread_only: bool = False,
    limit: int = 50,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Get notifications for the current user."""
    from app.services.notification_service import get_user_notifications

    notifications = await get_user_notifications(
        session=session,
        user_id=user.id,
        unread_only=unread_only,
        limit=limit,
    )

    # Count unread
    unread_result = await session.execute(
        select(func.count(Notification.id)).where(
            Notification.user_id == user.id,
            Notification.read.is_(False),
        )
    )
    unread_count = unread_result.scalar() or 0

    return NotificationsOut(
        notifications=[
            NotificationOut(
                id=str(n.id),
                notification_type=n.notification_type,
                entity_type=n.entity_type,
                entity_id=str(n.entity_id),
                title=n.title,
                message=n.message,
                read=n.read,
                created_at=n.created_at,
                action_url=n.action_url,
                meta=n.meta,
            )
            for n in notifications
        ],
        unread_count=unread_count,
    )


@router.post("/me/notifications/{notification_id}/read")
async def mark_notification_as_read(
    notification_id: str,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Mark a specific notification as read."""
    from app.services.notification_service import mark_notification_read

    success = await mark_notification_read(
        session=session,
        notification_id=uuid.UUID(notification_id),
        user_id=user.id,
    )

    if not success:
        raise HTTPException(status_code=404, detail="Notification not found")

    return {"ok": True}


@router.post("/me/notifications/read-all")
async def mark_all_notifications_as_read(
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Mark all notifications as read for the current user."""
    from app.services.notification_service import mark_all_notifications_read

    count = await mark_all_notifications_read(
        session=session,
        user_id=user.id,
    )

    return {"ok": True, "marked_read": count}
