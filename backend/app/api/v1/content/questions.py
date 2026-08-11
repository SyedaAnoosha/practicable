from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional, List
from app.db.session import get_session
from app.db.models import Question, TagValue, Domain, QuestionLeadershipTrait, Product, ProductContent
from app.core.deps import get_current_user_id_optional
from app.core.entitlements import ResourceType, has_access_to
import uuid


class RelatedProductOut(BaseModel):
    slug: str
    name: str
    price_amount: int
    currency: str

router = APIRouter()

class TagOut(BaseModel):
    dimension: str
    value: str
    display_label: str

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

class QuestionSummaryOut(BaseModel):
    id: str
    slug: str
    title: str
    subtitle: Optional[str]
    preview: str
    domain: str
    tags: List[TagOut]


async def _fetch_tags(question: Question, session: AsyncSession) -> List[TagOut]:
    """Shared by the list and detail routes so the two never drift on how a tag row
    resolves into a dimension/value/display_label triple."""
    tags: List[TagOut] = []
    tag_fields = [
        ('effort', question.effort_tag_id),
        ('duration', question.duration_tag_id),
        ('cost', question.cost_tag_id),
        ('roi_horizon', question.roi_horizon_tag_id),
        ('tier', question.tier_tag_id),
        ('regulator_pressure', question.regulator_pressure_tag_id),
    ]
    for dimension, tag_id in tag_fields:
        if tag_id:
            tag_result = await session.execute(select(TagValue).where(TagValue.id == tag_id))
            tag = tag_result.scalar_one_or_none()
            if tag:
                tags.append(TagOut(dimension=dimension, value=tag.value, display_label=tag.display_label))

    traits_result = await session.execute(
        select(TagValue)
        .join(QuestionLeadershipTrait, TagValue.id == QuestionLeadershipTrait.trait_tag_id)
        .where(QuestionLeadershipTrait.question_id == question.id)
    )
    for trait in traits_result.scalars().all():
        tags.append(TagOut(dimension='leadership_traits', value=trait.value, display_label=trait.display_label))
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

    out: List[QuestionSummaryOut] = []
    for question in questions:
        domain = (await session.execute(select(Domain).where(Domain.id == question.domain_id))).scalar_one()
        tags = await _fetch_tags(question, session)
        out.append(
            QuestionSummaryOut(
                id=str(question.id), slug=question.slug, title=question.title, subtitle=question.subtitle,
                preview=question.preview, domain=domain.name, tags=tags,
            )
        )
    return out


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
    
    # Fetch domain
    domain_result = await session.execute(
        select(Domain).where(Domain.id == question.domain_id)
    )
    domain = domain_result.scalar_one()
    
    # Fetch tags
    tags = []
    tag_fields = [
        ('effort', question.effort_tag_id),
        ('duration', question.duration_tag_id),
        ('cost', question.cost_tag_id),
        ('roi_horizon', question.roi_horizon_tag_id),
        ('tier', question.tier_tag_id),
        ('regulator_pressure', question.regulator_pressure_tag_id),
    ]
    
    for dimension, tag_id in tag_fields:
        if tag_id:
            tag_result = await session.execute(
                select(TagValue).where(TagValue.id == tag_id)
            )
            tag = tag_result.scalar_one_or_none()
            if tag:
                tags.append(TagOut(
                    dimension=dimension,
                    value=tag.value,
                    display_label=tag.display_label,
                ))
    
    # Fetch leadership traits (multi-select)
    traits_result = await session.execute(
        select(TagValue)
        .join(QuestionLeadershipTrait, TagValue.id == QuestionLeadershipTrait.trait_tag_id)
        .where(QuestionLeadershipTrait.question_id == question.id)
    )
    traits = traits_result.scalars().all()
    for trait in traits:
        tags.append(TagOut(
            dimension='leadership_traits',
            value=trait.value,
            display_label=trait.display_label,
        ))
    
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
    )
