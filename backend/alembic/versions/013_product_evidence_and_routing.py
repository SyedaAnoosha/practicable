"""Product evidence layer, routing, licence, bundle declaration.

Adds to `templates`: page_count, sheet_count, is_editable, has_macros, min_office_version,
preview_image_keys (JSONB), version, last_reviewed_at.

Adds to `products`: licence (enum), search_title, version, last_reviewed_at, is_bundle.

Adds index `ix_product_contents_type_content` for the reverse-direction routing query:
migration `010` indexed `product_contents` for product_id lookups (the gate's direction);
routing runs it backwards — given content ids, which products grant them — and that
direction had no index.

Deliberate shape choices:
- page_count AND sheet_count, not one size_metric (PDF has pages, spreadsheet has sheets)
- is_editable nullable, has_macros NOT NULL DEFAULT false (safety property)
- preview_image_keys as JSONB, not a join table (ordered, small, always read whole)
- licence as enum via str_enum(..., name='licence') (name= required, value not .name)
- is_bundle on products, not inferred (a bundle is a declaration, not a row count)

Backfill: existing published rows get version='1.0', last_reviewed_at=created_at.

Revision ID: 013
Revises: 012
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "013"
down_revision = "012"
branch_labels = None
depends_on = None

_LICENCE_ENUM_NAME = "licence"
_LICENCE_VALUES = ("standard", "client_delivery", "multi_client")

# New index for the routing reverse-direction query.
# product_contents is indexed for product_id lookups (gate direction, migration 010
# ix_product_contents_product_type). This adds the reverse: content_type, content_id →
# which products grant this content.
_NEW_CONCURRENT_INDEXES = [
    (
        "ix_product_contents_type_content_reverse",
        "product_contents",
        ["content_type", "content_id", "product_id"],
        {},
        "Routing reverse-direction: given content ids, find granting products. "
        "product_id included so the planner gets it without a heap fetch.",
    ),
    (
        "ix_products_published_slug",
        "products",
        ["slug"],
        {"postgresql_where": sa.text("published = true")},
        "Published product lookups by slug. Partial because unpublished products "
        "never appear in the routing output.",
    ),
]


def upgrade() -> None:
    # ── Create licence enum type ────────────────────────────────────────────────
    licence_enum = postgresql.ENUM(*_LICENCE_VALUES, name=_LICENCE_ENUM_NAME)
    licence_enum.create(op.get_bind(), checkfirst=True)

    # ── templates: pre-purchase evidence fields ─────────────────────────
    op.add_column("templates", sa.Column("page_count", sa.Integer(), nullable=True))
    op.add_column("templates", sa.Column("sheet_count", sa.Integer(), nullable=True))
    op.add_column("templates", sa.Column("is_editable", sa.Boolean(), nullable=True))
    # has_macros is a safety property — default MUST be false, so a true is a deliberate act
    op.add_column(
        "templates",
        sa.Column("has_macros", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column("templates", sa.Column("min_office_version", sa.String(50), nullable=True))
    # JSONB: ordered, small, always read whole, never queried by element
    op.add_column(
        "templates",
        sa.Column(
            "preview_image_keys",
            postgresql.JSONB(),
            nullable=False,
            server_default="[]",
        ),
    )
    op.add_column("templates", sa.Column("version", sa.String(20), nullable=True))
    op.add_column(
        "templates",
        sa.Column("last_reviewed_at", sa.DateTime(timezone=True), nullable=True),
    )

    # ── products: licence, search title, version, bundle declaration ─────────────
    # licence: NOT NULL with default 'standard' so all existing rows get a valid value
    op.add_column(
        "products",
        sa.Column(
            "licence",
            postgresql.ENUM(*_LICENCE_VALUES, name=_LICENCE_ENUM_NAME, create_type=False),
            nullable=False,
            server_default="standard",
        ),
    )
    op.add_column("products", sa.Column("search_title", sa.String(500), nullable=True))
    op.add_column("products", sa.Column("version", sa.String(20), nullable=True))
    op.add_column(
        "products",
        sa.Column("last_reviewed_at", sa.DateTime(timezone=True), nullable=True),
    )
    # is_bundle: a declaration, not inferred from content counts
    op.add_column(
        "products",
        sa.Column("is_bundle", sa.Boolean(), nullable=False, server_default=sa.false()),
    )

    # ── Backfill existing published rows ─────────────────────────────────────────
    # version='1.0' and last_reviewed_at=created_at for existing published templates.
    # ASSERTION: This is an approximation. The owner must confirm whether these dates
    # accurately represent the actual review dates for each template.
    op.execute(
        sa.text(
            "UPDATE templates SET version = '1.0', last_reviewed_at = created_at "
            "WHERE published = true AND version IS NULL"
        )
    )
    op.execute(
        sa.text(
            "UPDATE products SET version = '1.0', last_reviewed_at = created_at "
            "WHERE published = true AND version IS NULL"
        )
    )

    # ── Indexes: CONCURRENTLY, never blocks writes ────────────────────────────────
    with op.get_context().autocommit_block():
        for name, table, columns, kwargs, comment in _NEW_CONCURRENT_INDEXES:
            op.create_index(
                name, table, columns, postgresql_concurrently=True, **kwargs
            )
            op.execute(sa.text(f"COMMENT ON INDEX {name} IS :c").bindparams(c=comment))

    # Verify no INVALID indexes left by failed CONCURRENTLY build
    conn = op.get_bind()
    invalid = conn.execute(
        sa.text(
            "SELECT indexrelid::regclass::text FROM pg_index WHERE NOT indisvalid "
            "AND indexrelid::regclass::text = ANY(:names)"
        ),
        {"names": [i[0] for i in _NEW_CONCURRENT_INDEXES]},
    ).fetchall()
    if invalid:
        raise RuntimeError(
            f"CREATE INDEX CONCURRENTLY left INVALID index(es): {[r[0] for r in invalid]}. "
            "Drop and re-run."
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        for name, table, _columns, _kwargs, _comment in reversed(_NEW_CONCURRENT_INDEXES):
            op.drop_index(name, table_name=table, postgresql_concurrently=True)

    # products columns
    op.drop_column("products", "is_bundle")
    op.drop_column("products", "last_reviewed_at")
    op.drop_column("products", "version")
    op.drop_column("products", "search_title")
    op.drop_column("products", "licence")

    # templates columns
    op.drop_column("templates", "last_reviewed_at")
    op.drop_column("templates", "version")
    op.drop_column("templates", "preview_image_keys")
    op.drop_column("templates", "min_office_version")
    op.drop_column("templates", "has_macros")
    op.drop_column("templates", "is_editable")
    op.drop_column("templates", "sheet_count")
    op.drop_column("templates", "page_count")

    # Drop the enum type
    postgresql.ENUM(*_LICENCE_VALUES, name=_LICENCE_ENUM_NAME).drop(
        op.get_bind(), checkfirst=True
    )
