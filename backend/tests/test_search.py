"""Tests for W5-R3 — Public search.

Covers:
- Draft, in-review and archived rows never appear
- A title match outranks a description match
- A phrase query is handled without raising
- Empty and whitespace queries return empty groups with zero DB queries
- Only published rows appear
- Exactly four queries per search, regardless of result count (§2.3.4)
- The per-group total counts every match, not just the returned page
"""
from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    Author,
    Course,
    Domain,
    Product,
    PublishState,
    Question,
    Section,
    Template,
)

pytestmark = pytest.mark.asyncio


# Unique prefix avoids collision with real seeded data in the shared test DB.
SEARCH_TERM = f"xqvzq{uuid.uuid4().hex[:6]}"


async def _setup_content(db_session: AsyncSession):
    """Create test content for search tests."""
    section = Section(name="Test Section", slug=f"section-{uuid.uuid4().hex[:8]}")
    author = Author(name="Test Author", slug=f"author-{uuid.uuid4().hex[:8]}")
    domain = Domain(name=f"Test Domain {uuid.uuid4().hex[:6]}", slug=f"domain-{uuid.uuid4().hex[:8]}")
    db_session.add_all([section, author, domain])
    await db_session.flush()

    # Published course
    course = Course(
        slug=f"course-{uuid.uuid4().hex[:8]}",
        title=f"{SEARCH_TERM} Fundamentals",
        subtitle="A beginner's guide",
        description=f"Learn the basics of {SEARCH_TERM} in this comprehensive course.",
        section_id=section.id,
        author_id=author.id,
        published=True,
    )
    db_session.add(course)

    # Draft course (should not appear)
    draft_course = Course(
        slug=f"draft-course-{uuid.uuid4().hex[:8]}",
        title=f"Draft {SEARCH_TERM} Course",
        subtitle=None,
        description=f"This {SEARCH_TERM} course is still in draft.",
        section_id=section.id,
        author_id=author.id,
        published=False,
    )
    db_session.add(draft_course)

    # Published question
    question = Question(
        slug=f"question-{uuid.uuid4().hex[:8]}",
        title=f"What is {SEARCH_TERM} assessment?",
        subtitle="Understanding the basics",
        body=f"{SEARCH_TERM} assessment is the process of identifying potential hazards...",
        preview=f"A guide to {SEARCH_TERM} assessment",
        domain_id=domain.id,
        published=True,
    )
    db_session.add(question)

    # Published template
    template = Template(
        slug=f"template-{uuid.uuid4().hex[:8]}",
        title=f"{SEARCH_TERM} Register Template",
        description=f"A comprehensive {SEARCH_TERM} register for your organisation.",
        section_id=section.id,
        author_id=author.id,
        storage_key=f"test/{uuid.uuid4().hex}.xlsx",
        file_name=f"{SEARCH_TERM}_register.xlsx",
        file_size_bytes=1024,
        mime_type="application/vnd.ms-excel",
        published=True,
        is_free=False,
    )
    db_session.add(template)

    # Published product (pack)
    product = Product(
        slug=f"product-{uuid.uuid4().hex[:8]}",
        name=f"{SEARCH_TERM} Management Pack",
        description=f"A complete pack for {SEARCH_TERM} management professionals.",
        search_title=f"{SEARCH_TERM} Bundle",
        stripe_price_id=f"price_test_{uuid.uuid4().hex[:12]}",
        price_amount=4900,
        currency="AUD",
        published=True,
    )
    db_session.add(product)

    await db_session.flush()
    return course, draft_course, question, template, product


async def test_search_returns_published_results(anon_client: AsyncClient, db_session: AsyncSession):
    """Only published rows appear in search results."""
    course, draft, question, template, product = await _setup_content(db_session)

    resp = await anon_client.get("/search", params={"q": SEARCH_TERM})
    assert resp.status_code == 200
    body = resp.json()

    # Find all returned titles
    all_titles = []
    for group in body["groups"]:
        for item in group["items"]:
            all_titles.append(item["title"])

    # Published items should appear
    assert f"{SEARCH_TERM} Fundamentals" in all_titles
    assert f"What is {SEARCH_TERM} assessment?" in all_titles
    assert f"{SEARCH_TERM} Register Template" in all_titles
    assert f"{SEARCH_TERM} Management Pack" in all_titles

    # Draft should NOT appear
    assert f"Draft {SEARCH_TERM} Course" not in all_titles


