"""Give every product that sells a course's lessons an explicit `course` content row.

Companion to the gate in `app/core/entitlements.py`, which makes a `course` grant expand
to that course's lessons at request time so a lesson added after purchase unlocks for
existing buyers. That only helps products which actually name the course. Two did not:

    risk-register-fundamentals   A$49  "The full course - every lesson across both
                                        modules, plus the register template used in it."
    risk-register-bundle         A$79  "The course, plus every Risk question in the
                                        domain, curated."

Both sell `risk-register-fundamentals` and both listed its lessons individually — 3 of
them — with no `course` row at all. The course has 4 published lessons. So both products
promised "the full course" in their own description and delivered three quarters of it,
and `writing-a-register-entry` was unreachable for everyone who had paid.

The lesson-by-lesson list is a snapshot of the course as it stood when the product was
seeded; it silently stops being the course the moment anyone adds a lesson.

WHAT THIS DOES. For any product holding >= 1 `lesson` row, find the course(s) those
lessons belong to, and add a `course` row for each one not already named. It does NOT
remove the explicit lesson rows: they are harmless (the two paths union in the gate), and
deleting them would be an irreversible change to what a product declares it sells, for no
behavioural gain.

WHAT IT DELIBERATELY DOES NOT DO. It will not add a course row when the product names
only SOME of that course's published lessons and the product's description does not
claim to sell the whole course — that shape is a legitimate "sample" or "single lesson"
product, and promoting it to a full-course grant would give away content that was never
bought. Both products above claim the full course in their own copy, which is why they
qualify; anything ambiguous is REPORTED and skipped for a human to decide.

Re-runnable: a course row that already exists is left alone.

Usage:
    cd backend && python -m scripts.backfill_course_grants            # dry run
    cd backend && python -m scripts.backfill_course_grants --apply
"""
from __future__ import annotations

import asyncio
import sys

from sqlalchemy import select

from app.db.models import Course, Lesson, Module, Product, ProductContent
from app.db.session import AsyncSessionLocal

# Products whose own description promises the whole course. Anything not listed here
# that names only a subset of a course's lessons is reported, never auto-granted.
FULL_COURSE_PRODUCTS = {
    "risk-register-fundamentals",
    "risk-register-bundle",
}


async def backfill(apply: bool) -> None:
    async with AsyncSessionLocal() as session:
        products = (
            await session.execute(select(Product).order_by(Product.slug))
        ).scalars().all()

        added = skipped = 0

        for product in products:
            rows = (
                await session.execute(
                    select(ProductContent.content_type, ProductContent.content_id).where(
                        ProductContent.product_id == product.id
                    )
                )
            ).all()
            lesson_ids = [cid for ctype, cid in rows if ctype == "lesson"]
            course_ids = {cid for ctype, cid in rows if ctype == "course"}
            if not lesson_ids:
                continue

            owning_course_ids = set(
                (
                    await session.execute(
                        select(Module.course_id)
                        .join(Lesson, Lesson.module_id == Module.id)
                        .where(Lesson.id.in_(lesson_ids))
                    )
                ).scalars().all()
            )

            for course_id in owning_course_ids - course_ids:
                course = (
                    await session.execute(select(Course).where(Course.id == course_id))
                ).scalar_one()

                published_lesson_ids = set(
                    (
                        await session.execute(
                            select(Lesson.id)
                            .join(Module, Module.id == Lesson.module_id)
                            .where(Module.course_id == course_id)
                            .where(Lesson.published.is_(True))
                        )
                    ).scalars().all()
                )
                named = published_lesson_ids & set(lesson_ids)
                sells_whole_course = product.slug in FULL_COURSE_PRODUCTS

                if not sells_whole_course and named != published_lesson_ids:
                    print(
                        f"  REVIEW {product.slug}: names {len(named)}/{len(published_lesson_ids)} "
                        f"lessons of '{course.slug}' and is not marked as a full-course "
                        "product. Not granting the course - decide by hand."
                    )
                    skipped += 1
                    continue

                print(
                    f"  GRANT {product.slug}: + course row for '{course.slug}' "
                    f"({len(named)}/{len(published_lesson_ids)} lessons were named explicitly)"
                )
                added += 1
                if apply:
                    session.add(
                        ProductContent(
                            product_id=product.id,
                            content_type="course",
                            content_id=course_id,
                        )
                    )

        if apply:
            await session.commit()
            print(f"\nCommitted. {added} course grants added, {skipped} left for review.")
        else:
            print(f"\nDry run. {added} would be added, {skipped} left for review.")


if __name__ == "__main__":
    asyncio.run(backfill(apply="--apply" in sys.argv))
