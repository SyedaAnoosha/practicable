"""Delete products that sell exactly one file and carry no questions.

OWNER RULE (2026-08-23): "a pack is not a template — a pack must have more than one
file. Remove any product with only one file. Only one file is allowed when there are
questions involved."

So a file-selling product survives only if it has >= 2 `template` rows, or has >= 1
`question_set` row alongside its single template. Everything else goes.

SCOPE. Course products (`course`/`lesson` contents) are untouched: they sell lessons,
not files, and the one-file rule says nothing about them. Only products whose contents
are file-based are considered.

WHAT THIS DELETES, AND THE COST.

  Never sold (safe):
    cyber-related-issues              A$25   1 template
    cyber-risk-assessment-standard    A$25   1 template
    risk-assessment-template          A$39   1 template
    tprm-due-diligence-checklist      A$35   1 template

  Sold (destructive — owner confirmed 2026-08-23 after the consequences were spelled
  out, and confirmed again when told the FKs are ON DELETE NO ACTION):
    quality-risk-management-presentation  A$25  completed order 2026-08-19, 1 entitlement
    vendor-risk-assessment-scorecard      A$39  refunded  order 2026-08-14, 1 entitlement

  `order_items`, `entitlements` and `product_contents` all reference `products` with
  ON DELETE NO ACTION, so Postgres refuses the delete while any of them point at the
  row. Deleting these two products therefore REQUIRES deleting their order items and
  entitlements first. That means:

    - The order line item recording what was sold and for how much is gone. A receipt
      for the completed A$25 sale can no longer be reconstructed from the database.
    - `orders` rows survive, but an order whose every item was removed now reports a
      total with nothing itemised behind it.
    - One user loses entitlement rows. This contradicts the deliberate design in
      `Entitlement` ("a refund revokes rather than deletes: the row and its audit trail
      survive, revoked_at is what the gate checks") — that model expects revocation, not
      deletion, precisely so this history is never lost.

  This script prints exactly what it is about to destroy and requires --sold in
  addition to --apply before it will touch anything with a sale attached. Deleting a
  never-sold product needs only --apply. The extra flag exists so the destructive half
  cannot happen by running the safe half from muscle memory.

  `--unpublish-sold` is the non-destructive alternative: it removes the sold products
  from the catalogue and leaves every order item, entitlement and audit trail intact.

The underlying templates are NEVER deleted — they are shared content and can be
re-attached to a genuine multi-file pack later. Stripe prices are archived after the
commit, matching the order of operations in `POST /admin/products/{id}/price`.

Usage:
    cd backend && python -m scripts.delete_single_file_products                    # dry run
    cd backend && python -m scripts.delete_single_file_products --apply            # clean only
    cd backend && python -m scripts.delete_single_file_products --apply --sold     # + sold ones
    cd backend && python -m scripts.delete_single_file_products --apply --unpublish-sold
"""
from __future__ import annotations

import asyncio
import sys
from collections import Counter

from sqlalchemy import delete, func, select

import app.integrations.stripe_client  # noqa: F401  - import sets stripe.api_key
from app.db.models import Product, ProductContent
from app.db.models.entitlement import Entitlement
from app.db.models.order import OrderItem
from app.db.session import AsyncSessionLocal
from app.integrations.stripe_client import archive_price


async def _content_counts(session, product_id) -> Counter:
    rows = (
        await session.execute(
            select(ProductContent.content_type).where(
                ProductContent.product_id == product_id
            )
        )
    ).scalars().all()
    return Counter(rows)


def _violates_rule(counts: Counter) -> bool:
    """One file, no questions. Course products are excluded by the caller."""
    templates = counts.get("template", 0)
    questions = counts.get("question_set", 0)
    return templates == 1 and questions == 0


async def run(apply: bool, allow_sold: bool, unpublish_sold: bool) -> None:
    async with AsyncSessionLocal() as session:
        products = (
            await session.execute(select(Product).order_by(Product.slug))
        ).scalars().all()

        clean: list[tuple[Product, Counter]] = []
        sold: list[tuple[Product, Counter, int, int]] = []

        for product in products:
            counts = await _content_counts(session, product.id)

            # Course products sell lessons, not files - out of scope for this rule.
            if counts.get("course", 0) or counts.get("lesson", 0):
                continue
            if not _violates_rule(counts):
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
                sold.append((product, counts, order_items, entitlements))
            else:
                clean.append((product, counts))

        print("Never sold - safe to delete:")
        for product, counts in clean:
            print(f"  DELETE {product.slug:44s} A${product.price_amount / 100:7.2f} {dict(counts)}")
        if not clean:
            print("  (none)")

        print("\nHas sales history - deleting destroys it:")
        for product, counts, order_items, entitlements in sold:
            print(
                f"  {product.slug:44s} A${product.price_amount / 100:7.2f} "
                f"order_items={order_items} entitlements={entitlements}"
            )
        if not sold:
            print("  (none)")

        if not apply:
            print(
                f"\nDry run. {len(clean)} would be deleted."
                + (
                    f" {len(sold)} with sales history need --sold to delete"
                    " or --unpublish-sold to retire safely."
                    if sold
                    else ""
                )
            )
            return

        to_archive: list[tuple[str, str]] = []

        for product, _counts in clean:
            await session.execute(
                delete(ProductContent).where(ProductContent.product_id == product.id)
            )
            if product.stripe_price_id:
                to_archive.append((product.slug, product.stripe_price_id))
            await session.delete(product)

        deleted_sold = 0
        unpublished_sold = 0

        for product, _counts, _oi, _ent in sold:
            if unpublish_sold:
                product.published = False
                unpublished_sold += 1
                if product.stripe_price_id:
                    to_archive.append((product.slug, product.stripe_price_id))
                continue
            if not allow_sold:
                print(f"  SKIP {product.slug}: has sales history, needs --sold")
                continue

            # Destructive path, explicitly requested. Remove the referencing rows the
            # NO ACTION foreign keys would otherwise block on.
            await session.execute(
                delete(Entitlement).where(Entitlement.product_id == product.id)
            )
            await session.execute(
                delete(OrderItem).where(OrderItem.product_id == product.id)
            )
            await session.execute(
                delete(ProductContent).where(ProductContent.product_id == product.id)
            )
            if product.stripe_price_id:
                to_archive.append((product.slug, product.stripe_price_id))
            await session.delete(product)
            deleted_sold += 1
            print(f"  DELETED WITH HISTORY {product.slug}")

        await session.commit()
        print(
            f"\nCommitted. {len(clean)} clean deleted, {deleted_sold} sold deleted, "
            f"{unpublished_sold} sold unpublished."
        )

        for slug, price_id in to_archive:
            try:
                archive_price(price_id)
                print(f"  archived Stripe price for {slug}")
            except Exception as exc:
                print(f"  WARN could not archive price for {slug}: {type(exc).__name__}")


if __name__ == "__main__":
    asyncio.run(
        run(
            apply="--apply" in sys.argv,
            allow_sold="--sold" in sys.argv,
            unpublish_sold="--unpublish-sold" in sys.argv,
        )
    )
