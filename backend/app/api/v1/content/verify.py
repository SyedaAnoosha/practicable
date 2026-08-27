"""Public certificate verification endpoint.

GET /verify/{verification_code} is public, unauthenticated, and returns
learner name, course title, issue date and revocation state. No email,
no user id, no order data.

Rate-limited through the existing rate limiter, because an unauthenticated
lookup keyed on a short code is exactly what gets enumerated.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rate_limit import RateLimiter
from app.db.models import Certificate
from app.db.session import get_session

router = APIRouter()

# Rate limiter: 30 requests per minute per IP — generous enough for a
# legitimate check, tight enough to make brute-force enumeration impractical.
_verify_limiter = RateLimiter(window_seconds=60, max_requests=30)


def _get_client_ip(request: Request) -> str:
    """Client IP from X-Forwarded-For (behind the proxy) or the direct connection.

    Same extraction as api/v1/filter_events.py — the two are the only public,
    unauthenticated endpoints that need to rate-limit by caller.
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


class VerifyOut(BaseModel):
    learner_name: str
    course_title: str
    issued_at: str
    revoked: bool
    revoked_reason: str | None = None


@router.get("/verify/{verification_code}", response_model=VerifyOut)
async def verify_certificate(
    verification_code: str,
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    """Public, unauthenticated certificate verification.

    Returns only the public fields — never email, user id, or order data.
    The verification code is ~128 bits of entropy (secrets.token_urlsafe(16)),
    but rate-limiting makes enumeration impractical regardless.
    """
    # Keyed on the CALLER, not on the code. Keying on `verification_code` would
    # defeat the limiter it looks like it implements: an enumerator tries a
    # *different* code every request, so each attempt would land on its own fresh
    # counter and the limit would never fire — while the counter dict grew one
    # entry per guess. Keying on the IP is what actually caps guesses per caller,
    # and it matches how filter_events.py limits its public endpoints.
    if not _verify_limiter.allow(_get_client_ip(request), action="verify_certificate"):
        raise HTTPException(
            status_code=429,
            detail={"error": {"code": "rate_limited", "message": "Too many requests. Try again in a minute."}},
        )

    cert = (
        await session.execute(
            select(Certificate).where(
                Certificate.verification_code == verification_code,
            )
        )
    ).scalar_one_or_none()

    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found")

    return VerifyOut(
        learner_name=cert.learner_name_snapshot,
        course_title=cert.course_title_snapshot,
        issued_at=cert.issued_at.isoformat() if hasattr(cert.issued_at, 'isoformat') else str(cert.issued_at),
        revoked=cert.revoked_at is not None,
        revoked_reason=cert.revoked_reason,
    )
