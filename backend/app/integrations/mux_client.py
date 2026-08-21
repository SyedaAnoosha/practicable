import base64
import time

import jwt  # PyJWT — not python-jose, which has no top-level `jwt` module
import requests

from app.core.config import settings

MUX_API_BASE = "https://api.mux.com"


def generate_mux_playback_token(playback_id: str, expiry_minutes: int = 30) -> str:
    """Generate a signed JWT for Mux's signed video playback.

    Verified by Mux with RS256 against a signing key's public half (Settings → Signing
    Keys) — not HS256 against mux_token_secret, which is a separate credential for Mux
    API calls. The wrong algorithm produces a token that looks valid but Mux rejects.

    Phase 8 (8D-1): the token path this file and `admin/media.py` build exists at all
    because this was checked, not assumed — verified 2026-08-21 by calling `get_asset()`
    directly against 4 real Mux asset ids already in the live `media` table (not
    synthetic ones). Every one came back `playback_ids: [{"policy": "signed"}]`, e.g.
    asset `00R00wZ6tVNFHvhJ3501YQD49007Mfwm00jHZTh025BbMaVnI`. Had any come back
    `public`, the whole token-fetch machinery in this file and `admin/media.py` would
    have been unnecessary work for that asset.
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


def _auth() -> tuple[str, str]:
    if not settings.mux_token_id or not settings.mux_token_secret:
        raise RuntimeError("MUX_TOKEN_ID / MUX_TOKEN_SECRET are not configured.")
    return (settings.mux_token_id, settings.mux_token_secret)


def create_direct_upload() -> dict:
    """week3_plan.md Phase 5 step 1 — the admin never sees a Mux secret and the
    frontend never calls Mux directly: this is the ONE place MUX_TOKEN_ID/SECRET are
    used to talk to Mux's Video API. Returns Mux's own `{id, url}` — `id` is what
    `get_upload_status` below polls, `url` is what the browser PUTs the video file to,
    directly, bypassing this backend entirely for the actual bytes.

    `playback_policy: ["signed"]` matches `generate_mux_playback_token` above — an
    asset created any other way here would be playable with no signed token at all,
    quietly reopening the gate this whole signing scheme exists to close.
    """
    response = requests.post(
        f"{MUX_API_BASE}/video/v1/uploads",
        auth=_auth(),
        json={
            "new_asset_settings": {"playback_policy": ["signed"]},
            "cors_origin": settings.frontend_url or "*",
        },
        timeout=10,
    )
    response.raise_for_status()
    return response.json()["data"]


def get_upload_status(upload_id: str) -> dict:
    """Mux's own upload-progress record: `status` moves waiting -> asset_created (or
    errored/cancelled). `asset_id` is only present once `asset_created`."""
    response = requests.get(f"{MUX_API_BASE}/video/v1/uploads/{upload_id}", auth=_auth(), timeout=10)
    response.raise_for_status()
    return response.json()["data"]


def get_asset(asset_id: str) -> dict:
    """`status` moves preparing -> ready (or errored) as Mux encodes the upload.
    `playback_ids` is empty until the asset exists; the signed playback id is what
    `set_lesson_video` stores once this reports `ready`."""
    response = requests.get(f"{MUX_API_BASE}/video/v1/assets/{asset_id}", auth=_auth(), timeout=10)
    response.raise_for_status()
    return response.json()["data"]
