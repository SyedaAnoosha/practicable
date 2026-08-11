import logging

import requests

from app.core.config import settings

logger = logging.getLogger(__name__)

RESEND_SEND_URL = "https://api.resend.com/emails"

# docs/email.md "Option 1": Resend's sandbox sender needs no verified domain and no
# phone verification, but Resend's anti-abuse rules only let a sandbox account send to
# the single email address the Resend account itself is registered under — every other
# `to_email` gets a 403 "you can only send testing emails to your own address", logged
# clearly below rather than silently swallowed. Confirmed directly: even a "full
# access" Resend API key doesn't lift this — it's tied to whether any domain is
# verified on the account (none is), not to key permissions. Real buyers, and the
# owner notification below, can't receive mail this way yet; it's enough to prove the
# webhook -> order -> email code path for Week 1 testing. Switch to Brevo
# (app/core/config.py has the settings ready) once its one-time phone verification is
# done and real delivery is needed.
SANDBOX_SENDER = "Practicable <onboarding@resend.dev>"


async def _send(*, to_email: str, subject: str, html: str, context: str) -> None:
    """Shared send path for both email types below. Deliberately never raises
    (BACKEND.md §6.1) — a slow/failed send must not undo an already-committed order;
    logger.error, not print(), is what makes a failure here visible instead of the
    silent-for-every-order bug this integration had the first time it was built."""
    if not settings.resend_api_key:
        logger.error("Cannot send %s: RESEND_API_KEY not configured.", context)
        return

    try:
        response = requests.post(
            RESEND_SEND_URL,
            headers={"Authorization": f"Bearer {settings.resend_api_key}", "Content-Type": "application/json"},
            json={"from": SANDBOX_SENDER, "to": [to_email], "subject": subject, "html": html},
            timeout=10,
        )
        response.raise_for_status()
    except requests.RequestException as e:
        body = getattr(e.response, "text", "")
        logger.error("Failed to send %s to %s: %s %s", context, to_email, e, body)


async def send_receipt_email(
    to_email: str,
    order_id: str,
    amount_cents: int,
    currency: str,
    product_name: str,
):
    """To the buyer: confirms their purchase went through."""
    amount_display = f"{currency} {amount_cents / 100:.2f}"
    await _send(
        to_email=to_email,
        subject="Your receipt from Practicable",
        html=f"""
            <h1>Thank you for your purchase</h1>
            <p>Your order #{order_id} has been completed.</p>
            <p><strong>Amount:</strong> {amount_display}</p>
            <p><strong>Product:</strong> {product_name}</p>
            <p>You can access your purchased content in your library.</p>
        """,
        context=f"receipt email for order {order_id}",
    )


async def send_sale_notification_email(
    order_id: str,
    buyer_email: str,
    amount_cents: int,
    currency: str,
    product_name: str,
):
    """To the owner (settings.owner_notification_email): a sale just happened. Sent
    alongside the buyer's receipt, from the same webhook handler, after the same
    commit — one confirmed sale, two people who need to know."""
    amount_display = f"{currency} {amount_cents / 100:.2f}"
    await _send(
        to_email=settings.owner_notification_email,
        subject=f"New sale: {product_name}",
        html=f"""
            <h1>You made a sale</h1>
            <p>Order #{order_id} was just completed.</p>
            <p><strong>Buyer:</strong> {buyer_email}</p>
            <p><strong>Amount:</strong> {amount_display}</p>
            <p><strong>Product:</strong> {product_name}</p>
        """,
        context=f"sale notification for order {order_id}",
    )
