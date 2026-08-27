"""End-to-end proof of the course cover-image upload path, against the real Supabase
Storage S3-compatible endpoint — same rule as `test_template_uploads.py`: the thing
guarding what a public catalogue page renders as `<img src>` is verified against real
infrastructure, not a stand-in.

Real bytes are PUT directly to Storage (bypassing the app, exactly as a browser would
via the presigned URL) and always cleaned up in a `finally`, since `db_session`'s
transaction rollback (conftest.py) reverts the Postgres row but has no reach into the
external object store.
"""
import uuid

import httpx
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Author, Course, Section
from app.integrations.storage_client import delete_file, head_object

# A 1x1 PNG — smallest valid file that satisfies image/png's real magic bytes, so
# head_object's server-reported content_type reflects genuine content, not a label.
_TINY_PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108"
    "0600000031b2680a0000000a4944415478da6360000002000155"
    "0271050000000049454e44ae426082"
)


async def _make_course(db_session: AsyncSession) -> Course:
    section = Section(name="Cover Test Section", slug=f"cover-test-section-{uuid.uuid4().hex[:8]}")
    author = Author(name="Cover Test Author", slug=f"cover-test-author-{uuid.uuid4().hex[:8]}")
    db_session.add_all([section, author])
    await db_session.flush()
    course = Course(
        slug=f"cover-test-course-{uuid.uuid4().hex[:8]}",
        title="Cover Test Course", description="d",
        section_id=section.id, author_id=author.id,
    )
    db_session.add(course)
    await db_session.flush()
    return course


@pytest.mark.asyncio
async def test_cover_upload_end_to_end_real_storage(admin_client: httpx.AsyncClient, db_session: AsyncSession):
    """Presigned URL issued -> real PUT to Storage -> confirm verifies via a real
    head_object HEAD -> cover_image_key is set, and the response resolves it to a real
    presigned URL, never the raw key."""
    course = await _make_course(db_session)
    course_id = str(course.id)

    resp = await admin_client.post(
        f"/admin/courses/{course_id}/cover/upload-url",
        json={"file_name": "cover.png", "content_type": "image/png", "file_size_bytes": len(_TINY_PNG)},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    storage_key = body["storage_key"]
    assert storage_key.startswith(f"courses/{course_id}/cover/"), (
        f"Expected the course-cover prefix, got {storage_key!r}"
    )

    try:
        put_resp = httpx.put(body["upload_url"], content=_TINY_PNG, headers={"Content-Type": "image/png"})
        assert put_resp.status_code in (200, 201), f"Real PUT to Storage failed: {put_resp.status_code} {put_resp.text}"

        meta = head_object(storage_key)
        assert meta is not None, "head_object returned None immediately after a successful PUT"
        assert meta["content_length"] == len(_TINY_PNG)

        confirm_resp = await admin_client.post(
            f"/admin/courses/{course_id}/cover/upload-url/confirm",
            json={"storage_key": storage_key, "file_name": "cover.png"},
        )
        assert confirm_resp.status_code == 200, confirm_resp.text
        out = confirm_resp.json()
        # Never the raw key rendered as a URL — resolved to a real presigned Storage URL.
        assert out["cover_image_url"] != storage_key
        assert out["cover_image_url"].startswith("http")

        await db_session.refresh(course)
        assert course.cover_image_key == storage_key
    finally:
        delete_file(storage_key)


@pytest.mark.asyncio
async def test_cover_upload_rejects_non_image_content_type(admin_client: httpx.AsyncClient, db_session: AsyncSession):
    """A document MIME type is refused before a URL is even issued."""
    course = await _make_course(db_session)

    resp = await admin_client.post(
        f"/admin/courses/{course.id}/cover/upload-url",
        json={"file_name": "not-an-image.pdf", "content_type": "application/pdf", "file_size_bytes": 1000},
    )
    assert resp.status_code == 415, resp.text


@pytest.mark.asyncio
async def test_cover_upload_rejects_oversize_file(admin_client: httpx.AsyncClient, db_session: AsyncSession):
    """The 8MB ceiling is enforced against the declared size before a URL is issued."""
    course = await _make_course(db_session)

    resp = await admin_client.post(
        f"/admin/courses/{course.id}/cover/upload-url",
        json={"file_name": "huge.png", "content_type": "image/png", "file_size_bytes": 9 * 1024 * 1024},
    )
    assert resp.status_code == 413, resp.text


@pytest.mark.asyncio
async def test_cover_remove_end_to_end_real_storage(admin_client: httpx.AsyncClient, db_session: AsyncSession):
    """Remove clears the row and deletes the real Storage object — verified by a real
    head_object HEAD returning None afterwards, not just trusting the 200."""
    course = await _make_course(db_session)
    course_id = str(course.id)

    resp = await admin_client.post(
        f"/admin/courses/{course_id}/cover/upload-url",
        json={"file_name": "cover.png", "content_type": "image/png", "file_size_bytes": len(_TINY_PNG)},
    )
    storage_key = resp.json()["storage_key"]
    httpx.put(resp.json()["upload_url"], content=_TINY_PNG, headers={"Content-Type": "image/png"})
    await admin_client.post(
        f"/admin/courses/{course_id}/cover/upload-url/confirm",
        json={"storage_key": storage_key, "file_name": "cover.png"},
    )

    remove_resp = await admin_client.post(f"/admin/courses/{course_id}/cover/remove")
    assert remove_resp.status_code == 200, remove_resp.text
    assert remove_resp.json()["cover_image_url"] is None

    await db_session.refresh(course)
    assert course.cover_image_key is None
    assert head_object(storage_key) is None, "remove must actually delete the Storage object, not just clear the row"


@pytest.mark.asyncio
async def test_cover_remove_without_existing_image_404s(admin_client: httpx.AsyncClient, db_session: AsyncSession):
    course = await _make_course(db_session)
    resp = await admin_client.post(f"/admin/courses/{course.id}/cover/remove")
    assert resp.status_code == 404, resp.text
    assert resp.json()["detail"]["error"]["code"] == "no_cover_image"
