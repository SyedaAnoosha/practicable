"""Admin CRUD for module assessments — the quiz, its questions, its options, and publish.

One assessment per module (UNIQUE(module_id)), so create is idempotent-ish by design: a
second create for the same module is refused with a 409 naming the existing one rather
than silently producing a second paper the certificate gate would have to choose between.

Every mutation writes an `audit_log` row and commits explicitly. `get_session` does not
commit and `record_audit` deliberately does not either — see admin/promotions.py's
`create_promotion` for the full note on why an omitted commit is invisible to this test
suite but loses the write in production.

**Publishing is the switch that starts gating certificates** for the module (see
`app/services/assessment_service.py`). It is therefore its own endpoint rather than a
field on the update payload: turning it on is a decision with a consequence for every
learner who has already finished the lessons, and it should not be reachable by a PATCH
that meant to fix a typo in the title. The publish handler refuses a paper that cannot be
passed — no questions, or a question with no correct option — because publishing that is
indistinguishable from withdrawing certificates from the course.
"""
from __future__ import annotations

import uuid
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_admin
from app.db.models import (
    Assessment,
    AssessmentAttempt,
    AssessmentOption,
    AssessmentQuestion,
    AssessmentQuestionType,
    Course,
    Module,
    User,
)
from app.db.session import get_session
from app.services.audit_service import record_audit

router = APIRouter()


# ── Request / response models ────────────────────────────────────────────────


class OptionOut(BaseModel):
    id: str
    label: str
    # Admins DO see this — they are the ones authoring it. The learner-facing
    # serialiser in content/assessments.py has no such field at all.
    is_correct: bool
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
    course_id: Optional[str] = None
    # `[ADDED 2026-08-25, owner direction]` "show which assessment belongs to which
    # course and module." The ids were already resolved here and then thrown away, so
    # the admin list could only print the literal words "Module assessment" against
    # every row — with several courses each having a "Final Assessment", nothing on the
    # page said which was which. The titles cost no extra query: the module lookup that
    # produces `course_id` already loads both rows.
    module_title: Optional[str] = None
    course_title: Optional[str] = None
    title: str
    description: Optional[str]
    passing_score: int
    max_attempts: int
    published: bool
    questions: list[QuestionOut]
    attempt_count: int


class AssessmentCreateIn(BaseModel):
    module_id: str
    title: str = Field(min_length=1, max_length=500)
    description: Optional[str] = None
    passing_score: int = Field(default=70, ge=0, le=100)
    max_attempts: int = Field(default=3, gt=0)


class AssessmentUpdateIn(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=500)
    description: Optional[str] = None
    passing_score: Optional[int] = Field(default=None, ge=0, le=100)
    max_attempts: Optional[int] = Field(default=None, gt=0)


class QuestionCreateIn(BaseModel):
    prompt: str = Field(min_length=1)
    sort_order: int = 0
    question_type: Literal["single_choice", "multi_choice"] = "single_choice"


class QuestionUpdateIn(BaseModel):
    prompt: Optional[str] = Field(default=None, min_length=1)
    sort_order: Optional[int] = None
    question_type: Optional[Literal["single_choice", "multi_choice"]] = None


class OptionCreateIn(BaseModel):
    label: str = Field(min_length=1)
    is_correct: bool = False
    sort_order: int = 0


class OptionUpdateIn(BaseModel):
    label: Optional[str] = Field(default=None, min_length=1)
    is_correct: Optional[bool] = None
    sort_order: Optional[int] = None


class PublishIn(BaseModel):
    published: bool


# ── Helpers ──────────────────────────────────────────────────────────────────


