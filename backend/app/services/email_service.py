import asyncio
import logging
import smtplib
import ssl
from email.mime.text import MIMEText

import requests

from app.core.config import settings

logger = logging.getLogger(__name__)

BREVO_SMTP_HOST = "smtp-relay.brevo.com"
BREVO_SMTP_PORT = 587
RESEND_SEND_URL = "https://api.resend.com/emails"

# Resend's sandbox sender — deliverable only to the one address the Resend account
# itself is registered under (docs/email.md), never a real arbitrary buyer. Kept as a
# fallback, not the primary path: Brevo is account-wide blocked ("Your SMTP account is
# not yet activated", confirmed live against the real relay) until its support ticket
# clears, and without this fallback even the owner notification — which Resend *can*
# already reach — would go dark for however long that takes. Drop this fallback once
# Brevo activates; at that point Brevo will just start succeeding on the first try and
# this branch stops being exercised on its own, no code change required.
SANDBOX_SENDER = "Practicable <onboarding@resend.dev>"


def _send_via_brevo_smtp(*, to_email: str, subject: str, html: str) -> None:
    """The actual blocking SMTP conversation — smtplib has no async variant, so this
    only ever runs off the event loop via asyncio.to_thread in _send() below. Without
    that, a slow relay handshake would stall the webhook handler mid-request, and
    Stripe expects a fast 2xx back (BACKEND.md §6.1)."""
    msg = MIMEText(html, "html")
    msg["Subject"] = subject
    msg["From"] = f"{settings.brevo_sender_name} <{settings.brevo_sender_email}>"
    msg["To"] = to_email

    with smtplib.SMTP(BREVO_SMTP_HOST, BREVO_SMTP_PORT, timeout=15) as server:
        server.starttls(context=ssl.create_default_context())
        server.login(settings.brevo_smtp_login, settings.brevo_api_key)
        server.sendmail(settings.brevo_sender_email, [to_email], msg.as_string())


def _send_via_resend(*, to_email: str, subject: str, html: str) -> None:
    response = requests.post(
        RESEND_SEND_URL,
        headers={"Authorization": f"Bearer {settings.resend_api_key}", "Content-Type": "application/json"},
        json={"from": SANDBOX_SENDER, "to": [to_email], "subject": subject, "html": html},
        timeout=10,
    )
    response.raise_for_status()


async def _send(
    *,
    to_email: str,
    subject: str,
    html: str,
    context: str,
    resend_fallback_to: str | None = None,
) -> None:
    """Shared send path for both email types below. Deliberately never raises
    (BACKEND.md §6.1) — a slow/failed send must not undo an already-committed order;
    logger.error, not print(), is what makes a failure here visible instead of the
    silent-for-every-order bug this integration had the first time it was built.

    Brevo first, Resend as a fallback while Brevo's account activation is pending —
    see the SANDBOX_SENDER comment above for why this is temporary, not a permanent
    two-provider design.

    resend_fallback_to: only used if the Resend fallback actually fires. Resend's
    sandbox sender can only reach the one address the Resend account is registered
    under, so sending a real buyer's receipt there would always be a guaranteed 403 —
    send_receipt_email passes the owner's address here instead, so there's a real
    delivered email to check the template against rather than a logged failure.
    Once Brevo activates, Brevo succeeds on the first try and this is never used."""
    brevo_configured = bool(settings.brevo_api_key and settings.brevo_smtp_login and settings.brevo_sender_email)
    if brevo_configured:
        try:
            await asyncio.to_thread(_send_via_brevo_smtp, to_email=to_email, subject=subject, html=html)
            return
        except smtplib.SMTPException as e:
            logger.error("Brevo send failed for %s to %s, falling back to Resend: %s", context, to_email, e)
    else:
        logger.error("Brevo not fully configured for %s, falling back to Resend.", context)

    if not settings.resend_api_key:
        logger.error("Cannot send %s: neither Brevo nor RESEND_API_KEY is usable.", context)
        return

    resend_to = resend_fallback_to or to_email
    try:
        await asyncio.to_thread(_send_via_resend, to_email=resend_to, subject=subject, html=html)
    except requests.RequestException as e:
        body = getattr(e.response, "text", "")
        logger.error("Resend fallback also failed for %s to %s: %s %s", context, resend_to, e, body)


async def send_receipt_email(
    to_email: str,
    order_id: str,
    amount_cents: int,
    currency: str,
    product_name: str,
):
    """To the buyer: confirms their purchase went through. The "Order for" line below
    is redundant when this actually reaches the buyer (it's their own email, quoted
    back to them — normal on a real receipt) but load-bearing when the Resend
    fallback redirects this to the owner's inbox instead: without it, a receipt
    addressed to no one in particular in the owner's own inbox would be confusing."""
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
        context=f"receipt email for order {order_id}",
        resend_fallback_to=settings.owner_notification_email,
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
