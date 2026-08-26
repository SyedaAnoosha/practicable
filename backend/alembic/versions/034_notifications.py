"""Add notifications table for template version updates (#6).

Creates the notifications table to support user notifications when
templates they own have new versions available.

Revision ID: 034
Revises: 033
Create Date: 2026-08-25
"""
import sqlalchemy as sa
from alembic import op

revision = "034"
down_revision = "033"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "notifications",
        sa.Column("id", sa.Uuid, primary_key=True),
        sa.Column("user_id", sa.Uuid, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("notification_type", sa.String(50), nullable=False),
        sa.Column("entity_type", sa.String(50), nullable=False),
        sa.Column("entity_id", sa.Uuid, nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("message", sa.Text, nullable=False),
        sa.Column("read", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("email_delivered", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("email_delivered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("action_url", sa.String(500), nullable=True),
        sa.Column("meta", sa.JSON, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("entity_type IN ('template', 'course', 'pack')", name="ck_notifications_entity_type"),
    )

    # Index for user notifications lookup
    op.create_index(
        "ix_notifications_user_id_read",
        "notifications",
        ["user_id", sa.text("read"), sa.text("created_at DESC")],
    )


def downgrade() -> None:
    op.drop_index("ix_notifications_user_id_read", table_name="notifications")
    op.drop_table("notifications")
