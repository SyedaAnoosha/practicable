"""Add full-text search vectors and GIN indexes for site search.

Four generated tsvector columns and four GIN indexes. Generated columns,
not trigger-maintained — a trigger is a second place the truth lives and a
second thing to forget on a bulk update.

Each table's weight mapping:
- courses:    title=A, subtitle=B, description=C
- templates:  title=A, description=C
- questions:  title=A, preview=B, body=C
- products:   name=A, search_title=B, description=C

Query it exists for: GET /search — four queries, one per entity type, each
WHERE search_vector @@ websearch_to_tsquery('english', :q) AND published
WITH ORDER BY ts_rank_cd(...) DESC LIMIT 5. Constant regardless of result count.

Uses websearch_to_tsquery, not plainto_tsquery: it accepts quoted phrases
and `or`, and — the operative reason — it never raises on malformed input.
The input here is a public query string, so a parser that can throw is a
500 waiting for the first person who types a stray quote.

Index build: CONCURRENTLY, inside the autocommit block, with the INVALID
verification pass from migration 010. A GIN build across four tables at
current volume is sub-second — the pattern is there for the volume it is
being built for, not today's.

Revision ID: 028
Revises: 027
Create Date: 2026-08-23
"""
import sqlalchemy as sa
from alembic import op

revision = "028"
down_revision = "027"
branch_labels = None
depends_on = None

# (index name, table, tsvector definition)
_SEARCH_COLUMNS = [
    (
        "ix_courses_search",
        "courses",
        "setweight(to_tsvector('english', coalesce(title, '')), 'A') || "
        "setweight(to_tsvector('english', coalesce(subtitle, '')), 'B') || "
        "setweight(to_tsvector('english', coalesce(description, '')), 'C')",
    ),
    (
        "ix_templates_search",
        "templates",
        "setweight(to_tsvector('english', coalesce(title, '')), 'A') || "
        "setweight(to_tsvector('english', coalesce(description, '')), 'C')",
    ),
    (
        "ix_questions_search",
        "questions",
        "setweight(to_tsvector('english', coalesce(title, '')), 'A') || "
        "setweight(to_tsvector('english', coalesce(preview, '')), 'B') || "
        "setweight(to_tsvector('english', coalesce(body, '')), 'C')",
    ),
    (
        "ix_products_search",
        "products",
        "setweight(to_tsvector('english', coalesce(name, '')), 'A') || "
        "setweight(to_tsvector('english', coalesce(search_title, '')), 'B') || "
        "setweight(to_tsvector('english', coalesce(description, '')), 'C')",
    ),
]


def upgrade() -> None:
    conn = op.get_bind()

    # ── Generated tsvector columns ─────────────────────────────────────────
    for _idx_name, table, definition in _SEARCH_COLUMNS:
        # Idempotent: IF NOT EXISTS for partially-applied migrations against pooled connections.
        conn.execute(sa.text(
            f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS search_vector tsvector "
            f"GENERATED ALWAYS AS ({definition}) STORED"
        ))

    # ── GIN indexes — CONCURRENTLY, per migration 010's pattern ────────────
    with op.get_context().autocommit_block():
        for idx_name, table, _def in _SEARCH_COLUMNS:
            conn.execute(sa.text(
                f"CREATE INDEX CONCURRENTLY IF NOT EXISTS {idx_name} "
                f"ON {table} USING GIN (search_vector)"
            ))

    # Verification pass — catch any index left INVALID by a failed concurrent build.
    invalid = conn.execute(
        sa.text(
            "SELECT indexrelid::regclass::text FROM pg_index "
            "WHERE NOT indisvalid AND indexrelid::regclass::text = ANY(:names)"
        ),
        {"names": [i[0] for i in _SEARCH_COLUMNS]},
    ).fetchall()
    if invalid:
        raise RuntimeError(
            f"CREATE INDEX CONCURRENTLY left INVALID index(es): "
            f"{[r[0] for r in invalid]}. Drop and re-run."
        )


def downgrade() -> None:
    conn = op.get_bind()

    with op.get_context().autocommit_block():
        for idx_name, table, _def in _SEARCH_COLUMNS:
            conn.execute(sa.text(
                f"DROP INDEX CONCURRENTLY IF EXISTS {idx_name}"
            ))

    for _idx_name, table, _def in _SEARCH_COLUMNS:
        conn.execute(sa.text(f"ALTER TABLE {table} DROP COLUMN search_vector"))
