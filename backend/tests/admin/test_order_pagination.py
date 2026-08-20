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
import httpx
import pytest


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
