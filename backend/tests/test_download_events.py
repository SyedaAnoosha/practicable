"""Regression coverage for a real bug found during Phase 6B verification
(week4_plan.md): migration 014 created `download_events` and the model existed,
and `/admin/metrics`'s `download_links_issued` metric read from it — but nothing
ever wrote to it. The three real presigned-URL call sites named in step 4b
(`content/templates.py`'s two routes, `content/lessons.py`'s lesson-download
route) never inserted a row, so the metric was permanently 0 in production
despite `test_metrics.py::test_download_links_issued` passing (that test
inserts `DownloadEvent` rows directly via the fixture, never through a real
download call, so it could not have caught this).

A fourth real call site — `/lesson-blocks/{id}/download-url` — has appeared
since the plan's 3-site list was written; step 4b's own instruction ("if a
fourth call site has appeared, it is recorded too") applies to it as well.

Fixed by calling `record_download_event()` (app/services/download_events.py)
at all four sites, immediately after a presigned URL is actually minted.
"""
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select

from app.db.models import DownloadEvent


async def _download_event_count(db_session) -> int:
    result = await db_session.execute(select(func.count(DownloadEvent.id)))
    return result.scalar() or 0


@pytest.mark.asyncio
async def test_free_template_download_records_event(anon_client: AsyncClient, content_graph, db_session):
    g = content_graph
    before = await _download_event_count(db_session)
    resp = await anon_client.get(f"/templates/{g.free_template.id}/download-url")
    assert resp.status_code == 200, resp.text
    after = await _download_event_count(db_session)
    assert after == before + 1


@pytest.mark.asyncio
async def test_entitled_template_download_records_event(
    entitled_client: AsyncClient, entitled_user, content_graph, grant, db_session
):
    g = content_graph
    await grant(entitled_user, g.template_product)
    before = await _download_event_count(db_session)
    resp = await entitled_client.get(f"/templates/{g.paid_template.id}/download-url")
    assert resp.status_code == 200, resp.text
    after = await _download_event_count(db_session)
    assert after == before + 1


@pytest.mark.asyncio
async def test_free_lesson_block_download_records_event(anon_client: AsyncClient, content_graph, db_session):
    g = content_graph
    before = await _download_event_count(db_session)
    resp = await anon_client.get(f"/lesson-blocks/{g.free_file_block.id}/download-url")
    assert resp.status_code == 200, resp.text
    after = await _download_event_count(db_session)
    assert after == before + 1


@pytest.mark.asyncio
async def test_denied_download_does_not_record_event(anon_client: AsyncClient, content_graph, db_session):
    """A 401/403 never mints a URL, so no event should be recorded — this is the
    negative case proving the write is tied to an actual issued link, not the
    request itself."""
    g = content_graph
    before = await _download_event_count(db_session)
    resp = await anon_client.get(f"/templates/{g.paid_template.id}/download-url")
    assert resp.status_code == 401
    after = await _download_event_count(db_session)
    assert after == before


@pytest.mark.asyncio
async def test_download_event_carries_no_user_identifier(anon_client: AsyncClient, content_graph, db_session):
    """Privacy constraint from migration 014's docstring: the row must not carry
    anything that identifies who downloaded, even for an anonymous free download."""
    g = content_graph
    resp = await anon_client.get(f"/templates/{g.free_template.id}/download-url")
    assert resp.status_code == 200

    result = await db_session.execute(
        select(DownloadEvent).order_by(DownloadEvent.created_at.desc()).limit(1)
    )
    event = result.scalar_one()
    assert not hasattr(event, "user_id")
    assert not hasattr(event, "session_id")
    assert not hasattr(event, "ip_address")
    assert event.content_type == "template"
    assert event.content_id == g.free_template.id
