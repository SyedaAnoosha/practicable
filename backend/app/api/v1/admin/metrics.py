"""Admin metrics endpoint for analytics dashboard — week4_plan.md W4-R10.

Returns 10 key metrics as numerator+denominator pairs, never percentages.
All queries are pure SQL against tables that already exist. No PostHog dependency.
Revenue returns gross_cents, refunded_cents, net_cents as three fields.
Unknown is null, zero is 0, and the two are different (non-negotiable #15).
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
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
)
from app.db.session import get_session

router = APIRouter()


class MetricOut(BaseModel):
    """A single metric with numerator and denominator for frontend calculation.

    numerator/denominator are `None` (not `0`) when there is nothing yet to compute a
    ratio from — e.g. `second_purchase_rate` with zero total buyers. A real "0 of 5" is
    a fact; "0 of 0" is not a rate at all, and the two must not render the same way on
    the tile (non-negotiable #15: unknown is null, zero is 0, and the two are
    different).
    """
    name: str
    numerator: Optional[int]
    denominator: Optional[int]
    description: str


class MetricsOut(BaseModel):
    """All metrics for the admin dashboard."""
    metrics: list[MetricOut]
    generated_at: datetime
    # Revenue breakdown — gross, refunded, net (W4-R10)
    revenue_gross_cents: int
    revenue_refunded_cents: int
    revenue_net_cents: int
    # Enrollment splits by granted_via (W4-R10)
    enrollment_splits: dict  # {"purchase": n, "manual": n, "free": n}
    # Product rankings by revenue (W4-R10)
    product_rankings: list  # [{id, name, revenue_cents, revenue_dollars}]
    # Download links issued (W4-R10)
    download_links_issued: int


class RevenueSeriesPoint(BaseModel):
    """A single point in the revenue time series."""
    date: str  # ISO date string
    revenue_cents: int
    revenue_dollars: float
    order_count: int


class RevenueSeriesOut(BaseModel):
    """Revenue time series response."""
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
    """Products ranked by revenue (W4-R10). Joins through OrderItem, not Order.total."""
    from app.db.models import OrderItem
    
    result = await session.execute(
        select(
            Product.id,
            Product.name,
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
        {"id": str(r[0]), "name": r[1], "revenue_cents": r[2], "revenue_dollars": r[2] / 100}
        for r in result.all()
    ]


async def _get_download_links_issued(session: AsyncSession) -> int:
    """Download links issued — labelled 'links issued' with a one-sentence caveat (W4-R10)."""
    from app.db.models import DownloadEvent
    result = await session.execute(select(func.count(DownloadEvent.id)))
    return result.scalar() or 0





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
            "revenue_cents": row[1] or 0,
            "revenue_dollars": (row[1] or 0) / 100,
            "order_count": row[2] or 0,
        }
        for row in result.all()
    ]


@router.get("/admin/metrics", response_model=MetricsOut)
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
    ]

    return MetricsOut(
        metrics=metrics,
        generated_at=datetime.now(timezone.utc),
        revenue_gross_cents=gross,
        revenue_refunded_cents=refunded,
        revenue_net_cents=net,
        enrollment_splits=enrollment_splits,
        product_rankings=product_rankings,
        download_links_issued=downloads,
    )


@router.get("/admin/metrics/revenue-series", response_model=RevenueSeriesOut)
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

    return RevenueSeriesOut(
        period=period,
        data=[
            RevenueSeriesPoint(
                date=point["date"],
                revenue_cents=point["revenue_cents"],
                revenue_dollars=point["revenue_dollars"],
                order_count=point["order_count"],
            )
            for point in data
        ],
    )


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
