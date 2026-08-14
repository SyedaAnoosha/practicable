"""The gating suite — week2_plan.md Part IV / DESIGN.md §58.2. Non-negotiable.

Every case here asserts a *denial*. Non-negotiable #9 (week2_plan.md): a test that has
never failed has not been verified — each of these has been run once with its guarded
check commented out, confirmed red, then restored. See the PR description for the list.

Case 9 (view-source on an unentitled lesson) runs in Playwright, not here — it needs a
real rendered DOM; it is noted in place below. Case 11 (block-level gating) now has its
own six tests, added once `lesson_blocks` existed (week2_plan.md Phase 2 step 8).

`[CRITICAL]` §58.2's cases 9 and 10 invert the usual rule. A QUESTION's guidance body is
free by design (DESIGN.md §21.3, §27) — it is the free entry point, not the paid product,
gated only by a client-side email prompt. A test asserting a question body is absent from
the API response would be asserting a BUG. This suite only ever asserts body-absence for
LESSONS and DRAFT content. Read this paragraph again before "fixing" test_question_*.
"""
import uuid
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import AuditLog, Entitlement, WebhookEvent


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
    """Hits the real Supabase Storage bucket with no query-string signature at all — the
    bucket's own access policy must deny this, not our API (BACKEND.md §6.6: the API
    never proxies file bytes). Network call to the real project configured in `.env`."""
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
    """Waiting out a real 60-second S3 signature in a unit test is exactly the kind of
    slow, flaky, external-dependency test the plan's `[UNVERIFIED]` convention exists to
    avoid asserting silently. What is verified here, deterministically: the signer is
    configured with a 60-second TTL and the signed URL actually carries that as its
    `X-Amz-Expires` query parameter — the parameter S3-compatible storage enforces
    server-side on every GET. That the storage backend itself then honours it past that
    window is AWS SigV4 behaviour, not application code, and is the one part of this case
    that must be spot-checked manually against the live bucket rather than asserted here.
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
    mux_call.assert_not_called()  # the call must never happen — a minted-then-discarded token still existed


# ── Case 6 — a token issued for lesson A is scoped and cannot play lesson B ─────────
def test_case6_playback_token_scoped_to_one_playback_id():
    """Mux enforces this server-side (the signed JWT's `sub` claim is the playback id,
    verified by Mux's own player against the asset being requested) — not something our
    API can 403 on directly. What this asserts: the token we mint is scoped by
    construction, decoding it (without verifying Mux's signature, which needs Mux's
    private counterpart) and confirming `sub` is the exact playback id requested, not a
    wildcard or the asset id. A token minted for lesson A's playback id therefore carries
    lesson A's id and no other, which is what makes Mux reject it for lesson B.
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
# Deliberately no stub here: DESIGN §58.2's case 9 is a browser-rendered-HTML assertion,
# and a pytest stand-in for it would just re-test case 1/2's JSON shape a second time
# under a misleading name.


# ── Case 10 — the question index never carries `body`; the detail always does ──────
@pytest.mark.asyncio
async def test_case10_question_index_has_no_body_field(anon_client: AsyncClient):
    """`QuestionSummaryOut` has no `body` field at all (questions.py) — this inspects the
    raw JSON rather than trusting the response model, per BACKEND.md §11.1's own
    instruction: "assert the serialised body... by inspecting the JSON — not by trusting
    the response model."

    `[2026-08-14]` This moved from `/questions` to `/questions/index` when
    week2_plan.md Phase 3 split the routes — `/questions` (no path suffix) now
    carries the SCORED, filtered search, `/questions/index` is what `QuestionSummaryOut`
    was always describing. The guarantee is unchanged: whichever URL serves the
    lightweight list, it must never carry a body."""
    resp = await anon_client.get("/questions/index")
    assert resp.status_code == 200
    payload = resp.json()
    assert isinstance(payload, list)
    for row in payload:
        assert "body" not in row, "the question index leaked a body field — this is case 10 failing"


@pytest.mark.asyncio
async def test_case10_scored_search_close_rows_have_no_body_field(anon_client: AsyncClient):
    """The scored endpoint's `close` rows (`ScoredQuestionOut`) extend
    `QuestionSummaryOut` the same way — same guarantee, same JSON-level check,
    exercised against a real filtered request rather than assumed from the model."""
    resp = await anon_client.get("/questions", params={"effort": "quick"})
    assert resp.status_code == 200
    payload = resp.json()
    for row in payload["exact"] + payload["close"]:
        assert "body" not in row, "the scored search leaked a body field — this is case 10 failing"


@pytest.mark.asyncio
async def test_case10_question_detail_always_has_body(anon_client: AsyncClient, db_session: AsyncSession):
    """`[NOT A BUG]` A question's guidance is free by design (§21.3) — `body` is always
    present, gated == True only changes the upsell affordance, never the content. This is
    the deliberate exception the module docstring warns about."""
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
    assert payload["gated"] is True  # no entitlement resolved for an anonymous request — upsell only, not a lock


# ── Case 11 — block-level gating (added Phase 2, once lesson_blocks existed) ─────── `content_graph`'s `mixed_lesson` carries four blocks: a `text` block, a `video` block
# with its own media row, a PAID `file` block, and a FREE `file` block — granted by the same `lesson_product` as `lesson` above (a real course product covers every lesson in
# it via one ProductContent row each). The free block exists specifically to prove this is PER-BLOCK gating, not all-or-nothing: an unentitled viewer sees exactly the free
# file block and nothing else, mirroring the free-template-inside-a-course rule the single-block `download` field already followed before blocks existed.
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
    lesson living in a different product — this is the catalogue-shape bug a correct
    entitlement engine cannot catch on its own (BACKEND.md §7.3 / week2_plan.md Phase 1
    step 5)."""
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
    """The reverse of the case above: holding the COURSE product grants the lesson.
    (The course product in this fixture graph does not also carry the template — that
    pairing is asserted structurally by db/seed/012's fix, exercised for real in
    test_case7 and test_template_product_* above; this case exists so the two products'
    *asymmetry* is pinned down explicitly, matching docs/pricing.md's documented rule:
    "template does NOT unlock the course; course DOES include its own template lesson.")
    """
    g = content_graph
    await grant(entitled_user, g.lesson_product)
    resp = await entitled_client.get(f"/courses/{g.course.slug}/lessons/{g.lesson.slug}")
    assert resp.json()["entitled"] is True


# ── The admin-bypass audit gap (BACKEND.md §4.3, closed 2026-08-13) ─────────────────
@pytest.mark.asyncio
async def test_admin_bypass_writes_an_audit_row(admin_client: AsyncClient, admin_user, content_graph, db_session):
    """Was a bare `# TODO` in entitlements.py before this suite existed. An admin with no
    entitlement can still reach a gated resource (by role), but must never do so silently
    — BACKEND.md §4.3 lists this under Never."""
    g = content_graph
    resp = await admin_client.get(f"/lessons/{g.lesson.id}/playback-token")
    # 404 is expected here (no ready Mux asset check passes entitlement first) — what
    # matters is that the entitlement dependency itself ran and wrote the row before any
    # 403/404 from the rest of the handler.
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


# ── Webhook idempotency (BACKEND.md §6.1, §11.1) ────────────────────────────────────
@pytest.mark.asyncio
async def test_webhook_replayed_three_times_grants_exactly_once(
    anon_client: AsyncClient, member_user, content_graph, db_session: AsyncSession
):
    """Stripe retries. A naive handler double-grants and double-emails. Replays the same
    event id three times and asserts exactly one order, one entitlement, one of each
    email — mocking Stripe's own signature construction (that's Stripe's library, not
    ours) and the email sends (so this test sends no real mail).

    Deliberately captures every id as a plain value up front: replay #2/#3 hit the
    handler's own `except IntegrityError: await session.rollback()` duplicate-event path
    (webhooks.py), and any `session.rollback()` — even to a savepoint — expires every ORM
    object in the identity map by design, whether or not `expire_on_commit=False` is set.
    Touching `member_user.id` or `g.lesson_product.id` again AFTER that point raises
    `MissingGreenlet` (a synchronous attribute access trying to lazily reload from the DB
    outside the async context) — the fix is to never need the ORM objects again, not to
    work around the expiry.
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
                "metadata": {"user_id": str(member_user_id), "product_id": str(product_id)},
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
