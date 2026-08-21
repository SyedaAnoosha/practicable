"""Phase 10 (§10A/§10B/§10E/§10F): Tests for the self-serve account endpoints.

Found 2026-08-21 (Phase 10 re-verification): every DoD line for this phase claimed
"seen red first" test coverage, but zero test files existed anywhere in the repo for
any of /me/profile PATCH, /me/account/notifications, /me/account/password-change,
/me/account/email-changed, /me/account/export, or /me/account/close — confirmed by
grep, zero hits on any endpoint name or route. This is that missing coverage,
prioritised toward the two highest-severity claims the DoD makes: the data export
"scoped strictly to the requesting user" (a leak here is a real privacy breach) and
closure's interaction with the entitlements gate + no-hard-delete guarantee.
"""
import uuid

import pytest
from sqlalchemy import select

from app.db.models import Entitlement, Order, OrderItem, OrderStatus, Product, User


@pytest.mark.asyncio
async def test_export_contains_only_the_requesting_users_own_orders(
    member_client, member_user, db_session,
):
    """The core privacy claim: export must not leak another user's rows. Creates a
    second user with their own order, confirms it never appears in the first user's
    export."""
    other_user = User(id=uuid.uuid4(), email=f"other-{uuid.uuid4().hex[:8]}@test.com", role=member_user.role)
    product = Product(
        id=uuid.uuid4(), slug=f"p-{uuid.uuid4().hex[:8]}", name="Other User's Product",
        description="d", stripe_price_id="price_test", price_amount=9900, currency="AUD",
    )
    other_order = Order(
        id=uuid.uuid4(), user_id=other_user.id, stripe_session_id=f"sess_{uuid.uuid4().hex[:8]}",
        status=OrderStatus.COMPLETED, total_amount_cents=9900, currency="AUD",
    )
    db_session.add_all([other_user, product, other_order])
    await db_session.flush()
    db_session.add(OrderItem(order_id=other_order.id, product_id=product.id, price_amount_cents=9900))
    await db_session.flush()

    resp = await member_client.post("/me/account/export")
    assert resp.status_code == 200, resp.text
    data = resp.json()

    assert data["profile"]["id"] == str(member_user.id)
    order_ids = [o["id"] for o in data["orders"]]
    assert str(other_order.id) not in order_ids, "Export leaked another user's order"

    # And the requester's own profile fields are the real ones, not fabricated.
    assert data["profile"]["email"] == member_user.email


@pytest.mark.asyncio
async def test_export_includes_the_requesting_users_own_order(member_client, member_user, db_session):
    """The positive case: a real order belonging to the requester IS included."""
    product = Product(
        id=uuid.uuid4(), slug=f"p-{uuid.uuid4().hex[:8]}", name="My Product",
        description="d", stripe_price_id="price_test", price_amount=4900, currency="AUD",
    )
    order = Order(
        id=uuid.uuid4(), user_id=member_user.id, stripe_session_id=f"sess_{uuid.uuid4().hex[:8]}",
        status=OrderStatus.COMPLETED, total_amount_cents=4900, currency="AUD",
    )
    db_session.add_all([product, order])
    await db_session.flush()
    db_session.add(OrderItem(order_id=order.id, product_id=product.id, price_amount_cents=4900))
    await db_session.flush()

    resp = await member_client.post("/me/account/export")
    assert resp.status_code == 200, resp.text
    order_ids = [o["id"] for o in resp.json()["orders"]]
    assert str(order.id) in order_ids


@pytest.mark.asyncio
async def test_close_account_sets_disabled_at_not_a_delete(member_client, member_user, db_session):
    """§10F: closure is deactivation, never a hard delete."""
    resp = await member_client.post("/me/account/close")
    assert resp.status_code == 200, resp.text

    user = (await db_session.execute(select(User).where(User.id == member_user.id))).scalar_one_or_none()
    assert user is not None, "The user row was deleted — closure must be deactivation, never a hard delete"
    assert user.disabled_at is not None


@pytest.mark.asyncio
async def test_close_account_is_idempotent_not_a_double_fire(member_client, member_user):
    """A second close request on an already-closed account must not silently
    succeed as if it were the first (which would double-send the audit row and
    the closure email)."""
    first = await member_client.post("/me/account/close")
    assert first.status_code == 200, first.text

    second = await member_client.post("/me/account/close")
    assert second.status_code == 409, second.text


