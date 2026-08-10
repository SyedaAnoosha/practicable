from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, IdMixin, TimestampMixin

class TagValue(Base, IdMixin, TimestampMixin):
    __tablename__ = "tag_values"
    
    tag_dimension: Mapped[str] = mapped_column(String(50), nullable=False)  # effort, duration, cost, roi_horizon, tier, regulator_pressure, leadership_traits
    value: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g., "Quick", "XS", "$", "Q", "F", "N", "Accountability"
    display_label: Mapped[str] = mapped_column(String(255), nullable=False)  # e.g., "Quick (Days to weeks)"
    sort_order: Mapped[int] = mapped_column(default=0)
