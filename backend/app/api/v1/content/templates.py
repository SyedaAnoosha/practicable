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
                file_name=t.file_name, owned=owned, product=product_out,
            )
        )
    return out

@router.get("/templates/{template_id}/download-url", response_model=DownloadUrlOut)
async def get_template_download_url(
    template_id: str,
    session: AsyncSession = Depends(get_session),
    user_id: str = Depends(get_current_user_id),
):
    """Get presigned Supabase Storage download URL for a template."""
    
    # Fetch template
    result = await session.execute(
        select(Template).where(Template.id == uuid.UUID(template_id))
    )
    template = result.scalar_one_or_none()
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
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
