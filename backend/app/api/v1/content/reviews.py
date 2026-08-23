"""Review submission endpoint (W5-R4).

POST /reviews — submit a review for content the user has purchased.
Entitlement-gated through ``has_access_to``. Body sanitised through
``html_sanitizer``. ``state = pending`` on write, always — there is
no path by which a submission is born approved.
"""
from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.core.entitlements import ResourceType, has_access_to
from app.core.html_sanitizer import sanitize_html
from app.db.models import Course, Lesson, Module, Product, ProductContent, Review, ReviewState, Template, User
from app.db.session import get_session

router = APIRouter()


# week5_plan.md §2.4 / §4.6 — the Stage B gate, and this is its authority.
#
# Below this many approved reviews an item ships `rating: null` and the card renders
# no rating element at all (not "no reviews yet", which reads worse than silence).
# The threshold lives here rather than only in the client because a rating the
# backend sends and the frontend hides is still a rating on the wire: any other
# consumer would show it, and the number would leak through the API to anyone
# reading it directly. `frontend/src/lib/reviews.ts` mirrors this value for its own
# rendering decision; if one moves, move both.
MIN_REVIEWS_FOR_AGGREGATE = 8


class FeaturedReviewOut(BaseModel):
    id: str
    rating: int
    body: Optional[str] = None
    display_name: Optional[str] = None
    is_featured: bool
    created_at: str


class ContentRatingOut(BaseModel):
    """The aggregate for one content item, gated by MIN_REVIEWS_FOR_AGGREGATE.

    `rating` is null below the threshold — deliberately indistinguishable from
    "no reviews at all", because at low volume the two should look the same to a
    visitor. `review_count` is always the true count so an admin-facing or
    editorial consumer can still tell how close an item is to the gate.
    """

    content_type: str
    content_id: str
    rating: Optional[float] = None
    review_count: int


# The three content types that carry denormalised counters. Kept in step with
# `_COUNTER_MODEL` in api/v1/admin/reviews.py, which does the writing this reads.
_COUNTER_MODEL = {
    "course": Course,
    "template": Template,
    "pack": Product,
}


