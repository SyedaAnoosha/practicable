"""Add a unique constraint on tag_values(tag_dimension, value)

db/seed/001_seed_domains_and_tags.sql relies on `ON CONFLICT DO NOTHING` to stay
idempotent across re-runs, but with no unique constraint on this table that clause
was a silent no-op — every re-seed would have duplicated all 24 tag rows.

Revision ID: 002
Revises: 001
Create Date: 2026-08-10 00:00:00.000000

"""
from alembic import op


revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_unique_constraint(
        'uq_tag_values_dimension_value', 'tag_values', ['tag_dimension', 'value']
    )


def downgrade() -> None:
    op.drop_constraint('uq_tag_values_dimension_value', 'tag_values', type_='unique')
