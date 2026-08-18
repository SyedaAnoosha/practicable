"""Refunds and revocation (week3_plan.md W3-R5, Phase 4).

Adds `entitlements.revoked_at`/`revoked_reason` — the columns the gate needs to tell
"this user never had this" from "this user had this and it was taken back." The gate
itself changes in exactly one place (`core/entitlements.py:resolve_product_ids`),
non-negotiable #3: revocation is enforced in the query that already runs, never a
second check bolted on beside it.

Per week3_plan.md §26.4, this is also where the partial, covering index promised in
migration 010's comment lands: `ix_entitlements_user_live` answers
`resolve_product_ids()` from the index alone (INCLUDE product_id) and only ever
indexes live rows (`WHERE revoked_at IS NULL`) — the gate never reads a revoked
entitlement, so there is no reason to spend index space carrying rows it will never
match. The plain `ix_entitlements_user` from migration 010 is dropped in the same
migration it's superseded in, per that migration's own comment: "two indexes on the
same leading column is one index too many."

Revision ID: 011
Revises: 010
"""
import sqlalchemy as sa
from alembic import op

revision = "011"
down_revision = "010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Nullable, no default — a metadata-only change on Postgres, doesn't rewrite the
    # table. Must land (and be committed) before the autocommit block below builds an
    # index that references the new column.
    op.add_column("entitlements", sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("entitlements", sa.Column("revoked_reason", sa.Text(), nullable=True))

    # CONCURRENTLY cannot run inside Alembic's default transaction (week3_plan.md
    # §27.2) — same pattern as migration 010.
    with op.get_context().autocommit_block():
        op.create_index(
            "ix_entitlements_user_live",
            "entitlements",
            ["user_id"],
            postgresql_concurrently=True,
            postgresql_include=["product_id"],
            postgresql_where=sa.text("revoked_at IS NULL"),
        )
        op.execute(
            sa.text(
                "COMMENT ON INDEX ix_entitlements_user_live IS "
                ":c"
            ).bindparams(
                c=(
                    "Query 1 (THE GATE) — core/entitlements.py:resolve_product_ids, every "
                    "gated request. Partial + covering: answers the query from the index "
                    "alone, and never carries a revoked row. Supersedes ix_entitlements_user "
                    "(migration 010), dropped below."
                )
            )
        )
        op.drop_index("ix_entitlements_user", table_name="entitlements", postgresql_concurrently=True)

    # A CONCURRENTLY build can fail and leave an INVALID index behind without raising —
    # verified explicitly, same as migration 010.
    conn = op.get_bind()
    invalid = conn.execute(
        sa.text(
            "SELECT indexrelid::regclass::text FROM pg_index WHERE NOT indisvalid "
            "AND indexrelid::regclass::text = 'ix_entitlements_user_live'"
        )
    ).fetchall()
    if invalid:
        raise RuntimeError(
            f"CREATE INDEX CONCURRENTLY left INVALID index(es): {[r[0] for r in invalid]}. "
            "Drop and re-run — see week3_plan.md §27.2."
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.create_index(
            "ix_entitlements_user",
            "entitlements",
            ["user_id"],
            postgresql_concurrently=True,
            postgresql_include=["product_id"],
        )
        op.drop_index("ix_entitlements_user_live", table_name="entitlements", postgresql_concurrently=True)

    op.drop_column("entitlements", "revoked_reason")
    op.drop_column("entitlements", "revoked_at")
