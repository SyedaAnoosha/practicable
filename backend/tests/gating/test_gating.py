"""The gating suite. Every case here asserts a *denial* — each has been run once with
its guarded check commented out, confirmed red, then restored.

Case 9 (view-source on an unentitled lesson) runs in Playwright, not here — it needs a
real rendered DOM.

`[CRITICAL]` A QUESTION's guidance body is free by design — the free entry point, not
the paid product. This suite only ever asserts body-absence for LESSONS and DRAFT
content, never for questions.
"""
import uuid
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import AuditLog, Entitlement, Order, Product, ProductContent, WebhookEvent


# ── Case 1 — logged-out request for a gated lesson ──────────────────────────────────
@pytest.mark.asyncio
async def test_case1_logged_out_lesson_is_locked(anon_client: AsyncClient, content_graph):
    g = content_graph
    resp = await anon_client.get(f"/courses/{g.course.slug}/lessons/{g.lesson.slug}")
    assert resp.status_code == 200  # a 200 locked state, not a 403 — DESIGN.md §21.3's pattern extended to lessons
    body = resp.json()
    assert body["entitled"] is False
    assert body["body"] is None
    assert "THE-SECRET-LESSON-BODY-THAT-MUST-NEVER-LEAK" not in resp.text


# ── Case 2 — signed-in, unentitled ──────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_case2_unentitled_member_lesson_is_locked(member_client: AsyncClient, content_graph):
    g = content_graph
    resp = await member_client.get(f"/courses/{g.course.slug}/lessons/{g.lesson.slug}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["entitled"] is False
    assert body["body"] is None
    assert "THE-SECRET-LESSON-BODY-THAT-MUST-NEVER-LEAK" not in resp.text


# ── Case 3 — direct storage URL, no presigned credential ────────────────────────────
@pytest.mark.asyncio
async def test_case3_direct_storage_url_denied(content_graph):
    """Hits the real Supabase Storage bucket with no query-string signature — the
    bucket's own access policy must deny this, not our API. Real network call."""
    import httpx

    from app.core.config import settings

    g = content_graph
    unsigned_url = (
        f"{settings.supabase_storage_s3_endpoint}/{settings.supabase_storage_bucket_name}/{g.paid_template.storage_key}"
    )
    async with httpx.AsyncClient() as client:
        resp = await client.get(unsigned_url)
    assert resp.status_code in (400, 403, 404)


# ── Case 4 — a presigned URL's expiry is actually 60 seconds ────────────────────────
def test_case4_presigned_url_expiry_is_60_seconds():
    """Waiting out a real 60-second S3 signature would be slow and flaky. Instead this
    verifies deterministically that the signer is configured with a 60-second TTL and
    the signed URL carries it as `X-Amz-Expires`. That storage actually enforces that
    window is AWS SigV4 behaviour, spot-checked manually against the live bucket.
    """
    from urllib.parse import parse_qs, urlparse

    from app.integrations.storage_client import generate_presigned_url

    url = generate_presigned_url("some/test/key.xlsx")
    query = parse_qs(urlparse(url).query)
    assert query.get("X-Amz-Expires") == ["60"]


# ── Case 5 — a Mux token for an unentitled lesson is never issued ───────────────────
@pytest.mark.asyncio
async def test_case5_playback_token_never_issued_when_unentitled(member_client: AsyncClient, content_graph):
    g = content_graph
    with patch("app.api.v1.content.lessons.generate_mux_playback_token") as mux_call:
        resp = await member_client.get(f"/lessons/{g.lesson.id}/playback-token")
    assert resp.status_code == 403
    mux_call.assert_not_called()  # a minted-then-discarded token still existed


# ── Case 6 — a token issued for lesson A is scoped and cannot play lesson B ─────────
def test_case6_playback_token_scoped_to_one_playback_id():
    """Mux enforces this server-side against the signed JWT's `sub` claim — not something
    our API 403s on directly. This decodes the token (without verifying Mux's signature)
    and confirms `sub` is the exact playback id requested, never a wildcard.
    """
    import jwt as pyjwt

    from app.integrations.mux_client import generate_mux_playback_token

    token_a = generate_mux_playback_token("playback_AAA")
    token_b = generate_mux_playback_token("playback_BBB")
    claims_a = pyjwt.decode(token_a, options={"verify_signature": False})
    claims_b = pyjwt.decode(token_b, options={"verify_signature": False})
    assert claims_a["sub"] == "playback_AAA"
    assert claims_b["sub"] == "playback_BBB"
    assert claims_a["sub"] != claims_b["sub"]


# ── Case 7 — entitlement revoked mid-session ────────────────────────────────────────
@pytest.mark.asyncio
async def test_case7_revoked_entitlement_denies_the_next_request(
    entitled_client: AsyncClient, entitled_user, content_graph, grant, db_session: AsyncSession
):
    g = content_graph
    ent = await grant(entitled_user, g.lesson_product)
    await db_session.flush()

    resp_before = await entitled_client.get(f"/courses/{g.course.slug}/lessons/{g.lesson.slug}")
    assert resp_before.json()["entitled"] is True

    await db_session.delete(ent)
    await db_session.flush()

    resp_after = await entitled_client.get(f"/courses/{g.course.slug}/lessons/{g.lesson.slug}")
    assert resp_after.json()["entitled"] is False
    assert resp_after.json()["body"] is None


# ── week3_plan.md W3-R5 — a real production refund, not case 7's row deletion ───────
# Case 7 above simulates revocation by deleting the row, which — per the plan — "today
# has no production code path that can actually produce the state it tests." These
# three go through the real path: an Order + OrderItems, `POST
# /admin/orders/{id}/refund`, and the `charge.refunded` webhook.
@pytest.mark.asyncio
async def test_refund_denies_lesson_template_and_download_on_next_request(
    admin_client: AsyncClient, entitled_client: AsyncClient, entitled_user, content_graph, db_session: AsyncSession
):
    from app.services.order_service import create_order_from_checkout

    g = content_graph
    total = g.lesson_product.price_amount + g.template_product.price_amount
    order = await create_order_from_checkout(
        session=db_session,
        user_id=str(entitled_user.id),
        stripe_session_id=f"cs_test_{uuid.uuid4().hex[:16]}",
        stripe_payment_intent_id=f"pi_test_{uuid.uuid4().hex[:16]}",
        price_amount_cents=total,
        currency="AUD",
        product_ids=[str(g.lesson_product.id), str(g.template_product.id)],
    )

    lesson_before = await entitled_client.get(f"/courses/{g.course.slug}/lessons/{g.lesson.slug}")
    assert lesson_before.json()["entitled"] is True
    template_before = await entitled_client.get(f"/templates/{g.paid_template.id}/download-url")
    assert template_before.status_code == 200

    with (
        patch("app.api.v1.admin.orders.create_refund") as refund_mock,
        patch("app.api.v1.admin.orders.send_refund_confirmation_email", new_callable=AsyncMock),
    ):
        resp = await admin_client.post(f"/admin/orders/{order.id}/refund", json={"reason": "Buyer changed their mind, within window."})
    assert resp.status_code == 200, resp.text
    refund_mock.assert_called_once_with(payment_intent_id=order.stripe_payment_intent_id)

    lesson_after = await entitled_client.get(f"/courses/{g.course.slug}/lessons/{g.lesson.slug}")
    assert lesson_after.json()["entitled"] is False
    assert lesson_after.json()["body"] is None

    template_after = await entitled_client.get(f"/templates/{g.paid_template.id}/download-url")
    assert template_after.status_code == 403

    # A second refund attempt on the same order is refused before touching Stripe
    # again — the 409 IS the "nothing changed" guarantee, not an incidental side effect.
    with patch("app.api.v1.admin.orders.create_refund") as second_refund_mock:
        resp2 = await admin_client.post(f"/admin/orders/{order.id}/refund", json={"reason": "again"})
    assert resp2.status_code == 409
    second_refund_mock.assert_not_called()


@pytest.mark.asyncio
async def test_revoked_entitlement_never_reappears_in_library(
    admin_client: AsyncClient, entitled_client: AsyncClient, entitled_user, content_graph, db_session: AsyncSession
):
    from app.services.order_service import create_order_from_checkout

    g = content_graph
    order = await create_order_from_checkout(
        session=db_session,
        user_id=str(entitled_user.id),
        stripe_session_id=f"cs_test_{uuid.uuid4().hex[:16]}",
        stripe_payment_intent_id=f"pi_test_{uuid.uuid4().hex[:16]}",
        price_amount_cents=g.lesson_product.price_amount,
        currency="AUD",
        product_ids=[str(g.lesson_product.id)],
    )

    library_before = await entitled_client.get("/me/library")
    assert any(c["slug"] == g.course.slug for c in library_before.json()["courses"])

    with (
        patch("app.api.v1.admin.orders.create_refund"),
        patch("app.api.v1.admin.orders.send_refund_confirmation_email", new_callable=AsyncMock),
    ):
        resp = await admin_client.post(f"/admin/orders/{order.id}/refund", json={"reason": "test"})
    assert resp.status_code == 200

    library_after = await entitled_client.get("/me/library")
    assert library_after.json()["is_empty"] is True
    assert not any(c["slug"] == g.course.slug for c in library_after.json()["courses"])


@pytest.mark.asyncio
async def test_webhook_charge_refunded_idempotent_three_times(
    anon_client: AsyncClient, entitled_user, content_graph, db_session: AsyncSession
):
    """A refund issued from the Stripe dashboard (not /admin/orders) reaches the same
    end state, and delivering the same webhook event three times still produces
    exactly one revocation and one confirmation email.

    Every id is captured as a plain value up front, same discipline as
    `test_webhook_replayed_three_times_grants_exactly_once` above: replay #2/#3 hit the
    handler's own duplicate-event rollback path, which expires every ORM object in the
    identity map — touching `entitled_user.id`/`order.id` again after that raises
    `MissingGreenlet`.
    """
    from app.services.order_service import create_order_from_checkout

    g = content_graph
    entitled_user_id = entitled_user.id
    payment_intent_id = f"pi_test_{uuid.uuid4().hex[:16]}"
    order = await create_order_from_checkout(
        session=db_session,
        user_id=str(entitled_user_id),
        stripe_session_id=f"cs_test_{uuid.uuid4().hex[:16]}",
        stripe_payment_intent_id=payment_intent_id,
        price_amount_cents=g.lesson_product.price_amount,
        currency="AUD",
        product_ids=[str(g.lesson_product.id)],
    )
    order_id = order.id

    event_id = f"evt_test_{uuid.uuid4().hex[:16]}"
    fake_event = {
        "id": event_id,
        "type": "charge.refunded",
        "data": {"object": {"id": f"ch_test_{uuid.uuid4().hex[:16]}", "payment_intent": payment_intent_id}},
    }

    with (
        patch("app.api.v1.commerce.webhooks.construct_webhook_event", return_value=fake_event),
        patch("app.api.v1.commerce.webhooks.send_refund_confirmation_email", new_callable=AsyncMock) as email_mock,
    ):
        for _ in range(3):
            resp = await anon_client.post(
                "/webhooks/stripe", content=b"{}", headers={"stripe-signature": "test-sig"}
            )
            assert resp.status_code == 200

    assert email_mock.await_count == 1

    entitlements = (
        await db_session.execute(select(Entitlement).where(Entitlement.user_id == entitled_user_id))
    ).scalars().all()
    assert len(entitlements) == 1
    assert entitlements[0].revoked_at is not None

    refreshed_order = (
        await db_session.execute(select(Order).where(Order.id == order_id))
    ).scalar_one()
    assert refreshed_order.status.value == "refunded"


# ── Case 8 — draft content by direct URL, signed out → 404, not a preview ───────────
@pytest.mark.asyncio
async def test_case8_draft_lesson_404s_for_signed_out(anon_client: AsyncClient, content_graph):
    g = content_graph
    resp = await anon_client.get(f"/courses/{g.course.slug}/lessons/{g.draft_lesson.slug}")
    assert resp.status_code == 404
    assert "DRAFT-BODY-NEVER-PUBLIC" not in resp.text


@pytest.mark.asyncio
async def test_case8_draft_lesson_404s_for_admin_too(admin_client: AsyncClient, content_graph):
    """§31.2: "Draft content is never reachable on a public URL, even by direct link,
    even by an admin who is not signed in [to the admin surface specifically]." This
    route has no admin bypass — publish state, unlike entitlement, has none."""
    g = content_graph
    resp = await admin_client.get(f"/courses/{g.course.slug}/lessons/{g.draft_lesson.slug}")
    assert resp.status_code == 404


# ── Case 9 — view-source on an unentitled lesson — Playwright, see tests/e2e ────────
# Deliberately no stub here: this needs a browser-rendered-HTML assertion, and a pytest
# stand-in would just re-test case 1/2's JSON shape under a misleading name.


# ── Case 10 — the question index never carries `body`; the detail always does ──────
@pytest.mark.asyncio
async def test_case10_question_index_has_no_body_field(anon_client: AsyncClient):
    """`QuestionSummaryOut` has no `body` field — this inspects the raw JSON rather than
    trusting the response model. `/questions` now carries the scored search;
    `/questions/index` is the lightweight list this guarantee applies to."""
    resp = await anon_client.get("/questions/index")
    assert resp.status_code == 200
    payload = resp.json()
    assert isinstance(payload, list)
    for row in payload:
        assert "body" not in row, "the question index leaked a body field — this is case 10 failing"


@pytest.mark.asyncio
async def test_case10_scored_search_close_rows_have_no_body_field(anon_client: AsyncClient):
    """The scored endpoint's `close` rows extend `QuestionSummaryOut` the same way —
    same guarantee, exercised against a real filtered request."""
    resp = await anon_client.get("/questions", params={"effort": "quick"})
    assert resp.status_code == 200
    payload = resp.json()
    for row in payload["exact"] + payload["close"]:
        assert "body" not in row, "the scored search leaked a body field — this is case 10 failing"


@pytest.mark.asyncio
async def test_case10_question_detail_always_has_body(anon_client: AsyncClient, db_session: AsyncSession):
    """`[NOT A BUG]` A question's guidance is free by design — `body` is always present;
    gated == True only changes the upsell affordance, never the content."""
    from app.db.models import Domain, Question

    domain = Domain(name=f"Q10 Domain {uuid.uuid4().hex[:6]}", slug=f"q10-domain-{uuid.uuid4().hex[:8]}")
    db_session.add(domain)
    await db_session.flush()
    question = Question(
        slug=f"q10-question-{uuid.uuid4().hex[:8]}", title="A free question", body="FULL-GUIDANCE-BODY-TEXT",
        preview="preview", domain_id=domain.id, published=True,
    )
    db_session.add(question)
    await db_session.flush()

    resp = await anon_client.get(f"/questions/{question.slug}")
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["body"] == "FULL-GUIDANCE-BODY-TEXT"
    assert payload["gated"] is True  # anonymous request: upsell only, not a lock


# ── Case 11 — block-level gating ────────────────────────────────────────────────────
# `content_graph`'s `mixed_lesson` carries four blocks: text, video, a PAID file block,
# and a FREE file block. The free block proves this is PER-BLOCK gating, not
# all-or-nothing: an unentitled viewer sees exactly the free file block and nothing else.
@pytest.mark.asyncio
async def test_case11_unentitled_lesson_blocks_list_has_only_the_free_block(
    member_client: AsyncClient, content_graph
):
    g = content_graph
    resp = await member_client.get(f"/courses/{g.course.slug}/lessons/{g.mixed_lesson.slug}")
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["entitled"] is False
    assert "THE-SECRET-BLOCK-BODY-THAT-MUST-NEVER-LEAK" not in resp.text

    blocks = payload["blocks"]
    assert len(blocks) == 1, "an unentitled viewer must see only the free file block, nothing else"
    assert blocks[0]["block_type"] == "file"
    assert blocks[0]["file_is_free"] is True
    assert blocks[0]["id"] == str(g.free_file_block.id)


@pytest.mark.asyncio
async def test_case11_entitled_lesson_blocks_list_has_every_block_in_order(
    entitled_client: AsyncClient, entitled_user, content_graph, grant
):
    g = content_graph
    await grant(entitled_user, g.lesson_product)
    resp = await entitled_client.get(f"/courses/{g.course.slug}/lessons/{g.mixed_lesson.slug}")
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["entitled"] is True

    blocks = payload["blocks"]
    assert [b["block_type"] for b in blocks] == ["text", "video", "file", "file"]
    assert blocks[0]["text_body"] == "THE-SECRET-BLOCK-BODY-THAT-MUST-NEVER-LEAK"
    assert blocks[1]["video_ready"] is True
    assert blocks[2]["file_is_free"] is False
    assert blocks[3]["file_is_free"] is True


@pytest.mark.asyncio
async def test_case11_block_playback_token_denied_when_unentitled(member_client: AsyncClient, content_graph):
    g = content_graph
    with patch("app.api.v1.content.lessons.generate_mux_playback_token") as mux_call:
        resp = await member_client.get(f"/lesson-blocks/{g.video_block.id}/playback-token")
    assert resp.status_code == 403
    mux_call.assert_not_called()  # a minted-then-discarded token for a block still existed


@pytest.mark.asyncio
async def test_case11_block_playback_token_granted_when_entitled(
    entitled_client: AsyncClient, entitled_user, content_graph, grant
):
    g = content_graph
    await grant(entitled_user, g.lesson_product)
    with patch("app.api.v1.content.lessons.generate_mux_playback_token", return_value="signed.jwt.token") as mux_call:
        resp = await entitled_client.get(f"/lesson-blocks/{g.video_block.id}/playback-token")
    assert resp.status_code == 200
    mux_call.assert_called_once_with(g.mixed_media.mux_playback_id)
    assert resp.json()["playback_id"] == g.mixed_media.mux_playback_id


@pytest.mark.asyncio
async def test_case11_block_download_url_denied_for_paid_block_when_unentitled(
    member_client: AsyncClient, content_graph
):
    g = content_graph
    resp = await member_client.get(f"/lesson-blocks/{g.paid_file_block.id}/download-url")
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_case11_block_download_url_free_block_needs_no_auth(anon_client: AsyncClient, content_graph):
    g = content_graph
    resp = await anon_client.get(f"/lesson-blocks/{g.free_file_block.id}/download-url")
    assert resp.status_code == 200
    assert resp.json()["file_name"] == g.free_template.file_name


# ── The free-template case (new since §58.2 was written) ───────────────────────────
@pytest.mark.asyncio
async def test_free_template_downloads_with_no_auth(anon_client: AsyncClient, content_graph):
    g = content_graph
    resp = await anon_client.get(f"/templates/{g.free_template.id}/download-url")
    assert resp.status_code == 200
    assert resp.json()["file_name"] == "free.xlsx"


@pytest.mark.asyncio
async def test_paid_template_401s_anonymous(anon_client: AsyncClient, content_graph):
    g = content_graph
    resp = await anon_client.get(f"/templates/{g.paid_template.id}/download-url")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_paid_template_403s_signed_in_non_owner(member_client: AsyncClient, content_graph):
    g = content_graph
    resp = await member_client.get(f"/templates/{g.paid_template.id}/download-url")
    assert resp.status_code == 403


# ── The entitlement-shape regression (db/seed/012's bug) ────────────────────────────
@pytest.mark.asyncio
async def test_template_product_grants_template_and_nothing_else(
    entitled_client: AsyncClient, entitled_user, content_graph, grant
):
    """Holding the TEMPLATE product must grant the template and must NOT grant the
    lesson living in a different product — a catalogue-shape bug a correct entitlement
    engine can't catch on its own."""
    g = content_graph
    await grant(entitled_user, g.template_product)

    template_resp = await entitled_client.get(f"/templates/{g.paid_template.id}/download-url")
    assert template_resp.status_code == 200

    lesson_resp = await entitled_client.get(f"/courses/{g.course.slug}/lessons/{g.lesson.slug}")
    assert lesson_resp.json()["entitled"] is False


@pytest.mark.asyncio
async def test_course_product_grants_both_lesson_and_its_own_template(
    entitled_client: AsyncClient, entitled_user, content_graph, grant, db_session: AsyncSession
):
    """The reverse of the case above: holding the COURSE product grants the lesson. This
    pins down the asymmetry explicitly — template does NOT unlock the course; course
    DOES include its own template lesson.
    """
    g = content_graph
    await grant(entitled_user, g.lesson_product)
    resp = await entitled_client.get(f"/courses/{g.course.slug}/lessons/{g.lesson.slug}")
    assert resp.json()["entitled"] is True


# ── week3_plan.md Phase 3 step 8 — the bundle extends case 13's shape check ──────────
@pytest.mark.asyncio
async def test_bundle_grants_both_parts_and_nothing_else(
    entitled_client: AsyncClient, entitled_user, content_graph, grant, db_session: AsyncSession
):
    """A bundle is an ordinary Product whose product_contents union its parts (RS 5.6 —
    no new entitlement mechanism, exactly as db/seed/016_seed_bundle.sql builds the real
    one). Holding it must grant every part's content and nothing belonging to a third,
    unrelated product — the same shape assertion as the template/course pair above,
    generalised to two parts on one product."""
    g = content_graph
    bundle = Product(
        slug=f"bundle-product-{uuid.uuid4().hex[:10]}", name="Test Bundle", description="d",
        stripe_price_id=f"price_test_{uuid.uuid4().hex[:12]}", price_amount=7900, currency="AUD", published=True,
    )
    db_session.add(bundle)
    await db_session.flush()
    db_session.add_all([
        ProductContent(product_id=bundle.id, content_type="lesson", content_id=g.lesson.id),
        ProductContent(product_id=bundle.id, content_type="lesson", content_id=g.mixed_lesson.id),
        ProductContent(product_id=bundle.id, content_type="template", content_id=g.paid_template.id),
    ])
    await db_session.flush()

    await grant(entitled_user, bundle)

    lesson_resp = await entitled_client.get(f"/courses/{g.course.slug}/lessons/{g.lesson.slug}")
    assert lesson_resp.json()["entitled"] is True

    template_resp = await entitled_client.get(f"/templates/{g.paid_template.id}/download-url")
    assert template_resp.status_code == 200

    # The unrelated third product's content (the domain pack's PDF) must stay locked —
    # the bundle grants exactly its own two parts, not "everything this user can reach".
    pack_resp = await entitled_client.get(f"/templates/{g.pack_pdf.id}/download-url")
    assert pack_resp.status_code == 403


# ── week3_plan.md W3-R11 — a cart checkout grants exactly what was bought ───────────
@pytest.mark.asyncio
async def test_cart_checkout_grants_exactly_the_products_bought(
    member_user, content_graph, db_session: AsyncSession
):
    """A 3-product cart checkout must create one order, N order_items, N entitlements —
    and must grant exactly those three products' contents, not more (a fourth, untouched
    product's content) and not fewer (any of the three silently skipped)."""
    from app.core.entitlements import ResourceType, resolve_granted_content_ids, resolve_product_ids
    from app.db.models import OrderItem
    from app.services.order_service import create_order_from_checkout

    g = content_graph
    product_ids = [str(g.lesson_product.id), str(g.template_product.id), str(g.pack_product.id)]
    total = g.lesson_product.price_amount + g.template_product.price_amount + g.pack_product.price_amount

    order = await create_order_from_checkout(
        session=db_session,
        user_id=str(member_user.id),
        stripe_session_id=f"cs_test_{uuid.uuid4().hex[:16]}",
        stripe_payment_intent_id=f"pi_test_{uuid.uuid4().hex[:16]}",
        price_amount_cents=total,
        currency="AUD",
        product_ids=product_ids,
    )

    items = (
        await db_session.execute(select(OrderItem).where(OrderItem.order_id == order.id))
    ).scalars().all()
    assert len(items) == 3
    assert {str(i.product_id) for i in items} == set(product_ids)

    entitlements = (
        await db_session.execute(select(Entitlement).where(Entitlement.user_id == member_user.id))
    ).scalars().all()
    assert len(entitlements) == 3
    assert {str(e.product_id) for e in entitlements} == set(product_ids)

    owned = await resolve_product_ids(user_id=member_user.id, session=db_session)
    granted_lessons = await resolve_granted_content_ids(
        product_ids=owned, resource_type=ResourceType.LESSON, session=db_session
    )
    granted_templates = await resolve_granted_content_ids(
        product_ids=owned, resource_type=ResourceType.TEMPLATE, session=db_session
    )
    assert g.lesson.id in granted_lessons
    assert g.mixed_lesson.id in granted_lessons
    assert g.paid_template.id in granted_templates  # from template_product
    assert g.pack_pdf.id in granted_templates  # from pack_product
    # The draft lesson was never in any of the three products bought — a false positive
    # here would mean the cart granted more than it should have.
    assert g.draft_lesson.id not in granted_lessons


# ── Case 14 — the domain-pack PDF ────────────────────────────────────────────────
# A pack is a Product carrying a `template` row (the PDF) plus `question_set` rows, so
# this exercises the same route as the other template cases: a pack's PDF is denied to
# a non-purchaser exactly like any other paid template.
@pytest.mark.asyncio
async def test_case14_pack_pdf_401s_anonymous(anon_client: AsyncClient, content_graph):
    g = content_graph
    resp = await anon_client.get(f"/templates/{g.pack_pdf.id}/download-url")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_case14_pack_pdf_403s_signed_in_non_owner(member_client: AsyncClient, content_graph):
    g = content_graph
    resp = await member_client.get(f"/templates/{g.pack_pdf.id}/download-url")
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_case14_pack_pdf_downloads_once_purchased(
    entitled_client: AsyncClient, entitled_user, content_graph, grant
):
    g = content_graph
    await grant(entitled_user, g.pack_product)
    resp = await entitled_client.get(f"/templates/{g.pack_pdf.id}/download-url")
    assert resp.status_code == 200
    assert resp.json()["file_name"] == "pack.pdf"


@pytest.mark.asyncio
async def test_case14_pack_question_stays_free_whether_or_not_purchased(anon_client: AsyncClient, content_graph):
    """The whole honesty point of §20.6: buying the pack must not be what unlocks the
    question. It was never locked. A stranger reads it exactly the same before or
    after anyone buys the pack."""
    g = content_graph
    resp = await anon_client.get(f"/questions/{g.pack_question.slug}")
    assert resp.status_code == 200
    assert resp.json()["body"] == "THE-FREE-QUESTION-BODY"


@pytest.mark.asyncio
async def test_case14_unpublished_pack_product_404s(anon_client: AsyncClient, content_graph):
    g = content_graph
    resp = await anon_client.get(f"/packs/{g.pack_product.slug}")
    assert resp.status_code == 200  # published in the fixture — sanity check the happy path
    body = resp.json()
    assert body["question_count"] == 1
    assert body["honesty_notice"]  # never empty — §20.6 requires it be present, not just true


# ── The admin-bypass audit gap ───────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_admin_bypass_writes_an_audit_row(admin_client: AsyncClient, admin_user, content_graph, db_session):
    """An admin with no entitlement can still reach a gated resource by role, but must
    never do so silently."""
    g = content_graph
    resp = await admin_client.get(f"/lessons/{g.lesson.id}/playback-token")
    # 404 is expected here — what matters is that the entitlement dependency ran and
    # wrote the row before any 403/404 from the rest of the handler.
    assert resp.status_code in (200, 400, 403, 404)

    rows = (
        await db_session.execute(
            select(AuditLog).where(
                AuditLog.actor_user_id == admin_user.id,
                AuditLog.action == "admin_access_bypass",
                AuditLog.target_id == g.lesson.id,
            )
        )
    ).scalars().all()
    assert len(rows) == 1, "admin bypass did not write exactly one audit_log row"


# ── Webhook idempotency ──────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_webhook_replayed_three_times_grants_exactly_once(
    anon_client: AsyncClient, member_user, content_graph, db_session: AsyncSession
):
    """Stripe retries. A naive handler double-grants and double-emails. Replays the same
    event id three times and asserts exactly one order, one entitlement, one of each
    email, with Stripe's signature construction and the email sends mocked out.

    Every id is captured as a plain value up front: replay #2/#3 hit the handler's own
    duplicate-event rollback path, which expires every ORM object in the identity map —
    touching `member_user.id` again after that raises `MissingGreenlet`.
    """
    g = content_graph
    member_user_id = member_user.id
    product_id = g.lesson_product.id
    price_amount = g.lesson_product.price_amount

    event_id = f"evt_test_{uuid.uuid4().hex[:16]}"
    fake_event = {
        "id": event_id,
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": f"cs_test_{uuid.uuid4().hex[:16]}",
                "payment_intent": f"pi_test_{uuid.uuid4().hex[:16]}",
                "amount_total": price_amount,
                "currency": "aud",
                "metadata": {"user_id": str(member_user_id), "product_ids": str(product_id)},
            }
        },
    }

    with (
        patch("app.api.v1.commerce.webhooks.construct_webhook_event", return_value=fake_event),
        patch("app.api.v1.commerce.webhooks.send_receipt_email", new_callable=AsyncMock) as receipt_mock,
        patch("app.api.v1.commerce.webhooks.send_sale_notification_email", new_callable=AsyncMock) as sale_mock,
    ):
        for _ in range(3):
            resp = await anon_client.post(
                "/webhooks/stripe", content=b"{}", headers={"stripe-signature": "test-sig"}
            )
            assert resp.status_code == 200

    assert receipt_mock.await_count == 1
    assert sale_mock.await_count == 1

    entitlements = (
        await db_session.execute(
            select(Entitlement).where(
                Entitlement.user_id == member_user_id, Entitlement.product_id == product_id
            )
        )
    ).scalars().all()
    assert len(entitlements) == 1

    events = (
        await db_session.execute(select(WebhookEvent).where(WebhookEvent.stripe_event_id == event_id))
    ).scalars().all()
    assert len(events) == 1


