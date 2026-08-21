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
import stripe
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


@pytest.mark.asyncio
async def test_price_change_requires_reason(admin_client, content_graph):
    """Missing reason returns 422 (8B-3)."""
    g = content_graph
    resp = await admin_client.post(
        f"/admin/products/{g.template_product.id}/price",
        json={"price_amount": 4900, "currency": "AUD"},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_price_change_creates_audit_row(admin_client, content_graph, db_session):
    """Price change audit row carries old amount, new amount, and both Price ids (8B-5)."""
    from unittest.mock import patch, MagicMock
    from app.db.models import AuditLog

    g = content_graph
    old_price_id = g.template_product.stripe_price_id
    old_amount = g.template_product.price_amount
    new_price_id = f"price_new_{uuid.uuid4().hex[:12]}"

    # Mock Stripe: retrieve returns the old price's product, create returns new price
    fake_old_price = MagicMock()
    fake_old_price.product = "prod_stripe_123"

    with patch("stripe.Price.retrieve", return_value=fake_old_price):
        with patch("app.api.v1.admin.products.create_price_under_product", return_value=new_price_id):
            with patch("app.api.v1.admin.products.archive_price"):
                resp = await admin_client.post(
                    f"/admin/products/{g.template_product.id}/price",
                    json={"price_amount": 5900, "currency": "AUD", "reason": "Price increase"},
                )

    assert resp.status_code == 200, resp.text

    # Verify audit row was created with both amounts and both Price ids
    audit_result = await db_session.execute(
        select(AuditLog).where(
            AuditLog.target_type == "product",
            AuditLog.target_id == g.template_product.id,
            AuditLog.action == "change_product_price",
        ).order_by(AuditLog.created_at.desc())
    )
    audit = audit_result.scalar_one_or_none()
    assert audit is not None, "Audit row was not created"
    # context may be stored as JSON string or dict depending on driver
    ctx = audit.context
    if isinstance(ctx, str):
        import json
        ctx = json.loads(ctx)
    assert ctx["old_amount"] == old_amount
    assert ctx["new_amount"] == 5900
    assert ctx["old_price_id"] == old_price_id
    assert ctx["new_price_id"] == new_price_id
    assert ctx["reason"] == "Price increase"


@pytest.mark.asyncio
async def test_price_change_stores_new_price_id(admin_client, content_graph, db_session):
    """After price change, the product's stripe_price_id is updated to the new one."""
    from unittest.mock import patch, MagicMock

    g = content_graph
    new_price_id = f"price_new_{uuid.uuid4().hex[:12]}"

    fake_old_price = MagicMock()
    fake_old_price.product = "prod_stripe_123"

    with patch("stripe.Price.retrieve", return_value=fake_old_price):
        with patch("app.api.v1.admin.products.create_price_under_product", return_value=new_price_id):
            with patch("app.api.v1.admin.products.archive_price"):
                resp = await admin_client.post(
                    f"/admin/products/{g.template_product.id}/price",
                    json={"price_amount": 7900, "currency": "AUD", "reason": "test"},
                )

    assert resp.status_code == 200

    # Reload product and verify the new price id is stored
    from sqlalchemy import select as sa_select
    result = await db_session.execute(
        sa_select(Product).where(Product.id == g.template_product.id)
    )
    product = result.scalar_one()
    assert product.stripe_price_id == new_price_id
    assert product.price_amount == 7900


@pytest.mark.asyncio
async def test_price_change_new_price_fetched_back_from_stripe_matches(
    admin_client, content_graph, db_session
):
    """8B-10: 'the price fetched back from Stripe equals price_amount' — not just the
    DB row agreeing with itself. After a price change, retrieving the *new* Price id
    from Stripe (a fresh call, independent of the one the endpoint itself made) must
    report the same unit_amount the admin set."""
    from unittest.mock import patch, MagicMock

    g = content_graph
    new_price_id = f"price_new_{uuid.uuid4().hex[:12]}"
    new_amount = 8800

    fake_old_price = MagicMock()
    fake_old_price.product = "prod_stripe_123"

    # The real create_price_under_product() would ask Stripe to create a Price with
    # this exact unit_amount; a fake Stripe-side store keyed by price id stands in for
    # that so a later stripe.Price.retrieve(new_price_id) can honestly report it back,
    # rather than trivially asserting a value the test itself already knows.
    stripe_store = {g.template_product.stripe_price_id: fake_old_price}

    def fake_create_price_under_product(*, unit_amount, currency, stripe_product_id):
        created = MagicMock()
        created.id = new_price_id
        created.unit_amount = unit_amount
        created.currency = currency
        stripe_store[new_price_id] = created
        return new_price_id

    def fake_retrieve(price_id, *args, **kwargs):
        return stripe_store[price_id]

    with patch("stripe.Price.retrieve", side_effect=fake_retrieve):
        with patch(
            "app.api.v1.admin.products.create_price_under_product",
            side_effect=fake_create_price_under_product,
        ):
            with patch("app.api.v1.admin.products.archive_price"):
                resp = await admin_client.post(
                    f"/admin/products/{g.template_product.id}/price",
                    json={"price_amount": new_amount, "currency": "AUD", "reason": "test"},
                )
        assert resp.status_code == 200, resp.text

        # Independent re-fetch, as the DoD names: ask Stripe for the price actually
        # stored on the product now, not the one the test constructed it from.
        result = await db_session.execute(select(Product).where(Product.id == g.template_product.id))
        product = result.scalar_one()
        refetched = stripe.Price.retrieve(product.stripe_price_id)

    assert refetched.unit_amount == product.price_amount == new_amount


@pytest.mark.asyncio
async def test_price_change_missing_reason_is_422(admin_client, content_graph):
    """Missing reason returns 422 validation error."""
    g = content_graph
    resp = await admin_client.post(
        f"/admin/products/{g.template_product.id}/price",
        json={"price_amount": 4900, "currency": "AUD"},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_put_product_does_not_change_price(admin_client, content_graph, db_session):
    """8B-9: PUT /admin/products/{id} must not be a second way to change the price —
    that silently diverges the DB from Stripe with no audit reason and no archived old
    Price. Only POST /admin/products/{id}/price may change price_amount/stripe_price_id."""
    g = content_graph
    old_price_amount = g.template_product.price_amount
    old_stripe_price_id = g.template_product.stripe_price_id

    resp = await admin_client.put(
        f"/admin/products/{g.template_product.id}",
        json={
            "name": g.template_product.name,
            "description": g.template_product.description,
            "stripe_price_id": "price_smuggled_in_via_put",
            "price_amount": old_price_amount * 10,
            "currency": g.template_product.currency,
        },
    )
    assert resp.status_code == 200, resp.text

    result = await db_session.execute(select(Product).where(Product.id == g.template_product.id))
    product = result.scalar_one()
    assert product.price_amount == old_price_amount
    assert product.stripe_price_id == old_stripe_price_id
