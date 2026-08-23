"""Tests for W5-R5 — Notes and bookmarks.

Phase 5 shipped with no test file at all. These cover the guarantees the schema
and the endpoints actually make:

- A note is one per lesson per learner, edited in place by a second PUT
- Notes and bookmarks are scoped to their owner — another user's are invisible,
  and deleting one you don't own is a 404 rather than a 403
- A duplicate bookmark is a 409, enforced by UNIQUE, not by a pre-check
- Deleting a note or bookmark actually removes it

The ownership tests matter most: every one of these endpoints takes an id from
the URL, and an endpoint that looked it up without also filtering on `user_id`
would hand one learner another learner's private notes while passing every
happy-path test in this file.
"""
from __future__ import annotations

import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    Author,
    Bookmark,
    Course,
    Lesson,
    LessonType,
    Module,
    Role,
    Section,
    Template,
    User,
    UserNote,
)
from main import app
from tests.conftest import make_fake_token

pytestmark = pytest.mark.asyncio


async def _make_lesson(db_session: AsyncSession) -> tuple[Course, Lesson]:
    section = Section(name="NB Section", slug=f"section-{uuid.uuid4().hex[:8]}")
    author = Author(name="NB Author", slug=f"author-{uuid.uuid4().hex[:8]}")
    db_session.add_all([section, author])
    await db_session.flush()

    course = Course(
        slug=f"nb-course-{uuid.uuid4().hex[:8]}",
        title="Notes Test Course",
        description="d",
        section_id=section.id,
        author_id=author.id,
        published=True,
    )
    db_session.add(course)
    await db_session.flush()

    module = Module(title="Module 1", sort_order=0, course_id=course.id)
    db_session.add(module)
    await db_session.flush()

    lesson = Lesson(
        slug=f"nb-lesson-{uuid.uuid4().hex[:8]}",
        title="Notes Test Lesson",
        description="d",
        lesson_type=LessonType.READING,
        body="body",
        module_id=module.id,
        sort_order=0,
        published=True,
    )
    db_session.add(lesson)
    await db_session.flush()

    return course, lesson


async def _make_user(db_session: AsyncSession) -> User:
    user = User(
        id=uuid.uuid4(),
        email=f"nb-{uuid.uuid4().hex[:8]}@example.test",
        role=Role.MEMBER,
        name="Note Taker",
    )
    db_session.add(user)
    await db_session.flush()
    return user


def _client(user: User) -> AsyncClient:
    token = make_fake_token(user.id, user.email, user.name or "")
    return AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://testserver",
        headers={"Authorization": f"Bearer {token}"},
    )


# ── Notes ────────────────────────────────────────────────────────────────────


async def test_put_note_creates_then_edits_in_place(db_session: AsyncSession):
    """A second PUT replaces the body and keeps the same row.

    UNIQUE(user_id, lesson_id) is what makes this an edit rather than a second
    note — asserted by the row count, not just by the response body.
    """
    _course, lesson = await _make_lesson(db_session)
    user = await _make_user(db_session)

    async with _client(user) as client:
        first = await client.put(
            f"/me/notes/{lesson.id}", json={"body": "First thought."}
        )
        assert first.status_code == 200, first.text
        assert first.json()["body"] == "First thought."

        second = await client.put(
            f"/me/notes/{lesson.id}", json={"body": "Revised thought."}
        )
        assert second.status_code == 200
        assert second.json()["body"] == "Revised thought."
        assert second.json()["id"] == first.json()["id"], "A second PUT made a new row."

    count = (
        await db_session.execute(
            select(func.count())
            .select_from(UserNote)
            .where(UserNote.user_id == user.id, UserNote.lesson_id == lesson.id)
        )
    ).scalar_one()
    assert count == 1


async def test_note_for_unknown_lesson_is_404(db_session: AsyncSession):
    """A note must hang off a lesson that exists."""
    user = await _make_user(db_session)
    async with _client(user) as client:
        resp = await client.put(
            f"/me/notes/{uuid.uuid4()}", json={"body": "Orphan note."}
        )
    assert resp.status_code == 404


