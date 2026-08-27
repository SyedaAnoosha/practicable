"""The promotion-code half of the Checkout session.

`[ADDED 2026-08-27]` Both bugs these cover were live in production and neither had
a test, because every existing promotion test stops at our own API and never looks
at the kwargs handed to Stripe.

1. Setting a discount used to `del session_kwargs['allow_promotion_codes']` and pass
   `discounts=[...]` instead, because Stripe rejects both keys in one session. The
   effect was that having a code REMOVED the "Add promotion code" field from
   Checkout — the buyer could not enter a different code, or any code at all.

2. A `discounts[]` entry attached server-side is applied by fiat: Stripe does not
   evaluate the PromotionCode's `restrictions`. WELCOME15 carried
   `restrictions.first_time_transaction = True` and was still honoured on a
   returning buyer's second and later orders. The restriction was configured
   correctly and simply never consulted.

Both are properties of the kwargs, so they are asserted against the kwargs.
"""
from unittest.mock import MagicMock, patch

from app.integrations import stripe_client


def _stub_customer(mock_stripe):
    mock_stripe.Customer.list.return_value = MagicMock(data=[MagicMock(id="cus_1")])


def _session_kwargs(mock_stripe) -> dict:
    """The kwargs actually handed to Stripe — the thing Checkout renders from."""
    return mock_stripe.checkout.Session.create.call_args.kwargs


def _call(discount_code):
    return stripe_client.create_checkout_session(
        price_ids=["price_1"],
        success_url="https://example.test/ok",
        cancel_url="https://example.test/no",
        user_email="buyer@example.test",
        user_id="11111111-1111-1111-1111-111111111111",
        product_ids=["22222222-2222-2222-2222-222222222222"],
        discount_code=discount_code,
    )


def test_promotion_code_field_stays_available_when_a_code_is_supplied():
    """Regression, bug 1: the buyer must still be able to type a code."""
    with patch.object(stripe_client, "stripe") as mock_stripe:
        _stub_customer(mock_stripe)
        mock_stripe.PromotionCode.list.return_value = MagicMock(
            data=[MagicMock(id="promo_abc")]
        )
        _call("WELCOME15")

        kwargs = _session_kwargs(mock_stripe)
        assert kwargs["allow_promotion_codes"] is True
        # The presence of this key is what silently disabled the field, and what
        # bypassed the code's restrictions.
        assert "discounts" not in kwargs


def test_a_resolvable_code_is_not_pre_applied():
    """Regression, bug 2: Stripe must evaluate first_time_transaction itself, which it
    only does for a code the buyer redeems — never for one attached server-side.
    """
    with patch.object(stripe_client, "stripe") as mock_stripe:
        _stub_customer(mock_stripe)
        mock_stripe.PromotionCode.list.return_value = MagicMock(
            data=[MagicMock(id="promo_abc")]
        )
        _call("WELCOME15")

        kwargs = _session_kwargs(mock_stripe)
        assert "discounts" not in kwargs
        # Carried as a suggestion for support/debugging, not as an applied discount.
        assert kwargs["metadata"]["suggested_promo_code"] == "WELCOME15"


def test_unresolvable_code_still_produces_a_session_at_full_price():
    """A dead code must not cost the sale: no discount, field still offered."""
    with patch.object(stripe_client, "stripe") as mock_stripe:
        _stub_customer(mock_stripe)
        mock_stripe.PromotionCode.list.return_value = MagicMock(data=[])
        _call("NOSUCHCODE")

        kwargs = _session_kwargs(mock_stripe)
        assert kwargs["allow_promotion_codes"] is True
        assert "discounts" not in kwargs
        assert "suggested_promo_code" not in kwargs["metadata"]


def test_stripe_lookup_failure_does_not_block_checkout():
    """A Stripe outage on the lookup must degrade to full price, not to a lost sale."""
    class _Boom(Exception):
        pass

    with patch.object(stripe_client, "stripe") as mock_stripe:
        _stub_customer(mock_stripe)
        mock_stripe.StripeError = _Boom
        mock_stripe.PromotionCode.list.side_effect = _Boom("stripe down")
        _call("WELCOME15")

        kwargs = _session_kwargs(mock_stripe)
        assert kwargs["allow_promotion_codes"] is True
        assert "discounts" not in kwargs


def test_no_discount_code_still_offers_the_field():
    """The field is unconditional — a buyer with no banner code can still type one."""
    with patch.object(stripe_client, "stripe") as mock_stripe:
        _stub_customer(mock_stripe)
        _call(None)

        kwargs = _session_kwargs(mock_stripe)
        assert kwargs["allow_promotion_codes"] is True
        assert "discounts" not in kwargs
        mock_stripe.PromotionCode.list.assert_not_called()


# ── Resolving a dashboard-created code for deletion ──────────────────────────
#
# `[ADDED 2026-08-27]` WELCOME15 exists in Stripe with
# `restrictions.first_time_transaction = True` but its promotions row carries NULL
# stripe ids, because it was created by hand in the dashboard. Deleting that row used
# to skip Stripe entirely, removing the banner while the code stayed redeemable.

def test_find_promotion_code_resolves_an_active_code():
    with patch.object(stripe_client, "stripe") as mock_stripe:
        mock_stripe.PromotionCode.list.return_value = MagicMock(
            data=[MagicMock(id="promo_x", coupon="coup_x")]
        )
        assert stripe_client.find_promotion_code_by_code("WELCOME15") == (
            "promo_x",
            "coup_x",
        )


def test_find_promotion_code_falls_back_to_inactive_codes():
    """An already-deactivated code must still give up its coupon id, or the coupon is
    orphaned in the dashboard forever."""
    with patch.object(stripe_client, "stripe") as mock_stripe:
        mock_stripe.PromotionCode.list.side_effect = [
            MagicMock(data=[]),                                        # active=True
            MagicMock(data=[MagicMock(id="promo_i", coupon="coup_i")]),  # active=False
        ]
        assert stripe_client.find_promotion_code_by_code("OLDCODE") == (
            "promo_i",
            "coup_i",
        )


def test_find_promotion_code_returns_none_when_stripe_has_never_heard_of_it():
    with patch.object(stripe_client, "stripe") as mock_stripe:
        mock_stripe.PromotionCode.list.return_value = MagicMock(data=[])
        assert stripe_client.find_promotion_code_by_code("NOPE") is None


def test_delete_deactivates_the_code_before_removing_the_coupon():
    """Order matters: deleting a coupon does not deactivate the codes pointing at it,
    so the reverse order would leave a live code on a missing coupon."""
    calls: list[str] = []
    with patch.object(stripe_client, "stripe") as mock_stripe:
        mock_stripe.InvalidRequestError = type(
            "InvalidRequestError", (Exception,), {"http_status": None}
        )
        mock_stripe.PromotionCode.modify.side_effect = lambda *a, **k: calls.append("deactivate")
        mock_stripe.Coupon.delete.side_effect = lambda *a, **k: calls.append("delete_coupon")

        stripe_client.delete_promotion_in_stripe(
            promotion_code_id="promo_x", coupon_id="coup_x"
        )

    assert calls == ["deactivate", "delete_coupon"]
