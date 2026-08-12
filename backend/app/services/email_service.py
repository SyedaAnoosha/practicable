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
GMAIL_SMTP_HOST = "smtp.gmail.com"
GMAIL_SMTP_PORT = 587  # STARTTLS (docs/gmail.md); 465 would be implicit SSL instead

# Resend's sandbox sender — deliverable only to the one address the Resend account
# itself is registered under (docs/email.md), never a real arbitrary buyer. Now the
# last-resort tier, kept for when both Mailjet and Brevo are unreachable.
SANDBOX_SENDER = "Practicable <onboarding@resend.dev>"


def _send_via_gmail_smtp(*, to_email: str, subject: str, html: str, text: str) -> None:
    """Gmail SMTP with an App Password (docs/gmail.md). Blocking, like the Brevo path
    below — only ever called through asyncio.to_thread in _send().

    Two Gmail-specific facts worth knowing before changing anything here:
      - The From address is NOT ours to choose. Gmail rewrites it to the
        authenticated account on personal accounts, so setting a nice
        noreply@practicable.com.au here would be silently replaced. Only the display
        name survives, which is why settings.gmail_sender_name exists and there is no
        gmail_sender_email.
      - A first send from a new server IP can be blocked by Gmail's abuse checks even
        with correct credentials. The unblock is a one-time manual visit to
        accounts.google.com/DisplayUnlockCaptcha while signed in as that account —
        not a code change, and not something a retry here will resolve.
    """
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{settings.gmail_sender_name} <{settings.gmail_user}>"
    msg["To"] = to_email
    # Plain first, HTML second — clients render the last part they understand.
    msg.attach(MIMEText(text, "plain"))
    msg.attach(MIMEText(html, "html"))

    with smtplib.SMTP(GMAIL_SMTP_HOST, GMAIL_SMTP_PORT, timeout=15) as server:
        server.starttls(context=ssl.create_default_context())
        server.login(settings.gmail_user, settings.gmail_app_password)
        server.sendmail(settings.gmail_user, [to_email], msg.as_string())


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

    Four tiers, tried in order: Gmail SMTP (app password, reaches any real recipient,
    no provider review) -> Mailjet -> Brevo (dormant until its account activation
    clears) -> Resend (last resort; can only ever reach the one whitelisted sandbox
    address). Each tier only runs if the one before it is unconfigured or fails.

    resend_fallback_to: only consulted if execution reaches the Resend tier. Resend's
    sandbox sender cannot reach a real buyer at all, so send_receipt_email passes the
    owner's address here — a delivered email to check against, instead of a guaranteed
    logged failure. Doesn't apply to the first three tiers, which all reach the real
    to_email directly.
    """
    gmail_configured = bool(settings.gmail_user and settings.gmail_app_password)
    if gmail_configured:
        try:
            await asyncio.to_thread(_send_via_gmail_smtp, to_email=to_email, subject=subject, html=html, text=text)
            logger.info("Sent %s to %s via Gmail SMTP (tier 1).", context, to_email)
            return
        except (smtplib.SMTPException, OSError) as e:
            # OSError as well as SMTPException: a blocked/timed-out TCP connection to
            # smtp.gmail.com (common on hosts that firewall outbound 587) raises
            # socket.timeout/ConnectionRefusedError, which are NOT SMTPException — an
            # SMTPException-only except here would let those escape and crash the
            # webhook, which is precisely what this function promises never to do.
            logger.error("Gmail send failed for %s to %s, trying Mailjet: %s", context, to_email, e)
    else:
        # [ADDED 2026-08-12] This branch did not exist, and its absence is why a
        # production misconfiguration stayed invisible. Mailjet and Brevo both logged
        # "not configured"; Gmail alone skipped in silence, so a deploy missing
        # GMAIL_USER/GMAIL_APP_PASSWORD looked identical in the logs to one where
        # Gmail was tried and failed. Naming the missing variable matters more than
        # it looks: the local .env and the deployed environment are different places,
        # and the whole failure mode here was assuming the deployed one matched.
        missing = [
            name
            for name, value in (("GMAIL_USER", settings.gmail_user), ("GMAIL_APP_PASSWORD", settings.gmail_app_password))
            if not value
        ]
        logger.error("Gmail not configured for %s (missing %s), trying Mailjet.", context, ", ".join(missing))

    # NOTE the brevo_sender_email term: Mailjet borrows Brevo's sender identity as its
    # verified "From" address, so an otherwise-complete pair of Mailjet keys is still
    # skipped without it. That coupling is easy to miss when setting variables one at a
    # time in a hosting dashboard, hence the itemised log below rather than a bare
    # "not configured".
    mailjet_configured = bool(settings.mailjet_api_key and settings.mailjet_secret_key and settings.brevo_sender_email)
    if mailjet_configured:
        try:
            await asyncio.to_thread(_send_via_mailjet, to_email=to_email, subject=subject, html=html, text=text)
            logger.info("Sent %s to %s via Mailjet (tier 2).", context, to_email)
            return
        except requests.RequestException as e:
            logger.error("Mailjet send failed for %s to %s, trying Brevo: %s", context, to_email, e)
    else:
        missing = [
            name
            for name, value in (
                ("MAILJET_API_KEY", settings.mailjet_api_key),
                ("MAILJET_SECRET_KEY", settings.mailjet_secret_key),
                ("BREVO_SENDER_EMAIL", settings.brevo_sender_email),
            )
            if not value
        ]
        logger.error("Mailjet not configured for %s (missing %s), trying Brevo.", context, ", ".join(missing))

    brevo_configured = bool(settings.brevo_api_key and settings.brevo_smtp_login and settings.brevo_sender_email)
    if brevo_configured:
        try:
            await asyncio.to_thread(_send_via_brevo_smtp, to_email=to_email, subject=subject, html=html, text=text)
            logger.info("Sent %s to %s via Brevo SMTP (tier 3).", context, to_email)
            return
        except smtplib.SMTPException as e:
            logger.error("Brevo send failed for %s to %s, trying Resend: %s", context, to_email, e)
    else:
        logger.error("Brevo not configured for %s, trying Resend.", context)

    # Reaching this line is a production incident, not a fallback working as intended.
    # The Resend sandbox sender can only ever deliver to the single address the Resend
    # account is registered under, so for any real buyer at any other address this send
    # is already lost — the tier exists to salvage a copy for the owner, not to deliver.
    # Logged at ERROR with an explicit instruction because the symptom (owner receives
    # mail, everything "looks fine") actively disguises the failure.
    logger.error(
        "EMAIL DEGRADED: %s fell through every real transport to the Resend sandbox. "
        "Buyers at any address other than the Resend account's own will NOT receive mail. "
        "Set GMAIL_USER/GMAIL_APP_PASSWORD (or the Mailjet pair + BREVO_SENDER_EMAIL) in "
        "the DEPLOYED environment, not just the local .env.",
        context,
    )

    if not settings.resend_api_key:
        logger.error("Cannot send %s: Mailjet, Brevo, and RESEND_API_KEY are all unusable.", context)
        return

    resend_to = resend_fallback_to or to_email

    # If we are redirecting someone else's mail to the owner, SAY SO in the message.
    # [FIXED, 2026-08-11 — owner-reported] A real order fell through to this tier and
    # the owner received two emails a minute apart: "Thank you for your purchase —
    # your order has been completed" and "You made a sale". The first one is addressed
    # to the *buyer*, and arriving unlabelled in the owner's inbox it reads as though
    # the owner bought their own product, while giving no hint that the actual buyer
    # was never emailed. The redirect is still the right behaviour (a delivered email
    # beats a log line nobody reads), but it has to be honest about what it is.
    if resend_to != to_email:
        subject = f"[Not delivered to buyer] {subject}"
        notice_text = (
            f"This is a copy of an email that could NOT be delivered to {to_email}.\n"
            f"Every configured transport failed, so it was redirected to you instead.\n"
            f"The recipient has not received it — follow up manually.\n\n"
            f"{'-' * 60}\n\n"
        )
        text = notice_text + text
        html = (
            '<div style="border:2px solid #B3402E;padding:12px;margin-bottom:16px;font-family:sans-serif">'
            f"<strong>This email could not be delivered to {to_email}.</strong><br>"
            "Every configured transport failed, so it was redirected to you. "
            "The recipient has <strong>not</strong> received it — follow up manually."
            "</div>"
        ) + html

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
    # No configured owner address means there is no correct recipient for this — and
    # this email quotes the buyer's address and what they paid, so guessing one would
    # disclose a customer's purchase to whoever happened to be the fallback. Skip and
    # say so. The buyer's own receipt is a separate call and is unaffected: a missing
    # owner alert costs the owner a notification, not the customer their confirmation.
    if not settings.owner_notification_email:
        logger.error(
            "OWNER_NOTIFICATION_EMAIL is not set — skipping the sale notification for "
            "order %s. The buyer's receipt is unaffected. Set it in this environment to "
            "start receiving sale alerts.",
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
