from sqlalchemy import String, Text, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, IdMixin, TimestampMixin, str_enum
import enum
import uuid

class LessonType(str, enum.Enum):
    VIDEO = "video"
    READING = "reading"
    DOWNLOAD = "download"
    MIXED = "mixed"

class Lesson(Base, IdMixin, TimestampMixin):
    __tablename__ = "lessons"

    slug: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    lesson_type: Mapped[LessonType] = mapped_column(str_enum(LessonType, name="lesson_type"), default=LessonType.VIDEO, nullable=False)

    # The reading lesson type's content. Null for video/download-only lessons.
    body: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Download-type lessons reuse the Template row's storage columns rather than
    # duplicating them. Access is still gated by LESSON entitlement (course access),
    # regardless of whether that file is also sold standalone.
    download_template_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("templates.id"), nullable=True)

    # No free-preview mechanic: lessons and video are never free. Only a question's
    # written guidance is, and that gate is client-side.

    module_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("modules.id"), nullable=True)
    sort_order: Mapped[int] = mapped_column(default=0)

    published: Mapped[bool] = mapped_column(default=False)

    # Relationships
    module: Mapped["Module"] = relationship("Module", back_populates="lessons")
    media: Mapped["Media"] = relationship("Media", back_populates="lesson", uselist=False)
    download_template: Mapped["Template | None"] = relationship("Template")
