"""Admin metrics endpoint for analytics dashboard — week4_plan.md W4-R10.

Returns 10 key metrics as numerator+denominator pairs, never percentages.
All queries are pure SQL against tables that already exist. No PostHog dependency.
Revenue returns gross_cents, refunded_cents, net_cents as three fields.
Unknown is null, zero is 0, and the two are different (non-negotiable #15).
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_admin
from app.db.models import (
    User,
    Order,
    OrderStatus,
    Entitlement,
    Product,
    Template,
    Question,
    ContactMessage,
    Lead,
    DownloadEvent,
    FilterEvent,
)
from app.db.session import get_session

router = APIRouter()


def _to_camel(s: str) -> str:
    """Convert snake_case to camelCase for JSON serialization."""
    parts = s.split("_")
    return parts[0] + "".join(p.capitalize() for p in parts[1:])


def _camel_dict(model: BaseModel) -> dict:
    """Serialize a Pydantic model to a camelCase dict for JSON output."""
    return model.model_dump(by_alias=True)


class MetricOut(BaseModel):
    """A single metric with numerator and denominator for frontend calculation.

    numerator/denominator are `None` (not `0`) when there is nothing yet to compute a
    ratio from — e.g. `second_purchase_rate` with zero total buyers. A real "0 of 5" is
    a fact; "0 of 0" is not a rate at all, and the two must not render the same way on
    the tile (non-negotiable #15: unknown is null, zero is 0, and the two are
    different).
    """
    model_config = ConfigDict(alias_generator=_to_camel, populate_by_name=True, by_alias=True)

    name: str
    numerator: Optional[int]
    denominator: Optional[int]
    description: str


class MetricsOut(BaseModel):
    """All metrics for the admin dashboard."""
    model_config = ConfigDict(alias_generator=_to_camel, populate_by_name=True, by_alias=True)

    metrics: list[MetricOut]
    generated_at: datetime
    # Revenue breakdown — gross, refunded, net (W4-R10)
    revenue_gross_cents: int
    revenue_refunded_cents: int
    revenue_net_cents: int
    # Enrollment splits by granted_via (W4-R10)
    enrollment_splits: dict  # {"purchase": n, "manual": n, "free": n}
    # Product rankings by units and revenue (W4-R10)
    product_rankings: list  # [{id, name, units, revenueCents, revenueDollars}]
    # Download links issued (W4-R10)
    download_links_issued: int
    # Courses ranked by enrollment, started and completed (W4-R10 8C-2)
    course_enrollment_rankings: list  # [{id, title, enrolled, started, completed}]
    # Recommendation clicks — W4-R4 item 6.
    recommendation_clicks: dict  # {"question": n, "catalogue": n, "total": n}
    # The routed products readers actually follow, most-followed first.
    recommendation_rankings: list  # [{productSlug, clicks}]
    # Search analytics — most searched questions, zero results, most clicked tags
    most_searched_questions: list  # [{query, count}]
    zero_result_questions: list  # [{query, count}]
    most_clicked_tags: dict  # {"domain": n, "effort": n, "duration": n, "cost": n, "roi_horizon": n, "regulator_pressure": n, "tier": n, "leadership_traits": n}


class RevenueSeriesPoint(BaseModel):
    """A single point in the revenue time series."""
    model_config = ConfigDict(alias_generator=_to_camel, populate_by_name=True, by_alias=True)

    date: str  # ISO date string
    revenue_cents: int
    revenue_dollars: float
    order_count: int


class RevenueSeriesOut(BaseModel):
    """Revenue time series response."""
    model_config = ConfigDict(alias_generator=_to_camel, populate_by_name=True, by_alias=True)

    period: str  # "daily", "weekly", "monthly"
    data: list[RevenueSeriesPoint]


# ── W4-R10 Metrics ──────────────────────────────────────────────────────────────
# All queries are pure SQL against tables that already exist.
# Every metric returns numerator + denominator, never a pre-computed percentage.
# Unknown is null, zero is 0, and the two are different (non-negotiable #15).


async def _get_second_purchase_rate(session: AsyncSession) -> MetricOut:
    """Metric 1: Second-purchase rate — the single most informative number.
    
    Buyers who have placed 2+ orders / total buyers.
    """
    from sqlalchemy import literal_column
    
    # Buyers with 2+ orders
    subq = (
        select(Order.user_id)
        .where(Order.status == OrderStatus.COMPLETED)
        .group_by(Order.user_id)
        .having(func.count(Order.id) >= 2)
        .subquery()
    )
    repeat_buyers = (await session.execute(select(func.count()).select_from(subq))).scalar() or 0
    
    # Total distinct buyers
    total_buyers = (
        await session.execute(
            select(func.count(func.distinct(Order.user_id)))
            .where(Order.status == OrderStatus.COMPLETED)
        )
    ).scalar() or 0
    
    # No buyers at all yet — there is no rate to compute, not a real "0%".
    if total_buyers == 0:
        return MetricOut(
            name="second_purchase_rate",
            numerator=None,
            denominator=None,
            description="Buyers with 2+ orders / total buyers — no buyers yet",
        )

    return MetricOut(
        name="second_purchase_rate",
        numerator=repeat_buyers,
        denominator=total_buyers,
        description="Buyers with 2+ orders / total buyers",
    )


async def _get_free_to_paid(session: AsyncSession) -> MetricOut:
    """Metric 2: Free → paid conversion.
    
    People who gave an email (leads + users) vs people who bought something.
    """
    # People with an email (leads or users)
    lead_count = (await session.execute(select(func.count(Lead.id)))).scalar() or 0
    user_count = (await session.execute(select(func.count(User.id)))).scalar() or 0
    total_with_email = lead_count + user_count
    
    # People who have at least one completed order
    paid_count = (
        await session.execute(
            select(func.count(func.distinct(Order.user_id)))
            .where(Order.status == OrderStatus.COMPLETED)
        )
    ).scalar() or 0
    
    if total_with_email == 0:
        return MetricOut(
            name="free_to_paid",
            numerator=None,
            denominator=None,
            description="Buyers / people who gave an email — no leads or users yet",
        )

    return MetricOut(
        name="free_to_paid",
        numerator=paid_count,
        denominator=total_with_email,
        description="Buyers / people who gave an email",
    )


async def _get_refund_rate(session: AsyncSession) -> MetricOut:
    """Metric 4: Refund rate by product.
    
    Refunded orders / total completed orders.
    """
    refunded = (
        await session.execute(
            select(func.count(Order.id)).where(Order.status == OrderStatus.REFUNDED)
        )
    ).scalar() or 0
    
    completed = (
        await session.execute(
            select(func.count(Order.id)).where(Order.status == OrderStatus.COMPLETED)
        )
    ).scalar() or 0
    
    if completed == 0:
        return MetricOut(
            name="refund_rate",
            numerator=None,
            denominator=None,
            description="Refunded orders / completed orders — no completed orders yet",
        )

    return MetricOut(
        name="refund_rate",
        numerator=refunded,
        denominator=completed,
        description="Refunded orders / completed orders",
    )


async def _get_signup_to_purchase(session: AsyncSession) -> MetricOut:
    """Metric 5: Median time from signup to first purchase.
    
    Returns the median in days as the numerator; denominator is the count of
    buyers with a measurable span.
    """
    from sqlalchemy import literal_column
    from app.db.models import OrderStatus
    
    # For each buyer, find their first order's created_at minus their user created_at
    # This is a simplified version — a real median would need a subquery
    buyers_with_orders = (
        await session.execute(
            select(
                User.created_at.label("user_created"),
                func.min(Order.created_at).label("first_order"),
            )
            .join(Order, Order.user_id == User.id)
            .where(Order.status == OrderStatus.COMPLETED)
            .group_by(User.id, User.created_at)
        )
    ).all()
    
    if not buyers_with_orders:
        return MetricOut(
            name="signup_to_purchase_days",
            numerator=None,
            denominator=None,
            description="Median days from signup to first purchase — no buyers yet",
        )

    spans = [
        (row.first_order - row.user_created).total_seconds() / 86400
        for row in buyers_with_orders
        if row.first_order and row.user_created
    ]

    if not spans:
        return MetricOut(
            name="signup_to_purchase_days",
            numerator=None,
            denominator=None,
            description="Median days from signup to first purchase — no buyers yet",
        )
    
    spans.sort()
    median = spans[len(spans) // 2]
    
    return MetricOut(
        name="signup_to_purchase_days",
        numerator=int(median * 100),  # Store as hundredths of a day for precision
        denominator=len(spans),
        description=f"Median days from signup to first purchase (across {len(spans)} buyers)",
    )


async def _get_revenue_breakdown(session: AsyncSession) -> tuple[int, int, int]:
    """Revenue: gross, refunded, net — three fields, never one (W4-R10)."""
    gross = (
        await session.execute(
            select(func.coalesce(func.sum(Order.total_amount_cents), 0))
            .where(Order.status == OrderStatus.COMPLETED)
        )
    ).scalar() or 0
    
    refunded = (
        await session.execute(
            select(func.coalesce(func.sum(Order.total_amount_cents), 0))
            .where(Order.status == OrderStatus.REFUNDED)
        )
    ).scalar() or 0
    
    return gross, refunded, gross - refunded


async def _get_enrollment_splits(session: AsyncSession) -> dict:
    """Enrollment splits by granted_via: purchase / manual / free (W4-R10)."""
    result = await session.execute(
        select(Entitlement.granted_via, func.count(Entitlement.id))
        .where(Entitlement.revoked_at.is_(None))
        .group_by(Entitlement.granted_via)
    )
    return {row[0].value if hasattr(row[0], 'value') else str(row[0]): row[1] for row in result.all()}


async def _get_product_rankings(session: AsyncSession, limit: int = 10) -> list:
    """Products ranked by revenue (W4-R10). Joins through OrderItem, not Order.total.

    8C-2: "top products by units and revenue, refunds excluded" — units is the count
    of OrderItem rows (one per unit sold), not a separate query; a completed order's
    line item is a unit, so counting rows and summing price_amount_cents in the same
    grouped query costs nothing extra.
    """
    from app.db.models import OrderItem

    result = await session.execute(
        select(
            Product.id,
            Product.name,
            func.count(OrderItem.id).label("units"),
            func.coalesce(func.sum(OrderItem.price_amount_cents), 0).label("revenue"),
        )
        .join(OrderItem, Product.id == OrderItem.product_id)
        .join(Order, OrderItem.order_id == Order.id)
        .where(Order.status == OrderStatus.COMPLETED)
        .group_by(Product.id, Product.name)
        .order_by(func.sum(OrderItem.price_amount_cents).desc().nullslast())
        .limit(limit)
    )
    return [
        {"id": str(r[0]), "name": r[1], "units": r[2], "revenueCents": r[3], "revenueDollars": r[3] / 100}
        for r in result.all()
    ]


async def _get_course_enrollment_rankings(session: AsyncSession, limit: int = 10) -> list:
    """Courses ranked by enrollment, started and completed (W4-R10 8C-2).

    "Enrolled" is an active (non-revoked) entitlement whose linked content is this
    course, via ProductContent — the same purchasability graph 8A's readiness check
    walks. "Started" is a CourseProgress row existing at all (Lesson.tsx writes one
    on first open); "completed" is that row's `completed` flag. A course can be
    started and not completed, but not completed without having started — the query
    reports both counts independently rather than implying that ordering.
    """
    from app.db.models import Course, CourseProgress, ProductContent

    enrolled_subq = (
        select(
            ProductContent.content_id.label("course_id"),
            func.count(func.distinct(Entitlement.user_id)).label("enrolled"),
        )
        .join(Entitlement, Entitlement.product_id == ProductContent.product_id)
        .where(
            ProductContent.content_type == "course",
            Entitlement.revoked_at.is_(None),
        )
        .group_by(ProductContent.content_id)
        .subquery()
    )
    started_subq = (
        select(
            CourseProgress.course_id.label("course_id"),
            func.count(func.distinct(CourseProgress.user_id)).label("started"),
            func.count(func.distinct(CourseProgress.user_id)).filter(CourseProgress.completed.is_(True)).label("completed"),
        )
        .group_by(CourseProgress.course_id)
        .subquery()
    )

    result = await session.execute(
        select(
            Course.id,
            Course.title,
            func.coalesce(enrolled_subq.c.enrolled, 0),
            func.coalesce(started_subq.c.started, 0),
            func.coalesce(started_subq.c.completed, 0),
        )
        .outerjoin(enrolled_subq, enrolled_subq.c.course_id == Course.id)
        .outerjoin(started_subq, started_subq.c.course_id == Course.id)
        .order_by(func.coalesce(enrolled_subq.c.enrolled, 0).desc())
        .limit(limit)
    )
    return [
        {
            "id": str(r[0]),
            "title": r[1],
            "enrolled": r[2],
            "started": r[3],
            "completed": r[4],
        }
        for r in result.all()
    ]


async def _get_download_links_issued(session: AsyncSession) -> int:
    """Download links issued — labelled 'links issued' with a one-sentence caveat (W4-R10)."""
    from app.db.models import DownloadEvent
    result = await session.execute(select(func.count(DownloadEvent.id)))
    return result.scalar() or 0





async def _get_recommendation_clicks(session: AsyncSession) -> dict:
    """Recommendation clicks split by routing surface (W4-R4 item 6).

    Both surfaces are always present in the result, at zero if unclicked, so the page
    can render "0 of 0" honestly rather than omitting a row and implying the surface
    does not exist — the same denominator rule W4-R10's acceptance applies to the tiles.
    """
    from app.db.models import RecommendationEvent

    result = await session.execute(
        select(RecommendationEvent.surface, func.count(RecommendationEvent.id)).group_by(
            RecommendationEvent.surface
        )
    )
    counts = {"question": 0, "catalogue": 0}
    for surface, n in result.all():
        if surface in counts:
            counts[surface] = n
    counts["total"] = counts["question"] + counts["catalogue"]
    return counts


async def _get_recommendation_rankings(session: AsyncSession, limit: int = 10) -> list:
    """Which routed products readers actually follow. Slug rather than name because the
    event table deliberately stores no product id — a name join would need one, and
    adding it for a ranking is not worth coupling an anonymous counter to the catalogue."""
    from app.db.models import RecommendationEvent

    result = await session.execute(
        select(RecommendationEvent.product_slug, func.count(RecommendationEvent.id).label("clicks"))
        .group_by(RecommendationEvent.product_slug)
        .order_by(func.count(RecommendationEvent.id).desc())
        .limit(limit)
    )
    return [{"productSlug": slug, "clicks": clicks} for slug, clicks in result.all()]


async def _get_most_searched_questions(session: AsyncSession, limit: int = 10) -> list:
    """Most searched questions — aggregates query_text from FilterEvent."""
    result = await session.execute(
        select(FilterEvent.query_text, func.count(FilterEvent.id).label("count"))
        .where(FilterEvent.query_text.isnot(None))
        .where(FilterEvent.query_text != "")
        .group_by(FilterEvent.query_text)
        .order_by(func.count(FilterEvent.id).desc())
        .limit(limit)
    )
    return [{"query": query, "count": count} for query, count in result.all()]


async def _get_zero_result_questions(session: AsyncSession, limit: int = 10) -> list:
    """Questions with zero results — FilterEvent where result_count = 0."""
    result = await session.execute(
        select(FilterEvent.query_text, func.count(FilterEvent.id).label("count"))
        .where(FilterEvent.query_text.isnot(None))
        .where(FilterEvent.query_text != "")
        .where(FilterEvent.result_count == 0)
        .group_by(FilterEvent.query_text)
        .order_by(func.count(FilterEvent.id).desc())
        .limit(limit)
    )
    return [{"query": query, "count": count} for query, count in result.all()]


async def _get_most_clicked_tags(session: AsyncSession) -> dict:
    """Most clicked tags — counts how often each filter dimension was used."""
    # Count how often each dimension has a non-null value
    result = await session.execute(
        select(
            func.count(func.nullif(FilterEvent.domain, None)).label("domain"),
            func.count(func.nullif(FilterEvent.effort, None)).label("effort"),
            func.count(func.nullif(FilterEvent.duration, None)).label("duration"),
            func.count(func.nullif(FilterEvent.cost, None)).label("cost"),
            func.count(func.nullif(FilterEvent.roi_horizon, None)).label("roi_horizon"),
            func.count(func.nullif(FilterEvent.regulator_pressure, None)).label("regulator_pressure"),
            func.count(func.nullif(FilterEvent.tier, None)).label("tier"),
            func.count(func.nullif(FilterEvent.leadership_traits, None)).label("leadership_traits"),
        )
    )
    row = result.one()
    return {
        "domain": row.domain or 0,
        "effort": row.effort or 0,
        "duration": row.duration or 0,
        "cost": row.cost or 0,
        "roi_horizon": row.roi_horizon or 0,
        "regulator_pressure": row.regulator_pressure or 0,
        "tier": row.tier or 0,
        "leadership_traits": row.leadership_traits or 0,
    }


async def _get_revenue_series(
    session: AsyncSession,
    period: str = "daily",
    days: int = 90
) -> list:
    """Revenue time series data.

    Phase 8 (8C-4): Returns revenue grouped by day, week, or month.
    """
    from sqlalchemy import extract

    if period == "daily":
        # Group by date
        date_trunc = func.date_trunc("day", Order.created_at)
    elif period == "weekly":
        # Group by week
        date_trunc = func.date_trunc("week", Order.created_at)
    elif period == "monthly":
        # Group by month
        date_trunc = func.date_trunc("month", Order.created_at)
    else:
        raise ValueError(f"Invalid period: {period}")

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    result = await session.execute(
        select(
            date_trunc.label("period"),
            func.sum(Order.total_amount_cents).label("revenue"),
            func.count(Order.id).label("count")
        ).where(
            and_(
                Order.status == OrderStatus.COMPLETED,
                Order.created_at >= cutoff
            )
        ).group_by(date_trunc)
        .order_by(date_trunc)
    )

    return [
        {
            "date": row[0].isoformat() if row[0] else None,
            "revenueCents": row[1] or 0,
            "revenueDollars": (row[1] or 0) / 100,
            "orderCount": row[2] or 0,
        }
        for row in result.all()
    ]


@router.get("/admin/metrics")
async def get_metrics(
    session: AsyncSession = Depends(get_session),
):
    """W4-R10 metrics for the admin dashboard.
    
    Returns numerator+denominator pairs so the frontend can calculate
    percentages or ratios as needed. Revenue returns gross, refunded, net.
    Unknown is null, zero is 0, and the two are different (non-negotiable #15).
    """
    # W4-R10 metrics
    second_purchase = await _get_second_purchase_rate(session)
    free_to_paid = await _get_free_to_paid(session)
    refund_rate = await _get_refund_rate(session)
    signup_to_purchase = await _get_signup_to_purchase(session)
    gross, refunded, net = await _get_revenue_breakdown(session)
    enrollment_splits = await _get_enrollment_splits(session)
    product_rankings = await _get_product_rankings(session)
    downloads = await _get_download_links_issued(session)
    course_enrollment_rankings = await _get_course_enrollment_rankings(session)
    recommendation_clicks = await _get_recommendation_clicks(session)
    recommendation_rankings = await _get_recommendation_rankings(session)
    most_searched_questions = await _get_most_searched_questions(session)
    zero_result_questions = await _get_zero_result_questions(session)
    most_clicked_tags = await _get_most_clicked_tags(session)

    metrics = [
        second_purchase,
        free_to_paid,
        refund_rate,
        signup_to_purchase,
        MetricOut(
            name="total_revenue",
            numerator=gross,
            denominator=1,
            description="Total revenue in cents (all time)",
        ),
        MetricOut(
            name="enrollments",
            numerator=sum(enrollment_splits.values()),
            denominator=1,
            description=f"Active enrollments ({', '.join(f'{k}: {v}' for k, v in enrollment_splits.items())})",
        ),
        MetricOut(
            name="download_links_issued",
            numerator=downloads,
            denominator=1,
            description="Links issued (not unique downloads — a re-request of an expired presigned URL is counted)",
        ),
        MetricOut(
            name="recommendation_clicks",
            numerator=recommendation_clicks["total"],
            denominator=1,
            description=(
                "Routed recommendations followed "
                f"(question page: {recommendation_clicks['question']}, "
                f"filtered catalogue: {recommendation_clicks['catalogue']})"
            ),
        ),
    ]

    return {
        "metrics": [_camel_dict(m) for m in metrics],
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "revenueGrossCents": gross,
        "revenueRefundedCents": refunded,
        "revenueNetCents": net,
        "enrollmentSplits": enrollment_splits,
        "productRankings": product_rankings,
        "downloadLinksIssued": downloads,
        "courseEnrollmentRankings": course_enrollment_rankings,
        "recommendationClicks": recommendation_clicks,
        "recommendationRankings": recommendation_rankings,
        "mostSearchedQuestions": most_searched_questions,
        "zeroResultQuestions": zero_result_questions,
        "mostClickedTags": most_clicked_tags,
    }


@router.get("/admin/metrics/revenue-series")
async def get_revenue_series(
    period: str = Query("daily", pattern="^(daily|weekly|monthly)$"),
    days: int = Query(90, ge=1, le=365),
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(require_admin),
):
    """Phase 8 (8C-4): Revenue time series for charting.

    Returns revenue data grouped by day, week, or month for the specified period.
    """
    data = await _get_revenue_series(session, period=period, days=days)

    return {"period": period, "data": data}


# Keep the old operational functions available for backward compat if needed
async def _get_total_users(session: AsyncSession) -> int:
    result = await session.execute(select(func.count(User.id)))
    return result.scalar() or 0

async def _get_active_users(session: AsyncSession, days: int = 30) -> int:
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    result = await session.execute(
        select(func.count(User.id)).where(User.last_sign_in_at >= cutoff)
    )
    return result.scalar() or 0

async def _get_total_orders(session: AsyncSession) -> int:
    result = await session.execute(select(func.count(Order.id)))
    return result.scalar() or 0

async def _get_published_products(session: AsyncSession) -> int:
    result = await session.execute(
        select(func.count(Product.id)).where(Product.published.is_(True))
    )
    return result.scalar() or 0

async def _get_published_templates(session: AsyncSession) -> int:
    result = await session.execute(
        select(func.count(Template.id)).where(Template.published.is_(True))
    )
    return result.scalar() or 0

async def _get_published_questions(session: AsyncSession) -> int:
    result = await session.execute(
        select(func.count(Question.id)).where(Question.published.is_(True))
    )
    return result.scalar() or 0

async def _get_unnotified_contact_messages(session: AsyncSession) -> int:
    result = await session.execute(
        select(func.count(ContactMessage.id)).where(ContactMessage.notified.is_(False))
    )
    return result.scalar() or 0
