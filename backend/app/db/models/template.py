import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, Text, ForeignKey, Integer, Boolean, DateTime
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, IdMixin, PublishStateMixin, TimestampMixin


class Template(Base, IdMixin, TimestampMixin, PublishStateMixin):
    __tablename__ = "templates"

    slug: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)

    section_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("sections.id"), nullable=False
    )
    author_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("authors.id"), nullable=False
    )

    # Supabase Storage file reference (S3-compatible key within the bucket)
    storage_key: Mapped[str] = mapped_column(String(500), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(default=0)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)

    # `publish_state` (migration 012) comes from PublishStateMixin, kept in sync with
    # this column automatically — see that mixin's docstring.
    published: Mapped[bool] = mapped_column(default=False)

    # The free lead-magnet template: no product, no price, no entitlement check on
    # download. The email capture fronting it is a client-side conversion device, not a
    # security boundary. An explicit flag rather than "has no product row", because an
    # unpriced template is a draft, not a giveaway.
    is_free: Mapped[bool] = mapped_column(default=False, nullable=False)

    # ── W4-R1: pre-purchase evidence layer (migration 013) ──────────────────────
    # page_count AND sheet_count: a PDF has pages, a spreadsheet has sheets.
    # Two nullable columns beat one column plus a discriminator.
    page_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    sheet_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    # is_editable: nullable — editability is unknown until someone opens the file.
    is_editable: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    # has_macros: safety property — default MUST be false, a true is a deliberate act.
    # The publish guard refuses to publish any template with has_macros=True.
    has_macros: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    min_office_version: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    # preview_image_keys: JSONB array of Storage keys. Ordered, small, always read whole.
    # The publish guard requires at least 2 keys before a paid template can publish.
    preview_image_keys: Mapped[list] = mapped_column(
        JSONB, nullable=False, default=list
    )
    # version + last_reviewed_at: visible pre-purchase and stamped into the receipt
    version: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    last_reviewed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    section: Mapped["Section"] = relationship("Section")  # type: ignore[name-defined]
    author: Mapped["Author"] = relationship("Author")  # type: ignore[name-defined]
