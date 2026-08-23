"""Public promotion endpoint — returns the one active promotion for the banner.

W5-R1 acceptance #2: GET /promotions/active returns at most one promotion,
date-filtered in SQL, with no authentication required and no admin-only fields
in the body.

The response model is an allowlist: only `code`, `message`, `percent_off`, and
`ends_at`. Not `id`, not `stripe_coupon_id`, not `created_by`. A public
response model that exposes internal fields is a credential leak disguised
as a convenience.
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

    model_config = {"from_attributes": True}


@router.get("/promotions/active", response_model=PromotionOut | None)
async def get_active_promotion(
    session: AsyncSession = Depends(get_session),
) -> PromotionOut | None:
    """The one promotion in force right now, or null. Public and unauthenticated —
    the banner renders for a visitor who has never signed in.

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