@router.get("/reviews/rating", response_model=ContentRatingOut)
async def get_content_rating(
    content_type: str,
    content_id: str,
    session: AsyncSession = Depends(get_session),
):
    """Public, unauthenticated. The aggregate rating for one content item, or null
    below the Stage B threshold (§2.4).

    Reads the denormalised `review_count` / `rating_sum` columns rather than
    aggregating `reviews` — a COUNT/AVG per card is the N+1 shape those columns
    exist to avoid. `rating_sum` is an integer sum, so the average is computed here
    on read and never accumulates the drift a stored float would.
    """
    model = _COUNTER_MODEL.get(content_type)
    if model is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "unknown_content_type",
                    "message": f"Unknown content type: {content_type}",
                }
            },
        )

    try:
        cid = uuid.UUID(content_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Content not found")

    content = await session.get(model, cid)
    if content is None:
        raise HTTPException(status_code=404, detail="Content not found")

    count = content.review_count or 0
    total = content.rating_sum or 0

    rating: Optional[float] = None
    if count >= MIN_REVIEWS_FOR_AGGREGATE and count > 0:
        rating = round(total / count, 1)

    return ContentRatingOut(
        content_type=content_type,
        content_id=str(cid),
        rating=rating,
        review_count=count,
    )


@router.get("/reviews/featured", response_model=list[FeaturedReviewOut])
async def get_featured_reviews(
    content_type: str,
    content_id: str,
    session: AsyncSession = Depends(get_session),
):
    """Public, unauthenticated. Returns approved, featured reviews for a content item.
    Used by content detail pages to render testimonials (W5-R4 Stage A)."""
    cid = uuid.UUID(content_id)
    result = await session.execute(
        select(Review)
        .where(
            Review.content_type == content_type,
            Review.content_id == cid,
            Review.state == ReviewState.APPROVED.value,
            Review.is_featured.is_(True),
            Review.body.isnot(None),
        )
        .order_by(Review.created_at.desc())
        .limit(5)
    )
    reviews = result.scalars().all()
    return [
        FeaturedReviewOut(
            id=str(r.id),
            rating=r.rating,
            body=r.body,
            display_name=r.display_name,
            is_featured=r.is_featured,
            created_at=r.created_at.isoformat() if r.created_at else "",
        )
        for r in reviews
    ]

from app.db.models import Course, Lesson, Module, Product, ProductContent, Review, ReviewState, Template, User

# Map content_type strings to ResourceType for the entitlement gate
_TYPE_MAP = {
    "template": ResourceType.TEMPLATE,
    "pack": ResourceType.TEMPLATE,   # A pack's template is the access path
}

# Map content_type strings to the model class for validation
_MODEL_MAP = {
    "course": Course,
    "template": Template,
    "pack": Product,
}


class ReviewSubmitRequest(BaseModel):
    content_type: str = Field(..., pattern=r"^(course|template|pack)$")
    content_id: str
    rating: int = Field(..., ge=1, le=5)
    body: Optional[str] = Field(None, max_length=2000)
    display_name: Optional[str] = Field(None, max_length=120)


class ReviewOut(BaseModel):
    id: str
    content_type: str
    content_id: str
    rating: int
    body: Optional[str] = None
    display_name: Optional[str] = None
    state: str
    is_featured: bool
    created_at: str


@router.post("/reviews", response_model=ReviewOut, status_code=status.HTTP_201_CREATED)
async def submit_review(
    req: ReviewSubmitRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Submit a review for purchased content. The review is created in ``pending``
    state and invisible to the public until an admin approves it.

    One review per user per content item, enforced by a UNIQUE constraint.
    A duplicate submission returns 409.
    """
    content_id = uuid.UUID(req.content_id)

    # 1. Validate the content exists
    model = _MODEL_MAP[req.content_type]
    content = await session.get(model, content_id)
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")

    # 2. Entitlement gate — the same check used everywhere else.
    #    For courses, we check if ANY lesson in the course is granted (the user
    #    owns the course via its lessons, not via a course-level ProductContent row).
    entitled = False
    if req.content_type == "course":
        # Find lessons in this course and check if any is granted
        lesson_ids = (
            await session.execute(
                select(Lesson.id)
                .join(Module, Module.id == Lesson.module_id)
                .where(Module.course_id == content_id)
            )
        ).scalars().all()
        if lesson_ids:
            for lid in lesson_ids:
                if await has_access_to(user_id=user.id, resource_type=ResourceType.LESSON, resource_id=lid, session=session):
                    entitled = True
                    break
    else:
        resource_type = _TYPE_MAP[req.content_type]
        entitled = await has_access_to(user_id=user.id, resource_type=resource_type, resource_id=content_id, session=session)

    if not entitled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "not_entitled", "message": "You must purchase this content to leave a review."}},
        )

    # 3. Sanitise body
    body = sanitize_html(req.body) if req.body else None

    # 4. Derive display_name if not provided
    display_name = req.display_name
    if not display_name and user.name:
        parts = user.name.strip().split()
        if len(parts) >= 2:
            display_name = f"{parts[0]} {parts[-1][0]}."
        else:
            display_name = parts[0] if parts else None

    # 5. Insert — UNIQUE constraint catches duplicates
    review = Review(
        user_id=user.id,
        content_type=req.content_type,
        content_id=content_id,
        rating=req.rating,
        body=body,
        display_name=display_name,
        state=ReviewState.PENDING,
    )
    session.add(review)
    try:
        await session.flush()
    except IntegrityError:
        # IntegrityError specifically, not bare Exception: only a constraint violation
        # means "already reviewed". A broad catch here would report any insert failure —
        # a missing column, a bad type — as a duplicate, which is exactly how the same
        # bug in bookmarks.py stayed hidden behind a plausible message.
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": {"code": "already_reviewed", "message": "You have already reviewed this item."}},
        )

    # `get_session` never commits, so a flushed-but-uncommitted review is discarded when
    # the session closes: the submitter gets a 201 and the moderation queue stays empty.
    # The commit also populates the `created_at` server default that the response reads.
    await session.commit()
    await session.refresh(review)

    return ReviewOut(
        id=str(review.id),
        content_type=review.content_type,
        content_id=str(review.content_id),
        rating=review.rating,
        body=review.body,
        display_name=review.display_name,
        state=review.state,
        is_featured=review.is_featured,
        created_at=review.created_at.isoformat() if review.created_at else "",
    )
