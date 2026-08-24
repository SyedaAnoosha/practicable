# Engineering notes — merged working-session record

A single merged record of verification evidence and session-level decision logs from across
the project — database index measurements, gating and migration verification, two competing
design briefs and how they were reconciled, notable autonomous UI/UX decisions, the product
strategy document's shipped/gated status, and the email-transport history. Kept because the
*evidence* still matters even where the working notes that produced it don't need to survive
as separate files.

---

## 1. Database index evidence

The standing rule this project follows (repeated across every migration): **no index
without a plan, no plan without a measurement.** Every index below was verified with
`EXPLAIN (ANALYZE, BUFFERS)` against either the real database at its real row count, or a
synthetic production-shaped dataset built and rolled back inside a single transaction —
never committed, verified by re-counting `users` before/after each run.

### Migration `010` — the original index layer

| Index | Verdict |
|---|---|
| `ix_entitlements_user` | **Kept — 43× win, Seq Scan → Index Scan.** The single most important result: every gated request in the product runs this query. |
| `ix_product_contents_product_type` | **Kept — 10× win** |
| `ix_questions_published_title` | **Kept — 5× win, eliminates a Sort node** |
| `ix_lesson_progress_user_lesson` | **Kept — 62× win, Index Only Scan** |
| `ix_qlt_question` | **Dropped** — measured, doesn't change the plan, no near-term access pattern that would |
| `ix_orders_user_created` + 3 siblings | Kept despite no measured plan change — prerequisite for a named admin-pagination follow-up |
| Course-tree pair, join-table indexes | Kept — cheap, inconclusive only because the test data was too small |

One index dropped on measured evidence, two groups kept despite an inconclusive
measurement with an explicit written reason each — not silently kept "for comfort."

### Migration `013` — the two indexes that measured as unhelpful

Produced retroactively (the migration had already shipped before this evidence was
written). Both candidates measured as **unhelpful**: `ix_product_contents_type_content_
reverse` is redundant with an index from migration `010` and the planner never chose it
even when present; `ix_products_published_slug` has no real call site that filters
`published` in the same query. Neither finding blocks anything — the indexes cost near
nothing to maintain at this table size, and dropping a live index is a separate,
deliberate decision this evidence doesn't take unilaterally.

**A third finding from the same pass, not about an index:** `is_bundle` was never
backfilled. The one product that actually is a bundle (`risk-register-bundle`) had
`is_bundle = false` because the migration that added the column defaulted every existing
row to `false` and nothing backfilled the one row that needed `true` — silently disabling
the overlap guard's entire escape hatch for the one product that needed it. Fixed by
updating the live row and the seed script (which now self-heals a database seeded before
the fix). One small, real, pre-existing overlap remained after the fix — two standalone
products sharing one question grant — left as a named finding rather than resolved, since
whether that's acceptable is a catalogue-content decision, not an engineering one.

### Phase 8C — the admin metrics queries

All five `/admin/metrics` queries EXPLAINed for the first time this pass, against 5,000
synthetic orders (an order of magnitude past the real catalogue). **No new index was
warranted** — every query ran single-digit milliseconds, and every sequential scan present
was the plan a selective-enough index would produce anyway at this row count.

### Week 5 — migrations `026` and `028`

Same method, measured at both today's real (near-empty) scale and a synthetic scale sized
for where the tables are headed:

- **Promotions active-window query** (migration `026`): sequential scan today, correctly
  — the table is empty. At synthetic scale (5,000 rows, 2% active), the partial index
  `ix_promotions_active_window` is chosen, splitting the query's `OR` into two bitmap
  index scans touching 2 buffers against the 5,000-row table.
- **Full-text search** (migration `028`, courses and templates): sequential scan today,
  correctly — the tables are smaller than any GIN index would be. The GIN indexes will be
  chosen once each table exceeds roughly 100 rows.
- **Reviews approved-lookup** (migration `031` — an index specified in `029` and never
  actually created): at 20,001 synthetic rows, the partial index (`WHERE state =
  'approved'`) gets an index scan touching 3 buffers, versus a full sequential scan of the
  whole table on every content-detail page view without it.