async def _assessment_or_404(session: AsyncSession, assessment_id: str) -> Assessment:
    try:
        aid = uuid.UUID(assessment_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Assessment not found")
    assessment = (await session.execute(
        select(Assessment).where(Assessment.id == aid)
    )).scalar_one_or_none()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return assessment


async def _question_or_404(session: AsyncSession, question_id: str) -> AssessmentQuestion:
    try:
        qid = uuid.UUID(question_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Question not found")
    question = (await session.execute(
        select(AssessmentQuestion).where(AssessmentQuestion.id == qid)
    )).scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    return question


async def _option_or_404(session: AsyncSession, option_id: str) -> AssessmentOption:
    try:
        oid = uuid.UUID(option_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Option not found")
    option = (await session.execute(
        select(AssessmentOption).where(AssessmentOption.id == oid)
    )).scalar_one_or_none()
    if not option:
        raise HTTPException(status_code=404, detail="Option not found")
    return option


async def _serialise(session: AsyncSession, assessment: Assessment) -> AssessmentOut:
    questions = (
        (await session.execute(
            select(AssessmentQuestion)
            .where(AssessmentQuestion.assessment_id == assessment.id)
            .order_by(AssessmentQuestion.sort_order)
        )).scalars().all()
    )
    options_by_question: dict[uuid.UUID, list[AssessmentOption]] = {}
    if questions:
        options = (
            (await session.execute(
                select(AssessmentOption)
                .where(AssessmentOption.question_id.in_([q.id for q in questions]))
                .order_by(AssessmentOption.sort_order)
            )).scalars().all()
        )
        for opt in options:
            options_by_question.setdefault(opt.question_id, []).append(opt)

    attempt_count = (await session.execute(
        select(func.count()).select_from(AssessmentAttempt).where(
            AssessmentAttempt.assessment_id == assessment.id
        )
    )).scalar_one()

    # Resolve the module, and through it the course, so a row can name where it lives.
    course_id = None
    module_title = None
    course_title = None
    if assessment.module_id:
        module = (await session.execute(
            select(Module).where(Module.id == assessment.module_id)
        )).scalar_one_or_none()
        if module:
            course_id = str(module.course_id)
            module_title = module.title
            course = (await session.execute(
                select(Course).where(Course.id == module.course_id)
            )).scalar_one_or_none()
            if course:
                course_title = course.title

    return AssessmentOut(
        id=str(assessment.id),
        module_id=str(assessment.module_id),
        course_id=course_id,
        module_title=module_title,
        course_title=course_title,
        title=assessment.title,
        description=assessment.description,
        passing_score=assessment.passing_score,
        max_attempts=assessment.max_attempts,
        published=assessment.published,
        attempt_count=attempt_count,
        questions=[
            QuestionOut(
                id=str(q.id),
                prompt=q.prompt,
                sort_order=q.sort_order,
                question_type=q.question_type.value if hasattr(q.question_type, "value") else q.question_type,
                options=[
                    OptionOut(
                        id=str(o.id), label=o.label,
                        is_correct=o.is_correct, sort_order=o.sort_order,
                    )
                    for o in options_by_question.get(q.id, [])
                ],
            )
            for q in questions
        ],
    )


# ── Assessment ───────────────────────────────────────────────────────────────


@router.get("/admin/assessments", response_model=list[AssessmentOut])
async def list_assessments(
    module_id: Optional[str] = None,
    course_id: Optional[str] = None,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """All assessments, or the ones for a given module/course."""
    stmt = select(Assessment).order_by(Assessment.created_at.desc())
    if module_id:
        try:
            stmt = stmt.where(Assessment.module_id == uuid.UUID(module_id))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid module_id")
    elif course_id:
        try:
            course_uuid = uuid.UUID(course_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid course_id")
        # Filter by course via module join
        module_ids = (
            (await session.execute(
                select(Module.id).where(Module.course_id == course_uuid)
            )).scalars().all()
        )
        if module_ids:
            stmt = stmt.where(Assessment.module_id.in_(module_ids))
        else:
            return []
    rows = (await session.execute(stmt)).scalars().all()
    return [await _serialise(session, a) for a in rows]


@router.get("/admin/assessments/{assessment_id}", response_model=AssessmentOut)
async def get_assessment(
    assessment_id: str,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    return await _serialise(session, await _assessment_or_404(session, assessment_id))


@router.post(
    "/admin/assessments",
    response_model=AssessmentOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_assessment(
    payload: AssessmentCreateIn,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """Create the module's assessment. One per module — a second is a 409, not a second
    row, because the certificate gate asks a single-row question."""
    try:
        module_uuid = uuid.UUID(payload.module_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid module_id")

    module = (await session.execute(
        select(Module).where(Module.id == module_uuid)
    )).scalar_one_or_none()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    existing = (await session.execute(
        select(Assessment).where(Assessment.module_id == module_uuid)
    )).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": {
                    "code": "assessment_exists",
                    "message": f"This module already has an assessment ('{existing.title}').",
                }
            },
        )

    assessment = Assessment(
        module_id=module_uuid,
        title=payload.title,
        description=payload.description,
        passing_score=payload.passing_score,
        max_attempts=payload.max_attempts,
        published=False,
    )
    session.add(assessment)
    await session.flush()

    await record_audit(
        session,
        actor=admin,
        action="create_assessment",
        target_type="assessment",
        target_id=assessment.id,
        context={"module_id": str(module_uuid), "title": assessment.title},
    )
    # The endpoint owns the commit — see the module docstring.
    await session.commit()

    return await _serialise(session, assessment)


@router.patch("/admin/assessments/{assessment_id}", response_model=AssessmentOut)
async def update_assessment(
    assessment_id: str,
    payload: AssessmentUpdateIn,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """Update the assessment's metadata. Publish is deliberately NOT here — see the
    module docstring."""
    assessment = await _assessment_or_404(session, assessment_id)

    changed: dict[str, object] = {}
    if payload.title is not None:
        assessment.title = payload.title
        changed["title"] = payload.title
    if payload.description is not None:
        assessment.description = payload.description
        changed["description"] = True
    if payload.passing_score is not None:
        assessment.passing_score = payload.passing_score
        changed["passing_score"] = payload.passing_score
    if payload.max_attempts is not None:
        assessment.max_attempts = payload.max_attempts
        changed["max_attempts"] = payload.max_attempts
    await session.flush()

    await record_audit(
        session,
        actor=admin,
        action="update_assessment",
        target_type="assessment",
        target_id=assessment.id,
        context=changed,
    )
    await session.commit()

    return await _serialise(session, assessment)


@router.delete("/admin/assessments/{assessment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_assessment(
    assessment_id: str,
    force: bool = False,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """Delete an assessment, its questions and its options.

    `assessment_attempts.assessment_id` is `ON DELETE CASCADE`, so this also destroys
    every learner's attempt history for the quiz — and those attempts are what
    `course_assessment_gate_satisfied` reads to decide whether a certificate may be
    issued. Deleting a quiz people have sat therefore silently rewrites who has passed
    the course, which is not something to do on a mis-click.

    So an assessment with recorded attempts is refused unless the caller explicitly
    passes `?force=true`. A quiz nobody has attempted deletes freely — that is the
    common case (a draft created by mistake) and it destroys nothing.
    """
    assessment = await _assessment_or_404(session, assessment_id)

    attempt_count = (await session.execute(
        select(func.count()).select_from(AssessmentAttempt).where(
            AssessmentAttempt.assessment_id == assessment.id
        )
    )).scalar_one()

    if attempt_count and not force:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": {
                    "code": "assessment_has_attempts",
                    "message": (
                        f"{attempt_count} learner attempt(s) recorded. Deleting this "
                        "assessment erases them and may withdraw course certificates "
                        "that depended on a passing attempt. Unpublish it instead, or "
                        "confirm to delete anyway."
                    ),
                }
            },
        )

    await record_audit(
        session,
        actor=admin,
        action="delete_assessment",
        target_type="assessment",
        target_id=assessment.id,
        # Recorded before the delete: afterwards there is nothing left to describe what
        # was removed, and the attempt count is the part that matters most in review.
        context={
            "title": assessment.title,
            "module_id": str(assessment.module_id),
            "published": assessment.published,
            "attempts_destroyed": attempt_count,
            "forced": bool(force),
        },
    )

    await session.delete(assessment)
    await session.commit()
    return None


@router.post("/admin/assessments/{assessment_id}/publish", response_model=AssessmentOut)
async def set_assessment_published(
    assessment_id: str,
    payload: PublishIn,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """Publish or unpublish. Publishing starts gating this module's certificates, so a
    paper that cannot be passed is refused rather than published: no questions, or any
    question with no correct option, means nobody can reach 100% and everyone who
    finishes the lessons silently stops receiving certificates."""
    assessment = await _assessment_or_404(session, assessment_id)

    if payload.published:
        questions = (
            (await session.execute(
                select(AssessmentQuestion).where(
                    AssessmentQuestion.assessment_id == assessment.id
                )
            )).scalars().all()
        )
        if not questions:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "error": {
                        "code": "assessment_empty",
                        "message": "Add at least one question before publishing.",
                    }
                },
            )
        correct_question_ids = set(
            (await session.execute(
                select(AssessmentOption.question_id).where(
                    AssessmentOption.question_id.in_([q.id for q in questions]),
                    AssessmentOption.is_correct.is_(True),
                )
            )).scalars().all()
        )
        unanswerable = [q for q in questions if q.id not in correct_question_ids]
        if unanswerable:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "error": {
                        "code": "question_without_correct_option",
                        "message": (
                            f"{len(unanswerable)} question(s) have no correct option marked. "
                            "Nobody could pass this assessment."
                        ),
                    }
                },
            )

    assessment.published = payload.published
    await session.flush()

    await record_audit(
        session,
        actor=admin,
        action="publish_assessment" if payload.published else "unpublish_assessment",
        target_type="assessment",
        target_id=assessment.id,
        context={"published": payload.published, "module_id": str(assessment.module_id)},
    )
    await session.commit()

    return await _serialise(session, assessment)


# ── Questions ────────────────────────────────────────────────────────────────


@router.post(
    "/admin/assessments/{assessment_id}/questions",
    response_model=AssessmentOut,
    status_code=status.HTTP_201_CREATED,
)
async def add_question(
    assessment_id: str,
    payload: QuestionCreateIn,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    assessment = await _assessment_or_404(session, assessment_id)

    question = AssessmentQuestion(
        assessment_id=assessment.id,
        prompt=payload.prompt,
        sort_order=payload.sort_order,
        question_type=AssessmentQuestionType(payload.question_type),
    )
    session.add(question)
    await session.flush()

    await record_audit(
        session,
        actor=admin,
        action="create_assessment_question",
        target_type="assessment_question",
        target_id=question.id,
        context={"assessment_id": str(assessment.id), "question_type": payload.question_type},
    )
    await session.commit()

    return await _serialise(session, assessment)


@router.patch("/admin/assessment-questions/{question_id}", response_model=AssessmentOut)
async def update_question(
    question_id: str,
    payload: QuestionUpdateIn,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    question = await _question_or_404(session, question_id)

    changed: dict[str, object] = {}
    if payload.prompt is not None:
        question.prompt = payload.prompt
        changed["prompt"] = True
    if payload.sort_order is not None:
        question.sort_order = payload.sort_order
        changed["sort_order"] = payload.sort_order
    if payload.question_type is not None:
        question.question_type = AssessmentQuestionType(payload.question_type)
        changed["question_type"] = payload.question_type
    await session.flush()

    await record_audit(
        session,
        actor=admin,
        action="update_assessment_question",
        target_type="assessment_question",
        target_id=question.id,
        context=changed,
    )
    await session.commit()

    assessment = await _assessment_or_404(session, str(question.assessment_id))
    return await _serialise(session, assessment)


@router.delete("/admin/assessment-questions/{question_id}", response_model=AssessmentOut)
async def delete_question(
    question_id: str,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """Delete a question and its options (ON DELETE CASCADE in migration 036).

    Past attempts are untouched: their scores were computed and stored at submission
    time, and `assessment_attempts.answers` keeps the snapshot of what was submitted, so
    editing the paper never silently rewrites someone's result.
    """
    question = await _question_or_404(session, question_id)
    assessment_id = question.assessment_id

    await session.delete(question)
    await session.flush()

    await record_audit(
        session,
        actor=admin,
        action="delete_assessment_question",
        target_type="assessment_question",
        target_id=question.id,
        context={"assessment_id": str(assessment_id)},
    )
    await session.commit()

    assessment = await _assessment_or_404(session, str(assessment_id))
    return await _serialise(session, assessment)


# ── Options ──────────────────────────────────────────────────────────────────


@router.post(
    "/admin/assessment-questions/{question_id}/options",
    response_model=AssessmentOut,
    status_code=status.HTTP_201_CREATED,
)
async def add_option(
    question_id: str,
    payload: OptionCreateIn,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    question = await _question_or_404(session, question_id)

    option = AssessmentOption(
        question_id=question.id,
        label=payload.label,
        is_correct=payload.is_correct,
        sort_order=payload.sort_order,
    )
    session.add(option)
    await session.flush()

    await record_audit(
        session,
        actor=admin,
        action="create_assessment_option",
        target_type="assessment_option",
        target_id=option.id,
        context={"question_id": str(question.id), "is_correct": payload.is_correct},
    )
    await session.commit()

    assessment = await _assessment_or_404(session, str(question.assessment_id))
    return await _serialise(session, assessment)


@router.patch("/admin/assessment-options/{option_id}", response_model=AssessmentOut)
async def update_option(
    option_id: str,
    payload: OptionUpdateIn,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    option = await _option_or_404(session, option_id)

    changed: dict[str, object] = {}
    if payload.label is not None:
        option.label = payload.label
        changed["label"] = True
    if payload.is_correct is not None:
        option.is_correct = payload.is_correct
        changed["is_correct"] = payload.is_correct
    if payload.sort_order is not None:
        option.sort_order = payload.sort_order
        changed["sort_order"] = payload.sort_order
    await session.flush()

    await record_audit(
        session,
        actor=admin,
        action="update_assessment_option",
        target_type="assessment_option",
        target_id=option.id,
        context=changed,
    )
    await session.commit()

    question = await _question_or_404(session, str(option.question_id))
    assessment = await _assessment_or_404(session, str(question.assessment_id))
    return await _serialise(session, assessment)


@router.delete("/admin/assessment-options/{option_id}", response_model=AssessmentOut)
async def delete_option(
    option_id: str,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    option = await _option_or_404(session, option_id)
    question_id = option.question_id

    await session.delete(option)
    await session.flush()

    await record_audit(
        session,
        actor=admin,
        action="delete_assessment_option",
        target_type="assessment_option",
        target_id=option.id,
        context={"question_id": str(question_id)},
    )
    await session.commit()

    question = await _question_or_404(session, str(question_id))
    assessment = await _assessment_or_404(session, str(question.assessment_id))
    return await _serialise(session, assessment)
