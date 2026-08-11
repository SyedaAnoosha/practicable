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

    # The reading lesson type's actual content (intern brief §"more than one lesson
    # type: video, reading, and a downloadable artefact"). Null for video/download-only
    # lessons; required in practice for reading/mixed ones.
    body: Mapped[str | None] = mapped_column(Text, nullable=True)

    # The downloadable-artefact lesson type reuses the Template row's storage_key/
    # file_name/mime_type infra rather than duplicating file columns here — a lesson's
    # download is gated by LESSON entitlement (course access), not by whether that same
    # file also happens to be sold on its own as a template product.
    download_template_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("templates.id"), nullable=True)

    # No free-preview mechanic (explicit product decision, 2026-08-11): video and
    # lessons are never free — only a question's written guidance is (email-gated
    # client-side, app/api/v1/content/questions.py). DESIGN.md §23.3 recommends a free
    # preview lesson; the owner overrode that for this product.

    module_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("modules.id"), nullable=True)
    sort_order: Mapped[int] = mapped_column(default=0)

    published: Mapped[bool] = mapped_column(default=False)

    # Relationships
    module: Mapped["Module"] = relationship("Module", back_populates="lessons")
    media: Mapped["Media"] = relationship("Media", back_populates="lesson", uselist=False)
    download_template: Mapped["Template | None"] = relationship("Template")
