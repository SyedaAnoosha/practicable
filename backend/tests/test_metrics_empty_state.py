"""Regression coverage for a real bug found during Phase 6B verification
(week4_plan.md): non-negotiable #15 says "unknown is null, zero is 0, and the
two are different" — but every ratio metric (`second_purchase_rate`,
`free_to_paid`, `refund_rate`, `signup_to_purchase_days`) always returned real
integers, defaulting to `0`/`0` for "genuinely no data yet" exactly the same as
it would for "we checked, and the answer is truly zero out of some real
denominator". `MetricOut.numerator`/`denominator` were typed as plain `int`,
so there was no way to return anything else even if a call site wanted to.

Cannot be reproduced against the seeded test DB directly — `db_session`'s
transaction wraps genuinely seeded rows, so `total_buyers` etc. are never
actually 0 there. Mocking the session's `execute().scalar()` chain isolates
the zero-denominator branch the same way test_money.py already does for its
own MagicMock-session tests.
"""
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.api.v1.admin.metrics import (
    _get_free_to_paid,
    _get_refund_rate,
    _get_second_purchase_rate,
    _get_signup_to_purchase,
)


def _session_returning(*scalars):
    """A fake AsyncSession whose successive `execute(...).scalar()` calls return the
    given values in order."""
    session = MagicMock()
    results = []
    for value in scalars:
        result = MagicMock()
        result.scalar.return_value = value
        result.all.return_value = []
        results.append(result)
    session.execute = AsyncMock(side_effect=results)
    return session


@pytest.mark.asyncio
async def test_second_purchase_rate_returns_none_when_no_buyers():
    session = _session_returning(0, 0)  # repeat_buyers=0, total_buyers=0
    metric = await _get_second_purchase_rate(session)
    assert metric.numerator is None
    assert metric.denominator is None


@pytest.mark.asyncio
async def test_second_purchase_rate_returns_real_zero_when_buyers_exist_but_none_repeat():
    session = _session_returning(0, 5)  # repeat_buyers=0, total_buyers=5 — a real "0 of 5"
    metric = await _get_second_purchase_rate(session)
    assert metric.numerator == 0
    assert metric.denominator == 5


@pytest.mark.asyncio
async def test_free_to_paid_returns_none_when_no_leads_or_users():
    session = _session_returning(0, 0, 0)  # lead_count=0, user_count=0, paid_count=0
    metric = await _get_free_to_paid(session)
    assert metric.numerator is None
    assert metric.denominator is None


@pytest.mark.asyncio
async def test_refund_rate_returns_none_when_no_completed_orders():
    session = _session_returning(0, 0)  # refunded=0, completed=0
    metric = await _get_refund_rate(session)
    assert metric.numerator is None
    assert metric.denominator is None


@pytest.mark.asyncio
async def test_signup_to_purchase_returns_none_when_no_buyers():
    session = _session_returning(None)  # buyers_with_orders query returns no rows
    metric = await _get_signup_to_purchase(session)
    assert metric.numerator is None
    assert metric.denominator is None
