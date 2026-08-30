import logging
from datetime import datetime, timezone
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
    """Create a Stripe Checkout session for one or more products. A cart checkout is N
    line items in ONE session; a direct "Buy" is the same call with a one-item list, not
    a separate code path.

    Both user_id and product_ids go into metadata — the webhook handler
    (app/api/v1/commerce/webhooks.py) reads both back out of
    checkout.session.completed to know who to grant access to and for what.
    product_ids is joined with ',' rather than JSON-encoded: Stripe metadata values
    are plain strings, and a handful of UUIDs joined this way stays well under its
    500-character-per-value ceiling while needing no separate parser on the read side
    beyond `.split(',')`.

    invoice_creation and billing_address_collection enable tax-invoice-quality
    receipts for business buyers who need to expense purchases.
    """
    customers = stripe.Customer.list(email=user_email, limit=1)
    if customers.data:
        customer_id = customers.data[0].id
    else:
        customer = stripe.Customer.create(email=user_email, metadata={"user_id": user_id})
        customer_id = customer.id

    session_kwargs: dict = {
        'payment_method_types': ['card'],
        'line_items': [{'price': price_id, 'quantity': 1} for price_id in price_ids],
        'mode': 'payment',
        'success_url': success_url,
        'cancel_url': cancel_url,
        'customer': customer_id,
        'invoice_creation': {'enabled': True},
        'billing_address_collection': 'required',
        'allow_promotion_codes': True,
        'metadata': {
            'user_id': user_id,
            'product_ids': ','.join(product_ids),
        },
    }

    # Discount code — offered as a Checkout prefill, never pre-attached via
    # `discounts=[...]`. Pre-attaching is wrong twice: Stripe rejects `discounts` and
    # `allow_promotion_codes` together (so the "Add promotion code" field vanishes), and
    # a pre-attached discount is applied by fiat without Stripe evaluating the code's
    # `restrictions` (first_time_transaction, minimum amount, max redemptions, expiry).
    # Prefilling keeps Stripe as the single authority on redemption, enforced on every
    # order with its own refusal message.
    if discount_code:
        try:
            promo_codes = stripe.PromotionCode.list(code=discount_code, active=True, limit=1)
            if promo_codes.data:
                # Surfaced to the success page / dashboard for support, and lets the
                # buyer see which code was suggested without it being pre-applied.
                session_kwargs['metadata']['suggested_promo_code'] = discount_code
            else:
                # A buyer who was SHOWN a code on the site and then charged full price
                # has a refund claim, so a code that does not resolve is logged rather
                # than passing silently. Still not fatal — failing the whole checkout
                # over a promo code turns a discount problem into a lost sale, and the
                # promotion-code field is present either way.
                logger.warning(
                    "Discount code %r did not resolve to an active Stripe promotion "
                    "code. If this code is advertised on the site, create it in the "
                    "Stripe dashboard or remove the banner.",
                    discount_code,
                )
        except stripe.StripeError:
            logger.warning(
                "Stripe rejected the promotion-code lookup for %r; checkout continues "
                "with the promotion-code field available",
                discount_code,
                exc_info=True,
            )

    return stripe.checkout.Session.create(**session_kwargs)

