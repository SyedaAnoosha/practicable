from typing import TYPE_CHECKING

from sqlalchemy import String, Text, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, IdMixin, PublishStateMixin, TimestampMixin
import uuid

if TYPE_CHECKING:
    from app.db.models.domain import Domain
    from app.db.models.tag_value import TagValue
    from app.db.models.template import Template
    from app.db.models.lesson import Lesson

class Question(Base, IdMixin, TimestampMixin, PublishStateMixin):
    __tablename__ = "questions"
    
    slug: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    subtitle: Mapped[str | None] = mapped_column(String(500), nullable=True)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    preview: Mapped[str] = mapped_column(String(160), nullable=False)  # 160-char summary for index
    
    domain_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("domains.id"), nullable=False)
    
    # Tag values (foreign keys to tag_values table)
    effort_tag_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("tag_values.id"), nullable=True)
    duration_tag_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("tag_values.id"), nullable=True)
    cost_tag_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("tag_values.id"), nullable=True)
    roi_horizon_tag_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("tag_values.id"), nullable=True)
    tier_tag_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("tag_values.id"), nullable=True)
    regulator_pressure_tag_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("tag_values.id"), nullable=True)
    
    # Leadership traits is multi-select, so we need a join table
    # `publish_state` (migration 012) comes from PublishStateMixin, kept in sync with
    # this column automatically — see that mixin's docstring.
    published: Mapped[bool] = mapped_column(default=False)

    # The homepage's curated picks. `featured_sort` is nullable —
    # NULL reads as "featured, order unset" rather than a false zero that would force
    # every newly-featured question to the front of the row ahead of ones an editor
    # deliberately placed earlier.
    featured: Mapped[bool] = mapped_column(default=False, nullable=False)
    featured_sort: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Relationships
    domain: Mapped["Domain"] = relationship("Domain")
    effort_tag: Mapped["TagValue"] = relationship(foreign_keys=[effort_tag_id])
    duration_tag: Mapped["TagValue"] = relationship(foreign_keys=[duration_tag_id])
    cost_tag: Mapped["TagValue"] = relationship(foreign_keys=[cost_tag_id])
    roi_horizon_tag: Mapped["TagValue"] = relationship(foreign_keys=[roi_horizon_tag_id])
    tier_tag: Mapped["TagValue"] = relationship(foreign_keys=[tier_tag_id])
    regulator_pressure_tag: Mapped["TagValue"] = relationship(foreign_keys=[regulator_pressure_tag_id])
    leadership_traits: Mapped[list["QuestionLeadershipTrait"]] = relationship("QuestionLeadershipTrait", back_populates="question")

class QuestionLeadershipTrait(Base, IdMixin, TimestampMixin):
    __tablename__ = "question_leadership_traits"

    question_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("questions.id"), nullable=False)
    trait_tag_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tag_values.id"), nullable=False)

    # Relationships
    question: Mapped["Question"] = relationship("Question", back_populates="leadership_traits")
    trait_tag: Mapped["TagValue"] = relationship("TagValue")

class QuestionRelation(Base, IdMixin, TimestampMixin):
    """Self-referential many-to-many: the 'related questions' on a question detail page.
    Directional by row — add the reverse row too if it should show on both sides."""
    __tablename__ = "question_relations"

    question_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("questions.id"), nullable=False)
    related_question_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("questions.id"), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    # Relationships
    question: Mapped["Question"] = relationship("Question", foreign_keys=[question_id])
    related_question: Mapped["Question"] = relationship("Question", foreign_keys=[related_question_id])

class QuestionTemplate(Base, IdMixin, TimestampMixin):
    """Which templates a question links to on its detail page."""
    __tablename__ = "question_templates"

    question_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("questions.id"), nullable=False)
    template_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("templates.id"), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    # Relationships
    question: Mapped["Question"] = relationship("Question")
    template: Mapped["Template"] = relationship("Template")

class QuestionLesson(Base, IdMixin, TimestampMixin):
    """Which lessons a question links to — the course it leads into."""
    __tablename__ = "question_lessons"

    question_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("questions.id"), nullable=False)
    lesson_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("lessons.id"), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    # Relationships
    question: Mapped["Question"] = relationship("Question")
    lesson: Mapped["Lesson"] = relationship("Lesson")
