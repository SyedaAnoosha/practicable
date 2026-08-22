"""A course product that lists its LESSONS is still a course (refund eligibility).

Reported 2026-08-22 by the owner, against the live database: order `0b29c5e4` for
"Risk Register Fundamentals" — plainly a course, A$49 — offered a Refund request link
that answered *"This order doesn't include a course. Contact us and we'll sort it out."*

The cause is a mismatch between how eligibility asks the question and how the catalogue
actually stores the answer. `product_contents` is polymorphic, and a course product may
enumerate its **lessons** rather than the course row. Measured on the live data:

    content_type   rows
    question_set    122
    template         11
    lesson           11
    course            1     <-- exactly one product uses this

    product                                   course  lesson  template  qset
    risk-register-fundamentals                   0       3        1       1
    risk-register-bundle                         0       3        2      60
    managing-cyber-risk-...-course               1       5        0       0

So `WHERE content_type = 'course'` matched exactly one product in the entire catalogue,
and every other course product was told it contained no course. The existing suite never
caught it because its fixture (`_create_course_order`) writes a `content_type="course"`
row — encoding the one shape production mostly does NOT use.

Both endpoints carried their own copy of the query, so both were wrong the same way.

There is a second, quieter finding recorded here too. The buyer of that order is at 33%
complete, well past the 15% policy cut-off, so the order is genuinely ineligible — but
for a reason they were never shown. The bad check hid the real one. Getting this right
matters in both directions: a buyer who is refused must be refused for the true reason,
or the refusal cannot be argued with or trusted.
"""
import uuid

import pytest
from fastapi import HTTPException
from sqlalchemy import select

from app.api.v1.me import (
    RefundRequestIn,
    get_refund_eligibility,
    request_refund,
)
from app.db.models import (
    Author,
    Course,
    CourseProgress,
    Lesson,
    Module,
    Order,
    OrderItem,
    OrderStatus,
    Product,
    ProductContent,
    Role,
    Section,
    User,
)


async def _course_order_listing_lessons(
    db_session,
    *,
    user_email: str,
    price: int = 4900,
    lesson_count: int = 3,
    also_template: bool = True,
):
    """The real `risk-register-fundamentals` shape: a course product whose
    `product_contents` rows are LESSONS (plus a template), and no `course` row at all.

    Deliberately different from `test_refund_selfserve.py::_create_course_order`, which
    writes `content_type="course"`. That fixture describes 1 of the 10 products in the
    live catalogue; this one describes the other 9's course products.
    """
    user_id = uuid.uuid4()
    course_id = uuid.uuid4()
    module_id = uuid.uuid4()
    product_id = uuid.uuid4()
    order_id = uuid.uuid4()
    section_id = uuid.uuid4()
    author_id = uuid.uuid4()

    section = Section(id=section_id, name="Section", slug=f"sec-{uuid.uuid4().hex[:8]}")
    author = Author(id=author_id, name="Author", slug=f"auth-{uuid.uuid4().hex[:8]}")
    user = User(id=user_id, email=user_email, role=Role.MEMBER, name="Test")
    course = Course(
        id=course_id,
        slug=f"c-{uuid.uuid4().hex[:8]}",
        title="Risk Register Fundamentals",
        description="Test",
        section_id=section_id,
        author_id=author_id,
    )
    module = Module(id=module_id, course_id=course_id, title="Mod", sort_order=0)
    product = Product(
        id=product_id,
        slug=f"p-{uuid.uuid4().hex[:8]}",
        name="Risk Register Fundamentals",
        description="D",
        stripe_price_id="price_test",
        price_amount=price,
        currency="AUD",
    )
    order = Order(
        id=order_id,
        user_id=user_id,
        stripe_session_id="sess_test",
        stripe_payment_intent_id=f"pi_test_{uuid.uuid4().hex[:12]}",
        status=OrderStatus.COMPLETED,
        total_amount_cents=price,
        currency="AUD",
    )
    order_item = OrderItem(order_id=order_id, product_id=product_id, price_amount_cents=price)

    rows = [section, author, user, course, module, product, order, order_item]

    lesson_ids = []
    for i in range(lesson_count):
        lesson_id = uuid.uuid4()
        lesson_ids.append(lesson_id)
        rows.append(
            Lesson(
                id=lesson_id,
                slug=f"l-{uuid.uuid4().hex[:8]}",
                title=f"Lesson {i}",
                module_id=module_id,
                published=True,
            )
        )
        # The whole point: the product points at the LESSON, never the course.
        rows.append(
            ProductContent(product_id=product_id, content_type="lesson", content_id=lesson_id)
        )

    if also_template:
        # `risk-register-fundamentals` really does carry a template alongside its
        # lessons — included so the fixture cannot pass by being unrealistically clean.
        rows.append(
            ProductContent(
                product_id=product_id, content_type="template", content_id=uuid.uuid4()
            )
        )

    db_session.add_all(rows)
    await db_session.flush()
    return user_id, order_id, course_id, lesson_ids