def create_promotion_in_stripe(
    *,
    code: str,
    percent_off: int,
    expires_at: datetime | None = None,
    first_time_transaction: bool = False,
    minimum_amount: int | None = None,
    max_redemptions: int | None = None,
) -> tuple[str, str]:
    """Create the Coupon and the PromotionCode that references it, returning both ids.

    Two calls, not one: Stripe models the *discount* (Coupon) separately from the
    *string a buyer types* (PromotionCode). Checkout resolves the typed string, which
    is why create_checkout_session looks up PromotionCode and not Coupon.

    Raises on failure. The caller must not write a promotions row for a code Stripe
    will not honour — a banner advertising a dead code is worse than no banner.
    """
    # `amount_off` is omitted rather than passed as None: this is a percentage
    # discount, and Stripe rejects a Coupon carrying both kinds.
    coupon = stripe.Coupon.create(
        percent_off=percent_off,
        duration='once',
        name=f'PRC-{code}',
    )

    promo_code_params: dict = {
        'coupon': coupon.id,
        'code': code,
        'active': True,
    }
    
    if max_redemptions is not None:
        promo_code_params['max_redemptions'] = max_redemptions
        
    restrictions = {}
    if first_time_transaction:
        restrictions['first_time_transaction'] = True
    if minimum_amount is not None:
        restrictions['minimum_amount'] = minimum_amount
        restrictions['minimum_amount_currency'] = 'aud'
        
    if restrictions:
        promo_code_params['restrictions'] = restrictions

    if expires_at is not None:
        # Expiry goes on the PromotionCode (the thing a buyer types), not the Coupon.
        # Stripe wants a Unix timestamp; a naive datetime is read as UTC. Without
        # setting it here the window would be enforced in our DB only, and Stripe would
        # keep honouring the code for anyone who already copied it.
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        promo_code_params['expires_at'] = int(expires_at.timestamp())

    promo_code = stripe.PromotionCode.create(**promo_code_params)

    return coupon.id, promo_code.id


def find_promotion_code_by_code(code: str) -> tuple[str, str] | None:
    """Resolve a typed code to its (promotion_code_id, coupon_id) in Stripe.

    Needed because a promotion can exist in Stripe without this database knowing its ids
    — e.g. a code created by hand in the Stripe dashboard, whose promotions row carries
    NULL stripe_coupon_id and NULL stripe_promotion_code_id. Without this resolution,
    deleting that row leaves the code fully redeemable in Stripe while the admin screen
    shows it as gone.

    Includes inactive codes: a code being already deactivated is not a reason to leave
    its coupon behind. Returns None when Stripe has never heard of the code.
    """
    for params in ({"code": code, "active": True}, {"code": code, "active": False}):
        try:
            found = stripe.PromotionCode.list(limit=1, **params)
        except stripe.StripeError:
            return None
        if found.data:
            pc = found.data[0]
            coupon_id = pc.coupon if isinstance(pc.coupon, str) else pc.coupon.id
            return pc.id, coupon_id
    return None


def delete_promotion_in_stripe(promotion_code_id: str, coupon_id: str) -> None:
    """Deactivate the PromotionCode and delete the underlying Coupon in Stripe.

    Stripe does not permit completely deleting a PromotionCode (to preserve invoice
    history), but setting active=False ensures it can no longer be redeemed.
    We delete the Coupon to clean up the dashboard.

    Deactivating the code comes FIRST and deleting the coupon second. Deleting a coupon
    does not deactivate the promotion codes pointing at it, so the reverse order would
    leave a live code attached to a missing coupon if the second call failed.
    """
    try:
        stripe.PromotionCode.modify(promotion_code_id, active=False)
    except stripe.InvalidRequestError as e:
        # `http_status` is None on some client-side InvalidRequestErrors, so compare
        # explicitly rather than letting `!= 404` swallow the unknown case.
        if e.http_status != 404:
            raise

    try:
        stripe.Coupon.delete(coupon_id)
    except stripe.InvalidRequestError as e:
        if e.http_status != 404:
            raise


def create_refund(*, payment_intent_id: str, amount: Optional[int] = None) -> stripe.Refund:
    """Refund of a completed payment. `amount` omitted (the admin path) refunds the full
    charge; a buyer's self-serve partial refund keeps 15%, so passes `amount` (the 85%
    portion, computed by `_compute_refund_amount` in me.py) explicitly. Not a place to
    invent a new money decision — both callers pass an amount this codebase's own policy
    already computed; this function just forwards it.
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

    Creates both the Stripe Product and Price in one call. The Product ID is stored for
    future price changes, while the Price ID is what actually charges a card.

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

    Used for price changes - creates a new Price under the same Stripe Product,
    preserving the Product ID.

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

    Called after a successful price change to deactivate the old price. Done last
    (after database commit) per the specified order of operations.

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
