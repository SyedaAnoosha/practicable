"""Add the partial approved-reviews index, and drop the orphaned review_state type.

Two corrections to migration `029`, as additive follow-ups rather than edits, because
`029` has already been applied — never amend a migration that has run.

**1. `ix_reviews_content_approved` was specified and never created.** `reviews` needs
two indexes: `ix_reviews_state_created` for the moderation queue (which `029` did
create) and `ix_reviews_content_approved` — partial, `WHERE state = 'approved'` — for
the public read path. Without it, every testimonial block and every rating lookup on a
content detail page filters `reviews` on an unindexed pair of columns, on a visitor's
page load.

Partial by design: the public path only ever wants approved rows, so indexing the
pending and rejected ones would pay storage and write cost for rows no reader asks
for. The moderation queue has its own index and does not need this one.

**2. The `review_state` enum type is orphaned.** `029` creates
`CREATE TYPE review_state AS ENUM (...)` and then declares `reviews.state` as
`String(20)` with a `'pending'` server default — matching `app/db/models/review.py`,
which also uses `String(20)`. So the type is created, never referenced by any column,
and dropped again on downgrade. It is dead schema.

It is dropped here rather than converting the column to use it. The column is the
thing the application actually reads and writes, and `String(20)` + the model's
`ReviewState(str, enum.Enum)` is a working, tested arrangement; converting a live
column to an enum type is a rewrite with a lock, taken on for no behavioural gain.
What `029` lacked was not the type but a *constraint* — so this migration adds the
CHECK that makes the allowed values enforceable at the database, which is what the
type was reaching for. `DROP TYPE` is guarded: if some future migration has since
attached the type to a column, the drop is skipped rather than failing.

Revision ID: 031
Revises: 030
Create Date: 2026-08-23
"""
import sqlalchemy as sa
from alembic import op

revision = "031"
down_revision = "030"
branch_labels = None
depends_on = None

_INDEX_NAME = "ix_reviews_content_approved"


def upgrade() -> None:
    # ── The partial index — CONCURRENTLY, so it never blocks writes on a table
    # people are reading. Cannot run inside Alembic's default transaction, hence the
    # autocommit block — the pattern migration 010 established.
    with op.get_context().autocommit_block():
        op.create_index(
            _INDEX_NAME,
            "reviews",
            ["content_type", "content_id"],
            unique=False,
            postgresql_concurrently=True,
            postgresql_where=sa.text("state = 'approved'"),
            if_not_exists=True,
        )
        op.execute(
            sa.text(f"COMMENT ON INDEX {_INDEX_NAME} IS :c").bindparams(
                c="Public read path — GET /reviews/featured and GET /reviews/rating. "
                  "Partial: the public path only ever wants approved rows."
            )
        )

    # A CONCURRENTLY build can fail and leave an INVALID index behind WITHOUT raising.
    # Verify explicitly — an INVALID index is silent, it simply never gets used.
    conn = op.get_bind()
    invalid = conn.execute(
        sa.text(
            "SELECT indexrelid::regclass::text FROM pg_index WHERE NOT indisvalid "
            "AND indexrelid::regclass::text = :name"
        ),
        {"name": _INDEX_NAME},
    ).fetchall()
    if invalid:
        raise RuntimeError(
            f"CREATE INDEX CONCURRENTLY left INVALID index(es): {[r[0] for r in invalid]}. "
            "Drop and re-run."
        )

    # ── The CHECK the orphaned enum type was reaching for. Back inside Alembic's
    # normal transactional DDL — the autocommit block has already exited.
    op.create_check_constraint(
        "ck_reviews_state",
        "reviews",
        "state IN ('pending', 'approved', 'rejected')",
    )

    # ── Drop the orphaned type, but only if nothing actually uses it. pg_depend is
    # the authority on whether a column still references it; guessing would turn a
    # tidy-up into an outage.
    conn.execute(
        sa.text(
            """
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'review_state')
                   AND NOT EXISTS (
                       SELECT 1
                       FROM pg_attribute a
                       JOIN pg_type t ON a.atttypid = t.oid
                       WHERE t.typname = 'review_state' AND a.attnum > 0
                   )
                THEN
                    DROP TYPE review_state;
                END IF;
            END $$
            """
        )
    )


def downgrade() -> None:
    # Recreate the type so a downgrade to 029's world leaves the schema as 029 left it.
    conn = op.get_bind()
    conn.execute(
        sa.text(
            "DO $$ BEGIN "
            "CREATE TYPE review_state AS ENUM ('pending', 'approved', 'rejected'); "
            "EXCEPTION WHEN duplicate_object THEN NULL; "
            "END $$"
        )
    )

    op.drop_constraint("ck_reviews_state", "reviews", type_="check")

    with op.get_context().autocommit_block():
        op.drop_index(
            _INDEX_NAME,
            table_name="reviews",
            postgresql_concurrently=True,
            if_exists=True,
        )
