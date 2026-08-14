"""Shared helpers for the admin routes: audit writing, slugs, and 404s."""
import re
import unicodedata
import uuid
from typing import Any, Optional

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import User

# Re-exported, not duplicated: `app/core/entitlements.py` needs the same writer for the
# admin-bypass audit row, and a core module cannot import from `api/` without inverting
# the layer direction §1.3 exists to protect. The implementation lives in
# `services/audit_service.py`; every admin route still imports it from this module so
# nothing else in `admin/*` had to change.
from app.services.audit_service import record_audit  # noqa: F401


def slugify(value: str) -> str:
    """URL slug from a human title: ASCII, lowercase, hyphen-separated, no leading or
    trailing hyphens. Generated so an editor never has to understand URL rules."""
    normalised = unicodedata.normalize("NFKD", value)
    ascii_only = normalised.encode("ascii", "ignore").decode("ascii")
    lowered = ascii_only.lower()
    hyphenated = re.sub(r"[^a-z0-9]+", "-", lowered)
    return hyphenated.strip("-")[:255] or "untitled"


async def ensure_unique_slug(
    session: AsyncSession, model: Any, base: str, *, exclude_id: Optional[uuid.UUID] = None
) -> str:
    """`base`, or `base-2`, `base-3`… until it's free on `model`. Slugs are unique-
    constrained in the DB, so without this similar titles raise IntegrityError.
    `exclude_id` lets an edit keep its own slug instead of colliding with itself."""
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
