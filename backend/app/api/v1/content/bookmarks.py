"""Bookmarks endpoints for W5-R5.

POST   /me/bookmarks         — add a bookmark
DELETE /me/bookmarks/{id}    — remove a bookmark
GET    /me/bookmarks         — list all bookmarks
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.models import Bookmark, Course, Product, Template, User
from app.db.session import get_session

router = APIRouter(prefix="/me/bookmarks", tags=["bookmarks"])


class BookmarkCreateRequest(BaseModel):
    content_type: str = Field(..., pattern=r"^(course|template|pack)$")
    content_id: str


class BookmarkOut(BaseModel):
    id: str
    content_type: str
    content_id: str
    created_at: str
    # Resolved by the list endpoint so a saved-items view can render a real link.
    # Optional because create/delete return before any lookup, and because an item
    # can be deleted after it was saved - see `list_bookmarks`.
    title: str | None = None
    slug: str | None = None
    available: bool = True


@router.post("", response_model=BookmarkOut, status_code=status.HTTP_201_CREATED)
async def add_bookmark(
    req: BookmarkCreateRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Add a bookmark. UNIQUE constraint catches duplicates → 409."""
    cid = uuid.UUID(req.content_id)

    bookmark = Bookmark(
        user_id=user.id,
        content_type=req.content_type,
        content_id=cid,
    )
    session.add(bookmark)
    try:
        await session.flush()
    except IntegrityError:
        # IntegrityError specifically, not bare Exception: only a constraint violation
        # means "already bookmarked". Catching everything turned a missing-column error
        # into a 409, so a learner's FIRST bookmark reported as a duplicate and the real
        # fault stayed hidden behind a plausible-looking message.
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": {"code": "already_bookmarked", "message": "This item is already bookmarked."}},
        )

    # `get_session` never commits — without this the bookmark vanishes on reload.
    # The refresh populates the created_at server default read below.
    await session.commit()
    await session.refresh(bookmark)

    return BookmarkOut(
        id=str(bookmark.id),
        content_type=bookmark.content_type,
        content_id=str(bookmark.content_id),
        created_at=bookmark.created_at.isoformat() if bookmark.created_at else "",
    )


@router.delete("/{bookmark_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_bookmark(
    bookmark_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Remove a bookmark. 404 if not found or belongs to another user."""
    bid = uuid.UUID(bookmark_id)
    result = await session.execute(
        select(Bookmark).where(
            Bookmark.id == bid,
            Bookmark.user_id == user.id,
        )
    )
    bookmark = result.scalar_one_or_none()
    if not bookmark:
        raise HTTPException(status_code=404, detail="Bookmark not found")
    await session.delete(bookmark)
    # See add_bookmark: the endpoint owns the commit.
    await session.commit()


@router.get("", response_model=list[BookmarkOut])
async def list_bookmarks(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """All bookmarks for the current user, newest first.

    Each row is resolved to the item's title and slug. The bookmarks table stores
    only `(content_type, content_id)`, which is enough for the toggle button to know
    what is saved but not enough to *show* someone their saved items — a list of bare
    UUIDs is not a list. Resolving here rather than in the client keeps it to one
    round trip and one place where a deleted item is handled.

    Three queries at most, one per content type, regardless of how many bookmarks
    exist: the ids are grouped and each group fetched with a single `IN`. The naive
    shape - a lookup per row - is what turns a page of 40 saved items into 40 queries.
    """
    result = await session.execute(
        select(Bookmark)
        .where(Bookmark.user_id == user.id)
        .order_by(Bookmark.created_at.desc())
    )
    bookmarks = list(result.scalars().all())
    if not bookmarks:
        return []

    # Group the ids by type so each table is hit once.
    by_type: dict[str, set[uuid.UUID]] = {}
    for b in bookmarks:
        by_type.setdefault(b.content_type, set()).add(b.content_id)

    # `pack` is a Product; the others are their own tables. `title` for courses and
    # templates, `name` for products - the column differs, the meaning does not.
    _SOURCES = {
        "course": (Course, Course.title),
        "template": (Template, Template.title),
        "pack": (Product, Product.name),
    }

    resolved: dict[tuple[str, uuid.UUID], tuple[str, str, bool]] = {}
    for content_type, ids in by_type.items():
        source = _SOURCES.get(content_type)
        if not source:
            continue
        model, title_col = source
        rows = await session.execute(
            select(model.id, title_col, model.slug, model.published).where(model.id.in_(ids))
        )
        for row_id, title, slug, published in rows:
            resolved[(content_type, row_id)] = (title, slug, published)

    out: list[BookmarkOut] = []
    for b in bookmarks:
        found = resolved.get((b.content_type, b.content_id))
        # An item can be unpublished or deleted after it was saved. The bookmark row
        # is kept either way - silently dropping it would make items vanish from the
        # list with no explanation - but it is flagged so the client can render it as
        # unavailable rather than as a link that 404s.
        title, slug, available = found if found else (None, None, False)
        out.append(
            BookmarkOut(
                id=str(b.id),
                content_type=b.content_type,
                content_id=str(b.content_id),
                created_at=b.created_at.isoformat() if b.created_at else "",
                title=title,
                slug=slug,
                available=available,
            )
        )
    return out
