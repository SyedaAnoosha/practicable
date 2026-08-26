"""Notification model for template version updates (#6).

Stores notifications for users who own templates when a new version is available.
Includes the notification type, target entity, and delivery status.
"""
from sqlalchemy import String, Text, ForeignKey, Boolean, DateTime
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
import uuid

from app.db.base import Base, IdMixin, TimestampMixin


class Notification(Base, IdMixin, TimestampMixin):
    """A notification for a user about content updates."""

    __tablename__ = "notifications"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)

    # Notification type: "template_version_update", "course_update", etc.
    notification_type: Mapped[str] = mapped_column(String(50), nullable=False)

    # The entity this notification is about (e.g., template_id)
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(nullable=False)

    # Notification content
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)

    # Whether the user has read this notification
    read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Whether the notification was delivered via email
    email_delivered: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    email_delivered_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Optional: link to the relevant page
    action_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Metadata for additional context (e.g., old_version, new_version)
    # Named 'meta' instead of 'metadata' because 'metadata' is reserved in SQLAlchemy
    meta: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
