"""Admin audit log reader — read-only, newest first.

/admin/audit reads the audit_log table so the owner can see who changed what
without SQL. The append-only audit trail already exists (audit_service.py); this
endpoint just reads it.
"""

from datetime import datetime
from typing import Optional
import uuid

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import AuditLog
from app.db.session import get_session

router = APIRouter()


class AuditLogOut(BaseModel):
    id: str
    actor_email: Optional[str] = None
    action: str
    target_type: str
    target_id: str
    context: Optional[str] = None
    created_at: datetime


@router.get("/admin/audit", response_model=list[AuditLogOut])
async def list_audit_logs(
    action: Optional[str] = Query(default=None, description="Filter by action type"),
    target_type: Optional[str] = Query(default=None, description="Filter by target type"),
    limit: int = Query(default=100, le=500),
    session: AsyncSession = Depends(get_session),
):
    """The audit trail, newest first. Filterable by action and target type.

    Query count: 1 (joins actor_user → users for the email in the same query).
    """
    from app.db.models import User

    q = (
        select(AuditLog, User.email)
        .outerjoin(User, User.id == AuditLog.actor_user_id)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
    )
    if action:
        q = q.where(AuditLog.action == action)
    if target_type:
        q = q.where(AuditLog.target_type == target_type)

    rows = (await session.execute(q)).all()
    return [
        AuditLogOut(
            id=str(log.id),
            actor_email=email,
            action=log.action,
            target_type=log.target_type,
            target_id=str(log.target_id),
            context=log.context,
            created_at=log.created_at,
        )
        for log, email in rows
    ]
