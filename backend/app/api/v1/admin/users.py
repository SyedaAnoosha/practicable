"""Admin user management — list, search, role change, deactivation.

Phase 6C (W4-R13): the admin can view users, change roles (with guardrails),
and deactivate accounts — all without SQL and with an audit trail.

Non-negotiable #1: deactivation is wired into the entitlements gate
(core/entitlements.py), not bolted beside it.
"""

from datetime import datetime, timezone
import logging
from typing import Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import require_admin
from app.db.models import Entitlement, Order, Product, Role, User
from app.db.session import get_session
from app.services.audit_service import record_audit
from app.services.account_service import deactivate_user as deactivate_user_account

from .common import get_or_404

logger = logging.getLogger(__name__)

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


class UserUpdateIn(BaseModel):
    """Partial update: every field optional, only the present ones are applied.

    `EmailStr` gives the format validation for free (pydantic returns the project's
    normal 422 envelope on a malformed address), matching `auth.py`'s RequestResetIn.
    """
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    reason: Optional[str] = None


class UserUpdateOut(BaseModel):
    """The updated user, plus the one thing the admin MUST see after an email change.

    `email_auth_synced` is False when the local `users.email` moved but the Supabase
    auth email did not — see PATCH below. The frontend renders a loud warning on False;
    it is not an incidental flag.
    """
    user: UserOut
    email_auth_synced: Optional[bool] = None
    warning: Optional[str] = None


