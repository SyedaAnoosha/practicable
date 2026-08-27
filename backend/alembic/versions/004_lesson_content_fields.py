"""Add reading/download/free-preview fields to lessons

The LMS shell (courses catalogue, course outline, lesson viewer) needs lessons to
carry content for the two non-video types: `body` for reading lessons, and
`download_template_id` for downloadable-artefact lessons (reusing the templates table's
storage_key/file_name/mime_type rather than duplicating file columns on lessons).
`is_free_preview` backs the free preview lesson.

Revision ID: 004
Revises: 003
Create Date: 2026-08-11 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = '004'
down_revision = '003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('lessons', sa.Column('body', sa.Text(), nullable=True))
    op.add_column('lessons', sa.Column('download_template_id', sa.UUID(), nullable=True))
    op.add_column(
        'lessons',
        sa.Column('is_free_preview', sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_foreign_key(
        'fk_lessons_download_template_id', 'lessons', 'templates', ['download_template_id'], ['id']
    )


def downgrade() -> None:
    op.drop_constraint('fk_lessons_download_template_id', 'lessons', type_='foreignkey')
    op.drop_column('lessons', 'is_free_preview')
    op.drop_column('lessons', 'download_template_id')
    op.drop_column('lessons', 'body')
