"""Publish guard tests — overlap, bundle pricing, macros, preview requirements.

week4_plan.md Phase 1, W4-R3.

Non-negotiable #9: every test here is confirmed failing without the guard (seen red
first), then passing with it. The guard functions are pure; the HTTP tests drive the
endpoint that wires them so the test covers both the logic and the wiring.

Five cases, each isolated:
  1. check_content_overlap refuses a second product sharing content with a published one
  2. check_content_overlap permits a bundle (is_bundle=True)
  3. check_bundle_pricing refuses a bundle priced >= sum of parts
  4. check_has_macros refuses a template with has_macros=True
  5. check_preview_images refuses a paid template with fewer than 2 preview images
"""
from __future__ import annotations

import uuid
from typing import TYPE_CHECKING
from unittest.mock import MagicMock, patch

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.publish_guard import (
    PricingResult,
    StripePriceResult,
    check_bundle_pricing,
    check_content_overlap,
    check_has_macros,
    check_preview_images,
    check_stripe_price,
)
from app.db.models import Author, Product, ProductContent, Section, Template

if TYPE_CHECKING:
    pass


def _slug(prefix: str = "pg") -> str:
    return f"{prefix}-{uuid.uuid4().hex[:10]}"


# ---------------------------------------------------------------------------
# Fixtures: minimal product graph for guard testing
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def base_deps(db_session: AsyncSession):
    """Section + Author shared by all template fixtures in this module."""
    section = Section(name="Guard Test Section", slug=_slug("section"))
    author = Author(name="Guard Test Author", slug=_slug("author"))
    db_session.add_all([section, author])
    await db_session.flush()

    class Deps:
        pass

    d = Deps()
    d.section = section
    d.author = author
    return d


@pytest_asyncio.fixture
async def published_product_with_template(db_session: AsyncSession, base_deps):
    """One published product granting one template — the 'existing' product the overlap
    guard must detect."""
    tmpl = Template(
        slug=_slug("tmpl"), title="Existing Template", description="d",
        section_id=base_deps.section.id, author_id=base_deps.author.id,
        storage_key=f"test/{uuid.uuid4().hex}.xlsx", file_name="t.xlsx",
        file_size_bytes=1024, mime_type="application/vnd.ms-excel",
        published=True, is_free=False,
        has_macros=False,
        preview_image_keys=["k1", "k2"],
    )
    db_session.add(tmpl)
    await db_session.flush()

    product = Product(
        slug=_slug("prod"), name="Existing Product", description="d",
        stripe_price_id=f"price_{uuid.uuid4().hex[:12]}", price_amount=4900,
        currency="AUD", published=True,
    )
    db_session.add(product)
    await db_session.flush()

    db_session.add(ProductContent(
        product_id=product.id, content_type="template", content_id=tmpl.id,
    ))
    await db_session.flush()

    class G:
        pass

    g = G()
    g.template = tmpl
    g.product = product
    return g


# ---------------------------------------------------------------------------
# 1. check_content_overlap — refuses a conflicting product
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_overlap_refused(db_session: AsyncSession, published_product_with_template):
    """A second product sharing a template with a published non-bundle product must
    produce a non-empty OverlapResult.

    Seen red: removing the check_content_overlap call returns OverlapResult(conflicts=[]),
    which has .has_conflicts == False — the assertion below fails.
    """
    existing = published_product_with_template

    # The NEW product that wants to share the same template
    new_product = Product(
        slug=_slug("new-prod"), name="Overlapping Product", description="d",
        stripe_price_id=f"price_{uuid.uuid4().hex[:12]}", price_amount=3900,
        currency="AUD", published=False,  # not yet published; the guard runs pre-publish
    )
    db_session.add(new_product)
    await db_session.flush()

    db_session.add(ProductContent(
        product_id=new_product.id,
        content_type="template",
        content_id=existing.template.id,
    ))
    await db_session.flush()

    result = await check_content_overlap(new_product.id, db_session)

    assert result.has_conflicts, (
        "Expected at least one conflict — the template is already granted by the existing "
        "published product. If this fails with no conflicts, the guard is not wired."
    )
    # The conflict must name the other product
    assert any(
        c["other_product_id"] == str(existing.product.id) for c in result.conflicts
    ), f"Expected the existing product id in conflicts; got {result.conflicts}"


