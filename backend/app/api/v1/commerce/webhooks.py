import logging
import uuid

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.commerce.products import _resolve_contents_bulk
from app.core.config import settings
from app.db.models import Order, OrderStatus, Product, User, WebhookEvent
from app.db.session import get_session
from app.integrations.stripe_client import construct_webhook_event
from app.services.email_service import (
    send_access_granted_email,
    send_receipt_email,
    send_refund_confirmation_email,
    send_sale_notification_email,
    send_welcome_email,
)
from app.services.order_service import create_order_from_checkout
from app.services.refund_service import apply_refund

logger = logging.getLogger(__name__)

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
    except stripe.SignatureVerificationError as e:
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
        # week3_plan.md W3-R11 — comma-joined, same encoding stripe_client.py wrote it
        # with. A single-product "Buy" is a one-item list here, not a separate shape.
        product_ids_raw = session_data.get('metadata', {}).get('product_ids', '')
        product_ids = [pid for pid in product_ids_raw.split(',') if pid]

        if user_id and product_ids:
            try:
                # Order + N entitlements in one transaction, preventing "paid but no access".
                order = await create_order_from_checkout(
                    session=session,
                    user_id=user_id,
                    stripe_session_id=session_data['id'],
                    stripe_payment_intent_id=session_data.get('payment_intent'),
                    price_amount_cents=session_data['amount_total'],
                    currency=session_data['currency'].upper(),
                    product_ids=product_ids,
                )

                webhook_event.processed = True
                await session.commit()

                # After commit, never inside the transaction — a failed send must not roll
                # back a successful purchase.
                user_result = await session.execute(select(User).where(User.id == uuid.UUID(user_id)))
                user = user_result.scalar_one_or_none()
                products_result = await session.execute(
                    select(Product).where(Product.id.in_([uuid.UUID(pid) for pid in product_ids]))
                )
                products = list(products_result.scalars().all())
                # Preserve the order the buyer checked out in, not whatever order the DB
                # returned rows in — mostly cosmetic, but a receipt listing items in a
                # different order than the cart is the kind of thing a buyer notices.
                products_by_id = {str(p.id): p for p in products}
                products = [products_by_id[pid] for pid in product_ids if pid in products_by_id]

                frontend_base = settings.frontend_url.rstrip("/")
                library_url = f"{frontend_base}/library"

                contents_by_product, _ = await _resolve_contents_bulk(products, session)

                if user:
                    product_names = [p.name for p in products]
                    # week4_plan.md §20.9: the receipt states each product's own
                    # version/last_reviewed_at, same fact as the buy page's VersionStamp.
                    product_versions = [(p.version, p.last_reviewed_at) for p in products]
                    # W4-R2: the human-readable invoice number for the receipt.
                    #
                    # This read `session_data['invoice']['number']`, which assumed an
                    # expanded object. A webhook payload never carries one: Stripe sends
                    # `invoice` as a bare id string (or null), and nothing here requests
                    # `expand`. So it raised `AttributeError: 'str' object has no
                    # attribute 'get'` on every completed checkout — and because it sits
                    # above the sends, the receipt, the sale alert and every
                    # access-granted email were skipped with it. The order and the
                    # entitlements were already committed by then, so the buyer was
                    # charged, given access, and told nothing.
                    #
                    # The number lives on the Invoice, so fetching it needs a second
                    # call. That call is best-effort by design: an invoice number is a
                    # nicety on a receipt (`me.py` already documents an absent one as a
                    # supported state), and no failure reaching Stripe for it may ever
                    # again cost the buyer their email.
                    invoice_ref = session_data.get('invoice')
                    invoice_number = None
                    if isinstance(invoice_ref, dict):
                        # Defensive: correct if this is ever called with an expanded session.
                        invoice_number = invoice_ref.get('number')
                    elif isinstance(invoice_ref, str) and invoice_ref:
                        try:
                            invoice_number = stripe.Invoice.retrieve(invoice_ref).get('number')
                        except Exception:  # noqa: BLE001
                            logger.warning(
                                "Could not retrieve Stripe invoice %s for order %s; "
                                "sending the receipt without an invoice number.",
                                invoice_ref,
                                order.id,
                                exc_info=True,
                            )
                    # One receipt for the whole order, however many products it contains
                    # (W3-R11) — the same call a single "Buy" made before, just with a
                    # one-item list.
                    await send_receipt_email(
                        to_email=user.email,
                        order_id=str(order.id),
                        amount_cents=order.total_amount_cents,
                        currency=order.currency,
                        product_names=product_names,
                        primary_link=library_url,
                        order_date=order.created_at,
                        invoice_number=invoice_number,
                        product_versions=product_versions,
                    )
                    # To the owner, not the buyer, and independent of the receipt above:
                    # one failing must not skip the other. One alert per order (not per
                    # product) — the owner reads amount/buyer at a glance, not a list.
                    await send_sale_notification_email(
                        order_id=str(order.id),
                        buyer_email=user.email,
                        amount_cents=order.total_amount_cents,
                        currency=order.currency,
                        product_name=", ".join(product_names) if product_names else "Unknown product",
                    )

                    # access_granted fires once PER PRODUCT (W3-R11) — each has its own
                    # "what you now have access to" link, unlike the receipt/welcome pair
                    # above which describe the order as a whole.
                    for product in products:
                        content_items = [
                            {"label": c.label, "href": c.href}
                            for c in contents_by_product.get(str(product.id), [])
                        ]
                        if len(content_items) == 1 and content_items[0]["href"]:
                            primary_link = f"{frontend_base}{content_items[0]['href']}"
                        else:
                            primary_link = library_url
                        await send_access_granted_email(
                            to_email=user.email,
                            product_name=product.name,
                            content_items=content_items,
                            primary_link=primary_link,
                        )

                    # week3_plan.md Phase 1 step 8: welcome fires once, alongside access
                    # granted, only on a buyer's first-ever completed order — a repeat
                    # buyer already knows what "welcome" would tell them. Still once per
                    # ORDER (not per product) even for a first-order cart with several items.
                    order_count_result = await session.execute(
                        select(func.count())
                        .select_from(Order)
                        .where(Order.user_id == uuid.UUID(user_id), Order.status == OrderStatus.COMPLETED)
                    )
                    is_first_order = order_count_result.scalar_one() <= 1
                    if is_first_order:
                        first_product = products[0] if products else None
                        welcome_content_items = [
                            {"label": c.label, "href": c.href}
                            for p in products
                            for c in contents_by_product.get(str(p.id), [])
                        ]
                        welcome_primary_link = (
                            f"{frontend_base}{welcome_content_items[0]['href']}"
                            if len(products) == 1 and len(welcome_content_items) == 1 and welcome_content_items[0]["href"]
                            else library_url
                        )
                        await send_welcome_email(
                            to_email=user.email,
                            product_name=", ".join(product_names) if product_names else (first_product.name if first_product else "your purchase"),
                            content_items=welcome_content_items,
                            primary_link=welcome_primary_link,
                        )
            except Exception as e:
                webhook_event.error_message = str(e)[:1000]
                await session.commit()
                raise
        else:
            webhook_event.error_message = "Missing user_id or product_ids in session metadata"
            await session.commit()
    elif event['type'] == 'charge.refunded':
        # week3_plan.md W3-R5 — a refund issued from the Stripe dashboard (not
        # /admin/orders) must reach the same end state. Stripe has already refunded
        # the charge by the time this fires, so this only catches up local state —
        # `apply_refund` is the same function the admin endpoint calls, just with no
        # Stripe API call in front of it and no admin actor.
        charge = event['data']['object']
        payment_intent_id = charge.get('payment_intent')
        try:
            order = None
            if payment_intent_id:
                order_result = await session.execute(
                    select(Order).where(Order.stripe_payment_intent_id == payment_intent_id)
                )
                order = order_result.scalar_one_or_none()

            if order:
                result = await apply_refund(
                    session, order=order, reason="Refunded via Stripe dashboard", actor=None,
                )
                webhook_event.processed = True
                await session.commit()

                if not result.already_refunded:
                    user_result = await session.execute(select(User).where(User.id == order.user_id))
                    user = user_result.scalar_one_or_none()
                    if user:
                        contents_by_product, _ = await _resolve_contents_bulk(result.revoked_products, session)
                        removed_items = [
                            c.label
                            for product in result.revoked_products
                            for c in contents_by_product.get(str(product.id), [])
                        ] or [p.name for p in result.revoked_products]
                        await send_refund_confirmation_email(
                            to_email=user.email,
                            order_id=str(order.id),
                            amount_cents=order.total_amount_cents,
                            currency=order.currency,
                            removed_items=removed_items,
                        )
            else:
                webhook_event.error_message = f"No order found for payment_intent {payment_intent_id}"
                await session.commit()
        except Exception as e:
            webhook_event.error_message = str(e)[:1000]
            await session.commit()
            raise
    else:
        webhook_event.processed = True
        await session.commit()

    return {"received": True}
