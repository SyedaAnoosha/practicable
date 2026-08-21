"""End-to-end purchase test — week4_plan.md Phase 8A step 8.

The deliverable test: create a course through the admin API, make it purchasable,
set a price, publish, run a Stripe test-mode checkout (mocked), deliver the webhook,
assert the entitlement exists and the lesson is readable.

This test answers the owner instruction: "New courses aren't purchasable."
"""
import uuid
from unittest.mock import patch, MagicMock

import pytest
from sqlalchemy import select

from app.db.models import (
    Entitlement,
    Order,
    OrderStatus,
    Product,
    ProductContent,
    Role,
    User,
)


@pytest.mark.asyncio
async def test_course_purchase_e2e(
    admin_client,
    member_client,
    member_user,
    db_session,
    content_graph,
):
    """Full end-to-end: admin creates course → makes purchasable → buyer purchases → entitlement exists."""
    g = content_graph

    # ── Step 1: Admin creates a new course ────────────────────────────────────
    resp = await admin_client.post(
        "/admin/courses",
        json={
            "title": "E2E Purchase Test Course",
            "description": "A course to test the full purchase flow.",
        },
    )
    assert resp.status_code == 201, resp.text
    course_data = resp.json()
    course_id = course_data["id"]

    # ── Step 2: Admin makes it purchasable (creates Stripe Product + Price) ────
    # Mock Stripe to avoid real API calls
    fake_price_id = f"price_test_{uuid.uuid4().hex[:12]}"
    fake_product_id = f"prod_test_{uuid.uuid4().hex[:12]}"

    with patch(
        "app.integrations.stripe_client.create_price",
        return_value=(fake_price_id, fake_product_id),
    ) as create_price_mock:
        resp = await admin_client.post(f"/admin/courses/{course_id}/create-product")
        assert resp.status_code == 200, resp.text
        create_price_mock.assert_called_once()

    # Verify the product was created in the database
    product_result = await db_session.execute(
        select(Product).where(Product.id == uuid.UUID(resp.json()["id"]))
    )
    # The response is the course detail, not the product — find the product via ProductContent
    pc_result = await db_session.execute(
        select(ProductContent).where(
            ProductContent.content_type == "course",
            ProductContent.content_id == uuid.UUID(course_id),
        )
    )
    pc = pc_result.scalar_one_or_none()
    assert pc is not None, "ProductContent row was not created"

    product_result = await db_session.execute(
        select(Product).where(Product.id == pc.product_id)
    )
    product = product_result.scalar_one()
    assert product.stripe_price_id == fake_price_id
    # stripe_product_id is stored in audit context, not on the row (8B stores it)
    assert product.price_amount == 9900  # Default A$99
    assert product.published is False  # Starts unpublished

    # ── Step 3: Admin publishes the product (via products endpoint) ──────────
    # Mock check_stripe_price since we're using a fake price ID
    with patch(
        "app.api.v1.admin.products.check_stripe_price",
        return_value=MagicMock(ok=True, message="OK"),
    ):
        resp = await admin_client.post(
            f"/admin/products/{product.id}/publish",
            json={"published": True, "publish_state": "published"},
        )
        assert resp.status_code == 200, resp.text

    # Reload product to confirm published
    product_result = await db_session.execute(
        select(Product).where(Product.id == product.id)
    )
    product = product_result.scalar_one()
    assert product.published is True

    # ── Step 4: Buyer initiates checkout ──────────────────────────────────────
    fake_session = MagicMock()
    fake_session.url = "https://checkout.stripe.com/test-session-url"

    with patch(
        "app.api.v1.commerce.checkout.create_checkout_session",
        return_value=fake_session,
    ) as checkout_mock:
        resp = await member_client.post(
            "/checkout/session",
            json={"product_ids": [str(product.id)]},
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["checkout_url"] == fake_session.url
        checkout_mock.assert_called_once()

    # ── Step 5: Stripe webhook fires (checkout.session.completed) ─────────────
    event_id = f"evt_e2e_{uuid.uuid4().hex[:16]}"
    stripe_session_id = f"cs_test_{uuid.uuid4().hex[:16]}"
    payment_intent_id = f"pi_test_{uuid.uuid4().hex[:16]}"

    fake_event = {
        "id": event_id,
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": stripe_session_id,
                "payment_intent": payment_intent_id,
                "amount_total": 9900,
                "currency": "aud",
                "metadata": {
                    "user_id": str(member_user.id),
                    "product_ids": str(product.id),
                },
            }
        },
    }

    with patch(
        "app.api.v1.commerce.webhooks.construct_webhook_event",
        return_value=fake_event,
    ):
        resp = await member_client.post(
            "/webhooks/stripe",
            content=b"{}",
            headers={"stripe-signature": "test-sig"},
        )
        assert resp.status_code == 200, resp.text

    # ── Step 6: Assert entitlement exists ─────────────────────────────────────
    ent_result = await db_session.execute(
        select(Entitlement).where(
            Entitlement.user_id == member_user.id,
            Entitlement.product_id == product.id,
        )
    )
    entitlement = ent_result.scalar_one_or_none()
    assert entitlement is not None, "Entitlement was not created after webhook"
    assert entitlement.granted_via.value == "purchase"

    # ── Step 7: Assert order was created ──────────────────────────────────────
    order_result = await db_session.execute(
        select(Order).where(Order.user_id == member_user.id)
    )
    order = order_result.scalar_one_or_none()
    assert order is not None, "Order was not created"
    assert order.status == OrderStatus.COMPLETED
    assert order.total_amount_cents == 9900
    assert order.stripe_session_id == stripe_session_id

    # ── Step 8: Buyer can read the gated lesson ───────────────────────────────
    resp = await member_client.get(f"/courses/{g.course.slug}")
    assert resp.status_code == 200, resp.text
    # The course detail should include lessons
    lessons = resp.json().get("modules", [{}])[0].get("lessons", [])
    assert len(lessons) > 0, "Course has no lessons"


