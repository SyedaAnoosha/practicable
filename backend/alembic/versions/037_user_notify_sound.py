"""Add users.notify_sound for sound notification preference.

Adds a boolean column that controls whether the frontend plays a sound when
new notifications arrive. Defaults to True so existing users hear notifications
by default; the account settings page lets them disable it.

Revision ID: 037
Revises: 036
Create Date: 2026-08-25
"""
import sqlalchemy as sa
from alembic import op

revision = "037"
down_revision = "036"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "notify_sound",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "notify_sound")
