"""Backfill missing per-lesson entitlement grants.

Every lesson-access check (`_lesson_entitled` in content/lessons.py,
`require_entitlement` in core/entitlements.py) gates on a per-lesson `ProductContent`
row (`content_type="lesson"`, `content_id=<lesson.id>`) — never on the course-level
`content_type="course"` row `create_course_product` writes. `create_course_product`
and `create_lesson` now call `grant_course_lessons` (admin/courses.py) so this doesn't
recur; this script is the one-time repair for courses that already have a product and
are missing grants for some or all of their lessons.

Idempotent: reuses `grant_course_lessons`, which only inserts rows that don't already
exist — safe to run more than once.

Dry-run by default: prints, for every course with a product, how many lessons would
be newly granted. Nothing is written unless --apply is passed.

Usage:
    python -m scripts.backfill_lesson_entitlements            # dry run
    python -m scripts.backfill_lesson_entitlements --apply     # write changes
"""
from __future__ import annotations

import argparse
import asyncio

from sqlalchemy import select

from app.api.v1.admin.courses import grant_course_lessons
from app.db.models import Course, ProductContent
from app.db.session import AsyncSessionLocal


async def backfill(apply: bool) -> None:
    # get_session() is a FastAPI dependency generator (`yield`-based), not an async
    # context manager — `async with get_session()` raises TypeError before a single
    # query runs. Use AsyncSessionLocal() directly, the session factory itself.
    async with AsyncSessionLocal() as session:
        course_products = (
            await session.execute(
                select(ProductContent.content_id, ProductContent.product_id).where(
                    ProductContent.content_type == "course"
                )
            )
        ).all()

        if not course_products:
            print("No courses have a product yet — nothing to backfill.")
            return

        courses_by_id = {
            c.id: c
            for c in (
                await session.execute(
                    select(Course).where(Course.id.in_([row.content_id for row in course_products]))
                )
            )
            .scalars()
            .all()
        }

        total_granted = 0
        courses_affected = 0

        for row in course_products:
            course = courses_by_id.get(row.content_id)
            title = course.title if course else str(row.content_id)

            granted = await grant_course_lessons(
                session, product_id=row.product_id, course_id=row.content_id, dry_run=not apply
            )

            if granted > 0:
                courses_affected += 1
                total_granted += granted
                print(f"[course] '{title}' ({row.content_id}): {granted} lesson(s) {'granted' if apply else 'would be granted'}")

        if apply:
            await session.commit()

        mode = "APPLIED" if apply else "DRY RUN — nothing written, pass --apply to write"
        print(f"\n{mode}")
        print(f"Courses with a product: {len(course_products)}")
        print(f"Courses affected: {courses_affected}")
        print(f"Lesson grants {'created' if apply else 'that would be created'}: {total_granted}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="write changes (default: dry run)")
    args = parser.parse_args()
    asyncio.run(backfill(args.apply))
