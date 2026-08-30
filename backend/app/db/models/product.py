import enum
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, ForeignKey, Integer, Boolean, DateTime, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, IdMixin, PublishStateMixin, TimestampMixin, str_enum


class Licence(str, enum.Enum):
    """Product licence tiers (migration 013).

    standard: Use and adapt inside your own organisation (the only tier currently
              rendered).
    client_delivery / multi_client: defined but not rendered pending an owner decision.
    """
    STANDARD = "standard"
    CLIENT_DELIVERY = "client_delivery"
    MULTI_CLIENT = "multi_client"


class Product(Base, IdMixin, TimestampMixin, PublishStateMixin):
    __tablename__ = "products"

    slug: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)

    # Stripe price reference
    stripe_price_id: Mapped[str] = mapped_column(String(255), nullable=False)
    stripe_product_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    price_amount: Mapped[int] = mapped_column(Integer, nullable=False)  # in cents
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="AUD")

    # `publish_state` (migration 012) comes from PublishStateMixin and stays in sync
    # with this column. Neither is written by an admin endpoint yet — they exist so the
    # column shape matches the other four tables.
    published: Mapped[bool] = mapped_column(default=False)

    # ── Pre-purchase evidence layer (migration 013) ────────────────────────────
    # Licence tier: which uses are permitted. Default 'standard'. client_delivery /
    # multi_client are defined but not displayed pending an owner decision.
    licence: Mapped[Licence] = mapped_column(
        str_enum(Licence, name="licence"),
        nullable=False,
        default=Licence.STANDARD,
    )
    # SEO/search title — falls back to `name` when unset
    search_title: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    # Version stamp — visible pre-purchase and in the receipt
    version: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    last_reviewed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Bundle declaration — explicit flag, not inferred from content counts
    is_bundle: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Denormalised review counters (migration 029)
    review_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    rating_sum: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Relationships
    contents: Mapped[list["ProductContent"]] = relationship(
        "ProductContent", back_populates="product"
    )


class ProductContent(Base, IdMixin, TimestampMixin):
    __tablename__ = "product_contents"

    product_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("products.id"), nullable=False
    )

    # Polymorphic content reference
    content_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # "course", "lesson", "template", "question_set"
    content_id: Mapped[uuid.UUID] = mapped_column(nullable=False)

    # Relationships
    product: Mapped["Product"] = relationship("Product", back_populates="contents")
