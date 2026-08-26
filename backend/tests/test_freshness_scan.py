"""The push half of content freshness (#16): POST /admin/freshness/scan.

The passive badges were already tested in test_content_freshness.py. What is tested
here is the delivery contract:

- warnings reach every admin, and only admins — a member's inbox must never fill with
  operational noise they can do nothing about;
- `unknown` (never reviewed) and `stale` (reviewed too long ago) arrive as different
  notifications, carrying the same distinction the badges make;
- a scan is idempotent while warnings sit unread — running it twice must not double-
  notify — but a *dismissed* warning legitimately re-fires on the next scan;
- §16's third signal (high search traffic, near-zero routed-product clicks) flags the
  question it should and spares the one whose routed products are being followed;
- the endpoint commits (repo rule: get_session never auto-commits).
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.db.models import (
    Author,
    Course,
    Domain,
    FilterEvent,
    Notification,
    Question,
    RecommendationEvent,
    Section,
    Template,
    User,
)

NOW = datetime(2026, 8, 25, 12, 0, tzinfo=timezone.utc)


def _slug(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:10]}"


async def _make_template(db_session, *, last_reviewed_at=None):
    section = Section(name=_slug("section"), slug=_slug("section"))
    author_row = Author(name=_slug("author"), slug=_slug("author"))
    db_session.add_all([section, author_row])
    await db_session.flush()
    template = Template(
        slug=_slug("template"), title=f"Stale Template {_slug('t')}", description="d",
        section_id=section.id, author_id=author_row.id,
        storage_key=f"test/{uuid.uuid4().hex}.xlsx", file_name="t.xlsx",
        file_size_bytes=1024, mime_type="application/vnd.ms-excel",
        published=True, is_free=True,
        last_reviewed_at=last_reviewed_at,
    )
    db_session.add(template)
    await db_session.flush()
    return template


async def _make_course(db_session, *, last_reviewed_at=None):
    section = Section(name=_slug("section"), slug=_slug("section"))
    author_row = Author(name=_slug("author"), slug=_slug("author"))
    db_session.add_all([section, author_row])
    await db_session.flush()
    course = Course(
        slug=_slug("course"), title=f"Never Reviewed Course {_slug('c')}", description="d",
        section_id=section.id, author_id=author_row.id, published=True,
        last_reviewed_at=last_reviewed_at,
    )
    db_session.add(course)
    await db_session.flush()
    return course


async def _make_question(db_session, *, title: str, published: bool = True) -> Question:
    domain = Domain(name=_slug("domain"), slug=_slug("domain"))
    db_session.add(domain)
    await db_session.flush()
    question = Question(
        slug=_slug("question"), title=title, body="b", preview="p",
        domain_id=domain.id, published=published,
    )
    db_session.add(question)
    await db_session.flush()
    return question


async def _notifications_for(db_session, user: User):
    rows = (
        await db_session.execute(
            select(Notification).where(Notification.user_id == user.id)
        )
    ).scalars().all()
    return [n for n in rows if n.notification_type in ("content_freshness_warning", "low_conversion_question")]


@pytest.mark.asyncio
async def test_stale_content_notifies_admins_and_never_members(
    admin_client, admin_user, member_user, db_session
):
    """Every admin hears; no member does. A member cannot act on 'template is stale',
    so writing them a row is noise by construction."""
    template = await _make_template(db_session, last_reviewed_at=NOW - timedelta(days=400))

    resp = await admin_client.post("/admin/freshness/scan")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["stale_templates"] >= 1

    admin_notes = await _notifications_for(db_session, admin_user)
    assert any(n.entity_id == template.id for n in admin_notes), (
        "the acting admin was not told about stale content they just scanned"
    )

    member_notes = await _notifications_for(db_session, member_user)
    assert member_notes == [], "a member received an operational warning"


@pytest.mark.asyncio
async def test_unknown_and_stale_are_distinct_notifications(admin_client, admin_user, db_session):
    """The distinction test_content_freshness.py asserts for badges holds for push too:
    never-reviewed says so, rather than fabricating an age for content that has none."""
    never = await _make_course(db_session, last_reviewed_at=None)

    await admin_client.post("/admin/freshness/scan")

    notes = await _notifications_for(db_session, admin_user)
    matching = [n for n in notes if n.entity_id == never.id]
    assert len(matching) == 1
    assert "never reviewed" in matching[0].title.lower()
    assert "months ago" not in matching[0].message.lower(), (
        "an unknown-freshness row claimed an age it has no evidence for"
    )


@pytest.mark.asyncio
async def test_second_scan_does_not_duplicate_unread_warnings(admin_client, admin_user, db_session):
    """Two scans back-to-back must cost one notification per finding, not two — or the
    bell becomes a firehose the moment anyone runs the scan on a schedule."""
    template = await _make_template(db_session, last_reviewed_at=NOW - timedelta(days=400))

    first = await admin_client.post("/admin/freshness/scan")
    created_first = first.json()["notifications_created"]
    assert created_first > 0

    second = await admin_client.post("/admin/freshness/scan")
    assert second.json()["notifications_created"] == 0

    notes = await _notifications_for(db_session, admin_user)
    ours = [n for n in notes if n.entity_id == template.id]
    assert len(ours) == 1, "exactly one warning per stale artefact, even across scans"


@pytest.mark.asyncio
async def test_dismissed_warning_refires_on_next_scan(admin_client, admin_user, db_session):
    """Dismissing is clearing the slate, not muting forever: once read, the next scan
    may warn again — that is what keeps genuinely-stale content from hiding behind one
    old notification nobody will ever see again."""
    await _make_template(db_session, last_reviewed_at=NOW - timedelta(days=400))

    await admin_client.post("/admin/freshness/scan")
    notes = await _notifications_for(db_session, admin_user)
    notes[0].read = True
    await db_session.flush()

    second = await admin_client.post("/admin/freshness/scan")
    assert second.json()["notifications_created"] > 0


@pytest.mark.asyncio
async def test_fresh_content_warns_nobody(admin_client, admin_user, db_session):
    """A recently-reviewed course generates zero warnings for itself. Assertions are
    scoped to the rows this test creates because the dev database legitimately carries
    seeded, never-reviewed content the scan is supposed to flag."""
    course = await _make_course(db_session, last_reviewed_at=NOW - timedelta(days=30))
    template = await _make_template(db_session, last_reviewed_at=NOW - timedelta(days=30))

    await admin_client.post("/admin/freshness/scan")

    notes = await _notifications_for(db_session, admin_user)
    touched = {n.entity_id for n in notes}
    assert course.id not in touched, "fresh content was warned about"
    assert template.id not in touched, "fresh content was warned about"


@pytest.mark.asyncio
async def test_low_conversion_question_is_flagged(admin_client, admin_user, db_session):
    """"§16's third signal, approximated: high search traffic against the title, at most
    a couple of routed clicks. The searches are matched fuzzily (subset of the title),
    because readers type subsets of titles, not titles verbatim."""
    flagged = await _make_question(db_session, title="Do I need cyber insurance?")
    spared = await _make_question(db_session, title="Should my startup incorporate overseas?")

    for _ in range(12):
        # Subset of the flagged question's title — the realistic search shape.
        db_session.add(FilterEvent(query_text="cyber insurance", result_count=3))
        db_session.add(FilterEvent(query_text="should my startup incorporate overseas", result_count=2))
    await db_session.flush()

    # The spared question's routed products ARE being followed; the flagged one's aren't.
    db_session.add(RecommendationEvent(surface="question", question_slug=flagged.slug, product_slug="p-a"))
    for product_slug in ("p-b", "p-c", "p-d"):
        db_session.add(RecommendationEvent(surface="question", question_slug=spared.slug, product_slug=product_slug))
    await db_session.flush()

    resp = await admin_client.post("/admin/freshness/scan")
    assert resp.status_code == 200, resp.text

    conversion_notes = [
        n for n in await _notifications_for(db_session, admin_user)
        if n.notification_type == "low_conversion_question"
    ]
    flagged_ids = {n.entity_id for n in conversion_notes}
    assert flagged.id in flagged_ids, "high-traffic, low-click question went unwarned"
    assert spared.id not in flagged_ids, "well-converting question was flagged"

    note = next(n for n in conversion_notes if n.entity_id == flagged.id)
    assert note.meta["searches"] == 12
    assert note.meta["clicks"] == 1


@pytest.mark.asyncio
async def test_draft_questions_are_never_flagged(admin_client, admin_user, db_session):
    """An unpublished question has no page to convert from — flagging it would ask the
    editor to fix conversion on something readers cannot even reach."""
    question = await _make_question(db_session, title="Do I need cyber insurance?", published=False)
    for _ in range(12):
        db_session.add(FilterEvent(query_text="do i need cyber insurance", result_count=3))
    await db_session.flush()

    await admin_client.post("/admin/freshness/scan")

    notes = await _notifications_for(db_session, admin_user)
    assert all(n.entity_id != question.id for n in notes)


@pytest.mark.asyncio
async def test_scan_commits(db_session, admin_client, asserts_commit):
    """Repo rule: get_session never auto-commits, so every mutating route commits itself.
    A scan that rolled back would leave admins told nothing while the UI claims success."""
    await _make_template(db_session, last_reviewed_at=NOW - timedelta(days=400))

    resp = await admin_client.post("/admin/freshness/scan")
    assert resp.status_code == 200, resp.text


@pytest.mark.asyncio
async def test_scan_requires_admin(anon_client, db_session):
    """Router-level require_admin covers this module like every other admin module —
    proven here, not assumed, since this endpoint writes to many users' inboxes."""
    resp = await anon_client.post("/admin/freshness/scan")
    assert resp.status_code in (401, 403)
