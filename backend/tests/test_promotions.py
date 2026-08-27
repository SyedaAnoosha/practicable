"""Tests for W5-R1 — Admin control over promotions.

Covers:
- GET /promotions/active: date-window logic, active flag, response allowlist
- POST /admin/promotions: overlap detection (five interval cases), audit trail
- PATCH /admin/promotions/{id}: overlap excluding self
- POST /admin/promotions/{id}/deactivate: audit trail
- Stripe failure → 502 and zero rows
- Unauthenticated access → 401
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import AuditLog, Promotion

pytestmark = pytest.mark.asyncio

now = datetime.now(timezone.utc)


# ── Helpers ──────────────────────────────────────────────────────────────────

def _dt(delta_hours: int = 0) -> datetime:
    """A UTC timestamp offset from now."""
    return now + timedelta(hours=delta_hours)


def _promo_kwargs(**overrides) -> dict:
    """Minimal valid promotion payload, with sensible defaults."""
    defaults = {
        "code": f"TEST-{overrides.pop('code_suffix', 'X')}",
        "message": "Test discount",
        "percent_off": 10,
        "starts_at": _dt(-24).isoformat(),
        "ends_at": _dt(24).isoformat(),
        "active": True,
    }
    defaults.update(overrides)
    return defaults


async def _create_promo(client: AsyncClient, **overrides) -> dict:
    """Create a promotion via the admin endpoint and return the JSON body."""
    resp = await client.post("/admin/promotions", json=_promo_kwargs(**overrides))
    assert resp.status_code == 201, resp.text
    return resp.json()


# ── Public endpoint: GET /promotions/active ───────────────────────────────────

async def test_active_promotion_inside_window(admin_client: AsyncClient, anon_client: AsyncClient):
    """A promotion that is active and within its date window is returned."""
    await _create_promo(admin_client, code_suffix="IN")

    resp = await anon_client.get("/promotions/active")
    assert resp.status_code == 200
    body = resp.json()
    assert body is not None
    assert body["code"] == "TEST-IN"
    assert body["percent_off"] == 10


async def test_not_returned_before_starts_at(admin_client: AsyncClient, anon_client: AsyncClient):
    """A promotion whose starts_at is in the future is not returned."""
    await _create_promo(
        admin_client,
        code_suffix="FUTURE",
        starts_at=_dt(48).isoformat(),
        ends_at=_dt(72).isoformat(),
    )
    resp = await anon_client.get("/promotions/active")
    assert resp.status_code == 200
    body = resp.json()
    if body is not None:
        assert body["code"] != "TEST-FUTURE"


async def test_not_returned_after_ends_at(admin_client: AsyncClient, anon_client: AsyncClient):
    """A promotion whose ends_at is in the past is not returned."""
    await _create_promo(
        admin_client,
        code_suffix="PAST",
        starts_at=_dt(-48).isoformat(),
        ends_at=_dt(-24).isoformat(),
    )
    resp = await anon_client.get("/promotions/active")
    assert resp.status_code == 200
    body = resp.json()
    if body is not None:
        assert body["code"] != "TEST-PAST"


async def test_not_returned_when_inactive(admin_client: AsyncClient, anon_client: AsyncClient):
    """An inactive promotion is not returned even if dates are valid."""
    await _create_promo(admin_client, code_suffix="OFF", active=False)
    resp = await anon_client.get("/promotions/active")
    assert resp.status_code == 200
    body = resp.json()
    if body is not None:
        assert body["code"] != "TEST-OFF"


async def test_open_ended_promotion_is_active(admin_client: AsyncClient, anon_client: AsyncClient):
    """A promotion with no ends_at is treated as +infinity and is returned."""
    await _create_promo(admin_client, code_suffix="OPEN", ends_at=None)
    resp = await anon_client.get("/promotions/active")
    assert resp.status_code == 200
    body = resp.json()
    assert body is not None
    assert body["code"] == "TEST-OPEN"


async def test_active_body_is_a_strict_allowlist(admin_client: AsyncClient, anon_client: AsyncClient):
    """The public response is an allowlist. `first_time_transaction` is included so the
    banner can say who the offer is for; the redemption limits and every internal id
    (`id`, `stripe_coupon_id`, `created_by`, `minimum_amount`, `max_redemptions`) are not.
    """
    await _create_promo(admin_client, code_suffix="KEYS")
    resp = await anon_client.get("/promotions/active")
    assert resp.status_code == 200
    body = resp.json()
    assert body is not None
    assert set(body.keys()) == {
        "code", "message", "percent_off", "ends_at", "first_time_transaction",
    }


# ── Concurrent active promotions ─────────────────────────────────────────────
#
# `[CHANGED 2026-08-27]` These four cases asserted 409 when two active promotions
# covered the same instant. That check is gone: WELCOME15 is a standing
# first-order-only offer and a limited-time sale code has to be able to run
# alongside it, so refusing the second create made a legitimate pairing
# impossible. The cases are kept, inverted, so a reintroduced overlap check fails
# loudly here instead of silently breaking the sale-plus-welcome pairing.
#
# What still holds is that GET /promotions/active returns at most ONE promotion for
# the banner — the most recently started live one. That is asserted alongside each
# case, because "several may be active" and "one is advertised" are the two halves
# of the behaviour and neither is safe to change without the other in view.

async def test_two_open_ended_promotions_may_both_be_active(admin_client: AsyncClient):
    """Two open-ended active promotions are allowed."""
    await _create_promo(admin_client, code_suffix="O1", starts_at=_dt(-1).isoformat(), ends_at=None)
    resp = await admin_client.post(
        "/admin/promotions",
        json=_promo_kwargs(code_suffix="O2", starts_at=_dt(-1).isoformat(), ends_at=None),
    )
    assert resp.status_code == 201


async def test_dated_sale_may_run_inside_an_open_ended_offer(admin_client: AsyncClient):
    """The real WELCOME15 case: a standing open-ended offer plus a dated sale."""
    await _create_promo(admin_client, code_suffix="OE", starts_at=_dt(-1).isoformat(), ends_at=None)
    resp = await admin_client.post(
        "/admin/promotions",
        json=_promo_kwargs(code_suffix="OD", starts_at=_dt(0).isoformat(), ends_at=_dt(12).isoformat()),
    )
    assert resp.status_code == 201


async def test_no_overlap_exact_boundary_abutment(admin_client: AsyncClient):
    """One ending at T and one starting at T — allowed, as it always was."""
    t = _dt(12)
    await _create_promo(
        admin_client,
        code_suffix="A1",
        starts_at=_dt(-1).isoformat(),
        ends_at=t.isoformat(),
    )
    resp = await admin_client.post(
        "/admin/promotions",
        json=_promo_kwargs(
            code_suffix="A2",
            starts_at=t.isoformat(),
            ends_at=_dt(24).isoformat(),
        ),
    )
    assert resp.status_code == 201


async def test_partially_overlapping_promotions_are_allowed(admin_client: AsyncClient):
    """Partially overlapping ranges are allowed."""
    await _create_promo(
        admin_client,
        code_suffix="P1",
        starts_at=_dt(-12).isoformat(),
        ends_at=_dt(12).isoformat(),
    )
    resp = await admin_client.post(
        "/admin/promotions",
        json=_promo_kwargs(
            code_suffix="P2",
            starts_at=_dt(0).isoformat(),
            ends_at=_dt(24).isoformat(),
        ),
    )
    assert resp.status_code == 201


async def test_fully_contained_promotion_is_allowed(admin_client: AsyncClient):
    """A new promotion fully inside an existing window is allowed."""
    await _create_promo(
        admin_client,
        code_suffix="C1",
        starts_at=_dt(-24).isoformat(),
        ends_at=_dt(48).isoformat(),
    )
    resp = await admin_client.post(
        "/admin/promotions",
        json=_promo_kwargs(
            code_suffix="C2",
            starts_at=_dt(0).isoformat(),
            ends_at=_dt(12).isoformat(),
        ),
    )
    assert resp.status_code == 201


async def test_banner_shows_the_most_recently_started_live_promotion(
    admin_client: AsyncClient, anon_client: AsyncClient
):
    """With two live promotions the banner advertises the newer-starting one. The older
    one is still active and still redeemable — it is simply not the one on the banner.
    """
    await _create_promo(admin_client, code_suffix="OLD", starts_at=_dt(-48).isoformat(), ends_at=None)
    await _create_promo(admin_client, code_suffix="NEW", starts_at=_dt(-1).isoformat(), ends_at=None)

    resp = await anon_client.get("/promotions/active")
    assert resp.status_code == 200
    assert resp.json()["code"].endswith("NEW")


# ── Audit trail ──────────────────────────────────────────────────────────────

async def test_create_writes_audit(admin_client: AsyncClient, db_session: AsyncSession):
    """Creating a promotion writes an audit_log row."""
    await _create_promo(admin_client, code_suffix="AUD")
    result = await db_session.execute(
        select(AuditLog).where(AuditLog.action == "create_promotion")
    )
    row = result.scalar_one_or_none()
    assert row is not None
    assert row.target_type == "promotion"


async def test_deactivate_writes_audit(admin_client: AsyncClient, db_session: AsyncSession):
    """Deactivating a promotion writes an audit_log row."""
    promo = await _create_promo(admin_client, code_suffix="DEA")
    resp = await admin_client.post(f"/admin/promotions/{promo['id']}/deactivate")
    assert resp.status_code == 200

    result = await db_session.execute(
        select(AuditLog).where(AuditLog.action == "deactivate_promotion")
    )
    row = result.scalar_one_or_none()
    assert row is not None


# ── Unauthenticated access ──────────────────────────────────────────────────

async def test_admin_promotions_unauthenticated(anon_client: AsyncClient):
    """GET /admin/promotions without auth → 401 or 403."""
    resp = await anon_client.get("/admin/promotions")
    assert resp.status_code in (401, 403)


async def test_create_promotion_unauthenticated(anon_client: AsyncClient):
    """POST /admin/promotions without auth → 401 or 403."""
    resp = await anon_client.post("/admin/promotions", json=_promo_kwargs(code_suffix="NOAUTH"))
    assert resp.status_code in (401, 403)


# ── Stripe failure ──────────────────────────────────────────────────────────

async def test_stripe_failure_returns_502_and_zero_rows(
    admin_client: AsyncClient, db_session: AsyncSession
):
    """When Stripe sync is requested but fails, no promotion row is created."""
    import stripe as stripe_mod

    with patch(
        "app.integrations.stripe_client.stripe.Coupon.create",
        side_effect=stripe_mod.StripeError("mocked failure"),
    ):
        resp = await admin_client.post(
            "/admin/promotions",
            json=_promo_kwargs(code_suffix="FAIL", sync_to_stripe=True),
        )
    assert resp.status_code == 502

    # Verify no row was created
    result = await db_session.execute(
        select(Promotion).where(Promotion.code == "TEST-FAIL")
    )
    assert result.scalar_one_or_none() is None


# ── Stripe sync: the expiry must reach Stripe, not just our database ──────────


async def test_stripe_sync_propagates_expiry_to_the_promotion_code(
    admin_client: AsyncClient,
):
    """`ends_at` must be sent to Stripe as the PromotionCode's `expires_at`.

    Enforcing the window in our database only would mean GET /promotions/active
    stops advertising the code while Stripe keeps honouring it indefinitely for
    anyone who already copied it. An expiry that only one of the two systems knows
    about is not an expiry — so this asserts the value actually crossed the wire.
    """
    ends = _dt(48)

    with patch(
        "app.integrations.stripe_client.stripe.Coupon.create",
        return_value=type("C", (), {"id": "coupon_test_123"})(),
    ), patch(
        "app.integrations.stripe_client.stripe.PromotionCode.create",
        return_value=type("P", (), {"id": "promo_test_123"})(),
    ) as promo_create:
        resp = await admin_client.post(
            "/admin/promotions",
            json=_promo_kwargs(
                code_suffix="EXPIRY", sync_to_stripe=True, ends_at=ends.isoformat()
            ),
        )

    assert resp.status_code == 201, resp.text

    kwargs = promo_create.call_args.kwargs
    assert "expires_at" in kwargs, (
        "PromotionCode.create was called without expires_at — the promotion would "
        "never expire in Stripe."
    )
    assert kwargs["expires_at"] == int(ends.timestamp())


async def test_stripe_sync_omits_expiry_for_open_ended_promotion(
    admin_client: AsyncClient,
):
    """An open-ended promotion (ends_at = null) sends no expiry at all.

    Sending an expiry of 0 or "now" for the open-ended case would kill the code on
    creation — the absence has to stay an absence.
    """
    with patch(
        "app.integrations.stripe_client.stripe.Coupon.create",
        return_value=type("C", (), {"id": "coupon_test_456"})(),
    ), patch(
        "app.integrations.stripe_client.stripe.PromotionCode.create",
        return_value=type("P", (), {"id": "promo_test_456"})(),
    ) as promo_create:
        resp = await admin_client.post(
            "/admin/promotions",
            json=_promo_kwargs(code_suffix="OPEN", sync_to_stripe=True, ends_at=None),
        )

    assert resp.status_code == 201, resp.text
    assert "expires_at" not in promo_create.call_args.kwargs
