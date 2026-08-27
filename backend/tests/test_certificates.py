"""Tests for certificates on course completion.

Covers:
- Completing the last lesson issues exactly one certificate
- Completing it twice issues one (replay)
- Snapshot survives a course rename
- Verify returns only the public fields
- Unknown verification code → 404
- Revoked certificate shows revoked on verify
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import patch

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    Author,
    Certificate,
    Course,
    Entitlement,
    GrantedVia,
    Lesson,
    LessonProgress,
    Module,
    Product,
    ProductContent,
    Section,
    User,
)
from tests.conftest import make_fake_token

pytestmark = pytest.mark.asyncio


async def _setup_course(db_session: AsyncSession) -> tuple[Course, Module, list[Lesson]]:
    """Create a course with 3 published lessons."""
    section = Section(name="Test Section", slug=f"section-{uuid.uuid4().hex[:8]}")
    author = Author(name="Test Author", slug=f"author-{uuid.uuid4().hex[:8]}")
    db_session.add_all([section, author])
    await db_session.flush()

    course = Course(
        slug=f"cert-course-{uuid.uuid4().hex[:8]}",
        title="Certificate Test Course",
        description="d",
        section_id=section.id,
        author_id=author.id,
        published=True,
    )
    db_session.add(course)
    await db_session.flush()

    module = Module(title="Module 1", sort_order=0, course_id=course.id)
    db_session.add(module)
    await db_session.flush()

    lessons = []
    for i in range(3):
        lesson = Lesson(
            slug=f"cert-lesson-{i}-{uuid.uuid4().hex[:8]}",
            title=f"Lesson {i}",
            description="d",
            lesson_type="reading",
            body="body",
            module_id=module.id,
            sort_order=i,
            published=True,
        )
        db_session.add(lesson)
        lessons.append(lesson)
    await db_session.flush()

    return course, module, lessons


async def _create_entitled_user(db_session: AsyncSession, course: Course, lessons: list[Lesson]) -> tuple[User, AsyncClient]:
    """Create a user with entitlement, and return them plus an authenticated client."""
    from app.db.models import Role
    user = User(
        id=uuid.uuid4(),
        email=f"cert-user-{uuid.uuid4().hex[:8]}@example.test",
        role=Role.MEMBER,
        name="Test Learner",
    )
    db_session.add(user)
    await db_session.flush()

    product = Product(
        slug=f"cert-product-{uuid.uuid4().hex[:8]}",
        name="Course Access",
        description="d",
        stripe_price_id=f"price_test_{uuid.uuid4().hex[:12]}",
        price_amount=4900,
        currency="AUD",
        published=True,
    )
    db_session.add(product)
    await db_session.flush()

    for lesson in lessons:
        db_session.add(ProductContent(
            product_id=product.id, content_type="lesson", content_id=lesson.id,
        ))
    await db_session.flush()

    ent = Entitlement(user_id=user.id, product_id=product.id, granted_via=GrantedVia.MANUAL)
    db_session.add(ent)
    await db_session.flush()

    # Create an authenticated client for this user
    from httpx import ASGITransport
    from main import app as _app
    token = make_fake_token(user.id, user.email, user.name)
    transport = ASGITransport(app=_app)
    client = AsyncClient(
        transport=transport,
        base_url="http://testserver",
        headers={"Authorization": f"Bearer {token}"},
    )

    return user, client


async def test_completing_course_issues_certificate(db_session: AsyncClient):
    """Completing the last lesson issues exactly one certificate."""
    course, module, lessons = await _setup_course(db_session)
    user, client = await _create_entitled_user(db_session, course, lessons)

    # Mark all but the last lesson complete directly in DB
    now = datetime.now(timezone.utc)
    for lesson in lessons[:-1]:
        db_session.add(LessonProgress(
            user_id=user.id, lesson_id=lesson.id,
            completed=True, completed_at=now,
        ))
    await db_session.flush()

    # Mark the last lesson complete via the API (using the user's client)
    resp = await client.post(f"/lessons/{lessons[-1].id}/complete")
    assert resp.status_code == 200, resp.text

    # Check that exactly one certificate was issued
    result = await db_session.execute(
        select(Certificate).where(
            Certificate.user_id == user.id,
            Certificate.course_id == course.id,
        )
    )
    certs = result.scalars().all()
    assert len(certs) == 1
    cert = certs[0]
    assert cert.learner_name_snapshot == "Test Learner"
    assert cert.course_title_snapshot == "Certificate Test Course"
    assert cert.verification_code  # non-empty


async def test_completing_twice_issues_one_certificate(db_session: AsyncSession):
    """Completing the course twice (replay) issues one certificate."""
    course, module, lessons = await _setup_course(db_session)
    user, client = await _create_entitled_user(db_session, course, lessons)

    # Mark all lessons complete via the API
    for lesson in lessons:
        resp = await client.post(f"/lessons/{lesson.id}/complete")
        assert resp.status_code == 200

    # Call complete again for the last lesson (replay)
    resp = await client.post(f"/lessons/{lessons[-1].id}/complete")
    assert resp.status_code == 200

    # Still exactly one certificate
    result = await db_session.execute(
        select(Certificate).where(
            Certificate.user_id == user.id,
            Certificate.course_id == course.id,
        )
    )
    assert len(result.scalars().all()) == 1


async def test_snapshot_survives_course_rename(db_session: AsyncSession):
    """The certificate stores a snapshot — renaming the course doesn't change it."""
    course, module, lessons = await _setup_course(db_session)
    user, client = await _create_entitled_user(db_session, course, lessons)

    for lesson in lessons:
        resp = await client.post(f"/lessons/{lesson.id}/complete")
        assert resp.status_code == 200

    # Rename the course
    course.title = "Renamed Course"
    await db_session.flush()

    # Certificate still has the old title
    cert = (await db_session.execute(
        select(Certificate).where(
            Certificate.user_id == user.id,
            Certificate.course_id == course.id,
        )
    )).scalar_one()
    assert cert.course_title_snapshot == "Certificate Test Course"


