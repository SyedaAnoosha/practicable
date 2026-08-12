import logging
import uuid

from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import VerifiedToken, verify_jwt, verify_jwt_full, verify_jwt_optional
from app.db.models import Lead, Role, User
from app.db.session import get_session

logger = logging.getLogger(__name__)

# Someone who signs up has given us their address just as deliberately as someone who
# typed it into the free-template form — the only difference is which door they used.
# Recording it here rather than in the frontend's signUp() handler means it cannot be
# skipped: it fires on the first authenticated API call for a brand-new user, whatever
# path created the account (email/password, a future OAuth provider, or a seeded admin).
SIGNUP_LEAD_SOURCE = "signup"


async def _record_signup_lead(*, user: User, session: AsyncSession) -> None:
    """Add a `leads` row for a newly created user. Deliberately best-effort.

    Never allowed to fail the request: this runs after the user row is already
    committed, and a marketing-list side effect must not be the reason someone cannot
    sign in. Deduped on (email, source) to match POST /leads, so a person who used the
    email gate *and* signed up keeps both rows — two real touchpoints, not a duplicate.
    """
    # Placeholder address minted below when a token carries no email — not a real
    # contact, so it must never reach the mailing list.
    if not user.email or user.email.endswith("@unknown.local"):
        return
    try:
        existing = await session.execute(
            select(Lead.id).where(Lead.email == user.email, Lead.source == SIGNUP_LEAD_SOURCE)
        )
        if existing.scalar_one_or_none() is None:
            session.add(Lead(email=user.email, source=SIGNUP_LEAD_SOURCE))
            await session.commit()
    except Exception:
        await session.rollback()
        logger.exception("Could not record signup lead for user %s", user.id)


async def get_current_user_id(user_id: str = Depends(verify_jwt)) -> str:
    """Dependency to get current authenticated user ID (401 if absent/invalid)."""
    return user_id


async def get_current_user_id_optional(
    token: VerifiedToken | None = Depends(verify_jwt_optional),
) -> str | None:
    """Same as get_current_user_id, but returns None instead of 401 when there is no
    Authorization header — for routes that are public but personalise when logged in
    (the question preview/full split, BACKEND.md §4.2)."""
    return token.user_id if token else None


async def get_current_user(
    token: VerifiedToken = Depends(verify_jwt_full),
    session: AsyncSession = Depends(get_session),
) -> User:
    """Resolve the verified JWT into a local `users` row, creating it on first sight.

    Sign-up happens client-side against Supabase Auth, so nothing else ever inserts into
    `public.users`. Without this, the first entitlement/order write for a new user hits a
    foreign-key violation — `users.id` IS the Supabase auth id, with no mapping table.
    """
    user_id = uuid.UUID(token.user_id)
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is not None:
        return user

    user = User(
        id=user_id,
        email=token.email or f"{token.user_id}@unknown.local",
        name=token.name,
        role=Role.MEMBER,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)

    # After the commit above, so a failure here can never roll back the user row.
    await _record_signup_lead(user=user, session=session)
    return user


async def require_admin(user: User = Depends(get_current_user)) -> User:
    """403 unless the resolved local user's role is admin."""
    if user.role != Role.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user
