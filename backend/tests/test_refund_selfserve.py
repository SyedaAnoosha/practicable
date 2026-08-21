"""Phase 9B (W4-R20): Tests for buyer-initiated self-serve refund path.

Every money path seen red before green — the rounding test on A$9.90 is the
most embarrassing available bug if it gets the cents wrong.
"""
import os
import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import select

from app.api.v1.me import _compute_refund_amount, request_refund, RefundRequestIn
from app.db.models import (
    Author,
    Course,
    CourseProgress,
    Entitlement,
    Lesson,
    LessonProgress,
    Module,
    Order,
    OrderItem,
    OrderStatus,
    Product,
    ProductContent,
    Section,
    User,
    Role,
)


# ── Rounding rule ──────────────────────────────────────────────────────────────


def test_refund_rounding_990():
    """A$9.90 keeps A$1.49 (round_half_up(990 × 15 / 100) = 149), refunds A$8.41."""
    refund, kept = _compute_refund_amount(990)
    assert kept == 149
    assert refund == 841
    assert refund + kept == 990


def test_refund_rounding_1000():
    """A$10.00 keeps A$1.50, refunds A$8.50."""
    refund, kept = _compute_refund_amount(1000)
    assert kept == 150
    assert refund == 850


def test_refund_rounding_100():
    """A$1.00 keeps A$0.15, refunds A$0.85."""
    refund, kept = _compute_refund_amount(100)
    assert kept == 15
    assert refund == 85


def test_refund_rounding_99():
    """A$0.99 keeps A$0.15 (round_half_up(99 × 15 / 100) = 15), refunds A$0.84."""
    refund, kept = _compute_refund_amount(99)
    assert kept == 15
    assert refund == 84


def test_refund_rounding_5000():
    """A$50.00 keeps A$7.50, refunds A$42.50."""
    refund, kept = _compute_refund_amount(5000)
    assert kept == 750
    assert refund == 4250


def test_refund_rounding_preserves_total():
    """refund + kept always equals total for various amounts."""
    for total in [99, 100, 333, 990, 1000, 4900, 9900, 12345]:
        refund, kept = _compute_refund_amount(total)
        assert refund + kept == total, f"Mismatch for total={total}: {refund} + {kept} != {total}"


# ── Helper to create minimal course + order fixture ───────────────────────────


async def _create_course_order(db_session, *, user_email: str, price: int = 9900):
    """Create a user, a course (with one lesson), a product, an order, and return (user, order_id, course_id)."""
    user_id = uuid.uuid4()
    course_id = uuid.uuid4()
    module_id = uuid.uuid4()
    lesson_id = uuid.uuid4()
    product_id = uuid.uuid4()
    order_id = uuid.uuid4()
    section_id = uuid.uuid4()
    author_id = uuid.uuid4()

    section = Section(id=section_id, name="Section", slug=f"sec-{uuid.uuid4().hex[:8]}")
    author = Author(id=author_id, name="Author", slug=f"auth-{uuid.uuid4().hex[:8]}")
    user = User(id=user_id, email=user_email, role=Role.MEMBER, name="Test")
    course = Course(id=course_id, slug=f"c-{uuid.uuid4().hex[:8]}", title="Course",
                    description="Test", section_id=section_id, author_id=author_id)
    module = Module(id=module_id, course_id=course_id, title="Mod", sort_order=0)
    lesson = Lesson(id=lesson_id, slug=f"l-{uuid.uuid4().hex[:8]}", title="Lesson",
                    module_id=module_id, published=True)
    product = Product(id=product_id, slug=f"p-{uuid.uuid4().hex[:8]}", name="Product",
                      description="D", stripe_price_id="price_test", price_amount=price, currency="AUD")
    order = Order(id=order_id, user_id=user_id, stripe_session_id="sess_test",
                  stripe_payment_intent_id=f"pi_test_{uuid.uuid4().hex[:12]}",
                  status=OrderStatus.COMPLETED, total_amount_cents=price, currency="AUD")
    order_item = OrderItem(order_id=order_id, product_id=product_id, price_amount_cents=price)
    content = ProductContent(product_id=product_id, content_type="course", content_id=course_id)

    db_session.add_all([section, author, user, course, module, lesson, product, order, order_item, content])
    await db_session.flush()
    return user_id, order_id, course_id, lesson_id


