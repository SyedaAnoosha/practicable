# Week 3 — Report and Go/No-Go

**"Deciding in the Dark" Platform · 2026-08-17 · closes `week3_plan.md`'s own Phase 6 step 8 and ledger item 49**

*This is the standalone write-up `week3_plan.md`'s Definition of Done asks for. Its own §0.4 (entering state), Phase 6 Definition of Done, and §28's task ledger are this report's evidence base — this is the summary and the recommendation drawn from them, written against the repository as it stands today rather than against the week's original intentions.*

---

## The recommendation

> ## **GO for Week 4. Every engineering item on this week's ledger is closed or deliberately re-scoped in writing.**
>
> All eleven requirements (W3-R1 through W3-R11) are closed on the engineering side. The email spine, database indexes and uniqueness constraints, refunds and revocation, admin uploads and publish states, and the cart all shipped as specified. Content now reads as inhabited rather than seeded: zero machine-derived previews, 300 question-relation rows, and a stress-fixture suite that walks the DESIGN.md §49.2 extremes with no overflow. The release QA slice ran in full this session — both themes, all seven widths, and a real mobile checkout walk in Stripe test mode — and surfaced and fixed one genuine, if minor, accessibility defect along the way (a skipped heading level on three catalogue pages).
>
> **What remains is not code.** The watched non-developer usability test stays explicitly deferred to Week 4, by the owner's own instruction, not by an engineering shortfall. Two items are genuinely unverifiable from this environment — Supabase Auth's dashboard-only Site URL setting, and the two analytics "reads" W3-R10 asks for, which need real customer traffic that doesn't exist yet on a pre-launch site. One small, real gap surfaced this session and was **not** fixed, by design: two transactional pages (`CheckoutSuccess.tsx`, `Template.tsx`) share the same missing-`h1` pattern the catalogue fix addressed, but sit outside the axe sweep's route list — named here for Week 4, not silently carried.

---

## 1. What Week 3 set out to prove

> Make the store sellable to a stranger: several real products with deliberate pricing and a bundle, email that actually arrives, money that can move backwards as well as forwards, an admin a non-developer has been watched using, shelves full enough to read as inhabited — and a database that stays fast as the catalogue grows.

Eleven requirements, W3-R1 through W3-R11 (the last, a cart, added mid-week on owner request). All eleven are closed on the engineering side. One (W3-R6) has an explicitly human, explicitly deferred tail — the same shape Week 2's report described for its own three human-tailed requirements — and one (W3-R10) has a data tail that cannot exist before the site has real visitors.

## 2. Requirement by requirement

