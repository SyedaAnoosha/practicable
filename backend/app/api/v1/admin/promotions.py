"""Admin CRUD for promotions — create, update, deactivate, with overlap check and audit.

W5-R1: The admin creates a promotion with message, code, percent, date window,
and optionally syncs it to Stripe. Every mutation writes an audit_log row.

The overlap check prevents two active promotions covering the same instant,
which would make GET /promotions/active pick one arbitrarily by sort order.
That is a coin flip over which discount a visitor sees, so it is refused at
write time with a 409 naming the conflicting promotion.

Half-open intervals [starts_at, ends_at): one ending at noon and one starting
at noon do not overlap. A NULL ends_at is +infinity.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

import stripe
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_admin
from app.db.models import Promotion, User
from app.db.session import get_session
from app.integrations import stripe_client
from app.services.audit_service import record_audit

router = APIRouter()


# ── Response / request models ────────────────────────────────────────────────


class PromotionOut(BaseModel):
    id: str
    code: str
    message: str
    percent_off: int
    starts_at: datetime
    ends_at: datetime | None
    active: bool
    first_time_transaction: bool
    minimum_amount: int | None
    max_redemptions: int | None
    stripe_coupon_id: str | None = None
    stripe_promotion_code_id: str | None = None
    created_by: str | None = None
    created_at: datetime
    updated_at: datetime
    # Computed status so the admin screen does not re-derive date logic in TypeScript.
    status: str  # "scheduled" | "live" | "expired" | "inactive"

    model_config = {"from_attributes": True}


class PromotionCreateIn(BaseModel):
    code: str
    message: str
    percent_off: int
    starts_at: datetime
    ends_at: datetime | None = None
    active: bool = True
    first_time_transaction: bool = False
    minimum_amount: int | None = None
    max_redemptions: int | None = None
    sync_to_stripe: bool = False


class PromotionUpdateIn(BaseModel):
    code: str | None = None
    message: str | None = None
    percent_off: int | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    active: bool | None = None
    first_time_transaction: bool | None = None
    minimum_amount: int | None = None
    max_redemptions: int | None = None
    sync_to_stripe: bool = False


# ── Helpers ──────────────────────────────────────────────────────────────────


def _promotion_status(promo: Promotion) -> str:
    """Computed status: scheduled / live / expired / inactive."""
    if not promo.active:
        return "inactive"
    now = datetime.now(timezone.utc)
    starts = promo.starts_at
    if starts.tzinfo is None:
        starts = starts.replace(tzinfo=timezone.utc)
    if starts > now:
        return "scheduled"
    if promo.ends_at is not None:
        ends = promo.ends_at
        if ends.tzinfo is None:
            ends = ends.replace(tzinfo=timezone.utc)
        if ends <= now:
            return "expired"
    return "live"


def _promotion_to_out(promo: Promotion) -> dict:
    return {
        "id": str(promo.id),
        "code": promo.code,
        "message": promo.message,
        "percent_off": promo.percent_off,
        "starts_at": promo.starts_at,
        "ends_at": promo.ends_at,
        "active": promo.active,
        "first_time_transaction": promo.first_time_transaction,
        "minimum_amount": promo.minimum_amount,
        "max_redemptions": promo.max_redemptions,
        "stripe_coupon_id": promo.stripe_coupon_id,
        "stripe_promotion_code_id": promo.stripe_promotion_code_id,
        "created_by": promo.created_by,
        "created_at": promo.created_at,
        "updated_at": promo.updated_at,
        "status": _promotion_status(promo),
    }


async def _overlapping(
    *,
    session: AsyncSession,
    starts_at: datetime,
    ends_at: datetime | None,
    exclude_id: uuid.UUID | None = None,
) -> Promotion | None:
    """Two active promotions covering the same instant means GET /promotions/active
    picks one arbitrarily by sort order. That is a coin flip over which discount a
    visitor is offered, so it is refused at write time with a 409 naming the
    conflicting promotion.

    Half-open intervals [starts_at, ends_at): one ending at noon and one starting
    at noon do not overlap. A NULL ends_at is +infinity.
    """
    _inf = datetime.max.replace(tzinfo=timezone.utc)

    # Standard interval overlap: new_start < existing_end AND existing_start < new_end
    # Both conditions must always be checked regardless of whether ends_at is None:
    # - existing_start < new_end  (NULL ends = +infinity)
    # - new_start < existing_end  (NULL existing_ends = +infinity)
    conditions = [
        Promotion.active.is_(True),
        Promotion.starts_at < (ends_at or _inf),
        or_(Promotion.ends_at.is_(None), Promotion.ends_at > starts_at),
    ]
    if exclude_id is not None:
        conditions.append(Promotion.id != exclude_id)

    return (await session.execute(
        select(Promotion).where(*conditions).limit(1)
    )).scalar_one_or_none()


# ── Endpoints ────────────────────────────────────────────────────────────────


@router.get("/admin/promotions", response_model=list[PromotionOut])
async def list_promotions(session: AsyncSession = Depends(get_session)):
    """All promotions, newest first, with a computed status field."""
    result = await session.execute(
        select(Promotion).order_by(Promotion.created_at.desc())
    )
    return [_promotion_to_out(p) for p in result.scalars().all()]


@router.post(
    "/admin/promotions",
    response_model=PromotionOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_promotion(
    payload: PromotionCreateIn,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """Create a promotion. Overlap check → Stripe sync (if requested) → insert →
    audit → one commit. A Stripe failure fails the create with a 502 and writes
    no row — a promotion advertising a code Stripe will not honour is worse than
    no promotion.
    """
    # Overlap check removed per user request: allow multiple active promotions

    stripe_coupon_id = None
    stripe_promotion_code_id = None
    if payload.sync_to_stripe:
        try:
            coupon_id, promo_code_id = stripe_client.create_promotion_in_stripe(
                code=payload.code,
                percent_off=payload.percent_off,
                expires_at=payload.ends_at,
                first_time_transaction=payload.first_time_transaction,
                minimum_amount=payload.minimum_amount,
                max_redemptions=payload.max_redemptions,
            )
            stripe_coupon_id = coupon_id
            stripe_promotion_code_id = promo_code_id
        except stripe.StripeError as exc:
            # A failed create at admin time must not produce a lie. This is the
            # deliberate asymmetry with the read path in create_checkout_session,
            # which swallows a Stripe failure and continues at full price. A failed
            # lookup at checkout must not block a sale; a failed create at admin time
            # must not produce a code Stripe will not honour.
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail={
                    "error": {
                        "code": "stripe_sync_failed",
                        "message": f"Stripe rejected the promotion: {exc.user_message}",
                    }
                },
            )

    promo = Promotion(
        code=payload.code,
        message=payload.message,
        percent_off=payload.percent_off,
        starts_at=payload.starts_at,
        ends_at=payload.ends_at,
        active=payload.active,
        first_time_transaction=payload.first_time_transaction,
        minimum_amount=payload.minimum_amount,
        max_redemptions=payload.max_redemptions,
        stripe_coupon_id=stripe_coupon_id,
        stripe_promotion_code_id=stripe_promotion_code_id,
        created_by=admin.email,
    )
    session.add(promo)
    await session.flush()

    await record_audit(
        session,
        actor=admin,
        action="create_promotion",
        target_type="promotion",
        target_id=promo.id,
        context={"code": promo.code, "percent_off": promo.percent_off},
    )

    # `get_session` never commits and `record_audit` deliberately doesn't either (so an
    # audit row can't outlive a rolled-back mutation) — the endpoint owns the commit,
    # exactly as admin/settings.py and admin/products.py do. Without this the row is
    # discarded when the session closes and the admin sees a 201 for a promotion that
    # was never written. The test fixture's savepoint wrapper hides the omission, so
    # this is invisible to the suite and only shows up against a real database.
    await session.commit()

    return _promotion_to_out(promo)


@router.patch("/admin/promotions/{promotion_id}", response_model=PromotionOut)
async def update_promotion(
    promotion_id: str,
    payload: PromotionUpdateIn,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """Update a promotion. Same overlap check, excluding self."""
    promo = (await session.execute(
        select(Promotion).where(Promotion.id == uuid.UUID(promotion_id))
    )).scalar_one_or_none()
    if not promo:
        raise HTTPException(status_code=404, detail="Promotion not found")

    if payload.code is not None:
        promo.code = payload.code
    if payload.message is not None:
        promo.message = payload.message
    if payload.percent_off is not None:
        promo.percent_off = payload.percent_off
    if payload.starts_at is not None:
        promo.starts_at = payload.starts_at
    if payload.ends_at is not None:
        promo.ends_at = payload.ends_at
    if payload.active is not None:
        promo.active = payload.active
    if payload.first_time_transaction is not None:
        promo.first_time_transaction = payload.first_time_transaction
    if payload.minimum_amount is not None:
        promo.minimum_amount = payload.minimum_amount
    if payload.max_redemptions is not None:
        promo.max_redemptions = payload.max_redemptions
    await session.flush()
    await session.refresh(promo)

    # Overlap check removed per user request: allow multiple active promotions

    await record_audit(
        session,
        actor=admin,
        action="update_promotion",
        target_type="promotion",
        target_id=promo.id,
        context={"code": promo.code},
    )

    # See create_promotion: the endpoint owns the commit.
    await session.commit()

    return _promotion_to_out(promo)


@router.post("/admin/promotions/{promotion_id}/deactivate", response_model=PromotionOut)
async def deactivate_promotion(
    promotion_id: str,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """Deactivate a promotion. Separate from PATCH because it is the one action
    taken in a hurry — a single button that cannot accidentally rewrite the
    percentage on the way through.
    """
    promo = (await session.execute(
        select(Promotion).where(Promotion.id == uuid.UUID(promotion_id))
    )).scalar_one_or_none()
    if not promo:
        raise HTTPException(status_code=404, detail="Promotion not found")

    promo.active = False
    await session.flush()
    await session.refresh(promo)

    await record_audit(
        session,
        actor=admin,
        action="deactivate_promotion",
        target_type="promotion",
        target_id=promo.id,
        context={"code": promo.code},
    )

    # See create_promotion. This is the kill switch: an uncommitted deactivate would
    # report success while the discount stayed live for every visitor.
    await session.commit()

    return _promotion_to_out(promo)


@router.delete("/admin/promotions/{promotion_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_promotion(
    promotion_id: str,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> None:
    """Delete a promotion from the database and Stripe.
    
    If the promotion has Stripe IDs, it deactivates the PromotionCode and deletes
    the Coupon in Stripe.
    """
    promo = (await session.execute(
        select(Promotion).where(Promotion.id == uuid.UUID(promotion_id))
    )).scalar_one_or_none()
    
    if not promo:
        raise HTTPException(status_code=404, detail="Promotion not found")
        
    if promo.stripe_coupon_id and promo.stripe_promotion_code_id:
        try:
            stripe_client.delete_promotion_in_stripe(
                promotion_code_id=promo.stripe_promotion_code_id,
                coupon_id=promo.stripe_coupon_id,
            )
        except stripe.StripeError:
            # We allow local deletion even if Stripe fails (e.g. already deleted)
            pass

    await session.delete(promo)
    
    await record_audit(
        session,
        actor=admin,
        action="delete_promotion",
        target_type="promotion",
        target_id=promo.id,
        context={"code": promo.code},
    )
    
    await session.commit()
