from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from app.db.session import get_session
from app.db.models import Template
from app.core.deps import get_current_user_id
from app.core.entitlements import ResourceType, has_access_to
from app.integrations.storage_client import generate_presigned_url
import uuid

router = APIRouter()

class DownloadUrlOut(BaseModel):
    download_url: str
    file_name: str
    file_size_bytes: int

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
