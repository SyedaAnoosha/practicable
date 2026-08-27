"""Admin leads reader — read-only, newest first, with CSV export.

/admin/leads reads the leads table so the owner can see who signed up for the
free lead magnet. CSV export reuses admin/orders.py's export shape rather than a
second implementation.
"""

import csv
import io
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query, Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Lead
from app.db.session import get_session

router = APIRouter()


class LeadOut(BaseModel):
    id: str
    email: str
    source: Optional[str] = None
    created_at: datetime


@router.get("/admin/leads", response_model=list[LeadOut])
async def list_leads(
    limit: int = Query(default=100, le=500),
    session: AsyncSession = Depends(get_session),
):
    """All leads, newest first.

    Query count: 1. No per-row lookups.
    """
    leads = (
        await session.execute(
            select(Lead).order_by(Lead.created_at.desc()).limit(limit)
        )
    ).scalars().all()
    return [
        LeadOut(
            id=str(l.id),
            email=l.email,
            source=l.source,
            created_at=l.created_at,
        )
        for l in leads
    ]


@router.get("/admin/leads/export")
async def export_leads_csv(session: AsyncSession = Depends(get_session)):
    """CSV export — same rows, same query, a flat file (reuses orders.py's shape)."""
    leads = (
        await session.execute(select(Lead).order_by(Lead.created_at.desc()))
    ).scalars().all()
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["Date", "Email", "Source"])
    for l in leads:
        writer.writerow([l.created_at.date().isoformat(), l.email, l.source or ""])
    return Response(
        content=buffer.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=leads.csv"},
    )
