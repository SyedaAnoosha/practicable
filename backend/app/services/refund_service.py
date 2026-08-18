"""The one place an order's entitlements get revoked (week3_plan.md W3-R5).

Two callers reach `apply_refund` — `POST /admin/orders/{id}/refund` (which issues the
Stripe refund itself, then calls this) and the `charge.refunded` webhook (where Stripe
has already refunded the charge; this only has to catch the local state up) — so a
refund issued from the Stripe dashboard reaches the exact same end state as one issued
from the admin, per the plan's explicit requirement. Neither caller duplicates the
revoke/audit logic; both call this.
"""
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Entitlement, Order, OrderItem, OrderStatus, Product, User
from app.services.audit_service import record_audit


@dataclass
class RefundResult:
    order: Order
    revoked_entitlements: list[Entitlement]
    revoked_products: list[Product]
    already_refunded: bool


async def apply_refund(
    session: AsyncSession,
    *,
    order: Order,
    reason: str,
    actor: Optional[User],
) -> RefundResult:
    """Revoke every entitlement `order` granted, mark it refunded, write one audit row.

    Idempotent on `order.status` — the first caller to reach this (admin endpoint or
    the webhook, whichever wins the race) does the work; a second call for the same
    order is a no-op that still returns the already-revoked state, so a caller can't
    tell "just refunded" from "already was" without checking `already_refunded` itself,
    and doesn't need to: both fire the same emails/events either way (see the two call
    sites), and this file's job is state, not side effects.

    Does not commit — the caller's transaction does, same contract as `record_audit`.
    """
    if order.status == OrderStatus.REFUNDED:
        # Re-resolve what's revoked so a caller can still build the same email/response
        # as the original refund, rather than getting an empty result on a replay.
        item_result = await session.execute(select(OrderItem.product_id).where(OrderItem.order_id == order.id))
        product_ids = list(item_result.scalars().all())
        ent_result = await session.execute(
            select(Entitlement).where(Entitlement.user_id == order.user_id, Entitlement.product_id.in_(product_ids))
        )
        products_result = await session.execute(select(Product).where(Product.id.in_(product_ids)))
        return RefundResult(
            order=order,
            revoked_entitlements=list(ent_result.scalars().all()),
            revoked_products=list(products_result.scalars().all()),
            already_refunded=True,
        )

    item_result = await session.execute(select(OrderItem.product_id).where(OrderItem.order_id == order.id))
    product_ids = list(item_result.scalars().all())

    now = datetime.now(timezone.utc)
    ent_result = await session.execute(
        select(Entitlement).where(
            Entitlement.user_id == order.user_id,
            Entitlement.product_id.in_(product_ids),
            Entitlement.revoked_at.is_(None),
        )
    )
    entitlements = list(ent_result.scalars().all())
    for ent in entitlements:
        ent.revoked_at = now
        ent.revoked_reason = reason

    order.status = OrderStatus.REFUNDED

    products_result = await session.execute(select(Product).where(Product.id.in_(product_ids)))
    products = list(products_result.scalars().all())

    await record_audit(
        session,
        actor=actor,
        action="refund_order",
        target_type="order",
        target_id=order.id,
        context={
            "reason": reason,
            "amount_cents": order.total_amount_cents,
            "currency": order.currency,
            "product_ids": [str(p) for p in product_ids],
            "entitlements_revoked": [str(e.id) for e in entitlements],
            "actor": "admin" if actor else "stripe_dashboard",
        },
    )

    return RefundResult(
        order=order, revoked_entitlements=entitlements, revoked_products=products, already_refunded=False,
    )
