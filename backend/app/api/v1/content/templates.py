"""Public template catalogue, detail, and presigned download routes."""
import asyncio

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from app.api.v1.content.reviews import aggregate_rating
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
from app.integrations.storage_client import download_file, generate_presigned_url, upload_file
from app.services.download_events import record_download_event
from app.services.stamping import get_or_stamp, is_stampable
from app.services.link_rate_limit import check_and_record as check_link_rate
from app.services.template_evidence import PreviewOut, format_line, resolve_previews
import uuid

router = APIRouter()

class ProductRefOut(BaseModel):
    slug: str
    name: str
    price_amount: int
    currency: str

from datetime import datetime

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
    # Evidence layer
    page_count: Optional[int] = None
    sheet_count: Optional[int] = None
    is_editable: Optional[bool] = None
    has_macros: bool = False
    min_office_version: Optional[str] = None
    # Resolved {url, alt} pairs — never a raw Storage key (BACKEND.md §4.1).
    previews: list[PreviewOut] = []
    version: Optional[str] = None
    last_reviewed_at: Optional[datetime] = None
    # ".xlsx · 1 file" — read off the real uploaded file, never typed per product.
    format: Optional[str] = None
    # Null below MIN_REVIEWS_FOR_AGGREGATE; served from the row's own denormalised
    # counters so a catalogue stays one query.
    rating: Optional[float] = None
    review_count: int = 0

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

    Ownership and pricing are each resolved in one bulk query for the whole
    catalogue.
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
                page_count=t.page_count,
                sheet_count=t.sheet_count,
                is_editable=t.is_editable,
                has_macros=t.has_macros,
                min_office_version=t.min_office_version,
                previews=resolve_previews(t.preview_image_keys),
                version=t.version,
                last_reviewed_at=t.last_reviewed_at,
                format=format_line(t.file_name) if t.storage_key else None,
                rating=aggregate_rating(t.review_count, t.rating_sum),
                review_count=t.review_count or 0,
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
    without pulling the whole catalogue.

    Accepts either the id or the slug. The id branch is tried only when the value
    parses as a UUID; the slug branch handles everything else, so a wrong identifier
    is a 404 rather than a 500 from `uuid.UUID()` raising.
    """
    try:
        lookup = Template.id == uuid.UUID(template_id)
    except ValueError:
        lookup = Template.slug == template_id

    template = (await session.execute(select(Template).where(lookup))).scalar_one_or_none()
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
        page_count=template.page_count,
        sheet_count=template.sheet_count,
        is_editable=template.is_editable,
        has_macros=template.has_macros,
        min_office_version=template.min_office_version,
        previews=resolve_previews(template.preview_image_keys),
        version=template.version,
        last_reviewed_at=template.last_reviewed_at,
        format=format_line(template.file_name) if template.storage_key else None,
        rating=aggregate_rating(template.review_count, template.rating_sum),
        review_count=template.review_count or 0,
    )


@router.get("/templates/{template_id}/download-url", response_model=DownloadUrlOut)
async def get_template_download_url(
    template_id: str,
    session: AsyncSession = Depends(get_session),
    # Optional so a free template is downloadable with no account. Paid templates still
    # 401 below when this is None. The full User (not just the id) so an admin without
    # the entitlement gets the audited bypass rather than a plain 403 — see
    # `has_access_to_or_admin`.
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
        download_url = generate_presigned_url(template.storage_key)
        await record_download_event(session=session, content_type="template", content_id=template.id, content_slug=template.slug)
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

    # Soft rate-limit on link minting. Logs, never blocks.
    check_link_rate(str(user.id), str(template.id))

    # Stamp paid downloads with buyer info.
    # Free templates are never stamped (rule 3); unstampable types served unchanged (rule 2).
    if is_stampable(template.file_name):
        original_bytes = await asyncio.to_thread(download_file, template.storage_key)
        if original_bytes:
            # Find licence tier from the product that grants this template
            product_result = await session.execute(
                select(Product).join(ProductContent).where(
                    ProductContent.content_id == template.id,
                    ProductContent.content_type == "template",
                )
            )
            product = product_result.scalar_one_or_none()
            licence_tier = product.licence if product else "standard"

            stamped_bytes = await asyncio.to_thread(
                get_or_stamp,
                original_bytes,
                template_id=str(template.id),
                file_name=template.file_name,
                version=template.version,
                buyer_email=user.email,
                buyer_name=user.name or user.email,
                licence_tier=licence_tier,
                user_id=str(user.id),
            )
            # Upload stamped copy and return presigned URL to it
            ext = "." + template.file_name.rsplit(".", 1)[-1].lower() if "." in template.file_name else ""
            stamped_key = f"stamped/{template.id}/{template.version or 'unversioned'}/{user.id}{ext}"
            content_type_map = {
                ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                ".pdf": "application/pdf",
            }
            try:
                await asyncio.to_thread(
                    upload_file,
                    key=stamped_key,
                    body=stamped_bytes,
                    content_type=content_type_map.get(ext, "application/octet-stream"),
                )
                download_url = generate_presigned_url(stamped_key)
            except Exception:
                # Rule 1: stamping failure serves the original file
                download_url = generate_presigned_url(template.storage_key)
        else:
            download_url = generate_presigned_url(template.storage_key)
    else:
        download_url = generate_presigned_url(template.storage_key)

    await record_download_event(session=session, content_type="template", content_id=template.id, content_slug=template.slug)
    return DownloadUrlOut(
        download_url=download_url,
        file_name=template.file_name,
        file_size_bytes=template.file_size_bytes,
    )
