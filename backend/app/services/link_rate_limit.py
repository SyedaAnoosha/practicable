"""Soft rate limiter for download link minting (Phase 8F step 11).

Per user per template per hour, in memory. Logs when exceeded but never
blocks a legitimate download.  No IP stored (8C's and 6B's rule).

The limit is advisory — a real attacker would just wait or rotate sessions.
Its purpose is to surface automated scraping in logs, not to enforce a
policy against paying customers.
"""

import logging
import time
from collections import defaultdict

logger = logging.getLogger(__name__)

# Window: 1 hour.  Limit: 10 mints per user per template per window.
WINDOW_SECONDS = 3600
MAX_MINTS = 10

# {user_id: {template_id: [timestamp, ...]}}
_mints: dict[str, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))


def check_and_record(user_id: str, template_id: str) -> bool:
    """Record a link mint and return True if within limit, False if exceeded.

    Never raises.  The caller ignores the return value — exceeding the
    limit is logged, not enforced.
    """
    now = time.time()
    window_start = now - WINDOW_SECONDS

    user_mints = _mints[user_id]
    template_mints = user_mints[template_id]

    # Prune expired entries
    template_mints[:] = [t for t in template_mints if t > window_start]

    within_limit = len(template_mints) < MAX_MINTS
    template_mints.append(now)

    if not within_limit:
        logger.warning(
            "link_mint_rate_exceeded user=%s template=%s mints_in_window=%d",
            user_id,
            template_id,
            len(template_mints),
        )

    return within_limit