class PasswordResetOut(BaseModel):
    ok: bool
    sent_to: Optional[str] = None
    message: str


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
    """Deactivate a user via the shared `deactivate_user` service
    (app/services/account_service.py — also used by the self-serve
    POST /me/account/close, per week4_plan.md §10F step 2's "do not add a second
    mechanism" instruction). Wired into the entitlements gate
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

    await deactivate_user_account(
        session,
        user=user,
        actor=admin,
        action="deactivate_user",
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


# ── Edit profile (name / email / role) ──────────────────────────────────────────

# Sentinel for "this field is not being changed", distinct from a value of None.
_UNSET = object()


def _to_user_out(user: User) -> UserOut:
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


async def _sync_supabase_auth_email(user_id: uuid.UUID, new_email: str) -> bool:
    """Update the Supabase auth email so it cannot diverge from `users.email`.

    THE POINT OF THIS FUNCTION (read before changing it): `users.id` IS the Supabase
    auth user id (see db/models/user.py) — the RLS policies compare foreign keys against
    `auth.uid()` directly. `users.email` is a *local mirror* of a value Supabase owns.
    Writing only the local column produces a user who signs in with their OLD address
    while every screen in the admin panel shows the new one — a silent, invisible split
    that surfaces later as "the password reset went to the wrong inbox".

    So the auth record is the authoritative write and it happens FIRST; the local column
    is only updated once this succeeded. Returns False if it did not, and the caller
    then refuses the local write rather than committing half of it.

    `email_confirm=True` marks the new address confirmed immediately: this is an admin
    acting deliberately on a practitioner's behalf, not the user self-serving a change,
    so there is no confirmation round-trip to wait on.
    """
    from supabase import acreate_client

    admin_client = await acreate_client(settings.supabase_url, settings.supabase_service_role_key)
    await admin_client.auth.admin.update_user_by_id(
        str(user_id), {"email": new_email, "email_confirm": True}
    )
    return True


@router.patch("/admin/users/{user_id}", response_model=UserUpdateOut)
async def update_user(
    user_id: uuid.UUID,
    body: UserUpdateIn,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """Edit a practitioner's name, email and/or role in one call.

    Every field is optional; only the ones actually present *and actually different*
    are written and audited. Role changes routed through here reuse the same two
    guardrails as POST /admin/users/{id}/role — self-demotion and last-admin — because
    a second, laxer path to the same mutation would defeat both.

    EMAIL: changing it writes the Supabase auth record first (`_sync_supabase_auth_email`)
    and the local `users.email` only if that succeeded. If Supabase refuses, the whole
    request is refused with 502 and nothing is committed — this endpoint will not leave
    the local email and the auth email pointing at different addresses.

    ORDER MATTERS, and not only for readability: every validation and the external
    Supabase call happen BEFORE any attribute on `user` is assigned. Assigning first and
    validating after leaves rejected values sitting dirty on a live session object, where
    the next commit on that session — this app shares one session per request, and the
    test suite shares one across the client — would flush a change this endpoint had
    already refused with a 502. Caught by
    test_name_change_not_persisted_when_email_sync_fails. Keep the two phases separate.
    """
    user = await get_or_404(session, User, user_id, "User")
    reason = (body.reason or "").strip()

    changes: dict[str, dict[str, Optional[str]]] = {}
    email_auth_synced: Optional[bool] = None
    warning: Optional[str] = None

    # ══ Phase 1: validate everything, mutate nothing ════════════════════════════

    # `_UNSET` distinguishes "not being changed" from "being changed to None", which
    # matters for name: sending "" deliberately clears it, and a plain `None` sentinel
    # could not tell that apart from the field being absent.
    pending_role: Optional[Role] = None
    pending_name: object = _UNSET
    pending_email: Optional[str] = None

    # ── Role ────────────────────────────────────────────────────────────────────
    if body.role is not None:
        try:
            new_role = Role(body.role)
        except ValueError:
            raise HTTPException(
                status_code=422,
                detail={"error": {"code": "invalid_role", "message": "Role must be 'member' or 'admin'."}},
            )
        if new_role != user.role:
            # Same guardrails as the dedicated role endpoint — see docstring.
            if user.id == admin.id and new_role == Role.MEMBER:
                raise HTTPException(
                    status_code=409,
                    detail={"error": {"code": "self_demotion", "message": "You cannot remove your own admin role."}},
                )
            if new_role == Role.MEMBER and user.role == Role.ADMIN:
                admins = (await session.execute(select(User).where(User.role == Role.ADMIN))).scalars().all()
                if len(admins) <= 1:
                    raise HTTPException(
                        status_code=409,
                        detail={"error": {"code": "last_admin", "message": "Cannot demote the last admin. Add another admin first."}},
                    )
            pending_role = new_role

    # ── Name ────────────────────────────────────────────────────────────────────
    if body.name is not None:
        # "" or whitespace clears the name back to NULL, which is a legitimate edit.
        new_name = body.name.strip() or None
        if new_name != user.name:
            pending_name = new_name

    # ── Email ───────────────────────────────────────────────────────────────────
    if body.email is not None:
        new_email = str(body.email).strip().lower()
        if new_email != user.email.lower():
            # Uniqueness check against the local table before touching Supabase, so the
            # common collision fails cheaply and without a half-applied auth write.
            existing = (await session.execute(
                select(User).where(User.email.ilike(new_email), User.id != user.id)
            )).scalars().first()
            if existing is not None:
                raise HTTPException(
                    status_code=409,
                    detail={"error": {"code": "email_taken", "message": "Another account already uses that email address."}},
                )

            # Supabase auth is authoritative — it is written FIRST and the local mirror
            # follows only on success. See _sync_supabase_auth_email.
            try:
                await _sync_supabase_auth_email(user.id, new_email)
                email_auth_synced = True
            except Exception as exc:
                logger.error(
                    "Supabase auth email update failed for user %s (%s -> %s): %s",
                    user.id, user.email, new_email, exc,
                )
                # Refuse the whole request. Writing the local column here is exactly the
                # divergence this endpoint exists to prevent — and because nothing has
                # been assigned yet, the name and role in the same request are refused
                # with it rather than half-applying.
                raise HTTPException(
                    status_code=502,
                    detail={"error": {"code": "auth_email_sync_failed", "message": (
                        "The email was NOT changed. Supabase authentication could not be "
                        "updated, and changing only our local record would leave this user "
                        "signing in with their old address. Nothing was saved."
                    )}},
                )
            pending_email = new_email

    # ══ Phase 2: apply — past this point nothing raises ═════════════════════════

    if pending_role is not None:
        changes["role"] = {"old": user.role.value, "new": pending_role.value}
        user.role = pending_role

    if pending_name is not _UNSET:
        changes["name"] = {"old": user.name, "new": pending_name}  # type: ignore[dict-item]
        user.name = pending_name  # type: ignore[assignment]

    if pending_email is not None:
        changes["email"] = {"old": user.email, "new": pending_email}
        user.email = pending_email
        warning = (
            f"Sign-in address changed to {pending_email}. This user must now use the new "
            f"address to log in — their password is unchanged."
        )

    if not changes:
        return UserUpdateOut(user=_to_user_out(user), email_auth_synced=email_auth_synced)

    context: dict = {"changes": changes}
    if reason:
        context["reason"] = reason
    if email_auth_synced is not None:
        context["email_auth_synced"] = email_auth_synced

    await record_audit(
        session,
        actor=admin,
        action="update_user",
        target_type="user",
        target_id=user.id,
        context=context,
    )
    # get_session never commits — see admin/promotions.py.
    await session.commit()

    return UserUpdateOut(user=_to_user_out(user), email_auth_synced=email_auth_synced, warning=warning)


# ── Password reset trigger ──────────────────────────────────────────────────────


@router.post("/admin/users/{user_id}/send-password-reset", response_model=PasswordResetOut)
async def send_user_password_reset(
    user_id: uuid.UUID,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """Email the user a password *reset link*. The admin never sees or sets a password.

    This is deliberately not "admin sets a new password". This app delegates auth to
    Supabase and stores no password material locally (there is no such column on
    `users`), so the correct action is the one the user themselves would trigger:
    generate a recovery link and mail it. The admin learns nothing secret, and the
    new password is chosen by the account holder in their own browser.

    Reuses the exact mechanism of POST /auth/request-password-reset (api/v1/auth.py):
    `admin.generate_link()` produces the link WITHOUT sending Supabase's own unbranded
    email, so it goes out through our Mailjet transport and branded template instead.

    Unlike the public endpoint, this one reports failure honestly — the caller is a
    trusted admin acting on a known account, so the "never reveal whether the address
    exists" vagueness that endpoint needs would only hide a real problem here.
    """
    user = await get_or_404(session, User, user_id, "User")

    from supabase import acreate_client
    from app.services.email_service import send_password_reset_email

    try:
        admin_client = await acreate_client(settings.supabase_url, settings.supabase_service_role_key)
        redirect_to = f"{settings.frontend_url.rstrip('/')}/reset-password"
        response = await admin_client.auth.admin.generate_link(
            {
                "type": "recovery",
                "email": user.email,
                "options": {"redirect_to": redirect_to},
            }
        )
        reset_url = response.properties.action_link
    except Exception as exc:
        logger.error("Admin password reset link generation failed for %s: %s", user.email, exc)
        raise HTTPException(
            status_code=502,
            detail={"error": {"code": "reset_link_failed", "message": (
                "Could not generate a password reset link. No email was sent."
            )}},
        )

    sent = await send_password_reset_email(to_email=user.email, reset_url=reset_url)
    if not sent:
        # The link exists but the mail did not go out. Say so — silently returning ok
        # here would have the admin telling the user to check an inbox with nothing in it.
        logger.error("Password reset link generated for %s but the email did not send.", user.email)
        raise HTTPException(
            status_code=502,
            detail={"error": {"code": "reset_email_failed", "message": (
                "A reset link was generated but the email could not be sent. "
                "Check the mail transport configuration."
            )}},
        )

    await record_audit(
        session,
        actor=admin,
        action="send_password_reset",
        target_type="user",
        target_id=user.id,
        context={"email": user.email},
    )
    await session.commit()

    return PasswordResetOut(
        ok=True,
        sent_to=user.email,
        message=f"Password reset link sent to {user.email}.",
    )
