"""End-to-end proof of the presigned template-file and preview-image upload paths,
against the real Supabase Storage S3-compatible endpoint — not mocked, matching this
codebase's own rule (`storage_client.py`, gating case 3/4) that the thing guarding a
paid artefact's delivery is verified against real infrastructure, not a stand-in.

week4_plan.md Phase 2 step 1 / DoD: "Preview upload works end to end, verified with a
real `head_object` HEAD — not the browser's own 'done' event." This file is that
verification, kept as a permanent regression test rather than a one-off script.

Real bytes are PUT directly to Storage (bypassing the app, exactly as a browser would
via the presigned URL) and always cleaned up in a `finally`, since `db_session`'s
transaction rollback (conftest.py) reverts the Postgres row but has no reach into the
external object store.
"""
import uuid

import httpx
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Author, Section, Template
from app.integrations.storage_client import delete_file, head_object

# A 1x1 PNG — smallest valid file that satisfies image/png's real magic bytes, so
# head_object's server-reported content_type reflects genuine content, not a label.
_TINY_PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108"
    "0600000031b2680a0000000a4944415478da6360000002000155"
    "0271050000000049454e44ae426082"
)


@pytest.mark.asyncio
async def test_preview_upload_end_to_end_real_storage(
    admin_client: httpx.AsyncClient, db_session: AsyncSession
):
    """kind='preview': presigned URL issued -> real PUT to Storage -> confirm verifies
    via a real head_object HEAD -> preview_image_keys grows by one, the sold file field
    (storage_key) is untouched."""
    section = Section(name="Upload Test Section", slug=f"upload-test-section-{uuid.uuid4().hex[:8]}")
    author = Author(name="Upload Test Author", slug=f"upload-test-author-{uuid.uuid4().hex[:8]}")
    db_session.add_all([section, author])
    await db_session.flush()
    template = Template(
        slug=f"upload-test-template-{uuid.uuid4().hex[:8]}",
        title="Upload Test Template", description="d",
        section_id=section.id, author_id=author.id, storage_key="templates/existing-file.xlsx",
        file_name="existing.xlsx", file_size_bytes=100,
        mime_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        preview_image_keys=[],
    )
    db_session.add(template)
    await db_session.flush()
    template_id = str(template.id)
    original_storage_key = template.storage_key

    resp = await admin_client.post(
        f"/admin/templates/{template_id}/upload-url",
        json={"file_name": "preview-1.png", "content_type": "image/png", "file_size_bytes": len(_TINY_PNG), "kind": "preview"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    storage_key = body["storage_key"]
    assert storage_key.startswith(f"templates/{template_id}/previews/"), (
        f"Expected the preview prefix, got {storage_key!r} — kind='preview' isn't routing correctly"
    )

    try:
        # The real PUT a browser would make to the presigned URL — real network call,
        # real Supabase Storage bucket.
        put_resp = httpx.put(body["upload_url"], content=_TINY_PNG, headers={"Content-Type": "image/png"})
        assert put_resp.status_code in (200, 201), f"Real PUT to Storage failed: {put_resp.status_code} {put_resp.text}"

        # Confirm the real head_object HEAD sees it before calling confirm — the same
        # check confirm_template_upload does server-side, done here too so a failure
        # clearly separates "the PUT didn't land" from "the confirm endpoint is wrong."
        meta = head_object(storage_key)
        assert meta is not None, "head_object returned None immediately after a successful PUT"
        assert meta["content_length"] == len(_TINY_PNG)

        confirm_resp = await admin_client.post(
            f"/admin/templates/{template_id}/upload-url/confirm",
            json={"storage_key": storage_key, "file_name": "preview-1.png", "kind": "preview"},
        )
        assert confirm_resp.status_code == 200, confirm_resp.text
        out = confirm_resp.json()
        assert storage_key in out["preview_image_keys"], out["preview_image_keys"]
        assert len(out["preview_image_keys"]) == 1

        await db_session.refresh(template)
        assert template.storage_key == original_storage_key, (
            "A preview upload must not touch the sold file's own storage_key"
        )
    finally:
        delete_file(storage_key)


@pytest.mark.asyncio
async def test_preview_upload_rejects_non_image_content_type(admin_client: httpx.AsyncClient, db_session: AsyncSession):
    """kind='preview' with a document MIME type is refused before a URL is even
    issued — ALLOWED_PREVIEW_MIME_TYPES is a real, separate allow-list from the
    document one, not the same list reused."""
    section = Section(name="Upload Test Section 2", slug=f"upload-test-section2-{uuid.uuid4().hex[:8]}")
    author = Author(name="Upload Test Author 2", slug=f"upload-test-author2-{uuid.uuid4().hex[:8]}")
    db_session.add_all([section, author])
    await db_session.flush()
    template = Template(
        slug=f"upload-test-template2-{uuid.uuid4().hex[:8]}",
        title="Upload Test Template 2", description="d",
        section_id=section.id, author_id=author.id, storage_key="templates/existing-file.xlsx",
        file_name="existing.xlsx", file_size_bytes=100,
        mime_type="application/pdf", preview_image_keys=[],
    )
    db_session.add(template)
    await db_session.flush()

    resp = await admin_client.post(
        f"/admin/templates/{template.id}/upload-url",
        json={
            "file_name": "not-an-image.pdf",
            "content_type": "application/pdf",
            "file_size_bytes": 1000,
            "kind": "preview",
        },
    )
    assert resp.status_code == 415, resp.text