# ── The reported bug ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_eligibility_finds_the_course_through_its_lessons(db_session):
    """The exact reported case: A$49 course, 0% progress, listed by lesson.

    Before the fix this returned `no_course_in_order` — "This order doesn't include a
    course" — for an order whose only substantive content IS a course.
    """
    user_id, order_id, _, _ = await _course_order_listing_lessons(
        db_session, user_email=f"lessons-{uuid.uuid4().hex[:8]}@test.com"
    )

    result = await get_refund_eligibility(order_id, db_session, str(user_id))

    assert result.reason_code != "no_course_in_order", (
        "a course product that lists its lessons was told it contains no course"
    )
    assert result.eligible is True
    assert result.progress_percent == 0


@pytest.mark.asyncio
async def test_post_refund_finds_the_course_through_its_lessons(db_session):
    """The POST carried its own copy of the same query, so it needs its own test.

    A GET that says "eligible" followed by a POST that says "this order doesn't include
    a course" is the worst version of this bug: the buyer is invited to click, then
    refused.
    """
    from unittest.mock import MagicMock, patch

    user_id, order_id, _, _ = await _course_order_listing_lessons(
        db_session, user_email=f"lessons-post-{uuid.uuid4().hex[:8]}@test.com"
    )
    user = (await db_session.execute(select(User).where(User.id == user_id))).scalar_one()

    with patch("app.api.v1.me.create_refund", return_value=MagicMock()), patch(
        "app.api.v1.me.send_refund_confirmation_email", return_value=True
    ):
        result = await request_refund(
            order_id, RefundRequestIn(reason_code="changed_mind"), db_session, user
        )

    assert result.status == "refunded"
    assert result.refund_amount_cents + result.kept_amount_cents == 4900


# ── The second finding: the honest reason must survive the fix ───────────────────


@pytest.mark.asyncio
async def test_past_the_threshold_gives_the_progress_reason_not_the_course_reason(db_session):
    """The live order is at 33%, which IS ineligible — but for the progress rule.

    This is the half that makes the fix worth doing carefully. Resolving the course
    correctly must surface the REAL reason (past 15%), not swap one wrong answer for
    another. A buyer refused with a false reason cannot argue with it, and support
    cannot explain it.
    """
    user_id, order_id, course_id, _ = await _course_order_listing_lessons(
        db_session, user_email=f"lessons-33-{uuid.uuid4().hex[:8]}@test.com"
    )
    db_session.add(
        CourseProgress(
            user_id=user_id, course_id=course_id, completed=False, percentage_complete=33
        )
    )
    await db_session.flush()

    result = await get_refund_eligibility(order_id, db_session, str(user_id))

    assert result.eligible is False
    assert result.reason_code == "progress_exceeded", (
        f"refused with {result.reason_code!r} — the buyer is at 33%, so the honest "
        "reason is the progress rule, not a missing course"
    )
    assert result.progress_percent == 33


