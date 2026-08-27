"""Bookmark model — saved content references.

Polymorphic content_id (like Review), no FK constraint.

`CreatedAtMixin`, NOT `TimestampMixin`: a bookmark has no editable field, so it is
created and deleted but never updated, and the table has `created_at` alone.
`TimestampMixin` would add an `updated_at` the table does not have, and every INSERT
would fail on the missing column.
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
