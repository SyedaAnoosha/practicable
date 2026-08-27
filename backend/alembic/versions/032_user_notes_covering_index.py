"""Make ix_user_notes_user covering.

`ix_user_notes_user` should be on `(user_id)` **`INCLUDE (lesson_id)`** — the same
covering shape as `ix_entitlements_user` in migration `010` and `ix_certificates_user`
in `027`. Migration `030` created it without the `INCLUDE`, so `GET /me/notes` finds
its rows through the index and then visits the heap for every one of them purely to
read `lesson_id`.

That column is in the response for every note and is the only thing the heap visit
fetches, so including it removes the visit entirely — an index-only scan on a query
that runs on every lesson page a learner opens.

An additive follow-up rather than an edit to `030`: never amend a migration that has
already run.

Revision ID: 032
Revises: 031
Create Date: 2026-08-23
"""
import sqlalchemy as sa
from alembic import op

revision = "032"
down_revision = "031"
branch_labels = None
depends_on = None

_INDEX_NAME = "ix_user_notes_user"


def upgrade() -> None:
    # CONCURRENTLY, inside the autocommit block — the pattern migration 010 established.
    # Dropped and recreated rather than altered: Postgres has no ALTER INDEX ... INCLUDE.
    with op.get_context().autocommit_block():
        op.drop_index(_INDEX_NAME, table_name="user_notes", postgresql_concurrently=True, if_exists=True)
        op.create_index(
            _INDEX_NAME,
            "user_notes",
            ["user_id"],
            postgresql_include=["lesson_id"],
            postgresql_concurrently=True,
            if_not_exists=True,
        )
        op.execute(
            sa.text(f"COMMENT ON INDEX {_INDEX_NAME} IS :c").bindparams(
                c="GET /me/notes — covering on lesson_id so the learner's note list is "
                  "served index-only, without a heap visit per row."
            )
        )

    # A CONCURRENTLY build can fail and leave an INVALID index behind WITHOUT raising.
    # Checked explicitly: an INVALID index is silent, it simply never gets used, and
    # here it would also mean the table is left with no usable index on user_id at all.
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


def downgrade() -> None:
    # Back to migration 030's plain index, so a downgrade leaves the schema as 030 left it.
    with op.get_context().autocommit_block():
        op.drop_index(_INDEX_NAME, table_name="user_notes", postgresql_concurrently=True, if_exists=True)
        op.create_index(
            _INDEX_NAME,
            "user_notes",
            ["user_id"],
            postgresql_concurrently=True,
            if_not_exists=True,
        )
