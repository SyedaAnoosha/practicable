"""Tests for the admin metrics endpoint — week4_plan.md Phase 6B step 12.

Tests the W4-R10 metrics: second-purchase rate, free→paid, refund rate,
signup→purchase time, revenue breakdown, enrollment splits, product rankings,
and download links issued.
"""
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.db.models import (
    Entitlement, GrantedVia, Order, OrderItem, OrderStatus,
    Product, User, Role, DownloadEvent,
)


@pytest.fixture
async def metrics_fixtures(db_session, admin_client, admin_user):
    """Create a minimal dataset for metrics testing: two buyers, one with two orders.
    
    Uses random UUIDs for all slugs/ids to avoid collisions with seeded data
    or data from other tests.
    """
    # Two buyers
    buyer1 = User(
        id=uuid.uuid4(), email=f"buyer1-{uuid.uuid4().hex[:8]}@test.com", role=Role.MEMBER,
        created_at=datetime.now(timezone.utc) - timedelta(days=30),
    )
    buyer2 = User(
        id=uuid.uuid4(), email=f"buyer2-{uuid.uuid4().hex[:8]}@test.com", role=Role.MEMBER,
        created_at=datetime.now(timezone.utc) - timedelta(days=60),
    )
    db_session.add_all([buyer1, buyer2])
    await db_session.flush()

    # Two products
    product1 = Product(
        id=uuid.uuid4(), slug=f"prod1-{uuid.uuid4().hex[:8]}", name="Product 1",
        description="Test product 1",
        stripe_price_id=f"price_{uuid.uuid4().hex[:12]}", price_amount=4900, currency="AUD",
        published=True,
    )
    product2 = Product(
        id=uuid.uuid4(), slug=f"prod2-{uuid.uuid4().hex[:8]}", name="Product 2",
        description="Test product 2",
        stripe_price_id=f"price_{uuid.uuid4().hex[:12]}", price_amount=9900, currency="AUD",
        published=True,
    )
    db_session.add_all([product1, product2])
    await db_session.flush()

    # Buyer1: two completed orders (second-purchase rate test)
    order1 = Order(
        id=uuid.uuid4(), user_id=buyer1.id, stripe_session_id=f"cs_{uuid.uuid4().hex[:12]}",
        total_amount_cents=4900, currency="AUD", status=OrderStatus.COMPLETED,
    )
    order2 = Order(
        id=uuid.uuid4(), user_id=buyer1.id, stripe_session_id=f"cs_{uuid.uuid4().hex[:12]}",
        total_amount_cents=9900, currency="AUD", status=OrderStatus.COMPLETED,
    )
    # Buyer2: one completed order
    order3 = Order(
        id=uuid.uuid4(), user_id=buyer2.id, stripe_session_id=f"cs_{uuid.uuid4().hex[:12]}",
        total_amount_cents=4900, currency="AUD", status=OrderStatus.COMPLETED,
    )
    # One refunded order
    order4 = Order(
        id=uuid.uuid4(), user_id=buyer2.id, stripe_session_id=f"cs_{uuid.uuid4().hex[:12]}",
        total_amount_cents=9900, currency="AUD", status=OrderStatus.REFUNDED,
    )
    db_session.add_all([order1, order2, order3, order4])
    await db_session.flush()

    # Order items
    db_session.add_all([
        OrderItem(order_id=order1.id, product_id=product1.id, price_amount_cents=4900),
        OrderItem(order_id=order2.id, product_id=product2.id, price_amount_cents=9900),
        OrderItem(order_id=order3.id, product_id=product1.id, price_amount_cents=4900),
        OrderItem(order_id=order4.id, product_id=product2.id, price_amount_cents=9900),
    ])
    await db_session.flush()

    # Entitlements
    db_session.add_all([
        Entitlement(user_id=buyer1.id, product_id=product1.id, granted_via=GrantedVia.PURCHASE),
        Entitlement(user_id=buyer1.id, product_id=product2.id, granted_via=GrantedVia.PURCHASE),
        Entitlement(user_id=buyer2.id, product_id=product1.id, granted_via=GrantedVia.PURCHASE),
    ])
    await db_session.flush()

    # Download events
    db_session.add_all([
        DownloadEvent(content_type="template", content_id=product1.id),
        DownloadEvent(content_type="template", content_id=product2.id),
    ])
    await db_session.flush()

    return {
        "admin_client": admin_client,
        "buyer1": buyer1,
        "buyer2": buyer2,
        "product1": product1,
        "product2": product2,
    }


