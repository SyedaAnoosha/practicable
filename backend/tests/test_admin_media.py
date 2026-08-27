"""Tests for admin/media.py.

Covers the media library list endpoint and the four distinct playback-token
states — ready, encoding, asset_error, asset_unknown.
"""
import uuid
from unittest.mock import MagicMock, patch

import pytest

from app.db.models import Author, Course, Lesson, LessonType, Media, MediaStatus, Module, Section, User, Role


@pytest.fixture
async def lesson_with_media(db_session):
    """A published course/lesson with an attached Media row, for the media-library
    and playback-token tests below."""
    section = Section(id=uuid.uuid4(), name=f"S-{uuid.uuid4().hex[:6]}", slug=f"s-{uuid.uuid4().hex[:8]}")
    author = Author(id=uuid.uuid4(), name=f"A-{uuid.uuid4().hex[:6]}", slug=f"a-{uuid.uuid4().hex[:8]}")
    db_session.add_all([section, author])
    await db_session.flush()

    course = Course(
        id=uuid.uuid4(), slug=f"media-course-{uuid.uuid4().hex[:8]}", title="Media Test Course",
        description="d", section_id=section.id, author_id=author.id, published=True,
    )
    db_session.add(course)
    await db_session.flush()

    module = Module(id=uuid.uuid4(), title="M1", sort_order=0, course_id=course.id)
    db_session.add(module)
    await db_session.flush()

    lesson = Lesson(
        id=uuid.uuid4(), slug=f"media-lesson-{uuid.uuid4().hex[:8]}", title="Media Test Lesson",
        description="d", lesson_type=LessonType.VIDEO, module_id=module.id, sort_order=0, published=True,
    )
    db_session.add(lesson)
    await db_session.flush()

    media = Media(
        id=uuid.uuid4(), lesson_id=lesson.id, mux_asset_id=f"asset_{uuid.uuid4().hex[:8]}",
        mux_playback_id=f"pb_{uuid.uuid4().hex[:8]}", status=MediaStatus.READY, duration_seconds=90,
    )
    db_session.add(media)
    await db_session.flush()

    return lesson, media


@pytest.mark.asyncio
async def test_list_media_returns_403_for_member(member_client):
    resp = await member_client.get("/admin/media")
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_list_media_includes_lesson_context(admin_client, lesson_with_media):
    """8D-4: the media library row must name where the video is used, not just an id."""
    lesson, media = lesson_with_media
    resp = await admin_client.get("/admin/media")
    assert resp.status_code == 200, resp.text
    rows = resp.json()

    row = next(r for r in rows if r["id"] == str(media.id))
    assert row["lesson_title"] == "Media Test Lesson"
    assert row["lesson_id"] == str(lesson.id)
    assert row["mux_playback_id"] == media.mux_playback_id
    assert row["status"] == "ready"
    assert row["duration_seconds"] == 90


@pytest.mark.asyncio
async def test_playback_token_ready_state(admin_client, lesson_with_media):
    """8D-3/8D-5: a fully-encoded asset reports state 'ready'."""
    _, media = lesson_with_media
    fake_asset = {"status": "ready", "playback_ids": [{"id": media.mux_playback_id, "policy": "signed"}]}

    with patch("app.api.v1.admin.media.generate_mux_playback_token", return_value="fake.jwt.token"):
        with patch("app.api.v1.admin.media.get_asset", return_value=fake_asset):
            resp = await admin_client.post(
                "/admin/media/playback-token",
                json={"playback_id": media.mux_playback_id, "asset_id": media.mux_asset_id},
            )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["state"] == "ready"
    assert data["token"] == "fake.jwt.token"


@pytest.mark.asyncio
async def test_playback_token_encoding_state(admin_client, lesson_with_media):
    """8D-3: an asset still processing reports state 'encoding', not an error and not
    a bare 'ready' that would hand Mux a request it can't yet serve."""
    _, media = lesson_with_media
    fake_asset = {"status": "preparing"}

    with patch("app.api.v1.admin.media.generate_mux_playback_token", return_value="fake.jwt.token"):
        with patch("app.api.v1.admin.media.get_asset", return_value=fake_asset):
            resp = await admin_client.post(
                "/admin/media/playback-token",
                json={"playback_id": media.mux_playback_id, "asset_id": media.mux_asset_id},
            )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["state"] == "encoding"
    assert "encoding" in data["message"].lower()


@pytest.mark.asyncio
async def test_playback_token_asset_error_state(admin_client, lesson_with_media):
    """8D-5: Mux itself failed to encode the asset — distinct from 'encoding'."""
    _, media = lesson_with_media
    fake_asset = {"status": "errored"}

    with patch("app.api.v1.admin.media.generate_mux_playback_token", return_value="fake.jwt.token"):
        with patch("app.api.v1.admin.media.get_asset", return_value=fake_asset):
            resp = await admin_client.post(
                "/admin/media/playback-token",
                json={"playback_id": media.mux_playback_id, "asset_id": media.mux_asset_id},
            )
    assert resp.status_code == 200, resp.text
    assert resp.json()["state"] == "asset_error"


@pytest.mark.asyncio
async def test_playback_token_asset_unknown_state(admin_client, lesson_with_media):
    """8D-5: the asset id Mux doesn't recognize — e.g. a fat-fingered legacy paste,
    or an asset deleted at Mux after being attached here."""
    import requests

    _, media = lesson_with_media

    with patch("app.api.v1.admin.media.generate_mux_playback_token", return_value="fake.jwt.token"):
        with patch("app.api.v1.admin.media.get_asset", side_effect=requests.RequestException("404")):
            resp = await admin_client.post(
                "/admin/media/playback-token",
                json={"playback_id": media.mux_playback_id, "asset_id": "asset_does_not_exist"},
            )
    assert resp.status_code == 200, resp.text
    assert resp.json()["state"] == "asset_unknown"


@pytest.mark.asyncio
async def test_playback_token_without_asset_id_is_ready(admin_client, lesson_with_media):
    """Backward compatibility: a caller that only sends playback_id (no asset_id)
    still gets a usable response — state defaults to 'ready' rather than requiring
    every caller to be updated at once."""
    _, media = lesson_with_media

    with patch("app.api.v1.admin.media.generate_mux_playback_token", return_value="fake.jwt.token"):
        resp = await admin_client.post(
            "/admin/media/playback-token",
            json={"playback_id": media.mux_playback_id},
        )
    assert resp.status_code == 200, resp.text
    assert resp.json()["state"] == "ready"
