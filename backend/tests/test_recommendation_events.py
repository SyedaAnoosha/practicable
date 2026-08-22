"""Coverage for `POST /recommendation-events` (week4_plan.md W4-R4 item 6, ledger row 29).

W4-R4 asks for a `recommendation_clicked` event so §22's claim — that routing a reader
from a question to a product actually helps — is measured rather than asserted. Ledger
row 29 recorded it absent from both `frontend/src/lib` and the backend.

These tests were written against the endpoint's stated contract and each was confirmed
failing before the endpoint existed (there was no route at all, so every one 404'd),
which is the "seen red first" discipline W4-R9 requires of anything that ships.

The privacy assertion at the bottom is the load-bearing one: the table is deliberately
anonymous, and a later well-meaning "just add user_id so we can segment" would turn an
anonymous counter into a behavioural profile. The test makes that a deliberate act.
"""
import pytest
from httpx import AsyncClient
from sqlalchemy import func, select

from app.db.models import RecommendationEvent


async def _count(db_session) -> int:
    result = await db_session.execute(select(func.count(RecommendationEvent.id)))
    return result.scalar() or 0


@pytest.mark.asyncio
async def test_question_surface_records_the_pair(anon_client: AsyncClient, db_session):
    """The question surface (§20.5 RoutedProducts) records both ends of the routing."""
    before = await _count(db_session)
    resp = await anon_client.post(
        "/recommendation-events",
        json={
            "surface": "question",
            "question_slug": "how-do-i-start-a-risk-register",
            "product_slug": "risk-register-fundamentals",
        },
    )
    assert resp.status_code == 202, resp.text
    assert resp.json() == {"ok": True}
    assert await _count(db_session) == before + 1

    row = (
        await db_session.execute(
            select(RecommendationEvent).order_by(RecommendationEvent.created_at.desc()).limit(1)
        )
    ).scalar_one()
    assert row.surface == "question"
    assert row.question_slug == "how-do-i-start-a-risk-register"
    assert row.product_slug == "risk-register-fundamentals"


@pytest.mark.asyncio
async def test_catalogue_surface_records_without_a_question(anon_client: AsyncClient, db_session):
    """The catalogue surface (§20.6 SituationProducts) routes from a filter result set,
    not one question, so `question_slug` is legitimately absent — and the row must be
    accepted rather than refused, because inventing a question would make the metric
    lie about where the reader came from."""
    before = await _count(db_session)
    resp = await anon_client.post(
        "/recommendation-events",
        json={"surface": "catalogue", "product_slug": "risk-register-bundle"},
    )
    assert resp.status_code == 202, resp.text
    assert await _count(db_session) == before + 1

    row = (
        await db_session.execute(
            select(RecommendationEvent).order_by(RecommendationEvent.created_at.desc()).limit(1)
        )
    ).scalar_one()
    assert row.surface == "catalogue"
    assert row.question_slug is None


@pytest.mark.asyncio
async def test_unknown_surface_is_refused(anon_client: AsyncClient, db_session):
    """A typo'd constant must not silently pollute the metric with a third surface."""
    before = await _count(db_session)
    resp = await anon_client.post(
        "/recommendation-events",
        json={"surface": "sidebar", "product_slug": "risk-register-bundle"},
    )
    assert resp.status_code == 422
    assert resp.json()["detail"]["error"]["code"] == "unknown_surface"
    assert await _count(db_session) == before


@pytest.mark.asyncio
async def test_missing_product_is_refused(anon_client: AsyncClient, db_session):
    """A recommendation click with no destination is a bug, not an event: a row that
    can never be joined to a product answers no question and inflates every count."""
    before = await _count(db_session)
    resp = await anon_client.post(
        "/recommendation-events", json={"surface": "question", "product_slug": ""}
    )
    assert resp.status_code == 422
    assert resp.json()["detail"]["error"]["code"] == "missing_product"
    assert await _count(db_session) == before


@pytest.mark.asyncio
async def test_absent_product_field_is_refused(anon_client: AsyncClient):
    """Pydantic's own required-field rejection, distinct from the empty-string case."""
    resp = await anon_client.post("/recommendation-events", json={"surface": "question"})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_unexpected_field_is_refused(anon_client: AsyncClient, db_session):
    """`extra="forbid"` is load-bearing for the same reason it is on `FilterEventIn`:
    an undeclared field is how PII arrives by accident, and Pydantic v2's default would
    silently drop it rather than reject the request."""
    before = await _count(db_session)
    resp = await anon_client.post(
        "/recommendation-events",
        json={
            "surface": "question",
            "product_slug": "risk-register-bundle",
            "user_email": "someone@example.com",
        },
    )
    assert resp.status_code == 422
    assert await _count(db_session) == before


@pytest.mark.asyncio
async def test_no_identifying_column_exists_on_the_table():
    """The table is anonymous by design (migration 024's own docstring). This asserts
    that on the model, so adding an identity column becomes a deliberate act that breaks
    a test rather than a quiet change to what the platform records about its readers."""
    columns = set(RecommendationEvent.__table__.columns.keys())
    assert columns == {"id", "created_at", "surface", "question_slug", "product_slug"}
    for forbidden in ("user_id", "session_id", "ip", "ip_address", "email"):
        assert forbidden not in columns
