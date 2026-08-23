"""Notes endpoints for W5-R5.

PUT    /me/notes/{lesson_id}  — upsert (one note per lesson, edited in place)
GET    /me/notes              — list all notes for the current user
DELETE /me/notes/{lesson_id}  — delete a note
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.models import Lesson, UserNote
from app.db.session import get_session
from app.db.models import User

router = APIRouter(prefix="/me/notes", tags=["notes"])


class NoteUpserRequest(BaseModel):
    body: str = Field(..., min_length=1, max_length=5000)


class NoteOut(BaseModel):
    id: str
    lesson_id: str
    body: str
    created_at: str
    updated_at: str


@router.put("/{lesson_id}", response_model=NoteOut)
async def upsert_note(
    lesson_id: str,
    req: NoteUpserRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Upsert a note for a lesson. One note per lesson per learner — a second
    PUT replaces the body in place, keeping the same row."""
    lid = uuid.UUID(lesson_id)

    # Validate the lesson exists
    from app.db.models import Lesson
    lesson = await session.get(Lesson, lid)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    # Check for existing note
    result = await session.execute(
        select(UserNote).where(
            UserNote.user_id == user.id,
            UserNote.lesson_id == lid,
        )
    )
    note = result.scalar_one_or_none()

    if note:
        note.body = req.body
    else:
        note = UserNote(user_id=user.id, lesson_id=lid, body=req.body)
        session.add(note)

    # `get_session` never commits: without this the note is silently lost, which for an
    # autosaving panel means the learner watches "Saved" appear over work that isn't.
    # The refresh also populates the created_at/updated_at server defaults read below.
    await session.commit()
    await session.refresh(note)

    return NoteOut(
        id=str(note.id),
        lesson_id=str(note.lesson_id),
        body=note.body,
        created_at=note.created_at.isoformat() if note.created_at else "",
        updated_at=note.updated_at.isoformat() if note.updated_at else "",
    )


@router.get("", response_model=list[NoteOut])
async def list_notes(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """All notes for the current user, newest first."""
    result = await session.execute(
        select(UserNote)
        .where(UserNote.user_id == user.id)
        .order_by(UserNote.updated_at.desc())
    )
    notes = result.scalars().all()
    return [
        NoteOut(
            id=str(n.id),
            lesson_id=str(n.lesson_id),
            body=n.body,
            created_at=n.created_at.isoformat() if n.created_at else "",
            updated_at=n.updated_at.isoformat() if n.updated_at else "",
        )
        for n in notes
    ]


@router.delete("/{lesson_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note(
    lesson_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Delete a note for a lesson."""
    lid = uuid.UUID(lesson_id)
    result = await session.execute(
        select(UserNote).where(
            UserNote.user_id == user.id,
            UserNote.lesson_id == lid,
        )
    )
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    await session.delete(note)
    # See upsert_note: the endpoint owns the commit, or the note reappears on reload.
    await session.commit()
