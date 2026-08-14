from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, IdMixin, TimestampMixin, str_enum
import enum
import uuid


class LessonBlockType(str, enum.Enum):
    TEXT = "text"
    VIDEO = "video"
    FILE = "file"
    CALLOUT = "callout"


class LessonBlock(Base, IdMixin, TimestampMixin):
    """One ordered piece of a lesson's content — Product Spec §7.2's mixed-content
    requirement. alembic/versions/009_lesson_blocks.py has the full reasoning.

    Exactly one of `text_body` / `media_id` / `template_id` is populated, matching
    `block_type` — enforced at the API layer (the admin publish guard,
    week2_plan.md Phase 2 step 7), not by a DB CHECK constraint, the same choice this
    schema already makes for `product_contents`' polymorphic content_type/content_id.
    """

    __tablename__ = "lesson_blocks"

    lesson_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("lessons.id"), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    block_type: Mapped[LessonBlockType] = mapped_column(
        str_enum(LessonBlockType, name="lesson_block_type"), nullable=False
    )

    # text / callout only.
    text_body: Mapped[str | None] = mapped_column(Text, nullable=True)
    heading: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # video only.
    media_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("media.id"), nullable=True)
    # file only.
    template_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("templates.id"), nullable=True)

    # Relationships
    lesson: Mapped["Lesson"] = relationship("Lesson", back_populates="blocks")
    media: Mapped["Media | None"] = relationship("Media")
    template: Mapped["Template | None"] = relationship("Template")
