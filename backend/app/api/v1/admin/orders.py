"""Order reconciliation and the manual-entitlement escape hatch.

Every route here sits behind `router.py`'s router-level `require_admin` — no route in
this file re-declares the dependency for gating, only for the acting admin's identity
where a write needs to record who did it.
"""
import csv
import io
import uuid
from typing import Optional

import stripe as stripe_sdk
from fastapi import APIRouter, Depends, HTTPException, Response, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.commerce.products import _resolve_contents_bulk
from app.core.deps import require_admin
from app.db.models import Entitlement, Order, OrderStatus, OrderItem, Product, User
from app.db.session import get_session
from app.integrations.posthog_client import capture_refund_issued
from app.integrations.stripe_client import create_refund
from app.services.audit_service import record_audit
from app.services.email_service import send_refund_confirmation_email
from app.services.refund_service import apply_refund

router = APIRouter()


class AdminOrderRowOut(BaseModel):
    order_id: str
    date: str
    customer_email: str
    product_id: str
    product_name: str
    amount: int
    currency: str
    stripe_reference: str
    entitlement_status: str  # "granted" | "missing"
    user_id: str
    # week3_plan.md W3-R5 — needed so the table can show a `Refunded` chip and the
    # refund action can know the order's real total (not one item's price) without a
    # second request.
    order_status: str  # "pending" | "completed" | "failed" | "refunded"
    order_total_amount_cents: int
    # Keyset pagination cursor — the created_at timestamp for this row
    cursor: str


async def _order_rows(session: AsyncSession, cursor: Optional[str] = None, limit: int = 100) -> list[AdminOrderRowOut]:
    """One row per (order, order_item) — almost always one item per order today, but
    the schema allows more, and this table must never silently drop a second line item.
    
    Uses keyset pagination on Order.created_at for efficient large datasets.
    """
    query = (
        select(Order, OrderItem, User, Product)
        .join(OrderItem, OrderItem.order_id == Order.id)
        .join(User, User.id == Order.user_id)
        .join(Product, Product.id == OrderItem.product_id)
    )
    
    if cursor:
        try:
            cursor_date = cursor  # cursor is the ISO date string
            query = query.where(Order.created_at < cursor_date)
        except ValueError:
            # Invalid cursor format - ignore and return from start
            pass
    
    query = query.order_by(Order.created_at.desc()).limit(limit)
    
    result = await session.execute(query)
    rows = result.all()
    if not rows:
        return []

    # One query for every (user_id, product_id) pair on the page, not one per row.
    # `revoked_at IS NULL` — same predicate the gate itself uses (core/entitlements.py)
    # — a refunded order's rows must show as `missing`/`Refunded`, never `Granted`.
    pairs = {(order.user_id, item.product_id) for order, item, _user, _product in rows}
    ent_result = await session.execute(
        select(Entitlement.user_id, Entitlement.product_id).where(
            Entitlement.user_id.in_({p[0] for p in pairs}),
            Entitlement.product_id.in_({p[1] for p in pairs}),
            Entitlement.revoked_at.is_(None),
        )
    )
    granted_pairs = {(row.user_id, row.product_id) for row in ent_result.all()}

    out: list[AdminOrderRowOut] = []
    for order, item, user, product in rows:
        entitled = (order.user_id, item.product_id) in granted_pairs
        out.append(
            AdminOrderRowOut(
                order_id=str(order.id),
                date=order.created_at.date().isoformat(),
                customer_email=user.email,
                product_id=str(item.product_id),
                product_name=product.name,
                amount=item.price_amount_cents,
                currency=order.currency,
                stripe_reference=order.stripe_session_id,
                entitlement_status="granted" if entitled else "missing",
                user_id=str(order.user_id),
                order_status=order.status.value,
                order_total_amount_cents=order.total_amount_cents,
                cursor=order.created_at.isoformat(),
            )
        )
    return out


@router.get("/admin/orders", response_model=list[AdminOrderRowOut])
async def list_orders(
    cursor: Optional[str] = Query(default=None, description="Pagination cursor (ISO timestamp)"),
    limit: int = Query(default=100, le=500, description="Maximum number of rows to return"),
    session: AsyncSession = Depends(get_session),
):
    """The reconciliation table: date, customer email, product, amount, currency,
    Stripe reference, entitlement status. `missing` is the payment-succeeded-webhook-
    failed case the manual grant below exists for.
    
    Supports keyset pagination via cursor parameter for efficient large datasets.
    """
    return await _order_rows(session, cursor=cursor, limit=limit)


@router.get("/admin/orders/export")
async def export_orders_csv(session: AsyncSession = Depends(get_session)):
    """The CSV export button: same rows, same query, a flat file for pasting into a
    spreadsheet, not a second API."""
    rows = await _order_rows(session)
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["Date", "Customer email", "Product", "Amount", "Currency", "Stripe reference", "Entitlement"])
    for r in rows:
        writer.writerow([r.date, r.customer_email, r.product_name, f"{r.amount / 100:.2f}", r.currency, r.stripe_reference, r.entitlement_status])
    return Response(
        content=buffer.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=orders.csv"},
    )


