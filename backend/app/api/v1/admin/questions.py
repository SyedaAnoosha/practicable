"""Admin CRUD for the reference library — the 100-question catalogue."""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_admin
from app.db.models import Domain, Question, QuestionLeadershipTrait, TagValue, User
from app.db.session import get_session

from .common import PublishStateIn, apply_publish_state_or_422, ensure_unique_slug, get_or_404, record_audit, slugify

router = APIRouter()

# The six single-select tag dimensions, mapped to their column on `questions`.
SINGLE_SELECT_DIMENSIONS: dict[str, str] = {
    "effort": "effort_tag_id",
    "duration": "duration_tag_id",
    "cost": "cost_tag_id",
    "roi_horizon": "roi_horizon_tag_id",
    "tier": "tier_tag_id",
    "regulator_pressure": "regulator_pressure_tag_id",
}
# The seventh dimension is multi-select and lives in its own join table.
MULTI_SELECT_DIMENSION = "leadership_traits"


class QuestionWriteIn(BaseModel):
    """One shape for create and update. Everything except title/body/domain is optional
    so a half-finished draft can still be saved."""
    title: str = Field(min_length=1, max_length=500)
    body: str = Field(min_length=1)
    domain_id: uuid.UUID
    subtitle: Optional[str] = Field(default=None, max_length=500)
    # 160 is the DB column width, not a style preference — see questions.preview.
    preview: Optional[str] = Field(default=None, max_length=160)
    # {dimension: tag_value_id} for the six single-select dimensions.
    tags: dict[str, uuid.UUID] = Field(default_factory=dict)
    leadership_trait_ids: list[uuid.UUID] = Field(default_factory=list)


class QuestionRowOut(BaseModel):
    id: str
    slug: str
    title: str
    subtitle: Optional[str]
    domain: str
    published: bool
    publish_state: str
    featured: bool
    featured_sort: Optional[int]
    # In the list so an editor can spot rows still carrying a machine-derived preview.
    preview: str


class QuestionDetailOut(QuestionRowOut):
    body: str
    domain_id: str
    tags: dict[str, str]
    leadership_trait_ids: list[str]


class QuestionListOut(BaseModel):
    items: list[QuestionRowOut]
    total: int


class TagOptionOut(BaseModel):
    id: str
    value: str
    display_label: str
    sort_order: int


class DomainOptionOut(BaseModel):
    id: str
    name: str


class FormOptionsOut(BaseModel):
    """Everything the question form needs to render its dropdowns, in one request —
    all tag values regardless of use, which the public endpoint never returns."""
    domains: list[DomainOptionOut]
    tag_dimensions: dict[str, list[TagOptionOut]]


@router.get("/admin/questions/form-options", response_model=FormOptionsOut)
async def get_form_options(session: AsyncSession = Depends(get_session)):
    domains = (await session.execute(select(Domain).order_by(Domain.name))).scalars().all()
    tags = (
        (await session.execute(select(TagValue).order_by(TagValue.tag_dimension, TagValue.sort_order)))
        .scalars()
        .all()
    )
    by_dimension: dict[str, list[TagOptionOut]] = {}
    for tag in tags:
        by_dimension.setdefault(tag.tag_dimension, []).append(
            TagOptionOut(
                id=str(tag.id), value=tag.value,
                display_label=tag.display_label, sort_order=tag.sort_order,
            )
        )
    return FormOptionsOut(
        domains=[DomainOptionOut(id=str(d.id), name=d.name) for d in domains],
        tag_dimensions=by_dimension,
    )


