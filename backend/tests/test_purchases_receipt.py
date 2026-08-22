"""Phase 10 (§10C re-verification, 2026-08-22): GET /me/orders/{id}/receipt.

The plan's own `[GAP]` marker: no Stripe invoice id is ever persisted on `orders`
(it's fetched from the Stripe session at webhook time and only reaches the one-shot
receipt email — never saved). Per the plan's explicit instruction ("if not [stored],
regenerate the receipt from order data. Never fabricate an invoice number."), this
endpoint regenerates a receipt from the order row alone and never invents an invoice
number.

Also covers the /me/orders `next_cursor` fix: it was computed and then silently
dropped from the response model, so has_more was returned with no way to actually
request the next page — a genuine keyset-pagination bug, not just a missing field.
"""
import uuid

import pytest
from sqlalchemy import select

from app.db.models import Order, OrderItem, OrderStatus, Product, Role, User


async def _create_order(db_session, *, user: User, price: int = 4900, n_items: int = 1):
    order_id = uuid.uuid4()
    order = Order(
        id=order_id,
        user_id=user.id,
        stripe_session_id=f"sess_test_{uuid.uuid4().hex[:12]}",
        stripe_payment_intent_id=f"pi_test_{uuid.uuid4().hex[:12]}",
        status=OrderStatus.COMPLETED,
        total_amount_cents=price * n_items,
        currency="AUD",
    )
    db_session.add(order)
    products = []
    for i in range(n_items):
        product = Product(
            id=uuid.uuid4(),
            slug=f"p-{uuid.uuid4().hex[:8]}",
            name=f"Product {i}",
            description="D",
            stripe_price_id="price_test",
            price_amount=price,
            currency="AUD",
        )
        db_session.add(product)
        products.append(product)
    await db_session.flush()
    for product in products:
        db_session.add(OrderItem(order_id=order_id, product_id=product.id, price_amount_cents=price))
    await db_session.flush()
    return order_id


@pytest.mark.asyncio
async def test_receipt_regenerated_from_order_data_never_fabricates_an_invoice_number(
    member_client, member_user, db_session
):
    order_id = await _create_order(db_session, user=member_user)

    resp = await member_client.get(f"/me/orders/{order_id}/receipt")
    assert resp.status_code == 200, resp.text
    body = resp.json()

    assert body["order_id"] == str(order_id)
    assert body["total_amount_cents"] == 4900
    assert body["currency"] == "AUD"
    assert len(body["lines"]) == 1
    # No invoice_number field is fabricated — the response simply doesn't carry one.
    assert "invoice_number" not in body


@pytest.mark.asyncio
async def test_receipt_lists_every_line_of_a_multi_item_order(member_client, member_user, db_session):
    order_id = await _create_order(db_session, user=member_user, n_items=3)

    resp = await member_client.get(f"/me/orders/{order_id}/receipt")
    assert resp.status_code == 200, resp.text
    assert len(resp.json()["lines"]) == 3


@pytest.mark.asyncio
async def test_receipt_is_scoped_to_the_requesting_user_only(member_client, db_session):
    """A receipt for someone else's order must 404, not leak their purchase data."""
    other_user = User(id=uuid.uuid4(), email=f"other-{uuid.uuid4().hex[:8]}@example.test", role=Role.MEMBER)
    db_session.add(other_user)
    await db_session.flush()
    order_id = await _create_order(db_session, user=other_user)

    resp = await member_client.get(f"/me/orders/{order_id}/receipt")
    assert resp.status_code == 404, resp.text


@pytest.mark.asyncio
async def test_receipt_for_a_nonexistent_order_404s(member_client):
    resp = await member_client.get(f"/me/orders/{uuid.uuid4()}/receipt")
    assert resp.status_code == 404, resp.text


@pytest.mark.asyncio
async def test_receipt_shows_refund_details_when_present(member_client, member_user, db_session):
    from datetime import datetime, timezone

    order_id = await _create_order(db_session, user=member_user)
    order = (await db_session.execute(select(Order).where(Order.id == order_id))).scalar_one()
    order.buyer_refund_amount_cents = 4165
    order.buyer_refunded_at = datetime.now(timezone.utc)
    order.status = OrderStatus.REFUNDED
    await db_session.flush()

    resp = await member_client.get(f"/me/orders/{order_id}/receipt")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["buyer_refund_amount_cents"] == 4165
    assert body["buyer_refunded_at"] is not None


@pytest.mark.asyncio
async def test_orders_next_cursor_is_present_and_usable_for_a_second_page(member_client, member_user, db_session):
    """The bug: next_cursor was computed inside get_my_orders and then dropped from
    the response model, so has_more=true carried no way to actually request page 2."""
    for _ in range(3):
        await _create_order(db_session, user=member_user)

    first_page = await member_client.get("/me/orders", params={"limit": 2})
    assert first_page.status_code == 200, first_page.text
    body = first_page.json()
    assert body["has_more"] is True
    assert body["next_cursor"] is not None

    second_page = await member_client.get("/me/orders", params={"limit": 2, "cursor": body["next_cursor"]})
    assert second_page.status_code == 200, second_page.text
    second_body = second_page.json()
    assert len(second_body["orders"]) == 1
    assert second_body["has_more"] is False

    # No overlap between pages — the cursor genuinely advanced, it didn't just repeat.
    first_ids = {o["id"] for o in body["orders"]}
    second_ids = {o["id"] for o in second_body["orders"]}
    assert first_ids.isdisjoint(second_ids)
