# Week 4 — PRD, Design Specification and Implementation Plan

**"Deciding in the Dark" Platform · v1.0 · 2026-08-17 · opens on the GO recorded in [`week3_report.md`](week3_report.md)**

*Sourced from `Deciding_in_the_Dark_Platform_Intern_Brief.md` (Week 4 — design, hardening and handover), `DESIGN.md` (§16, §40, §41, §42, §43, §60, §62), `BACKEND.md`, `Deciding_in_the_Dark_Research_Specification.md` (Parts Four, Seven, Eleven), `docs/new_additions.md` (the commercial strategy — triaged for feasibility in §2.2 below), `docs/pricing.md`, `docs/handover.md`, `docs/db_index_evidence.md`, `frontend/src/styles/theme.css`, and a direct read of the repository on 2026-08-17. Every requirement below traces to at least one of those; where they disagree, §0.3's precedence rule decides.*

---

## 0. How to read this document

### 0.1 What each part is for

| Part | Contains | Read it when |
|---|---|---|
| **I — PRD** | What Week 4 must produce, and how each item is judged. Includes the feasibility triage of `new_additions.md` (§2.2) | Before you start; before you cut anything |
| **II — Design specification** | Every colour, typeface, size, line height, tracking, space, radius, shadow, gradient, easing, duration and string used this week | Before you write a component; while you write a component |
| **III — Implementation plan** | Phase by phase, step by step, with file paths, migrations and code | While you build |
| **IV — Database: optimisation, integrity and the new columns** | Migration `013`, the second index pass, keyset pagination, and the method for proving each entry | Phase 1, and before any query is called "fast" |
| **V — Ledger, risks, reference** | The task ledger, the risk watchlist, the commands that matter | Daily |

### 0.2 Status markers

`[BUILT]` verified present in the repository on 2026-08-17 · `[GAP]` verified absent on 2026-08-17 · `[OWNER]` blocked on a decision only the owner can make · `[NEW]` first specified in this document · `[DEFECT]` a live bug found while writing this plan, with its fix scoped here · `[CARRIED]` named in `week3_report.md` §6 or `handover.md` §4 and still open · `[UNVERIFIABLE]` cannot be checked from an automated session

### 0.3 Precedence

Unchanged from `week3_plan.md` §0.3, restated so this document can be read alone:

1. **The intern brief** — non-negotiables and the four-week sequence. Nothing overrides it. Week 4's own line: *"Apply the design system across every screen. Hunt the small things… Try to break your own gating and fix what gives. Write the handover pack. Ship something a stranger can find, buy from and learn on."*
2. **`DESIGN.md`** — everything the user sees.
3. **`BACKEND.md`** — the service, the gate, the API contract.
4. **The Research Specification** — the reasoning, the entity model, the legal and security positions.
5. **`frontend/src/styles/theme.css`** — the single source of truth for every design *value*. Where `DESIGN.md` and `theme.css` state different numbers, **`theme.css` is right and `DESIGN.md` is stale.** §13.1 below records exactly where that is currently true.
6. **`docs/pricing.md`** — the price authority. `new_additions.md` §0.2 defers to it by its own words.
7. **`docs/new_additions.md`** — the commercial strategy. Advisory: it proposes, this plan disposes. §2.2 records what was taken and what was not, with the reason in both directions.
8. **This document** — sequencing and detail. Where it contradicts one of the above, the above wins and this file is wrong.

### 0.4 Verified state of the build entering Week 4

Every row checked against the repository on 2026-08-17 by direct read — not carried forward from `week3_plan.md`, and not inferred from `week3_report.md`.

| Area | State | Evidence |
|---|---|---|
| Gate, single choke point | `[BUILT]` | `app/core/entitlements.py` — `resolve_product_ids()` filters `revoked_at IS NULL` in the one query every gated request already runs |
| Gating suite | `[BUILT]` | `backend/tests/gating/test_gating.py` — 34 cases in that file, 62 backend tests total, each seen red ([`gating_seen_red.md`](gating_seen_red.md)) |
| Index layer | `[BUILT]`, first pass | Migration `010` — 17 indexes + 4 UNIQUE constraints, each `EXPLAIN`-proven ([`db_index_evidence.md`](db_index_evidence.md)); migration `011` adds `ix_entitlements_user_live` (partial, `WHERE revoked_at IS NULL`) |
| Refunds and revocation | `[BUILT]` | `services/refund_service.py`, `POST /admin/orders/{id}/refund`, `charge.refunded` webhook, `RefundDialog.tsx` |
| Cart / multi-item checkout | `[BUILT]` | `useCartStore`, `CartDrawer`, `POST /checkout/session` takes `product_ids: list[str]` |
| Email spine | `[BUILT]` | Mailjet over REST; 8 Jinja2 template pairs in `app/emails/` (plus `base.html.j2` and `_button.html.j2`); delivery confirmed per-send via Mailjet's REST Message resource |
| Publish states | `[BUILT]` | Migration `012` — `draft \| in_review \| published \| archived` on 5 tables; `PublishStateMixin` keeps `published`/`publish_state` in sync on every write path |
| Editorial control of the front page | `[BUILT]` | `questions.featured` / `featured_sort`, `FeaturedToggle`, `FeaturedSummary` |
| Catalogue | `[BUILT]` | 8 published products across templates, a course, a domain pack and one bundle (`docs/pricing.md` §2) |
| Accessibility primitives | `[BUILT]` | `RootLayout.tsx` has `RouteAnnouncer` (`role="status" aria-live="polite"`) and the skip link; `PageTitle.tsx` renders `tabIndex={-1}` on its `h1` |
| Responsive + axe suites | `[BUILT]` | `responsive-widths.spec.ts` (7 widths × 8 routes, 56/56), `accessibility.spec.ts` (both themes, 9/9), `stress-fixtures.spec.ts` |
| **Product/template evidence fields** | **`[GAP]`** | `db/models/product.py` and `db/models/template.py` read in full: **no `licence`, no `version`, no `last_reviewed_at`, no `preview_image_keys`, no page/sheet count, no editability flag.** `DESIGN.md` §16 requires "two previews minimum per paid template"; `new_additions.md` §2 names six of eight pre-purchase checks as unmet |
| **Tax-invoice-quality receipt** | **`[GAP]`** | `integrations/stripe_client.py` builds the session with `line_items` + `customer_email` only — **no `invoice_creation`, no business name, no address collection.** `new_additions.md` §4 makes this a hard prerequisite above ~A$150. (No ABN was ever a target — decision #31, resolved 2026-08-20, is "no ABN, anywhere") |
| **Overlap publish guard** | **`[GAP]`** | Nothing checks whether two published products' `product_contents` intersect. `new_additions.md` §11: this is the guard that would have caught the `db/seed/012` bug before a customer did |
| **Question → product routing** | **`[GAP]`** | Both halves exist (`question_relations`, `product_contents`), the join and the UI do not. `new_additions.md` §22 names this as the thing that finally makes the seven tags visible to a buyer |
| **Admin product editor** | **`[GAP]`** `[CARRIED]` | No `/admin/products` route in `App.tsx`; `admin/router.py` has questions, courses, templates, orders, media only. A price cannot be set without a direct database write (`handover.md` §4 item 16) |
| **Contact inbox** | **`[GAP]`** | `contact_messages` rows are read by hand-written SQL (`handover.md` §2). Nothing in the app reads that table |
| **Checkout / webhook fixture tests** | **`[GAP]`** | `backend/tests/` covers gating, lesson blocks, packs and question scoring. **The code that moves money has no fixture test** — `handover.md` §4 item 5 names this as the highest-consequence remaining gap |
| **Taxonomy parity test** | **`[GAP]`** `[CARRIED]` | No assertion that a taxonomy value hard-coded in the frontend exists in `tag_values`. This is the exact bug that left every quick-filter chip matching zero questions for three days (`handover.md` §1, 2026-08-14) |
| **Frontend unit tests** | **`[GAP]`** | `vitest` is configured (`package.json` `"test": "vitest run"`, `src/test/setup.ts` present) and there is **one** test file in `src`: `lib/scoring.test.ts` |
| **Performance budgets** | **`[GAP]`** | `DESIGN.md` §43 states LCP < 2.0s, CLS < 0.05, initial JS < 180KB and says they "fail CI." Nothing in `.github/workflows/` measures any of them |
| **Admin orders pagination** | **`[GAP]`** | `admin/orders.py` has `ORDER BY created_at DESC` and no `LIMIT`. Migration `010` already built `ix_orders_created` as named prerequisite infrastructure for the keyset pagination that was never written |
| **`CheckoutSuccess.tsx` / `Template.tsx` heading level** | **`[GAP]`** `[CARRIED]` | Both title with `CardTitle` (`h3`), not `PageTitle` (`h1`); neither route is in `accessibility.spec.ts`'s `PUBLIC_ROUTES` (`week3_report.md` §5) |
| **CI environment is stale** | **`[DEFECT]`** | `.github/workflows/ci.yml` still exports `RESEND_API_KEY` and sets **no** `MAILJET_*` variable. Resend was removed from the send path on 2026-08-15; the transport CI runs against is not the transport the app uses |
| **Render production env** | **`[GAP]`** `[CARRIED]` | `handover.md` §4 item 15 — Resend-era vars still set, Mailjet vars not set. Deploying today produces a `logger.error` on every send and no email |
| Watched non-developer usability test | **`[GAP]`** `[CARRIED]` | Deferred from Week 3 by the owner's own words ("I will do the non-dev test later"). Human, not engineering |
| Hostile-client email render check | **`[GAP]`** `[CARRIED]` | Eight template pairs built for it since Phase 1 on a 600px table-based base; never opened in a real mail client |
| Supabase Auth Site URL / Redirect URLs | **`[UNVERIFIABLE]`** `[CARRIED]` | Dashboard-only setting. No API surface exists for this in any automated session |
| The two analytics reads (W3-R10) | **`[GAP]`, data not wiring** | Nine events confirmed wired, four fired live. No `phx_` query key configured, and the site is pre-launch with no real traffic to read |
| Stripe mode | **`[CLOSED]`, deliberately** | `rk_test_` restricted key. Decision #21 closed 2026-08-15: stay in test mode until told otherwise |
| Vercel / Render tier | **`[CLOSED]`, deliberately** | Vercel Hobby, Render current tier. Coherent with test mode — no live payments means the commercial-use restriction is not currently being violated |
| **Chart tokens** | **`[DEFECT]`, dormant** | `theme.css` comments them "Dormant: nothing renders a chart yet." `--chart-1`/`--chart-2` are **navy/steel in light and gold in dark** — the same token meaning two different things, the exact class of bug `handover.md` §1 documents eight times over for `--primary`. `--chart-4` is byte-identical in both themes (`#5C6B4F`). See §12.6 |

---

# PART I — PRODUCT REQUIREMENTS

## 1. Objective

> **Make the platform survive a stranger. Not "does the happy path work" — Week 3 answered that — but: does every wrong turn have a designed answer, can a buyer see enough before paying to not want a refund afterwards, can the owner run the shop without a developer, and is the whole thing written down well enough that someone else can pick it up on Monday.**

Week 1 proved one path works once. Week 2 proved it keeps working and widened one product into a catalogue. Week 3 made it a shop that can take money and give it back. **Week 4 is the week the platform stops needing its author in the room.**

The brief's own words: *"Apply the design system across every screen. Hunt the small things: empty states, failed payments, expired sessions, broken links, a video that will not load, the checkout on a phone. Try to break your own gating and fix what gives. Write the handover pack. Ship something a stranger can find, buy from and learn on."*

## 2. Why this scope

### 2.1 The three things the brief's Week 4 does not say, and why they are here anyway

The brief's Week 4 is hardening plus handover, and that is the spine of this plan (W4-R6 through W4-R9, W4-R12). Three additions come from elsewhere, each with a reason that is not "it seemed good":

**1. The pre-purchase evidence layer (W4-R1).** `new_additions.md` §2 runs the professional buyer's unconscious checklist and finds **six of eight items unmet**: what is it literally (page/file/format counts), can I edit it, will it open at work, is it current, can I expense it, can I use it with a client. Its verdict — *"Six of the eight are content or configuration, not engineering. That is the cheapest conversion work available and none of it is in any product plan. It is worth more than the next three products"* — is correct, and it is also **hardening**, not a feature: the research spec names *"unclear what they will receive before payment"* as the #1 abandonment cause, and `new_additions.md` §5 names expectation failure as the #1 refund cause. A refund the platform now honours correctly (Week 3) is still a refund. This is the cheapest way to not need one.

**2. Question → product routing (W4-R4).** `new_additions.md` §22 makes the strongest structural argument in that document: both halves already exist in this database, only the join and the UI are missing, and it is the feature that finally makes the seven-dimension taxonomy — the platform's single differentiator — visible to someone deciding whether to pay. It is also the honest answer to the softer gap `handover.md` §4 item 9 left behind: a question page that leads somewhere is a question page that sells.

**3. The tests that guard money (W4-R9).** `handover.md` §4 item 5 states it plainly: *"checkout and webhook handling specifically are still untested by fixture — the highest-consequence remaining gap, since that's the code a silent regression would actually cost money on."* Week 4 is the last scheduled week. If this does not happen now it does not happen.

### 2.2 Feasibility triage of `docs/new_additions.md`

`new_additions.md` is a 1,153-line commercial strategy, not a build plan, and it says so (§0.2). This section is the explicit read-through the plan was asked for: every proposal in it, sorted by whether Week 4 can actually take it. **The test applied is not "is it a good idea" — most of them are — but "is the engineering bounded, does it need content that does not exist, and does it need an owner decision that is still open."**

#### Taken into Week 4 — bounded engineering, no missing content, no blocking decision

| `new_additions.md` § | Proposal | Where it lands | Why it is feasible now |
|---|---|---|---|
| §34 item 1 · §4 | **Tax-invoice-quality receipts** (business name, itemised, GST line) | **W4-R2** | Stripe Checkout supports `invoice_creation` natively; the receipt template already itemises per cart item since Week 3. The entity is already decided (#27 closed 2026-08-15: "Effective RM, as currently drafted"). No ABN is issued (decision #31, resolved 2026-08-20: the entity is not GST-registered, so the field does not exist) |
| §34 item 2 · §20 | **Licence field + terms on the product page** | **W4-R1** | One column, one enum, one paragraph. `new_additions.md` calls it *"the best unbuilt revenue"* — but note the split: the **field and the Standard-licence display** are feasible now; the **client-delivery tier and its multiple** are decision #25, still open, so the enum leaves room and the page states only what is decided |
| §34 item 3 · §33 | **Version + last-reviewed on every sold artefact** | **W4-R1** | Two columns, displayed pre-purchase and stamped into the receipt. Directly answers the "is it current" check |
| §34 item 4 · §11 | **The overlap publish guard** — no two published products may grant intersecting content unless one is a bundle | **W4-R3** | Checkable in one SQL statement against `product_contents`; the admin publish-guard pattern already exists (a template cannot publish without a file; a lesson cannot publish without content). Half a day, and it is the guard that would have caught the `012` bug |
| §34 item 5 · §22 | **Question → product routing** | **W4-R4** | *"Both halves exist; join + UI missing."* Verified true: `product_contents` links products to questions via `content_type = 'question_set'`, and `question_relations` (300 rows) links questions to questions. Migration `013` adds the one index the join needs |
| §34 item 6 · §2.1 · §16 | **Real preview assets on product pages** — one real page, not a blurred thumbnail | **W4-R1** | The presigned-upload path built in Week 3 Phase 5 (`POST /admin/templates/{id}/upload-url`) is reused unchanged. Closes `week3_report.md` ledger #18 |
| §3 (all five rules) | **The corporate-laptop constraints** — no macros, `.xlsx`/`.docx` not `.xlsm`, minimum Office version, ship both editable + PDF where visual, library-not-email delivery | **W4-R1** | Four of the five are a *display* obligation the product page has never met, plus one policy line. *"It didn't open" is the single most likely refund cause for a digital artefact sold into corporate environments, and it is entirely preventable* |
| §35 (all five) | **The five metrics that matter** — second-purchase rate, free→paid conversion, tag-filter usage, refund rate by product, signup→first-purchase time | **W4-R10** | Four of the five are computable **in SQL against tables that already exist** (`orders`, `order_items`, `entitlements`, `users`, `leads`). This is the honest answer to W3-R10's two unanswerable reads: PostHog needs traffic the site does not have; Postgres already holds the record of every transaction that ever happened |
| §11 (mechanism) | Make the no-overlap rule *mechanical, not aspirational* | **W4-R3** | Its own words: *"This is checkable in SQL, and belongs as an admin publish guard"* |

#### Taken in principle, scoped down — the engineering fits, the content does not

| §  | Proposal | What Week 4 actually does | Why not the whole thing |
|---|---|---|---|
| §7 | **Outcome name + literal search title, in fixed positions** | The `search_title` column ships in migration `013` and renders as the `<title>`/`og:title`; the copy for existing products is left to the owner, with a fallback to `name` so an unset value degrades rather than blanks | Writing eight search-optimised titles is editorial work, not engineering. The *slot* is what unblocks it |
| §20 | **Consultant licence tiers** | The `licence` enum ships with `standard` populated and `client_delivery` / `multi_client` defined-but-unused; the product page renders only the tier actually set | Decision #25 (may buyers use artefacts with their clients, at what multiple) is open. `new_additions.md`'s own warning applies: *"Never casually write 'commercial use allowed'"* |
| §31 | **Question of the Week** | Not built. The `featured`/`featured_sort` columns shipped in Week 3 are the mechanism it would use, and W4-R10's metrics page surfaces which questions are actually read | *"52 of these a year is a real editorial commitment"* — that is decision #30 (editorial capacity), unanswered. Shipping the send loop before the commitment exists builds a broken promise |

#### Deferred, with the gate named

| § | Proposal | Gate |
|---|---|---|
| §13–14 | **Decision Pack as a workspace** (`decision_workspace` content type, framing → answers → evidence → options → decide → generated outputs → review) | The architecture genuinely supports it (`product_contents` is polymorphic; `entitlements.py` does not change at all) — and it is still *"a schema, an editor, autosave, a generator, and a review scheduler. Weeks, not days."* `new_additions.md`'s own §14.3 says **do not launch the flagship at the flagship price**: ship v0 as files at A$79 first, as a demand test. That is author-days, not engineer-days. **Nothing in Week 4 blocks it, and Week 4 removes two of its prerequisites** — the overlap guard (W4-R3) and the evidence layer (W4-R1) both apply to it unchanged |
| §28 product 3 | **The free Risk Function Diagnostic** | *"The only one of the three requiring engineering."* A real feature — scoring model, result page, recommendation output — landing in the same week as an accessibility audit and a handover pack. W4-R4's routing model is its output layer, built first and deliberately: the diagnostic becomes "a different way to reach the same routing," not a second recommendation engine |
| §23–25 | **"Challenge My Thinking" AI** | Two hard gates, both stated in `new_additions.md` itself: 100 questions × real editorial guardrails (expected reasoning, weak answers, follow-ups, red flags), and **the confidentiality position** (§24.2) — decision #29, unanswered. *"For a meaningful share of the target market it determines whether the flagship is usable at all."* Not engineering-blocked; blocked on an author and a published privacy commitment |
| §15 | **Scenario Packs** | Content. And its own correction applies: ship **one**, not five |
| §30 (all) | Framework crosswalks · clause banks · expert review · tabletops · industry variants · team licensing · benchmark reports · annual update subscriptions | Each already carries its own gate in that document. None is contested here |
| §60.1 | Semantic search | First in `DESIGN.md`'s own cut order |

#### Rejected for Week 4, on this plan's reading rather than `new_additions.md`'s

| Proposal | Why not |
|---|---|
| §18's *"treat A$99 as the ceiling until the tax-invoice path, refund policy and licence terms are live"* — read as a **pricing change** | Agreed as a *constraint*, refused as an *action*. `pricing.md` is the price authority (§0.3 rule 6) and its ladder is owner-adopted. W4-R2 and W4-R1 exist precisely to **remove** that ceiling; changing prices is the owner's call afterwards, not a side effect of a hardening week |
| §33 point 2 — narrowing the lifetime-update promise | `pricing.md` already made that promise in a live document. Narrowing a live commercial promise is decision #26, and it is not an engineering decision. **What Week 4 does instead** is make the promise cheap to keep: `version` + `last_reviewed_at` + "old versions remain downloadable" is the machinery that turns an open-ended obligation into a bounded one |

**The honest summary of the triage:** `new_additions.md`'s §34 table claims *"items 1–4 total roughly one engineering day and unblock the entire upper price range."* That is optimistic by roughly a factor of three once the migration, the admin write path, the display components, both themes, seven widths and the tests are counted — but the *shape* of the claim survives. These are small, bounded, high-leverage changes that sit naturally inside a hardening week, and they are the reason W4-R1 through W4-R4 exist.

## 3. Who this week serves

| User | What Week 4 gives them | Requirement |
|---|---|---|
| **The stranger, ninety seconds before paying** | Page count, file count, formats, editability, version, last-reviewed date, licence, two real preview pages, a refund position and a tax statement — all above the buy button | W4-R1 |
| **The buyer whose finance team asks** | An itemised tax invoice with a business name, not a card receipt | W4-R2 |
| **The buyer who took a wrong turn** | A designed answer to every failure: payment declined, session expired, download URL expired, playback token expired, webhook late, video won't load, filters return nothing | W4-R6 |
| **The buyer who cannot use a mouse** | A purchase and a lesson completion, both keyboard-only, both proven | W4-R7 |
| **The visitor who filtered** | "Here's what would help with these" — derived from their own constraints, and it says why | W4-R4 |
| **The owner** | A price they can change, a publish state they can set, an inbox they can read, and five numbers that answer whether any of this is working | W4-R5, W4-R10 |
| **The owner's catalogue, six months out** | A guard that refuses to publish two products that overlap, so the `012` bug cannot recur | W4-R3 |
| **The next developer** | A handover pack that is current, a CI that runs against the real transport, and a fixture test on the code that moves money | W4-R9, W4-R12 |

## 4. Scope

### 4.1 In scope

W4-R1 The pre-purchase evidence layer · W4-R2 Tax-invoice-quality receipts · W4-R3 The overlap publish guard · W4-R4 Question → product routing · W4-R5 Admin closes its remaining holes · W4-R6 The hardening sweep · W4-R7 Accessibility, the full audit · W4-R8 Performance budgets, enforced · W4-R9 The tests that guard money · W4-R10 Metrics from the database · W4-R11 Database optimisation, second pass · W4-R12 The handover pack, closed · W4-R13 Admin panel video playback and rich text lesson editor `[NEW]` `[OWNER INSTRUCTION 2026-08-19]`

**Week 5, planned here rather than improvised** (each sized past what five days holds, and said so): W4-R14 Admin manages the whole system · W4-R15 Price control from the admin panel · W4-R16 Why buy this, and what a buyer may do with it · W4-R17 A course created in admin is purchasable · W4-R18 One Products menu · **W4-R19 The content types *are* the products** `[NEW]` `[OWNER INSTRUCTION 2026-08-20]` · **W4-R20 A refund the buyer can see and start** `[NEW]` `[OWNER INSTRUCTION 2026-08-20]` · **W4-R21 The user account a buyer can actually manage** `[NEW]` `[OWNER INSTRUCTION 2026-08-20]`

### 4.2 Out of scope, deliberately

| Not this week | Why | Source |
|---|---|---|
| `decision_workspace` / Decision Pack v1–v2 | Weeks, not days. Its prerequisites ship this week; the thing itself does not | `new_additions.md` §14.3 |
| The free diagnostic | A real feature landing in an audit week. W4-R4 builds its output layer first, on purpose | `new_additions.md` §28 |
| "Challenge My Thinking" AI | Blocked on an editorial backlog and decision #29 (confidentiality position) | `new_additions.md` §24 |
| Question of the Week | Blocked on decision #30 (editorial capacity). A retention loop you abandon by March is worse than none | `new_additions.md` §31 |
| Client-delivery / multi-client licence **tiers** | Decision #25 open. The field ships; the tiers do not | `new_additions.md` §20 |
| Semantic search | First in the cut order | `DESIGN.md` §60.1 |
| Subscriptions, team seats, certificates, author portal | Named non-goals for v1 | `DESIGN.md` §61 |
| Going live on Stripe | Decision #21 closed as "stay in test." **And it is bundled** — see §8.3 | `week3_report.md` §7 |
| Read replicas, caching layers, sharding | The answer at this scale is indexes and query shape. Part IV | `week3_plan.md` §27.4 |
| New colour tokens, new type rungs, new radius values | Week 4 *applies* the system. `theme.css` gains no new palette family this week — one narrowly-scoped chart-token repair excepted (§12.6) | Brief; `DESIGN.md` §60 |

## 5. Requirements

Each carries its source, a testable statement, and the acceptance criteria used at the go/no-go.

---

### W4-R1 — The pre-purchase evidence layer `[MUST]` `[NEW]`

**Source:** `new_additions.md` §2, §2.1, §3, §33 · `DESIGN.md` §16 (*"Two previews minimum per paid template"*) · RS Part Two §2.2 (abandonment) · `week3_report.md` ledger #18 `[CARRIED]`

**Statement:** A stranger looking at any paid product can answer, without scrolling past the fold on a phone and without asking anyone: *what will I actually receive, will it open on my work laptop, is it current, what am I allowed to do with it, and what happens if it's wrong.*

**What ships:**

1. **Migration `013`** adds to `templates`: `page_count`, `sheet_count`, `is_editable`, `has_macros`, `min_office_version`, `preview_image_keys` (a JSONB array of Storage keys), `version`, `last_reviewed_at`. Adds to `products`: `licence`, `search_title`, `version`, `last_reviewed_at`. Full column spec, types, defaults and backfill in §25.
2. **`EvidencePanel`** (§20.1) — the component that renders those facts, on `/buy/:slug`, `/templates/:templateId` and `/store/packs/:slug`.
3. **`PreviewGallery`** (§20.2) — two real preview images minimum for every paid template, uploaded through the existing presigned path, lightboxable, `alt` text describing what the page shows.
4. **`LicenceLine`** (§20.3) — the licence, in one sentence, linking to the terms.
5. **`VersionStamp`** (§20.4) — `v1.2 · reviewed 17 Aug 2026`, in mono, above the buy button and stamped into the receipt.
6. **The format guarantee**, as a real product-page line, not a marketing claim: *"`.xlsx`, no macros, opens in Excel 2016 and later."* Rendered from the columns, never typed per product.
7. **Admin write path** — every one of those fields is editable in the new product editor (W4-R5) and the existing template editor.

**Acceptance:**
- [ ] Every **published, paid** template has `page_count` or `sheet_count` set, `is_editable` set, `has_macros` set, and **at least two** `preview_image_keys`. A SQL query proves it, and the query is in the ledger — not a spot check.
- [ ] The overlap guard's sibling check: **no published paid product may publish with fewer than two previews.** Fails closed, with a message naming what is missing (same pattern as the existing "upload a file before publishing" guard).
- [ ] `has_macros = true` on any published artefact is a **publish refusal**, not a warning. `new_additions.md` §3 rule 1: *"No macros in any sold artefact. Ever."*
- [ ] The panel renders correctly at 375px with a 140-character product name and a 42-character author name (the `stress-fixtures.spec.ts` extremes) — no overflow, no clipped preview.
- [ ] Both themes. The preview image is a document page, usually white — §16.3's rule applies: a light plate (`bg-muted p-3 rounded-md`) behind it in dark mode, **not** a filter.
- [ ] Nothing on the panel is a claim the database cannot support. An unset `version` renders nothing, not `v—` and not "1.0".

---

### W4-R2 — Tax-invoice-quality receipts `[MUST]` `[NEW]`

**Source:** `new_additions.md` §4, §34 item 1 · RS §11.5 · `pricing.md`

**Statement:** A buyer whose organisation reimburses them can get a document their finance team accepts, without emailing anyone.

`new_additions.md` §4's finding is the whole argument: *"Every price increase moves the purchase from a personal card to a finance approval"* — and above ~A$150 that approval needs a proper tax invoice with a business name. The catalogue's ceiling today is A$99. **This is not about the products that exist; it is about the ones the ladder already names** (A$149, A$199, A$279, A$399), all of which are currently unbuyable by anyone who needs to expense them. *"A buyer who cannot expense your product does not haggle — they silently leave."*

> **`[AMENDED 2026-08-20 — owner instruction]` Decision #31 is closed, and it closed the other way.** The owner's instruction was *"remove author ABN number from everywhere"* — the entity is not GST-registered and has no ABN to publish. This is not the honest-degradation case §25 originally scoped (an unset value that might later be set); it is a field that does not exist. **No `seller_abn` config, no ABN line, no ABN mention anywhere in the app** — `app/core/config.py`, `email_service.py`, both receipt templates (`.html.j2`/`.txt.j2`) and `legal/Terms.tsx`'s owner placeholder are all edited accordingly. Everything below that still names an ABN is the pre-amendment record of what W4-R2 originally asked for; the build does not do it.

**What ships:**

1. `create_checkout_session` gains `invoice_creation={'enabled': True}`, `billing_address_collection='required'`, and the business name set on the Stripe account rather than per-session.
2. The receipt email gains an **invoice block** (§20.9): invoice number, date, seller legal name, buyer name and address, itemised lines with unit price, the GST line, and the total. Rendered in the Jinja2 templates that already exist — *the one place hex is allowed* (`week3_plan.md` §20.7), and the only place it stays allowed.
3. `SELLER_LEGAL_NAME` becomes a config value in `backend/.env.example` and `app/core/config.py`. **No `SELLER_ABN`** — see the amendment above.
4. `TAX_STATEMENT_TEXT` (already in `lib/labels.ts` and its Python twin) is joined by `SELLER_ENTITY_TEXT` in the same paired-file pattern, so the entity reads identically on `/store`, `/legal/terms` and the receipt.

**Acceptance:**
- [ ] A real test-mode purchase produces a Stripe invoice object, and the emailed receipt carries the same invoice number as that object — verified by fetching it back from the Stripe API, not read from the email.
- [ ] No receipt, invoice block, config field or legal page mentions an ABN anywhere. Verified 2026-08-20 by full-repo grep: the only remaining occurrences are the code comments explaining that the field was deliberately removed.
- [ ] The GST line states GST as *included*, matching `TAX_STATEMENT_TEXT`'s existing wording — one fact, one source.

---

### W4-R3 — The overlap publish guard `[MUST]` `[NEW]`

**Source:** `new_additions.md` §11, §34 item 4

**Statement:** Publishing a product whose granted content intersects an already-published product's fails closed, naming the conflict — unless the new product is explicitly a bundle and is sold at a visible discount.

`new_additions.md` §11's diagnosis is precise and worth repeating because it is about *this* schema: *"`product_contents` is polymorphic, so spinning up a new product over existing content rows takes seconds and no new content at all. A convenience becomes a trap."* And the closing argument: *"This rule would have caught the A$29-template-grants-the-whole-course bug before a customer did."* That bug is real, it is in this repository's history (`db/seed/012_split_template_and_course_products.sql`), and nothing currently prevents its recurrence.

**What ships:**

1. `app/core/publish_guard.py` `[NEW]` — `check_content_overlap(product_id, session)` returns the intersecting `(product, content_type, content_id)` rows, or empty.
2. Wired into the product publish path (W4-R5's editor) *before* the state change, alongside the existing template-file and lesson-content guards.
3. A `is_bundle` boolean on `products` (migration `013`) — the explicit escape hatch. A bundle is *permitted* to overlap; it is **required** to price below the sum of its parts, and the guard checks that too, in the same call.
4. A standalone SQL audit in `scripts/check_overlaps.sql` `[NEW]`, so the rule can be run against production without deploying anything.

**Acceptance:**
- [ ] A test constructs two products sharing one `product_contents` row, attempts to publish the second, and asserts a 409 whose message names the other product and the shared content. **Seen red first** — the test is confirmed failing with the guard removed, per non-negotiable #9.
- [ ] A test constructs a bundle (`is_bundle = true`) over two published products, publishes it successfully, and asserts the guard *did* run and *did* find overlap — i.e. the escape hatch is a deliberate branch, not an unreached code path.
- [ ] A test asserts a bundle priced **at or above** the sum of its parts is refused. The existing A$79 bundle over A$98 of parts passes it; a hypothetical A$98 bundle does not.
- [ ] `scripts/check_overlaps.sql` run against the live database returns exactly the rows expected for the existing bundle and **nothing else**. If it returns something else, that is a real finding and it is fixed, not suppressed.

---

### W4-R4 — Question → product routing `[MUST]` `[NEW]`

**Source:** `new_additions.md` §8, §19, §22, §34 item 5 · `handover.md` §4 item 9

**Statement:** A question page names what would help with it, and a filtered catalogue names what would help with the situation the filters describe — and both say *why*, in terms of the reader's own constraints.

**Why this and not product tags.** `new_additions.md` §21 is the correction that makes this buildable: the seven tag dimensions describe **the risk work the question implies**, not the product. `cost: low` means *fixing this issue is cheap*, not *this product is cheap*. Reading them as product attributes produces actively wrong recommendations. So the routing goes *through* the questions:

```text
the reader's situation (their active filters, or the question they are on)
        ↓
  questions matching it                        ← built, indexed, live
        ↓
  products whose product_contents include those questions   ← built, live
        ↓
  "Here's what would help with these, and here's why"       ← the gap
```

**What ships:**

1. `GET /questions/{slug}/related-products` `[NEW]` — products granting this question, or granting any of its `question_relations` neighbours, ranked (direct grant first, then neighbour count, then price ascending). Fixed query count regardless of catalogue size, per the bulk-primitive pattern `entitlements.py` already establishes.
2. `GET /products/for-questions?ids=…` `[NEW]` — the catalogue-side twin, taking the current result set.
3. **`RoutedProducts`** (§20.5) on the question detail page, below the guidance body, above related questions.
4. **`SituationProducts`** (§20.6) on `/questions`, rendered **only when at least one filter is active** — an unfiltered catalogue has no situation to route from, and offering one anyway is the "fabricated relevance score" the existing match-explanation code was written to avoid.
5. **The explanation is real or it is absent.** *"We're suggesting this because it addresses questions 14, 31 and 62 — which match your constraints"* — with the question titles as live links. If the join produces nothing, the component renders nothing. It never falls back to "popular products."
6. `recommendation_clicked` analytics event (`new_additions.md` §34.1) — source question → product, so §22's own claim is measurable rather than asserted.

**Acceptance:**
- [ ] On a question granted by a published product, the panel names that product and links it. On a question granted by nothing and neighbouring nothing granted, the panel is **absent** — not an empty card, not "no recommendations yet."
- [ ] Every recommendation states at least one real question it routes through, by title, as a link.
- [ ] The endpoint issues a fixed number of queries regardless of how many products or questions exist — asserted by a query-count test, the same discipline the four N+1 fixes of 2026-08-14 established.
- [ ] Migration `013`'s `ix_product_contents_type_content` is `EXPLAIN`-proven against this exact query, before and after, and the evidence lands in `db_index_evidence.md` alongside migration `010`'s.
- [ ] Both themes, seven widths, `stress-fixtures` extremes.

---

### W4-R5 — Admin closes its remaining holes `[MUST]`

**Source:** `handover.md` §4 items 2 and 16 `[CARRIED]` · `week3_report.md` §6 · `DESIGN.md` §31

**Statement:** The owner can set a price, publish a product, read what came in through the contact form, and page through orders — without a developer and without SQL.

**What ships:**

1. **`/admin/products`** `[NEW]` — the gap `handover.md` §4 item 16 names as *"the one piece of 'no admin UI' with a direct revenue impact."* Create/edit: name, `search_title`, description, `price_amount`, `stripe_price_id`, `licence`, `version`, `last_reviewed_at`, `is_bundle`, `publish_state`. Reuses `useAutosave`, `useFieldValidation`, `PublishStateChip` and `UploadField` — nothing new is invented for it (§20.0's reuse rule).
2. **`/admin/contact`** `[NEW]` — the `contact_messages` inbox. Read-only list, `notified` state visible, newest first, `enquiry_type` filter. `handover.md` §2 currently instructs the reader to run SQL; this replaces that instruction.
3. **Keyset pagination on `/admin/orders`** — migration `010` built `ix_orders_created` explicitly as prerequisite infrastructure for this and recorded that it showed no plan change *against today's unpaginated query*. The query is what changes. See §26.3.
4. **The watched non-developer usability test** `[CARRIED]` — 30 minutes, a real non-developer, watched, unaided, adding a lesson and setting a price. Deferred from Week 3 by the owner's own words. It is in this week's Definition of Done.

**Acceptance:**
- [ ] A product's price can be changed and republished entirely through `/admin/products`, with the change visible on `/store` on the next load. Proven by doing it, not by reading the code.
- [ ] Changing `price_amount` **without** changing `stripe_price_id` surfaces an inline warning naming the mismatch — the price shown and the price charged are two different systems, and the admin says so rather than letting them drift silently. This is the same class of trap as `--primary` on a `--stage` plane: two sources of one fact.
- [ ] `/admin/orders` returns a bounded page and a cursor. The query is `EXPLAIN`-proven to use `ix_orders_created` and to **not** re-scan (§26.3).
- [ ] The contact inbox shows every row in `contact_messages`, including `notified = false` ones, which are the set that matters after any email outage.
- [ ] `[HUMAN]` The usability test runs, and **every place the tester stopped is written down** — whether or not it was fixed. `DESIGN.md` §63 item 4 asks for exactly that, and a test with no recorded friction is a test that was not really watched.

---

### W4-R6 — The hardening sweep `[MUST — the week's non-negotiable]`

**Source:** The brief, verbatim · `DESIGN.md` §40, §60 Week 4, §62

**Statement:** Every failure mode named in `DESIGN.md` §40 and §60 has a designed, tested answer, and a deliberate attempt to break the gate found nothing that gives.

**The four states, on every surface** (§40): empty, loading, error, locked. The sweep is a route-by-route table (§21.3), not a vibe — `App.tsx` currently declares **30 paths** (verified by count, including the `/pricing` → `/store` redirect and the `/admin` → `/admin/questions` alias), and this week adds three more.

**The failure modes, each with a designed answer:**

| Failure | Designed answer | State today |
|---|---|---|
| Payment declined | Stripe's own page handles the decline; `/checkout/cancel` handles the return | `[BUILT]`, verify copy |
| Webhook late (entitlement delay) | `CheckoutSuccess` polls `/me/entitlements` until every product in the set is entitled | `[BUILT]`, verify the *timeout* branch |
| Webhook never arrives | A bounded poll that ends in a real message with a real next step, not an infinite spinner | **`[GAP]` — verify and fix** |
| Session expired mid-flow | 401 → re-auth → return to where they were, cart intact | **Verify.** `useCartStore` persists to `localStorage`, so the cart should survive; the *return path* is what to check |
| Download URL expired | A re-request, not an error page. The presigned URL is short-lived by design | **Verify** |
| Playback token expired mid-video | Silent re-mint, or a designed re-auth. A video that dies at minute 12 of a lesson is the worst failure on this list | **Verify** |
| Video will not load (Mux down, asset errored) | `media.status` already models `error`; the player must render it | **Verify** |
| Broken link | No route 404s into a blank page; a real 404 with a route back into the catalogue | **Verify** |
| Filters return nothing | §40.1's exact pattern: name the tightest constraint, offer to relax *that one* | `[BUILT]` on `/questions`, verify elsewhere |

**Break your own gating** — a deliberate adversarial pass, results written down whether or not anything gives:
signed-out direct hits on every gated endpoint · another user's JWT · a tampered JWT · an expired JWT · a *revoked* entitlement's resource · a raw Storage URL · a raw Mux playback ID with no token · a garbage token · an `in_review` and an `archived` resource · a cart containing a product the buyer already owns · a replayed webhook · a webhook with a bad signature.

**Also in this requirement, because they are one-line fixes that have been carried twice:**
- `CheckoutSuccess.tsx` and `Template.tsx` get a real `PageTitle` (`h1`), and **both routes are added to `accessibility.spec.ts`'s `PUBLIC_ROUTES`** — the fix and the thing that would have caught it, together. `[CARRIED]`
- `.github/workflows/ci.yml` drops `RESEND_API_KEY` and gains the five `MAILJET_*` / sender variables. `[DEFECT]`

**Acceptance:**
- [ ] The route × state matrix (§21.3) is complete, with a cell either ticked or carrying a named reason it does not apply.
- [ ] Every failure row above is **exercised**, not reasoned about. Where a failure cannot be triggered naturally, it is forced (revoke the entitlement, expire the token, point Mux at a bad id) — the same discipline that re-delivered a real signed webhook rather than faking one in Week 3.
- [ ] The gating attack list runs in full and its results are recorded in `gating_seen_red.md`'s successor section — **including the ones that found nothing.** A list of twelve attacks with twelve passes is evidence; a sentence saying "gating holds" is not.
- [ ] CI is green against the transport the application actually uses.

---

### W4-R7 — Accessibility, the full audit `[MUST]`

**Source:** `DESIGN.md` §42.9 (*"In Week 4 also do, by hand"*) · §62 · `week3_plan.md` §4.2 (deferred here explicitly)

**Statement:** The six manual checks `DESIGN.md` §42.9 names are performed, by hand, and what they find is fixed or written down.

| Check | What "done" looks like |
|---|---|
| Complete a purchase using only the keyboard | Landing → catalogue → product → evidence panel → cart → checkout redirect → success → download. No mouse. Every step reachable, every focus visible |
| Complete a lesson using only the keyboard | Including the Mux player's own controls and the "mark complete" action |
| Screen reader on the discovery page | NVDA or VoiceOver; the result count **is announced** on filter change (the `aria-live` region exists — confirm it actually fires) |
| Zoom to 200% | Nothing clipped, no horizontal scroll on the page body. The seven-width suite does not catch this — zoom reflows differently from a narrow viewport |
| `prefers-reduced-motion` forced | Nothing becomes unusable. `theme.css`'s global backstop collapses transitions to 0.01ms rather than removing them, deliberately — verify the *state change* is still visible |
| Dark mode, every state | Especially focus and error. `--ring` is `#1B4E8C` light / `#8FC1EA` dark; `--destructive` `#B3402E` / `#E11D48` |

**Plus, in code:**
- `accessibility.spec.ts`'s `PUBLIC_ROUTES` grows to cover every public route in `App.tsx`, including the two that were missing (W4-R6).
- The new components (§20) each carry their own axe assertion.
- WCAG 2.2 §2.5.8 target size (24×24 CSS px, 44×44 touch) is checked on the new filter-adjacent controls and the preview gallery's thumbnails — `DESIGN.md` §42.6 names chips and close buttons as where this fails in practice.

**Acceptance:**
- [ ] All six manual checks performed and their findings recorded — **including "no findings," which is a result.**
- [ ] axe clean on every public route, in both themes.
- [ ] Any finding that is not fixed is in the ledger with a reason, not dropped.

---

### W4-R8 — Performance budgets, enforced `[MUST]`

**Source:** `DESIGN.md` §43 — *"'Avoid large bundles' is not a budget. These are, and they fail CI."*

**Statement:** The three budgets `DESIGN.md` §43 states are measured on every push and block a red build.

| Metric | Budget | How |
|---|---|---|
| LCP | < 2.0s | Lighthouse CI against the built preview, mobile profile |
| CLS | < 0.05 | Same run |
| Initial JS | < 180KB | `vite build` output, gzipped, entry chunk — asserted in CI, not eyeballed in the build log |

**Acceptance:**
- [ ] A CI job fails when a budget is exceeded. Proven by **temporarily** breaking one (import something heavy, confirm red, revert) — the "seen red first" rule applied to a CI gate rather than a test.
- [ ] The current numbers are recorded in the ledger. If the app is already over a budget today, that is the finding, and it is fixed or the budget is renegotiated **in writing** — never silently raised to match reality.
- [ ] Font loading is confirmed not to cause the FOUT-driven layout jump `DESIGN.md` §9 warns about, at throttled network speed. Three variable faces (Schibsted Grotesk, Newsreader, Azeret Mono) is the largest single lever on LCP here.

---

### W4-R9 — The tests that guard money `[MUST]`

**Source:** `handover.md` §4 item 5 `[CARRIED]` · §1 (the dead-chips incident)

**Statement:** The three untested things that have already cost, or nearly cost, real money each gain a test.

1. **Checkout and webhook, by fixture.** `handover.md`: *"the highest-consequence remaining gap, since that's the code a silent regression would actually cost money on."* Cases: single-product session · N-item cart session · a session for a product already fully owned (409 before Stripe) · webhook creates order + N order_items + N entitlements in one transaction · webhook replay is idempotent · webhook with a bad signature is rejected · `charge.refunded` revokes · a webhook for an unknown product fails loudly rather than granting nothing silently.
2. **Taxonomy parity.** Every taxonomy value hard-coded anywhere in `frontend/src` exists in `tag_values`. `handover.md` §1: *"A single assertion that every hardcoded taxonomy value in the frontend exists in `tag_values` would have caught it on the day it was written, and is worth more than any other test in this codebase apart from the payment path."* Every quick-filter chip matched **zero** questions for three days because nobody had this.
3. **The first real frontend unit tests.** `vitest` is configured and has one test file. Start with the pure functions that carry real logic and no DOM: `lib/scoring.ts` (has tests), `lib/utils/formatCurrency.ts`, `lib/tags.ts`, `stores/useCartStore.ts`.

**Acceptance:**
- [ ] Each new backend test is **seen red before green** — non-negotiable #9, applied to the payment path specifically.
- [ ] The taxonomy parity test fails if a chip's value is changed to something not in `tag_values`. Proven by changing one.
- [ ] `npm test` runs in CI as a blocking job (it is already declared in `package.json`; confirm the workflow actually invokes it).
- [ ] Backend suite total is stated as a number in the ledger, not as "all green."

---

### W4-R10 — Metrics from the database `[SHOULD]` `[NEW]`

**Source:** `new_additions.md` §35 · `week3_report.md` §4 (the two unanswerable reads)

**Statement:** The five metrics that matter are computed from Postgres and shown on one admin page — so the questions W3-R10 could not answer become answerable the day traffic arrives, without waiting on a PostHog query key.

| # | Metric | Source |
|---|---|---|
| 1 | **Second-purchase rate** — *"the single most informative number"* | `orders` grouped by `user_id` |
| 2 | **Free → paid conversion** | `leads` ∪ `users` vs `orders` |
| 3 | **Tag-filter usage** — is the differentiator being used | PostHog `filter_applied`, **or** a lightweight server-side counter. See acceptance |
| 4 | **Refund rate by product** | `orders.status = 'refunded'` joined to `order_items` |
| 5 | **Time from signup to first purchase** | `users.created_at` → `min(orders.created_at)` |

Four of five are pure SQL against tables that already exist. Metric 3 is the honest exception: nothing server-side currently records a filter application, because `filter_applied` is a client event. Either accept the PostHog dependency for that one row and label it as such, or add a fire-and-forget server counter. **Pick one and say which** — a metrics page with one silently-empty tile is worse than a metrics page with four tiles and a stated gap.

> **`[AMENDED 2026-08-17 — owner instruction]` Metric 3 is decided, and the form decision below is partly reversed.**
>
> The owner's instruction was *"instead of using PostHog, design the analytics page ourselves"* and *"[use a premade UI kit] for charts."* Two consequences, both recorded here rather than by rewriting the paragraphs above — a later fact wins by addition:
>
> 1. **Metric 3 resolves to the server-side counter.** The page depends on nothing external. Every one of the five metrics is answerable from Postgres alone, and `/admin/metrics` renders correctly with no PostHog project key, no `phx_` query key, and no network egress. This is the stronger of the two options W4-R10 offered and the owner picked it.
> 2. **One chart is admitted; four tiles are not.** The form argument below is still correct for metrics 1, 2, 4 and 5 — they are single numbers and a plot around them adds ink without information. It was never correct for a *series*, and the owner is right that the page wants one. **Revenue and orders over time** is the series this page has always implied and never had. See §20.7a for the amended spec and Phase 6B for the build.
>
> **What the amendment does not license.** It is one chart, not a charting page. A second plot needs a second argument, made in writing, against the same test §20.7 applies: *is this a series or a part-to-whole comparison, or is it a number wearing a costume?*

#### W4-R10 second amendment `[2026-08-17, owner instruction]` — the sales metrics

The owner asked for **enrollment counts, total revenue, popular courses and template downloads**. Checked against the schema on 2026-08-17 rather than assumed. Three are answerable from tables that exist; one is not, and the difference is the important part of this section.

| # | Metric | Source | Status |
|---|---|---|---|
| 6 | **Total revenue** — gross, refunded and **net**, as three figures | `orders.total_amount_cents` by `status` | `[READY]` pure SQL |
| 7 | **Enrollment counts** — per course, and total | `entitlements` → `product_contents` (`content_type='course'`, `revoked_at IS NULL`) | `[READY]` pure SQL |
| 8 | **Popular courses** — ranked | Enrollments · started · completed. **Not views** | `[READY]`, with a stated limit — see below |
| 9 | **Template downloads** — per template, and total | **Nothing records one.** Needs `download_events` | `[GAP]` new table + 3 call sites |
| 10 | **Top-selling products** — units and revenue | `order_items` → `products`, refunds excluded | `[READY]` pure SQL |

**Four things this table is deliberately careful about:**

1. **Revenue is three numbers, never one.** Gross, refunded, net. A single "total revenue" figure that silently includes refunded orders overstates the business, and one that silently excludes them hides that refunds are happening at all. W3-R5 made refunds real; the metric has to have noticed. The tile shows net as the value and gross/refunded as its denominator line — the same "state your denominator" rule §20.7 already applies.

2. **"Enrollment" is not a concept this schema has**, and inventing a word for an existing row is how two sources of one fact get created. What exists is an **entitlement granting a product that contains a course**, live when `revoked_at IS NULL`. The metric counts exactly that and the page says so in as many words. It also splits by `granted_via` — `purchase` vs `manual` vs `free` — because 40 enrollments reads very differently when 38 of them were free grants.

3. **"Popular" is measured by enrollment, starting and completion — not by views**, and the page states which. `content_viewed` is a client-side PostHog event; **no view count exists in Postgres**, and this amendment's whole premise is that the page depends on nothing external. Ranking by "popular" while quietly meaning "purchased" is precisely the fabricated-relevance failure §20.6 was written to avoid. If view-ranked popularity is wanted later it needs its own counter, the same shape as `filter_events`, and that is a deliberate future decision rather than a silent gap here.

4. **Template downloads genuinely do not exist yet.** A presigned URL is minted at three call sites — `content/templates.py:187`, `content/templates.py:217`, `content/lessons.py:458` — and none of them records that it happened. Only *failures* are captured, and only to PostHog (`capture_download_failed`). So downloads need `download_events`, and **a mint is not a download**: the URL may never be fetched. The metric is named *"download links issued"* on the page, because that is what the number is. Calling it "downloads" would be a claim the database cannot back — non-negotiable #13, applied to our own admin page rather than to a product page.

**Acceptance for the second amendment:**
- [ ] Revenue shows gross, refunded and net — never one undifferentiated total
- [ ] Enrollment splits `purchase` / `manual` / `free`, and the page uses the word "entitlement" where that is what it means
- [ ] "Popular courses" names its own measure in the UI; no tile or column implies view counts exist
- [ ] The downloads metric is labelled "links issued", with one sentence saying why that is not the same as downloads
- [ ] Every new query `EXPLAIN`ed, same rule as the first five

**Design:** stat tiles, no charting library, no new dependency. Five metrics is a case where the right form is *not a chart* — a tile carries a single number better than any plot, and adding a charting library to a hardening week is exactly the kind of scope drift this document exists to refuse. Full spec at §20.7. *(Amended above: five tiles **plus one time-series chart**. The "no new dependency" clause is the part that gives — see decision #33.)*

**Acceptance:**
- [ ] Every tile states its own denominator. "Second-purchase rate: 50%" over 2 buyers is a true number and a useless one; "1 of 2 buyers" is honest at this scale and stays honest at 2,000.
- [ ] With zero data, every tile renders an empty state naming what would populate it — never `0%`, never `NaN`, never a dash with no explanation. This is `handover.md` §1's own generalised rule: *"any count derived from a fetch should distinguish 'zero' from 'don't know yet.'"*
- [ ] Each query is `EXPLAIN`ed. A metrics page that table-scans `orders` on every admin page load is a self-inflicted version of the problem Part IV exists to prevent.
- [ ] `[AMENDED]` The page renders every tile and the chart correctly with `POSTHOG_API_KEY` unset and `VITE_POSTHOG_KEY` unset. Proven by test, not by reasoning — this is the whole point of the amendment.
- [ ] `[AMENDED]` The chart renders a **fewer-than-two-points** state rather than a line. One order is not a trend, and a two-pixel line implying one is the same class of dishonesty as `0%` over two buyers.

---

### W4-R11 — Database optimisation, second pass `[MUST]`

**Source:** `week3_plan.md` Part IV's method · `db_index_evidence.md` · non-negotiable #14 (*no index without a plan, no plan without a measurement*)

**Statement:** Every query shape introduced this week is indexed, proven, and documented — and the two structural gaps migration `010` deliberately left are closed.

Full detail in **Part IV**. In summary: migration `013`'s index layer (§26.1), keyset pagination on `/admin/orders` (§26.3), the FK coverage `010` did not reach (§26.2), and one partial index for the new routing join.

**Acceptance:**
- [ ] Every index in `013` has an `EXPLAIN (ANALYZE, BUFFERS)` before/after in `db_index_evidence.md`, against a synthetic dataset built and rolled back in one transaction — the exact method `010` used and proved leaves the real database untouched.
- [ ] **Any index that measures as not helping is not created.** Migration `010` dropped `ix_qlt_question` for exactly this reason and said so; that precedent holds.
- [ ] Every `CREATE INDEX CONCURRENTLY` is verified against `pg_index.indisvalid` after the fact, in the migration, per §27.2's trap.
- [ ] The migration is applied to dev and independently re-verified, and the full backend suite passes with everything from this week together.

---

### W4-R12 — The handover pack, closed `[MUST]`

**Source:** The brief (*"Write the handover pack"*) · `DESIGN.md` §63

**Statement:** `handover.md` is current as of the last commit of Week 4, `week4_report.md` exists with a go/no-go, and the environment the code expects matches the environment that is deployed.

**What ships:**

1. **`handover.md` updated** — a Week 4 section in the same register as its Weeks 1–3 sections (why, not just what), and every closed item in §4 struck through with the date rather than deleted. Its own rule: nothing quietly disappears.
2. **`week4_report.md`** — the standalone report and go/no-go, matching `week1_go_no_go.md` / `week2_report.md` / `week3_report.md` in shape.
3. **`DESIGN.md` reconciled with `theme.css`** — §13.1 below lists exactly where it is stale. `DESIGN.md` is precedence #2 and it currently states a type scale the product does not use; that is the same "two sources of one fact" defect this project has now found four times.
4. **Environment sync** — `.env.example`, the CI workflow, and a written checklist of what must be set on Render. `handover.md` §4 item 15 has carried this since 2026-08-13.
5. **`docs/new_additions.md` gets a status footer** — which of its proposals shipped, which are gated and on what. Not a rewrite: an addition, per the project's own "a later fact wins by addition, not silent rewrite" convention.
6. **A commit hygiene pass.** `handover.md` §4's last item names the real hazard: *"the last commit, `ae03593` 'edited', is a single mixed commit containing several sessions' unrelated work — so it cannot be read as a unit or reverted selectively."* Week 3's entire output is still uncommitted in the working tree (verified: 60+ staged and unstaged paths). Week 4 lands in **topic-scoped commits**, not one more `edited`.

**Acceptance:**
- [ ] Every open item in `week3_report.md` §6 appears in `week4_report.md` as closed, carried with a reason, or explicitly re-scoped. **None disappears.**
- [ ] A `grep` claim written into any document is verified at the moment it is written. `handover.md` §4 records this exact failure happening once already.
- [ ] The go/no-go is written against the repository, not against this plan's intentions.

---

### W4-R13 — Admin panel video playback and rich text lesson editor `[MUST]` `[NEW]` `[OWNER INSTRUCTION 2026-08-19]`

**Source:** Owner instruction 2026-08-19

**Statement:** Admins can actually play and preview videos in the lesson editor, and can write lesson content with a rich text editor supporting h1, h2, h3, bullets, and tables. New courses created through the admin panel are automatically purchasable via product association.

**What ships:**

1. **Video playback in admin lesson editor** — Add actual video player component in AdminCourses.tsx lesson editor that uses the mux_playback_id to render a playable preview of attached videos, not just the playback ID string.
2. **Rich text editor for lesson body** — Replace plain textarea with a rich text editor (e.g., Tiptap or similar lightweight solution) supporting:
   - Headings: h1, h2, h3
   - Bullet lists
   - Numbered lists
   - Tables
   - Bold, italic, underline
   - Links
3. **Auto-product association for new courses** — When a new course is created via admin panel, automatically create or associate a product so the course is immediately purchasable. This can be:
   - Option A: Auto-create a product with default pricing when course is published
   - Option B: Require product selection before course can be published
   - Option C: Add explicit "Create Product" button in course editor with sensible defaults

**Acceptance:**
- [ ] Video playback renders in admin lesson editor when mux_playback_id is present
- [ ] Rich text editor toolbar provides h1, h2, h3, bullets, numbered lists, tables
- [ ] Rich text content is stored and rendered correctly on the public lesson page
- [ ] New courses created via admin panel have an associated product and are purchasable
- [ ] Product association is visible in the course editor UI

---

### W4-R14 — The admin panel manages the whole system `[SHOULD]` `[CARRIED]`

**Source:** Owner instruction, 2026-08-17 — *"admin panel should also allow to manage everything it does, with users and system settings."*

**Statement:** Every operational thing the owner needs to do is doable from `/admin`, without SQL, without a Render shell, and without a developer — **except the things that must not be**, which are named rather than quietly omitted.

**Where the admin stands after W4-R5.** Questions · courses · templates · products · orders · media · contact inbox. What is missing, and what this requirement adds:

| Surface | State | This requirement |
|---|---|---|
| **Users** | **`[GAP]`** — no `/admin/users` exists. `users.role` is editable only by SQL | Full list, search, detail, role change, entitlement view |
| **Leads** | **`[GAP]`** — `leads` rows are written and never read back | Read-only list + CSV export |
| **Audit log** | **`[GAP]`** — `audit_log` is written by four call sites and has **no reader at all** | Read-only, filterable |
| **System settings** | **`[GAP]`**, and mostly stays one — see the split below | A narrow, non-secret settings table |

#### The settings split — the load-bearing decision

**Secrets never become editable from a web form.** `config.py` is env-backed `BaseSettings`, and Stripe, Mailjet, Supabase and Mux keys **stay there**. This is not conservatism: an admin panel that can rewrite `STRIPE_SECRET_KEY` turns one compromised admin session into full control of the payment account, and a settings table that holds live keys puts them in every database backup in plaintext. Non-negotiable #1 says never handle card data; this is the same instinct one layer out.

So settings split in three, and the page says which is which rather than presenting a uniform wall of fields:

| Class | Examples | Where it lives | Editable in admin |
|---|---|---|---|
| **Secrets** | Stripe, Mailjet, Supabase, Mux keys | Env / Render | **No.** The page *displays* which are set and which are missing — never a value, not even masked |
| **Deployment** | `FRONTEND_URL`, `ALLOWED_ORIGINS`, database URL | Env / Render | **No.** Changing these at runtime breaks the running app in ways a form cannot safely offer |
| **Operational** | `SELLER_LEGAL_NAME`, `OWNER_NOTIFICATION_EMAIL`, refund-window wording (#17), free-entry-point copy | **New `settings` table** | **Yes**, audited |

The **"is it set?"** panel is the quiet win here: `handover.md` has carried an environment-checklist item since 2026-08-13, and a page showing `MAILJET_API_KEY ✓ set · SELLER_LEGAL_NAME ✗ unset` answers *"is this deployment configured correctly"* in one glance, without ever rendering a secret. That is the item the checklist was standing in for. (No `SELLER_ABN` row — decision #31, resolved 2026-08-20: there is no ABN field to report on.)

#### User management, and its three guardrails

A role change is **privilege escalation**, and it is the only write in this project that can create another actor. It gets treated accordingly:

1. **Every role change writes an `audit_log` row** with actor, target, old role, new role, and a **required reason** — the same contract `grant_entitlement_manually` already uses. This is why the audit-log *reader* is in the same requirement: writing a trail nobody can read is theatre.
2. **An admin cannot change their own role.** Not a permission subtlety — it removes the single most common way to lock yourself out, and self-demotion has no legitimate use the owner has.
3. **The last admin cannot be demoted.** Checked server-side, in the same transaction, `SELECT count(*) … WHERE role = 'admin'` — an application-level guard here, because unlike uniqueness (#12) this is not expressible as a constraint.

**Deleting a user is not offered.** A user with orders carries financial records that Australian record-keeping expects to survive, and `orders.user_id` is a non-nullable FK — a hard delete either fails or cascades away purchase history. If an account must go, that is a **deactivation** (a `disabled_at` column, gate checks it) plus a data-deletion request handled through the route the privacy policy already names. Offering a Delete button that silently means one of those two things is worse than offering neither.

**Acceptance:**
- [ ] `/admin/users` lists, searches and pages users; a detail view shows their entitlements and orders
- [ ] A role change requires a reason, writes an audit row, and is refused for self-demotion and for the last admin — **all three proven by test, seen red first**
- [ ] `/admin/audit` reads `audit_log` newest-first, filterable by actor and action
- [ ] `/admin/settings` edits only operational values; **no secret is rendered, masked or otherwise**, and a test asserts the response body contains no key material
- [ ] The "configuration status" panel shows set/unset for every required env var, sourced from `config.py`, not a hand-maintained list that will drift
- [ ] No Delete User button exists; deactivation is what ships, or nothing does

---

### W4-R15 — Price control from the admin panel `[MUST]` `[NEW]` `[OWNER INSTRUCTION 2026-08-20]`

**Source:** Owner instruction 2026-08-20 — *"implement the ability to adjust the pricing of each course and template."*

**Statement:** The owner can change what a course or a template costs from `/admin`, without opening the Stripe dashboard — and the price the product page shows is provably the price Stripe charges.

**The fact this requirement is built around.** `create_checkout_session` passes `price_ids` straight through as `line_items[].price` (`app/integrations/stripe_client.py:30`). **The Stripe Price object is what charges the card. `products.price_amount` is display only.** Those are two systems holding one fact, `admin/products.py`'s own module docstring says so, and the mismatch warning that docstring promises is never assigned — `warning` is initialised to `None` in `publish_product` and returned unchanged. The copy deck (§23) already carries the string for a warning the code cannot currently produce.

Three consequences, none of them optional:

1. **A Stripe Price's amount is immutable.** Changing a price means creating a *new* Price and swapping the id — there is no "edit". Any design that treats `price_amount` as the editable field ships the mismatch rather than fixing it.
2. **`products` has no `stripe_product_id`.** A new Price has to be created under the same Stripe Product as the old one, or the catalogue fragments into one Stripe Product per price change. The column does not exist yet; migration `016` adds it.
3. **A free-text `stripe_price_id` field in an admin form is the mismatch's source.** It becomes read-only. The price endpoint writes it, a human does not.

**What ships:**

1. **Migration `016_product_stripe_product_id`** — nullable `products.stripe_product_id`, backfilled by a script that resolves each existing `stripe_price_id` through the Stripe API. **Not guessed in SQL**; ids that fail to resolve are reported, not defaulted.
2. **`stripe_client.create_price()` / `retrieve_price()` / `archive_price()`** — the three calls a price change needs, in the one module that already owns the Stripe seam.
3. **`POST /admin/products/{id}/price`** — `{price_amount, currency, reason}`. Reason required, audited with both Price ids and both amounts.
4. **`check_stripe_price()` in `publish_guard.py`** — publish is refused when the Stripe price does not resolve, is inactive, belongs to the other Stripe mode, or disagrees with the row's amount or currency. This is the guard that turns the promised warning into something real, and it is also what makes `placeholder_update_in_stripe` (W4-R17) unpublishable rather than merely unwise.
5. **A price control in the course and template editors**, writing to the same endpoint. The owner asked to change the price of a *course* and a *template*; being told to go and find its product first is the admin panel failing to answer the question asked.

**Acceptance:**
- [ ] A price change from `/admin` creates exactly one new Stripe Price under the existing Stripe Product, swaps the row's id, and archives the old one
- [ ] After the change, `price_amount` equals the Stripe price's `unit_amount` — **proven by fetching it back from Stripe**, not by reading the row we just wrote
- [ ] A reason is required; the audit row carries old amount, new amount, both Price ids and the reason
- [ ] Publish is refused for a price that does not resolve, is inactive, is cross-mode, or disagrees with the row — four separate refusals, four separate messages
- [ ] No editable `stripe_price_id` field exists anywhere in the admin UI
- [ ] Price is edited from the course editor and from the template editor, through one endpoint and one code path — not two

---

### W4-R16 — Why buy this from us, and what a buyer may do with it `[MUST]` `[NEW]` `[OWNER INSTRUCTION 2026-08-20]`

**Source:** Owner instruction 2026-08-20 — *"why a user should buy from us? A template can be made by anyone"* and *"downloaded templates can be shared with anyone."*

**Statement:** Every paid product page answers *"why buy this rather than make it myself"* with claims a column can back — and every paid download carries the buyer's name and the licence inside the file, so passing it on is a choice someone makes knowingly rather than a leak nobody notices.

**These are one requirement, not two.** Both instructions are the same observation from opposite ends: the artefact is copyable, so **the file is not the thing being sold**. What is being sold is the decision model behind it, the fact that it is versioned and reviewed, and the licence that says what may be done with it. A page that cannot say that has no answer to "I'll make my own", and a file that does not carry it has no answer to "I'll just forward it".

**The six claims, and what backs each.** Nothing else may be written on these surfaces:

| Claim | Backed by |
|---|---|
| Derived from a documented decision model, not invented | `Deciding_in_the_Dark_Research_Specification.md`, and the question taxonomy the artefact is tagged against |
| Written for a specific decision you are actually in | W4-R4's routing — the product is reached *from* the question |
| Versioned and reviewed, not a file dumped once | `products.version`, `products.last_reviewed_at`, `templates.version` |
| You know exactly what you are getting before paying | The evidence layer — `page_count`, `sheet_count`, `is_editable`, `min_office_version`, ≥2 preview images |
| It will open on a corporate machine | `has_macros`, and the macro publish guard that enforces it |
| The licence says what you may do, in words | `products.licence`, `LicenceLine`, and the stamp inside the file |

**No social proof of any kind ships in this requirement.** No "trusted by *n* teams", no ratings, no testimonials, no download counts. Non-negotiable #13 — *every claim on a product page is backed by a column* — applies with no exception, and none of those numbers exists. This is stated as a rule because copywriting is precisely where the rule is most tempting to break.

**On redistribution, the true thing first.** An editable `.docx` or `.xlsx` cannot be stopped from being forwarded. Any DRM that tried would destroy `is_editable`, which is one of the things being sold, and would break the corporate-machine claim above. So what ships is **deterrence, traceability and a route to pay for wider use** — never prevention, and the copy never implies otherwise:

1. **Per-buyer stamping** — a paid download serves a copy stamped with the buyer's name and email, the order id, the licence tier and the version.
2. **The licence travels inside the file**, so a forwarded copy carries its own terms.
3. **Unstampable file types are served unchanged**, and the admin says which types those are. A silent no-op would be a claim the code does not keep.
4. **Aggregate counting only.** `download_events` stays user-less — Phase 6B's privacy constraint holds unchanged. The buyer's identity goes into the buyer's own copy of their own file, never into a new table. Per-user download traceability is decision **#35**, and it costs a privacy-policy edit.
5. **Wider use is a tier, not a scolding.** Someone who needs to hand the file to clients is decision #25's client-delivery tier; the licence line links there.

**Acceptance:**
- [ ] Every paid product surface answers "why not make my own" in words, and **every claim traces to a column or a guard** — checked line by line against the table above
- [ ] Zero social-proof claims anywhere in the shipped copy, verified by reading the copy deck additions rather than by intent
- [ ] One primary CTA per page, with the sample-pages and free-entry CTAs subordinate to it
- [ ] A paid download of a stampable type contains the buyer's email and the licence tier, **asserted against the file's extracted contents**
- [ ] An unstampable type downloads unchanged and is labelled as such in admin
- [ ] A stamping failure serves the original file — **never a 500, never nothing**. A broken stamp must not cost someone the file they paid for
- [ ] `download_events` still has no `user_id`, and the privacy policy still needs no edit

---

### W4-R17 — A course created in the admin panel is purchasable `[MUST]` `[NEW]` `[OWNER INSTRUCTION 2026-08-20]`

**Source:** Owner instruction 2026-08-20 — *"I added a new course from the admin panel. New courses aren't purchasable."*

**Statement:** A course created through `/admin` can be bought — created, priced, published and paid for without a Stripe dashboard visit, an SQL statement or a developer.

**The root cause, read rather than guessed.** `create_course_product` (`app/api/v1/admin/courses.py:306`) writes:

```python
stripe_price_id="placeholder_update_in_stripe",  # Must be updated
```

and `create_checkout_session` passes that string to Stripe as a Price id. So the course is not unpurchasable because a step was skipped — **it is unpurchasable because the id it ships with is not a Stripe object**, and nothing in the system refuses to publish it, warns about it, or tells the owner what is missing. The failure surfaces at the buyer's checkout, which is the last possible place anyone would want to find it.

Three more contributors, all real:

- **Templates have no product path at all.** `admin/templates.py` never touches `Product`, so a paid template created in admin has the same problem one step earlier.
- **Nothing states readiness.** Product exists · price set · Stripe price resolves · published — four conditions, and the admin UI shows none of them.
- **W4-R13's option A/B/C was never resolved**, so "make the course purchasable" had no defined path even for someone who knew all of the above.

**Resolution of W4-R13's open option:** **Option C** — an explicit "Make this purchasable" action with sensible defaults, plus a readiness line. Not option A: auto-creating a priced product the moment a course is published means the first course published at the wrong price is a real charge to a real card. A price is an owner decision, and the panel asks for it once rather than guessing.

**Acceptance:**
- [ ] `grep -r placeholder_update_in_stripe` returns nothing
- [ ] "Make purchasable" creates a real Stripe Price and stores the returned id; a Stripe failure creates **no product row at all**
- [ ] The same action exists for templates
- [ ] Every course and template in admin shows one readiness line naming exactly what is missing, server-derived
- [ ] **The end-to-end test passes**: create a course in admin → make it purchasable → set a price → publish → buy it in Stripe test mode → the webhook grants the entitlement → the lesson opens. This single test is the answer to the instruction; the rest is how it is made to pass

---

### W4-R19 — The content types *are* the products `[MUST]` `[NEW]` `[OWNER INSTRUCTION 2026-08-20]`

**Source:** Owner instruction 2026-08-20 — *"Products are itself not 'Products' in admin panel. Products are the actual products we have like Questions, Templates, Courses, Reference Packs, Domain Packs. Remove Products in the admin panel."*

**Statement:** The owner sets a price, makes something purchasable and publishes it **from the editor for the thing itself** — a course from the course editor, a template from the template editor, a pack from the pack editor. There is no separate "Products" destination to visit first.

**The reading, and the safety line that goes with it.** The instruction is about the *admin surface*, and it is right: `Product` is an implementation detail of how money attaches to content, and making the owner navigate to an abstraction before they can price a course is the panel failing the question asked. But the `products` **table is load-bearing** — `entitlements`, `orders`, `order_items`, `product_contents` and every Stripe call resolve through it, and `resolve_product_ids()` is the single choke point non-negotiable #1 protects. **The table stays. The API module stays.** What goes is the page and the nav item.

| Layer | Fate |
|---|---|
| `products` / `product_contents` tables | **Unchanged.** Removing them breaks gating and purchases outright |
| `app/api/v1/admin/products.py` | **Stays**, as the shared seam W4-R15 requires — one endpoint, one code path |
| `POST /admin/products/{id}/price` | **Stays.** The content editors call it; it is not reimplemented three times |
| Overlap · bundle-pricing · Stripe-price guards | **Unchanged**, called from the new surfaces |
| `/admin/products` route + `AdminProducts.tsx` + nav entry | **Removed** |

**Questions carry no commerce controls.** Every question is free to read and always will be (`HONESTY_NOTICE`, §30A.5). A price field on a question editor would be a control that must never be used, which is worse than no control.

**Acceptance:**
- [ ] No `/admin/products` route and no nav entry; a direct URL resolves to a real page with a way back into admin, never a blank 404 (`DESIGN.md` §40)
- [ ] Price and publish are reachable from the course, template and pack editors, through **one** endpoint
- [ ] The `products` table, `product_contents` and `resolve_product_ids()` are untouched — asserted by the full gating suite still passing unchanged
- [ ] The questions editor has no price, no Stripe field and no publish-to-sell control, and a test says so

---

### W4-R20 — A refund the buyer can see and start `[MUST]` `[NEW]` `[OWNER INSTRUCTION 2026-08-20]`

**Source:** Owner instruction 2026-08-20 — *"show that a user has refunded. Add a button for the user to refund. 15% of the original price is kept if the course hasn't been opened. If the course has more than 15% progress it can't be refunded."* · Research Specification §11.3 (ACL) · `DESIGN.md` §29.4

**Statement:** A buyer can see that an order was refunded, and can start a change-of-mind refund themselves when their progress in the course is 15% or less — without emailing anyone, and without the interface ever implying their statutory rights are gone.

**The policy, exactly as instructed:**

| Course progress | Self-serve | Amount |
|---|---|---|
| 0% — never opened | Yes | 85% refunded, 15% kept |
| >0% and ≤15% | Yes | 85% refunded, 15% kept |
| **>15%** | **No** | — |
| Template-only order | No `[OWNER #37]` — support path | — |
| Already refunded | No | — |

"More than 15%" is strictly greater — exactly 15% still refunds. Progress reads `course_progress.percentage_complete`, which **exists** (`db/models/progress.py`). Where one product grants several courses, the **highest** progress governs: the buyer has had the most value from that one, and picking the lowest would let a nearly-finished second course refund on the strength of an unopened first.

**The ACL constraint, which is not negotiable and not a matter of tone.** This is a **change-of-mind** policy sitting *on top of* the Australian Consumer Law, never in place of it. A major failure — content materially not as described, a file that does not work — is a **full** refund, and no percentage rule applies to it. Research Spec §11.3 records the ACCC v Valve outcome for exactly this: a business that words its policy as though the statutory guarantees do not exist is in breach regardless of what the policy says. So:

- **Admin/support refunds stay unrestricted and full.** That is the ACL path and it must not inherit the 15% rule.
- No shipped string may read "no refunds", "all sales final", or "non-refundable".
- The >15% refusal copy **names the remaining right in the same breath**, not in a footnote.

**Acceptance:**
- [ ] Eligibility is computed **server-side**; no client-held flag is authority
- [ ] 0% and 15% progress both refund 85%; 16% is refused, with copy naming the consumer-guarantee path
- [ ] A double request and a replayed `charge.refunded` each refund exactly once
- [ ] A refunded course disappears from Continue, the library and the dashboard — through the existing `revoked_at` gate, not a second check
- [ ] Admin manual refund still works, still full, still unrestricted
- [ ] No shipped string contains "no refunds" or "all sales final", asserted by a grep test

---

### W4-R21 — The user account a buyer can actually manage `[MUST]` `[NEW]` `[OWNER INSTRUCTION 2026-08-20]`

**Source:** Owner instruction 2026-08-20 — *"Write me a prompt for a Phase 10 for user profile including to change name, password, confirm password, refund request, all purchases, and other necessary changes. Check what Coursera, Udemy, edX for necessary user account settings."* · `DESIGN.md` §30.3, §45 · Research Specification §7.2, §7.5–7.6

**Statement:** A signed-in buyer has one destination, `/account`, where they can change their name, change their email, change their password, read every purchase they have made, start a refund on the ones that qualify, choose which email arrives, export their own data, and close their account — with every sensitive action re-authenticated, audited, rate-limited, and none of it able to hard-delete a financial record.

**Why this is a requirement and not a nicety.** `DESIGN.md` §30.3 already specified profile, email, password, purchase history and a data route; §47.3 lists `/account` among the member routes. **Neither exists.** `/account` has no route in `App.tsx` and no page file, and `me.py` has no PATCH verb of any kind. A platform that takes money and grants durable access, but offers no way to change a password, is missing the settings floor that Coursera, Udemy and edX have all held for years — and the data-rights half is a Privacy Act obligation (Research §7.6), not a feature.

**The five settings every comparable platform offers**, and the shape of this requirement:

| | What it means here | Section |
|---|---|---|
| **Identity** | Name and email, both changeable; email confirmed via Supabase's new-address round trip | 10A |
| **Security** | Password change requiring the current password **plus** a confirm field | 10B |
| **Commerce** | Every purchase, with receipts and honest refund states | 10C |
| **Refunds** | The buyer's refund path, placed where a buyer looks for it | 10D |
| **Preferences** | Which optional email arrives — and which never stops | 10E |
| **Data rights** | Export my data; close my account | 10F |

**The constraints that make this hard, stated so nobody discovers them mid-build:**

- **The backend cannot verify a current password.** Supabase's admin API sets a password without knowing the old one. Verification is therefore client-side — `signInWithPassword`, then `updateUser` — and the audit row must be written by a **separate backend hook**, or a password change never reaches the audit trail at all.
- **An email change is asynchronous and the UI must say so.** `updateUser({ email })` sends a confirmation link to the *new* address; the sign-in email does not change until it is clicked. Copy that implies otherwise generates support load.
- **Closure is deactivation, never deletion.** `orders.user_id` is a non-nullable FK and financial records must survive seven years (Research §7.5). A hard delete either fails or destroys purchase history. `users.disabled_at` **already exists** (migration `015`) and is **already filtered inside `resolve_product_ids`** ([entitlements.py:53](backend/app/core/entitlements.py#L53)) — so closure must call that path, never build a second one.
- **Transactional email is not marketing.** Receipts, access grants, password resets and security alerts are the contract of a purchase. No preference toggle may suppress them, and the preferences page must say so plainly.
- **The refund path already exists and must not fork.** W4-R20 shipped the endpoints and the UI. This requirement *places* them; a second eligibility rule anywhere is the money-path fork non-negotiable #1 forbids.

**Acceptance:**
- [x] `/account` exists and reaches all six areas; both themes, seven widths, axe-clean — **DONE** `2026-08-21`. `AccountShell.tsx` with routed sub-pages, five sections, `NavLink` active states.
- [x] Name and email are editable, validated, audited; the email change is password-gated and its confirmation delay is explained **before** submit — **DONE** `2026-08-21`. `AccountProfile.tsx` + `PATCH /me/profile` + `POST /me/account/email-changed`.
- [x] Password change takes current + new + confirm, enforces the minimum both sides, keeps the session, writes an audit row and sends a security alert — **DONE** `2026-08-21`. `AccountSecurity.tsx` + `POST /me/account/password-change` + `send_security_alert_email`.
- [x] Every purchase renders with a receipt and an honest status; exactly **one** purchases component and **one** refund code path exist in the tree — **DONE** `2026-08-21`. `AccountPurchases.tsx` wraps `Purchases.tsx`; both routes mount the same component.
- [x] Notification preferences persist, and a test proves a receipt still sends with every optional flag off — **DONE** `2026-08-21`. `AccountNotifications.tsx` + `PATCH /me/account/notifications`.
- [x] Data export returns a real file containing the requester's records and no one else's — **DONE** `2026-08-21`. `POST /me/account/export` returns JSON with profile/orders/entitlements/progress, downloaded as `.json`.
- [x] Account closure is a password-confirmed deactivation reusing the gate-wired path; **no hard-delete exists anywhere**, asserted by a test — **DONE** `2026-08-21`. `POST /me/account/close` sets `disabled_at` (existing gate path).
- [x] Every sensitive endpoint is rate-limited through **one** extracted helper, not five copies — **DONE** `2026-08-21`. `app/core/rate_limit.py` with `RateLimiter` class, used by all five endpoints.
- [x] `pytest backend/tests/test_entitlements.py` passes unchanged — the gate was extended, never rewritten — **DONE**. No changes to `entitlements.py`.

---

### W4-R18 — One Products menu, not four scattered catalogues `[MUST]` `[NEW]` `[OWNER INSTRUCTION 2026-08-20]`

**Source:** Owner instruction 2026-08-20 — *"instead of Store, restructure the main navigation so that questions, courses, templates and reference packs are grouped under one Products section in the navbar as a drop-down menu opening product pages, instead of keeping them separated under different store sections. Similar goes to the sidebar in the dashboard."*

**Statement:** Everything a visitor can read or buy is reached from **one** menu in the header and **one** group in the member rail — four destinations, named, with `/store` demoted from a sibling to the overview inside it.

**The state being replaced, read from the files:**

| Surface | Today | Problem |
|---|---|---|
| Marketing header (`MarketingLayout.tsx:19`) | `Questions` · `Store` · `About` | Two of the four content types are reachable only *through* Store, and Questions sits beside the index that also contains it |
| Member rail (`MemberLayout.tsx:38-47`) | Browse: `Questions` · `Store` · `Courses` · `Templates` | **`Store` sits beside the three catalogues it indexes.** The comment above it records the 2026-08-13 decision to add it *"alongside (not instead of)"* them — this instruction reverses that decision |
| Reference packs | **No catalogue exists.** Reachable only at `/store/packs/:slug`, from `Home.tsx:1045` and `Store.tsx:202` | A "Reference packs" menu item has nowhere to point until one is built |

**Three constraints this requirement is built around, each verified rather than assumed:**

1. **`/store` is not deleted.** `/pricing` redirects to it (`App.tsx:88`), `CartDrawer.tsx:143` and `Home.tsx:1039` link to it, both e2e suites list it — and it is **the only place the bundle's real arithmetic lives** (`BundleCard`, §20.2's *"the saving is a real dollar amount, never hard-coded"*), alongside `TAX_STATEMENT_TEXT` and `REFUND_POSITION_TEXT`. It becomes **"All products"**, the overview item inside the menu. Demoted, not removed.
2. **A fourth item needs a fourth destination.** Packs get `/packs`, a real catalogue, for the same reason the other three have one. A menu item that scrolls to a section of a different page is the kind of half-link that makes navigation feel broken.
3. **Questions is the free entry point**, and this change puts it one click deeper. Named as a cost, not hidden: it is accepted because the header's existing free CTA (`/#free-pack`) keeps a one-click free path for signed-out visitors, Questions is listed **first** in the menu and labelled free, and §8C's metrics can show afterwards whether questions traffic actually moved. If it drops, that is a finding to act on rather than a surprise.

**Acceptance:**
- [ ] Header nav is `Products` (menu) · `About`, and every one of the four destinations is reachable from it
- [ ] Member rail's `Browse` group becomes `Products` with the same four destinations plus All products; **no dropdown in the rail** — it is already grouped by heading
- [ ] `/packs` exists as a real catalogue page, in both e2e suites
- [ ] `/store` still resolves, still holds the bundle arithmetic, and is reachable as "All products"
- [ ] The menu is operable by keyboard alone: opens on Enter/Space, closes on Escape with focus returned to the trigger, and every item is a real link that cmd-click and middle-click still open in a new tab
- [ ] On mobile there is **no dropdown** — the sheet menu shows the group expanded under a heading
- [ ] axe clean with the menu **open**, not only closed — the state a closed-menu-only audit never checks

---

## 6. Non-negotiables

Carried from Weeks 1–3, plus three this week adds. These are not aspirations; a breach is a bug.

1. **The gate changes in one place.** `resolve_product_ids()` is the only place entitlement is decided. No second check anywhere.
2. **No component holds a hex.** Every colour resolves through a token. The Jinja2 email templates are the single sanctioned exception, and W4-R2's invoice block does not widen it.
3. **No inverting token on the dark plane.** Before adding anything to a `bg-stage` surface, grep it for `primary` and `accent`. This has shipped as a bug **nine** times (`handover.md` §1's eight, plus `CartButton`'s badge in Week 3).
4. **No hard-coded currency symbol on a formatted amount.** `formatCurrency` exists.
5. **No hover distance drifted past 2px.** `.hover-lift` exists so it cannot.
6. **Nothing loops.** No ambient motion, no reveal-on-scroll for body content.
7. **Real content, always.** Stress extremes live in `page.route()` fixtures, never in the database.
8. **A chip is offered only if it is counted.** Every suggested term, filter or route is checked against live data before being shown.
9. **Seen red first.** A test is not trusted green until it has been observed failing without the thing it tests.
10. **Confirm via the provider API, never infer from log silence.** Established twice by the Resend arc.
11. **No index without a plan, no plan without a measurement.**
12. **Uniqueness is a database constraint, not careful coding.**
13. `[NEW]` **A claim on a product page is backed by a column.** Page count, format, editability, version, licence — each renders from data or does not render. No product page states something the database cannot prove. This is the mechanical version of `new_additions.md` §2's whole argument.
14. `[NEW]` **Two published products may not grant overlapping content unless one is a declared bundle priced below the sum of its parts.** Enforced by W4-R3, checkable in SQL.
15. `[NEW]` **Zero and unknown are different, everywhere.** A count that has not loaded renders an em dash; a count that is genuinely zero renders `0` with its empty state. Already true on the homepage's domain counts; now a rule.
16. `[NEW 2026-08-20]` **A change-of-mind rule never displaces a statutory one.** Every refund surface — copy, policy page, email, refusal message — states its terms *on top of* the Australian Consumer Law, never in place of it. No shipped string may read "no refunds", "all sales final" or "non-refundable"; a refusal names the remaining consumer-guarantee path in the same breath. The admin/support refund stays **full and unrestricted** — it is the ACL path and must not inherit the 15% rule. Research Spec §11.3 (ACCC v Valve) is why this is a bug and not a tone preference. Enforced by W4-R20 and a grep assertion (§30).

## 7. Definition of Done — Week 4

Week 4 is done when all of the following are true. Items marked `[HUMAN]` cannot be closed by an engineering session and are named so they are scheduled, not silently dropped.

**Product and commerce**
- [ ] Every published paid product carries page/file facts, format guarantees, version, last-reviewed date, licence, and ≥2 real preview images — proven by SQL, not spot-checked (W4-R1)
- [ ] A test-mode purchase produces a real Stripe invoice and an itemised receipt carrying the same invoice number (W4-R2)
- [ ] The overlap guard refuses a conflicting publish and permits a declared bundle, both proven by test (W4-R3)
- [ ] A question page and a filtered catalogue both route to products, with real explanations (W4-R4)

**Admin**
- [ ] A price is set and republished entirely through `/admin/products` (W4-R5)
- [ ] The contact inbox reads `contact_messages`, `notified = false` rows included (W4-R5)
- [ ] `/admin/orders` pages with a keyset cursor, `EXPLAIN`-proven (W4-R5, §26.3)
- [ ] `[HUMAN]` The watched non-developer usability test has happened, and every place the tester stopped is written down (W4-R5)

**Hardening**
- [ ] The route × state matrix is complete (W4-R6, §21.3)
- [ ] Every named failure mode is exercised, not reasoned about (W4-R6)
- [ ] The twelve-item gating attack list runs in full, results recorded including the passes (W4-R6)
- [ ] `CheckoutSuccess.tsx` and `Template.tsx` have real `h1`s **and** are in the axe route list (W4-R6)

**Quality gates**
- [ ] All six manual accessibility checks performed, findings recorded (W4-R7)
- [ ] axe clean on every public route, both themes (W4-R7)
- [ ] LCP, CLS and initial-JS budgets measured in CI and blocking; proven by breaking one (W4-R8)
- [ ] Checkout and webhook fixture tests exist and were seen red first (W4-R9)
- [ ] The taxonomy parity test exists and fails when a value is wrong (W4-R9)
- [ ] `npm test` blocks CI (W4-R9)
- [ ] CI runs against Mailjet, not Resend (W4-R6)

**Database**
- [ ] Migration `013` applied, every index `EXPLAIN`-proven, every `CONCURRENTLY` build verified valid (W4-R11)
- [ ] No index created that measured as not helping (W4-R11)

**Handover**
- [ ] `handover.md` current; `week4_report.md` written with a go/no-go (W4-R12)
- [ ] `DESIGN.md` reconciled with `theme.css` (W4-R12, §13.1)
- [ ] Environment checklist written; CI and `.env.example` agree with the code (W4-R12)
- [ ] Week 3's and Week 4's work committed in topic-scoped commits (W4-R12)
- [ ] `[HUMAN]` One of the nine email templates opened in a real mail client `[CARRIED]`
- [ ] `[HUMAN]` `[UNVERIFIABLE]` Supabase Auth Site URL / Redirect URLs confirmed by an owner dashboard login `[CARRIED]`

## 8. Open decisions `[OWNER]`

### 8.1 Blocking a specific line, not a requirement

| # | Decision | Blocks | Degrades to |
|---|---|---|---|
| ~~**31**~~ `[RESOLVED 2026-08-20]` | ~~The ABN digits~~ — **owner instruction: no ABN, anywhere.** The entity is not GST-registered. `seller_abn` removed from `config.py`, both receipt templates, `email_service.py` and `legal/Terms.tsx`'s owner note — not left unset, removed | — | — |
| **32** `[NEW]` | **The file facts for each published artefact** — page/sheet counts, minimum Office version. Owner or a five-minute file open | The evidence panel's completeness (W4-R1) | Any unset fact simply does not render |
| ~~**33**~~ `[RESOLVED 2026-08-17]` | ~~The chart library~~ — **the shadcn/ui chart block, Recharts underneath.** Owner instruction: *"search for existing UI libraries and build using them."* Reasoning and costs at §20.7a; the deciding fact is that `--chart-1…5` are shadcn's own convention and are already in `theme.css`, unused | — | — |
| ~~**34**~~ `[RESOLVED 2026-08-21]` | ~~Whether PostHog is removed entirely~~ — **owner instruction: removed entirely.** Overrides this doc's own earlier recommendation (below) to keep the events and only drop the dependency | — | — |

**#33 resolved, and the criteria it was judged against** — kept because the next component decision should be judged the same way, not because the answer is still open. Any library had to: resolve colour through `--chart-1`/`--chart-2` rather than its own palette (non-negotiable #2, no component holds a hex) · render both a tooltip and a focusable point (§22 — hover-only fails the keyboard check) · respect `prefers-reduced-motion` · add less to the entry chunk than W4-R8's budget allows, **measured after the fact, not promised**. The shadcn chart block meets all four, and `--chart-1…5` turned out to be its own convention already sitting unused in `theme.css`. Tremor was the runner-up and is recorded with its rejection reason at §20.7a rather than forgotten.

**#34's original recommendation, kept for the record rather than deleted** — this doc had argued for keeping the events and only dropping the dependency ("the nine events cost nothing while unused, the privacy policy already names PostHog... unpicking it is a legal-page edit plus ten call sites to buy back a dependency that Phase 6B has already made non-load-bearing"). The owner's explicit instruction on 2026-08-21 was full removal regardless of that cost, and it shipped: `posthog`/`posthog-js` uninstalled, `posthog_client.py` and `lib/analytics.ts` deleted, all ~9 backend and ~12 frontend call sites removed (along with the two client props — `questionSlugs`, the `email_gate_shown`/`checkout_started` triggers — that existed only to feed them), `POSTHOG_API_KEY`/`POSTHOG_HOST`/`VITE_POSTHOG_KEY`/`VITE_POSTHOG_HOST` removed from `config.py`/`.env.example`/`.env.local.example`, and `Privacy.tsx`'s sub-processor list and Analytics section rewritten to state plainly that no third-party analytics is used. Full backend + frontend suites re-run clean after the removal.

### 8.2 Worth a short answer this week

| # | Decision | Why now |
|---|---|---|
| **25** | **Client-delivery licence** — permitted at all, and at what multiple? | `new_additions.md` §20 calls it *"the best unbuilt revenue."* The field ships regardless; the answer turns it from a label into a price |
| **26** | **The update promise** — `pricing.md` commits to lifetime updates including future revisions. Confirm deliberately with a maintenance budget, or narrow it before more products inherit it | W4-R1's `version`/`last_reviewed_at` make it *cheap to keep*, which is the right moment to decide whether to keep it |
| **30** | **Editorial capacity** — author-days per month, realistically | Gates Question of the Week, the Decision Pack, the diagnostic, and the AI feature. `new_additions.md`: *"Every plan in this document is a guess without it"* |
| **35** `[NEW 2026-08-20]` | **Per-user download traceability** — should a table record *who* downloaded *what*, or is the stamp inside the buyer's own file enough? | Phase 8 ships the stamp and **no table**, because a table is new PII the privacy policy does not name. Answering yes costs a policy edit and W2-R8's ordering rule — policy first, instrumentation second — applies unchanged |
| **36** `[NEW 2026-08-20]` | **Does an opened-but-≤15% course refund the same 85% as an unopened one?** The instruction says 15% is kept *"if the course hasn't been opened"* and separately that *">15% progress can't be refunded"*, which leaves 0<p≤15 unstated | Phase 9B builds **yes** — one rule, one threshold. The alternative is a third band nobody asked for, and a buyer at 3% cannot explain why they are treated as a completer. Answering no costs one branch in `refund-eligibility` and one copy line |
| **37** `[NEW 2026-08-20]` | **Self-serve refunds for template-only orders.** The 15% rule is measured in course progress, and a downloaded file has no progress to measure | Phase 9B builds **not eligible** — support handles it, and the copy says so without implying the right is gone (non-negotiable #16). Answering yes needs a different test than progress: "has the file been downloaded", which `download_events` can already answer |
| **38** `[NEW 2026-08-20]` | **A refund time window** (e.g. 30 days), which is decision **#17** finally being asked | Phase 9B builds **no window in v1**. A window is one clause and one condition to add later; adding one now with no sales data behind the number is guessing |
| **39** `[NEW 2026-08-20]` | **Are ad-hoc bundles managed as packs?** `risk-register-bundle` exists and today has no editor at all | Phase 9A step 5 builds **yes** — one pack editor with `is_bundle`, guard-enforced below the sum of its parts. A second bundle mechanism is the two-sources-of-one-fact defect this project has found five times |

### 8.3 Closed, deliberately, and bundled

Restated from `week3_report.md` §7 because the bundling is the part that gets forgotten:

1. Stripe stays in test mode (#21).
2. Hosting stays on Vercel Hobby / Render current tier.
3. The refund window stays undecided (#17); the mechanism ships against ACL-safe wording.

> **These three are one decision, not three.** The moment Stripe's key becomes `sk_live_`/`rk_live_`, Vercel Hobby's commercial-use restriction is being violated again and Render's tier becomes a live-checkout risk — **on the same day**. Do not flip one without reopening the other two in the same conversation.

### 8.4 Deferred by owner instruction, not open

- The watched usability test — scheduled, not cancelled. In this week's DoD.
- Domain purchase — Mailjet delivers without it; still worth doing for sender reputation.

## 9. Success measures

| Measure | Target | Read from |
|---|---|---|
| Published paid products with complete evidence | 100% | The W4-R1 SQL query |
| Failure modes with a designed, exercised answer | 9 of 9 | §21.3's matrix |
| Gating attacks that found something | 0 — **or every finding fixed** | The recorded attack list |
| Manual accessibility checks performed | 6 of 6 | W4-R7 |
| Backend tests | > 62, with checkout/webhook covered | `pytest` |
| Frontend unit test files | > 1 | `vitest` |
| CI jobs that block | backend · frontend unit · Playwright+axe · typecheck/build · **performance** | `ci.yml` |
| Open items carried into "next" without a written reason | 0 | `week4_report.md` |

## 10. Cut order if the week runs long

Protect hardening and handover; they are what the brief asked for. Cut in this order:

0. **`TrendChart` alone** `[NEW 2026-08-17]` — the five tiles ship, the chart does not. Cut this before cutting the page: it is the only item here that is blocked on an unanswered decision (#33), and with fewer than two data points it would render its "not enough history" sentence anyway. Cutting it costs the week nothing today
1. **W4-R10** metrics page — the numbers are all still in the database; the page is a convenience. *Amended: Phase 6B is most of a day, not a quarter of one. If it has not started by the end of Day 4, it slips to Week 5 rather than compressing Phase 5 — see Phase 6B's header*
2. **W4-R4's** `SituationProducts` on `/questions` — keep `RoutedProducts` on the question page, which is where the argument is strongest
3. **W4-R5's** contact inbox — the SQL in `handover.md` §2 still works
4. **W4-R9's** frontend unit tests — keep the taxonomy parity test, which is the one with a real incident behind it
5. **W4-R1's** `search_title` — the slot without the copy is nearly free anyway
6. **W4-R8's** LCP/CLS jobs — keep the JS bundle assertion, which is the cheapest of the three

**Never cut:** the gating attack pass · the four states matrix · the checkout/webhook tests · the overlap guard · the handover pack · the two carried `h1` fixes · the CI transport fix.

---

# PART II — DESIGN SPECIFICATION

*Every value here is quoted from `frontend/src/styles/theme.css` as it stands on 2026-08-17. Where `DESIGN.md` states a different number, §13.1 records it and `theme.css` wins (§0.3 rule 5).*

## 11. Principles in force this week

Week 4 **applies** the design system; it does not extend it. Three consequences:

1. **No new colour family.** The palette is ivory + navy + champagne, with status colours exempt and charts exempt. One narrowly-scoped repair to the dormant chart tokens (§12.6) is the only token change this week.
2. **No new type rung.** Ten rungs exist. If a new surface seems to need an eleventh, it needs a different rung, not a new one.
3. **Reuse before you build.** Every new component in §20 names the existing primitives it composes. `Card`, `Badge`, `Button`, `EmptyState`, `PageTitle`, `SectionHeading`, `StatusDot`, `UploadField`, `PublishStateChip`, `AutosaveIndicator`, `FieldError` all exist and all have contracts.

## 12. Colour

### 12.1 The system, restated

Two colour families, not three:

```text
ivory            the ground              --background
midnight navy    PRIMARY   — brand, action, links, focus, the five domains
champagne gold   SECONDARY — warmth, rules, washes, quiet emphasis
```

Shades within those families are open. **A third hue family is not.** Status colours (red = error, green = success, amber = warning) are the one exception, because they are conventions worth keeping. Charts are the second exception, stated in `theme.css` itself.

### 12.2 Light theme — the complete token set

| Token | Value | Role |
|---|---|---|
| `--background` | `#FBF9F4` | Warm ivory. The paper this brand is printed on |
| `--foreground` | `#1C1712` | Espresso ink, not near-black |
| `--card` | `#FFFFFF` | |
| `--card-foreground` | `#1C1712` | |
| `--popover` / `--popover-foreground` | `#FFFFFF` / `#1C1712` | |
| `--primary` | `#10213E` | Midnight navy |
| `--primary-foreground` | `#F7F2E9` | Warm cream, never pure white |
| `--stage` | `#10213E` | **The dark plane. Does not invert.** Hero, footer, auth panel, member rail |
| `--stage-foreground` | `#F7F2E9` | 14.39:1 on stage |
| `--stage-deep` | `#050B18` | Aurora: the near-black it opens on |
| `--stage-glow-1` | `#10305F` | Aurora: widest, quietest bloom |
| `--stage-glow-2` | `#1F6FC4` | Aurora: the body of the ramp |
| `--stage-glow-3` | `#8ED2FB` | Aurora: corner core only. **1.48:1 — never under text** |
| `--secondary` | `#F0E7D2` | Champagne surface |
| `--secondary-foreground` | `#4A3D22` | |
| `--secondary-strong` | `#E5D7B6` | |
| `--accent` | `#1D5FA8` | The one interactive accent. 6.13:1 on ivory |
| `--accent-foreground` | `#FFFFFF` | |
| `--gold` | `#C6A961` | **Decorative only. 2.16:1 — never text** |
| `--gold-strong` | `#7C5C14` | The text-safe gold. Clears 4.5:1 on ivory, card, `--secondary` and `--gold-soft` |
| `--gold-soft` | `#F3E9D2` | Champagne wash for tinted surfaces |
| `--muted` / `--muted-foreground` | `#F1ECE1` / `#6E675A` | |
| `--border` / `--input` | `#E6DFD0` | Warm hairline |
| `--border-strong` | `#998E78` | 3.2:1 on card — state-bearing borders |
| `--ring` | `#1B4E8C` | Focus. ~5.7:1 on ivory |
| `--destructive` / `-foreground` | `#B3402E` / `#FFFFFF` | |
| `--success` / `-foreground` | `#067647` / `#FFFFFF` | |
| `--warning` / `-foreground` | `#8A5300` / `#FFFFFF` | |
| `--primary-edge` | `color-mix(in srgb, var(--primary-foreground) 16%, transparent)` | |
| `--domain-risk` | `#142E5C` | Deep navy-blue |
| `--domain-cyber` | `#1B5FA8` | Azure |
| `--domain-compliance` | `#1D6FA5` | Steel blue, leaning cyan |
| `--domain-resilience` | `#3D5A99` | Indigo-blue |
| `--domain-ai` | `#46618C` | Slate blue-grey |
| `--sidebar` | `#E0E8F3` | |
| `--sidebar-foreground` | `#1A2E4A` | 11.09:1; at 70% (nav labels) 4.75:1 |
| `--sidebar-primary` / `-foreground` | `#10213E` / `#F7F2E9` | |
| `--sidebar-accent` / `-foreground` | `#CBD9EC` / `#10213E` | |
| `--sidebar-border` / `--sidebar-ring` | `#BDCEE5` / `#1B4E8C` | |
| `--shadow-tint` | `52 42 26` | Warm espresso, not black |

### 12.3 Dark theme — the complete token set

Mirrors the light theme's *shape* rather than inverting its values. Same token names, same rules, inverted values.

| Token | Value | Note |
|---|---|---|
| `--background` | `#141008` | Warm espresso near-black, not blue-black |
| `--foreground` | `#F2EBDE` | |
| `--card` / `--popover` | `#1B1710` / `#1E1911` | Elevation reads from a lighter surface here, not a darker shadow |
| `--primary` / `-foreground` | `#6FA8DC` / `#0B1A2E` | **Inverts. Never on `--stage`** |
| `--stage` / `-foreground` | `#080D18` / `#EAF1FA` | 17.08:1. Separation from `--background` is carried by hue plus a hairline, not luminance (they sit at 1.02:1) |
| `--stage-deep` · `-glow-1` · `-glow-2` · `-glow-3` | `#02060E` · `#0A2147` · `#14538F` · `#4794D8` | Two steps lower than light — a sky-bright core on a night page reads as a light leak |
| `--secondary` / `-foreground` | `#2A2318` / `#EDE2CB` | |
| `--secondary-strong` | `#2E271B` | |
| `--accent` / `-foreground` | `#b6deff` / `#0B1A2E` | **Inverts** |
| `--gold` | `#C9AC6A` | Decorative only, as in light |
| `--gold-strong` | `#E3CB92` | Text-safe on espresso, 12.0:1 |
| `--gold-soft` | `#2E2517` | |
| `--muted` / `-foreground` | `#201B12` / `#A79D89` | |
| `--border` / `--input` | `#332B1E` | |
| `--border-strong` | `#7C6F56` | |
| `--ring` | `#8FC1EA` | |
| `--destructive` / `--success` / `--warning` | `#E11D48` / `#2CC08A` / `#E9A13B` | |
| `--domain-*` | `#5B7FBD` · `#6FB0E8` · `#5FB8D9` · `#8090D8` · `#93A7C9` | Same five leans, one step brighter |
| `--sidebar` | `#0C1524` | 8.53:1; at 70% 4.79:1 |
| `--shadow-tint` | `0 0 0` | Near-black, so what little shadow remains stays neutral |

### 12.4 The gold rule — the one way to misuse this palette

```text
--gold          decorative ONLY — rules, gradient stops, tile fills, icon marks on a dark plane
--gold-strong   the text-safe shade — labels, prices, small type, icons beside text
--gold-soft     a surface wash — tinting a card or a tile background
```

`--gold` is **2.16:1 in light**. It fails text contrast *by design* — it is a light metal. Putting it on a text node is the single way to break this palette, and it has happened. Every price in the product uses `--gold-strong` at `text-h3` or larger, and `theme.css` carries a comment on that line specifically so a future size reduction is caught.

**This week's application:** `EvidencePanel`'s section rules use `--gold`; its labels use `--gold-strong`; its surface uses `--gold-soft`. `VersionStamp` uses `--gold-strong` (it is small mono text — decorative gold would fail it outright).

### 12.5 Contrast floors, measured not eyeballed

| Context | Floor |
|---|---|
| Body text, and anything a decision depends on | 4.5:1 |
| Text ≥ 18.66px bold or ≥ 24px | 3:1 |
| UI component boundaries, focus rings, graphical objects | 3:1 |
| Decorative fills carrying no information | none — but they may never sit under text |

**And the rule that has bitten this project once already** (`DESIGN.md` §7.5.3, `handover.md` §1): **a gradient's contrast is only real where the text actually lands.** The token-level maths said the auth panel was safe; sampling the rendered pixels under the actual paragraph said 4.36:1. Any new surface this week that sits on `.stage-aurora`, `.hero-wash` or `.page-wash` is measured **from a screenshot**, not from the swatches.

Flat fills on flat surfaces — which is everything in §20 except the metrics tiles' optional wash — can be computed at token level. Say which method was used.

### 12.6 The chart tokens `[DEFECT]`, and the narrow repair

`theme.css` marks `--chart-1` … `--chart-5` *"Dormant: nothing renders a chart yet."* That is still true, and W4-R10 deliberately keeps it true by using stat tiles rather than plots. But the tokens are latent bugs and this is the design-hardening week:

| Token | Light | Dark | Problem |
|---|---|---|---|
| `--chart-1` | `#10213E` navy | `#C7AC6D` gold | **Different hue family per theme.** The same token meaning two different things — the exact defect `handover.md` §1 documents for `--primary` and `StatusDot`, nine occurrences deep |
| `--chart-2` | `#1D6FA5` steel | `#A17D2E` dark gold | Same |
| `--chart-3` | `#B3402E` | `#E55252` | Consistent (red both) |
| `--chart-4` | `#5C6B4F` | `#5C6B4F` | **Byte-identical across themes** — a strong signal the set was never audited as a set. Computed at token level: 5.37:1 on ivory, **3.36:1** on espresso. Above the 3:1 graphical-object floor, but only just, and by accident rather than by choice |
| `--chart-5` | `#7A8699` | `#B7AC96` | Grey both, but the dark value leans warm and the light value leans cool |

**What Week 4 does:** re-derive all five in both themes from the existing families so that chart-*n* means the same *thing* in both, validate the set as a categorical palette (lightness band, chroma floor, CVD separation between adjacent pairs, contrast against each surface), and record the result. **What Week 4 does not do:** render a chart. This is a token repair on a dormant surface, sized in minutes, done now because the first person to build a chart will otherwise inherit a five-token version of the bug this project has already shipped nine times.

If the repair cannot be validated cleanly inside its time box, the honest alternative is to **delete the five tokens** rather than leave a broken set standing — an absent token forces a deliberate decision at the moment a chart is first built; a broken one gets used.

> **`[AMENDED 2026-08-17]` The delete option is closed, and where these tokens came from is now known.** W4-R10's amendment admits one chart (§20.7a), so *"nothing renders a chart yet"* stops being true this week and the moment this paragraph anticipated — *"the moment a chart is first built"* — has arrived.
>
> **The origin explains the defect.** `--chart-1` … `--chart-5` are **shadcn/ui's own convention**, installed with the Week 1 scaffold (`week1_plan.md`: shadcn, New York, CSS variables) and never rendered against. That is why they read as unaudited: nobody chose these five values for this palette — they arrived as defaults and were then half-edited toward the brand. `--chart-4` being byte-identical across themes is not a mystery, it is a default nobody got to.
>
> **Consequences.** Deleting them is now the *wrong* repair: shadcn's `ChartConfig` resolves `var(--chart-N)` directly, so deleting the tokens would break the chart block's contract and push the same decision into `TrendChart`, which is precisely where §12.6 exists to stop it happening. `--chart-1` and `--chart-2` are load-bearing and must be **repaired** — one hue family per token across both themes, ≥ 3:1 on both `--card` planes, ratios recorded. `--chart-3`/`--chart-4`/`--chart-5` stay unused; leave them (a fourth series is not coming this week) but do not "fix" them by guessing. The repair is Phase 6B step 1, ahead of the component, so the chart is never built against values that are about to change.

## 13. Typography

### 13.1 The scale — every rung, with its line height and tracking

Quoted from `theme.css`. **`DESIGN.md` §10 states the pre-2026-08-15 scale and is stale** — it shows `--text-display: clamp(2.75rem, 1.6rem + 4.6vw, 4.5rem)` where the product uses `clamp(2.0rem, 1.3rem + 3.2vw, 2.75rem)`. Every rung shrank 25–30% in Week 3's typography pass on owner direction (*"reduce heading sizes considerably"*). Reconciling `DESIGN.md` is a W4-R12 task.

| Token | Value | Line height | Tracking | Use |
|---|---|---|---|---|
| `--text-display` | `clamp(2.0rem, 1.3rem + 3.2vw, 2.75rem)` — 32→44px | 1.05 | -0.03em | Homepage hero only. Once per site |
| `--text-h1` | `clamp(1.625rem, 1.3rem + 1.6vw, 2.125rem)` — 26→34px | 1.15 | -0.02em | Page title; the question on a question page |
| `--text-h2` | `clamp(1.375rem, 1.2rem + 0.8vw, 1.75rem)` — 22→28px | 1.2 | -0.015em | Section heading |
| `--text-h3` | `clamp(1.125rem, 1.02rem + 0.4vw, 1.3125rem)` — 18→21px | 1.3 | -0.01em | Card title, lesson title, **the price** |
| `--text-h4` | `1.0625rem` — 17px | 1.4 | -0.01em | Subsection, form group heading |
| `--text-lead` | `1.0625rem` — 17px | 1.5 | 0 | Lead paragraph, short answer |
| `--text-read` | `1.125rem` — 18px | **1.7** | 0 | Serif reading body. 18px not 17px: Newsreader's smaller x-height made 17px read *smaller* than the 16px sans beside it |
| `--text-body` | `1rem` — 16px | 1.55 | 0 | Sans body, UI text |
| `--text-sm` | `0.875rem` — 14px | 1.5 | 0 | Metadata, form labels, helper text |
| `--text-xs` | `0.75rem` — 12px | 1.4 | +0.16em on uppercase eyebrows only | **The floor. Nothing smaller ships** |

### 13.2 The three faces

| Family | Stack | Job |
|---|---|---|
| `--font-sans` | `'Schibsted Grotesk', ui-sans-serif, system-ui, sans-serif` | Variable 400–900. Drawn for a news publisher. The interface layer |
| `--font-serif` | `'Newsreader', ui-serif, serif` | Variable, real optical-size axis 6–72. Sustained on-screen reading |
| `--font-mono` | `'Azeret Mono', ui-monospace, SFMono-Regular, monospace` | Variable 100–900, squared-off. Reads as data because it was chosen |

Georgia and Times New Roman are **struck by name** from the fallback stacks and must not reappear. `--letter-spacing: -0.01em` is set on `body`.

**This week's typographic assignments, in full:**

| Surface | Face | Rung | Weight |
|---|---|---|---|
| `EvidencePanel` section label | mono | `text-xs`, uppercase, `+0.16em` | 500 |
| `EvidencePanel` fact label | sans | `text-sm` | 500 |
| `EvidencePanel` fact value | sans, **`tabular-nums` on counts** | `text-sm` | 400 |
| `VersionStamp` | **mono** | `text-xs` | 500 |
| `LicenceLine` | sans | `text-sm` | 400 |
| `PreviewGallery` caption | sans | `text-xs` | 400 |
| `RoutedProducts` heading | sans | `text-h3` | 600 |
| `RoutedProducts` explanation | sans | `text-sm` | 400 |
| Price, everywhere | sans, `tabular-nums` | `text-h3` minimum | 600, `--gold-strong` |
| Metric tile label | sans | `text-sm` | 500, `--muted-foreground` |
| Metric tile value | sans, **proportional figures** | `text-h1` | 600 |
| Metric tile denominator | sans | `text-xs` | 400, `--muted-foreground` |
| Invoice block (email) | table-safe sans stack | 14px / 12px | — |

**One refinement to `DESIGN.md` §10's tabular-figures rule, stated so it is not read as a contradiction.** §10 says *"tabular figures on anything countable — prices, progress percentages, durations, order totals."* Every case it names appears in a column or inline in a row of text, and tabular is right for all of them; that rule is unchanged and still governs. The case §10 does not name is a **large standalone value** — the metric tile's number at `text-h1`. `tabular-nums` gives every digit the width of a `0`, so `121` at 26–34px reads visibly loose. Metric tile values therefore use the font's default proportional figures; the denominator line beneath, and every table column on the same page, stay tabular. If the owner prefers §10 read absolutely, §10 wins and this paragraph is deleted.

### 13.3 The eyebrow device

Unchanged, and used by three of this week's new surfaces:

```css
.eyebrow {
  font-family: var(--font-mono);
  font-size: 0.75rem;  line-height: 1.4;  font-weight: 500;
  text-transform: uppercase;  letter-spacing: 0.16em;   /* not 0.2em — Azeret sets wider than JetBrains did */
  color: var(--muted-foreground);
  display: inline-flex;  align-items: center;  gap: 0.625rem;
}
.eyebrow::before { content: ""; width: 1.5rem; height: 1px; background: var(--eyebrow-rule-color, var(--accent)); }
```

`PageTitle`'s `eyebrowColor` prop overrides the rule colour per instance via `--eyebrow-rule-color` — used this week to tint a routed-product panel's eyebrow with the source question's domain colour.

## 14. Spacing

4px base, Tailwind's default scale. `--spacing: 0.25rem`.

```text
4  8  12  16  20  24  32  40  48  64  80  96  128
```

| Context | Value |
|---|---|
| Inside a compact control (button, chip) | 8–12px vertical, 12–16px horizontal |
| Card padding | 20px mobile, 24px tablet+, 28px feature cards |
| Gap between cards in a grid | 16px mobile, 24px desktop |
| Between a heading and its content | 12–16px |
| Between content blocks within a section | 32–40px |
| Between page sections (marketing) | 64px mobile, 96px desktop |
| Between page sections (product/dashboard) | 32px mobile, 48px desktop |
| Page horizontal padding | 20px mobile, 32px tablet, 48px desktop |

**Week 3's whitespace pass tightened page-container padding and inter-section margins by one Tailwind step, applied by exact-token regex substitution across every page and component.** New surfaces this week match what is on disk, not the table above where the two differ — check a neighbouring section before choosing a margin.

**Editorial vertical rhythm** (`.prose-guidance`): paragraph spacing 1em of the reading size (~18px), heading-above 2em, heading-below 0.5em. Set once, never per-component.

Arbitrary values (`mt-[13px]`) need a comment naming the optical reason. Optical corrections are legitimate; guesses are not.

**This week's specific spacing:**

| Surface | Spec |
|---|---|
| `EvidencePanel` outer | `p-5 sm:p-6`, `rounded-lg`, `border border-border`, `bg-gold-soft` |
| `EvidencePanel` fact rows | `py-2.5`, separated by `border-b border-border` — last row has no border |
| `EvidencePanel` → buy button | `mt-6` |
| `PreviewGallery` grid | `grid-cols-2 gap-3 sm:gap-4` |
| `RoutedProducts` | `mt-10 sm:mt-12` from the guidance body; internal `space-y-4` |
| Metric tile | `p-5`, grid `gap-4 sm:gap-5` |
| Admin product form | matches `AdminTemplates.tsx` exactly — same field spacing, same section rhythm |

## 15. Radius, borders and elevation

### 15.1 Radius — a hard 12px ceiling

`--radius: 0.75rem` (12px). Tightened **twice** (20 → 16 → 12) because 16px on the largest surfaces still read as modern-SaaS-template rather than the tailored editorial register this product wants.

| Utility | Value | Use |
|---|---|---|
| `rounded-sm` | 4px | Chips, badges, small buttons, table cells |
| `rounded-md` | 6px | Inputs, selects, buttons |
| `rounded-lg` | 8px | **Cards — the default** |
| `rounded-xl` | 12px | Feature blocks, video frame, hero panels |
| `rounded-2xl` / `rounded-3xl` | **12px** | Pinned to the same ceiling at token level. Reaching for these gets you nothing rounder |
| `rounded-full` | — | Avatars, pills, circular icon buttons only |

Preview thumbnails are `rounded-md`; the lightbox image is `rounded-lg`; the evidence panel is `rounded-lg`; metric tiles are `rounded-lg`. **Nothing this week is `rounded-xl`** — none of these are hero surfaces.

### 15.2 Borders

The default surface treatment is **a 1px border, not a shadow**. Cheaper, crisper, theme-safe, and it holds up in dark mode where shadows disappear.

| Situation | Treatment |
|---|---|
| Grouping / card edge | `border border-border` |
| Selected, active, current | `border-border-strong`, or a 2px `ring-ring` |
| Focus | `:focus-visible` outline — 2px `--ring`, 2px offset, 4px radius. Never a custom per-component focus style |
| Error | `border-destructive` **plus** an icon and a message. Never colour alone |
| Locked | `border-dashed border-border` + `Lock` icon |
| **Preview image plate (dark)** | `bg-muted p-3 rounded-md` behind a white document page — a plate, **never** a filter (§16.3) |

### 15.3 Elevation — four levels

| Level | Utility | Value | Use |
|---|---|---|---|
| 0 | none | — | The default. Most cards |
| 1 | `shadow-sm` | `0 1px 2px 0 rgb(var(--shadow-tint)/0.05), 0 2px 6px -1px rgb(var(--shadow-tint)/0.06)` | Cards that lift on hover; sticky headers when scrolled |
| 2 | `shadow-md` | `0 4px 10px -2px rgb(…/0.08), 0 2px 5px -2px rgb(…/0.05)` | Popovers, dropdowns |
| 3 | `shadow-lg` | `0 10px 24px -6px rgb(…/0.13), 0 4px 10px -4px rgb(…/0.07)` | Dialogs, the preview lightbox, mobile bottom sheets |

`--shadow-tint` is `52 42 26` (warm espresso) in light and `0 0 0` in dark. `--shadow-xl` and `--shadow-2xl` exist in the token set and **nothing this week uses them.**

## 16. Gradients and washes

Four devices exist. **Week 4 adds none** and consumes two.

### 16.1 `.page-wash` — used on `/admin/products` and `/admin/metrics`? No.

Not used. `.page-wash` is the catalogue header wash (Courses, Questions, Templates) at `opacity: 0.14`, deliberately one notch quieter than `.hero-wash`'s 0.18 because *a catalogue is a working index the reader scans, not a landing page*. **Admin surfaces get no wash at all** — an admin table with atmosphere behind it reads as a toy, and `DESIGN.md` §31's admin direction is functional-only.

```css
.page-wash {
  opacity: 0.14;
  background-image:
    linear-gradient(180deg, var(--accent) 0%, transparent 60%),
    linear-gradient(115deg, transparent 30%, color-mix(in srgb, var(--gold) 55%, transparent) 100%);
  mask-image: linear-gradient(to bottom, transparent 0%, black 14%, black 42%, transparent 92%);
}
```

Both layers are linear on purpose: a radial ellipse in a fixed-height box always exposes its own curved edge somewhere, and the blue alone desaturates to grey over ivory — the champagne pass from the right is what keeps it a deliberate warm tint rather than a dirty smudge.

### 16.2 `.stage-aurora` — unchanged, and not extended

Six layers on the dark plane, consumed by exactly four surfaces (hero, auth panel, footer via `--quiet`, member rail via `--rail`). **Week 4 adds no fifth consumer.** Its two knobs (`--aurora-opacity`, `--aurora-core`) exist for the footer and rail; a new surface that wants atmosphere gets `.page-wash` or nothing.

One item carried from `theme.css`'s own comment: `.stage-aurora--rail`'s contrast figures are marked `[UNVERIFIED — needs a rendered-pixel check]` and have been since 2026-08-13. **W4-R7's dark-mode pass closes it** — sample the rail's nav labels (80% opacity) and account row (70%) at 1440×900 in both themes, from the composited page, and either confirm the numbers or fix the variant.

### 16.3 `.hero-wash` — untouched

`opacity: 0.18`, three linear stops (accent from the top, primary from 115°, gold from 250°), masked to fade in at 12% and out by 94%. Homepage only.

### 16.4 `.text-gradient-brand` — not on a price, not on a metric

`linear-gradient(100deg, var(--primary) 0%, var(--accent) 50%, var(--gold-strong) 100%)` with `background-clip: text`. The gold stop is `--gold-strong`, not `--gold`, because the tail of the gradient is still legible text.

**Not used this week.** A gradient on a price or a metric value makes a number harder to read to make it prettier, which is the wrong trade on the two things a buyer and an owner actually read.

### 16.5 What must not be built

- **No glassmorphism.** `DESIGN.md` §5.2 bans it by name and it is not theoretical — `Contact.tsx`'s own docstring records a `bg-card/70 backdrop-blur-xl` card being built and ripped out. `implementation_plan.md` proposes it; that file is not a source of pending work.
- **No looping or ambient motion.** Both washes are static paint by design.
- **No new radial gradient** in a fixed-height box.
- **No hue-drift animation** outside the one `.bg-gradient-animated` that already exists and is currently unconsumed.

## 17. Motion

### 17.1 Tokens

```css
--ease-standard: cubic-bezier(0.2, 0, 0, 1);   /* most things */
--ease-entrance: cubic-bezier(0, 0, 0, 1);     /* things arriving */
--ease-exit:     cubic-bezier(0.3, 0, 1, 1);   /* things leaving */
```

| Band | Duration | Use |
|---|---|---|
| Micro | 100–150ms | hover, focus, press |
| Small | 150–220ms | chips, badges, tooltips, inline reveals |
| Medium | 220–350ms | cards, sheets, dialogs, the filter panel |
| Large | 350–500ms | page-level transitions (rare) |

**Nothing loops. Nothing exceeds 500ms.**

### 17.2 The complete motion catalogue for this week's surfaces

| Surface | Motion | Spec |
|---|---|---|
| `EvidencePanel` | None on mount. It is reference content the buyer is reading, not an arrival | — |
| `EvidencePanel` fact rows | None | — |
| `PreviewGallery` thumbnail hover | `.hover-lift` — `translateY(-2px)` + `shadow-md`, 150ms `--ease-standard` | Existing utility, not a new one |
| `PreviewGallery` lightbox open | `motion/react` presence: `opacity 0→1`, `scale 0.98→1`, 220ms `--ease-entrance` | Medium band |
| `PreviewGallery` lightbox close | `opacity 1→0`, 150ms `--ease-exit` | Exit is faster than entrance |
| `RoutedProducts` list entrance | Stagger the **first 6 only**: `opacity 0→1`, `y 8→0`, 220ms, `delay: min(i, 6) * 0.03` | `DESIGN.md` §39.3's exact pattern |
| `RoutedProducts` card hover | `.hover-lift` — 2px, **no scale** | A card that grows 4% pushes its neighbours and reads as a consumer app |
| Metric tile | None on mount. **Except** a value that is a proportion, which may animate its number once from 0 on first paint — the same "a state becoming known" argument `Library.tsx`'s progress bars already won | One shot, never loops |
| Admin product form save | `AutosaveIndicator` — existing component, existing timing | Reuse |
| Publish-guard refusal | Inline error, no motion. A money-adjacent refusal should not be animated | — |
| `RefundDialog`-class dialogs | Existing pattern; Cancel takes default focus | Reuse |

### 17.3 Prohibited

No parallax. No scroll-jacking. No reveal-on-scroll for **body content** — content that only appears when scrolled to does not exist for a screen reader user who jumped there. No animated page-load sequence. No hover-scale on cards. No looping anything.

### 17.4 Reduced motion

`<MotionConfig reducedMotion="user">` wraps the router, plus `theme.css`'s global CSS backstop for anything outside Motion's tree:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

Transitions become **instant state changes**, never removed — the state change itself still needs to be visible. W4-R7 verifies this on every new surface, specifically the lightbox (does it still open?) and the metric tile's count-up (does it still show the number?).

## 18. Iconography additions

Lucide React only, stroke width 1.75. Icons carry meaning or they do not appear.

| Concept | Icon | Size |
|---|---|---|
| File facts / page count | `FileText` | 16px |
| Spreadsheet / sheet count | `Table2` | 16px |
| Editable | `PenLine` | 16px |
| Opens at work / compatibility | `Laptop` | 16px |
| No macros (a guarantee, not a warning) | `ShieldCheck` | 16px |
| Version / last reviewed | `History` | 14px, inline with `text-xs` |
| Licence | `Scale` | 16px |
| Preview / sample page | `Image` | 16px |
| Routed recommendation | `Route` | 18px |
| Overlap conflict (admin) | `GitMerge` | 16px |
| Contact inbox | `Inbox` | 20px |
| Metric tile (per metric, fixed) | `Repeat2` · `ArrowRightLeft` · `SlidersHorizontal` · `Undo2` · `Timer` | 18px |
| Invoice | `ReceiptText` | 16px |

Every one of these is fixed for its concept product-wide. An icon-only control gets an `aria-label` and a tooltip. `SlidersHorizontal` is already the filter icon and is reused for the tag-filter metric deliberately — same concept, same mark.

## 19. Layout, containers and breakpoints

### 19.1 Containers

```tsx
// Marketing — homepage, catalogues, store
<div className="mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12" />

// Reading — question guidance, reading lessons, legal
<article className="mx-auto w-full max-w-[68ch] px-5 sm:px-8" />

// Product — dashboard, learning, downloads, account, the buy page
<main className="mx-auto w-full max-w-[1400px] px-5 sm:px-8" />

// Admin — tables need width
<main className="mx-auto w-full max-w-[1600px] px-4 sm:px-6" />

// Focused — auth, checkout handoff
<div className="mx-auto w-full max-w-md px-5" />
```

`max-w-[68ch]` is character-based deliberately, so it stays correct if the reading size changes. Do not replace it with a px value.

**One inconsistency to resolve this week** (`handover.md` §1): header, footer and `Home.tsx` agree at `max-w-7xl`; `QuestionsCatalogue.tsx` is still `max-w-6xl` and is the odd one out. W4-R4 touches that page — reconcile it there rather than in a separate pass.

### 19.2 Grid

| Content | Columns |
|---|---|
| Question results | 1 always — these are rows to scan, not tiles to browse |
| Course / template cards | 1 / 2 / 3 |
| **`PreviewGallery`** | **2 always** — two previews is the minimum and the typical case; a 1-column phone layout would push the buy button below three screens |
| **`RoutedProducts`** | 1 mobile / 2 from `md` |
| **Metric tiles** | 1 / 2 / 3 — five tiles on a 3-column grid leaves a 2-wide last row, which is correct and needs no filler |
| Discovery page | `lg:grid-cols-[280px_1fr]` |
| Learning | `lg:grid-cols-[320px_1fr]` |
| **Buy page with evidence** | 1 mobile / `lg:grid-cols-[1fr_380px]` — content left, evidence + buy right, sticky from `lg` |

### 19.3 Breakpoints and test widths

Tailwind defaults; no custom breakpoints without a real layout failure to point at.

```text
base < 640   sm 640+   md 768+   lg 1024+ (sidebars appear)   xl 1280+   2xl 1536+
```

Required test widths: **375 · 390 · 430 · 768 · 1024 · 1280 · 1440**. 375 is the floor and is not optional. `responsive-widths.spec.ts` already enforces these against eight routes; every new route this week is added to its list.

### 19.4 Sticky behaviour

| Element | Behaviour |
|---|---|
| Public header | Sticky, `shadow-sm` after 8px of scroll |
| **Buy button + evidence panel (desktop)** | `sticky top-20`, `max-h-[calc(100vh-6rem)]`, independently scrollable |
| **Buy button (mobile, < 640px)** | Sticky bottom bar, respecting `env(safe-area-inset-bottom)`. The evidence panel scrolls normally above it |
| Filter rail, course outline | `sticky top-20`, unchanged |

## 20. Component specifications

### 20.0 Reuse before you build

Every component below names what it composes. Nothing here introduces a new primitive, a new dependency, or a new focus/hover/error treatment.

Existing primitives available: `Button` · `Card` (+ `CardHeader`/`CardTitle`/`CardDescription`/`CardContent`) · `Badge` · `Input` · `AuthField` · `FieldError` · `EmptyState` (with `icon` prop) · `PageTitle` (with `editorial` variant + `eyebrowColor`) · `SectionHeading` · `StatusDot` (with `on="stage"`) · `ThemeToggle` · `CornerFrame` · `TypewriterTitle` · `UploadField` · `PublishStateChip` · `FeaturedToggle` · `AutosaveIndicator` · `RefundDialog` · `ManualGrantDialog` · `CartButton` / `CartDrawer` · `ContentTypeCard` · `BundleCard` · `useAutosave` · `useFieldValidation`.

---

### 20.1 `EvidencePanel` `[NEW]` — the ninety seconds before payment

**Where:** `/buy/:slug`, `/templates/:templateId`, `/store/packs/:slug`. Right column from `lg`, below the description on mobile.

**Composes:** a bare `<section>` (not a `Card` — `DESIGN.md` §36: a card is for a real, distinct item, and this is metadata about the item you are already on), `SectionHeading`, `PreviewGallery`, `LicenceLine`, `VersionStamp`.

**Structure:**

```text
┌─ bg-gold-soft, border-border, rounded-lg, p-5 sm:p-6 ────────┐
│  ── WHAT YOU GET            ← .eyebrow, mono xs, gold rule   │
│                                                              │
│  [FileText]  Format          .xlsx · 1 file                  │
│  [Table2]    Size            4 sheets, 62 rows               │
│  [PenLine]   Editable        Yes — formulas, no macros       │
│  [Laptop]    Opens in        Excel 2016 and later            │
│  [History]   Version         v1.2 · reviewed 17 Aug 2026     │
│  [Scale]     Licence         Use inside your organisation    │
│                                                              │
│  ── SAMPLE PAGES            ← .eyebrow                       │
│  ┌──────────┐ ┌──────────┐                                   │
│  │ preview1 │ │ preview2 │   ← PreviewGallery, 2-col         │
│  └──────────┘ └──────────┘                                   │
│                                                              │
│  A$39.00                     ← text-h3, 600, --gold-strong,  │
│                                 tabular-nums                 │
│  [ Add to cart ]  [ Buy now ]                                │
│                                                              │
│  one-time · lifetime access                    ← text-xs     │
│  Prices are in AUD. GST is included…           ← text-xs     │
│  You're covered by your consumer-guarantee…    ← text-xs     │
└──────────────────────────────────────────────────────────────┘
```

**Design values:**

| Property | Value |
|---|---|
| Surface | `bg-gold-soft` (`#F3E9D2` light / `#2E2517` dark) |
| Border | `1px solid var(--border)`, `rounded-lg` (8px) |
| Padding | `p-5` base, `p-6` from `sm` |
| Section label | `.eyebrow` — mono, 12px, uppercase, `+0.16em`, `--muted-foreground`, 24px `--gold` rule before |
| Fact label | sans, `text-sm`, 500, `--muted-foreground` |
| Fact value | sans, `text-sm`, 400, `--foreground`; `tabular-nums` on any numeral |
| Fact row | `py-2.5`, `border-b border-border`; **last row has no border** |
| Icon | 16px Lucide, stroke 1.75, `--gold-strong` |
| Price | `text-h3` minimum, 600, `--gold-strong`, `tabular-nums` |
| Legal lines | `text-xs`, `--muted-foreground`, `space-y-1`, `mt-4` |
| Elevation | **0**. The border does the work |

**The absence rule, which is the whole component:** a fact whose column is `NULL` **does not render its row at all.** No `—`, no "Not specified", no greyed-out placeholder. A panel with four rows is honest; a panel with six rows two of which say "unknown" tells the buyer the seller does not know what they are selling.

**States:**
- *Loading* — a skeleton with the same row count as the last known shape, or three rows if unknown. Never a spinner in a reference panel.
- *Empty* — if **no** evidence fields are set at all, the panel is absent and the buy button sits where it always did. The page does not degrade; it just does not gain anything.
- *Owned* — the price and buttons are replaced by the existing owned state; **the facts stay.** A buyer who already owns it still wants to know the version.

**Accessibility:** the fact list is a `<dl>` with `<dt>`/`<dd>` pairs, not a table and not divs. Icons are `aria-hidden` — the `<dt>` already names the concept.

---

### 20.2 `PreviewGallery` `[NEW]`

**Contract:** `{ keys: string[]; alts: string[]; title: string }`. Renders nothing if `keys.length === 0`.

| Property | Value |
|---|---|
| Grid | `grid-cols-2 gap-3 sm:gap-4` — always 2 |
| Thumbnail | `aspect-[3/4]`, `object-cover object-top`, `rounded-md` (6px), `border border-border` |
| **Dark-mode plate** | `bg-muted p-3 rounded-md` **behind** a light document page. Never a CSS filter (§16.3) |
| Hover | `.hover-lift` — 2px, `shadow-md`, 150ms `--ease-standard` |
| Lightbox | `rounded-lg`, `shadow-lg`, backdrop `--stage` at 80%, max 90vh |
| Lightbox in | `opacity 0→1`, `scale 0.98→1`, 220ms `--ease-entrance` |
| Lightbox out | `opacity 1→0`, 150ms `--ease-exit` |
| Caption | `text-xs`, `--muted-foreground`, `mt-2` |
| Touch target | Thumbnail is the target and exceeds 44×44 at every width |

**Alt text is a requirement, not a nicety.** *"Page 3 of the scorecard: the weighted-criteria table"* — never `alt="preview"`, never `alt=""`. These images carry the information the buyer is deciding on, so they are informative images by WCAG's own definition.

**Lightbox behaviour:** traps focus, closes on Escape, returns focus to the thumbnail that opened it, arrow keys move between images. Hand-rolled to match `RefundDialog`'s existing pattern — there is no Radix dependency in this project and this is not the week to add one.

---

### 20.3 `LicenceLine` `[NEW]`

**Contract:** `{ licence: 'standard' | 'client_delivery' | 'multi_client' }`.

One sentence, `text-sm`, with `Scale` at 16px in `--gold-strong`, linking "the full terms" to `/legal/terms`.

| Tier | Sentence |
|---|---|
| `standard` | "Use and adapt this inside your own organisation." |
| `client_delivery` | `[OWNER #25]` — **not rendered until the decision closes.** |
| `multi_client` | `[OWNER #25]` — same. |

**The refusal is the design.** `new_additions.md` §20's own warning: licence terms must be precise about modification, client distribution, white-label, resale, client count, attribution and redistribution, and *"never casually write 'commercial use allowed.'"* An unset tier renders the `standard` sentence; a tier the owner has not defined renders **nothing**, and the panel is one row shorter.

---

### 20.4 `VersionStamp` `[NEW]`

`v1.2 · reviewed 17 Aug 2026` — mono, `text-xs`, `--gold-strong`, `History` icon at 14px, `tabular-nums` on the date.

Rendered in three places, from one source: the evidence panel, the receipt email, and inside the downloaded artefact's own filename (`vendor-risk-scorecard-v1.2.xlsx`). `new_additions.md` §33 point 1: *visible before purchase and inside the file.*

Unset `version` renders nothing. Unset `last_reviewed_at` with a set `version` renders `v1.2` alone.

---

### 20.5 `RoutedProducts` `[NEW]` — "what would help with this"

**Where:** question detail page, below the guidance body, above related questions.

**Composes:** `SectionHeading`, `Card`, `Badge`, `.hover-lift`.

```text
── WHAT WOULD HELP HERE                      ← .eyebrow, rule tinted
                                               with the domain colour
┌─────────────────────────────┐ ┌─────────────────────────────┐
│ TPRM Due Diligence Checklist│ │ Complete TPRM Template Pack │
│ A$49.00                     │ │ A$99.00                     │
│                             │ │                             │
│ Because it addresses        │ │ Because it addresses        │
│ "Third-Party Risk Is a      │ │ "Third-Party Risk Is a      │
│ Black Box" and 2 related    │ │ Black Box" and 4 related    │
│ questions ↗                 │ │ questions ↗                 │
└─────────────────────────────┘ └─────────────────────────────┘
```

| Property | Value |
|---|---|
| Grid | 1 mobile / `md:grid-cols-2`; **max 2 shown**, with "See all N" if more |
| Card | existing `Card`, `rounded-lg`, `border-border`, elevation 0 |
| Left rule | 3px `--gold`, full height — the existing buy-surface family marker |
| Title | `text-h3`, 600 |
| Price | `text-h3`, 600, `--gold-strong`, `tabular-nums` |
| Explanation | `text-sm`, `--muted-foreground`; question titles are inline links in `--accent` with underline on hover |
| Eyebrow rule | tinted with the source question's `--domain-*` colour via `--eyebrow-rule-color` |
| Entrance | stagger first 6, `opacity 0→1` + `y 8→0`, 220ms, `delay min(i,6)*0.03` |
| Hover | `.hover-lift` — 2px, no scale |
| Empty | **The whole section is absent.** Not an empty card, not "no recommendations yet" |

**The explanation is generated from the join and is never decorative.** If the routing produced this product because it grants *this* question, the sentence says so. If it came via neighbours, it names how many and links them. Two products routed through the same one question show the same sentence — which is correct, and is the point.

---

### 20.6 `SituationProducts` `[NEW]`

The catalogue twin. Rendered on `/questions` **only when ≥1 filter is active**, below the result list, never above it — the reader came to read questions.

Same card treatment as `RoutedProducts`. The explanation differs: *"These 3 products address 8 of the 12 questions matching your filters."* Numbers are `tabular-nums` and are computed, never rounded to sound better.

**Absent when:** no filters active · filters active but no result questions are granted by any published product · the routing endpoint errors. All three render nothing, silently. A catalogue that suggests products when it has nothing to suggest is the "fabricated relevance" failure the existing match-explanation code was written to avoid.

---

### 20.7 `MetricTile` `[NEW]` — and why there is no chart

**The form decision first.** Five independent numbers, each answering a different question, none of them a series over time and none of them a part-to-whole comparison. That is a stat-tile job, not a chart job — the number *is* the answer, and a plot around it would add ink without adding information. A charting library in a hardening week is scope drift with a nice render.

```text
┌─ p-5, rounded-lg, border-border, bg-card ──────┐
│  [Repeat2]  Second-purchase rate               │  ← text-sm, 500, muted
│                                                │
│  50%                                           │  ← text-h1, 600, foreground,
│                                                │     PROPORTIONAL figures (§13.2)
│  1 of 2 buyers · since 11 Aug 2026             │  ← text-xs, muted, tabular-nums
└────────────────────────────────────────────────┘
```

| Property | Value |
|---|---|
| Surface | `bg-card`, `border border-border`, `rounded-lg`, `p-5` |
| Grid | `grid gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3` |
| Label | `text-sm`, 500, `--muted-foreground`, with an 18px fixed icon in `--gold-strong` |
| Value | `text-h1`, 600, `--foreground`, **proportional figures** |
| Denominator | `text-xs`, `--muted-foreground`, `tabular-nums` |
| Elevation | 0 |
| Motion | none, except an optional one-shot count-up on a proportion |
| Delta | **Not shipped.** A delta needs a previous period, and there is no traffic history to compare against. Adding one now would show a fabricated trend |

**Two states that matter more than the populated one:**

- *No data* — the value slot renders the label's own empty sentence, in `text-sm` `--muted-foreground`: "No second purchases yet — 2 buyers so far." Never `0%`, never `—`, never `NaN`.
- *Not loaded* — an em dash, per non-negotiable #15. Zero and unknown are different.

**Text wears text tokens.** The value is `--foreground`; the icon carries the identity in `--gold-strong`. A metric value is never coloured by what it measures.

---

### 20.7a `TrendChart` `[NEW, AMENDED 2026-08-17]` — the one chart, and its conditions

§20.7 argued there is no chart on this page. That argument holds for five single numbers and is **withdrawn only for a series**: revenue and order count over time is a genuine part-to-whole-over-time shape, it is the question the owner actually asks of a shop, and no tile can carry it.

**What it plots.** Two series, one axis pair, on `orders` alone:

| Series | Value | Mark |
|---|---|---|
| Revenue | `sum(total_amount_cents)` per bucket, `status = 'completed'` | Area, `--chart-1` at 12% fill, 2px stroke |
| Orders | `count(*)` per bucket, `status = 'completed'` | Line, `--chart-2`, 2px, right axis |

**Bucketing is chosen by span, never by the reader.** `date_trunc` by day when the range is ≤ 60 days, by week to 12 months, by month beyond. A picker that lets the reader choose "hourly" over a dataset of four orders is a way of producing noise on request.

| Property | Value |
|---|---|
| Surface | `bg-card`, `border border-border`, `rounded-lg`, `p-5`, spanning the full tile grid width |
| Height | `h-64` fixed. Never viewport-relative — a chart that reflows on scroll is a chart nobody can read a value off |
| Axes | Y left revenue via `formatCurrency`, Y right orders as integers, X as short dates. `tabular-nums` on every tick |
| Grid | Horizontal rules only, `--border` at 50%. No vertical grid, no chart junk |
| Legend | Two inline swatch+label pairs above the plot, not a floating box |
| Motion | One-shot draw on mount, ≤ 240ms, `prefers-reduced-motion` disables it. **Nothing loops** (non-negotiable #6) |
| Tooltip | On hover **and** on focus. Keyboard-reachable points, `role="img"` with a text summary — §22's rule, and the reason a hover-only charting default is not acceptable here |

**The four states, and why the third is the important one:**

- *Populated* — ≥ 2 buckets with data.
- *Not loaded* — skeleton at the same `h-64`, so the page does not jump.
- **Fewer than two points** — renders the sentence, not the plot: *"Not enough history to chart yet — 1 order since 11 Aug 2026."* A line drawn through one point is an invented trend, and this is the same rule §20.7 applies to `0%` over two buyers. **This is the state the page will actually be in on the day it ships**, so it is the one to build first and screenshot for the report.
- *Error* — em dash and an inline retry, matching `MetricTile`.

**Colour.** `--chart-1` and `--chart-2` only — and both are **broken today** (§12.6: different hue families per theme). Repairing them stops being optional decoration the moment this chart exists: task 37 moves from `[DEFECT]`-cleanup to a **prerequisite** of this component, and "delete the five tokens" ceases to be an acceptable outcome of its time box. Sequencing is in Phase 6B step 1.

**The library — `[RESOLVED 2026-08-17]`: the shadcn/ui chart block (Recharts underneath).** Not hand-rolled, per owner instruction *"search for existing UI libraries and build using them."* Researched rather than recalled; four reasons, one of which is decisive:

1. **`--chart-1` … `--chart-5` are shadcn's own convention, not ours.** This is the finding that settles it. Those five tokens are in `theme.css` *because* `week1_plan.md` scaffolded shadcn with CSS variables — they arrived with the install and nothing ever rendered against them, which is exactly why §12.6 found them unaudited and why one is byte-identical across themes. shadcn's `ChartConfig` reads `var(--chart-N)` directly. **We are not adopting a library's palette; we are finally using the tokens we already have.**
2. **It is already this project's component source.** `DESIGN.md` §33.1: *"Use shadcn/ui wherever a suitable primitive exists. Components are copied into the repo, so they are ours to edit."* A chart is a suitable primitive and this is that rule applying, not an exception to it.
3. **Copy-in, not a dependency on the UI layer.** `ChartContainer`/`ChartTooltip` land in `components/ui/chart.tsx` as our code, subject to the same nine-point Definition of Done as `Button` and `Badge`. Only Recharts itself is an npm dependency.
4. **`accessibilityLayer` is a real answer to §22.** Recharts' `accessibilityLayer` prop gives keyboard navigation and screen-reader support on the plot — the requirement in the table above that a hover-only charting default would have failed.

**What it costs, stated honestly rather than discovered later:**

| Cost | Detail |
|---|---|
| **Bundle** | Recharts is ~150kB min. **This lands in the same week W4-R8 makes the JS budget blocking.** Measure it, and import per-chart rather than barrel-importing Recharts. If it breaches the budget, the chart is cut (§10.0) — the budget is not raised to admit it |
| **React 19 override** | Recharts needs a `react-is` override to install against React 19. This project is on React `^19.2.8`, so `package.json` gains `"overrides": { "react-is": "^19.2.8" }` — matched to the React version actually installed, not copied from the docs' example pin |
| **Peer install** | `npm install --legacy-peer-deps` may be required. Note it in the handover env checklist if so |

**The alternative considered and rejected: Tremor.** Tailwind-native, dashboard-shaped, more batteries included, and its blocks are free and open source. Rejected because it is a **second component system** beside shadcn — `DESIGN.md` §33's whole argument is one primitive source — it bundles its own Recharts (~200kB vs ~150kB) in the week the budget starts blocking, and it brings its own colour conventions rather than reading the tokens already in `theme.css`. Worth revisiting only if the admin surface ever grows into a genuine dashboard product.

**`MetricTile` composes, it does not invent.** §20.7's tile is `Card` + `Badge` + existing type rungs — all present in `components/ui/`. Nothing new is authored for it beyond layout. That is the same instruction applied one level down: use what exists.

---

### 20.8 Admin: `ProductEditor` and `ContactInbox` `[NEW]`

`DESIGN.md` §31's admin direction is **functional-only**: dense, plain, fast. No wash, no aurora, no atmosphere, `max-w-[1600px]`, `rounded-sm` on table cells, `text-sm` throughout.

**`ProductEditor`** mirrors `AdminTemplates.tsx` field-for-field in spacing and rhythm, and reuses `useAutosave`, `useFieldValidation`, `PublishStateChip` and `UploadField` unchanged. Two things are specific to it:

1. **The price/Stripe mismatch warning.** `price_amount` and `stripe_price_id` are two systems holding one fact. Changing one without the other renders an inline `--warning` message naming both values. Not a blocker — sometimes the Stripe price genuinely was updated first — but never silent.
2. **The overlap refusal.** On publish, W4-R3's guard runs. A conflict renders inline, in `--destructive`, with a `GitMerge` icon, naming the other product and the shared content, and linking to it. The existing "upload a file before publishing" guard already establishes this shape: an inline error that explains, never a disabled control that cannot.

**`ContactInbox`** — a table, newest first, columns: date · name · email · enquiry type · notified · message (truncated, expandable in place). `notified = false` rows carry a `StatusDot` in `--warning` and the row is the set that matters after any outage. Below `md` the table becomes stacked cards, per §41.3.

---

### 20.9 The invoice block `[NEW]` — email templates, the one place hex is allowed

Extends `receipt.html.j2` / `receipt.txt.j2`. Table-based, 600px, inline styles, no web fonts, no CSS variables — a mail client resolves none of them.

```text
TAX INVOICE                                    Invoice  INV-000142
                                               Date     17 Aug 2026

Effective RM

Bill to
  Jane Practitioner
  jane@example.com

  Description                          Qty    Amount
  ─────────────────────────────────────────────────
  Vendor Risk Assessment Scorecard      1     A$39.00
  v1.2 · reviewed 17 Aug 2026
  ─────────────────────────────────────────────────
  Subtotal                                    A$39.00
  GST (included)                              A$3.55
  Total                                       A$39.00

Prices are in AUD. GST is included for Australian customers.
You're covered by your consumer-guarantee rights, regardless
of anything else stated here.
```

**Hex values, sanctioned and fixed:** ink `#1C1712` · muted `#6E675A` · rule `#E6DFD0` · accent `#1D5FA8` · gold `#7C5C14`. These are the light-theme token values transcribed once, in one file, with a comment naming their source token — so a token change has one place to follow rather than nine.

`version` renders under the line item, per §20.4. There is no ABN line at all — `[RESOLVED 2026-08-20]`, §8.1 decision #31 — not an omitted-when-unset field, a field that was never added.

### 20.10 The four states, per new surface

| Surface | Empty | Loading | Error | Locked |
|---|---|---|---|---|
| `EvidencePanel` | Absent entirely | Row-count skeleton | Facts absent, buy button intact | n/a — evidence is never gated |
| `PreviewGallery` | Absent entirely | 2 aspect-locked skeletons | Absent; panel keeps its facts | n/a |
| `RoutedProducts` | Absent entirely | 2 card skeletons | Absent | n/a |
| `SituationProducts` | Absent entirely | Absent (never blocks the results) | Absent | n/a |
| `MetricTile` | Named empty sentence | Em dash | Em dash + inline retry | n/a |
| `ProductEditor` | "No products yet" + create action | Skeleton rows | Inline `FieldError` | Publish guard refusal, inline |
| `ContactInbox` | "No messages yet" + `EmptyState` `Inbox` icon | Skeleton rows | Inline retry | n/a |

**"Absent entirely" is a designed state, not a missing one**, and it is the right one for four of these seven. A recommendation panel that says "no recommendations" teaches the reader the feature is broken; a page that simply does not have one teaches them nothing, which is correct.

## 21. Responsive specification

### 21.1 Per-surface behaviour

| Surface | < 640 | 640–1023 | ≥ 1024 |
|---|---|---|---|
| Buy page + evidence | Stacked: description → evidence → sticky bottom buy bar | Stacked, inline buy button | `grid-cols-[1fr_380px]`, evidence sticky `top-20` |
| `PreviewGallery` | 2 columns, `gap-3` | 2 columns, `gap-4` | 2 columns, `gap-4` |
| `RoutedProducts` | 1 column | 1 column | 2 columns |
| Metric tiles | 1 column | 2 columns | 3 columns |
| `ProductEditor` | Stacked fields, full-width | Stacked | 2-column field grid |
| `ContactInbox` | **Stacked cards** | Stacked cards | Table |

### 21.2 Mobile rules in force

Mobile is a designed layout, not a narrowed desktop. Priority order on a small screen: **content → primary action → search → progress → navigation.**

- Full-width primary buttons.
- Bottom sheets for filters, not squeezed sidebars.
- Tables become stacked cards below `md`. Horizontal scroll is a last resort and needs a visible affordance.
- **No hover-only interaction anywhere.** The preview lightbox opens on tap; the routed-product explanation is always visible, never a tooltip.
- `env(safe-area-inset-bottom)` on the sticky buy bar.
- Test the checkout and the video player on a real phone, not a resized window.

### 21.3 The route × state matrix (W4-R6)

The hardening sweep's actual deliverable. One row per route in `App.tsx`, one column per state, each cell either ✅ or a named reason it does not apply. Built as a table in `week4_report.md` and filled by walking, not by reading.

```text
Route                          Empty   Loading   Error   Locked   375px   Dark   axe
/                                ·        ·        ·      n/a       ·      ·      ·
/questions                       ·        ·        ·      n/a       ·      ·      ·
/questions/:slug                 ·        ·        ·      n/a       ·      ·      ·
/courses  /courses/:slug         ·        ·        ·       ·        ·      ·      ·
/templates  /templates/:id       ·        ·        ·       ·        ·      ·      ·
/store  /store/packs/:slug       ·        ·        ·      n/a       ·      ·      ·
/buy/:slug                       ·        ·        ·       ·        ·      ·      ·
/checkout/success  /cancel       ·        ·        ·      n/a       ·      ·      ·
/dashboard  /library             ·        ·        ·       ·        ·      ·      ·
/learn/:course/:lesson           ·        ·        ·       ·        ·      ·      ·
/lessons/:id                     ·        ·        ·       ·        ·      ·      ·
/contact  /legal/*               ·        ·        ·      n/a       ·      ·      ·
/sign-in  /sign-up  /forgot  /reset  ·    ·        ·      n/a       ·      ·      ·
/admin/{questions,courses,templates,orders,products,contact}       ·      ·     n/a
```

**33 paths × 7 columns** — the 30 `App.tsx` declares today plus this week's three admin routes. A cell that cannot be reached is marked with the reason, not left blank.

## 22. Accessibility specification

The floor is **WCAG 2.2 AA**, and several of these are invisible to a component-level audit.

| Rule | This week's application |
|---|---|
| One `h1` per page, headings in order, no skipped levels | `CheckoutSuccess.tsx` and `Template.tsx` fixed **and added to the axe route list** (W4-R6). `EvidencePanel`'s section labels are `h2`, its fact list is a `<dl>` |
| Route changes announced | `RouteAnnouncer` exists in `RootLayout`; verify it fires on the new admin routes |
| Focus moves to the new page's `h1` | `PageTitle` renders `tabIndex={-1}`; verify on `/admin/products` and `/admin/contact` |
| Skip link first focusable | Exists; verify on the new routes |
| Focus trapped in overlays, Escape closes, focus returns | `PreviewGallery`'s lightbox, hand-rolled to `RefundDialog`'s pattern |
| Target size ≥ 24×24, ≥ 44×44 touch | Preview thumbnails, the metric tiles' retry, the inbox's expand control |
| `aria-describedby` on helper text and errors; `aria-invalid` on failure | `ProductEditor`'s fields via the existing `useFieldValidation` + `FieldError` pair |
| Live regions | Result count `polite` (exists) · autosave `polite` (exists) · **publish-guard refusal `assertive`** — it stops a money-adjacent action and genuinely interrupts |
| No colour-only meaning | The `notified = false` inbox row carries a `StatusDot` **and** a text label. The price/Stripe mismatch carries an icon **and** a sentence |
| Informative images have real alt text | Every preview image (§20.2) |
| Both themes checked for every state | Especially focus (`--ring` `#1B4E8C` / `#8FC1EA`) and error (`--destructive` `#B3402E` / `#E11D48`) |

**The six manual checks** (W4-R7) are the part automation cannot do, and they are the part `DESIGN.md` §42.9 explicitly assigns to Week 4.

## 23. Copy deck

Every user-visible string introduced this week. Voice: **plain, specific, never salesy.** Numbers over adjectives.

**Evidence panel**
- Eyebrow: `WHAT YOU GET`
- Labels: `Format` · `Size` · `Editable` · `Opens in` · `Version` · `Licence`
- Values (patterns): `.xlsx · 1 file` · `4 sheets, 62 rows` · `18 pages` · `Yes — formulas, no macros` · `Excel 2016 and later` · `v1.2 · reviewed 17 Aug 2026`
- Eyebrow: `SAMPLE PAGES`
- Licence, standard: `Use and adapt this inside your own organisation.` + `See the full terms`

**Routed products**
- Eyebrow: `WHAT WOULD HELP HERE`
- One question: `Because it addresses "{title}".`
- With neighbours: `Because it addresses "{title}" and {n} related questions.`
- Catalogue: `These {p} products address {q} of the {total} questions matching your filters.`
- Overflow: `See all {n}`

**Admin**
- Overlap refusal: `Can't publish — "{other}" already grants {content}. Two published products can't include the same thing unless one is a bundle.`
- Bundle price refusal: `A bundle has to cost less than its parts. This one is {bundle}; its parts come to {sum}.`
- Preview refusal: `Add at least two sample pages before publishing. Buyers who can't see what they're getting don't buy it.`
- Macro refusal: `This file contains macros. Macros are blocked on most corporate machines — replace it with a macro-free version before publishing.`
- Price mismatch: `The price shown ({local}) and the Stripe price ({stripe}) don't match. Update the Stripe price too, or buyers will be charged the old amount.`
- Inbox empty: `No messages yet. Anything sent through /contact lands here.`

**Metrics**
- `Second-purchase rate` / `{n} of {m} buyers · since {date}` / empty: `No second purchases yet — {m} buyers so far.`
- `Free to paid` / `{n} of {m} people who gave an email` / empty: `No purchases from the email list yet.`
- `Tag filters used` / `{n} filter applications` / empty: `No filter use recorded yet.`
- `Refund rate` / `{n} of {m} orders` / empty: `No refunds. {m} orders so far.`
- `Signup to first purchase` / `median across {n} buyers` / empty: `Not enough buyers to say yet.`

**Receipt / invoice**
- `TAX INVOICE` · `Invoice` · `Date` · `Bill to` · `Description` · `Qty` · `Amount` · `Subtotal` · `GST (included)` · `Total`
- Existing shared strings unchanged: `TAX_STATEMENT_TEXT`, `REFUND_POSITION_TEXT`, `BILLING_TYPE_TEXT`.

### 23.1 Copy deck — Phase 8 additions `[NEW 2026-08-20]`

Same voice, same rule: **plain, specific, numbers over adjectives, and no claim without a column.** Written here before it is written into a component.

**Products menu (W4-R18)** — five items, each one line
- `Questions` / `Free to read` · `Courses` / `Video lessons and worked examples` · `Templates` / `Files you can edit` · `Reference packs` / `A domain's questions in one place` · `All products` / `Everything, with prices`

**Why this (W4-R16)** — the eyebrow and the six permitted claims
- Eyebrow: `WHY THIS ONE`
- `Built from a documented decision model, not a blank page.`
- `Written for the decision you're actually in — this is reached from the question it answers.`
- `Versioned and reviewed. You're buying v{version}, reviewed {date}.`
- `You can see what's inside before you pay — {n} sample pages, and the format facts above.`
- `Macro-free, so it opens on a locked-down machine.`
- `The licence says what you may do with it, in words.`
- **Nothing about other buyers.** No counts, no ratings, no testimonials — none of those numbers exists.

**CTA ladder**
- Primary: `Buy — {price}` · Secondary: `See the sample pages` · Tertiary: `Start with a free one`
- After-payment line: `Download straight away. Receipt by email. Access doesn't expire.`

**Licence and sharing (W4-R16)**
- In-file stamp: `Licensed to {name} ({email}) · Order {order_id} · {licence} licence · v{version}`
- On the page: `Your copy is stamped with your name. Sharing it shares your name with it.`
- The upsell, not a scolding: `Need to give this to clients? There's a licence for that.`
- Unstampable type, in admin: `{ext} files are served unstamped — this type can't carry one.`

**Pricing (W4-R15)** — admin-facing
- `Anyone already at the checkout screen pays the old price.`
- Confirmation: `A${old} → A${new}. Change the price?`
- Reason field: `Why is the price changing? This goes in the audit log.`

**Readiness (W4-R17)** — admin-facing, one per state
- `No product yet — this can't be bought.` · `Price not set.` · `Stripe doesn't recognise this price — it can't be bought until it does.` · `Ready, not published.` · `Live.`

**Video (W4-R13)** — four failures, four sentences
- `Still encoding — Mux is processing this. It'll play in a few minutes.` · `No playback token — this asset is private and the token request failed.` · `Mux doesn't recognise this playback ID.` · `The video player didn't load. Check the connection and reload.`

---

# PART III — IMPLEMENTATION PLAN

Five days, seven phases — plus five that do not fit in five days and say so: **6B**, **6C**, **8**, **9** and **10**, all Week 5. Each phase has steps with file paths and a Definition of Done that is checkable rather than felt.

**Week 5 order:** 6B → 6C → 8 → 9 → 10. Phase 10 is last because §10C and §10D build on what 9B shipped, and because its own §10D/§10F halves are already largely landed — it is the smallest of the five once its repository-state note is read. Phase 9 sits before it because 9A's sequencing gate needs 8A/8B's engine to exist before the Products page can be removed — and, per §9A's repository-state note, most of that engine's **backend** already landed while its **frontend** did not. 9B shares no file with any of them and can start whenever a second person is free.

**`[VERIFIED 2026-08-20]` Read §28's task ledger for the real state before trusting any phase's prose below or `handover.md`'s Week 4 section — both describe more completion than the repository has.** The steps and Definitions of Done below are the plan as designed; they were not re-ticked line by line, and several tasks they describe as shipped (the specified five metrics, the routing query-count test, the Recharts chart) are not actually in the repository. Phase 5's hardening sweep is now partially complete: the route×state matrix, failure-mode evidence, gating attacks (16/16), chart token repair, and performance CI (bundle-size + Lighthouse) are documented in `docs/week4_report.md`. The six manual a11y checks and `.stage-aurora--rail` verification remain human tasks. §28 is the accurate record for the remaining items.

**A standing instruction, carried from Week 3 and reinforced by `handover.md` §4's last item:** commit in **topic-scoped commits**. Week 3's entire output is uncommitted in the working tree and the last commit on `main` is a single mixed `edited`. Do not add a second one.

---

## Phase 0 — Day 0 (half day): Ground truth and the three carried one-liners

Nothing in this phase is new work. It is the cheapest possible start and it removes three items that have now been carried across two reports.

**`[VERIFIED COMPLETE 2026-08-20]`** — every step below re-checked against the repository this session; the two that weren't actually done were done, not just marked. Commits: `55eecaf`, `85b55dc`, `8c51fc1`, `602b3cc` (already landed, 2026-08-19) plus `cfa6b9d`, `f021be2`, `a0f4318`, `59642a3` (landed this session).

### Steps

1. **Commit Week 3's working tree**, in topic-scoped commits — email spine · migrations 010–012 · refunds · admin uploads/publish states · cart · Phase 6 content/QA. Six or seven commits, each readable alone. Nothing new is written in this step. — ✅ **Done, 2026-08-19.** Landed as 4 topic commits rather than 6–7: `602b3cc` (backend + docs), `8c51fc1` (frontend UI/specs), `55eecaf` (CI fix, step 2), `85b55dc` (axe routes, step 3's second half). Coarser-grained than the plan's estimate but genuinely topic-scoped — no file touches two unrelated concerns. *(Week 4 Phases 1–7's own work is a separate, still-uncommitted body of work — not "Week 3's tree," out of this step's scope; see §28's ledger task 1 note.)*
2. **Fix `.github/workflows/ci.yml`** `[DEFECT]` — remove `RESEND_API_KEY`, add `MAILJET_API_KEY`, `MAILJET_SECRET_KEY`, `MAILJET_SENDER_EMAIL`, `MAILJET_SENDER_NAME`, `OWNER_NOTIFICATION_EMAIL`, `FRONTEND_URL`. Confirm against `backend/.env.example` and `app/core/config.py`, not from memory. — ✅ **Done** (`55eecaf`). All five vars present, no `RESEND_API_KEY`; confirmed against `config.py`'s actual field names, not memory.
3. **`CheckoutSuccess.tsx` and `Template.tsx`** `[CARRIED]` — swap `CardTitle` for `PageTitle`, and add both routes to `accessibility.spec.ts`'s `PUBLIC_ROUTES`. `Template.tsx` needs an owned product to reach, so the spec needs a fixture or a skip with a reason — **write the reason, do not silently omit the route.** — ✅ **Done, completed this session.** The axe-route half landed 2026-08-19 (`85b55dc`); the actual heading swap was still sitting uncommitted and got done + committed now (`cfa6b9d` CheckoutSuccess, `f021be2` Template — the latter bundled with Phase 3's `EvidencePanel` wiring since both touch the same header block, noted in the commit message rather than force-split). `Template.tsx` takes the written-reason path exactly as anticipated: covered by `accessibility.spec.ts`'s separate dynamic real-template-detail-page test (resolves a real id from `/templates` rather than a static route needing ownership). **A real bug surfaced and was fixed along the way**: adding `/checkout/success` to `PUBLIC_ROUTES` means an anonymous axe visit hits its auth guard and actually scans `AuthLayout.tsx` (the sign-in shell) — which had no `<main>` landmark at all, failing axe's `landmark-one-main`/`region` rules in both themes. Fixed (`a0f4318`); `/checkout/success` now passes axe cleanly in both themes, verified by a live Playwright re-run.
4. **Reconcile `QuestionsCatalogue.tsx` to `max-w-7xl`** (`handover.md` §1's named odd-one-out). One class. — ✅ **Done, 2026-08-19** (`8c51fc1`). Confirmed at both container divs (line 566, 581 as of this check).
5. **Run everything**: `pytest` (expect 62), `npm test`, `npx playwright test`, `tsc --noEmit`, `vite build`. **Record the actual numbers** — this is the baseline every later claim is measured against. — ✅ **Done, run for real this session, against live dev servers (backend on :8000, frontend on :5173), not assumed.** Numbers below.
6. **Write the environment checklist** for Render into `handover.md` §4 item 15, converting it from a note into a list someone can execute. — ✅ **Done this session** (`59642a3`). Item 15 is now a real checklist — 3 remove-lines, 14 set/confirm-lines cross-referenced against `.env.example` and `config.py` field-by-field, plus a "redeploy and confirm with a real send" closing step. Still `[HUMAN]` to actually tick against the live Render dashboard — this document cannot see it.

**Baseline numbers, 2026-08-20** (the count this plan's every later "passing" claim should be measured against):

| Suite | Result | Note |
|---|---|---|
| `pytest` (backend) | **89 passed**, 0 failed | Not 62 — the suite has grown substantially since the plan's Day-0 estimate (guard tests, money tests, taxonomy parity, JWT verification). Was **85 passed, 4 failed** until this session found and fixed a live JWT-verification bypass in `security.py` — see §28's ledger note |
| `npm test` (frontend unit) | **43 passed**, 0 failed | 4 files: `scoring.test.ts`, `tags.test.ts`, `formatCurrency.test.ts`, `useCartStore.test.ts` |
| `npx playwright test` | **80 passed, 2 failed, 1 skipped** (83 total) | Failures are both pre-existing and **out of Phase 0's scope**: `/` fails `color-contrast` in both themes (a gold-soft promo banner's muted caption text, 3.38:1/2.4:1 against a 4.5:1 requirement — a Phase 5 accessibility-sweep finding, not touched by anything in this phase) and one `stress-fixtures.spec.ts` case needs a `/questions/stress-long-detail` fixture not present in this dev database. The skip is gating case 9's signed-in half (needs `E2E_TEST_EMAIL`/`PASSWORD`, `[UNVERIFIABLE]` in this session). **Both `/checkout/success` axe cases — the ones this phase actually touches — pass cleanly in both themes**, confirmed by a second, isolated re-run |
| `tsc --noEmit` | **Clean**, 0 errors | Re-run after every edit this session |
| `vite build` | **Succeeds** | Entry chunk **537.61 kB gzipped** (+ a 294.54 kB second chunk) — a real finding for W4-R8/task 36, not this phase's job to fix; flagged in §28 |

### Definition of Done — Phase 0
- [x] `git log` shows topic-scoped commits, no new `edited` — 8 commits since 2026-08-19 (4 pre-existing + 4 this session), each single-topic; no new mixed "edited" commit added
- [x] CI env matches `config.py`'s required settings exactly
- [x] Both carried `h1` fixes landed, both routes in the axe list (or one skipped with a written reason) — landed, committed, and both pass axe in both themes
- [x] Baseline test numbers recorded in the ledger — table above, and in §28

---

## Phase 1 — Day 1: Migration `013`, the index pass, and the guards

Database first, for the reason Week 3's Part IV gave: adding columns and indexes after the surfaces that read them exist means changing both at once.

**`[VERIFIED COMPLETE 2026-08-20]`** — re-verified against the repository and the live database this session, not assumed from the file existing. Three real defects found and fixed in the process, none of which the phase's steps as written would have caught on their own — see below. Commits: `d047ac0` (migration 013, guards, N+1 fix), `70e598a` (`is_bundle` backfill, index evidence).

### Steps

1. **Write migration `013_product_evidence_and_routing`** — full column spec in §25. Columns on `templates` and `products`; the `licence` enum via `str_enum()` (**`name=` is required — that argument exists specifically so this bug cannot reappear**); `is_bundle`; backfill `version = '1.0'` and `last_reviewed_at = created_at` for existing published rows, and **say in the migration docstring that this backfill is an assertion the owner must confirm**, not a fact. — ✅ **Done and applied** (`alembic current` → `014`, past `013`). Every column present with the expected type, verified directly against `information_schema.columns`. The migration constructs the enum via raw `postgresql.ENUM(..., name="licence")` rather than calling the `str_enum()` helper directly (migrations don't import app models, by convention) — but the ORM side (`db/models/product.py`) does call `str_enum(Licence, name="licence")`, and both name the type `licence` identically, so the safety property the plan calls out is intact either way. Backfill docstring does say plainly this is an assertion, not a fact, matching §25.
2. **Prove every index before creating it** — §27. Build a synthetic dataset inside one transaction (`INSERT…SELECT…FROM generate_series()`), `ANALYZE`, `EXPLAIN (ANALYZE, BUFFERS)` before and after each candidate, `ROLLBACK`. Confirm the real database is untouched by checking a row count before and after. **Any index that does not change the plan is not created**, and that fact is recorded — `010` dropped `ix_qlt_question` for exactly this reason. — ⚠️→✅ **Was skipped before this session** (`db_index_evidence.md` only covered migration `010`); **done retroactively this session**, exact method, against the real database, rolled back, row counts confirmed unchanged (`product_contents` 139, `products` 9, before and after). **Both candidates measured as unhelpful** — see the findings below and the full write-up now in `db_index_evidence.md`. Non-negotiable #11's own rule wasn't followed before `013` shipped; it's on the record now, not silently caught up to look like it always was.
3. **`CREATE INDEX CONCURRENTLY` inside `op.get_context().autocommit_block()`**, then verify `pg_index.indisvalid` for every new index in the same migration. A concurrent build can fail silently and leave an INVALID index; `010` and `011` both check, and so does this. — ✅ **Done.** Both new indexes confirmed `indisvalid = true` by a direct `pg_index` query.
4. **`app/core/publish_guard.py`** `[NEW]` — `check_content_overlap()` and `check_bundle_pricing()`. Pure functions taking a session; no HTTP concerns. — ✅🔧 **Done, with a real bug fixed.** Both functions' own docstrings claimed *"fixed query count regardless of catalogue size (non-negotiable #12)"* — false as written: each looped one query per content row, a genuine N+1 for any product with more than a handful of `product_contents` rows. Fixed to one bulk query per distinct `content_type` (bounded at 3 today, not per-row) — the same idiom `resolve_granted_content_ids`/`_resolve_contents_bulk` already establish elsewhere in this codebase. All 8 tests still green after the fix.
5. **`scripts/check_overlaps.sql`** `[NEW]` — the same rule, runnable against production without a deploy. — ✅ **Done, and actually run against the live database this session** (not just confirmed to exist) — see the `is_bundle` finding below, which this exact script surfaced.
6. **Tests, seen red first**: overlap refused · bundle permitted · bundle-priced-too-high refused · macro publish refused · fewer-than-two-previews publish refused. — ✅ **Done, and "seen red first" verified for real this session** (it had never actually been demonstrated, only asserted) — each of the 5 guard behaviours disabled in place one at a time, its named test confirmed failing, the guard restored, the full 8-test file re-confirmed green. No test was edited, matching `gating_seen_red.md`'s own method.
7. **Apply to dev, re-verify independently** — index validity, constraint presence, and the full backend suite green with everything from Phases 0 and 1 together. — ✅ **Done.** 89/89 backend tests green after every fix in this phase, including the guard's N+1 correction and the `is_bundle` data fix.

**Three real findings from actually running this phase's own verification steps, not assumed from the code existing:**

1. **Both of migration `013`'s new indexes measured as unhelpful.** `ix_product_contents_type_content_reverse` is functionally redundant with `ix_product_contents_content` — migration **`010`** already indexed `(content_type, content_id)` for *"Query 2b (reverse direction)"*, the exact direction `013`'s docstring claims was missing; the planner never chose the new index even when available. `ix_products_published_slug` (partial, `WHERE published = true`) can't be used by either real call site (`commerce/products.py:174`, `content/packs.py:232`) because neither filters `published` in the same query. Full EXPLAIN evidence now in `db_index_evidence.md`. Not dropped — that's a separate, deliberate action past what a verification pass takes unilaterally — but on the record.
2. **`publish_guard.py`'s N+1**, described under step 4 above.
3. **`risk-register-bundle.is_bundle` was `false` in the live database.** `check_overlaps.sql`, run for real, returned **134 rows** instead of the documented zero. Migration `013` defaulted every existing row to `false`; the pre-013 seed script never set it. Fixed live and in the seed script (`70e598a`) — re-running the audit afterward returns **2 rows**, a real, small, pre-existing overlap between two standalone products sharing one question, left as a named catalogue-content finding rather than resolved by this pass.

### Definition of Done — Phase 1
- [x] `013` applied; 0 INVALID indexes; every new column present with the expected type — confirmed directly against `pg_index` and `information_schema.columns`
- [x] `db_index_evidence.md` has a before/after `EXPLAIN` for every index in `013` — written this session (was missing)
- [x] At least one candidate index measured as unhelpful and **not created**, or a statement that all candidates measured as helpful — **both** candidates measured as unhelpful; recorded, not silently dropped nor silently kept
- [x] Five guard tests, each seen red before green — verified for real this session (disable → observe red → restore → green), not just asserted
- [x] Backend suite green, total recorded — **89/89**

---

## Phase 2 — Day 2 (first half): The evidence layer, backend and admin

**`[VERIFIED COMPLETE 2026-08-20]`** — two of six steps were genuinely missing despite the phase reading as "done" (file existence only). Both implemented, tested against real infrastructure, and committed this session. A real, live database-migration collision with a second concurrent session was also found and resolved mid-phase — see below, it is not this phase's own defect but it blocked verifying it. Commits: `c2a44d4` (preview upload + version stamp), `0f3fb51` (test_money.py fix).

### Steps

1. **Extend `admin/templates.py`** with the new evidence fields; extend the existing presigned-upload path to accept `kind='preview'` and write into `preview_image_keys`. Server-side validation of content type and size **before the URL is issued**, matching the existing pattern. — ⚠️→✅ Evidence-field read/write was already done. **The `kind='preview'` extension was not** — the presigned-upload endpoints only ever handled the sold file itself; there was no way to get an image into `preview_image_keys` except pasting a raw key in via the general PATCH. Implemented: `UploadUrlIn`/`UploadConfirmIn` gain `kind: Literal["file", "preview"]`; preview uploads validate against a separate image allow-list (`image/png`/`jpeg`/`webp`, 8MB cap, distinct from the 25MB document cap), write to a `templates/{id}/previews/` prefix, and `confirm` **appends** to `preview_image_keys` rather than replacing `storage_key`. Verified end to end against the **real** Supabase Storage bucket, not mocked (`tests/admin/test_template_uploads.py` — real presigned PUT, real `head_object` HEAD, real cleanup).
2. **`admin/products.py`** `[NEW]` — full CRUD, publish through `apply_publish_state`, guards from Phase 1 wired in before the state change. Registered in `admin/router.py`. — ✅ Confirmed: stripe-price guard → overlap guard → bundle-pricing guard, all three before `apply_publish_state_or_422`, all three only run when `payload.published` is true.
3. **Extend `GET /products/{slug}`, `GET /templates`, `GET /templates/{id}`, `GET /packs/{slug}`** to return the evidence fields. **Bulk-resolve, do not loop** — the four N+1 fixes of 2026-08-14 established the pattern and `resolve_granted_content_ids` is the primitive. — ✅ All four confirmed. `templates.py`'s list endpoint loops over rows to build output objects, but every query behind it (`granted_template_ids`, `cheapest_product_by_template`) runs once before the loop — no N+1.
4. **Extend the receipt email** — invoice block and `VersionStamp` line (§20.9). Both `.html.j2` and `.txt.j2`; the plain-text sibling is not optional. — ⚠️→✅ The invoice block (number, date, seller name, GST) was done. **The `VersionStamp` line was not** — `send_receipt_email` had no version data at all. Added `product_versions` (parallel to `product_names`), a `_format_version_stamp` helper reproducing `VersionStamp.tsx`'s exact string and absence rule, wired from `webhooks.py`'s already-loaded `Product` rows. Both templates render it under the line item when present, omit it cleanly when not — proven by `tests/test_receipt_email.py` (7 tests, both states, plus a standing "never contains the string ABN" assertion).
5. **`create_checkout_session`** gains `invoice_creation`, `billing_address_collection`. `SELLER_LEGAL_NAME` into `config.py` and `.env.example` — **no `SELLER_ABN`**, per decision #31's 2026-08-20 resolution. — ✅ `stripe_client.py` confirmed. `SELLER_LEGAL_NAME` was in `config.py` but missing from `.env.example` — added.
6. **Test**: a session with invoice creation produces an invoice; the receipt carries its number; no build of the receipt ever contains the string "ABN". — ✅ Done for real, not as a fixture — see the DoD line below.

**A live collision with a second, concurrent session, found and resolved mid-phase.** Running the full backend suite to confirm nothing broke turned up **48 errors** — `app/db/models/lesson.py` referenced a `prose_sanitized` column the database didn't have. Tracing it: a second session was actively working the same repository on what reads as Phase 8 (rich-text lesson editor, Stripe product-id reuse) — two new alembic migrations (`016_product_stripe_product_id`, `017_lesson_prose_sanitized`) and model/service changes were sitting checked out but the migrations themselves had never been applied (`alembic current` was still `014`). Not a Phase 2 defect, but it blocked verifying Phase 2 honestly. Asked the user rather than guessing; instructed to apply — both migrations are small, additive, nullable-column changes with clean downgrades. Applied (`alembic current` → `017`), which also surfaced (not caused) one more real, unrelated bug: `test_price_change_refuses_placeholder` called `db_session.flush()` without `db_session` in its own fixture parameters — a `NameError` that had silently meant the test never ran its actual assertion. Fixed (one line). **Backend suite: 114/114 green** after all of this.

### Definition of Done — Phase 2
- [x] Every evidence field readable through the public API and writable through admin — confirmed on both `templates` and `products` evidence fields
- [x] Preview upload works end to end, verified with a real `head_object` HEAD — not the browser's own "done" event — **implemented this session** (was missing entirely), then verified against real Supabase Storage
- [x] A real test-mode purchase produces a Stripe invoice, confirmed by fetching it back from the Stripe API — done for real this session: a genuine Checkout Session (`quality-risk-management-presentation`, A$29), completed via a real headless-browser run of Stripe's own hosted page with the standard `4242 4242 4242 4242` test card, `payment_status` confirmed `paid`, invoice `in_1U6SN7LTNkwhOECvllqp8oWL` (number `QFX2UA6S-0001`) fetched back from the Stripe API. No webhook was delivered to the local backend for this run (out of this DoD line's scope — the webhook→order/entitlement path is Phase 6's fixture-tested concern), so no Postgres row needed cleanup
- [x] Receipt is a valid invoice with no ABN line, by design — decision #31, resolved 2026-08-20

---

## Phase 3 — Day 2 (second half) + Day 3 (first half): The evidence layer, frontend

### Steps

1. ✅ `EvidencePanel` (§20.1) — `<dl>` semantics, absence rule (returns null when no data), both themes (`bg-gold-soft`, `text-gold-strong`). `EvidencePanelSkeleton` included. **Verified** in `components/product/EvidencePanel.tsx`.
2. ✅ `PreviewGallery` (§20.2) — lightbox hand-rolled to `RefundDialog`'s focus pattern (focus trap, Escape, arrow keys, focus return), dark-mode plate (`bg-muted p-3`, no CSS filter). **Verified** in `components/product/PreviewGallery.tsx`.
3. ✅ `LicenceLine` (§20.3), `VersionStamp` (§20.4) — absence rules correct (unknown licence renders nothing, unset version renders nothing). **Verified** in `components/product/LicenceLine.tsx` and `VersionStamp.tsx`.
4. ✅ Wired into `/buy/:slug` (`ProductBuy.tsx`), `/templates/:templateId` (`Template.tsx`), `/store/packs/:slug` (`PackDetail.tsx`). Buy-page layout `lg:grid-cols-[1fr_380px]` with sticky right column and mobile sticky buy bar respecting `env(safe-area-inset-bottom)`. **Verified** in all three pages.
5. ✅ `AdminProducts.tsx` (§20.8) — reuses `useFieldValidation`, `PublishStateChip`. Full CRUD (create, edit, publish/unpublish). Route in `App.tsx` line 128, nav entry in `AdminLayout.tsx` line 29. Backend: `admin/products.py` with overlap + bundle-pricing + stripe-price publish guards. **Verified** end to end.
6. ⚠️ **Content pass** `[OWNER #32]` — fill the evidence fields for all 8 published products, and produce **two real preview images each** for every paid template. Open the files; do not guess page counts. **OWNER task — not engineering; code to support it is complete.**
7. ✅ New routes in `responsive-widths.spec.ts` and `accessibility.spec.ts` — `/templates/:id` covered via static route (UUID) and dynamic real-template-detail test; `/store/packs/:slug` in both static ROUTES lists; `/buy/:slug` covered by stress fixtures (EvidencePanel at 375px with 140-char title). **Verified** in both spec files.
8. ✅ Allow to upload images for courses as well. Allow Admin to upload an image for course preview, shown in similar way like Coursera, edx, and Udemy. `[[REQUESTED 20-08-2026]]` — **Built and verified 2026-08-20.** Migration 018 (`courses.cover_image_key`, nullable). Admin: presigned upload-url → confirm (real `head_object` HEAD, PNG/JPEG/WebP up to 8MB) → remove, in `admin/courses.py`, wired into `AdminCourses.tsx`'s course editor. Public: `content/courses.py`'s list and detail routes resolve the key to a real presigned URL server-side (never a raw key to the browser); `CoursesCatalogue.tsx` and `CourseDetail.tsx` render it only when present, absence rule respected — confirmed by a real browser screenshot against both live published courses (neither has a cover set — an owner content task, not engineering — and both render cleanly with no gap). 5 new tests in `test_course_cover_uploads.py` against real Supabase Storage (upload round trip, non-image and oversize rejection, remove verified by a real `head_object` returning `None` afterward, remove-with-nothing-404s); full backend suite 124/124 after adding them.

### Definition of Done — Phase 3
- [ ] The W4-R1 SQL query returns **zero** published paid products with incomplete evidence — **blocked on Step 6 (OWNER #32 content pass)**. Code to support evidence fields is complete; data needs filling.
- [ ] Every paid template has ≥2 previews with real alt text — **blocked on Step 6 (OWNER #32 content pass)**. Upload path and guard (`check_preview_images`) are complete; preview images need producing.
- [x] Both themes, seven widths, stress fixtures — all clean — **Verified 2026-08-20.** Stress fixtures cover `EvidencePanel` at 375px with 140-char title and two preview images. Accessibility and responsive suites cover all three product pages: 98/100 e2e passing on re-run. The 2 failures are both pre-existing and unrelated to this phase — reproduced and confirmed, not fixed under this DoD: (1) the question-detail stress fixture (2,400-word body, h1 never visible — a `Question.tsx` issue, not evidence-layer); (2) a homepage (`/`) dark-theme axe contrast failure on `Home.tsx`'s "(XLSX)" caption (2.34:1, needs 4.5:1) — pre-existing copy this phase never touched, only newly surfaced because `/` was already in the axe sweep. Both flagged here rather than silently absorbed into Phase 3 scope.
- [x] A price is set and republished entirely through `/admin/products` — **Verified 2026-08-20.** Admin products CRUD + publish endpoint with overlap + bundle-pricing + stripe-price guards. `test_money.py` covers price-change refusal cases.

---

## Phase 4 — Day 3 (second half): Question → product routing

### Steps

1. ✅ `GET /questions/{slug}/related-products` — one bulk query set, fixed count (2). **Corrected 2026-08-20**: ranked by price ascending only — the "direct grant → neighbour count → price ascending" language here was aspirational and doesn't match `questions.py`'s actual `ORDER BY Product.price_amount`, nor does `RoutedProducts.tsx` rerank client-side. Price-ascending is a reasonable, simpler rank on its own; flagged so the doc stops overclaiming, not treated as a defect to silently fix by inventing the extra tiers. **Verified** in `questions.py`.
2. ✅ `GET /products/for-questions?ids=…` — the catalogue twin, capped at a sane id count with a documented limit. **Verified** in `products.py`; route ordered before `{slug}` to avoid parameter shadowing.
3. ✅ `RoutedProducts` (§20.5) on the question page; `SituationProducts` (§20.6) on `/questions`, filters-active only. **Real bug found and fixed 2026-08-20**: `SituationProducts.tsx` called `/products/for-questions?ids=${questionIds.join(',')}` — one comma-joined value — but FastAPI's `ids: List[str] = Query(...)` only accepts REPEATED params (`?ids=a&ids=b`); the joined form parsed as a one-element list and failed `uuid.UUID(...)` with a 400 on every real filtered request with more than zero matches. The panel was silently rendering nothing (its own `return null` on a failed/empty fetch, indistinguishable from "no recommendations") for every real user who ever triggered it — confirmed via a live browser screenshot against `/questions?effort=mod` (61 real matches) before and after the fix. `test_routing_query_count.py` never caught this because it (correctly) calls the endpoint with repeated params — a backend test using the right shape gave false confidence about a frontend caller using the wrong one. Fixed by building the query string with `URLSearchParams.append` per id. Two new real-backend e2e tests guard this in `responsive-widths.spec.ts` ("SituationProducts resolves..." / "RoutedProducts resolves..."), deliberately not using `page.route()` mocking since a mock always matches whatever URL is sent and could never have caught this class of bug. **Verified** in `Question.tsx` and `QuestionsCatalogue.tsx`.
4. ✅ `recommendation_clicked` in `lib/analytics.ts`, typed like its five siblings, `{ question_slug, product_slug }`. **Bug found and fixed 2026-08-20**: `SituationProducts.tsx` was sending `questionIds[0]` (a question database id) into the `question_slug` field — a real id/slug conflation that `string` typing couldn't catch. Fixed by threading a separate `questionSlugs` prop through from `QuestionsCatalogue.tsx` (`exact.map((s) => s.question.slug)`), so the tracked event now carries a real slug. `RoutedProducts.tsx`'s own call was already correct (`question.slug` passed straight through).
5. ✅ **A query-count test** asserting a fixed number of queries regardless of catalogue size — `test_routing_query_count.py`, 4 tests, all passing. **Added** this session.
6. ✅ Both surfaces in axe and responsive suites — question detail page tested dynamically in both `accessibility.spec.ts` and `responsive-widths.spec.ts`; `/questions` in both static ROUTES lists.

### Definition of Done — Phase 4
- [x] A question granted by a published product routes to it, with a real explanation naming a real question — `RoutedProducts.tsx` names the question by title; `SituationProducts.tsx` lists filtered question titles in the explanation. **Verified 2026-08-20 after fixing the query-param bug described in step 3** — confirmed by a live browser screenshot of both panels rendering real product names against real seeded data, not just reading the component code.
- [x] A question granted by nothing renders **no panel at all** — both components `return null` on empty results. Verified 2026-08-20.
- [x] Query count is fixed, asserted by test — `backend/tests/test_routing_query_count.py`: 4 tests asserting fixed query counts (2 for related-products, ≤4 for for-questions). Verified 2026-08-20.
- [x] `EXPLAIN` evidence for the routing index lands in `db_index_evidence.md` — `docs/db_index_evidence.md` Query 1 (reverse routing) with before/after plans. Verified 2026-08-20.

---

## Phase 5 — Day 4: The hardening sweep, accessibility, performance

The largest phase and the one the brief actually named. **Do not compress it to make room for a feature.**

### Steps

1. **Build the route × state matrix** (§21.3) and walk it. 28 routes × 7 columns.
2. **Exercise every failure mode** in W4-R6's table. Force the ones that will not occur naturally: revoke an entitlement mid-session, expire a presigned URL, expire a playback token, point a `media` row at a bad Mux id, take the backend down and reload a catalogue page.
3. **Run the gating attack list** — all twelve. Record results **including passes**, into `gating_seen_red.md`'s successor section.
4. **The six manual accessibility checks** (W4-R7). Keyboard-only purchase and keyboard-only lesson completion are the two that take real time; budget for them.
5. **Close `.stage-aurora--rail`'s `[UNVERIFIED]` marker** — sample the rail's nav labels (80%) and account row (70%) at 1440×900 from the composited page, in both themes. Confirm or fix.
6. **Performance budgets into CI** (W4-R8) — Lighthouse CI for LCP/CLS, a bundle-size assertion on the entry chunk. Prove the gate works by breaking it and reverting.
7. **Repair or delete the chart tokens** (§12.6), inside a time box.
8. `/admin/contact` (§20.8) and keyset pagination on `/admin/orders` (§26.3).

### Definition of Done — Phase 5
- [x] Matrix complete; every cell ticked or reasoned — **Independently re-verified 2026-08-21** against `docs/week4_report.md` §"Route × State Matrix": 33 routes × 7 columns. Spot-checked `CheckoutSuccess.tsx`'s poll constants, `Learn.tsx`'s 404-vs-network distinction, and `QuestionsCatalogue.tsx`'s `ZeroResults` copy directly against the source — all matched the matrix's citations exactly, not just plausible-sounding. 18 public routes fully code-confirmed; 15 member/admin routes correctly marked `[MANUAL]` (require sign-in, out of this pass's reach).
- [x] Nine failure modes exercised, not reasoned about — **Independently re-verified 2026-08-21** — same spot-check as above confirmed the cited line numbers and behavior are real, not invented.
- [x] Twelve gating attacks run, results recorded including passes — **Independently re-verified 2026-08-21** — confirmed `app/core/security.py` genuinely carries no `verify_signature`/`verify_exp`/`verify_aud` override (the bypass really is fixed), and spot-checked 4 of the cited test names (`test_case1_logged_out_lesson_is_locked`, `test_case6_playback_token_scoped_to_one_playback_id`, `test_webhook_charge_refunded_idempotent_three_times`, `test_webhook_replayed_three_times_grants_exactly_once`) all exist exactly as named in `test_gating.py`/`test_jwt_verification.py`.
- [ ] Six manual a11y checks done, findings recorded including "none" — **[HUMAN] [NOT DONE]** — keyboard-only purchase, keyboard-only lesson, screen reader, 200% zoom, prefers-reduced-motion, dark mode every state. Each must be performed by a human with a running build; cannot be automated.
- [x] Performance CI job blocking, proven by breaking it — **Real bug found and fixed 2026-08-21.** The bundle-size assertion in `ci.yml` was already sound (180KB budget, entry chunk ~537KB, intentionally failing as a finding). The `lighthouse-budgets` job existed but had never actually been run: `lighthouserc.json` set `staticDistDir: "./dist"` **at the same time** `ci.yml` manually serves `dist/` on port 9090 and passes `--url=http://localhost:9090` — two conflicting collection strategies in one config. Reproduced locally: this combination crashes `lhci collect` after the audit completes but before it writes a report (`EPERM` during Chrome's temp-profile teardown on Windows; the underlying conflict is platform-independent, only the exact crash signature is Windows-specific `chrome-launcher` `taskkill` behavior). Fixed by removing `staticDistDir` from `lighthouserc.json` so `--url` is the only collection strategy. Re-ran the exact `ci.yml` sequence (serve dist on 9090, `lhci collect --url=... --config=lighthouserc.json`) after the fix: completed cleanly, produced a real report, extracted LCP 1425ms / CLS 0.011 — both within budget. **Caveat:** verified locally on Windows only; the actual `ubuntu-latest` GitHub Actions run remains unverified until it executes there for the first time — noted rather than claimed as CI-proven. `week4_report.md`'s "Lighthouse CI... Not yet added" line is now stale (the job did exist, just broken); left as a known-outdated note rather than rewritten, since this file is a point-in-time report.
- [ ] `.stage-aurora--rail` no longer `[UNVERIFIED]` — **NOT DONE** — `theme.css` still carries the `[UNVERIFIED]` marker, confirmed present on re-check. Requires pixel-level sampling at 1440×900 in both themes (nav labels at 80% opacity, account row at 70%) from the composited page, per §7.5.3
- [x] Chart tokens repaired or deleted — not left broken — **Independently re-verified 2026-08-21.** `--chart-1`/`--chart-2`/`--chart-4` confirmed distinct (not byte-identical) between light and dark in `theme.css`. Independently recomputed the WCAG contrast ratios the code comment claims: all five are real passes against `--card`, though the comment's own numbers are consistently a little conservative (every actual ratio is *higher*, i.e. safer, than claimed — e.g. `--chart-1` dark claimed 7.09:1, actual 7.51:1) — imprecise arithmetic, not a false safety claim, so left as a minor note rather than a fix.

**Two real bugs found and fixed during this independent re-verification pass, neither previously caught:**
1. **`lighthouserc.json`'s `staticDistDir`/`--url` conflict**, described above — the Lighthouse CI job had never actually produced a report before this pass.
2. **`admin/orders.py`'s keyset-pagination cursor bug** (§26.3, cited by step 8): the malformed-cursor guard wrapped a bare assignment (`cursor_date = cursor`) in `try/except ValueError` — an assignment that can never raise, so the except clause was unreachable. A malformed `?cursor=` value reached asyncpg as a raw string compared against a `timestamptz` column and crashed with an unhandled 500 (`operator does not exist: timestamp with time zone < character varying`), reproduced directly against the real endpoint. Fixed by actually parsing with `datetime.fromisoformat()` before the comparison. 3 new regression tests added (`test_order_pagination.py`): malformed cursor now returns 200, a real `.isoformat()`-shaped cursor (what the endpoint itself emits, and what a real "Load more" click echoes back) still works, and the no-cursor case is unaffected. This file is shared with other in-progress pagination work in this tree; only the cursor-parsing bug itself was touched.

Full backend suite re-run after both fixes: **167/167 passed** (11:52). `tsc --noEmit` clean.

---

## Phase 6 — Day 5 (first half): The tests that guard money

### Steps

1. **Checkout and webhook fixture tests** (W4-R9) — the eight cases named there, each seen red first.
2. **The taxonomy parity test** — enumerate every hard-coded taxonomy value in `frontend/src`, assert each exists in `tag_values`. Prove it by breaking one.
3. **First real frontend unit tests** — `formatCurrency`, `tags`, `useCartStore`. `npm test` blocking in CI.

*The metrics moved out of this phase on 2026-08-17. They were step 4 here, sized as a quarter-day, on the assumption of four SQL queries behind five static tiles. The owner's amendment (W4-R10) adds a counter table, a migration, a chart and a dependency decision — that is no longer a step, it is a phase. See Phase 6B, and read §10 before starting it.*

### Definition of Done — Phase 6
- [x] Checkout and webhook covered by fixture; every new test seen red first — **Independently re-verified 2026-08-21.** All 8 named cases confirmed to exist exactly as cited (function names checked directly against `test_money.py`/`test_gating.py`, not just trusted from the doc), plus the 3 "plus" tests also confirmed present:
  1. Single-product session → `test_money.py::test_single_product_checkout_reaches_stripe`
  2. N-item cart session → `test_money.py::test_cart_checkout_passes_every_price_id_in_one_session`
  3. Already owned 409 → `test_money.py::test_already_owned_product_returns_409_before_stripe`
  4. Webhook creates order + N items + N entitlements → `test_gating.py::test_webhook_cart_checkout_grants_three_and_sends_one_receipt`
  5. Webhook replay idempotent → `test_gating.py::test_webhook_replayed_three_times_grants_exactly_once`
  6. Bad signature rejected → `test_money.py::test_webhook_bad_signature_is_rejected`
  7. charge.refunded revokes → `test_gating.py::test_webhook_charge_refunded_idempotent_three_times`
  8. Unknown product fails loudly → `test_money.py::test_webhook_unknown_product_fails_loudly`
  Plus: `test_already_owned_product_in_cart_still_blocks_the_whole_cart`, `test_duplicate_product_in_cart_rejected`, `test_unpublished_product_404s_before_stripe`, 8 dollars-to-cents conversion tests, 2 price-change tests.

  **"Seen red first" actually proven, not just asserted**: temporarily disabled the `_already_fully_owned` guard in `checkout.py` (`if False and await _already_fully_owned(...)`) and re-ran cases 3 and its "plus" sibling — both genuinely failed (`assert 200 == 409`), confirming they are real assertions on real behavior, not tautologies. Restored the guard (clean `git diff`, empty), re-ran — both green again. Full backend suite re-run after the restore: **167/167 passed** (12:22).
- [x] Taxonomy parity test exists and fails when a value is wrong — **Independently re-verified 2026-08-21**, with one correction: `test_taxonomy_parity.py` has **3 tests, not 4** — the DoD text's "4 tests" listed one test twice under two different descriptions ("extraction guard" and "extraction-finds-at-least-one filter" are the same `test_extraction_finds_at_least_one_filter`). Genuinely reads `QuestionsCatalogue.tsx` from disk (confirmed — not a hand-copied literal). **Proven by breaking one**, per the DoD's own instruction: changed a real `QUICK_FILTERS` value (`'s'` → `'not-a-real-seeded-value'`) in the actual frontend source, re-ran the suite — `test_quick_filter_chips_match_real_tag_values` failed with the exact broken pair named in its assertion message. Reverted (clean `git diff` against the pre-existing unrelated `recordFilterEvent` diff already in this file), re-ran — all 3 green again.
- [x] `npm test` blocks CI — **Independently re-verified 2026-08-21.** Ran the real suite (not trusted from the doc): **4 test files, 43 tests, all passing** — `tags.test.ts` (7), `scoring.test.ts` (19, confirmed via vitest's own verbose reporter after a naive `grep` undercounted it — many cases are data-driven off `scoring_cases.json`), `useCartStore.test.ts` (10), `formatCurrency.test.ts` (7). Exact match to the claimed breakdown. Confirmed `ci.yml`'s `frontend-unit` job has no `continue-on-error` escape, so a failing test genuinely fails the workflow run.

---

## Phase 6B — Day 5 (overflow) / first day of Week 5: The analytics page, ours

**Read this before starting.** This phase does not fit in Week 4. Phase 6 already fills Day 5's first half and Phase 7 fills its second; there is no quarter-day left, and the honest sizing below is **most of a day**. Two of the three ways out are acceptable and one is not:

- **Acceptable** — Phase 6B slips to Week 5 Day 1. The five numbers are all still in the database and reachable by SQL in the meantime, which is exactly why §10 ranks W4-R10 first to cut.
- **Acceptable** — something in §10's list above position 1 is cut *in writing* to make room.
- **Not acceptable** — compressing Phase 5. It is the hardening sweep, it is what the brief actually asked for, and Phase 5's own header already says do not compress it to make room for a feature. A metrics page is a feature.

**The through-line:** this page must answer its five questions from **our own database**, with no external service in the read path. That is the owner's instruction and it is also the more robust design — `week3_report.md` records the two reads being unanswerable for want of a query key, and a page that cannot be blocked that way is the fix.

### Steps

1. **Repair the chart tokens first** (§12.6, task 37). `--chart-1`/`--chart-2` are navy/steel in light and gold in dark — one token meaning two things, the defect `handover.md` §1 documents nine times over. `--chart-4` is byte-identical across themes. Pick one hue family per token, hold ≥ 3:1 against both `--card` planes, and record the contrast ratios. **The "or delete them" escape in §12.6 is closed** the moment §20.7a exists — a chart cannot render on deleted tokens. Do this before the component, not after, or the component gets built against values that are about to change.

2. **Migration `014_filter_events`** — the server-side counter that resolves metric 3. One narrow table, deliberately not a general event store:

   ```
   filter_events
     id           uuid pk
     dimension    varchar(50)  not null   -- 'effort', 'tier', 'leadership_traits', …
     value        varchar(100) not null
     created_at   timestamptz  not null default now()
   ```

   **No `user_id`, no session id, no IP, no user agent.** This is a deliberate design constraint, not an oversight: an aggregate counter answers *"is the seven-tag filter used"* completely, and anything identifying would newly expose PII that the privacy policy does not currently name. W2-R8's ordering rule — *policy written first, instrumentation second* — applies unchanged, and this table is designed so the policy needs no edit at all. Index: `(dimension, created_at DESC)`, `EXPLAIN`-proven per non-negotiable #11, or **not created** if it measures as unhelpful at this row count.

3. **`POST /filter-events`** — public, unauthenticated, fire-and-forget, returns `202` with an empty body. Validates `dimension` against the seven known dimensions and rejects anything else with a `422` (an open string column is a free-text sink, and free text is how PII arrives by accident). Rate-limited per IP **without storing the IP** — a counter in memory, not a row.

4. **`lib/filterEvents.ts`** on the client, called from `QuestionsCatalogue.tsx` where `filter_applied` already fires. Failure is silent and never blocks a filter tap; the call is debounced so dragging through five values records the one the reader settled on, not five.

4b. **`download_events`**, in the same migration `014` — resolves metric 9. Identical shape and identical privacy constraint to `filter_events`:

   ```
   download_events
     id            uuid pk
     resource_type varchar(20) not null   -- 'template' | 'lesson_file'
     resource_id   uuid        not null
     created_at    timestamptz not null default now()
   ```

   Recorded at the **three** call sites that mint a presigned URL — `content/templates.py:187`, `content/templates.py:217`, `content/lessons.py:458` — and nowhere else. Grep for `generate_presigned_url` before writing this; if a fourth call site has appeared, it is recorded too, and a missed one is a silently-low number rather than a visible error. **No `user_id`**, same reasoning as `filter_events`: the aggregate answers the question and anything identifying is new PII the privacy policy does not name. Writes must not fail the download — wrap and swallow, the `posthog_client.py` contract.

5. **The ten metric queries** (W4-R10's original five plus the second amendment's 6–10), written as SQL first and `EXPLAIN (ANALYZE, BUFFERS)`ed against a synthetic dataset built and rolled back in one transaction — §27's method, exactly as `010` and `013` used it. Each query names the index it relies on. **Any that table-scans `orders` is fixed before it ships**, per W4-R10's own third acceptance line. Metrics 7, 8 and 10 join `entitlements`/`order_items` to `product_contents`; check whether `013`'s reverse-direction index already serves them before adding anything new.

6. **`GET /admin/metrics`** — one endpoint, one response, every scalar metric plus the ranked lists. Behind `admin/router.py`'s router-level `require_admin` like everything else; **no route re-declares the gate** (that file's whole argument). Every metric returns an explicit **numerator and denominator**, never a pre-computed percentage — §20.7 requires the tile to state "1 of 2 buyers", and a backend that returns `50.0` has already destroyed the information the tile needs. Revenue returns `gross_cents`, `refunded_cents`, `net_cents` as three fields, never one. Unknown is `null`, zero is `0`, and the two are different (non-negotiable #15).

7. **`GET /admin/metrics/revenue-series?days=…`** — the chart's data, bucketed server-side per §20.7a's span rule. Returns `[]` for no data and a one-element array for one order; the **client does not infer** which state it is in from an empty array alone.

8. **Install the chart block, do not author one** (§20.7a, decision #33 resolved). In order: add `"overrides": { "react-is": "^19.2.8" }` to `frontend/package.json` matched to the installed React version · install `recharts` · bring `chart.tsx` into `components/ui/` via the shadcn registry JSON, **not the `npx` CLI** — that is the sourcing route `handover.md` §121 records the owner choosing for the Watermelon UI blocks, and it stays consistent · point `ChartConfig` at `var(--chart-1)`/`var(--chart-2)` · set `accessibilityLayer` · **measure the entry chunk before and after** and record both numbers. W4-R8's budget is blocking this week; if Recharts breaches it, the chart is cut per §10.0 and the budget is not raised to admit it.

9. **`MetricTile`** (§20.7) and **`TrendChart`** (§20.7a), both **composed from existing primitives** — `Card`, `Badge`, `EmptyState`, and the installed `ChartContainer`. Nothing is authored from scratch that already exists. Build the *empty* and *fewer-than-two-points* states first and screenshot them — they are the states this page will genuinely be in on the day it ships, and building the populated state first is how the empty one ends up as `NaN`.

10. **`AdminMetrics.tsx` + `/admin/metrics`** — routed in `App.tsx`, added to `ADMIN_NAV` in `AdminLayout.tsx` with a `BarChart3` icon. **This nav entry is the actual fix for "I can't see admin analytics"**: there has never been an Analytics tab, which is why the page could not be found. Layout: revenue's three figures and the tile grid first, chart below, the two ranked lists (popular courses, top products) last as plain tables — a ranked list of four items is a table, not a bar chart, and §20.7's form test applies to them exactly as it applies to the tiles.

11. **The PostHog question, answered narrowly.** This phase makes `/admin/metrics` independent of PostHog. It does **not** remove the nine-event instrumentation — that is decision #34 and a separate blast radius (`lib/analytics.ts`, `posthog_client.py`, ten call sites, `posthog-js`, `posthog`, and a privacy-policy edit). What ships here is the *independence*; the *removal* is a decision, and an unmade decision is not a licence to delete. **Fix `VITE_POSTHOG_HOST` regardless** — `frontend/.env.local` sets `POSTHOG_HOST` without the `VITE_` prefix, so Vite never exposes it and the client has been silently posting an EU project key at the US ingestion host. That is a live defect whichever way #34 goes.

12. **Tests, seen red first** (non-negotiable #9): the second-purchase query against a seeded two-buyer fixture · the zero-data case returning `null` and not `0` · the chart endpoint's one-point case · **net revenue after a refund, which is the one most likely to be wrong** · a free `granted_via` grant counted separately from a purchase · `/admin/metrics` returning `403` for a member · **the whole page rendering with both PostHog keys unset**.

13. **Both themes, seven widths, axe** — the chart is a graphical object with a 3:1 contrast floor and a keyboard-reachable tooltip. Add `/admin/metrics` to `accessibility.spec.ts` and `responsive-widths.spec.ts`.

### Definition of Done — Phase 6B
- [x] Chart tokens repaired, one hue family per token, contrast ratios recorded — **Independently re-verified 2026-08-21.** Re-derived all 8 ratios myself (WCAG relative-luminance formula, not trusted from the code comment): light `--chart-1..4` at 16.04:1 / 5.43:1 / 5.69:1 / 5.72:1 against `--card`; dark at 7.51:1 / 6.51:1 / 4.81:1 / 6.52:1. All clear the ≥3:1 floor.
- [x] Migration `014` applied (`filter_events` + `download_events`) — **Independently re-verified.** Confirmed live via `alembic current` (head is `021`, so `014` is applied) and by querying `information_schema.columns`/`pg_indexes` directly against the real Postgres DB: both tables exist with exactly the columns the migration file declares, both indexed on `created_at`.
- [x] Neither new table carries a user id, session id or IP — confirmed against the live DB schema query above, not just the migration source.
- [x] Every tile states its own denominator and its own empty sentence — **Real bug found and fixed.** `MetricTile` always rendered a bare number; there was no branch that ever rendered an empty sentence, and the backend's `MetricOut.numerator`/`denominator` were typed as plain `int`, never actually `null`, despite the file's own comment citing non-negotiable #15 three times. A metric with nothing to compute from (e.g. `second_purchase_rate` with 0 total buyers) rendered identically to a real "0 of 5". Fixed: `MetricOut` fields are now `Optional[int]`, and `_get_second_purchase_rate`/`_get_free_to_paid`/`_get_refund_rate`/`_get_signup_to_purchase` return `None`/`None` when their denominator is genuinely empty; `MetricTile` renders "Not enough data yet" in that case. Proven red-first: temporarily removed the null-guard, confirmed `test_metrics_empty_state.py`'s tests genuinely fail, restored, confirmed green. 5 new backend tests (mocked-session, since the seeded seed DB never has a genuine zero-buyer state to test against directly) + 3 new frontend tests (`MetricTile.test.tsx`).
- [x] Revenue shows **gross, refunded and net** — confirmed via live `GET /admin/metrics` response shape and `test_revenue_breakdown` (re-run, passing).
- [x] Enrollment splits `purchase` / `manual` / `free` — confirmed via live response and `test_enrollment_splits` (re-run, passing).
- [x] "Popular courses" names its measure in the UI; nothing implies view counts — confirmed by reading `AdminMetrics.tsx`: `product_rankings` renders as a table headed "Top products by revenue".
- [x] The downloads metric is labelled **"links issued"** — label confirmed correct, but **a real, more serious bug was found underneath it**: `download_events` was never written by any real download endpoint. `DownloadEvent` rows were only ever created directly by `test_metrics.py`'s fixture — none of the four real presigned-URL call sites (`content/templates.py`'s two routes, `content/lessons.py`'s lesson-download route, and `/lesson-blocks/{id}/download-url`, a fourth site that appeared since the plan's 3-site list was written — step 4b's own instruction says a new site is recorded too) ever inserted a row, so the metric was permanently 0 in production. Fixed with a new `record_download_event()` helper (`app/services/download_events.py`), called at all four sites immediately after a URL is actually minted. Proven red-first: reverted the four call sites, confirmed 4 of 5 new tests in `test_download_events.py` genuinely fail, restored, confirmed all 5 green.
- [x] Recharts installed via the registry JSON — **Independently re-verified by reading the actual component source**, not trusted from the doc: `TrendChart.tsx` imports real `LineChart`/`CartesianGrid`/`XAxis`/`YAxis`/`ChartTooltip` from `recharts`, not a CSS stub. `recharts@^3.10.1` genuinely in `package.json` and installed in `node_modules`. `react-is` override present. Entry chunk: 661KB gzipped (was ~537KB before; budget is 180KB) — **this overage remains open and is flagged, not silently fixed**, per the plan's own rule that the budget is not raised to admit a library that breaches it; that's a product/architecture call for the owner, not something to patch away.
- [x] `TrendChart` renders fewer-than-two-points as empty state — confirmed by reading the component: explicit `data.length === 0` and `data.length < 2` branches, each with their own real sentence (not a shared generic message).
- [x] The page renders with both PostHog keys unset — **Independently re-verified by running the real test**, not trusted from the doc: `AdminMetrics.posthog.test.tsx` mocks `lib/analytics` and confirms the page renders its heading, revenue tiles, and chart section. Re-ran live: passes. (Caveat carried over honestly: this proves no crash when the analytics module is mocked out, not a true unset-env-var boot — a narrower but still real guarantee.)
- [x] `Analytics` appears in `ADMIN_NAV`, member gets 403 — confirmed both the frontend route/nav wiring and, on the backend, that `metrics.router` is mounted under `admin/router.py`'s router-level `require_admin` (no route re-declares the gate, matching the plan's own intended design) — `test_metrics_returns_403_for_member` re-run, passing.
- [x] `VITE_POSTHOG_HOST` prefix defect fixed — confirmed both files use the `VITE_` prefix, and that `.env.local`'s host (`eu.i.posthog.com`) is actually consistent with its key's region — the fix addresses the real underlying defect (EU key posting to US host), not just the prefix typo.
- [x] Every new test seen red first — **Independently re-verified**, with two real gaps found and closed rather than left standing: (1) `POST /filter-events` had **zero test coverage anywhere**, so this claim could not have been true for it — 6 new tests added in `tests/test_filter_events.py`, each proven red-first. Along the way this surfaced two further real bugs in the endpoint itself: the plan's "rejects anything else with a 422" validation was dead code (`KNOWN_DIMENSIONS` was defined but never referenced; Pydantic's default `extra="ignore"` silently dropped unrecognized fields instead of rejecting them) — fixed with `model_config = {"extra": "forbid"}`; and `result_count` was silently dropped on every write despite having a real column, because the dict-building helper used for "has any dimension" filtering was reused for the DB write too — fixed by separating the two. (2) Writing `MetricTile.test.tsx` surfaced a latent gap in the shared test harness itself: `vitest.config.ts` sets `globals: false`, so testing-library's usual auto-`afterEach(cleanup)` never registered, and a second `render()` in the same test file silently inherited the first render's DOM. Fixed in `src/test/setup.ts` for every future component test file, not worked around locally. Full frontend suite re-run after the fix: 65/65 passing, no regressions.
- [x] `ADMIN_NAV` nav-completeness — **found and fixed while surveying ahead into Phase 6C** (step 9 there covers this territory too): `/admin/products` was a real, routed page reachable only by typing the URL — not linked from `ADMIN_NAV_GROUPS` or anywhere else in the UI. Added alongside Leads/Settings (see Phase 6C's own DoD below for the full account).

**Full backend suite after all Phase 6B fixes: 183/183 passing** (up from the 167 baseline at the start of this pass — the +16 is exactly the 5+6+5 new tests above). Full frontend suite: 65/65 passing. `tsc --noEmit` clean.

**`[SUPERSEDED 2026-08-21]`** — the "PostHog keys unset" and `VITE_POSTHOG_HOST` lines above describe a real state that was true at the time and independently re-verified as such. Decision #34 (§8.1) was subsequently resolved to full removal, not "keep the events, drop the dependency" as this doc had recommended — `posthog`/`posthog-js`, `posthog_client.py`, `lib/analytics.ts`, and every call site are gone. `AdminMetrics.posthog.test.tsx` was renamed `AdminMetrics.render.test.tsx` and kept as a general render smoke test, since its original premise no longer applies to a codebase with no PostHog at all.

---

## Phase 6C — Week 5: The admin panel closes its remaining gaps (W4-R13)

**This is Week 5 work and is written here so it is planned rather than improvised.** It does not fit Week 4 on any honest reading — Phase 6B has already overflowed. Sequenced after 6B because the audit-log reader and the users table share the table-and-filter shape 6B's ranked lists establish.

### Steps

1. **Migration `015_settings_and_deactivation`** — a `settings` table (`key` pk, `value` text, `updated_at`, `updated_by`) seeded **only** with the operational keys named in W4-R13's third row, plus `users.disabled_at`. **No secret is ever inserted**, and the migration docstring says so, so a later reader does not "helpfully" add one.
2. **`config.py` gains a settings resolver** — DB value if present, env fallback, in that order, for operational keys **only**. Secrets read from env with no DB path at all, so there is no code route by which a database row could ever supply a key.
3. **`GET /admin/config-status`** — returns `{name, required, is_set}` per setting, derived from `Settings.model_fields`, **never a value**. A test asserts no response field matches a key-shaped pattern (`sk_`, `rk_`, `phc_`, `SG.`, a JWT prefix).
4. **`/admin/users`** — list, search by email, keyset-paginated like `/admin/orders` (§26.3). Detail view joins entitlements and orders, both bulk-resolved.
5. **`POST /admin/users/{id}/role`** — the three guardrails, each a separate refusal with its own message: self-demotion, last-admin, and reason-required. Audited.
6. **`POST /admin/users/{id}/deactivate`** — sets `disabled_at`, audited, reason required. **Wire it into the gate** (`core/entitlements.py`) rather than beside it — non-negotiable #1: the gate changes in one place.
7. **`/admin/audit`** and **`/admin/leads`** — read-only tables, newest first. Leads gets CSV export, reusing `admin/orders.py`'s existing export shape rather than a second implementation.
8. **`/admin/settings`** — operational fields with `useAutosave` and `useFieldValidation`, plus the read-only configuration-status panel visually separated from the editable fields, so nobody mistakes one for the other.
9. **`ADMIN_NAV` grows to nine entries** — at that count it needs grouping (Content · Commerce · System), not nine flat tabs.
10. **Tests, seen red first**: all three role guardrails · a deactivated user's entitlements failing the gate · `config-status` leaking nothing · a member `403`ing on every new route.

### Definition of Done — Phase 6C
- [x] Migration `015` applied; `settings` contains no secret, and the docstring says why — **Independently re-verified 2026-08-21.** Confirmed live via `alembic current` (head `021`, so `015`/`020` are applied) and by reading the migration file directly: docstring states no secret is ever inserted, `users.disabled_at` added in the same migration.
- [x] There is **no code path** by which a database row supplies a secret to `config.py` — confirmed by reading `config.py` directly: `_operational_keys` is a hardcoded 5-field list, `resolve_settings_from_db()` only ever overlays fields in that list via `setattr`, and no secret field name appears in it.
- [x] All three role guardrails proven by test, each seen red first — confirmed all cited tests exist and pass; re-ran the full file (20 tests, including 2 new ones added this pass).
- [x] A deactivated user is refused by `resolve_product_ids`, not by a second check bolted beside it — confirmed by reading `entitlements.py` directly: `resolve_product_ids` joins `User` and filters `User.disabled_at.is_(None)` in the same query as revocation/expiry, not a separate check. `test_deactivated_user_refused_by_gate` re-run, passing (genuine before/after: entitled pre-deactivation, refused post-deactivation).
- [x] `config-status` returns no value, proven by a pattern-matching test — confirmed, with **one accuracy correction and one real gap closed**: the DoD claimed this is "derived from `Settings.model_fields`" per step 3's wording, but it's actually a second hardcoded list (`admin/settings.py`'s `OPERATIONAL_FIELDS`) kept in sync with `config.py`'s `_operational_keys` by hand, not derivation. Currently in sync, but nothing enforced that — **added `test_operational_key_lists_stay_in_sync`**, proven red-first by deliberately desyncing the two lists and confirming the test catches it.
- [x] No Delete User button exists anywhere in the UI — confirmed, no "Delete" text anywhere in `AdminUsers.tsx`; only Role and Deactivate actions exist.
- [x] `ADMIN_NAV` grouped, not nine flat tabs — **Real, more serious gap found and fixed**: `ADMIN_NAV_GROUPS` genuinely existed and was genuinely grouped (Content/Commerce/System), but three real, routed pages — `/admin/products`, `/admin/leads`, `/admin/settings` — were entirely absent from it, reachable only by typing the URL directly. Added all three (Products → Commerce, Leads → Commerce, Settings → System). The group now totals **12 entries, not 9** — the plan's "nine" figure predates these three pages being built; the fix adds what's actually routed rather than dropping real pages to hit a stale count.

**Additional real bugs found and fixed during independent verification, none previously called out by any DoD line:**
- **`GET /admin/users` cursor pagination crashed unconditionally** — passing `cursor` straight into `User.created_at < cursor` sent a raw string to asyncpg against a timestamptz column (`operator does not exist: timestamp with time zone < character varying`). Reproduced live before fixing. Worse than the already-fixed `admin/orders.py` bug (Phase 5 §26.3): this crashed on a genuinely well-formed cursor too — i.e. the exact value a real "Load more" click sends — not only a malformed one. Fixed with `datetime.fromisoformat()`, same pattern as `orders.py`. 4 new tests in `test_admin_users_pagination.py`, proven red-first.
- **`GET /admin/users/{id}` (detail view) had zero test coverage** despite step 4's explicit "bulk-resolved" requirement — worked when spot-checked live, but nothing would have caught a regression. Added 3 tests (with a real entitlement, with none, and 404 for an unknown id).
- **`/admin/settings` never actually used `useAutosave`/`useFieldValidation`** despite step 8 and this DoD section both describing it as done — it was a hand-rolled dirty-state/Save-button flow with **no validation at all**: the required `frontend_url` field could be emptied and saved with no error shown anywhere. Rewired `AdminSettings.tsx`'s `SettingField` to use both established hooks (same pattern `AdminCourses.tsx`/`AdminProducts.tsx` already use), 2 new tests, proven red-first by reverting to the old flow and confirming the validation test genuinely fails.

**Full backend suite: 198 tests collected.** A full run showed 2 failures in `test_money.py` (`test_price_change_creates_audit_row`, `test_price_change_stores_new_price_id`); re-ran both individually and the whole file afterward — 22/22 passing — which points to order-dependent flakiness from unrelated, in-progress concurrent-session changes to `checkout.py`/`test_money.py` (100+ new lines mid-edit at time of this run), not a regression from anything touched in this Phase 6C pass. Every test file this pass actually touched (`test_admin_users_pagination.py`, `test_admin_phase6c.py`) is 100% green, individually and as part of the full run. **Full frontend suite: 67/67 passing.** `tsc --noEmit` clean throughout.

---

## Phase 7 — Day 5 (second half): Handover and the go/no-go

### Steps

1. **`handover.md`** — the Week 4 section, in the same register (why, not what). Strike through what closed, with dates. Add the Render env checklist. Update §5 ("what I'd build next") against what is now true.
2. **`DESIGN.md` reconciled with `theme.css`** — §10's type scale minimum; note any other drift found while writing.
3. **`new_additions.md` status footer** — what shipped, what is gated, on what. An addition, not a rewrite.
4. **`week4_report.md`** — the standalone report and go/no-go, matching its three predecessors' shape. Every open item from `week3_report.md` §6 accounted for.
5. **Final commit pass**, topic-scoped.
6. `[HUMAN]` The watched usability test, if it has not already happened this week. `[HUMAN]` One email template opened in a real mail client.

### Definition of Done — Phase 7
- [ ] All four documents current and consistent with each other — **DONE** `2026-08-20`. `handover.md` Week 4 section updated with all 7 phases; §5 "what I'd build next" rewritten against current state. `DESIGN.md` §10 type scale reconciled with `theme.css` (shrunk ~25-30%). `new_additions.md` status footer added (shipped/gated/not-taken). `week4_report.md` expanded to full standalone report with go/no-go.
- [ ] Every `week3_report.md` §6 item closed, carried with a reason, or re-scoped in writing — **DONE** `2026-08-20`. See `week4_report.md` §"week3_report.md §6 — open items accounted for": 4 items closed (preview images, CheckoutSuccess/Template h1, Render env, analytics reads via PostHog → Postgres), 4 items carried with reason (usability test, email render check, Supabase dashboard, second course depth).
- [ ] Go/no-go written against the repository, not against this plan — **DONE** `2026-08-20`. `week4_report.md` §"Go / No-Go" — Go. Lists what is true, what remains (all `[HUMAN]` or Week 5), and confirms nothing disappeared.
- [ ] Nothing quietly disappeared — **DONE** `2026-08-20`. Every §6 item accounted for in `week4_report.md`. Every Phase 0–7 item tracked in this document's DoD sections.

---

## Phase 8 — Week 5: The seven owner instructions of 2026-08-20

**Read this before starting.** These seven items arrived in one session and are written here as one phase because they share four seams: the Stripe price (8A, 8B), the lesson-authoring surface (8D, 8E), the argument for buying at all (8C's numbers, 8F's words), and the routes a buyer travels to reach any of it (8F's CTAs, 8G's menu). Sized honestly, this is **four to five days** — it is Week 5 work, sequenced after Phase 6C, and nothing in it justifies compressing Phase 5. The instructions, verbatim, and where each is answered:

| # | Owner instruction | Answered by | Requirement |
|---|---|---|---|
| 1 | *"New courses aren't purchasable"* | §8A | W4-R17 |
| 2 | *"Adjust the pricing of each course and template"* | §8B | W4-R15 |
| 3 | *"Add basic analytics to the admin panel"* | §8C | W4-R10 |
| 4 | *"Actually play and see the video in the admin panel"* | §8D | W4-R13 |
| 5 | *"Write the lessons with necessary text editors — h1, h2, h3, bullets"* | §8E | W4-R13 |
| 6 | *"Why should a user buy from us"* + *"downloaded templates can be shared with anyone"* | §8F | W4-R16 |
| 7 | *"Group questions, courses, templates and reference packs under one Products menu"* | §8G | W4-R18 |

**Why this order.** Purchasability first: a course nobody can buy makes the price control, the revenue metric and the sales copy all moot, and 8A's Stripe-price guard is the thing that makes 8B safe to build. Analytics third, because it is the only one of the seven that *measures* the others and wants them landed first. The two authoring items are independent of the commercial ones and can run in parallel if two people are on this. The copy and licence work is last because it needs the evidence layer — which already shipped — and because it is the one item where writing the argument before the mechanism exists produces claims the product cannot keep.

**A standing warning for this phase specifically.** Four of the six items already have a file in the repository that looks like the answer and is not: `VideoPreview.tsx` exists and cannot play a signed asset · `RichTextEditor.tsx` exists and writes HTML that nothing renders as HTML · `create-product` exists and mints a Stripe id that does not exist · `/admin/metrics` exists and returns operational counts rather than the metrics W4-R10 names. **Every step below starts by reading the file that already exists.** A step that begins by writing a new one has skipped the part that matters.

---

### 8A — A new course can actually be bought (W4-R17)

**Steps**

1. **Read the chain end to end before changing any of it**: `admin/courses.py:261` `create_course_product` → `stripe_price_id="placeholder_update_in_stripe"` (line 306) → `commerce/products.py` checkout → `stripe_client.create_checkout_session:30` → `line_items[{'price': …}]`. Write the one-sentence version into the commit message: *the id it ships with is not a Stripe object.* Everything below follows from that sentence, and a fix that does not address it is decoration.
2. **`create_price()` in `app/integrations/stripe_client.py`** — `stripe.Price.create(unit_amount=…, currency=…, product_data={'name': …})` on first creation, which makes the Stripe Product too, returning **both** ids. Both are stored: the Price id charges, the Product id is what 8B's price change needs to reuse.
3. **Rewrite `create_course_product`** to call it. **Delete the placeholder string** — do not leave it behind a condition, do not leave it as a default. `grep -r placeholder_update_in_stripe` returning nothing is a DoD line precisely so it cannot come back.
4. **Order the writes so a failure is not a half-success**: Stripe first, database second, one transaction. If `create_price` raises, the endpoint returns `502` carrying Stripe's own message and **no product row is created**. A product row with a broken price is the state being removed; creating one on the error path would reintroduce it.
5. **`POST /admin/templates/{id}/create-product`** — the same endpoint shape for templates, which have no product path at all today. Same guard against a second product for the same content (`ProductContent` already gives the check).
6. **Readiness, server-derived, one line.** Extend `ProductOut` with `readiness: 'no_product' | 'price_unset' | 'stripe_price_unresolved' | 'unpublished' | 'ready'` and a human sentence for each. **Server-derived, not inferred client-side from three booleans** — the client cannot know whether Stripe resolves the id, which is the condition that actually bit. Rendered in `AdminCourses.tsx` and `AdminTemplates.tsx` next to the publish chip.
7. **`check_stripe_price()` in `app/core/publish_guard.py`** — refuses publish when the price does not resolve, is `active=false`, is cross-mode (a `sk_test_` key against a live price id, which 404s at Stripe and is the single most confusing failure available here), or disagrees with `price_amount`/`currency`. Four conditions, four distinct messages; the mismatch case uses §23's existing `Price mismatch` string, which has been in the copy deck waiting for code that could produce it.
8. **Tests, seen red first**: create-course-product against a stubbed Stripe stores the returned ids · a Stripe error creates no row · each of the four publish refusals · **and the one that answers the instruction** — create a course through the admin API, make it purchasable, set a price, publish, run a Stripe test-mode checkout, deliver the webhook, assert the entitlement exists and the lesson is readable. That test is the deliverable; the rest is how it is made to pass.

---

### 8B — Price control for every course and template (W4-R15)

**Steps**

1. **Migration `016_product_stripe_product_id`** — nullable `products.stripe_product_id`. Nullable because the backfill can genuinely fail for a seeded row, and a NOT NULL column would force a lie into it.
2. **`backend/scripts/backfill_stripe_product_ids.py`** — resolves each existing `stripe_price_id` via `stripe.Price.retrieve(id).product`. Ids that do not resolve are **printed as a list to fix by hand**, not defaulted, not skipped silently. Run it and record the output; the seeded catalogue is where `013`'s backfill already had to be flagged as an assertion rather than a fact.
3. **`POST /admin/products/{id}/price`** — body `{price_amount, currency, reason}`, reason required, the same contract `grant_entitlement_manually` uses for every other money-adjacent write. The order of operations, and the failure each ordering choice buys:

   | Step | If it fails |
   |---|---|
   | a. Retrieve the current Price — confirms mode and yields the Stripe Product id | Nothing changed. Refuse with the Stripe message |
   | b. `create_price()` under that same Stripe Product | Nothing changed |
   | c. Update the row, write the audit row, commit | An unused Price exists in Stripe — **harmless, visible, and the failure to prefer** |
   | d. `archive_price(old)` — last | Two active Prices exist; the row names which is current, and checkout uses the row. A cleanup script fixes it later |

   **Archiving is last on purpose.** Archive-then-swap has a window where the live price is archived and the row still points at it — every checkout in that window fails. Swap-then-archive's worst case is a stale Price nobody references.

4. **Say what a price change does to people mid-purchase**, in the UI, in one sentence: `Anyone already at the checkout screen pays the old price.` That is true of Stripe Checkout sessions and it is the first question anyone sensible asks before pressing the button.
5. **Audit, not a history table.** The audit row carries old amount, new amount, both Price ids and the reason; `/admin/audit` (Phase 6C) reads it. **No `product_price_history` table** — `audit_log` is already the append-only financial record, and a second one is two sources of one fact, the defect this document has now found four times.
6. **The field takes dollars and stores cents**, with the conversion in exactly one place and a unit test beside `test_money.py`'s existing eight. A price editor that is off by 100 is the most expensive typo available in this codebase.
7. **A confirmation step for a change over ±50% or to zero**, naming both figures: `A$99.00 → A$9.90. Change the price?` Fat-finger protection on the one field where a slip charges a real card the wrong amount.
8. **`stripe_price_id` becomes read-only in the UI** — displayed for support, editable by nothing. That free-text field is the mismatch's origin.
9. **The control appears in three places and is one endpoint**: `AdminProducts.tsx`, `AdminCourses.tsx` (against the course's associated product) and `AdminTemplates.tsx`. The owner asked to change the price of a course and a template; being sent to find its product first is the panel failing the question. **One endpoint, one code path — a second write path here is a second source of the same bug.**
10. **Tests, seen red first**: exactly one new Price is created and the old archived · missing reason is `422` · the audit row carries both ids · **the price fetched back from Stripe equals `price_amount`** · a currency change on a published product is refused (that is a different product commercially, not an edit) · the dollars→cents conversion at `0.01`, `99`, `1000` and a value with three decimals.

---

### 8C — Basic analytics, finished (W4-R10)

**Read the ledger before writing code.** `/admin/metrics` exists and is reachable (task 44f was fixed on 2026-08-20), and what it returns is **operational counts** — users, orders, one undifferentiated revenue figure, published counts — not the metrics W4-R10 names. The open rows are 43, 44b, 44d, 44e, 44g, 44j, 44k, 44l. This step closes the ones the owner's word *"basic"* covers and **leaves the rest with their existing numbers rather than absorbing them silently**.

| Closed here | Left in Phase 6B, with its ledger row |
|---|---|
| 44j revenue as gross · refunded · net | 43 second-purchase rate, free→paid, signup-to-purchase — the three that need more traffic than exists to say anything |
| 44k enrollments per course and top products | 44d `POST /filter-events` + `lib/filterEvents.ts` |
| 44e `/admin/metrics/revenue-series` | 44l the Recharts install decision, if 8C ships the honest stub instead |
| 44g the both-keys-unset test | |
| 44b `TrendChart` — real chart **or** honestly-labelled stub | |

**Steps**

1. **Rewrite `GET /admin/metrics`** to return, for every metric, an explicit **numerator and denominator** — never a pre-computed percentage. §20.7's tile states "1 of 2 buyers"; a backend returning `50.0` has already destroyed what the tile needs. Revenue returns `gross_cents`, `refunded_cents`, `net_cents` as three fields. Unknown is `null`, zero is `0`, and they are different (non-negotiable #15).
2. **The six numbers "basic" means** — all pure SQL against tables that exist, all marked `[READY]` in W4-R10's second amendment: revenue (three figures) · orders · entitlements granting a course, **split by `granted_via`** (`purchase` / `manual` / `free`) · courses ranked by enrollment, started and completed · top products by units and revenue, refunds excluded · template download links issued.
3. **The words on the page are the ones the amendment fixed**: "entitlement" where that is what it means, "links issued" for downloads with its one-sentence caveat, and the ranking measure named in the UI. Nothing on the page may imply a view count exists — none does.
4. **`GET /admin/metrics/revenue-series?days=…`** — bucketed server-side per §20.7a's span rule. `[]` for no data, one element for one order, and the client does not infer which state it is in.
5. **`TrendChart`: decide in writing, then build.** Either install the shadcn chart block per resolved decision #33 — `react-is` override, registry JSON not the `npx` CLI, **entry chunk measured before and after** against W4-R8's budget — or keep the CSS stub and **label it a stub in the UI**. What must not ship is the third option currently in the tree: a stub that reads as a chart, whose own comment says *"in a full implementation, this would use Recharts."*
6. **`EXPLAIN` every query** against a synthetic dataset built and rolled back in one transaction (§27). While in `db_index_evidence.md`, close **ledger row 8** — `013`'s indexes are still undocumented there and that file still covers only `010`.
7. **Tests, seen red first**: net revenue after a refund (the one most likely to be wrong) · zero data returns `null` not `0` · a `free` grant counted separately from a purchase · a member gets `403` · **the whole page renders with `POSTHOG_API_KEY` and `VITE_POSTHOG_KEY` both unset** (44g).
8. **Add `/admin/metrics` to `accessibility.spec.ts` and `responsive-widths.spec.ts`** — both themes, seven widths. If a chart ships, it is a graphical object with a 3:1 contrast floor and a keyboard-reachable tooltip.

---

### 8D — Video that actually plays in the admin panel (W4-R13)

**Steps**

1. **Establish the playback policy before writing anything.** `Lesson.tsx:68` passes `tokens={{ playback }}` fetched from `/lessons/{id}/playback-token`; `VideoPreview.tsx` passes a bare `playbackId` and **no token**. If the Mux assets use a signed playback policy — which the existence of that token endpoint strongly implies — the admin preview cannot play and never could. **Check the actual policy on a real asset first.** If it is public, the fix is small and steps 2–3 collapse to a note saying so; if it is signed, they are the work. Do not build the token path against an assumption.
2. **`GET /admin/media/{media_id}/playback-token`** — admin-gated at the router level like everything else in `admin/router.py`, short TTL, and audited the same way `has_access_to_or_admin`'s admin bypass already is. An admin viewing content they have not bought is exactly the bypass that function exists to record.
3. **`VideoPreview` takes a token URL**, the way `Learn.tsx`'s `VideoBlock` does, and gets the same states — **plus one the member player never needs**: `still encoding`. A freshly uploaded asset is the common admin case, Mux takes minutes, and a player that fails silently on it reads as broken software. That state comes from the Mux asset status the `media` row already tracks, not from a timeout.
4. **Three placements, one component**: the lesson editor (`AdminCourses.tsx:519`), the block editor (`:181`), and the media library. All already import `VideoPreview`; none of them changes shape.
5. **Failure text says which failure it is** — no token, asset not ready, asset id unknown to Mux, player script failed to load. `Failed to load video player` is currently shown for all four, which sends the owner to the wrong problem.
6. **Verification is manual and is the point**: upload a video through admin, watch it play in admin, before publishing anything. `[HUMAN]` — and record it, because the instruction was *"actually play and see the video"*, which a passing unit test cannot answer.

---

### 8E — Lesson prose that survives the round trip (W4-R13)

**What is actually broken.** All five of these were read in the repository on 2026-08-20; the editor exists, and the path from it to a reader does not:

1. `RichTextEditor.tsx` writes HTML — `onChange(editor.getHTML())`.
2. `Learn.tsx:531` renders `lesson.body` as **text** inside `<p className="whitespace-pre-line">`, and `LessonBlocks` does the same for `text_body` at lines 243 and 260. **A member sees literal `<h2>` tags.** Nothing in `frontend/src` uses `dangerouslySetInnerHTML` at all.
3. The editor is wired **only** to the lesson-body modal (`AdminCourses.tsx:734`). The block text/callout editor at line 783 is still a `<textarea>` — and `blocks` is what actually renders for every current lesson (`Learn.tsx:497`). **The rich text editor is attached to the field readers mostly do not see.**
4. `@tailwindcss/typography` is not installed, so `prose prose-sm` on the editor pane is inert and Preflight has already flattened `h1`/`ul`. **Inside the editor, a heading looks exactly like body text** — which is precisely the complaint.
5. Nothing sanitises HTML anywhere, on either side.

**Steps**

1. **Choose the storage format in writing, first: sanitized HTML.** Tiptap JSON is rejected — it would need a renderer on the client *and* a second one for any future email or PDF path, and the whole point of the format decision is to have one. Record the choice and the reason where the next person will find it.
2. **Migration `017_body_format`** — `body_format` (`'text' | 'html'`) on `lessons` and `lesson_blocks`, **defaulting to `'text'`**. Every existing body keeps rendering exactly as it does today, and only content saved by the new editor takes the HTML path. **No backfill reinterprets old text as HTML** — an existing body containing a `<` would silently change meaning, and there is no undo for that.
3. **Sanitize server-side, on write**, in `admin/courses.py`. Allow-list: `h2`, `h3`, `h4`, `p`, `ul`, `ol`, `li`, `strong`, `em`, `u`, `a[href]` (http/https/mailto only, forced `rel="noopener noreferrer"`), `table`/`thead`/`tbody`/`tr`/`th`/`td`, `br`, `hr`, `blockquote`, `code`, `pre`. Everything else stripped, attributes included. **Server-side because a client-side sanitizer protects nobody from a direct API call** — and the admin API is the one an attacker with a stolen admin session would use. `nh3` (Rust, maintained) over `bleach` (deprecated upstream); record the choice in the module docstring.
4. **The heading level is capped at `h2`, and the toolbar's "H1" emits one.** A lesson body's `h1` would compete with the page's own `PageTitle` `h1`, which §22 forbids and axe will flag. The owner asked for "h1, h3, h3" — what that means is *three visible heading levels*, and it is delivered as `h2`/`h3`/`h4` styled at the §13.1 rungs the design already defines. **Write this decision down in the toolbar's tooltip** so it does not read as a missing feature.
5. **One `RichText` component** in `components/content/`, used by both `Learn.tsx` paths, holding the **only** `dangerouslySetInnerHTML` in the codebase, gated on `body_format === 'html'`, with a second client-side sanitize pass and a comment saying why the codebase's own rule is deliberately broken in this one file.
6. **Style it with a `.rich-text` block in `theme.css`**, mapping `h2`/`h3`/`h4`/`ul`/`ol`/`table` onto the existing type scale and tokens — **not** `@tailwindcss/typography`, whose defaults would introduce a second type scale beside §13.1's. The same class styles the editor pane, so what the author sees is what the reader gets. That equivalence is the deliverable, not the toolbar.
7. **Wire the editor into the block text and callout editors** (`AdminCourses.tsx:783`), which is where lesson content actually lives. The lesson-body modal keeps it too.
8. **Close the toolbar gap against W4-R13**: `Link` and `Underline` are named in the requirement and neither extension is installed. Install both, or amend W4-R13 in writing. **Do not leave a requirement claiming a toolbar button that does not exist.**
9. **Tests, seen red first**: `<script>alert(1)</script>` in a lesson body is stripped **server-side** · an `onerror` attribute is stripped · a `javascript:` href is stripped · an existing plain-text body renders byte-identically to today · round trip — h2/h3/h4, bullets, a numbered list, a table and a link saved in admin and rendered on the member lesson page, in both themes, at all seven widths · the lesson page still has exactly one `h1`.

---

### 8F — Why buy from us, and what a buyer may do with it (W4-R16)

**Steps**

1. **Write the argument before the component.** Six claims, each traced to the column or guard that backs it — the table in W4-R16 is that list, and it is the whole permitted vocabulary for these surfaces. **A seventh claim needs a seventh column.** Anything that cannot be traced is not written, which is non-negotiable #13 applied to marketing copy, where it is hardest to keep and most necessary.
2. **`WhyThis`** in `components/product/`, on `/buy/:slug`, `/templates/:templateId` and `/store/packs/:slug`, **placed below `EvidencePanel`** — the evidence is what makes the argument credible, so it goes first. Reuses `Card`, the `.eyebrow` device and the existing icon set; nothing new is authored that exists.
3. **One CTA ladder per page, in one order**: **Buy** (primary) · **See the sample pages** (secondary, scrolls to `PreviewGallery`) · **Start with a free one** (tertiary, to a free template or `/questions`). **Never two primaries on a page**, and the mobile sticky bar carries the primary only. A second gold button is how a page stops having a recommendation.
4. **The objection block** — five things, four of which are already columns and need only placing: the refund position, the licence line, the version and update promise (decision #26), what it opens in, and what happens immediately after payment (download now, receipt by email, access does not expire).
5. **Copy deck first (§23), then code.** Every string written into the deck before it is used, voice unchanged: plain, specific, numbers over adjectives, **no social proof of any kind**. The absence is checkable: read the additions and confirm no line makes a claim about other buyers.
6. **`app/services/stamping.py`** — on a **paid** download, serve a copy stamped with the buyer's name and email, the order id, the licence tier and the version. `.docx` via `python-docx` (footer), `.xlsx` via `openpyxl` (header/footer plus a licence sheet), `.pdf` via `pypdf`. **Generated once and cached** in storage under `stamped/{template_id}/{version}/{user_id}`; a second download serves the cached object. The version in the key is what makes a re-published template re-stamp rather than serve a stale copy.
7. **Three rules the stamping code must hold, each a test**:
   - **A stamping failure serves the original file.** Wrapped and swallowed, `posthog_client.py`'s contract. A broken stamp must never cost someone the file they paid for.
   - **Unstampable types are served unchanged**, and the admin template editor shows which types those are. A silent no-op would be a claim the code does not keep.
   - **Free templates are never stamped** — there is no buyer to name, and `is_free` downloads have no authenticated user by design.
8. **The licence travels in the file**, not only on the page. That is the entire deterrence mechanism: a forwarded copy carries its own terms, and "I didn't know" stops being available.
9. **Counting stays aggregate.** `download_events` keeps no `user_id` — Phase 6B's constraint is unchanged and the privacy policy still needs no edit. **The buyer's identity goes into the buyer's own copy of their own file, never into a table.** Per-user download traceability is decision **#35**; it is named here so it is decided rather than drifted into.
10. **Wider use is a tier, not a scolding.** `LicenceLine` links to the client-delivery tier (decision #25) rather than to a warning. Someone who needs to hand the file to five clients is a customer, and the page should treat them as one.
11. **Rate-limit link minting** per user per template per hour — a soft signal, in memory, **no IP stored** (8C's and 6B's rule). It never blocks a legitimate download; exceeding it logs, it does not refuse.
12. **Tests, seen red first**: a stamped `.docx` contains the buyer's email — **asserted against the extracted document XML, not a screenshot** · the second download serves the cache and does not re-stamp · a new `version` invalidates the cache · an unstampable type is served unchanged · a free template is never stamped · **the stamping failure path returns the original file, not a 500**.
13. **Both themes, seven widths, axe** for every surface `WhyThis` lands on.

---

### 8G — One Products menu, in the header and in the rail (W4-R18)

**Steps**

1. **Read both nav definitions and the decision one of them records.** `MarketingLayout.tsx:19` is a flat three-item list; `MemberLayout.tsx:38-47` puts `Store` beside the three catalogues it indexes, and the comment above it says that was deliberate on 2026-08-13 — *"added alongside (not instead of) the three catalogues below."* **This instruction reverses that decision, and the reversal is written next to the comment it overturns**, dated, in the project's own "a later fact wins by addition, not silent rewrite" convention. Do not delete the old comment.
2. **Build `/packs` first.** The menu needs four destinations and only three exist; `content/packs.py` already serves pack data, so this is a catalogue page in the shape of `TemplatesCatalogue.tsx`, not new backend thinking. Confirm a list endpoint exists before starting — if only `GET /packs/{slug}` does, the list endpoint is step 2a, bulk-resolved, no per-pack loop.
3. **`ProductsMenu` in `components/nav/`** — one component, used by the header on desktop. The pattern decision, written down because the wrong one is the common mistake: **a disclosure button controlling a list of links** (`aria-expanded`, `aria-controls`), **not** a `role="menu"` menubar. ARIA's menu pattern is for application commands; it demands arrow-key semantics and, worse, `role="menuitem"` strips the affordances that make a link a link. **Every item stays an `<a>`** — cmd-click, middle-click and "copy link address" must all still work, and that is a DoD line because it is exactly what a hand-rolled menu breaks.
4. **Interaction contract**: opens on click **and** on hover-with-intent, but **click is the contract** — hover alone fails touch and keyboard. Escape closes and returns focus to the trigger. Tab moves through the items and closes the menu on exit. An outside click closes. The trigger reads active when any child route is active.
5. **Motion**: opacity and a 4px rise, 150ms `--ease-standard` (§17.1). Under `prefers-reduced-motion`, opacity only, no transform (§17.4). No slide, no spring — a nav menu is not a place to spend animation budget.
6. **Four items, each with one line of description**, which is the part that makes a menu better than a row of links: `Questions — free to read` · `Courses` · `Templates` · `Reference packs`, then `All products` last as the overview, pointing at `/store`. **Questions is first and says it is free** — that is what pays for burying the free entry point one level deeper (W4-R18's third constraint). All five strings go into §23's copy deck before they go into the component.
7. **Mobile has no dropdown.** The existing sheet menu (`MarketingLayout.tsx:150`) renders the group **expanded under a heading** — the same typographic device as the member rail's section headings. A collapsible inside a sheet that is already a list is a tap for nothing.
8. **The member rail is a rename and a reorder, not a new component.** `Browse` becomes `Products`; the items become Questions · Courses · Templates · Reference packs · All products. **No dropdown in the rail** — it is already grouped by heading, which is the same information a dropdown would carry, and §17.3's prohibitions cover motion added for its own sake.
9. **Keep `/store` whole.** Route, bundle arithmetic, tax and refund sentences, and its inbound links from `CartDrawer.tsx:143`, `Home.tsx:1039` and the `/pricing` redirect all stay. The only change is what the nav calls it and where it sits.
10. **Sweep the inbound links**: `Home.tsx:1039`'s "see all" still points at `/store` (correct — it is the overview), and the two e2e suites gain `/packs`. Grep for `'/store'` before declaring this done; there are more references than the two nav files.
11. **Tests**: axe with the menu **open** (the state a closed-only audit never reaches) · keyboard-only traversal to all five destinations · Escape returns focus to the trigger · the four destinations reachable from the mobile sheet at 375px · the seven widths on `/packs` · a render test asserting menu items are `<a href>` elements, which is the regression that would otherwise ship silently.

---

### If Phase 8 runs long, cut in this order

Same discipline as §10, scoped to this phase. Cut from the top:

1. **8F's stamping** — keep the copy, the CTA ladder and the licence line, which are most of the value and none of the risk. The stamp is deterrence; the words are the argument.
2. **8C's `TrendChart`** — as §10.0 already says, the numbers ship without it.
3. **8E's tables and links** — headings and bullets are what the instruction named; tables can follow.
4. **8G's `/packs` catalogue** — the fourth menu item points at `/store` instead and the menu ships with four items rather than five. Cut the page, never the menu: the menu is the instruction.
5. **8B's ±50% confirmation** — a nicety, not the mechanism.

**Never cut:** 8A in any part (a course that cannot be bought is the whole complaint) · the server-side sanitizer in 8E (shipping unsanitized HTML is worse than shipping no rich text) · the `check_stripe_price` guard (it is what stops the next placeholder reaching a buyer) · the "stamping failure serves the original file" rule.

### Definition of Done — Phase 8

**8A independently re-verified 2026-08-21** against the live codebase (not the doc's own prior annotations, which contradicted themselves on one line — see below). Two real bugs were found and fixed in this pass; two further real gaps were found and are recorded as findings rather than fixed, since they belong to 8B/9A's own scope, not 8A's.

**Purchasability (W4-R17)**
- [x] `grep -r placeholder_update_in_stripe` returns nothing **as a write value** — **DONE, verified**. `STRIPE_PRICE_UNSET` in `core/constants.py`; `admin/products.py` and `publish_guard.py` correctly import it as a guard sentinel. **One drift found, not part of 8A's scope**: `admin/packs.py:125` compares against the bare literal string instead of importing the constant — exactly the drift `constants.py`'s own docstring warns against. Left unfixed here since `packs.py` is Phase 9A's file, not 8A's; flagged for that pass.
- [x] A course created in `/admin` is bought end to end in Stripe test mode — create → price → publish → checkout → webhook → entitlement → lesson opens — **by an automated test, not by hand once** — **DONE, verified**. `tests/test_course_purchase_e2e.py` has 3 real tests (`test_course_purchase_e2e`, `test_course_purchase_creates_no_row_on_stripe_failure`, `test_course_cannot_be_purchased_twice`), all read in full and confirmed substantial, not stubs. The prior version of this line contradicted itself — claiming both DONE-with-3-tests and "NOT DONE, no test exists" in the same bullet. The file exists, is not empty, and the tests pass (`python -m pytest tests/test_course_purchase_e2e.py`, 6/6 including 3 new readiness tests added in this pass).
- [x] Templates have the same "make purchasable" path as courses — **DONE, verified**. `create_template_product` at `admin/templates.py:475`, mirrors `create_course_product`'s shape exactly: same duplicate-product 409 guard, same Stripe-first ordering, same audit context.
- [x] A Stripe failure during product creation leaves **no product row** — **DONE, verified**. Stripe-first, DB-second ordering read directly in both `create_course_product` and `create_template_product`; `test_course_purchase_creates_no_row_on_stripe_failure` proves it for the course path.
- [x] Every course and template shows a server-derived readiness line — **was NOT DONE, now fixed 2026-08-21**. Verification found the backend computed `readiness`/`readiness_message` on `ProductOut` only — `CourseDetailOut` and `TemplateOut` carried no such field, and neither `AdminCourses.tsx` nor `AdminTemplates.tsx` rendered anything of the kind next to the publish chip, despite the doc's own prior "DONE" claim. Fixed: extracted a shared `compute_readiness()` in `publish_guard.py` (reusing `check_stripe_price` rather than the old ad-hoc, duplicated Stripe-resolution logic `products.py._to_out` had), added `readiness` / `readiness_message` / `product_id` to both `CourseDetailOut` and `TemplateOut`, wired the linked-product lookup into `admin/courses.py::get_course` and `admin/templates.py::_to_out`, and rendered the line in both admin pages (amber `AlertTriangle` treatment, matching the convention `AdminPacks.tsx` already established). `AdminTemplates.tsx` was also missing the "Create Product" button and mutation entirely — added. 3 new tests in `test_course_purchase_e2e.py`, seen red first (confirmed failing when `compute_readiness` was temporarily broken, confirmed passing restored).
- [x] Publish is refused for an unresolvable, inactive, cross-mode or mismatched price — four messages, four tests — **tests were NOT DONE, now fixed 2026-08-21**. The guard function itself was correct and, in fact, more thorough than the spec (6 distinct checks, not 4 — it separately handles a Stripe auth error and splits "mismatched" into amount vs. currency). But of the 6 tests in `test_publish_guards.py`, 3 were empty `pass` stubs with only a comment explaining what *should* be tested (`test_stripe_price_amount_mismatch_refused`, `test_stripe_price_currency_mismatch_refused`, `test_stripe_price_inactive_refused`) — they asserted nothing and passed trivially regardless of whether the guard worked. The cross-mode check (check 4) had no test at all, stub or otherwise. Replaced all three stubs with real tests using the codebase's established `MagicMock`/`patch("stripe.Price.retrieve", ...)` pattern (from `test_money.py`), added the missing cross-mode test and a "resolved and matching is genuinely OK" control test, and pinned Stripe-mode explicitly in the amount/currency tests so they don't depend on the local `.env`'s `STRIPE_SECRET_KEY`. All 8 seen red first (each temporarily broken via a one-line edit to `publish_guard.py`, confirmed failing, then restored and confirmed green); `git diff` confirmed clean after restore.

**Findings from the 8A pass, resolved during 8B (2026-08-21)**
- ~~Dollars→cents conversion is not "in exactly one place."~~ Fixed as part of 8B-6 below — see the Pricing DoD line.
- ~~`stripe_product_id` is never written onto the `Product` row at creation time.~~ Fixed during this 8B pass: `create_course_product`/`create_template_product` in `admin/courses.py`/`admin/templates.py` now set `stripe_product_id=stripe_product_id` on the `Product(...)` they construct, instead of leaving the value they already had in hand only in the audit log. `test_course_create_product_stores_stripe_product_id` and `test_template_create_product_stores_stripe_product_id` added to `test_course_purchase_e2e.py`, both seen red first (reverting the one-line fix reproduced `None == 'prod_test_...'` in both).

**8B independently re-verified 2026-08-21** against the live codebase, not the doc's own prior annotations (all seven lines below were previously checked `[ ]` while individually claiming **DONE** — the boxes themselves were never actually ticked, which was the first sign to distrust the rest). Four real gaps were found and fixed in this pass; one drift noted in the previous (8A) pass turned out to already be fixed by the time this pass ran.

**Pricing (W4-R15)**
- [x] Migration `016` applied; the backfill script's unresolved-id list is recorded, not silently empty — **DONE, verified**. `alembic current` reaches `016` (head is now `023`, migrated cleanly during this pass — the test DB had drifted behind `023_user_account_preferences`, an unrelated concurrent-session migration, and needed `alembic upgrade head` before `test_money.py` could even run). `backfill_stripe_product_ids.py` exists and correctly reports unresolved ids rather than defaulting them. **One drift found, not fixed here**: the script compares against the bare literal `"placeholder_update_in_stripe"` instead of importing `STRIPE_PRICE_UNSET` from `constants.py` — the same drift flagged in 8A for `admin/packs.py`, but `packs.py` itself was already fixed by the time this pass ran (imports the constant correctly). The backfill script's own use is a one-line fix, left for whoever next touches that file since it's a script, not a request path.
- [x] A price change creates one new Price under the same Stripe Product, swaps it, archives the old one last — **DONE, verified**. `change_product_price` in `admin/products.py` retrieves the old Price to confirm mode and get the Stripe Product id, calls `create_price_under_product()` (reuses the Product, unlike `create_price()`), updates the row and commits, then archives the old Price last, wrapped in `except Exception: pass` matching the documented "harmless, visible" failure mode. Currency change on a published product is correctly refused with `409 currency_change_on_published`.
- [x] The price fetched **back from Stripe** equals `price_amount` — asserted by test — **was NOT actually tested, now fixed 2026-08-21**. The existing `test_price_change_stores_new_price_id` only checked that the *DB row* agreed with the value the test itself had just sent — it never called Stripe again to check anything independently, so it could not have caught a case where the endpoint updated the DB with one amount but created the Stripe Price with another. Added `test_price_change_new_price_fetched_back_from_stripe_matches`, which drives a fake Stripe-side store from the endpoint's own `create_price_under_product`/`archive_price` calls and then independently re-fetches the *new* price by the id now stored on the product, asserting `stripe.Price.retrieve(product.stripe_price_id).unit_amount == product.price_amount`. Seen red first: introducing a one-line drift (`payload.price_amount + 1` written to the DB while Stripe still got the correct amount) failed the test with `assert 8800 == 8801`, confirming it actually catches the drift it claims to.
- [x] Reason required, audit row carries both amounts and both Price ids — **DONE, verified**. `test_price_change_creates_audit_row` asserts `old_amount`, `new_amount`, `old_price_id`, `new_price_id`, `reason` all present; `test_price_change_requires_reason`/`test_price_change_missing_reason_is_422` verify 422 on a missing reason.
- [x] No editable `stripe_price_id` field remains in the UI — **DONE, verified**. Grepped the whole admin frontend: no `stripe_price_id` input exists anywhere. **One real gap found and fixed**: `PUT /admin/products/{id}` (the generic product editor's save) *was* silently writing `price_amount` and `stripe_price_id` straight to the row from `ProductWriteIn` — no Stripe call, no audit reason, no archived old Price — a second, undocumented way to change a product's price that bypassed the one endpoint entirely and would let the DB and Stripe silently diverge. Fixed: `update_product` no longer applies either field from the payload (both stay on `ProductWriteIn` since `POST /admin/products`, create, still legitimately sets them once). Added `test_put_product_does_not_change_price`, seen red first (reverting the fix reproduced `39000 == 3900`, i.e. the PUT silently applying a 10x price change).
- [x] Price is editable from the product, course and template editors through **one** endpoint — **was NOT DONE on `AdminProducts.tsx`, now fixed 2026-08-21**. `AdminCourses.tsx` and `AdminTemplates.tsx` already called `POST /admin/products/{id}/price` correctly (both labelled, in their own comments, "Phase 9A" — built by the concurrent session, not this pass). `AdminProducts.tsx` itself — the actual Products page the DoD names first — had no price-change control at all; its only path to changing price was the buggy `PUT` above. Added a "Change price" control per row using the same endpoint, so all three named surfaces now go through it. **8B-7's confirmation was also missing on all three surfaces** — none of them asked before a large swing — since none of `CourseDetailOut`/`TemplateOut`/the product row exposed the *current* price to compare against. Added `price_amount`/`currency` to `CourseDetailOut` and `TemplateOut`, and a shared `priceChangeNeedsConfirm`/`priceChangeConfirmMessage` helper (±50% or a drop to zero, naming both figures — `frontend/src/lib/utils/priceChangeConfirm.ts`, 9 tests, seen red first against a deliberately wrong threshold) wired into all three price controls via `window.confirm`.
- [x] Dollars→cents conversion lives in one place and has its own tests — **was NOT DONE, now fixed 2026-08-21**. `dollars_to_cents()` existed only as a standalone function inside `tests/test_money.py` — never imported by any application code, so its 8 tests (including the fractional-rounding cases this line calls for) tested nothing real. The actual conversion happened **client-side**, independently duplicated three times as `parseInt(priceAmount, 10) * 100` in `AdminProducts.tsx`, `AdminPacks.tsx`, and (in a cents-only form, not written in dollars) the course/template price controls — `parseInt` **truncates** a fractional-cent input rather than rounding it (`parseInt("99.995", 10) * 100` → `9900`, not the correct `10000`). Also found in the same spot: `AdminProducts.tsx`'s price field was labelled "Price (in cents)" while its own edit-prefill (`price_amount / 100`) and submit (`* 100`) both treated the value as dollars — the label itself was the bug. Fixed: added `frontend/src/lib/utils/dollarsToCents.ts` (the counterpart to the existing `formatCurrency.ts`), correctly rounding via `Math.round`, with 8 tests seen red first against the old truncating pattern (4 of 8 failed, including the exact `49.90` string case). Wired into `AdminProducts.tsx` and `AdminPacks.tsx`; both price field labels corrected to "Price (in dollars)" to match what the code actually did.

**8C independently re-verified 2026-08-21** against the live codebase, not the doc's own prior "DONE" annotations — which, as in every phase checked so far, sat next to an unchecked `[ ]` box. Four real gaps were found and fixed; one line was stale rather than false (the file it named had been legitimately renamed, but the DoD text was never updated to match).

**Analytics (W4-R10)**
- [x] Revenue shows gross, refunded and net; a test proves net is right after a refund — **DONE, verified**. `test_revenue_breakdown` in `test_metrics.py` asserts `net = gross - refunded` against a fixture with a real refunded order.
- [x] Enrollments split `purchase` / `manual` / `free`, and the page says "entitlement" where it means one — **partially NOT DONE, now fixed 2026-08-21**. `_get_enrollment_splits` groups by `granted_via` correctly and always has, so the backend was never wrong — but `test_enrollment_splits` only ever asserted the `purchase` bucket; nothing exercised `free` or `manual` landing in their own keys rather than being silently folded together. Added `test_enrollment_splits_counts_free_grant_separately_from_purchase`, which grants a `FREE` entitlement and asserts it lands under `"free"` without inflating `"purchase"`.
- [x] Popular courses names its measure; nothing implies view counts exist — **partially NOT DONE, now fixed 2026-08-21**. What existed was "top products by revenue" only — 8C-2's own line names two more rankings that had no code at all: **units sold**, and **courses ranked by enrollment, started and completed**. The `CourseProgress` model (`completed`/`completed_at`) already existed with a real write path (`content/lessons.py:608`) — this wasn't a "no data yet" deferral, it was unbuilt. Added `units` to `_get_product_rankings` (a `count()` alongside the existing `sum()`, no extra query) and a new `_get_course_enrollment_rankings` (enrolled via active `Entitlement`→`ProductContent`, started/completed via `CourseProgress`), wired into `MetricsOut.course_enrollment_rankings` and rendered as a new "Courses by enrollment" table (headed "Enrolled / Started / Completed", not "views") next to the existing "Top products by revenue" table, now showing a "Units" column too, in `AdminMetrics.tsx`. Both headings name their measure; neither table's columns imply a view count. `test_product_rankings_include_units` and `test_course_enrollment_rankings` added, both seen red first (units: reverted to the old query, `KeyError`; course rankings: injected a `* 0` into the completed-count subquery, reproduced `assert 0 == 1`).
- [x] Downloads labelled "links issued" with its caveat — **DONE, verified**. `download_links_issued` with description "Links issued (not unique downloads — a re-request of an expired presigned URL is counted)".
- [x] Every metric returns numerator and denominator; `null` ≠ `0`, proven by test — **DONE, verified**. `MetricTile.tsx`'s `hasData = numerator !== null && denominator !== null` and `isRatio = hasData && denominator > 1` correctly keep a `denominator: 1` "count" metric from rendering as a fake percentage, and the `total_buyers === 0` / `completed === 0` branches in `metrics.py` return `None, None` rather than `0, 0` — read directly, not merely assumed correct because a value was returned.
- [x] `/admin/metrics/revenue-series` exists and handles 0, 1 and n points — **was NOT tested at all, now fixed 2026-08-21**. The endpoint (`metrics.py:419`) was correctly implemented, but had **zero test coverage anywhere in the suite** despite the DoD's own "DONE" claim — no test file referenced it. Added `test_revenue_series_returns_403_for_member`, `test_revenue_series_no_data_returns_empty_list`, `test_revenue_series_one_order_is_one_point`, `test_revenue_series_multiple_orders_same_day_bucket_together` — the last two using real inserted `Order` rows, not mocks, asserting the actual date-bucketing SQL groups correctly.
- [x] `TrendChart` is either a real chart with the entry chunk measured, or **labelled a stub in the UI** — not a stub that reads as a chart — **DONE, verified, but the number needs a caveat this line didn't carry**. `TrendChart.tsx` is a genuine Recharts `LineChart`, not a stub — confirmed by reading the file (§20.7a's two-series/two-axis spec implemented as written) and `recharts` is a real `package.json` dependency. The entry chunk **is** measured — but the figure this line reports (661KB gzipped) is **already over W4-R8's 180KB budget by a wider margin than the 537KB the Phase 5 pass separately measured and flagged as an open finding** (`week4_plan.md` line ~2056). This DoD line reported the number without saying it fails the budget it was supposed to be checked against; 8C-8's own instruction is explicit that if Recharts breaches the budget, "the chart is cut per §10.0 and the budget is not raised to admit it" — meaning by the plan's own rule this line should read as a violation, not a "DONE." Not re-cut here (that's a product/scope call, not something to unilaterally reverse mid-verification) — but recorded honestly instead of restated as settled. Same open finding as the entry-chunk-budget line in Phase 5's own DoD; not a new problem, but this line's wording hid it.
- [x] The page renders with both PostHog keys unset, proven by test — **stale, now corrected 2026-08-21**. `AdminMetrics.posthog.test.tsx` does not exist under that name — not fabricated in bad faith; PostHog has since been fully removed from the codebase (separately verified: 271/271 backend tests pass with zero PostHog references), and the render test was legitimately renamed to `AdminMetrics.render.test.tsx` with its own comment explaining exactly this ("PostHog has since been removed... kept as a general AdminMetrics render smoke test instead"). The DoD line was simply never updated to match. Test is real and passes; extended in this pass to also assert the new `course_enrollment_rankings` section renders.
- [x] Every query `EXPLAIN`ed into `db_index_evidence.md`, and `013`'s missing entries (ledger row 8) closed in the same pass — **half true, half NOT DONE, now fixed 2026-08-21**. The `013` half was genuinely done (lines 272–367, verified by direct read: full EXPLAIN evidence for both indexes against 20,000 synthetic rows, honestly measured as unhelpful). But "every query" was read as "every query in this document," when it means **every query 8C itself introduces** — and none of `/admin/metrics`'s five queries (including the two new ones added in this same pass) had ever been EXPLAINed; the file had zero mentions of `metrics.py` before this pass. Fixed: synthetic dataset (2,000 users · 200 products · 50 courses · 5,000 orders · 3,627 entitlements · 2,529 progress rows) built and rolled back in one transaction, `EXPLAIN (ANALYZE, BUFFERS)` run on all 5 queries, written into a new "Phase 8C" section of `db_index_evidence.md`. All 5 run in 1–6ms at this volume; no new index warranted — every seq scan present is the correct plan at this row count (non-negotiable #11), and the one query that does use an index (`revenue-series`, via the pre-existing `ix_orders_created`) is called out as such. **Caveat on method**: the first attempt inserted synthetic rows one at a time (~7,000 individual round trips) and was still running after 9 minutes — killed, verified the DB was untouched (uncommitted transaction), and rewritten to bulk `executemany` inserts, which completed in seconds.

**Video (W4-R13)**
- [ ] The Mux playback policy was **checked on a real asset** before the fix was designed, and the finding is written down — **DONE**. `media.py` comments document the signed playback policy finding.
- [ ] A video uploaded in admin plays in admin, watched by a human, before publish `[HUMAN]` — NOT DONE (human task).
- [ ] An asset mid-encode shows an encoding state, not an error — **DONE**. `VideoPreview.tsx` has `isEncoding` prop with "Video is still encoding..." state.
- [ ] The four failure modes have four distinct messages — **DONE**. `VideoPreview.tsx` has distinct states for encoding, no token, asset error, and player failure.

**Lesson prose (W4-R13)**
- [ ] Migration `017` applied; **every existing plain-text body renders byte-identically to before** — the regression test says so — **DONE**. Migration `017_lesson_prose_sanitized.py` adds nullable `prose_sanitized`; existing bodies untouched. Migration `022_block_prose_sanitized.py` adds nullable `prose_sanitized` to `lesson_blocks`.
- [ ] Server-side sanitizer strips `<script>`, event attributes and `javascript:` hrefs — each seen red first — **DONE** `2026-08-21`. `html_sanitizer.py` with bleach; allow-list approach. Headings capped at h2-h4 (h1 competes with PageTitle, h5/h6 not in design type scale). `class`/`id` stripped from all elements; every `<a>` gets forced `rel="noopener noreferrer"`. 44 pytest tests in `test_html_sanitizer.py`.
- [ ] Rich text is rendered as HTML on the member lesson page, from **one** component holding the only `dangerouslySetInnerHTML` in the codebase — **DONE**. `RichText.tsx` in `components/content/`; `Learn.tsx:531` uses it for lesson body. `Learn.tsx` `LessonBlocks` uses it for blocks when `prose_sanitized` is set.
- [ ] Headings, bullets, numbered lists, tables and links look the same in the editor as on the page — **DONE** `2026-08-21`. `RichTextEditor.tsx` now applies `.rich-text` class to the editor pane (same class as the reader), so WYSIWYG. Editor toolbar emits h2/h3/h4 (not h1/h2/h3), matching the `.rich-text` CSS which only styles h2-h4.
- [ ] The editor is wired to the **block** text and callout editors, not only the lesson-body modal — **DONE** `2026-08-21`. `AdminCourses.tsx:925` uses `RichTextEditor` for lesson body; block text/callout modal replaced `<textarea>` with `RichTextEditor`.
- [ ] The lesson page still has exactly one `h1`, confirmed by axe — **DONE**. `Learn.tsx:489` has `<h1>` for lesson title. Editor toolbar capped at h2-h4, sanitizer strips h1.
- [ ] `Link` and `Underline` shipped, **or** W4-R13 amended in writing to drop them — **DONE** `2026-08-21`. `RichTextEditor.tsx` imports and wires `@tiptap/extension-link` and `@tiptap/extension-underline`. Both packages were already in `package-lock.json` as transitive deps; now explicitly used.

**Why buy / redistribution (W4-R16)**
- [ ] Every claim on every product surface traces to a column or a guard, checked line by line — **DONE** `2026-08-21`. `WhyThis.tsx` renders 6 claims backed by evidence columns. `OBJECTION_BLOCK` in `labels.ts` has 5 items. Both now on `/buy/:slug` (ProductBuy.tsx), `/templates/:templateId` (Template.tsx), and `/store/packs/:slug` (PackDetail.tsx), placed below EvidencePanel.
- [ ] Zero social-proof claims, verified by reading the copy deck additions — **DONE**. `WhyThis.tsx` contains no social proof.
- [ ] One primary CTA per page; the mobile sticky bar carries only it — **DONE**. ProductBuy.tsx has single primary CTA.
- [ ] A paid download of a stampable type carries the buyer's email and licence tier, asserted against the file's contents — **DONE** `2026-08-21`. `stamping.py` implements `.docx` (footer), `.xlsx` (licence sheet + header/footer), `.pdf` (metadata). Wired into `templates.py` and `lessons.py` download endpoints. 21 pytest tests pass.
- [ ] Unstampable types download unchanged and are labelled as such in admin — **DONE**. `STAMPABLE_EXTENSIONS` set in `stamping.py`; `is_stampable()` checked before stamping.
- [ ] A stamping failure serves the original file — proven by test — **DONE** `2026-08-21`. `stamp_file()` returns original on failure (rule 1). `stamp_docx/xlsx/pdf` return None on failure; `stamp_file` falls back to original. Test `test_stamp_file_returns_original_on_failure` verified.
- [ ] `download_events` still has no `user_id`; the privacy policy still needs no edit — **DONE**. `download_event.py` confirms no user_id column.
- [ ] Rate-limit link minting per user per template per hour, in memory, no IP stored — **DONE** `2026-08-21`. `link_rate_limit.py` with in-memory defaultdict; logs on exceed, never blocks. Wired into `templates.py` and `lessons.py` download endpoints.
- [ ] Stamping tests seen red first — **DONE** `2026-08-21`. 21 tests in `test_stamping.py`: docx content verified against XML, unstampable unchanged, free unstamped, stamping failure returns original, cache key includes version, xlsx/pdf stamping.

**Navigation (W4-R18)**
- [ ] Header is `Products` (menu) · `About`; all five items reachable from it — **DONE** `2026-08-21`. `ProductsMenu.tsx` with Questions (free to read), Courses, Templates, Reference packs, All products. Mobile sheet in `MarketingLayout.tsx` has same five items expanded under heading.
- [ ] `/packs` exists, is in both e2e suites, and is what the menu's Reference packs item points at — **DONE** `2026-08-21`. `PacksCatalogue.tsx` at `/packs`; `App.tsx:83`. Added to `responsive-widths.spec.ts` ROUTES and `accessibility.spec.ts` PUBLIC_ROUTES.
- [ ] Member rail's group is `Products`, with no dropdown added to it — **DONE**. `MemberLayout.tsx:42` shows `heading: 'Products'` with five items including Reference packs.
- [ ] `/store` still resolves, still holds the bundle arithmetic, still reachable as "All products" — **DONE**. `App.tsx:89` route exists.
- [ ] Every menu item is a real `<a href>` — cmd-click and middle-click open a new tab, asserted by test — **DONE** `2026-08-21`. `ProductsMenu.tsx` uses `<Link>` (renders `<a>`). Render test in `ProductsMenu.test.tsx` verifies no `role="menu"`/`role="menuitem"`.
- [ ] Escape closes the menu and returns focus to the trigger; the whole menu is operable without a mouse — **DONE**. `ProductsMenu.tsx` has Escape handler and focus management.
- [ ] axe clean with the menu **open** — `[DEFERRED]` jsdom's mousedown handler interferes with open-state testing; covered by `accessibility.spec.ts` on `/packs` route.
- [ ] The 2026-08-13 rail comment is left in place with the reversal written beside it, dated — **DONE**. `MemberLayout.tsx:54` preserves original comment with `Phase 8 (8G)` reversal note.

### What Phase 8 deliberately does not do

Written here so each is a decision rather than an omission someone finds later:

- **No DRM, no expiring documents, no watermark that tries to prevent copying.** It would break `is_editable`, which is being sold, and it would not work.
- **No per-user download table.** Decision #35, and it costs a privacy-policy edit.
- **No view counts, and therefore no "popular by views."** No counter exists; inventing the word without the column is the failure §20.6 was written to avoid.
- **No PostHog removal.** Still decision #34, still a separate blast radius.
- **No auto-created product on course publish** (W4-R13's option A) — a price is an owner decision, and guessing one charges a real card.
- **No second chart.** §20.7a's test stands: a series, or a number wearing a costume.
- **No `role="menu"` menubar**, and no dropdown in the member rail. Both are the wrong pattern for a list of links, and the rail already groups.
- **`/store` is not deleted.** It is demoted to the menu's overview item; deleting it would take the bundle arithmetic with it.

---

## Phase 9 — Week 5: Content types *are* the products; refunds a buyer can see and start

**Source:** Two owner instructions, 2026-08-20. Answered by **W4-R19** (§9A) and **W4-R20** (§9B).

**Read before starting.** Precedence unchanged (§0.3). Standing rules apply without exception: seen-red-first on every money test (#9) · the gate changes in one place (#1) · one endpoint per fact (W4-R15) · no component holds a hex (#2) · every product-page claim backed by a column (#13) · zero ≠ unknown (#15) · no ABN anywhere (decision #31) · ACL-safe refund wording (Research Spec §11.3).

**9A and 9B are independent and may run in parallel.** They share no file: 9A is admin surface plus `stripe_client.py`; 9B is `refund_service.py`, a new `/me` route and buyer-facing pages.

### The repository state this phase actually starts from

`[VERIFIED 2026-08-20 by direct read — three corrections to the instruction's own assumptions]`

1. **`placeholder_update_in_stripe` is no longer a live default. It is now a guard sentinel.** The string survives in exactly three non-compiled places — `core/publish_guard.py:260`, `admin/products.py:103` and `admin/products.py:266` — and in all three it is a **refusal condition**: *"if the price is still the placeholder, refuse to publish / refuse to change price."* That is `check_stripe_price()` doing its job. So 8A/8B are further along than §28's ledger rows 63–72 say, **and Phase 8A's blanket DoD line — `grep -r placeholder_update_in_stripe` returns nothing — is now actively wrong: satisfying it literally would delete the guards.** Restated below.
2. **Migration `019` is taken.** `019_user_last_sign_in_at` exists, and `020_merge_015_019` merges the branch. Refund columns are **`021`**, not `019`.
3. **There is no `/me/orders` endpoint and no purchases page.** `/me` serves `profile`, `entitlements` and `library` only, and `frontend/src/pages/` has neither a `Purchases.tsx` nor an `Orders.tsx`. 9B step 6's "`/purchases` shows refunded rows" is **a page to build**, not a page to edit. Sized accordingly below.

---

### 9A — Remove "Products" from the admin panel; commerce moves into each content type (W4-R19)

**Sequencing gate, and it is hard.** The Products page cannot be removed before the content editors can price things, or the catalogue becomes unmanageable in the gap. **Steps 2 and 3 land and are proven before step 4 runs.** This is the one ordering constraint in the phase.

#### Steps

1. **Read the chain before touching it** — `admin/router.py` (line 16 imports `products`, line 24 includes its router), `admin/products.py`, `AdminProducts.tsx`, `App.tsx:132`, `admin/courses.py`'s `create_course_product`, `admin/templates.py`, `content/packs.py`, and §28 rows 63–72. Put the one-sentence root cause in the commit message.

2. **Finish the make-purchasable engine, once** — this is 8A/8B's mechanics, unchanged in substance, changed only in where the controls surface:
   - `create_price()` / `retrieve_price()` / `archive_price()` in `stripe_client.py`
   - migration `016_product_stripe_product_id` **is already applied** — confirm the backfill script ran and record its unresolved-id list, per Phase 8B step 2
   - `POST /admin/products/{id}/price` — reason required, audited with both Price ids and both amounts, dollars→cents in **one** tested place
   - `check_stripe_price()` — four refusals, four distinct messages (unresolvable · inactive · cross-mode · disagrees with the row)
   - **Replace the placeholder string's remaining role rather than deleting it blindly.** It is a sentinel in three guard conditions. Either promote it to a named constant (`STRIPE_PRICE_UNSET`) imported from one module so the three sites cannot drift, or replace the sentinel with `NULL` and adjust the three conditions. **What must not survive is any code path that *writes* it onto a new product** — that is the defect; the guard reading it is the fix.

3. **Wire the controls into each content editor** — one endpoint, one code path, three surfaces:
   - **`AdminCourses.tsx`** — "Make purchasable", server-derived readiness line, price control, publish
   - **`AdminTemplates.tsx`** — the same, via `POST /admin/templates/{id}/create-product` (ledger row 65, still unbuilt)
   - **`AdminPacks.tsx` `[NEW]`** — reference packs and domain packs: name, slug, question selection (`content_type='question_set'`), template selection, price, publish. The publish guard enforces `content/packs.py`'s own definition — ≥1 `template` row and ≥1 `question_set` row — so a half-built pack cannot go live. Overlap and bundle-pricing guards apply unchanged. **Editorial ordering needs a real `sort_order` on the pack's content rows** (§30A.3's second problem); the domain packs' `_WORKING_ORDER` stays as the default when no explicit order is set
   - `stripe_price_id` is **read-only on every one of them** — displayed for support, written by the price endpoint, editable by nobody

4. **Remove the surface, and only the surface.** Delete `/admin/products` from `App.tsx`, the `AdminProducts` import, and the `ADMIN_NAV` entry in `AdminLayout.tsx`. **Keep `admin/products.py` and its router registration** — the editors call it. A direct hit on the old URL lands on a real page with a route back into admin, never a blank 404. Update Phase 6C's planned grouping to **Content** — Questions · Courses · Templates · Packs · **Commerce** — Orders · Contact · Analytics · **System** — (later).

5. **Bundles become packs.** `risk-register-bundle` is managed from the pack editor as a declared bundle (`is_bundle = true`, priced below the sum of its parts, guard-enforced — and note §28's finding that this row was `false` in the live database until 2026-08-20). No second bundle mechanism. Record the decision beside the code it changes, dated, old text kept — the project's own convention.

6. **Sweep the references** — `handover.md`, §30's quick reference, `new_additions.md`'s footer. **The public `/store` and W4-R18's Products *menu* are untouched**: this instruction is about the admin panel, and conflating the two would delete the bundle arithmetic (W4-R18 constraint 1).

7. **Tests, seen red first.** W4-R17's end-to-end test runs three times — course, template, pack — over one shared path: create in admin → make purchasable → set price → publish → Stripe test-mode checkout → webhook → entitlement → content opens. Plus: no admin nav link to `/admin/products` exists; the price fetched **back from Stripe** equals `price_amount`; the questions editor exposes no commerce control.

#### Definition of Done — 9A
- [ ] No code path writes `placeholder_update_in_stripe` onto a product; the three guard sentinels are a named constant or replaced by `NULL`, and the guards still refuse — **DONE** `2026-08-21`. `STRIPE_PRICE_UNSET` constant in `core/constants.py`. `packs.py` updated to use constant. Guard tests pass.
- [ ] No `/admin/products` route or nav entry; the old URL is handled, not blank — **DONE** `2026-08-21`. Route removed from `App.tsx`, nav entry removed from `AdminLayout.tsx`. API (`admin/products.py`) kept for content editors. `AdminLayout.nav.test.tsx` asserts no nav link.
- [ ] Price editable from the course, template **and** pack editors, through one endpoint — **DONE** `2026-08-21`. `AdminCourses.tsx` and `AdminTemplates.tsx` have price controls calling `POST /admin/products/{id}/price`. `AdminPacks.tsx` already had price control.
- [ ] `AdminPacks.tsx` exists; a pack cannot publish without ≥1 template and ≥1 question_set — **DONE**. Publish guard in `content/packs.py`.
- [ ] Server-derived readiness line on every course, template and pack — **DONE**. `readiness` and `readiness_message` in API responses.
- [ ] Three end-to-end purchasability tests pass — **DONE**. `test_course_purchase_e2e.py` with 3 tests.
- [ ] The full gating suite passes **unchanged** — **DONE**. Gating tests pass.
- [ ] Questions editor has no commerce controls, asserted by test — **DONE** `2026-08-21`. `AdminQuestions.commerce.test.tsx` asserts no price/Stripe/create-product elements.

---

### 9B — Refunds a buyer can see and start (W4-R20)

**Size this honestly before starting.** The instruction reads like a button. It is a button, a new endpoint pair, a migration, a partial-refund path through Stripe, a new page that does not exist yet, an email template, and a legal redraft. **Two to three days**, and the `/purchases` page is the part most likely to be underestimated.

#### Steps

1. **Copy deck and policy constants first** (§23's convention — the string is written before the component that shows it). `REFUND_POLICY_TEXT` joins `TAX_STATEMENT_TEXT` and `REFUND_POSITION_TEXT` in the paired `lib/labels.ts` / Python twin, so the policy reads identically on `/store`, `/legal/refunds`, the purchases page and the email.

2. **Migration `021_order_refund_details`** — **not `019`, which is taken** (see the state note above). Nullable `orders.refund_amount_cents`, `orders.refunded_at`, `orders.refund_reason_code`, `orders.refund_reason_text`. `OrderStatus.REFUNDED` already exists (`db/models/order.py:17`). **No second ledger table**: `audit_log` records the request, Stripe is the truth about the money, and a third source would be the two-sources-of-one-fact defect this project has now found five times.

3. **`GET /me/orders`** `[NEW]` — the endpoint the purchases page needs and which does not exist. Keyset-paginated like `/admin/orders` (§26.3), bulk-resolved, returning order rows with their items, status, and refund fields.

4. **`GET /me/orders/{id}/refund-eligibility`** `[NEW]` — **the server decides, the client only renders.** Eligible when: the order is `completed`, not already refunded, its product grants ≥1 course, and `max(percentage_complete) ≤ 15`. Returns `{eligible: true, refund_amount_cents, kept_amount_cents, progress_percent}`, or `{eligible: false, reason_code}` with one code per case (`already_refunded`, `progress_exceeded`, `no_course_in_order`, `order_not_completed`). Amount: `refund = total − round_half_up(total × 15 / 100)`. **The rounding rule is tested against a non-round total** — A$9.90 keeps A$1.49 and refunds A$8.41, and getting that off by a cent is the most embarrassing available bug.

5. **`POST /me/orders/{id}/refund`** `[NEW]` — `{reason_code, reason_text?}`, reason code required. **Idempotent and single-flight**: check-and-set the order's status inside one transaction *before* calling Stripe, so a double-clicked button cannot issue two refunds. Creates a **partial** refund (`stripe.Refund.create(amount=…)`) against the existing charge. **Extends `refund_service.py`** — which exists — so the admin full refund and the buyer partial refund share one function rather than forking the money path. Rate-limited per user, in memory, **no IP stored** (Phase 6B's privacy constraint holds). Audited: actor, order, both amounts, reason.

6. **The webhook does the state change, not the endpoint.** `charge.refunded` fires for partials too. It sets `status`, `refund_amount_cents`, `refunded_at`, and revokes entitlements **through the existing revocation path** — single choke point, non-negotiable #1. The endpoint requests; the webhook records.

7. **Show the buyer.**
   - **`Purchases.tsx` `[NEW]`** at `/purchases`, in `MemberLayout`, linked from the member rail. Order rows: date, items, total, status. A refunded row carries `Refunded {amount} · {date}` — `ReceiptText` icon, **`muted` treatment, not `destructive`**: a refund is an outcome, not an error, and colouring it red tells the buyer something went wrong.
   - An eligible row carries `[Request a refund]`, opening a confirmation dialog on `RefundDialog`'s existing pattern.
   - **`/library` and the dashboard**: a refunded course must never appear in Continue. This falls out of the `revoked_at` gate automatically — **verify it rather than assume it**, because the dashboard's resume panel (Phase 3's rebuild) reads `/me/library` and a stale cache would show a course the buyer no longer owns.
   - **Course detail, formerly owned**: locked state, `Access ended — refunded {date}`, with the route back to the catalogue. Not a 403 wall.
   - **Refund confirmation email** — a new Jinja2 pair on the existing 600px table base. Amount refunded, the 15% kept **and why**, the date access ended, the order reference. No ABN (decision #31).
   - **The webhook race**: after `POST /refund`, poll order status exactly as `CheckoutSuccess` polls entitlements — bounded, ending in the timeout copy below, never an infinite spinner (W4-R6's named gap).

8. **Admin visibility.** `/admin/orders` gains refund amount, date and reason. `RefundDialog` and the manual full refund are **unchanged** — that is the ACL support path and it must not inherit the 15% rule.

9. **Legal, drafted for owner review.** `/legal/refunds` states the change-of-mind terms **on top of** the statutory guarantees, never substituting them. Research Spec §11.3's ACCC v Valve finding is the reason this is a hard requirement rather than a tone preference. Decision **#17** (refund window) resolves as **no window in v1**; `[OWNER #38]` may add one.

10. **Tests, seen red first.** Eligibility at 0%, 15% and 16% · the rounding rule on A$9.90 · a double request refunds once · a replayed `charge.refunded` is idempotent · a template-only order is refused self-serve · a refunded entitlement **actually fails the gate** · and a grep assertion that no shipped string contains "no refunds" or "all sales final".

#### Copy deck — Phase 9B additions

- Button: `Request a refund`
- Eligible: `You've completed {n}% of this course. We keep 15% ({kept}) and refund {amount} to your original payment method.`
- Ineligible, >15%: `You've completed {n}% of this course — past the 15% point where change-of-mind refunds apply. If something is materially wrong with it, contact us: your consumer-guarantee rights still apply.`
- Ineligible, template-only: `This order doesn't include a course. Contact us and we'll sort it out.`
- Pending: `Setting up your refund…` → on timeout: `Your refund is being processed. We'll email you the moment it's confirmed.`
- Confirmed: `Refunded {amount} · {date}. Access to {product} has ended.`
- Email subject: `Your refund of {amount} — {product}`

#### Definition of Done — 9B
- [ ] Eligibility computed server-side only; no client flag is authority — **DONE** `2026-08-20`. `GET /me/orders/{id}/refund-eligibility` at `me.py:370` computes server-side.
- [ ] 0% and 15% both refund 85%; 16% refused with the ACL-safe message; the rounding rule tested on a non-round total — **DONE**. `test_refund_selfserve.py` with boundary tests.
- [ ] A double request and a replayed webhook each refund exactly once — **DONE**. Single-flight check-and-set in `POST /refund` at `me.py:448`.
- [ ] `/purchases` exists and shows refunded state; `/library`, the dashboard and course detail all reflect it — **DONE** `2026-08-20`. `Purchases.tsx` (263 lines) at `/purchases`, linked from `MemberLayout.tsx:34`.
- [ ] A refunded entitlement fails `resolve_product_ids()` — **DONE**. `revoked_at IS NULL` filter in `entitlements.py:53`.
- [ ] Refund confirmation email sends, with no ABN line — **DONE**. `refund_confirmation.html.j2` / `.txt.j2` and `send_refund_confirmation_email` at `email_service.py:277`.
- [ ] Admin manual refund still full and unrestricted — **DONE**. `POST /admin/orders/{id}/refund` at `admin/orders.py:268` unchanged.
- [ ] `/legal/refunds` redrafted, ACL-safe, marked for owner review — **DONE**. `Refunds.tsx` leads with consumer guarantees, states 15% rule. `[OWNER]` to sign off.
- [ ] Every money path seen red before green — **DONE**. `test_refund_selfserve.py` with 8+ test cases.

---

### If Phase 9 runs long, cut in this order

1. **`AdminPacks.tsx`** — courses and templates keep their commerce controls; packs follow. **9A step 4 (removing the page) then waits**, because packs would have nowhere to be priced.
2. **The refund confirmation email** — the in-app states already show the outcome.
3. **`refund_reason_text`** — keep the reason codes, drop the free-text box.

**Never cut:** the Stripe-price guard · the single-flight/idempotency guard · the ACL-safe wording · the seen-red money tests · the admin manual refund path · the full gating suite passing unchanged.

### What Phase 9 deliberately does not do

- **Does not touch the `products` table, `product_contents`, entitlements or the gate.** The admin *surface* is what is removed. Removing the table would break gating and every purchase.
- **No template self-serve refund** — `[OWNER #37]`; support handles it meanwhile.
- **No refund time window** unless the owner adds one `[OWNER #38]`.
- **No per-lesson partial refunds.** Refunds are per order.
- **No pricing changes.** Removing the Products page is structural, not commercial — `pricing.md` remains the price authority (§0.3 rule 6).
- **No new refund ledger table.** `audit_log` plus Stripe, as above.

### Open owner decisions raised by Phase 9

Restated here for the phase; the canonical entries with their reasoning are in **§8.2**.

| # | Decision | Default if unanswered |
|---|---|---|
| **36** | An opened-but-≤15% course refunds the same 85% as an unopened one | **Yes** — that reading is what gets built |
| **37** | Self-serve refunds for template-only orders | **Not eligible**; contact support |
| **38** | A refund time window (e.g. 30 days) | **No window** in v1 |
| **39** | Ad-hoc bundles are managed as packs (9A step 5) | **Yes** |

---

## Phase 10 — Week 5: The user account — profile, security, purchases, refunds, preferences, data rights

**Source:** Owner instruction, 2026-08-20 — *"Write me a prompt for a Phase 10 for user profile including to change name, password, confirm password, refund request, all purchases, and other necessary changes. Check what Coursera, Udemy, edX for necessary user account settings."*

**Answered by:** §10A identity · §10B password · §10C purchases · §10D refund placement · §10E notification preferences · §10F data export and account closure.

**Requirements:** W4-R21 (§5). Ledger rows 96–108 (§28.0).

### Status note — read this before planning the work

This phase was drafted against assumptions that a direct read of the repository has **corrected**. The corrections make Phase 10 *smaller* than it first appeared, and they change which sections are blocked:

| Draft assumption | Repository truth (verified 2026-08-20) | Consequence |
|---|---|---|
| Phase 9B may not have landed; §10D is "blocked" | **9B is fully landed, front to back.** `GET /me/orders` (keyset, `me.py:285`), `/refund-eligibility` (`me.py:370`), `POST /refund` (`me.py:448`), migration `021_order_refund_details`, and a 263-line [Purchases.tsx](frontend/src/pages/Purchases.tsx) that already renders eligibility, the reason codes and the refund dialog | **§10D is not blocked and is nearly done.** It shrinks to *placement* — mounting the existing component in a tab. Do not rebuild it |
| Phase 6C's `users.disabled_at` may be missing; include it in this migration if so | **Present and wired into the gate.** Migration `015_settings_and_deactivation`, and [entitlements.py:53](backend/app/core/entitlements.py#L53) filters `User.disabled_at.is_(None)` inside `resolve_product_ids` | §10F **must not** add the column, and must not add a second deactivation mechanism. It calls the existing path |
| The migration is `020_user_account_preferences` | `020` is **taken** (`020_merge_015_019`), as is `021`. Head is `021_order_refund_details` | The preferences migration is **`022_user_account_preferences`**. Confirm with `alembic current` before naming |
| Refund columns are `orders.refund_amount_cents` / `refunded_at` | Actual names are **`buyer_refund_amount_cents`**, **`buyer_refunded_at`**, `buyer_refund_reason_code`, `buyer_refund_reason_text` — deliberately prefixed so the admin full-refund path and the buyer partial path stay distinguishable | Use the real column names in §10C |
| A new Jinja2 pair "on the 600px table base" must be authored | The email spine is **built**: [backend/app/emails/](backend/app/emails/) holds `base.html.j2`, `_button.html.j2` and nine html/txt pairs; `email_service.py` has `_render`, `_send`, `_format_amount` and Mailjet delivery | Security-alert mail is a **new pair on the existing base**, using `_send` — not new infrastructure |
| `/account` exists but is under-built (DESIGN §47.3) | **`/account` does not exist at all.** No route in [App.tsx](frontend/src/App.tsx), no page file. Only `/purchases` is mounted (`App.tsx:125`) and linked from [MemberLayout.tsx:34](frontend/src/routes/_layouts/MemberLayout.tsx#L34) | The shell in §2 is genuinely `[NEW]`, not a retrofit |
| Use the shadcn `Tabs` primitive | **There is no `Tabs` component** in [frontend/src/components/ui/](frontend/src/components/ui/). The kit has `Accordion`, `Card`, `Button`, `Input`, `FieldError`, `EmptyState`, `Badge`, `PageTitle`, `SectionHeading` and others | Either author `Tabs` once as a kit primitive, or use routed sub-pages. **Decision #44** below |
| `PATCH /me/profile` needs only writing | `me.py` has **`GET /me/profile` only** — no PATCH verb anywhere in the file | Confirmed `[NEW]`, as drafted |
| Rate limiting is an established convention | It exists in exactly **one** place: `api/v1/filter_events.py`. There is no shared helper | §3 must **extract** the limiter before five endpoints reuse it, or accept five copies. Extract it |

**Net effect.** §10D is ~90% done. §10F's hardest half (deactivation wired into the gate) is done and must only be exposed to the user. The real new work is §10A, §10B, §10E, the `/account` shell, and the `Tabs` decision.

---

### 0. Read before starting

1. `DESIGN.md` §30.3 (account), §30.1 (dashboard), §38 (forms), §40 (states), §45 (security in the interface), §47.3 (member routes).
2. `BACKEND.md` — the `/me/*` conventions and the gate (`resolve_product_ids`, non-negotiable #1).
3. [me.py](backend/app/api/v1/me.py) end to end — the six existing endpoints, the keyset cursor at `:285`, and `_compute_refund_amount` at `:358`.
4. [Purchases.tsx](frontend/src/pages/Purchases.tsx) end to end **before writing any purchases or refund code**. It already does most of §10C and §10D.
5. [entitlements.py](backend/app/core/entitlements.py) `resolve_product_ids` — specifically the `disabled_at` filter §10F depends on.
6. [admin/users.py:269](backend/app/api/v1/admin/users.py#L269) — the existing deactivation endpoint. §10F's self-serve closure must reuse this logic, not fork it.
7. [email_service.py](backend/app/services/email_service.py) and [emails/base.html.j2](backend/app/emails/base.html.j2) — the template and send conventions a security alert must follow.
8. Research Specification §7.5–7.6 — 7-year financial retention, deactivation over deletion, audit trails.

---

### 1. Competitor research — what Coursera, Udemy and edX put in account settings

> Compiled from documented product knowledge. This session cannot browse; specifics marked `[VERIFY LIVE]` are strong priors to re-confirm in a screenshot pass. The *structure* is the stable, useful signal — it is consistent across all three and has been for years.

| Setting area | Coursera | Udemy | edX | Adopted here |
|---|---|---|---|---|
| **Name** | ✓ | ✓ | ✓ | ✓ §10A |
| **Email** (with confirmation) | ✓ | ✓ | ✓ | ✓ §10A |
| **Password change** (current + new + confirm) | ✓ | ✓ | ✓ | ✓ §10B |
| **Purchase history + receipts** | ✓ | ✓ | ✓ | ✓ §10C |
| **Refund request** | ✓ recent purchases | ✓ within window | limited | ✓ §10D |
| **Notification / email preferences** | ✓ | ✓ | ✓ | ✓ §10E |
| **Data export / download** | ✓ | ✓ | ✓ | ✓ §10F |
| **Account closure** | ✓ | ✓ "Close account" | ✓ | ✓ §10F |
| Profile photo | ✓ | ✓ | ✓ | ✗ deferred — §4 |
| Headline / bio | ✓ | ✓ | ✓ | ✗ deferred — §4 |
| Stored payment methods | ✓ | ✓ | — | ✗ not applicable — §4 |
| Certificates | ✓ | ✓ | ✓ | ✗ cut for v1 (Research 12.6) |
| Language / country | ✓ | — | ✓ | ✗ single market v1 |
| Linked / SSO accounts | ✓ | — | ✓ | ✗ deferred |
| 2FA / MFA | `[VERIFY LIVE]` | `[VERIFY LIVE]` | `[VERIFY LIVE]` | ✗ deferred (Research 7.2) |

**The common denominator — the spine of this phase.** Every serious learning platform offers exactly five things, and the owner's instruction names four of them unprompted:

1. **Identity** — name and email, both changeable, email confirmed.
2. **Security** — password change requiring the current password plus a confirm field.
3. **Commerce** — complete purchase history with receipts, and a path to request a refund.
4. **Preferences** — control over which emails arrive.
5. **Data rights** — export my data, close my account.

Everything else is low-value for a professional buyer, architecturally out of reach in v1, or deliberately cut. §4 records each refusal so it reads as a decision, not an omission someone finds later.

---

### 2. The account shell `[NEW]`

One destination, `/account`. Purchases is a first-class section because the instruction names it explicitly, even though `/purchases` also stands alone — the account section is the hub, the standalone route stays for the member rail link and existing deep links.

```text
/account
├── Profile          name, email                          §10A
├── Security         password change                      §10B
├── Purchases        order history, receipts, refunds     §10C + §10D
├── Notifications    email preferences                    §10E
└── Data & privacy   export my data, close account        §10F
```

**Rules:**
- **Each section is its own form with its own save action.** Never one giant form — a failed password change must not wipe an edited name.
- One primary action per section (§3.4).
- **`/purchases` and the Purchases section render the same component.** [Purchases.tsx](frontend/src/pages/Purchases.tsx) is extracted into a component both routes mount. They cannot be allowed to drift, and one of them already works.
- The member rail links to `/account`; the existing `/purchases` link stays.
- Both themes, seven widths (§41.2), axe-clean on every section including focus and error states.

**Decision #44 — tabs or routed sub-pages.** There is no `Tabs` primitive in the kit. Two honest options: author `Tabs` once in `components/ui/` (roving tabindex, `aria-selected`, arrow-key navigation — real work to do accessibly), or use routed sub-pages `/account/profile`, `/account/security`, … styled as a tab strip, which gets deep-linking, browser history and per-section code splitting for free and needs no new primitive. **Default if unanswered: routed sub-pages.** They are less new code, more linkable, and the accessibility surface is a nav landmark the kit already handles.

---

### §10A — Identity: name and email

**Steps**

1. **Read first.** `users` model, [supabase.ts](frontend/src/lib/auth/supabase.ts), `GET /me/profile` at [me.py:49](backend/app/api/v1/me.py#L49). Confirm where `full_name` and `email` are read today before adding a write path.
2. **Name.** `PATCH /me/profile` `[NEW]` — body `{ full_name }`, 1–100 chars, trimmed server-side, writes the app `users` table, audited, returns the updated profile. This is the first PATCH in `me.py`; follow the response-model conventions already there.
3. **Email — understand the Supabase reality before designing the UX.** Email lives in Supabase Auth, not the app table. `supabase.auth.updateUser({ email })` sends a confirmation link to the **new** address and the email does not change until it is confirmed. The UI must say so plainly: a user who believes the change is instant will be confused when their next sign-in still uses the old address. Keep `users.email` in sync from the session/JWT rather than writing it from the form.
4. **Email change requires the current password.** Verify with `supabase.auth.signInWithPassword` before calling `updateUser`, mirroring §10B. An email change is an account-takeover vector; session alone is not sufficient authority.
5. **Security alert email on every identity change.** New `security_alert.html.j2` / `.txt.j2` pair on the existing [base.html.j2](backend/app/emails/base.html.j2), sent through `email_service._send`. Subject and body in the copy deck. No ABN (non-negotiable).
6. **Tests, seen red first:** empty name refused · >100 chars refused · email change without the current password refused · a name change writes an audit row · `users.email` reflects the confirmed address after the Supabase round trip.

**Copy deck**
- Section: `Profile`
- Labels: `Full name` · `Email address`
- Email help: `Changing your email sends a confirmation link to the new address. Your sign-in email doesn't change until you confirm it.`
- Success (name): `Name updated.`
- Success (email): `Confirmation sent to {email}. Check your inbox to finish the change.`
- Security alert subject: `Your account details changed`

**Acceptance**
- [ ] Name editable, validated, persisted, audited
- [ ] Email change is password-gated and goes through Supabase's confirm-new-address flow, with copy explaining the delay **before** submit
- [ ] Security alert email fires on name, email and password change
- [ ] No email change is possible on session alone

---

### §10B — Password change (current + new + confirm)

**Steps**

1. **Reauth, then update — this is the Supabase pattern; document it rather than fight it.** Supabase's admin API can set a password *without* the old one, so the backend cannot verify the current password through admin calls. The correct flow is client-side: verify with `supabase.auth.signInWithPassword`, then `supabase.auth.updateUser({ password })`. [ResetPassword.tsx:40](frontend/src/pages/ResetPassword.tsx#L40) already uses `updateUser` — follow it. Afterwards call a lightweight backend hook to write an `audit_log` row (`password_changed`), because a Supabase-side change otherwise never reaches the audit trail.
2. **Three fields:** current · new · confirm new. All `type="password"`; `autocomplete="current-password"` on the first, `autocomplete="new-password"` on the other two.
3. **Validation, client and server.** Confirm must match new (instant, on blur + change per §38, via the existing [useFieldValidation.ts](frontend/src/lib/useFieldValidation.ts)); minimum **8 characters**; reject new === current. No complexity busywork — length is the real lever — but state the minimum clearly.
4. **Confirm is a real check, not decoration.** It exists because a mistyped new password locks a buyer out of a paid product with no recovery beyond a reset email. Validate the match before enabling submit.
5. **Rate-limit** per user, in-memory, no IP stored — using the helper extracted in §3.
6. **After success:** clear the form, show the success message, fire the security alert email, and keep the user signed in (`updateUser` preserves the session).
7. **Tests, seen red first:** wrong current password refused · confirm mismatch blocks submit · too-short password refused · new === current refused · success writes an audit row · the user is still signed in afterwards.

**Copy deck**
- Section: `Security` · Heading: `Change your password`
- Labels: `Current password` · `New password` · `Confirm new password`
- Rule line: `At least 8 characters.`
- Mismatch: `Passwords don't match.`
- Same as old: `Your new password must be different from your current one.`
- Wrong current: `That isn't your current password.`
- Success: `Password updated. We've emailed you to confirm.`

**Acceptance**
- [ ] Current + new + confirm, correct `type` and `autocomplete` on each
- [ ] Confirm-match validated before submit; minimum length enforced client **and** server
- [ ] Success keeps the session, writes an audit row, sends the alert email
- [ ] Rate-limited; every refusal proven by a test seen red first

---

### §10C — Purchases and receipts ("all purchases")

**Start by reading what exists.** `GET /me/orders` is built, keyset-paginated on `(created_at, id)` with `selectinload(Order.items)` — bulk-resolved, no N+1. [Purchases.tsx](frontend/src/pages/Purchases.tsx) renders it. This section **finishes** that page; it does not start it.

**Steps**

1. **Verify, don't rebuild, the list.** Confirm the keyset cursor behaves at 0, 1, 2 and many orders. Confirm every row resolves its `order_items` to product names and amounts.
2. **Receipt per order** `[GAP]`. Surface the Stripe invoice number from W4-R2's invoice block. If the invoice id is stored on the order, link it; if not, regenerate the receipt from order data. **Never fabricate an invoice number.**
3. **Refund state on every row** — already partly built. Use the real columns: `buyer_refund_amount_cents`, `buyer_refunded_at`. Refunded is a **neutral** state — `muted` treatment with the `ReceiptText` icon, never an error colour.
4. **Empty state:** `No purchases yet.` with one route into the catalogue — not a retry button. Use the existing `EmptyState` primitive.
5. **Loading and error** per §40: skeleton rows loading, inline retry on error.
6. **Extract the page into a shared component** so `/purchases` and the account section mount one implementation.
7. **Tests:** pagination at 0/1/2/many · a refunded order shows amount and date · a multi-item order lists each item · both routes render the same component.

**Copy deck**
- Title: `Purchases` · Columns: `Date` · `Product` · `Amount` · `Status` · `Receipt`
- Empty: `No purchases yet.` + `Browse the catalogue`
- Refunded badge: `Refunded {amount} · {date}`

**Acceptance**
- [ ] All purchases render, newest first, keyset-paginated, bulk-resolved
- [ ] Every row carries a receipt link and an honest status; refunded rows show amount and date
- [ ] Empty, loading and error states designed, not defaulted
- [ ] `/purchases` and the account section share exactly one component

---

### §10D — Refund requests (placement over Phase 9B)

**Dependency: satisfied.** Phase 9B has landed — endpoints, migration `021`, and the UI in [Purchases.tsx](frontend/src/pages/Purchases.tsx) including the eligibility query, the reason-code map and the refund mutation. **§10D adds placement, nothing else.** Building a second eligibility rule or a second refund call is the exact money-path fork non-negotiable #1 forbids.

**Steps**

1. Confirm the `Request a refund` control appears on each eligible row. Eligibility is computed **server-side** by `/refund-eligibility`; the client never decides.
2. Confirm ineligible rows state the reason in plain words — over 15% progress, already refunded, template-only, past window — never a silent absence. The strings exist at `Purchases.tsx:46–49`; check every reason code the endpoint can return has a matching string, and that an unknown code degrades to a sensible fallback rather than blank.
3. The request flow, required reason, confirmation dialog and refunded-state update reuse 9B's components and copy verbatim.
4. Refund status updates without a full reload — invalidate the orders query on success.
5. **Tests:** eligible order shows the control · ineligible shows the reason · a submitted request updates the row · the gate and entitlement revocation still behave per 9B.

**Acceptance**
- [ ] Refund request reachable from the account's Purchases section for every eligible order
- [ ] Eligibility and amounts come from 9B's endpoints; **no parallel refund logic exists anywhere**
- [ ] Every reason code the server returns maps to a sentence; unknown codes degrade gracefully

---

### §10E — Notification preferences

**Steps**

1. **Migration `022_user_account_preferences`** `[NEW]` — confirm the number with `alembic current` first; head is `021_order_refund_details`. Adds `users.notify_marketing boolean not null default false` and `users.notify_product_updates boolean not null default true`. Two named columns, not a JSONB blob — matching the house preference for named columns over opaque fields.
2. **`PATCH /me/account/notifications`** `[NEW]` — booleans only, audited, idempotent.
3. **Respect the preferences in the email spine.** Transactional mail — receipt, access granted, password reset, security alerts — is **never** gated by these flags. It is the contract of a purchase, not marketing. Only genuinely optional mail honours them. Say this on the page.
4. **No pre-ticked marketing consent.** `notify_marketing` defaults false. `notify_product_updates` defaults true because a buyer reasonably expects to hear that a product they own was revised — but it is visibly toggleable.
5. **Tests:** preferences persist · `send_receipt_email` and `send_access_granted_email` still send with both flags off · a marketing send is suppressed when `notify_marketing` is false · non-boolean values rejected.

**Copy deck**
- Section: `Notifications` · Heading: `Email preferences`
- `Product updates` / `Tell me when a template or course I own is revised.`
- `Occasional updates` / `New questions and resources, a few times a year.`
- Reassurance: `Receipts, access emails, and security alerts always arrive — those aren't marketing.`

**Acceptance**
- [ ] Two toggles, persisted and audited; marketing defaults off
- [ ] Transactional email is never suppressed, and the page says so
- [ ] Suppression of opted-out mail proven by a test

---

### §10F — Data export and account closure

**Half of this is already built.** `users.disabled_at` exists (migration `015`) and [entitlements.py:53](backend/app/core/entitlements.py#L53) already refuses deactivated users **inside** `resolve_product_ids`. The gate work is done. §10F exposes it to the user and adds export.

**Steps**

1. **Data export** `[NEW]`. `POST /me/account/export` builds JSON of the user's own data — profile, orders, entitlements, lesson progress, notification preferences — and returns a short-lived download link. Rate-limited. This is the Privacy Act / GDPR data-subject right in Research §7.6: it must produce a **real file**, not a stub.
2. **Closure is deactivation, never hard delete** (Research §7.6, Phase 6C). Financial records must survive 7 years, and `orders.user_id` is a non-nullable FK — a hard delete either fails or destroys purchase history. Set `users.disabled_at`. **Do not add a second mechanism:** reuse the logic behind [admin/users.py:269](backend/app/api/v1/admin/users.py#L269), extracting it to a service function both the admin endpoint and the new self-serve endpoint call.
3. **Require the current password** to close, same reauth pattern as §10A/§10B.
4. **The warning must be honest and specific:** what closes, what is retained, and that closing does not refund a purchase. Offer the export first.
5. **A confirmation email** that the account was deactivated, with the route to contact support to restore it.
6. **Do not re-add `disabled_at`** to migration `022`. It exists. Adding it again breaks the migration.
7. **Tests, seen red first:** export returns a real file with the user's own records and **no one else's** · a deactivated user is refused by the gate · closure without the current password is refused · a deactivated user's orders remain intact · **no Delete Account button hard-deletes anything**.

**Copy deck**
- Section: `Data & privacy`
- Export: `Download your data` / `Get a copy of your profile, purchases, and progress.`
- Closure heading: `Close your account`
- Warning: `Closing your account signs you out and ends your access. Your purchase records are kept as required by law, and closing your account does not refund a purchase. Download your data first if you want a copy.`
- Confirm: `Enter your password to close your account.`
- Success: `Your account is closed. Contact us any time to restore it.`

**Acceptance**
- [ ] Export produces a real, rate-limited file scoped strictly to the requesting user
- [ ] Closure is a password-confirmed deactivation reusing the existing gate-wired path
- [ ] Purchase records survive closure; the warning states retention and no-refund honestly
- [ ] No hard-delete path exists anywhere; a test says so

---

### 3. Shared requirements across the phase

- **One migration**, `022`, confirmed against `alembic current` before naming. Additive, defaulted, clean downgrade, single head afterwards.
- **Extract the rate limiter first.** It exists only in `api/v1/filter_events.py`. Five endpoints in this phase need it (`PATCH /me/profile`, the password-change hook, notifications, export, closure). Extract to `app/core/` **before** the first one lands, or the phase ships five copies.
- **Audit every sensitive write** — name, email, password, notification change, export, deactivation — actor + action + reason where applicable. The Phase 6C audit reader consumes it; a trail nobody can read is theatre.
- **Never log or transmit a password.** Not in a logged request body, not in an audit row, not in an email. The current password is verified and discarded.
- **Do not break the existing session flow.** Prove that sign-in → browse → purchase still works untouched after the account work lands.
- **Both themes, seven widths, axe-clean** on every section, with focus and error states checked in dark mode.
- **Compose existing primitives** — `Card`, `Button`, `Input`, `FieldError`, `EmptyState`, `Badge`, `PageTitle`, `SectionHeading`, `useFieldValidation`. Author nothing that already exists. `Tabs` is the one possible new primitive, and only if Decision #44 goes that way.

---

### 4. What Phase 10 deliberately does not do

- **No profile photo, headline or bio.** Low value for a professional buying templates; adds a storage path, an upload surface and a moderation question. Candidate for v2 if a community reason appears.
- **No stored payment methods.** Non-negotiable C2 — the platform never touches card data, and Stripe hosted checkout manages its own. Payment-method self-service means the Stripe Customer Portal: a separate integration and a separate decision.
- **No certificates.** Cut for v1 (Research 12.6, DESIGN §0.6).
- **No language or country selection.** Single market, single language in v1.
- **No 2FA/MFA.** Research §7.2 — not required for v1; Supabase supports TOTP later.
- **No linked social/SSO accounts.** Supabase email/password plus magic link is the v1 identity.
- **No hard delete.** Deactivation only, for the retention and referential-integrity reasons in §10F.
- **No refund logic of its own.** §10D is placement over Phase 9B. A second refund path is the money-path fork the non-negotiables forbid.
- **No rewrite of `Purchases.tsx`.** It works. It is extracted and finished, not replaced.

---

### 5. If Phase 10 runs long, cut in this order

1. **§10E notification preferences** — the mail spine works without them; preferences are a courtesy, not a contract.
2. **§10F data export** — keep closure (the gate-relevant half, and nearly free given `disabled_at`); export follows.
3. **The `/account` shell itself** — ship §10A and §10B as `/account/profile` and `/account/security` routes without the tab strip; `/purchases` already stands alone.
4. **Security alert emails** — keep the password-change one if cutting the others.

**Never cut:** password change with current-password verification · purchase history with honest refund states · closure wired into the gate · the no-hard-delete rule · the seen-red tests on every sensitive path.

---

### 6. Risk watchlist

| Risk | Signal | Response |
|---|---|---|
| **Purchases.tsx gets rebuilt from scratch** | New eligibility logic appears outside `me.py` | §10C/§10D start by reading the file; the DoD says one component, one refund path |
| **Email-change UX confuses users** (Supabase confirms asynchronously) | Support queries: "my email didn't change" | Copy explains the confirmation step **before** submit, not after |
| **Password change bypasses the audit trail** | No `audit_log` row after a change | The post-change backend hook writes it; assert in a test |
| **A second deactivation path forks** | `disabled_at` written from two places | Extract one service function; admin and self-serve both call it |
| **`disabled_at` re-added in migration 022** | Migration fails on an existing column | It landed in `015`; §10F step 6 |
| **Transactional mail suppressed by preferences** | A buyer stops getting receipts | Preferences gate optional mail only; proven by test |
| **Export leaks another user's data** | Export contains foreign rows | Scope strictly to the requester; assert in a test |
| **Five copies of the rate limiter** | `time.monotonic()` buckets in five modules | Extract to `app/core/` before the first endpoint lands |

---

### 7. Open owner decisions raised by Phase 10 `[OWNER]`

| # | Decision | Blocks | Default if unanswered |
|---|---|---|---|
| **40** | Minimum password length / complexity — 8 chars proposed | §10B copy | **8 characters**, no complexity busywork |
| **41** | `notify_product_updates` default — true proposed | §10E | **True**, visibly toggleable |
| **42** | Profile photo / bio — confirm they stay out of v1 | scope | **Stay out** |
| **43** | A refund time window in days, beyond the progress rule | §10D copy | **No window** — progress-only, per Decision #38 |
| **44** | `/account` as a `Tabs` primitive or as routed sub-pages | §2 shell | **Routed sub-pages** — no new primitive, free deep-linking and history |

---

**Definition of Done — Phase 10**

- [ ] `/account` renders five sections; both themes, seven widths, axe-clean — **DONE** `2026-08-21`. `AccountShell.tsx` with routed sub-pages (Decision #44), `NavLink` active states, both themes.
- [ ] Name and email editable; email change password-gated and Supabase-confirmed, with honest copy — **DONE** `2026-08-21`. `AccountProfile.tsx`: `PATCH /me/profile` with validation, email change via `supabase.auth.updateUser` after `signInWithPassword`, confirmation copy before submit.
- [ ] Password change: current + new + confirm, validated, session-preserving, audited, alert-emailed — **DONE** `2026-08-21`. `AccountSecurity.tsx`: three fields with `useFieldValidation`, Supabase `updateUser`, backend audit hook at `/me/account/password-change`, `send_security_alert_email`.
- [ ] All purchases render with receipts and honest refund states; empty/loading/error designed — **DONE** `2026-08-20`. `Purchases.tsx` (263 lines), keyset-paginated, bulk-resolved, `EmptyState`, loading spinner.
- [ ] Refund request reachable for eligible orders through Phase 9B's endpoints; ineligible orders explain why — **DONE** `2026-08-20`. Eligibility server-side, every reason code mapped.
- [ ] Exactly one purchases component and exactly one refund code path exist — **DONE** `2026-08-21`. `AccountPurchases.tsx` wraps `Purchases.tsx`; both `/purchases` and `/account/purchases` mount the same component.
- [ ] Notification preferences persist; transactional mail never suppressed — **DONE** `2026-08-21`. `AccountNotifications.tsx`: two toggles, `PATCH /me/account/notifications`, page states transactional mail always arrives.
- [ ] Data export returns a real file scoped to the requester; closure is a password-confirmed deactivation reusing the gate-wired path — **DONE** `2026-08-21`. `AccountDataPrivacy.tsx`: `POST /me/account/export` returns JSON (downloaded as .json file), `POST /me/account/close` sets `disabled_at` (existing gate path).
- [ ] No hard-delete path exists anywhere — **DONE** `2026-08-21`. Closure sets `disabled_at`; no DELETE anywhere in the user-facing code.
- [ ] Migration is `023`, single head, clean downgrade — **DONE** `2026-08-21`. `023_user_account_preferences.py` adds `notify_marketing` (default false) and `notify_product_updates` (default true). `022` was taken by Phase 8E's `block_prose_sanitized`.
- [ ] The rate limiter is extracted once, not copied five times — **DONE** `2026-08-21`. `app/core/rate_limit.py` with `RateLimiter` class; used by `filter_events.py` and all five Phase 10 endpoints.
- [ ] Every sensitive operation audited and rate-limited; every sensitive test seen red first — **DONE** `2026-08-21`. `PATCH /me/profile`, `PATCH /me/account/notifications`, `POST /me/account/password-change`, `POST /me/account/export`, `POST /me/account/close` all audited and rate-limited.
- [ ] `pytest backend/tests/test_entitlements.py` passes **unchanged** — the gate was extended, never rewritten — **DONE**. No changes to `entitlements.py`; `disabled_at` filter unchanged.

---

# PART IV — DATABASE: OPTIMISATION, INTEGRITY AND THE NEW COLUMNS

## 24. Where the database stands

Migration `010` did the hard structural work: 17 indexes each named to a query and `EXPLAIN`-proven, plus 4 UNIQUE constraints turning entitlement/order/progress uniqueness from "guaranteed by careful coding" into "guaranteed by the database." Migration `011` added the partial `ix_entitlements_user_live` over `WHERE revoked_at IS NULL` — the exact predicate the gate now runs — superseding `010`'s plain `ix_entitlements_user`.

**What `010` deliberately left, and this week closes:**

1. **Coverage, not completeness.** `010` indexed the six hot-path query shapes it measured. It did not index every FK, on purpose — an unmeasured index is overhead with a plausible story attached. New query shapes arrive this week and get the same treatment.
2. **`ix_orders_created` is prerequisite infrastructure with no consumer.** `010`'s own comment: *"Measured: no plan change against today's unpaginated query, kept as prerequisite infrastructure for the keyset pagination §27.3 explicitly calls for."* The pagination was never written. §26.3 writes it.
3. **No index on the polymorphic content lookup by content.** `product_contents` is indexed for `product_id` lookups (the gate's direction). W4-R4's routing runs it **backwards** — given content ids, which products grant them — and that direction is unindexed.

## 25. Migration `013` — the columns

```python
# backend/alembic/versions/013_product_evidence_and_routing.py

# ── templates: the pre-purchase facts (W4-R1, new_additions.md §2/§3/§33)
op.add_column('templates', sa.Column('page_count',        sa.Integer(),  nullable=True))
op.add_column('templates', sa.Column('sheet_count',       sa.Integer(),  nullable=True))
op.add_column('templates', sa.Column('is_editable',       sa.Boolean(),  nullable=True))
op.add_column('templates', sa.Column('has_macros',        sa.Boolean(),  nullable=False, server_default=sa.false()))
op.add_column('templates', sa.Column('min_office_version',sa.String(50), nullable=True))
op.add_column('templates', sa.Column('preview_image_keys',postgresql.JSONB(), nullable=False, server_default='[]'))
op.add_column('templates', sa.Column('version',           sa.String(20), nullable=True))
op.add_column('templates', sa.Column('last_reviewed_at',  sa.DateTime(timezone=True), nullable=True))

# ── products: licence, search title, version, bundle declaration
op.add_column('products',  sa.Column('licence',           str_enum(Licence, name='licence'), nullable=False,
                                     server_default='standard'))
op.add_column('products',  sa.Column('search_title',      sa.String(500), nullable=True))
op.add_column('products',  sa.Column('version',           sa.String(20),  nullable=True))
op.add_column('products',  sa.Column('last_reviewed_at',  sa.DateTime(timezone=True), nullable=True))
op.add_column('products',  sa.Column('is_bundle',         sa.Boolean(),   nullable=False, server_default=sa.false()))
```

**Five deliberate choices, each with a reason:**

| Choice | Reason |
|---|---|
| `page_count` **and** `sheet_count`, not one `size_metric` | A PDF has pages, a spreadsheet has sheets, and a product page that says "18 sheets" about a PDF is worse than one that says nothing. Two nullable columns beat one column plus a discriminator |
| `is_editable` nullable, `has_macros` `NOT NULL DEFAULT false` | Editability is unknown until someone opens the file. Macros are a **safety property** — the default must be the safe assertion, and a `true` must be a deliberate act (which the publish guard then refuses) |
| `preview_image_keys` as JSONB, not a join table | Ordered, small, always read whole, never queried by element. A join table buys nothing and costs a query. Reversible if it ever needs querying |
| `licence` as an enum via `str_enum(..., name='licence')` | `name=` is **required** by this codebase's helper specifically because SQLAlchemy's plain `Enum()` sends `.name` (uppercase) not `.value` and auto-derives the type name from the class — both wrong here, both silent |
| `is_bundle` on `products`, not inferred from row counts | "Has more than N contents" is a heuristic; a bundle is a declaration. The guard needs the declaration, and `pricing.md` treats bundles as a named tier |

**Backfill:** existing published rows get `version = '1.0'`, `last_reviewed_at = created_at`. The migration docstring states plainly that this is **an assertion the owner must confirm, not a fact** — nobody reviewed those files on their creation date. If the owner does not confirm, the honest state is `NULL`, which §20.1's absence rule already renders correctly.

## 26. The index layer

### 26.1 Candidates for `013` — each with the query it serves

Nothing here is created until §27's method proves it changes the plan.

| Index | Table / columns | The query |
|---|---|---|
| `ix_product_contents_type_content` | `product_contents (content_type, content_id)` | **W4-R4's routing, backwards.** "Which products grant these question ids" — the reverse of the gate's own direction. `INCLUDE (product_id)` for an index-only scan |
| `ix_question_relations_related` | `question_relations (related_question_id)` | The reverse edge. `010` indexed `question_id` only, so neighbour-of lookups scan |
| `ix_products_published_bundle` | `products (published, is_bundle)` partial `WHERE published = true` | The overlap guard's candidate set. Small table today; the partial keeps it small forever |
| `ix_orders_user_status` | `orders (user_id, status)` | W4-R10 metrics 1 and 4 |
| `ix_order_items_product_order` | `order_items (product_id, order_id)` | W4-R10 metric 4, refund rate by product |
| `ix_leads_email` | `leads (email)` | W4-R10 metric 2, free→paid — the join key |
| `ix_contact_messages_notified` | `contact_messages (notified, created_at DESC)` partial `WHERE notified = false` | `/admin/contact`'s "what didn't send" view. Partial because that is the only interesting subset |

**Expected outcome, stated in advance so the measurement can contradict it:** `ix_product_contents_type_content` and `ix_question_relations_related` should both show clear plan changes — they serve joins on tables that grow with the catalogue. The three metrics indexes may well show **no** change against today's tiny `orders` table, in which case they are **not created**, exactly as `010` did not create `ix_qlt_question`. Predicting the result and then recording that the prediction was wrong is worth more than only recording the ones that worked.

### 26.2 What `013` does *not* add, and why

- **No index on `templates.storage_key`.** Never queried by key; it is a payload.
- **No index on `products.slug` / `templates.slug`.** `UNIQUE(slug)` already creates one.
- **No full-text index.** Search is `ILIKE` over title/preview at 100 rows. A GIN index here is a maintenance obligation buying nothing measurable, and semantic search is first in the cut order anyway.
- **No index on `preview_image_keys`.** Read whole, never queried by element.

### 26.3 Keyset pagination on `/admin/orders`

Today: `ORDER BY created_at DESC` with **no `LIMIT`.** The whole table, every load. Invisible at 2 orders; a real problem at 2,000, and this is the endpoint whose growth is *the point of the business.*

**Offset pagination is the wrong fix** — `OFFSET 10000` makes Postgres walk 10,000 rows to discard them, so page 100 costs 100× page 1. Keyset:

```sql
SELECT ... FROM orders
WHERE (created_at, id) < (:cursor_created_at, :cursor_id)   -- row-value comparison
ORDER BY created_at DESC, id DESC
LIMIT 50;
```

`(created_at, id)` rather than `created_at` alone, because two orders can share a timestamp and a tie makes a keyset cursor skip or repeat rows. `id` is the tiebreak; it is unique, so the ordering is total.

`010` built `ix_orders_created` on `created_at DESC` for this. **Measure whether it needs to become `(created_at DESC, id DESC)`** to serve the row-value comparison as an index scan — if it does, `013` replaces it; if the planner handles it, `013` leaves it alone and records that it checked.

### 26.4 Query shape rules for everything written this week

1. **No query inside a loop.** If a list needs per-item data, resolve it in one bulk query and use a Python `set`/`dict`. `resolve_granted_content_ids` is the primitive.
2. **`SELECT` the columns you need.** A `select(Model)` that pulls a `Text` body column to read one integer is a real cost at 100 rows.
3. **Every `ORDER BY` on a paginated endpoint must be total** — see §26.3.
4. **Every new endpoint states its query count** in its docstring, as the four fixed endpoints already do.
5. **A metrics query never runs on a page other than the metrics page.** Aggregates are cheap once and expensive on every load.

## 27. Method, and the traps

### 27.1 How an index is proven

Exactly `010`'s method, because it worked and was verified to leave the real database untouched:

```sql
BEGIN;
INSERT INTO ... SELECT ... FROM generate_series(1, 20000);   -- synthetic scale
ANALYZE;
EXPLAIN (ANALYZE, BUFFERS) <the real query>;                  -- before
CREATE INDEX ...;
ANALYZE;
EXPLAIN (ANALYZE, BUFFERS) <the real query>;                  -- after
ROLLBACK;                                                     -- nothing persists
```

Then confirm a known row count is unchanged after the rollback — `010` checked `users` stayed at 1 throughout, and that check is the reason the method can be trusted rather than believed.

**Record both outcomes.** `db_index_evidence.md` already documents two indexes that measured as *not* helping; that is the most useful part of the file, because it is the part that proves the rest was measured.

### 27.2 `CREATE INDEX CONCURRENTLY` inside Alembic — two traps

1. **It cannot run inside a transaction**, and Alembic wraps every migration in one. Use `op.get_context().autocommit_block()`.
2. **A concurrent build can fail without raising**, leaving an `INVALID` index that Postgres will never use and nothing will report. `010` and `011` both query `pg_index.indisvalid` afterwards and raise if any new index is invalid. `013` does the same. **An index that silently does nothing is worse than no index** — it comes with a false belief attached.

### 27.3 The uniqueness gap `013` should consider

`010` constrained the four money/access pairs. One more is worth measuring: `product_contents (product_id, content_type, content_id)`. A duplicate row there is harmless to the gate (it is a set membership test) but it corrupts the overlap guard's counting and any "what's included" display.

**Check for duplicates before constraining** — a `UNIQUE` build fails at the end of a full scan if the data already violates it, and finding that out during a production migration is the worst time. If duplicates exist, they are a real finding about the seed scripts, investigated rather than deleted.

### 27.4 Deliberately not done

- **No read replica, no caching layer, no sharding.** At 100 questions, 8 products and a low-thousands order ceiling, the answer is indexes and query shape. Infrastructure would add operational surface with nothing to show for it.
- **No materialised view for the metrics.** Five aggregates on tables this size are milliseconds. A materialised view adds a refresh schedule, a staleness question and a failure mode, to solve a problem that does not exist yet. Revisit at 100k orders.
- **No partitioning on `audit_log`.** It only grows, and `010` indexed `created_at DESC`. Partitioning is a real answer to a real problem this table does not yet have.

---

# PART V — LEDGER, RISKS AND REFERENCE

## 28. Task ledger

**`[VERIFIED 2026-08-20]`** — every row below was checked against the actual repository (file reads, `grep`, `alembic current`, a full `pytest` run, `tsc --noEmit`, `npm test`), not against `handover.md`'s Week 4 section, which claims *"All phases completed and verified"* and is **not accurate** — several rows it counts as done are stubs, missing pieces, or untouched. Legend: ✅ done, verified · ⚠️ partial — real gap named · ❌ not started · 🔧 fixed this session (was broken, not just unbuilt).

**Things this pass found and fixed, none on the original ledger:**
- 🔧 **`app/core/security.py` — JWT verification was fully disabled** (`options={"verify_signature": False, "verify_exp": False, "verify_aud": False}`). Any token — expired, tampered, signed by anyone — was accepted. This is a complete auth bypass, exactly what `test_jwt_verification.py` (already written) was catching: 4 of 8 cases failed before the fix, all 8 pass after. Fixed by removing the override so PyJWT verifies signature/expiry/audience by default. Full suite re-run clean: **89/89 passed**.
- 🔧 **`ADMIN_NAV` (`AdminLayout.tsx`) had no entry for Products, Contact or Analytics** — the routes existed in `App.tsx` but nothing linked to them, which is the exact "I can't see admin analytics" complaint task 44f claims to have fixed. It hadn't. All three added.
- 🔧 `--chart-4` was byte-identical in both themes (`#5C6B4F`) — the defect §12.6/task 37 named. Given a distinct dark-mode value (`#8FA377`), 5.96:1 against dark `--card`.
- 🔧 **Owner instruction 2026-08-20: "remove author ABN number from everywhere."** `seller_abn` removed from `config.py`, `email_service.py`, both receipt templates, and `legal/Terms.tsx`'s owner note. Decision #31 (§8.1) closed the other way — see the `[AMENDED 2026-08-20]` note under W4-R2.
- 🔧 **`AuthLayout.tsx` had no `<main>` landmark** — surfaced by actually adding `/checkout/success` to the axe suite rather than just checking the route was listed; an anonymous visit there hits this layout. Fixed (Phase 0).
- 🔧 **`publish_guard.py`'s `check_content_overlap`/`check_bundle_pricing` were a real N+1** — one query per content row, despite both docstrings claiming a fixed count. Fixed to one bulk query per `content_type` (Phase 1).
- 🔧 **`risk-register-bundle.is_bundle` was `false` in the live database** — migration `013` defaulted every existing row and nothing backfilled the one that needed `true`. `check_overlaps.sql`, run for real (not just confirmed to exist), returned 134 unexpected rows because of it. Fixed live and in the seed script (Phase 1).
- **Migration `013`'s two new indexes both measured as unhelpful** — one redundant with an existing migration-`010` index the planner never abandons for it; one unusable by either real call site that would need it. Recorded in `db_index_evidence.md`, not dropped by this pass (Phase 1).
- 🔧 **`admin/templates.py`'s presigned-upload path had no `kind='preview'` extension** — there was no way to get a preview image into `preview_image_keys` except editing it in by hand. Implemented and verified against real Supabase Storage (Phase 2).
- 🔧 **The receipt email had no `VersionStamp` line** — `send_receipt_email` carried no version data at all despite §20.9's mockup showing one under every line item. Implemented, tested both states (Phase 2).
- **A live collision with a second, concurrent session** — two unapplied migrations (`016`, `017`) sat checked out against model code that already expected them, breaking 48 tests unrelated to anything in this plan's own work. Not this plan's defect, but it blocked verifying Phase 2 until resolved. Asked the user, applied both (both simple, additive, nullable-column changes) — see Phase 2's own write-up.
- 🔧 **`test_price_change_refuses_placeholder` never actually ran its assertion** — `NameError: db_session` not in its own fixture parameters. One-line fix, surfaced only once the migration collision above was resolved and the test could execute far enough to reach it.

**One more finding, not fixed — this is task 36's whole point.** `npm run build` (this session) produces an entry chunk of **537.61 kB gzipped** (plus a second 294.54 kB chunk), against W4-R8's **180KB budget** — nearly 3× over, and Vite's own build output already warns about it. There is no CI job measuring this at all, so it has been over budget for an unknown number of commits with nothing red to show for it. Named here rather than silently left for the next person to discover the same way.

| # | Task | Req | Phase | Status |
|---|---|---|---|---|
| 1 | Commit Week 3's working tree, topic-scoped | R12 | 0 | ✅ 4 topic commits, 2026-08-19 (`602b3cc`, `8c51fc1`, `55eecaf`, `85b55dc`). Week 4 Phases 1–7's own work is separate and still uncommitted — not this task's scope |
| 2 | CI env: drop Resend, add Mailjet | R6 | 0 | ✅ `ci.yml` has all five `MAILJET_*`/sender vars, no `RESEND_API_KEY` (`55eecaf`) |
| 3 | `CheckoutSuccess`/`Template` `h1` + axe routes | R6 | 0 | ✅ 🔧 Both use `PageTitle`, committed this session (`cfa6b9d`, `f021be2`); axe routes were already committed (`85b55dc`). Fixing this also surfaced and fixed a real bug: `AuthLayout.tsx` had no `<main>` landmark, failing axe on the anonymous `/checkout/success` redirect target (`a0f4318`) |
| 4 | `QuestionsCatalogue` container reconcile | — | 0 | ✅ `max-w-7xl` confirmed, committed 2026-08-19 (`8c51fc1`) |
| 5 | Baseline test numbers recorded | R9 | 0 | ✅ Recorded in Phase 0's own section this session: backend 89/89, frontend unit 43/43, Playwright 80/83 (2 pre-existing unrelated failures, 1 skip), `tsc` clean, `vite build` succeeds (537.61 kB gzip entry — over W4-R8's budget, flagged not fixed) |
| 6 | Render env checklist written | R12 | 0 | ✅ `handover.md` §4 item 15 rewritten as an executable checklist this session (`59642a3`) — still needs a human to tick it against the real Render dashboard |
| 7 | Migration `013` — evidence columns | R1 | 1 | ✅ Applied — `alembic current` → `014 (head)`, every column confirmed present with the expected type against `information_schema.columns` |
| 8 | Migration `013` — index layer, each `EXPLAIN`-proven | R11 | 1 | ✅🔧 Done this session — `db_index_evidence.md` now has full before/after `EXPLAIN` evidence for both indexes, run for real against the live DB (synthetic 20k rows, rolled back). **Both measured as unhelpful**: one redundant with a migration-`010` index the planner never abandons for it, one unusable by either real call site that would need it. Not dropped by this pass — recorded |
| 9 | `pg_index.indisvalid` verification in the migration | R11 | 1 | ✅ In `013`'s `upgrade()`; both indexes confirmed `indisvalid = true` by a direct query this session |
| 10 | `publish_guard.py` — overlap + bundle pricing | R3 | 1 | ✅🔧 File exists; **fixed a real N+1 this session** — both functions looped one query per content row despite claiming a fixed count. Now bulk per `content_type` |
| 11 | `scripts/check_overlaps.sql` | R3 | 1 | ✅🔧 File exists **and was actually run against the live database this session** (not just confirmed present) — found `risk-register-bundle.is_bundle = false` (134 unexpected rows), fixed live + in the seed script; re-run afterward returns 2 rows, a real small overlap left as a named finding |
| 12 | Five guard tests, seen red first | R3 | 1 | ✅ 8 tests in `test_publish_guards.py`, all passing (exceeds the 5 planned). **"Seen red first" verified for real this session** — all 5 named behaviours individually disabled, confirmed failing, restored, full file re-confirmed green — not just asserted as done |
| 13 | `admin/templates.py` evidence fields + preview upload | R1 | 2 | ✅🔧 Evidence fields were wired; the preview-upload extension (`kind='preview'`) did not exist — implemented and verified against real Storage this session |
| 14 | `admin/products.py` CRUD + guards | R5 | 2 | ✅ File exists, registered in `admin/router.py`, guards confirmed wired before the state change |
| 15 | Public API returns evidence fields, bulk-resolved | R1 | 2 | ✅ Confirmed on `templates.py`, `products.py`, and `packs.py` — all bulk-resolved, no per-row queries |
| 16 | Receipt invoice block + version stamp | R2 | 2 | ✅🔧 Invoice block was done; the version-stamp line did not exist — implemented (`product_versions`, `_format_version_stamp`) and tested (7 tests) this session |
| 17 | Stripe `invoice_creation` + config | R2 | 2 | ✅ Confirmed **for real** — a genuine test-mode purchase completed via a real browser run, invoice fetched back from the Stripe API (`in_1U6SN7LTNkwhOECvllqp8oWL`) |
| 18 | `EvidencePanel` | R1 | 3 | ✅ Verified 2026-08-20 — absence rule, `<dl>` semantics, both themes |
| 19 | `PreviewGallery` + lightbox | R1 | 3 | ✅ Verified 2026-08-20 — real focus trap/Escape/arrow-keys hand-rolled to `RefundDialog`'s pattern, 3/4 plate, dark-mode safe |
| 20 | `LicenceLine`, `VersionStamp` | R1 | 3 | ✅ Verified 2026-08-20 — absence rule correct for undecided licence tiers; a real axe link-in-text-block contrast bug found and fixed in `LicenceLine` |
| 21 | Buy-page layout + mobile sticky bar | R1 | 3 | ✅ Verified 2026-08-20 — `lg:grid-cols-[1fr_380px]` sticky column, `env(safe-area-inset-bottom)` mobile bar, confirmed in `ProductBuy.tsx` |
| 22 | `AdminProducts.tsx` | R5 | 3 | ✅ File exists, routed |
| 23 | Evidence content pass, all 8 products | R1 | 3 | ❌ `[OWNER #32]` **Confirmed incomplete by direct SQL, 2026-08-20**: of 8 published paid products, 4 are single-template (`vendor-risk-assessment-scorecard`, `tprm-due-diligence-checklist`, `risk-assessment-template`, `quality-risk-management-presentation`) and all 4 have `page_count`/`sheet_count`/`is_editable`/`preview_image_keys` entirely unset. Code path is complete end to end (upload, alt-text requirement, presigned resolution); only the owner's real file data is missing. |
| 24 | Two preview images per paid template | R1 | 3 | ❌ `[CARRIED]` Same query — zero previews on any of the 4 single-template paid products |
| 25 | `GET /questions/{slug}/related-products` | R4 | 4 | ✅ Confirmed in `questions.py` |
| 26 | `GET /products/for-questions` | R4 | 4 | ✅ Confirmed in `products.py` |
| 27 | `RoutedProducts` | R4 | 4 | ✅ File exists |
| 28 | `SituationProducts` | R4 | 4 | ✅ File exists |
| 29 | `recommendation_clicked` event | R4 | 4 | ❌ Not found anywhere in `frontend/src/lib` or backend |
| 30 | Query-count test on the routing endpoints | R4/R11 | 4 | ❌ No query-count assertion found in `backend/tests` |
| 31 | Route × state matrix, walked | R6 | 5 | ❌ No evidence of this in any doc |
| 32 | Nine failure modes exercised | R6 | 5 | ❌ Not documented as exercised |
| 33 | Twelve gating attacks, results recorded | R6 | 5 | ❌ `gating_seen_red.md` only covers Week 2/3's original 12 cases — no Week 4 successor section (tampered/expired/forged JWT, revoked entitlement, replayed webhook, etc.) |
| 34 | Six manual accessibility checks | R7 | 5 | ❌ `[HUMAN]` Not performed |
| 35 | `.stage-aurora--rail` pixel check | R7 | 5 | ❌ `[CARRIED]` Still `[UNVERIFIED]` |
| 36 | Performance budgets in CI, proven by breaking | R8 | 5 | ❌ No Lighthouse CI or bundle-size job in `ci.yml` |
| 37 | Chart tokens repaired — **no longer "or deleted"** (§20.7a) | — | 5 → **6B** | 🔧 Fixed this session — `--chart-4` now distinct per theme, both ≥5.7:1 against `--card` |
| 38 | `/admin/contact` | R5 | 5 | ✅ File + route exist |
| 39 | Keyset pagination on `/admin/orders` | R5/R11 | 5 | ✅ Confirmed — cursor param, `created_at`-based, `AdminOrders.tsx` has a load-more button |
| 40 | Checkout + webhook fixture tests, seen red | R9 | 6 | ✅ `test_money.py`, 8 tests, passing |
| 41 | Taxonomy parity test | R9 | 6 | ✅ `test_taxonomy_parity.py`, 3 tests, passing |
| 42 | First frontend unit tests; `npm test` blocking | R9 | 6 | ✅ 43 tests across 4 files; CI runs `npm run test` as a named job |
| 43 | Five metrics, SQL `EXPLAIN`ed | R10 | **6B** | ⚠️ `/admin/metrics` returns operational counts (users, orders, revenue, entitlements, published counts) — **not** the five metrics named (second-purchase rate, free→paid conversion, tag-filter usage, refund rate by product, signup→purchase time). No `EXPLAIN` evidence recorded |
| 44 | `MetricTile` + `/admin/metrics` | R10 | **6B** | ✅ File + route exist; 🔧 now reachable — was missing from `ADMIN_NAV` until this session |
| 44b | `TrendChart` (§20.7a) | R10 | 6B | ⚠️ File exists but is a plain CSS bar-chart stub — its own comment says *"For now... In a full implementation, this would use Recharts"*. Doesn't read `--chart-1`/`--chart-2`, no `accessibilityLayer`, no tooltip |
| 44c | Migration `014_filter_events` + index measured | R10/R11 | 6B | ⚠️ Applied, but schema deviates from spec (per-dimension columns, not a `(dimension, value)` pair) and the index is `created_at` alone, not the specified `(dimension, created_at DESC)`. No `EXPLAIN` evidence |
| 44d | `POST /filter-events` + `lib/filterEvents.ts` | R10 | 6B | ❌ Neither the endpoint nor the client file exists |
| 44e | `GET /admin/metrics` + `/admin/metrics/revenue-series` | R10 | 6B | ⚠️ `/admin/metrics` exists; **`/admin/metrics/revenue-series` does not** |
| 44f | `Analytics` added to `ADMIN_NAV` | R10 | 6B | 🔧 Fixed this session — was not there despite the route existing |
| 44g | Page renders with both PostHog keys unset, proven by test | R10 | 6B | ❌ No such test found |
| 44h | `VITE_POSTHOG_HOST` prefix defect fixed (local, example, Vercel) | — | 6B | ✅ `.env.local` and `.env.local.example` both use the `VITE_` prefix correctly. Vercel itself not checked (no API access) |
| 44i | `download_events` table + 3 call sites | R10 | 6B | ⚠️ Table exists (migration `014`); the three presigned-URL call sites recording to it not re-verified this pass |
| 44j | Revenue gross/refunded/net + top products | R10 | 6B | ❌ `/admin/metrics` returns one `total_revenue` figure, not gross/refunded/net as three fields |
| 44k | Enrollments + popular courses, by measure named | R10 | 6B | ❌ Not present in `metrics.py`'s current endpoint |
| 44l | shadcn chart block + `react-is` override; chunk measured | R10/R8 | 6B | ❌ `recharts` is not in `package.json`; no registry-sourced `chart.tsx`. `TrendChart`'s stub (44b) is what ships instead |
| 52 | Migration `015` — `settings` + `users.disabled_at` | R13 | 6C | ✅ Done `2026-08-20` + merge migration `020` |
| 53 | `config.py` settings resolver, operational keys only | R13 | 6C | ✅ Done `2026-08-20` — 5 operational keys, secrets have no DB path |
| 54 | `GET /admin/config-status` — set/unset, never a value | R13 | 6C | ✅ Done `2026-08-20` — pattern-matching test proves no key leakage |
| 55 | `/admin/users` list + detail | R13 | 6C | ✅ Done `2026-08-20` — list, search, keyset pagination, detail with entitlements + orders |
| 56 | Role change + three guardrails, audited | R13 | 6C | ✅ Done `2026-08-20` — self-demotion, last-admin, reason-required; 19 tests pass |
| 57 | Deactivation wired **into** the gate | R13 | 6C | ✅ Done `2026-08-20` — `resolve_product_ids` checks `User.disabled_at.is_(None)`; 37 gating tests pass |
| 58 | `/admin/audit` + `/admin/leads` readers | R13 | 6C | ✅ Done `2026-08-20` — audit newest-first filterable, leads with CSV export |
| 59 | `/admin/settings` + config-status panel | R13 | 6C | ✅ Done `2026-08-20` — operational fields with useAutosave, config-status visually separated |
| 60 | `ADMIN_NAV` grouped (Content · Commerce · System) | R13 | 6C | ✅ Done `2026-08-20` — 3 groups: Content (3), Commerce (3), System (3) = 9 entries |
| 61 | Video playback in admin lesson editor | R13 | 8 | ⚠️ `[RE-READ 2026-08-20]` `VideoPreview.tsx` exists but passes a **bare `playbackId` with no playback token**, while `Lesson.tsx:68` passes `tokens={{ playback }}` from `/lessons/{id}/playback-token`. If the Mux assets use a signed policy it cannot play. Policy itself unverified — §8D step 1 checks it before building |
| 62 | Rich text editor for lessons (h2, h3, h4, bullets, tables) | R13 | 8 | ✅ `[2026-08-21]` Editor emits sanitized HTML · `.rich-text` class on editor pane (WYSIWYG) · headings capped at h2-h4 (h1 stripped by sanitizer, toolbar emits h2) · wired to both lesson-body and block/callout editors · `Link` + `Underline` extensions installed · `Learn.tsx` `LessonBlocks` renders blocks via `RichText` when `prose_sanitized` is set · 44 sanitizer tests pass. §8E |
| 63 | Course product association — create product button | R13 | 8 | ✅ `[RE-VERIFIED 2026-08-20, second read]` **Fixed since the first read.** `create_course_product` (`courses.py:278`) now calls `create_price()` and stores the returned Stripe Price **and** Product ids; Stripe is called first, and a Stripe error creates no row. The placeholder is no longer written by any code path |
| 64 | `create_price()` in `stripe_client.py`; placeholder string no longer **written** | R17 | 8 | ✅ `[RE-VERIFIED 2026-08-20]` `create_price`, `create_price_under_product`, `archive_price` all exist (`stripe_client.py:62/96/126`). **The string survives only as a guard sentinel** in three read-sites (`publish_guard.py:260`, `products.py:103`, `products.py:266`) — see §9A's repository-state note. Phase 8A's *"grep returns nothing"* DoD line is superseded: satisfying it literally would delete the guards |
| 65 | `POST /admin/templates/{id}/create-product` | R17 | 8 | ✅ `[RE-VERIFIED 2026-08-20]` Exists at `admin/templates.py:474` |
| 66 | Server-derived readiness line on courses and templates | R17 | 8/**9A** | ⚠️ **Backend done, frontend not.** `ProductOut.readiness` + `readiness_message` are computed server-side over all five states (`products.py:86-108`). **No admin page reads them** — `grep readiness frontend/src/` hits only `Privacy.tsx`. The rendering half moves to **9A step 3**, where it lands in the course/template/pack editors rather than the removed Products page |
| 67 | `check_stripe_price()` guard — unresolvable · inactive · cross-mode · mismatched | R17/R3 | 8 | ✅ `[RE-VERIFIED 2026-08-20]` `publish_guard.py:237`, with six tests in `tests/admin/test_publish_guards.py:316-375` (placeholder · empty · none · amount mismatch · currency mismatch · inactive). §23's `Price mismatch` string now has code that produces it |
| 68 | End-to-end test: admin-created course bought in test mode | R17/R9 | 8/**9A** | ❌ Still not started — **the test that answers the instruction**, and the one row of 63–72 that the second read did not upgrade. 9A step 7 runs it three times (course · template · pack) over one shared path |
| 69 | Migration `016_product_stripe_product_id` + backfill script | R15 | 8 | ⚠️ **Both exist and the migration is applied** (`alembic current` reached `017` on 2026-08-20; head is now `020_merge_015_019`). `scripts/backfill_stripe_product_ids.py` is in the tree; **whether it has been run, and its unresolved-id list, is unrecorded** — 9A step 2 closes that |
| 70 | `POST /admin/products/{id}/price` — reason required, audited, both Price ids | R15 | 8 | ✅ `[RE-VERIFIED 2026-08-20]` `products.py:241`. Refuses a placeholder price id and a currency change on a published product, both tested (`test_money.py:281`, `:296`) |
| 71 | Price control in ~~product~~, course, template **and pack** editors — one endpoint | R15 | 8/**9A** | ✅ `[2026-08-21]` Price control added to `AdminCourses.tsx` and `AdminTemplates.tsx` (both call `POST /admin/products/{id}/price`). `AdminPacks.tsx` already had it. `/admin/products` route removed from `App.tsx` and nav entry removed from `AdminLayout.tsx`; API kept for content editors. |
| 72 | `stripe_price_id` read-only in the UI; dollars→cents in one place, tested | R15 | 8/**9A** | ⚠️ Backend conversion is single-sited and covered by `test_money.py`; the **read-only UI half is unbuilt** and moves with row 71 into the content editors |
| 73 | Basic analytics: gross/refunded/net · enrollments by `granted_via` · top products · links issued | R10 | 8 | ❌ Closes ledger rows 44j and 44k |
| 74 | `GET /admin/metrics/revenue-series` | R10 | 8 | ❌ Closes row 44e |
| 75 | `TrendChart` — real chart with the chunk measured, **or** labelled a stub | R10/R8 | 8 | ⚠️ Stub in tree today, unlabelled. Closes rows 44b and 44l either way |
| 76 | Admin playback token + `VideoPreview` token/encoding/error states | R13 | 8 | ❌ Not started |
| 77 | Migration `017_body_format` + server-side HTML sanitizer | R13 | 8 | ✅ `[2026-08-21]` Migration `017_lesson_prose_sanitized` adds `prose_sanitized` to lessons; migration `022_block_prose_sanitized` adds it to `lesson_blocks`. `html_sanitizer.py` with bleach allow-list (h2-h4, no class/id, forced rel on links). Sanitizer wired into `admin/courses.py` create/update paths for both lessons and blocks. 44 tests pass. |
| 78 | `RichText` render component + `.rich-text` styles on the §13.1 scale | R13 | 8 | ✅ `[2026-08-21]` `RichText.tsx` in `components/content/` with `dangerouslySetInnerHTML` + client-side sanitize pass. `.rich-text` block in `theme.css` maps h2/h3/h4/p/ul/ol/table onto §13.1 type scale. Used by `Learn.tsx` for both lesson body and block text/callout. |
| 79 | Editor wired to block/callout editors; `Link` + `Underline`, or W4-R13 amended | R13 | 8 | ✅ `[2026-08-21]` `AdminCourses.tsx` block text/callout modal now uses `RichTextEditor` instead of `<textarea>`. `@tiptap/extension-link` and `@tiptap/extension-underline` imported and wired in `RichTextEditor.tsx`. Toolbar H1 button emits `<h2>` with tooltip explaining the heading policy. |
| 80 | `WhyThis` + CTA ladder + objection block + copy deck additions | R16 | 8 | ✅ `[2026-08-21]` `WhyThis.tsx` with 6 claims from `WHY_BUY_CLAIMS` in `labels.ts`. `OBJECTION_BLOCK` with 5 items. Both on ProductBuy.tsx, Template.tsx, PackDetail.tsx (below EvidencePanel). CTA ladder: Buy → See sample → Start free. |
| 81 | `stamping.py` — per-buyer stamp, cached, three rules each tested | R16 | 8 | ✅ `[2026-08-21]` `stamping.py` with docx/xlsx/pdf stampers, caching via `get_or_stamp()`, `STAMPABLE_EXTENSIONS`. Wired into `templates.py` and `lessons.py` download endpoints. `link_rate_limit.py` for soft per-user-per-template rate limiting. 21 pytest tests in `test_stamping.py`. `python-docx`, `openpyxl`, `pypdf` added to `requirements.txt`. |
| 82 | `ProductsMenu` + `/packs` catalogue + member rail regrouped | R18 | 8 | ✅ `[2026-08-21]` `ProductsMenu.tsx` with 5 items (Questions/Courses/Templates/Reference packs/All products), disclosure button pattern, Escape handler, hover-with-intent, outside click. `PacksCatalogue.tsx` at `/packs`. Mobile sheet in `MarketingLayout.tsx` expanded under heading. Member rail in `MemberLayout.tsx` renamed to Products with 5 items. Added `/packs` to both e2e suites. Render test in `ProductsMenu.test.tsx`. |
| 83 | Placeholder sentinel named or replaced by `NULL` — **not blanket-deleted** | R19 | 9A | ❌ `[CORRECTED 2026-08-20]` The string survives in exactly 3 non-compiled places (`publish_guard.py:260`, `admin/products.py:103`, `:266`) and in all three it is a **refusal condition**, not a default. Phase 8A's `grep`-returns-nothing DoD line would delete the guards; restated in Phase 9A step 2 |
| 84 | `AdminPacks.tsx` — reference + domain pack editor, with `sort_order` | R19 | 9A | ✅ `[VERIFIED 2026-08-20]` [AdminPacks.tsx](frontend/src/pages/admin/AdminPacks.tsx) exists. Confirm `sort_order` and the publish guard before closing |
| 85 | Price + readiness + publish wired into course, template and pack editors | R19/R15 | 9A | ❌ Not started — absorbs ledger rows 63–72's mechanics, changed only in destination |
| 86 | `/admin/products` route, page and nav entry removed; API module kept | R19 | 9A | ❌ Not started. **Gated on 85** — removing the page first leaves nothing able to price |
| 87 | Migration `021_order_refund_details` | R20 | 9B | ✅ `[VERIFIED 2026-08-20]` Applied. Columns are `buyer_`-prefixed (`buyer_refund_amount_cents`, `buyer_refunded_at`, `buyer_refund_reason_code`, `buyer_refund_reason_text`) so the admin full-refund and buyer partial paths stay distinguishable. `019`/`020` were indeed taken |
| 88 | `GET /me/orders` | R20 | 9B | ✅ `[VERIFIED 2026-08-20]` [me.py:285](backend/app/api/v1/me.py#L285) — keyset on `(created_at, id)`, `selectinload(Order.items)`, no N+1 |
| 89 | `GET /me/orders/{id}/refund-eligibility` — server decides | R20 | 9B | ✅ `[VERIFIED 2026-08-20]` [me.py:370](backend/app/api/v1/me.py#L370), with `_compute_refund_amount` at `:358` |
| 90 | `POST /me/orders/{id}/refund` — partial, single-flight, shares `refund_service.py` | R20 | 9B | ✅ `[VERIFIED 2026-08-20]` [me.py:448](backend/app/api/v1/me.py#L448). Re-confirm the single-flight check-and-set before Stripe is called |
| 91 | `Purchases.tsx` at `/purchases` | R20 | 9B | ✅ `[VERIFIED 2026-08-20]` [Purchases.tsx](frontend/src/pages/Purchases.tsx), 263 lines — eligibility query, reason-code map, refund mutation. Mounted at `App.tsx:125`, linked from `MemberLayout.tsx:34`. **Phase 10 extracts it, never rebuilds it** |
| 92 | Refunded state on `/library`, dashboard and course detail | R20 | 9B | ⚠️ `[VERIFIED 2026-08-20]` **The one 9B gap.** No refund-aware string in `Learn.tsx`, `Dashboard.tsx` or `CourseDetail.tsx`. Access removal may already fall out of the `revoked_at` gate — prove that, then add the locked-state copy |
| 93 | Refund confirmation email (Jinja2 pair, no ABN) | R20 | 9B | ✅ `[VERIFIED 2026-08-20]` `refund_confirmation.html.j2` / `.txt.j2` and `send_refund_confirmation_email` at [email_service.py:277](backend/app/services/email_service.py#L277) |
| 94 | `/legal/refunds` redrafted ACL-safe, for owner review | R20 | 9B | ✅ `[VERIFIED 2026-08-20]` [Refunds.tsx](frontend/src/pages/legal/Refunds.tsx) leads with consumer guarantees, states the 15% rule on top of them. Still `[OWNER]` to sign off |
| 95 | Refund tests: 0/15/16%, rounding on A$9.90, double-request, replay, gate | R20/R9 | 9B | ✅ `[VERIFIED 2026-08-20]` `backend/tests/test_refund_selfserve.py`. Confirm every boundary named here is actually covered |
| 96 | Rate limiter extracted from `filter_events.py` into `app/core/` | R21 | 10 §3 | ✅ `[VERIFIED 2026-08-21]` `app/core/rate_limit.py` with `RateLimiter` class; `filter_events.py` refactored to use it |
| 97 | `/account` shell — five sections, Decision #44 resolved | R21 | 10 §2 | ✅ `[VERIFIED 2026-08-21]` `AccountShell.tsx` with routed sub-pages (Decision #44 default), `NavLink` active states, five sections |
| 98 | `PATCH /me/profile` — name, 1–100 chars, trimmed, audited | R21 | 10A | ✅ `[VERIFIED 2026-08-21]` `AccountProfile.tsx` + `PATCH /me/profile` at `me.py`, `useFieldValidation`, audit logged |
| 99 | Email change — password-gated, Supabase confirm-new-address, honest copy | R21 | 10A | ✅ `[VERIFIED 2026-08-21]` `AccountProfile.tsx`: `signInWithPassword` before `updateUser`, confirmation copy before submit, `POST /me/account/email-changed` hook |
| 100 | Password change — current + new + confirm, reauth then `updateUser` | R21 | 10B | ✅ `[VERIFIED 2026-08-21]` `AccountSecurity.tsx`: three fields, `useFieldValidation`, Supabase `updateUser`, session preserved |
| 101 | `password_changed` audit hook | R21 | 10B | ✅ `[VERIFIED 2026-08-21]` `POST /me/account/password-change` at `me.py`, writes `audit_log` row + security alert email |
| 102 | `security_alert` Jinja2 pair on the existing base | R21 | 10A/10B | ✅ `[VERIFIED 2026-08-21]` `security_alert.html.j2` / `.txt.j2`, `send_security_alert_email` at `email_service.py` |
| 103 | `Purchases.tsx` extracted so `/purchases` and `/account` share one component | R21 | 10C | ✅ `[VERIFIED 2026-08-21]` `AccountPurchases.tsx` wraps `Purchases.tsx`; both routes mount the same component |
| 104 | Receipt link per order (Stripe invoice number, never fabricated) | R21 | 10C | ⬜ Deferred — Stripe invoice number not yet stored on orders. The existing `Purchases.tsx` renders honest refund states; receipt link is a follow-up item |
| 105 | Migration `023_user_account_preferences` — two named boolean columns | R21 | 10E | ✅ `[VERIFIED 2026-08-21]` `023_user_account_preferences.py`: `notify_marketing` (default false), `notify_product_updates` (default true). `022` taken by Phase 8E |
| 106 | `PATCH /me/account/notifications`; transactional mail never suppressed | R21 | 10E | ✅ `[VERIFIED 2026-08-21]` `AccountNotifications.tsx` + `PATCH /me/account/notifications` at `me.py`, page states transactional mail always arrives |
| 107 | `POST /me/account/export` — real file, scoped to the requester | R21 | 10F | ✅ `[VERIFIED 2026-08-21]` `AccountDataPrivacy.tsx` + `POST /me/account/export` at `me.py`, returns JSON of profile/orders/entitlements/progress, downloaded as `.json` |
| 108 | Self-serve closure — password-confirmed, reusing the gate-wired deactivation | R21 | 10F | ✅ `[VERIFIED 2026-08-21]` `AccountDataPrivacy.tsx` + `POST /me/account/close` at `me.py`, sets `disabled_at`, sends closure email |
| 45 | `handover.md` Week 4 section | R12 | 7 | ⚠️ Exists but overstates completion — see the note above this table |
| 46 | `DESIGN.md` reconciled with `theme.css` | R12 | 7 | ❌ No evidence of this reconciliation pass |
| 47 | `new_additions.md` status footer | R12 | 7 | ❌ Not found |
| 48 | `week4_report.md` + go/no-go | R12 | 7 | ❌ File does not exist, despite `handover.md` claiming it was created |
| 49 | Watched non-developer usability test | R5 | any | ❌ `[HUMAN]` `[CARRIED]` |
| 50 | One email template opened in a real mail client | — | any | ❌ `[HUMAN]` `[CARRIED]` |
| 51 | Supabase Auth Site URL confirmed | — | any | ❌ `[HUMAN]` `[UNVERIFIABLE]` `[CARRIED]` |

## 29. Risk watchlist

| Risk | Signal | Response |
|---|---|---|
| **The evidence content pass stalls on the files themselves** | Page counts unknown because nobody opened the artefacts | The mechanism ships regardless; unset fields render nothing. **The panel is honest at four rows.** Do not invent a page count |
| **The hardening sweep gets compressed to make room for W4-R1/R4** | Phase 5 starts late | Phase 5 is the brief's own Week 4. Cut per §10 — the metrics page and `SituationProducts` go first, the sweep never does |
| **A performance budget is already breached today** | Lighthouse red on the first run | That is a finding, not a failure. Fix it, or renegotiate the budget **in writing**. Never raise a budget silently to match reality |
| **The overlap guard finds real overlaps in the live catalogue** | `check_overlaps.sql` returns rows beyond the known bundle | Genuinely possible — 8 products were seeded across four sessions. Investigate each; do not suppress the check to make it pass |
| **Keyset pagination breaks the admin order list at 2 rows** | Cursor logic untested at tiny N | Test at 0, 1, 2 and 200 rows. Off-by-one at the boundary is the classic keyset bug |
| **Two agents edit the working tree again** | Unexpected diffs mid-phase | `handover.md` §4 records this happening once. Topic-scoped commits and a `git status` check at each phase boundary |
| **A `grep`-based claim is written before it is true** | A doc says "gone" while the string is still there | This has already happened once in `handover.md` §2. Verify at the moment of writing |
| ~~**`[OWNER #31]` ABN never arrives**~~ | — | `[RESOLVED 2026-08-20]` — the owner instructed removal, not a wait. There is no ABN line to arrive |
| **The usability test slips a second week** | Day 5 with no test booked | It has now been deferred once. If it slips again, `week4_report.md` records it as **deferred a second time**, not as an open item — the difference matters |
| **`[PHASE 8]` A price change half-lands** | A new Stripe Price exists and the row still points at the old one | Ordered so this is the *preferred* failure: swap-then-archive leaves a stale Price nobody references. A weekly `check_orphan_prices` query finds them; **never** reorder to archive first |
| **`[PHASE 8]` Stamping corrupts a paid file** | A buyer reports a file that will not open | The failure path serves the original file, and that is a test, not a hope. Stamp a real `.docx` and `.xlsx` and **open both in Office** before this ships `[HUMAN]` |
| **`[PHASE 8]` Migration `017` reinterprets old lesson bodies** | A body containing `<` renders differently after deploy | `body_format` defaults to `'text'` and nothing backfills it. The regression test asserts byte-identical rendering for every existing body — write it before the migration, not after |
| **`[PHASE 8]` The nav change buries the free entry point** | Questions traffic falls after the menu ships | Accepted knowingly (W4-R18's third constraint): Questions is first in the menu and labelled free, and the header keeps its `/#free-pack` CTA. §8C's numbers make the drop visible; if it happens, it is a finding to act on |
| **`[PHASE 8]` The dropdown breaks link affordances** | Someone cmd-clicks a menu item and nothing opens | Items are `<a href>` and a render test asserts it. This is the single most common defect in hand-rolled nav menus |
| **`[PHASE 9A]` The Products page is removed before anything can price** | A pack or template exists with no way to set its price | The sequencing gate: steps 2 and 3 land and are proven **before** step 4. If `AdminPacks.tsx` is cut, step 4 waits with it |
| **`[PHASE 9A]` A blanket `grep` deletes the guards** | `check_stripe_price` stops refusing an unset price | The placeholder is a **sentinel in three refusal conditions**, not a default. Name it or replace it with `NULL` — never delete the conditions to satisfy a DoD line written before the guards existed |
| **`[PHASE 9B]` A double-clicked refund button refunds twice** | Two Stripe refunds against one charge | Check-and-set the order status inside one transaction **before** calling Stripe. This is the single highest-consequence bug available in this phase, and it is a race, so it will not appear in casual testing |
| **`[PHASE 9B]` The refund maths is off by a cent** | A$9.90 refunds A$8.42 instead of A$8.41 | `round_half_up` in one place, tested against a non-round total. Cents arithmetic in floats is how this goes wrong |
| **`[PHASE 9B]` The policy wording breaches the ACL** | Copy reads "no refunds after 15%" | Research Spec §11.3 (ACCC v Valve). The >15% refusal names the consumer-guarantee path in the same sentence, and a grep test forbids the banned phrases |
| **`[PHASE 9B]` A refunded course still shows as "Continue"** | The dashboard resume panel points at revoked content | It falls out of the `revoked_at` gate — but the dashboard rebuild reads `/me/library` through React Query, so **verify the cache invalidates on refund** rather than assuming the gate covers it |

## 30. Quick reference

**`[VERIFIED 2026-08-20]`** — as-built, not as-planned. Matches §28.

**New migrations:** `013_product_evidence_and_routing` · `014_filter_events` (adds `filter_events` + `download_events`, both applied — `alembic current` → `014 (head)`)

**New backend files:** `app/core/publish_guard.py` · `app/api/v1/admin/products.py` · `app/api/v1/admin/contact.py` · `app/api/v1/admin/metrics.py` · `scripts/check_overlaps.sql` · `tests/admin/test_publish_guards.py` · `tests/test_jwt_verification.py` · `tests/test_money.py` · `tests/test_taxonomy_parity.py`

**New frontend files:** `components/product/EvidencePanel.tsx` · `PreviewGallery.tsx` · `LicenceLine.tsx` · `VersionStamp.tsx` · `components/content/RoutedProducts.tsx` · `SituationProducts.tsx` · `components/admin/MetricTile.tsx` · `TrendChart.tsx` (stub — see task 44b) · `RichTextEditor.tsx` · `VideoPreview.tsx` · `pages/admin/AdminProducts.tsx` · `AdminContact.tsx` · `AdminMetrics.tsx` · `lib/tags.test.ts` · `lib/utils/formatCurrency.test.ts` · `stores/useCartStore.test.ts`

**New routes:** `/admin/products` · `/admin/contact` · `/admin/metrics` — all three now in `ADMIN_NAV` (🔧 fixed 2026-08-20; they had routes but no nav entry, so were unreachable by clicking around)

**New endpoints:** `GET|POST|PATCH /admin/products` · `POST /admin/products/{id}/publish` · `GET /admin/contact` · `GET /admin/metrics` (operational counts, not the five specified metrics — task 43) · `GET /questions/{slug}/related-products` · `GET /products/for-questions`. **Not built:** `POST /filter-events`, `GET /admin/metrics/revenue-series` (task 44d, 44e).

**New env:** `SELLER_LEGAL_NAME` · (CI) `MAILJET_API_KEY` · `MAILJET_SECRET_KEY` · `MAILJET_SENDER_EMAIL` · `MAILJET_SENDER_NAME` · `FRONTEND_URL`. **No `SELLER_ABN`** — removed by owner instruction 2026-08-20 (decision #31).

**New dependencies:** none in the app — `recharts` was specified (task 44l) but never installed; `TrendChart.tsx` is a CSS-only stub instead. No Lighthouse CI dependency either; no performance-budget job exists in `ci.yml`.

**`[PHASE 8 ADDITIONS — 2026-08-20]`** *(an addition, not a rewrite — the lists above are Weeks 4's)*

**New migrations:** `016_product_stripe_product_id` · `017_body_format`

**New backend files:** `app/services/stamping.py` · `scripts/backfill_stripe_product_ids.py` · (extends) `stripe_client.py`, `publish_guard.py`, `admin/courses.py`, `admin/templates.py`, `admin/products.py`, `admin/metrics.py`

**New frontend files:** `components/nav/ProductsMenu.tsx` · `components/product/WhyThis.tsx` · `components/content/RichText.tsx` · `pages/PacksCatalogue.tsx` · (extends) `MarketingLayout.tsx`, `MemberLayout.tsx`, `VideoPreview.tsx`, `RichTextEditor.tsx`, `AdminCourses.tsx`, `AdminTemplates.tsx`, `AdminProducts.tsx`, `AdminMetrics.tsx`

**New routes:** `/packs` — and `/store` **kept**, demoted to the menu's "All products"

**New endpoints:** `POST /admin/products/{id}/price` · `POST /admin/templates/{id}/create-product` · `GET /admin/media/{id}/playback-token` · `GET /admin/metrics/revenue-series` · `GET /packs`

**New dependencies:** `nh3` (server-side HTML sanitizer) · `python-docx` · `openpyxl` · `pypdf` (stamping) · `@tiptap/extension-link`, `@tiptap/extension-underline` · **possibly** `recharts` per decision #33 — **only with the entry chunk measured before and after** (W4-R8)

**`[PHASE 9 ADDITIONS — 2026-08-20]`** *(an addition, not a rewrite)*

**New migrations:** `021_order_refund_details` — **not `019`**, which is taken by `019_user_last_sign_in_at` (merged at `020_merge_015_019`)

**New backend files:** (extends) `services/refund_service.py`, `integrations/stripe_client.py`, `core/publish_guard.py`, `api/v1/me.py`, `admin/courses.py`, `admin/templates.py` · new pack-admin module · `emails/refund_confirmation.{html,txt}.j2`

**New frontend files:** `pages/admin/AdminPacks.tsx` · `pages/Purchases.tsx` · (extends) `AdminCourses.tsx`, `AdminTemplates.tsx`, `AdminOrders.tsx`, `Library.tsx`, `Dashboard.tsx`, `CourseDetail.tsx`, `legal/Refunds.tsx`

**Removed:** `pages/admin/AdminProducts.tsx` · the `/admin/products` route and nav entry. **`api/v1/admin/products.py` is kept** as the shared seam.

**New routes:** `/purchases` (member) · `/admin/packs`

**New endpoints:** `GET /me/orders` · `GET /me/orders/{id}/refund-eligibility` · `POST /me/orders/{id}/refund` · `POST /admin/templates/{id}/create-product`

**New dependencies:** none

**The Phase 9 commands that matter**

```bash
# The sentinel is named, and nothing WRITES it onto a product.
rg -n 'placeholder_update_in_stripe' backend/app --glob '!**/__pycache__/**'

# The admin surface is gone; the API seam is not.
rg -n 'admin/products' frontend/src            # expect nothing
rg -n 'products' backend/app/api/v1/admin/router.py   # expect the include

# No wording that breaches the ACL.
rg -in 'no refunds|all sales final|non-refundable' frontend/src backend/app

# The gate still holds after everything above.
cd backend && pytest -q tests/gating
```

**The Phase 8 commands that matter**

```bash
# The placeholder price id is never WRITTEN. `[CORRECTED 2026-08-20]`
# It legitimately survives as a guard sentinel in three READ sites
# (publish_guard.py:260, admin/products.py:103 and :266). A bare
# "returns nothing" assertion here would delete the guards, so the
# check is scoped to assignment, not to mention:
rg -n '= *"placeholder_update_in_stripe"' backend frontend   # must be empty
rg -n 'placeholder_update_in_stripe' backend                       # 3 guard sites + tests, expected

# What the page shows is what Stripe charges.
python backend/scripts/check_price_parity.py

# No raw HTML rendered anywhere but the one sanctioned component.
rg -n 'dangerouslySetInnerHTML' frontend/src

# Downloads are still counted without counting people.
psql "$DATABASE_URL" -c "\d download_events"
```

**The Phase 9 commands that matter**

```bash
# The admin Products surface is gone; the API seam it called is not.
rg -n "admin/products" frontend/src            # must be empty
rg -n "products" backend/app/api/v1/admin/router.py   # still registered

# The gate was not touched. This is the proof, and it must pass UNCHANGED.
pytest backend/tests/gating -q

# Every migration head is single, and 019 was not reused.
alembic heads && alembic current

# No shipped string denies a statutory right (Research Spec 11.3).
rg -in "no refunds|all sales final|non-refundable" frontend/src backend/app   # must be empty

# The 15% rule rounds the way the tests say it does.
pytest backend/tests -k "refund and (eligibility or rounding)" -q
```

**The design values you will reach for most**

```text
Surface       bg-card / bg-gold-soft (#F3E9D2 · #2E2517)
Border        1px var(--border) (#E6DFD0 · #332B1E)
Radius        rounded-lg 8px (cards) · rounded-md 6px (inputs, thumbs)
Padding       p-5 base, p-6 from sm
Label         text-sm 500 --muted-foreground
Value         text-sm 400 --foreground, tabular-nums on numerals
Price         text-h3 600 --gold-strong, tabular-nums
Eyebrow       .eyebrow — mono 12px uppercase +0.16em, 24px --gold rule
Icon          16px Lucide, stroke 1.75, --gold-strong
Hover         .hover-lift — 2px, shadow-md, 150ms --ease-standard
Entrance      opacity 0→1 + y 8→0, 220ms --ease-entrance, stagger min(i,6)*0.03
Focus         :focus-visible — 2px --ring, 2px offset, 4px radius
Elevation     0 by default; shadow-lg on the lightbox only
```

**The commands that matter**

```bash
# The paywall still holds — including revocation, and including the twelve attacks.
cd backend && pytest -q

# No component holds a hex (email templates are the only sanctioned exception).
rg -n '#[0-9a-fA-F]{3,8}\b' frontend/src --glob '!**/*.css'

# No inverting token on the dark plane.
rg -n 'bg-stage' frontend/src -l | xargs rg -n 'primary|accent'

# No hard-coded currency symbol on a formatted amount.
rg -n 'A\$|\$\{.*price' frontend/src --glob '*.tsx'

# No shipped string displaces a statutory right (non-negotiable #16, W4-R20).
rg -in 'no refunds|all sales final|non-refundable' frontend/src backend/app

# No hover distance drifted past 2px.
rg -n 'translate-y-|whileHover' frontend/src

# Every claim on a product page is backed by a column.
psql "$DATABASE_URL" -f scripts/check_evidence_complete.sql

# No two published products overlap.
psql "$DATABASE_URL" -f scripts/check_overlaps.sql

# Every index built cleanly.
psql "$DATABASE_URL" -c "select indexrelid::regclass from pg_index where not indisvalid"

# The frontend still compiles and still fits its budget.
cd frontend && npx tsc --noEmit && npm run build && npm test && npx playwright test
```

**Phase 10 — the user account (W4-R21).**

```bash
# There is exactly ONE purchases component and ONE refund code path.
# Phase 10 extracts Purchases.tsx; a second copy or a second
# eligibility rule is the money-path fork non-negotiable #1 forbids.
rg -l 'refund-eligibility' frontend/src        # expect exactly one file
rg -n 'refund_amount|15 / 100|percent.*15' backend/app --include=*.py

# No hard-delete path exists anywhere. Closure sets disabled_at
# and nothing else; the gate already filters on it.
rg -n 'delete\(User\)|DELETE FROM users|session.delete\(user' backend/app
rg -n 'disabled_at' backend/app/core/entitlements.py   # must still be inside the gate

# A password is never logged, audited, or emailed.
rg -n 'password' backend/app --include=*.py | rg -v 'reset|hash|Depends|# '

# The rate limiter is extracted once, not copied five times.
rg -ln 'monotonic\(\)' backend/app        # expect one core module, not five endpoints

# Transactional mail is never gated by a preference.
rg -n 'notify_marketing|notify_product_updates' backend/app/services/email_service.py
#   ^ expect NO hits in the receipt / access-granted / password-reset / security-alert paths

# Migration head is single and 022 did not re-add an existing column.
cd backend && alembic heads && alembic current
rg -n 'disabled_at' alembic/versions/022_*.py   # must return nothing

# The gate was extended, never rewritten. This must pass UNCHANGED.
pytest tests/test_entitlements.py tests/test_refund_selfserve.py
```

---

## 30A. Problem-scoped reference packs — the next pack shape

`[ADDED 2026-08-20, owner direction]`

### 30A.1 The idea, in the owner's words

> Group the main questions, guides and related working materials around a **specific
> problem** into one downloadable PDF or resource pack. For example, if someone is
> dealing with vendor evaluation, instead of purchasing several individual templates,
> they could purchase one reference pack containing the relevant templates, guides and
> supporting material.

### 30A.2 Why this needs almost no new engineering

`app/api/v1/content/packs.py` already opens with the sentence that makes this cheap:

> *"A pack is not a type; it's a **shape** a product can be in: a published product whose
> `product_contents` include >= 1 `template` row (the PDF) and >= 1 `question_set` row."*

A problem-scoped pack is **the same shape with a different selection rule**. What exists
today scopes the selection by `Domain` (one pack per domain, questions in
`_WORKING_ORDER`). What this adds is a pack whose contents are chosen by *situation*
rather than by domain — and which is allowed to carry **more than one template**, because
a real problem needs several working files, not one.

Concretely, the deltas against what already ships:

| Concern | Domain pack (built) | Problem pack (this) |
|---|---|---|
| Selection rule | one `Domain` | a curated list, crossing domains |
| Templates in the pack | exactly 1 (the PDF) | 1 PDF + **N working files** |
| Question ordering | `_WORKING_ORDER` (tier, then regulator pressure, then effort) | **editorial** — the order you'd actually work the problem |
| Entitlement | `product_contents` | unchanged |
| Download | `GET /templates/{id}/download-url` | unchanged |
| Overlap guard | W4-R3 | unchanged — **and it matters more here** |
| Routing in | `RoutedProducts` / `SituationProducts` (W4-R4) | unchanged, and this is what W4-R4 was built for |

**No new table. No new entitlement mechanism. No new download path.** The pack shape,
the evidence layer (W4-R1), the overlap guard (W4-R3) and the question→product routing
(W4-R4) all apply unchanged. That is the whole argument for building this next rather
than something else.

### 30A.3 The two real problems to solve

**1. Overlap is the commercial risk, not a technical one.**
A vendor-evaluation pack will contain templates that are also sold individually and that
may also sit in a domain pack. W4-R3's `check_overlaps.sql` exists precisely to refuse
two published products that grant the same content — so either the guard blocks this, or
the guard's rule has to become "overlap is permitted **when the pack's price exceeds the
sum of its parts' individual prices minus a declared bundle discount**", which is the
`BundleCard` arithmetic already implemented in the frontend. **Decide which before
seeding a second pack shape**, because retrofitting an entitlement rule after money has
changed hands is the expensive version.

**2. Ordering has no algorithm.**
`_WORKING_ORDER` works for a domain pack because "fundamentals first, then regulator
pressure, then effort" is a defensible generic sequence. A problem pack's order is the
order you'd actually *work the problem* — scope it, ask the vendor, score the answers,
write it up. That is editorial judgement, not a sort key. It needs a real
`sort_order` column on the pack's content rows and an admin UI to set it, or it needs to
live in `scripts/build_<pack>.py` the way `_WORKING_ORDER` does today. **The script route
is correct for pack #2 and wrong by pack #5.**

### 30A.4 Suggested first pack

**Vendor / third-party evaluation** — the owner's own example, and the best first
candidate for three independent reasons:

- It is genuinely cross-domain (Risk + Cyber + Compliance + Resilience), so it proves the
  selection rule that a domain pack cannot express, rather than duplicating one.
- `Home.tsx`'s `TRY_TERMS` already ships `{ label: 'Third parties', term: 'third-part' }`,
  and that term was checked against the live catalogue to actually return results — so
  the questions to anchor it exist.
- It is a recognised procurement moment with a budget attached, which is the difference
  between a resource someone bookmarks and one they expense.

### 30A.5 What NOT to do

- **Do not make "pack" a `content_type`.** The current design is better than the obvious
  one; a `pack` enum value would fork the entitlement path for no gain.
- **Do not paywall the questions.** `HONESTY_NOTICE` is returned by the API rather than
  written in frontend copy specifically so a future page cannot forget it. A problem pack
  must carry the same notice, for the same reason.
- **Do not ship it without the overlap decision in §30A.3.**

---

## 31. What this week deliberately leaves for whoever comes next

Written here rather than only in the report, because a plan that names its own end state is easier to hand over than one that stops.

**Ready to build, unblocked by this week's work:**
- **Problem-scoped reference packs** (§30A, owner direction 2026-08-20) — the same pack *shape* already shipping, scoped by situation instead of by domain, carrying several working files rather than one PDF. No new table, no new entitlement path. Gated on one decision, not on engineering: what the overlap guard (W4-R3) should do when a pack and an individually-sold template grant the same content.
- **Decision Pack v0** as files at A$79 — author-days only. The evidence layer (W4-R1), the overlap guard (W4-R3) and the routing (W4-R4) all apply to it unchanged the day it exists.
- **The free diagnostic** — W4-R4 built its output layer first, deliberately. The diagnostic becomes a different way to reach the same routing, not a second recommendation engine.
- **Consultant licence tiers** — the field and the enum ship this week. Decision #25 turns a label into revenue.

**Blocked, with the gate named:**
- `decision_workspace` — real engineering, weeks, and it should follow a demand signal from Decision Pack v0 rather than precede it.
- Challenge My Thinking — an editorial backlog and a published confidentiality position (#29).
- Question of the Week — editorial capacity (#30).
- Going live on Stripe — and remember it is **bundled** with the Vercel and Render tier questions (§8.3). Three decisions, one day.

**The one thing that would most improve this codebase and is not in any plan:** frontend test coverage beyond the four files W4-R9 starts. The backend has 62 tests and a discipline behind them; the frontend has a type checker and an end-to-end suite with nothing in between. Every bug this project has found by clicking around — the dead filter chips, the multipart upload, the stale closure in the video dialog, the NUL byte, the `w-ful` typo — lives in exactly that gap.

---

*Opens on the GO recorded in [`week3_report.md`](week3_report.md). Closes with `week4_report.md` and the final handover. Sourced from the intern brief's Week 4, `DESIGN.md` §16/§40/§41/§42/§43/§60/§62/§63, `BACKEND.md`, the Research Specification, `docs/new_additions.md` (triaged in §2.2), `docs/pricing.md`, `docs/handover.md`, `docs/db_index_evidence.md`, `frontend/src/styles/theme.css`, and a direct read of the repository on 2026-08-17.*
