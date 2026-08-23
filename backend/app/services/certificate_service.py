"""Certificate issuance service — called from the lesson-completion path.

W5-R2: On the false→true transition of CourseProgress.completed, exactly one
Certificate row is created. Idempotent by UNIQUE(user_id, course_id): a
replayed request hits the constraint and is treated as success, not as an error.

Does NOT generate the PDF. Issue is a database write on the request path;
rendering is deferred to first fetch, so a slow or failed render can never cost
someone the lesson completion they actually performed.
"""
from __future__ import annotations

import logging
import secrets
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Certificate, Course, User

logger = logging.getLogger(__name__)


async def issue_certificate_if_newly_complete(
    *,
    session: AsyncSession,
    user: User,
    course: Course,
    was_complete: bool,
    is_complete: bool,
) -> Optional[Certificate]:
    """Issue on the false→true edge only.

    Called from the lesson-completion path with the before/after state that path
    already computed — the caller knows the edge, so this function does not
    re-derive it from the database and therefore cannot disagree with the
    transition that actually happened.

    Idempotent by UNIQUE(user_id, course_id) via INSERT ... ON CONFLICT DO NOTHING:
    a replayed request inserts zero rows and returns the existing certificate.
    No application-level race, no IntegrityError, no rollback.

    Returns the Certificate row (existing or new), or None if no transition occurred.
    """
    if was_complete or not is_complete:
        # Not the false→true edge — nothing to do.
        return None

    now = datetime.now(timezone.utc)
    learner_name = user.name or user.email or "Learner"
    course_title = course.title
    verification_code = secrets.token_urlsafe(16)[:32]

    # INSERT ... ON CONFLICT (user_id, course_id) DO NOTHING — the constraint
    # is the guard; no SELECT-then-INSERT race.
    result = await session.execute(
        insert(Certificate)
        .values(
            user_id=user.id,
            course_id=course.id,
            verification_code=verification_code,
            learner_name_snapshot=learner_name,
            course_title_snapshot=course_title,
            issued_at=now,
        )
        .on_conflict_do_nothing(index_elements=["user_id", "course_id"])
        .returning(Certificate)
    )
    cert = result.scalar_one_or_none()

    if cert is not None:
        # New certificate was inserted.
        await session.flush()
        logger.info(
            "Issued certificate %s for user %s, course %s",
            cert.id, user.id, course.id,
        )
        return cert

    # Certificate already existed — fetch it.
    existing = (
        await session.execute(
            select(Certificate).where(
                Certificate.user_id == user.id,
                Certificate.course_id == course.id,
            )
        )
    ).scalar_one_or_none()
    return existing
