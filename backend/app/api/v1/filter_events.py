"""Public filter-events endpoint — week4_plan.md Phase 6B step 3.

POST /filter-events: public, unauthenticated, fire-and-forget, returns 202.
Validates dimension against the seven known dimensions, rejects anything else with 422.
Rate-limited per IP without storing the IP — a counter in memory, not a row.
"""
import logging
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session

router = APIRouter()
logger = logging.getLogger(__name__)

# Rate limit: max 30 filter-events per IP per 60-second window.
# A counter in memory, not a row — no IP is stored anywhere.
_RATE_LIMIT_WINDOW = timedelta(seconds=60)
_RATE_LIMIT_MAX = 30
_rate_counters: dict[str, tuple[datetime, int]] = defaultdict(lambda: (datetime.now(timezone.utc), 0))


class FilterEventIn(BaseModel):
    """Matches the migration 014 schema: per-dimension columns, not a (dimension, value) pair.

    The client sends only the dimension(s) that are active; NULL columns mean "not filtered."

    `model_config`'s `extra="forbid"` is load-bearing, not cosmetic: without it, Pydantic
    v2 silently drops any field not declared below (its default is `extra="ignore"`), so
    a bogus/unexpected field sent alongside a real one would be dropped rather than
    rejected — exactly the "free text is how PII arrives by accident" risk step 3 of
    week4_plan.md Phase 6B names. The eight fields declared below, together with
    `extra="forbid"`, are what enforce "reject anything not one of the known dimensions".
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


def _check_rate_limit(ip: str) -> bool:
    """Returns True if the request is within the rate limit."""
    now = datetime.now(timezone.utc)
    window_start, count = _rate_counters[ip]
    if now - window_start > _RATE_LIMIT_WINDOW:
        _rate_counters[ip] = (now, 1)
        return True
    if count >= _RATE_LIMIT_MAX:
        return False
    _rate_counters[ip] = (window_start, count + 1)
    return True


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
    if not _check_rate_limit(ip):
        # Silently drop — the contract is fire-and-forget, never blocks a filter tap.
        return FilterEventOut()

    try:
        from app.db.models import FilterEvent

        dims = body.as_row_fields()
        event = FilterEvent(**dims)
        session.add(event)
        await session.commit()
    except Exception:
        # Wrap and swallow — writes must not fail the request (posthog_client.py contract).
        logger.warning("Failed to record filter event: %s", body.model_dump())

    return FilterEventOut()
