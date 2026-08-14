"""The append-only audit trail.

`BACKEND.md` §1.5: every entitlement grant, manual override, publish and refund writes
an `audit_log` row with actor, action, target and timestamp. It is a handful of lines and
it is the difference between "we think the webhook fired" and knowing.

This lives in `services/` rather than in `api/v1/admin/common.py`, where the first
implementation sat, because `app/core/entitlements.py` needs it too and a core module
importing from `api/` inverts the layer direction §1.3 exists to protect. `admin/common.py`
re-exports `record_audit` from here, so there is still exactly one implementation.
"""
import json
import uuid
from typing import Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import AuditLog, User


async def record_audit(
    session: AsyncSession,
    *,
    actor: User,
    action: str,
    target_type: str,
    target_id: uuid.UUID,
    context: Optional[dict[str, Any]] = None,
) -> None:
    """Write one `audit_log` row. The ONLY way a mutation or an override gets recorded.

    Does not commit — the caller's transaction does, so an audit row can't survive a
    mutation that rolled back. `context` is JSON, truncated to the column's 2000 chars,
    and holds the shape of the change, never full body text: this is a trail, not a
    version history.
    """
    payload = None
    if context is not None:
        payload = json.dumps(context, default=str)[:2000]
    session.add(
        AuditLog(
            actor_user_id=actor.id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            context=payload,
        )
    )


async def record_admin_bypass(
    session: AsyncSession,
    *,
    actor: User,
    resource_type: str,
    resource_id: uuid.UUID,
) -> None:
    """Record an admin reading gated content without holding an entitlement for it.

    `BACKEND.md` §4.3 lists "no admin bypass without an audit row" under **Never**, and
    until now `entitlements.py` carried it as a `# TODO`. An admin who can read every
    paid lesson and mint every signed URL leaving no trace is precisely the hole the
    `audit_log` table was created to close.

    This one commits, unlike `record_audit`. The gate runs before the endpoint does any
    other work (§4.1), so nothing else is pending on the session at this point, and the
    gated reads that reach here — a playback token, a presigned download — never write
    anything of their own for this row to ride along with.

    A failure here is deliberately allowed to propagate and fail the request. The rule is
    that the bypass may not happen *without* the row, which makes the write a precondition
    of access rather than a side effect of it. Swallowing the error would reinstate exactly
    the untraceable bypass this function exists to remove.
    """
    await record_audit(
        session,
        actor=actor,
        action="admin_access_bypass",
        target_type=resource_type,
        target_id=resource_id,
        context={"reason": "role=admin; no entitlement held"},
    )
    await session.commit()
