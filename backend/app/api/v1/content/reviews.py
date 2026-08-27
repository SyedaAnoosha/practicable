"""Review submission endpoint.

POST /reviews — submit a review for content the user has purchased.
Entitlement-gated through ``has_access_to``; body stripped to plain text.
Reviews are born approved (the entitlement gate is the safeguard); moderation
is reactive via the admin delete endpoint.
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
from app.core.html_sanitizer import strip_tags
from app.db.models import Course, Lesson, Module, Product, ProductContent, Review, ReviewState, Template, User
from app.db.session import get_session

router = APIRouter()


# Below this many approved reviews an item ships `rating: null` and the card renders
# no rating element at all (not "no reviews yet", which reads worse than silence).
# The threshold lives here rather than only in the client because a rating the
# backend sends and the frontend hides is still a rating on the wire: any other
# consumer would show it, and the number would leak through the API to anyone
# reading it directly. `frontend/src/lib/reviews.ts` mirrors this value for its own
# rendering decision; if one moves, move both.
MIN_REVIEWS_FOR_AGGREGATE = 8


# Which model carries the denormalised `review_count`/`rating_sum` for each content
# type. Defined here rather than in admin/reviews.py because both the submission path
# (which now approves on write, and so must increment) and the admin moderation path
# adjust the same counters — one map, so the two cannot drift onto different models.
_COUNTER_MODEL = {
    "course": Course,
    "template": Template,
    "pack": Product,
}


def aggregate_rating(review_count: Optional[int], rating_sum: Optional[int]) -> Optional[float]:
    """The aggregate rating for one item, or None below MIN_REVIEWS_FOR_AGGREGATE.

    Lives here rather than in each catalogue endpoint because the gate is a product
    rule, not a per-endpoint one: courses, templates and packs must all hide the
    average at the same review count, and three copies of `>= MIN_REVIEWS...` would
    be three places for it to drift. `rating_sum` is an integer sum, so the average
    is computed on read and never accumulates the drift a stored float would.
    """
    count = review_count or 0
    if count < MIN_REVIEWS_FOR_AGGREGATE:
        return None
    return round((rating_sum or 0) / count, 1)


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
    below MIN_REVIEWS_FOR_AGGREGATE.

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
    rating = aggregate_rating(count, content.rating_sum)

    return ContentRatingOut(
        content_type=content_type,
        content_id=str(cid),
        rating=rating,
        review_count=count,
    )


@router.get("/reviews/featured", response_model=list[FeaturedReviewOut])
async def get_featured_reviews(
    content_type: Optional[str] = None,
    content_id: Optional[str] = None,
    limit: int = 5,
    session: AsyncSession = Depends(get_session),
):
    """Public, unauthenticated. Approved, featured reviews.

    With `content_type` + `content_id`, returns that item's testimonials — what the
    content detail pages ask for.

    Both are optional. Omitting them returns featured reviews across the whole
    catalogue, which is what the landing page's testimonial section needs: hard-coding
    some course's id there would break the section the day that course was unpublished.

    `is_featured` remains the gate in both modes. Reviews are approved on submission
    now, so "approved" alone is no longer a curation signal — featuring is the
    deliberate act that puts a quote on the marketing surface.
    """
    conditions = [
        Review.state == ReviewState.APPROVED.value,
        Review.is_featured.is_(True),
        Review.body.isnot(None),
    ]

    if content_type:
        conditions.append(Review.content_type == content_type)

    if content_id:
        # A non-UUID content_id is a caller error, not a server error. This was a bare
        # `uuid.UUID(content_id)` and raised ValueError straight out of the handler as a
        # 500 the moment a page passed a slug (PackDetail did exactly that). The sibling
        # rating endpoint above already returns 404 for the same input; this matches it,
        # because a public endpoint must not 500 on a malformed path from any caller.
        try:
            cid = uuid.UUID(content_id)
        except ValueError:
            raise HTTPException(status_code=404, detail="Content not found")
        conditions.append(Review.content_id == cid)

    result = await session.execute(
        select(Review)
        .where(*conditions)
        .order_by(Review.created_at.desc())
        # Clamped: `limit` is a public query parameter, and an unbounded one lets any
        # caller ask for the entire review table in a single request.
        .limit(max(1, min(limit, 24)))
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
    """Submit a review for purchased content.

    The review is published immediately: only a buyer can review, so moderation is
    reactive — an admin deletes a bad review — rather than a queue every honest
    review waits behind.

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

    # 3. Sanitise body — strip tags to PLAIN TEXT, do not sanitise as rich HTML.
    #
    # A review is a plain-text field with no editor behind it. `sanitize_html` would
    # promote plain text to `<p>` paragraphs that then show as literal tags. `strip_tags`
    # also flattens any markup in a hostile body, so nothing can be injected through
    # this field whichever way it is later rendered.
    body = strip_tags(req.body).strip() if req.body else None
    # A body of nothing but markup strips to an empty string; store NULL rather than ""
    # so "has a written review" stays a single check for every reader of this column.
    body = body or None

    # 4. Derive display_name if not provided
    display_name = req.display_name
    if not display_name and user.name:
        parts = user.name.strip().split()
        if len(parts) >= 2:
            display_name = f"{parts[0]} {parts[-1][0]}."
        else:
            display_name = parts[0] if parts else None

    # 5. Insert — UNIQUE constraint catches duplicates
    #
    # Reviews are born APPROVED rather than PENDING. The entitlement gate above makes
    # that safe: only someone who bought the item can review it, so this is not an open
    # comment box. Moderation is reactive — an admin removes a bad review.
    review = Review(
        user_id=user.id,
        content_type=req.content_type,
        content_id=content_id,
        rating=req.rating,
        body=body,
        display_name=display_name,
        state=ReviewState.APPROVED,
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

    # The denormalised counters used to be advanced only by the admin moderation
    # endpoint, on the pending→approved transition. Now that a review is approved on
    # write that transition never happens, so the increment has to happen here — without
    # it `review_count`/`rating_sum` would stay at zero forever and every card would sit
    # below MIN_REVIEWS_FOR_AGGREGATE showing no rating at all.
    #
    # Same transaction as the insert, so a review and the counters it contributes to can
    # never disagree.
    counter_model = _COUNTER_MODEL.get(req.content_type)
    if counter_model:
        content = await session.get(counter_model, content_id)
        if content:
            content.review_count = (content.review_count or 0) + 1
            content.rating_sum = (content.rating_sum or 0) + req.rating

    # `get_session` never commits, so a flushed-but-uncommitted review is discarded when
    # the session closes: the submitter gets a 201 and nothing is stored.
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