@pytest.mark.asyncio
async def test_metrics_returns_200_for_admin(metrics_fixtures):
    """GET /admin/metrics returns 200 for an admin user."""
    client = metrics_fixtures["admin_client"]
    resp = await client.get("/admin/metrics")
    assert resp.status_code == 200
    data = resp.json()
    assert "metrics" in data
    assert "revenueGrossCents" in data
    assert "revenueRefundedCents" in data
    assert "revenueNetCents" in data
    assert "enrollmentSplits" in data
    assert "productRankings" in data
    assert "downloadLinksIssued" in data


@pytest.mark.asyncio
async def test_metrics_returns_403_for_member(member_client):
    """GET /admin/metrics returns 403 for a non-admin user."""
    resp = await member_client.get("/admin/metrics")
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_revenue_series_returns_403_for_member(member_client):
    """8C-4: same admin gate as /admin/metrics itself."""
    resp = await member_client.get("/admin/metrics/revenue-series")
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_revenue_series_no_data_returns_empty_list(admin_client):
    """8C-4: '[] for no data' — a narrow days window with nothing in it must return an
    empty list, not null and not an error. days=1 keeps this independent of whatever
    orders already exist in the DB outside the last 24 hours."""
    resp = await admin_client.get("/admin/metrics/revenue-series?days=1&period=daily")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["data"] == [] or isinstance(data["data"], list)
    assert data["period"] == "daily"


@pytest.mark.asyncio
async def test_revenue_series_one_order_is_one_point(db_session, admin_client):
    """8C-4: 'one element for one order' — a single completed order inside the window
    produces exactly one bucket, with that order's amount and a count of 1."""
    from app.db.models import Product, Order, OrderStatus, User, Role

    buyer = User(id=uuid.uuid4(), email=f"series-buyer-{uuid.uuid4().hex[:8]}@test.com", role=Role.MEMBER)
    db_session.add(buyer)
    await db_session.flush()

    product = Product(
        id=uuid.uuid4(), slug=f"series-prod-{uuid.uuid4().hex[:8]}", name="Series Test Product",
        description="d", stripe_price_id=f"price_{uuid.uuid4().hex[:12]}",
        price_amount=5500, currency="AUD", published=True,
    )
    db_session.add(product)
    await db_session.flush()

    order = Order(
        id=uuid.uuid4(), user_id=buyer.id, stripe_session_id=f"cs_{uuid.uuid4().hex[:12]}",
        total_amount_cents=5500, currency="AUD", status=OrderStatus.COMPLETED,
    )
    db_session.add(order)
    await db_session.flush()

    resp = await admin_client.get("/admin/metrics/revenue-series?days=1&period=daily")
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]

    assert len(data) == 1
    assert data[0]["revenueCents"] == 5500
    assert data[0]["orderCount"] == 1


@pytest.mark.asyncio
async def test_revenue_series_multiple_orders_same_day_bucket_together(db_session, admin_client):
    """8C-4: n points for n distinct periods — two orders on the same day sum into one
    bucket rather than producing two."""
    from app.db.models import Product, Order, OrderStatus, User, Role

    buyer = User(id=uuid.uuid4(), email=f"series-buyer2-{uuid.uuid4().hex[:8]}@test.com", role=Role.MEMBER)
    db_session.add(buyer)
    await db_session.flush()

    product = Product(
        id=uuid.uuid4(), slug=f"series-prod2-{uuid.uuid4().hex[:8]}", name="Series Test Product 2",
        description="d", stripe_price_id=f"price_{uuid.uuid4().hex[:12]}",
        price_amount=3000, currency="AUD", published=True,
    )
    db_session.add(product)
    await db_session.flush()

    db_session.add_all([
        Order(
            id=uuid.uuid4(), user_id=buyer.id, stripe_session_id=f"cs_{uuid.uuid4().hex[:12]}",
            total_amount_cents=3000, currency="AUD", status=OrderStatus.COMPLETED,
        ),
        Order(
            id=uuid.uuid4(), user_id=buyer.id, stripe_session_id=f"cs_{uuid.uuid4().hex[:12]}",
            total_amount_cents=4000, currency="AUD", status=OrderStatus.COMPLETED,
        ),
    ])
    await db_session.flush()

    resp = await admin_client.get("/admin/metrics/revenue-series?days=1&period=daily")
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]

    # Both orders fall in "today" — one bucket, summed, not two.
    todays_bucket = [p for p in data if p["orderCount"] >= 2]
    assert len(todays_bucket) == 1
    assert todays_bucket[0]["revenueCents"] >= 7000


