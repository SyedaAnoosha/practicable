import uuid

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Product, User, WebhookEvent
from app.db.session import get_session
from app.integrations.stripe_client import construct_webhook_event
from app.services.email_service import send_receipt_email, send_sale_notification_email
from app.services.order_service import create_order_from_checkout

router = APIRouter()


@router.post("/webhooks/stripe")
async def stripe_webhook(
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    """Handle Stripe webhook events (no auth required, verified via signature)."""
    payload = await request.body()
    sig_header = request.headers.get('stripe-signature')

    if not sig_header:
        raise HTTPException(status_code=400, detail="Missing stripe-signature HEADER")

    try:
        event = construct_webhook_event(payload, sig_header)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid payload: {e}")
    except stripe.error.SignatureVerificationError as e:
        raise HTTPException(status_code=400, detail=f"Invalid signature: {e}")

    # Idempotency: insert the event id first and return early on conflict, so a Stripe
    # retry can't create a second entitlement row. Must be the first write in this handler.
    webhook_event = WebhookEvent(stripe_event_id=event['id'], event_type=event['type'])
    session.add(webhook_event)
    try:
        await session.flush()
    except IntegrityError:
        await session.rollback()
        return {"received": True, "duplicate": True}

    # Handle the event
    if event['type'] == 'checkout.session.completed':
        session_data = event['data']['object']
        user_id = session_data.get('metadata', {}).get('user_id')
        product_id = session_data.get('metadata', {}).get('product_id')

        if user_id and product_id:
            try:
                # Order + entitlement in one transaction, preventing "paid but no access".
                order = await create_order_from_checkout(
                    session=session,
                    user_id=user_id,
                    stripe_session_id=session_data['id'],
                    stripe_payment_intent_id=session_data.get('payment_intent'),
                    price_amount_cents=session_data['amount_total'],
                    currency=session_data['currency'].upper(),
                    product_id=product_id,
                )

                webhook_event.processed = True
                await session.commit()

                # After commit, never inside the transaction — a failed send must not roll
                # back a successful purchase.
                user_result = await session.execute(select(User).where(User.id == uuid.UUID(user_id)))
                user = user_result.scalar_one_or_none()
                product_result = await session.execute(select(Product).where(Product.id == uuid.UUID(product_id)))
                product = product_result.scalar_one_or_none()

                if user:
                    await send_receipt_email(
                        to_email=user.email,
                        order_id=str(order.id),
                        amount_cents=order.total_amount_cents,
                        currency=order.currency,
                        product_name=product.name if product else "Your purchase",
                    )
                    # To the owner, not the buyer, and independent of the receipt above:
                    # one failing must not skip the other.
                    await send_sale_notification_email(
                        order_id=str(order.id),
                        buyer_email=user.email,
                        amount_cents=order.total_amount_cents,
                        currency=order.currency,
                        product_name=product.name if product else "Unknown product",
                    )
            except Exception as e:
                webhook_event.error_message = str(e)[:1000]
                await session.commit()
                raise
        else:
            webhook_event.error_message = "Missing user_id or product_id in session metadata"
            await session.commit()
    else:
        webhook_event.processed = True
        await session.commit()

    return {"received": True}
