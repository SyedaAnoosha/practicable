"""Shared helpers for the admin routes: audit writing, slugs, and 404s."""
import json
import re
import unicodedata
import uuid
from typing import Any, Optional

from fastapi import HTTPException, status
from sqlalchemy import select
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
    """Write one `audit_log` row. The ONLY way admin mutations get recorded.

    Does not commit — the caller's transaction does, so an audit row can never survive
    a mutation that then failed and rolled back (a log claiming a change that didn't
    happen is worse than no log).

    `context` is serialised to JSON and truncated to the column's 2000 chars. It holds
    the *shape* of the change (which fields, old/new publish state), never the full
    body text of a question — this table is a trail, not a version history.
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


def slugify(value: str) -> str:
    """URL slug from a human title. Deliberately conservative: ASCII, lowercase,
    hyphen-separated, no leading/trailing hyphens.

    Admins type titles with apostrophes, em dashes and ampersands ("We Have a Risk
    Register, But No One Uses It"), and every one of those is either illegal or
    ambiguous in a URL. Auto-generating the slug from the title is what stops the
    editor needing to understand URL rules at all — the spec's "no code required"
    applies to slugs too.
    """
    normalised = unicodedata.normalize("NFKD", value)
    ascii_only = normalised.encode("ascii", "ignore").decode("ascii")
    lowered = ascii_only.lower()
    hyphenated = re.sub(r"[^a-z0-9]+", "-", lowered)
    return hyphenated.strip("-")[:255] or "untitled"


async def ensure_unique_slug(
    session: AsyncSession, model: Any, base: str, *, exclude_id: Optional[uuid.UUID] = None
) -> str:
    """`base`, or `base-2`, `base-3`… until it's free on `model`.

    Slugs are unique-constrained at the DB level on questions/courses/templates, so
    without this an admin creating two questions with similar titles gets a raw
    IntegrityError instead of a saved row. `exclude_id` lets an edit keep its own slug
    rather than colliding with itself and drifting to `-2` on every save.
    """
    candidate = base
    suffix = 1
    while True:
        query = select(model.id).where(model.slug == candidate)
        if exclude_id is not None:
            query = query.where(model.id != exclude_id)
        if (await session.execute(query)).first() is None:
            return candidate
        suffix += 1
        candidate = f"{base[: 250 - len(str(suffix))]}-{suffix}"


async def get_or_404(session: AsyncSession, model: Any, obj_id: uuid.UUID, label: str):
    """Fetch by primary key or raise a clean 404 in this project's error envelope."""
    obj = await session.get(model, obj_id)
    if obj is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "not_found", "message": f"{label} not found."}},
        )
    return obj
