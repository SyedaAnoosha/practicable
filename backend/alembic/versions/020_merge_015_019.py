"""Merge migration 015 (settings/deactivation) and 019 (user last_sign_in_at).

These two migrations branched from 014 independently and both ran successfully.
This merge unifies them into a single head.

Revision ID: 020
Revises: 015, 019
Create Date: 2026-08-20
"""
from alembic import op
import sqlalchemy as sa

revision = "020"
down_revision = ("015", "019")
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Both 015 and 019 have already been applied individually. This merge
    # revision is purely structural — no schema changes needed.
    pass


def downgrade() -> None:
    pass
