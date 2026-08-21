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
    Question,
    Role,
    Template,
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

    # ── Step 1b: Admin adds a module and a lesson BEFORE the course is purchasable —
    # so create-product's own grant (grant_course_lessons) is exercised, not just
    # create_lesson's. A second lesson is added AFTER create-product below, which is
    # the exact scenario the 2026-08-21 owner report found broken.
    resp = await admin_client.post(f"/admin/courses/{course_id}/modules", json={"title": "Module 1"})
    assert resp.status_code == 201, resp.text
    module_id = resp.json()["modules"][0]["id"]

    resp = await admin_client.post(
        f"/admin/modules/{module_id}/lessons",
        json={"title": "Lesson added before purchase", "lesson_type": "reading", "body": "before"},
    )
    assert resp.status_code == 201, resp.text
    lesson_before_id = next(
        l["id"] for m in resp.json()["modules"] for l in m["lessons"] if l["title"] == "Lesson added before purchase"
    )

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

    # ── Step 2b: Admin adds a SECOND lesson AFTER the course is already purchasable —
    # this is the exact owner-reported scenario (2026-08-21): a lesson added to an
    # already-published, already-purchased course showed locked to a buyer who owned
    # the course. create_lesson's own grant_course_lessons call is what this exercises.
    resp = await admin_client.post(
        f"/admin/modules/{module_id}/lessons",
        json={"title": "Lesson added after purchase", "lesson_type": "reading", "body": "after"},
    )
    assert resp.status_code == 201, resp.text
    lesson_after_id = next(
        l["id"] for m in resp.json()["modules"] for l in m["lessons"] if l["title"] == "Lesson added after purchase"
    )

    # Both lessons need to be published for the member-facing sidebar/lesson-detail
    # endpoints to return them at all (Lesson.published.is_(True) filters in
    # content/lessons.py) — separate from the entitlement check step 8 below actually
    # exercises.
    for lid in (lesson_before_id, lesson_after_id):
        resp = await admin_client.post(f"/admin/lessons/{lid}/publish", json={"published": True, "publish_state": "published"})
        assert resp.status_code == 200, resp.text

    # The course itself must be published too — /courses/{slug} (step 8 below) filters
    # on Course.published.is_(True), separate from the product's own published flag.
    resp = await admin_client.post(
        f"/admin/courses/{course_id}/publish", json={"published": True, "publish_state": "published"}
    )
    assert resp.status_code == 200, resp.text

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
    # Found live 2026-08-21: this assertion previously read `g.course` — content_graph's
    # OWN pre-built course, granted via a completely different product (`lesson_product`,
    # set up by the fixture itself) — not "E2E Purchase Test Course", the course this
    # test actually just purchased. It never checked that THIS purchase unlocked
    # anything. Fixed to add a real lesson to the purchased course and check it by name.
    resp = await member_client.get(f"/courses/{course_data['slug']}")
    assert resp.status_code == 200, resp.text
    lessons = resp.json().get("modules", [{}])[0].get("lessons", [])
    assert len(lessons) > 0, "Course has no lessons"
    for lesson_summary in lessons:
        resp = await member_client.get(f"/courses/{course_data['slug']}/lessons/{lesson_summary['slug']}")
        assert resp.status_code == 200, resp.text
        sidebar_lessons = [
            l for m in resp.json()["modules"] for l in m["lessons"] if l["id"] == lesson_summary["id"]
        ]
        assert sidebar_lessons and sidebar_lessons[0]["locked"] is False, (
            f"Lesson '{lesson_summary['title']}' still shows locked after purchase"
        )


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


