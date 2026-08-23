"""Recompute denormalised review counters from the reviews table (W5-R4).

``review_count`` and ``rating_sum`` on courses, templates, and products are
updated in the same transaction as moderation transitions. This script
recomputes both from ``reviews`` and reports drift — it exists because a
denormalised counter with no reconciler is a number nobody can ever check.

Usage:
    cd backend && python -m scripts.reconcile_review_aggregates [--apply]

Without --apply it reports what it would change and writes nothing.
"""
from __future__ import annotations

import asyncio
import sys

from sqlalchemy import func, select, text

from app.db.models import Course, Product, Review, ReviewState, Template
from app.db.session import AsyncSessionLocal


async def reconcile(apply: bool) -> None:
    async with AsyncSessionLocal() as session:
        # Count of drift instances found
        drift_count = 0

        # The label is the value stored in `reviews.content_type`, NOT the model name.
        # A pack is sold as a Product row but is reviewed as content_type 'pack' —
        # that is the vocabulary the CHECK constraint in migration 029 enforces
        # ('course', 'template', 'pack') and the one api/v1/admin/reviews.py writes.
        # Querying for 'product' here would match zero rows, so the reconciler would
        # compute an expected count of 0 for every pack and — with --apply — zero out
        # counters that were correct, in the name of fixing drift.
        for model, label in [(Course, "course"), (Template, "template"), (Product, "pack")]:
            # Get correct counters from reviews table
            correct = await session.execute(
                select(
                    Review.content_id,
                    func.count().label("review_count"),
                    func.coalesce(func.sum(Review.rating), 0).label("rating_sum"),
                )
                .where(
                    Review.content_type == label,
                    Review.state == ReviewState.APPROVED.value,
                )
                .group_by(Review.content_id)
            )
            correct_map = {row.content_id: (row.review_count, row.rating_sum) for row in correct.all()}

            # Get current denormalised counters
            contents = await session.execute(
                select(model.id, model.review_count, model.rating_sum)
            )
            for content_id, current_count, current_sum in contents.all():
                expected_count, expected_sum = correct_map.get(content_id, (0, 0))

                if current_count != expected_count or current_sum != expected_sum:
                    drift_count += 1
                    print(
                        f"  DRIFT: {label} {content_id} "
                        f"count={current_count}->{expected_count} "
                        f"sum={current_sum}->{expected_sum}"
                    )
                    if apply:
                        await session.execute(
                            text(
                                f"UPDATE {model.__tablename__} "
                                f"SET review_count = :count, rating_sum = :sum "
                                f"WHERE id = :id"
                            ),
                            {"count": expected_count, "sum": expected_sum, "id": content_id},
                        )

            # Check for content with reviews but no model row (orphaned reviews)
            for content_id in correct_map:
                content = await session.get(model, content_id)
                if not content:
                    print(f"  WARNING: {label} {content_id} has approved reviews but no model row")

        if apply and drift_count > 0:
            await session.commit()
            print(f"\nFixed {drift_count} drift instances.")
        elif drift_count == 0:
            print("No drift found — all counters are correct.")
        else:
            print(f"\nFound {drift_count} drift instances. Run with --apply to fix.")


if __name__ == "__main__":
    apply = "--apply" in sys.argv
    asyncio.run(reconcile(apply))
