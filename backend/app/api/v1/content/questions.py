"""Public question catalogue and detail routes.

`/questions/index` and the scored `/questions` are deliberately two different response
shapes at two different paths, not one endpoint branching on query params: the index
never carries `body`, as a structural fact about its model rather than a runtime check.

At today's scale, `QuestionsCatalogue.tsx` fetches `/questions/index` once and does all
filtering/scoring/counting client-side with `scoring.ts`. The scored `/questions`
endpoint below is the authoritative server-side twin of that algorithm
(`question_service.py`), so a later swap to server-side filtering at scale is a
data-source change, not a new subsystem.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional, List, Union
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
from app.core.entitlements import ResourceType, resolve_granted_content_ids, resolve_product_ids
from app.services.question_service import (
    QuestionFilters,
    ScorableQuestion,
    TagRef,
    partition_questions,
    rank_relaxation_candidates,
)
import uuid


class RelatedProductOut(BaseModel):
    slug: str
    name: str
    price_amount: int
    currency: str

class RelatedLessonOut(BaseModel):
    """A lesson this question leads into, with its entitlement state. A signpost to
    the course, never a player."""
    course_slug: str
    course_title: str
    lesson_slug: str
    lesson_title: str
    lesson_type: str
    owned: bool
    # Cheapest published product that grants THIS lesson, or None if nothing sells it.
    # Resolved per lesson — the question's own upsell list may sell a different item.
    unlock_product_slug: Optional[str] = None
    unlock_product_name: Optional[str] = None

router = APIRouter()

class TagOut(BaseModel):
    dimension: str
    value: str
    display_label: str
    # tag_values.sort_order — the ordinal scale (effort: quick < mod < project < trans,
    # duration: xs < s < m < l < xl, ...) the frontend orders values by.
    sort_order: int

class QuestionSummaryOut(BaseModel):
    id: str
    slug: str
    title: str
    subtitle: Optional[str]
    preview: str
    domain: str
    # The stable identifier scoring/filtering compares against — `domain` above is the
    # display name, which the owner can reword without breaking a bookmarked filter URL.
    domain_slug: str
    tags: List[TagOut]
    # The homepage's curated picks (week3_plan.md §20.6). Carried on every summary
    # response (not a separate `?featured=true`-only field set) so `Home.tsx` can derive
    # its featured row from the one `/questions/index` fetch it already makes for
    # everything else on the page, at no extra round trip.
    featured: bool = False
    featured_sort: Optional[int] = None

class QuestionOut(BaseModel):
    id: str
    slug: str
    title: str
    subtitle: Optional[str]
    preview: str
    # Always present, and always rendered in full — the written question is the free
    # entry point, not the paid product.
    body: str
    domain: str
    tags: List[TagOut]
    # Drives the product upsell card only; unrelated to whether `body` is present.
    gated: bool
    related_content: List[RelatedProductOut]
    # Up to 3 related questions (§21.1).
    related_questions: List[QuestionSummaryOut]
    # Course lesson(s) this question leads into, with entitlement state so the
    # frontend can show "included" vs locked without a second round trip.
    related_lessons: List[RelatedLessonOut]


_TAG_FK_DIMENSIONS = (
    'effort_tag_id', 'duration_tag_id', 'cost_tag_id',
    'roi_horizon_tag_id', 'tier_tag_id', 'regulator_pressure_tag_id',
)


async def _load_domains(session: AsyncSession) -> dict:
    """All domains, once — five rows, avoiding a per-question round trip."""
    result = await session.execute(select(Domain))
    return {d.id: d for d in result.scalars().all()}


async def _load_tag_value_map(session: AsyncSession) -> dict:
    """All tag_values, once, keyed by id. One flat map resolves every tag FK on a
    question and every leadership-trait row, avoiding an N+1 across the catalogue."""
    result = await session.execute(select(TagValue))
    return {
        t.id: TagOut(dimension=t.tag_dimension, value=t.value, display_label=t.display_label, sort_order=t.sort_order)
        for t in result.scalars().all()
    }


async def _load_leadership_traits(session: AsyncSession, question_ids: list, tag_map: dict) -> dict:
    """Every question's leadership traits in one query, grouped by question_id."""
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
    # Multi-select, so sort by the ordinal scale rather than DB row order.
    for traits in by_question.values():
        traits.sort(key=lambda t: t.sort_order)
    return by_question


