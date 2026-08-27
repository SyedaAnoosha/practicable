"""Backfill `Course.level` on courses that were created before migration 025.

Notes on what this script does not do:

  - The lesson count is taken through the `Module.course_id` join alone; correlating an
    unjoined `Course` cross-joins the whole courses table instead of filtering.
  - Duration is not written here. `estimated_duration_minutes` is the authored figure,
    and the read path (app/api/v1/content/courses.py) deliberately prefers it over
    measured video time because it covers reading time no encoder can see. Where a
    course has no authored figure, the read path computes one from media at request
    time, and `scripts/backfill_media_durations.py` ensures media has a real length.

A course with no published lessons is skipped rather than defaulted: the heuristic
reads lesson count, and zero lessons is an absence of evidence, not evidence of a
beginner course.

Level remains a heuristic on published-lesson count, and the admin can override it in
the admin panel. An existing level is never overwritten.

Usage:
    cd backend && python -m scripts.seed_course_levels [--apply]

Without --apply it reports what it would change and writes nothing.
"""
from __future__ import annotations

import asyncio
import sys

from sqlalchemy import func, select

from app.db.models import Course, Lesson, Module
from app.db.session import AsyncSessionLocal


def level_for(lesson_count: int) -> str:
    """Few lessons read as beginner, many as advanced. Judgement, not measurement."""
    if lesson_count <= 5:
        return "beginner"
    if lesson_count <= 15:
        return "intermediate"
    return "advanced"


async def seed_levels(apply: bool) -> None:
    async with AsyncSessionLocal() as session:
        courses = (
            await session.execute(
                select(Course).where(Course.level.is_(None)).order_by(Course.created_at)
            )
        ).scalars().all()

        if not courses:
            print("Nothing to do — every course already has a level.")
            return

        updated = skipped = 0
        for course in courses:
            lesson_count = (
                await session.execute(
                    select(func.count(Lesson.id))
                    .join(Module, Module.id == Lesson.module_id)
                    .where(Module.course_id == course.id)
                    .where(Lesson.published.is_(True))
                )
            ).scalar() or 0

            if lesson_count == 0:
                # A course with no published lessons gives the heuristic nothing to read.
                # Calling it "beginner" would state a fact about content that does not
                # exist yet, so it stays null until the course has something in it.
                print(f"  SKIP {course.slug}: no published lessons, nothing to infer from")
                skipped += 1
                continue

            level = level_for(lesson_count)
            print(f"  {course.slug}: {lesson_count} published lessons -> level={level}")
            updated += 1
            if apply:
                course.level = level

        if apply:
            await session.commit()
            print(f"\nCommitted. {updated} updated, {skipped} skipped.")
        else:
            print(f"\nDry run. {updated} would be updated, {skipped} skipped. Re-run with --apply.")


if __name__ == "__main__":
    asyncio.run(seed_levels(apply="--apply" in sys.argv))
