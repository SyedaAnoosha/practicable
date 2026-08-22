"""Analytics events for filters and downloads (week4_plan.md W4-R10).

Adds `filter_events` and `download_events` tables for tracking user behavior
without user_id (privacy-first analytics).

These tables capture:
- filter_events: when users apply filters in the questions catalogue
- download_events: when users download templates/packs

Both tables are intentionally anonymous (no user_id) to respect privacy
while still enabling aggregate analytics.

Revision ID: 014
Revises: 013
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "014"
down_revision = "013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # filter_events table
    op.create_table(
        "filter_events",
        sa.Column(
            "id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("domain", sa.String(), nullable=True),
        sa.Column("effort", sa.String(), nullable=True),
        sa.Column("duration", sa.String(), nullable=True),
        sa.Column("cost", sa.String(), nullable=True),
        sa.Column("roi_horizon", sa.String(), nullable=True),
        sa.Column("regulator_pressure", sa.String(), nullable=True),
        sa.Column("tier", postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column("leadership_traits", postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column("query_text", sa.String(), nullable=True),
        sa.Column("result_count", sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_filter_events_created_at", "filter_events", ["created_at"])

    # download_events table
    op.create_table(
        "download_events",
        sa.Column(
            "id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("content_type", sa.String(), nullable=False),  # "template" or "pack"
        sa.Column("content_id", sa.UUID(), nullable=True),
        sa.Column("content_slug", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_download_events_created_at", "download_events", ["created_at"])
    op.create_index("ix_download_events_content_type", "download_events", ["content_type"])


def downgrade() -> None:
    op.drop_index("ix_download_events_content_type", table_name="download_events")
    op.drop_index("ix_download_events_created_at", table_name="download_events")
    op.drop_table("download_events")
    op.drop_index("ix_filter_events_created_at", table_name="filter_events")
    op.drop_table("filter_events")
