from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional, List
from app.db.session import get_session
from app.db.models import (
    Question,
    TagValue,
    Domain,
    QuestionLeadershipTrait,
    QuestionRelation,
    QuestionLesson,
    Product,
    ProductContent,
    Lesson,
    Module,
    Course,
)
from app.core.deps import get_current_user_id_optional
from app.core.entitlements import ResourceType, has_access_to
import uuid


class RelatedProductOut(BaseModel):
    slug: str
    name: str
    price_amount: int
    currency: str

class RelatedLessonOut(BaseModel):
    """A lesson this question leads into (§21.1 "related lessons"), shown with its
    entitlement state — never playable from here, this is a signpost to the course
    (§21.4's buy surface is the actual purchase path), not a second player."""
    course_slug: str
    course_title: str
    lesson_slug: str
    lesson_title: str
    lesson_type: str
    owned: bool

router = APIRouter()

class TagOut(BaseModel):
    dimension: str
    value: str
    display_label: str
    # tag_values.sort_order — the real ordinal scale (effort: quick < mod < project
    # < trans, duration: xs < s < m < l < xl, ...). Without this the frontend's only
    # option was rendering values in whatever order they were first encountered
    # across the question list, which reads as random ("Mod., Project, Quick,
    # Trans."), not a scale a practitioner can actually read at a glance.
    sort_order: int

class QuestionSummaryOut(BaseModel):
    id: str
    slug: str
    title: str
    subtitle: Optional[str]
    preview: str
    domain: str
    tags: List[TagOut]

class QuestionOut(BaseModel):
    id: str
    slug: str
    title: str
    subtitle: Optional[str]
    preview: str
    # Always present now — the written question is the free entry point (intern
    # brief: "at least one free entry point that earns an email address"), not the
    # paid product. It used to be withheld entirely for non-entitled visitors
    # (QuestionPreviewOut had no body field at all), which meant nothing was
    # actually free to read — only a 160-char teaser. The frontend soft-gates this
    # behind an email capture (CSS blur + /leads, not a server-side restriction);
    # the body itself is not the thing being sold.
    body: str
    domain: str
    tags: List[TagOut]
    # Now purely about the *product* upsell card (template/lesson bundle), unrelated
    # to whether body above is present — kept under this name so the frontend's
    # existing "buy the template" card logic didn't need to change.
    gated: bool
    related_content: List[RelatedProductOut]
    # §21.1: up to 3 related questions (explicit QuestionRelation rows first, same-
    # domain published questions as a fallback so this is never empty just because
    # nobody has curated relations yet — never fabricated, always a real query).
    related_questions: List[QuestionSummaryOut]
    # §21.1: the course lesson(s) this question leads into, with entitlement state
    # so the frontend can show "included" vs the lock icon (§23.4) without a second
    # round trip.
    related_lessons: List[RelatedLessonOut]


_TAG_FK_DIMENSIONS = (
    'effort_tag_id', 'duration_tag_id', 'cost_tag_id',
    'roi_horizon_tag_id', 'tier_tag_id', 'regulator_pressure_tag_id',
)


async def _load_domains(session: AsyncSession) -> dict:
    """All domains, once. Five rows — cheap to hold for the life of a request and
    avoids a per-question round trip (see `_load_tag_value_map` for why this
    matters now that the catalogue is 100 rows, not 1)."""
    result = await session.execute(select(Domain))
    return {d.id: d for d in result.scalars().all()}


async def _load_tag_value_map(session: AsyncSession) -> dict:
    """All tag_values, once, keyed by id. `tag_values.tag_dimension` already carries
    the dimension name, so a single flat map resolves every FK column on a question
    (effort_tag_id, duration_tag_id, ...) *and* every leadership-trait join row,
    with no per-tag query. `list_questions` used to do 1 domain query + 6 tag
    queries + 1 traits query *per question* — invisible at 1 seeded question,
    ~90s at the real 100 (§43's performance budget exists for exactly this)."""
    result = await session.execute(select(TagValue))
    return {
        t.id: TagOut(dimension=t.tag_dimension, value=t.value, display_label=t.display_label, sort_order=t.sort_order)
        for t in result.scalars().all()
    }