def _tags_for_question(question: Question, tag_map: dict, traits_by_question: dict) -> List[TagOut]:
    """Resolve a question's tag FKs from the batched maps above. Shared by the list
    and detail routes so the two can't drift; issues no queries itself."""
    tags: List[TagOut] = [
        tag_map[tag_id]
        for field in _TAG_FK_DIMENSIONS
        if (tag_id := getattr(question, field)) and tag_id in tag_map
    ]
    tags.extend(traits_by_question.get(question.id, []))
    return tags


async def _load_published_questions(session: AsyncSession):
    """The shared data both `/questions/index` and the scored `/questions` need, so the
    two routes can't drift on what "published" means. Four queries either way."""
    result = await session.execute(
        select(Question).where(Question.published.is_(True)).order_by(Question.title)
    )
    questions = result.scalars().all()
    domains = await _load_domains(session)
    tag_map = await _load_tag_value_map(session)
    traits_by_question = await _load_leadership_traits(session, [q.id for q in questions], tag_map)
    return questions, domains, tag_map, traits_by_question


def _question_summary(q: Question, domains: dict, tag_map: dict, traits_by_question: dict) -> QuestionSummaryOut:
    domain = domains[q.domain_id]
    return QuestionSummaryOut(
        id=str(q.id), slug=q.slug, title=q.title, subtitle=q.subtitle,
        preview=q.preview, domain=domain.name, domain_slug=domain.slug,
        tags=_tags_for_question(q, tag_map, traits_by_question),
        featured=q.featured, featured_sort=q.featured_sort,
    )


@router.get("/questions/index", response_model=List[QuestionSummaryOut])
async def list_questions_index(
    session: AsyncSession = Depends(get_session),
    featured: Optional[bool] = None,
):
    """The cacheable question index — public, no `body` field ever. Every question is
    free to read, so no entitlement check is needed. `QuestionsCatalogue.tsx` fetches
    this once and does all filtering/scoring/live-counting against it client-side.

    `?featured=true` (week3_plan.md §20.6 / Phase 5 step 6) narrows to the owner's
    curated homepage picks, ordered by `featured_sort` (nulls last, so a featured
    question with no explicit order still appears rather than vanishing). `Home.tsx`
    doesn't call this directly — it already holds the full list from its own
    unfiltered fetch and filters client-side — but the parameter exists as first-class
    API surface for any other caller that wants the curated set without the rest."""
    questions, domains, tag_map, traits_by_question = await _load_published_questions(session)
    if featured is True:
        questions = sorted(
            (q for q in questions if q.featured),
            key=lambda q: (q.featured_sort is None, q.featured_sort, q.title),
        )
    elif featured is False:
        questions = [q for q in questions if not q.featured]
    # Title order otherwise, not creation order: the tie-break scoring relies on being
    # stable against, and reads better as a plain unfiltered list.
    return [_question_summary(q, domains, tag_map, traits_by_question) for q in questions]


class QuestionMissOut(BaseModel):
    dimension: str
    requested: Union[str, List[str]]
    actual: Optional[Union[str, List[str]]]
    # 1 = adjacent, null = far or unknown — both scored 0.
    distance: Optional[int]


class ScoredQuestionOut(QuestionSummaryOut):
    score: int
    misses: List[QuestionMissOut]


class QuestionSearchOut(BaseModel):
    exact: List[QuestionSummaryOut]
    close: List[ScoredQuestionOut]
    exact_count: int
    close_count: int
    has_filters: bool
    # Zero-result recovery: active filter dimensions ranked most-restrictive-first, so
    # the frontend can offer the top two as one-tap relaxations.
    relaxation_candidates: List[str]


