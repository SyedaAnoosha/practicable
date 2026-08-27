"""Add buyer-initiated refund detail columns to orders.

buyer_refund_amount_cents, buyer_refunded_at, buyer_refund_reason_code,
buyer_refund_reason_text — nullable, only populated when a buyer initiates
a partial refund through the self-serve path.

The existing admin full-refund path (refund_service.py) continues to set
status=REFUNDED without touching these columns, keeping the two refund
paths distinguishable.

Revision ID: 021
Revises: 020_merge_015_019
Create Date: 2026-08-20
"""
from alembic import op
import sqlalchemy as sa

revision = "021"
down_revision = "020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "orders",
        sa.Column("buyer_refund_amount_cents", sa.Integer(), nullable=True),
    )
    op.add_column(
        "orders",
        sa.Column("buyer_refunded_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "orders",
        sa.Column("buyer_refund_reason_code", sa.String(50), nullable=True),
    )
    op.add_column(
        "orders",
        sa.Column("buyer_refund_reason_text", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("orders", "buyer_refund_reason_text")
    op.drop_column("orders", "buyer_refund_reason_code")
    op.drop_column("orders", "buyer_refunded_at")
    op.drop_column("orders", "buyer_refund_amount_cents")
