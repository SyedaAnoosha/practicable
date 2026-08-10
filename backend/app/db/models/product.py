from sqlalchemy import String, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, IdMixin, TimestampMixin
import uuid

class Product(Base, IdMixin, TimestampMixin):
    __tablename__ = "products"
    
    slug: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str] = mapped_column(String(2000), nullable=False)
    
    # Stripe price reference
    stripe_price_id: Mapped[str] = mapped_column(String(255), nullable=False)
    price_amount: Mapped[int] = mapped_column(Integer, nullable=False)  # in cents
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="AUD")  # AUD, USD, GBP, EUR
    
    published: Mapped[bool] = mapped_column(default=False)
    
    # Relationships
    contents: Mapped[list["ProductContent"]] = relationship("ProductContent", back_populates="product")

class ProductContent(Base, IdMixin, TimestampMixin):
    __tablename__ = "product_contents"
    
    product_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("products.id"), nullable=False)
    
    # Polymorphic content reference
    content_type: Mapped[str] = mapped_column(String(50), nullable=False)  # "course", "lesson", "template", "question_set"
    content_id: Mapped[uuid.UUID] = mapped_column(nullable=False)  # ID of the referenced content
    
    # Relationships
    product: Mapped["Product"] = relationship("Product", back_populates="contents")
