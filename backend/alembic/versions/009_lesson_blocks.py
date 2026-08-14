"""Add lesson_blocks — mixed-content lessons (Product Spec §7.2).

Today a lesson is one rigid `lesson_type` (video | reading | download | mixed, but
`mixed` has never had anywhere to put its content). Product Spec §7.2: "video sits
within the reading wherever it's useful, rather than being a separate video-only step" —
a lesson authored as text, then a short video, then more text, then a file, needs an
ORDERED sequence of typed content, which a single `body`/`download_template_id` pair on
`lessons` cannot express.

A table, not a JSON column: blocks are individually addressable and one of them (`file`)
points at a `templates` row — a foreign key JSON cannot enforce, and BACKEND.md's whole
argument for this schema is that `product_contents`/entitlement resolution stays a join,
never a query into an opaque blob.

`lessons.lesson_type` is KEPT, not dropped (week2_plan.md Phase 2 step 2 — deliberate).
It becomes a display hint (which icon the course outline shows) rather than the content
contract; dropping it would break the outline, the library's readiness checks, and the
publish-guard logic all in one migration. `lessons.body` and `download_template_id` are
also kept, unused by new content going forward, so nothing that already reads them
breaks before the API layer is updated to read blocks instead.

This migration backfills the three lessons that exist today (2026-08-13) into one block
each, matching their current single-type content exactly — see the render-parity check
required before this may be considered safe (week2_plan.md Non-negotiable #11).

Revision ID: 009
Revises: 008
"""
import uuid

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    block_type_enum = postgresql.ENUM(
        "text", "video", "file", "callout", name="lesson_block_type", create_type=False
    )
    block_type_enum.create(op.get_bind())

    op.create_table(
        "lesson_blocks",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("lesson_id", sa.UUID(), sa.ForeignKey("lessons.id"), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("block_type", block_type_enum, nullable=False),
        # text/callout only — the author's prose, or the callout's body text.
        sa.Column("text_body", sa.Text(), nullable=True),
        # text/callout only — optional heading rendered above the prose (§20.3's TextBlock).
        sa.Column("heading", sa.String(500), nullable=True),
        # video only.
        sa.Column("media_id", sa.UUID(), sa.ForeignKey("media.id"), nullable=True),
        # file only.
        sa.Column("template_id", sa.UUID(), sa.ForeignKey("templates.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        # A lesson cannot have two blocks claiming the same position — the ordering the
        # renderer and the admin's up/down reorder controls both depend on being unambiguous.
        sa.UniqueConstraint("lesson_id", "sort_order", name="uq_lesson_blocks_lesson_id_sort_order"),
    )
    op.create_index("ix_lesson_blocks_lesson_id", "lesson_blocks", ["lesson_id"])

    # ── Backfill ─────────────────────────────────────────────────────────────────
    # Deliberately hand-written INSERT/SELECT via the raw connection, not the ORM: a
    # migration must not depend on `app.db.models` shifting under it in a later commit.
    # Each of the three lesson types existing today becomes exactly one block, in the
    # same shape the API already serves — the render-parity check this backfill must
    # pass compares against exactly this.
    conn = op.get_bind()

    reading_lessons = conn.execute(
        sa.text("SELECT id, body FROM lessons WHERE lesson_type = 'reading' AND body IS NOT NULL")
    ).fetchall()
    for lesson_id, body in reading_lessons:
        conn.execute(
            sa.text(
                "INSERT INTO lesson_blocks (id, lesson_id, sort_order, block_type, text_body, created_at, updated_at) "
                "VALUES (:id, :lesson_id, 0, 'text', :text_body, now(), now())"
            ),
            {"id": str(uuid.uuid4()), "lesson_id": lesson_id, "text_body": body},
        )

    video_lessons = conn.execute(
        sa.text(
            "SELECT l.id, m.id FROM lessons l JOIN media m ON m.lesson_id = l.id "
            "WHERE l.lesson_type = 'video'"
        )
    ).fetchall()
    for lesson_id, media_id in video_lessons:
        conn.execute(
            sa.text(
                "INSERT INTO lesson_blocks (id, lesson_id, sort_order, block_type, media_id, created_at, updated_at) "
                "VALUES (:id, :lesson_id, 0, 'video', :media_id, now(), now())"
            ),
            {"id": str(uuid.uuid4()), "lesson_id": lesson_id, "media_id": media_id},
        )

    download_lessons = conn.execute(
        sa.text(
            "SELECT id, download_template_id FROM lessons "
            "WHERE lesson_type = 'download' AND download_template_id IS NOT NULL"
        )
    ).fetchall()
    for lesson_id, template_id in download_lessons:
        conn.execute(
            sa.text(
                "INSERT INTO lesson_blocks (id, lesson_id, sort_order, block_type, template_id, created_at, updated_at) "
                "VALUES (:id, :lesson_id, 0, 'file', :template_id, now(), now())"
            ),
            {"id": str(uuid.uuid4()), "lesson_id": lesson_id, "template_id": template_id},
        )

    # `mixed`-type lessons are deliberately NOT backfilled: no lesson has ever been able
    # to carry more than one content field before this migration, so a `mixed` row today
    # (none exist as of 2026-08-13) would have nothing coherent to construct a block
    # from — it would need to be authored fresh in the admin editor, block by block.


def downgrade() -> None:
    op.drop_index("ix_lesson_blocks_lesson_id", table_name="lesson_blocks")
    op.drop_table("lesson_blocks")
    postgresql.ENUM(name="lesson_block_type").drop(op.get_bind())
