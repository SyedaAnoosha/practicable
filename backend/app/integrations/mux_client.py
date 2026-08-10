import base64
import time

import jwt  # PyJWT — not python-jose, which has no top-level `jwt` module

from app.core.config import settings


def generate_mux_playback_token(playback_id: str, expiry_minutes: int = 30) -> str:
    """Generate a signed JWT for Mux's signed video playback.

    Mux verifies this with RS256 against the *public* half of a signing key created
    in the Mux dashboard (Settings -> Signing Keys) — not HS256 against
    mux_token_secret, which authenticates Mux *API* calls (creating assets, uploads),
    a completely separate credential pair. Signing with the wrong algorithm/secret
    produces a token that looks valid locally and is silently rejected by Mux.
    """
    if not settings.mux_signing_key_id or not settings.mux_signing_key_private:
        raise RuntimeError(
            "MUX_SIGNING_KEY_ID / MUX_SIGNING_KEY_PRIVATE are not configured. "
            "Create a signing key in the Mux dashboard (Settings -> Signing Keys) — "
            "this is separate from the MUX_TOKEN_ID/MUX_TOKEN_SECRET API credentials."
        )

    # Mux provides the signing key's private key base64-encoded; decode to the PEM
    # bytes jwt.encode expects.
    private_key = base64.b64decode(settings.mux_signing_key_private)

    payload = {
        "sub": playback_id,
        "aud": "v",  # 'v' = video playback (Mux also has 'g' for GIF, 't' for thumbnail)
        "exp": int(time.time()) + (expiry_minutes * 60),
        "kid": settings.mux_signing_key_id,
    }

    return jwt.encode(
        payload,
        private_key,
        algorithm="RS256",
        headers={"kid": settings.mux_signing_key_id},
    )
