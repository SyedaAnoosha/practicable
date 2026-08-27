"""Tests for W5-R4 — Reviews and ratings.

Covers:
- 403 when reviewer has no entitlement
- 201 when reviewer is entitled
- 409 on duplicate review
- HTML sanitisation in body
- Admin approve transitions + counter update (review_count +1, rating_sum += rating)
- Admin reject transitions + counter decrement
- Featured toggle
- Public featured-reviews endpoint returns only approved + featured
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy import func, select, text

from app.db.models import (
    AuditLog,
    Author,
    Course,
    Domain,
    Entitlement,
    GrantedVia,
    Lesson,
    LessonType,
    Module,
    Product,
    ProductContent,
    Review,
    ReviewState,
    Role,
    Section,
    Template,
    User,
)

# Imported rather than hardcoded: these tests must follow the gate if it moves,
# not silently start asserting the wrong threshold.
from app.api.v1.content.reviews import MIN_REVIEWS_FOR_AGGREGATE

pytestmark = pytest.mark.asyncio

_RV = f"rv{uuid.uuid4().hex[:6]}"


async def _make_course(db_session: AsyncSession):
    """Create a published course with one lesson and a product that grants it."""
    section = Section(name="Test Section", slug=f"section-{uuid.uuid4().hex[:8]}")
    author = Author(name="Test Author", slug=f"author-{uuid.uuid4().hex[:8]}")
    db_session.add_all([section, author])
    await db_session.flush()

    course = Course(
        slug=f"course-{uuid.uuid4().hex[:8]}",
        title=f"{_RV} Review Course",
        subtitle=None,
        description="A course for review tests.",
        section_id=section.id,
        author_id=author.id,
        published=True,
    )
    db_session.add(course)
    await db_session.flush()

    module = Module(title="Module 1", sort_order=0, course_id=course.id)
    db_session.add(module)
    await db_session.flush()

    lesson = Lesson(
        slug=f"lesson-{uuid.uuid4().hex[:8]}",
        title=f"{_RV} Lesson",
        description="d",
        lesson_type=LessonType.READING,
        body="content",
        module_id=module.id,
        sort_order=0,
        published=True,
    )
    db_session.add(lesson)
    await db_session.flush()

    product = Product(
        slug=f"product-{uuid.uuid4().hex[:8]}",
        name=f"{_RV} Course Product",
        description="d",
        stripe_price_id=f"price_test_{uuid.uuid4().hex[:12]}",
        price_amount=4900,
        currency="AUD",
        published=True,
    )
    db_session.add(product)
    await db_session.flush()

    db_session.add(
        ProductContent(product_id=product.id, content_type="lesson", content_id=lesson.id),
    )
    await db_session.flush()

    return course, lesson, product


async def _make_template(db_session: AsyncSession):
    """Create a published template with a product that grants it."""
    section = Section(name="Test Section", slug=f"section-{uuid.uuid4().hex[:8]}")
    author = Author(name="Test Author", slug=f"author-{uuid.uuid4().hex[:8]}")
    db_session.add_all([section, author])
    await db_session.flush()

    template = Template(
        slug=f"template-{uuid.uuid4().hex[:8]}",
        title=f"{_RV} Review Template",
        description="A template for review tests.",
        section_id=section.id,
        author_id=author.id,
        storage_key=f"test/{uuid.uuid4().hex}.xlsx",
        file_name=f"{_RV}_template.xlsx",
        file_size_bytes=1024,
        mime_type="application/vnd.ms-excel",
        published=True,
        is_free=False,
    )
    db_session.add(template)
    await db_session.flush()

    product = Product(
        slug=f"product-{uuid.uuid4().hex[:8]}",
        name=f"{_RV} Template Product",
        description="d",
        stripe_price_id=f"price_test_{uuid.uuid4().hex[:12]}",
        price_amount=2900,
        currency="AUD",
        published=True,
    )
    db_session.add(product)
    await db_session.flush()

    db_session.add(
        ProductContent(product_id=product.id, content_type="template", content_id=template.id),
    )
    await db_session.flush()

    return template, product


async def _make_user(db_session: AsyncSession, name: str = "Test Buyer", role: Role = Role.MEMBER):
    user = User(
        id=uuid.uuid4(),
        email=f"buyer-{uuid.uuid4().hex[:8]}@example.test",
        role=role,
        name=name,
    )
    db_session.add(user)
    await db_session.flush()
    return user


async def _grant_user(db_session, user, product):
    ent = Entitlement(user_id=user.id, product_id=product.id, granted_via=GrantedVia.MANUAL)
    db_session.add(ent)
    await db_session.flush()


def _make_client(user: User) -> AsyncClient:
    """Create an ASGI test client pre-authed as the given user."""
    from tests.conftest import make_fake_token, _authed_client_factory
    # We can't use the fixture directly, so build the headers manually.
    from httpx import ASGITransport
    from main import app

    token = make_fake_token(user.id, user.email, user.name or "")
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://testserver", headers={"Authorization": f"Bearer {token}"})


# ── Submission tests ─────────────────────────────────────────────────────────


async def test_submit_review_403_without_entitlement(
    anon_client: AsyncClient, db_session: AsyncSession
):
    """A user who hasn't purchased the course cannot submit a review."""
    course, _, _ = await _make_course(db_session)
    user = await _make_user(db_session)

    client = _make_client(user)
    async with client:
        resp = await client.post(
            "/reviews",
            json={
                "content_type": "course",
                "content_id": str(course.id),
                "rating": 5,
                "body": "Great course!",
            },
        )

    assert resp.status_code == 403
    assert resp.json()["detail"]["error"]["code"] == "not_entitled"


