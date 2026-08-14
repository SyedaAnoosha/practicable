"""week2_plan.md Phase 6 / W2-R9 — order reconciliation and the manual-entitlement
escape hatch. `DESIGN.md §31.8` names order reconciliation as raw SQL today and
autosave-losing-work as "the highest-value gap"; this file closes the first.

Every route here sits behind `router.py`'s router-level `require_admin` — no route in
this file re-declares the dependency for gating, only for the acting admin's identity
where a write needs to record who did it.
"""
import csv
import io
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_admin
from app.db.models import Entitlement, Order, OrderItem, Product, User
from app.db.session import get_session
from app.services.audit_service import record_audit

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


async def _order_rows(session: AsyncSession) -> list[AdminOrderRowOut]:
    """One row per (order, order_item) — almost always one item per order in this
    catalogue today, but the schema (and Stripe, in principle) allows more, and a
    reconciliation table that silently dropped a second line item would be exactly
    the kind of quiet gap this table exists to catch.
    """
    result = await session.execute(
        select(Order, OrderItem, User, Product)
        .join(OrderItem, OrderItem.order_id == Order.id)
        .join(User, User.id == Order.user_id)
        .join(Product, Product.id == OrderItem.product_id)
        .order_by(Order.created_at.desc())
    )
    rows = result.all()
    if not rows:
        return []

    # One query for every (user_id, product_id) pair on the page, not one query per
    # row — an admin with a real order history should not turn this page into an
    # N+1 query storm.
    pairs = {(order.user_id, item.product_id) for order, item, _user, _product in rows}
    ent_result = await session.execute(
        select(Entitlement.user_id, Entitlement.product_id).where(
            Entitlement.user_id.in_({p[0] for p in pairs}),
            Entitlement.product_id.in_({p[1] for p in pairs}),
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
            )
        )
    return out


@router.get("/admin/orders", response_model=list[AdminOrderRowOut])
async def list_orders(session: AsyncSession = Depends(get_session)):
    """§20.8's reconciliation table: date, customer email, product, amount + currency,
    Stripe reference, entitlement status. `missing` is the payment-succeeded-webhook-
    failed case the manual grant below exists for — visible here rather than only
    discoverable by querying Supabase directly."""
    return await _order_rows(session)


@router.get("/admin/orders/export")
async def export_orders_csv(session: AsyncSession = Depends(get_session)):
    """The CSV export button on `/admin/orders` — same rows, same query, no format
    beyond a flat file: this is for pasting into a spreadsheet, not a second API."""
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
    # Required, not Optional — §20.8: "the reason field is required and is not a
    # formality." Pydantic alone enforces non-empty-string-required; the strip/length
    # check below is what stops a lone space from satisfying that.
    reason: str


class ManualGrantOut(BaseModel):
    entitlement_id: str


@router.post("/admin/entitlements/grant", response_model=ManualGrantOut, status_code=201)
async def grant_entitlement_manually(
    body: ManualGrantIn,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """§20.8's `ManualGrantDialog` — the escape hatch for "the payment succeeded but
    the webhook failed," a risk BACKEND.md §1.5 names with no mitigation until this
    route existed. Writes the entitlement AND an audited `audit_log` row with actor,
    target and the reason — the difference between "we think we fixed it" and knowing
    who granted what, and why.
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
