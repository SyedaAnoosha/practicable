from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, IdMixin, TimestampMixin


class ContactMessage(Base, IdMixin, TimestampMixin):
    """A message sent from the public contact page.

    Deliberately NOT folded into `leads`. A lead is an address plus the entry point it
    came from; there is nowhere in that table to put what the person actually said, so
    routing the contact form through it would persist the email and silently discard the
    message — the one part the sender cared about.

    The row is the durable record. The owner notification email is a convenience on top
    of it, and it is sent best-effort *after* the commit: the email transport is
    currently a sandbox sender (see email_service), so a message that only ever existed
    as an email would be a message that can be lost.
    """

    __tablename__ = "contact_messages"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)

    # Free text rather than an enum: the categories on the form are a routing hint that
    # will be re-worded as the product changes, and a schema migration per wording
    # change buys nothing here.
    enquiry_type: Mapped[str | None] = mapped_column(String(64), nullable=True)

    message: Mapped[str] = mapped_column(Text, nullable=False)

    # Whether the owner alert went out. Lets an unattended message be found later —
    # without it, a send failure is only ever a line in a log that has since rotated.
    notified: Mapped[bool] = mapped_column(nullable=False, default=False)
