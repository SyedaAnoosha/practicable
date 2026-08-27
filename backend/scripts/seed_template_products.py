"""Give each unsold published template its own product, so it stops reading
"Not yet for sale" in the templates catalogue.

OWNER RULE: a TEMPLATE may be sold as a single file — that is what a template is. A PACK
is what must hold more than one template, and a pack may only be a single file when what
it sells is a questions PDF (as `risk-enterprise-op-question-pack` does).
`delete_single_file_products.py` applies the file-count rule to every product regardless
of type, which also removes single-file TEMPLATE products; this restores them.

This restores a product per template. It does NOT recreate the deleted packs.

WHY THESE PRICES.
  Taken from the products that previously sold these same files, so nothing is invented
  and nothing silently changes price:
    risk-assessment-template               A$39  (was risk-assessment-template)
    tprm-due-diligence-checklist           A$35  (was tprm-due-diligence-checklist)
    vendor-risk-assessment-scorecard       A$39  (was vendor-risk-assessment-scorecard)
    quality-risk-management-presentation   A$25  (was quality-risk-management-presentation)
  The two unpublished templates (`cyber-related-issues`, `cyber-risk-assessment-standard`)
  are skipped: an unpublished template is not visible, so it is not the thing showing
  "Not yet for sale", and one of them has no file attached at all (0 bytes, empty
  file_name). Pricing content that does not exist is not something a script should do.

KNOWN CONSEQUENCE.
  `app/api/v1/content/packs.py::_pack_product_ids` classifies ANY published product with
  at least one `template` row as a pack, so these single-template products would appear
  on the packs surface alongside real multi-template packs — the shape the owner's rule
  says a pack must not have. A real "template product" vs "pack" distinction in that
  classifier is an API change, out of scope for a seed script.

  Products are created UNPUBLISHED for that reason: an unpublished product still gives
  the template its price in the catalogue without adding a bogus entry to the packs
  page. Publish them once the classifier distinguishes the two shapes.

Re-runnable: matched on slug, so a second run updates nothing and creates nothing.

Usage:
    cd backend && python -m scripts.seed_template_products            # dry run
    cd backend && python -m scripts.seed_template_products --apply
"""
from __future__ import annotations

import asyncio
import sys

from sqlalchemy import select

from app.core.config import settings
from app.db.models import Product, ProductContent, Template
from app.db.session import AsyncSessionLocal
from app.integrations.stripe_client import create_price

# template slug -> (price cents, product name, description)
PLAN: dict[str, tuple[int, str, str]] = {
    "risk-assessment-template": (
        3900,
        "Risk Assessment Template",
        "A worked risk-assessment example you can follow end to end — hazard, who it "
        "affects, existing controls, and what still needs doing.",
    ),
    "tprm-due-diligence-checklist": (
        3500,
        "TPRM Due Diligence Checklist",
        "A working third-party due diligence task tracker: collect vendor information, "
        "screen the vendor, assess vendor risk — with status, owner and date columns to "
        "run the process end to end.",
    ),
    "vendor-risk-assessment-scorecard": (
        3900,
        "Vendor Risk Assessment Scorecard",
        "A per-vendor scoring form for comparing vendors on the risks that matter, so a "
        "selection decision is defensible rather than a matter of opinion.",
    ),
    "quality-risk-management-presentation-ready-to-use-template": (
        2500,
        "Quality Risk Management Presentation",
        "A ready-to-use presentation on quality risk management, for briefing a team or "
        "a steering group without building the deck from scratch.",
    ),
}


def _mode_of_key(key: str) -> str:
    if key.startswith(("sk_test_", "rk_test_")):
        return "test"
    if key.startswith(("sk_live_", "rk_live_")):
        return "live"
    return "unknown"


async def seed(apply: bool, live_ok: bool) -> None:
    mode = _mode_of_key(settings.stripe_secret_key)
    print(f"Stripe key mode: {mode}")
    if mode == "unknown":
        print("Refusing to run: STRIPE_SECRET_KEY is not a recognised test or live key.")
        return
    if mode == "live" and apply and not live_ok:
        print("Refusing to run: this is a LIVE Stripe key. Re-run with --live to confirm.")
        return

    async with AsyncSessionLocal() as session:
        created = skipped = 0

        for template_slug, (amount, name, description) in PLAN.items():
            template = (
                await session.execute(
                    select(Template).where(Template.slug == template_slug)
                )
            ).scalar_one_or_none()
            if template is None:
                print(f"  SKIP {template_slug}: no such template")
                skipped += 1
                continue
            if not template.published:
                print(f"  SKIP {template_slug}: template is unpublished")
                skipped += 1
                continue
            if getattr(template, "is_free", False):
                # A free template never advertises a price - content/templates.py
                # suppresses it - so a product would be bought and change nothing.
                print(f"  SKIP {template_slug}: template is free")
                skipped += 1
                continue

            # Already sold by something? Then it is not the one saying "Not yet for sale".
            existing_seller = (
                await session.execute(
                    select(Product.slug)
                    .join(ProductContent, ProductContent.product_id == Product.id)
                    .where(
                        ProductContent.content_type == "template",
                        ProductContent.content_id == template.id,
                    )
                )
            ).scalars().first()
            if existing_seller:
                print(f"  SKIP {template_slug}: already sold by {existing_seller}")
                skipped += 1
                continue

            product_slug = template_slug
            already = (
                await session.execute(
                    select(Product).where(Product.slug == product_slug)
                )
            ).scalar_one_or_none()
            if already is not None:
                print(f"  SKIP {product_slug}: product slug already exists")
                skipped += 1
                continue

            print(f"  CREATE {product_slug}: A${amount / 100:.2f} for 1 template")
            created += 1
            if apply:
                price_id, stripe_product_id = create_price(
                    unit_amount=amount, currency="AUD", product_name=name
                )
                product = Product(
                    slug=product_slug,
                    name=name,
                    description=description,
                    stripe_price_id=price_id,
                    stripe_product_id=stripe_product_id,
                    price_amount=amount,
                    currency="AUD",
                    published=False,
                )
                session.add(product)
                await session.flush()
                session.add(
                    ProductContent(
                        product_id=product.id,
                        content_type="template",
                        content_id=template.id,
                    )
                )

        if apply:
            await session.commit()
            print(f"\nCommitted ({mode} mode). {created} created, {skipped} skipped.")
            print(
                "Created UNPUBLISHED on purpose - see this script's docstring: the packs\n"
                "classifier would otherwise list a single-template product as a pack."
            )
        else:
            print(f"\nDry run ({mode} mode). {created} would be created, {skipped} skipped.")


if __name__ == "__main__":
    asyncio.run(seed(apply="--apply" in sys.argv, live_ok="--live" in sys.argv))
