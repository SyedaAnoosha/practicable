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

    # week4_plan.md W4-R9: a product id in webhook metadata that no product row backs —
    # a stale id, a bad write, a tampered session — must fail loudly before any write
    # is attempted. Checked here, before `order`/`OrderItem`/`Entitlement` are even
    # constructed: letting this reach a flush instead raises a FK-violation
    # IntegrityError mid-transaction, which leaves the session unable to even commit
    # the `error_message` this same handler tries to record on the way out
    # (PendingRollbackError) — silently losing the one trace that the event ever
    # arrived, and leaving Stripe's retry to fail the same way forever.
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

    # Every entitlement row this user already has for these products, live or revoked —
    # resolved once, up front, so a race (two tabs, a retried webhook reaching here
    # before the pre-checkout 409 could apply) skips only the duplicate entitlement, not
    # the whole order. The DB itself backstops this too
    # (uq_entitlements_user_product, migration 010), but checking first means never
    # touching the constraint in the common case.
    #
    # The whole ROW is loaded, not just the product_id, and revoked rows are kept rather
    # than filtered out — both deliberate, and both load-bearing after the bug found on
    # 2026-08-22 (`tests/test_repurchase_after_refund.py`):
    #
    #   A refund sets `revoked_at`; it never deletes the row, because the audit trail has
    #   to survive. The unique constraint then means a re-purchase CANNOT insert a second
    #   row. So a query that skipped on "a row exists" charged a returning buyer and
    #   granted them nothing, while one that ignored revoked rows and inserted would have
    #   raised an IntegrityError after Stripe already took the money.
    #
    #   Reinstating the existing row is the only shape that is correct on both counts.
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
