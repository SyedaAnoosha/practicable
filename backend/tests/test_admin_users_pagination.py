"""Keyset pagination on GET /admin/users.

Regression coverage for a real bug found during Phase 6C verification
(week4_plan.md): unlike admin/orders.py's cursor bug (Phase 5 §26.3, already
fixed), this endpoint never parsed the cursor at all — `cursor` was passed
straight into `User.created_at < cursor` as a raw string. This crashed with an
unhandled 500 (`operator does not exist: timestamp with time zone <
character varying`) for BOTH a malformed cursor AND a genuinely well-formed
one (i.e. the exact value the endpoint's own `cursor` field emits, which is
what a real "Load more" click sends) — worse than the orders.py bug, which
only crashed on malformed input. Fixed by parsing with
`datetime.fromisoformat()` before using it, same pattern as orders.py.
"""
import httpx
import pytest


@pytest.mark.asyncio
async def test_real_isoformat_cursor_accepted(admin_client: httpx.AsyncClient):
    """The cursor value the endpoint itself emits (`created_at.isoformat()`) must be
    accepted when echoed straight back — this is exactly what a real "Load more"
    click sends, and it crashed unconditionally before the fix."""
    resp = await admin_client.get("/admin/users", params={"cursor": "2026-01-01T00:00:00+00:00"})
    assert resp.status_code == 200, resp.text


@pytest.mark.asyncio
async def test_malformed_cursor_ignored_not_500(admin_client: httpx.AsyncClient):
    resp = await admin_client.get("/admin/users", params={"cursor": "not-a-real-date"})
    assert resp.status_code == 200, resp.text


@pytest.mark.asyncio
async def test_no_cursor_returns_from_start(admin_client: httpx.AsyncClient):
    resp = await admin_client.get("/admin/users")
    assert resp.status_code == 200, resp.text
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_each_row_carries_a_cursor_that_round_trips(admin_client: httpx.AsyncClient):
    """The cursor a row carries must itself be a value the endpoint accepts back —
    otherwise "Load more" is unusable even when nothing is malformed."""
    first_page = await admin_client.get("/admin/users", params={"limit": 1})
    assert first_page.status_code == 200
    rows = first_page.json()
    if not rows:
        pytest.skip("no users seeded to page through")
    cursor = rows[0]["cursor"]
    second_page = await admin_client.get("/admin/users", params={"cursor": cursor})
    assert second_page.status_code == 200, second_page.text
