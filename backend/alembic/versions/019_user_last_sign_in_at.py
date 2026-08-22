"""Add last_sign_in_at to users for the admin metrics "active users" query.

app/api/v1/admin/metrics.py's _get_active_users() counts users seen within the
last N days, but until now nothing on the User model recorded when a user was
last seen — Supabase auth tracks its own sign-in timestamp, but this backend
never read it back. This adds a nullable column, stamped in
app/core/deps.get_current_user on every authenticated request (see that
function for the write side).

Revision ID: 019_user_last_sign_in_at
Revises: 018_course_cover_image
Create Date: 2026-08-20
"""
from alembic import op
import sqlalchemy as sa


revision = "019"
down_revision = "018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("last_sign_in_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "last_sign_in_at")
