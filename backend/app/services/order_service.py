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

    A cart checkout is the general case; a single-product checkout is a special case of
    it (`product_ids` is a one-item list there). One order, N order_items, N entitlements,
    still one transaction. Entitlement checks stay server-side and resolve through
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

    # An unknown product id in webhook metadata must fail loudly here, before any row is
    # constructed. Letting it reach a flush raises a FK IntegrityError mid-transaction,
    # after which the session can't even commit the `error_message` this handler records
    # on the way out (PendingRollbackError) — losing the trace and leaving Stripe's retry
    # to fail forever.
    missing = [pid for pid in product_uuids if pid not in products_by_id]
    if missing:
        raise ValueError(f"checkout webhook named unknown product id(s): {[str(m) for m in missing]}")

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

    # Every entitlement row this user already has for these products, live or revoked,
    # resolved up front so a race skips only the duplicate entitlement, not the whole
    # order. `uq_entitlements_user_product` backstops this; checking first avoids
    # touching the constraint in the common case.
    #
    # The whole ROW is loaded and revoked rows are kept, both load-bearing
    # (`tests/test_repurchase_after_refund.py`): a refund only sets `revoked_at`, so the
    # unique constraint blocks a second row. Skipping on "a row exists" would charge a
    # returning buyer and grant nothing; ignoring revoked rows and inserting would
    # IntegrityError after Stripe took the money. Reinstating the existing row is the
    # only shape correct on both counts.
    existing = await session.execute(
        select(Entitlement).where(
            Entitlement.user_id == uid, Entitlement.product_id.in_(product_uuids)
        )
    )
    entitlement_by_product = {e.product_id: e for e in existing.scalars().all()}

    for product_id in product_uuids:
        # Every id in product_uuids is guaranteed present in products_by_id by the
        # "missing" check above — no `if product else 0` fallback needed or wanted;
        # a silent $0 order_item for a real product would be its own money bug.
        product = products_by_id[product_id]
        order_item = OrderItem(
            order_id=order.id,
            product_id=product_id,
            price_amount_cents=product.price_amount,
        )
        session.add(order_item)

        prior = entitlement_by_product.get(product_id)

        if prior is not None and prior.revoked_at is None:
            # Genuinely already owned — the original duplicate guard, unchanged.
            continue

        if prior is not None:
            # Bought before, refunded, now bought again. Reinstate the row the unique
            # constraint forces us to reuse. `revoked_reason` is cleared alongside
            # `revoked_at`: a live entitlement still labelled "refund" is a contradiction
            # that misleads the audit trail and the admin user-detail page.
            prior.revoked_at = None
            prior.revoked_reason = None
            prior.granted_via = GrantedVia.PURCHASE
            entitlement = prior
            audit_action = "reinstate_entitlement"
            audit_reason = "repurchase_after_refund"
        else:
            entitlement = Entitlement(
                user_id=uid,
                product_id=product_id,
                granted_via=GrantedVia.PURCHASE,
            )
            session.add(entitlement)
            audit_action = "grant_entitlement"
            audit_reason = "purchase"

        await session.flush()  # entitlement.id populated for the audit context below

        audit_entry = AuditLog(
            actor_user_id=uid,
            action=audit_action,
            target_type="product",
            target_id=product_id,
            context=json.dumps({
                "reason": audit_reason, "order_id": str(order.id), "entitlement_id": str(entitlement.id),
            }),
        )
        session.add(audit_entry)

    await session.commit()
    await session.refresh(order)

    return order
