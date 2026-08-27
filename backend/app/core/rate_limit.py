"""Shared in-memory rate limiter used by several endpoints.

A counter in memory, keyed by string (user id or IP), not a row in the database.
No IP is stored; no user data is logged. A failed check logs the key and action name,
not the IP or any other identifying detail.
"""
import logging
from collections import defaultdict
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)


class RateLimiter:
    """Sliding-window counter keyed by an opaque string.

    Usage:
        limiter = RateLimiter(window_seconds=60, max_requests=10)
        if not limiter.allow(user_id, "password_change"):
            raise HTTPException(429, "Too many requests. Try again in a minute.")
    """

    def __init__(self, window_seconds: int = 60, max_requests: int = 10) -> None:
        self._window = timedelta(seconds=window_seconds)
        self._max = max_requests
        self._counters: dict[str, tuple[datetime, int]] = defaultdict(
            lambda: (datetime.now(timezone.utc), 0)
        )

    def allow(self, key: str, action: str = "") -> bool:
        """Returns True if the request is within the rate limit."""
        now = datetime.now(timezone.utc)
        window_start, count = self._counters[key]
        if now - window_start > self._window:
            self._counters[key] = (now, 1)
            return True
        if count >= self._max:
            logger.warning("Rate limit exceeded for %s (action=%s)", key, action)
            return False
        self._counters[key] = (window_start, count + 1)
        return True
