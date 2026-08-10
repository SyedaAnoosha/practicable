from sqlalchemy import String, Text, ForeignKey, Integer, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, IdMixin, TimestampMixin
import uuid

class Course(Base, IdMixin, TimestampMixin):
    __tablename__ = "courses"
    
    slug: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    subtitle: Mapped[str | None] = mapped_column(String(500), nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    
    section_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sections.id"), nullable=False)
    author_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("authors.id"), nullable=False)
    
    published: Mapped[bool] = mapped_column(default=False)
    
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
