"""Public filter-events endpoint.

POST /filter-events: public, unauthenticated, fire-and-forget, returns 202.
Validates dimension against the seven known dimensions, rejects anything else with 422.
Rate-limited per IP without storing the IP — a counter in memory, not a row.
"""
import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rate_limit import RateLimiter
from app.db.session import get_session

router = APIRouter()
logger = logging.getLogger(__name__)

# Rate limit: max 30 filter-events per IP per 60-second window.
# A counter in memory, not a row — no IP is stored anywhere.
_rate_limiter = RateLimiter(window_seconds=60, max_requests=30)


class FilterEventIn(BaseModel):
    """Matches the migration 014 schema: per-dimension columns, not a (dimension, value) pair.

    The client sends only the dimension(s) that are active; NULL columns mean "not filtered."

    `model_config`'s `extra="forbid"` is load-bearing: without it Pydantic v2 silently
    drops any undeclared field (default `extra="ignore"`), so a bogus field sent
    alongside a real one would be dropped rather than rejected — a way PII arrives by
    accident. The declared fields plus `extra="forbid"` enforce "reject anything not
    one of the known dimensions".
    """
    model_config = {"extra": "forbid"}

    domain: str | None = None
    effort: str | None = None
    duration: str | None = None
    cost: str | None = None
    roi_horizon: str | None = None
    regulator_pressure: str | None = None
    tier: list[str] | None = None
    leadership_traits: list[str] | None = None
    query_text: str | None = None
    result_count: int | None = None

    def has_any_dimension(self) -> bool:
        return any(v is not None for v in [
            self.domain, self.effort, self.duration, self.cost,
            self.roi_horizon, self.regulator_pressure, self.tier,
            self.leadership_traits, self.query_text,
        ])

    def as_row_fields(self) -> dict[str, str | list[str] | int | None]:
        """All non-None fields, including `result_count` — everything the row actually
        has a column for. Distinct from `has_any_dimension()`'s narrower definition of
        "a filter is active", which deliberately does not count `result_count` alone."""
        return {k: v for k, v in self.model_dump().items() if v is not None}


class FilterEventOut(BaseModel):
    ok: bool = True


def _get_client_ip(request: Request) -> str:
    """Extract client IP from X-Forwarded-For (behind proxy) or direct connection."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@router.post("/filter-events", response_model=FilterEventOut, status_code=202)
async def record_filter_event(
    body: FilterEventIn,
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    """Fire-and-forget filter event recording.

    Public, unauthenticated — anyone can POST. Validates dimension against the
    seven known dimensions and rejects anything else. Rate-limited per IP without
    storing the IP.
    """
    if not body.has_any_dimension():
        raise HTTPException(
            status_code=422,
            detail={"error": {"code": "no_dimensions", "message": "At least one dimension must be set."}},
        )

    ip = _get_client_ip(request)
    if not _rate_limiter.allow(ip, action="filter_event"):
        # Silently drop — the contract is fire-and-forget, never blocks a filter tap.
        return FilterEventOut()

    try:
        from app.db.models import FilterEvent

        dims = body.as_row_fields()
        event = FilterEvent(**dims)
        session.add(event)
        await session.commit()
    except Exception:
        # Wrap and swallow — writes must not fail the request.
        logger.warning("Failed to record filter event: %s", body.model_dump())

    return FilterEventOut()


# ── Recommendation clicks ────────────────────────────────────────
# The routing twin of the filter counter above — same contract (public, anonymous,
# fire-and-forget, per-IP rate-limited without storing an IP), kept in this module so
# the two can't drift. Its own limiter so heavy filtering doesn't spend the click
# budget; clicks are rarer, so the ceiling is lower.
_recommendation_limiter = RateLimiter(window_seconds=60, max_requests=15)

# The two valid routing surfaces. Anything else is a client bug and is refused rather
# than recorded, so the metric cannot be polluted by a typo'd constant.
RECOMMENDATION_SURFACES = ("question", "catalogue")


class RecommendationEventIn(BaseModel):
    """`extra="forbid"` for the same load-bearing reason FilterEventIn carries it: an
    unexpected field is how PII arrives by accident, and Pydantic v2 would otherwise
    drop it silently rather than reject it."""

    model_config = {"extra": "forbid"}

    surface: str
    product_slug: str
    question_slug: str | None = None


@router.post("/recommendation-events", response_model=FilterEventOut, status_code=202)
async def record_recommendation_event(
    body: RecommendationEventIn,
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    """Record that a routed recommendation was followed.

    Public, unauthenticated, fire-and-forget, returns 202 — identical to the filter
    counter. Nothing identifying is stored: the row is (surface, question, product,
    timestamp) and nothing else.
    """
    if body.surface not in RECOMMENDATION_SURFACES:
        raise HTTPException(
            status_code=422,
            detail={
                "error": {
                    "code": "unknown_surface",
                    "message": "surface must be one of: " + ", ".join(RECOMMENDATION_SURFACES),
                }
            },
        )
    if not body.product_slug:
        # A recommendation click with no destination is not an event, it is a bug —
        # refuse it rather than write a row that can never be joined to anything.
        raise HTTPException(
            status_code=422,
            detail={
                "error": {
                    "code": "missing_product",
                    "message": "product_slug is required.",
                }
            },
        )

    ip = _get_client_ip(request)
    if not _recommendation_limiter.allow(ip, action="recommendation_event"):
        # Silently drop — the contract is fire-and-forget, never blocks a navigation.
        return FilterEventOut()

    try:
        from app.db.models import RecommendationEvent

        session.add(
            RecommendationEvent(
                surface=body.surface,
                question_slug=body.question_slug,
                product_slug=body.product_slug,
            )
        )
        await session.commit()
    except Exception:
        # Wrap and swallow — a metrics write must not cost the reader their click.
        logger.warning("Failed to record recommendation event: %s", body.model_dump())

    return FilterEventOut()