async def test_submit_review_201_with_entitlement(
    anon_client: AsyncClient, db_session: AsyncSession
):
    """A user who owns the course can submit a review, which is born APPROVED.

    `[CHANGED 2026-08-25, owner direction]` Reviews used to be born `pending` and wait
    for an admin. They are now visible immediately — the entitlement gate (only buyers
    can review) is what makes that safe — and moderation is reactive: an admin deletes
    a bad one. The counters must move on submission too, since the pending→approved
    transition that used to advance them no longer happens.
    """
    course, _, product = await _make_course(db_session)
    user = await _make_user(db_session)
    await _grant_user(db_session, user, product)

    client = _make_client(user)
    async with client:
        resp = await client.post(
            "/reviews",
            json={
                "content_type": "course",
                "content_id": str(course.id),
                "rating": 4,
                "body": "Really helpful content.",
            },
        )

    assert resp.status_code == 201
    body = resp.json()
    assert body["state"] == "approved"
    assert body["rating"] == 4
    assert body["content_type"] == "course"

    # The denormalised counters advance with the insert, in the same transaction.
    await db_session.refresh(course)
    assert course.review_count == 1
    assert course.rating_sum == 4


async def test_submit_review_409_on_duplicate(
    anon_client: AsyncClient, db_session: AsyncSession
):
    """Submitting two reviews for the same content by the same user returns 409."""
    course, _, product = await _make_course(db_session)
    user = await _make_user(db_session)
    await _grant_user(db_session, user, product)

    client = _make_client(user)
    async with client:
        payload = {
            "content_type": "course",
            "content_id": str(course.id),
            "rating": 3,
        }
        resp1 = await client.post("/reviews", json=payload)
        assert resp1.status_code == 201

        resp2 = await client.post("/reviews", json=payload)
        assert resp2.status_code == 409
        assert resp2.json()["detail"]["error"]["code"] == "already_reviewed"


async def test_submit_review_sanitises_html(
    anon_client: AsyncClient, db_session: AsyncSession
):
    """HTML in the review body is sanitised — script tags are stripped."""
    course, _, product = await _make_course(db_session)
    user = await _make_user(db_session)
    await _grant_user(db_session, user, product)

    client = _make_client(user)
    async with client:
        resp = await client.post(
            "/reviews",
            json={
                "content_type": "course",
                "content_id": str(course.id),
                "rating": 5,
                "body": '<p>Great course!</p><script>alert("xss")</script>',
            },
        )

    assert resp.status_code == 201
    assert "<script>" not in resp.json()["body"]
    assert "Great course!" in resp.json()["body"]


