from fastapi import APIRouter, Depends
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Lead
from app.db.session import get_session

router = APIRouter()


class LeadIn(BaseModel):
    email: EmailStr
    source: str | None = None


class LeadOut(BaseModel):
    ok: bool = True


@router.post("/leads", response_model=LeadOut)
async def capture_lead(body: LeadIn, session: AsyncSession = Depends(get_session)):
    """The homepage's free entry point (DESIGN.md §18.1) — public, no auth. Deduped on
    (email, source) rather than erroring or silently duplicating on a repeat signup;
    either way this always returns ok so the frontend never has to distinguish
    "new lead" from "already on the list" — neither is the visitor's problem."""
    existing = await session.execute(
        select(Lead.id).where(Lead.email == body.email, Lead.source == body.source)
    )
    if existing.scalar_one_or_none() is None:
        session.add(Lead(email=body.email, source=body.source))
        await session.commit()
    return LeadOut()
