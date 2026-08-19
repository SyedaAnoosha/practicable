"""Public template catalogue, detail, and presigned download routes."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from app.db.session import get_session
from app.db.models import Product, ProductContent, Template, User
from app.core.deps import get_current_user_id_optional, get_current_user_optional
from app.core.entitlements import (
    ResourceType,
    has_access_to,
    has_access_to_or_admin,
    resolve_granted_content_ids,
    resolve_product_ids,
)
from app.integrations.posthog_client import capture_download_failed
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
    so the card can show a real price without a second round trip.

    `[FIXED]` This used to spend two round trips per template — a full `has_access_to`
    call (itself 2 queries) plus a product lookup — run serially for every row. Each
    round trip to Postgres here costs on the order of hundreds of ms, so a catalogue of
    a dozen templates could take seconds. Below, ownership and pricing are each
    resolved in one bulk query for the whole catalogue.
    """
    result = await session.execute(select(Template).where(Template.published.is_(True)).order_by(Template.created_at))
    templates = list(result.scalars().all())
    if not templates:
        return []

    template_ids = [t.id for t in templates]

    granted_template_ids: set = set()
    if user_id:
        product_ids = await resolve_product_ids(user_id=uuid.UUID(user_id), session=session)
        granted_template_ids = await resolve_granted_content_ids(
            product_ids=product_ids, resource_type=ResourceType.TEMPLATE, session=session
        )

    # Cheapest product per template, resolved once for every template rather than once
    # per template — load-bearing ordering preserved: a template can be granted by both
    # a standalone product and the course containing it, so the cheapest must win.
    cheapest_product_by_template: dict = {}
    product_result = await session.execute(
        select(ProductContent.content_id, Product)
        .join(Product, Product.id == ProductContent.product_id)
        .where(
            ProductContent.content_type == ResourceType.TEMPLATE.value,
            ProductContent.content_id.in_(template_ids),
            Product.published.is_(True),
        )
        .order_by(Product.price_amount.desc())  # desc + overwrite => cheapest wins, same trick as questions.py
    )
    for content_id, product in product_result.all():
        cheapest_product_by_template[content_id] = product

    out: list[TemplateSummaryOut] = []
    for t in templates:
        owned = t.id in granted_template_ids
        product = cheapest_product_by_template.get(t.id)
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
    # 401 below when this is None. The full User (not just the id) so an admin without
    # the entitlement gets the audited bypass rather than a plain 403 — see
    # `has_access_to_or_admin`; this route called `has_access_to` directly before
    # 2026-08-13, which had no concept of role at all.
    user: Optional[User] = Depends(get_current_user_optional),
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
        try:
            download_url = generate_presigned_url(template.storage_key)
        except Exception as e:
            capture_download_failed(
                user_id=str(user.id) if user else "anonymous",
                resource_type="template", resource_id=str(template.id), reason=str(e),
            )
            raise
        return DownloadUrlOut(download_url=download_url, file_name=template.file_name, file_size_bytes=template.file_size_bytes)

    if user is None:
        raise HTTPException(
            status_code=401,
            detail={"error": {"code": "not_authenticated", "message": "Sign in to download this template."}},
        )

    # Checked before the URL is minted (BACKEND.md §4.1) — never mint-then-discard.
    entitled = await has_access_to_or_admin(
        user=user,
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
    try:
        download_url = generate_presigned_url(template.storage_key)
    except Exception as e:
        capture_download_failed(
            user_id=str(user.id), resource_type="template", resource_id=str(template.id), reason=str(e),
        )
        raise

    return DownloadUrlOut(
        download_url=download_url,
        file_name=template.file_name,
        file_size_bytes=template.file_size_bytes,
    )
