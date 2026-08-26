"""Assessment marking and the certificate gate.

Two things live here rather than in an endpoint, because two callers need each of them
and they must not be able to disagree:

``score_submission``   the only place a submission is marked. The submit endpoint calls
                       it; nothing else marks. Correctness is decided from the live
                       option rows, never from the client's payload — a client that sends
                       ``is_correct: true`` alongside its choices is sending noise.

``has_passing_attempt``/``module_assessment_gate_satisfied``/``course_assessment_gate_satisfied``
                       the certificate gate. ``lessons.py`` calls the gate before issuing;
                       the "my attempts" endpoint reports the same passing state, so the
                       learner's screen and the gate cannot say different things about
                       whether the quiz is done.

**The gate's default is the pre-existing behaviour.** A course whose modules have no
published assessments is not gated at all — 100% lesson completion still issues the
certificate exactly as it did before. Only a *published* assessment on a module adds the
requirement. This is what keeps every existing certificate test true, and it is the
correct product behaviour besides: a half-written draft quiz on a live module must not
quietly withhold certificates from people who finished the lessons.

With per-module assessments, the certificate gate checks ALL modules: every module that
has a published assessment must have a passing attempt before the certificate is issued.
"""
from __future__ import annotations

import uuid
from typing import Iterable, Mapping

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    Assessment,
    AssessmentAttempt,
    AssessmentOption,
    AssessmentQuestion,
    Module,
)


def _mark(
    *,
    questions: Iterable[AssessmentQuestion],
    correct_by_question: Mapping[uuid.UUID, set[uuid.UUID]],
    submitted_by_question: Mapping[uuid.UUID, set[uuid.UUID]],
) -> int:
    """Percent correct, all-or-nothing per question.

    A question is correct only when the submitted option set *equals* the correct set.
    No partial credit: a subset is wrong, and so is a superset. Otherwise "select every
    option" scores well on multi-choice questions and ``passing_score`` stops meaning one
    thing across a paper.

    A question with no correct option defined is unanswerable and would make a 100% score
    impossible, so it is treated as correct when nothing was submitted for it — but that
    is a content bug the admin publish path should catch, not a scoring feature.

    Returns 0 for an empty paper rather than dividing by zero.
    """
    questions = list(questions)
    if not questions:
        return 0

    correct_count = 0
    for q in questions:
        expected = correct_by_question.get(q.id, set())
        given = submitted_by_question.get(q.id, set())
        if given == expected:
            correct_count += 1

    return round(100 * correct_count / len(questions))


async def score_submission(
    *,
    session: AsyncSession,
    assessment: Assessment,
    submitted: Mapping[uuid.UUID, set[uuid.UUID]],
) -> tuple[int, bool]:
    """Mark one submission against the live question/option rows. Returns (score, passed).

    ``submitted`` maps question_id → the option ids the learner selected. Option ids that
    do not belong to the question they were submitted under are dropped before marking,
    so a client cannot smuggle another question's correct option into this one's answer
    set. Questions the learner skipped are simply absent from the mapping and mark as
    wrong, which is the same outcome as submitting an empty set.
    """
    questions = (
        (await session.execute(
            select(AssessmentQuestion)
            .where(AssessmentQuestion.assessment_id == assessment.id)
            .order_by(AssessmentQuestion.sort_order)
        )).scalars().all()
    )
    if not questions:
        return 0, False

    question_ids = [q.id for q in questions]
    options = (
        (await session.execute(
            select(AssessmentOption).where(AssessmentOption.question_id.in_(question_ids))
        )).scalars().all()
    )

    correct_by_question: dict[uuid.UUID, set[uuid.UUID]] = {q.id: set() for q in questions}
    valid_by_question: dict[uuid.UUID, set[uuid.UUID]] = {q.id: set() for q in questions}
    for opt in options:
        valid_by_question.setdefault(opt.question_id, set()).add(opt.id)
        if opt.is_correct:
            correct_by_question.setdefault(opt.question_id, set()).add(opt.id)

    # Confine every answer to its own question's options.
    cleaned = {
        qid: (submitted.get(qid, set()) & valid_by_question.get(qid, set()))
        for qid in question_ids
    }

    score = _mark(
        questions=questions,
        correct_by_question=correct_by_question,
        submitted_by_question=cleaned,
    )
    return score, score >= assessment.passing_score


async def get_published_assessment_for_module(
    *, session: AsyncSession, module_id: uuid.UUID
) -> Assessment | None:
    """The one published assessment for a module, or None. UNIQUE(module_id) means this
    can never be ambiguous about which assessment gates the module."""
    return (await session.execute(
        select(Assessment).where(
            Assessment.module_id == module_id,
            Assessment.published.is_(True),
        )
    )).scalar_one_or_none()


async def get_all_published_assessments_for_course(
    *, session: AsyncSession, course_id: uuid.UUID
) -> list[Assessment]:
    """Every published assessment for a course (via its modules). Returns a list so the
    gate can check that ALL module assessments are passed."""
    return list(
        (await session.execute(
            select(Assessment)
            .join(Module, Module.id == Assessment.module_id)
            .where(
                Module.course_id == course_id,
                Assessment.published.is_(True),
            )
        )).scalars().all()
    )


async def has_passing_attempt(
    *, session: AsyncSession, user_id: uuid.UUID, assessment_id: uuid.UUID
) -> bool:
    attempt = (await session.execute(
        select(AssessmentAttempt.id).where(
            AssessmentAttempt.user_id == user_id,
            AssessmentAttempt.assessment_id == assessment_id,
            AssessmentAttempt.passed.is_(True),
        ).limit(1)
    )).scalar_one_or_none()
    return attempt is not None


async def module_assessment_gate_satisfied(
    *, session: AsyncSession, user_id: uuid.UUID, module_id: uuid.UUID
) -> bool:
    """True when nothing blocks a certificate on the assessment side for a single module.

    No assessment, or an unpublished one → True, preserving the original
    "100% lessons = certificate" rule untouched. A published assessment → True only with
    at least one passing attempt.
    """
    assessment = await get_published_assessment_for_module(session=session, module_id=module_id)
    if assessment is None:
        return True
    return await has_passing_attempt(
        session=session, user_id=user_id, assessment_id=assessment.id
    )


async def course_assessment_gate_satisfied(
    *, session: AsyncSession, user_id: uuid.UUID, course_id: uuid.UUID
) -> bool:
    """True when ALL published module assessments for this course have been passed.

    No published assessments on any module → True (original behaviour).
    Any published assessment without a passing attempt → False.
    """
    assessments = await get_all_published_assessments_for_course(
        session=session, course_id=course_id
    )
    if not assessments:
        return True

    for assessment in assessments:
        if not await has_passing_attempt(
            session=session, user_id=user_id, assessment_id=assessment.id
        ):
            return False
    return True


async def count_attempts(
    *, session: AsyncSession, user_id: uuid.UUID, assessment_id: uuid.UUID
) -> int:
    return (await session.execute(
        select(func.count()).select_from(AssessmentAttempt).where(
            AssessmentAttempt.user_id == user_id,
            AssessmentAttempt.assessment_id == assessment_id,
        )
    )).scalar_one()