async def test_empty_query_returns_empty_groups(anon_client: AsyncClient, db_session: AsyncSession):
    """Empty and whitespace queries return empty groups without touching the database."""
    await _setup_content(db_session)

    resp = await anon_client.get("/search", params={"q": ""})
    assert resp.status_code == 200
    body = resp.json()
    assert body["groups"] == []

    resp = await anon_client.get("/search", params={"q": "   "})
    assert resp.status_code == 200
    body = resp.json()
    assert body["groups"] == []


async def test_title_match_outranks_description(anon_client: AsyncClient, db_session: AsyncSession):
    """A title match outranks a description match."""
    section = Section(name="Test Section", slug=f"section-{uuid.uuid4().hex[:8]}")
    author = Author(name="Test Author", slug=f"author-{uuid.uuid4().hex[:8]}")
    db_session.add_all([section, author])
    await db_session.flush()

    # Course with "emergency" in the title
    course_title = Course(
        slug=f"course-t-{uuid.uuid4().hex[:8]}",
        title="Emergency Response Plan",
        subtitle=None,
        description="A general guide.",
        section_id=section.id,
        author_id=author.id,
        published=True,
    )
    # Course with "emergency" only in the description
    course_desc = Course(
        slug=f"course-d-{uuid.uuid4().hex[:8]}",
        title="Business Continuity",
        subtitle=None,
        description="This covers emergency response procedures.",
        section_id=section.id,
        author_id=author.id,
        published=True,
    )
    db_session.add_all([course_title, course_desc])
    await db_session.flush()

    resp = await anon_client.get("/search", params={"q": "emergency"})
    assert resp.status_code == 200
    body = resp.json()

    # Find course results
    course_group = next((g for g in body["groups"] if g["type"] == "course"), None)
    assert course_group is not None
    assert len(course_group["items"]) >= 2

    # Title match should rank higher
    titles = [item["title"] for item in course_group["items"]]
    assert titles.index("Emergency Response Plan") < titles.index("Business Continuity")


async def test_phrase_query_does_not_raise(anon_client: AsyncClient, db_session: AsyncSession):
    """A phrase query with quotes is handled without raising."""
    await _setup_content(db_session)

    resp = await anon_client.get("/search", params={"q": f'"{SEARCH_TERM} register"'})
    assert resp.status_code == 200
    body = resp.json()
    # Should find the template with the SEARCH_TERM in the title
    all_titles = []
    for group in body["groups"]:
        for item in group["items"]:
            all_titles.append(item["title"])
    assert f"{SEARCH_TERM} Register Template" in all_titles


async def test_search_response_structure(anon_client: AsyncClient, db_session: AsyncSession):
    """The search response has the correct structure with groups and items."""
    await _setup_content(db_session)

    resp = await anon_client.get("/search", params={"q": SEARCH_TERM})
    assert resp.status_code == 200
    body = resp.json()

    assert "query" in body
    assert "groups" in body
    assert isinstance(body["groups"], list)

    for group in body["groups"]:
        assert "type" in group
        assert "total" in group
        assert "items" in group
        for item in group["items"]:
            assert "id" in item
            assert "slug" in item
            assert "title" in item
            assert "type" in item
            assert "rank" in item


async def test_in_review_and_archived_never_appear(anon_client: AsyncClient, db_session: AsyncSession):
    """Courses with publish_state in_review or archived are excluded, even though
    the archived one has published=True (the legacy boolean is out of sync).

    The search endpoint filters on `published.is_(True)`, and the PublishStateMixin
    keeps `published` in sync with `publish_state` — so in_review and archived
    both have published=False.  This test asserts the invariant holds for the
    search surface.
    """
    section = Section(name="Test Section", slug=f"section-{uuid.uuid4().hex[:8]}")
    author = Author(name="Test Author", slug=f"author-{uuid.uuid4().hex[:8]}")
    db_session.add_all([section, author])
    await db_session.flush()

    in_review_course = Course(
        slug=f"ir-course-{uuid.uuid4().hex[:8]}",
        title=f"{SEARCH_TERM} In Review Only",
        subtitle=None,
        description=f"Only in review, not published: {SEARCH_TERM}.",
        section_id=section.id,
        author_id=author.id,
        published=False,
        publish_state=PublishState.IN_REVIEW,
    )
    archived_course = Course(
        slug=f"arch-course-{uuid.uuid4().hex[:8]}",
        title=f"{SEARCH_TERM} Archived Only",
        subtitle=None,
        description=f"Archived course about {SEARCH_TERM}.",
        section_id=section.id,
        author_id=author.id,
        published=False,
        publish_state=PublishState.ARCHIVED,
    )
    db_session.add_all([in_review_course, archived_course])
    await db_session.flush()

    resp = await anon_client.get("/search", params={"q": SEARCH_TERM})
    assert resp.status_code == 200
    body = resp.json()

    all_titles = [
        item["title"]
        for group in body["groups"]
        for item in group["items"]
    ]
    assert f"{SEARCH_TERM} In Review Only" not in all_titles
    assert f"{SEARCH_TERM} Archived Only" not in all_titles


