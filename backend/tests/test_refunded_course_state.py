"""`access_ended_at` on course detail.

/library and the dashboard both read through `resolve_product_ids`, which already
excludes a revoked entitlement, so a refunded course simply stops appearing there.
Course detail is the exception: it is a *public* page, so a refunded buyer opening it
gets the ordinary buy page back with no acknowledgement that they ever owned it —
which reads as the site having lost their purchase.

These tests pin the three cases apart, because the whole value of the field is that it
distinguishes them:

  never bought      -> access_ended_at is None   (a stranger must learn nothing)
  currently owns    -> access_ended_at is None   (owned=True is the state, not this)
  bought, refunded  -> access_ended_at is set    (the fourth state, finally said)
"""
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_never_bought_reports_no_ended_access(member_client: AsyncClient, content_graph):
    """A reader who never bought the course must not be told anything about refunds —
    the field is null, and the page renders as an ordinary buy page."""
    resp = await member_client.get(f"/courses/{content_graph.course.slug}")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["owned"] is False
    assert body["access_ended_at"] is None


@pytest.mark.asyncio
async def test_anonymous_reader_reports_no_ended_access(anon_client: AsyncClient, content_graph):
    """No signed-in user, no entitlement history to read. Also proves the extra query is
    skipped rather than run with a null user id."""
    resp = await anon_client.get(f"/courses/{content_graph.course.slug}")
    assert resp.status_code == 200, resp.text
    assert resp.json()["access_ended_at"] is None


@pytest.mark.asyncio
async def test_current_owner_reports_no_ended_access(
    member_client: AsyncClient, member_user, content_graph, grant, db_session
):
    """An active entitlement means `owned=True` is the state being communicated. Setting
    `access_ended_at` as well would let the page show a refund notice to someone who
    currently has access."""
    await grant(member_user, content_graph.lesson_product)
    await db_session.flush()

    resp = await member_client.get(f"/courses/{content_graph.course.slug}")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["owned"] is True
    assert body["access_ended_at"] is None


@pytest.mark.asyncio
async def test_refunded_owner_reports_when_access_ended(
    member_client: AsyncClient, member_user, content_graph, grant, db_session
):
    """The case row 92 named. A revoked entitlement removes access (the gate already did
    that) AND now tells the page when it happened, so the buyer sees an explanation
    rather than a buy page that has forgotten them."""
    ended = datetime.now(timezone.utc) - timedelta(days=3)
    entitlement = await grant(member_user, content_graph.lesson_product)
    entitlement.revoked_at = ended
    entitlement.revoked_reason = "refund"
    await db_session.flush()

    resp = await member_client.get(f"/courses/{content_graph.course.slug}")
    assert resp.status_code == 200, resp.text
    body = resp.json()

    # Access really is gone — this must never become a way to keep reading.
    assert body["owned"] is False
    assert body["access_ended_at"] is not None
    assert body["access_ended_at"].startswith(ended.strftime("%Y-%m-%d"))


@pytest.mark.asyncio
async def test_one_row_per_product_means_one_revocation_date(
    member_client: AsyncClient, member_user, content_graph, grant, db_session
):
    """`uq_entitlements_user_product` (migration 010) permits exactly one entitlement row
    per (user, product), and a re-purchase reinstates that row rather than adding one
    (see `test_repurchase_after_refund.py`). So "the most recent revocation" is simply
    "the revocation" — the `ORDER BY revoked_at DESC LIMIT 1` in the handler is
    belt-and-braces against a future schema that relaxes the constraint, not a case this
    schema can currently produce. This test pins the invariant the ordering relies on.
    """
    ended = datetime.now(timezone.utc) - timedelta(days=2)
    entitlement = await grant(member_user, content_graph.lesson_product)
    entitlement.revoked_at = ended
    entitlement.revoked_reason = "refund"
    await db_session.flush()

    resp = await member_client.get(f"/courses/{content_graph.course.slug}")
    assert resp.status_code == 200, resp.text
    assert resp.json()["access_ended_at"].startswith(ended.strftime("%Y-%m-%d"))


@pytest.mark.asyncio
async def test_a_revoked_entitlement_for_a_different_course_is_not_reported(
    member_client: AsyncClient, member_user, content_graph, grant, db_session
):
    """The lookup is scoped to THIS course's lessons. A refund of an unrelated template
    product must not put a refund notice on a course the reader never bought."""
    entitlement = await grant(member_user, content_graph.template_product)
    entitlement.revoked_at = datetime.now(timezone.utc) - timedelta(days=1)
    entitlement.revoked_reason = "refund"
    await db_session.flush()

    resp = await member_client.get(f"/courses/{content_graph.course.slug}")
    assert resp.status_code == 200, resp.text
    assert resp.json()["access_ended_at"] is None
