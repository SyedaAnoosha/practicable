"""Add templates.is_free — the free lead-magnet template.

Product spec §9 must-have: "At least one free template that captures an email", and
§4.3's "cheapest, fastest, easiest first purchase, and the natural free-entry-point /
email-capture item". Owner instruction, 2026-08-12: "Made question free and one
template free for capturing email."

A free template is NOT sold. It has no product, no price, and no entitlement — the
download endpoint serves it to anyone who asks. The email is captured client-side into
`leads`, exactly as the free question's guidance is (DESIGN.md §21.3): a conversion
device, not a security boundary. Marking a template free is therefore a real product
decision, which is why it is an explicit column an admin toggles rather than something
inferred from "has no product row" — a template that simply hasn't been priced yet is
a draft, not a giveaway, and the two must not be the same state.

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