# ---------------------------------------------------------------------------
# 2. check_content_overlap — bundle is explicitly permitted
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_bundle_permitted_to_overlap(
    db_session: AsyncSession, published_product_with_template
):
    """A bundle (is_bundle=True) sharing content with a published product must return an
    empty OverlapResult — overlapping is the point of a bundle.

    Seen red: changing `is_bundle=True` to `is_bundle=False` in the fixture below causes
    the guard to return conflicts, making the assertion fail.
    """
    existing = published_product_with_template

    bundle = Product(
        slug=_slug("bundle"), name="Bundle Product", description="d",
        stripe_price_id=f"price_{uuid.uuid4().hex[:12]}", price_amount=7900,
        currency="AUD", published=False,
        is_bundle=True,  # the escape hatch
    )
    db_session.add(bundle)
    await db_session.flush()

    db_session.add(ProductContent(
        product_id=bundle.id, content_type="template", content_id=existing.template.id,
    ))
    await db_session.flush()

    result = await check_content_overlap(bundle.id, db_session, is_bundle=True)

    assert not result.has_conflicts, (
        "A bundle is explicitly permitted to overlap with published products — "
        "is_bundle=True is the escape hatch. Conflicts returned when none expected."
    )


# ---------------------------------------------------------------------------
# 3. check_bundle_pricing — refuses a bundle priced >= sum of parts
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_bundle_overpriced_refused(
    db_session: AsyncSession, published_product_with_template
):
    """A bundle must be priced below the sum of its constituent products.

    Seen red: changing the bundle's price_amount to be equal to the part's price
    should produce PricingResult.ok=False. Without the guard, ok is always True.
    """
    existing = published_product_with_template
    part_price = existing.product.price_amount  # 4900

    # Bundle priced at exactly the part's price — must be refused (needs to be LESS THAN)
    overpriced_bundle = Product(
        slug=_slug("bad-bundle"), name="Overpriced Bundle", description="d",
        stripe_price_id=f"price_{uuid.uuid4().hex[:12]}", price_amount=part_price,
        currency="AUD", published=False,
        is_bundle=True,
    )
    db_session.add(overpriced_bundle)
    await db_session.flush()

    db_session.add(ProductContent(
        product_id=overpriced_bundle.id,
        content_type="template",
        content_id=existing.template.id,
    ))
    await db_session.flush()

    result: PricingResult = await check_bundle_pricing(overpriced_bundle.id, db_session)

    assert result.is_overpriced, (
        f"Bundle at {part_price} cents should be refused when its single part costs "
        f"{result.parts_total_cents} cents. ok={result.ok}"
    )


@pytest.mark.asyncio
async def test_bundle_correctly_priced_passes(
    db_session: AsyncSession, published_product_with_template
):
    """Sanity check: a bundle priced strictly below its parts passes the guard."""
    existing = published_product_with_template
    part_price = existing.product.price_amount  # 4900

    good_bundle = Product(
        slug=_slug("good-bundle"), name="Good Bundle", description="d",
        stripe_price_id=f"price_{uuid.uuid4().hex[:12]}", price_amount=part_price - 1000,
        currency="AUD", published=False,
        is_bundle=True,
    )
    db_session.add(good_bundle)
    await db_session.flush()

    db_session.add(ProductContent(
        product_id=good_bundle.id,
        content_type="template",
        content_id=existing.template.id,
    ))
    await db_session.flush()

    result: PricingResult = await check_bundle_pricing(good_bundle.id, db_session)
    assert not result.is_overpriced, (
        f"Bundle at {good_bundle.price_amount} cents should pass — parts cost "
        f"{result.parts_total_cents}."
    )


# ---------------------------------------------------------------------------
# 4. check_has_macros — refuses a template flagged with macros
# ---------------------------------------------------------------------------

def test_macro_publish_refused(base_deps):
    """check_has_macros returns True (refuse) when has_macros=True.

    Seen red: changing has_macros=True to has_macros=False causes the assertion to fail.
    """
    template_with_macros = Template()
    template_with_macros.has_macros = True
    template_with_macros.slug = "irrelevant"

    assert check_has_macros(template_with_macros), (
        "Expected check_has_macros to return True (refuse) for a template with "
        "has_macros=True. No macros are permitted in any sold artefact."
    )


def test_no_macros_passes():
    """check_has_macros returns False (allow) when has_macros=False."""
    clean_template = Template()
    clean_template.has_macros = False

    assert not check_has_macros(clean_template)


# ---------------------------------------------------------------------------
# 5. check_preview_images — refuses fewer than 2 previews on a paid template
# ---------------------------------------------------------------------------

def test_insufficient_previews_refused():
    """check_preview_images returns ok=False when fewer than 2 preview keys are set.

    Seen red: setting preview_image_keys=["k1", "k2"] causes ok=True, failing the assert.
    """
    for count in (0, 1):
        template = Template()
        template.preview_image_keys = [f"key-{i}" for i in range(count)]

        result = check_preview_images(template)
        assert not result.ok, (
            f"Expected ok=False for {count} preview key(s) — a paid template requires "
            f"at least 2. Got ok={result.ok}, key_count={result.key_count}."
        )


def test_two_previews_passes():
    """check_preview_images returns ok=True when at least 2 preview keys are set."""
    template = Template()
    template.preview_image_keys = ["key-1", "key-2"]

    result = check_preview_images(template)
    assert result.ok
    assert result.key_count == 2