@pytest.mark.asyncio
async def test_pack_purchase_e2e(
    admin_client,
    member_client,
    member_user,
    db_session,
    content_graph,
):
    """week4_plan.md §9A step 7: the same end-to-end purchase path proven for courses
    and templates, run a third time for a pack — create in admin -> make purchasable ->
    set price -> publish -> Stripe test-mode checkout -> webhook -> entitlement ->
    content opens. Found missing 2026-08-21: test_course_purchase_e2e.py covered course
    and template only; the DoD line claiming "3 tests... course, template, pack" had no
    pack coverage anywhere in the repo (confirmed by grep — zero "pack" matches in this
    file before this test).

    Unlike course/template, pack creation is a single call (POST /admin/packs) that
    creates the Stripe price and the Product row together, and requires >=1 template
    and >=1 question_set content row at creation time — content/packs.py's own publish
    guard (verified separately) enforces the same constraint again at publish.
    """
    # ── Step 1: A template (the PDF) and a question to build the pack from ─────
    # Built directly against the models, not POST /admin/templates: that endpoint
    # leaves storage_key/file_name null (no file upload step in this test), and
    # step 8's download-url call below needs a real key to reach a genuine ok/fail on
    # the *gating*, not a storage-client error. Own rows, not content_graph's
    # g.pack_pdf/g.pack_question — those already belong to g.pack_product, and the
    # content-overlap publish guard correctly refuses a second published product
    # claiming the same content (proven live: reusing them 409s here, guard working).
    g = content_graph
    own_template = Template(
        slug=f"pack-e2e-pdf-{uuid.uuid4().hex[:8]}", title="Pack E2E PDF Template", description="d",
        section_id=g.section.id, author_id=g.author.id,
        storage_key=f"test/{uuid.uuid4().hex}.pdf", file_name="pack-e2e.pdf",
        file_size_bytes=4096, mime_type="application/pdf",
        published=True, is_free=False,
    )
    own_question = Question(
        slug=f"pack-e2e-question-{uuid.uuid4().hex[:8]}", title="Pack E2E Question", subtitle="d",
        body="THE-PACK-E2E-QUESTION-BODY", preview="preview", domain_id=g.domain.id, published=True,
    )
    db_session.add_all([own_template, own_question])
    await db_session.flush()

    template_id = str(own_template.id)
    question_id = str(own_question.id)
    question_slug = own_question.slug

    # ── Step 2: Admin creates the pack — Stripe price + Product row together ───
    fake_price_id = f"price_test_{uuid.uuid4().hex[:12]}"
    fake_product_id = f"prod_test_{uuid.uuid4().hex[:12]}"

    with patch(
        "app.api.v1.admin.packs.create_price",
        return_value=(fake_price_id, fake_product_id),
    ) as create_price_mock:
        resp = await admin_client.post(
            "/admin/packs",
            json={
                "name": "E2E Purchase Test Pack",
                "description": "A pack to test the full purchase flow.",
                "price_amount": 4900,
                "currency": "AUD",
                "contents": [
                    {"content_type": "template", "content_id": template_id},
                    {"content_type": "question_set", "content_id": question_id},
                ],
            },
        )
        assert resp.status_code == 201, resp.text
        create_price_mock.assert_called_once()

    pack = resp.json()
    product_id = pack["id"]
    assert pack["stripe_price_id"] == fake_price_id
    assert pack["published"] is False
    assert pack["template_count"] == 1
    assert pack["question_count"] == 1

    # ── Step 3: Admin publishes the pack (shared /admin/products endpoint) ─────
    with patch(
        "app.api.v1.admin.products.check_stripe_price",
        return_value=MagicMock(ok=True, message="OK"),
    ):
        resp = await admin_client.post(
            f"/admin/products/{product_id}/publish",
            json={"published": True, "publish_state": "published"},
        )
        assert resp.status_code == 200, resp.text

    product_result = await db_session.execute(
        select(Product).where(Product.id == uuid.UUID(product_id))
    )
    product = product_result.scalar_one()
    assert product.published is True

    # ── Step 4: Buyer initiates checkout ────────────────────────────────────────
    fake_session = MagicMock()
    fake_session.url = "https://checkout.stripe.com/test-pack-session-url"

    with patch(
        "app.api.v1.commerce.checkout.create_checkout_session",
        return_value=fake_session,
    ) as checkout_mock:
        resp = await member_client.post(
            "/checkout/session",
            json={"product_ids": [product_id]},
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["checkout_url"] == fake_session.url
        checkout_mock.assert_called_once()

    # ── Step 5: Stripe webhook fires (checkout.session.completed) ──────────────
    event_id = f"evt_pack_e2e_{uuid.uuid4().hex[:16]}"
    stripe_session_id = f"cs_test_pack_{uuid.uuid4().hex[:16]}"
    payment_intent_id = f"pi_test_pack_{uuid.uuid4().hex[:16]}"

    fake_event = {
        "id": event_id,
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": stripe_session_id,
                "payment_intent": payment_intent_id,
                "amount_total": 4900,
                "currency": "aud",
                "metadata": {
                    "user_id": str(member_user.id),
                    "product_ids": product_id,
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

    # ── Step 6: Assert entitlement exists ───────────────────────────────────────
    ent_result = await db_session.execute(
        select(Entitlement).where(
            Entitlement.user_id == member_user.id,
            Entitlement.product_id == uuid.UUID(product_id),
        )
    )
    entitlement = ent_result.scalar_one_or_none()
    assert entitlement is not None, "Entitlement was not created after webhook"
    assert entitlement.granted_via.value == "purchase"

    # ── Step 7: Assert order was created ────────────────────────────────────────
    order_result = await db_session.execute(
        select(Order).where(
            Order.user_id == member_user.id,
            Order.stripe_session_id == stripe_session_id,
        )
    )
    order = order_result.scalar_one_or_none()
    assert order is not None, "Order was not created"
    assert order.status == OrderStatus.COMPLETED
    assert order.total_amount_cents == 4900

    # ── Step 8: Buyer can now access the pack's gated content (the template PDF) ─
    resp = await member_client.get(f"/templates/{template_id}/download-url")
    assert resp.status_code == 200, resp.text

    # ── Step 9: The pack's question stays free regardless — never gated by the pack ─
    resp = await member_client.get(f"/questions/{question_slug}")
    assert resp.status_code == 200, resp.text
    assert resp.json()["body"] == "THE-PACK-E2E-QUESTION-BODY"


@pytest.mark.asyncio
async def test_template_in_a_pack_does_not_crash_the_templates_list(
    admin_client, db_session, content_graph,
):
    """Found live 2026-08-21, mid-Phase-9A-re-verification: a template that is BOTH
    sold standalone AND included in a pack has two ProductContent rows referencing
    it — admin/templates.py's _to_out used scalar_one_or_none() assuming exactly one,
    which crashed GET /admin/templates with MultipleResultsFound the moment a real
    template ended up in both states (observed directly on the dev server's own
    /admin/templates page, not just in a test). The same bad assumption also broke
    POST /admin/templates/{id}/create-product's own "does a product already exist"
    check the same way. This proves both call sites survive the overlap.
    """
    g = content_graph

    # A fresh template, not content_graph's own g.paid_template — that one already
    # has a standalone product (g.template_product) wired in by the fixture itself,
    # which would make this test's own create-product call 409 before it ever
    # reaches the overlap this test exists to prove.
    tpl_resp = await admin_client.post(
        "/admin/templates",
        json={"title": "Overlap Test Template", "description": "d", "is_free": False},
    )
    assert tpl_resp.status_code == 201, tpl_resp.text
    template_id = tpl_resp.json()["id"]

    # Give it a standalone product via the real endpoint...
    fake_price_id = f"price_test_{uuid.uuid4().hex[:12]}"
    fake_product_id = f"prod_test_{uuid.uuid4().hex[:12]}"
    with patch(
        "app.integrations.stripe_client.create_price",
        return_value=(fake_price_id, fake_product_id),
    ):
        resp = await admin_client.post(f"/admin/templates/{template_id}/create-product")
        assert resp.status_code == 200, resp.text

    # ...then also put the SAME template into a pack, alongside a question.
    q_resp = await admin_client.post(
        "/admin/questions",
        json={
            "title": "Overlap Test Question", "subtitle": "d",
            "body": "d", "difficulty": "easy", "domain_id": str(g.domain.id),
        },
    )
    assert q_resp.status_code == 201, q_resp.text

    with patch(
        "app.api.v1.admin.packs.create_price",
        return_value=(f"price_pack_{uuid.uuid4().hex[:12]}", f"prod_pack_{uuid.uuid4().hex[:12]}"),
    ):
        pack_resp = await admin_client.post(
            "/admin/packs",
            json={
                "name": "Overlap Test Pack", "description": "d",
                "price_amount": 3900, "currency": "AUD",
                "contents": [
                    {"content_type": "template", "content_id": template_id},
                    {"content_type": "question_set", "content_id": q_resp.json()["id"]},
                ],
            },
        )
        assert pack_resp.status_code == 201, pack_resp.text

    # This is the crash: GET /admin/templates must not 500.
    list_resp = await admin_client.get("/admin/templates")
    assert list_resp.status_code == 200, list_resp.text
    row = next(r for r in list_resp.json() if r["id"] == template_id)
    assert row["product_id"] is not None  # the standalone product, not the pack's

    # And create-product's own duplicate check must still correctly 409, not 500,
    # for a template that already has its OWN standalone product.
    dup_resp = await admin_client.post(f"/admin/templates/{template_id}/create-product")
    assert dup_resp.status_code == 409, dup_resp.text
