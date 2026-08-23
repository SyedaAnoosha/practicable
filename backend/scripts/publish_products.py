"""Publish every product that passes the same guards the admin publish endpoint runs.

This is the scripted equivalent of clicking "Publish" on each product in /admin, and it
deliberately reuses `publish_guard`'s own functions rather than a looser local check, so
a product published here is one the API would also have published. Three guards, in the
order `POST /admin/products/{id}/publish` runs them:

  1. `check_stripe_price`  - the price resolves at Stripe, is active, is in the same
     mode as the configured key, and matches the row's amount and currency.
  2. `check_content_overlap` - no already-published non-bundle product grants the same
     content. Two published products selling the same thing at different prices is the
     failure this catches; bundles are exempt, which is the point of a bundle.
  3. `check_bundle_pricing` - a bundle must cost less than the sum of its parts.

A product that fails any guard is REPORTED AND SKIPPED, never forced. The guards encode
commerce decisions (what is on sale, at what price, sold once); a script that overrode
them would be reintroducing exactly the defects they exist to prevent, silently and in
bulk. Publishing is also the moment content becomes purchasable, so the default is a dry
run and writes happen only under --apply.

`publish_state` is kept in sync with `published` through the same PublishStateMixin the
endpoint relies on, so rows written here are indistinguishable from rows written by the
admin panel.

Usage:
    cd backend && python -m scripts.publish_products            # dry run
    cd backend && python -m scripts.publish_products --apply
"""
from __future__ import annotations

import asyncio
import sys

from sqlalchemy import select

import app.integrations.stripe_client  # noqa: F401  - import sets stripe.api_key
from app.core.publish_guard import (
    check_bundle_pricing,
    check_content_overlap,
    check_stripe_price,
)
from app.db.models.product import Product
from app.db.session import AsyncSessionLocal


async def publish_all(apply: bool) -> None:
    async with AsyncSessionLocal() as session:
        products = (
            await session.execute(
                select(Product)
                .where(Product.published.is_(False))
                .order_by(Product.slug)
            )
        ).scalars().all()

        if not products:
            print("Nothing to do - every product is already published.")
            return

        publishable: list[Product] = []
        blocked: list[tuple[Product, str]] = []

        for product in products:
            price_check = check_stripe_price(
                stripe_price_id=product.stripe_price_id,
                price_amount=product.price_amount,
                currency=product.currency,
            )
            if not price_check.ok:
                blocked.append((product, f"stripe price: {price_check.message}"))
                continue

            overlap = await check_content_overlap(
                product.id, session, is_bundle=product.is_bundle
            )
            if overlap.has_conflicts:
                others = sorted({c["other_product_name"] for c in overlap.conflicts})
                blocked.append(
                    (
                        product,
                        f"content overlap: {len(overlap.conflicts)} row(s) already sold by "
                        + ", ".join(f'"{name}"' for name in others),
                    )
                )
                continue

            if product.is_bundle:
                pricing = await check_bundle_pricing(product.id, session)
                if pricing.is_overpriced:
                    blocked.append(
                        (
                            product,
                            f"bundle overpriced: A${product.price_amount / 100:.2f} vs parts "
                            f"A${pricing.parts_total_cents / 100:.2f}",
                        )
                    )
                    continue

            publishable.append(product)

        for product in publishable:
            print(f"  PUBLISH {product.slug} (A${product.price_amount / 100:.2f})")
            if apply:
                product.published = True

        for product, reason in blocked:
            print(f"  SKIP    {product.slug} - {reason}")

        if apply:
            await session.commit()
            print(f"\nCommitted. {len(publishable)} published, {len(blocked)} skipped.")
        else:
            print(
                f"\nDry run. {len(publishable)} would be published, "
                f"{len(blocked)} skipped. Re-run with --apply."
            )


if __name__ == "__main__":
    asyncio.run(publish_all(apply="--apply" in sys.argv))
