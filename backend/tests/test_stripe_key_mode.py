"""`[ADDED 2026-08-22]` Regression cover for the publish guard's Stripe mode check.

`check_stripe_price` decided which mode the API key was in with:

    is_test_key = settings.stripe_secret_key.startswith("sk_test_")

`sk_` is only one of the key forms Stripe issues. A **restricted** key is `rk_test_…` /
`rk_live_…`, and this project is configured with an `rk_test_` key — so `is_test_key`
came out False, the "live key against a test price" branch fired, and the admin screens
for courses, templates and packs all displayed:

    Mode mismatch: live API key against a test Stripe price. Use matching keys.

against a configuration that was correct. A payment-safety check that cries wolf is
worse than no check: it teaches the owner to click past the one that matters.

These tests pin the behaviour for every key form, in both directions.
"""
from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.core.publish_guard import check_stripe_price


def _fake_price(*, livemode: bool, amount: int = 4900, currency: str = "aud"):
    return SimpleNamespace(
        id="price_test_123",
        active=True,
        livemode=livemode,
        unit_amount=amount,
        currency=currency,
    )


@pytest.fixture
def stripe_price(monkeypatch):
    """Patch the Stripe retrieve call; each test decides the price's livemode.

    `check_stripe_price` does `import stripe` and `from app.core.config import settings`
    *inside* the function body, so both are resolved from the real modules at call time
    — patching attributes on `publish_guard` would have no effect. The patches therefore
    go on `stripe.Price` and `app.core.config.settings` themselves.
    """
    import stripe as stripe_module

    from app.core.config import settings as real_settings

    def _install(*, livemode: bool, key: str):
        monkeypatch.setattr(real_settings, "stripe_secret_key", key, raising=False)
        monkeypatch.setattr(
            stripe_module.Price,
            "retrieve",
            staticmethod(lambda *_a, **_k: _fake_price(livemode=livemode)),
            raising=False,
        )

    return _install


def _check():
    return check_stripe_price(
        stripe_price_id="price_test_123", price_amount=4900, currency="AUD"
    )


@pytest.mark.parametrize("key", ["sk_test_abc123", "rk_test_abc123"])
def test_test_key_against_test_price_is_accepted(stripe_price, key):
    """The `rk_test_` case is the reported bug: a correct pairing rejected as a mismatch."""
    stripe_price(livemode=False, key=key)

    result = _check()

    assert result.ok, result.message
    assert "mismatch" not in (result.message or "").lower()


@pytest.mark.parametrize("key", ["sk_live_abc123", "rk_live_abc123"])
def test_live_key_against_live_price_is_accepted(stripe_price, key):
    stripe_price(livemode=True, key=key)

    result = _check()

    assert result.ok, result.message


@pytest.mark.parametrize("key", ["sk_live_abc123", "rk_live_abc123"])
def test_live_key_against_test_price_is_still_rejected(stripe_price, key):
    """The guard must keep catching the real mismatch it exists for."""
    stripe_price(livemode=False, key=key)

    result = _check()

    assert not result.ok
    assert "Mode mismatch" in result.message
    assert "live API key against a test Stripe price" in result.message


@pytest.mark.parametrize("key", ["sk_test_abc123", "rk_test_abc123"])
def test_test_key_against_live_price_is_still_rejected(stripe_price, key):
    stripe_price(livemode=True, key=key)

    result = _check()

    assert not result.ok
    assert "Mode mismatch" in result.message
    assert "test API key against a live Stripe price" in result.message


def test_unrecognised_key_shape_does_not_invent_a_mismatch(stripe_price):
    """A key we cannot classify is not evidence of a mismatch — Stripe rejects a truly
    bad key itself, and guessing produced exactly the false alarm this file is about."""
    stripe_price(livemode=False, key="some-other-secret")

    result = _check()

    assert "mismatch" not in (result.message or "").lower()
