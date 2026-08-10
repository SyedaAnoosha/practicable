import json

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.models import AuditLog, Order, OrderItem, OrderStatus, Product, Entitlement, GrantedVia, User
from app.integrations.stripe_client import construct_webhook_event
import uuid

async def create_order_from_checkout(
    session: AsyncSession,
    user_id: str,
    stripe_session_id: str,
    stripe_payment_intent_id: str,
    price_amount_cents: int,
    currency: str,
    product_id: str,
) -> Order:
    """Create an order from a completed Stripe checkout session."""
    
    # Create order
    order = Order(
        user_id=uuid.UUID(user_id),
        stripe_session_id=stripe_session_id,
        stripe_payment_intent_id=stripe_payment_intent_id,
        status=OrderStatus.COMPLETED,
        total_amount_cents=price_amount_cents,
        currency=currency,
    )
    session.add(order)
    await session.flush()
    
    # Create order item
    order_item = OrderItem(
        order_id=order.id,
        product_id=uuid.UUID(product_id),
        price_amount_cents=price_amount_cents,
    )
    session.add(order_item)
    
    # Grant entitlement
    entitlement = Entitlement(
        user_id=uuid.UUID(user_id),
        product_id=uuid.UUID(product_id),
        granted_via=GrantedVia.PURCHASE,
    )
    session.add(entitlement)

    # BACKEND.md §1.5: every entitlement grant is audited — this is the difference
    # between "we think the webhook fired" and knowing. actor_user_id is the buyer
    # themselves here (a self-service purchase, not an admin override).
    await session.flush()  # entitlement.id populated for the audit context below
    audit_entry = AuditLog(
        actor_user_id=uuid.UUID(user_id),
        action="grant_entitlement",
        target_type="product",
        target_id=uuid.UUID(product_id),
        context=json.dumps({"reason": "purchase", "order_id": str(order.id), "entitlement_id": str(entitlement.id)}),
    )
    session.add(audit_entry)

    await session.commit()
    await session.refresh(order)
    
    return order
