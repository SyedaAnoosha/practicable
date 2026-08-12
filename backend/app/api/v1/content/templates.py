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
    # The free lead-magnet template (product spec §9). When true, `product` is None and
    # `owned` is meaningless — there is nothing to own. The card shows an email capture
    # instead of a price.
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
    """The template catalogue — public, like /questions and /courses. Each template
    carries the product that sells it (if any) so the card can show a real price
    without a second round trip, same pattern as questions.py's related_content."""
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
            # Cheapest first, and the ordering is load-bearing rather than cosmetic:
            # since the template/course split (db/seed/012) a template is granted by
            # BOTH the standalone template product and the course that contains it, so
            # an unordered .first() would sometimes price the template card at the
            # course's A$49. The card must always quote the cheapest way to get this
            # file — DESIGN.md §23.2's "never overstate what something costs".
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
                # A free template never advertises a product, even if one somehow
                # points at it — "free" and "A$29" on the same card is the kind of
                # contradiction a visitor reads as a pricing bug.
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
    """One template, public. Added so the download page can tell a visitor what they
    are about to get (and whether it's free) without pulling the whole catalogue and
    filtering client-side."""
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
    # Optional, not required — a free template must be downloadable by a visitor with
    # no account at all (product spec §9: "at least one free template that captures an
    # email"). Paid templates still 401 below when this is None.
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

    # The free lead magnet: no entitlement, no account, no check. `is_free` is an
    # explicit product decision (migration 007), so this branch cannot be reached by a
    # template that merely hasn't been priced yet. The email capture that fronts this
    # in the UI is a conversion device, not a boundary — it is deliberately NOT
    # enforced here, because a server-side check on an unverified email would be
    # security theatre: anyone can type any address. Free means free.
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