async def test_submit_review_display_name_derived(
    anon_client: AsyncClient, db_session: AsyncSession
):
    """When display_name is omitted, it's derived from the user's name."""
    course, _, product = await _make_course(db_session)
    user = await _make_user(db_session, name="Jane Smith")
    await _grant_user(db_session, user, product)

    client = _make_client(user)
    async with client:
        resp = await client.post(
            "/reviews",
            json={
                "content_type": "course",
                "content_id": str(course.id),
                "rating": 5,
            },
        )

    assert resp.status_code == 201
    assert resp.json()["display_name"] == "Jane S."


# ── Moderation + counter tests ───────────────────────────────────────────────


async def test_admin_approve_updates_counters(
    admin_client: AsyncClient, db_session: AsyncSession
):
    """Re-approving an already-approved review is a no-op on the counters.

    `[CHANGED 2026-08-25]` This test used to assert the pending→approved transition.
    Submission now approves directly and advances the counters itself, so what needs
    guarding here is the other half of that: moderating an approved review to
    "approved" again must not double-count it. `_update_counters` derives its delta
    from old_state vs new_state, so an approved→approved move contributes zero.
    """
    course, _, product = await _make_course(db_session)
    user = await _make_user(db_session)
    await _grant_user(db_session, user, product)

    # Submit as the buyer — born approved, counters already at 1/4
    client = _make_client(user)
    async with client:
        resp = await client.post(
            "/reviews",
            json={
                "content_type": "course",
                "content_id": str(course.id),
                "rating": 4,
                "body": "Good.",
            },
        )
        review_id = resp.json()["id"]

    await db_session.refresh(course)
    assert course.review_count == 1
    assert course.rating_sum == 4

    # Re-approve as admin — must not double-count
    resp = await admin_client.patch(
        f"/admin/reviews/{review_id}",
        json={"state": "approved"},
    )
    assert resp.status_code == 200
    assert resp.json()["review_count"] == 1
    assert resp.json()["rating_sum"] == 4

    await db_session.refresh(course)
    assert course.review_count == 1
    assert course.rating_sum == 4


async def test_admin_reject_decrements_counters(
    admin_client: AsyncClient, db_session: AsyncSession
):
    """Rejecting an already-approved review decrements review_count and rating_sum."""
    course, _, product = await _make_course(db_session)
    user = await _make_user(db_session)
    await _grant_user(db_session, user, product)

    # Submit — born approved, so no separate approval step is needed
    client = _make_client(user)
    async with client:
        resp = await client.post(
            "/reviews",
            json={
                "content_type": "course",
                "content_id": str(course.id),
                "rating": 5,
            },
        )
        review_id = resp.json()["id"]

    # Verify 1/5
    await db_session.refresh(course)
    assert course.review_count == 1
    assert course.rating_sum == 5

    # Reject
    resp = await admin_client.patch(
        f"/admin/reviews/{review_id}",
        json={"state": "rejected"},
    )
    assert resp.status_code == 200
    assert resp.json()["review_count"] == 0
    assert resp.json()["rating_sum"] == 0

    await db_session.refresh(course)
    assert course.review_count == 0
    assert course.rating_sum == 0


async def test_admin_feature_toggle(
    admin_client: AsyncClient, db_session: AsyncSession
):
    """Toggling is_featured on a review."""
    course, _, product = await _make_course(db_session)
    user = await _make_user(db_session)
    await _grant_user(db_session, user, product)

    client = _make_client(user)
    async with client:
        resp = await client.post(
            "/reviews",
            json={
                "content_type": "course",
                "content_id": str(course.id),
                "rating": 5,
                "body": "Excellent!",
            },
        )
        review_id = resp.json()["id"]

    # Approve + feature
    resp = await admin_client.patch(
        f"/admin/reviews/{review_id}",
        json={"state": "approved", "is_featured": True},
    )
    assert resp.status_code == 200
    assert resp.json()["is_featured"] is True

    # Un-feature
    resp = await admin_client.patch(
        f"/admin/reviews/{review_id}",
        json={"state": "approved", "is_featured": False},
    )
    assert resp.json()["is_featured"] is False


# ── Public featured-reviews endpoint ─────────────────────────────────────────


