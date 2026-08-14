import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Course, Lesson, Module, Product, ProductContent, Question, Template
from app.db.session import get_session

router = APIRouter()


class ProductContentOut(BaseModel):
    content_type: str
    label: str
    # The destination route for this content, computed here rather than guessed per
    # content_type in the frontend, so each type's route lives in one place.
    href: str | None = None


class ProductOut(BaseModel):
    id: str
    slug: str
    name: str
    description: str
    price_amount: int
    currency: str
    contents: list[ProductContentOut]


async def _resolve_contents(product: Product, session: AsyncSession) -> list[ProductContentOut]:
    """Label and route every item a product contains.

    Extracted so the list and detail routes below return byte-identical content rows.
    Each type's route is computed here, once, rather than guessed from `content_type` in
    the frontend.
    """
    contents_result = await session.execute(
        select(ProductContent).where(ProductContent.product_id == product.id)
    )
    contents: list[ProductContentOut] = []
    for pc in contents_result.scalars().all():
        label = None
        href = None
        if pc.content_type == "template":
            r = await session.execute(select(Template.title).where(Template.id == pc.content_id))
            label = r.scalar_one_or_none()
            href = f"/templates/{pc.content_id}"
        elif pc.content_type == "lesson":
            r = await session.execute(select(Lesson).where(Lesson.id == pc.content_id))
            lesson = r.scalar_one_or_none()
            label = lesson.title if lesson else None
            # The full learning interface lives at /learn/:courseSlug/:lessonSlug; the
            # bare /lessons/:id player is only a fallback for an orphaned lesson.
            href = f"/lessons/{pc.content_id}"
            if lesson and lesson.module_id:
                module_r = await session.execute(select(Module).where(Module.id == lesson.module_id))
                module = module_r.scalar_one_or_none()
                if module:
                    course_r = await session.execute(select(Course.slug).where(Course.id == module.course_id))
                    course_slug = course_r.scalar_one_or_none()
                    if course_slug:
                        href = f"/learn/{course_slug}/{lesson.slug}"
        elif pc.content_type == "question_set":
            r = await session.execute(select(Question).where(Question.id == pc.content_id))
            question = r.scalar_one_or_none()
            label = question.title if question else None
            # Questions are public, so they route by slug under MarketingLayout.
            href = f"/questions/{question.slug}" if question else None
        contents.append(ProductContentOut(content_type=pc.content_type, label=label or pc.content_type, href=href))

    return contents


def _to_out(product: Product, contents: list[ProductContentOut]) -> ProductOut:
    return ProductOut(
        id=str(product.id),
        slug=product.slug,
        name=product.name,
        description=product.description,
        price_amount=product.price_amount,
        currency=product.currency,
        contents=contents,
    )


@router.get("/products", response_model=list[ProductOut])
async def list_products(session: AsyncSession = Depends(get_session)):
    """Every published product, newest first — public, like the detail route.

    This exists so no surface has to name a product by slug to show one. The dashboard
    previously hardcoded `risk-register-template`, which stopped being published: the
    request 404'd and the card's CTA led nowhere, with nothing in the UI to indicate the
    product had simply gone away. A list answers "what is actually for sale right now"
    and returns an empty array when the answer is nothing, which a consumer can render
    honestly. A hardcoded slug can only 404.

    `published` is the filter, so unpublishing something removes it from every surface
    at once rather than leaving a dead card behind on whichever page named it.
    """
    result = await session.execute(
        select(Product).where(Product.published.is_(True)).order_by(Product.created_at.desc())
    )
    products = result.scalars().all()
    return [_to_out(p, await _resolve_contents(p, session)) for p in products]


@router.get("/products/{slug}", response_model=ProductOut)
async def get_product(slug: str, session: AsyncSession = Depends(get_session)):
    """Public product detail — the pre-checkout summary (DESIGN.md §29.1). No
    entitlement check here: browsing what a product contains, before buying it, is
    exactly what this endpoint is for."""
    result = await session.execute(select(Product).where(Product.slug == slug))
    product = result.scalar_one_or_none()
    if not product or not product.published:
        raise HTTPException(status_code=404, detail="Product not found")

    return _to_out(product, await _resolve_contents(product, session))
