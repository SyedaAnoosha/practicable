import uuid

from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import VerifiedToken, verify_jwt, verify_jwt_full, verify_jwt_optional
from app.db.models import Role, User
from app.db.session import get_session


async def get_current_user_id(user_id: str = Depends(verify_jwt)) -> str:
    """Dependency to get current authenticated user ID (401 if absent/invalid)."""
    return user_id


async def get_current_user_id_optional(
    token: VerifiedToken | None = Depends(verify_jwt_optional),
) -> str | None:
    """Same as get_current_user_id but returns None instead of 401 when there is no
    Authorization header — for routes that are public but personalise when logged in
    (the question preview/full split, BACKEND.md §4.2)."""
    return token.user_id if token else None


async def get_current_user(
    token: VerifiedToken = Depends(verify_jwt_full),
    session: AsyncSession = Depends(get_session),
) -> User:
    """Resolve the verified JWT into a local `users` row, creating it on first sight.

    Sign-up happens client-side against Supabase Auth directly (RS 6.3) — nothing
    in this codebase ever runs a `public.users` INSERT for a new account otherwise.
    Without this, the first entitlement/order write for a brand-new user hits a
    foreign-key violation, since `entitlements.user_id` / `orders.user_id` reference
    `users.id`, and `users.id` IS the Supabase auth id directly (app/db/models/user.py)
    — there is no separate mapping table to fall back on.
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
    return user


async def require_admin(user: User = Depends(get_current_user)) -> User:
    """403 unless the resolved local user's role is admin. Not used by any Week 1
    route yet (no admin UI until Week 3 — week1_plan.md Scope guardrails), but
    defined now per BACKEND.md §5 so an admin route added later can't accidentally
    ship unguarded by forgetting to write this."""
    if user.role != Role.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user
