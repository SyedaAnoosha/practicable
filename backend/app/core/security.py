"""Supabase JWT verification and the FastAPI bearer-token dependencies built on it."""

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

# auto_error=False so a missing Authorization header 401s below rather than HTTPBearer's
# default 403, which is reserved for "authenticated but not entitled".
security = HTTPBearer(auto_error=False)

# This Supabase project signs JWTs asymmetrically (ES256, via Supabase's "JWT Signing
# Keys"), not with the legacy shared HS256 secret — settings.supabase_jwt_secret is unused
# here. PyJWKClient fetches the public keys and picks one by the token's `kid`, so key
# rotation on Supabase's side needs no change here.
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

    # Supabase puts signUp's options.data under user_metadata, not at the top level.
    name = payload.get("user_metadata", {}).get("name")

    return VerifiedToken(user_id=user_id, email=payload.get("email"), name=name)


async def verify_jwt_full(credentials: HTTPAuthorizationCredentials | None = Depends(security)) -> VerifiedToken:
    """Verify a Supabase JWT and return the full VerifiedToken. Raises 401 for anything
    wrong with authentication itself — never 403."""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return _decode(credentials.credentials)


async def verify_jwt(token: VerifiedToken = Depends(verify_jwt_full)) -> str:
    """Same verification, narrowed to just the user id — the shape most routes want."""
    return token.user_id


async def verify_jwt_optional(credentials: HTTPAuthorizationCredentials | None = Depends(security)) -> VerifiedToken | None:
    """Returns None when there's no Authorization header, for public-but-personalised
    routes. A present-but-invalid token still raises 401 rather than being silently
    downgraded to anonymous."""
    if credentials is None:
        return None
    return _decode(credentials.credentials)