@pytest.mark.asyncio
async def test_closed_account_fails_the_entitlements_gate(member_client, member_user, db_session):
    """§10F's own required test, verbatim: 'a deactivated user is refused by the
    gate.' Via resolve_product_ids, the same function the gate itself calls —
    not a re-implementation of the gate's logic."""
    from app.core.entitlements import resolve_product_ids

    product = Product(
        id=uuid.uuid4(), slug=f"p-{uuid.uuid4().hex[:8]}", name="Gate Test Product",
        description="d", stripe_price_id="price_test", price_amount=4900, currency="AUD",
    )
    db_session.add(product)
    await db_session.flush()
    db_session.add(Entitlement(user_id=member_user.id, product_id=product.id, granted_via="purchase"))
    await db_session.flush()

    held_before = await resolve_product_ids(user_id=member_user.id, session=db_session)
    assert product.id in held_before

    resp = await member_client.post("/me/account/close")
    assert resp.status_code == 200, resp.text

    held_after = await resolve_product_ids(user_id=member_user.id, session=db_session)
    assert product.id not in held_after, "A closed/deactivated account must be refused by the gate"


@pytest.mark.asyncio
async def test_closed_accounts_orders_are_not_deleted(member_client, member_user, db_session):
    """§10F step 7: 'a deactivated user's orders remain intact.'"""
    product = Product(
        id=uuid.uuid4(), slug=f"p-{uuid.uuid4().hex[:8]}", name="Retained Order Product",
        description="d", stripe_price_id="price_test", price_amount=4900, currency="AUD",
    )
    order = Order(
        id=uuid.uuid4(), user_id=member_user.id, stripe_session_id=f"sess_{uuid.uuid4().hex[:8]}",
        status=OrderStatus.COMPLETED, total_amount_cents=4900, currency="AUD",
    )
    db_session.add_all([product, order])
    await db_session.flush()

    resp = await member_client.post("/me/account/close")
    assert resp.status_code == 200, resp.text

    surviving_order = (await db_session.execute(select(Order).where(Order.id == order.id))).scalar_one_or_none()
    assert surviving_order is not None, "Closure must not delete order records — financial retention (Research §7.6)"


@pytest.mark.asyncio
async def test_notification_preferences_persist(member_client, member_user, db_session):
    """§10E: preferences persist across the GET/PATCH round trip."""
    resp = await member_client.patch(
        "/me/account/notifications",
        json={"notify_marketing": True, "notify_product_updates": False},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json() == {"notify_marketing": True, "notify_product_updates": False}

    follow_up = await member_client.get("/me/account/notifications")
    assert follow_up.status_code == 200, follow_up.text
    assert follow_up.json() == {"notify_marketing": True, "notify_product_updates": False}


@pytest.mark.asyncio
async def test_notification_preferences_default_marketing_off_updates_on(member_client):
    """§10E step 4: no pre-ticked marketing consent; product-update mail defaults
    on, visibly toggleable."""
    resp = await member_client.get("/me/account/notifications")
    assert resp.status_code == 200, resp.text
    assert resp.json()["notify_marketing"] is False
    assert resp.json()["notify_product_updates"] is True


@pytest.mark.asyncio
async def test_password_change_hook_writes_an_audit_row(member_client, member_user, db_session):
    """§10B: 'success ... writes an audit row' — the one thing a Supabase-side
    password change never reaches on its own."""
    from app.db.models import AuditLog

    resp = await member_client.post("/me/account/password-change")
    assert resp.status_code == 200, resp.text

    audit_result = await db_session.execute(
        select(AuditLog).where(
            AuditLog.target_id == member_user.id,
            AuditLog.action == "password_changed",
        )
    )
    assert audit_result.scalar_one_or_none() is not None


@pytest.mark.asyncio
async def test_profile_name_update_persists_and_validates(member_client, member_user, db_session):
    """§10A step 2: PATCH /me/profile writes full_name, validated, audited."""
    resp = await member_client.patch("/me/profile", json={"full_name": "A New Name"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["name"] == "A New Name"

    user = (await db_session.execute(select(User).where(User.id == member_user.id))).scalar_one()
    assert user.name == "A New Name"


@pytest.mark.asyncio
async def test_profile_name_update_refuses_empty(member_client):
    """§10A step 2: empty name refused."""
    resp = await member_client.patch("/me/profile", json={"full_name": ""})
    assert resp.status_code == 422, resp.text


@pytest.mark.asyncio
async def test_profile_name_update_refuses_over_100_chars(member_client):
    """§10A step 2: >100 chars refused."""
    resp = await member_client.patch("/me/profile", json={"full_name": "x" * 101})
    assert resp.status_code == 422, resp.text
