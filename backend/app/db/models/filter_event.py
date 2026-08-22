"""Filter event model — week4_plan.md Phase 6B step 2.

Migration 014_filter_events creates this table. The schema uses per-dimension
columns (not a (dimension, value) pair) so queries can filter on specific
dimensions without string matching.

No user_id, no session id, no IP — a deliberate privacy constraint.
"""
from sqlalchemy import String, Integer, DateTime, func
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, IdMixin


class FilterEvent(Base, IdMixin):
    """Anonymous filter event — records which filter dimensions were active."""

    __tablename__ = "filter_events"

    # Ordinal dimensions — single value per filter
    domain: Mapped[str | None] = mapped_column(String, nullable=True)
    effort: Mapped[str | None] = mapped_column(String, nullable=True)
    duration: Mapped[str | None] = mapped_column(String, nullable=True)
    cost: Mapped[str | None] = mapped_column(String, nullable=True)
    roi_horizon: Mapped[str | None] = mapped_column(String, nullable=True)
    regulator_pressure: Mapped[str | None] = mapped_column(String, nullable=True)

    # Multi-select dimensions — array of values
    tier: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)
    leadership_traits: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)

    # Search context
    query_text: Mapped[str | None] = mapped_column(String, nullable=True)
    result_count: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # created_at only — no updated_at in the migration
    created_at = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
