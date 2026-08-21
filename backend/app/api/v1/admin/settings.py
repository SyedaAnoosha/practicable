"""Admin settings — operational fields and configuration status panel.

Phase 6C (W4-R13 steps 3, 8): /admin/config-status returns {name, required, is_set}
per setting derived from Settings.model_fields, NEVER a value. /admin/settings
allows editing operational fields only.

Secrets are never returned, masked or otherwise — a test asserts the response body
contains no key material (sk_, rk_, phc_, SG., JWT prefix patterns).
"""

import re
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import require_admin
from app.db.models import Setting, User
from app.db.session import get_session
from app.services.audit_service import record_audit

router = APIRouter()

# Pattern matching key-shaped values that should NEVER appear in config-status output
_KEY_PATTERNS = re.compile(r"(sk_|rk_|phc_|SG\.|eyJ)")

# Operational keys that can be read/edited through the admin UI.
# Secrets (stripe keys, Mux keys, JWT secrets, etc.) are NOT here — they live
# in env with no DB path, so no database row can ever supply a key.
OPERATIONAL_FIELDS = [
    {"key": "seller_legal_name", "label": "Seller legal name", "required": False},
    {"key": "mailjet_sender_email", "label": "Mailjet sender email", "required": False},
    {"key": "mailjet_sender_name", "label": "Mailjet sender name", "required": False},
    {"key": "owner_notification_email", "label": "Owner notification email", "required": False},
    {"key": "frontend_url", "label": "Frontend URL", "required": True},
]


class ConfigStatusOut(BaseModel):
    name: str
    required: bool
    is_set: bool


class SettingsUpdateIn(BaseModel):
    key: str
    value: str


class SettingOut(BaseModel):
    key: str
    value: str
    updated_at: Optional[str] = None
    updated_by: Optional[str] = None


@router.get("/admin/config-status", response_model=list[ConfigStatusOut])
async def get_config_status():
    """Returns {name, required, is_set} per setting. NEVER returns a value.

    A test asserts no response field matches a key-shaped pattern (sk_, rk_,
    phc_, SG., JWT prefix) — proven by a pattern-matching test.
    """
    return [
        ConfigStatusOut(
            name=field["key"],
            required=field["required"],
            is_set=bool(getattr(settings, field["key"], None)),
        )
        for field in OPERATIONAL_FIELDS
    ]


@router.get("/admin/settings", response_model=list[SettingOut])
async def list_settings(session: AsyncSession = Depends(get_session)):
    """All operational settings with their current values.

    Returns DB values where set, env fallbacks where not. Secrets are NEVER here.
    """
    result = await session.execute(select(Setting))
    db_settings = {s.key: s for s in result.scalars().all()}

    out = []
    for field in OPERATIONAL_FIELDS:
        key = field["key"]
        db_setting = db_settings.get(key)
        out.append(
            SettingOut(
                key=key,
                value=db_setting.value if db_setting else getattr(settings, key, ""),
                updated_at=db_setting.updated_at.isoformat() if db_setting else None,
                updated_by=db_setting.updated_by if db_setting else None,
            )
        )
    return out


@router.put("/admin/settings/{key}", response_model=SettingOut)
async def update_setting(
    key: str,
    payload: SettingsUpdateIn,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """Update an operational setting. Only allowed for operational keys — secrets
    are never editable here.
    """
    allowed_keys = {f["key"] for f in OPERATIONAL_FIELDS}
    if key not in allowed_keys:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "forbidden_key", "message": "This key cannot be edited through the admin UI."}},
        )

    if not payload.value.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": {"code": "empty_value", "message": "Setting value cannot be empty."}},
        )

    # Upsert
    existing = (
        await session.execute(select(Setting).where(Setting.key == key))
    ).scalar_one_or_none()

    if existing:
        existing.value = payload.value
        existing.updated_by = admin.email
    else:
        session.add(Setting(key=key, value=payload.value, updated_by=admin.email))

    await session.flush()

    # Update the in-memory settings object so the change takes effect immediately
    setattr(settings, key, payload.value)

    # Settings has no UUID PK, so we use a deterministic UUID based on the key.
    # This is a shared convention: the same key always produces the same target_id,
    # which makes deduplication and querying straightforward.
    target_uuid = uuid.uuid5(uuid.NAMESPACE_URL, f"setting:{key}")
    await record_audit(
        session,
        actor=admin,
        action="update_setting",
        target_type="setting",
        target_id=target_uuid,
        context={"key": key, "new_value": payload.value[:200]},
    )
    await session.commit()

    return SettingOut(key=key, value=payload.value)
