"""Add prose_sanitized column to lesson_blocks (Phase 8 8E).

Mirrors the existing prose_sanitized column on lessons (migration 017):
the original text_body is kept for editing; prose_sanitized holds the
sanitized HTML rendered to the reader.  Nullable — null means the block
is plain text (the existing rendering path).

Revision ID: 022
Revises: 021
"""
import sqlalchemy as sa
from alembic import op

revision = "022"
down_revision = "021"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "lesson_blocks",
        sa.Column("prose_sanitized", sa.Text, nullable=True),
    )


def downgrade() -> None:
    op.drop_column("lesson_blocks", "prose_sanitized")
