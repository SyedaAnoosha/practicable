"""Add settings table and users.disabled_at for admin panel gaps.

settings table: operational key-value store for non-secret configuration.
Docstring deliberately states: NO SECRET IS EVER INSERTED. Secrets read from
env with no DB path at all, so there is no code route by which a database row
could ever supply a key.

users.disabled_at: soft-deactivation timestamp, wired into the entitlements gate
(core/entitlements.py) so a deactivated user's existing entitlements are refused
at the same choke point as every other access check.

Revision ID: 015_settings_and_deactivation
Revises: 014_filter_events
Create Date: 2026-08-20
"""
from alembic import op
import sqlalchemy as sa


revision = "015"
down_revision = "014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── settings table ─────────────────────────────────────────────────────────
    # Operational keys only. Secrets are never stored here — see the module docstring.
    op.create_table(
        "settings",
        sa.Column("key", sa.String(255), primary_key=True),
        sa.Column("value", sa.Text(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("updated_by", sa.String(255), nullable=True),
    )

    # ── users.disabled_at ──────────────────────────────────────────────────────
    op.add_column(
        "users",
        sa.Column("disabled_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "disabled_at")
    op.drop_table("settings")
