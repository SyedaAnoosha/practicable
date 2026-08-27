"""Promotion model — admin-controlled discount codes with date scheduling.

W5-R1: The discount path already reaches Stripe end to end. This model adds the
control surface: an admin creates a promotion with a code, percent-off, and date
window; the public endpoint returns the one active promotion for the banner;
the checkout path resolves the code against Stripe as it already does.

Two active promotions covering the same instant is refused at write time with a 409
(the overlap check in admin/promotions.py), not left to a coin-flip at read time.

`sync_to_stripe` is an endpoint flag, not a stored column — it is never persisted
because Stripe is the authoritative source for whether a code works, and syncing
on every read would be an N+1 against a third-party API.
"""
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, IdMixin, TimestampMixin


class Promotion(Base, IdMixin, TimestampMixin):
    __tablename__ = "promotions"

    code: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    message: Mapped[str] = mapped_column(String(255), nullable=False)
    percent_off: Mapped[int] = mapped_column(Integer, nullable=False)
    starts_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
    )
    ends_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    stripe_coupon_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    stripe_promotion_code_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True,
    )
    first_time_transaction: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false", default=False)
    minimum_amount: Mapped[int | None] = mapped_column(Integer, nullable=True)
    max_redemptions: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_by: Mapped[str | None] = mapped_column(String(255), nullable=True)

    __table_args__ = (
        CheckConstraint(
            "percent_off > 0 AND percent_off <= 100",
            name="ck_promotions_percent_off",
        ),
        CheckConstraint(
            "ends_at IS NULL OR ends_at > starts_at",
            name="ck_promotions_dates",
        ),
    )
