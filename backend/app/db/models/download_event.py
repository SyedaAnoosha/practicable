"""Download event model — week4_plan.md Phase 6B step 4b.

Migration 014_filter_events creates this table alongside filter_events.
Identical privacy constraint: no user_id, no session id, no IP.

Recorded at the three call sites that mint a presigned URL, and nowhere else.
Writes must not fail the download — wrap and swallow.
"""
from uuid import UUID

from sqlalchemy import String, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, IdMixin


class DownloadEvent(Base, IdMixin):
    """Anonymous download event — counts links issued, not who downloaded."""

    __tablename__ = "download_events"

    # "template" or "lesson_file" — the content type of the downloaded resource
    content_type: Mapped[str] = mapped_column(String, nullable=False)
    content_id: Mapped[UUID | None] = mapped_column(nullable=True)
    content_slug: Mapped[str | None] = mapped_column(String, nullable=True)

    # created_at only — no updated_at in the migration
    created_at = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
