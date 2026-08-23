"""Backfill `Course.level` on courses that were created before migration 025.

`[FIXED 2026-08-23]` Three bugs meant this script had never once run to completion,
which is why the two oldest courses still had a null level long after it was written:

  1. It imported `async_session` from `app.db.session`. That name does not exist —
     the factory is `AsyncSessionLocal` — so the script died at import, every time.
  2. The lesson count selected from `Lesson`/`Module` and then tried to correlate the
     course with a bare `.where(Course.id == course_id)` against an unjoined `Course`,
     which cross-joins the whole courses table instead of filtering. The count is now
     taken through the `Module.course_id` join alone.
  3. It also wrote a *computed* video duration into `estimated_duration_minutes`. That
     column is the **authored** figure, and the read path (app/api/v1/content/courses.py)
     deliberately prefers it over measured video time because it covers reading time no
     encoder can see. Writing a computed number there would have silently promoted a
     4-minute video sum over a 120-minute authored value and made the precedence
     unrecoverable. Duration is no longer written here at all: where a course has no
     authored figure, the read path computes one from media at request time, and
     `scripts/backfill_media_durations.py` makes sure that media has a real length.

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
