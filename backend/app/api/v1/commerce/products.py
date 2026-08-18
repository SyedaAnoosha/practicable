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


async def _resolve_contents_bulk(
    products: list[Product], session: AsyncSession
) -> dict[str, list[ProductContentOut]]:
    """Label and route every item every given product contains, in a fixed number of
    queries regardless of how many products or contents there are.

    Extracted so the list and detail routes below return byte-identical content rows.
    Each type's route is computed here, once, rather than guessed from `content_type` in
    the frontend.

    `[FIXED]` This used to be a per-product, per-content-row loop of awaited queries —
    one round trip to look up the row, plus (for a lesson) up to two more to walk
    module → course for the /learn href. Each round trip to Postgres here costs on the
    order of hundreds of ms, so a product with a handful of contents cost multiple
    seconds; `list_products` made that worse by repeating the whole thing per product,
    serially. This resolves every type in one bulk query each, then assembles every
    product's content list from in-memory maps — no query count that scales with the
    catalogue's size.
    """
    if not products:
        return {}

    product_ids = [p.id for p in products]
    contents_result = await session.execute(
        select(ProductContent).where(ProductContent.product_id.in_(product_ids))
    )
    all_contents = list(contents_result.scalars().all())

    template_ids = [pc.content_id for pc in all_contents if pc.content_type == "template"]
    lesson_ids = [pc.content_id for pc in all_contents if pc.content_type == "lesson"]
    question_ids = [pc.content_id for pc in all_contents if pc.content_type == "question_set"]

    template_titles: dict = {}
    if template_ids:
        r = await session.execute(select(Template.id, Template.title).where(Template.id.in_(template_ids)))
        template_titles = dict(r.all())

    lessons_by_id: dict = {}
    if lesson_ids:
        r = await session.execute(select(Lesson).where(Lesson.id.in_(lesson_ids)))
        lessons_by_id = {lesson.id: lesson for lesson in r.scalars().all()}

    module_ids = [l.module_id for l in lessons_by_id.values() if l.module_id]
    modules_by_id: dict = {}
    if module_ids:
        r = await session.execute(select(Module).where(Module.id.in_(module_ids)))
        modules_by_id = {m.id: m for m in r.scalars().all()}

    course_ids = [m.course_id for m in modules_by_id.values()]
    course_slugs_by_id: dict = {}
    if course_ids:
        r = await session.execute(select(Course.id, Course.slug).where(Course.id.in_(course_ids)))
        course_slugs_by_id = dict(r.all())

    questions_by_id: dict = {}
    if question_ids:
        r = await session.execute(select(Question).where(Question.id.in_(question_ids)))
        questions_by_id = {q.id: q for q in r.scalars().all()}

    contents_by_product: dict[str, list[ProductContentOut]] = {str(p.id): [] for p in products}
    for pc in all_contents:
        label = None
        href = None
        if pc.content_type == "template":
            label = template_titles.get(pc.content_id)
            href = f"/templates/{pc.content_id}"
        elif pc.content_type == "lesson":
            lesson = lessons_by_id.get(pc.content_id)
            label = lesson.title if lesson else None
            # The full learning interface lives at /learn/:courseSlug/:lessonSlug; the
            # bare /lessons/:id player is only a fallback for an orphaned lesson.
            href = f"/lessons/{pc.content_id}"
            if lesson and lesson.module_id:
                module = modules_by_id.get(lesson.module_id)
                course_slug = course_slugs_by_id.get(module.course_id) if module else None
                if course_slug:
                    href = f"/learn/{course_slug}/{lesson.slug}"
        elif pc.content_type == "question_set":
            question = questions_by_id.get(pc.content_id)
            label = question.title if question else None
            # Questions are public, so they route by slug under MarketingLayout.
            href = f"/questions/{question.slug}" if question else None
        contents_by_product[str(pc.product_id)].append(
            ProductContentOut(content_type=pc.content_type, label=label or pc.content_type, href=href)
        )

    return contents_by_product


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
    products = list(result.scalars().all())
    contents_by_product = await _resolve_contents_bulk(products, session)
    return [_to_out(p, contents_by_product[str(p.id)]) for p in products]


@router.get("/products/{slug}", response_model=ProductOut)
async def get_product(slug: str, session: AsyncSession = Depends(get_session)):
    """Public product detail — the pre-checkout summary (DESIGN.md §29.1). No
    entitlement check here: browsing what a product contains, before buying it, is
    exactly what this endpoint is for."""
    result = await session.execute(select(Product).where(Product.slug == slug))
    product = result.scalar_one_or_none()
    if not product or not product.published:
        raise HTTPException(status_code=404, detail="Product not found")

    contents_by_product = await _resolve_contents_bulk([product], session)
    return _to_out(product, contents_by_product[str(product.id)])
