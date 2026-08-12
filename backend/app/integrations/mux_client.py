import base64
import time

import jwt  # PyJWT — not python-jose, which has no top-level `jwt` module

from app.core.config import settings


def generate_mux_playback_token(playback_id: str, expiry_minutes: int = 30) -> str:
    """Generate a signed JWT for Mux's signed video playback.

    Verified by Mux with RS256 against a signing key's public half (Settings → Signing
    Keys) — not HS256 against mux_token_secret, which is a separate credential for Mux
    API calls. The wrong algorithm produces a token that looks valid but Mux rejects.
    """
    if not settings.mux_signing_key_id or not settings.mux_signing_key_private:
        raise RuntimeError(
            "MUX_SIGNING_KEY_ID / MUX_SIGNING_KEY_PRIVATE are not configured. "
            "Create a signing key in the Mux dashboard (Settings -> Signing Keys) — "
            "this is separate from the MUX_TOKEN_ID/MUX_TOKEN_SECRET API credentials."
        )

    # Mux base64-encodes the private key; decode to the PEM bytes jwt.encode expects.
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
