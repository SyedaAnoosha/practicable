import logging

from fastapi import APIRouter, Depends
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import ContactMessage
from app.db.session import get_session
from app.services.email_service import send_contact_notification_email

router = APIRouter()

logger = logging.getLogger(__name__)


class ContactIn(BaseModel):
    # Length caps are the only validation here beyond a well-formed address. The form is
    # public and unauthenticated, so the caps exist to bound what an anonymous caller can
    # write into the table, not to police how someone words an enquiry.
    name: str = Field(min_length=1, max_length=255)
    email: EmailStr
    enquiry_type: str | None = Field(default=None, max_length=64)
    message: str = Field(min_length=1, max_length=5000)


class ContactOut(BaseModel):
    ok: bool = True


@router.post("/contact", response_model=ContactOut)
async def submit_contact(body: ContactIn, session: AsyncSession = Depends(get_session)):
    """The public contact form — no auth, like /leads.

    Not deduped, unlike /leads: two enquiries from the same address are two different
    questions, and dropping the second one silently would be the worst possible way to
    treat someone who wrote in twice because they got no reply the first time.

    The commit happens before the notification, and the notification cannot fail the
    request. The email transport is a sandbox sender right now (see email_service), so
    if the two were coupled a working form would look broken — and the message is
    already safely on disk either way.
    """
    entry = ContactMessage(
        name=body.name.strip(),
        email=body.email,
        enquiry_type=body.enquiry_type,
        message=body.message.strip(),
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
