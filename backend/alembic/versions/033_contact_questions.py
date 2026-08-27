"""Add user-submitted questions fields to contact_messages.

Adds fields to support "Ask Practicable" functionality:
- related_question_id: FK to questions for similar existing questions
- related_domain_id: FK to domains for categorization
- keywords: stored keywords for similarity matching
- similar_count: count of similar questions for dedup/priority

Both FK columns get an index: `/admin/contact/grouped` (app/api/v1/admin/contact.py)
GROUPs BY `related_question_id` alongside `keywords`, and a new FK column should not go
unindexed. `CREATE INDEX CONCURRENTLY` inside an autocommit block, same pattern as
`010_performance_indexes.py` — cannot run inside Alembic's default transaction; plain
(non-covering) shape, since there is no known covering column.

`similar_count`'s `server_default` matches `ContactMessage.similar_count`'s `default=0`
in the model (app/db/models/contact_message.py), so a row inserted through raw SQL and
one through the ORM land on the same value. The column is written once at insert time (a
plain COUNT) as a best-effort snapshot for the flat admin list; the grouped admin
endpoint computes its own live COUNT and does not read this column.

Revision ID: 033
Revises: 032
Create Date: 2026-08-25
"""
import sqlalchemy as sa
from alembic import op

revision = "033"
down_revision = "032"
branch_labels = None
depends_on = None

_INDEXES = [
    ("ix_contact_messages_related_question", "contact_messages", ["related_question_id"]),
    ("ix_contact_messages_related_domain", "contact_messages", ["related_domain_id"]),
]


def upgrade() -> None:
    # Add new columns to contact_messages
    op.add_column(
        "contact_messages",
        sa.Column("related_question_id", sa.Uuid, sa.ForeignKey("questions.id"), nullable=True)
    )
    op.add_column(
        "contact_messages",
        sa.Column("related_domain_id", sa.Uuid, sa.ForeignKey("domains.id"), nullable=True)
    )
    op.add_column(
        "contact_messages",
        sa.Column("keywords", sa.String(500), nullable=True)
    )
    op.add_column(
        "contact_messages",
        sa.Column("similar_count", sa.Integer, nullable=False, server_default=sa.text("0"))
    )

    # CONCURRENTLY, same pattern as migration 010 — never blocks writes on a table a
    # public unauthenticated endpoint (POST /contact) is inserting into.
    with op.get_context().autocommit_block():
        for name, table, columns in _INDEXES:
            op.create_index(name, table, columns, postgresql_concurrently=True, if_not_exists=True)

    conn = op.get_bind()
    invalid = conn.execute(
        sa.text(
            "SELECT indexrelid::regclass::text FROM pg_index WHERE NOT indisvalid "
            "AND indexrelid::regclass::text = ANY(:names)"
        ),
        {"names": [i[0] for i in _INDEXES]},
    ).fetchall()
    if invalid:
        raise RuntimeError(
            f"CREATE INDEX CONCURRENTLY left INVALID index(es): {[r[0] for r in invalid]}. "
            "Drop and re-run."
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        for name, table, _columns in reversed(_INDEXES):
            op.drop_index(name, table_name=table, postgresql_concurrently=True, if_exists=True)

    op.drop_column("contact_messages", "similar_count")
    op.drop_column("contact_messages", "keywords")
    op.drop_column("contact_messages", "related_domain_id")
    op.drop_column("contact_messages", "related_question_id")