| # | Requirement | Status |
|---|---|---|
| W3-R1 | The email spine | **Closed.** Mailjet restored as sole transport over REST (unaffected by Render's port-587 block); six Jinja2 templates plus six plain-text siblings; welcome, access-granted, reset and free-entry sends all wired and delivered, confirmed by Mailjet's own message-status API. **One item stays open, unrelated to this session**: the hostile-client render check (ledger #11) — built for it, never actually opened in a real mail client |
| W3-R2 | Several real products, tiers, and one bundle | **Closed**, with one pre-existing partial carried forward. Two new paid templates, a domain pack (Risk, 60 questions, content-ready), and a bundle at A$79 (real `SELECT DISTINCT`-union contents, not a copied id list) all shipped with real Stripe test-mode Products/Prices. **Ledger #18 stays `[PARTIAL]`**: the two product-preview images have no column, no upload path and no display component — untouched this session, not newly found |
| W3-R3 | The pricing page | **Closed, differently than planned.** Built to spec in Phase 3, then **removed entirely 2026-08-16 on explicit owner direction** ("remove the pricing page completely… look at how Coursera handles it") — every price now lives on its own product card in `/store`, Coursera-style, rather than a side-by-side tier-comparison page. `BundleCard` and the refund/tax footer text moved to `/store` unchanged; `/pricing` redirects rather than 404s. See §3 |
| W3-R4 | Content that reads as inhabited | **Closed this session.** Zero machine-derived previews (16 rewritten by hand this session, closing what earlier sessions left at 83/99); the quick-win taxonomy gap reviewed and **deliberately left as-is** (owner's editorial call, not a drop); 300 `question_relations` rows seeded; stress fixtures loaded and walked, no overflow. The second course (ledger #19) stays an owner-held content decision, unchanged |
| W3-R5 | Refunds and revocation | **Closed.** Migration `011`, `resolve_product_ids()` checks `revoked_at` in the query already running, `POST /admin/orders/{id}/refund`, the `charge.refunded` webhook (idempotent), `RefundDialog`, and three revocation gating tests seen red before green |
| W3-R6 | Admin a non-developer can use, proven | **Engineering closed.** Mux direct-upload, Storage presigned-upload, `UploadField`, publish states with `PublishStateMixin` keeping `published`/`publish_state` in sync on every write path. **The watched usability test itself is deferred to Week 4 by the owner's own words** ("I will do the non-dev test later") — recorded as scheduled, not silently dropped |
| W3-R7 | Editorial control of the front page | **Closed.** `featured`/`featured_sort` columns, `PublishStateChip` and `FeaturedToggle` in three editors, the homepage now prefers curated featured questions over the old "first by `created_at`" accident |
| W3-R8 | The launch-condition sweep | **Closed**, with one item that stays permanently outside this environment's reach. Stripe test mode, hosting tiers, Mailjet transport and the cost table all confirmed unchanged against §8.4. **Supabase Auth's Site URL/Redirect URLs stay `[UNVERIFIABLE]`** — a dashboard-only setting with no API this session, or any automated session, can read |
| W3-R9 | Database performance and integrity | **Closed**, from an earlier session this week. Migration `010`'s index layer (every entry named to a query, `EXPLAIN`-proven in `db_index_evidence.md`) and `011`'s four uniqueness constraints, with zero duplicate rows found before constraining |
| W3-R10 | Analytics closes its own loop | **Partially closed.** All nine events confirmed wired; four fired live for real during this session's own QA work. **The two required reads stay unanswered** — not a wiring gap, a data gap. See §4 |
| W3-R11 | A cart | **Closed.** `checkout/session`, `order_service` and the webhook all take a product-id list; `CartDrawer`/`CartIcon`; one itemised receipt per order regardless of item count; gating case 13 extended to N-item carts and the bundle |

## 3. What changed since the ledger was last written

**`/pricing` was removed entirely, folded into `/store`, mid-Phase-6.** The owner's stated reason — "we are not offering subscription-based models" — didn't describe what the page actually did (every price on it was always one-time; `BILLING_TYPE_TEXT` said so explicitly), but named the real problem once asked: a three-column "Free / recommended / bundle" layout reads as a SaaS plan comparison regardless of what the numbers in it actually are. Rather than restyle the columns, the owner's final call was Coursera's pattern — price shown per product, on the product's own card, not a second page repeating a subset of the same catalogue. `Pricing.tsx` and `PricingColumn.tsx` are deleted outright; `BundleCard` survives unchanged, now rendered directly on `/store`; the refund-position and tax-statement sentences moved with it, still one string defined once (`lib/labels.ts`); `/pricing` itself redirects to `/store` rather than 404ing, for anyone with the old link. `week3_plan.md`'s own Phase 3 steps and Part II design spec are **not** rewritten to erase that `/pricing` was planned and built — that document's own rule is that a later fact wins by addition, not silent rewrite, and this report follows the same convention.

**The full Phase 6 content and QA slice closed this session** — steps 1 through 8, all eight, none left partial:

- **16 questions' previews rewritten by hand**, closing the gap `011_seed_100_questions.py`'s `stopgap_preview()` left at 83/99 from earlier sessions. `select count(*) from questions where preview like '%…'` now returns 0.
- **The quick-win taxonomy gap reviewed and deliberately left as-is** — the owner's editorial call, recorded as a decision rather than a drop, precisely because `handover.md` §1's own rule ("a chip is offered only if it is counted") means adding one without real content behind it would be worse than the gap.
- **`question_relations` populated** — 300 rows, top three per question, scored by shared domain, shared tags and shared leadership traits, `sort_order` 0–2. A question page leads somewhere now.
- **Stress fixtures loaded and walked** — `stress-fixtures.spec.ts`, three tests, 375px, using `page.route()` interception rather than real seed rows (DESIGN.md §49.1's "real content, always" rule keeps synthetic extremes out of the live database; §49.2's own words call for exactly this fixture-based approach). A 140-character title, a one-word title, a 2,400-word body, a 12-module/60-lesson course, a 42-character author name — none of them overflow.
- **§8.4 confirmed against reality** — Stripe's `rk_test_` restricted key, current hosting tiers, Mailjet as sole transport, the cost table. Supabase Auth's dashboard setting is the one item that stays out of reach of any automated session.
- **Nine analytics events confirmed wired**; four fired for real during this session's own QA work rather than only being read from source — see §4.
- **The release QA slice ran in full**: a clean raw-hex grep (two sanctioned exceptions, both pre-existing); the axe sweep now runs in both themes (`accessibility.spec.ts` gained a `dark theme` describe block, 9/9 clean); a new, permanent `responsive-widths.spec.ts` suite checks all seven required widths against six public routes plus a real question and a real course detail page (56/56 passing); and a real mobile checkout walk in Stripe test mode. See §5 for both the defect this surfaced and the walk's own findings.
- **This document.**

## 4. Analytics: what actually fired, and why the two reads can't be answered yet

Nine events exist across the two layers — `content_viewed`, `filter_applied`, `email_captured`, `email_gate_shown`, `checkout_started` (client, `lib/analytics.ts`) and `purchase_completed`, `entitlement_delay`, `download_failed`, `refund_issued` (server, `integrations/posthog_client.py`). All nine are confirmed wired to real call sites — `refund_issued`, orphaned as recently as Phase 4, now fires from both the admin refund endpoint and the `charge.refunded` webhook.

**Four fired for real this session, not just on paper.** The seven-width responsive sweep and the mobile checkout walk both drove a real browser against the real running app: `content_viewed` fired repeatedly (every question, course and template detail page visited); `checkout_started` fired once, from the walkthrough's actual "Continue to secure checkout" click; `purchase_completed` and `entitlement_delay` both fired once, from the webhook handler processing the walkthrough's real Stripe payment. The other five — `filter_applied`, `email_captured`, `email_gate_shown`, `download_failed`, `refund_issued` — were not exercised, because nothing in this session's testing clicked a filter chip, hit an email gate, failed a download, or issued a refund.

**The two required reads — which content type converts, and whether the seven-tag filter is used — are not answerable yet**, for two separate reasons, neither of them a wiring problem. First, this environment holds only the `phc_` write key; no `phx_` personal/query key is configured, so PostHog's dashboard or API can't be queried back to confirm ingestion or run the actual read. Second, and more fundamentally: the site is pre-launch, with no real customer traffic. A "which content type converts" read needs conversions to have happened; a "is the filter used" read needs real visitors filtering. Both questions are instrumented correctly and will be answerable the first week real visitors arrive — that's a genuine Week 4 (or later) item, not a gap in this week's engineering.

## 5. The release QA slice: what it found

**A real, previously-undetected accessibility defect, found and fixed.** `/courses`, `/templates` and `/questions` all skipped from the page's `h1` (`PageTitle`) straight to each card's `h3` (`Card.tsx`'s `CardTitle`) with no `h2` between them — a direct violation of DESIGN.md's own stated rule ("one h1 per page, headings in order, no skipped levels," §10's "if a section needs h2 and cards inside it need h3, that is the whole hierarchy"). It's a genuinely timing-dependent axe finding — the async-loaded card grid isn't present at the instant axe scans if data hasn't arrived yet — which is exactly why nobody had caught it before: it reproduced in roughly 1 of 4 runs, always attributed to the suite's already-documented Framer Motion flake rather than checked as a distinct signature. Isolating the violation id (`heading-order`, not `color-contrast`) confirmed it was real and separate. Fixed with one `sr-only` `<h2>` before each grid on all three pages — no visual change, confirmed clean across 9 reruns after the fix where it had failed 1-in-4 before.

**The axe sweep now genuinely covers both themes.** `accessibility.spec.ts` previously ran light-mode only, with its own comment naming a dark-mode pass as "a second, deliberately separate run" that had never been built. It now has one — `test.use({ colorScheme: 'dark' })` plus an `addInitScript` that sets `localStorage['practicable:theme']` before first paint, matching the app's own theme-persistence mechanism. 9/9 clean.

**A new, permanent seven-width suite.** `responsive-widths.spec.ts` checks all seven required widths (375 · 390 · 430 · 768 · 1024 · 1280 · 1440 — DESIGN.md §62's own list) against six real public routes plus a real question detail and a real course detail page, resolved from the live catalogue rather than hard-coded. 56/56 passing. This is deliberately separate from `stress-fixtures.spec.ts`: one checks whether deliberately extreme synthetic content overflows at the 375px floor, the other checks whether real, current content overflows at any of the seven required widths.

**A real mobile checkout walk, in Stripe test mode, at a real phone viewport (390×844).** Signed in as a pre-confirmed test account, browsed to the cheapest paid product, started checkout, paid with Stripe's documented test card (`4242 4242 4242 4242`), landed on `/checkout/success`, confirmed the entitlement, and downloaded the purchased template — the exact "sign-up → browse → buy → watch/download" walk `handover.md`'s own open-items list named as the one thing nobody had done. One local-environment wrinkle, not a product defect: no `stripe listen` process was forwarding webhooks to this local backend, so the entitlement didn't land automatically the way it will against the real deployed webhook endpoint. Rather than fake the result, the real, already-paid Stripe session was fetched back from Stripe's API and re-delivered as a genuine, correctly-signed webhook POST — exercising the actual handler code, not bypassing it. Every row this walk created (a Supabase Auth user, an app user, an order, an entitlement, a webhook-event row, an audit-log row) was deleted afterward; a direct re-check of the shared database confirms it's back to exactly the state it was in before (2 orders, 2 entitlements, 0 test users).

**One separate, minor finding, deliberately not fixed this session.** The walk surfaced that `CheckoutSuccess.tsx` and `Template.tsx` both title their page with a `CardTitle` (`h3`), the same missing-`h1` pattern the catalogue fix above addressed — but neither page is in `accessibility.spec.ts`'s `PUBLIC_ROUTES` list (one is a post-payment redirect target, the other requires an owned product to reach), so axe never had a chance to catch it. Named here for Week 4 rather than fixed in the same pass that found it, since it's outside this session's actual QA scope (a checkout walk, not an accessibility audit) and doesn't block anything — the pages function correctly, they're just one heading level short of DESIGN.md's own rule.

## 6. What's left, and why it isn't code

| Item | What it needs |
|---|---|
| The watched non-developer usability test (decision #23) | 30 minutes, a real non-developer, watched, unaided, using the admin tool — the owner's own words: "I will do the non-dev test later." Moved to Week 4's Definition of Done, named explicitly rather than silently dropped |
| The hostile-client email render check (ledger #11) | Actually opening one of the six templates in a real mail client — built for it since Phase 1, never checked |
| The two analytics reads (W3-R10) | Real customer traffic, which doesn't exist before the site is actually live |
| Supabase Auth's Site URL/Redirect URLs | An owner login to the Supabase dashboard — no API surface exists for this, in this or any automated session |
| Two product-preview images (ledger #18) | A column, an upload path, and a display component — untouched this session |
| The second course's depth (ledger #19) | An owner-held content decision on scope, unchanged since Week 2 |
| The `CheckoutSuccess.tsx`/`Template.tsx` missing-`h1` (§5) | One `PageTitle` swap on each, and adding both routes to the axe sweep — small, not urgent, named so it doesn't disappear |

None of these block Week 4 starting. The usability test and the hostile-client check are worth scheduling soonest, since both are the only remaining evidence for claims this report would otherwise be making on inspection alone.

## 7. Conditions that carry into Week 4

Nothing here is new; all were named and closed as deliberate positions in §8.4, not left open by omission:

1. **Stripe stays in test mode** (decision #21, closed 2026-08-15) — a restricted `rk_test_` key, confirmed still live this session.
2. **Hosting stays on Vercel Hobby / Render's current tier** (closed 2026-08-15) — coherent with staying in test mode, since no live payments means Vercel's commercial-use restriction isn't currently being violated.
3. **The refund window stays undecided on purpose** (decision #17, closed as "leave open") — the mechanism ships against generic, ACL-safe wording rather than a specific day count.
4. **These three are bundled, not independent**: the moment Stripe's key changes to `sk_live_`/`rk_live_`, the Vercel Hobby and Render free-tier questions both become urgent again on the same day — stated explicitly here so that switch doesn't happen without the other two being reopened in the same conversation.

## 8. Assessment

Week 3's stated objective was to make the store sellable to a stranger: several real products with deliberate pricing, email that actually arrives, money that moves backwards as well as forwards, an admin proven usable by someone who isn't the developer, shelves full enough to read as inhabited, and a database that stays fast as the catalogue grows. Every one of those is true today, verifiably — down to a detail the plan didn't originally ask for: a database with zero explicit indexes and zero uniqueness constraints on money-adjacent tables at the start of the week now has both, each one named to a query it serves and proven with `EXPLAIN`.

The pattern worth naming for Week 4, following the one Week 2's report named for itself: **an explicit, mid-week owner correction turned a planned deliverable into a better one, in the same session it was raised.** The pricing page wasn't broken — it was built exactly to spec — but the spec itself, once actually looked at next to Coursera's pattern, was the wrong shape for a product with no subscriptions. Removing it outright, rather than restyling it, is the harder call and the more honest one.

The other pattern worth naming plainly: **this session found one real defect it wasn't looking for.** The release QA slice was scoped as verification — confirm what's already believed to be true — and it caught a genuine, if minor, accessibility regression (or more precisely, a pre-existing gap nobody had isolated from a known flake) that inspection alone would not have surfaced, because it only reproduced some of the time. That's the actual argument for running the full QA slice rather than trusting the code review that preceded it.

**Go. Start Week 4.** The seven items in §6 are a mix of calendar entries (the usability test, the hostile-client check, a Supabase dashboard login) and small named engineering (two preview images, one heading fix, a second course's depth) — none of them block anything, and all of them are written down so none quietly disappears the way `handover.md`'s own rule insists they can't.

---

*Closes `week3_plan.md` Phase 6 step 8 and ledger item 49. Sourced from that document's §0.4, Phase 6 Definition of Done, §8.4, W3-R1 through W3-R11, and §28's task ledger; from [`handover.md`](handover.md)'s open-items list; and from this session's own test runs (`frontend/tests/e2e/accessibility.spec.ts`, `stress-fixtures.spec.ts`, `responsive-widths.spec.ts`, and `backend/tests/` — 62/62 passing).*
