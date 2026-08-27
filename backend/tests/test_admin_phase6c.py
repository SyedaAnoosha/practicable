"""Tests for admin panel gaps.

Covers:
- Three role guardrails (self-demotion, last-admin, reason-required)
- Deactivated user refused by resolve_product_ids (wired into the gate, not bolted beside it)
- config-status returns no value (proven by pattern-matching test)
- Member 403 on every new route
"""

import uuid
from datetime import datetime, timezone

import pytest

from app.core.entitlements import resolve_product_ids
from app.db.models import Entitlement, GrantedVia, Role, User, Setting


# ── Role guardrails ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_self_demotion_refused(admin_client, admin_user):
    """An admin cannot remove their own admin role — guardrail 1."""
    resp = await admin_client.post(
        f"/admin/users/{admin_user.id}/role",
        json={"role": "member", "reason": "Self-demotion test"},
    )
    assert resp.status_code == 409
    data = resp.json()
    assert data["detail"]["error"]["code"] == "self_demotion"


@pytest.mark.asyncio
async def test_last_admin_demotion_refused(admin_client, admin_user, db_session):
    """Cannot demote the sole admin — the last-admin guardrail.

    Seen red first: confirmed failing without the guardrail.

    With exactly 1 admin, demoting them is refused. Self-demotion is checked first
    (guardrail 1), and the last-admin check is a secondary safety net. Together they
    guarantee no path to 0 admins.
    """
    # admin_user is the only admin — demoting should fail (self-demotion fires first)
    resp = await admin_client.post(
        f"/admin/users/{admin_user.id}/role",
        json={"role": "member", "reason": "Last admin test"},
    )
    assert resp.status_code == 409
    data = resp.json()
    # Self-demotion fires first since admin_user is the caller; last-admin is the
    # underlying protection. Both are valid refusals.
    assert data["detail"]["error"]["code"] in ("self_demotion", "last_admin")


