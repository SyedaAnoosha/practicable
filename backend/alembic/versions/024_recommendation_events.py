"""recommendation_events — make W4-R4's routing claim measurable

week4_plan.md W4-R4 item 6 asks for a `recommendation_clicked` event so that §22's own
claim — that routing a reader from a question to a product actually helps — is measured
rather than asserted. Ledger row 29 recorded it as absent everywhere.

Server-side, not PostHog, for the same reason W4-R10's 2026-08-17 amendment moved the
tag-filter counter server-side: the admin metrics page must answer its questions with
no external project key set. This table is the routing twin of `download_events`.

The same privacy constraint as `filter_events` and `download_events`, and it is
load-bearing, not incidental: **no user_id, no session id, no IP.** The question this
table answers is "does routing from question X to product Y get clicked", which needs
only the pair and a timestamp. Adding an identity column would turn an anonymous counter
into a behavioural profile, which is not what was asked for and not what was disclosed.

`surface` distinguishes the two routing components (§20.5 `RoutedProducts` on a question
page, §20.6 `SituationProducts` on a filtered catalogue), because a click from a
question the reader is actually reading and a click from a filter result set are
different signals and averaging them would hide which one works.

Revision ID: 024
Revises: 023
"""
from alembic import op
import sqlalchemy as sa


revision = "024"
down_revision = "023"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "recommendation_events",
        sa.Column(
            "id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        # "question" (RoutedProducts, §20.5) or "catalogue" (SituationProducts, §20.6).
        sa.Column("surface", sa.String(), nullable=False),
        # The question the reader was routed FROM. Nullable because a catalogue-surface
        # click routes from a filter result set, not from one question.
        sa.Column("question_slug", sa.String(), nullable=True),
        # The product the reader was routed TO. Always present — a recommendation click
        # with no destination is not an event, it is a bug.
        sa.Column("product_slug", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    # Serves the admin metrics read: "clicks in the last N days, grouped by product".
    # Same shape as ix_download_events_created_at, which the metrics page already uses.
    op.create_index(
        "ix_recommendation_events_created_at", "recommendation_events", ["created_at"]
    )
    op.create_index(
        "ix_recommendation_events_product_slug", "recommendation_events", ["product_slug"]
    )


def downgrade() -> None:
    op.drop_index(
        "ix_recommendation_events_product_slug", table_name="recommendation_events"
    )
    op.drop_index(
        "ix_recommendation_events_created_at", table_name="recommendation_events"
    )
    op.drop_table("recommendation_events")
