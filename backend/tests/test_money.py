"""The tests that guard money — week4_plan.md W4-R9, handover.md §4 item 5: "checkout
and webhook handling specifically are still untested by fixture — the highest-
consequence remaining gap, since that's the code a silent regression would actually
cost money on."

The webhook's idempotency, cart-grants-N-entitlements, and charge.refunded paths are
already covered end-to-end in tests/gating/test_gating.py (test_webhook_replayed_*,
test_webhook_cart_checkout_*, test_webhook_charge_refunded_idempotent_three_times).
This file covers what that suite does not: the checkout SESSION endpoint itself
(POST /checkout/session — the 409-before-Stripe guard in particular) and the two
webhook failure paths — a bad signature, and metadata naming a product that no longer
exists — that never had a fixture at all.

Phase 8 (8B-5): Added dollars-to-cents conversion tests to prevent the most expensive
typo in the codebase (off by 100 = off by a factor of 100 in price).
"""
import uuid
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import select

from app.db.models import Entitlement, Order, Product, WebhookEvent


# ---------------------------------------------------------------------------
# Dollars-to-cents conversion (Phase 8 8B-5)
# ---------------------------------------------------------------------------

def dollars_to_cents(dollars: float) -> int:
    """Convert dollars to cents for Stripe pricing.

    Phase 8 (8B-5): The field takes dollars and stores cents, with the conversion
    in exactly one place. A price editor that is off by 100 is the most expensive
    typo available in this codebase.

    Args:
        dollars: Price in dollars (e.g., 99.00)

    Returns:
        Price in cents (e.g., 9900)

    Raises:
        ValueError: If dollars is negative
    """
    if dollars < 0:
        raise ValueError("Price cannot be negative")
    return int(round(dollars * 100))


def test_dollars_to_cents_basic():
    """Basic conversion: 99.00 dollars = 9900 cents."""
    assert dollars_to_cents(99.00) == 9900


def test_dollars_to_cents_zero():
    """Zero price: 0.00 dollars = 0 cents."""
    assert dollars_to_cents(0.00) == 0


def test_dollars_to_cents_single_digit():
    """Single dollar: 1.00 dollars = 100 cents."""
    assert dollars_to_cents(1.00) == 100


def test_dollars_to_cents_cents():
    """Cents: 0.99 dollars = 99 cents."""
    assert dollars_to_cents(0.99) == 99


def test_dollars_to_cents_fractional_rounds():
    """Fractional cents round to nearest cent: 99.995 = 10000 cents."""
    assert dollars_to_cents(99.995) == 10000


def test_dollars_to_cents_large_value():
    """Large value: 1000.00 dollars = 100000 cents."""
    assert dollars_to_cents(1000.00) == 100000


def test_dollars_to_cents_three_decimals():
    """Three decimal places: 99.999 rounds to 10000 cents."""
    assert dollars_to_cents(99.999) == 10000


def test_dollars_to_cents_negative_refused():
    """Negative prices are refused."""
    with pytest.raises(ValueError, match="cannot be negative"):
        dollars_to_cents(-10.00)


# ---------------------------------------------------------------------------
# POST /checkout/session
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_single_product_checkout_reaches_stripe(member_client, content_graph):
    """The ordinary case: one product, not already owned, Stripe is asked to create a
    session and its url is returned untouched."""
    g = content_graph
    fake_session = MagicMock()
    fake_session.url = "https://checkout.stripe.com/test-session-url"

    with patch(
        "app.api.v1.commerce.checkout.create_checkout_session", return_value=fake_session
    ) as create_mock:
        resp = await member_client.post(
            "/checkout/session", json={"product_ids": [str(g.template_product.id)]}
        )

    assert resp.status_code == 200
    assert resp.json()["checkout_url"] == fake_session.url
    create_mock.assert_called_once()
    assert create_mock.call_args.kwargs["product_ids"] == [str(g.template_product.id)]


@pytest.mark.asyncio
async def test_cart_checkout_passes_every_price_id_in_one_session(member_client, content_graph):
    """An N-item cart is one Stripe session with N line items, not N sessions
    (week3_plan.md W3-R11) — asserted at the boundary this endpoint owns."""
    g = content_graph
    fake_session = MagicMock()
    fake_session.url = "https://checkout.stripe.com/cart-session-url"
    product_ids = [str(g.template_product.id), str(g.lesson_product.id)]

    with patch(
        "app.api.v1.commerce.checkout.create_checkout_session", return_value=fake_session
    ) as create_mock:
        resp = await member_client.post("/checkout/session", json={"product_ids": product_ids})

    assert resp.status_code == 200
    called_price_ids = create_mock.call_args.kwargs["price_ids"]
    assert len(called_price_ids) == 2
    assert set(create_mock.call_args.kwargs["product_ids"]) == set(product_ids)


@pytest.mark.asyncio
async def test_already_owned_product_returns_409_before_stripe(
    entitled_client, entitled_user, content_graph, grant
):
    """week3_plan.md Phase 3 step 5: refuse before payment, not after it. A buyer who
    already holds every piece of content a product grants must never reach Stripe for
    it — a refund is strictly more expensive than a 409."""
    g = content_graph
    await grant(entitled_user, g.template_product)

    with patch("app.api.v1.commerce.checkout.create_checkout_session") as create_mock:
        resp = await entitled_client.post(
            "/checkout/session", json={"product_ids": [str(g.template_product.id)]}
        )

    assert resp.status_code == 409
    assert resp.json()["detail"]["error"]["code"] == "already_owned"
    create_mock.assert_not_called()


