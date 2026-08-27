"""Add notification preference columns to users.

Revision ID: 023
Revises: 022
Create Date: 2026-08-21
"""

from alembic import op
import sqlalchemy as sa

revision = "023"
down_revision = "022"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Two named columns, not a JSONB blob — house preference for named columns over
    # opaque fields.
    op.add_column(
        "users",
        sa.Column(
            "notify_marketing",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "notify_product_updates",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "notify_product_updates")
    op.drop_column("users", "notify_marketing")