**Verdict across all of Week 5's index work:** infrastructure for the growth that's
coming, not the volume that exists today — the same pattern as migrations `010` and `013`.

---

## 2. Gating suite — seen-red evidence

The standing rule: *"A test that has never failed has not been verified. Every gating test
is seen red before it is trusted green: comment out the check, watch it fail, restore it."*
Run against 25 backend gating cases plus the Playwright anonymous-redirect case. For each,
the guard was disabled in place, the test was run and observed failing, the guard was
restored verbatim, and the full suite re-run to confirm a clean pass. No test was ever
edited — only the production code it exercises.

Guards proven this way include: the logged-out lesson lock, `has_access_to()`'s real
entitlement query (8 of 9 targeted tests failed when it was forced to always return
`True`), the 60-second presigned-URL TTL, Mux playback-token scoping to one playback ID,
the draft-lesson 404, the question index never leaking the gated body, the free/paid
template branch, the admin-bypass audit write, and Stripe webhook idempotency (disabling
the dedupe check caused a triple-send — exactly the failure mode the test exists to catch).
One case (direct storage URL access) is enforced by the Supabase Storage bucket's own
access policy rather than application code, so there was nothing to comment out — it was
spot-checked live against the real bucket instead.

**Four additional attacks were found and defended during the same pass**, beyond the
twelve originally scoped: a webhook with a forged Stripe signature (400, rejected before
the handler runs), a webhook naming an unknown product id (500, loud failure by design), a
JWT signed with the wrong private key (401), and a JWT with the wrong audience claim (401).
The JWT-audience/signature checks were the most significant finding — a live bypass that
existing tests were designed to catch, and did; the fix was a one-line removal of an
`options` override that had silently disabled a security-critical default.

**Total: 16 attack vectors named across both passes, 16/16 defended.**

---

## 3. Lesson-block migration — render-parity evidence

The standing rule: *"A migration that changes live content silently is worse than no
migration."* The `009_lesson_blocks` migration had already run before this check was
written, so there was no "before" build left to screenshot against. Instead: the block
renderer is a pure function of three fields (`text_body`, `media_id`, `template_id`) read
off each `lesson_blocks` row, so byte-identical fields guarantee byte-identical rendering —
a stronger guarantee than a screenshot, which is only ever a proxy for this.

All three lessons that existed before the migration were checked against the live
database: exact field matches on all three (video media id, reading body full-string
equality, download template id), each backfilled into exactly one block of the correct
type with `sort_order = 0`. This closes the content-safety half of the concern; the
layout/CSS-parity half is covered by the block components' own Definition of Done rather
than a dedicated before/after screenshot.

---

## 4. Two competing design briefs — how they were reconciled

A second, independently-written creative brief for the whole platform arrived partway
through the project, alongside the already-adopted `DESIGN.md`. `DESIGN.md` §0.7 records
the outcome: it is not treated as a second source of truth, and where it disagreed with an
already-audited, already-shipped decision, `DESIGN.md` won. Three places the second brief
was simply right, and `DESIGN.md` was corrected to match: the question body should be
public with email capture as a soft conversion device (not a hard security boundary); the
question title should be serif, not sans; and the mobile filter sheet should apply changes
live, not batched on close.

Where `DESIGN.md` was and remains stronger: contrast actually audited against WCAG 2.2
with corrected hex values (not just asserted), a real `[DECIDED]`/`[OWNER]`/`[PROVISIONAL]`
decision-status marker system, numbered speed-to-answer budgets tied to real analytics
events, a real copy glossary, and a document that is stack-specific and buildable rather
than a mood brief. Where the second brief was genuinely stronger: a real "what to avoid"
anti-pattern list, a sharper single end-to-end prototype journey, and an explicit
visual-priority ranking of the whole information architecture — several of these were
folded into `DESIGN.md` in its own format rather than left to live only in the second
document.

---

## 5. Session-level UI/UX decision logs — highlights

Three separate passes recorded autonomous senior-engineering/UX judgement calls made while
the owner was unavailable, each with the reasoning and the "reasonable objection and why it
was rejected anyway." The full entries are working notes; what's worth keeping is the
pattern and the handful of real defects each pass found:

- **A live data-loss bug in account receipts** — found and fixed while auditing pagination
  and error-state coverage on the account/receipts screen.
- **A refund success confirmation that was never actually visible** — the confirmation
  fired, but nothing in the DOM surfaced it to the user.
- **A real name-shadowing bug** found while extracting a shared account-deactivation
  service across export/closure flows.
- **The email-change audit hook was moved** from `AccountProfile.tsx`'s direct
  `updateUser()` call site to `RootLayout.tsx`'s `onAuthStateChange` subscription, so it
  fires on any genuine email transition rather than only the one call site that happened
  to trigger it.
- **The admin metrics response and its test fixture disagreed on casing** (camelCase API,
  snake_case fixture) — the kind of defect a green suite doesn't catch because the fixture
  and the API had simply never been compared against each other.
- **The homepage products section went through three layout iterations** (bento grid →
  mini cards → horizontal carousels → an editorial layout) before landing, each rejected
  for a stated, specific reason rather than taste alone — the bento grid read as "three
  separate boxes," for instance, which is the literal defect it was replaced to fix.
- **The collapsible sidebar, command palette, discount banner, and cookie consent** were
  all built and refined in this window; each is now covered in `REDESIGN.md` (the
  sidebar and command palette) or `handover.md` (promotions/discount banner, Week 5).

---

## 6. Product strategy — what shipped, what's still gated

A long-running strategy document tracked proposals against what actually shipped. Its
final status footer (updated after Week 4, and still accurate as of Week 5) is the
load-bearing part:

**Shipped:** the pre-purchase evidence layer, tax-invoice-quality receipts, the overlap
publish guard, question-to-product routing, metrics computed from the database, the
product-page format guarantee (rendered from real columns, never typed per product), real
preview assets, and a proper search-title/outcome-name column — all closed by end of Week
4; promotions, certificates, full-text search, reviews, and notes/bookmarks closed in
Week 5 (see `handover.md` §6).

**Still gated, and why:**

| Proposal | Gate |
|---|---|
| Decision Pack workspace | Schema + editor + autosave + generator + review scheduler — weeks of work, not days. Its prerequisites (the overlap guard, the evidence layer) now ship. |
| "Challenge My Thinking" AI | Needs an editorial-guardrails and confidentiality position across all 100 questions — not engineering-blocked, an owner decision. |
| Free Risk Diagnostic | Needs a scoring model and a recommendation output layer; the question-routing model already shipped is its output half. |
| Scenario Packs | Content, not code — ship one before deciding whether to build five. |
| Consultant licence tiers | Blocked on an explicit owner decision about whether buyers may use artefacts with their own clients. |
| Question of the Week | Blocked on editorial capacity — 52 original pieces a year is a real standing commitment. |
| Semantic search | First item in `DESIGN.md`'s own deliberate v2 cut list. |

**Deliberately not taken, on purpose:** removing the price ceiling (pricing is the owner's
call, not an engineering one — the adopted price ladder is recorded in `DESIGN.md` §27) and
narrowing the lifetime-update promise (also an owner call; the `version`/
`last_reviewed_at` machinery that would support a narrower promise already shipped either
way).

One correction the strategy document made about itself, worth keeping as a lesson: the
seven-tag taxonomy discussion in an early draft assumed AI confidentiality was unmentioned
as a product requirement, when it in fact already was — a reminder that "not mentioned
where I looked" and "not decided" are different claims, and conflating them is exactly the
kind of thing that turns into a real gap if unchecked.

---

## 7. Email transport — historical trail (superseded)

Worth recording only because it explains a decision still visible in the code today: the
backend tried Gmail SMTP, then Resend, then Brevo, then several other providers across
Weeks 1–2, because a real test order revealed Resend's sandbox sender could only deliver
to the Resend account's own address — the buyer received nothing, and the owner received
the buyer's receipt, unlabelled, in the wrong inbox. That multi-provider fallback chain is
now retired. **Mailjet has been the sole transport since Week 3** (`handover.md` §1),
reached over REST rather than SMTP specifically because Render blocks outbound SMTP on
port 587. Delivery is confirmed per-send via Mailjet's own REST message-status endpoint,
never inferred from the absence of a logged error.
