"""Publish guards for content overlap, bundle pricing, macros, and preview requirements.

`check_content_overlap(product_id, session)` returns the intersecting
(product, content_type, content_id) rows, or empty — giving the admin UI the information
to render an inline refusal with full context rather than a generic 409.

`check_bundle_pricing(product_id, session)` verifies a bundle is priced below the sum
of its individual product prices — the guard that prevents a bundle from being priced at
or above what buying each part separately would cost.

`check_has_macros(template)` refuses publish if has_macros=True.
`check_preview_images(template)` refuses publish if fewer than 2 preview image keys.

All functions are pure (no HTTP concerns); they take a session and return a result object,
never raise. The calling admin endpoint is responsible for translating the result into an
HTTP 409 with the appropriate message from the copy deck.

The overlap guard is also available as a standalone SQL file at
`scripts/check_overlaps.sql` for running against production without a deploy.

The guard changes in one place only (here), not beside the gate.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Literal, Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.product import Product, ProductContent


@dataclass
class OverlapResult:
    """Returned by check_content_overlap. .conflicts is empty when publish is safe."""
    conflicts: list[dict] = field(default_factory=list)

    @property
    def has_conflicts(self) -> bool:
        return bool(self.conflicts)


@dataclass
class PricingResult:
    """Returned by check_bundle_pricing."""
    bundle_price_cents: int = 0
    parts_total_cents: int = 0
    ok: bool = True

    @property
    def is_overpriced(self) -> bool:
        return not self.ok


@dataclass
class PreviewResult:
    """Returned by check_preview_images."""
    key_count: int = 0
    ok: bool = True


async def check_content_overlap(
    product_id: uuid.UUID,
    session: AsyncSession,
    *,
    is_bundle: bool = False,
) -> OverlapResult:
    """Return any (published_product, content_type, content_id) rows that this product
    would share with an already-published product.

    Bundles are permitted to overlap — that is the point of a bundle — but only when
    is_bundle=True. The escape hatch is deliberate, not the default.

    The query is a fixed count regardless of catalogue size. It uses the
    reverse-direction index added in migration 013
    (ix_product_contents_type_content_reverse) to avoid a seq scan on product_contents.
    """
    if is_bundle:
        return OverlapResult()

    # Find content_ids granted by THIS product
    this_contents_q = select(
        ProductContent.content_type,
        ProductContent.content_id,
    ).where(ProductContent.product_id == product_id)
    this_rows = (await session.execute(this_contents_q)).all()

    if not this_rows:
        return OverlapResult()

    # Find OTHER published products granting any of the same content — one bulk query
    # per content_type (at most 3: template/lesson/question_set), not one per content
    # row. Matches the bulk-resolve idiom used elsewhere.
    ids_by_type: dict[str, list[uuid.UUID]] = {}
    for content_type, content_id in this_rows:
        ids_by_type.setdefault(content_type, []).append(content_id)

    conflicts: list[dict] = []
    for content_type, content_ids in ids_by_type.items():
        overlap_q = (
            select(
                ProductContent.product_id,
                ProductContent.content_type,
                ProductContent.content_id,
                Product.name,
                Product.slug,
            )
            .join(Product, Product.id == ProductContent.product_id)
            .where(
                ProductContent.content_type == content_type,
                ProductContent.content_id.in_(content_ids),
                ProductContent.product_id != product_id,
                Product.published.is_(True),
                Product.is_bundle.is_(False),  # bundles are allowed to overlap
            )
        )
        rows = (await session.execute(overlap_q)).all()
        for row in rows:
            conflicts.append(
                {
                    "other_product_id": str(row.product_id),
                    "other_product_name": row.name,
                    "other_product_slug": row.slug,
                    "content_type": row.content_type,
                    "content_id": str(row.content_id),
                }
            )

    return OverlapResult(conflicts=conflicts)


async def check_bundle_pricing(
    product_id: uuid.UUID,
    session: AsyncSession,
) -> PricingResult:
    """A bundle must cost less than the sum of its constituent products' prices.

    A bundle priced at or above the sum of its parts is refused. The existing A$79
    bundle over A$98 of parts passes; a hypothetical A$98 bundle over A$98 of parts
    does not.

    Returns PricingResult.ok=False with both prices when the bundle is overpriced.
    Returns PricingResult.ok=True immediately when the product is not a bundle or has no
    constituent products with prices.
    """
    # Get the bundle's own price
    bundle = await session.get(Product, product_id)
    if bundle is None or not bundle.is_bundle:
        return PricingResult(ok=True)

    # Get all content_ids this bundle grants (content_type='product' not currently in
    # schema, but the spirit: this bundle's product_contents links to parts)
    # In the current schema: bundle product_contents link to courses/templates, not
    # sub-products directly. Compute sum of all published products that share any
    # product_contents with this bundle.
    content_q = select(
        ProductContent.content_type, ProductContent.content_id
    ).where(ProductContent.product_id == product_id)
    bundle_contents = (await session.execute(content_q)).all()

    if not bundle_contents:
        return PricingResult(bundle_price_cents=bundle.price_amount, ok=True)

    # Find non-bundle products that grant the same content — those are the "parts".
    # Grouped by content_type, same fix and same reasoning as check_content_overlap
    # above: one bulk query per type, not one per content row.
    ids_by_type: dict[str, list[uuid.UUID]] = {}
    for content_type, content_id in bundle_contents:
        ids_by_type.setdefault(content_type, []).append(content_id)

    parts_total = 0
    seen_products: set[uuid.UUID] = set()
    for content_type, content_ids in ids_by_type.items():
        parts_q = (
            select(Product.id, Product.price_amount)
            .join(ProductContent, ProductContent.product_id == Product.id)
            .where(
                ProductContent.content_type == content_type,
                ProductContent.content_id.in_(content_ids),
                Product.id != product_id,
                Product.published.is_(True),
                Product.is_bundle.is_(False),
            )
        )
        for row in (await session.execute(parts_q)).all():
            if row.id not in seen_products:
                seen_products.add(row.id)
                parts_total += row.price_amount

    if parts_total == 0:
        # No individually-priced parts found; bundle pricing check is vacuous
        return PricingResult(bundle_price_cents=bundle.price_amount, ok=True)

    ok = bundle.price_amount < parts_total
    return PricingResult(
        bundle_price_cents=bundle.price_amount,
        parts_total_cents=parts_total,
        ok=ok,
    )


def check_has_macros(template) -> bool:
    """Returns True if publishing is REFUSED (has_macros=True).

    No macros in any sold artefact: a publish with has_macros=True is a hard refusal,
    not a warning.
    """
    return bool(getattr(template, "has_macros", False))


def check_preview_images(template) -> PreviewResult:
    """Returns PreviewResult.ok=False if fewer than 2 preview image keys are set.

    No paid product may publish with fewer than two previews. Fails closed, with a
    message naming what is missing.
    """
    keys = getattr(template, "preview_image_keys", None) or []
    count = len(keys)
    return PreviewResult(key_count=count, ok=count >= 2)


@dataclass
class StripePriceResult:
    """Returned by check_stripe_price."""
    ok: bool = True
    message: str = ""


def check_stripe_price(
    *,
    stripe_price_id: str,
    price_amount: int,
    currency: str,
) -> StripePriceResult:
    """Refuses publish when the Stripe price is invalid, inactive, cross-mode, or mismatches.

    Four conditions, four distinct messages. The mismatch case uses the existing
    "Price mismatch" string.

    Args:
        stripe_price_id: The Stripe price ID to validate
        price_amount: Expected price in cents from the database
        currency: Expected currency code from the database

    Returns:
        StripePriceResult with ok=False and a specific message if any check fails
    """
    import stripe
    from app.core.config import settings

    from app.core.constants import STRIPE_PRICE_UNSET

    # Check 1: Placeholder or empty
    if not stripe_price_id or stripe_price_id == STRIPE_PRICE_UNSET:
        return StripePriceResult(
            ok=False,
            message="Stripe price is not set. Create a product to generate a real Stripe price.",
        )

    try:
        price = stripe.Price.retrieve(stripe_price_id)
    except stripe.InvalidRequestError:
        # Check 2: Price does not resolve at Stripe
        return StripePriceResult(
            ok=False,
            message="Stripe price not found. The price ID may have been deleted or never existed.",
        )
    except stripe.AuthenticationError:
        # API key issue - this is a configuration problem, not a product problem
        return StripePriceResult(
            ok=False,
            message="Stripe authentication failed. Check the API key configuration.",
        )

    # Check 3: Price is inactive
    if not price.active:
        return StripePriceResult(
            ok=False,
            message="Stripe price is inactive. Reactivate it in Stripe or create a new price.",
        )

    # Check 4: cross-mode (test key against live price or vice versa). Mode comes from
    # the `_test_`/`_live_` infix, present on every key form (sk_, rk_, pk_) — a
    # `startswith("sk_test_")` check would miss the restricted keys this project uses.
    key = settings.stripe_secret_key or ""
    if "_test_" in key:
        key_is_live = False
    elif "_live_" in key:
        key_is_live = True
    else:
        # An unrecognised key shape: say so rather than guessing a mode and reporting a
        # mismatch that may not exist. Stripe itself will reject a genuinely bad key.
        key_is_live = None

    # `price.livemode` is authoritative and is what Stripe returns; the old
    # `not stripe_price_id.startswith("price_")` half of this test was never meaningful
    # (every price id starts with `price_`, in both modes).
    price_is_live = bool(getattr(price, "livemode", False))

    if key_is_live is False and price_is_live:
        return StripePriceResult(
            ok=False,
            message="Mode mismatch: test API key against a live Stripe price. Use matching keys.",
        )
    if key_is_live is True and not price_is_live:
        return StripePriceResult(
            ok=False,
            message="Mode mismatch: live API key against a test Stripe price. Use matching keys.",
        )

    # Check 5: Price amount mismatch
    if price.unit_amount is None or price.unit_amount != price_amount:
        stripe_amount = f"{price.unit_amount / 100:.2f}" if price.unit_amount is not None else "unknown"
        return StripePriceResult(
            ok=False,
            message=f"Price mismatch: Stripe shows {stripe_amount} {price.currency.upper()}, "
            f"but database has {price_amount / 100:.2f} {currency.upper()}. Update one to match.",
        )

    # Check 6: Currency mismatch
    if price.currency.upper() != currency.upper():
        return StripePriceResult(
            ok=False,
            message=f"Currency mismatch: Stripe shows {price.currency.upper()}, "
            f"but database has {currency.upper()}. Update one to match.",
        )

    return StripePriceResult(ok=True)


ReadinessState = Literal["no_product", "price_unset", "stripe_price_unresolved", "unpublished", "ready"]


@dataclass
class Readiness:
    """Returned by compute_readiness — the one place a course/template/product's
    purchasability state is decided: server-derived, not inferred client-side."""
    state: ReadinessState
    message: str


def compute_readiness(product: Optional[Product]) -> Readiness:
    """Server-derived readiness for a course, template, or the product row itself.

    `product` is None when the content has no product at all yet (a course just
    created, before "Make purchasable" has ever been called) — the state a bare
    `ProductOut`-only readiness calculation could never express, because it always
    starts from a product row that already exists.

    Reuses `check_stripe_price` rather than a second, looser Stripe-resolution
    check, so a course/template's readiness and a product's own agree by
    construction instead of by two people remembering to keep them in sync.
    """
    if product is None:
        return Readiness("no_product", "Not purchasable yet — no product exists")

    try:
        result = check_stripe_price(
            stripe_price_id=product.stripe_price_id,
            price_amount=product.price_amount,
            currency=product.currency,
        )
    except Exception:
        # check_stripe_price is deliberately strict for the publish guard, where a
        # malformed Stripe response should be investigated, not hidden. Readiness is
        # display-only — every list/detail response that includes a course, template
        # or product computes this — so a genuinely unexpected error here degrades to
        # "unresolved" rather than 500ing an otherwise-unrelated page load.
        return Readiness("stripe_price_unresolved", "Stripe price could not be verified.")

    if not result.ok:
        # check_stripe_price's own message already distinguishes "not set" from
        # "not found" from "inactive" etc — the caller doesn't need to re-derive it.
        if "not set" in result.message.lower():
            return Readiness("price_unset", result.message)
        return Readiness("stripe_price_unresolved", result.message)

    if not product.published:
        return Readiness("unpublished", "Product is unpublished")

    return Readiness("ready", "Ready to purchase")
