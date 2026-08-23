"""Add user_notes and bookmarks tables (W5-R5).

``user_notes`` stores per-lesson learner notes. One note per lesson per
learner, edited in place via upsert.

``bookmarks`` stores saved content references across courses, templates,
and packs. One bookmark per user per content item.

Revision ID: 030
Revises: 029
Create Date: 2026-08-23
"""
import sqlalchemy as sa
from alembic import op

revision = "030"
down_revision = "029"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── user_notes ─────────────────────────────────────────────────────────
    op.create_table(
        "user_notes",
        sa.Column("id", sa.Uuid, primary_key=True),
        sa.Column("user_id", sa.Uuid, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("lesson_id", sa.Uuid, sa.ForeignKey("lessons.id"), nullable=False),
        sa.Column("body", sa.Text, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "lesson_id", name="uq_user_notes_user_lesson"),
    )
    op.create_index("ix_user_notes_user", "user_notes", ["user_id"])

    # ── bookmarks ──────────────────────────────────────────────────────────
    op.create_table(
        "bookmarks",
        sa.Column("id", sa.Uuid, primary_key=True),
        sa.Column("user_id", sa.Uuid, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("content_type", sa.String(50), nullable=False),
        sa.Column("content_id", sa.Uuid, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("content_type IN ('course', 'template', 'pack')", name="ck_bookmarks_content_type"),
        sa.UniqueConstraint("user_id", "content_type", "content_id", name="uq_bookmarks_user_content"),
    )
    op.create_index("ix_bookmarks_user", "bookmarks", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_bookmarks_user", table_name="bookmarks")
    op.drop_table("bookmarks")
    op.drop_index("ix_user_notes_user", table_name="user_notes")
    op.drop_table("user_notes")