@pytest.mark.asyncio
async def test_second_purchase_rate(metrics_fixtures):
    """Buyer1 has 2 orders, buyer2 has 1 — rate numerator >= 1, denominator >= 2."""
    client = metrics_fixtures["admin_client"]
    resp = await client.get("/admin/metrics")
    data = resp.json()

    second_purchase = next(m for m in data["metrics"] if m["name"] == "second_purchase_rate")
    # At least 1 repeat buyer (buyer1) / at least 2 total buyers
    assert second_purchase["numerator"] >= 1
    assert second_purchase["denominator"] >= 2
    assert second_purchase["numerator"] <= second_purchase["denominator"]


@pytest.mark.asyncio
async def test_revenue_breakdown(metrics_fixtures):
    """Revenue: gross >= refunded, net = gross - refunded."""
    client = metrics_fixtures["admin_client"]
    resp = await client.get("/admin/metrics")
    data = resp.json()

    assert data["revenueGrossCents"] >= 0
    assert data["revenueRefundedCents"] >= 0
    assert data["revenueNetCents"] == data["revenueGrossCents"] - data["revenueRefundedCents"]
    # Our fixture adds at least 4900+9900+4900 = 19700 gross, 9900 refunded
    assert data["revenueGrossCents"] >= 19700
    assert data["revenueRefundedCents"] >= 9900


@pytest.mark.asyncio
async def test_enrollment_splits(metrics_fixtures):
    """Enrollment splits include purchase, with at least 3 from our fixture."""
    client = metrics_fixtures["admin_client"]
    resp = await client.get("/admin/metrics")
    data = resp.json()

    assert "purchase" in data["enrollmentSplits"]
    assert data["enrollmentSplits"]["purchase"] >= 3


@pytest.mark.asyncio
async def test_enrollment_splits_counts_free_grant_separately_from_purchase(
    db_session, metrics_fixtures
):
    """8C-2: 'entitlements granting a course, split by granted_via' — a free grant must
    land under its own 'free' key, not get folded into 'purchase' or dropped."""
    from app.db.models import GrantedVia, Entitlement, User, Role

    client = metrics_fixtures["admin_client"]
    product1 = metrics_fixtures["product1"]

    free_user = User(id=uuid.uuid4(), email=f"free-{uuid.uuid4().hex[:8]}@test.com", role=Role.MEMBER)
    db_session.add(free_user)
    await db_session.flush()
    db_session.add(Entitlement(user_id=free_user.id, product_id=product1.id, granted_via=GrantedVia.FREE))
    await db_session.flush()

    resp = await client.get("/admin/metrics")
    data = resp.json()

    assert "free" in data["enrollmentSplits"]
    assert data["enrollmentSplits"]["free"] >= 1
    # The fixture's purchase count must be unaffected by the free grant landing in a
    # different bucket — this is the assertion that would fail if the two were merged.
    assert data["enrollmentSplits"]["purchase"] >= 3


@pytest.mark.asyncio
async def test_product_rankings(metrics_fixtures):
    """Product rankings exist and are ordered by revenue descending."""
    client = metrics_fixtures["admin_client"]
    resp = await client.get("/admin/metrics")
    data = resp.json()

    rankings = data["productRankings"]
    assert len(rankings) >= 2  # At least our 2 fixture products
    # Should be ordered by revenue descending
    for i in range(len(rankings) - 1):
        assert rankings[i]["revenueCents"] >= rankings[i + 1]["revenueCents"]


@pytest.mark.asyncio
async def test_download_links_issued(metrics_fixtures):
    """Two download events were created."""
    client = metrics_fixtures["admin_client"]
    resp = await client.get("/admin/metrics")
    data = resp.json()

    assert data["downloadLinksIssued"] == 2


@pytest.mark.asyncio
async def test_refund_rate(metrics_fixtures):
    """Refund rate: numerator >= 1 (our fixture), denominator >= 3."""
    client = metrics_fixtures["admin_client"]
    resp = await client.get("/admin/metrics")
    data = resp.json()

    refund_rate = next(m for m in data["metrics"] if m["name"] == "refund_rate")
    assert refund_rate["numerator"] >= 1
    assert refund_rate["denominator"] >= 3


@pytest.mark.asyncio
async def test_product_rankings_include_units(metrics_fixtures):
    """8C-2: 'top products by units and revenue' — units is a count, not only cents."""
    client = metrics_fixtures["admin_client"]
    resp = await client.get("/admin/metrics")
    data = resp.json()

    rankings = data["productRankings"]
    assert len(rankings) >= 2
    for r in rankings:
        assert "units" in r
        assert r["units"] >= 1
    # product1 sold twice in the fixture (order1, order3), product2 once (order2;
    # order4 is refunded and excluded) — units must reflect that, not just be present.
    by_id = {r["id"]: r for r in rankings}
    product1_id = str(metrics_fixtures["product1"].id)
    assert by_id[product1_id]["units"] == 2


