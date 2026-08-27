"""Certificate model — issued on course completion.

A certificate is a claim about a moment. The snapshot columns (learner name,
course title, issue date) are frozen at issue time so a later course rename
does not rewrite an issued certificate — joining to courses.title at render
time would silently rewrite history.

`verification_code` is `secrets.token_urlsafe(16)` (~128 bits), not sequential
and not derived from the ids — it cannot be enumerated.

The UNIQUE(user_id, course_id) constraint makes issuance idempotent under a
replayed request or a double-click. The service catches IntegrityError and
treats it as success. A SELECT-then-INSERT pre-check would race; the
constraint cannot.
"""
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, IdMixin, TimestampMixin


class Certificate(Base, IdMixin, TimestampMixin):
    __tablename__ = "certificates"
    __table_args__ = (
        UniqueConstraint("user_id", "course_id", name="uq_certificates_user_course"),
    )

    user_id = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )
    course_id = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"), nullable=False,
    )
    verification_code: Mapped[str] = mapped_column(
        String(32), nullable=False, unique=True,
    )
    # Frozen at issue — a course rename does not rewrite an issued certificate.
    learner_name_snapshot: Mapped[str] = mapped_column(String(255), nullable=False)
    course_title_snapshot: Mapped[str] = mapped_column(String(500), nullable=False)
    issued_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
    )
    # Lazily generated — NULL until first fetch.
    pdf_storage_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # Set by the refund path when the entitlement is revoked.
    revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    revoked_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
