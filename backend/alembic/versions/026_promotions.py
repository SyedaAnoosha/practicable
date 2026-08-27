"""Add promotions table for admin-controlled discount codes.

The discount path already reaches Stripe end to end (stripe_client.py:53-84).
This migration adds the control surface: a promotions table an admin can
manage, plus a partial index for the single hot query (GET /promotions/active).

Query it exists for: GET /promotions/active — one query, on the partial index,
LIMIT 1, ORDER BY starts_at DESC. Date filtering happens in SQL, not Python.

Revision ID: 026
Revises: 025
Create Date: 2026-08-23
"""
import sqlalchemy as sa
from alembic import op

revision = "026"
down_revision = "025"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "promotions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("code", sa.String(64), nullable=False, unique=True),
        sa.Column("message", sa.String(255), nullable=False),
        sa.Column("percent_off", sa.Integer(), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("stripe_coupon_id", sa.String(255), nullable=True),
        sa.Column("stripe_promotion_code_id", sa.String(255), nullable=True),
        sa.Column("created_by", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            "percent_off > 0 AND percent_off <= 100",
            name="ck_promotions_percent_off",
        ),
        sa.CheckConstraint(
            "ends_at IS NULL OR ends_at > starts_at",
            name="ck_promotions_dates",
        ),
    )

    # Partial index for GET /promotions/active: filters on active first, then
    # the date window. The table is empty at migration time, so CONCURRENTLY
    # is unnecessary — but the pattern is idempotent and the comment names
    # the query so a later reader knows why the index shape matches.
    op.create_index(
        "ix_promotions_active_window",
        "promotions",
        ["starts_at", "ends_at"],
        postgresql_where=sa.text("active"),
    )


def downgrade() -> None:
    op.drop_index("ix_promotions_active_window", table_name="promotions")
    op.drop_table("promotions")