async def test_verify_returns_public_fields(anon_client: AsyncClient, db_session: AsyncSession):
    """The verify endpoint returns only public fields."""
    course, module, lessons = await _setup_course(db_session)
    user, client = await _create_entitled_user(db_session, course, lessons)

    for lesson in lessons:
        resp = await client.post(f"/lessons/{lesson.id}/complete")
        assert resp.status_code == 200

    cert = (await db_session.execute(
        select(Certificate).where(Certificate.user_id == user.id)
    )).scalar_one()

    # Verify via public endpoint
    verify_resp = await anon_client.get(f"/verify/{cert.verification_code}")
    assert verify_resp.status_code == 200
    body = verify_resp.json()
    assert body["learner_name"] == "Test Learner"
    assert body["course_title"] == "Certificate Test Course"
    assert body["revoked"] is False
    # Must NOT contain user_id, email, or other private fields
    assert "user_id" not in body
    assert "email" not in body


async def test_verify_unknown_code_is_404(anon_client: AsyncClient):
    """An unknown verification code returns 404."""
    resp = await anon_client.get("/verify/not-a-real-code")
    assert resp.status_code == 404


async def test_verify_revoked_certificate(anon_client: AsyncClient, db_session: AsyncSession):
    """A revoked certificate shows revoked=True on verify."""
    course, module, lessons = await _setup_course(db_session)
    user, _client = await _create_entitled_user(db_session, course, lessons)

    # Manually create a revoked certificate
    cert = Certificate(
        user_id=user.id,
        course_id=course.id,
        verification_code="REVOKED-CODE-123",
        learner_name_snapshot="Test Learner",
        course_title_snapshot="Test Course",
        issued_at=datetime.now(timezone.utc),
        revoked_at=datetime.now(timezone.utc),
        revoked_reason="Refunded",
    )
    db_session.add(cert)
    await db_session.flush()

    resp = await anon_client.get("/verify/REVOKED-CODE-123")
    assert resp.status_code == 200
    body = resp.json()
    assert body["revoked"] is True
    assert body["revoked_reason"] == "Refunded"