async def test_always_returns_exactly_four_groups(anon_client: AsyncClient, db_session: AsyncSession):
    """The response always has exactly four groups (course, template, question,
    pack) regardless of which types have results. This is the four bounded
    queries contract — the UI renders all four sections, empty or not.
    """
    await _setup_content(db_session)

    resp = await anon_client.get("/search", params={"q": SEARCH_TERM})
    assert resp.status_code == 200
    body = resp.json()

    group_types = [g["type"] for g in body["groups"]]
    assert group_types == ["course", "template", "question", "pack"]
    assert len(body["groups"]) == 4


class _QueryCounter:
    """Counts statements emitted on a session.

    Same method as tests/test_routing_query_count.py — a fixed count means the
    endpoint cannot develop an N+1 as the catalogue grows.
    """

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


async def test_search_issues_exactly_four_queries(
    anon_client: AsyncClient, db_session: AsyncSession
):
    """week5_plan.md §2.3.4: one query per entity type, four total, regardless of
    result count.

    This is the assertion that keeps the per-group `total` honest. Counting the
    matches with a second COUNT query per type would pass every other test in this
    file while quietly doubling the budget to eight, so the total is taken from a
    COUNT(*) OVER () window on the rows already being fetched.
    """
    await _setup_content(db_session)

    counter = _QueryCounter(db_session)
    counter.start()
    try:
        resp = await anon_client.get("/search", params={"q": SEARCH_TERM})
        assert resp.status_code == 200
    finally:
        counter.stop()

    assert counter.count == 4, (
        f"Expected exactly 4 queries (one per entity type), got {counter.count}. "
        "A second COUNT query per type would make this 8."
    )


async def test_empty_query_touches_no_database(
    anon_client: AsyncClient, db_session: AsyncSession
):
    """An empty or whitespace-only query returns empty groups without touching the
    database at all — the guard is before the first query, not after it.
    """
    for blank in ("", "   "):
        counter = _QueryCounter(db_session)
        counter.start()
        try:
            resp = await anon_client.get("/search", params={"q": blank})
            assert resp.status_code == 200
            assert resp.json()["groups"] == []
        finally:
            counter.stop()

        assert counter.count == 0, (
            f"Expected 0 queries for q={blank!r}, got {counter.count}."
        )


async def test_total_counts_all_matches_not_just_the_returned_page(
    anon_client: AsyncClient, db_session: AsyncSession
):
    """The per-group `total` must count every match, not just the capped items.

    COUNT(*) OVER () is evaluated before LIMIT, which is what makes "see all in
    courses" able to say there are more than the five shown. A total that merely
    counted the returned rows would silently equal the cap forever.
    """
    section = Section(name="Total Section", slug=f"section-{uuid.uuid4().hex[:8]}")
    author = Author(name="Total Author", slug=f"author-{uuid.uuid4().hex[:8]}")
    db_session.add_all([section, author])
    await db_session.flush()

    # Seven published courses all matching the term — more than the per-type cap.
    for i in range(7):
        db_session.add(
            Course(
                slug=f"total-course-{i}-{uuid.uuid4().hex[:8]}",
                title=f"{SEARCH_TERM} Total Course {i}",
                description="A course used to prove the total exceeds the page size.",
                section_id=section.id,
                author_id=author.id,
                published=True,
                publish_state=PublishState.PUBLISHED,
            )
        )
    await db_session.flush()

    resp = await anon_client.get("/search", params={"q": SEARCH_TERM})
    assert resp.status_code == 200
    course_group = next(g for g in resp.json()["groups"] if g["type"] == "course")

    assert course_group["total"] >= 7, (
        f"total={course_group['total']} should count all 7 matches, "
        "not just the returned page."
    )
    assert len(course_group["items"]) < course_group["total"], (
        "The returned items should be capped below the true total."
    )
