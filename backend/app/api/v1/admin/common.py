"""Shared helpers for the admin routes: audit writing, slugs, and 404s."""
import re
import unicodedata
import uuid
from typing import Any, Literal, Optional

from fastapi import HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.publish_state import apply_publish_state
from app.db.base import PublishState
from app.db.models import User

# Re-exported, not duplicated: `app/core/entitlements.py` needs the same writer for the
# admin-bypass audit row, and a core module cannot import from `api/` without inverting
# the layer direction. The implementation lives in `services/audit_service.py`; every
# admin route imports it from this module.
from app.services.audit_service import record_audit  # noqa: F401


class PublishStateIn(BaseModel):
    """Shared publish-toggle body for questions/templates/courses/lessons (migration
    012). `published` is the legacy boolean every existing caller and test sends;
    `publish_state` is the fourth-state field the `PublishStateChip` UI sends
    explicitly. Both are accepted so old and new clients keep working against the
    same endpoint — see `apply_publish_state_or_422`."""
    published: bool
    publish_state: Optional[Literal["draft", "in_review", "published", "archived"]] = None


def apply_publish_state_or_422(entity: Any, payload: PublishStateIn) -> PublishState:
    """Wraps `core.publish_state.apply_publish_state`, turning its ValueError (the two
    fields disagree) into this API's normal 422 error envelope instead of a raw 500 from
    migration 012's CHECK constraint at commit time."""
    requested = PublishState(payload.publish_state) if payload.publish_state else None
    try:
        return apply_publish_state(entity, published=payload.published, publish_state=requested)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": {"code": "publish_state_mismatch", "message": str(exc)}},
        )


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
