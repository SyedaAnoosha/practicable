"""Phase 9A (W4-R19): Admin CRUD for packs (reference packs and domain packs).

A pack is a Product whose product_contents include >= 1 `template` row and >= 1
`question_set` row. This module creates and manages such products, selecting which
templates and questions to include. The publish guard (content/packs.py) enforces
the >= 1 template + >= 1 question_set constraint at publish time.

Shares the price endpoint through `admin/products.py` — no new price path.
"""
import uuid
from typing import Optional, Sequence

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_admin
from app.core.constants import STRIPE_PRICE_UNSET
from app.core.publish_guard import check_stripe_price
from app.db.models import (
    Product,
    ProductContent,
    Question,
    Template,
    User,
)
from app.db.session import get_session
from app.integrations.stripe_client import create_price

from .common import PublishStateIn, apply_publish_state_or_422, ensure_unique_slug, get_or_404, record_audit, slugify

router = APIRouter()


class PackContentIn(BaseModel):
    content_type: str  # "template" or "question_set"
    content_id: uuid.UUID


class PackWriteIn(BaseModel):
    name: str = Field(min_length=1, max_length=500)
    description: str = Field(min_length=1)
    # Price in cents. Required on create; optional on update (omitted = keep current).
    price_amount: Optional[int] = Field(default=None, gt=0)
    currency: str = Field(min_length=3, max_length=3, default="AUD")
    # Content items to include — the full list replaces what's there.
    contents: list[PackContentIn] = Field(default_factory=list)


class PackContentOut(BaseModel):
    content_type: str
    content_id: str
    title: str


class PackOut(BaseModel):
    id: str
    slug: str
    name: str
    description: str
    price_amount: int
    currency: str
    stripe_price_id: Optional[str] = None
    published: bool
    publish_state: str
    is_bundle: bool
    template_count: int
    question_count: int
    contents: list[PackContentOut]
    # Readiness
    readiness: str
    readiness_message: str


async def _count_content_types(product_id: uuid.UUID, session: AsyncSession) -> dict[str, int]:
    # Found 2026-08-21 (Phase 9A re-verification): this was a plain `def` calling
    # `session.execute(...)` unawaited on an AsyncSession — every caller (list, create,
    # update, publish) got back a bare coroutine object and crashed with
    # `AttributeError: 'coroutine' object has no attribute 'all'` the moment it actually
    # ran. No existing test exercised /admin/packs create/list/publish, which is why
    # this had never been caught — the whole pack purchasability path was unreachable.
    result = await session.execute(
        select(ProductContent.content_type, func.count(ProductContent.id))
        .where(ProductContent.product_id == product_id)
        .group_by(ProductContent.content_type)
    )
    return {row[0]: row[1] for row in result.all()}


async def _resolve_content_titles(contents: Sequence[ProductContent], session) -> list[PackContentOut]:
    out = []
    for pc in contents:
        if pc.content_type == "template":
            title_result = await session.execute(
                select(Template.title).where(Template.id == pc.content_id)
            )
            title = title_result.scalar_one_or_none() or "Unknown template"
        elif pc.content_type == "question_set":
            title_result = await session.execute(
                select(Question.title).where(Question.id == pc.content_id)
            )
            title = title_result.scalar_one_or_none() or "Unknown question"
        else:
            title = pc.content_type
        out.append(PackContentOut(
            content_type=pc.content_type,
            content_id=str(pc.content_id),
            title=title,
        ))
    return out


async def _pack_to_out(product: Product, session: AsyncSession) -> PackOut:
    content_rows = (
        await session.execute(
            select(ProductContent).where(ProductContent.product_id == product.id)
        )
    ).scalars().all()

    counts = await _count_content_types(product.id, session)
    contents = await _resolve_content_titles(content_rows, session)

    template_count = counts.get("template", 0)
    question_count = counts.get("question_set", 0)

    # Readiness
    has_template = template_count >= 1
    has_questions = question_count >= 1
    has_price = (
        product.stripe_price_id
        and product.stripe_price_id != STRIPE_PRICE_UNSET
    )

    if not has_template:
        readiness = "no_template"
        readiness_message = "Needs at least 1 template (the PDF)"
    elif not has_questions:
        readiness = "no_questions"
        readiness_message = "Needs at least 1 question"
    elif not has_price:
        readiness = "price_unset"
        readiness_message = "Price not set in Stripe"
    elif not product.published:
        readiness = "unpublished"
        readiness_message = "Pack is unpublished"
    else:
        readiness = "ready"
        readiness_message = "Pack is published and ready"

    return PackOut(
        id=str(product.id),
        slug=product.slug,
        name=product.name,
        description=product.description,
        price_amount=product.price_amount,
        currency=product.currency,
        stripe_price_id=product.stripe_price_id,
        published=product.published,
        publish_state=product.publish_state.value,
        is_bundle=product.is_bundle,
        template_count=template_count,
        question_count=question_count,
        contents=contents,
        readiness=readiness,
        readiness_message=readiness_message,
    )


@router.get("/admin/packs", response_model=list[PackOut])
async def list_packs(session: AsyncSession = Depends(get_session)):
    """All products that have at least one template OR one question_set content item.
    This catches both published packs and ones being built."""
    template_product_ids = select(ProductContent.product_id).where(
        ProductContent.content_type == "template"
    )
    question_product_ids = select(ProductContent.product_id).where(
        ProductContent.content_type == "question_set"
    )
    result = await session.execute(
        select(Product).where(
            Product.id.in_(template_product_ids) | Product.id.in_(question_product_ids)
        ).order_by(Product.name)
    )
    products = result.scalars().all()
    return [await _pack_to_out(p, session) for p in products]