@pytest.mark.asyncio
async def test_post_past_the_threshold_names_the_progress_in_its_message(db_session):
    """And the POST's refusal message says the real number, so support can explain it."""
    user_id, order_id, course_id, _ = await _course_order_listing_lessons(
        db_session, user_email=f"lessons-33p-{uuid.uuid4().hex[:8]}@test.com"
    )
    db_session.add(
        CourseProgress(
            user_id=user_id, course_id=course_id, completed=False, percentage_complete=33
        )
    )
    await db_session.flush()
    user = (await db_session.execute(select(User).where(User.id == user_id))).scalar_one()

    with pytest.raises(HTTPException) as exc:
        await request_refund(
            order_id, RefundRequestIn(reason_code="changed_mind"), db_session, user
        )

    assert exc.value.status_code == 409
    detail = str(exc.value.detail)
    assert "33" in detail, f"refusal did not name the actual progress: {detail!r}"
    assert "doesn't include a course" not in detail


# ── The genuinely template-only case must STILL be refused ───────────────────────


@pytest.mark.asyncio
async def test_a_real_template_only_order_is_still_refused(db_session):
    """The fix must not turn "resolve courses properly" into "everything is a course".

    A template-only order has no lessons and no course, and stays ineligible — which is
    the whole point of the check the fix is repairing.
    """
    user_id = uuid.uuid4()
    order_id = uuid.uuid4()
    product_id = uuid.uuid4()
    user = User(
        id=user_id, email=f"tpl-{uuid.uuid4().hex[:8]}@test.com", role=Role.MEMBER, name="T"
    )
    product = Product(
        id=product_id,
        slug=f"p-{uuid.uuid4().hex[:8]}",
        name="Template Only",
        description="D",
        stripe_price_id="price_test",
        price_amount=2900,
        currency="AUD",
    )
    order = Order(
        id=order_id,
        user_id=user_id,
        stripe_session_id="sess_tpl",
        stripe_payment_intent_id=f"pi_test_{uuid.uuid4().hex[:12]}",
        status=OrderStatus.COMPLETED,
        total_amount_cents=2900,
        currency="AUD",
    )
    order_item = OrderItem(order_id=order_id, product_id=product_id, price_amount_cents=2900)
    content = ProductContent(
        product_id=product_id, content_type="template", content_id=uuid.uuid4()
    )
    db_session.add_all([user, product, order, order_item, content])
    await db_session.flush()

    result = await get_refund_eligibility(order_id, db_session, str(user_id))
    assert result.eligible is False
    assert result.reason_code == "no_course_in_order"


@pytest.mark.asyncio
async def test_a_question_pack_only_order_is_still_refused(db_session):
    """The other real non-course shape in the catalogue: question sets and a template
    (`risk-enterprise-op-question-pack` — 0 course, 0 lesson, 1 template, 60 qsets)."""
    user_id = uuid.uuid4()
    order_id = uuid.uuid4()
    product_id = uuid.uuid4()
    user = User(
        id=user_id, email=f"qs-{uuid.uuid4().hex[:8]}@test.com", role=Role.MEMBER, name="Q"
    )
    product = Product(
        id=product_id,
        slug=f"p-{uuid.uuid4().hex[:8]}",
        name="Question Pack",
        description="D",
        stripe_price_id="price_test",
        price_amount=1900,
        currency="AUD",
    )
    order = Order(
        id=order_id,
        user_id=user_id,
        stripe_session_id="sess_qs",
        stripe_payment_intent_id=f"pi_test_{uuid.uuid4().hex[:12]}",
        status=OrderStatus.COMPLETED,
        total_amount_cents=1900,
        currency="AUD",
    )
    order_item = OrderItem(order_id=order_id, product_id=product_id, price_amount_cents=1900)
    db_session.add_all([user, product, order, order_item])
    for _ in range(3):
        db_session.add(
            ProductContent(
                product_id=product_id, content_type="question_set", content_id=uuid.uuid4()
            )
        )
    db_session.add(
        ProductContent(product_id=product_id, content_type="template", content_id=uuid.uuid4())
    )
    await db_session.flush()

    result = await get_refund_eligibility(order_id, db_session, str(user_id))
    assert result.eligible is False
    assert result.reason_code == "no_course_in_order"


