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
import json
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.core.security import VerifiedToken, verify_jwt_full
from app.db.models import Entitlement, Order, OrderItem, OrderStatus, Product, User
from main import app


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
async def test_close_account_with_a_stale_token_is_refused(member_user):
    """Found 2026-08-22 (owner-flagged): /me/account/close previously required only
    a valid session — the password gate lived entirely in AccountDataPrivacy.tsx's
    choice to call signInWithPassword first, which a direct API call bypasses
    completely. require_recent_reauth closes this server-side using the JWT's `iat` —
    fresh only immediately after a real signInWithPassword. This constructs a token
    stamped 10 minutes old (outside the 5-minute freshness window) to prove a stale
    token is refused, not just a missing one.
    """
    stale_token = VerifiedToken(
        user_id=str(member_user.id),
        email=member_user.email,
        name=None,
        issued_at=int((datetime.now(timezone.utc) - timedelta(minutes=10)).timestamp()),
    )

    async def _stale_verify_jwt_full():
        return stale_token

    app.dependency_overrides[verify_jwt_full] = _stale_verify_jwt_full
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(
            transport=transport, base_url="http://testserver",
            headers={"Authorization": "Bearer irrelevant-stale-token-test"},
        ) as client:
            resp = await client.post("/me/account/close")
    finally:
        del app.dependency_overrides[verify_jwt_full]

    assert resp.status_code == 403, resp.text
    assert resp.json()["detail"]["error"]["code"] == "reauth_required"


@pytest.mark.asyncio
async def test_close_account_with_a_fresh_token_succeeds(member_user):
    """The positive case: a token issued 30 seconds ago (well inside the 5-minute
    window) is accepted — the fixture default every other test in this file relies
    on, made explicit here so the freshness check itself is proven both ways."""
    fresh_token = VerifiedToken(
        user_id=str(member_user.id),
        email=member_user.email,
        name=None,
        issued_at=int((datetime.now(timezone.utc) - timedelta(seconds=30)).timestamp()),
    )

    async def _fresh_verify_jwt_full():
        return fresh_token

    app.dependency_overrides[verify_jwt_full] = _fresh_verify_jwt_full
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(
            transport=transport, base_url="http://testserver",
            headers={"Authorization": "Bearer irrelevant-fresh-token-test"},
        ) as client:
            resp = await client.post("/me/account/close")
    finally:
        del app.dependency_overrides[verify_jwt_full]

    assert resp.status_code == 200, resp.text


@pytest.mark.asyncio
async def test_export_is_rate_limited(member_client):
    """§10F step 1: 'Rate-limited.' Untested before this pass — confirms the
    _account_rate_limiter actually gates this endpoint, not just the ones with a
    dedicated closure/password-change test already covering it indirectly."""
    responses = [await member_client.post("/me/account/export") for _ in range(11)]
    statuses = [r.status_code for r in responses]
    assert 429 in statuses, f"Expected a 429 among 11 rapid requests, got {statuses}"


@pytest.mark.asyncio
async def test_no_hard_delete_path_exists_anywhere_for_a_user_account(member_client, member_user, db_session):
    """§10F step 7: 'no Delete Account button hard-deletes anything.' No behavioral
    test can prove a negative UI claim by itself, so this pairs a backend check (the
    user row survives close_my_account, full stop — no code path removes it) with
    the frontend's own structural test (AccountDataPrivacy.deleteButton.test.tsx)
    that greps for the literal absence of a hard-delete control."""
    close_resp = await member_client.post("/me/account/close")
    assert close_resp.status_code == 200, close_resp.text

    result = await db_session.execute(select(User).where(User.id == member_user.id))
    user = result.scalar_one_or_none()
    assert user is not None, "close_my_account must deactivate, never delete, the user row"
    assert user.disabled_at is not None


@pytest.mark.asyncio
async def test_notification_preferences_persist(member_client, member_user, db_session):
    """§10E: preferences persist across the GET/PATCH round trip."""
    resp = await member_client.patch(
        "/me/account/notifications",
        json={"notify_marketing": True, "notify_product_updates": False},
    )
    assert resp.status_code == 200, resp.text
    # notify_sound isn't in the PATCH payload, so it round-trips at its default (True)
    # rather than being cleared — the endpoint only overwrites fields it was sent.
    assert resp.json() == {
        "notify_marketing": True, "notify_product_updates": False, "notify_sound": True,
    }

    follow_up = await member_client.get("/me/account/notifications")
    assert follow_up.status_code == 200, follow_up.text
    assert follow_up.json() == {
        "notify_marketing": True, "notify_product_updates": False, "notify_sound": True,
    }


@pytest.mark.asyncio
async def test_notification_preferences_default_marketing_off_updates_on(member_client):
    """§10E step 4: no pre-ticked marketing consent; product-update mail defaults
    on, visibly toggleable."""
    resp = await member_client.get("/me/account/notifications")
    assert resp.status_code == 200, resp.text
    assert resp.json()["notify_marketing"] is False
    assert resp.json()["notify_product_updates"] is True


@pytest.mark.asyncio
async def test_notification_preferences_reject_non_boolean_values(member_client):
    """§10E step 5: 'non-boolean values rejected' — the one DoD line with no test
    at all before this pass."""
    resp = await member_client.patch(
        "/me/account/notifications",
        json={"notify_marketing": "not-a-real-boolean", "notify_product_updates": False},
    )
    assert resp.status_code == 422, resp.text