# ── Eligibility logic ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_eligibility_at_0_percent(db_session):
    """0% completion → eligible."""
    from app.api.v1.me import get_refund_eligibility

    user_id, order_id, _, _ = await _create_course_order(db_session, user_email="e0@test.com")

    result = await get_refund_eligibility(order_id, db_session, str(user_id))
    assert result.eligible is True
    assert result.progress_percent == 0


@pytest.mark.asyncio
async def test_eligibility_at_15_percent(db_session):
    """15% completion → still eligible (the boundary)."""
    from app.api.v1.me import get_refund_eligibility

    user_id, order_id, course_id, lesson_id = await _create_course_order(db_session, user_email="e15@test.com")

    db_session.add(CourseProgress(
        user_id=user_id, course_id=course_id,
        completed=False, percentage_complete=15,
    ))
    await db_session.flush()

    result = await get_refund_eligibility(order_id, db_session, str(user_id))
    assert result.eligible is True
    assert result.progress_percent == 15


@pytest.mark.asyncio
async def test_eligibility_at_16_percent(db_session):
    """16% completion → ineligible."""
    from app.api.v1.me import get_refund_eligibility

    user_id, order_id, course_id, lesson_id = await _create_course_order(db_session, user_email="e16@test.com")

    db_session.add(CourseProgress(
        user_id=user_id, course_id=course_id,
        completed=False, percentage_complete=16,
    ))
    await db_session.flush()

    result = await get_refund_eligibility(order_id, db_session, str(user_id))
    assert result.eligible is False
    assert result.reason_code == "progress_exceeded"
    assert result.progress_percent == 16


@pytest.mark.asyncio
async def test_eligibility_template_only_order(db_session):
    """A template-only order is ineligible for self-serve refund."""
    from app.api.v1.me import get_refund_eligibility

    user_id = uuid.uuid4()
    product_id = uuid.uuid4()
    order_id = uuid.uuid4()

    user = User(id=user_id, email="tpl@test.com", role=Role.MEMBER, name="T")
    product = Product(id=product_id, slug=f"p-{uuid.uuid4().hex[:8]}", name="P",
                      description="D", stripe_price_id="price_t", price_amount=4900, currency="AUD")
    order = Order(id=order_id, user_id=user_id, stripe_session_id="s",
                  status=OrderStatus.COMPLETED, total_amount_cents=4900, currency="AUD")
    content = ProductContent(product_id=product_id, content_type="template", content_id=uuid.uuid4())
    item = OrderItem(order_id=order_id, product_id=product_id, price_amount_cents=4900)

    db_session.add_all([user, product, order, content, item])
    await db_session.flush()

    result = await get_refund_eligibility(order_id, db_session, str(user_id))
    assert result.eligible is False
    assert result.reason_code == "no_course_in_order"


@pytest.mark.asyncio
async def test_already_refunded_order(db_session):
    """An already-refunded order is ineligible."""
    from app.api.v1.me import get_refund_eligibility

    user_id, order_id, course_id, _ = await _create_course_order(db_session, user_email="re@test.com")

    # Mark as refunded
    order = (await db_session.execute(select(Order).where(Order.id == order_id))).scalar_one()
    order.status = OrderStatus.REFUNDED
    order.buyer_refunded_at = datetime.now(timezone.utc)
    await db_session.flush()

    result = await get_refund_eligibility(order_id, db_session, str(user_id))
    assert result.eligible is False
    assert result.reason_code == "already_refunded"


# ── The actual refund POST — found missing 2026-08-21 ──────────────────────────
# Every test above exercises either the pure rounding function or the eligibility
# GET; none of them ever called POST /me/orders/{id}/refund itself, which is why a
# `# TODO: Call Stripe Refund.create(...) here` sat in the endpoint undetected — the
# DoD's own claim "every money path seen red before green" had never actually run
# the money-moving path red, let alone green. These are that missing coverage.


def _fake_stripe_error():
    import stripe as stripe_lib
    return stripe_lib.error.StripeError("Simulated decline")


