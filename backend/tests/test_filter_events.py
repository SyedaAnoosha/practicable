"""Regression coverage for `POST /filter-events`.

regression: `FilterEventIn` needs `model_config = {"extra": "forbid"}` so a bogus
field sent alongside one real dimension is rejected with 422. Without it, Pydantic
v2's default (`extra="ignore"`) silently dropped the unknown field and accepted the
request with 202.
"""
import pytest
from httpx import AsyncClient
from sqlalchemy import func, select

from app.db.models import FilterEvent


async def _filter_event_count(db_session) -> int:
    result = await db_session.execute(select(func.count(FilterEvent.id)))
    return result.scalar() or 0


@pytest.mark.asyncio
async def test_valid_dimension_returns_202_and_records_row(anon_client: AsyncClient, db_session):
    before = await _filter_event_count(db_session)
    resp = await anon_client.post("/filter-events", json={"effort": "mod"})
    assert resp.status_code == 202, resp.text
    assert resp.json() == {"ok": True}
    after = await _filter_event_count(db_session)
    assert after == before + 1


@pytest.mark.asyncio
async def test_empty_body_returns_422(anon_client: AsyncClient):
    resp = await anon_client.post("/filter-events", json={})
    assert resp.status_code == 422
    assert resp.json()["detail"]["error"]["code"] == "no_dimensions"


@pytest.mark.asyncio
async def test_unknown_field_alongside_real_one_returns_422_not_202(anon_client: AsyncClient, db_session):
    """The real bug this test was written to catch: a bogus/unexpected field must be
    rejected outright, not silently dropped and the request accepted anyway — an open
    sink for arbitrary text is exactly how PII arrives by accident (step 3's own
    reasoning)."""
    before = await _filter_event_count(db_session)
    resp = await anon_client.post(
        "/filter-events",
        json={"effort": "mod", "not_a_real_dimension": "user@example.com free text"},
    )
    assert resp.status_code == 422, resp.text
    after = await _filter_event_count(db_session)
    assert after == before  # nothing written for a rejected request


@pytest.mark.asyncio
async def test_no_ip_column_exists_on_the_model():
    """Privacy constraint (migration 014's docstring): the table must not be able to
    carry an IP even if a future edit tried to pass one through."""
    assert not hasattr(FilterEvent, "ip_address")
    assert not hasattr(FilterEvent, "user_id")
    assert not hasattr(FilterEvent, "session_id")


@pytest.mark.asyncio
async def test_multiple_dimensions_in_one_event(anon_client: AsyncClient, db_session):
    resp = await anon_client.post(
        "/filter-events",
        json={"effort": "mod", "tier": ["free", "paid"], "result_count": 5},
    )
    assert resp.status_code == 202, resp.text

    result = await db_session.execute(select(FilterEvent).order_by(FilterEvent.created_at.desc()).limit(1))
    event = result.scalar_one()
    assert event.effort == "mod"
    assert event.tier == ["free", "paid"]
    assert event.result_count == 5


@pytest.mark.asyncio
async def test_rate_limit_silently_drops_over_threshold(anon_client: AsyncClient, db_session):
    """31st request in a window returns 202 (fire-and-forget contract — never blocks
    a filter tap) but is silently dropped rather than written."""
    before = await _filter_event_count(db_session)
    last_status = None
    for _ in range(31):
        resp = await anon_client.post("/filter-events", json={"effort": "mod"})
        last_status = resp.status_code
    assert last_status == 202
    after = await _filter_event_count(db_session)
    # At most 30 of the 31 requests should have written a row.
    assert after - before <= 30