@pytest.mark.asyncio
async def test_already_owned_product_in_cart_still_blocks_the_whole_cart(
    entitled_client, entitled_user, content_graph, grant
):
    """One already-owned item in an otherwise-new cart still refuses before Stripe —
    the buyer re-adds the wanted items rather than being silently overcharged for
    something they hold, or silently short-changed a line they didn't ask to drop."""
    g = content_graph
    await grant(entitled_user, g.template_product)

    with patch("app.api.v1.commerce.checkout.create_checkout_session") as create_mock:
        resp = await entitled_client.post(
            "/checkout/session",
            json={"product_ids": [str(g.template_product.id), str(g.lesson_product.id)]},
        )

    assert resp.status_code == 409
    create_mock.assert_not_called()


@pytest.mark.asyncio
async def test_duplicate_product_in_cart_rejected(member_client, content_graph):
    g = content_graph
    resp = await member_client.post(
        "/checkout/session",
        json={"product_ids": [str(g.template_product.id), str(g.template_product.id)]},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_unpublished_product_404s_before_stripe(member_client, content_graph, db_session):
    g = content_graph
    g.template_product.published = False
    await db_session.flush()

    with patch("app.api.v1.commerce.checkout.create_checkout_session") as create_mock:
        resp = await member_client.post(
            "/checkout/session", json={"product_ids": [str(g.template_product.id)]}
        )

    assert resp.status_code == 404
    create_mock.assert_not_called()


# ---------------------------------------------------------------------------
# POST /webhooks/stripe — the two failure paths with no prior fixture
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_webhook_bad_signature_is_rejected(anon_client, db_session):
    """A forged or corrupted webhook must never reach the handler's business logic —
    verified by letting the REAL signature verifier run (no patch on
    construct_webhook_event) against a signature Stripe never produced."""
    resp = await anon_client.post(
        "/webhooks/stripe",
        content=b'{"id": "evt_fake", "type": "checkout.session.completed"}',
        headers={"stripe-signature": "t=1,v1=not-a-real-signature"},
    )
    assert resp.status_code == 400

    # And nothing was recorded as having been processed — a rejected signature must
    # leave no trace that could later be mistaken for a handled event.
    events = (
        await db_session.execute(select(WebhookEvent).where(WebhookEvent.stripe_event_id == "evt_fake"))
    ).scalars().all()
    assert events == []


@pytest.mark.asyncio
async def test_webhook_unknown_product_fails_loudly(anon_client, member_user, db_session):
    """metadata.product_ids naming a product that doesn't exist (a stale id, a bad
    write, a tampered session) must not silently return 200 with nothing granted — it
    must fail loudly enough to alert someone, and it must not leave a half-built order
    behind. handover.md's own standard: a silent no-op here is worse than a crash."""
    member_user_id = member_user.id
    bogus_product_id = str(uuid.uuid4())

    event_id = f"evt_test_{uuid.uuid4().hex[:16]}"
    fake_event = {
        "id": event_id,
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": f"cs_test_{uuid.uuid4().hex[:16]}",
                "payment_intent": f"pi_test_{uuid.uuid4().hex[:16]}",
                "amount_total": 4900,
                "currency": "aud",
                "metadata": {"user_id": str(member_user_id), "product_ids": bogus_product_id},
            }
        },
    }

    # The test transport re-raises unhandled application exceptions (httpx's
    # ASGITransport default, raise_app_exceptions=True) rather than converting them to
    # a 500 response — this IS "fails loudly": a real deployment's ServerErrorMiddleware
    # converts the same exception to an HTTP 500 for Stripe, which is what triggers a
    # retry, rather than a silent 200 with nothing granted.
    with patch("app.api.v1.commerce.webhooks.construct_webhook_event", return_value=fake_event):
        with pytest.raises(ValueError, match="unknown product id"):
            await anon_client.post(
                "/webhooks/stripe", content=b"{}", headers={"stripe-signature": "test-sig"}
            )

    # Nothing was granted for the bogus id.
    entitlements = (
        await db_session.execute(select(Entitlement).where(Entitlement.user_id == member_user_id))
    ).scalars().all()
    assert all(str(e.product_id) != bogus_product_id for e in entitlements)

    # And the failure left a real trace — the same webhook_event row the idempotency
    # guard inserted now carries the error, rather than the PendingRollbackError this
    # test caught before the order_service.py fix, which lost that row entirely.
    event_row = (
        await db_session.execute(select(WebhookEvent).where(WebhookEvent.stripe_event_id == event_id))
    ).scalar_one()
    assert event_row.error_message and "unknown product" in event_row.error_message


# ---------------------------------------------------------------------------
# POST /admin/products/{id}/price (Phase 8 8B-9)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_price_change_refuses_placeholder(admin_client, content_graph, db_session):
    """Price change refuses a product with placeholder stripe_price_id."""
    g = content_graph
    g.template_product.stripe_price_id = "placeholder_update_in_stripe"
    await db_session.flush()

    resp = await admin_client.post(
        f"/admin/products/{g.template_product.id}/price",
        json={"price_amount": 4900, "currency": "AUD", "reason": "test"},
    )
    assert resp.status_code == 409
    assert resp.json()["detail"]["error"]["code"] == "placeholder_price"


@pytest.mark.asyncio
async def test_price_change_refuses_currency_on_published(admin_client, content_graph, db_session):
    """Currency change on a published product is refused (8B-3)."""
    g = content_graph
    g.template_product.published = True
    await db_session.flush()

    resp = await admin_client.post(
        f"/admin/products/{g.template_product.id}/price",
        json={"price_amount": 4900, "currency": "USD", "reason": "test"},
    )
    assert resp.status_code == 409
    assert resp.json()["detail"]["error"]["code"] == "currency_change_on_published"
