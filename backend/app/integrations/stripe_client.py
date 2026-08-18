import stripe
from app.core.config import settings

stripe.api_key = settings.stripe_secret_key

def create_checkout_session(
    price_ids: list[str],
    success_url: str,
    cancel_url: str,
    user_email: str,
    user_id: str,
    product_ids: list[str],
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
    """
    return stripe.checkout.Session.create(
        payment_method_types=['card'],
        line_items=[{'price': price_id, 'quantity': 1} for price_id in price_ids],
        mode='payment',
        success_url=success_url,
        cancel_url=cancel_url,
        customer_email=user_email,
        metadata={
            'user_id': user_id,
            'product_ids': ','.join(product_ids),
        },
    )

def create_refund(*, payment_intent_id: str) -> stripe.Refund:
    """Full refund of a completed payment (week3_plan.md W3-R5). Always the whole
    amount — this product has no partial-refund UI or policy, and inventing one at the
    API layer would be a decision this codebase's own rule reserves for the owner
    (non-negotiable #1's neighbour: don't build a money decision nobody asked for).
    """
    return stripe.Refund.create(payment_intent=payment_intent_id)


def construct_webhook_event(payload: bytes, sig_header: str) -> stripe.Event:
    """Construct and verify a Stripe webhook event."""
    return stripe.Webhook.construct_event(
        payload,
        sig_header,
        settings.stripe_webhook_secret
    )