@router.post("/admin/packs", response_model=PackOut, status_code=status.HTTP_201_CREATED)
async def create_pack(
    payload: PackWriteIn,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(require_admin),
):
    """Create a new pack product. Price is required at creation."""
    if payload.price_amount is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": {"code": "price_required", "message": "A price is required when creating a pack."}},
        )

    # Validate contents
    template_count = sum(1 for c in payload.contents if c.content_type == "template")
    question_count = sum(1 for c in payload.contents if c.content_type == "question_set")
    if template_count < 1 or question_count < 1:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "insufficient_content",
                    "message": f"A pack needs at least 1 template and 1 question. Got {template_count} template(s) and {question_count} question(s).",
                }
            },
        )

    # Create Stripe Price
    try:
        stripe_price_id, stripe_product_id = create_price(
            unit_amount=payload.price_amount,
            currency=payload.currency,
            product_name=payload.name,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"error": {"code": "stripe_error", "message": str(e)}},
        )

    product = Product(
        slug=await ensure_unique_slug(session, Product, slugify(payload.name)),
        name=payload.name,
        description=payload.description,
        stripe_price_id=stripe_price_id,
        price_amount=payload.price_amount,
        currency=payload.currency,
        published=False,
        is_bundle=question_count > 1 or template_count > 1,
    )
    session.add(product)
    await session.flush()

    # Add contents
    for content in payload.contents:
        session.add(ProductContent(
            product_id=product.id,
            content_type=content.content_type,
            content_id=content.content_id,
        ))

    await record_audit(
        session, actor=admin, action="create_pack", target_type="product",
        target_id=product.id, context={
            "name": product.name,
            "price_amount": payload.price_amount,
            "template_count": template_count,
            "question_count": question_count,
        },
    )
    await session.commit()
    return await _pack_to_out(product, session)


@router.put("/admin/packs/{product_id}", response_model=PackOut)
async def update_pack(
    product_id: uuid.UUID,
    payload: PackWriteIn,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(require_admin),
):
    """Update a pack's name, description, and contents. Price is changed via
    POST /admin/products/{id}/price — not here, to keep the price-change
    audit trail in one place."""
    product = await get_or_404(session, Product, product_id, "Product")

    product.name = payload.name
    product.description = payload.description

    # Replace contents
    existing = (
        await session.execute(
            select(ProductContent).where(ProductContent.product_id == product.id)
        )
    ).scalars().all()
    for ec in existing:
        await session.delete(ec)

    for content in payload.contents:
        session.add(ProductContent(
            product_id=product.id,
            content_type=content.content_type,
            content_id=content.content_id,
        ))

    # Recalculate is_bundle
    template_count = sum(1 for c in payload.contents if c.content_type == "template")
    question_count = sum(1 for c in payload.contents if c.content_type == "question_set")
    product.is_bundle = question_count > 1 or template_count > 1

    await record_audit(
        session, actor=admin, action="update_pack", target_type="product",
        target_id=product.id, context={
            "name": product.name,
            "template_count": template_count,
            "question_count": question_count,
        },
    )
    await session.commit()
    return await _pack_to_out(product, session)


@router.post("/admin/packs/{product_id}/publish", response_model=PackOut)
async def set_pack_published(
    product_id: uuid.UUID,
    payload: PublishStateIn,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(require_admin),
):
    """Publish/unpublish a pack. Enforces >= 1 template + >= 1 question_set."""
    product = await get_or_404(session, Product, product_id, "Product")

    if payload.published:
        counts = await _count_content_types(product.id, session)
        if counts.get("template", 0) < 1:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"error": {"code": "no_template", "message": "A pack needs at least 1 template (the PDF)."}},
            )
        if counts.get("question_set", 0) < 1:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"error": {"code": "no_questions", "message": "A pack needs at least 1 question set."}},
            )
        # Price check
        price_check = check_stripe_price(
            stripe_price_id=product.stripe_price_id,
            price_amount=product.price_amount,
            currency=product.currency,
        )
        if not price_check.ok:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"error": {"code": "price_issue", "message": price_check.message}},
            )

    was = product.published
    was_state = product.publish_state.value
    new_state = apply_publish_state_or_422(product, payload)
    await record_audit(
        session, actor=admin,
        action="publish_pack" if payload.published else "unpublish_pack",
        target_type="product", target_id=product.id,
        context={"from": was, "to": payload.published, "state_from": was_state, "state_to": new_state.value},
    )
    await session.commit()
    return await _pack_to_out(product, session)


# ── Lookup endpoints for the content selectors ──────────────────────────────────


class ContentOption(BaseModel):
    id: str
    title: str
    subtitle: Optional[str] = None


@router.get("/admin/packs/available-templates", response_model=list[ContentOption])
async def list_available_templates(session: AsyncSession = Depends(get_session)):
    """All published templates the pack editor can select from."""
    result = await session.execute(
        select(Template).where(Template.published.is_(True)).order_by(Template.title)
    )
    return [
        ContentOption(id=str(t.id), title=t.title, subtitle=t.description[:80] if t.description else None)
        for t in result.scalars().all()
    ]


@router.get("/admin/packs/available-questions", response_model=list[ContentOption])
async def list_available_questions(session: AsyncSession = Depends(get_session)):
    """All published questions the pack editor can select from."""
    result = await session.execute(
        select(Question).where(Question.published.is_(True)).order_by(Question.title)
    )
    return [
        ContentOption(id=str(q.id), title=q.title)
        for q in result.scalars().all()
    ]
