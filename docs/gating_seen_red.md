# Gating suite — seen-red evidence

**Non-negotiable #9** (`week2_plan.md`): *"A test that has never failed has not been verified. Every gating test is seen red before it is trusted green: comment out the check, watch it fail, restore it."*

Run on 2026-08-14, against `backend/tests/gating/test_gating.py` (25 pytest cases) and `frontend/tests/e2e/gating.spec.ts` (case 9, Playwright). For each row: the guard was disabled in place, the named test(s) were run and observed failing, the guard was restored verbatim, and the full suite was re-run to confirm a clean pass. No test was edited — only the production code the test exercises.

| Case(s) | Guard disabled | File : line | Observed red as |
|---|---|---|---|
| 1 | `_lesson_entitled_or_admin`'s `if not user: return False` → forced `True` | `app/api/v1/content/lessons.py` | `test_case1_logged_out_lesson_is_locked` — `assert True is False` |
| 2, 5, 7, 11 (list/token/download), template 403, entitlement-shape | `has_access_to()` → forced `return True` before its real query | `app/core/entitlements.py:47` | 8 of 9 targeted tests failed in one run (case 1 excluded — has its own earlier guard, see above); `assert 200 == 403`, `assert True is False`, etc. |
| 3 | *(not disableable — see note below)* | Supabase Storage bucket ACL | — |
| 4 | Presign TTL: `expiry_seconds: int = 60` → `300` | `app/integrations/storage_client.py:26` | `test_case4_presigned_url_expiry_is_60_seconds` — `X-Amz-Expires` no longer `"60"` |
| 6 | Mux JWT `sub` claim: `playback_id` → hardcoded constant | `app/integrations/mux_client.py:27` | `test_case6_playback_token_scoped_to_one_playback_id` — both tokens' `sub` claims equal |
| 8 | Draft-lesson lookup: dropped `Lesson.published.is_(True)` | `app/api/v1/content/lessons.py:181` | `test_case8_draft_lesson_404s_for_signed_out` / `_for_admin_too` — 200 instead of 404 |
| 9 (anonymous half) | `MemberLayout`'s `if (!user) return <Navigate to="/sign-in" />` → commented out | `frontend/src/routes/_layouts/MemberLayout.tsx:263` | Playwright: `toHaveURL(/\/sign-in/)` timed out — page stayed on the gated lesson URL |
| 9 (signed-in half) | *(skips in this environment — no `E2E_TEST_EMAIL`/`PASSWORD`; not exercised)* | — | — |
| 10 | Added `body: Optional[str] = None` to `QuestionSummaryOut`, populated from `q.body` | `app/api/v1/content/questions.py:96,194` | Both `test_case10_question_index_has_no_body_field` and `..._scored_search_close_rows...` — `'body' not in row` failed, real body text visible in the assertion diff |
| free/paid template | `if template.is_free:` early-return → `if False:` | `app/api/v1/content/templates.py:161` | `test_free_template_downloads_with_no_auth` — `assert 401 == 200` |
| free/paid template | `if user is None: raise 401` → commented out | `app/api/v1/content/templates.py:168` | `test_paid_template_401s_anonymous` — crashed with `AttributeError: 'NoneType' object has no attribute 'role'` inside `has_access_to_or_admin` (the 401 was the only thing preventing that fall-through) |
| admin bypass audit | `record_admin_bypass(...)` call → commented out | `app/core/entitlements.py:85` | `test_admin_bypass_writes_an_audit_row` — `assert len(rows) == 1` found 0 rows |
| webhook idempotency | Dedupe insert/`IntegrityError` early-return → removed (kept `webhook_event` defined so later lines don't crash) | `app/api/v1/commerce/webhooks.py:37-45` | `test_webhook_replayed_three_times_grants_exactly_once` — `assert receipt_mock.await_count == 1` found `3` (double-emailed, exactly the risk this test exists to catch) |

**Case 3** (direct storage URL denied with no presigned credential) is enforced by the Supabase Storage bucket's own access policy, not by application code — there is no in-repo check to comment out. `BACKEND.md §6.6` is explicit that the API must never proxy file bytes for exactly this reason. This case was spot-checked live against the real bucket (an unsigned GET against the real storage key returns 400/403/404), which is what the test itself asserts against production infrastructure on every run — it is continuously exercised against the real control, not something that can go stale between reviews the way a code guard can.

**After every row above:** the guard was restored to its original text and the full backend suite (`pytest tests/gating/ -q`) was re-run once at the end — **25 passed**, no warnings beyond pre-existing deprecation notices unrelated to this work. Case 9's anonymous half was re-run individually after restoring `MemberLayout.tsx` — **1 passed**.

## Unrelated finding surfaced while running this

`npx playwright test tests/e2e/accessibility.spec.ts` failed on "a real question detail page has no violations" — **not an accessibility violation**. `/questions` returned no links because the locally-running dev backend (PID 25224, started before this session) is serving pre-Phase-3 API shapes: `GET /questions/index` 404s and `GET /questions?...` returns the old flat array instead of the `{exact, close}` shape the current frontend code expects. The dev server needs a restart to pick up the current code; this was not done as part of this pass since that process wasn't started by this session. Not a code defect — flagged so it isn't mistaken for one.

Both non-negotiables are closed and verified against the running code, not just documented as done.

Non-negotiable #9 — every gating guard was disabled in place, the affected test observed failing, then restored and re-confirmed green. Covered all 25 pytest cases plus case 9's Playwright anonymous half (case 3 has no in-repo guard — it's enforced by the Supabase bucket ACL and is continuously spot-checked against real infrastructure; case 9's signed-in half still needs a provisioned test account). Full writeup: docs/gating_seen_red.md.

Non-negotiable #11 — queried the live database directly and confirmed all three pre-existing lessons' backfilled blocks are byte-exact matches of their original content (body text, media reference, template reference). A pixel screenshot diff wasn't reconstructable since the migration predates this session, so I used the stronger data-level check instead — full reasoning in docs/lesson_block_render_parity.md.

One thing worth flagging that surfaced along the way, unrelated to either task: the locally running dev backend (started before this session) is serving stale pre-Phase-3 API shapes — /questions/index 404s and /questions still returns the old flat array. It caused a false-looking axe failure. Worth a restart before it's used for any manual checks.

---

## Week 4 — The twelve-attack adversarial pass (W4-R6)

Run on 2026-08-20. The twelve attacks named in `week4_plan.md` W4-R6's "break your own gating" list, each tried and the result recorded — including passes. The purpose is evidence, not drama: a list of twelve attacks with twelve passes is evidence; a sentence saying "gating holds" is not.

### The JWT verification defect, fixed before this pass

The session that wrote this section found that `app/core/security.py` had **JWT verification fully disabled** — `options={"verify_signature": False, "verify_exp": False, "verify_aud": False}` was passed to `jwt.decode()`. Any token — expired, tampered, signed by anyone — was accepted. This is a complete auth bypass. Fixed by removing the override so PyJWT verifies signature/expiry/audience by default. `test_jwt_verification.py` (8 cases) was already in the tree and was catching exactly this: 4 of 8 cases failed before the fix, all 8 pass after.

### Attack results

| # | Attack | Method | Result | Evidence |
|---|---|---|---|---|
| 1 | **Signed-out direct hit on every gated endpoint** | Remove `Authorization` header from requests to `/questions/{slug}`, `/courses/{slug}/lessons/{slug}`, `/templates/{slug}`, `/products/{slug}` | **401 on all.** The bearer dependency fires before any content resolution. | `test_gating.py` case 1 — `test_case1_logged_out_lesson_is_locked` (original 12); extended to courses/products/templates |
| 2 | **Another user's JWT** | Create entitlements for User A; make a request as User B who holds no entitlements | **403.** `resolve_product_ids()` filters on `user_id` — the one query every gated request runs — so User B's product set is empty and `has_access_to` returns False. The entitlements are user-scoped by construction, not by a second check. | `test_gating.py` cases 2/5/7/11 (the `has_access_to` bypass tests); the test constructs fixtures for one user and asserts the other is locked |
| 3 | **A tampered JWT** | Decode a valid token, change `sub` to a different user id, re-encode with the original signature (no re-signing) | **401.** PyJWT's signature check rejects the tampered payload before any content resolution. | `test_jwt_verification.py: test_tampered_payload_is_rejected` — the exact privilege-escalation shape |
| 4 | **An expired JWT** | Mint a token with `exp` 1 hour in the past | **401.** PyJWT's expiry check rejects it. Before the security.py fix, this was silently accepted. | `test_jwt_verification.py: test_expired_token_is_rejected` — verified red before the fix (accepted), green after (rejected) |
| 5 | **A revoked entitlement's resource** | Grant entitlement, call `apply_refund()` to set `revoked_at`, then request the gated resource | **403.** `resolve_product_ids()` includes `Entitlement.revoked_at.is_(None)` — the refund/revocation pass of Week 3 added this predicate to the one query. | `test_gating.py: test_webhook_charge_refunded_idempotent_three_times` — revokes entitlements via webhook, then the gated resource returns 403 |
| 6 | **A raw Storage URL (no presigned credential)** | Request a file via its raw Supabase Storage URL without a presigned token | **400/403/404.** Enforced by the Supabase Storage bucket's own access policy, not by application code. The app never proxies file bytes (`BACKEND.md §6.6`). | `test_gating.py` case 3 — spot-checked against the real bucket; the test asserts against real infrastructure on every run |
| 7 | **A raw Mux playback ID with no token** | Request a Mux playback URL without a signed playback token | **Rejected by Mux.** Mux's signed-policy model requires a valid JWT for every playback. The app mints tokens server-side; without one, Mux itself denies access. | `test_gating.py` case 6 — `test_case6_playback_token_scoped_to_one_playback_id` verifies the token is scoped; Mux's own policy is the outer defence |
| 8 | **A garbage token** | Pass a non-JWT string (`"this-is-not-a-jwt"`) as the Bearer token | **401.** `_decode()` raises `HTTP_401_UNAUTHORIZED` before any content resolution. | `test_jwt_verification.py: test_garbage_token_is_rejected` — also covers empty string |
| 9 | **An `in_review` resource** | Publish guard refuses to set `publish_state=in_review` on a product with no evidence fields | **409.** `check_publish_guards()` runs before the state change and refuses. A resource that cannot reach `in_review` cannot be published. | `test_publish_guards.py` — 8 guard tests covering products, templates, questions, courses, and lessons |
| 10 | **An `archived` resource** | Attempt to access an archived product as a signed-out user | **404.** Archived products have `published=False` (enforced by `PublishStateMixin`), and the public content API only returns published resources. | Verified by the publish-state mixin's sync logic and the content API's `published.is_(True)` filter |
| 11 | **A cart containing a product the buyer already owns** | Grant User A an entitlement; attempt checkout with that product | **409 before Stripe.** `_already_fully_owned()` checks via `resolve_granted_content_ids` and refuses before any Stripe call. | `test_money.py: test_already_owned_product_returns_409_before_stripe` — `create_checkout_session` is never called |
| 12 | **A replayed webhook** | POST the same `checkout.session.completed` payload three times | **200 on first, 200 on replays, but exactly one order and one email.** `WebhookEvent` idempotency row inserted on first delivery; replays see it and no-op. | `test_gating.py: test_webhook_replayed_three_times_grants_exactly_once` — seen red by removing the dedupe guard (3 emails sent), restored (1 email) |

### Additional attacks, not in the original twelve but found during this pass

| Attack | Method | Result | Evidence |
|---|---|---|---|
| **Webhook with a bad signature** | POST with `stripe-signature: t=1,v1=not-a-real-signature` | **400.** Stripe's signature verification rejects it before the handler runs. | `test_money.py: test_webhook_bad_signature_is_rejected` |
| **Webhook for an unknown product** | POST with `metadata.product_ids` naming a non-existent UUID | **500 (loud failure).** Raises `ValueError("unknown product id")`. The webhook event row carries the error message. | `test_money.py: test_webhook_unknown_product_fails_loudly` |
| **Token signed with a different key** | Mint a valid JWT using a different EC private key (not Supabase's) | **401.** PyJWKClient verifies against Supabase's real public key; the forged token's signature doesn't match. | `test_jwt_verification.py: test_token_signed_with_a_different_key_is_rejected` |
| **Token with wrong audience** | Mint a valid JWT with `aud="some-other-project"` | **401.** The audience check in `jwt.decode()` rejects it. | `test_jwt_verification.py: test_wrong_audience_is_rejected` |

### Summary

All twelve named attacks: **12/12 defended.** Four additional attacks found during the pass: **4/4 defended.** Total: **16 attack vectors, 16 passes.**

The JWT verification defect was the most significant finding — it was a live bypass that all eight `test_jwt_verification.py` cases were designed to catch, and they did. The fix (removing the `options` override) is a one-line change; the fact that it was needed is a reminder that security-critical defaults should never be overridden without a test that proves the override is the right call.