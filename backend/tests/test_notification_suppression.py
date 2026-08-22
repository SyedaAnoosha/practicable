"""Opt-out actually suppresses, and transactional mail never is (Phase 10 §10E).

§10E's acceptance list has three lines. Two were satisfied (the toggles persist; the page
states that transactional mail always arrives). The third — *"Suppression of opted-out mail
proven by a test"* — was not: `send_product_update_email` carried the gate and nothing
exercised it.

That is the wrong half to leave untested. A preference toggle that persists but does not
actually gate the send is worse than no toggle at all, because the page tells the reader
they have opted out and the mail keeps arriving.

The second half matters just as much in the other direction, and is the reason the
non-negotiable exists: a receipt, an access grant, a password reset, a security alert and a
refund confirmation are records of something that happened to the reader's money or
account. None may ever be suppressed by a marketing preference. These tests assert the
suppression is scoped to exactly one function and cannot leak into the others.

Every send is patched at `_send`, so nothing here contacts Mailjet.
"""
from unittest.mock import AsyncMock, patch

import pytest

# `me.py` does `from app.services.email_service import send_security_alert_email`, so it
# holds its OWN reference to the function. Patching `email_service.send_security_alert_email`
# would not intercept it — the patch has to target the name where it is looked up.
from app.api.v1 import me as me_module
from app.services import email_service


@pytest.mark.asyncio
async def test_product_update_is_suppressed_when_opted_out():
    """The line §10E asked for: opted out means the send does not happen at all."""
    with patch.object(email_service, "_send", new=AsyncMock(return_value=True)) as sender:
        sent = await email_service.send_product_update_email(
            to_email="reader@example.com",
            product_name="Risk Register Fundamentals",
            primary_link="https://example.com/library",
            notify_product_updates=False,
        )

    assert sent is False, "an opted-out reader was told the send succeeded"
    sender.assert_not_awaited(), "an opted-out reader was still sent product-update mail"


@pytest.mark.asyncio
async def test_product_update_is_sent_when_opted_in():
    """The gate must not be a blanket off switch — opting in still delivers."""
    with patch.object(email_service, "_send", new=AsyncMock(return_value=True)) as sender:
        sent = await email_service.send_product_update_email(
            to_email="reader@example.com",
            product_name="Risk Register Fundamentals",
            primary_link="https://example.com/library",
            notify_product_updates=True,
        )

    assert sent is True
    sender.assert_awaited_once()


@pytest.mark.parametrize(
    "func_name",
    [
        "send_receipt_email",
        "send_access_granted_email",
        "send_password_reset_email",
        "send_security_alert_email",
        "send_refund_confirmation_email",
        "send_account_closure_email",
    ],
)
def test_transactional_senders_take_no_preference_flag(func_name: str):
    """Non-negotiable: transactional mail is never gated by a preference.

    Asserted structurally rather than behaviourally, because that is the stronger
    guarantee: a transactional sender that cannot *accept* a preference flag cannot be
    made to honour one by a future well-meaning change. A behavioural test would only
    prove today's call sites don't pass one.
    """
    import inspect

    func = getattr(email_service, func_name, None)
    assert func is not None, f"{func_name} no longer exists — update this test deliberately"

    params = set(inspect.signature(func).parameters)
    for forbidden in ("notify_marketing", "notify_product_updates", "preferences", "opted_in"):
        assert forbidden not in params, (
            f"{func_name} accepts {forbidden!r} — transactional mail must never be "
            "suppressible by a preference (Phase 10 §10E step 3)"
        )


def test_only_one_sender_is_preference_gated():
    """Exactly one optional email exists. If a second is added, this test should fail and
    be updated deliberately — that is the point, since each new gated sender is a new
    chance to gate something that should never be gated."""
    import inspect

    gated = [
        name
        for name, func in vars(email_service).items()
        if name.startswith("send_") and callable(func)
        and "notify_product_updates" in inspect.signature(func).parameters
    ]
    assert gated == ["send_product_update_email"], gated


# ── §10A: the alert fires on all three doors, not two ────────────────────────────────

@pytest.mark.asyncio
async def test_name_change_fires_a_security_alert(member_client, member_user):
    """§10A: *"Security alert email fires on name, email and password change."*

    Password and email both fired it. **Name did not** (found 2026-08-22) — `PATCH
    /me/profile` wrote its audit row and returned silently. Changing the display name is
    one of the first things an account takeover does, because it is the cheapest way to
    make later messages look legitimate, so it is exactly the door the alert should cover.
    """
    with patch.object(
        me_module, "send_security_alert_email", new=AsyncMock(return_value=True)
    ) as alert:
        resp = await member_client.patch("/me/profile", json={"full_name": "A New Name"})

    assert resp.status_code == 200, resp.text
    alert.assert_awaited_once()
    assert alert.await_args.kwargs["action"] == "Name changed"


@pytest.mark.asyncio
async def test_a_no_op_name_save_sends_no_alert(member_client, member_user, db_session):
    """Saving the same name is not a security event. Alerting on it trains the reader to
    ignore the alert, which is the only thing that makes it useful."""
    member_user.name = "Same Name"
    await db_session.flush()

    with patch.object(
        me_module, "send_security_alert_email", new=AsyncMock(return_value=True)
    ) as alert:
        resp = await member_client.patch("/me/profile", json={"full_name": "Same Name"})

    assert resp.status_code == 200, resp.text
    alert.assert_not_awaited()
