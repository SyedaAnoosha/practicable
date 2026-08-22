"""Admin contact inbox — reads the contact_messages table.

week4_plan.md W4-R5: 'Read what came in through the contact form, without SQL.'

handover.md §2 currently instructs the owner to run hand-written SQL to see contact
messages. This endpoint replaces that instruction with a proper admin view.

The inbox is read-only. `notified = false` rows are the set that matters after any email
outage — they are always included and never filtered by default.
"""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import ContactMessage
from app.db.session import get_session

router = APIRouter()


class ContactMessageOut(BaseModel):
    id: str
    name: str
    email: str
    enquiry_type: Optional[str]
    message: str
    notified: bool
    created_at: datetime


@router.get("/admin/contact", response_model=List[ContactMessageOut])
async def list_contact_messages(
    notified: Optional[bool] = Query(default=None, description="Filter by notified state. Omit for all."),
    limit: int = Query(default=50, le=200),
    session: AsyncSession = Depends(get_session),
):
    """All contact messages, newest-first.

    `notified` filter is optional — the default shows every row because the owner must
    be able to find a message that failed to notify regardless of when it arrived.

    Query count: 1. No per-row lookups.
    """
    q = select(ContactMessage).order_by(ContactMessage.created_at.desc()).limit(limit)
    if notified is not None:
        q = q.where(ContactMessage.notified.is_(notified))

    messages = (await session.execute(q)).scalars().all()
    return [
        ContactMessageOut(
            id=str(m.id),
            name=m.name,
            email=m.email,
            enquiry_type=m.enquiry_type,
            message=m.message,
            notified=m.notified,
            created_at=m.created_at,
        )
        for m in messages
    ]
