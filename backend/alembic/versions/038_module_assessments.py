"""Module-level assessments: add module_id, drop course_id unique constraint.

Every assessment now belongs to a module rather than a course. A course has no
assessment of its own — instead, each module optionally carries one. The certificate
gate is updated to require ALL published module assessments to be passed.

Existing data migration: any course-level assessment (course_id set, module_id NULL)
is assigned to the course's first module. If the course has no modules, the assessment
is dropped — this should never happen in practice.

Revision ID: 038
Revises: 037
Create Date: 2026-08-25
"""
import sqlalchemy as sa
from alembic import op

revision = "038"
down_revision = "037"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # ── Step 1: Add module_id column (nullable for now) ─────────────────────
    op.add_column(
        "assessments",
        sa.Column("module_id", sa.Uuid, sa.ForeignKey("modules.id"), nullable=True),
    )

    # ── Step 2: Migrate existing course-level assessments to their first module ──
    conn.execute(sa.text("""
        UPDATE assessments
        SET module_id = (
            SELECT m.id
            FROM modules m
            WHERE m.course_id = assessments.course_id
            ORDER BY m.sort_order
            LIMIT 1
        )
        WHERE module_id IS NULL AND course_id IS NOT NULL
    """))

    # ── Step 3: Drop the course-level unique constraint ─────────────────────
    op.drop_constraint("uq_assessments_course", "assessments", type_="unique")

    # ── Step 4: Make module_id NOT NULL ─────────────────────────────────────
    op.alter_column("assessments", "module_id", nullable=False)

    # ── Step 5: Add module-level unique constraint ──────────────────────────
    op.create_unique_constraint("uq_assessments_module", "assessments", ["module_id"])

    # ── Step 6: Make course_id nullable (derived from module) ───────────────
    op.alter_column("assessments", "course_id", nullable=True)

    # ── Step 7: Add indexes ─────────────────────────────────────────────────
    op.create_index(
        "ix_assessments_module_id",
        "assessments",
        ["module_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_assessments_module_id", table_name="assessments")
    op.drop_constraint("uq_assessments_module", "assessments", type_="unique")

    # Restore course_id from module for any remaining assessments
    conn = op.get_bind()
    conn.execute(sa.text("""
        UPDATE assessments
        SET course_id = (
            SELECT m.course_id
            FROM modules m
            WHERE m.id = assessments.module_id
        )
        WHERE course_id IS NULL AND module_id IS NOT NULL
    """))

    op.alter_column("assessments", "course_id", nullable=False)
    op.create_unique_constraint("uq_assessments_course", "assessments", ["course_id"])

    op.drop_column("assessments", "module_id")
