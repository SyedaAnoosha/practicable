"""Learner-facing assessment endpoints.

GET  /modules/{module_id}/assessment          — the paper, with no correct answers in it
POST /modules/{module_id}/assessment/attempts — submit, marked on the server
GET  /modules/{module_id}/assessment/attempts — this learner's own attempt history

**The security requirement this file exists to hold.** ``assessment_options.is_correct```
must never reach the client before submission — a payload that carries it turns the quiz
into a lookup table, and it is invisible in a rendered page, so nothing about the UI would
reveal the leak. Two things enforce it here:

1. ``QuestionOut``/``OptionOut`` are hand-written and carry no ``is_correct`` field at
   all, and the ORM rows are never dumped with ``from_attributes``. A field that does not
   exist on the response model cannot be leaked by an oversight in the handler.
2. ``tests/test_assessments.py`` asserts the substring ``is_correct`` does not appear
   anywhere in the raw response body, nested included, rather than checking a key on the
   top level. If someone later adds a convenience field that serialises the option rows,
   that test fails.

**Marking is server-side only.** The submission carries option ids and nothing else. The
score is computed in ``app.services.assessment_service.score_submission`` against the
live rows; the client's arithmetic — if it does any — is never consulted or trusted.

**The attempt cap is checked before the row is written**, and the count and the stored
``attempt_number`` come from the same query, so they cannot disagree about how many
attempts have been spent. Exhaustion is a 409 with code ``attempts_exhausted``; a
learner who has run out sees a specific message rather than a bare "forbidden".

Access follows the existing gate rather than adding a parallel one: an assessment belongs
to a module, and holding any lesson in that module's course means the course was bought
(see ``entitlements.py``'s ``_lessons_of_granted_courses``). Admins get the same audited
bypass every other gated read uses.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.core.entitlements import ResourceType, has_access_to_or_admin
from app.db.models import (
    Assessment,
    AssessmentAttempt,
    AssessmentOption,
    AssessmentQuestion,
    Course,
    CourseProgress,
    Lesson,
    Module,
    User,
)
from app.db.session import get_session
from app.services.assessment_service import (
    count_attempts,
    course_assessment_gate_satisfied,
    get_published_assessment_for_module,
    score_submission,
)
from app.services.certificate_service import issue_certificate_if_newly_complete

router = APIRouter()


# ── Response / request models ────────────────────────────────────────────────
# Note what is absent: no `is_correct` anywhere. See the module docstring.


class OptionOut(BaseModel):
    id: str
    label: str
    sort_order: int


class QuestionOut(BaseModel):
    id: str
    prompt: str
    sort_order: int
    question_type: str
    options: list[OptionOut]


class AssessmentOut(BaseModel):
    id: str
    module_id: str
    course_slug: str
    title: str
    description: Optional[str]
    passing_score: int
    max_attempts: int
    questions: list[QuestionOut]
    # Attempt state, so the learner's screen does not need a second round trip to know
    # whether the "Start" button should be enabled.
    attempts_used: int
    attempts_remaining: int
    passed: bool


class AnswerIn(BaseModel):
    question_id: str
    # Always a list, including for single_choice — one shape for the client to build and
    # one for the server to mark. A single_choice question submitting two options simply
    # fails to equal the one-element correct set, which is the right answer to "the
    # learner picked two things on a pick-one question".
    option_ids: list[str] = []


class AttemptSubmitIn(BaseModel):
    answers: list[AnswerIn] = []


class AttemptOut(BaseModel):
    id: str
    attempt_number: int
    score: int
    passed: bool
    submitted_at: datetime
    attempts_remaining: int


# ── Helpers ──────────────────────────────────────────────────────────────────


async def _module_or_404(session: AsyncSession, module_id: str) -> Module:
    try:
        mid = uuid.UUID(module_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Module not found")
    module = (await session.execute(
        select(Module).where(Module.id == mid)
    )).scalar_one_or_none()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    return module


async def _published_assessment_or_404(session: AsyncSession, module_id: uuid.UUID) -> Assessment:
    assessment = await get_published_assessment_for_module(session=session, module_id=module_id)
    if not assessment:
        raise HTTPException(
            status_code=404,
            detail={
                "error": {
                    "code": "no_assessment",
                    "message": "This module has no assessment.",
                }
            },
        )
    return assessment


async def _require_module_access(*, session: AsyncSession, module: Module, user: User) -> None:
    """Entitlement to the module, expressed through the existing lesson gate.

    Holding any published lesson in the module's course is exactly what owning the
    course means to that gate today.
    """
    lesson_ids = (
        (await session.execute(
            select(Lesson.id)
            .where(Lesson.module_id == module.id, Lesson.published.is_(True))
        )).scalars().all()
    )
    for lesson_id in lesson_ids:
        if await has_access_to_or_admin(
            user=user, resource_type=ResourceType.LESSON, resource_id=lesson_id, session=session
        ):
            return
    raise HTTPException(
        status_code=403,
        detail={
            "error": {
                "code": "not_entitled",
                "message": "This assessment is part of a course you don't have yet.",
            }
        },
    )


async def _load_paper(session: AsyncSession, assessment_id: uuid.UUID) -> list[QuestionOut]:
    questions = (
        (await session.execute(
            select(AssessmentQuestion)
            .where(AssessmentQuestion.assessment_id == assessment_id)
            .order_by(AssessmentQuestion.sort_order)
        )).scalars().all()
    )
    if not questions:
        return []

    options = (
        (await session.execute(
            select(AssessmentOption)
            .where(AssessmentOption.question_id.in_([q.id for q in questions]))
            .order_by(AssessmentOption.sort_order)
        )).scalars().all()
    )
    by_question: dict[uuid.UUID, list[AssessmentOption]] = {}
    for opt in options:
        by_question.setdefault(opt.question_id, []).append(opt)

    # Built field by field on purpose — `is_correct` is one attribute away on each of
    # these rows and a model dump would carry it straight into the response.
    return [
        QuestionOut(
            id=str(q.id),
            prompt=q.prompt,
            sort_order=q.sort_order,
            question_type=q.question_type.value if hasattr(q.question_type, "value") else q.question_type,
            options=[
                OptionOut(id=str(o.id), label=o.label, sort_order=o.sort_order)
                for o in by_question.get(q.id, [])
            ],
        )
        for q in questions
    ]


# ── Endpoints ────────────────────────────────────────────────────────────────


@router.get("/modules/{module_id}/assessment", response_model=AssessmentOut)
async def get_module_assessment(
    module_id: str,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """The paper, without answers. Requires the module entitlement — an assessment is
    module content like any other lesson."""
    module = await _module_or_404(session, module_id)
    assessment = await _published_assessment_or_404(session, module.id)
    await _require_module_access(session=session, module=module, user=user)

    used = await count_attempts(session=session, user_id=user.id, assessment_id=assessment.id)
    passed = (await session.execute(
        select(AssessmentAttempt.id).where(
            AssessmentAttempt.user_id == user.id,
            AssessmentAttempt.assessment_id == assessment.id,
            AssessmentAttempt.passed.is_(True),
        ).limit(1)
    )).scalar_one_or_none() is not None

    # Get course slug from module
    course = (await session.execute(
        select(Course).where(Course.id == module.course_id)
    )).scalar_one_or_none()
    course_slug = course.slug if course else ""

    return AssessmentOut(
        id=str(assessment.id),
        module_id=str(assessment.module_id),
        course_slug=course_slug,
        title=assessment.title,
        description=assessment.description,
        passing_score=assessment.passing_score,
        max_attempts=assessment.max_attempts,
        questions=await _load_paper(session, assessment.id),
        attempts_used=used,
        attempts_remaining=max(0, assessment.max_attempts - used),
        passed=passed,
    )


@router.post(
    "/modules/{module_id}/assessment/attempts",
    response_model=AttemptOut,
    status_code=status.HTTP_201_CREATED,
)
async def submit_attempt(
    module_id: str,
    payload: AttemptSubmitIn,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Mark a submission and record it. Server-side scoring; the cap is enforced before
    anything is written, so a refused submission consumes no attempt."""
    module = await _module_or_404(session, module_id)
    assessment = await _published_assessment_or_404(session, module.id)
    await _require_module_access(session=session, module=module, user=user)

    used = await count_attempts(session=session, user_id=user.id, assessment_id=assessment.id)
    if used >= assessment.max_attempts:
        # 409, not 403: the request is well-formed and the learner is entitled — the
        # resource state (attempts spent) is what refuses it. A named code so the client
        # can say "no attempts left" rather than a generic denial.
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": {
                    "code": "attempts_exhausted",
                    "message": (
                        f"You have used all {assessment.max_attempts} attempts for this assessment."
                    ),
                }
            },
        )

    # Parse client ids defensively: a malformed uuid is a bad request, not a 500.
    submitted: dict[uuid.UUID, set[uuid.UUID]] = {}
    try:
        for answer in payload.answers:
            qid = uuid.UUID(answer.question_id)
            submitted[qid] = {uuid.UUID(oid) for oid in answer.option_ids}
    except (ValueError, AttributeError, TypeError):
        raise HTTPException(
            status_code=400,
            detail={"error": {"code": "invalid_answers", "message": "Malformed answer ids."}},
        )

    score, passed = await score_submission(
        session=session, assessment=assessment, submitted=submitted
    )

    now = datetime.now(timezone.utc)
    attempt = AssessmentAttempt(
        user_id=user.id,
        assessment_id=assessment.id,
        attempt_number=used + 1,
        score=score,
        passed=passed,
        submitted_at=now,
        # A record of what was sent, kept so a score stays explainable after the question
        # set is edited. Never re-read as an input to marking.
        answers=[
            {"question_id": str(qid), "option_ids": sorted(str(o) for o in oids)}
            for qid, oids in submitted.items()
        ],
    )
    session.add(attempt)
    await session.flush()

    # `get_session` never commits — without this the attempt is discarded at the end of
    # the request and the learner's cap silently never advances. See
    # admin/promotions.py's create_promotion for the full note.
    await session.commit()
    await session.refresh(attempt)

    # The other half of the certificate gate. `lessons.py` issues when the last lesson is
    # completed AND the assessment is already passed; this issues when the assessment is
    # passed AND the lessons are already complete. Without this branch a learner who
    # finished every lesson before sitting the quiz would never receive a certificate at
    # all: the false→true completion edge that path watches for has already been spent.
    #
    # `issue_certificate_if_newly_complete` is idempotent by UNIQUE(user_id, course_id),
    # so the two paths racing or both firing produces one row, not two.
    if passed:
        # Get the course from the module
        course = (await session.execute(
            select(Course).where(Course.id == module.course_id)
        )).scalar_one_or_none()
        if course:
            course_progress = (await session.execute(
                select(CourseProgress).where(
                    CourseProgress.user_id == user.id,
                    CourseProgress.course_id == course.id,
                )
            )).scalar_one_or_none()
            # Passing *this* module's quiz is not enough: since migration 038 a course
            # can have a published assessment on every module, and the certificate gate
            # in lessons.py requires all of them. Re-checking the whole course gate here
            # keeps the two issue paths agreeing — otherwise this path would mint a
            # certificate on the first module passed while lessons.py, asked the same
            # question, would still say no.
            gate_ok = await course_assessment_gate_satisfied(
                session=session, user_id=user.id, course_id=course.id
            )
            if course_progress is not None and course_progress.completed and gate_ok:
                await issue_certificate_if_newly_complete(
                    session=session, user=user, course=course,
                    was_complete=False, is_complete=True,
                )
                await session.commit()

    return AttemptOut(
        id=str(attempt.id),
        attempt_number=attempt.attempt_number,
        score=attempt.score,
        passed=attempt.passed,
        submitted_at=attempt.submitted_at,
        attempts_remaining=max(0, assessment.max_attempts - attempt.attempt_number),
    )


@router.get("/modules/{module_id}/assessment/attempts", response_model=list[AttemptOut])
async def list_my_attempts(
    module_id: str,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """This learner's own attempts, newest first. Scoped to `user.id` in the query
    itself — there is no path here that reads another learner's attempts."""
    module = await _module_or_404(session, module_id)
    assessment = await _published_assessment_or_404(session, module.id)
    await _require_module_access(session=session, module=module, user=user)

    attempts = (
        (await session.execute(
            select(AssessmentAttempt)
            .where(
                AssessmentAttempt.user_id == user.id,
                AssessmentAttempt.assessment_id == assessment.id,
            )
            .order_by(AssessmentAttempt.attempt_number.desc())
        )).scalars().all()
    )
    total = len(attempts)
    return [
        AttemptOut(
            id=str(a.id),
            attempt_number=a.attempt_number,
            score=a.score,
            passed=a.passed,
            submitted_at=a.submitted_at,
            attempts_remaining=max(0, assessment.max_attempts - total),
        )
        for a in attempts
    ]
