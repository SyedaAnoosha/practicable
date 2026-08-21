"""Admin user management — list, search, role change, deactivation.

Phase 6C (W4-R13): the admin can view users, change roles (with guardrails),
and deactivate accounts — all without SQL and with an audit trail.

Non-negotiable #1: deactivation is wired into the entitlements gate
(core/entitlements.py), not bolted beside it.
"""

from datetime import datetime, timezone
from typing import Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_admin
from app.db.models import Entitlement, Order, Product, Role, User
from app.db.session import get_session
from app.services.audit_service import record_audit

from .common import get_or_404

router = APIRouter()


# ── Output schemas ──────────────────────────────────────────────────────────────


class UserOut(BaseModel):
    id: str
    email: str
    name: Optional[str] = None
    role: str
    last_sign_in_at: Optional[datetime] = None
    disabled_at: Optional[datetime] = None
    created_at: datetime
    cursor: str  # keyset pagination cursor


class UserEntitlementOut(BaseModel):
    product_id: str
    product_name: str
    granted_via: str
    granted_at: datetime


class UserOrderOut(BaseModel):
    order_id: str
    date: str
    amount: int
    currency: str
    status: str


class UserDetailOut(BaseModel):
    id: str
    email: str
    name: Optional[str] = None
    role: str
    last_sign_in_at: Optional[datetime] = None
    disabled_at: Optional[datetime] = None
    created_at: datetime
    entitlements: list[UserEntitlementOut]
    orders: list[UserOrderOut]


class RoleChangeIn(BaseModel):
    role: str  # "member" or "admin"
    reason: str  # Required for audit trail


class DeactivateIn(BaseModel):
    reason: str  # Required for audit trail


# ── List / search ───────────────────────────────────────────────────────────────


@router.get("/admin/users", response_model=list[UserOut])
async def list_users(
    search: Optional[str] = Query(default=None, description="Search by email (contains)"),
    cursor: Optional[str] = Query(default=None, description="Keyset pagination cursor (ISO timestamp)"),
    limit: int = Query(default=50, le=200),
    session: AsyncSession = Depends(get_session),
):
    """All users, newest first, keyset-paginated like /admin/orders (§26.3).

    Query count: 1. No per-row lookups.
    """
    q = select(User).order_by(User.created_at.desc())
    if cursor:
        # `[FIXED]` Same real bug found and fixed in admin/orders.py (week4_plan.md
        # Phase 5 §26.3): passing `cursor` straight into the comparison sends a raw
        # string to asyncpg against a timestamptz column, crashing with an unhandled
        # 500 (`operator does not exist: timestamp with time zone < character
        # varying`) — for a genuinely well-formed cursor, not just a malformed one,
        # since nothing here ever parsed it. Parsing first is what makes a malformed
        # cursor degrade to "return from the start" instead of crashing either way.
        try:
            cursor_date = datetime.fromisoformat(cursor)
            q = q.where(User.created_at < cursor_date)
        except ValueError:
            pass
    if search:
        q = q.where(User.email.ilike(f"%{search}%"))
    q = q.limit(limit)

    users = (await session.execute(q)).scalars().all()
    return [
        UserOut(
            id=str(u.id),
            email=u.email,
            name=u.name,
            role=u.role.value,
            last_sign_in_at=u.last_sign_in_at,
            disabled_at=u.disabled_at,
            created_at=u.created_at,
            cursor=u.created_at.isoformat(),
        )
        for u in users
    ]





# ── Detail ──────────────────────────────────────────────────────────────────────


@router.get("/admin/users/{user_id}", response_model=UserDetailOut)
async def get_user_detail(
    user_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
):
    """User detail with entitlements and orders, both bulk-resolved."""
    user = await get_or_404(session, User, user_id, "User")

    # Bulk-resolve entitlements
    ent_result = await session.execute(
        select(Entitlement)
        .where(Entitlement.user_id == user_id)
        .order_by(Entitlement.created_at.desc())
    )
    entitlements = list(ent_result.scalars().all())

    # Bulk-resolve orders
    order_result = await session.execute(
        select(Order)
        .where(Order.user_id == user_id)
        .order_by(Order.created_at.desc())
    )
    orders = list(order_result.scalars().all())

    # Resolve product names for entitlements in one query
    ent_product_ids = {e.product_id for e in entitlements}
    product_names: dict[uuid.UUID, str] = {}
    if ent_product_ids:
        prod_result = await session.execute(
            select(Product.id, Product.name).where(Product.id.in_(ent_product_ids))
        )
        for pid, pname in prod_result.all():
            product_names[pid] = pname

    return UserDetailOut(
        id=str(user.id),
        email=user.email,
        name=user.name,
        role=user.role.value,
        last_sign_in_at=user.last_sign_in_at,
        disabled_at=user.disabled_at,
        created_at=user.created_at,
        entitlements=[
            UserEntitlementOut(
                product_id=str(e.product_id),
                product_name=product_names.get(e.product_id, "Unknown"),
                granted_via=e.granted_via.value if hasattr(e.granted_via, 'value') else str(e.granted_via),
                granted_at=e.created_at,
            )
            for e in entitlements
        ],
        orders=[
            UserOrderOut(
                order_id=str(o.id),
                date=o.created_at.date().isoformat(),
                amount=o.total_amount_cents,
                currency=o.currency,
                status=o.status.value,
            )
            for o in orders
        ],
    )


