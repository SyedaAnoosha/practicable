from dataclasses import dataclass

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from app.core.config import settings


@dataclass
class VerifiedToken:
    user_id: str
    email: str | None

# auto_error=False: HTTPBearer's default behaviour is to raise 403 when the
# Authorization header is simply absent, which is wrong here — week1_plan.md's Phase 2
# Definition of Done explicitly requires 401 for "no token", reserving 403 for
# "authenticated but not entitled" (the gate in app/core/entitlements.py). Handling it
# ourselves below is what keeps that distinction correct.
security = HTTPBearer(auto_error=False)

def _decode(token: str) -> VerifiedToken:
    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience=settings.supabase_jwt_audience,
        )
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}"
        )

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token: missing user ID"
        )

    return VerifiedToken(user_id=user_id, email=payload.get("email"))


async def verify_jwt_full(credentials: HTTPAuthorizationCredentials | None = Depends(security)) -> VerifiedToken:
    """Verify Supabase JWT and return the full VerifiedToken (id + email). Raises 401
    for anything wrong with authentication itself (missing, malformed, expired, bad
    signature) — never 403, which is reserved for "authenticated but not entitled to
    this resource"."""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return _decode(credentials.credentials)


async def verify_jwt(token: VerifiedToken = Depends(verify_jwt_full)) -> str:
    """Same verification, narrowed to just the user id — the shape most routes want.
    Kept as a separate dependency (rather than every route unpacking .user_id itself)
    so app/core/deps.py's get_current_user_id stays a one-line passthrough."""
    return token.user_id


async def verify_jwt_optional(credentials: HTTPAuthorizationCredentials | None = Depends(security)) -> VerifiedToken | None:
    """Same verification as verify_jwt, but returns None for a request with no
    Authorization header at all, instead of raising — for public-but-personalised
    routes (the question preview, which must be visible logged-out per the research
    spec's own discovery funnel). A *present but invalid* token still raises 401: a
    client that thinks it's authenticated should be told its token is bad, not
    silently downgraded to anonymous."""
    if credentials is None:
        return None
    return _decode(credentials.credentials)
