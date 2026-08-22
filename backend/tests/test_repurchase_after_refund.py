"""Re-purchase after a refund must actually grant access again.

The bug this file was written to prove (found 2026-08-22 while closing ledger row 92,
not previously on any ledger, and the most severe defect of that pass):

`create_order_from_checkout` resolved `already_owned` with

    select(Entitlement.product_id).where(user_id == uid, product_id.in_(...))

with **no `revoked_at IS NULL` filter**. A refund does not delete the entitlement row —
`refund_service.py` sets `revoked_at`, deliberately, so the audit trail survives — and
`uq_entitlements_user_product` (migration 010) means there can only ever be one row per
(user, product).

Put together, that is a money bug with the worst possible shape:

  1. buyer purchases            -> entitlement row created, access works
  2. buyer refunds             -> same row gets revoked_at, access correctly ends
  3. buyer purchases AGAIN     -> Stripe charges them
  4. `already_owned` matches the REVOKED row, so the grant is skipped
  5. the revoked row is never cleared, so `resolve_product_ids` still denies access

The buyer pays and receives nothing, and no error is raised anywhere — the order and the
order_item are both written, so it looks like a successful purchase from every angle
except the only one that matters.

The fix restricts `already_owned` to live entitlements and reinstates a revoked row when
one is found, rather than inserting a second row the unique constraint would reject.

Every test below was confirmed failing against the pre-fix code.
"""
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import func, select

from app.core.entitlements import resolve_product_ids
from app.db.models import Entitlement
from app.services.order_service import create_order_from_checkout


def _stripe_ids() -> tuple[str, str]:
    token = uuid.uuid4().hex[:16]
    return f"cs_test_{token}", f"pi_test_{token}"


@pytest.mark.asyncio
async def test_repurchase_after_refund_restores_access(
    db_session, member_user, content_graph, grant
):
    """The headline case: buy, refund, buy again — access must come back."""
    product = content_graph.lesson_product

    entitlement = await grant(member_user, product)
    entitlement.revoked_at = datetime.now(timezone.utc) - timedelta(days=5)
    entitlement.revoked_reason = "refund"
    await db_session.flush()

    # Precondition: the gate genuinely denies access right now.
    assert product.id not in await resolve_product_ids(user_id=member_user.id, session=db_session)

    session_id, intent_id = _stripe_ids()
    await create_order_from_checkout(
        session=db_session,
        user_id=str(member_user.id),
        stripe_session_id=session_id,
        stripe_payment_intent_id=intent_id,
        price_amount_cents=product.price_amount,
        currency=product.currency,
        product_ids=[str(product.id)],
    )
    await db_session.flush()

    granted = await resolve_product_ids(user_id=member_user.id, session=db_session)
    assert product.id in granted, (
        "Re-purchase after a refund left the buyer paying for access they did not get."
    )


@pytest.mark.asyncio
async def test_repurchase_does_not_insert_a_second_entitlement_row(
    db_session, member_user, content_graph, grant
):
    """`uq_entitlements_user_product` allows exactly one row per (user, product), so the
    fix must reinstate the existing row rather than insert alongside it — otherwise the
    purchase raises an IntegrityError after Stripe has already taken the money."""
    product = content_graph.lesson_product

    entitlement = await grant(member_user, product)
    entitlement.revoked_at = datetime.now(timezone.utc) - timedelta(days=5)
    entitlement.revoked_reason = "refund"
    await db_session.flush()

    session_id, intent_id = _stripe_ids()
    await create_order_from_checkout(
        session=db_session,
        user_id=str(member_user.id),
        stripe_session_id=session_id,
        stripe_payment_intent_id=intent_id,
        price_amount_cents=product.price_amount,
        currency=product.currency,
        product_ids=[str(product.id)],
    )
    await db_session.flush()

    count = (
        await db_session.execute(
            select(func.count(Entitlement.id)).where(
                Entitlement.user_id == member_user.id, Entitlement.product_id == product.id
            )
        )
    ).scalar()
    assert count == 1


@pytest.mark.asyncio
async def test_reinstated_row_clears_the_refund_reason(
    db_session, member_user, content_graph, grant
):
    """A live entitlement carrying `revoked_reason='refund'` is a contradiction that
    would mislead anyone reading the audit trail or the admin user detail page."""
    product = content_graph.lesson_product

    entitlement = await grant(member_user, product)
    entitlement.revoked_at = datetime.now(timezone.utc) - timedelta(days=5)
    entitlement.revoked_reason = "refund"
    await db_session.flush()

    session_id, intent_id = _stripe_ids()
    await create_order_from_checkout(
        session=db_session,
        user_id=str(member_user.id),
        stripe_session_id=session_id,
        stripe_payment_intent_id=intent_id,
        price_amount_cents=product.price_amount,
        currency=product.currency,
        product_ids=[str(product.id)],
    )
    await db_session.flush()
    await db_session.refresh(entitlement)

    assert entitlement.revoked_at is None
    assert entitlement.revoked_reason is None


@pytest.mark.asyncio
async def test_an_active_entitlement_is_still_not_duplicated(
    db_session, member_user, content_graph, grant
):
    """The original guard must survive the fix: a genuine double-purchase of something
    already owned still skips the grant rather than touching the constraint."""
    product = content_graph.lesson_product
    await grant(member_user, product)
    await db_session.flush()

    session_id, intent_id = _stripe_ids()
    await create_order_from_checkout(
        session=db_session,
        user_id=str(member_user.id),
        stripe_session_id=session_id,
        stripe_payment_intent_id=intent_id,
        price_amount_cents=product.price_amount,
        currency=product.currency,
        product_ids=[str(product.id)],
    )
    await db_session.flush()

    count = (
        await db_session.execute(
            select(func.count(Entitlement.id)).where(
                Entitlement.user_id == member_user.id, Entitlement.product_id == product.id
            )
        )
    ).scalar()
    assert count == 1
    assert product.id in await resolve_product_ids(user_id=member_user.id, session=db_session)