async def _load_leadership_traits(session: AsyncSession, question_ids: list, tag_map: dict) -> dict:
    """One query for every question's leadership traits at once, grouped by
    question_id — the multi-select join table's answer to the same N+1 problem."""
    if not question_ids:
        return {}
    result = await session.execute(
        select(QuestionLeadershipTrait.question_id, QuestionLeadershipTrait.trait_tag_id).where(
            QuestionLeadershipTrait.question_id.in_(question_ids)
        )
    )
    by_question: dict = {}
    for question_id, trait_tag_id in result.all():
        tag = tag_map.get(trait_tag_id)
        if tag:
            by_question.setdefault(question_id, []).append(tag)
    # Multi-select, so display order matters and the query above has none — sort
    # each question's traits by the real ordinal scale, same as every other
    # dimension (tag_values.sort_order), not by insertion/DB row order.
    for traits in by_question.values():
        traits.sort(key=lambda t: t.sort_order)
    return by_question


def _tags_for_question(question: Question, tag_map: dict, traits_by_question: dict) -> List[TagOut]:
    """Shared by the list and detail routes so the two never drift on how a
    question's tag FKs resolve into (dimension, value, display_label) triples —
    reading from the batched maps above, never issuing a query itself."""
    tags: List[TagOut] = [
        tag_map[tag_id]
        for field in _TAG_FK_DIMENSIONS
        if (tag_id := getattr(question, field)) and tag_id in tag_map
    ]
    tags.extend(traits_by_question.get(question.id, []))
    return tags


@router.get("/questions", response_model=List[QuestionSummaryOut])
async def list_questions(session: AsyncSession = Depends(get_session)):
    """The question index — public, like /courses and /templates. Every question's
    written guidance is free to read (the email-gate lives client-side), so this list
    never needs an entitlement check the way the template/course catalogues do."""
    result = await session.execute(
        select(Question).where(Question.published.is_(True)).order_by(Question.created_at)
    )
    questions = result.scalars().all()

    # Four queries total, however many questions there are — not four-plus-eight-
    # per-question (see `_load_tag_value_map`'s docstring).
    domains = await _load_domains(session)
    tag_map = await _load_tag_value_map(session)
    traits_by_question = await _load_leadership_traits(session, [q.id for q in questions], tag_map)

    return [
        QuestionSummaryOut(
            id=str(q.id), slug=q.slug, title=q.title, subtitle=q.subtitle,
            preview=q.preview, domain=domains[q.domain_id].name,
            tags=_tags_for_question(q, tag_map, traits_by_question),
        )
        for q in questions
    ]