async def test_verify_rate_limits_enumeration_of_distinct_codes(
    anon_client: AsyncClient,
):
    """Guessing many DIFFERENT codes from one caller must hit the rate limit.

    This is the shape of the actual attack, and it is the case a limiter keyed on
    `verification_code` silently fails: each guess is a different key, so every
    attempt lands on its own fresh counter and the limit never fires. Keying on the
    caller is what makes the cap mean anything. Hammering a single code (the easy
    case) would pass either way, which is why this test uses distinct codes.
    """
    from app.api.v1.content.verify import _verify_limiter

    # A limiter is process-global and other tests share it; start from a clean slate
    # so this asserts its own traffic rather than whatever ran before it.
    _verify_limiter._counters.clear()

    statuses = []
    for _ in range(40):  # comfortably past the 30/minute cap
        resp = await anon_client.get(f"/verify/{uuid.uuid4().hex}")
        statuses.append(resp.status_code)

    assert 429 in statuses, (
        "Enumerating 40 distinct codes from one caller was never rate-limited. "
        "The limiter is keyed on something the attacker varies."
    )
    # Everything before the cutoff should be an honest 404, not a 429.
    assert statuses[0] == 404

    _verify_limiter._counters.clear()


async def test_uncompleting_then_recompleting_still_issues_one(
    db_session: AsyncSession,
):
    """The edge a naive `if is_complete` gets wrong.

    There is no un-complete endpoint, so this drives the issue service directly with
    the transitions a progress reset would produce. The false→true edge fires twice;
    UNIQUE(user_id, course_id) — not an application pre-check — is what keeps it at
    one row. A SELECT-then-INSERT guard would race here; the constraint cannot.
    """
    from app.services.certificate_service import issue_certificate_if_newly_complete

    course, _module, lessons = await _setup_course(db_session)
    user, client = await _create_entitled_user(db_session, course, lessons)
    async with client:
        pass  # the client isn't needed; the service is driven directly

    # First completion: false → true, issues.
    first = await issue_certificate_if_newly_complete(
        session=db_session, user=user, course=course,
        was_complete=False, is_complete=True,
    )
    assert first is not None

    # Progress reset: true → false. Not an issuing edge, and must not revoke either.
    none_on_reset = await issue_certificate_if_newly_complete(
        session=db_session, user=user, course=course,
        was_complete=True, is_complete=False,
    )
    assert none_on_reset is None

    # Re-completion: false → true again. Same edge, same learner, same course.
    second = await issue_certificate_if_newly_complete(
        session=db_session, user=user, course=course,
        was_complete=False, is_complete=True,
    )
    assert second is not None
    assert second.id == first.id, "Re-completion minted a second certificate."

    count = (await db_session.execute(
        select(func.count()).select_from(Certificate).where(
            Certificate.user_id == user.id, Certificate.course_id == course.id,
        )
    )).scalar_one()
    assert count == 1


async def test_pdf_render_failure_does_not_cost_the_completion(
    db_session: AsyncSession,
):
    """A failed render must never cost someone the completion they performed.

    Issue and render are deliberately separated — the row is written on the request
    path, the PDF is rendered lazily on first fetch. This drives the whole completion
    request with the renderer raising, and asserts both halves of the promise: the
    lesson completes, and the certificate row exists with no cached PDF key.
    """
    course, _module, lessons = await _setup_course(db_session)
    user, client = await _create_entitled_user(db_session, course, lessons)

    with patch(
        "app.services.certificate_pdf.render_certificate_pdf",
        side_effect=RuntimeError("storage is down"),
    ):
        async with client:
            for lesson in lessons:
                resp = await client.post(f"/lessons/{lesson.id}/complete")
                assert resp.status_code == 200, resp.text
            assert resp.json()["course_progress_percent"] == 100

    cert = (await db_session.execute(
        select(Certificate).where(
            Certificate.user_id == user.id, Certificate.course_id == course.id,
        )
    )).scalar_one_or_none()
    assert cert is not None, "The completion was recorded but no certificate was issued."
    assert cert.pdf_storage_key is None, (
        "A failed render must leave the cache key unset so the next fetch retries."
    )
