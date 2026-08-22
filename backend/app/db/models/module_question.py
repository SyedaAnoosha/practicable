from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, IdMixin, TimestampMixin
import uuid

if TYPE_CHECKING:
    from app.db.models.course import Module
    from app.db.models.question import Question

class ModuleQuestion(Base, IdMixin, TimestampMixin):
    """Attaches a question to a module as a syllabus item alongside its lessons.
    Questions stay public regardless; this only records the attachment."""
    __tablename__ = "module_questions"

    module_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("modules.id"), nullable=False)
    question_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("questions.id"), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    # Relationships
    module: Mapped["Module"] = relationship("Module")
    question: Mapped["Question"] = relationship("Question")
