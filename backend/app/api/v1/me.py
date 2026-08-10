from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user_id
from app.core.entitlements import resolve_product_ids
from app.db.session import get_session
import uuid

router = APIRouter()


class EntitlementsOut(BaseModel):
    product_ids: list[str]


@router.get("/me/entitlements", response_model=EntitlementsOut)
async def get_my_entitlements(
    session: AsyncSession = Depends(get_session),
    user_id: str = Depends(get_current_user_id),
):
    """DESIGN.md §29.4: the success page polls this every 1.5s for up to 20s after a
    Stripe redirect, since the webhook that actually creates the entitlement can
    arrive after the user is already back on our site. Returns every product the
    user currently holds — the frontend just checks whether the one it's waiting on
    is in the list."""
    product_ids = await resolve_product_ids(user_id=uuid.UUID(user_id), session=session)
    return EntitlementsOut(product_ids=[str(pid) for pid in product_ids])
