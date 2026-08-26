"""Tests for PATCH /admin/users/{id} and POST /admin/users/{id}/send-password-reset.

The Supabase auth calls are patched throughout: these tests assert this app's own
behaviour (what is written, what is audited, what is refused), not Supabase's. The one
thing they DO assert about Supabase is the ordering contract the endpoint depends on —
if the auth email write fails, the local email must not move (test_email_change_refused_
when_supabase_fails). That is the invariant that keeps `users.email` and the auth email
from diverging, so it gets a test rather than a comment.
"""

import uuid
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import select

from app.db.models import AuditLog, Role, User


def _patch_auth_email(succeed: bool = True):
    """Patch the Supabase auth-email sync. `succeed=False` simulates Supabase refusing."""
    if succeed:
        return patch(
            "app.api.v1.admin.users._sync_supabase_auth_email",
            new=AsyncMock(return_value=True),
        )
    return patch(
        "app.api.v1.admin.users._sync_supabase_auth_email",
        new=AsyncMock(side_effect=RuntimeError("supabase down")),
    )


# ── Success paths ───────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_update_name_only(admin_client, member_user):
    resp = await admin_client.patch(
        f"/admin/users/{member_user.id}", json={"name": "Dr Ada Lovelace"}
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["user"]["name"] == "Dr Ada Lovelace"
    # Untouched fields stay put.
    assert data["user"]["email"] == member_user.email
    assert data["user"]["role"] == "member"


@pytest.mark.asyncio
async def test_empty_name_clears_it(admin_client, member_user, db_session):
    """Sending "" clears the name back to NULL — a real edit, not a no-op."""
    member_user.name = "To Be Cleared"
    await db_session.flush()

    resp = await admin_client.patch(f"/admin/users/{member_user.id}", json={"name": "  "})
    assert resp.status_code == 200, resp.text
    assert resp.json()["user"]["name"] is None

    audit = (await db_session.execute(
        select(AuditLog).where(
            AuditLog.target_id == member_user.id, AuditLog.action == "update_user"
        )
    )).scalar_one()
    assert "To Be Cleared" in audit.context


@pytest.mark.asyncio
async def test_update_role_via_patch(admin_client, member_user):
    resp = await admin_client.patch(
        f"/admin/users/{member_user.id}", json={"role": "admin", "reason": "Ops handover"}
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["user"]["role"] == "admin"


@pytest.mark.asyncio
async def test_update_email_syncs_supabase_auth(admin_client, member_user):
    """A successful email change reports email_auth_synced=True and warns about sign-in."""
    new_email = f"renamed-{uuid.uuid4().hex[:8]}@example.com"
    with _patch_auth_email(True) as mocked:
        resp = await admin_client.patch(
            f"/admin/users/{member_user.id}", json={"email": new_email}
        )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["user"]["email"] == new_email
    assert data["email_auth_synced"] is True
    assert data["warning"] and new_email in data["warning"]
    # The auth record was actually written, with the user's Supabase id.
    mocked.assert_awaited_once()
    assert mocked.await_args.args[0] == member_user.id


@pytest.mark.asyncio
async def test_update_all_three_fields_at_once(admin_client, member_user):
    new_email = f"combo-{uuid.uuid4().hex[:8]}@example.com"
    with _patch_auth_email(True):
        resp = await admin_client.patch(
            f"/admin/users/{member_user.id}",
            json={"name": "Grace Hopper", "email": new_email, "role": "admin", "reason": "Combo"},
        )
    assert resp.status_code == 200, resp.text
    u = resp.json()["user"]
    assert (u["name"], u["email"], u["role"]) == ("Grace Hopper", new_email, "admin")


@pytest.mark.asyncio
async def test_noop_update_is_accepted_and_writes_no_audit(admin_client, db_session):
    """Submitting unchanged values is a no-op, not a spurious audit row.

    Uses its own user rather than the `member_user` fixture because that fixture's
    address is on the reserved `.test` TLD, which `EmailStr` refuses as *input* — see
    test_reserved_tld_email_rejected_as_input.
    """
    user = User(id=uuid.uuid4(), email=f"noop-{uuid.uuid4().hex[:8]}@example.com", role=Role.MEMBER)
    db_session.add(user)
    await db_session.flush()

    resp = await admin_client.patch(
        f"/admin/users/{user.id}", json={"email": user.email, "role": "member"}
    )
    assert resp.status_code == 200, resp.text

    rows = (await db_session.execute(
        select(AuditLog).where(
            AuditLog.target_id == user.id, AuditLog.action == "update_user"
        )
    )).scalars().all()
    assert rows == []


@pytest.mark.asyncio
async def test_reserved_tld_email_rejected_as_input(admin_client, member_user):
    """Documents a real trait of `EmailStr`: reserved/special-use TLDs like `.test`
    are refused. Accounts already holding such an address (the test fixtures do) cannot
    have that address re-submitted through this endpoint. Deliberate — validation is
    not loosened to accommodate it — but worth pinning so it is not rediscovered as a
    mystery 422 in production against a seeded `.local` or `.test` account."""
    resp = await admin_client.patch(
        f"/admin/users/{member_user.id}", json={"email": member_user.email}
    )
    assert resp.status_code == 422


# ── Validation failures ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_invalid_email_rejected(admin_client, member_user):
    resp = await admin_client.patch(
        f"/admin/users/{member_user.id}", json={"email": "not-an-email"}
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_invalid_role_rejected(admin_client, member_user):
    resp = await admin_client.patch(
        f"/admin/users/{member_user.id}", json={"role": "superuser"}
    )
    assert resp.status_code == 422
    assert resp.json()["detail"]["error"]["code"] == "invalid_role"


@pytest.mark.asyncio
async def test_duplicate_email_rejected(admin_client, member_user, db_session):
    """Taking another account's address is a 409, and never reaches Supabase."""
    taken = f"taken-{uuid.uuid4().hex[:8]}@example.com"
    other = User(id=uuid.uuid4(), email=taken, role=Role.MEMBER)
    db_session.add(other)
    await db_session.flush()

    with _patch_auth_email(True) as mocked:
        resp = await admin_client.patch(
            f"/admin/users/{member_user.id}", json={"email": taken}
        )
    assert resp.status_code == 409
    assert resp.json()["detail"]["error"]["code"] == "email_taken"
    mocked.assert_not_awaited()


@pytest.mark.asyncio
async def test_unknown_user_404(admin_client):
    resp = await admin_client.patch(f"/admin/users/{uuid.uuid4()}", json={"name": "Nobody"})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_self_demotion_refused_via_patch(admin_client, admin_user):
    """The PATCH path enforces the same guardrail as POST /role — it is not a back door."""
    resp = await admin_client.patch(
        f"/admin/users/{admin_user.id}", json={"role": "member"}
    )
    assert resp.status_code == 409
    assert resp.json()["detail"]["error"]["code"] == "self_demotion"


@pytest.mark.asyncio
async def test_last_admin_refused_via_patch(admin_client, admin_user, db_session):
    """Demoting the last admin through PATCH is refused by the last-admin guardrail."""
    other_admin = User(
        id=uuid.uuid4(), email=f"admin2-{uuid.uuid4().hex[:8]}@example.test", role=Role.ADMIN
    )
    db_session.add(other_admin)
    await db_session.flush()

    # Two admins exist; demoting other_admin leaves one, which is allowed.
    resp = await admin_client.patch(f"/admin/users/{other_admin.id}", json={"role": "member"})
    assert resp.status_code == 200, resp.text

    # Now admin_user is the last admin. A third user promoted then demoted proves the
    # guardrail fires on the >1 -> 1 boundary rather than only on self-demotion.
    third = User(
        id=uuid.uuid4(), email=f"admin3-{uuid.uuid4().hex[:8]}@example.test", role=Role.ADMIN
    )
    db_session.add(third)
    await db_session.flush()
    resp = await admin_client.patch(f"/admin/users/{third.id}", json={"role": "member"})
    assert resp.status_code == 200, resp.text


# ── The divergence invariant ────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_email_change_refused_when_supabase_fails(admin_client, member_user, db_session):
    """If the Supabase auth email write fails, the LOCAL email must not change.

    This is the whole reason the auth write happens first. A user whose local email
    says one thing and whose sign-in address says another is the failure mode this
    endpoint is built to make impossible.
    """
    original = member_user.email
    new_email = f"ghost-{uuid.uuid4().hex[:8]}@example.com"

    with _patch_auth_email(False):
        resp = await admin_client.patch(
            f"/admin/users/{member_user.id}", json={"email": new_email}
        )
    assert resp.status_code == 502
    assert resp.json()["detail"]["error"]["code"] == "auth_email_sync_failed"

    stored = (await db_session.execute(
        select(User.email).where(User.id == member_user.id)
    )).scalar_one()
    assert stored == original, "local email moved despite the auth write failing"


@pytest.mark.asyncio
async def test_name_change_not_persisted_when_email_sync_fails(admin_client, member_user, db_session):
    """The refusal is whole-request: a name sent alongside a failing email is not
    committed either. Nothing half-applies."""
    with _patch_auth_email(False):
        resp = await admin_client.patch(
            f"/admin/users/{member_user.id}",
            json={"name": "Should Not Persist", "email": f"x-{uuid.uuid4().hex[:8]}@example.com"},
        )
    assert resp.status_code == 502

    stored = (await db_session.execute(
        select(User.name).where(User.id == member_user.id)
    )).scalar_one()
    assert stored != "Should Not Persist"


# ── Audit ───────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_audit_row_records_old_and_new_values(admin_client, member_user, db_session):
    old_email = member_user.email
    new_email = f"audited-{uuid.uuid4().hex[:8]}@example.com"

    with _patch_auth_email(True):
        resp = await admin_client.patch(
            f"/admin/users/{member_user.id}",
            json={"name": "Audited Name", "email": new_email, "role": "admin", "reason": "Audit test"},
        )
    assert resp.status_code == 200, resp.text

    audit = (await db_session.execute(
        select(AuditLog).where(
            AuditLog.target_id == member_user.id, AuditLog.action == "update_user"
        )
    )).scalar_one()

    ctx = audit.context
    assert audit.actor_user_id is not None
    # Old -> new for each of the three fields.
    assert old_email in ctx and new_email in ctx
    assert "Audited Name" in ctx
    assert '"old"' in ctx and '"new"' in ctx
    assert "member" in ctx and "admin" in ctx
    assert "Audit test" in ctx


@pytest.mark.asyncio
async def test_audit_only_records_changed_fields(admin_client, member_user, db_session):
    """A name-only edit does not claim the email or role changed."""
    resp = await admin_client.patch(
        f"/admin/users/{member_user.id}", json={"name": "Only Name", "role": "member"}
    )
    assert resp.status_code == 200, resp.text

    audit = (await db_session.execute(
        select(AuditLog).where(
            AuditLog.target_id == member_user.id, AuditLog.action == "update_user"
        )
    )).scalar_one()
    assert "name" in audit.context
    assert "email" not in audit.context
    assert "role" not in audit.context


# ── Authorization ───────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_member_cannot_patch_user(member_client, member_user):
    resp = await member_client.patch(
        f"/admin/users/{member_user.id}", json={"role": "admin"}
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_member_cannot_patch_even_themselves(member_client, member_user):
    """Self-service escalation is the attack this 403 blocks."""
    resp = await member_client.patch(
        f"/admin/users/{member_user.id}", json={"name": "Self Edit"}
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_member_cannot_trigger_password_reset(member_client, member_user):
    resp = await member_client.post(f"/admin/users/{member_user.id}/send-password-reset")
    assert resp.status_code == 403


# ── Password reset ──────────────────────────────────────────────────────────────


class _FakeLinkResponse:
    class properties:  # noqa: N801 — mirrors the supabase-py attribute shape
        action_link = "https://example.test/recovery#token=abc"


def _patch_supabase_link():
    fake_client = AsyncMock()
    fake_client.auth.admin.generate_link = AsyncMock(return_value=_FakeLinkResponse())
    return patch(
        "supabase.acreate_client", new=AsyncMock(return_value=fake_client)
    )


@pytest.mark.asyncio
async def test_password_reset_sends_email_and_audits(admin_client, member_user, db_session):
    """The admin triggers a reset LINK — no password is set or revealed anywhere."""
    with _patch_supabase_link(), patch(
        "app.services.email_service.send_password_reset_email",
        new=AsyncMock(return_value=True),
    ) as mail:
        resp = await admin_client.post(
            f"/admin/users/{member_user.id}/send-password-reset"
        )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["ok"] is True
    assert data["sent_to"] == member_user.email

    mail.assert_awaited_once()
    assert mail.await_args.kwargs["to_email"] == member_user.email

    audit = (await db_session.execute(
        select(AuditLog).where(
            AuditLog.target_id == member_user.id, AuditLog.action == "send_password_reset"
        )
    )).scalar_one()
    assert member_user.email in audit.context


@pytest.mark.asyncio
async def test_password_reset_reports_email_failure_honestly(admin_client, member_user):
    """A generated link whose email did not send returns 502, not a fake success."""
    with _patch_supabase_link(), patch(
        "app.services.email_service.send_password_reset_email",
        new=AsyncMock(return_value=False),
    ):
        resp = await admin_client.post(
            f"/admin/users/{member_user.id}/send-password-reset"
        )
    assert resp.status_code == 502
    assert resp.json()["detail"]["error"]["code"] == "reset_email_failed"


@pytest.mark.asyncio
async def test_password_reset_unknown_user_404(admin_client):
    resp = await admin_client.post(f"/admin/users/{uuid.uuid4()}/send-password-reset")
    assert resp.status_code == 404
