"""Transactional email, over Mailjet.

Mailjet is the only transport (week3_plan.md W3-R1, restored 2026-08-15). It was
working over REST when it was removed by choice on 2026-08-12, not because it failed —
see docs/email.md and docs/gmail.md §9 for the full provider history. It reaches an
arbitrary real recipient directly, no domain and no sandbox redirect required, and it
survives Render's outbound-port-587 block that makes Gmail/Brevo SMTP structurally
impossible on this host (docs/gmail.md §8).

Every send is rendered from a Jinja2 template under app/emails/ with autoescaping on —
load-bearing for send_contact_notification_email, the one call in this module built
from wholly untrusted public-form input — and carries a plain-text alternative from the
matching `.txt.j2` sibling, per DESIGN.md §20.7.

Never raises (BACKEND.md §6.1): a failed send must not undo an already-committed order.
A failure is a logger.error and a `False` return, not an exception.

**Delivery is confirmed by querying Mailjet's API for the message's status, never by
the absence of an error line in the logs** — non-negotiable #12. `send_mailjet` returns
the Mailjet message id for exactly this reason; `get_message_status` queries it.
"""

import asyncio
import logging
from datetime import datetime, timezone

import requests
from jinja2 import Environment, PackageLoader, select_autoescape

from app.core.config import settings
from app.core.labels import REFUND_POSITION_TEXT

logger = logging.getLogger(__name__)

MAILJET_SEND_URL = "https://api.mailjet.com/v3.1/send"
MAILJET_MESSAGE_URL = "https://api.mailjet.com/v3/REST/message"

# select_autoescape's default extension matching is a plain `.endswith(".html")` check,
# which never matches a name like "welcome.html.j2" — passing the compound suffix here
# is what actually turns autoescaping on for these templates. ".txt.j2" is deliberately
# left out: escaping HTML entities into a plain-text email would corrupt it.
_env = Environment(
    loader=PackageLoader("app", "emails"),
    autoescape=select_autoescape(enabled_extensions=("html.j2",)),
    trim_blocks=True,
    lstrip_blocks=True,
)


def _format_version_stamp(version: str | None, last_reviewed_at: datetime | None) -> str | None:
    """`v1.2 · reviewed 17 Aug 2026` — the exact string `VersionStamp.tsx` renders on
    the product page, reproduced here so the receipt states the same fact rather than a
    second, drifting formatting of it. Absence rule: both unset returns None, which the
    template renders as nothing — never `v—` or an empty stamp line (week4_plan.md
    §20.1, the rule every unset-evidence-field surface in this app already follows)."""
    if not version and not last_reviewed_at:
        return None
    parts = []
    if version:
        parts.append(f"v{version}")
    if last_reviewed_at:
        parts.append(f"reviewed {last_reviewed_at.strftime('%d %b %Y').lstrip('0')}")
    return " · ".join(parts)


def _render(template_stem: str, **context) -> tuple[str, str]:
    """Renders a template's HTML body and its plain-text sibling from the same context.
    A template missing one half of the pair is a build-time error (TemplateNotFound),
    not a silent single-part send — DESIGN.md §20.7 requires both on every send."""
    html = _env.get_template(f"{template_stem}.html.j2").render(**context)
    text = _env.get_template(f"{template_stem}.txt.j2").render(**context)
    return html, text


def _send_via_mailjet(*, to_email: str, subject: str, html: str, text: str, reply_to: str | None = None) -> str:
    """Blocking call — only ever run via asyncio.to_thread from _send() below, so a slow
    Mailjet response cannot stall the event loop mid Stripe-webhook-handler.

    Returns Mailjet's MessageID for the accepted recipient, so a caller can later query
    `get_message_status` instead of trusting a 200 alone. Mailjet can return HTTP 200
    with a per-message failure inside the body (batch-send semantics, relevant even at
    our one-message scale), so the response body's own Status field is what's checked.
    """
    message: dict = {
        "From": {"Email": settings.mailjet_sender_email, "Name": settings.mailjet_sender_name},
        "To": [{"Email": to_email}],
        "Subject": subject,
        "TextPart": text,
        "HTMLPart": html,
    }
    if reply_to:
        message["ReplyTo"] = {"Email": reply_to}

    response = requests.post(
        MAILJET_SEND_URL,
        auth=(settings.mailjet_api_key, settings.mailjet_secret_key),
        json={"Messages": [message]},
        timeout=10,
    )
    response.raise_for_status()

    result = response.json().get("Messages", [{}])[0]
    if result.get("Status") != "success":
        raise requests.RequestException(f"Mailjet rejected the message: {result}")

    to_info = (result.get("To") or [{}])[0]
    return str(to_info.get("MessageID", ""))