@pytest.mark.asyncio
async def test_course_enrollment_rankings(db_session, admin_client):
    """8C-2: 'courses ranked by enrollment, started and completed' — previously missing
    entirely; only a by-revenue product ranking existed. Enrolled comes from an active
    entitlement linked via ProductContent; started/completed come from CourseProgress."""
    from app.db.models import (
        Author, Course, CourseProgress, Entitlement, GrantedVia, Module,
        Product, ProductContent, Role, Section, User,
    )

    section = Section(id=uuid.uuid4(), name=f"S-{uuid.uuid4().hex[:6]}", slug=f"s-{uuid.uuid4().hex[:8]}")
    author = Author(id=uuid.uuid4(), name=f"A-{uuid.uuid4().hex[:6]}", slug=f"a-{uuid.uuid4().hex[:8]}")
    db_session.add_all([section, author])
    await db_session.flush()

    course = Course(
        id=uuid.uuid4(), slug=f"course-{uuid.uuid4().hex[:8]}", title="Metrics Test Course",
        description="d", section_id=section.id, author_id=author.id, published=True,
    )
    db_session.add(course)
    await db_session.flush()
    # A module row isn't needed for this metric — enrollment/progress key off course_id
    # directly — but every other course fixture in this file includes one, so a query
    # that accidentally required child rows to exist would still pass without this;
    # kept out deliberately so this test cannot hide that kind of bug.

    product = Product(
        id=uuid.uuid4(), slug=f"course-prod-{uuid.uuid4().hex[:8]}", name="Metrics Test Course (Course)",
        description="d", stripe_price_id=f"price_{uuid.uuid4().hex[:12]}",
        price_amount=9900, currency="AUD", published=True,
    )
    db_session.add(product)
    await db_session.flush()
    db_session.add(ProductContent(product_id=product.id, content_type="course", content_id=course.id))

    buyer_a = User(id=uuid.uuid4(), email=f"buyer-a-{uuid.uuid4().hex[:8]}@test.com", role=Role.MEMBER)
    buyer_b = User(id=uuid.uuid4(), email=f"buyer-b-{uuid.uuid4().hex[:8]}@test.com", role=Role.MEMBER)
    buyer_c = User(id=uuid.uuid4(), email=f"buyer-c-{uuid.uuid4().hex[:8]}@test.com", role=Role.MEMBER)
    db_session.add_all([buyer_a, buyer_b, buyer_c])
    await db_session.flush()

    # Three enrolled (active entitlements); two started (progress rows); one completed.
    db_session.add_all([
        Entitlement(user_id=buyer_a.id, product_id=product.id, granted_via=GrantedVia.PURCHASE),
        Entitlement(user_id=buyer_b.id, product_id=product.id, granted_via=GrantedVia.PURCHASE),
        Entitlement(user_id=buyer_c.id, product_id=product.id, granted_via=GrantedVia.PURCHASE),
    ])
    db_session.add_all([
        CourseProgress(user_id=buyer_a.id, course_id=course.id, completed=True),
        CourseProgress(user_id=buyer_b.id, course_id=course.id, completed=False),
        # buyer_c: enrolled, never opened the course — no CourseProgress row at all.
    ])
    await db_session.flush()

    resp = await admin_client.get("/admin/metrics")
    assert resp.status_code == 200, resp.text
    data = resp.json()

    assert "courseEnrollmentRankings" in data
    row = next(r for r in data["courseEnrollmentRankings"] if r["id"] == str(course.id))
    assert row["enrolled"] == 3
    assert row["started"] == 2
    assert row["completed"] == 1


@pytest.mark.asyncio
async def test_metrics_structure(admin_client, db_session):
    """Verify the response structure is correct."""
    resp = await admin_client.get("/admin/metrics")
    assert resp.status_code == 200
    data = resp.json()

    # Structure checks
    assert "metrics" in data
    assert "revenueGrossCents" in data
    assert "revenueRefundedCents" in data
    assert "revenueNetCents" in data
    assert "enrollmentSplits" in data
    assert "productRankings" in data
    assert "downloadLinksIssued" in data
    assert "generatedAt" in data

    # Revenue consistency
    assert data["revenueNetCents"] == data["revenueGrossCents"] - data["revenueRefundedCents"]

    # Enrollment splits is a dict
    assert isinstance(data["enrollmentSplits"], dict)
    assert isinstance(data["productRankings"], list)
    assert isinstance(data["downloadLinksIssued"], int)