async def test_notes_are_private_to_their_owner(db_session: AsyncSession):
    """One learner's notes never appear in another's list.

    This is the test that would fail if any query dropped its `user_id` filter —
    the one mistake that turns a private note into a public one.
    """
    _course, lesson = await _make_lesson(db_session)
    author_user = await _make_user(db_session)
    other_user = await _make_user(db_session)

    async with _client(author_user) as client:
        await client.put(f"/me/notes/{lesson.id}", json={"body": "Private."})

    async with _client(other_user) as client:
        listing = await client.get("/me/notes")
        assert listing.status_code == 200
        assert listing.json() == []

        # And deleting it is a 404 — the note is not merely hidden from the list.
        deleted = await client.delete(f"/me/notes/{lesson.id}")
        assert deleted.status_code == 404

    still_there = (
        await db_session.execute(
            select(func.count())
            .select_from(UserNote)
            .where(UserNote.user_id == author_user.id)
        )
    ).scalar_one()
    assert still_there == 1


async def test_delete_note_removes_it(db_session: AsyncSession):
    _course, lesson = await _make_lesson(db_session)
    user = await _make_user(db_session)

    async with _client(user) as client:
        await client.put(f"/me/notes/{lesson.id}", json={"body": "Delete me."})
        resp = await client.delete(f"/me/notes/{lesson.id}")
        assert resp.status_code == 204

        listing = await client.get("/me/notes")
        assert listing.json() == []


# ── Bookmarks ────────────────────────────────────────────────────────────────


async def test_bookmark_create_and_list(db_session: AsyncSession):
    course, _lesson = await _make_lesson(db_session)
    user = await _make_user(db_session)

    async with _client(user) as client:
        resp = await client.post(
            "/me/bookmarks",
            json={"content_type": "course", "content_id": str(course.id)},
        )
        assert resp.status_code == 201, resp.text
        assert resp.json()["content_type"] == "course"

        listing = await client.get("/me/bookmarks")
        assert [b["content_id"] for b in listing.json()] == [str(course.id)]


async def test_duplicate_bookmark_is_409(db_session: AsyncSession):
    """UNIQUE(user_id, content_type, content_id) is the guard, not a pre-check."""
    course, _lesson = await _make_lesson(db_session)
    user = await _make_user(db_session)

    payload = {"content_type": "course", "content_id": str(course.id)}
    async with _client(user) as client:
        assert (await client.post("/me/bookmarks", json=payload)).status_code == 201
        second = await client.post("/me/bookmarks", json=payload)

    assert second.status_code == 409
    assert second.json()["detail"]["error"]["code"] == "already_bookmarked"


async def test_bookmark_rejects_unknown_content_type(db_session: AsyncSession):
    """The endpoint refuses a type the CHECK constraint would reject anyway —
    a 422 at the edge beats an IntegrityError from the database."""
    user = await _make_user(db_session)
    async with _client(user) as client:
        resp = await client.post(
            "/me/bookmarks",
            json={"content_type": "banana", "content_id": str(uuid.uuid4())},
        )
    assert resp.status_code == 422


async def test_bookmarks_are_private_to_their_owner(db_session: AsyncSession):
    """Another user's bookmark is invisible, and deleting it by id is a 404."""
    course, _lesson = await _make_lesson(db_session)
    owner = await _make_user(db_session)
    other = await _make_user(db_session)

    async with _client(owner) as client:
        created = await client.post(
            "/me/bookmarks",
            json={"content_type": "course", "content_id": str(course.id)},
        )
        bookmark_id = created.json()["id"]

    async with _client(other) as client:
        assert (await client.get("/me/bookmarks")).json() == []
        assert (await client.delete(f"/me/bookmarks/{bookmark_id}")).status_code == 404

    survived = (
        await db_session.execute(
            select(func.count())
            .select_from(Bookmark)
            .where(Bookmark.user_id == owner.id)
        )
    ).scalar_one()
    assert survived == 1


async def test_delete_bookmark_removes_it(db_session: AsyncSession):
    course, _lesson = await _make_lesson(db_session)
    user = await _make_user(db_session)

    async with _client(user) as client:
        created = await client.post(
            "/me/bookmarks",
            json={"content_type": "course", "content_id": str(course.id)},
        )
        resp = await client.delete(f"/me/bookmarks/{created.json()['id']}")
        assert resp.status_code == 204
        assert (await client.get("/me/bookmarks")).json() == []


async def test_notes_and_bookmarks_require_authentication(anon_client: AsyncClient):
    """Every one of these endpoints holds personal content and none is public."""
    for method, path, kwargs in (
        ("put", f"/me/notes/{uuid.uuid4()}", {"json": {"body": "x"}}),
        ("get", "/me/notes", {}),
        ("delete", f"/me/notes/{uuid.uuid4()}", {}),
        ("post", "/me/bookmarks",
         {"json": {"content_type": "course", "content_id": str(uuid.uuid4())}}),
        ("get", "/me/bookmarks", {}),
        ("delete", f"/me/bookmarks/{uuid.uuid4()}", {}),
    ):
        resp = await getattr(anon_client, method)(path, **kwargs)
        assert resp.status_code in (401, 403), f"{method.upper()} {path} → {resp.status_code}"