async def get_message_status(message_id: str) -> dict:
    """Queries Mailjet's Message resource for a message's actual delivery state.

    Non-negotiable #12: 'an email that cannot be received is not an email.' Delivery is
    confirmed here, at the provider, not inferred from Render's logs staying quiet —
    handover.md §4 item 3 records that exact reasoning being wrong twice already.
    """
    if not message_id:
        return {}
    response = await asyncio.to_thread(
        requests.get,
        f"{MAILJET_MESSAGE_URL}/{message_id}",
        auth=(settings.mailjet_api_key, settings.mailjet_secret_key),
        timeout=10,
    )
    response.raise_for_status()
    data = response.json().get("Data", [])
    return data[0] if data else {}


async def _send(
    *, to_email: str, subject: str, html: str, text: str, context: str, reply_to: str | None = None
) -> bool:
    """Shared send path for every email function below. Returns whether Mailjet actually
    accepted the message, so a caller that records delivery state (e.g.
    contact_messages.notified) can tell "sent" from "swallowed"."""
    missing = [
        name
        for name, value in (
            ("MAILJET_API_KEY", settings.mailjet_api_key),
            ("MAILJET_SECRET_KEY", settings.mailjet_secret_key),
            ("MAILJET_SENDER_EMAIL", settings.mailjet_sender_email),
        )
        if not value
    ]
    if missing:
        logger.error("Cannot send %s to %s: missing %s.", context, to_email, ", ".join(missing))
        return False

    try:
        message_id = await asyncio.to_thread(
            _send_via_mailjet, to_email=to_email, subject=subject, html=html, text=text, reply_to=reply_to
        )
        logger.info("Sent %s to %s via Mailjet (message id %s).", context, to_email, message_id)
        return True
    except requests.RequestException as e:
        body = getattr(e.response, "text", "")
        logger.error("Mailjet send failed for %s to %s: %s %s", context, to_email, e, body)
        return False


def _format_amount(amount_cents: int, currency: str) -> str:
    return f"{currency} {amount_cents / 100:.2f}"


# ── The six buyer-facing emails (DESIGN.md §32.3 + the refund confirmation W3-R5 adds) ──


async def send_welcome_email(
    *, to_email: str, product_name: str, content_items: list[dict], primary_link: str
) -> bool:
    """To a first-time buyer: what they now have access to, a direct link, the author.
    Fired once, alongside send_access_granted_email, only on a buyer's first-ever order —
    see the webhook handler for the "is this their first order" check."""
    html, text = _render(
        "welcome", product_name=product_name, content_items=content_items, primary_link=primary_link
    )
    return await _send(to_email=to_email, subject="Welcome to Practicable", html=html, text=text, context="welcome email")


async def send_receipt_email(
    to_email: str,
    order_id: str,
    amount_cents: int,
    currency: str,
    product_names: list[str],
    primary_link: str = "",
    tax_line: str | None = None,
    order_date: datetime | None = None,
    invoice_number: str | None = None,
    product_versions: list[tuple[str | None, datetime | None]] | None = None,
) -> bool:
    """To the buyer: order reference, every product the order contains, amount, date,
    and the currently-drafted contracting entity (decision #27, closed — 'Effective
    Risk Management') — a document someone can submit to finance. The entity is not
    GST-registered and has no ABN, so no ABN field exists here or anywhere else in the
    app — not blank, not [OWNER], simply absent.

    `product_names` is a list, not a single string, since week3_plan.md W3-R11: one
    receipt for a whole cart checkout, itemising every product, not one receipt per
    product. A direct "Buy" (the pre-cart path) is the one-item-list case of the same
    call, not a second code path.

    `product_versions` is the parallel (version, last_reviewed_at) tuple per entry in
    `product_names` — week4_plan.md §20.9's "version renders under the line item."
    Optional and independently absent per product (a cart can mix versioned and
    unversioned products); omitted entirely (None) for a caller that predates this.

    W4-R2: invoice_number and seller_legal_name enable tax-invoice-quality receipts
    for business buyers."""
    amount_display = _format_amount(amount_cents, currency)
    # %-d (no leading zero) is glibc/macOS-only; %d is portable but zero-pads, so the
    # leading zero is stripped by hand instead — this runs on Windows in dev and Linux
    # on Render, and %-d raises ValueError on the former.
    display_date = (order_date or datetime.now(timezone.utc)).strftime("%d %B %Y").lstrip("0")
    versions = product_versions or [(None, None)] * len(product_names)
    product_lines = [
        {"name": name, "version_stamp": _format_version_stamp(v, r)}
        for name, (v, r) in zip(product_names, versions)
    ]
    html, text = _render(
        "receipt",
        order_id=order_id,
        product_names=product_names,
        product_lines=product_lines,
        amount_display=amount_display,
        order_date=display_date,
        tax_line=tax_line,
        primary_link=primary_link or settings.frontend_url.rstrip("/") + "/library",
        refund_position_text=REFUND_POSITION_TEXT,
        refunds_url=settings.frontend_url.rstrip("/") + "/legal/refunds",
        invoice_number=invoice_number,
        seller_legal_name=settings.seller_legal_name or None,
    )
    return await _send(
        to_email=to_email,
        subject="Your receipt from Practicable",
        html=html,
        text=text,
        context=f"receipt email for order {order_id}",
    )


