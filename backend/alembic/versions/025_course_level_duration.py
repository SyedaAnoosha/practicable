"""Add level and estimated_duration_minutes to courses for catalogue filtering.

Courses currently have no level or duration metadata — the catalogue shows
only title and lesson count. This migration adds a level (beginner /
intermediate / advanced) and an estimated total duration in minutes so the
frontend can offer filter controls like the research recommends.

Level is set by the admin when creating/editing a course. Duration is computed
from the sum of lesson media durations and stored denormalized for fast reads.

Revision ID: 025_course_level_duration
Revises: 024_recommendation_events
Create Date: 2026-08-22
"""
from alembic import op
import sqlalchemy as sa


revision = "025"
down_revision = "024"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "courses",
        sa.Column("level", sa.String(50), nullable=True),
    )
    op.add_column(
        "courses",
        sa.Column("estimated_duration_minutes", sa.Integer, nullable=True),
    )


def downgrade() -> None:
    op.drop_column("courses", "estimated_duration_minutes")
    op.drop_column("courses", "level")
