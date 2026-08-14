"""week2_plan.md Phase 5 / W2-R8 / BACKEND.md §6.5.

Server-side events only for the ones the client cannot be trusted to report:
`purchase_completed`, `entitlement_delay`, `download_failed`, `refund_issued`.
Every other event of the nine (content_viewed, filter_applied, email_gate_shown,
email_captured, checkout_started) stays client-side — see
`frontend/src/lib/analytics.ts`.

No event carries anything beyond a distinct id (the user id, or `anonymous` for a
pre-signup send) — W2-R8's "no PII beyond a user id" applies here exactly as it does
to the client wrapper.

Module-level singleton, same shape as PostHog's own recommended server pattern —
configured once here rather than per call site. No-ops (rather than raising) when
`POSTHOG_API_KEY` isn't set, the same "never break the caller" contract
`email_service.py` follows, since these calls sit inside the webhook handler and a
purchase must never fail because analytics did.
"""
import logging

import posthog

from app.core.config import settings

logger = logging.getLogger(__name__)

posthog.api_key = settings.posthog_api_key
posthog.host = settings.posthog_host
# PostHog's own recommended no-op switch — set once here rather than guarding every
# call site with `if settings.posthog_api_key:`.
posthog.disabled = not settings.posthog_api_key


def _capture(event: str, *, distinct_id: str, properties: dict) -> None:
    # `posthog.disabled = True` still runs the SDK's own capture path and logs an
    # ERROR-level "api_key is empty" line on every call rather than cleanly no-op'ing
    # — noisy in test output and in prod logs alike. Guarding here, on the same
    # setting, skips the SDK entirely rather than relying on its internal behaviour.
    if not settings.posthog_api_key:
        return
    try:
        posthog.capture(event, distinct_id=distinct_id, properties=properties)
    except Exception:
        # Analytics must never take down the request it's instrumenting.
        logger.warning("PostHog capture failed for %s", event, exc_info=True)


def capture_purchase_completed(*, user_id: str, order_id: str, product_id: str, amount_cents: int, currency: str) -> None:
    _capture(
        "purchase_completed",
        distinct_id=user_id,
        properties={"order_id": order_id, "product_id": product_id, "amount": amount_cents, "currency": currency},
    )


def capture_entitlement_delay(*, user_id: str, order_id: str, seconds_waited: float) -> None:
    """`seconds_waited` is measured from the Stripe event's own `created` timestamp to
    the moment the entitlement was actually granted — genuine backend processing
    latency, not client redirect/network variance, which is the point of this being
    server-side rather than timed by `CheckoutSuccess.tsx`'s poll loop."""
    _capture(
        "entitlement_delay",
        distinct_id=user_id,
        properties={"order_id": order_id, "seconds_waited": round(seconds_waited, 2)},
    )


def capture_download_failed(*, user_id: str, resource_type: str, resource_id: str, reason: str) -> None:
    _capture(
        "download_failed",
        distinct_id=user_id,
        properties={"resource_type": resource_type, "resource_id": resource_id, "reason": reason[:200]},
    )


def capture_refund_issued(*, user_id: str, order_id: str) -> None:
    """`[NO CALL SITE YET]` No refund mechanism exists in the product as of Week 2 —
    refunds happen via the Stripe dashboard directly (docs/week2_plan.md Phase 5 /
    §11.3's refund policy names the pathway, but building an in-app refund action is
    not in this week's scope). Defined now so the emitter exists the moment one is
    built, rather than adding an eighth server-side call site under time pressure then."""
    _capture("refund_issued", distinct_id=user_id, properties={"order_id": order_id})
