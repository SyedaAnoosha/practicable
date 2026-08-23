"""Bookmark model for W5-R5 — saved content references.

Polymorphic content_id (like Review), no FK constraint.

`CreatedAtMixin`, NOT `TimestampMixin`: a bookmark has no editable field, so it is
created and deleted but never updated, and §III.5 of week5_plan.md specifies
`created_at` alone. `TimestampMixin` would add an `updated_at` the table does not
have — and did, until this was found: every INSERT failed on the missing column,
and the endpoint's broad `except` reported that as "already bookmarked", so a
learner's *first* bookmark on any item came back 409.
"""
import uuid
from sqlalchemy import CheckConstraint, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, CreatedAtMixin, IdMixin


class Bookmark(Base, IdMixin, CreatedAtMixin):
    __tablename__ = "bookmarks"
    __table_args__ = (
        CheckConstraint("content_type IN ('course', 'template', 'pack')", name="ck_bookmarks_content_type"),
        UniqueConstraint("user_id", "content_type", "content_id", name="uq_bookmarks_user_content"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    content_type: Mapped[str] = mapped_column(String(50), nullable=False)
    content_id: Mapped[uuid.UUID] = mapped_column(nullable=False)