class ManualGrantIn(BaseModel):
    user_id: str
    product_id: str
    # Required, not a formality: the strip/length check below stops a lone space
    # from satisfying Pydantic's bare non-empty-string requirement.
    reason: str


class ManualGrantOut(BaseModel):
    entitlement_id: str


@router.post("/admin/entitlements/grant", response_model=ManualGrantOut, status_code=201)
async def grant_entitlement_manually(
    body: ManualGrantIn,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """The escape hatch for "the payment succeeded but the webhook failed." Writes the
    entitlement AND an audited `audit_log` row with actor, target and reason.
    """
    reason = body.reason.strip()
    if not reason:
        raise HTTPException(status_code=422, detail={"error": {"code": "reason_required", "message": "A reason is required."}})

    try:
        user_id = uuid.UUID(body.user_id)
        product_id = uuid.UUID(body.product_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid user_id or product_id.")

    if not (await session.execute(select(User.id).where(User.id == user_id))).scalar_one_or_none():
        raise HTTPException(status_code=404, detail="User not found.")
    if not (await session.execute(select(Product.id).where(Product.id == product_id))).scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Product not found.")

    existing = (
        await session.execute(
            select(Entitlement).where(Entitlement.user_id == user_id, Entitlement.product_id == product_id)
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="This user already holds an entitlement for this product.")

    entitlement = Entitlement(user_id=user_id, product_id=product_id, granted_via="manual")
    session.add(entitlement)
    await session.flush()  # assigns entitlement.id for the audit row below

    await record_audit(
        session,
        actor=admin,
        action="manual_entitlement_grant",
        target_type="entitlement",
        target_id=entitlement.id,
        context={"user_id": str(user_id), "product_id": str(product_id), "reason": reason},
    )
    await session.commit()

    return ManualGrantOut(entitlement_id=str(entitlement.id))


class RefundIn(BaseModel):
    # Required, not a formality — same non-empty-after-strip contract as the manual
    # grant above, and RefundDialog's spec (week3_plan.md §20.3) makes it a required
    # field in the UI too.
    reason: str


class RefundOut(BaseModel):
    order_id: str
    revoked_product_names: list[str]


@router.post("/admin/orders/{order_id}/refund", response_model=RefundOut)
async def refund_order(
    order_id: str,
    body: RefundIn,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """Issue a real Stripe refund and revoke every entitlement it granted, in one
    audited operation (week3_plan.md W3-R5). The Stripe call happens BEFORE any local
    state changes — if Stripe declines it, nothing here has changed yet, matching
    RefundDialog's §20.3 failure contract ("Nothing has changed.").

    The actual revocation/audit logic lives in `refund_service.apply_refund`, shared
    with the `charge.refunded` webhook handler, so a refund issued from the Stripe
    dashboard instead of here reaches the identical end state.
    """
    reason = body.reason.strip()
    if not reason:
        raise HTTPException(status_code=422, detail={"error": {"code": "reason_required", "message": "A reason is required."}})

    try:
        order_uuid = uuid.UUID(order_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid order id.")

    order = (await session.execute(select(Order).where(Order.id == order_uuid))).scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found.")
    if order.status == OrderStatus.REFUNDED:
        raise HTTPException(status_code=409, detail="This order has already been refunded.")
    if not order.stripe_payment_intent_id:
        raise HTTPException(status_code=422, detail="This order has no payment to refund.")

    try:
        create_refund(payment_intent_id=order.stripe_payment_intent_id)
    except stripe_sdk.StripeError as e:
        # §20.3: inline, never a toast — a toast for a money operation disappears
        # before it's read. The frontend renders this message directly in the dialog.
        raise HTTPException(status_code=502, detail=f"Stripe declined the refund: {e.user_message or str(e)}")

    result = await apply_refund(session, order=order, reason=reason, actor=admin)
    await session.commit()

    # After commit, never inside the transaction — same ordering rule as the purchase
    # path (webhooks.py): a failed send must not undo a refund that already happened.
    capture_refund_issued(user_id=str(order.user_id), order_id=str(order.id))

    user = (await session.execute(select(User).where(User.id == order.user_id))).scalar_one_or_none()
    if user:
        contents_by_product, _ = await _resolve_contents_bulk(result.revoked_products, session)
        removed_items = [
            c.label
            for product in result.revoked_products
            for c in contents_by_product.get(str(product.id), [])
        ]
        if not removed_items:
            # Never a blank list in the email — a refund with nothing named removed
            # reads as "did this actually do anything?" to the person receiving it.
            removed_items = [p.name for p in result.revoked_products]
        await send_refund_confirmation_email(
            to_email=user.email,
            order_id=str(order.id),
            amount_cents=order.total_amount_cents,
            currency=order.currency,
            removed_items=removed_items,
        )

    return RefundOut(
        order_id=str(order.id),
        revoked_product_names=[p.name for p in result.revoked_products],
    )
