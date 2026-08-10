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

class QuestionPreviewOut(BaseModel):
    id: str
    slug: str
    title: str
    subtitle: Optional[str]
    preview: str
    domain: str
    tags: List[TagOut]
    gated: bool
    related_content: List[RelatedProductOut]

class QuestionFullOut(BaseModel):
    id: str
    slug: str
    title: str
    subtitle: Optional[str]
    preview: str
    body: str
    domain: str
    tags: List[TagOut]
    gated: bool
    related_content: List[RelatedProductOut]

@router.get("/questions/{slug}", response_model=QuestionPreviewOut | QuestionFullOut)
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

    base_data = {
        "id": str(question.id),
        "slug": question.slug,
        "title": question.title,
        "subtitle": question.subtitle,
        "preview": question.preview,
        "domain": domain.name,
        "tags": tags,
        "gated": not is_entitled,
        "related_content": related_content,
    }
    
    if is_entitled:
        return QuestionFullOut(**base_data, body=question.body)
    else:
        return QuestionPreviewOut(**base_data)
