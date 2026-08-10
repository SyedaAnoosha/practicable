"""Add a unique constraint on lessons.slug

Every other content table with a slug (questions, courses, templates) already has
one; lessons was missed. db/seed/004_seed_course_skeleton.sql's
`ON CONFLICT (slug) DO NOTHING` needs it to exist to even be valid SQL, let alone
idempotent.

Revision ID: 003
Revises: 002
Create Date: 2026-08-10 00:05:00.000000

"""
from alembic import op


revision = '003'
down_revision = '002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_unique_constraint('uq_lessons_slug', 'lessons', ['slug'])


def downgrade() -> None:
    op.drop_constraint('uq_lessons_slug', 'lessons', type_='unique')
