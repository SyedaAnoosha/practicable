"""Delete the two duplicate products that the content-overlap guard blocked.

Both sold content an already-published product sells, at a lower price:

    risk-register-template                        A$29  its template + question set are
                                                        already sold inside the published
                                                        Risk Register Fundamentals (A$49)
    risk-enterprise-operational-question-pack-pdf A$25  its template is already sold by the
                                                        published Risk (Enterprise &
                                                        operational) question pack (A$49)

Publishing either would have put the same artefact on sale twice at two prices, which is
what `check_content_overlap` exists to stop. The owner's call (2026-08-23) was to delete
them rather than keep them as permanently-unpublishable rows.

SAFETY. Deleting a product is only safe when nothing references it, so this script
refuses rather than cascades. Before removing anything it checks, per product:

  - `order_items.product_id` - a real FK. A product that has ever been bought must not
    be deleted: the order history would lose the row that says what was sold and for how
    much, and a receipt cannot be reconstructed from an orphaned line item.
  - `entitlements.product_id` - a live grant. Deleting the product would leave a user
    holding access to something the catalogue can no longer describe.

Both were verified empty for these two products before this script was written (0 order
items, 0 entitlements, and neither was ever published, so neither could have been sold).
The checks run anyway on every invocation, because the state that made this safe is not
guaranteed to still hold the next time someone runs it.

`product_contents` rows ARE deleted, since they are owned by the product and describe
nothing once it is gone. The underlying templates, lessons and question sets are never
touched - they are shared content that other products still sell.

The Stripe Price is archived, not deleted (Stripe does not permit deleting a Price), so
the objects stop appearing as active in the dashboard. Archiving happens AFTER the
database commit, matching the order of operations in `POST /admin/products/{id}/price`:
a stale archived Price nobody references is recoverable, a live Price whose row vanished
mid-transaction is not.

Usage:
    cd backend && python -m scripts.delete_overlapping_products            # dry run
    cd backend && python -m scripts.delete_overlapping_products --apply
"""
from __future__ import annotations

import asyncio
import sys

from sqlalchemy import delete, func, select

import app.integrations.stripe_client  # noqa: F401  - import sets stripe.api_key
from app.db.models.entitlement import Entitlement
from app.db.models.order import OrderItem
from app.db.models.product import Product, ProductContent
from app.db.session import AsyncSessionLocal
from app.integrations.stripe_client import archive_price

DOOMED = [
    "risk-register-template",
    "risk-enterprise-operational-question-pack-pdf",
]


async def delete_products(apply: bool) -> None:
    async with AsyncSessionLocal() as session:
        deleted = skipped = 0
        archive_after_commit: list[tuple[str, str]] = []

        for slug in DOOMED:
            product = (
                await session.execute(select(Product).where(Product.slug == slug))
            ).scalar_one_or_none()
            if product is None:
                print(f"  SKIP {slug}: already gone")
                skipped += 1
                continue

            order_items = (
                await session.execute(
                    select(func.count())
                    .select_from(OrderItem)
                    .where(OrderItem.product_id == product.id)
                )
            ).scalar() or 0
            entitlements = (
                await session.execute(
                    select(func.count())
                    .select_from(Entitlement)
                    .where(Entitlement.product_id == product.id)
                )
            ).scalar() or 0

            if order_items or entitlements:
                # Refuse, loudly. Unpublishing is the right move for a product that has
                # been sold; deleting it destroys the record of the sale.
                print(
                    f"  REFUSE {slug}: {order_items} order item(s), "
                    f"{entitlements} entitlement(s) reference it. "
                    "Unpublish it instead of deleting it."
                )
                skipped += 1
                continue

            contents = (
                await session.execute(
                    select(func.count())
                    .select_from(ProductContent)
                    .where(ProductContent.product_id == product.id)
                )
            ).scalar() or 0

            print(
                f"  DELETE {slug} (A${product.price_amount / 100:.2f}, "
                f"published={product.published}, {contents} content row(s))"
            )
            deleted += 1

            if apply:
                await session.execute(
                    delete(ProductContent).where(ProductContent.product_id == product.id)
                )
                await session.delete(product)
                if product.stripe_price_id:
                    archive_after_commit.append((slug, product.stripe_price_id))

        if not apply:
            print(f"\nDry run. {deleted} would be deleted, {skipped} skipped. Re-run with --apply.")
            return

        await session.commit()
        print(f"\nCommitted. {deleted} deleted, {skipped} skipped.")

        for slug, price_id in archive_after_commit:
            try:
                archive_price(price_id)
                print(f"  archived Stripe price for {slug}: {price_id}")
            except Exception as exc:
                # The row is already gone; a surviving active Price is untidy, not unsafe.
                print(f"  WARN could not archive {price_id} for {slug}: {type(exc).__name__}")


if __name__ == "__main__":
    asyncio.run(delete_products(apply="--apply" in sys.argv))
