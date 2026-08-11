from dataclasses import dataclass

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jwt import PyJWKClient
from app.core.config import settings


@dataclass
class VerifiedToken:
    user_id: str
    email: str | None
    name: str | None

# auto_error=False: HTTPBearer's default behaviour is to raise 403 when the
# Authorization header is simply absent, which is wrong here — week1_plan.md's Phase 2
# Definition of Done explicitly requires 401 for "no token", reserving 403 for
# "authenticated but not entitled" (the gate in app/core/entitlements.py). Handling it
# ourselves below is what keeps that distinction correct.
security = HTTPBearer(auto_error=False)

# This Supabase project signs JWTs asymmetrically (ES256, via Supabase's newer "JWT
# Signing Keys" feature) rather than the legacy scheme of one shared HS256 secret
# (settings.supabase_jwt_secret, which is NOT what verifies these tokens and is now
# unused here — confirmed by decoding a real session token: header alg is ES256, with
# a `kid` matching a key at this JWKS endpoint, not any HMAC secret). PyJWKClient
# fetches Supabase's public signing keys and picks the right one by the token's `kid`,
# so there is no shared secret to keep in sync with the dashboard at all — key
# rotation on Supabase's side just works.
_jwks_client = PyJWKClient(f"{settings.supabase_url}/auth/v1/.well-known/jwks.json")


def _decode(token: str) -> VerifiedToken:
    try:
        signing_key = _jwks_client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256"],
            audience=settings.supabase_jwt_audience,
        )
    except jwt.PyJWTError as e:
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

    # Supabase puts anything passed as signUp's options.data (SignUp.tsx) under the
    # user_metadata claim, not at the payload's top level.
    name = payload.get("user_metadata", {}).get("name")

    return VerifiedToken(user_id=user_id, email=payload.get("email"), name=name)


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
