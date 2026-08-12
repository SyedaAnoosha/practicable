"""Transactional email (buyer receipts, owner sale alerts) over Resend.

WARNING: while this file is Resend-only, NO REAL CUSTOMER RECEIVES ANY EMAIL — every
send is redirected to the owner's inbox and labelled undelivered, because Resend's
sandbox sender can only deliver to its own account address. This is a deliberate
holding position for a test-mode store and must be reversed before taking real money.
Gmail and Brevo SMTP were removed because Render blocks outbound port 587; Mailjet was
working over REST when it was removed by choice, and is the fastest route back to real
delivery. See docs/gmail.md §8 and docs/email.md.
"""

import asyncio
import logging

import requests

from app.core.config import settings

logger = logging.getLogger(__name__)

RESEND_SEND_URL = "https://api.resend.com/emails"

# Sending from a real address requires verifying a domain at resend.com/domains.
SANDBOX_SENDER = "Practicable <onboarding@resend.dev>"


def _send_via_resend(*, to_email: str, subject: str, html: str, text: str) -> None:
    response = requests.post(
        RESEND_SEND_URL,
        headers={"Authorization": f"Bearer {settings.resend_api_key}", "Content-Type": "application/json"},
        json={"from": SANDBOX_SENDER, "to": [to_email], "subject": subject, "html": html, "text": text},
        timeout=10,
    )
    response.raise_for_status()


async def _send(*, to_email: str, subject: str, html: str, text: str, context: str) -> None:
    """Shared send path for both email types below. Never raises (BACKEND.md §6.1) — a
    failed send must not undo an already-committed order.

    `to_email` is the INTENDED recipient; everything is currently redirected to
    settings.owner_notification_email (see the module note).
    """
    if not settings.resend_api_key:
        logger.error("Cannot send %s: RESEND_API_KEY is not set.", context)
        return

    # No fallback to the buyer's address: the sandbox would 403. Fail loudly instead.
    if not settings.owner_notification_email:
        logger.error(
            "Cannot send %s: OWNER_NOTIFICATION_EMAIL is not set, and the Resend sandbox "
            "can only deliver to the Resend account's own address.",
            context,
        )
        return

    recipient = settings.owner_notification_email

    # If this is someone else's mail being redirected, say so in the message itself —
    # an unlabelled buyer receipt in the owner's inbox reads as their own purchase and
    # gives no hint that the buyer was never emailed.
    if recipient != to_email:
        subject = f"[Not delivered to buyer] {subject}"
        notice_text = (
            f"This is a copy of an email that was NOT delivered to {to_email}.\n"
            f"The store is running on a sandbox email sender that can only reach the\n"
            f"owner's own address, so it was redirected to you instead.\n"
            f"The recipient has not received it — follow up manually.\n\n"
            f"{'-' * 60}\n\n"
        )
        text = notice_text + text
        html = (
            '<div style="border:2px solid #B3402E;padding:12px;margin-bottom:16px;font-family:sans-serif">'
            f"<strong>This email was not delivered to {to_email}.</strong><br>"
            "The store is running on a sandbox email sender that can only reach your own "
            "address, so it was redirected to you. The recipient has <strong>not</strong> "
            "received it — follow up manually."
            "</div>"
        ) + html

    try:
        await asyncio.to_thread(_send_via_resend, to_email=recipient, subject=subject, html=html, text=text)
        if recipient == to_email:
            logger.info("Sent %s to %s via Resend.", context, recipient)
        else:
            logger.warning(
                "Sent %s to the owner (%s) instead of the intended recipient %s — "
                "the buyer has NOT been emailed.",
                context,
                recipient,
                to_email,
            )
    except requests.RequestException as e:
        body = getattr(e.response, "text", "")
        logger.error("Resend send failed for %s to %s: %s %s", context, recipient, e, body)


async def send_receipt_email(
    to_email: str,
    order_id: str,
    amount_cents: int,
    currency: str,
    product_name: str,
):
    """To the buyer: confirms their purchase went through. Currently redirected to the
    owner and labelled undelivered — the "Order for" line identifies whose receipt it is."""
    amount_display = f"{currency} {amount_cents / 100:.2f}"
    await _send(
        to_email=to_email,
        subject="Your receipt from Practicable",
        html=f"""
            <h1>Thank you for your purchase</h1>
            <p>Your order #{order_id} has been completed.</p>
            <p><strong>Order for:</strong> {to_email}</p>
            <p><strong>Amount:</strong> {amount_display}</p>
            <p><strong>Product:</strong> {product_name}</p>
            <p>You can access your purchased content in your library.</p>
        """,
        text=(
            f"Thank you for your purchase\n\n"
            f"Your order #{order_id} has been completed.\n"
            f"Order for: {to_email}\n"
            f"Amount: {amount_display}\n"
            f"Product: {product_name}\n\n"
            f"You can access your purchased content in your library."
        ),
        context=f"receipt email for order {order_id}",
    )


async def send_sale_notification_email(
    order_id: str,
    buyer_email: str,
    amount_cents: int,
    currency: str,
    product_name: str,
):
    """To the owner: a sale just happened. Sent alongside the buyer's receipt from the
    same webhook handler, and arrives without the redirect banner."""
    if not settings.owner_notification_email:
        logger.error(
            "OWNER_NOTIFICATION_EMAIL is not set — skipping the sale notification for "
            "order %s. Set it in this environment to start receiving sale alerts.",
            order_id,
        )
        return

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
        text=(
            f"You made a sale\n\n"
            f"Order #{order_id} was just completed.\n"
            f"Buyer: {buyer_email}\n"
            f"Amount: {amount_display}\n"
            f"Product: {product_name}"
        ),
        context=f"sale notification for order {order_id}",
    )