async def send_access_granted_email(
    *, to_email: str, product_name: str, content_items: list[dict], primary_link: str
) -> bool:
    """To the buyer: what they bought, a direct link, how to sign in. Sent on every
    purchase (unlike welcome, which is first-purchase-only)."""
    html, text = _render(
        "access_granted",
        to_email=to_email,
        product_name=product_name,
        content_items=content_items,
        primary_link=primary_link,
    )
    return await _send(
        to_email=to_email, subject=f"You now have access to {product_name}", html=html, text=text, context="access granted email"
    )


async def send_product_update_email(
    *, to_email: str, product_name: str, primary_link: str, notify_product_updates: bool, summary: str = "",
) -> bool:
    """Phase 10 (§10E): the one genuinely optional email in this module — every other
    function here is transactional (a receipt, access, a password reset, a security
    or refund confirmation) and is never gated by a preference, per §10E step 3's own
    rule stated plainly on the Notifications page. This is what "Tell me when a
    template or course I own is revised" (the copy deck's own line) actually sends,
    and it is gated on the caller's own `notify_product_updates` flag — the owner of
    the email address, not a global setting, decides.

    Found 2026-08-22 (Phase 10 re-verification): the preference toggle existed and
    persisted correctly, but nothing in this file sent product-update mail at all, so
    the DoD's own required test ("a marketing send is suppressed when
    notify_marketing is false") had nothing to exercise. This is that sender. The
    trigger — deciding *when* a revision is significant enough to notify every
    entitled buyer — is separate, larger work this fix does not invent; this
    function is the correctly-gated send path a future trigger calls into, matching
    how every other send in this file is a narrow, single-purpose function the
    caller decides when to invoke.
    """
    if not notify_product_updates:
        return False
    html, text = _render(
        "product_update", product_name=product_name, primary_link=primary_link, summary=summary, to_email=to_email,
    )
    return await _send(
        to_email=to_email, subject=f"{product_name} has been updated", html=html, text=text,
        context="product update email",
    )


async def send_password_reset_email(*, to_email: str, reset_url: str, expires_in: str = "1 hour") -> bool:
    """One link, its expiry stated, and what to do if this wasn't requested."""
    html, text = _render("password_reset", reset_url=reset_url, expires_in=expires_in)
    return await _send(
        to_email=to_email, subject="Reset your Practicable password", html=html, text=text, context="password reset email"
    )


async def send_free_entry_point_email(*, to_email: str, primary_link: str) -> bool:
    """The durable link a /leads capture earned, plus one honest sentence about what
    else exists — sent once per (email, source), from the leads capture path."""
    html, text = _render("free_entry_point", primary_link=primary_link)
    return await _send(
        to_email=to_email, subject="Your link to Practicable", html=html, text=text, context="free entry point email"
    )


async def send_refund_confirmation_email(
    *,
    to_email: str,
    order_id: str,
    amount_cents: int,
    currency: str,
    removed_items: list[str],
    refund_eta: str = "5–10 business days",
) -> bool:
    """The original order reference, the amount refunded, what access was removed, and
    when the money should land — wired from the refund endpoint in Phase 4 (W3-R5)."""
    amount_display = _format_amount(amount_cents, currency)
    html, text = _render(
        "refund_confirmation",
        order_id=order_id,
        amount_display=amount_display,
        removed_items=removed_items,
        refund_eta=refund_eta,
    )
    return await _send(
        to_email=to_email,
        subject=f"Your refund for order {order_id}",
        html=html,
        text=text,
        context=f"refund confirmation for order {order_id}",
    )