async def test_featured_reviews_endpoint(
    anon_client: AsyncClient, admin_client: AsyncClient, db_session: AsyncSession
):
    """GET /reviews/featured returns only approved, featured reviews with bodies."""
    course, _, product = await _make_course(db_session)
    user = await _make_user(db_session)
    await _grant_user(db_session, user, product)

    # Submit as buyer
    client = _make_client(user)
    async with client:
        resp = await client.post(
            "/reviews",
            json={
                "content_type": "course",
                "content_id": str(course.id),
                "rating": 5,
                "body": "Outstanding course!",
            },
        )
        review_id = resp.json()["id"]

    # Approve + feature via admin
    await admin_client.patch(
        f"/admin/reviews/{review_id}",
        json={"state": "approved", "is_featured": True},
    )

    # Fetch featured (public, unauthenticated)
    resp = await anon_client.get(
        "/reviews/featured",
        params={"content_type": "course", "content_id": str(course.id)},
    )
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) >= 1
    assert any(i["id"] == review_id for i in items)


async def test_featured_reviews_excludes_unfeatured(
    anon_client: AsyncClient, admin_client: AsyncClient, db_session: AsyncSession
):
    """An approved review is NOT featured until an admin features it.

    `[CHANGED 2026-08-25]` This was `..._excludes_pending`, and relied on submission
    producing a pending review. Reviews are approved on write now, so "approved" is no
    longer a curation signal at all — `is_featured` is the only thing separating an
    ordinary review from one that appears on a marketing surface. That is what this
    guards: without it, going approve-on-write would silently promote every review a
    customer writes onto the landing page.
    """
    course, _, product = await _make_course(db_session)
    user = await _make_user(db_session)
    await _grant_user(db_session, user, product)

    client = _make_client(user)
    async with client:
        resp = await client.post(
            "/reviews",
            json={
                "content_type": "course",
                "content_id": str(course.id),
                "rating": 5,
                "body": "Approved, but nobody featured it.",
            },
        )
        assert resp.json()["state"] == "approved"
        assert resp.json()["is_featured"] is False
        review_id = resp.json()["id"]

    # Do NOT feature it.
    resp = await anon_client.get(
        "/reviews/featured",
        params={"content_type": "course", "content_id": str(course.id)},
    )
    assert resp.status_code == 200
    items = resp.json()
    assert not any(i["id"] == review_id for i in items)

    # The same holds for the site-wide (no content_id) listing the landing page uses.
    resp = await anon_client.get("/reviews/featured")
    assert resp.status_code == 200
    assert not any(i["id"] == review_id for i in resp.json())


# ── Template review (non-course content type) ────────────────────────────────


async def test_submit_template_review(
    anon_client: AsyncClient, admin_client: AsyncClient, db_session: AsyncSession
):
    """Reviews work for templates too — same entitlement gate, same counter update."""
    template, product = await _make_template(db_session)
    user = await _make_user(db_session)
    await _grant_user(db_session, user, product)

    client = _make_client(user)
    async with client:
        resp = await client.post(
            "/reviews",
            json={
                "content_type": "template",
                "content_id": str(template.id),
                "rating": 3,
                "body": "Decent template.",
            },
        )
        assert resp.status_code == 201
        review_id = resp.json()["id"]

    # Approve via admin
    resp = await admin_client.patch(
        f"/admin/reviews/{review_id}",
        json={"state": "approved"},
    )
    assert resp.status_code == 200
    assert resp.json()["review_count"] == 1
    assert resp.json()["rating_sum"] == 3

    await db_session.refresh(template)
    assert template.review_count == 1
    assert template.rating_sum == 3


# ── Admin list endpoint ───────────────────────────────────────────────────────


