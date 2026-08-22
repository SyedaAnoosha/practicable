"""Keyset pagination on GET /admin/orders.

Regression coverage for a real bug found during Phase 5 verification
(week4_plan.md): the malformed-cursor guard wrapped a bare assignment
(`cursor_date = cursor`) in a `try/except ValueError`, which can never raise —
so a malformed cursor skipped the "ignore and return from start" the code's
own comment promised, reached asyncpg as a raw string compared against a
timestamptz column, and crashed with an unhandled 500
(`operator does not exist: timestamp with time zone < character varying`).
Fixed by actually parsing the cursor with `datetime.fromisoformat()` before
using it, so the except clause is reachable.
"""
import uuid

import httpx
import pytest

from app.db.models import Order, OrderItem, OrderStatus, Product, Role, User


async def _create_order_row(db_session, *, price: int = 4900):
    """One user, one product, one order, one item — the minimum row this endpoint
    joins across (Order + OrderItem + User + Product)."""
    user = User(id=uuid.uuid4(), email=f"buyer-{uuid.uuid4().hex[:8]}@example.test", role=Role.MEMBER)
    product = Product(
        id=uuid.uuid4(),
        slug=f"p-{uuid.uuid4().hex[:8]}",
        name="Product",
        description="D",
        stripe_price_id="price_test",
        price_amount=price,
        currency="AUD",
    )
    db_session.add_all([user, product])
    await db_session.flush()
    order = Order(
        id=uuid.uuid4(),
        user_id=user.id,
        stripe_session_id=f"sess_test_{uuid.uuid4().hex[:12]}",
        stripe_payment_intent_id=f"pi_test_{uuid.uuid4().hex[:12]}",
        status=OrderStatus.COMPLETED,
        total_amount_cents=price,
        currency="AUD",
    )
    db_session.add(order)
    await db_session.flush()
    item = OrderItem(order_id=order.id, product_id=product.id, price_amount_cents=price)
    db_session.add(item)
    await db_session.flush()
    return order, item


@pytest.mark.asyncio
async def test_orders_tied_on_the_same_timestamp_are_not_silently_dropped_across_pages(
    admin_client: httpx.AsyncClient, db_session
):
    """Phase 10 (§10C re-verification, 2026-08-22): DESIGN.md §26.3 requires
    `(created_at, id)` as the cursor, exactly because a created_at-only cursor
    drops the rest of a tied batch instead of a clean skip/repeat. Proven first
    against /me/orders (test_purchases_receipt.py) with the identical query shape,
    then fixed here too since this endpoint had the same gap."""
    created = [await _create_order_row(db_session) for _ in range(3)]
    order_ids = {str(order.id) for order, _item in created}

    first_page = await admin_client.get("/admin/orders", params={"limit": 2})
    assert first_page.status_code == 200, first_page.text
    first_rows = first_page.json()
    seen_ids = {row["order_id"] for row in first_rows}

    last_cursor = first_rows[-1]["cursor"]
    second_page = await admin_client.get("/admin/orders", params={"limit": 2, "cursor": last_cursor})
    assert second_page.status_code == 200, second_page.text
    second_rows = second_page.json()
    seen_ids |= {row["order_id"] for row in second_rows}

    # Every order created for this test must show up across the two pages combined —
    # none silently dropped because they tied on created_at.
    assert order_ids <= seen_ids


@pytest.mark.asyncio
async def test_malformed_cursor_ignored_not_500(admin_client: httpx.AsyncClient):
    """A garbage cursor value degrades to "return from the start", not a crash."""
    resp = await admin_client.get("/admin/orders", params={"cursor": "not-a-real-date"})
    assert resp.status_code == 200, resp.text


@pytest.mark.asyncio
async def test_real_isoformat_cursor_accepted(admin_client: httpx.AsyncClient):
    """The cursor value the endpoint itself emits (`created_at.isoformat()`) must be
    accepted when echoed straight back, since that's exactly what a real "Load more"
    click sends."""
    resp = await admin_client.get("/admin/orders", params={"cursor": "2026-01-01T00:00:00+00:00"})
    assert resp.status_code == 200, resp.text


@pytest.mark.asyncio
async def test_no_cursor_returns_from_start(admin_client: httpx.AsyncClient):
    resp = await admin_client.get("/admin/orders")
    assert resp.status_code == 200, resp.text
    assert isinstance(resp.json(), list)
