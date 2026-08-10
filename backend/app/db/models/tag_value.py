from sqlalchemy import String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, IdMixin, TimestampMixin

class TagValue(Base, IdMixin, TimestampMixin):
    __tablename__ = "tag_values"
    __table_args__ = (
        # db/seed/001_seed_domains_and_tags.sql's ON CONFLICT DO NOTHING needs this to
        # actually be idempotent across re-runs — see alembic/versions/002_tag_values_unique.py.
        UniqueConstraint('tag_dimension', 'value', name='uq_tag_values_dimension_value'),
    )

    tag_dimension: Mapped[str] = mapped_column(String(50), nullable=False)  # effort, duration, cost, roi_horizon, tier, regulator_pressure, leadership_traits
    value: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g., "quick", "xs", "low", "q", "f", "n"
    display_label: Mapped[str] = mapped_column(String(255), nullable=False)  # e.g., "Quick (Days to weeks)"
    sort_order: Mapped[int] = mapped_column(default=0)