async def test_admin_list_reviews_with_state_filter(
    admin_client: AsyncClient, db_session: AsyncSession
):
    """GET /admin/reviews?state=… filters by state.

    `[CHANGED 2026-08-25]` Submission no longer produces `pending`, so the pair this
    separates is now approved (the state everything is born in) vs rejected (the state
    an admin moves one to). The moderated_by/moderated_at assertions move with it: an
    untouched review has null moderation fields even though it is approved, which is
    the observable difference between "approved because nobody objected" and "approved
    by a named admin".
    """
    course, _, product = await _make_course(db_session)
    user = await _make_user(db_session)
    await _grant_user(db_session, user, product)

    # Submit two reviews from different users — both born approved
    client = _make_client(user)
    async with client:
        resp = await client.post(
            "/reviews",
            json={"content_type": "course", "content_id": str(course.id), "rating": 4},
        )
        review1_id = resp.json()["id"]

    user2 = await _make_user(db_session, name="Second Buyer")
    await _grant_user(db_session, user2, product)
    client2 = _make_client(user2)
    async with client2:
        resp = await client2.post(
            "/reviews",
            json={"content_type": "course", "content_id": str(course.id), "rating": 3},
        )
        review2_id = resp.json()["id"]

    # Reject the first review
    await admin_client.patch(f"/admin/reviews/{review1_id}", json={"state": "rejected"})

    # List only rejected — should return only the first review
    resp = await admin_client.get("/admin/reviews", params={"state": "rejected"})
    assert resp.status_code == 200
    data = resp.json()
    ids = [r["id"] for r in data]
    assert review1_id in ids
    assert review2_id not in ids

    # The moderated review must include admin-only fields
    rejected = next(r for r in data if r["id"] == review1_id)
    assert rejected["moderated_by"] is not None, "moderated_by must be set after moderation"
    assert rejected["moderated_at"] is not None, "moderated_at must be set after moderation"

    # List only approved — should return only the second, untouched review
    resp = await admin_client.get("/admin/reviews", params={"state": "approved"})
    assert resp.status_code == 200
    data = resp.json()
    ids = [r["id"] for r in data]
    assert review2_id in ids
    assert review1_id not in ids

    # An auto-approved review nobody moderated must NOT have moderation fields
    untouched = next(r for r in data if r["id"] == review2_id)
    assert untouched["moderated_by"] is None, "unmoderated review should have null moderated_by"
    assert untouched["moderated_at"] is None, "unmoderated review should have null moderated_at"

    # List all (no filter) — should return both
    resp = await admin_client.get("/admin/reviews")
    assert resp.status_code == 200
    ids = [r["id"] for r in resp.json()]
    assert review1_id in ids
    assert review2_id in ids


# ── Audit row verification ───────────────────────────────────────────────────


async def test_moderation_writes_audit_row(
    admin_client: AsyncClient, db_session: AsyncSession
):
    """Every moderation transition writes an audit_log row."""
    course, _, product = await _make_course(db_session)
    user = await _make_user(db_session)
    await _grant_user(db_session, user, product)

    client = _make_client(user)
    async with client:
        resp = await client.post(
            "/reviews",
            json={"content_type": "course", "content_id": str(course.id), "rating": 5},
        )
        review_id = resp.json()["id"]

    # Count audit rows before. `scalar_one`, not `scalar`: a COUNT always returns
    # exactly one row, so `scalar`'s Optional return is a lie the arithmetic below
    # cannot honour (Pylance flags `before + 1` as unsupported for None). `scalar_one`
    # is both correctly typed and the stronger assertion — it raises if the query ever
    # stops returning the single row this arithmetic assumes.
    before = (
        await db_session.execute(
            select(func.count()).select_from(AuditLog)
        )
    ).scalar_one()

    # Approve
    await admin_client.patch(f"/admin/reviews/{review_id}", json={"state": "approved"})

    # Count audit rows after — should be one more
    after = (
        await db_session.execute(
            select(func.count()).select_from(AuditLog)
        )
    ).scalar_one()
    assert after == before + 1

    # Verify the audit row content
    audit = (
        await db_session.execute(
            select(AuditLog).order_by(AuditLog.created_at.desc()).limit(1)
        )
    ).scalar_one()
    assert audit.action == "review_approved"
    assert audit.target_type == "review"


# ── 404 / 400 error paths ───────────────────────────────────────────────────


async def test_moderate_nonexistent_review_returns_404(
    admin_client: AsyncClient,
):
    """PATCH /admin/reviews/<bad-id> returns 404."""
    resp = await admin_client.patch(
        "/admin/reviews/00000000-0000-0000-0000-000000000000",
        json={"state": "approved"},
    )
    assert resp.status_code == 404


async def test_moderate_invalid_state_returns_400(
    admin_client: AsyncClient, db_session: AsyncSession
):
    """PATCH with an invalid state value returns 400."""
    course, _, product = await _make_course(db_session)
    user = await _make_user(db_session)
    await _grant_user(db_session, user, product)

    client = _make_client(user)
    async with client:
        resp = await client.post(
            "/reviews",
            json={"content_type": "course", "content_id": str(course.id), "rating": 3},
        )
        review_id = resp.json()["id"]

    resp = await admin_client.patch(
        f"/admin/reviews/{review_id}",
        json={"state": "banana"},
    )
    assert resp.status_code == 400


