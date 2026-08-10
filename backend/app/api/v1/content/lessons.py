from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from app.db.session import get_session
from app.db.models import Lesson, Media
from app.core.deps import get_current_user_id
from app.core.entitlements import ResourceType, has_access_to
from app.integrations.mux_client import generate_mux_playback_token
import uuid

router = APIRouter()

class PlaybackTokenOut(BaseModel):
    playback_id: str
    token: str

@router.get("/lessons/{lesson_id}/playback-token", response_model=PlaybackTokenOut)
async def get_playback_token(
    lesson_id: str,
    session: AsyncSession = Depends(get_session),
    user_id: str = Depends(get_current_user_id),
):
    """Get signed Mux playback token for a lesson."""
    
    # Fetch lesson
    result = await session.execute(
        select(Lesson).where(Lesson.id == uuid.UUID(lesson_id))
    )
    lesson = result.scalar_one_or_none()
    
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    
    # Fetch media
    media_result = await session.execute(
        select(Media).where(Media.lesson_id == lesson.id)
    )
    media = media_result.scalar_one_or_none()
    
    if not media or not media.mux_playback_id:
        raise HTTPException(status_code=404, detail="Video not ready")
    
    if media.status != "ready":
        raise HTTPException(status_code=400, detail="Video still processing")
    
    # The check runs BEFORE Mux is ever called (BACKEND.md §4.1) — a signed URL minted
    # and then discarded on a failed check is a signed URL that existed, and existing
    # is enough.
    entitled = await has_access_to(
        user_id=uuid.UUID(user_id),
        resource_type=ResourceType.LESSON,
        resource_id=lesson.id,
        session=session,
    )
    if not entitled:
        raise HTTPException(
            status_code=403,
            detail={"error": {"code": "not_entitled", "message": "This lesson is part of a course you don't have yet."}},
        )

    # Generate signed token
    token = generate_mux_playback_token(media.mux_playback_id)
    
    return PlaybackTokenOut(
        playback_id=media.mux_playback_id,
        token=token,
    )
