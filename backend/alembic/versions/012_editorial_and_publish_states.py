"""Editorial and publish states.

Adds a four-state `publish_state` (draft | in_review | published | archived) to the five
editorial tables — questions, courses, lessons, templates, products — replacing the old
binary "draft vs published".

The boolean `published` stays as a derived read so existing tests and read paths keep
working. It is pinned to `publish_state` with a CHECK constraint
(`published = (publish_state = 'published')`) rather than a Postgres GENERATED column,
because several `db/seed/*.sql` scripts insert `published` directly in raw `INSERT`
statements and a GENERATED column rejects any INSERT that names it. The CHECK gives the
same guarantee while failing loudly the moment a writer sets one without the other.
The three admin `/publish` endpoints set both together; see
`app/api/v1/admin/{questions,courses,templates}.py`.

Also adds `questions.featured` + `questions.featured_sort` for the homepage's curated
picks — nullable sort, since NULL reads as "featured, order unset" rather than a false
zero forcing every newly-featured question to the front of the row.

Revision ID: 012
Revises: 011
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "012"
down_revision = "011"
branch_labels = None
depends_on = None

_ENUM_NAME = "publish_state"
_ENUM_VALUES = ("draft", "in_review", "published", "archived")
# create_type=False on every column use — the type itself is created/dropped explicitly
# below, once, rather than once per table (the default behaviour would try to re-issue
# CREATE TYPE for every op.add_column call and fail on the second table).
_PUBLISH_STATE_COL = postgresql.ENUM(*_ENUM_VALUES, name=_ENUM_NAME, create_type=False)

_TABLES = ["questions", "courses", "lessons", "templates", "products"]


def upgrade() -> None:
    postgresql.ENUM(*_ENUM_VALUES, name=_ENUM_NAME).create(op.get_bind(), checkfirst=True)

    for table in _TABLES:
        # Nullable first, backfilled, then constrained — a metadata-only ADD COLUMN,
        # same three-step shape migration 011 uses for revoked_at, so this never holds
        # a table-rewriting lock across the UPDATE below.
        op.add_column(table, sa.Column("publish_state", _PUBLISH_STATE_COL, nullable=True))
        op.execute(
            sa.text(
                f"UPDATE {table} SET publish_state = "
                f"CASE WHEN published THEN 'published'::{_ENUM_NAME} ELSE 'draft'::{_ENUM_NAME} END"
            )
        )
        op.execute(sa.text(f"ALTER TABLE {table} ALTER COLUMN publish_state SET NOT NULL"))
        op.execute(sa.text(f"ALTER TABLE {table} ALTER COLUMN publish_state SET DEFAULT 'draft'"))
        op.create_check_constraint(
            f"ck_{table}_publish_state_matches_published",
            table,
            "published = (publish_state = 'published')",
        )

    op.add_column("questions", sa.Column("featured", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("questions", sa.Column("featured_sort", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("questions", "featured_sort")
    op.drop_column("questions", "featured")

    for table in _TABLES:
        op.drop_constraint(f"ck_{table}_publish_state_matches_published", table, type_="check")
        op.drop_column(table, "publish_state")

    postgresql.ENUM(*_ENUM_VALUES, name=_ENUM_NAME).drop(op.get_bind(), checkfirst=True)
