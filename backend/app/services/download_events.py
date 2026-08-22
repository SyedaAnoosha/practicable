"""Records `download_events` rows — week4_plan.md Phase 6B step 4b.

Called at the exact call sites that mint a presigned download URL for a
template or lesson file, and nowhere else. No `user_id`: same privacy
constraint as `filter_events` (see migration 014's docstring) — the aggregate
count answers "how many links were issued", and anything identifying would be
new PII the privacy policy doesn't name.

Writes must not fail the download — wrap and swallow.
"""
import logging
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


async def record_download_event(
    *,
    session: AsyncSession,
    content_type: str,
    content_id: uuid.UUID | None = None,
    content_slug: str | None = None,
) -> None:
    """Fire-and-forget. Never raises — a failed write must not fail the download
    it's instrumenting."""
    try:
        from app.db.models import DownloadEvent

        session.add(
            DownloadEvent(content_type=content_type, content_id=content_id, content_slug=content_slug)
        )
        await session.commit()
    except Exception:
        logger.warning("Failed to record download event for %s %s", content_type, content_id, exc_info=True)
