import json

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.models import AuditLog, Order, OrderItem, OrderStatus, Product, Entitlement, GrantedVia, User
import uuid


async def create_order_from_checkout(
    session: AsyncSession,
    user_id: str,
    stripe_session_id: str,
    stripe_payment_intent_id: str,
    price_amount_cents: int,
    currency: str,
    product_ids: list[str],
) -> Order:
    """Create an order from a completed Stripe checkout session.

    week3_plan.md W3-R11 — a cart checkout is the general case a single-product
    checkout is now a special case of (`product_ids` is a one-item list there). One
    order, N order_items, N entitlements, still one transaction: non-negotiable #3
    requires entitlement checks to stay server-side and resolved through
    `resolve_product_ids()` regardless of how many products a single order granted, and
    that path reads `entitlements` however many rows this call leaves behind.

    `price_amount_cents`/`currency` describe the ORDER total (what Stripe actually
    charged); each order_item's own price is looked up from `products.price_amount` —
    Stripe's `checkout.session.completed` payload carries a total, not a per-line-item
    breakdown, and this is the one place that number already lives.
    """
    uid = uuid.UUID(user_id)
    product_uuids = [uuid.UUID(pid) for pid in product_ids]

    result = await session.execute(select(Product).where(Product.id.in_(product_uuids)))
    products_by_id = {p.id: p for p in result.scalars().all()}

    order = Order(
        user_id=uid,
        stripe_session_id=stripe_session_id,
        stripe_payment_intent_id=stripe_payment_intent_id,
        status=OrderStatus.COMPLETED,
        total_amount_cents=price_amount_cents,
        currency=currency,
    )
    session.add(order)
    await session.flush()

    # Which products this user already holds — resolved once, up front, so a race
    # (two tabs, a retried webhook reaching here before the pre-checkout 409 could
    # apply) skips only the duplicate entitlement, not the whole order. The DB itself
    # backstops this too (uq_entitlements_user_product, migration 010), but checking
    # first means never touching the constraint in the common case.
    existing = await session.execute(
        select(Entitlement.product_id).where(
            Entitlement.user_id == uid, Entitlement.product_id.in_(product_uuids)
        )
    )
    already_owned = set(existing.scalars().all())

    for product_id in product_uuids:
        product = products_by_id.get(product_id)
        order_item = OrderItem(
            order_id=order.id,
            product_id=product_id,
            price_amount_cents=product.price_amount if product else 0,
        )
        session.add(order_item)

        if product_id in already_owned:
            continue

        entitlement = Entitlement(
            user_id=uid,
            product_id=product_id,
            granted_via=GrantedVia.PURCHASE,
        )
        session.add(entitlement)
        await session.flush()  # entitlement.id populated for the audit context below

        audit_entry = AuditLog(
            actor_user_id=uid,
            action="grant_entitlement",
            target_type="product",
            target_id=product_id,
            context=json.dumps({
                "reason": "purchase", "order_id": str(order.id), "entitlement_id": str(entitlement.id),
            }),
        )
        session.add(audit_entry)

    await session.commit()
    await session.refresh(order)

    return order
