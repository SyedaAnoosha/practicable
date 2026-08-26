"""Tests for scored module assessments.

Four things are worth proving here, and they are the four this file covers:

1. **Scoring is correct**, including the multi-choice rule that a partial or excess
   selection is simply wrong. The "select every option" case is tested explicitly
   because that is the exact shape a partial-credit implementation gets wrong, and
   getting it wrong makes the quiz useless as a gate rather than merely inaccurate.

2. **The attempt cap holds**, and a refused submission consumes nothing — the cap is
   checked before the row is written, so a learner cannot be charged an attempt by a
   request that was rejected.

3. **Correct answers never leak.** Asserted against the raw response *text*, not a
   top-level key, so a nested option object that starts carrying `is_correct` fails the
   test. This is the requirement with no visible symptom: a leaked answer key renders
   identically to a correct payload.

4. **Certificate gating cuts both ways.** With no assessment the original
   "100% lessons = certificate" behaviour is unchanged; with a published one the
   certificate waits for a passing attempt — and arrives whether the quiz is passed
   before or after the last lesson, since only one of those two orderings hits the
   lesson-completion edge.
"""
from __future__ import annotations

import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    Assessment,
    AssessmentAttempt,
    AssessmentOption,
    AssessmentQuestion,
    AssessmentQuestionType,
    Author,
    Certificate,
    Course,
    Entitlement,
    GrantedVia,
    Lesson,
    Module,
    Product,
    ProductContent,
    Role,
    Section,
    User,
)
from tests.conftest import make_fake_token

pytestmark = pytest.mark.asyncio


# ── Fixtures / helpers ───────────────────────────────────────────────────────


