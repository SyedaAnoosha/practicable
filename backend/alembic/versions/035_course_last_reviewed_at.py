"""Add courses.last_reviewed_at for the content freshness system (#16).

Templates already carry `version` and `last_reviewed_at` (migration 013). Courses carried
neither, so the freshness warning docs/improvements.md §16 asks for could only ever cover
half the catalogue — and the half it missed is the half that goes stale fastest, since a
course narrating a regulation dates the moment the regulation moves.

Only `last_reviewed_at` is added, deliberately not `version`. A template is a file
someone downloads and keeps, so its version is a fact the buyer needs in order to know
whether the copy on their disk is current — that is what makes it worth stamping into
the receipt. A course is consumed in place and is always the current one, so a version
string on it would be a number with no reader.

Nullable with no backfill: NULL means "never reviewed", which is the honest state for
every existing row. Backfilling `now()` would assert a review that never happened, and
the freshness computation reports unknown and stale as distinct states precisely so this
column never has to lie to avoid a warning.

Revision ID: 035
Revises: 034
Create Date: 2026-08-25
"""
import sqlalchemy as sa
from alembic import op

revision = "035"
down_revision = "034"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "courses",
        sa.Column("last_reviewed_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("courses", "last_reviewed_at")
