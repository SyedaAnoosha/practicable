"""Backfill stripe_product_id from existing stripe_price_id values (Phase 8 8B-2).

Phase 8 (8B): Price control for every course and template.
This script resolves each existing stripe_price_id via stripe.Price.retrieve(id).product
to populate the new stripe_product_id column added in migration 016.

Ids that do not resolve are printed as a list to fix by hand, not defaulted, not skipped silently.
Run it and record the output; the seeded catalogue is where 013's backfill already had to be
flagged as an assertion rather than a fact.

Usage:
    python -m scripts.backfill_stripe_product_ids
"""
import asyncio
import sys
from pathlib import Path

# Run as `python scripts/backfill_stripe_product_ids.py` from `backend/`. Without this the
# script dies on `ModuleNotFoundError: No module named 'app'` — the other scripts in this
# directory already carry the same line (2026-08-22).
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import stripe
from sqlalchemy import select

from app.core.config import settings
from app.db.models import Product
from app.db.session import _asyncpg_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine


async def backfill_stripe_product_ids():
    """Resolve stripe_product_id from stripe_price_id for all products."""
    stripe.api_key = settings.stripe_secret_key

    # `get_session` is a FastAPI dependency (an async *generator*), not a context
    # manager — `async with get_session()` raised TypeError, so this script had never
    # actually run. Build a session directly instead, the way every other script here
    # does (2026-08-22).
    engine = create_async_engine(_asyncpg_url(settings.database_url))
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with Session() as session:
        # Get all products
        result = await session.execute(select(Product))
        products = result.scalars().all()

        print(f"Found {len(products)} products to backfill")

        failed_products = []
        updated_count = 0

        for product in products:
            if product.stripe_product_id:
                # Already has a value, skip
                print(f"Skipping {product.slug} - already has stripe_product_id")
                continue

            if not product.stripe_price_id or product.stripe_price_id == "placeholder_update_in_stripe":
                print(f"Skipping {product.slug} - has placeholder or no stripe_price_id")
                failed_products.append({
                    "slug": product.slug,
                    "id": str(product.id),
                    "reason": "placeholder_or_empty"
                })
                continue

            try:
                # Resolve the Stripe Product ID from the Price
                price = stripe.Price.retrieve(product.stripe_price_id)
                # No `expand` was requested above, so Stripe returns the Product as a plain ID.
                assert isinstance(price.product, str)
                product_id = price.product

                # Update the product
                product.stripe_product_id = product_id
                updated_count += 1
                print(f"[ok] Updated {product.slug}: {product.stripe_product_id}")

            except stripe.InvalidRequestError as e:
                # Price does not exist at Stripe
                print(f"[FAIL] Failed {product.slug}: {e}")
                failed_products.append({
                    "slug": product.slug,
                    "id": str(product.id),
                    "stripe_price_id": product.stripe_price_id,
                    "reason": str(e)
                })
            except Exception as e:
                # Other error
                print(f"[FAIL] Failed {product.slug}: {e}")
                failed_products.append({
                    "slug": product.slug,
                    "id": str(product.id),
                    "stripe_price_id": product.stripe_price_id,
                    "reason": str(e)
                })

        # Commit changes
        await session.commit()

        print(f"\nBackfill complete: {updated_count} updated")

        if failed_products:
            print(f"\n{len(failed_products)} products failed to resolve:")
            print("These must be fixed manually:")
            for failure in failed_products:
                print(f"  - {failure['slug']} (id: {failure['id']}): {failure.get('reason', 'unknown')}")
                if 'stripe_price_id' in failure:
                    print(f"    stripe_price_id: {failure['stripe_price_id']}")
            sys.exit(1)
        else:
            print("All products resolved successfully")


if __name__ == "__main__":
    asyncio.run(backfill_stripe_product_ids())
