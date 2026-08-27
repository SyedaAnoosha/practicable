"""Add stripe_product_id to products table.

Price control for every course and template. Adds nullable stripe_product_id column to
store the Stripe Product ID returned by create_price(). Enables future price changes by
allowing reuse of the same Stripe Product when creating new Prices.

Nullable because the backfill can genuinely fail for a seeded row, and a NOT NULL column
would force a lie into it.

Revision ID: 016
Revises: 014
"""
import sqlalchemy as sa
from alembic import op

revision = "016"
down_revision = "014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add nullable stripe_product_id column
    op.add_column(
        "products",
        sa.Column("stripe_product_id", sa.String(length=255), nullable=True),
    )


def downgrade() -> None:
    # Remove stripe_product_id column
    op.drop_column("products", "stripe_product_id")
