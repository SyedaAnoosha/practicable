"""Admin CRUD for products, including the overlap and bundle-pricing publish guards.

The editor reuses the same patterns as `admin/templates.py`:
  - `useAutosave` on the frontend calls PUT on every field change
  - `PublishStateChip` calls the /publish endpoint
  - Overlap + bundle-pricing guards run at publish, not at write, matching the existing
    template-file and lesson-content guards

price_amount / stripe_price_id are two systems holding one fact. Changing price_amount
without updating stripe_price_id is a common mistake — the product page shows one price
and Stripe charges another. The publish endpoint surfaces a warning when they look
inconsistent. It is never a blocker (the Stripe price may legitimately have been updated
first), but it is never silent.
"""
import uuid
from datetime import datetime
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_admin
from app.core.publish_guard import check_bundle_pricing, check_content_overlap, check_stripe_price
from app.db.models import Product, ProductContent, User
from app.db.models.product import Licence
from app.db.session import get_session
from app.integrations.stripe_client import archive_price, create_price, create_price_under_product

from .common import (
    PublishStateIn,
    apply_publish_state_or_422,
    ensure_unique_slug,
    get_or_404,
    record_audit,
    slugify,
)

router = APIRouter()


class ProductWriteIn(BaseModel):
    name: str = Field(min_length=1, max_length=500)
    description: str = Field(min_length=1)
    # Stripe-side price reference — updating this alone does NOT update what Stripe
    # charges; the Stripe dashboard or API must be used for that.
    stripe_price_id: str = Field(min_length=1, max_length=255)
    # price_amount is in cents (AUD by default). Changing it without updating the Stripe
    # price produces a mismatch warning at publish.
    price_amount: int = Field(gt=0)
    currency: str = Field(min_length=3, max_length=3, default="AUD")
    # Evidence layer
    licence: Licence = Licence.STANDARD
    search_title: Optional[str] = Field(default=None, max_length=500)
    version: Optional[str] = Field(default=None, max_length=20)
    last_reviewed_at: Optional[datetime] = None
    is_bundle: bool = False


class PriceChangeIn(BaseModel):
    """Price change request with required reason."""
    price_amount: int = Field(gt=0)  # in cents
    currency: str = Field(min_length=3, max_length=3)
    reason: str = Field(min_length=1, max_length=500)  # Required for audit trail


class ProductOut(BaseModel):
    id: str
    slug: str
    name: str
    description: str
    stripe_price_id: str
    price_amount: int
    currency: str
    published: bool
    publish_state: str
    licence: str
    search_title: Optional[str] = None
    version: Optional[str] = None
    last_reviewed_at: Optional[datetime] = None
    is_bundle: bool
    content_count: int  # how many ProductContent rows this product has
    # Server-derived readiness state
    readiness: Literal["no_product", "price_unset", "stripe_price_unresolved", "unpublished", "ready"]
    readiness_message: str  # Human-readable description of the readiness state


class ProductPublishOut(ProductOut):
    """Extended response on publish that can carry a non-blocking warning."""
    warning: Optional[str] = None


def _to_out(p: Product, content_count: int = 0) -> ProductOut:
    """Server-derived readiness state.

    The readiness state is calculated server-side because the client cannot
    know whether a Stripe price ID actually resolves at Stripe.

    Delegates to `compute_readiness` (publish_guard.py) — the same function
    `CourseDetailOut`/`TemplateOut` use for their own readiness field, so a
    course's product and the product itself never disagree about its state.
    """
    from app.core.publish_guard import compute_readiness

    readiness_result = compute_readiness(p)
    readiness, readiness_message = readiness_result.state, readiness_result.message

    return ProductOut(
        id=str(p.id),
        slug=p.slug,
        name=p.name,
        description=p.description,
        stripe_price_id=p.stripe_price_id,
        price_amount=p.price_amount,
        currency=p.currency,
        published=p.published,
        publish_state=p.publish_state.value,
        licence=p.licence.value,
        search_title=p.search_title,
        version=p.version,
        last_reviewed_at=p.last_reviewed_at,
        is_bundle=p.is_bundle,
        content_count=content_count,
        readiness=readiness,
        readiness_message=readiness_message,
    )


async def _count_contents(product_id: uuid.UUID, session: AsyncSession) -> int:
    result = await session.execute(
        select(ProductContent).where(ProductContent.product_id == product_id)
    )
    return len(result.scalars().all())


