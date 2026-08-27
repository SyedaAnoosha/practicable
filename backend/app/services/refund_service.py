"""The one place an order's entitlements get revoked.

Two callers reach `apply_refund` — `POST /admin/orders/{id}/refund` (which issues the
Stripe refund itself, then calls this) and the `charge.refunded` webhook (where Stripe
has already refunded the charge; this only has to catch the local state up) — so a
refund issued from the Stripe dashboard reaches the exact same end state as one issued
from the admin. Neither caller duplicates the revoke/audit logic; both call this.
"""
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Certificate, Course, Entitlement, Order, OrderItem, OrderStatus, Product, ProductContent, User
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

    # Revoke certificates for courses covered by the refunded products.
    # A certificate for a refunded course must not verify clean — that is the
    # whole point of having a verify page.
    if entitlements:
        product_ids_for_courses = [str(e.product_id) for e in entitlements]
        # Find lessons granted by these products, then find the courses those lessons belong to
        pc_result = await session.execute(
            select(ProductContent.content_id, ProductContent.content_type)
            .where(
                ProductContent.product_id.in_([e.product_id for e in entitlements]),
                ProductContent.content_type == "lesson",
            )
        )
        lesson_ids = [row[0] for row in pc_result.all()]
        if lesson_ids:
            # Find courses via modules
            from app.db.models import Lesson, Module
            module_result = await session.execute(
                select(Module.course_id)
                .join(Lesson, Lesson.module_id == Module.id)
                .where(Lesson.id.in_(lesson_ids))
                .distinct()
            )
            course_ids = [row[0] for row in module_result.all()]
            if course_ids:
                cert_result = await session.execute(
                    select(Certificate).where(
                        Certificate.user_id == order.user_id,
                        Certificate.course_id.in_(course_ids),
                        Certificate.revoked_at.is_(None),
                    )
                )
                certs_to_revoke = cert_result.scalars().all()
                for cert in certs_to_revoke:
                    cert.revoked_at = now
                    cert.revoked_reason = reason

    return RefundResult(
        order=order, revoked_entitlements=entitlements, revoked_products=products, already_refunded=False,
    )
