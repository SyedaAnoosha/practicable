from sqlalchemy import ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, IdMixin, TimestampMixin
import uuid

class ModuleQuestion(Base, IdMixin, TimestampMixin):
    """A module can attach a question as a syllabus item alongside its lessons — e.g.
    a reading module points at the question its content answers, so the course
    outline can link straight to it. Questions stay free/public regardless of this
    link (app/api/v1/content/questions.py); this only records the attachment."""
    __tablename__ = "module_questions"

    module_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("modules.id"), nullable=False)
    question_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("questions.id"), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    # Relationships
    module: Mapped["Module"] = relationship("Module")
    question: Mapped["Question"] = relationship("Question")