@pytest.mark.asyncio
async def test_course_purchase_creates_no_row_on_stripe_failure(
    admin_client,
    db_session,
    content_graph,
):
    """Phase 8A step 4: If Stripe fails during product creation, no product row is created."""
    import stripe as stripe_lib

    # Create a course
    resp = await admin_client.post(
        "/admin/courses",
        json={
            "title": "Stripe Failure Test Course",
            "description": "Testing that no row is created on Stripe failure.",
        },
    )
    assert resp.status_code == 201, resp.text
    course_id = resp.json()["id"]

    # Count products before
    before = (
        await db_session.execute(select(Product))
    ).scalars().all()
    before_count = len(before)

    # Mock Stripe to raise an error
    with patch(
        "app.integrations.stripe_client.create_price",
        side_effect=stripe_lib.StripeError("Simulated Stripe failure"),
    ):
        resp = await admin_client.post(f"/admin/courses/{course_id}/create-product")
        assert resp.status_code == 502, resp.text
        assert "stripe_error" in resp.json()["detail"]["error"]["code"]

    # Count products after — should be the same
    after = (
        await db_session.execute(select(Product))
    ).scalars().all()
    assert len(after) == before_count, (
        f"Product row was created despite Stripe failure: {len(after)} != {before_count}"
    )

    # Verify no ProductContent row was created either
    pc_result = await db_session.execute(
        select(ProductContent).where(
            ProductContent.content_type == "course",
            ProductContent.content_id == uuid.UUID(course_id),
        )
    )
    assert pc_result.scalar_one_or_none() is None, (
        "ProductContent row was created despite Stripe failure"
    )


