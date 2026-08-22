"""The one place a user account actually gets deactivated (week4_plan.md §10F step 2).

Two callers reach `deactivate_user` — `POST /admin/users/{id}/deactivate` (an admin
acting on someone else, reason required) and `POST /me/account/close` (a user acting
on themselves, password-reauth-gated instead) — and the plan is explicit: "Do not add
a second mechanism... extracting it to a service function both the admin endpoint and
the new self-serve endpoint call." Before this, both endpoints inlined the identical
`user.disabled_at = datetime.now(timezone.utc)` independently — same effect today, but
two places that could silently drift (e.g. one remembering to re-check an already-
active gate condition and the other not) with no test able to catch the divergence.
Neither caller sets `disabled_at` directly anymore; both call this.
"""
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import User
from app.services.audit_service import record_audit


async def deactivate_user(
    session: AsyncSession,
    *,
    user: User,
    actor: User,
    action: str,
    context: Optional[dict] = None,
) -> None:
    """Set `user.disabled_at` and write one audit row. Does not commit — the caller's
    transaction does, same contract as `apply_refund`/`record_audit`.

    Idempotency and self-deactivation guardrails stay with each caller: they differ
    (an admin can't deactivate themselves; a self-serve close is a 409 no-op on a
    second call, not an error an admin would want) and belong close to the request
    context that makes them meaningful, not buried in a shared helper that would then
    need a parameter for every caller's own rule.
    """
    user.disabled_at = datetime.now(timezone.utc)
    await record_audit(
        session,
        actor=actor,
        action=action,
        target_type="user",
        target_id=user.id,
        context=context,
    )
