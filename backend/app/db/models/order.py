from sqlalchemy import String, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, IdMixin, TimestampMixin, str_enum
import enum
import uuid

class OrderStatus(str, enum.Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"

class Order(Base, IdMixin, TimestampMixin):
    __tablename__ = "orders"
    
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    
    # Stripe checkout session reference
    stripe_session_id: Mapped[str] = mapped_column(String(255), nullable=False)
    stripe_payment_intent_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    
    status: Mapped[OrderStatus] = mapped_column(str_enum(OrderStatus, name="order_status"), default=OrderStatus.PENDING, nullable=False)
    total_amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    
    # Relationships
    user: Mapped["User"] = relationship("User")
    items: Mapped[list["OrderItem"]] = relationship("OrderItem", back_populates="order")

class OrderItem(Base, IdMixin, TimestampMixin):
    __tablename__ = "order_items"
    
    order_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("orders.id"), nullable=False)
    product_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("products.id"), nullable=False)
    
    price_amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    
    # Relationships
    order: Mapped["Order"] = relationship("Order", back_populates="items")
    product: Mapped["Product"] = relationship("Product")
