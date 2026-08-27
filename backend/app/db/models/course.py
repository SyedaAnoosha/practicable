from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import String, Text, ForeignKey, Integer, Numeric, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, IdMixin, PublishStateMixin, TimestampMixin
import uuid

if TYPE_CHECKING:
    from app.db.models.section import Section
    from app.db.models.author import Author
    from app.db.models.lesson import Lesson

class Course(Base, IdMixin, TimestampMixin, PublishStateMixin):
    __tablename__ = "courses"

    slug: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    subtitle: Mapped[str | None] = mapped_column(String(500), nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)

    section_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sections.id"), nullable=False)
    author_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("authors.id"), nullable=False)

    # `publish_state` (migration 012) comes from PublishStateMixin, kept in sync with
    # this column automatically — see that mixin's docstring.
    published: Mapped[bool] = mapped_column(default=False)

    # Cover image for the course catalogue and detail page (migration 018).
    # Nullable — null means no image yet; public pages degrade gracefully.
    cover_image_key: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Level and duration for catalogue filtering (migration 025).
    # Level is set by the admin; duration is computed from lesson media and
    # stored denormalized for fast reads.
    level: Mapped[str | None] = mapped_column(String(50), nullable=True)
    estimated_duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Denormalised review counters (migration 029). Updated in the same
    # transaction as moderation transitions so the catalogue never needs a
    # COUNT/AVG join per card.
    review_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    rating_sum: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # #16: content freshness (migration 035). Nullable, and NULL means "never reviewed"
    # — a distinct state from "reviewed, but long ago", never backfilled to now() to
    # silence a warning. No `version` counterpart: a course is consumed in place and is
    # always the current one, unlike a template the buyer downloads and keeps.
    last_reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    section: Mapped["Section"] = relationship("Section")
    author: Mapped["Author"] = relationship("Author")
    modules: Mapped[list["Module"]] = relationship("Module", back_populates="course")

class Module(Base, IdMixin, TimestampMixin):
    __tablename__ = "modules"
    
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(default=0)
    
    course_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("courses.id"), nullable=False)
    
    # Relationships
    course: Mapped["Course"] = relationship("Course", back_populates="modules")
    lessons: Mapped[list["Lesson"]] = relationship("Lesson", back_populates="module")