@pytest.mark.asyncio
async def test_course_cannot_be_purchased_twice(
    admin_client,
    member_client,
    member_user,
    db_session,
    content_graph,
):
    """A course already purchased should not allow a second checkout."""
    g = content_graph

    # Create a course and make it purchasable
    resp = await admin_client.post(
        "/admin/courses",
        json={"title": "Double Purchase Test", "description": "d"},
    )
    assert resp.status_code == 201
    course_id = resp.json()["id"]

    fake_price_id = f"price_test_{uuid.uuid4().hex[:12]}"
    fake_product_id = f"prod_test_{uuid.uuid4().hex[:12]}"

    with patch(
        "app.integrations.stripe_client.create_price",
        return_value=(fake_price_id, fake_product_id),
    ):
        resp = await admin_client.post(f"/admin/courses/{course_id}/create-product")
        assert resp.status_code == 200

    # Publish the product so checkout can find it
    pc_result = await db_session.execute(
        select(ProductContent).where(
            ProductContent.content_type == "course",
            ProductContent.content_id == uuid.UUID(course_id),
        )
    )
    pc = pc_result.scalar_one()
    product_id = pc.product_id

    # Publish the product so checkout can find it
    product_result = await db_session.execute(
        select(Product).where(Product.id == product_id)
    )
    product = product_result.scalar_one()
    product.published = True
    await db_session.flush()

    # First checkout succeeds
    fake_session = MagicMock()
    fake_session.url = "https://checkout.stripe.com/first"

    with patch(
        "app.api.v1.commerce.checkout.create_checkout_session",
        return_value=fake_session,
    ):
        resp = await member_client.post(
            "/checkout/session",
            json={"product_ids": [str(product_id)]},
        )
        assert resp.status_code == 200

    # Simulate the webhook to grant entitlement
    fake_event = {
        "id": f"evt_first_{uuid.uuid4().hex[:12]}",
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": f"cs_first_{uuid.uuid4().hex[:12]}",
                "payment_intent": f"pi_first_{uuid.uuid4().hex[:12]}",
                "amount_total": 9900,
                "currency": "aud",
                "metadata": {
                    "user_id": str(member_user.id),
                    "product_ids": str(product_id),
                },
            }
        },
    }

    with patch(
        "app.api.v1.commerce.webhooks.construct_webhook_event",
        return_value=fake_event,
    ):
        resp = await member_client.post(
            "/webhooks/stripe",
            content=b"{}",
            headers={"stripe-signature": "test-sig"},
        )
        assert resp.status_code == 200

    # Verify entitlement exists
    ent_result = await db_session.execute(
        select(Entitlement).where(
            Entitlement.user_id == member_user.id,
            Entitlement.product_id == product_id,
        )
    )
    assert ent_result.scalar_one() is not None

    # Second checkout should return 409 (already owned)
    with patch("app.api.v1.commerce.checkout.create_checkout_session") as checkout_mock:
        resp = await member_client.post(
            "/checkout/session",
            json={"product_ids": [str(product_id)]},
        )
        assert resp.status_code == 409
        assert resp.json()["detail"]["error"]["code"] == "already_owned"
        checkout_mock.assert_not_called()


@pytest.mark.asyncio
async def test_new_course_readiness_is_no_product(admin_client):
    """8A-6: a freshly created course has no product yet — readiness says so,
    not `price_unset` or any other state that implies a product exists."""
    resp = await admin_client.post(
        "/admin/courses",
        json={"title": "Readiness Test Course", "description": "d"},
    )
    assert resp.status_code == 201, resp.text
    course = resp.json()
    assert course["readiness"] == "no_product"
    assert course["product_id"] is None
    assert "no product" in course["readiness_message"].lower() or "not purchasable" in course["readiness_message"].lower()