@pytest.mark.asyncio
async def test_refund_post_calls_stripe_with_the_partial_amount(db_session):
    """The actual defect: this previously never called Stripe at all. Confirms the
    endpoint calls create_refund with the 85% amount, not the full total."""
    user_id, order_id, _, _ = await _create_course_order(db_session, user_email="post0@test.com")
    user = (await db_session.execute(select(User).where(User.id == user_id))).scalar_one()
    order = (await db_session.execute(select(Order).where(Order.id == order_id))).scalar_one()

    with patch("app.api.v1.me.create_refund", return_value=MagicMock()) as refund_mock, \
         patch("app.api.v1.me.send_refund_confirmation_email", return_value=True):
        result = await request_refund(
            order_id, RefundRequestIn(reason_code="changed_mind"), db_session, user,
        )

    refund_mock.assert_called_once_with(
        payment_intent_id=order.stripe_payment_intent_id, amount=8415,
    )
    assert result.status == "refunded"
    assert result.refund_amount_cents == 8415
    assert result.kept_amount_cents == 1485


@pytest.mark.asyncio
async def test_refund_post_revokes_entitlement_and_marks_order_refunded(db_session):
    """§9B step 6: entitlements revoked through the existing revocation path, order
    ends up REFUNDED — not left in an intermediate "processing" state forever."""
    user_id, order_id, _, _ = await _create_course_order(db_session, user_email="post1@test.com")
    user = (await db_session.execute(select(User).where(User.id == user_id))).scalar_one()
    order = (await db_session.execute(select(Order).where(Order.id == order_id))).scalar_one()

    product_id = (
        await db_session.execute(select(OrderItem.product_id).where(OrderItem.order_id == order_id))
    ).scalar_one()
    entitlement = Entitlement(user_id=user_id, product_id=product_id, granted_via="purchase")
    db_session.add(entitlement)
    await db_session.flush()

    with patch("app.api.v1.me.create_refund", return_value=MagicMock()), \
         patch("app.api.v1.me.send_refund_confirmation_email", return_value=True):
        await request_refund(order_id, RefundRequestIn(reason_code="changed_mind"), db_session, user)

    await db_session.refresh(order)
    assert order.status == OrderStatus.REFUNDED

    await db_session.refresh(entitlement)
    assert entitlement.revoked_at is not None


@pytest.mark.asyncio
async def test_refund_post_a_double_request_refunds_exactly_once(db_session):
    """§9B step 5's single-flight requirement: a double-clicked button cannot issue
    two Stripe refunds. The second call sees buyer_refunded_at already set (from the
    first call's commit, which happens BEFORE Stripe is called) and 409s."""
    user_id, order_id, _, _ = await _create_course_order(db_session, user_email="post2@test.com")
    user = (await db_session.execute(select(User).where(User.id == user_id))).scalar_one()

    with patch("app.api.v1.me.create_refund", return_value=MagicMock()) as refund_mock, \
         patch("app.api.v1.me.send_refund_confirmation_email", return_value=True):
        await request_refund(order_id, RefundRequestIn(reason_code="changed_mind"), db_session, user)

        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            await request_refund(order_id, RefundRequestIn(reason_code="changed_mind"), db_session, user)
        assert exc_info.value.status_code == 409

    refund_mock.assert_called_once()


@pytest.mark.asyncio
async def test_refund_post_stripe_failure_rolls_back_the_single_flight_lock(db_session):
    """A declined/failed Stripe call must not permanently consume the buyer's one
    shot at self-serve — found missing 2026-08-21 alongside the TODO itself."""
    user_id, order_id, _, _ = await _create_course_order(db_session, user_email="post3@test.com")
    user = (await db_session.execute(select(User).where(User.id == user_id))).scalar_one()

    from fastapi import HTTPException
    with patch("app.api.v1.me.create_refund", side_effect=_fake_stripe_error()):
        with pytest.raises(HTTPException) as exc_info:
            await request_refund(order_id, RefundRequestIn(reason_code="changed_mind"), db_session, user)
        assert exc_info.value.status_code == 502

    order = (await db_session.execute(select(Order).where(Order.id == order_id))).scalar_one()
    assert order.buyer_refunded_at is None
    assert order.status == OrderStatus.COMPLETED

    # And a retry (Stripe succeeding this time) now goes through — the buyer wasn't
    # locked out by the failed first attempt.
    with patch("app.api.v1.me.create_refund", return_value=MagicMock()) as refund_mock, \
         patch("app.api.v1.me.send_refund_confirmation_email", return_value=True):
        result = await request_refund(order_id, RefundRequestIn(reason_code="changed_mind"), db_session, user)
    refund_mock.assert_called_once()
    assert result.status == "refunded"


