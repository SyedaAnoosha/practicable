"""Add scored assessments: one quiz per course, with a pass mark and an attempt cap.

Creates four tables and the ``assessment_question_type`` enum:

- ``assessments`` — one per course, UNIQUE(course_id). CHECKs keep ``passing_score``
  inside 0-100 and ``max_attempts`` above zero, so a quiz that nobody can pass or nobody
  can sit cannot be written at all.
- ``assessment_questions`` — ordered prompts, ON DELETE CASCADE from the assessment.
- ``assessment_options`` — the choices, each with ``is_correct``. Cascades from its
  question.
- ``assessment_attempts`` — append-only submissions. ``created_at`` only, no
  ``updated_at``: an attempt is marked once and never edited, and the model uses
  ``CreatedAtMixin`` to match.

The enum is created with the same DO $$ ... EXCEPTION WHEN duplicate_object $$ guard
migration 029 uses, so a re-run against a database that already has the type does not
abort the whole migration. Its name is snake_case to match the ``str_enum(...,
name="assessment_question_type")`` call in ``app/db/models/assessment.py`` — see that
helper's docstring for what a mismatch costs.

The index on ``(user_id, assessment_id)`` serves the attempt-cap count, which runs on
every submission before anything is written.

Revision ID: 036
Revises: 035
Create Date: 2026-08-25
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "036"
down_revision = "035"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # ── Enum type ──────────────────────────────────────────────────────────
    conn.execute(sa.text(
        "DO $$ BEGIN "
        "CREATE TYPE assessment_question_type AS ENUM ('single_choice', 'multi_choice'); "
        "EXCEPTION WHEN duplicate_object THEN NULL; "
        "END $$"
    ))

    # ── Assessments ────────────────────────────────────────────────────────
    op.create_table(
        "assessments",
        sa.Column("id", sa.Uuid, primary_key=True),
        sa.Column("course_id", sa.Uuid, sa.ForeignKey("courses.id"), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("passing_score", sa.Integer, nullable=False, server_default=sa.text("70")),
        sa.Column("max_attempts", sa.Integer, nullable=False, server_default=sa.text("3")),
        sa.Column("published", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("course_id", name="uq_assessments_course"),
        sa.CheckConstraint("passing_score BETWEEN 0 AND 100", name="ck_assessments_passing_score"),
        sa.CheckConstraint("max_attempts > 0", name="ck_assessments_max_attempts"),
    )

    # ── Questions ──────────────────────────────────────────────────────────
    op.create_table(
        "assessment_questions",
        sa.Column("id", sa.Uuid, primary_key=True),
        sa.Column(
            "assessment_id", sa.Uuid,
            sa.ForeignKey("assessments.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column("prompt", sa.Text, nullable=False),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default=sa.text("0")),
        sa.Column(
            "question_type",
            postgresql.ENUM(
                "single_choice", "multi_choice",
                name="assessment_question_type", create_type=False,
            ),
            nullable=False,
            server_default="single_choice",
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index(
        "ix_assessment_questions_assessment_sort",
        "assessment_questions",
        ["assessment_id", "sort_order"],
    )

    # ── Options ────────────────────────────────────────────────────────────
    op.create_table(
        "assessment_options",
        sa.Column("id", sa.Uuid, primary_key=True),
        sa.Column(
            "question_id", sa.Uuid,
            sa.ForeignKey("assessment_questions.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column("label", sa.Text, nullable=False),
        sa.Column("is_correct", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index(
        "ix_assessment_options_question_sort",
        "assessment_options",
        ["question_id", "sort_order"],
    )

    # ── Attempts (append-only: created_at, no updated_at) ───────────────────
    op.create_table(
        "assessment_attempts",
        sa.Column("id", sa.Uuid, primary_key=True),
        sa.Column("user_id", sa.Uuid, sa.ForeignKey("users.id"), nullable=False),
        sa.Column(
            "assessment_id", sa.Uuid,
            sa.ForeignKey("assessments.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column("attempt_number", sa.Integer, nullable=False),
        sa.Column("score", sa.Integer, nullable=False),
        sa.Column("passed", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("answers", postgresql.JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("score BETWEEN 0 AND 100", name="ck_assessment_attempts_score"),
        sa.CheckConstraint("attempt_number > 0", name="ck_assessment_attempts_number"),
    )
    # Serves the attempt-cap count and "my attempts", both keyed on this pair.
    op.create_index(
        "ix_assessment_attempts_user_assessment",
        "assessment_attempts",
        ["user_id", "assessment_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_assessment_attempts_user_assessment", table_name="assessment_attempts")
    op.drop_table("assessment_attempts")

    op.drop_index("ix_assessment_options_question_sort", table_name="assessment_options")
    op.drop_table("assessment_options")

    op.drop_index("ix_assessment_questions_assessment_sort", table_name="assessment_questions")
    op.drop_table("assessment_questions")

    op.drop_table("assessments")

    conn = op.get_bind()
    conn.execute(sa.text("DROP TYPE IF EXISTS assessment_question_type"))