# ── Rating bounds validation ─────────────────────────────────────────────────


async def test_submit_review_rating_out_of_range_returns_422(
    anon_client: AsyncClient, db_session: AsyncSession
):
    """Rating must be 1-5. Out of range returns 422."""
    course, _, product = await _make_course(db_session)
    user = await _make_user(db_session)
    await _grant_user(db_session, user, product)

    client = _make_client(user)
    async with client:
        for bad_rating in [0, 6, -1, 100]:
            resp = await client.post(
                "/reviews",
                json={"content_type": "course", "content_id": str(course.id), "rating": bad_rating},
            )
            assert resp.status_code == 422, f"rating={bad_rating} should fail validation"


# ── Non-existent content ─────────────────────────────────────────────────────


async def test_submit_review_for_nonexistent_content_returns_404(
    anon_client: AsyncClient, db_session: AsyncSession
):
    """Reviewing content that doesn't exist returns 404."""
    user = await _make_user(db_session)
    client = _make_client(user)
    async with client:
        resp = await client.post(
            "/reviews",
            json={
                "content_type": "course",
                "content_id": "00000000-0000-0000-0000-000000000000",
                "rating": 5,
            },
        )
        assert resp.status_code == 404


# ── Multi-review counter arithmetic ──────────────────────────────────────────


async def test_multiple_reviews_counter_arithmetic(
    admin_client: AsyncClient, db_session: AsyncSession
):
    """Approving two reviews with different ratings produces the correct sum."""
    course, _, product = await _make_course(db_session)
    user1 = await _make_user(db_session, name="Buyer One")
    user2 = await _make_user(db_session, name="Buyer Two")
    await _grant_user(db_session, user1, product)
    await _grant_user(db_session, user2, product)

    # Submit from both users
    ids = []
    for user, rating in [(user1, 3), (user2, 5)]:
        client = _make_client(user)
        async with client:
            resp = await client.post(
                "/reviews",
                json={"content_type": "course", "content_id": str(course.id), "rating": rating},
            )
            ids.append(resp.json()["id"])

    # Approve both
    for rid in ids:
        resp = await admin_client.patch(f"/admin/reviews/{rid}", json={"state": "approved"})

    # Verify combined counters: 2 reviews, sum = 3 + 5 = 8
    await db_session.refresh(course)
    assert course.review_count == 2
    assert course.rating_sum == 8

    # Reject the first one — count drops to 1, sum drops to 5
    await admin_client.patch(f"/admin/reviews/{ids[0]}", json={"state": "rejected"})
    await db_session.refresh(course)
    assert course.review_count == 1
    assert course.rating_sum == 5


# ── Reconciler script ────────────────────────────────────────────────────────


async def test_reconciler_fixes_counter_drift(
    admin_client: AsyncClient, db_session: AsyncSession
):
    """Manually corrupting counters, then running the reconciler, restores correct values."""
    course, _, product = await _make_course(db_session)
    user = await _make_user(db_session)
    await _grant_user(db_session, user, product)

    # Submit + approve a review (rating 4)
    client = _make_client(user)
    async with client:
        resp = await client.post(
            "/reviews",
            json={"content_type": "course", "content_id": str(course.id), "rating": 4},
        )
        review_id = resp.json()["id"]
    await admin_client.patch(f"/admin/reviews/{review_id}", json={"state": "approved"})

    # Verify correct state
    await db_session.refresh(course)
    assert course.review_count == 1
    assert course.rating_sum == 4

    # Manually corrupt the counters (simulate drift)
    await db_session.execute(
        text("UPDATE courses SET review_count = 99, rating_sum = 999 WHERE id = :id"),
        {"id": course.id},
    )
    await db_session.flush()
    await db_session.refresh(course)
    assert course.review_count == 99  # corrupted

    # The reconciler script uses its own AsyncSessionLocal session, which can't
    # see uncommitted test data. Instead, simulate its logic: recompute from
    # reviews and write back.
    # Scoped to THIS course. Without the content_id filter this counted every
    # approved course review in the database and wrote that total onto one course —
    # so it passed only while this course was the sole one with approved reviews, and
    # started failing (71 != 1) as soon as any other test left some behind. The real
    # reconciler groups by content_id (scripts/reconcile_review_aggregates.py); a
    # simulation of it that aggregates across every row is not simulating it.
    correct = (
        await db_session.execute(
            select(func.count(), func.coalesce(func.sum(Review.rating), 0))
            .where(
                Review.content_type == "course",
                Review.content_id == course.id,
                Review.state == ReviewState.APPROVED.value,
            )
        )
    ).one()
    correct_count, correct_sum = correct
    await db_session.execute(
        text("UPDATE courses SET review_count = :count, rating_sum = :sum WHERE id = :id"),
        {"count": correct_count, "sum": correct_sum, "id": course.id},
    )
    await db_session.flush()
    await db_session.refresh(course)
    assert course.review_count == 1
    assert course.rating_sum == 4