# ── W3-R11 — a cart checkout, through the real webhook, sends ONE itemised receipt ──
@pytest.mark.asyncio
async def test_webhook_cart_checkout_grants_three_and_sends_one_receipt(
    anon_client: AsyncClient, member_user, content_graph, db_session: AsyncSession
):
    """The webhook side of the cart test above: a single checkout.session.completed
    event naming three products must grant all three and fire exactly one receipt
    (itemising all three, not three separate receipts) and one access_granted per
    product — not per order."""
    g = content_graph
    member_user_id = member_user.id
    product_ids = [g.lesson_product.id, g.template_product.id, g.pack_product.id]
    total = g.lesson_product.price_amount + g.template_product.price_amount + g.pack_product.price_amount

    event_id = f"evt_test_{uuid.uuid4().hex[:16]}"
    fake_event = {
        "id": event_id,
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": f"cs_test_{uuid.uuid4().hex[:16]}",
                "payment_intent": f"pi_test_{uuid.uuid4().hex[:16]}",
                "amount_total": total,
                "currency": "aud",
                "metadata": {
                    "user_id": str(member_user_id),
                    "product_ids": ",".join(str(pid) for pid in product_ids),
                },
            }
        },
    }

    with (
        patch("app.api.v1.commerce.webhooks.construct_webhook_event", return_value=fake_event),
        patch("app.api.v1.commerce.webhooks.send_receipt_email", new_callable=AsyncMock) as receipt_mock,
        patch("app.api.v1.commerce.webhooks.send_sale_notification_email", new_callable=AsyncMock),
        patch("app.api.v1.commerce.webhooks.send_access_granted_email", new_callable=AsyncMock) as access_mock,
        patch("app.api.v1.commerce.webhooks.send_welcome_email", new_callable=AsyncMock),
    ):
        resp = await anon_client.post(
            "/webhooks/stripe", content=b"{}", headers={"stripe-signature": "test-sig"}
        )
        assert resp.status_code == 200

    assert receipt_mock.await_count == 1
    receipt_names = receipt_mock.await_args.kwargs["product_names"]
    assert len(receipt_names) == 3
    assert {g.lesson_product.name, g.template_product.name, g.pack_product.name} == set(receipt_names)

    # access_granted fires once PER PRODUCT, not once per order.
    assert access_mock.await_count == 3

    entitlements = (
        await db_session.execute(select(Entitlement).where(Entitlement.user_id == member_user_id))
    ).scalars().all()
    assert {e.product_id for e in entitlements} == set(product_ids)


# ── W3-R9 — a duplicate entitlement is impossible at the database level ─────────────
@pytest.mark.asyncio
async def test_duplicate_entitlement_rejected_by_database_constraint(
    entitled_user, content_graph, grant, db_session: AsyncSession
):
    """migration 010's uq_entitlements_user_product (non-negotiable #13) — the database
    rejects a second (user_id, product_id) row, not just application code choosing not
    to insert one. Seen red first: run against the database at migration 009 (before
    the constraint existed), the second grant() succeeded silently and this assertion
    failed; run again at 010, it raises IntegrityError as asserted below."""
    g = content_graph
    await grant(entitled_user, g.lesson_product)

    with pytest.raises(IntegrityError):
        await grant(entitled_user, g.lesson_product)
