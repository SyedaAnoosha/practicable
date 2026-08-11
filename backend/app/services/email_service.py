import asyncio
import logging
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import requests

from app.core.config import settings

logger = logging.getLogger(__name__)

MAILJET_SEND_URL = "https://api.mailjet.com/v3.1/send"
BREVO_SMTP_HOST = "smtp-relay.brevo.com"
BREVO_SMTP_PORT = 587
RESEND_SEND_URL = "https://api.resend.com/emails"

# Resend's sandbox sender — deliverable only to the one address the Resend account
# itself is registered under (docs/email.md), never a real arbitrary buyer. Now the
# last-resort tier, kept for when both Mailjet and Brevo are unreachable.
SANDBOX_SENDER = "Practicable <onboarding@resend.dev>"


def _send_via_mailjet(*, to_email: str, subject: str, html: str, text: str) -> None:
    response = requests.post(
        MAILJET_SEND_URL,
        auth=(settings.mailjet_api_key, settings.mailjet_secret_key),
        json={
            "Messages": [
                {
                    "From": {"Email": settings.brevo_sender_email, "Name": settings.brevo_sender_name},
                    "To": [{"Email": to_email}],
                    "Subject": subject,
                    "TextPart": text,
                    "HTMLPart": html,
                }
            ]
        },
        timeout=10,
    )
    response.raise_for_status()
    # Mailjet can return HTTP 200 with a per-message failure inside the body (batch
    # send semantics — relevant even at our one-message-one-recipient scale), so an
    # OK status code alone isn't proof of a successful send.
    message = response.json().get("Messages", [{}])[0]
    if message.get("Status") != "success":
        raise requests.RequestException(f"Mailjet rejected the message: {message}")


def _send_via_brevo_smtp(*, to_email: str, subject: str, html: str, text: str) -> None:
    """The actual blocking SMTP conversation — smtplib has no async variant, so this
    only ever runs off the event loop via asyncio.to_thread in _send() below. Without
    that, a slow relay handshake would stall the webhook handler mid-request, and
    Stripe expects a fast 2xx back (BACKEND.md §6.1)."""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{settings.brevo_sender_name} <{settings.brevo_sender_email}>"
    msg["To"] = to_email
    # Plain-text part first, HTML second — email clients render the last part that
    # they understand, so this order is what makes HTML the one actually shown while
    # still giving a text alternative to filters/clients that want one.
    msg.attach(MIMEText(text, "plain"))
    msg.attach(MIMEText(html, "html"))

    with smtplib.SMTP(BREVO_SMTP_HOST, BREVO_SMTP_PORT, timeout=15) as server:
        server.starttls(context=ssl.create_default_context())
        server.login(settings.brevo_smtp_login, settings.brevo_api_key)
        server.sendmail(settings.brevo_sender_email, [to_email], msg.as_string())


def _send_via_resend(*, to_email: str, subject: str, html: str, text: str) -> None:
    response = requests.post(
        RESEND_SEND_URL,
        headers={"Authorization": f"Bearer {settings.resend_api_key}", "Content-Type": "application/json"},
        json={"from": SANDBOX_SENDER, "to": [to_email], "subject": subject, "html": html, "text": text},
        timeout=10,
    )
    response.raise_for_status()


async def _send(
    *,
    to_email: str,
    subject: str,
    html: str,
    text: str,
    context: str,
    resend_fallback_to: str | None = None,
) -> None:
    """Shared send path for both email types below. Deliberately never raises
    (BACKEND.md §6.1) — a slow/failed send must not undo an already-committed order;
    logger.error, not print(), is what makes a failure here visible instead of the
    silent-for-every-order bug this integration had the first time it was built.

    Three tiers, tried in order: Mailjet (confirmed live, reaches any real recipient
    today) -> Brevo (dormant until its account activation clears) -> Resend (dormant,
    can only ever reach the one whitelisted sandbox address). Each tier only runs if
    the one before it is unconfigured or fails, so this only ever exercises Mailjet
    in the common case — the other two are redundancy, not the active path.

    resend_fallback_to: only consulted if execution reaches the Resend tier. Resend's
    sandbox sender can't reach a real buyer at all, so send_receipt_email passes the
    owner's address here — a delivered email to check against, instead of a
    guaranteed logged failure. Doesn't apply to Mailjet/Brevo, which can both reach
    the real to_email directly.
    """
    mailjet_configured = bool(settings.mailjet_api_key and settings.mailjet_secret_key and settings.brevo_sender_email)
    if mailjet_configured:
        try:
            await asyncio.to_thread(_send_via_mailjet, to_email=to_email, subject=subject, html=html, text=text)
            return
        except requests.RequestException as e:
            logger.error("Mailjet send failed for %s to %s, trying Brevo: %s", context, to_email, e)
    else:
        logger.error("Mailjet not configured for %s, trying Brevo.", context)

    brevo_configured = bool(settings.brevo_api_key and settings.brevo_smtp_login and settings.brevo_sender_email)
    if brevo_configured:
        try:
            await asyncio.to_thread(_send_via_brevo_smtp, to_email=to_email, subject=subject, html=html, text=text)
            return
        except smtplib.SMTPException as e:
            logger.error("Brevo send failed for %s to %s, trying Resend: %s", context, to_email, e)
    else:
        logger.error("Brevo not configured for %s, trying Resend.", context)

    if not settings.resend_api_key:
        logger.error("Cannot send %s: Mailjet, Brevo, and RESEND_API_KEY are all unusable.", context)
        return

    resend_to = resend_fallback_to or to_email
    try:
        await asyncio.to_thread(_send_via_resend, to_email=resend_to, subject=subject, html=html, text=text)
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
    is redundant when this reaches the buyer directly (the common case now, via
    Mailjet) but load-bearing if execution ever falls all the way to the Resend
    fallback, which redirects this to the owner's inbox instead."""
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
        text=(
            f"You made a sale\n\n"
            f"Order #{order_id} was just completed.\n"
            f"Buyer: {buyer_email}\n"
            f"Amount: {amount_display}\n"
            f"Product: {product_name}"
        ),
        context=f"sale notification for order {order_id}",
    )
