"""Scored assessments — one quiz per module, with a passing score and an attempt cap.

Four tables, in the shape the grading path actually needs:

``Assessment``          one per module (UNIQUE on ``module_id``), carrying the pass mark
                        and the attempt cap. Publish state is a plain boolean rather than
                        ``PublishStateMixin``: an assessment is not an editorial artefact
                        with a review queue, it is a switch that turns certificate gating
                        on, and adding the shared enum here would imply a workflow that
                        does not exist for it.
``AssessmentQuestion``  ordered prompts. ``question_type`` decides how a submission is
                        marked, not how it is rendered — see the scoring rule below.
``AssessmentOption``    the choices, each carrying ``is_correct``. This column is the
                        reason the learner-facing serialiser is written by hand rather
                        than with ``from_attributes``: the correct answers live one
                        relationship hop from the payload the client receives, and an
                        automatic model dump would ship them.
``AssessmentAttempt``   append-only record of one submission. ``CreatedAtMixin``, not
                        ``TimestampMixin`` — an attempt is never edited after it is
                        marked, so there is no ``updated_at`` column in migration 036 and
                        a model that declared one would name a missing column in every
                        INSERT (see that mixin's docstring for how that failure presents).

**Scoring is all-or-nothing per question.** A ``multi_choice`` question is correct only
when the submitted option set equals the correct option set exactly — no partial credit
for a subset, and a superset that includes every correct option plus a wrong one is
wrong. Partial credit would make ``passing_score`` mean something different per question
shape, and "I selected all four options and passed" is the specific failure that makes a
quiz worthless as a gate.

``answers`` on an attempt is a JSONB snapshot of what was submitted, stored so a score
can be explained later even after an admin edits the question set. It is a record, not an
input: re-marking always reads the live rows, never this blob.

The ``assessment_question_type`` enum type name is passed explicitly to ``str_enum`` and
must match the Postgres type created in ``alembic/versions/036_assessments.py`` — see the
``str_enum`` docstring in ``app/db/base.py`` for why it is not inferred.
"""
import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, CreatedAtMixin, IdMixin, TimestampMixin, str_enum

if TYPE_CHECKING:
    from app.db.models.course import Course, Module
    from app.db.models.user import User


class AssessmentQuestionType(str, enum.Enum):
    SINGLE_CHOICE = "single_choice"
    MULTI_CHOICE = "multi_choice"


class Assessment(Base, IdMixin, TimestampMixin):
    """One assessment per module. UNIQUE(module_id) is the constraint the certificate
    gate leans on: "does this module have a published assessment" is a single-row
    question, so the gate cannot be ambiguous about which quiz it is checking."""

    __tablename__ = "assessments"
    __table_args__ = (
        UniqueConstraint("module_id", name="uq_assessments_module"),
        CheckConstraint("passing_score BETWEEN 0 AND 100", name="ck_assessments_passing_score"),
        CheckConstraint("max_attempts > 0", name="ck_assessments_max_attempts"),
    )

    module_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("modules.id"), nullable=False)
    course_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("courses.id"), nullable=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Percent, inclusive: a score >= passing_score passes.
    passing_score: Mapped[int] = mapped_column(Integer, nullable=False, default=70)
    max_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=3)

    # Only a published assessment gates certificates. An unpublished one is invisible to
    # learners and leaves the pre-existing "100% lessons = certificate" rule untouched,
    # so an admin can draft a quiz on a live course without silently withholding
    # certificates from everyone who finishes it mid-draft.
    published: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    module: Mapped["Module"] = relationship("Module")
    questions: Mapped[list["AssessmentQuestion"]] = relationship(
        "AssessmentQuestion",
        back_populates="assessment",
        cascade="all, delete-orphan",
        order_by="AssessmentQuestion.sort_order",
    )


class AssessmentQuestion(Base, IdMixin, TimestampMixin):
    __tablename__ = "assessment_questions"

    assessment_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("assessments.id", ondelete="CASCADE"), nullable=False
    )
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    question_type: Mapped[AssessmentQuestionType] = mapped_column(
        str_enum(AssessmentQuestionType, name="assessment_question_type"),
        nullable=False,
        default=AssessmentQuestionType.SINGLE_CHOICE,
    )

    assessment: Mapped["Assessment"] = relationship("Assessment", back_populates="questions")
    options: Mapped[list["AssessmentOption"]] = relationship(
        "AssessmentOption",
        back_populates="question",
        cascade="all, delete-orphan",
        order_by="AssessmentOption.sort_order",
    )


class AssessmentOption(Base, IdMixin, TimestampMixin):
    """``is_correct`` never leaves the server. The learner-facing serialiser in
    ``api/v1/content/assessments.py`` builds its payload field by field for this reason;
    ``tests/test_assessments.py`` asserts the string does not appear anywhere in the
    response body, including nested."""

    __tablename__ = "assessment_options"

    question_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("assessment_questions.id", ondelete="CASCADE"), nullable=False
    )
    label: Mapped[str] = mapped_column(Text, nullable=False)
    is_correct: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    question: Mapped["AssessmentQuestion"] = relationship("AssessmentQuestion", back_populates="options")


class AssessmentAttempt(Base, IdMixin, CreatedAtMixin):
    """Append-only: one row per submission, never updated.

    ``attempt_number`` is 1-based and dense per (user, assessment); the submit endpoint
    derives it from a COUNT of existing rows, so the attempt cap and this number always
    agree about how many attempts have been spent.
    """

    __tablename__ = "assessment_attempts"
    __table_args__ = (
        CheckConstraint("score BETWEEN 0 AND 100", name="ck_assessment_attempts_score"),
        CheckConstraint("attempt_number > 0", name="ck_assessment_attempts_number"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    assessment_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("assessments.id", ondelete="CASCADE"), nullable=False
    )
    attempt_number: Mapped[int] = mapped_column(Integer, nullable=False)
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    passed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    # Snapshot of the submission: [{"question_id": ..., "option_ids": [...]}, ...].
    # A record of what was sent, never re-read as an input to marking.
    answers: Mapped[Optional[dict | list]] = mapped_column(JSONB, nullable=True)

    user: Mapped["User"] = relationship("User")
    assessment: Mapped["Assessment"] = relationship("Assessment")
