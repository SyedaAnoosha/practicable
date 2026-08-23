"""`[ADDED 2026-08-22]` Regression cover for the course catalogue's duration field.

The `/courses` list endpoint had no test touching `estimated_duration_minutes`,
`min_duration` or `max_duration` at all, which is how three separate defects survived:

  1. `Media.duration_seconds` was summed and returned as `estimated_duration_minutes`
     — a 60x overstatement on every card (a three-minute video read as "184 min").
  2. The authored `Course.estimated_duration_minutes` column, which every seed script
     populates, was never read, so reading-only courses reported `null` forever.
  3. `max_duration` used `.get(id, 0)`, so a course with *unknown* duration scored zero
     and passed every "under N minutes" filter.

Each test below fails against the old implementation.
"""
from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Course, Lesson, LessonType, Media, MediaStatus, Module

pytestmark = pytest.mark.asyncio


def _slug(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:10]}"


async def _make_course(
    db_session: AsyncSession,
    *,
    authored_minutes: int | None,
    video_seconds: int | None,
    author_id,
    section_id,
) -> Course:
    """A published course with one published lesson, optionally carrying media."""
    course = Course(
        slug=_slug("dur-course"),
        title="Duration Course",
        description="d",
        section_id=section_id,
        author_id=author_id,
        published=True,
        estimated_duration_minutes=authored_minutes,
    )
    db_session.add(course)
    await db_session.flush()

    module = Module(title="M1", sort_order=0, course_id=course.id)
    db_session.add(module)
    await db_session.flush()

    lesson = Lesson(
        slug=_slug("dur-lesson"),
        title="Lesson",
        description="d",
        lesson_type=LessonType.VIDEO if video_seconds is not None else LessonType.READING,
        body="body",
        module_id=module.id,
        sort_order=0,
        published=True,
    )
    db_session.add(lesson)
    await db_session.flush()

    if video_seconds is not None:
        db_session.add(
            Media(
                lesson_id=lesson.id,
                mux_asset_id=f"asset_{uuid.uuid4().hex[:10]}",
                mux_playback_id=f"pb_{uuid.uuid4().hex[:12]}",
                status=MediaStatus.READY,
                duration_seconds=video_seconds,
            )
        )
    await db_session.flush()
    return course


async def _ids(db_session: AsyncSession, content_graph):
    """Reuse the shared graph's section/author so we don't duplicate taxonomy rows."""
    course = (
        await db_session.execute(select(Course).where(Course.id == content_graph.course.id))
    ).scalar_one()
    return course.section_id, course.author_id


async def _fetch(anon_client: AsyncClient, slug: str, **params):
    resp = await anon_client.get("/courses", params=params or None)
    assert resp.status_code == 200, resp.text
    return next((c for c in resp.json() if c["slug"] == slug), None)


async def test_video_duration_is_reported_in_minutes_not_seconds(
    db_session: AsyncSession, anon_client: AsyncClient, content_graph
):
    """A 10-minute video must read as 10, not 600."""
    section_id, author_id = await _ids(db_session, content_graph)
    course = await _make_course(
        db_session, authored_minutes=None, video_seconds=600,
        author_id=author_id, section_id=section_id,
    )
    await db_session.commit()

    body = await _fetch(anon_client, course.slug)
    assert body is not None
    assert body["estimated_duration_minutes"] == 10


async def test_partial_minute_of_video_rounds_up_rather_than_vanishing(
    db_session: AsyncSession, anon_client: AsyncClient, content_graph
):
    """40 seconds is not "0 min" — a course that exists has a non-zero length."""
    section_id, author_id = await _ids(db_session, content_graph)
    course = await _make_course(
        db_session, authored_minutes=None, video_seconds=40,
        author_id=author_id, section_id=section_id,
    )
    await db_session.commit()

    body = await _fetch(anon_client, course.slug)
    assert body is not None
    assert body["estimated_duration_minutes"] == 1


async def test_reading_only_course_reports_its_authored_duration(
    db_session: AsyncSession, anon_client: AsyncClient, content_graph
):
    """No Media rows at all — the authored column is the only source, and it was ignored."""
    section_id, author_id = await _ids(db_session, content_graph)
    course = await _make_course(
        db_session, authored_minutes=140, video_seconds=None,
        author_id=author_id, section_id=section_id,
    )
    await db_session.commit()

    body = await _fetch(anon_client, course.slug)
    assert body is not None
    assert body["estimated_duration_minutes"] == 140


async def test_authored_duration_wins_over_computed_video_time(
    db_session: AsyncSession, anon_client: AsyncClient, content_graph
):
    """The authored figure covers reading time too, so it is the better number."""
    section_id, author_id = await _ids(db_session, content_graph)
    course = await _make_course(
        db_session, authored_minutes=90, video_seconds=600,
        author_id=author_id, section_id=section_id,
    )
    await db_session.commit()

    body = await _fetch(anon_client, course.slug)
    assert body is not None
    assert body["estimated_duration_minutes"] == 90


async def test_duration_filters_bound_on_the_same_unit_they_report(
    db_session: AsyncSession, anon_client: AsyncClient, content_graph
):
    """min/max are documented as minutes; the comparison used to be against seconds."""
    section_id, author_id = await _ids(db_session, content_graph)
    short = await _make_course(
        db_session, authored_minutes=30, video_seconds=None,
        author_id=author_id, section_id=section_id,
    )
    long = await _make_course(
        db_session, authored_minutes=200, video_seconds=None,
        author_id=author_id, section_id=section_id,
    )
    await db_session.commit()

    assert await _fetch(anon_client, short.slug, max_duration=60) is not None
    assert await _fetch(anon_client, long.slug, max_duration=60) is None
    assert await _fetch(anon_client, long.slug, min_duration=100) is not None
    assert await _fetch(anon_client, short.slug, min_duration=100) is None


async def test_unknown_duration_does_not_pass_the_upper_bound_filter(
    db_session: AsyncSession, anon_client: AsyncClient, content_graph
):
    """`.get(id, 0)` made the courses we know least about look like the shortest ones."""
    section_id, author_id = await _ids(db_session, content_graph)
    unknown = await _make_course(
        db_session, authored_minutes=None, video_seconds=None,
        author_id=author_id, section_id=section_id,
    )
    await db_session.commit()

    assert await _fetch(anon_client, unknown.slug) is not None
    body = await _fetch(anon_client, unknown.slug)
    assert body["estimated_duration_minutes"] is None
    assert await _fetch(anon_client, unknown.slug, max_duration=30) is None
