"""Add prose_sanitized column to lessons table.

Rich text round trip for lesson prose. Adds nullable prose_sanitized column to store
sanitized HTML content. The original prose column remains for editing, while
prose_sanitized is the safe version displayed to users.

Revision ID: 017
Revises: 016
"""
import sqlalchemy as sa
from alembic import op

revision = "017"
down_revision = "016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add nullable prose_sanitized column
    op.add_column(
        "lessons",
        sa.Column("prose_sanitized", sa.Text, nullable=True),
    )


def downgrade() -> None:
    # Remove prose_sanitized column
    op.drop_column("lessons", "prose_sanitized")