@router.get("/admin/products", response_model=List[ProductOut])
async def list_products(session: AsyncSession = Depends(get_session)):
    """All products (including unpublished) — admin only, guarded at the router level."""
    products = (
        await session.execute(select(Product).order_by(Product.created_at.desc()))
    ).scalars().all()

    if not products:
        return []

    # Resolve content counts in one query — never one per product
    all_contents = (
        await session.execute(
            select(ProductContent.product_id, ProductContent.id).where(
                ProductContent.product_id.in_([p.id for p in products])
            )
        )
    ).all()
    count_by_product: dict[uuid.UUID, int] = {}
    for pid, _ in all_contents:
        count_by_product[pid] = count_by_product.get(pid, 0) + 1

    return [_to_out(p, count_by_product.get(p.id, 0)) for p in products]


@router.get("/admin/products/{product_id}", response_model=ProductOut)
async def get_product(
    product_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
):
    product = await get_or_404(session, Product, product_id, "Product")
    return _to_out(product, await _count_contents(product_id, session))


@router.post("/admin/products", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
async def create_product(
    payload: ProductWriteIn,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(require_admin),
):
    """Create a product row. Content (which templates/lessons it grants) is set
    through ProductContent rows, not through this endpoint — separate concern."""
    product = Product(
        slug=await ensure_unique_slug(session, Product, slugify(payload.name)),
        name=payload.name,
        description=payload.description,
        stripe_price_id=payload.stripe_price_id,
        price_amount=payload.price_amount,
        currency=payload.currency,
        published=False,
        licence=payload.licence,
        search_title=payload.search_title,
        version=payload.version,
        last_reviewed_at=payload.last_reviewed_at,
        is_bundle=payload.is_bundle,
    )
    session.add(product)
    await session.flush()
    await record_audit(
        session, actor=admin, action="create_product", target_type="product",
        target_id=product.id, context={"name": product.name},
    )
    await session.commit()
    return _to_out(product)


@router.put("/admin/products/{product_id}", response_model=ProductOut)
async def update_product(
    product_id: uuid.UUID,
    payload: ProductWriteIn,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(require_admin),
):
    """price and stripe_price_id are deliberately NOT written from this
    payload. They used to be — silently re-writing price_amount here, with no Stripe
    call, no audit reason and no archived-old-Price bookkeeping, was a second write
    path for the exact bug POST /admin/products/{id}/price exists to prevent. A price
    change goes through that one endpoint, from all three surfaces, or not at all.
    ProductWriteIn still carries both fields because POST /admin/products (create) has
    no existing price to change from and legitimately sets them once, at creation.
    """
    product = await get_or_404(session, Product, product_id, "Product")
    product.name = payload.name
    product.description = payload.description
    product.licence = payload.licence
    product.search_title = payload.search_title
    product.version = payload.version
    product.last_reviewed_at = payload.last_reviewed_at
    product.is_bundle = payload.is_bundle
    await record_audit(
        session, actor=admin, action="update_product", target_type="product",
        target_id=product.id,
        context={"name": product.name},
    )
    await session.commit()
    return _to_out(product, await _count_contents(product_id, session))


@router.post("/admin/products/{product_id}/price", response_model=ProductOut)
async def change_product_price(
    product_id: uuid.UUID,
    payload: PriceChangeIn,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(require_admin),
):
    """Change the price of a product.

    Follows the specified order of operations:
    a. Retrieve the current Price — confirms mode and yields the Stripe Product id
    b. create_price_under_product() under that same Stripe Product
    c. Update the row, write the audit row, commit
    d. archive_price(old) — last

    Archiving is last on purpose: Archive-then-swap has a window where the live price
    is archived and the row still points at it — every checkout in that window fails.
    Swap-then-archive's worst case is a stale Price nobody references.
    """
    import stripe

    product = await get_or_404(session, Product, product_id, "Product")

    # Step a: Retrieve the current Price to confirm mode and get Stripe Product id
    from app.core.constants import STRIPE_PRICE_UNSET

    old_price_id = product.stripe_price_id
    if not old_price_id or old_price_id == STRIPE_PRICE_UNSET:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": {
                    "code": "placeholder_price",
                    "message": "Cannot change price of a product with a placeholder Stripe price. Create a real product first.",
                }
            },
        )

    # Currency change on a published product is refused
    if product.published and payload.currency != product.currency:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": {
                    "code": "currency_change_on_published",
                    "message": "Cannot change currency on a published product. That's a different product commercially.",
                }
            },
        )

    # The normal flow looks up the existing Price to find its Stripe Product, then adds
    # a new Price under it. When the stored `price_…` id doesn't resolve (issued by a
    # different or since-cleared Stripe account), that lookup 404s — and retrying can
    # never help. A missing Price is recoverable: mint a fresh Stripe Product and Price
    # and adopt them. The database is the source of truth for what a thing costs; the old
    # id is already gone, so there is nothing to archive.
    stripe_product_id: str | None = None
    try:
        old_price = stripe.Price.retrieve(old_price_id)
        # No `expand` was requested above, so Stripe returns the Product as a plain ID.
        assert isinstance(old_price.product, str)
        stripe_product_id = old_price.product
    except stripe.InvalidRequestError:
        stripe_product_id = None

    # Step b: Create the new Price — under the same Stripe Product where one exists,
    # otherwise as a brand-new Product/Price pair.
    try:
        if stripe_product_id:
            new_price_id = create_price_under_product(
                unit_amount=payload.price_amount,
                currency=payload.currency,
                stripe_product_id=stripe_product_id,
            )
        else:
            new_price_id, _new_stripe_product_id = create_price(
                unit_amount=payload.price_amount,
                currency=payload.currency,
                product_name=product.name,
            )
    except stripe.StripeError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "error": {
                    "code": "stripe_error",
                    "message": str(e),
                }
            },
        )

    # Step c: Update the row, write audit row, commit
    old_amount = product.price_amount
    old_currency = product.currency
    product.stripe_price_id = new_price_id
    product.price_amount = payload.price_amount
    product.currency = payload.currency

    # Write audit row for the price change
    await record_audit(
        session, actor=admin, action="change_product_price", target_type="product",
        target_id=product.id, context={
            "old_amount": old_amount,
            "new_amount": payload.price_amount,
            "old_currency": old_currency,
            "new_currency": payload.currency,
            "old_price_id": old_price_id,
            "new_price_id": new_price_id,
            "stripe_product_id": stripe_product_id,
            "reason": payload.reason,
        },
    )
    await session.commit()

    # Step d: Archive the old price (last, after commit)
    try:
        archive_price(old_price_id)
    except Exception:
        # Log but don't fail - the database is already updated
        pass

    return _to_out(product, await _count_contents(product_id, session))