@router.get("/admin/questions", response_model=QuestionListOut)
async def list_questions(
    session: AsyncSession = Depends(get_session),
    search: Optional[str] = None,
    published: Optional[bool] = None,
    featured: Optional[bool] = None,
    limit: int = Query(default=50, le=200),
    offset: int = 0,
):
    """Paginated and searchable, unlike the public catalogue which returns everything.
    `total` is a separate COUNT so the UI can show "showing 50 of 100" truthfully.

    `?featured=true` sorts by `featured_sort` (nulls last) instead of title — the
    `FeaturedToggle` summary calls this to show "4 questions featured, in this order"
    with the actual homepage order, not an alphabetical one."""
    conditions = []
    if search:
        pattern = f"%{search}%"
        conditions.append(or_(Question.title.ilike(pattern), Question.subtitle.ilike(pattern)))
    if published is not None:
        conditions.append(Question.published.is_(published))
    if featured is not None:
        conditions.append(Question.featured.is_(featured))

    total = (
        await session.execute(select(func.count()).select_from(Question).where(*conditions))
    ).scalar_one()

    order_by = (
        (Question.featured_sort.is_(None), Question.featured_sort, Question.title)
        if featured
        else (Question.title,)
    )
    rows = (
        await session.execute(
            select(Question, Domain)
            .join(Domain, Domain.id == Question.domain_id)
            .where(*conditions)
            .order_by(*order_by)
            .limit(limit)
            .offset(offset)
        )
    ).all()

    return QuestionListOut(
        total=total,
        items=[
            QuestionRowOut(
                id=str(q.id), slug=q.slug, title=q.title, subtitle=q.subtitle,
                domain=d.name, published=q.published, publish_state=q.publish_state.value,
                featured=q.featured, featured_sort=q.featured_sort, preview=q.preview,
            )
            for q, d in rows
        ],
    )


@router.get("/admin/questions/{question_id}", response_model=QuestionDetailOut)
async def get_question(question_id: uuid.UUID, session: AsyncSession = Depends(get_session)):
    question = await get_or_404(session, Question, question_id, "Question")
    domain = await session.get(Domain, question.domain_id)

    tags = {
        dimension: str(getattr(question, column))
        for dimension, column in SINGLE_SELECT_DIMENSIONS.items()
        if getattr(question, column) is not None
    }
    trait_ids = (
        (
            await session.execute(
                select(QuestionLeadershipTrait.trait_tag_id).where(
                    QuestionLeadershipTrait.question_id == question.id
                )
            )
        )
        .scalars()
        .all()
    )

    return QuestionDetailOut(
        id=str(question.id), slug=question.slug, title=question.title,
        subtitle=question.subtitle, body=question.body, preview=question.preview,
        domain=domain.name if domain else "", domain_id=str(question.domain_id),
        published=question.published, publish_state=question.publish_state.value,
        featured=question.featured, featured_sort=question.featured_sort, tags=tags,
        leadership_trait_ids=[str(t) for t in trait_ids],
    )


async def _validate_tags(session: AsyncSession, payload: QuestionWriteIn) -> None:
    """Reject a tag id that isn't real, or that belongs to the wrong dimension. The FK
    only proves the id exists — it would accept a duration value in `effort_tag_id`."""
    requested = list(payload.tags.items()) + [
        (MULTI_SELECT_DIMENSION, tid) for tid in payload.leadership_trait_ids
    ]
    if not requested:
        return
    found = {
        t.id: t
        for t in (
            await session.execute(select(TagValue).where(TagValue.id.in_([tid for _, tid in requested])))
        )
        .scalars()
        .all()
    }
    for dimension, tag_id in requested:
        tag = found.get(tag_id)
        if tag is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"error": {"code": "unknown_tag", "message": f"Tag {tag_id} does not exist."}},
            )
        if tag.tag_dimension != dimension:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "error": {
                        "code": "wrong_dimension",
                        "message": (
                            f"'{tag.display_label}' is a {tag.tag_dimension} value and "
                            f"cannot be used as {dimension}."
                        ),
                    }
                },
            )
    if payload.tags:
        unknown = set(payload.tags) - set(SINGLE_SELECT_DIMENSIONS)
        if unknown:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "error": {
                        "code": "unknown_dimension",
                        "message": f"Not a single-select tag dimension: {', '.join(sorted(unknown))}.",
                    }
                },
            )


async def _apply_tags(session: AsyncSession, question: Question, payload: QuestionWriteIn) -> None:
    for dimension, column in SINGLE_SELECT_DIMENSIONS.items():
        setattr(question, column, payload.tags.get(dimension))
    # Replace rather than diff — small set, and it can't leave a stale row behind.
    await session.execute(
        delete(QuestionLeadershipTrait).where(QuestionLeadershipTrait.question_id == question.id)
    )
    for trait_id in payload.leadership_trait_ids:
        session.add(QuestionLeadershipTrait(question_id=question.id, trait_tag_id=trait_id))


