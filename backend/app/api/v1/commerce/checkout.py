import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import get_current_user
from app.core.entitlements import ResourceType, resolve_granted_content_ids, resolve_product_ids
from app.db.models import Product, ProductContent, User
from app.db.session import get_session
from app.integrations.stripe_client import create_checkout_session

router = APIRouter()


class CheckoutRequest(BaseModel):
    # week3_plan.md W3-R11 — a cart is the general case a direct "Buy" is a one-item
    # list of. min_length=1 so an empty cart can't reach Stripe at all.
    product_ids: list[str] = Field(min_length=1)


async def _already_fully_owned(*, product: Product, user_id: uuid.UUID, session: AsyncSession) -> bool:
    """True if every piece of content this product would grant is already covered by
    an entitlement the buyer holds — via this exact product, another product, or (for
    the bundle) both its parts bought separately. week3_plan.md Phase 3 step 5: refuse
    before payment, not after it — a refund is strictly more expensive than a 409.

    A product with no product_contents rows at all (shouldn't happen for anything
    published, but nothing here assumes it can't) is never considered "already owned" —
    there is nothing to check membership against, so it falls through to checkout
    rather than silently blocking a real purchase.
    """
    contents_result = await session.execute(
        select(ProductContent.content_type, ProductContent.content_id).where(
            ProductContent.product_id == product.id
        )
    )
    rows = contents_result.all()
    if not rows:
        return False

    owned_product_ids = await resolve_product_ids(user_id=user_id, session=session)
    if not owned_product_ids:
        return False

    by_type: dict[str, set[uuid.UUID]] = {}
    for content_type, content_id in rows:
        by_type.setdefault(content_type, set()).add(content_id)

    for content_type, content_ids in by_type.items():
        granted = await resolve_granted_content_ids(
            product_ids=owned_product_ids, resource_type=ResourceType(content_type), session=session
        )
        if not content_ids.issubset(granted):
            return False
    return True


@router.post("/checkout/session")
async def create_checkout(
    request: CheckoutRequest,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Create a Stripe Checkout session for the current user — one or more products in
    one session (week3_plan.md W3-R11). Takes OUR product ids, not Stripe price ids —
    the client shouldn't need to know Stripe's identifiers. product_ids also has to
    reach the webhook via metadata (app/api/v1/commerce/webhooks.py reads it back out
    of session.metadata.product_ids to know which products to grant).
    """
    try:
        product_uuids = [uuid.UUID(pid) for pid in request.product_ids]
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid product id")
    if len(set(product_uuids)) != len(product_uuids):
        raise HTTPException(status_code=400, detail="Duplicate product in cart")

    result = await session.execute(select(Product).where(Product.id.in_(product_uuids)))
    products_by_id = {p.id: p for p in result.scalars().all()}
    missing = [str(pid) for pid in product_uuids if pid not in products_by_id or not products_by_id[pid].published]
    if missing:
        raise HTTPException(status_code=404, detail="Product not found")

    products = [products_by_id[pid] for pid in product_uuids]

    for product in products:
        if await _already_fully_owned(product=product, user_id=user.id, session=session):
            raise HTTPException(
                status_code=409,
                detail={
                    "error": {
                        "code": "already_owned",
                        "message": f"You already own {product.name}.",
                        "product_slug": product.slug,
                    }
                },
            )

    # The success/cancel pages are frontend routes, so ALLOWED_ORIGIN doubles as their
    # base rather than adding a third setting to keep in sync. product_slugs travels
    # with the redirect (comma-joined — same reasoning as stripe_client's metadata) so
    # the success page knows which entitlements it's polling for, for a cart of any size.
    product_slugs = ",".join(p.slug for p in products)
    success_url = (
        f"{settings.allowed_origin}/checkout/success"
        f"?session_id={{CHECKOUT_SESSION_ID}}&product_slugs={product_slugs}"
    )
    cancel_url = f"{settings.allowed_origin}/checkout/cancel"

    try:
        checkout_session = create_checkout_session(
            price_ids=[p.stripe_price_id for p in products],
            success_url=success_url,
            cancel_url=cancel_url,
            user_email=user.email,
            user_id=str(user.id),
            product_ids=[str(p.id) for p in products],
        )
        return {"checkout_url": checkout_session.url}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
