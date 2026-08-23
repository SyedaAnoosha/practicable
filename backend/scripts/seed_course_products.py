"""Attach a purchasable product to each of the five seeded courses.

`scripts/seed_five_courses.py` deliberately creates no commerce rows, because a product
needs a real Stripe price id and those cannot be invented in a seed file. This script is
the other half: it mints the Stripe objects through the same helper the admin panel uses
(`create_price`, which creates a Stripe Product *and* Price together), then writes the
`products` row and the `product_contents` rows that actually unlock the lessons.

WHAT EACH PRODUCT GRANTS.
  One `course` content row, plus one `lesson` row per published lesson in the course.
  Both are needed. The course row is what the catalogue and the course page read to show
  a price; the lesson rows are what the entitlement check reads to unlock a lesson. A
  product with only the course row renders a price and then unlocks nothing - the same
  class of mistake db/seed/006 calls out for its question_set row.

PRICING (owner decision, 2026-08-23) - scaled by published lesson count, anchored on the
existing A$99 / 12-lesson `building-an-effective-risk-register-course`:
    enterprise-risk-management-essentials       10 lessons   A$99
    business-continuity-and-crisis-management    9 lessons   A$89
    third-party-and-vendor-risk-management       6 lessons   A$69
    regulatory-compliance-fundamentals           6 lessons   A$69
`building-an-effective-risk-register` already has its product and is left alone.

TEST AND LIVE MODE.
  A Stripe price id is mode-bound: a `price_...` minted with a test key does not resolve
  under a live key, and `products.stripe_price_id` is a single column, so one row cannot
  reference both modes at once. This script is therefore written to be run once per mode
  against the matching `STRIPE_SECRET_KEY`:

    - It reports the mode it is about to write, read from the configured key, and
      refuses to run against a live key without `--live` as well as `--apply`. Minting
      live Stripe objects is not something a script should do because someone forgot
      which .env was loaded.
    - Re-running in the other mode re-mints the Stripe objects and updates the existing
      row in place rather than creating a second product, so the same catalogue survives
      a mode switch with its slugs, copy and prices intact.
    - It never publishes. `publish_guard.validate_stripe_price` already retrieves the
      price and rejects a cross-mode one at publish time; leaving these unpublished
      means that check runs against whatever mode the deployment is actually in.

Re-runnable: products are matched on slug, contents on (product, type, content id).

Usage:
    cd backend && python -m scripts.seed_course_products            # dry run
    cd backend && python -m scripts.seed_course_products --apply    # test mode
    cd backend && python -m scripts.seed_course_products --apply --live
"""
from __future__ import annotations

import asyncio
import sys

from sqlalchemy import select

from app.core.config import settings
from app.db.models import Course, Lesson, Module
from app.db.models.product import Product, ProductContent
from app.db.session import AsyncSessionLocal
from app.integrations.stripe_client import create_price


# course slug -> (price in cents, description)
PLAN: dict[str, tuple[int, str]] = {
    "enterprise-risk-management-essentials": (
        9900,
        "Enterprise risk management for organisations that need it to work in practice: "
        "risk appetite, mapping risk to strategy, the ERM architecture, and the failures "
        "that quietly stop a framework being used.",
    ),
    "business-continuity-and-crisis-management": (
        8900,
        "Building continuity and crisis capability you can actually run on the day: "
        "impact analysis, plans people can follow under pressure, and exercises that "
        "find the gaps before an incident does.",
    ),
    "third-party-and-vendor-risk-management": (
        6900,
        "Third-party risk end to end: tiering vendors by criticality, running an "
        "assessment that tells you something, contract clauses that protect you, and "
        "exit planning before you need it.",
    ),
    "regulatory-compliance-fundamentals": (
        6900,
        "Regulatory compliance without the guesswork: identifying what applies to you, "
        "turning obligations into controls, and evidencing compliance in a way that "
        "survives scrutiny.",
    ),
}


def _mode_of_key(key: str) -> str:
    """Stripe issues sk_/rk_ in test and live flavours - check both prefixes."""
    if key.startswith(("sk_test_", "rk_test_")):
        return "test"
    if key.startswith(("sk_live_", "rk_live_")):
        return "live"
    return "unknown"