# ── The mixed shape: a bundle carrying both a direct course row AND lessons ──────


@pytest.mark.asyncio
async def test_a_product_with_a_direct_course_row_still_works(db_session):
    """`managing-cyber-risk-...-course` is the one product that DOES use
    `content_type='course'` (alongside 5 lesson rows). The fix must keep it working —
    a repair that fixed nine products by breaking the tenth is not a repair."""
    user_id, order_id, course_id, _ = await _course_order_listing_lessons(
        db_session, user_email=f"both-{uuid.uuid4().hex[:8]}@test.com"
    )
    product_id = (
        await db_session.execute(select(OrderItem.product_id).where(OrderItem.order_id == order_id))
    ).scalar_one()
    # Add the direct row too, so this product has BOTH shapes at once.
    db_session.add(
        ProductContent(product_id=product_id, content_type="course", content_id=course_id)
    )
    await db_session.flush()

    result = await get_refund_eligibility(order_id, db_session, str(user_id))
    assert result.eligible is True

    # And progress on that course is still counted exactly once, not doubled by the
    # course being reachable through two paths.
    db_session.add(
        CourseProgress(
            user_id=user_id, course_id=course_id, completed=False, percentage_complete=20
        )
    )
    await db_session.flush()
    result = await get_refund_eligibility(order_id, db_session, str(user_id))
    assert result.eligible is False
    assert result.reason_code == "progress_exceeded"
    assert result.progress_percent == 20


@pytest.mark.asyncio
async def test_a_lesson_with_no_module_resolves_to_no_course(db_session):
    """`lessons.module_id` is nullable, so a standalone lesson is a real shape.

    It must NOT make an order refundable-as-a-course: there is no course, so there is no
    course progress to measure against the 15% rule, and "eligible" would be a guess.
    The inner join drops it, which is the intended behaviour rather than an accident —
    pinned here so a later switch to an outer join cannot quietly change it.
    """
    user_id = uuid.uuid4()
    order_id = uuid.uuid4()
    product_id = uuid.uuid4()
    lesson_id = uuid.uuid4()

    user = User(
        id=user_id, email=f"orphan-{uuid.uuid4().hex[:8]}@test.com", role=Role.MEMBER, name="O"
    )
    product = Product(
        id=product_id,
        slug=f"p-{uuid.uuid4().hex[:8]}",
        name="Standalone Lesson",
        description="D",
        stripe_price_id="price_test",
        price_amount=1900,
        currency="AUD",
    )
    order = Order(
        id=order_id,
        user_id=user_id,
        stripe_session_id="sess_orphan",
        stripe_payment_intent_id=f"pi_test_{uuid.uuid4().hex[:12]}",
        status=OrderStatus.COMPLETED,
        total_amount_cents=1900,
        currency="AUD",
    )
    order_item = OrderItem(order_id=order_id, product_id=product_id, price_amount_cents=1900)
    lesson = Lesson(
        id=lesson_id,
        slug=f"l-{uuid.uuid4().hex[:8]}",
        title="Standalone",
        module_id=None,
        published=True,
    )
    content = ProductContent(product_id=product_id, content_type="lesson", content_id=lesson_id)
    db_session.add_all([user, product, order, order_item, lesson, content])
    await db_session.flush()

    result = await get_refund_eligibility(order_id, db_session, str(user_id))
    assert result.eligible is False
    assert result.reason_code == "no_course_in_order"
