"""Admin freshness scan (#16's push half).

`compute_freshness` already powers the passive badges on the Templates and Courses
screens, but badges only exist when an admin happens to load those pages. This endpoint
is the "automatic warnings" half of improvements.md §16: one POST scans every template
and course plus the low-conversion question approximation, and writes Notification rows
for every admin through the same Notification infrastructure the template-version path
uses — no parallel notification system.

Deduplication lives in the service (an unread warning for the same entity is not
re-created), so an admin can run this repeatedly without spam; dismissing a notification
clears it for the next scan to re-flag if the underlying staleness persists.
"""

import uuid
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_admin
from app.db.models import User
from app.db.session import get_session
from app.services.freshness_service import create_admin_freshness_notifications

from .common import record_audit

router = APIRouter()


class FreshnessScanOut(BaseModel):
    """The scan summary. Counts per finding class plus delivery facts (recipients,
    rows actually created — which can be fewer than findings × recipients once the
    unread dedup skips what admins have already been told and not yet read)."""

    stale_templates: int
    unknown_templates: int
    stale_courses: int
    unknown_courses: int
    low_conversion_questions: int
    recipients: int
    notifications_created: int


@router.post("/admin/freshness/scan", response_model=FreshnessScanOut)
async def run_freshness_scan(
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """Scan all content for freshness and conversion signals; notify every admin.

    Explicit commit, matching every other mutating admin route (`get_session` never
    commits): either the scan and its notifications land together or neither does.
    """
    summary: dict[str, Any] = await create_admin_freshness_notifications(session)

    # Audit target has no natural UUID of its own — a scan is a batch, not an entity.
    # Same deterministic-uuid5 convention update_setting uses for key-shaped targets:
    # every scan of a given day hashes identically, so audit queries group cleanly.
    batch_id = uuid.uuid5(uuid.NAMESPACE_URL, f"freshness_scan:{uuid.uuid4()}")
    await record_audit(
        session,
        actor=admin,
        action="run_freshness_scan",
        target_type="freshness_scan",
        target_id=batch_id,
        context=summary,
    )
    await session.commit()

    return FreshnessScanOut(**summary)
