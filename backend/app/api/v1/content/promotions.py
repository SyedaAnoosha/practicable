"""Public promotion endpoint — returns the one active promotion for the banner.

GET /promotions/active returns at most one promotion, date-filtered in SQL, with
no authentication required and no admin-only fields in the body.

The response model is an allowlist: `code`, `message`, `percent_off`, `ends_at`
and `first_time_transaction`. Not `id`, not `stripe_coupon_id`, not `created_by`,
and not the redemption/minimum-amount limits. A public response model that
exposes internal fields is a credential leak disguised as a convenience.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Promotion
from app.db.session import get_session

router = APIRouter()


class PromotionOut(BaseModel):
    code: str
    message: str
    percent_off: int
    ends_at: datetime | None
    # Included because the banner has to be honest about who the offer is for —
    # advertising a first-order-only code to a returning buyer who is then refused
    # at checkout is the complaint this field prevents.
    first_time_transaction: bool
    # `minimum_amount` and `max_redemptions` are deliberately NOT here. Stripe
    # enforces both at checkout, and "3 redemptions left" is an inventory signal
    # about the business, not a fact the visitor is owed.

    model_config = {"from_attributes": True}


@router.get("/promotions/active", response_model=PromotionOut | None)
async def get_active_promotion(
    session: AsyncSession = Depends(get_session),
) -> PromotionOut | None:
    """The one promotion to advertise right now, or null. Public and unauthenticated —
    the banner renders for a visitor who has never signed in.

    Several promotions may be active at once (a standing first-order code plus a
    limited-time sale), so `.limit(1)` chooses which to *show*, not which is
    redeemable. The most recently started live promotion wins, so a new sale takes
    over the banner without the admin deactivating anything. Every other live code
    still redeems at checkout, where Stripe validates it.

    Date filtering happens in SQL, not Python: the server's clock is the authority
    on whether an offer is live, and a client that filtered would let a wrong local
    clock show an expired code.
    """
    now = datetime.now(timezone.utc)
    stmt = (
        select(Promotion)
        .where(
            Promotion.active.is_(True),
            Promotion.starts_at <= now,
            or_(Promotion.ends_at.is_(None), Promotion.ends_at > now),
        )
        .order_by(Promotion.starts_at.desc())
        .limit(1)
    )
    promo = (await session.execute(stmt)).scalar_one_or_none()
    return PromotionOut.model_validate(promo) if promo else None
