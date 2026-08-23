"""Add certificates table for course completion certificates (W5-R2).

On the false→true transition of CourseProgress.completed, exactly one
Certificate row is created. Re-completing, un-completing then re-completing,
or replaying the request never creates a second row — enforced by
UNIQUE(user_id, course_id), not by application logic.

Query it exists for:
1. Issue: INSERT ... ON CONFLICT DO NOTHING (no SELECT first — the
   constraint is the guard).
2. Verify: one query on the unique verification_code index.
3. Learner list: ix_certificates_user on (user_id) INCLUDE (course_id).

Revision ID: 027
Revises: 026
Create Date: 2026-08-23
"""
import sqlalchemy as sa
from alembic import op

revision = "027"
down_revision = "026"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "certificates",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "course_id",
            sa.Uuid(),
            sa.ForeignKey("courses.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("verification_code", sa.String(32), nullable=False, unique=True),
        sa.Column("learner_name_snapshot", sa.String(255), nullable=False),
        sa.Column("course_title_snapshot", sa.String(500), nullable=False),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("pdf_storage_key", sa.String(500), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "course_id", name="uq_certificates_user_course"),
    )

    # ix_certificates_user: the learner's "my certificates" list. INCLUDE (course_id)
    # so the query is served entirely from the index without hitting the table.
    op.create_index(
        "ix_certificates_user",
        "certificates",
        ["user_id"],
        postgresql_include=["course_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_certificates_user", table_name="certificates")
    op.drop_table("certificates")
