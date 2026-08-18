import logging

from fastapi import APIRouter, Depends
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models import Lead
from app.db.session import get_session
from app.services.email_service import send_free_entry_point_email

logger = logging.getLogger(__name__)

router = APIRouter()


class LeadIn(BaseModel):
    email: EmailStr
    source: str | None = None


class LeadOut(BaseModel):
    ok: bool = True


@router.post("/leads", response_model=LeadOut)
async def capture_lead(body: LeadIn, session: AsyncSession = Depends(get_session)):
    """The homepage's free entry point — public, no auth. Deduped on (email, source),
    and always returns ok so the frontend needn't distinguish a repeat signup."""
    existing = await session.execute(
        select(Lead.id).where(Lead.email == body.email, Lead.source == body.source)
    )
    is_new = existing.scalar_one_or_none() is None
    if is_new:
        session.add(Lead(email=body.email, source=body.source))
        await session.commit()

        # Only on a genuinely new capture — a repeat submission of the same address
        # already has the link, and re-sending it on every resubmit reads as spam.
        # The free entry point is the 100 free questions (W3-R3); the gate itself
        # (frontend/src/lib/emailGate.ts) only unlocks them in this browser's
        # localStorage, so a durable link mailed to the address is what makes the
        # unlock reach a buyer on a second device.
        primary_link = f"{settings.frontend_url.rstrip('/')}/questions"
        sent = await send_free_entry_point_email(to_email=body.email, primary_link=primary_link)
        if not sent:
            logger.warning("Free entry point email not sent to %s (source=%s).", body.email, body.source)
    return LeadOut()