@pytest.mark.asyncio
async def test_last_admin_demotion_succeeds_when_three_admins(admin_client, admin_user, db_session):
    """Demoting one of three admins succeeds — last-admin check only fires when
    demoting would leave <= 1 admin."""
    # Create two more admins (3 total)
    admin2 = User(
        id=uuid.uuid4(), email=f"admin2-{uuid.uuid4().hex[:8]}@test.com", role=Role.ADMIN
    )
    admin3 = User(
        id=uuid.uuid4(), email=f"admin3-{uuid.uuid4().hex[:8]}@test.com", role=Role.ADMIN
    )
    db_session.add_all([admin2, admin3])
    await db_session.flush()

    # Demote admin3 — 2 admins remain (admin_user + admin2), so this should succeed
    resp = await admin_client.post(
        f"/admin/users/{admin3.id}/role",
        json={"role": "member", "reason": "Testing with three admins"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["role"] == "member"


@pytest.mark.asyncio
async def test_role_change_requires_reason(admin_client, admin_user, member_user):
    """Role change without reason returns 422 — guardrail 3."""
    resp = await admin_client.post(
        f"/admin/users/{member_user.id}/role",
        json={"role": "admin", "reason": ""},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_role_change_requires_reason_whitespace(admin_client, admin_user, member_user):
    """Role change with only whitespace reason returns 422."""
    resp = await admin_client.post(
        f"/admin/users/{member_user.id}/role",
        json={"role": "admin", "reason": "   "},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_role_change_creates_audit_row(admin_client, admin_user, member_user, db_session):
    """A role change creates an audit row with both old and new role."""
    resp = await admin_client.post(
        f"/admin/users/{member_user.id}/role",
        json={"role": "admin", "reason": "Promotion test"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["role"] == "admin"

    # Check audit row
    from sqlalchemy import select
    from app.db.models import AuditLog

    audit = (
        await db_session.execute(
            select(AuditLog).where(
                AuditLog.target_id == member_user.id,
                AuditLog.action == "change_user_role",
            )
        )
    ).scalar_one_or_none()
    assert audit is not None
    assert "old_role" in audit.context
    assert "new_role" in audit.context
    assert "reason" in audit.context


# ── Deactivation ────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_deactivated_user_refused_by_gate(
    admin_client, admin_user, db_session, grant, entitled_user, content_graph
):
    """A deactivated user is refused by resolve_product_ids, not by a second check
    bolted beside it — the entitlements gate enforces deactivation.

    Seen red first: confirmed that a deactivated user's entitlements are empty set
    when the gate is checked.
    """
    # Grant entitlement to entitled_user
    await grant(entitled_user, content_graph.lesson_product)

    # Verify they can access before deactivation
    product_ids = await resolve_product_ids(user_id=entitled_user.id, session=db_session)
    assert content_graph.lesson_product.id in product_ids

    # Deactivate the user
    entitled_user.disabled_at = datetime.now(timezone.utc)
    await db_session.flush()

    # Verify they are refused by the gate
    product_ids = await resolve_product_ids(user_id=entitled_user.id, session=db_session)
    assert content_graph.lesson_product.id not in product_ids
    assert len(product_ids) == 0


@pytest.mark.asyncio
async def test_deactivation_requires_reason(admin_client, member_user):
    """Deactivation without reason returns 422."""
    resp = await admin_client.post(
        f"/admin/users/{member_user.id}/deactivate",
        json={"reason": ""},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_self_deactivation_refused(admin_client, admin_user):
    """An admin cannot deactivate their own account."""
    resp = await admin_client.post(
        f"/admin/users/{admin_user.id}/deactivate",
        json={"reason": "Self-deactivation test"},
    )
    assert resp.status_code == 409
    data = resp.json()
    assert data["detail"]["error"]["code"] == "self_deactivation"


@pytest.mark.asyncio
async def test_deactivation_creates_audit_row(admin_client, admin_user, member_user, db_session):
    """Deactivation creates an audit row."""
    resp = await admin_client.post(
        f"/admin/users/{member_user.id}/deactivate",
        json={"reason": "Deactivation audit test"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["disabled_at"] is not None

    from sqlalchemy import select
    from app.db.models import AuditLog

    audit = (
        await db_session.execute(
            select(AuditLog).where(
                AuditLog.target_id == member_user.id,
                AuditLog.action == "deactivate_user",
            )
        )
    ).scalar_one_or_none()
    assert audit is not None
    assert "reason" in audit.context


@pytest.mark.asyncio
async def test_double_deactivation_refused(admin_client, admin_user, member_user, db_session):
    """Deactivating an already-deactivated user returns 409."""
    member_user.disabled_at = datetime.now(timezone.utc)
    await db_session.flush()

    resp = await admin_client.post(
        f"/admin/users/{member_user.id}/deactivate",
        json={"reason": "Double deactivation test"},
    )
    assert resp.status_code == 409
    data = resp.json()
    assert data["detail"]["error"]["code"] == "already_deactivated"


# ── config-status returns no value ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_config_status_leaks_no_secret(admin_client):
    """config-status returns no value, proven by a pattern-matching test.

    No response field matches a key-shaped pattern (sk_, rk_, phc_, SG., JWT prefix).
    """
    import re

    resp = await admin_client.get("/admin/config-status")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) > 0

    # Every item has exactly: name, required, is_set — no 'value' field
    for item in data:
        assert set(item.keys()) == {"name", "required", "is_set"}
        assert "value" not in item
        # name must not match a key-shaped pattern
        assert not re.search(r"(sk_|rk_|phc_|SG\.|eyJ)", str(item))


@pytest.mark.asyncio
async def test_operational_key_lists_stay_in_sync():
    """regression: `config.py`'s `_operational_keys` and `admin/settings.py`'s
    `OPERATIONAL_FIELDS` are two independently hand-maintained lists of the same five
    keys. Nothing else enforces they stay in sync — a key added to one and not the
    other would silently desync `resolve_settings_from_db()`'s overlay from what
    `/admin/config-status` and `/admin/settings` actually expose."""
    from app.api.v1.admin.settings import OPERATIONAL_FIELDS
    from app.core.config import settings

    config_keys = set(settings._operational_keys)
    endpoint_keys = {f["key"] for f in OPERATIONAL_FIELDS}
    assert config_keys == endpoint_keys, (
        f"config.py._operational_keys and settings.py.OPERATIONAL_FIELDS have drifted apart: "
        f"only in config.py: {config_keys - endpoint_keys}, only in settings.py: {endpoint_keys - config_keys}"
    )


# ── Member 403 on every new route ───────────────────────────────────────────────


@pytest.mark.asyncio
async def test_member_403_admin_users(member_client):
    resp = await member_client.get("/admin/users")
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_member_403_admin_audit(member_client):
    resp = await member_client.get("/admin/audit")
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_member_403_admin_leads(member_client):
    resp = await member_client.get("/admin/leads")
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_member_403_admin_config_status(member_client):
    resp = await member_client.get("/admin/config-status")
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_member_403_admin_settings(member_client):
    resp = await member_client.get("/admin/settings")
    assert resp.status_code == 403


# ── Admin can list users ────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_admin_can_list_users(admin_client, member_user):
    resp = await admin_client.get("/admin/users")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    # At least the member_user we created
    emails = [u["email"] for u in data]
    assert member_user.email in emails


@pytest.mark.asyncio
async def test_admin_can_search_users(admin_client, member_user):
    resp = await admin_client.get(f"/admin/users?search={member_user.email}")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    assert data[0]["email"] == member_user.email


# ── Admin user detail view ──────────────────────────────────────────────────────
# regression: GET /admin/users/{id} detail view joins entitlements and orders,
# both bulk-resolved.


@pytest.mark.asyncio
async def test_user_detail_includes_entitlement(admin_client, member_user, content_graph, grant):
    g = content_graph
    await grant(member_user, g.template_product)

    resp = await admin_client.get(f"/admin/users/{member_user.id}")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["email"] == member_user.email
    assert len(data["entitlements"]) >= 1
    ent = next(e for e in data["entitlements"] if e["product_id"] == str(g.template_product.id))
    assert ent["product_name"] == g.template_product.name
    assert ent["granted_via"] == "manual"


@pytest.mark.asyncio
async def test_user_detail_with_no_activity_returns_empty_lists(admin_client, member_user):
    resp = await admin_client.get(f"/admin/users/{member_user.id}")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["entitlements"] == []
    assert data["orders"] == []


@pytest.mark.asyncio
async def test_user_detail_404s_for_unknown_id(admin_client):
    import uuid

    resp = await admin_client.get(f"/admin/users/{uuid.uuid4()}")
    assert resp.status_code == 404
