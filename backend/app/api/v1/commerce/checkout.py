import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import get_current_user
from app.db.models import Product, User
from app.db.session import get_session
from app.integrations.stripe_client import create_checkout_session

router = APIRouter()


class CheckoutRequest(BaseModel):
    product_id: str


@router.post("/checkout/session")
async def create_checkout(
    request: CheckoutRequest,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Create a Stripe Checkout session for the current user.

    Takes OUR product id, not a Stripe price id — the client shouldn't need to know
    Stripe's identifiers. product_id also has to reach the webhook via metadata
    (app/api/v1/commerce/webhooks.py reads session.metadata.product_id to know which
    product to grant); the previous version of this endpoint never set it, so no
    webhook-driven order/entitlement could ever be created.
    """
    result = await session.execute(
        select(Product).where(Product.id == uuid.UUID(request.product_id))
    )
    product = result.scalar_one_or_none()
    if not product or not product.published:
        raise HTTPException(status_code=404, detail="Product not found")

    # The success/cancel pages are frontend routes, so ALLOWED_ORIGIN doubles as their
    # base rather than adding a third setting to keep in sync. product_slug travels with
    # the redirect so the success page knows which entitlement it's polling for.
    success_url = (
        f"{settings.allowed_origin}/checkout/success"
        f"?session_id={{CHECKOUT_SESSION_ID}}&product_slug={product.slug}"
    )
    cancel_url = f"{settings.allowed_origin}/checkout/cancel"

    try:
        checkout_session = create_checkout_session(
            price_id=product.stripe_price_id,
            success_url=success_url,
            cancel_url=cancel_url,
            user_email=user.email,
            user_id=str(user.id),
            product_id=str(product.id),
        )
        return {"checkout_url": checkout_session.url}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