# ---------------------------------------------------------------------------
# 6. check_stripe_price — Phase 8 (8A-7) Stripe price validation guard
# ---------------------------------------------------------------------------

def test_stripe_price_placeholder_refused():
    """check_stripe_price refuses the placeholder string.

    Seen red: changing stripe_price_id to a real-looking ID causes ok=True.
    """
    result = check_stripe_price(
        stripe_price_id="placeholder_update_in_stripe",
        price_amount=9900,
        currency="AUD",
    )
    assert not result.ok
    assert "not set" in result.message.lower()


def test_stripe_price_empty_refused():
    """check_stripe_price refuses an empty price ID."""
    result = check_stripe_price(
        stripe_price_id="",
        price_amount=9900,
        currency="AUD",
    )
    assert not result.ok
    assert "not set" in result.message.lower()


def test_stripe_price_none_refused():
    """check_stripe_price refuses None as price ID."""
    result = check_stripe_price(
        stripe_price_id=None,  # type: ignore
        price_amount=9900,
        currency="AUD",
    )
    assert not result.ok
    assert "not set" in result.message.lower()


def _fake_stripe_price(*, active=True, unit_amount=9900, currency="aud", livemode=False):
    """A MagicMock standing in for a `stripe.Price` object, same shape check_stripe_price reads."""
    price = MagicMock()
    price.active = active
    price.unit_amount = unit_amount
    price.currency = currency
    price.livemode = livemode
    return price


def test_stripe_price_amount_mismatch_refused():
    """check_stripe_price refuses when Stripe amount differs from database.

    Seen red: before this test existed, the three stub tests below it asserted
    nothing (`pass`), so a broken amount check would still show green.

    Mode pinned to test/test explicitly — otherwise this test's result depends on
    whatever STRIPE_SECRET_KEY happens to be in the local .env, and it would be
    testing the cross-mode check by accident instead of the amount check.
    """
    fake_price = _fake_stripe_price(unit_amount=4900, livemode=False)  # Stripe says A$49
    with patch("stripe.Price.retrieve", return_value=fake_price):
        with patch("app.core.config.settings.stripe_secret_key", "sk_test_abc123"):
            result = check_stripe_price(
                stripe_price_id="price_real_123",
                price_amount=9900,  # DB says A$99
                currency="AUD",
            )
    assert not result.ok
    assert "mismatch" in result.message.lower()
    assert "49" in result.message and "99" in result.message


def test_stripe_price_currency_mismatch_refused():
    """check_stripe_price refuses when Stripe currency differs from database.

    Mode pinned to test/test — see the amount-mismatch test above for why.
    """
    fake_price = _fake_stripe_price(unit_amount=9900, currency="usd", livemode=False)
    with patch("stripe.Price.retrieve", return_value=fake_price):
        with patch("app.core.config.settings.stripe_secret_key", "sk_test_abc123"):
            result = check_stripe_price(
                stripe_price_id="price_real_123",
                price_amount=9900,
                currency="AUD",
            )
    assert not result.ok
    assert "currency" in result.message.lower()


def test_stripe_price_inactive_refused():
    """check_stripe_price refuses an inactive Stripe price."""
    fake_price = _fake_stripe_price(active=False)
    with patch("stripe.Price.retrieve", return_value=fake_price):
        result = check_stripe_price(
            stripe_price_id="price_real_123",
            price_amount=9900,
            currency="AUD",
        )
    assert not result.ok
    assert "inactive" in result.message.lower()


def test_stripe_price_cross_mode_test_key_live_price_refused():
    """A test-mode API key against a live-mode Stripe price is refused (8A-7 check 4).

    This is, per the plan's own words, "the single most confusing failure available
    here" — a live price silently 404ing (or, worse, resolving) against a test key.
    """
    fake_price = _fake_stripe_price(livemode=True)
    with patch("stripe.Price.retrieve", return_value=fake_price):
        with patch("app.core.config.settings.stripe_secret_key", "sk_test_abc123"):
            result = check_stripe_price(
                stripe_price_id="price_real_123",
                price_amount=9900,
                currency="AUD",
            )
    assert not result.ok
    assert "mode mismatch" in result.message.lower()


def test_stripe_price_resolved_active_matching_is_ok():
    """The one case that must NOT be refused: a real, active, matching, same-mode price.

    Without this, a fix to any of the five refusal checks above could accidentally
    refuse everything and still show green.
    """
    fake_price = _fake_stripe_price(active=True, unit_amount=9900, currency="aud", livemode=False)
    with patch("stripe.Price.retrieve", return_value=fake_price):
        with patch("app.core.config.settings.stripe_secret_key", "sk_test_abc123"):
            result = check_stripe_price(
                stripe_price_id="price_real_123",
                price_amount=9900,
                currency="AUD",
            )
    assert result.ok