def _scorable_question(item: Question, domains: dict, tag_map: dict, traits_by_question: dict) -> ScorableQuestion:
    tags: dict[str, TagRef] = {
        tag_map[tag_id].dimension: TagRef(
            dimension=tag_map[tag_id].dimension, value=tag_map[tag_id].value,
            display_label=tag_map[tag_id].display_label, sort_order=tag_map[tag_id].sort_order,
        )
        for field in _TAG_FK_DIMENSIONS
        if (tag_id := getattr(item, field)) and tag_id in tag_map
    }
    traits = tuple(
        TagRef(dimension=t.dimension, value=t.value, display_label=t.display_label, sort_order=t.sort_order)
        for t in traits_by_question.get(item.id, [])
    )
    return ScorableQuestion(id=str(item.id), domain_slug=domains[item.domain_id].slug, tags=tags, leadership_traits=traits)


@router.get("/questions", response_model=QuestionSearchOut)
async def search_questions(
    session: AsyncSession = Depends(get_session),
    domain: Optional[str] = None,
    effort: Optional[str] = None,
    duration: Optional[str] = None,
    cost: Optional[str] = None,
    roi_horizon: Optional[str] = None,
    regulator_pressure: Optional[str] = None,
    tier: List[str] = Query(default=[]),
    leadership_traits: List[str] = Query(default=[]),
    q: Optional[str] = None,
):
    """The authoritative, server-side scored search — see this file's module docstring
    for why `QuestionsCatalogue.tsx` doesn't call this on every filter tap today.
    `question_service.py` implements the identical rule `scoring.ts` does; the two are
    parity-tested against a shared fixture.
    """
    questions, domains, tag_map, traits_by_question = await _load_published_questions(session)

    # Free-text search runs BEFORE scoring, as a filter over title/preview, not as a
    # scored dimension — mixing keyword relevance into the constraint score would
    # produce a ranking nobody could explain.
    if q and (needle := q.strip().lower()):
        questions = [
            item for item in questions if needle in item.title.lower() or needle in item.preview.lower()
        ]

    scorable = [_scorable_question(item, domains, tag_map, traits_by_question) for item in questions]
    summaries_by_id = {
        str(item.id): _question_summary(item, domains, tag_map, traits_by_question) for item in questions
    }
    tag_lookup = {
        (t.dimension, t.value): TagRef(dimension=t.dimension, value=t.value, display_label=t.display_label, sort_order=t.sort_order)
        for t in tag_map.values()
    }
    filters = QuestionFilters(
        domain=domain, effort=effort, duration=duration, cost=cost,
        roi_horizon=roi_horizon, regulator_pressure=regulator_pressure,
        tier=tuple(tier), leadership_traits=tuple(leadership_traits),
    )
    exact, close, has_filters = partition_questions(scorable, filters, tag_lookup)

    # Only computed when there's actually a dead end to recover from.
    relaxation_candidates = (
        rank_relaxation_candidates(scorable, filters) if has_filters and not exact and not close else []
    )

    return QuestionSearchOut(
        exact=[summaries_by_id[s.question.id] for s in exact],
        close=[
            ScoredQuestionOut(
                **summaries_by_id[s.question.id].model_dump(),
                score=s.score,
                misses=[
                    QuestionMissOut(
                        dimension=m.dimension,
                        requested=list(m.requested) if isinstance(m.requested, tuple) else m.requested,
                        actual=list(m.actual) if isinstance(m.actual, tuple) else m.actual,
                        distance=m.distance,
                    )
                    for m in s.misses
                ],
            )
            for s in close
        ],
        exact_count=len(exact),
        close_count=len(close),
        has_filters=has_filters,
        relaxation_candidates=relaxation_candidates,
    )


@router.get("/questions/{slug}/related-products", response_model=List[RelatedProductOut])
async def get_related_products(
    slug: str,
    session: AsyncSession = Depends(get_session),
):
    """Products that include this question, ranked by price (cheapest first).
    
    Fixed query count: one join on product_contents. Used for question detail page
    upsell panel (week4_plan.md W4-R8).
    """
    # Fetch question
    result = await session.execute(
        select(Question).where(Question.slug == slug)
    )
    question = result.scalar_one_or_none()
    
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    
    # Find products that include this question via product_contents
    related_result = await session.execute(
        select(Product)
        .join(ProductContent, ProductContent.product_id == Product.id)
        .where(
            ProductContent.content_type == ResourceType.QUESTION.value,
            ProductContent.content_id == question.id,
            Product.published.is_(True),
        )
        # Cheapest first — more than one product can grant the same question
        .order_by(Product.price_amount)
    )
    
    return [
        RelatedProductOut(slug=p.slug, name=p.name, price_amount=p.price_amount, currency=p.currency)
        for p in related_result.scalars().all()
    ]


