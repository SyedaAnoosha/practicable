"""Direct unit tests of `app.core.security._decode` — the ES256/JWKS verification the
gating suite's own token comes nowhere near, because every gating test overrides
`verify_jwt_full` entirely (conftest.py's `_fake_verify_jwt_full`, so the app doesn't
need a live Supabase JWKS endpoint in CI). That override is the right call for testing
gating logic, but it means "a tampered JWT," "an expired JWT," and "a garbage token" —
three of the twelve attacks week4_plan.md W4-R6 names under "break your own gating" —
had never actually exercised `_decode` at all before this file.

A real Supabase JWKS endpoint isn't reachable offline, so this mints its own ES256
key pair and patches `_jwks_client.get_signing_key_from_jwt` to return its public half —
`_decode`'s own verification logic (signature, expiry, audience, the `sub` claim) then
runs completely unmodified against tokens this file controls end to end.

Covers a tampered JWT, an expired JWT, and a garbage token.
"""
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import patch

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi import HTTPException

from app.core.config import settings
from app.core.security import _decode

_PRIVATE_KEY = ec.generate_private_key(ec.SECP256R1())


def _make_token(*, sub="00000000-0000-0000-0000-000000000001", exp_delta=timedelta(hours=1), audience=None, **extra_claims):
    payload = {
        "sub": sub,
        "aud": audience if audience is not None else settings.supabase_jwt_audience,
        "exp": datetime.now(timezone.utc) + exp_delta,
        "email": "attacker@example.test",
        **extra_claims,
    }
    return jwt.encode(payload, _PRIVATE_KEY, algorithm="ES256")


@pytest.fixture(autouse=True)
def patched_jwks():
    """Every case in this file decodes against our own key pair's public half, not the
    real Supabase project — `_decode` itself is exercised unmodified."""
    fake_signing_key = SimpleNamespace(key=_PRIVATE_KEY.public_key())
    with patch("app.core.security._jwks_client.get_signing_key_from_jwt", return_value=fake_signing_key):
        yield


def test_a_validly_signed_token_decodes(patched_jwks):
    """Sanity check the harness itself before trusting any of the rejections below."""
    token = _make_token()
    result = _decode(token)
    assert result.user_id == "00000000-0000-0000-0000-000000000001"


def test_garbage_token_is_rejected():
    """Not a JWT at all — three-part-dot-separated-base64 structure absent entirely."""
    with pytest.raises(HTTPException) as exc:
        _decode("this-is-not-a-jwt")
    assert exc.value.status_code == 401


def test_empty_string_token_is_rejected():
    with pytest.raises(HTTPException) as exc:
        _decode("")
    assert exc.value.status_code == 401


def test_expired_token_is_rejected():
    token = _make_token(exp_delta=timedelta(hours=-1))
    with pytest.raises(HTTPException) as exc:
        _decode(token)
    assert exc.value.status_code == 401


def test_tampered_payload_is_rejected():
    """The exact privilege-escalation shape: decode a real token, edit its payload (a
    different `sub`), re-encode without re-signing (a forger has no private key), and
    confirm the signature check — not just the shape check — is what stops it."""
    token = _make_token(sub="00000000-0000-0000-0000-000000000001")
    header_b64, payload_b64, signature_b64 = token.split(".")

    import base64
    import json

    payload = json.loads(base64.urlsafe_b64decode(payload_b64 + "=="))
    payload["sub"] = "11111111-1111-1111-1111-111111111111"  # a different, more interesting user
    tampered_payload_b64 = base64.urlsafe_b64encode(json.dumps(payload).encode()).rstrip(b"=").decode()
    tampered_token = f"{header_b64}.{tampered_payload_b64}.{signature_b64}"

    with pytest.raises(HTTPException) as exc:
        _decode(tampered_token)
    assert exc.value.status_code == 401


def test_wrong_audience_is_rejected():
    """A token signed by the same real key but for a different Supabase project/audience
    must not verify here — the audience check is not decorative."""
    token = _make_token(audience="some-other-project")
    with pytest.raises(HTTPException) as exc:
        _decode(token)
    assert exc.value.status_code == 401


def test_token_with_no_sub_claim_is_rejected():
    payload = {
        "aud": settings.supabase_jwt_audience,
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
    }
    token = jwt.encode(payload, _PRIVATE_KEY, algorithm="ES256")
    with pytest.raises(HTTPException) as exc:
        _decode(token)
    assert exc.value.status_code == 401


def test_token_signed_with_a_different_key_is_rejected():
    """A forger with their own valid EC key pair, correctly self-signing a token — this
    is what `_jwks_client` (verifying against Supabase's real public key) is the actual
    defence against, distinct from the tampered-payload case above."""
    other_key = ec.generate_private_key(ec.SECP256R1())
    payload = {
        "sub": "00000000-0000-0000-0000-000000000001",
        "aud": settings.supabase_jwt_audience,
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
    }
    forged_token = jwt.encode(payload, other_key, algorithm="ES256")
    with pytest.raises(HTTPException) as exc:
        _decode(forged_token)
    assert exc.value.status_code == 401
