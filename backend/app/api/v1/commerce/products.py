import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Lesson, Product, ProductContent, Question, Template
from app.db.session import get_session

router = APIRouter()


class ProductContentOut(BaseModel):
    content_type: str
    label: str


class ProductOut(BaseModel):
    id: str
    slug: str
    name: str
    description: str
    price_amount: int
    currency: str
    contents: list[ProductContentOut]


@router.get("/products/{slug}", response_model=ProductOut)
async def get_product(slug: str, session: AsyncSession = Depends(get_session)):
    """Public product detail — the pre-checkout summary (DESIGN.md §29.1). No
    entitlement check here: browsing what a product contains, before buying it, is
    exactly what this endpoint is for."""
    result = await session.execute(select(Product).where(Product.slug == slug))
    product = result.scalar_one_or_none()
    if not product or not product.published:
        raise HTTPException(status_code=404, detail="Product not found")

    contents_result = await session.execute(
        select(ProductContent).where(ProductContent.product_id == product.id)
    )
    contents: list[ProductContentOut] = []
    for pc in contents_result.scalars().all():
        label = None
        if pc.content_type == "template":
            r = await session.execute(select(Template.title).where(Template.id == pc.content_id))
            label = r.scalar_one_or_none()
        elif pc.content_type == "lesson":
            r = await session.execute(select(Lesson.title).where(Lesson.id == pc.content_id))
            label = r.scalar_one_or_none()
        elif pc.content_type == "question_set":
            r = await session.execute(select(Question.title).where(Question.id == pc.content_id))
            label = r.scalar_one_or_none()
        contents.append(ProductContentOut(content_type=pc.content_type, label=label or pc.content_type))

    return ProductOut(
        id=str(product.id),
        slug=product.slug,
        name=product.name,
        description=product.description,
        price_amount=product.price_amount,
        currency=product.currency,
        contents=contents,
    )