@pytest.mark.asyncio
async def test_notification_preferences_update_writes_an_audit_row(member_client, member_user, db_session):
    """§10E step 2: 'PATCH /me/account/notifications — booleans only, audited,
    idempotent' — the audited half was never actually tested."""
    from app.db.models import AuditLog

    resp = await member_client.patch(
        "/me/account/notifications",
        json={"notify_marketing": True, "notify_product_updates": True},
    )
    assert resp.status_code == 200, resp.text

    audit_result = await db_session.execute(
        select(AuditLog).where(
            AuditLog.target_id == member_user.id,
            AuditLog.action == "notification_preferences_updated",
        )
    )
    row = audit_result.scalar_one_or_none()
    assert row is not None
    context = json.loads(row.context) if isinstance(row.context, str) else row.context
    assert context["notify_marketing"] is True
    assert context["notify_product_updates"] is True


@pytest.mark.asyncio
async def test_notification_preferences_patch_is_idempotent(member_client):
    """§10E step 2: sending the same values twice must not error or double-apply
    anything — a plain field overwrite, safe to repeat."""
    payload = {"notify_marketing": True, "notify_product_updates": False}
    first = await member_client.patch("/me/account/notifications", json=payload)
    second = await member_client.patch("/me/account/notifications", json=payload)

    assert first.status_code == 200, first.text
    assert second.status_code == 200, second.text
    # notify_sound isn't in payload, so it defaults to True on the response model
    # both times — the idempotency claim is about repeating the same PATCH, not
    # about the fields the payload never mentioned.
    expected = {**payload, "notify_sound": True}
    assert first.json() == second.json() == expected


@pytest.mark.asyncio
async def test_email_change_hook_syncs_email_and_writes_an_audit_row(member_client, member_user, db_session):
    """§10A step 3: 'After Supabase confirms the new email, the frontend calls this
    to sync users.email, write an audit row, fire the security alert email.' This
    endpoint itself had zero test coverage before this pass, despite being the exact
    hook RootLayout.tsx's onAuthStateChange now calls (see
    RootLayout.emailChange.test.tsx for the frontend half)."""
    from app.db.models import AuditLog

    new_email = f"changed-{uuid.uuid4().hex[:8]}@example.test"
    resp = await member_client.post("/me/account/email-changed", json={"new_email": new_email})
    assert resp.status_code == 200, resp.text

    user = (await db_session.execute(select(User).where(User.id == member_user.id))).scalar_one()
    assert user.email == new_email

    audit_result = await db_session.execute(
        select(AuditLog).where(
            AuditLog.target_id == member_user.id,
            AuditLog.action == "email_changed",
        )
    )
    row = audit_result.scalar_one_or_none()
    assert row is not None
    context = json.loads(row.context) if isinstance(row.context, str) else row.context
    assert context["new_email"] == new_email


@pytest.mark.asyncio
async def test_email_change_hook_is_rate_limited(member_client):
    """§10A/§10F pattern: every account-mutation hook in this file shares
    _account_rate_limiter — this one had no test confirming it actually applies
    here too."""
    responses = [
        await member_client.post("/me/account/email-changed", json={"new_email": f"e{i}@example.test"})
        for i in range(11)
    ]
    statuses = [r.status_code for r in responses]
    assert 429 in statuses, f"Expected a 429 among 11 rapid requests, got {statuses}"


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


# ── §10E step 5's own required test, verbatim ───────────────────────────────────
# "a marketing send is suppressed when notify_marketing is false" — found 2026-08-22:
# untestable as written because no product-update/marketing sender existed anywhere
# in email_service.py at all (confirmed by grep — zero matches on either preference
# column in that file). send_product_update_email is that sender, gated on the
# caller's own notify_product_updates flag; these test the gate directly rather than
# through Mailjet, since the gate's own early return is what's under test — no
# network call happens on either branch.


@pytest.mark.asyncio
async def test_product_update_email_suppressed_when_preference_is_false():
    """`_send` is mocked here so the only variable under test is the gate itself —
    an unmocked version would pass for the wrong reason in this environment (no
    Mailjet credentials means the real network call also returns False, on either
    branch, which would silently hide a missing gate). Found exactly this way,
    2026-08-22: the first version of this test used the real `_send` and stayed
    green after the gate was deliberately deleted in a red-first check — rewritten
    to mock `_send` once that false pass was caught."""
    from unittest.mock import patch
    from app.services.email_service import send_product_update_email

    with patch("app.services.email_service._send", return_value=True) as send_mock:
        sent = await send_product_update_email(
            to_email="buyer@example.test",
            product_name="Vendor Risk Template",
            primary_link="https://example.test/library",
            notify_product_updates=False,
        )
    assert sent is False
    send_mock.assert_not_called()


@pytest.mark.asyncio
async def test_product_update_email_sends_when_preference_is_true():
    from unittest.mock import patch
    from app.services.email_service import send_product_update_email

    with patch("app.services.email_service._send", return_value=True) as send_mock:
        sent = await send_product_update_email(
            to_email="buyer@example.test",
            product_name="Vendor Risk Template",
            primary_link="https://example.test/library",
            notify_product_updates=True,
        )
    assert sent is True
    send_mock.assert_called_once()


@pytest.mark.asyncio
async def test_transactional_receipt_email_has_no_preference_parameter_to_suppress_it():
    """§10E step 3 / step 5: transactional mail is NEVER gated by these flags. Proven
    structurally — send_receipt_email and send_access_granted_email take no
    notify_marketing/notify_product_updates parameter at all, so there is no flag
    inside either function capable of suppressing them, by construction."""
    import inspect
    from app.services.email_service import send_receipt_email, send_access_granted_email

    receipt_params = set(inspect.signature(send_receipt_email).parameters)
    access_params = set(inspect.signature(send_access_granted_email).parameters)

    assert "notify_marketing" not in receipt_params
    assert "notify_product_updates" not in receipt_params
    assert "notify_marketing" not in access_params
    assert "notify_product_updates" not in access_params
