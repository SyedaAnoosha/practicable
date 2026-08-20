"""Add cover_image_key to courses for course preview images.

Courses currently have no preview/cover image — the catalogue and detail pages
show only text. This migration adds a nullable storage key so an admin can upload
a cover image (like Coursera, edX, Udemy course thumbnails) through the admin
panel. Null means no image yet; the public pages degrade gracefully by hiding
the image slot.

Revision ID: 018_course_cover_image
Revises: 017_lesson_prose_sanitized
Create Date: 2026-08-20
"""
from alembic import op
import sqlalchemy as sa


revision = "018"
down_revision = "017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "courses",
        sa.Column("cover_image_key", sa.String(500), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("courses", "cover_image_key")
