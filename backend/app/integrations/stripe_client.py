import stripe
from app.core.config import settings

stripe.api_key = settings.stripe_secret_key

def create_checkout_session(
    price_id: str,
    success_url: str,
    cancel_url: str,
    user_email: str,
    user_id: str,
    product_id: str,
) -> stripe.checkout.Session:
    """Create a Stripe Checkout session for a product.

    Both user_id and product_id go into metadata — the webhook handler
    (app/api/v1/commerce/webhooks.py) reads both back out of
    checkout.session.completed to know who to grant access to and for what.
    """
    return stripe.checkout.Session.create(
        payment_method_types=['card'],
        line_items=[{
            'price': price_id,
            'quantity': 1,
        }],
        mode='payment',
        success_url=success_url,
        cancel_url=cancel_url,
        customer_email=user_email,
        metadata={
            'user_id': user_id,
            'product_id': product_id,
        },
    )

def construct_webhook_event(payload: bytes, sig_header: str) -> stripe.Event:
    """Construct and verify a Stripe webhook event."""
    return stripe.Webhook.construct_event(
        payload,
        sig_header,
        settings.stripe_webhook_secret
    )