def _derive_preview(payload: QuestionWriteIn) -> str:
    """Use the editor's preview if given; otherwise cut the body at a sentence boundary.
    160 is a hard ceiling in every branch — the column is varchar(160)."""
    if payload.preview:
        return payload.preview[:160]
    body = payload.body.strip()
    if len(body) <= 160:
        return body
    cut = body.rfind(". ", 0, 155)
    if cut != -1:
        return body[: cut + 1].strip()
    return body[:159].rstrip() + "…"


@router.post("/admin/questions", response_model=QuestionDetailOut, status_code=status.HTTP_201_CREATED)
async def create_question(
    payload: QuestionWriteIn,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(require_admin),
):
    await _validate_tags(session, payload)
    await get_or_404(session, Domain, payload.domain_id, "Domain")

    question = Question(
        slug=await ensure_unique_slug(session, Question, slugify(payload.title)),
        title=payload.title,
        subtitle=payload.subtitle,
        body=payload.body,
        preview=_derive_preview(payload),
        domain_id=payload.domain_id,
        published=False,  # never live on create — see the package docstring
    )
    session.add(question)
    await session.flush()  # assigns question.id, needed by the trait rows below
    await _apply_tags(session, question, payload)
    await record_audit(
        session, actor=admin, action="create_question", target_type="question",
        target_id=question.id, context={"title": question.title, "slug": question.slug},
    )
    await session.commit()
    return await get_question(question.id, session)


@router.put("/admin/questions/{question_id}", response_model=QuestionDetailOut)
async def update_question(
    question_id: uuid.UUID,
    payload: QuestionWriteIn,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(require_admin),
):
    question = await get_or_404(session, Question, question_id, "Question")
    await _validate_tags(session, payload)
    await get_or_404(session, Domain, payload.domain_id, "Domain")

    # Slugs are set once, at creation: a retitle must not break already-shared URLs,
    # since there are no redirects.
    question.title = payload.title
    question.subtitle = payload.subtitle
    question.body = payload.body
    question.preview = _derive_preview(payload)
    question.domain_id = payload.domain_id
    await _apply_tags(session, question, payload)
    await record_audit(
        session, actor=admin, action="update_question", target_type="question",
        target_id=question.id, context={"title": question.title},
    )
    await session.commit()
    return await get_question(question_id, session)


@router.post("/admin/questions/{question_id}/publish", response_model=QuestionDetailOut)
async def set_published(
    question_id: uuid.UUID,
    payload: PublishStateIn,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(require_admin),
):
    """Publish/unpublish, or move through the fuller draft/in_review/published/archived
    cycle (migration 012). Separate from update so the audit trail distinguishes a
    wording edit from a state change."""
    question = await get_or_404(session, Question, question_id, "Question")
    was_state = question.publish_state.value
    was = question.published
    new_state = apply_publish_state_or_422(question, payload)
    await record_audit(
        session, actor=admin,
        action="publish_question" if payload.published else "unpublish_question",
        target_type="question", target_id=question.id,
        context={"from": was, "to": payload.published, "state_from": was_state, "state_to": new_state.value},
    )
    await session.commit()
    return await get_question(question_id, session)


class FeaturedIn(BaseModel):
    featured: bool
    # Required when featuring, ignored when unfeaturing — see the handler.
    featured_sort: Optional[int] = None


@router.post("/admin/questions/{question_id}/featured", response_model=QuestionDetailOut)
async def set_featured(
    question_id: uuid.UUID,
    payload: FeaturedIn,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(require_admin),
):
    """The homepage's curated picks (week3_plan.md §20.6). Unfeaturing always clears
    `featured_sort` — a stale sort value on an unfeatured row is a landmine for whoever
    features it again later and inherits an order they never chose."""
    question = await get_or_404(session, Question, question_id, "Question")
    was = {"featured": question.featured, "featured_sort": question.featured_sort}
    question.featured = payload.featured
    question.featured_sort = payload.featured_sort if payload.featured else None
    await record_audit(
        session, actor=admin, action="feature_question" if payload.featured else "unfeature_question",
        target_type="question", target_id=question.id,
        context={"from": was, "to": {"featured": question.featured, "featured_sort": question.featured_sort}},
    )
    await session.commit()
    return await get_question(question_id, session)