# ── Stage B: the aggregate gate (§2.4, §4.6) ──────────────────────────────────
# The threshold is enforced by the backend, not only by the client. A rating the
# API sends and the frontend hides is still a rating on the wire.


async def test_rating_is_null_below_threshold(
    anon_client: AsyncClient, db_session: AsyncSession
):
    """Below MIN_REVIEWS_FOR_AGGREGATE the API returns rating: null.

    `review_count` is still reported truthfully — an editorial consumer needs to
    know how close an item is to the gate — but the aggregate itself is withheld,
    because "5.0 (2 reviews)" reads worse than no rating at all.
    """
    course, _, _ = await _make_course(db_session)
    course.review_count = MIN_REVIEWS_FOR_AGGREGATE - 1
    course.rating_sum = 5 * (MIN_REVIEWS_FOR_AGGREGATE - 1)  # a perfect 5.0 average
    await db_session.flush()

    resp = await anon_client.get(
        "/reviews/rating",
        params={"content_type": "course", "content_id": str(course.id)},
    )
    assert resp.status_code == 200
    body = resp.json()

    assert body["rating"] is None, (
        "A flawless average must still be withheld below the threshold — "
        "otherwise the gate only exists in the client."
    )
    assert body["review_count"] == MIN_REVIEWS_FOR_AGGREGATE - 1


async def test_rating_appears_at_threshold(
    anon_client: AsyncClient, db_session: AsyncSession
):
    """At exactly MIN_REVIEWS_FOR_AGGREGATE the aggregate appears, with no deploy.

    This is the "when the eighth review is approved, stars appear" promise in §2.4.
    """
    course, _, _ = await _make_course(db_session)
    course.review_count = MIN_REVIEWS_FOR_AGGREGATE
    course.rating_sum = 4 * MIN_REVIEWS_FOR_AGGREGATE
    await db_session.flush()

    resp = await anon_client.get(
        "/reviews/rating",
        params={"content_type": "course", "content_id": str(course.id)},
    )
    assert resp.status_code == 200
    assert resp.json()["rating"] == 4.0


async def test_rating_zero_reviews_is_null_not_a_division_error(
    anon_client: AsyncClient, db_session: AsyncSession
):
    """An item nobody has reviewed returns rating: null, and never divides by zero."""
    course, _, _ = await _make_course(db_session)

    resp = await anon_client.get(
        "/reviews/rating",
        params={"content_type": "course", "content_id": str(course.id)},
    )
    assert resp.status_code == 200
    assert resp.json() == {
        "content_type": "course",
        "content_id": str(course.id),
        "rating": None,
        "review_count": 0,
    }


async def test_rating_unknown_content_type_returns_422(anon_client: AsyncClient):
    """An unrecognised content type is refused rather than silently reported as 0."""
    resp = await anon_client.get(
        "/reviews/rating",
        params={"content_type": "banana", "content_id": str(uuid.uuid4())},
    )
    assert resp.status_code == 422


