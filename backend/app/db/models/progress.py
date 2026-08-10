from datetime import datetime

from sqlalchemy import String, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, IdMixin, TimestampMixin
import uuid

class LessonProgress(Base, IdMixin, TimestampMixin):
    __tablename__ = "lesson_progress"
    
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    lesson_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("lessons.id"), nullable=False)
    
    completed: Mapped[bool] = mapped_column(default=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Resume point for video (in seconds)
    resume_at_seconds: Mapped[int] = mapped_column(default=0)
    
    # Relationships
    user: Mapped["User"] = relationship("User")
    lesson: Mapped["Lesson"] = relationship("Lesson")

class CourseProgress(Base, IdMixin, TimestampMixin):
    __tablename__ = "course_progress"
    
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    course_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("courses.id"), nullable=False)
    
    completed: Mapped[bool] = mapped_column(default=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Percentage of lessons completed
    percentage_complete: Mapped[int] = mapped_column(default=0)
    
    # Relationships
    user: Mapped["User"] = relationship("User")
    course: Mapped["Course"] = relationship("Course")