@router.get("/questions/{slug}", response_model=QuestionOut)
async def get_question(
    slug: str,
    session: AsyncSession = Depends(get_session),
    user_id: Optional[str] = Depends(get_current_user_id_optional),
):
    """Get question by slug. Returns preview for non-entitled (including logged-out —
    this is the public discovery surface, research spec 8.2), full for entitled."""
    
    # Fetch question
    result = await session.execute(
        select(Question).where(Question.slug == slug)
    )
    question = result.scalar_one_or_none()
    
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    
    # Same batched helpers as list_questions (§ above) — a single-question request
    # only needs domains/tag_values loaded once each regardless, and sharing the
    # helpers means this route and the list route can no longer drift on how a
    # tag FK resolves into a TagOut, which the old duplicated inline loop here
    # already had (its docstring claimed sharing that wasn't actually happening).
    domains = await _load_domains(session)
    domain = domains[question.domain_id]
    tag_map = await _load_tag_value_map(session)
    traits_by_question = await _load_leadership_traits(session, [question.id], tag_map)
    tags = _tags_for_question(question, tag_map, traits_by_question)

    # Check entitlement — 200 either way, never 403: the paywall is a conversion
    # surface, not an error (DESIGN.md §21.3). Logged-out users are never entitled,
    # skipping the query entirely rather than passing a null user_id through.
    is_entitled = (
        await has_access_to(
            user_id=uuid.UUID(user_id),
            resource_type=ResourceType.QUESTION,
            resource_id=question.id,
            session=session,
        )
        if user_id
        else False
    )
    
    # DESIGN.md §21.4: the related-template card on the question page is a direct buy
    # surface (name, price) — resolved via product_contents (content_type='question_set',
    # content_id=this question), never a hardcoded/empty stand-in the frontend can't act on.
    related_result = await session.execute(
        select(Product)
        .join(ProductContent, ProductContent.product_id == Product.id)
        .where(
            ProductContent.content_type == ResourceType.QUESTION.value,
            ProductContent.content_id == question.id,
            Product.published.is_(True),
        )
    )
    related_content = [
        RelatedProductOut(slug=p.slug, name=p.name, price_amount=p.price_amount, currency=p.currency)
        for p in related_result.scalars().all()
    ]

    # §21.1 "Related questions": explicit curated relations first, in their sort
    # order; if none have been curated yet, fall back to other published questions
    # in the same domain so the section is never empty purely for lack of admin
    # data-entry — capped at 3 either way (§21.1).
    related_q_result = await session.execute(
        select(Question)
        .join(QuestionRelation, QuestionRelation.related_question_id == Question.id)
        .where(QuestionRelation.question_id == question.id, Question.published.is_(True))
        .order_by(QuestionRelation.sort_order)
        .limit(3)
    )
    related_questions_rows = list(related_q_result.scalars().all())
    if not related_questions_rows:
        fallback_result = await session.execute(
            select(Question)
            .where(
                Question.domain_id == question.domain_id,
                Question.id != question.id,
                Question.published.is_(True),
            )
            .order_by(Question.created_at)
            .limit(3)
        )
        related_questions_rows = list(fallback_result.scalars().all())

    related_traits_by_question = await _load_leadership_traits(
        session, [rq.id for rq in related_questions_rows], tag_map
    )
    related_questions = [
        QuestionSummaryOut(
            id=str(rq.id), slug=rq.slug, title=rq.title, subtitle=rq.subtitle,
            preview=rq.preview, domain=domains[rq.domain_id].name,
            tags=_tags_for_question(rq, tag_map, related_traits_by_question),
        )
        for rq in related_questions_rows
    ]

    # §21.1 "Related lessons": the course lesson(s) this question leads into, each
    # with its own entitlement check (§23.4 — never a second player here, just the
    # signpost + lock state; the course page is where playback actually happens).
    related_lesson_result = await session.execute(
        select(Lesson, Module, Course)
        .join(QuestionLesson, QuestionLesson.lesson_id == Lesson.id)
        .join(Module, Module.id == Lesson.module_id)
        .join(Course, Course.id == Module.course_id)
        .where(
            QuestionLesson.question_id == question.id,
            Lesson.published.is_(True),
            Course.published.is_(True),
        )
        .order_by(QuestionLesson.sort_order)
    )
    related_lessons = []
    for lesson, module, course in related_lesson_result.all():
        owned = (
            await has_access_to(
                user_id=uuid.UUID(user_id),
                resource_type=ResourceType.LESSON,
                resource_id=lesson.id,
                session=session,
            )
            if user_id
            else False
        )
        related_lessons.append(
            RelatedLessonOut(
                course_slug=course.slug,
                course_title=course.title,
                lesson_slug=lesson.slug,
                lesson_title=lesson.title,
                lesson_type=lesson.lesson_type,
                owned=owned,
            )
        )

    return QuestionOut(
        id=str(question.id),
        slug=question.slug,
        title=question.title,
        subtitle=question.subtitle,
        preview=question.preview,
        body=question.body,
        domain=domain.name,
        tags=tags,
        gated=not is_entitled,
        related_content=related_content,
        related_questions=related_questions,
        related_lessons=related_lessons,
    )
