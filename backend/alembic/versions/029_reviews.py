"""Add reviews table and denormalised counters on content tables.

Creates the ``reviews`` table with a ``review_state`` enum, a partial index
for the moderation queue, and a unique constraint enforcing one review per
user per content item.

Adds ``review_count`` and ``rating_sum`` to ``courses``, ``templates`` and
``products`` — denormalised counters updated in the same transaction as
moderation transitions, so the public catalogue never needs a COUNT/AVG join
per card.

Revision ID: 029
Revises: 028
Create Date: 2026-08-23
"""
import sqlalchemy as sa
from alembic import op

revision = "029"
down_revision = "028"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # ── Enum type ──────────────────────────────────────────────────────────
    conn.execute(sa.text(
        "DO $$ BEGIN "
        "CREATE TYPE review_state AS ENUM ('pending', 'approved', 'rejected'); "
        "EXCEPTION WHEN duplicate_object THEN NULL; "
        "END $$"
    ))

    # ── Reviews table ──────────────────────────────────────────────────────
    op.create_table(
        "reviews",
        sa.Column("id", sa.Uuid, primary_key=True),
        sa.Column("user_id", sa.Uuid, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("content_type", sa.String(50), nullable=False),
        sa.Column("content_id", sa.Uuid, nullable=False),
        sa.Column("rating", sa.SmallInteger, nullable=False),
        sa.Column("body", sa.Text, nullable=True),
        sa.Column("display_name", sa.String(120), nullable=True),
        sa.Column("state", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("is_featured", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("moderated_by", sa.String(255), nullable=True),
        sa.Column("moderated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("content_type IN ('course', 'template', 'pack')", name="ck_reviews_content_type"),
        sa.CheckConstraint("rating BETWEEN 1 AND 5", name="ck_reviews_rating"),
        sa.UniqueConstraint("user_id", "content_type", "content_id", name="uq_reviews_user_content"),
    )

    # Partial index for the moderation queue
    op.create_index(
        "ix_reviews_state_created",
        "reviews",
        ["state", sa.text("created_at DESC")],
    )

    # ── Denormalised counters on content tables ─────────────────────────────
    for table in ("courses", "templates", "products"):
        op.add_column(table, sa.Column("review_count", sa.Integer, nullable=False, server_default=sa.text("0")))
        op.add_column(table, sa.Column("rating_sum", sa.Integer, nullable=False, server_default=sa.text("0")))


def downgrade() -> None:
    for table in ("courses", "templates", "products"):
        op.drop_column(table, "rating_sum")
        op.drop_column(table, "review_count")

    op.drop_index("ix_reviews_state_created", table_name="reviews")
    op.drop_table("reviews")

    conn = op.get_bind()
    conn.execute(sa.text("DROP TYPE IF EXISTS review_state"))
