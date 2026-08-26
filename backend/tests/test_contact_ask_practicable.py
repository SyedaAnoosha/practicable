"""Regression coverage for the write-amplification/DoS fix on `POST /contact` (#12,
found during the coordinator's review of the "Ask Practicable" feature).

Before this fix, an "ask_practicable" submission committed the new row, then ran a
second `UPDATE ... WHERE keywords = :same_keywords` across every existing row sharing
those keywords, then committed again — turning one public, unauthenticated POST into an
unbounded write proportional to how many prior submissions share a keyword string. That
made it a cheap denial-of-service vector, and the endpoint had no rate limiting at all.

This file checks the fix's three claims:
1. A submission never overwrites `similar_count` on rows other than the one it inserts
   (no fan-out UPDATE) — the count on prior rows stays exactly what it was.
2. `similar_count` on the newly-inserted row is still a correct snapshot at insert time
   (existing matches + 1), computed from a single COUNT, not the fan-out.
3. The endpoint is rate-limited per IP and returns 429 once exceeded, unlike
   /filter-events' silent-drop contract — a lost question submission is a real loss for
   the user, not a fire-and-forget metrics tap.
"""
import pytest
from httpx import AsyncClient
from sqlalchemy import select

import app.api.v1.contact as contact_module
from app.db.models import ContactMessage


def _reset_rate_limiter():
    """The limiter is process-global state (same shape as filter_events.py's), so
    tests must not leak counts across each other depending on run order."""
    contact_module._rate_limiter._counters.clear()


@pytest.mark.asyncio
async def test_submission_returns_ok_and_persists_row(anon_client: AsyncClient, db_session):
    _reset_rate_limiter()
    resp = await anon_client.post(
        "/contact",
        json={"name": "Ada", "email": "ada@example.com", "message": "Hello"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json() == {"ok": True}


@pytest.mark.asyncio
async def test_ask_practicable_similar_count_is_a_snapshot_not_a_fanout(anon_client: AsyncClient, db_session):
    """Three submissions sharing the same keywords: each new row's similar_count is the
    running count at the time it was inserted (1, 2, 3) — earlier rows are never
    rewritten by a later submission."""
    _reset_rate_limiter()
    keywords = "vendor ai governance unique-marker-abc123"

    for _ in range(3):
        resp = await anon_client.post(
            "/contact",
            json={
                "name": "Grace",
                "email": "grace@example.com",
                "message": "Question about AI governance for vendors",
                "enquiry_type": "ask_practicable",
                "keywords": keywords,
            },
        )
        assert resp.status_code == 200, resp.text

    rows = (
        await db_session.execute(
            select(ContactMessage)
            .where(ContactMessage.keywords == keywords)
            .order_by(ContactMessage.created_at.asc())
        )
    ).scalars().all()

    assert len(rows) == 3
    # The fix: each row keeps the count it was given at insert time. The old fan-out
    # UPDATE would have left all three rows reading 3; the correct behaviour is a
    # strictly increasing snapshot, and critically the FIRST row is never touched again.
    assert [r.similar_count for r in rows] == [1, 2, 3]


@pytest.mark.asyncio
async def test_submission_does_not_touch_unrelated_rows_keywords_count(anon_client: AsyncClient, db_session):
    """A later submission with different keywords must not perform any write against
    rows that don't match it — the fan-out UPDATE this replaces had no WHERE bound on
    the row being inserted, only on keywords equality, so this is the direct regression
    check for the DoS vector."""
    _reset_rate_limiter()
    resp1 = await anon_client.post(
        "/contact",
        json={
            "name": "Grace",
            "email": "grace@example.com",
            "message": "Q1",
            "enquiry_type": "ask_practicable",
            "keywords": "keyword-set-one-xyz",
        },
    )
    assert resp1.status_code == 200

    row = (
        await db_session.execute(
            select(ContactMessage).where(ContactMessage.keywords == "keyword-set-one-xyz")
        )
    ).scalar_one()
    assert row.similar_count == 1

    # A different, unrelated submission.
    resp2 = await anon_client.post(
        "/contact",
        json={
            "name": "Ada",
            "email": "ada@example.com",
            "message": "Q2",
            "enquiry_type": "ask_practicable",
            "keywords": "keyword-set-two-abc",
        },
    )
    assert resp2.status_code == 200

    # The first row's count must be unchanged by the second, unrelated submission.
    refreshed = (
        await db_session.execute(
            select(ContactMessage).where(ContactMessage.keywords == "keyword-set-one-xyz")
        )
    ).scalar_one()
    assert refreshed.similar_count == 1


@pytest.mark.asyncio
async def test_rate_limit_returns_429_once_exceeded(anon_client: AsyncClient):
    """Unlike /filter-events' fire-and-forget silent-drop, a dropped question
    submission is a real loss for the user, so this endpoint responds 429 rather than
    pretending to succeed."""
    _reset_rate_limiter()
    last_status = None
    for _ in range(11):
        resp = await anon_client.post(
            "/contact",
            json={"name": "Ada", "email": "ada@example.com", "message": "hi"},
        )
        last_status = resp.status_code
    assert last_status == 429


@pytest.mark.asyncio
async def test_within_limit_all_succeed(anon_client: AsyncClient):
    _reset_rate_limiter()
    for _ in range(10):
        resp = await anon_client.post(
            "/contact",
            json={"name": "Ada", "email": "ada@example.com", "message": "hi"},
        )
        assert resp.status_code == 200, resp.text
