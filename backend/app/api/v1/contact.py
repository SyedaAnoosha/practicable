import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rate_limit import RateLimiter
from app.db.models import ContactMessage
from app.db.session import get_session
from app.services.email_service import send_contact_notification_email

router = APIRouter()

logger = logging.getLogger(__name__)

# Same shape as filter_events.py's limiter: an in-memory counter keyed by IP, no IP
# stored anywhere. This form is public and unauthenticated, so it is the endpoint an
# abusive caller would hit to pollute the "Ask Practicable" grouping — capped at 10
# submissions per IP per 60 seconds, tighter than /filter-events' 30 because a contact
# submission is a deliberate, infrequent action, not a UI tap.
_rate_limiter = RateLimiter(window_seconds=60, max_requests=10)


def _get_client_ip(request: Request) -> str:
    """Extract client IP from X-Forwarded-For (behind proxy) or direct connection."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


class ContactIn(BaseModel):
    # Length caps are the only validation here beyond a well-formed address. The form is
    # public and unauthenticated, so the caps exist to bound what an anonymous caller can
    # write into the table, not to police how someone words an enquiry.
    name: str = Field(min_length=1, max_length=255)
    email: EmailStr
    enquiry_type: str | None = Field(default=None, max_length=64)
    message: str = Field(min_length=1, max_length=5000)
    # #12: User-submitted questions fields
    related_question_id: str | None = Field(default=None, description="ID of a similar existing question")
    related_domain_id: str | None = Field(default=None, description="ID of the related domain")
    keywords: str | None = Field(default=None, max_length=500, description="Keywords for similarity matching")


class ContactOut(BaseModel):
    ok: bool = True


@router.post("/contact", response_model=ContactOut)
async def submit_contact(body: ContactIn, request: Request, session: AsyncSession = Depends(get_session)):
    """The public contact form — no auth, like /leads.

    Not deduped, unlike /leads: two enquiries from the same address are two different
    questions, and dropping the second one silently would be the worst possible way to
    treat someone who wrote in twice because they got no reply the first time.

    The commit happens before the notification, and the notification cannot fail the
    request. The email transport is a sandbox sender right now (see email_service), so
    if the two were coupled a working form would look broken — and the message is
    already safely on disk either way.

    #12: Extended to support "Ask Practicable" with similarity tracking.

    Rate-limited per IP (10/min, in-memory, no IP stored) — same shape as
    filter_events.py. A public unauthenticated form is the endpoint an abusive caller
    would hit to pollute the "Ask Practicable" grouping, so unlike /filter-events this
    limit responds 429 rather than silently dropping: a dropped question submission is a
    lost user request, not a fire-and-forget metrics tap.

    `similar_count` is written once, at insert time, from a plain COUNT of existing rows
    sharing these keywords — it does NOT retroactively update every prior row with the
    same keywords. That fan-out UPDATE was removed: it turned one public POST into an
    unbounded write across every historically-matching row (an easy DoS on an
    unauthenticated endpoint), and the count it maintained was never even read by
    `/admin/contact/grouped`, which already computes its own live GROUP BY/COUNT. The
    per-row `similar_count` is now a best-effort snapshot for the flat (non-grouped)
    admin list only; the grouped view is the source of truth for frequency.
    """
    ip = _get_client_ip(request)
    if not _rate_limiter.allow(ip, action="contact_submit"):
        raise HTTPException(
            status_code=429,
            detail={"error": {"code": "rate_limited", "message": "Too many submissions. Try again in a minute."}},
        )

    similar_count = 0
    if body.enquiry_type == "ask_practicable" and body.keywords:
        from sqlalchemy import func, select

        existing = (
            await session.execute(
                select(func.count(ContactMessage.id))
                .where(ContactMessage.enquiry_type == "ask_practicable")
                .where(ContactMessage.keywords == body.keywords)
            )
        ).scalar() or 0
        similar_count = existing + 1  # including the row being inserted now

    entry = ContactMessage(
        name=body.name.strip(),
        email=body.email,
        enquiry_type=body.enquiry_type,
        message=body.message.strip(),
        # #12: User-submitted questions fields
        related_question_id=uuid.UUID(body.related_question_id) if body.related_question_id else None,
        related_domain_id=uuid.UUID(body.related_domain_id) if body.related_domain_id else None,
        keywords=body.keywords,
        similar_count=similar_count,
    )
    session.add(entry)
    await session.commit()

    notified = await send_contact_notification_email(
        name=entry.name,
        from_email=entry.email,
        enquiry_type=entry.enquiry_type,
        message=entry.message,
    )
    if notified:
        entry.notified = True
        await session.commit()
    else:
        # Not an error response — the enquiry is stored. But it is a real operational
        # problem: nobody has been told about it, so say so at a level that is visible.
        logger.warning(
            "Contact message %s from %s was stored but no owner notification was sent.",
            entry.id,
            entry.email,
        )

    return ContactOut()
