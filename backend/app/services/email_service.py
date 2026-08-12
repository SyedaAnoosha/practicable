import asyncio
import logging

import requests

from app.core.config import settings

logger = logging.getLogger(__name__)

RESEND_SEND_URL = "https://api.resend.com/emails"

# Resend's sandbox sender. It can only ever deliver to the single address the Resend
# account itself is registered under — attempting any other recipient returns a 403
# validation_error naming that address. Sending from a real address instead requires
# verifying a domain at resend.com/domains.
SANDBOX_SENDER = "Practicable <onboarding@resend.dev>"


# ── Why this file is one transport instead of four ───────────────────────────────────
#
# [OWNER-DECIDED 2026-08-12] Gmail SMTP, Mailjet and Brevo were removed, leaving Resend
# alone, with every email routed to the owner's inbox.
#
# What was actually true at the time of that decision, recorded here because it is not
# recoverable from the code that remains:
#
#   - Gmail SMTP and Brevo SMTP could NEVER work on Render. Both connect on port 587,
#     and Render blocks outbound SMTP — every attempt failed with [Errno 101] Network
#     is unreachable. Deleting them removed two tiers that were structurally incapable
#     of sending from the deployed host. This is the one unambiguously correct part of
#     the change, and it also removes a doomed 15-second TCP timeout from the front of
#     every send, inside a Stripe webhook that must return fast.
#
#   - Mailjet, by contrast, WAS working. It is a REST call over 443, immune to the SMTP
#     block, and it delivered order 46ff0ba1's receipt to a real buyer at an address
#     that was not the sender. It was removed by choice, not because it failed.
#
# The consequence, stated plainly so it is not rediscovered later as a bug: while this
# file is Resend-only, NO REAL CUSTOMER RECEIVES ANY EMAIL. Their receipt is redirected
# to the owner, labelled as undelivered. That is a deliberate holding position for a
# test-mode store, not a working receipt path, and it must be reversed before taking
# real money. `git log` on this file has the four-tier version to restore from; the
# fastest route back to real delivery is Mailjet plus BREVO_SENDER_EMAIL.
#
# See docs/gmail.md §8 for the Render/SMTP finding and docs/email.md for provider
# history.


def _send_via_resend(*, to_email: str, subject: str, html: str, text: str) -> None:
    response = requests.post(
        RESEND_SEND_URL,
        headers={"Authorization": f"Bearer {settings.resend_api_key}", "Content-Type": "application/json"},
        json={"from": SANDBOX_SENDER, "to": [to_email], "subject": subject, "html": html, "text": text},
        timeout=10,
    )
    response.raise_for_status()


async def _send(*, to_email: str, subject: str, html: str, text: str, context: str) -> None:
    """Shared send path for both email types below. Deliberately never raises
    (BACKEND.md §6.1) — a slow or failed send must not undo an already-committed order.

    `to_email` is the INTENDED recipient, which is not necessarily where this ends up:
    everything is redirected to settings.owner_notification_email while the store runs
    in this holding configuration. The distinction is kept in the signature rather than
    collapsed at the call site so the redirect stays visible and reversible in one place.
    """
    if not settings.resend_api_key:
        logger.error("Cannot send %s: RESEND_API_KEY is not set.", context)
        return

    # Resend's sandbox refuses any recipient other than the account's own address, so an
    # unset owner address doesn't degrade to "send to the buyer" — that would be a
    # guaranteed 403. Fail loudly instead of pretending there is a fallback.
    if not settings.owner_notification_email:
        logger.error(
            "Cannot send %s: OWNER_NOTIFICATION_EMAIL is not set, and the Resend sandbox "
            "can only deliver to the Resend account's own address.",
            context,
        )
        return

    recipient = settings.owner_notification_email

    # If this is someone else's mail being redirected, SAY SO in the message itself.
    # [FIXED 2026-08-11 — owner-reported] A real order once fell through to this tier and
    # the owner received two emails a minute apart: "Thank you for your purchase — your
    # order has been completed" and "You made a sale". The first is addressed to the
    # *buyer*, and arriving unlabelled in the owner's inbox it reads as though the owner
    # bought their own product, while giving no hint that the actual buyer was never
    # emailed. The redirect is the right behaviour; it just has to be honest about what
    # it is. That matters more now than it did then, because this is no longer a rare
    # last-resort path — it is every single receipt.
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
    owner and labelled undelivered — see the module note above. The "Order for" line is
    what makes the redirected copy legible, since the owner otherwise cannot tell whose
    receipt they are looking at."""
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
    """To the owner (settings.owner_notification_email): a sale just happened. Sent
    alongside the buyer's receipt, from the same webhook handler, after the same
    commit — one confirmed sale, two people who need to know. This one is genuinely
    addressed to the owner, so it arrives without the redirect banner."""
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
