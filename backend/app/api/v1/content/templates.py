"""Public template catalogue, detail, and presigned download routes."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from app.db.session import get_session
from app.db.models import Product, ProductContent, Template
from app.core.deps import get_current_user_id, get_current_user_id_optional
from app.core.entitlements import ResourceType, has_access_to
from app.integrations.storage_client import generate_presigned_url
import uuid

router = APIRouter()

class ProductRefOut(BaseModel):
    slug: str
    name: str
    price_amount: int
    currency: str

class TemplateSummaryOut(BaseModel):
    id: str
    slug: str
    title: str
    description: str
    file_name: str
    owned: bool
    product: Optional[ProductRefOut]
    # When true, `product` is None and `owned` is meaningless — the card shows an email
    # capture instead of a price.
    is_free: bool

class DownloadUrlOut(BaseModel):
    download_url: str
    file_name: str
    file_size_bytes: int

@router.get("/templates", response_model=list[TemplateSummaryOut])
async def list_templates(
    session: AsyncSession = Depends(get_session),
    user_id: Optional[str] = Depends(get_current_user_id_optional),
):
    """The template catalogue — public. Each template carries the product that sells it,
    so the card can show a real price without a second round trip."""
    result = await session.execute(select(Template).where(Template.published.is_(True)).order_by(Template.created_at))
    templates = result.scalars().all()

    out: list[TemplateSummaryOut] = []
    for t in templates:
        owned = False
        if user_id:
            owned = await has_access_to(
                user_id=uuid.UUID(user_id), resource_type=ResourceType.TEMPLATE, resource_id=t.id, session=session
            )

        product_result = await session.execute(
            select(Product)
            .join(ProductContent, ProductContent.product_id == Product.id)
            .where(
                ProductContent.content_type == ResourceType.TEMPLATE.value,
                ProductContent.content_id == t.id,
                Product.published.is_(True),
            )
            # Cheapest first, and load-bearing: a template is granted by both the
            # standalone product and the course containing it, so an unordered .first()
            # would sometimes quote the course price for the template card.
            .order_by(Product.price_amount)
        )
        product = product_result.scalars().first()
        product_out = (
            ProductRefOut(slug=product.slug, name=product.name, price_amount=product.price_amount, currency=product.currency)
            if product
            else None
        )

        out.append(
            TemplateSummaryOut(
                id=str(t.id), slug=t.slug, title=t.title, description=t.description,
                file_name=t.file_name, owned=owned,
                # A free template never advertises a price, even if a product points at it.
                product=None if t.is_free else product_out,
                is_free=t.is_free,
            )
        )
    return out

@router.get("/templates/{template_id}", response_model=TemplateSummaryOut)
async def get_template(
    template_id: str,
    session: AsyncSession = Depends(get_session),
    user_id: Optional[str] = Depends(get_current_user_id_optional),
):
    """One template, public — lets the download page show what a visitor is about to get
    without pulling the whole catalogue."""
    template = (
        await session.execute(select(Template).where(Template.id == uuid.UUID(template_id)))
    ).scalar_one_or_none()
    if not template or not template.published:
        raise HTTPException(status_code=404, detail="Template not found")

    owned = False
    if user_id:
        owned = await has_access_to(
            user_id=uuid.UUID(user_id), resource_type=ResourceType.TEMPLATE,
            resource_id=template.id, session=session,
        )

    product_out = None
    if not template.is_free:
        product = (
            await session.execute(
                select(Product)
                .join(ProductContent, ProductContent.product_id == Product.id)
                .where(
                    ProductContent.content_type == ResourceType.TEMPLATE.value,
                    ProductContent.content_id == template.id,
                    Product.published.is_(True),
                )
                .order_by(Product.price_amount)
            )
        ).scalars().first()
        if product:
            product_out = ProductRefOut(
                slug=product.slug, name=product.name,
                price_amount=product.price_amount, currency=product.currency,
            )

    return TemplateSummaryOut(
        id=str(template.id), slug=template.slug, title=template.title,
        description=template.description, file_name=template.file_name,
        owned=owned, product=product_out, is_free=template.is_free,
    )


@router.get("/templates/{template_id}/download-url", response_model=DownloadUrlOut)
async def get_template_download_url(
    template_id: str,
    session: AsyncSession = Depends(get_session),
    # Optional so a free template is downloadable with no account. Paid templates still
    # 401 below when this is None.
    user_id: Optional[str] = Depends(get_current_user_id_optional),
):
    """Get presigned Supabase Storage download URL for a template."""

    # Fetch template
    result = await session.execute(
        select(Template).where(Template.id == uuid.UUID(template_id))
    )
    template = result.scalar_one_or_none()

    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    # Free means free: no entitlement, no account, no check. The email capture fronting
    # this in the UI is a conversion device, not a boundary, so it isn't enforced here.
    if template.is_free:
        return DownloadUrlOut(
            download_url=generate_presigned_url(template.storage_key),
            file_name=template.file_name,
            file_size_bytes=template.file_size_bytes,
        )

    if user_id is None:
        raise HTTPException(
            status_code=401,
            detail={"error": {"code": "not_authenticated", "message": "Sign in to download this template."}},
        )

    # Checked before the URL is minted (BACKEND.md §4.1) — never mint-then-discard.
    entitled = await has_access_to(
        user_id=uuid.UUID(user_id),
        resource_type=ResourceType.TEMPLATE,
        resource_id=template.id,
        session=session,
    )
    if not entitled:
        raise HTTPException(
            status_code=403,
            detail={"error": {"code": "not_entitled", "message": "This template is part of a product you don't have yet."}},
        )

    # Generate presigned URL
    download_url = generate_presigned_url(template.storage_key)
    
    return DownloadUrlOut(
        download_url=download_url,
        file_name=template.file_name,
        file_size_bytes=template.file_size_bytes,
    )