async def seed(apply: bool, live_ok: bool, remint: bool) -> None:
    mode = _mode_of_key(settings.stripe_secret_key)
    print(f"Stripe key mode: {mode}")

    if mode == "unknown":
        print("Refusing to run: STRIPE_SECRET_KEY is not a recognised test or live key.")
        return
    if mode == "live" and apply and not live_ok:
        print("Refusing to run: this is a LIVE Stripe key. Re-run with --live to confirm.")
        return

    async with AsyncSessionLocal() as session:
        created = existing = reminted = skipped = 0

        for course_slug, (amount, description) in PLAN.items():
            course = (
                await session.execute(select(Course).where(Course.slug == course_slug))
            ).scalar_one_or_none()
            if course is None:
                print(f"  SKIP {course_slug}: no such course")
                skipped += 1
                continue

            lessons = (
                await session.execute(
                    select(Lesson)
                    .join(Module, Module.id == Lesson.module_id)
                    .where(Module.course_id == course.id)
                    .where(Lesson.published.is_(True))
                )
            ).scalars().all()
            if not lessons:
                # A product whose lessons are all unpublished sells access to nothing.
                print(f"  SKIP {course_slug}: no published lessons to grant")
                skipped += 1
                continue

            product_slug = f"{course_slug}-course"
            product = (
                await session.execute(select(Product).where(Product.slug == product_slug))
            ).scalar_one_or_none()

            price_str = f"A${amount / 100:.2f}"

            if product is None:
                print(f"  CREATE {product_slug}: {price_str}, {len(lessons)} lessons")
                created += 1
                if apply:
                    price_id, stripe_product_id = create_price(
                        unit_amount=amount,
                        currency="AUD",
                        product_name=f"{course.title} (Course)",
                    )
                    product = Product(
                        slug=product_slug,
                        name=f"{course.title} (Course)",
                        description=description,
                        stripe_price_id=price_id,
                        stripe_product_id=stripe_product_id,
                        price_amount=amount,
                        currency="AUD",
                        published=False,
                    )
                    session.add(product)
                    await session.flush()
            elif remint:
                # Mode switch: mint a fresh Stripe Product/Price under the current key
                # and repoint the row. The old objects are left alone - they belong to
                # the other mode and archiving them from here would need that mode's key.
                print(f"  REMINT {product_slug}: {price_str} -> new {mode}-mode Stripe objects")
                reminted += 1
                if apply:
                    price_id, stripe_product_id = create_price(
                        unit_amount=product.price_amount,
                        currency=product.currency,
                        product_name=product.name,
                    )
                    product.stripe_price_id = price_id
                    product.stripe_product_id = stripe_product_id
            else:
                print(
                    f"  EXISTS {product_slug}: {price_str}, "
                    f"stripe_price_id={product.stripe_price_id[:20]}... "
                    f"(pass --remint to repoint at {mode} mode)"
                )
                existing += 1

            if not apply or product is None:
                continue

            # Content rows - one course, one per published lesson. Idempotent.
            wanted = [("course", course.id)] + [("lesson", lesson.id) for lesson in lessons]
            added = 0
            for content_type, content_id in wanted:
                already = (
                    await session.execute(
                        select(ProductContent).where(
                            ProductContent.product_id == product.id,
                            ProductContent.content_type == content_type,
                            ProductContent.content_id == content_id,
                        )
                    )
                ).scalar_one_or_none()
                if already is None:
                    session.add(
                        ProductContent(
                            product_id=product.id,
                            content_type=content_type,
                            content_id=content_id,
                        )
                    )
                    added += 1
            if added:
                print(f"         + {added} content rows")

        if apply:
            await session.commit()
            print(
                f"\nCommitted ({mode} mode). {created} created, {reminted} reminted, "
                f"{existing} already present, {skipped} skipped."
            )
            print("New products are UNPUBLISHED - publish from /admin once you have reviewed them.")
        else:
            print(
                f"\nDry run ({mode} mode). {created} would be created, {reminted} reminted, "
                f"{existing} already present, {skipped} skipped."
            )


if __name__ == "__main__":
    asyncio.run(
        seed(
            apply="--apply" in sys.argv,
            live_ok="--live" in sys.argv,
            remint="--remint" in sys.argv,
        )
    )