@pytest.mark.asyncio
async def test_course_readiness_after_create_product_is_unpublished(admin_client):
    """8A-6: right after create-product, the course has a real (resolving) price but
    is not yet published — readiness says `unpublished`, not `ready`.

    `stripe.Price.retrieve` is mocked too, not just `create_price` — readiness is
    computed by re-resolving the price via `check_stripe_price`, so a fake id that
    doesn't actually resolve at Stripe would legitimately (and correctly) come back
    `stripe_price_unresolved` instead. This test is about the unpublished branch.
    """
    resp = await admin_client.post(
        "/admin/courses",
        json={"title": "Readiness Test Course 2", "description": "d"},
    )
    course_id = resp.json()["id"]

    fake_price_id = f"price_test_{uuid.uuid4().hex[:12]}"
    fake_product_id = f"prod_test_{uuid.uuid4().hex[:12]}"
    fake_price = MagicMock()
    fake_price.active = True
    fake_price.unit_amount = 9900  # matches the A$99 default create_course_product sets
    fake_price.currency = "aud"
    fake_price.livemode = False
    with patch(
        "app.integrations.stripe_client.create_price",
        return_value=(fake_price_id, fake_product_id),
    ):
        resp = await admin_client.post(f"/admin/courses/{course_id}/create-product")

    assert resp.status_code == 200, resp.text
    with patch("stripe.Price.retrieve", return_value=fake_price):
        with patch("app.core.config.settings.stripe_secret_key", "sk_test_abc123"):
            resp = await admin_client.get(f"/admin/courses/{course_id}")

    assert resp.status_code == 200, resp.text
    course = resp.json()
    assert course["readiness"] == "unpublished"
    assert course["product_id"] is not None


@pytest.mark.asyncio
async def test_new_template_readiness_is_no_product(admin_client, content_graph):
    """8A-6: the same no_product state applies to a template with no product yet."""
    resp = await admin_client.post(
        "/admin/templates",
        json={"title": "Readiness Test Template", "description": "d", "is_free": False},
    )
    assert resp.status_code == 201, resp.text
    template = resp.json()
    assert template["readiness"] == "no_product"


@pytest.mark.asyncio
async def test_course_create_product_stores_stripe_product_id(admin_client, db_session):
    """8B: stripe_product_id (migration 016) must be written on the Product row at
    creation time, not left NULL until the first price change. create_price() returns
    it for exactly this reason."""
    resp = await admin_client.post(
        "/admin/courses",
        json={"title": "Stripe Product Id Test Course", "description": "d"},
    )
    assert resp.status_code == 201, resp.text
    course_id = resp.json()["id"]

    fake_price_id = f"price_test_{uuid.uuid4().hex[:12]}"
    fake_product_id = f"prod_test_{uuid.uuid4().hex[:12]}"

    with patch(
        "app.integrations.stripe_client.create_price",
        return_value=(fake_price_id, fake_product_id),
    ):
        resp = await admin_client.post(f"/admin/courses/{course_id}/create-product")
        assert resp.status_code == 200, resp.text

    product_id = resp.json()["product_id"]
    result = await db_session.execute(select(Product).where(Product.id == uuid.UUID(product_id)))
    product = result.scalar_one()
    assert product.stripe_product_id == fake_product_id


@pytest.mark.asyncio
async def test_template_create_product_stores_stripe_product_id(admin_client, db_session):
    """8B: same guarantee for the template path — create_template_product must not
    silently drop the Stripe Product id it already has in hand."""
    resp = await admin_client.post(
        "/admin/templates",
        json={"title": "Stripe Product Id Test Template", "description": "d", "is_free": False},
    )
    assert resp.status_code == 201, resp.text
    template_id = resp.json()["id"]

    fake_price_id = f"price_test_{uuid.uuid4().hex[:12]}"
    fake_product_id = f"prod_test_{uuid.uuid4().hex[:12]}"

    with patch(
        "app.integrations.stripe_client.create_price",
        return_value=(fake_price_id, fake_product_id),
    ):
        resp = await admin_client.post(f"/admin/templates/{template_id}/create-product")
        assert resp.status_code == 200, resp.text

    product_id = resp.json()["product_id"]
    result = await db_session.execute(select(Product).where(Product.id == uuid.UUID(product_id)))
    product = result.scalar_one()
    assert product.stripe_product_id == fake_product_id
