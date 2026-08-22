import logging
from typing import Optional

import stripe

from app.core.config import settings

logger = logging.getLogger(__name__)

stripe.api_key = settings.stripe_secret_key

def create_checkout_session(
    price_ids: list[str],
    success_url: str,
    cancel_url: str,
    user_email: str,
    user_id: str,
    product_ids: list[str],
    discount_code: str | None = None,
) -> stripe.checkout.Session:
    """Create a Stripe Checkout session for one or more products (week3_plan.md
    W3-R11 — a cart checkout is N line items in ONE session; a direct "Buy" is the
    same call with a one-item list, not a separate code path).

    Both user_id and product_ids go into metadata — the webhook handler
    (app/api/v1/commerce/webhooks.py) reads both back out of
    checkout.session.completed to know who to grant access to and for what.
    product_ids is joined with ',' rather than JSON-encoded: Stripe metadata values
    are plain strings, and a handful of UUIDs joined this way stays well under its
    500-character-per-value ceiling while needing no separate parser on the read side
    beyond `.split(',')`.

    W4-R2: invoice_creation and billing_address_collection enable tax-invoice-quality
    receipts for business buyers who need to expense purchases.
    """
    session_kwargs: dict = {
        'payment_method_types': ['card'],
        'line_items': [{'price': price_id, 'quantity': 1} for price_id in price_ids],
        'mode': 'payment',
        'success_url': success_url,
        'cancel_url': cancel_url,
        'customer_email': user_email,
        'invoice_creation': {'enabled': True},
        'billing_address_collection': 'required',
        'metadata': {
            'user_id': user_id,
            'product_ids': ','.join(product_ids),
        },
    }

    # Discount code — validated via Stripe Promotion Codes. The admin creates
    # the code in the Stripe dashboard; this just passes it through.
    if discount_code:
        applied = False
        try:
            promo_codes = stripe.PromotionCode.list(code=discount_code, active=True)
            if promo_codes.data:
                session_kwargs['discounts'] = [{
                    'promotion_code': promo_codes.data[0].id,
                }]
                applied = True
        except stripe.StripeError:
            logger.warning(
                "Stripe rejected the promotion-code lookup for %r; continuing at full price",
                discount_code,
                exc_info=True,
            )

        if not applied:
            # `[CHANGED 2026-08-22]` Previously this passed silently. A buyer who was
            # SHOWN a code on the site and then charged full price has a refund claim
            # and a reason to distrust every other number on the page, so a code that
            # does not apply must be visible rather than merely absent.
            #
            # It is still not fatal — failing the whole checkout over a promo code
            # would turn a discount problem into a lost sale. Instead the checkout
            # proceeds at full price and the reason is logged for the operator, who is
            # the only person who can actually fix it (the code lives in the Stripe
            # dashboard, not in this codebase).
            logger.warning(
                "Discount code %r did not resolve to an active Stripe promotion code — "
                "checkout proceeding at full price. If this code is advertised on the "
                "site, create it in the Stripe dashboard or remove the banner.",
                discount_code,
            )

    return stripe.checkout.Session.create(**session_kwargs)

def create_refund(*, payment_intent_id: str, amount: Optional[int] = None) -> stripe.Refund:
    """Refund of a completed payment. `amount` omitted (the admin path, week3_plan.md
    W3-R5) refunds the full charge — this was the only path that existed until Phase
    9B, whose §9B step 5 adds the one other decision the owner actually asked for: a
    buyer's self-serve partial refund keeps 15%, so passes `amount` (the 85% portion,
    computed by `_compute_refund_amount` in me.py) explicitly. Still not a place to
    invent a new money decision — both callers pass an amount this codebase's own
    policy already computed; this function just forwards it.
    """
    if amount is not None:
        return stripe.Refund.create(payment_intent=payment_intent_id, amount=amount)
    return stripe.Refund.create(payment_intent=payment_intent_id)


def construct_webhook_event(payload: bytes, sig_header: str) -> stripe.Event:
    """Construct and verify a Stripe webhook event."""
    return stripe.Webhook.construct_event(
        payload,
        sig_header,
        settings.stripe_webhook_secret
    )


def create_price(
    *,
    unit_amount: int,
    currency: str,
    product_name: str,
) -> tuple[str, str]:
    """Create a Stripe Price and Product, returning both IDs.

    Phase 8 (8A): Creates both the Stripe Product and Price in one call.
    The Product ID is stored for future price changes (8B), while the Price ID
    is what actually charges a card.

    Args:
        unit_amount: Price in cents (e.g., 9900 for A$99.00)
        currency: Three-letter currency code (e.g., "AUD")
        product_name: Human-readable product name

    Returns:
        Tuple of (price_id, product_id) from Stripe

    Raises:
        stripe.StripeError: If creation fails at Stripe
    """
    price = stripe.Price.create(
        unit_amount=unit_amount,
        currency=currency,
        product_data={'name': product_name},
    )
    # product_data (not product) was passed above, so Stripe creates a new Product
    # and returns its plain ID here rather than an expanded object.
    assert isinstance(price.product, str)
    return price.id, price.product


def create_price_under_product(
    *,
    unit_amount: int,
    currency: str,
    stripe_product_id: str,
) -> str:
    """Create a new Stripe Price under an existing Product.

    Phase 8 (8B-3): Used for price changes - creates a new Price under the
    same Stripe Product, preserving the Product ID.

    Args:
        unit_amount: Price in cents (e.g., 9900 for A$99.00)
        currency: Three-letter currency code (e.g., "AUD")
        stripe_product_id: Existing Stripe Product ID

    Returns:
        New Stripe Price ID

    Raises:
        stripe.StripeError: If creation fails at Stripe
    """
    price = stripe.Price.create(
        unit_amount=unit_amount,
        currency=currency,
        product=stripe_product_id,
    )
    return price.id


def archive_price(price_id: str) -> None:
    """Archive a Stripe Price (set active=False).

    Phase 8 (8B-3): Called after a successful price change to deactivate the old price.
    This is done last (after database commit) per the specified order of operations.

    Args:
        price_id: Stripe Price ID to archive

    Raises:
        stripe.StripeError: If archiving fails at Stripe
    """
    try:
        price = stripe.Price.modify(price_id, active=False)
    except stripe.InvalidRequestError:
        # Price may not exist or already be archived - log but don't fail
        pass