@router.get("/questions/{slug}", response_model=QuestionOut)
async def get_question(
    slug: str,
    session: AsyncSession = Depends(get_session),
    user_id: Optional[str] = Depends(get_current_user_id_optional),
):
    """Get a question by slug. Public — `gated` carries the entitlement state."""
    
    # Fetch question
    result = await session.execute(
        select(Question).where(Question.slug == slug)
    )
    question = result.scalar_one_or_none()
    
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    
    # Same batched helpers as list_questions, so the two routes can't drift.
    domains = await _load_domains(session)
    domain = domains[question.domain_id]
    tag_map = await _load_tag_value_map(session)
    traits_by_question = await _load_leadership_traits(session, [question.id], tag_map)
    tags = _tags_for_question(question, tag_map, traits_by_question)

    # 200 either way, never 403 — the paywall is a conversion surface, not an error.
    # `product_ids` is resolved once and reused for every entitlement check below,
    # rather than each one re-resolving it in its own round trip.
    product_ids = await resolve_product_ids(user_id=uuid.UUID(user_id), session=session) if user_id else set()
    granted_question_ids = await resolve_granted_content_ids(
        product_ids=product_ids, resource_type=ResourceType.QUESTION, session=session
    )
    is_entitled = question.id in granted_question_ids
    
    # The related-template card is a direct buy surface, resolved via product_contents.
    related_result = await session.execute(
        select(Product)
        .join(ProductContent, ProductContent.product_id == Product.id)
        .where(
            ProductContent.content_type == ResourceType.QUESTION.value,
            ProductContent.content_id == question.id,
            Product.published.is_(True),
        )
        # Cheapest first — more than one product can grant the same question, and the
        # frontend's buy card reads related_content[0].
        .order_by(Product.price_amount)
    )
    related_content = [
        RelatedProductOut(slug=p.slug, name=p.name, price_amount=p.price_amount, currency=p.currency)
        for p in related_result.scalars().all()
    ]

    # Curated relations first; falling back to same-domain questions so the section is
    # never empty purely for lack of admin data entry. Capped at 3 either way.
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
        _question_summary(rq, domains, tag_map, related_traits_by_question)
        for rq in related_questions_rows
    ]

    # Lesson(s) this question leads into, each with its own entitlement check.
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
    related_lesson_rows = related_lesson_result.all()

    # Which product unlocks each lesson — one batched query, cheapest product wins.
    unlock_by_lesson: dict[uuid.UUID, Product] = {}
    if related_lesson_rows:
        unlock_result = await session.execute(
            select(ProductContent.content_id, Product)
            .join(Product, Product.id == ProductContent.product_id)
            .where(
                ProductContent.content_type == ResourceType.LESSON.value,
                ProductContent.content_id.in_([lesson.id for lesson, _, _ in related_lesson_rows]),
                Product.published.is_(True),
            )
            .order_by(Product.price_amount.desc())  # desc + overwrite => cheapest wins
        )
        for lesson_id, product in unlock_result.all():
            unlock_by_lesson[lesson_id] = product

    # One bulk ownership check for every related lesson, rather than one `has_access_to`
    # round trip per lesson.
    granted_lesson_ids = (
        await resolve_granted_content_ids(
            product_ids=product_ids, resource_type=ResourceType.LESSON, session=session
        )
        if related_lesson_rows
        else set()
    )

    related_lessons = []
    for lesson, module, course in related_lesson_rows:
        owned = lesson.id in granted_lesson_ids
        unlock_product = unlock_by_lesson.get(lesson.id)
        related_lessons.append(
            RelatedLessonOut(
                course_slug=course.slug,
                course_title=course.title,
                lesson_slug=lesson.slug,
                lesson_title=lesson.title,
                lesson_type=lesson.lesson_type,
                owned=owned,
                unlock_product_slug=unlock_product.slug if unlock_product else None,
                unlock_product_name=unlock_product.name if unlock_product else None,
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
