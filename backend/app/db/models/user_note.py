"""UserNote model for W5-R5 — per-lesson learner notes.

One note per lesson per learner, edited in place via upsert.
"""
import uuid
from sqlalchemy import ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, IdMixin, TimestampMixin


class UserNote(Base, IdMixin, TimestampMixin):
    __tablename__ = "user_notes"
    __table_args__ = (
        UniqueConstraint("user_id", "lesson_id", name="uq_user_notes_user_lesson"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    lesson_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("lessons.id"), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
