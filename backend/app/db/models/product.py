import enum
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, ForeignKey, Integer, Boolean, DateTime, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, IdMixin, PublishStateMixin, TimestampMixin, str_enum


class Licence(str, enum.Enum):
    """Product licence tiers (week4_plan.md W4-R1, migration 013).

    standard: Use and adapt inside your own organisation (the only tier rendered until
              decision #25 closes).
    client_delivery / multi_client: OWNER DECISION #25 — not rendered until resolved.
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
    stripe_product_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # Phase 8 (8B)
    price_amount: Mapped[int] = mapped_column(Integer, nullable=False)  # in cents
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="AUD")

    # `publish_state` (migration 012) comes from PublishStateMixin, kept in sync with
    # this column automatically — see that mixin's docstring. No admin endpoint writes
    # either field yet (products are seeded, not edited in `/admin`); they exist so the
    # column shape matches the other four tables and a future admin product editor
    # doesn't need its own migration.
    published: Mapped[bool] = mapped_column(default=False)

    # ── W4-R1: pre-purchase evidence layer (migration 013) ──────────────────────
    # Licence tier: which uses are permitted. Default 'standard'. client_delivery /
    # multi_client are defined but not displayed until decision #25 closes.
    licence: Mapped[Licence] = mapped_column(
        str_enum(Licence, name="licence"),
        nullable=False,
        default=Licence.STANDARD,
    )
    # SEO/search title — falls back to `name` when unset (W4-R1, new_additions.md §7)
    search_title: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    # Version stamp — visible pre-purchase and in the receipt (W4-R1, §20.4)
    version: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    last_reviewed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Bundle declaration — explicit flag, not inferred from content counts
    is_bundle: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # W5-R4: denormalised review counters (migration 029)
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
