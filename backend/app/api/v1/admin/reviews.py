"""Admin reviews moderation endpoint.

GET    /admin/reviews          — list reviews (filterable by state)
PATCH  /admin/reviews/{id}     — approve/reject/feature a review
POST   /admin/reviews/{id}/moderate — transition state with counter update

Every transition writes an audit row AND adjusts ``review_count`` /
``rating_sum`` in the same transaction — the counter and the state
can never be committed apart.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.models import (
    Course,
    Product,
    Review,
    ReviewState,
    Template,
    User,
)
from app.db.session import get_session
from app.services.audit_service import record_audit

router = APIRouter()

# Map content_type to the model that carries denormalised counters
# Shared with the submission endpoint, which now also adjusts these counters (reviews
# are approved on write since 2026-08-25). Imported rather than redeclared so the two
# paths can never disagree about which model holds the counters.
from app.api.v1.content.reviews import _COUNTER_MODEL  # noqa: E402


class ReviewModerateRequest(BaseModel):
    state: str  # "approved" or "rejected"
    is_featured: Optional[bool] = None


class ReviewListOut(BaseModel):
    id: str
    user_id: str
    content_type: str
    content_id: str
    rating: int
    body: Optional[str] = None
    display_name: Optional[str] = None
    state: str
    is_featured: bool
    moderated_by: Optional[str] = None
    moderated_at: Optional[str] = None
    created_at: str


class ReviewModerateOut(BaseModel):
    id: str
    state: str
    is_featured: bool
    review_count: int
    rating_sum: int


async def _update_counters(
    session: AsyncSession,
    *,
    content_type: str,
    content_id,
    old_state: ReviewState,
    new_state: ReviewState,
    old_rating: int,
    new_rating: int,
) -> tuple[int, int]:
    """Adjust denormalised counters in the same transaction as the state change.

    Returns (review_count, rating_sum) after the update.
    """
    model = _COUNTER_MODEL.get(content_type)
    if not model:
        return 0, 0

    content = await session.get(model, content_id)
    if not content:
        return 0, 0

    # Delta for rating_sum: only approved reviews contribute
    delta = 0
    if new_state == ReviewState.APPROVED:
        delta += new_rating
    if old_state == ReviewState.APPROVED:
        delta -= old_rating

    # Delta for review_count: only approved reviews count
    count_delta = 0
    if new_state == ReviewState.APPROVED and old_state != ReviewState.APPROVED:
        count_delta = 1
    elif new_state != ReviewState.APPROVED and old_state == ReviewState.APPROVED:
        count_delta = -1

    content.review_count = max(0, content.review_count + count_delta)
    content.rating_sum = max(0, content.rating_sum + delta)

    return content.review_count, content.rating_sum


@router.get("/admin/reviews", response_model=list[ReviewListOut])
async def list_reviews(
    state: Optional[str] = Query(None, description="Filter by state: pending, approved, rejected"),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """List reviews for moderation. Newest first."""
    stmt = select(Review).order_by(Review.created_at.desc())
    if state:
        stmt = stmt.where(Review.state == state)
    result = await session.execute(stmt)
    reviews = result.scalars().all()
    return [
        ReviewListOut(
            id=str(r.id),
            user_id=str(r.user_id),
            content_type=r.content_type,
            content_id=str(r.content_id),
            rating=r.rating,
            body=r.body,
            display_name=r.display_name,
            state=r.state,
            is_featured=r.is_featured,
            moderated_by=r.moderated_by,
            moderated_at=r.moderated_at.isoformat() if r.moderated_at else None,
            created_at=r.created_at.isoformat() if r.created_at else "",
        )
        for r in reviews
    ]


@router.patch("/admin/reviews/{review_id}", response_model=ReviewModerateOut)
async def moderate_review(
    review_id: str,
    req: ReviewModerateRequest,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Moderate a review: approve, reject, or toggle featured status.

    Every transition writes an audit row AND updates denormalised counters
    in the same transaction.
    """
    import uuid

    review = await session.get(Review, uuid.UUID(review_id))
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    old_state = ReviewState(review.state)  # column is String, convert for _update_counters
    old_rating = review.rating

    # Parse new state
    try:
        new_state = ReviewState(req.state)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid state: {req.state}")

    # Update state — column is String(20), write the value not the enum member
    review.state = new_state.value
    review.moderated_by = user.email or str(user.id)
    review.moderated_at = datetime.now(timezone.utc)

    # Update featured if provided
    if req.is_featured is not None:
        review.is_featured = req.is_featured

    # Update counters in the same transaction
    review_count, rating_sum = await _update_counters(
        session,
        content_type=review.content_type,
        content_id=review.content_id,
        old_state=old_state,
        new_state=new_state,
        old_rating=old_rating,
        new_rating=review.rating,
    )

    # Write audit row
    await record_audit(
        session,
        actor=user,
        action=f"review_{new_state.value}",
        target_type="review",
        target_id=review.id,
        context={
            "content_type": review.content_type,
            "content_id": str(review.content_id),
            "old_state": old_state.value,
            "new_state": new_state.value,
            "is_featured": review.is_featured,
        },
    )

    # The state change, the counter update and the audit row commit together or not at
    # all — that is what "the counter and the state can never be committed apart" means.
    # `get_session` never commits, so without this the whole moderation is discarded and
    # the queue still shows the review as pending on the next load.
    await session.commit()

    return ReviewModerateOut(
        id=str(review.id),
        state=review.state,
        is_featured=review.is_featured,
        review_count=review_count,
        rating_sum=rating_sum,
    )


@router.delete("/admin/reviews/{review_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_review(
    review_id: str,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Remove a review outright.

    Reviews are approved on submission (see content/reviews.py), so moderation is
    reactive: this is the control that takes a bad one down.

    Deleting is not the same as rejecting. A rejected review stays on file — the
    UNIQUE(user_id, content_type, content_id) constraint still holds its slot, so its
    author can never submit a replacement. Deleting frees that slot, which is the right
    behaviour for "this one shouldn't be here": the customer can write another.

    Counters are decremented in the same transaction, and only if the review was
    actually approved — a rejected review never contributed to them, so subtracting for
    one would under-count the item permanently.
    """
    import uuid

    try:
        review = await session.get(Review, uuid.UUID(review_id))
    except ValueError:
        raise HTTPException(status_code=404, detail="Review not found")
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    was_approved = ReviewState(review.state) == ReviewState.APPROVED
    if was_approved:
        model = _COUNTER_MODEL.get(review.content_type)
        if model:
            content = await session.get(model, review.content_id)
            if content:
                content.review_count = max(0, (content.review_count or 0) - 1)
                content.rating_sum = max(0, (content.rating_sum or 0) - review.rating)

    await record_audit(
        session,
        actor=user,
        action="review_deleted",
        target_type="review",
        target_id=review.id,
        # Captured before the delete — the row is gone afterwards, and the rating and
        # body are what a review of this action would need to see.
        context={
            "content_type": review.content_type,
            "content_id": str(review.content_id),
            "state": review.state,
            "rating": review.rating,
            "body": review.body,
            "display_name": review.display_name,
        },
    )

    await session.delete(review)
    await session.commit()
    return None
