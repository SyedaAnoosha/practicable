from datetime import datetime

from sqlalchemy import String, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, IdMixin, TimestampMixin, str_enum
import enum
import uuid

class GrantedVia(str, enum.Enum):
    PURCHASE = "purchase"
    MANUAL = "manual"
    FREE = "free"

class Entitlement(Base, IdMixin, TimestampMixin):
    __tablename__ = "entitlements"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    product_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("products.id"), nullable=False)

    # How this entitlement came to exist: 'purchase' on webhook fulfilment, 'manual' for
    # an audited admin override, 'free' for a lead-capture grant.
    granted_via: Mapped[GrantedVia] = mapped_column(str_enum(GrantedVia, name="granted_via"), nullable=False, default=GrantedVia.PURCHASE)

    # Optional expiry for temporary access.
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    user: Mapped["User"] = relationship("User")
    product: Mapped["Product"] = relationship("Product")
