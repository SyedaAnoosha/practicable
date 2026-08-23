"""Every write endpoint must actually commit - the open risk from week 5, closed.

**The defect this guards.** `get_session` yields a session and never commits it, and
`record_audit` deliberately does not commit either. An endpoint that writes rows and
omits `await session.commit()` therefore loses the work when the request ends. In
production the row is simply gone; the caller still gets its 200.

**Why the suite could not see it.** `conftest.db_session` runs each test inside one
outer transaction with `join_transaction_mode="create_savepoint"`, so a flushed-but-
uncommitted row stays readable by every later statement on that connection. Asserting
"the row is there afterwards" passes either way. Seven endpoints shipped missing their
commit - promotions create/update/deactivate, review moderation, review submission,
notes, bookmarks - and 490 tests stayed green across all of them.

**What is asserted here instead.** Not whether the row survived, but whether the code
*asked* it to: `asserts_commit` counts `Session.commit()` via SQLAlchemy's `after_commit`
event, which does not fire for the fixture's savepoint restarts. That distinguishes a
real commit from the fixture's illusion of one, which is exactly the distinction the
rest of the suite cannot make.

These tests are deliberately thin on response-shape assertions - the feature suites
already cover that. Each one exists to answer a single question: did this endpoint
commit? A regression that drops a commit turns one of these red and names the fix.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Role, User

pytestmark = pytest.mark.asyncio


# -- The guard itself --------------------------------------------------------
# If `asserts_commit` cannot tell a committing block from a non-committing one, every
# test below is decoration. These two prove it can, so the guard is not taken on trust.

async def test_the_guard_passes_when_the_code_commits(
    db_session: AsyncSession, asserts_commit,
):
    with asserts_commit():
        db_session.add(
            User(id=uuid.uuid4(), email=f"c-{uuid.uuid4().hex[:8]}@x.test", role=Role.MEMBER)
        )
        await db_session.commit()


async def test_the_guard_fails_when_the_code_only_flushes(
    db_session: AsyncSession, asserts_commit,
):
    """A flush without a commit must be caught.

    This is the shape of the actual bug: the row is written, stays readable for the
    rest of the test, and is discarded in production. The flushed row IS queryable
    afterwards - which is precisely why a "did the row land?" assertion cannot detect
    this, and why this one can.
    """
    with pytest.raises(AssertionError, match="never committed"):
        with asserts_commit():
            db_session.add(
                User(id=uuid.uuid4(), email=f"f-{uuid.uuid4().hex[:8]}@x.test", role=Role.MEMBER)
            )
            await db_session.flush()


# -- The endpoints that shipped without one ----------------------------------

async def test_creating_a_promotion_commits(admin_client: AsyncClient, asserts_commit):
    with asserts_commit():
        resp = await admin_client.post(
            "/admin/promotions",
            json={
                "code": f"TEST{uuid.uuid4().hex[:8].upper()}",
                "message": "commit guard",
                "percent_off": 10,
                "starts_at": datetime.now(timezone.utc).isoformat(),
                "active": True,
            },
        )
    assert resp.status_code in (200, 201), resp.text


async def test_updating_a_promotion_commits(admin_client: AsyncClient, asserts_commit):
    created = await admin_client.post(
        "/admin/promotions",
        json={
            "code": f"UPD{uuid.uuid4().hex[:8].upper()}",
            "message": "before",
            "percent_off": 10,
            "starts_at": datetime.now(timezone.utc).isoformat(),
            "active": True,
        },
    )
    assert created.status_code in (200, 201), created.text
    promo_id = created.json()["id"]

    with asserts_commit():
        resp = await admin_client.patch(
            f"/admin/promotions/{promo_id}", json={"message": "after"},
        )
    assert resp.status_code == 200, resp.text


async def test_deactivating_a_promotion_commits(admin_client: AsyncClient, asserts_commit):
    created = await admin_client.post(
        "/admin/promotions",
        json={
            "code": f"DEA{uuid.uuid4().hex[:8].upper()}",
            "message": "to deactivate",
            "percent_off": 10,
            "starts_at": datetime.now(timezone.utc).isoformat(),
            "active": True,
        },
    )
    assert created.status_code in (200, 201), created.text
    promo_id = created.json()["id"]

    with asserts_commit():
        resp = await admin_client.post(f"/admin/promotions/{promo_id}/deactivate")
    assert resp.status_code == 200, resp.text


async def test_saving_a_note_commits(
    entitled_client: AsyncClient, content_graph, asserts_commit,
):
    """An autosaving panel that shows "Saved" over work that was not saved."""
    with asserts_commit():
        resp = await entitled_client.put(
            f"/me/notes/{content_graph.lesson.id}",
            json={"body": "a note that must survive the request"},
        )
    assert resp.status_code in (200, 201), resp.text


async def test_deleting_a_note_commits(
    entitled_client: AsyncClient, content_graph, asserts_commit,
):
    await entitled_client.put(
        f"/me/notes/{content_graph.lesson.id}", json={"body": "x"},
    )
    with asserts_commit():
        resp = await entitled_client.delete(f"/me/notes/{content_graph.lesson.id}")
    assert resp.status_code in (200, 204), resp.text


async def test_adding_a_bookmark_commits(
    member_client: AsyncClient, content_graph, asserts_commit,
):
    """Bookmarks were 100% broken in production and green in tests.

    Two independent causes: the model declared an `updated_at` the migration never
    created, and a bare `except` reported the resulting error as 409 "already
    bookmarked". A learner's first bookmark on anything reported as a duplicate.
    """
    with asserts_commit():
        resp = await member_client.post(
            "/me/bookmarks",
            json={"content_type": "course", "content_id": str(content_graph.course.id)},
        )
    assert resp.status_code in (200, 201), resp.text


async def test_removing_a_bookmark_commits(
    member_client: AsyncClient, content_graph, asserts_commit,
):
    created = await member_client.post(
        "/me/bookmarks",
        json={"content_type": "course", "content_id": str(content_graph.course.id)},
    )
    assert created.status_code in (200, 201), created.text
    bookmark_id = created.json()["id"]

    with asserts_commit():
        resp = await member_client.delete(f"/me/bookmarks/{bookmark_id}")
    assert resp.status_code in (200, 204), resp.text