@pytest.mark.asyncio
async def test_refund_post_a_refunded_entitlement_actually_fails_the_gate(db_session):
    """§9B step 10's own required test, verbatim: 'a refunded entitlement actually
    fails the gate' — via resolve_product_ids, the same function the gate itself calls."""
    from app.core.entitlements import resolve_product_ids

    user_id, order_id, _, _ = await _create_course_order(db_session, user_email="post4@test.com")
    user = (await db_session.execute(select(User).where(User.id == user_id))).scalar_one()

    product_id = (
        await db_session.execute(select(OrderItem.product_id).where(OrderItem.order_id == order_id))
    ).scalar_one()
    entitlement = Entitlement(user_id=user_id, product_id=product_id, granted_via="purchase")
    db_session.add(entitlement)
    await db_session.flush()

    held_before = await resolve_product_ids(user_id=user_id, session=db_session)
    assert product_id in held_before

    with patch("app.api.v1.me.create_refund", return_value=MagicMock()), \
         patch("app.api.v1.me.send_refund_confirmation_email", return_value=True):
        await request_refund(order_id, RefundRequestIn(reason_code="changed_mind"), db_session, user)

    held_after = await resolve_product_ids(user_id=user_id, session=db_session)
    assert product_id not in held_after


@pytest.mark.asyncio
async def test_refund_post_template_only_order_refused(db_session):
    """§9B step 10: 'a template-only order is refused self-serve' — for the POST,
    not just the eligibility GET this file already covered."""
    user_id = uuid.uuid4()
    order_id = uuid.uuid4()
    product_id = uuid.uuid4()
    user = User(id=user_id, email=f"tpl-{uuid.uuid4().hex[:8]}@test.com", role=Role.MEMBER, name="Test")
    product = Product(id=product_id, slug=f"p-{uuid.uuid4().hex[:8]}", name="Template Product",
                      description="D", stripe_price_id="price_test", price_amount=4900, currency="AUD")
    order = Order(id=order_id, user_id=user_id, stripe_session_id="sess_tpl",
                  stripe_payment_intent_id=f"pi_test_{uuid.uuid4().hex[:12]}",
                  status=OrderStatus.COMPLETED, total_amount_cents=4900, currency="AUD")
    order_item = OrderItem(order_id=order_id, product_id=product_id, price_amount_cents=4900)
    db_session.add_all([user, product, order, order_item])
    await db_session.flush()

    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc_info:
        await request_refund(order_id, RefundRequestIn(reason_code="changed_mind"), db_session, user)
    assert exc_info.value.status_code == 409
    assert "doesn't include a course" in str(exc_info.value.detail)


# ── ACL-safe wording grep test ────────────────────────────────────────────────


def test_no_banned_phrases():
    """Research Spec §11.3: no shipped string contains 'no refunds' or 'all sales final'."""
    import glob as glob_mod

    banned = ["no refunds", "all sales final", "non-refundable"]
    found = []

    for directory in ["frontend/src", "backend/app"]:
        base = os.path.join(os.path.dirname(__file__), "..", directory)
        for fpath in glob_mod.glob(os.path.join(base, "**", "*"), recursive=True):
            if not os.path.isfile(fpath):
                continue
            if fpath.endswith((".pyc", ".map", ".lock")):
                continue
            try:
                with open(fpath, encoding="utf-8", errors="ignore") as f:
                    text = f.read().lower()
                    for phrase in banned:
                        if phrase in text:
                            found.append(f"{fpath}: contains '{phrase}'")
            except Exception:
                pass

    assert found == [], f"Found banned ACL phrases:\n" + "\n".join(found)
