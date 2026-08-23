# Week 5 Report — Commercial Control Surfaces, Credibility and Discovery

**Date:** 2026-08-23
**Branch:** `feat/week5-promotions-certificates-search`
**Plan:** [`week5_plan.md`](week5_plan.md)

---

## Verification pass, 2026-08-23

The section below was written as the code was built. A subsequent pass read every new
module back against the plan's acceptance lines and found **fourteen defects that the
test suite did not catch**. They are listed here rather than quietly fixed, because the
reason each one survived is itself the finding.

Three of them meant a feature did not work *at all* in production while its tests were
green: bookmarks (#8), search in the browser (#9), and certificate downloads (#10). One
— #9 — passed `tsc --noEmit`, verified directly rather than assumed.

The pattern worth carrying forward: **every one of these lived in the gap between "the
API returns the right JSON" and "a person can use the feature."** The backend suite was
490 tests and never went red, because the backend was mostly right. What was missing was
anything that rendered a component against a real response, opened a real page, or
committed a real row.

| # | Defect | Why the suite missed it | Fix |
|---|---|---|---|
| 1 | **Seven endpoint modules never committed.** `admin/promotions.py`, `admin/reviews.py`, `content/reviews.py`, `content/notes.py`, `content/bookmarks.py` called only `session.flush()`. `get_session` never commits and `record_audit` deliberately doesn't either, so every promotion create/update/**deactivate**, every review moderation, every note and every bookmark was discarded when the session closed. | `tests/conftest.py` wraps each test in one connection with a savepoint that restarts after every inner commit. A missing `commit()` is invisible under that fixture and only appears against a real database. | `await session.commit()` at each mutation, matching `admin/settings.py` and `admin/products.py`. |
| 2 | **`GET /verify/{code}` rate limiter keyed on the verification code.** An enumerator tries a *different* code each request, so every attempt landed on its own fresh counter and the limit never fired — while the counter dict grew one entry per guess. | The plan's "verify is rate-limited" test was never written. | Keyed on the caller's IP, reusing `filter_events.py`'s extraction. New test enumerates 40 distinct codes and asserts a 429; confirmed red against the old keying. |
| 3 | **Stripe promotion expiry never sent.** `create_promotion_in_stripe` computed the timezone conversion for `expires_at` and then discarded it, setting `max_redemptions = None` instead. The window was enforced in our database only: Stripe would honour the code indefinitely for anyone who had copied it. | The one Stripe test mocks `Coupon.create` to raise, so it never inspects what `PromotionCode.create` receives. | `expires_at` passed to `PromotionCode.create`. Two new tests assert the timestamp crosses the wire, and that an open-ended promotion sends no expiry. |
| 4 | **Search ran eight queries, not four.** A separate `COUNT` per entity type alongside each select, against a budget of four (§2.3.4). | The existing test asserts four *groups* in the response — a different claim from four *queries*. | Total now comes from `COUNT(*) OVER ()` on rows already being fetched. New query-count test using the `test_routing_query_count.py` counter, plus a test that the total exceeds the returned page. |
| 5 | **`ix_reviews_content_approved` was specified and never created.** §III.5 names two indexes on `reviews`; migration `029` created only the moderation-queue one. The missing one serves the public read — the query that runs on a visitor's page load. | No test asserts an index exists. | Migration `031`, `CONCURRENTLY` inside the autocommit block with the `INVALID` verification pass copied from `010`. |
| 6 | **The `review_state` enum type was orphaned.** `029` creates the type, then declares `reviews.state` as `String(20)`; the type is never referenced and is dropped on downgrade. | Nothing reads it, so nothing failed. | Migration `031` drops it (guarded by `pg_depend`, so it is skipped if anything ever attaches to it) and adds the `CHECK` the type was reaching for. |
| 7 | **The reconciler queried `content_type == 'product'`.** The schema's CHECK allows only `'course'`, `'template'`, `'pack'` — a pack is sold as a `Product` row but reviewed as `'pack'`. Every pack review was invisible to the reconciler, which with `--apply` would have zeroed correct counters in the name of repairing drift. | The reconciler test reimplements the logic inline rather than calling the script, so the mapping was never exercised. | Label corrected to `'pack'`. New test reads the vocabulary out of the live CHECK constraint and asserts the script's labels are a subset — so it follows the schema if that ever changes. |
| 8 | **Bookmarks were entirely non-functional.** `Bookmark` used `TimestampMixin`, which adds an `updated_at` column migration `030` never created, so SQLAlchemy named a non-existent column in every INSERT. The endpoint's bare `except Exception` then reported that failure as **409 "already bookmarked"** — so a learner's *first* bookmark on any item came back as a duplicate, and the real fault stayed hidden behind a plausible message. | Phase 5 shipped with **no test file at all**. | New `CreatedAtMixin` (created-and-deleted rows, never edited). Both bare `except Exception` handlers — here and in `content/reviews.py` — narrowed to `IntegrityError`, so only a real constraint violation can be reported as a duplicate. New `tests/test_notes_bookmarks.py`, 10 tests. |
| 9 | **The search palette crashed on every real query.** `TYPE_CONFIG` carried a stale `lesson` key and no `pack`, so `TYPE_CONFIG['pack'].icon` threw `Cannot read properties of undefined` — and nearly every query matches a pack. Search returned 20 correct results from the API and rendered **nothing** in the browser. | **`tsc --noEmit` passed with the bug present** — verified directly. The `Record<SearchResult['type'], …>` annotation reports the missing key and the excess key on the same object literal, and neither surfaced. No unit test rendered the component against a real response shape. | `pack` restored; an unknown group type is now skipped rather than thrown on, so a backend ahead of a deployed frontend costs one section instead of the whole palette. New `CommandPalette.test.tsx` — both cases confirmed red against the original code. |
| 10 | **`GET /me/certificates/{id}/download` was unreachable from the UI.** The Dashboard used `<a href="/api/v1/me/certificates/…" download>`. The API base is the bare origin with no `/api/v1` prefix, so it resolved against the SPA and returned the index page; the endpoint is also authenticated (an `<a>` sends no header) and returns *JSON* holding a presigned URL, not the file. Three independent reasons it could not work. | No test opens a certificate download. | Replaced with a handler that fetches through the authenticated client and opens the presigned URL. |
| 11 | **The command palette had no `role="dialog"`.** A modal overlay that covers the page and takes the keyboard, announcing no boundary to a screen reader. | axe does not flag a missing dialog role on a `<div>` overlay. | `role="dialog"` + `aria-modal` + `aria-label="Search"`. |
| 12 | **`signInAsAdmin` never worked.** `getByLabel(/password/i)` matched both the password field and its "Show password" toggle — a strict-mode violation that failed before typing anything. | Only reachable with real credentials set, so the entire admin suite skipped past it and the broken helper went unnoticed. | Scoped to `getByRole('textbox', {name: /^password$/i})`. Verified by creating a throwaway admin account (§ below). |
| 13 | **`ix_user_notes_user` was not covering.** §III.5 specifies `INCLUDE (lesson_id)`; `030` created it without, so `GET /me/notes` visits the heap for every row purely to read a column that is in the response. | No test asserts an index shape. | Migration `032`, `CONCURRENTLY` with the `INVALID` verification pass. |
| 14 | **The `/search` results page had no search field, no `role="search"`, and no live region.** §2.3.5 requires all three. The page could only be reached by editing the URL or reopening the palette — a dead end for exactly the person most likely to want to refine a query. | The W5-R3 a11y test asserting this existed and had never been run against a working `/search` route. | A real labelled search form plus an `aria-live` result count. State derived rather than set in an effect, matching `CommandPalette`'s existing pattern and this repo's `react-hooks/set-state-in-effect` rule. |

Two further corrections, cosmetic rather than behavioural: `Promotion.starts_at`/`ends_at`
and `Certificate.issued_at`/`revoked_at` were annotated `Mapped[str]` while holding
`datetime`, and `frontend/src/lib/reviews.ts` carried a comment claiming the aggregate
gate was "mirrored in the API serialiser" when it existed only in the client.

**The gate is now genuinely mirrored.** `MIN_REVIEWS_FOR_AGGREGATE` is enforced in
`app/api/v1/content/reviews.py` by a new `GET /reviews/rating` endpoint, so no rating
below the threshold reaches the wire for the client to hide — which is what §4.6 asked
for. Previously `computeRating` was imported by `Testimonial.tsx` and never called:
Stage B was unwired on both sides.

### Follow-up pass, 2026-08-23

The three open risks below were revisited, along with the `[OWNER]` §V.3.2 decision.
Two are closed, one is not, and the investigation found two further defects that had
been sitting behind them.

**Closed.**

1. **The fixture no longer hides missing commits.** `asserts_commit` (in `conftest.py`)
   wraps a request and fails unless the endpoint itself committed. It asserts not that
   the row survived — which the savepoint fixture makes true either way — but that the
   code *asked* for it to. Two subtleties each defeated an earlier attempt: SQLAlchemy's
   `after_commit` fires inside the async-to-sync greenlet, whose stack contains no
   application frames at any depth, so the caller must be captured by wrapping
   `AsyncSession.commit`; and `get_current_user` commits when it materialises the user
   row, so a plain count passes for a handler that never committed at all. Verified by
   deleting a real commit from bookmarks, notes and promotions in turn. 9 tests.

2. **Bookmarks are browsable.** `/saved` renders them, grouped by type, reachable from
   the member nav. The list endpoint now resolves titles and slugs in at most three
   queries rather than returning bare UUIDs, and keeps deleted items visible but flagged
   rather than dropping them. 12 tests.

**Resolved: `[OWNER]` §V.3.2.** Per owner direction the heading stays "Certificate of
Completion" and the document is signed from the platform, not a named individual —
issuance is automatic on 100% completion, so a personal signature would assert a review
nobody performed. A scope disclaimer sits on the PDF itself, not only in the email.

**Found while doing it: the certificate PDF was a blank page.** The content stream
emitted eight `Tj` operators and not one `BT`; text operators outside a text object are
discarded by a conforming renderer. Poppler extracts "Practicable" and nothing else from
the shipped file — every learner's name, course, date and verification code was silently
dropped. Nothing caught it because the only test touching the renderer patched it to
raise. 23 tests now extract with Poppler rather than pypdf, whose lenient extractor
passes against the broken stream.

**Found while doing it: catalogue cards had no visible focus.** On all three catalogues,
a focused card computed to exactly the same styles as an unfocused one — the grid draws
its cell dividers as `[&>*]:outline-1` on the card links, which beats the global
`:focus-visible` rule. A real WCAG 2.4.7 failure. This is what the "flake" in item 3 was
actually reporting.

### Still open

**The keyboard-purchase e2e walk is genuinely flaky**, roughly 2 runs in 6. The earlier
diagnosis in this report — "test pollution between sibling cases" — was wrong. The cause
is that the landing page mounts its carousels asynchronously, so which link the walk tabs
onto varies run to run. `waitForLoadState('networkidle')` was tried and made it *worse*
(6 failures in 8) and was reverted. A durable fix means changing how that page mounts,
which a keyboard test should not be driving. The WCAG defect it was intermittently
catching is now covered deterministically by the "catalogue cards show focus" suite.

**Backend suite after all of the above: 525 passed, 0 failed.**


### Where the certificate wording decision stands

`[OWNER]` §V.3.2 is **still open**. `certificate_pdf.py` renders with placeholder
wording; what the certificate asserts, whose name signs it, and whether any
accreditation is implied are not engineering calls. The plan sequenced issuance ahead of
rendering precisely so this would not block, and it did not — but the PDF a learner
downloads today carries text nobody has approved.

---

## What shipped

All five requirements from the plan are implemented (subject to the corrections above):

### W5-R1 — Admin control over promotions ✅

- **Migration 026** — `promotions` table with CHECK constraints, partial index on `(starts_at, ends_at) WHERE active`
- **Backend** — `GET /promotions/active` (public, date-filtered in SQL), admin CRUD with overlap check (409 on conflict), Stripe sync, audit trail
- **Frontend** — `AdminPromotions.tsx` moderation screen, `DiscountBanner` rewired from live endpoint, `useActivePromotion` hook with 5-minute stale time
- **Tests** — 5 backend tests (active window, outside window, allowlisted keys, overlap, empty query)

### W5-R2 — Certificates on course completion ✅

- **Migration 027** — `certificates` table with `UNIQUE(user_id, course_id)`, `verification_code` index, frozen snapshot columns
- **Backend** — Issue service (`certificate_service.py`), PDF renderer (`certificate_pdf.py`), `GET /me/certificates`, `GET /me/certificates/{id}/download`, `GET /verify/{code}`, revocation on refund, completion email
- **Frontend** — Dashboard certificates panel, public `/verify/:code` page
- **Tests** — 10 backend tests (edge detection, replay, snapshot, PDF cache, verify allowlist, 404 enumeration, revocation)

### W5-R3 — Public search ✅

- **Migration 028** — 4 generated `tsvector` columns + 4 GIN indexes with CONCURRENTLY build and INVALID verification
- **Backend** — `GET /search` with 4 bounded queries, `websearch_to_tsquery`, `published` filter, `LIMIT 5` per type
- **Frontend** — `SearchPage.tsx` full results page, `CommandPalette` with debounced search, keyboard nav, `role="search"` wrapper, `aria-live` result count
- **Tests** — 5 backend tests (published only, title outranks description, phrase query, empty query, response structure)

### W5-R4 — Reviews and ratings ✅

- **Migration 029** — `reviews` table with `review_state` enum, `UNIQUE(user_id, content_type, content_id)`, denormalised `review_count`/`rating_sum` on courses/templates/products
- **Backend** — Entitlement-gated submission endpoint (pending state, sanitised body), admin moderation with counter updates in same transaction + audit row, reconciler script
- **Frontend** — `AdminReviews.tsx` moderation queue, `Testimonial` component (Stage A, featured only), `MIN_REVIEWS_FOR_AGGREGATE = 8` gate (Stage B, closed)

### W5-R5 — Notes, bookmarks, learner analytics ✅

- **Migration 030** — `user_notes` table (one per lesson per learner, upsert), `bookmarks` table (polymorphic, one per user per content item)
- **Backend** — Notes CRUD (`PUT /me/notes/{lesson_id}`, `GET /me/notes`, `DELETE /me/notes/{lesson_id}`), bookmarks CRUD (`POST /me/bookmarks`, `DELETE /me/bookmarks/{id}`, `GET /me/bookmarks`), library endpoint now returns `estimated_duration_minutes`
- **Frontend** — `NotesPanel` component with autosave, `useNotes`/`useBookmarks` hooks, Dashboard shows estimated time remaining per course

---

## What was deferred

| Item | Reason |
|---|---|
| Wishlist | 8 products too few; revisit above ~25 |
| Blog / CMS | Second content system, needs its own plan |
| Newsletter | Consent records + editorial commitment, not engineering |

---

## Migration summary

| Migration | Tables added | Indexes |
|---|---|---|
| 026 | `promotions` | `ix_promotions_active_window` (partial) |
| 027 | `certificates` | `ix_certificates_user` (covering) |
| 028 | — (generated columns) | 4 GIN indexes on `search_vector` |
| 029 | `reviews` | `ix_reviews_state_created` |
| 030 | `user_notes`, `bookmarks` | `ix_user_notes_user`, `ix_bookmarks_user` |
| 031 | — (corrects `029`) | `ix_reviews_content_approved` (partial, `WHERE state = 'approved'`); drops the orphaned `review_state` type; adds `ck_reviews_state` |
| 032 | — (corrects `030`) | `ix_user_notes_user` rebuilt as `(user_id) INCLUDE (lesson_id)`, the covering shape §III.5 specified |

All migrations round-trip clean: `alembic upgrade head && alembic downgrade -1 && alembic upgrade head`.

`031` is an additive follow-up rather than an edit to `029`, per §III.6: never amend a
migration that has already run. Its index build was verified after the fact — the index
is present in `pg_indexes` with the partial `WHERE` clause, and `pg_index.indisvalid` is
true, so the `CONCURRENTLY` build did not leave it `INVALID`.

---

## Test counts

All measured 2026-08-23, after the verification pass, against a live backend and a real
browser:

| Suite | Result |
|---|---|
| **Backend, full** | **490 passed, 0 failed** (37m45s) |
| Frontend unit | **246 passed** across 36 files (was 237/34) |
| Frontend typecheck | clean, 0 errors |
| Frontend lint | clean on every file touched |
| e2e — accessibility (axe, both themes) | **35/35**, including the two admin-only cases that had always skipped |
| e2e — admin screen sweep | **21/21**, including `/admin/promotions` and `/admin/reviews` |
| e2e — public screen sweep | **19/19** |
| e2e — responsive widths | 100 passed, 7 skipped |
| e2e — search keyboard (new) | **5/5** |
| e2e — a11y manual checks | 23 passed, 1 skipped |
| Migrations | `026`–`032` all round-trip clean |

**Twenty-two tests were added**, each covering a defect the existing suite passed over:
verify-endpoint enumeration, Stripe expiry propagation, the search query budget and
total-vs-page, the reviews aggregate gate, the reconciler's content-type vocabulary, the
certificate un-complete/re-complete edge and PDF-failure isolation, notes and bookmarks
(10 — the phase had none), the discount banner (7), and the command palette (2).

**Three were confirmed red against the pre-fix code before being accepted** — the verify
enumeration test and both palette tests. The rest assert behaviour that did not exist at
all beforehand.

### On the admin suites

`admin-screen-overview.spec.ts` and the two admin cases in `accessibility.spec.ts` had
**never been run**: they skip without `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`, and the
sign-in helper they depend on was broken (#12). With the owner's explicit approval a
throwaway admin account was created in the live Supabase project, all three suites were
run green, and the account was then deleted from **both** `auth.users` and
`public.users` — verified absent from each afterwards, not assumed.

---

## Index evidence

Appended to `docs/db_index_evidence.md`:
- Migration 026: promotions active window query — sequential scan at current scale (0 rows), partial index will be chosen at ~100+ rows
- Migration 028: full-text search on courses and templates — sequential scan at current scale (8–10 rows), GIN indexes will be chosen at ~100+ rows

Both follow the established pattern from migrations 010 and 013: build the index before the data needs it, measure honestly, record the result.

---

## Files changed

### New files
- `backend/alembic/versions/026_promotions.py`
- `backend/alembic/versions/027_certificates.py`
- `backend/alembic/versions/028_full_text_search.py`
- `backend/alembic/versions/029_reviews.py`
- `backend/alembic/versions/030_notes_bookmarks.py`
- `backend/alembic/versions/031_reviews_approved_index.py` — verification pass
- `backend/tests/test_reviews.py`
- `backend/app/api/v1/admin/promotions.py`
- `backend/app/api/v1/admin/reviews.py`
- `backend/app/api/v1/content/promotions.py`
- `backend/app/api/v1/content/reviews.py`
- `backend/app/api/v1/content/search.py`
- `backend/app/api/v1/content/verify.py`
- `backend/app/api/v1/content/notes.py`
- `backend/app/api/v1/content/bookmarks.py`
- `backend/app/db/models/certificate.py`
- `backend/app/db/models/promotion.py`
- `backend/app/db/models/review.py`
- `backend/app/db/models/user_note.py`
- `backend/app/db/models/bookmark.py`
- `backend/app/services/certificate_pdf.py`
- `backend/app/services/certificate_service.py`
- `backend/app/emails/certificate_issued.html.j2`
- `backend/app/emails/certificate_issued.txt.j2`
- `backend/scripts/reconcile_review_aggregates.py`
- `backend/tests/test_certificates.py`
- `backend/tests/test_promotions.py`
- `backend/tests/test_search.py`
- `frontend/src/hooks/useActivePromotion.ts`
- `frontend/src/hooks/useCertificates.ts`
- `frontend/src/hooks/useNotes.ts`
- `frontend/src/hooks/useBookmarks.ts`
- `frontend/src/pages/SearchPage.tsx`
- `frontend/src/pages/VerifyCertificate.tsx`
- `frontend/src/pages/admin/AdminPromotions.tsx`
- `frontend/src/pages/admin/AdminReviews.tsx`
- `frontend/src/components/ui/Testimonial.tsx`
- `frontend/src/components/ui/NotesPanel.tsx`
- `frontend/src/lib/reviews.ts`

### Modified files
- `backend/app/api/v1/admin/router.py` — added reviews, promotions routers
- `backend/app/api/v1/content/lessons.py` — certificate issuance on completion edge
- `backend/app/api/v1/content/packs.py` — pack definition tightened
- `backend/app/api/v1/me.py` — certificates list/download, library duration
- `backend/app/core/entitlements.py` — course-granted lesson expansion
- `backend/app/db/models/__init__.py` — registered new models
- `backend/app/db/models/course.py` — added review counters
- `backend/app/db/models/template.py` — added review counters
- `backend/app/db/models/product.py` — added review counters
- `backend/app/integrations/stripe_client.py` — promotion sync
- `backend/app/services/email_service.py` — certificate email
- `backend/app/services/refund_service.py` — certificate revocation on refund
- `backend/main.py` — mounted new routers
- `backend/scripts/seed_course_levels.py` — fixed three bugs
- `frontend/src/App.tsx` — added search, verify, admin routes
- `frontend/src/components/ui/CommandPalette.tsx` — accessibility improvements
- `frontend/src/components/ui/DiscountBanner.tsx` — rewired from live endpoint
- `frontend/src/components/ui/Meta.tsx` — updated
- `frontend/src/lib/query/keys.ts` — added promotions key
- `frontend/src/pages/CoursesCatalogue.tsx` — updated
- `frontend/src/pages/Dashboard.tsx` — certificates, time remaining
- `frontend/src/routes/_layouts/AdminLayout.tsx` — added reviews nav
- `frontend/src/routes/_layouts/MarketingLayout.tsx` — search button
- `frontend/tests/e2e/screen-overview.spec.ts` — added search, verify routes
- `frontend/tests/e2e/admin-screen-overview.spec.ts` — added promotions, reviews routes
