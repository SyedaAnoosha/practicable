"""Admin contact inbox — reads the contact_messages table.

Read what came in through the contact form, without SQL — replacing the
hand-written SQL that handover.md §2 instructs the owner to run.

The inbox is read-only. `notified = false` rows are the set that matters after any email
outage — they are always included and never filtered by default.

Also supports "Ask Practicable" with grouping by similar questions.
"""
from datetime import datetime
from typing import List, Optional
import uuid

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select, func
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
    # #12: User-submitted questions fields
    related_question_id: Optional[str] = None
    related_domain_id: Optional[str] = None
    keywords: Optional[str] = None
    similar_count: int = 0


@router.get("/admin/contact", response_model=List[ContactMessageOut])
async def list_contact_messages(
    notified: Optional[bool] = Query(default=None, description="Filter by notified state. Omit for all."),
    enquiry_type: Optional[str] = Query(default=None, description="Filter by enquiry_type (e.g., 'ask_practicable')."),
    group_by_similarity: bool = Query(default=False, description="Group similar questions together."),
    limit: int = Query(default=50, le=200),
    session: AsyncSession = Depends(get_session),
):
    """All contact messages, newest-first.

    `notified` filter is optional — the default shows every row because the owner must
    be able to find a message that failed to notify regardless of when it arrived.

    `enquiry_type` filter for #12 to separate "Ask Practicable" submissions.

    `group_by_similarity` for #12: groups similar questions together, ordered by
    similar_count (frequency of similar questions).

    Query count: 1. No per-row lookups.
    """
    q = select(ContactMessage)

    if notified is not None:
        q = q.where(ContactMessage.notified.is_(notified))

    if enquiry_type is not None:
        q = q.where(ContactMessage.enquiry_type == enquiry_type)

    if group_by_similarity:
        # Group by similar questions (same keywords or related_question_id)
        # Order by similar_count desc to show most frequent similar questions first
        q = q.order_by(ContactMessage.similar_count.desc(), ContactMessage.created_at.desc())
    else:
        q = q.order_by(ContactMessage.created_at.desc())

    q = q.limit(limit)

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
            related_question_id=str(m.related_question_id) if m.related_question_id else None,
            related_domain_id=str(m.related_domain_id) if m.related_domain_id else None,
            keywords=m.keywords,
            similar_count=m.similar_count,
        )
        for m in messages
    ]


@router.get("/admin/contact/grouped")
async def list_grouped_contact_messages(
    enquiry_type: str = Query(default="ask_practicable", description="Group by this enquiry_type."),
    session: AsyncSession = Depends(get_session),
):
    """#12: Group contact messages by similarity for "Ask Practicable".

    Returns groups of similar questions with counts, ordered by frequency.
    This helps identify common questions that should be added to the question bank.
    """
    # Group by keywords (if present) or by message similarity (simplified here)
    result = await session.execute(
        select(
            ContactMessage.keywords,
            ContactMessage.related_question_id,
            func.count(ContactMessage.id).label("count"),
            func.max(ContactMessage.created_at).label("latest_at"),
        )
        .where(ContactMessage.enquiry_type == enquiry_type)
        .where(ContactMessage.keywords.isnot(None))
        .group_by(ContactMessage.keywords, ContactMessage.related_question_id)
        .order_by(func.count(ContactMessage.id).desc())
    )

    groups = []
    for row in result.all():
        groups.append({
            "keywords": row.keywords,
            "related_question_id": str(row.related_question_id) if row.related_question_id else None,
            "count": row.count,
            "latest_at": row.latest_at.isoformat() if row.latest_at else None,
        })

    return {"groups": groups}