# ── Internal, owner-facing emails ──


async def send_sale_notification_email(
    order_id: str,
    buyer_email: str,
    amount_cents: int,
    currency: str,
    product_name: str,
) -> bool:
    """To the owner: a sale just happened. Sent alongside the buyer's receipt, from the
    same webhook handler, after the same commit."""
    if not settings.owner_notification_email:
        logger.error(
            "OWNER_NOTIFICATION_EMAIL is not set — skipping the sale notification for "
            "order %s. The buyer's receipt is unaffected. Set it in this environment to "
            "start receiving sale alerts.",
            order_id,
        )
        return False

    amount_display = _format_amount(amount_cents, currency)
    html, text = _render(
        "sale_notification",
        order_id=order_id,
        buyer_email=buyer_email,
        product_name=product_name,
        amount_display=amount_display,
    )
    return await _send(
        to_email=settings.owner_notification_email,
        subject=f"New sale: {product_name}",
        html=html,
        text=text,
        context=f"sale notification for order {order_id}",
    )


async def send_contact_notification_email(
    *,
    name: str,
    from_email: str,
    enquiry_type: str | None,
    message: str,
) -> bool:
    """To the owner: someone used the public contact form. Returns whether it was sent,
    so the caller can record that on the stored row (contact_messages.notified).

    Every interpolated value here is wholly untrusted public input — a stranger with no
    account chooses the name and the entire message body — so this relies on the Jinja
    environment's autoescaping (see `_env` above) rather than a hand-rolled escape, which
    is exactly the class of bug hand-rolling invites (one call site forgets one field).
    """
    if not settings.owner_notification_email:
        logger.error(
            "OWNER_NOTIFICATION_EMAIL is not set — a contact message from %s could not be "
            "notified. It is still stored in contact_messages.",
            from_email,
        )
        return False

    html, text = _render(
        "contact_notification", name=name, from_email=from_email, enquiry_type=enquiry_type, message=message
    )
    return await _send(
        to_email=settings.owner_notification_email,
        subject=f"Contact form: {name}",
        html=html,
        text=text,
        context=f"contact notification from {from_email}",
        reply_to=from_email,
    )


# ── Security alert (Phase 10A/10B: identity and password changes) ──


async def send_security_alert_email(
    *,
    to_email: str,
    action: str,
    details: str | None = None,
) -> bool:
    """Sent on every identity-sensitive change: name, email, password.
    The buyer must know their account changed, whether they were the one who changed it.
    No ABN (non-negotiable). The base template footer carries the entity line."""
    html, text = _render("security_alert", action=action, details=details)
    return await _send(
        to_email=to_email,
        subject="Your account details changed",
        html=html,
        text=text,
        context=f"security alert ({action})",
    )


# ── Account closure (Phase 10F) ──


async def send_account_closure_email(*, to_email: str) -> bool:
    """Confirmation that the account was deactivated, with the route to restore it."""
    html, text = _render("security_alert", action="Account closed", details="Contact us any time to restore your account.")
    return await _send(
        to_email=to_email,
        subject="Your Practicable account has been closed",
        html=html, text=text,
        context="account closure confirmation",
    )


# ── Certificate email (W5-R2) ───────────────────────────────────────────────


async def send_certificate_issued_email(
    *,
    to_email: str,
    course_title: str,
    download_url: str,
) -> bool:
    """To the learner: your certificate is ready, with a link to download it.
    Links to the certificate rather than attaching it: attachments hurt
    deliverability, and a link works from any device."""
    html, text = _render(
        "certificate_issued",
        course_title=course_title,
        download_url=download_url,
    )
    return await _send(
        to_email=to_email,
        subject=f"Your certificate for {course_title}",
        html=html,
        text=text,
        context=f"certificate issued for {course_title}",
    )


# ── Notification email (#6: Template version updates) ────────────────────────


async def send_notification_email(
    *,
    to_email: str,
    subject: str,
    message: str,
    action_url: str | None = None,
) -> bool:
    """To a user: a notification about content updates or other events.
    Generic notification sender for the notification system (#6)."""
    html, text = _render(
        "notification",
        subject=subject,
        message=message,
        action_url=action_url,
    )
    return await _send(
        to_email=to_email,
        subject=subject,
        html=html,
        text=text,
        context=f"notification email to {to_email}",
    )