# ── Role change ─────────────────────────────────────────────────────────────────


@router.post("/admin/users/{user_id}/role", response_model=UserOut)
async def change_user_role(
    user_id: uuid.UUID,
    body: RoleChangeIn,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """Change a user's role with three guardrails (Phase 6C / W4-R13 step 5):

    1. Self-demotion: an admin cannot remove their own admin role.
    2. Last-admin: cannot demote the last admin.
    3. Reason required: every role change is audited with a reason.
    """
    reason = body.reason.strip()
    if not reason:
        raise HTTPException(
            status_code=422,
            detail={"error": {"code": "reason_required", "message": "A reason is required for role changes."}},
        )

    try:
        new_role = Role(body.role)
    except ValueError:
        raise HTTPException(status_code=422, detail={"error": {"code": "invalid_role", "message": "Role must be 'member' or 'admin'."}})

    user = await get_or_404(session, User, user_id, "User")

    # Guardrail 1: self-demotion
    if user.id == admin.id and new_role == Role.MEMBER:
        raise HTTPException(
            status_code=409,
            detail={"error": {"code": "self_demotion", "message": "You cannot remove your own admin role."}},
        )

    # Guardrail 2: last-admin
    if new_role == Role.MEMBER and user.role == Role.ADMIN:
        admin_count = (await session.execute(
            select(User).where(User.role == Role.ADMIN)
        )).scalars().all()
        if len(admin_count) <= 1:
            raise HTTPException(
                status_code=409,
                detail={"error": {"code": "last_admin", "message": "Cannot demote the last admin. Add another admin first."}},
            )

    old_role = user.role.value
    user.role = new_role

    await record_audit(
        session,
        actor=admin,
        action="change_user_role",
        target_type="user",
        target_id=user.id,
        context={"old_role": old_role, "new_role": new_role, "reason": reason},
    )
    await session.commit()

    return UserOut(
        id=str(user.id),
        email=user.email,
        name=user.name,
        role=user.role.value,
        last_sign_in_at=user.last_sign_in_at,
        disabled_at=user.disabled_at,
        created_at=user.created_at,
        cursor=user.created_at.isoformat(),
    )


# ── Deactivate ──────────────────────────────────────────────────────────────────


@router.post("/admin/users/{user_id}/deactivate", response_model=UserOut)
async def deactivate_user(
    user_id: uuid.UUID,
    body: DeactivateIn,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """Deactivate a user by setting disabled_at. Wired into the entitlements gate
    (core/entitlements.py resolve_product_ids) rather than bolted beside it —
    non-negotiable #1.

    An admin cannot deactivate themselves (same guardrail as self-demotion).
    """
    reason = body.reason.strip()
    if not reason:
        raise HTTPException(
            status_code=422,
            detail={"error": {"code": "reason_required", "message": "A reason is required for deactivation."}},
        )

    user = await get_or_404(session, User, user_id, "User")

    if user.id == admin.id:
        raise HTTPException(
            status_code=409,
            detail={"error": {"code": "self_deactivation", "message": "You cannot deactivate your own account."}},
        )

    if user.disabled_at is not None:
        raise HTTPException(
            status_code=409,
            detail={"error": {"code": "already_deactivated", "message": "This user is already deactivated."}},
        )

    user.disabled_at = datetime.now(timezone.utc)

    await record_audit(
        session,
        actor=admin,
        action="deactivate_user",
        target_type="user",
        target_id=user.id,
        context={"reason": reason},
    )
    await session.commit()

    return UserOut(
        id=str(user.id),
        email=user.email,
        name=user.name,
        role=user.role.value,
        last_sign_in_at=user.last_sign_in_at,
        disabled_at=user.disabled_at,
        created_at=user.created_at,
        cursor=user.created_at.isoformat(),
    )
