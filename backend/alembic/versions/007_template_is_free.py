"""Add templates.is_free — the free lead-magnet template.

Supports the free lead-magnet template: at least one free template that captures an
email, the natural free entry point.

A free template is NOT sold. It has no product, no price, and no entitlement — the
download endpoint serves it to anyone who asks. The email is captured client-side into
`leads`, like the free question's guidance: a conversion device, not a security
boundary. Marking a template free is a real product decision, which is why it is an
explicit column an admin toggles rather than something inferred from "has no product
row" — a template that simply hasn't been priced yet is a draft, not a giveaway.

Revision ID: 007
Revises: 006
"""
import sqlalchemy as sa
from alembic import op

revision = "007"
down_revision = "006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "templates",
        sa.Column("is_free", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("templates", "is_free")
