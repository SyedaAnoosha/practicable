"""Review model — reviews and ratings.

A polymorphic review tied to courses, templates, or packs. The ``content_id``
column has no FK constraint because it references different tables depending
on ``content_type`` — referential integrity is the application's job here,
enforced by the submission endpoint which resolves content through
``resolve_granted_content_ids`` before inserting.

The ``review_state`` enum type name is chosen explicitly (see ``base.py``
docstring on ``str_enum``) — it must match the Postgres type created by
migration 029.
"""
import enum
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, SmallInteger, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, IdMixin, TimestampMixin


class ReviewState(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class Review(Base, IdMixin, TimestampMixin):
    __tablename__ = "reviews"
    __table_args__ = (
        UniqueConstraint("user_id", "content_type", "content_id", name="uq_reviews_user_content"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    content_type: Mapped[str] = mapped_column(String(50), nullable=False)
    # Polymorphic — no FK. See module docstring.
    content_id: Mapped[uuid.UUID] = mapped_column(nullable=False)
    rating: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    body: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    display_name: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    state: Mapped[str] = mapped_column(
        String(20), nullable=False,
        default=ReviewState.PENDING.value,
    )
    is_featured: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    moderated_by: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    moderated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
