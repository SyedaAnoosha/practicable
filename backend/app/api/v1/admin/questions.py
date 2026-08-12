"""Admin CRUD for the reference library — the 100-question catalogue.

Product spec §8: "As an admin, I want to add a new question, course, or template — tag
it, attach a video or file, and publish — without writing code."
"""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_admin
from app.db.models import Domain, Question, QuestionLeadershipTrait, TagValue, User
from app.db.session import get_session

from .common import ensure_unique_slug, get_or_404, record_audit, slugify

router = APIRouter()

# The six single-select tag dimensions, mapped to their column on `questions`. Kept as
# one table rather than six near-identical blocks: adding a seventh single-select
# dimension later means one line here plus the column, not another copy-paste branch.
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
    """One shape for create and update. Every field except title/body/domain is
    optional so a half-finished draft can still be saved — an editor who has to fill
    all seven tags before the first save will lose work."""
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
    # Surfaced in the list so an editor can see at a glance which rows still carry a
    # machine-derived preview (docs/handover.md's known gap) without opening each one.
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
    """Everything the question form needs to render its dropdowns, in one request.
    The editor is a form, not a catalogue — it needs all tag values regardless of use,
    which the public /questions endpoint deliberately never returns."""
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
    limit: int = Query(default=50, le=200),
    offset: int = 0,
):
    """Paginated and searchable, unlike the public catalogue which returns everything.

    With 100 questions today and no ceiling by design, an admin list that returns the
    whole table would repeat the N+1-scale mistake this codebase already hit once on
    GET /questions. `total` is a separate COUNT so the UI can show "showing 50 of 100"
    truthfully rather than inferring it from a short page.
    """
    conditions = []
    if search:
        pattern = f"%{search}%"
        conditions.append(or_(Question.title.ilike(pattern), Question.subtitle.ilike(pattern)))
    if published is not None:
        conditions.append(Question.published.is_(published))

    total = (
        await session.execute(select(func.count()).select_from(Question).where(*conditions))
    ).scalar_one()

    rows = (
        await session.execute(
            select(Question, Domain)
            .join(Domain, Domain.id == Question.domain_id)
            .where(*conditions)
            .order_by(Question.title)
            .limit(limit)
            .offset(offset)
        )
    ).all()

    return QuestionListOut(
        total=total,
        items=[
            QuestionRowOut(
                id=str(q.id), slug=q.slug, title=q.title, subtitle=q.subtitle,
                domain=d.name, published=q.published, preview=q.preview,
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
        published=question.published, tags=tags,
        leadership_trait_ids=[str(t) for t in trait_ids],
    )


async def _validate_tags(session: AsyncSession, payload: QuestionWriteIn) -> None:
    """Reject a tag id that isn't real, or that belongs to the wrong dimension.

    The FK alone only proves the id exists in `tag_values` — it would happily accept
    a *duration* value stored in `effort_tag_id`, which then renders as nonsense on
    the public page and silently corrupts the filter counts. Dimension is the part
    the database cannot check, so it's checked here.
    """
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
    # Replace rather than diff: the trait set is small and a full replace can't leave
    # a stale row behind the way an incremental add/remove can if it misses a case.
    await session.execute(
        delete(QuestionLeadershipTrait).where(QuestionLeadershipTrait.question_id == question.id)
    )
    for trait_id in payload.leadership_trait_ids:
        session.add(QuestionLeadershipTrait(question_id=question.id, trait_tag_id=trait_id))


def _derive_preview(payload: QuestionWriteIn) -> str:
    """Use the editor's preview if given; otherwise cut the body at a sentence boundary.

    160 is a hard ceiling in every branch — the column is varchar(160), and an earlier
    version of this logic searched for a sentence boundary *past* the limit and blew up
    the seed with StringDataRightTruncationError.
    """
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

    # The slug deliberately does NOT follow a retitle. Question URLs are the product's
    # shareable surface (DESIGN.md §21) and may already be linked from an email or a
    # colleague's message; silently changing one to match an edited title breaks those
    # links with no redirect. Slugs are set once, at creation.
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


class PublishIn(BaseModel):
    published: bool


@router.post("/admin/questions/{question_id}/publish", response_model=QuestionDetailOut)
async def set_published(
    question_id: uuid.UUID,
    payload: PublishIn,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(require_admin),
):
    """Publish/unpublish. Separate from update so the audit trail distinguishes "an
    admin edited the wording" from "an admin took this off the site" — the second is
    the one worth being able to answer questions about later."""
    question = await get_or_404(session, Question, question_id, "Question")
    was = question.published
    question.published = payload.published
    await record_audit(
        session, actor=admin,
        action="publish_question" if payload.published else "unpublish_question",
        target_type="question", target_id=question.id,
        context={"from": was, "to": payload.published},
    )
    await session.commit()
    return await get_question(question_id, session)
