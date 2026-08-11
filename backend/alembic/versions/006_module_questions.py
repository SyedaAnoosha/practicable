"""Create module_questions

Lets a module attach a question as a syllabus item alongside its lessons — e.g. a
reading module can point at the question its content answers, so a learner can jump
straight to the related written guidance from the course outline. Questions stay
free/public everywhere (app/api/v1/content/questions.py) regardless of this link; this
table only records that a module references one, not any new gating.

Revision ID: 006
Revises: 005
Create Date: 2026-08-11 00:45:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = '006'
down_revision = '005'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'module_questions',
        sa.Column('id', sa.UUID(), primary_key=True),
        sa.Column('module_id', sa.UUID(), sa.ForeignKey('modules.id'), nullable=False),
        sa.Column('question_id', sa.UUID(), sa.ForeignKey('questions.id'), nullable=False),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_unique_constraint(
        'uq_module_questions_module_question', 'module_questions', ['module_id', 'question_id']
    )


def downgrade() -> None:
    op.drop_table('module_questions')
