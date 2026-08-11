"""Drop lessons.is_free_preview

Explicit product decision (owner, 2026-08-11): video and lessons must never be free —
only a question's written guidance is free (email-gated client-side). The free-preview
mechanic added in 004 was a DESIGN.md §23.3 recommendation, not a requirement the
owner wants; dropping the column removes the bypass structurally rather than just
leaving no row with the flag set, so it can't be silently re-enabled later (e.g. by a
future admin UI) without a deliberate schema change.

Revision ID: 005
Revises: 004
Create Date: 2026-08-11 00:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = '005'
down_revision = '004'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column('lessons', 'is_free_preview')


def downgrade() -> None:
    op.add_column(
        'lessons',
        sa.Column('is_free_preview', sa.Boolean(), nullable=False, server_default=sa.false()),
    )
