"""grant_course_lessons and its two call sites.

regression: a buyer who owned a course could see a lesson locked — root cause and
full reasoning in grant_course_lessons' own docstring (admin/courses.py). This
covers the function directly (idempotency, empty-course, no-product-yet) rather
than only through the full purchase flow test_course_purchase_e2e.py exercises.
"""
import uuid

import pytest
from sqlalchemy import select

from app.api.v1.admin.courses import grant_course_lessons
from app.db.models import ProductContent


@pytest.mark.asyncio
async def test_grant_course_lessons_grants_every_lesson_in_the_course(admin_client, db_session, content_graph):
    g = content_graph

    # A fresh product with no grants yet, pointed at content_graph's own course (which
    # already has two lessons: the video lesson and the mixed lesson).
    from app.db.models import Product

    product = Product(
        slug=f"grant-test-{uuid.uuid4().hex[:8]}", name="Grant test product", description="d",
        stripe_price_id=f"price_test_{uuid.uuid4().hex[:12]}", price_amount=1000, currency="AUD", published=True,
    )
    db_session.add(product)
    await db_session.flush()

    granted = await grant_course_lessons(db_session, product_id=product.id, course_id=g.course.id)
    await db_session.flush()

    # All three of the course's lessons, including the unpublished draft_lesson —
    # deliberate, not a gap: granting a draft's entitlement now means it's ready the
    # instant it's published, and it's harmless in the meantime since
    # _lesson_entitled is only ever consulted for lessons content/lessons.py has
    # already filtered to published=True.
    assert granted == 3

    rows = (
        await db_session.execute(
            select(ProductContent.content_id).where(
                ProductContent.product_id == product.id, ProductContent.content_type == "lesson"
            )
        )
    ).scalars().all()
    assert set(rows) == {g.lesson.id, g.mixed_lesson.id, g.draft_lesson.id}


@pytest.mark.asyncio
async def test_grant_course_lessons_is_idempotent(db_session, content_graph):
    """Calling it twice must not create duplicate product_contents rows — there is no
    unique constraint on (product_id, content_type, content_id) to fall back on."""
    g = content_graph
    from app.db.models import Product

    product = Product(
        slug=f"grant-idem-{uuid.uuid4().hex[:8]}", name="Idempotency test product", description="d",
        stripe_price_id=f"price_test_{uuid.uuid4().hex[:12]}", price_amount=1000, currency="AUD", published=True,
    )
    db_session.add(product)
    await db_session.flush()

    first = await grant_course_lessons(db_session, product_id=product.id, course_id=g.course.id)
    await db_session.flush()
    assert first == 3  # lesson, mixed_lesson, draft_lesson — see the other test's comment

    second = await grant_course_lessons(db_session, product_id=product.id, course_id=g.course.id)
    await db_session.flush()
    assert second == 0, "a repeat call must grant nothing new"

    rows = (
        await db_session.execute(
            select(ProductContent).where(
                ProductContent.product_id == product.id, ProductContent.content_type == "lesson"
            )
        )
    ).scalars().all()
    assert len(rows) == 3, "must not have created duplicate rows"


@pytest.mark.asyncio
async def test_grant_course_lessons_dry_run_reports_without_writing(db_session, content_graph):
    g = content_graph
    from app.db.models import Product

    product = Product(
        slug=f"grant-dry-{uuid.uuid4().hex[:8]}", name="Dry run test product", description="d",
        stripe_price_id=f"price_test_{uuid.uuid4().hex[:12]}", price_amount=1000, currency="AUD", published=True,
    )
    db_session.add(product)
    await db_session.flush()

    reported = await grant_course_lessons(db_session, product_id=product.id, course_id=g.course.id, dry_run=True)
    await db_session.flush()
    assert reported == 3

    rows = (
        await db_session.execute(
            select(ProductContent).where(
                ProductContent.product_id == product.id, ProductContent.content_type == "lesson"
            )
        )
    ).scalars().all()
    assert rows == [], "dry_run must not write anything"


@pytest.mark.asyncio
async def test_grant_course_lessons_on_a_course_with_no_lessons_grants_nothing(db_session, content_graph):
    """Not an error path — a brand-new course with no lessons yet has nothing to grant."""
    g = content_graph
    from app.db.models import Course, Product

    course = Course(
        slug=f"empty-course-{uuid.uuid4().hex[:8]}", title="Empty Course", description="d",
        section_id=g.section.id, author_id=g.author.id, published=False,
    )
    db_session.add(course)
    product = Product(
        slug=f"empty-course-product-{uuid.uuid4().hex[:8]}", name="p", description="d",
        stripe_price_id=f"price_test_{uuid.uuid4().hex[:12]}", price_amount=1000, currency="AUD", published=True,
    )
    db_session.add(product)
    await db_session.flush()

    granted = await grant_course_lessons(db_session, product_id=product.id, course_id=course.id)
    assert granted == 0


@pytest.mark.asyncio
async def test_create_lesson_on_a_course_with_no_product_yet_does_not_error(admin_client):
    """The exact non-bug path: a course that isn't purchasable yet has no product to
    grant against, and create_lesson must not fail just because none exists."""
    resp = await admin_client.post(
        "/admin/courses", json={"title": "No Product Course", "description": "d"}
    )
    assert resp.status_code == 201, resp.text
    course_id = resp.json()["id"]

    resp = await admin_client.post(f"/admin/courses/{course_id}/modules", json={"title": "M1"})
    assert resp.status_code == 201, resp.text
    module_id = resp.json()["modules"][0]["id"]

    resp = await admin_client.post(
        f"/admin/modules/{module_id}/lessons",
        json={"title": "Lesson with no product yet", "lesson_type": "reading", "body": "x"},
    )
    assert resp.status_code == 201, resp.text