# ── The saved-items list: resolved titles ────────────────────────────────────
# `GET /me/bookmarks` returned only `(content_type, content_id)`. That is enough for
# the toggle button to know what is saved, and not enough to SHOW someone their saved
# items — a list of bare UUIDs is not a list. These cover the resolution the Saved page
# depends on, including the case where the saved item no longer exists.


async def test_listing_resolves_the_title_and_slug(db_session: AsyncSession):
    """Without this the Saved page can only render UUIDs."""
    course, _lesson = await _make_lesson(db_session)
    user = await _make_user(db_session)

    async with _client(user) as client:
        await client.post(
            "/me/bookmarks",
            json={"content_type": "course", "content_id": str(course.id)},
        )
        row = (await client.get("/me/bookmarks")).json()[0]

    assert row["title"] == course.title
    assert row["slug"] == course.slug
    assert row["available"] is True


async def test_an_item_that_no_longer_exists_is_listed_as_unavailable(
    db_session: AsyncSession,
):
    """An item can be deleted or unpublished after it was saved.

    Dropping the row from the response would make saved items vanish with no
    explanation, which reads as data loss. It stays, flagged `available: false`, so the
    client renders it as unavailable rather than as a link that 404s.

    The bookmark points at an id with no row behind it — the same state the endpoint
    sees once the target is gone. Bookmarks carry no foreign key to their target
    (they span three tables), so this is reachable in production.
    """
    user = await _make_user(db_session)
    missing_id = uuid.uuid4()

    async with _client(user) as client:
        created = await client.post(
            "/me/bookmarks",
            json={"content_type": "course", "content_id": str(missing_id)},
        )
        assert created.status_code == 201, created.text
        rows = (await client.get("/me/bookmarks")).json()

    assert len(rows) == 1, "The bookmark row must survive its target being gone."
    assert rows[0]["available"] is False
    assert rows[0]["title"] is None


async def test_listing_does_not_run_a_query_per_bookmark(db_session: AsyncSession):
    """Resolution is grouped: at most one query per content type, not one per row.

    The naive shape - look up each bookmark as you serialise it - turns a page of 40
    saved items into 40 round trips. Asserted by counting statements rather than by
    reading the code, so a later refactor into a per-row lookup goes red.
    """
    from sqlalchemy import event as sa_event

    section = Section(name="NB Section", slug=f"section-{uuid.uuid4().hex[:8]}")
    author = Author(name="NB Author", slug=f"author-{uuid.uuid4().hex[:8]}")
    db_session.add_all([section, author])
    await db_session.flush()

    templates = [
        Template(
            slug=f"nb-tpl-{uuid.uuid4().hex[:8]}",
            title=f"Template {i}",
            description="d",
            section_id=section.id,
            author_id=author.id,
            storage_key=f"test/{uuid.uuid4().hex}.xlsx",
            file_name="t.xlsx",
            file_size_bytes=512,
            mime_type="application/vnd.ms-excel",
            published=True,
            is_free=True,
        )
        for i in range(3)
    ]
    db_session.add_all(templates)
    await db_session.flush()

    user = await _make_user(db_session)

    async with _client(user) as client:
        for tpl in templates:
            await client.post(
                "/me/bookmarks",
                json={"content_type": "template", "content_id": str(tpl.id)},
            )

        seen: list[str] = []

        def _record(conn, cursor, statement, params, context, executemany):
            seen.append(statement)

        # `get_bind()` already returns the sync Engine here, so listen on it
        # directly — there is no `.sync_engine` to unwrap.
        sync_engine = db_session.get_bind().engine
        sa_event.listen(sync_engine, "before_cursor_execute", _record)
        try:
            rows = (await client.get("/me/bookmarks")).json()
        finally:
            sa_event.remove(sync_engine, "before_cursor_execute", _record)

    assert len(rows) == 3
    template_lookups = [
        st for st in seen
        if st.lstrip().upper().startswith("SELECT") and "FROM templates" in st
    ]
    assert len(template_lookups) <= 1, (
        f"Expected one grouped lookup for all three templates, saw {len(template_lookups)}. "
        "The list endpoint is resolving titles one row at a time."
    )
