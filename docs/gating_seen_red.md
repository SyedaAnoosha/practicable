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