async def test_reconciler_uses_the_same_content_type_vocabulary_as_the_schema(
    db_session: AsyncSession,
):
    """The reconciler must query the content_type values the database actually stores.

    A pack is sold as a Product row but reviewed as content_type 'pack' — the
    vocabulary migration 029's CHECK constraint enforces. A reconciler that queried
    for 'product' instead would match zero rows for every pack, compute an expected
    count of 0, and with --apply zero out counters that were correct — corrupting
    data in the name of repairing it, while reporting success.

    Asserted against the CHECK constraint in the live schema rather than a literal
    list here, so the test follows the schema if the vocabulary ever changes.
    """
    import inspect

    from scripts import reconcile_review_aggregates

    # The vocabulary the database will actually accept, read from the constraint.
    constraint_src = (
        await db_session.execute(
            text(
                "SELECT pg_get_constraintdef(oid) FROM pg_constraint "
                "WHERE conname = 'ck_reviews_content_type'"
            )
        )
    ).scalar_one()

    allowed = {v for v in ("course", "template", "pack", "product")
               if f"'{v}'" in constraint_src}
    assert allowed == {"course", "template", "pack"}, (
        f"Unexpected content_type vocabulary in the schema: {constraint_src}"
    )

    # Every label the reconciler pairs with a model must be one the schema allows.
    src = inspect.getsource(reconcile_review_aggregates.reconcile)
    labels = {
        label
        for label in ("course", "template", "pack", "product")
        if f'"{label}"' in src
    }
    assert "product" not in labels, (
        "The reconciler queries reviews.content_type == 'product', which the schema "
        "never stores — every pack's counters would be reconciled to zero."
    )
    assert {"course", "template", "pack"} <= labels


async def test_submit_review_403_when_entitlement_is_revoked(
    db_session: AsyncSession,
):
    """A refunded buyer loses the right to review, not just the right to read.

    The gate is `has_access_to`, the same one every other resource uses — so a
    revoked entitlement closes reviewing for free. This test exists because a
    bespoke "did they ever buy it" check would pass here and would be wrong: the
    question is whether access is live *now*, not whether it once was.
    """
    course, _, product = await _make_course(db_session)
    user = await _make_user(db_session)

    ent = Entitlement(
        user_id=user.id, product_id=product.id, granted_via=GrantedVia.PURCHASE,
    )
    db_session.add(ent)
    await db_session.flush()

    # Refund: the row survives, revoked_at is what the gate checks.
    ent.revoked_at = datetime.now(timezone.utc)
    ent.revoked_reason = "refunded"
    await db_session.flush()

    client = _make_client(user)
    async with client:
        resp = await client.post(
            "/reviews",
            json={
                "content_type": "course",
                "content_id": str(course.id),
                "rating": 5,
                "body": "Refunded, but still trying to review.",
            },
        )

    assert resp.status_code == 403
    assert resp.json()["detail"]["error"]["code"] == "not_entitled"


# ── Review bodies are plain text, not rich HTML ───────────────────────────────
#
# `[ADDED 2026-08-27]` The submit endpoint used to run bodies through
# `sanitize_html`, the rich-text-editor sanitiser, which deliberately promotes plain
# text to real paragraphs. A review typed as "I definitely loved using it!" was
# therefore STORED as "<p>I definitely loved using it!</p>", and Testimonial.tsx
# renders the body as `{review.body}` — plain JSX text that React escapes — so the
# reviewer's words appeared on the public page wrapped in visible <p> tags.
#
# These test the sanitiser contract directly. That is the seam the bug lived in: the
# endpoint picked the wrong helper, and both helpers are "sanitise" as far as the call
# site reads.

from app.core.html_sanitizer import strip_tags


async def test_plain_text_review_body_is_not_wrapped_in_paragraph_tags():
    """The exact regression: no markup in, no markup out."""
    assert strip_tags("I definitely loved using it!").strip() == (
        "I definitely loved using it!"
    )


async def test_markup_in_a_review_body_is_flattened_to_its_text():
    assert strip_tags("<p>Very <strong>practical</strong>.</p>").strip() == (
        "Very practical."
    )


async def test_a_body_of_only_markup_becomes_empty_so_the_endpoint_stores_null():
    """`body or None` in the endpoint depends on this being falsy — otherwise a review
    with no words reads as "has a written review" to every consumer of the column."""
    assert (strip_tags("<p></p>").strip() or None) is None


async def test_script_tags_do_not_survive_a_review_body():
    """Defence in depth: the field is rendered as text today, but a body that still
    carried a live <script> would be one `dangerouslySetInnerHTML` away from XSS."""
    cleaned = strip_tags("<script>alert('xss')</script>Nice template")
    assert "<script>" not in cleaned
    assert "Nice template" in cleaned