async def _setup_course(db_session: AsyncSession, *, n_lessons: int = 2):
    section = Section(name="Assess Section", slug=f"a-section-{uuid.uuid4().hex[:8]}")
    author = Author(name="Assess Author", slug=f"a-author-{uuid.uuid4().hex[:8]}")
    db_session.add_all([section, author])
    await db_session.flush()

    course = Course(
        slug=f"assess-course-{uuid.uuid4().hex[:8]}",
        title="Assessment Test Course",
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
    for i in range(n_lessons):
        lesson = Lesson(
            slug=f"assess-lesson-{i}-{uuid.uuid4().hex[:8]}",
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


async def _entitled_learner(db_session: AsyncSession, lessons: list[Lesson]):
    user = User(
        id=uuid.uuid4(),
        email=f"assess-user-{uuid.uuid4().hex[:8]}@example.test",
        role=Role.MEMBER,
        name="Assess Learner",
    )
    db_session.add(user)
    await db_session.flush()

    product = Product(
        slug=f"assess-product-{uuid.uuid4().hex[:8]}",
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
    db_session.add(Entitlement(user_id=user.id, product_id=product.id, granted_via=GrantedVia.MANUAL))
    await db_session.flush()

    from main import app as _app
    client = AsyncClient(
        transport=ASGITransport(app=_app),
        base_url="http://testserver",
        headers={"Authorization": f"Bearer {make_fake_token(user.id, user.email, user.name)}"},
    )
    return user, client


async def _build_assessment(
    db_session: AsyncSession,
    module: Module,
    *,
    passing_score: int = 50,
    max_attempts: int = 3,
    published: bool = True,
):
    """Two questions: one single-choice (1 correct of 3), one multi-choice (2 correct of 4).

    Two questions and a 50% pass mark make every interesting score reachable and
    distinguishable: 0, 50, 100 — so a test asserting "one right out of two" cannot pass
    by coincidence against a rounding bug.
    """
    assessment = Assessment(
        module_id=module.id,
        title="Final Assessment",
        description="Answer honestly.",
        passing_score=passing_score,
        max_attempts=max_attempts,
        published=published,
    )
    db_session.add(assessment)
    await db_session.flush()

    q1 = AssessmentQuestion(
        assessment_id=assessment.id, prompt="Pick the one right answer.",
        sort_order=0, question_type=AssessmentQuestionType.SINGLE_CHOICE,
    )
    q2 = AssessmentQuestion(
        assessment_id=assessment.id, prompt="Pick both right answers.",
        sort_order=1, question_type=AssessmentQuestionType.MULTI_CHOICE,
    )
    db_session.add_all([q1, q2])
    await db_session.flush()

    q1_opts = [
        AssessmentOption(question_id=q1.id, label="right", is_correct=True, sort_order=0),
        AssessmentOption(question_id=q1.id, label="wrong a", is_correct=False, sort_order=1),
        AssessmentOption(question_id=q1.id, label="wrong b", is_correct=False, sort_order=2),
    ]
    q2_opts = [
        AssessmentOption(question_id=q2.id, label="right 1", is_correct=True, sort_order=0),
        AssessmentOption(question_id=q2.id, label="right 2", is_correct=True, sort_order=1),
        AssessmentOption(question_id=q2.id, label="wrong 1", is_correct=False, sort_order=2),
        AssessmentOption(question_id=q2.id, label="wrong 2", is_correct=False, sort_order=3),
    ]
    db_session.add_all(q1_opts + q2_opts)
    await db_session.flush()

    return assessment, (q1, q1_opts), (q2, q2_opts)


def _answer(q, opts):
    return {"question_id": str(q.id), "option_ids": [str(o.id) for o in opts]}


# ── Scoring ──────────────────────────────────────────────────────────────────


async def test_all_correct_scores_100_and_passes(db_session: AsyncSession):
    course, module, lessons = await _setup_course(db_session)
    user, client = await _entitled_learner(db_session, lessons)
    _a, (q1, q1_opts), (q2, q2_opts) = await _build_assessment(db_session, module)

    async with client:
        resp = await client.post(
            f"/modules/{module.id}/assessment/attempts",
            json={"answers": [
                _answer(q1, [q1_opts[0]]),
                _answer(q2, [q2_opts[0], q2_opts[1]]),
            ]},
        )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["score"] == 100
    assert body["passed"] is True
    assert body["attempt_number"] == 1
    assert body["attempts_remaining"] == 2


async def test_half_correct_scores_50(db_session: AsyncSession):
    """One of two questions right. With passing_score=50 this passes; the point of the
    test is the arithmetic, which a per-option scorer would report as 3/7 rather than
    1/2."""
    course, module, lessons = await _setup_course(db_session)
    user, client = await _entitled_learner(db_session, lessons)
    _a, (q1, q1_opts), (q2, q2_opts) = await _build_assessment(db_session, module)

    async with client:
        resp = await client.post(
            f"/modules/{module.id}/assessment/attempts",
            json={"answers": [
                _answer(q1, [q1_opts[0]]),            # right
                _answer(q2, [q2_opts[0], q2_opts[2]]),  # one right, one wrong
            ]},
        )
    assert resp.status_code == 201, resp.text
    assert resp.json()["score"] == 50


async def test_multi_choice_partial_selection_is_wrong(db_session: AsyncSession):
    """A subset of the correct options earns nothing. No partial credit."""
    course, module, lessons = await _setup_course(db_session)
    user, client = await _entitled_learner(db_session, lessons)
    _a, (q1, q1_opts), (q2, q2_opts) = await _build_assessment(db_session, module)

    async with client:
        resp = await client.post(
            f"/modules/{module.id}/assessment/attempts",
            json={"answers": [
                _answer(q1, [q1_opts[1]]),   # wrong
                _answer(q2, [q2_opts[0]]),   # only one of the two correct options
            ]},
        )
    assert resp.status_code == 201, resp.text
    assert resp.json()["score"] == 0


async def test_selecting_every_option_does_not_pass(db_session: AsyncSession):
    """The exploit a partial-credit scorer hands out for free.

    Selecting all four options on the multi-choice question includes both correct ones.
    Any scheme that credits "correct options selected" without penalising the wrong ones
    marks this full marks, and the quiz stops being a gate at all.
    """
    course, module, lessons = await _setup_course(db_session)
    user, client = await _entitled_learner(db_session, lessons)
    _a, (q1, q1_opts), (q2, q2_opts) = await _build_assessment(db_session, module)

    async with client:
        resp = await client.post(
            f"/modules/{module.id}/assessment/attempts",
            json={"answers": [
                _answer(q1, q1_opts),   # all three
                _answer(q2, q2_opts),   # all four
            ]},
        )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["score"] == 0, "Selecting every option scored above zero — partial credit leaked in."
    assert body["passed"] is False


async def test_answers_for_the_wrong_question_are_discarded(db_session: AsyncSession):
    """An option id belonging to another question cannot be smuggled into this one's
    answer set. Submitting q2's correct options under q1 marks q1 wrong, not right."""
    course, module, lessons = await _setup_course(db_session)
    user, client = await _entitled_learner(db_session, lessons)
    _a, (q1, _q1_opts), (q2, q2_opts) = await _build_assessment(db_session, module)

    async with client:
        resp = await client.post(
            f"/modules/{module.id}/assessment/attempts",
            json={"answers": [
                _answer(q1, [q2_opts[0], q2_opts[1]]),   # q2's answers, under q1
                _answer(q2, [q2_opts[0], q2_opts[1]]),   # right
            ]},
        )
    assert resp.status_code == 201, resp.text
    assert resp.json()["score"] == 50


async def test_score_is_compared_against_the_configured_passing_score(db_session: AsyncSession):
    """50% against a pass mark of 80 fails; the mark is not hardcoded."""
    course, module, lessons = await _setup_course(db_session)
    user, client = await _entitled_learner(db_session, lessons)
    _a, (q1, q1_opts), (q2, q2_opts) = await _build_assessment(
        db_session, module, passing_score=80,
    )

    async with client:
        resp = await client.post(
            f"/modules/{module.id}/assessment/attempts",
            json={"answers": [_answer(q1, [q1_opts[0]]), _answer(q2, [q2_opts[2]])]},
        )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["score"] == 50
    assert body["passed"] is False


# ── Attempt limit ────────────────────────────────────────────────────────────


async def test_attempt_limit_is_enforced(db_session: AsyncSession):
    """The cap refuses the (max+1)th submission with a named error code."""
    course, module, lessons = await _setup_course(db_session)
    user, client = await _entitled_learner(db_session, lessons)
    assessment, (q1, q1_opts), (q2, q2_opts) = await _build_assessment(
        db_session, module, max_attempts=2, passing_score=100,
    )

    failing = {"answers": [_answer(q1, [q1_opts[1]]), _answer(q2, [q2_opts[2]])]}

    async with client:
        first = await client.post(f"/modules/{module.id}/assessment/attempts", json=failing)
        assert first.status_code == 201, first.text
        assert first.json()["attempts_remaining"] == 1

        second = await client.post(f"/modules/{module.id}/assessment/attempts", json=failing)
        assert second.status_code == 201, second.text
        assert second.json()["attempts_remaining"] == 0

        third = await client.post(f"/modules/{module.id}/assessment/attempts", json=failing)

    assert third.status_code == 409, third.text
    assert third.json()["detail"]["error"]["code"] == "attempts_exhausted"

    # And the refused request wrote nothing — a rejected submission must not cost an
    # attempt, or the cap silently becomes max_attempts - (number of refusals).
    rows = (await db_session.execute(
        select(AssessmentAttempt).where(
            AssessmentAttempt.user_id == user.id,
            AssessmentAttempt.assessment_id == assessment.id,
        )
    )).scalars().all()
    assert len(rows) == 2
    assert sorted(r.attempt_number for r in rows) == [1, 2]


async def test_attempts_remaining_counts_down_in_the_get_payload(db_session: AsyncSession):
    course, module, lessons = await _setup_course(db_session)
    user, client = await _entitled_learner(db_session, lessons)
    _a, (q1, q1_opts), (q2, q2_opts) = await _build_assessment(
        db_session, module, max_attempts=3, passing_score=100,
    )

    async with client:
        before = await client.get(f"/modules/{module.id}/assessment")
        assert before.status_code == 200, before.text
        assert before.json()["attempts_remaining"] == 3
        assert before.json()["passed"] is False

        await client.post(
            f"/modules/{module.id}/assessment/attempts",
            json={"answers": [_answer(q1, [q1_opts[0]]), _answer(q2, [q2_opts[0], q2_opts[1]])]},
        )

        after = await client.get(f"/modules/{module.id}/assessment")

    assert after.json()["attempts_used"] == 1
    assert after.json()["attempts_remaining"] == 2
    assert after.json()["passed"] is True


async def test_my_attempts_lists_only_my_own(db_session: AsyncSession):
    course, module, lessons = await _setup_course(db_session)
    user_a, client_a = await _entitled_learner(db_session, lessons)
    user_b, client_b = await _entitled_learner(db_session, lessons)
    _a, (q1, q1_opts), (q2, q2_opts) = await _build_assessment(db_session, module)

    correct = {"answers": [_answer(q1, [q1_opts[0]]), _answer(q2, [q2_opts[0], q2_opts[1]])]}

    async with client_a:
        await client_a.post(f"/modules/{module.id}/assessment/attempts", json=correct)
        await client_a.post(f"/modules/{module.id}/assessment/attempts", json=correct)
        mine = await client_a.get(f"/modules/{module.id}/assessment/attempts")

    async with client_b:
        theirs = await client_b.get(f"/modules/{module.id}/assessment/attempts")

    assert mine.status_code == 200, mine.text
    assert len(mine.json()) == 2
    assert [a["attempt_number"] for a in mine.json()] == [2, 1]  # newest first
    assert theirs.json() == []


# ── The answer key never leaves the server ───────────────────────────────────


async def test_correct_answers_are_never_in_the_get_payload(db_session: AsyncSession):
    """Asserted on the raw body, not on a parsed key.

    A leaked answer key has no visible symptom — the page renders identically — so the
    check has to be blunt: the string must not appear anywhere in the response, at any
    nesting depth. A future convenience field that dumps the option rows fails here.
    """
    course, module, lessons = await _setup_course(db_session)
    user, client = await _entitled_learner(db_session, lessons)
    _a, (q1, q1_opts), (q2, q2_opts) = await _build_assessment(db_session, module)

    async with client:
        resp = await client.get(f"/modules/{module.id}/assessment")

    assert resp.status_code == 200, resp.text
    assert "is_correct" not in resp.text, "The answer key leaked into the learner payload."
    assert "correct" not in resp.text.replace("is_correct", ""), (
        "Something correctness-shaped is in the payload; check what was added."
    )

    body = resp.json()
    assert len(body["questions"]) == 2
    for question in body["questions"]:
        assert question["options"], "Options must still be present — only their answers are hidden."
        for option in question["options"]:
            assert set(option.keys()) == {"id", "label", "sort_order"}


async def test_correct_answers_are_not_in_the_attempt_response(db_session: AsyncSession):
    """The submit response reports the score, not the marking scheme. Returning the key
    after one attempt would hand it over with attempts still remaining."""
    course, module, lessons = await _setup_course(db_session)
    user, client = await _entitled_learner(db_session, lessons)
    _a, (q1, q1_opts), (q2, q2_opts) = await _build_assessment(db_session, module)

    async with client:
        resp = await client.post(
            f"/modules/{module.id}/assessment/attempts",
            json={"answers": [_answer(q1, [q1_opts[1]]), _answer(q2, [q2_opts[2]])]},
        )
        attempts = await client.get(f"/modules/{module.id}/assessment/attempts")

    assert "is_correct" not in resp.text
    assert "is_correct" not in attempts.text


async def test_unpublished_assessment_is_invisible_to_learners(db_session: AsyncSession):
    course, module, lessons = await _setup_course(db_session)
    user, client = await _entitled_learner(db_session, lessons)
    await _build_assessment(db_session, module, published=False)

    async with client:
        resp = await client.get(f"/modules/{module.id}/assessment")
        submit = await client.post(f"/modules/{module.id}/assessment/attempts", json={"answers": []})

    assert resp.status_code == 404
    assert resp.json()["detail"]["error"]["code"] == "no_assessment"
    assert submit.status_code == 404


async def test_unentitled_learner_cannot_read_the_assessment(db_session: AsyncSession, member_client):
    """A signed-in member with no entitlement gets 403, not the paper."""
    course, module, lessons = await _setup_course(db_session)
    await _build_assessment(db_session, module)

    resp = await member_client.get(f"/modules/{module.id}/assessment")
    assert resp.status_code == 403
    assert resp.json()["detail"]["error"]["code"] == "not_entitled"


async def test_anonymous_visitor_cannot_read_the_assessment(db_session: AsyncSession, anon_client):
    course, module, lessons = await _setup_course(db_session)
    await _build_assessment(db_session, module)

    resp = await anon_client.get(f"/modules/{module.id}/assessment")
    assert resp.status_code == 401


# ── Certificate gating ───────────────────────────────────────────────────────


async def test_no_assessment_means_certificate_on_lesson_completion(db_session: AsyncSession):
    """The pre-existing behaviour, unchanged. This is the regression guard for every
    course in the catalogue that has no quiz."""
    course, module, lessons = await _setup_course(db_session)
    user, client = await _entitled_learner(db_session, lessons)

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
    assert cert is not None, "A course with no assessment must still certify on 100% lessons."


async def test_published_assessment_withholds_certificate_until_passed(db_session: AsyncSession):
    """100% lessons is no longer enough on a course with a published assessment."""
    course, module, lessons = await _setup_course(db_session)
    user, client = await _entitled_learner(db_session, lessons)
    _a, (q1, q1_opts), (q2, q2_opts) = await _build_assessment(
        db_session, module, passing_score=100,
    )

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
        assert cert is None, "The certificate was issued without a passing attempt."

        # A failing attempt still does not unlock it.
        await client.post(
            f"/modules/{module.id}/assessment/attempts",
            json={"answers": [_answer(q1, [q1_opts[1]]), _answer(q2, [q2_opts[2]])]},
        )
        cert = (await db_session.execute(
            select(Certificate).where(
                Certificate.user_id == user.id, Certificate.course_id == course.id,
            )
        )).scalar_one_or_none()
        assert cert is None, "A failing attempt issued a certificate."

        # Passing does.
        passing = await client.post(
            f"/modules/{module.id}/assessment/attempts",
            json={"answers": [_answer(q1, [q1_opts[0]]), _answer(q2, [q2_opts[0], q2_opts[1]])]},
        )
        assert passing.status_code == 201, passing.text
        assert passing.json()["passed"] is True

    cert = (await db_session.execute(
        select(Certificate).where(
            Certificate.user_id == user.id, Certificate.course_id == course.id,
        )
    )).scalar_one_or_none()
    assert cert is not None, (
        "Passing the assessment after finishing the lessons never issued the certificate. "
        "The lesson-completion edge was already spent, so the submit path has to issue."
    )


async def test_passing_before_finishing_lessons_certifies_on_the_last_lesson(
    db_session: AsyncSession,
):
    """The other ordering. Here the completion edge IS available, so lessons.py issues."""
    course, module, lessons = await _setup_course(db_session)
    user, client = await _entitled_learner(db_session, lessons)
    _a, (q1, q1_opts), (q2, q2_opts) = await _build_assessment(
        db_session, module, passing_score=100,
    )

    async with client:
        passing = await client.post(
            f"/modules/{module.id}/assessment/attempts",
            json={"answers": [_answer(q1, [q1_opts[0]]), _answer(q2, [q2_opts[0], q2_opts[1]])]},
        )
        assert passing.json()["passed"] is True

        # No certificate yet — the lessons are not done.
        cert = (await db_session.execute(
            select(Certificate).where(Certificate.user_id == user.id, Certificate.course_id == course.id)
        )).scalar_one_or_none()
        assert cert is None

        for lesson in lessons:
            resp = await client.post(f"/lessons/{lesson.id}/complete")
            assert resp.status_code == 200, resp.text

    cert = (await db_session.execute(
        select(Certificate).where(Certificate.user_id == user.id, Certificate.course_id == course.id)
    )).scalar_one_or_none()
    assert cert is not None


async def test_unpublished_assessment_does_not_gate_certificates(db_session: AsyncSession):
    """A draft quiz on a live course must not quietly withhold certificates from people
    who finish the lessons while it is being written."""
    course, module, lessons = await _setup_course(db_session)
    user, client = await _entitled_learner(db_session, lessons)
    await _build_assessment(db_session, module, published=False, passing_score=100)

    async with client:
        for lesson in lessons:
            resp = await client.post(f"/lessons/{lesson.id}/complete")
            assert resp.status_code == 200, resp.text

    cert = (await db_session.execute(
        select(Certificate).where(Certificate.user_id == user.id, Certificate.course_id == course.id)
    )).scalar_one_or_none()
    assert cert is not None


async def test_passing_twice_does_not_mint_a_second_certificate(db_session: AsyncSession):
    course, module, lessons = await _setup_course(db_session)
    user, client = await _entitled_learner(db_session, lessons)
    _a, (q1, q1_opts), (q2, q2_opts) = await _build_assessment(
        db_session, module, passing_score=100, max_attempts=5,
    )
    correct = {"answers": [_answer(q1, [q1_opts[0]]), _answer(q2, [q2_opts[0], q2_opts[1]])]}

    async with client:
        for lesson in lessons:
            await client.post(f"/lessons/{lesson.id}/complete")
        await client.post(f"/modules/{module.id}/assessment/attempts", json=correct)
        await client.post(f"/modules/{module.id}/assessment/attempts", json=correct)

    certs = (await db_session.execute(
        select(Certificate).where(Certificate.user_id == user.id, Certificate.course_id == course.id)
    )).scalars().all()
    assert len(certs) == 1


# ── Admin surface ────────────────────────────────────────────────────────────


async def test_admin_can_author_and_publish_an_assessment(
    db_session: AsyncSession, admin_client, asserts_commit,
):
    """The authoring path end to end, and the commit guard on the create."""
    course, module, _lessons = await _setup_course(db_session)

    with asserts_commit():
        created = await admin_client.post(
            "/admin/assessments",
            json={"module_id": str(module.id), "title": "Final", "passing_score": 60, "max_attempts": 2},
        )
    assert created.status_code == 201, created.text
    assessment_id = created.json()["id"]
    assert created.json()["published"] is False

    # A second assessment for the same module is refused.
    duplicate = await admin_client.post(
        "/admin/assessments", json={"module_id": str(module.id), "title": "Another"},
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["detail"]["error"]["code"] == "assessment_exists"

    # An empty paper cannot be published.
    empty_publish = await admin_client.post(
        f"/admin/assessments/{assessment_id}/publish", json={"published": True},
    )
    assert empty_publish.status_code == 422
    assert empty_publish.json()["detail"]["error"]["code"] == "assessment_empty"

    with asserts_commit():
        q_resp = await admin_client.post(
            f"/admin/assessments/{assessment_id}/questions",
            json={"prompt": "Which one?", "sort_order": 0, "question_type": "single_choice"},
        )
    assert q_resp.status_code == 201, q_resp.text
    question_id = q_resp.json()["questions"][0]["id"]

    # A question with no correct option cannot be published either.
    await admin_client.post(
        f"/admin/assessment-questions/{question_id}/options",
        json={"label": "nope", "is_correct": False, "sort_order": 1},
    )
    unanswerable = await admin_client.post(
        f"/admin/assessments/{assessment_id}/publish", json={"published": True},
    )
    assert unanswerable.status_code == 422
    assert unanswerable.json()["detail"]["error"]["code"] == "question_without_correct_option"

    with asserts_commit():
        opt_resp = await admin_client.post(
            f"/admin/assessment-questions/{question_id}/options",
            json={"label": "yes", "is_correct": True, "sort_order": 0},
        )
    assert opt_resp.status_code == 201, opt_resp.text

    with asserts_commit():
        published = await admin_client.post(
            f"/admin/assessments/{assessment_id}/publish", json={"published": True},
        )
    assert published.status_code == 200, published.text
    assert published.json()["published"] is True

    # Update metadata.
    with asserts_commit():
        updated = await admin_client.patch(
            f"/admin/assessments/{assessment_id}", json={"passing_score": 75},
        )
    assert updated.json()["passing_score"] == 75

    # And an audit row exists for the publish.
    from app.db.models import AuditLog
    actions = (await db_session.execute(
        select(AuditLog.action).where(AuditLog.target_id == uuid.UUID(assessment_id))
    )).scalars().all()
    assert "create_assessment" in actions
    assert "publish_assessment" in actions
    assert "update_assessment" in actions


async def test_admin_can_delete_questions_and_options(db_session: AsyncSession, admin_client):
    course, module, _lessons = await _setup_course(db_session)
    _a, (q1, q1_opts), (q2, _q2_opts) = await _build_assessment(db_session, module)

    del_opt = await admin_client.delete(f"/admin/assessment-options/{q1_opts[1].id}")
    assert del_opt.status_code == 200, del_opt.text
    q1_out = next(q for q in del_opt.json()["questions"] if q["id"] == str(q1.id))
    assert len(q1_out["options"]) == 2

    del_q = await admin_client.delete(f"/admin/assessment-questions/{q1.id}")
    assert del_q.status_code == 200, del_q.text
    assert [q["id"] for q in del_q.json()["questions"]] == [str(q2.id)]


async def test_non_admin_cannot_reach_the_admin_assessment_routes(
    db_session: AsyncSession, member_client,
):
    course, module, _lessons = await _setup_course(db_session)
    resp = await member_client.post(
        "/admin/assessments", json={"module_id": str(module.id), "title": "Sneaky"},
    )
    assert resp.status_code in (401, 403)
