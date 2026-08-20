"""Query-count tests for the question → product routing endpoints.

week4_plan.md Phase 4 step 5: "A query-count test asserting a fixed number of
queries regardless of catalogue size. This is the discipline the four N+1 fixes
established; it is worth one test rather than another handover paragraph."

The method: count every `SELECT` statement emitted against the session during a
single request. A fixed count means no N+1 — the query count cannot scale with
catalogue or content size.
"""
from __future__ import annotations

import uuid
from typing import AsyncIterator

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    Domain,
    Product,
    ProductContent,
    Question,
    QuestionRelation,
)


class QueryCounter:
    """Counts SELECT statements emitted on a session."""

    def __init__(self, session: AsyncSession) -> None:
        self.count = 0
        self._session = session
        self._listener = self._on_execute

    def start(self) -> None:
        event.listen(self._session.sync_session, "do_orm_execute", self._listener)

    def stop(self) -> None:
        event.remove(self._session.sync_session, "do_orm_execute", self._listener)

    def _on_execute(self, orm_context) -> None:
        self.count += 1


# ── Fixtures ──────────────────────────────────────────────────────────────────


def _slug(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:10]}"


@pytest_asyncio.fixture
async def routing_graph(db_session: AsyncSession):
    """A question with two products granting it (via product_contents) and a
    related question (via question_relations), enough to exercise both endpoints."""
    domain = Domain(name=f"Routing Domain {uuid.uuid4().hex[:6]}", slug=_slug("domain"))
    db_session.add(domain)
    await db_session.flush()

    # Two questions — one with products, one without
    q1 = Question(
        slug=_slug("q1"), title="Question One", subtitle="s",
        body="body", preview="preview", domain_id=domain.id, published=True,
    )
    q2 = Question(
        slug=_slug("q2"), title="Question Two", subtitle="s",
        body="body", preview="preview", domain_id=domain.id, published=True,
    )
    db_session.add_all([q1, q2])
    await db_session.flush()

    # Related: q1 → q2
    rel = QuestionRelation(question_id=q1.id, related_question_id=q2.id, sort_order=0)
    db_session.add(rel)

    # Two published products granting q1
    p1 = Product(
        slug=_slug("prod1"), name="Product One", description="d",
        stripe_price_id=f"price_{uuid.uuid4().hex[:12]}",
        price_amount=2900, currency="AUD", published=True,
    )
    p2 = Product(
        slug=_slug("prod2"), name="Product Two", description="d",
        stripe_price_id=f"price_{uuid.uuid4().hex[:12]}",
        price_amount=4900, currency="AUD", published=True,
    )
    db_session.add_all([p1, p2])
    await db_session.flush()

    db_session.add_all([
        ProductContent(product_id=p1.id, content_type="question_set", content_id=q1.id),
        ProductContent(product_id=p2.id, content_type="question_set", content_id=q1.id),
    ])
    await db_session.flush()

    class G:
        pass

    g = G()
    g.domain = domain
    g.q1, g.q2 = q1, q2
    g.p1, g.p2 = p1, p2
    return g


# ── Tests ─────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_related_products_fixed_query_count(
    anon_client: AsyncClient, routing_graph, db_session: AsyncSession,
):
    """GET /questions/{slug}/related-products issues a fixed number of queries
    (exactly 2: one for the question, one for the products) regardless of how
    many products grant the question."""
    counter = QueryCounter(db_session)
    counter.start()
    try:
        resp = await anon_client.get(f"/questions/{routing_graph.q1.slug}/related-products")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2  # both products found
        # Fixed count: 2 queries (question lookup + product join)
        assert counter.count == 2, (
            f"Expected exactly 2 queries, got {counter.count}. "
            "This endpoint must not N+1 per product."
        )
    finally:
        counter.stop()


@pytest.mark.asyncio
async def test_related_products_empty_for_ungranted_question(
    anon_client: AsyncClient, routing_graph, db_session: AsyncSession,
):
    """A question with no products returns an empty list with a fixed query count."""
    counter = QueryCounter(db_session)
    counter.start()
    try:
        resp = await anon_client.get(f"/questions/{routing_graph.q2.slug}/related-products")
        assert resp.status_code == 200
        data = resp.json()
        assert data == []
        assert counter.count == 2, (
            f"Expected exactly 2 queries, got {counter.count}. "
            "Even an empty result must not alter the query shape."
        )
    finally:
        counter.stop()


@pytest.mark.asyncio
async def test_for_questions_fixed_query_count(
    anon_client: AsyncClient, routing_graph, db_session: AsyncSession,
):
    """GET /products/for-questions?ids=... issues a fixed number of queries
    regardless of how many question ids are passed or how many products match."""
    counter = QueryCounter(db_session)
    counter.start()
    try:
        q1_id = str(routing_graph.q1.id)
        q2_id = str(routing_graph.q2.id)
        resp = await anon_client.get(
            "/products/for-questions",
            params=[("ids", q1_id), ("ids", q2_id)],
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2  # both products found (via q1)
        # The _resolve_contents_bulk call adds queries, but they are bounded
        # (one per content type present), not per-product. Assert a ceiling
        # that allows for the bulk queries but prohibits N+1.
        assert counter.count <= 4, (
            f"Expected at most 4 queries, got {counter.count}. "
            "This endpoint must not N+1 per product or per content row."
        )
    finally:
        counter.stop()


@pytest.mark.asyncio
async def test_for_questions_invalid_uuid(
    anon_client: AsyncClient, db_session: AsyncSession,
):
    """An invalid UUID returns 400 with zero queries."""
    counter = QueryCounter(db_session)
    counter.start()
    try:
        resp = await anon_client.get(
            "/products/for-questions",
            params=[("ids", "not-a-uuid")],
        )
        assert resp.status_code == 400
        assert counter.count == 0, (
            f"Expected 0 queries for an invalid request, got {counter.count}."
        )
    finally:
        counter.stop()