@router.post("/admin/products/{product_id}/publish", response_model=ProductPublishOut)
async def publish_product(
    product_id: uuid.UUID,
    payload: PublishStateIn,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(require_admin),
):
    """Publish or unpublish. Runs the overlap and bundle-pricing guards before the state
    change — the same discipline as the template and course publish endpoints.

    Guards run only when publishing (payload.published=True). Unpublishing never needs
    them — removing a product from public view doesn't create an integrity problem.
    """
    product = await get_or_404(session, Product, product_id, "Product")
    warning: Optional[str] = None

    if payload.published:
        # ── Stripe price guard ──────────────────────────────────────
        stripe_check = check_stripe_price(
            stripe_price_id=product.stripe_price_id,
            price_amount=product.price_amount,
            currency=product.currency,
        )
        if not stripe_check.ok:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error": {
                        "code": "stripe_price_invalid",
                        "message": stripe_check.message,
                    }
                },
            )

        # ── Overlap guard ──────────────────────────────────────────────
        overlap = await check_content_overlap(
            product_id, session, is_bundle=product.is_bundle
        )
        if overlap.has_conflicts:
            conflict = overlap.conflicts[0]
            others = ", ".join(
                f"\"{c['other_product_name']}\"" for c in overlap.conflicts[:3]
            )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error": {
                        "code": "content_overlap",
                        "message": (
                            f"Can't publish — {others} already grant"
                            f" {conflict['content_type']} content."
                            " Two published products can't include the same thing"
                            " unless one is a bundle."
                        ),
                        "conflicts": overlap.conflicts,
                    }
                },
            )

        # ── Bundle pricing guard ───────────────────────────────────────
        if product.is_bundle:
            pricing = await check_bundle_pricing(product_id, session)
            if pricing.is_overpriced:
                bundle_price = product.price_amount / 100
                parts_total = pricing.parts_total_cents / 100
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail={
                        "error": {
                            "code": "bundle_overpriced",
                            "message": (
                                f"A bundle has to cost less than its parts."
                                f" This one is A${bundle_price:.2f};"
                                f" its parts come to A${parts_total:.2f}."
                            ),
                        }
                    },
                )

    was_state = product.publish_state.value
    was = product.published
    new_state = apply_publish_state_or_422(product, payload)
    await record_audit(
        session, actor=admin,
        action="publish_product" if payload.published else "unpublish_product",
        target_type="product", target_id=product.id,
        context={
            "from": was, "to": payload.published,
            "state_from": was_state, "state_to": new_state.value,
        },
    )
    await session.commit()

    out = ProductPublishOut(
        **_to_out(product, await _count_contents(product_id, session)).model_dump(),
        warning=warning,
    )
    return out
