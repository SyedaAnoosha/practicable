# Week 3 — PRD, Design Specification and Implementation Plan

**"Deciding in the Dark" Platform · v1.0 · 2026-08-15 · opens on the GO recorded in [`week2_report.md`](week2_report.md)**

*Sourced from `Deciding_in_the_Dark_Platform_Intern_Brief.md` (Week 3 — commerce and content), `Deciding_in_the_Dark_Product_Spec.md` §4/§5/§9, `Deciding_in_the_Dark_Research_Specification.md` (Parts Four, Six, Seven, Eleven, Appendices F/H/I/J/M), `DESIGN.md` v2.0 (§28–§32, §31, §60), `BACKEND.md`, and the repository as it stands on 2026-08-15. Every requirement below traces to at least one of those; where they disagree, §0.3's precedence rule decides.*

---

## 0. How to read this document

### 0.1 What each part is for

| Part | Contains | Read it when |
|---|---|---|
| **I — PRD** | What Week 3 must produce, and how each item is judged | Before you start; before you cut anything |
| **II — Design specification** | Every colour, size, space, gradient, easing and string used this week | Before you write a component; while you write a component |
| **III — Implementation plan** | Phase by phase, step by step, with file paths and code | While you build |
| **IV — Database performance and integrity** | The index layer, the constraints, and the method for proving both | Phase 2, and before any query is called "fast" |
| **V — Ledger, risks, reference** | The checklist, the watchlist, the commands that matter | Daily |

### 0.2 Status markers

`[BUILT]` verified present in the repository on 2026-08-15 · `[GAP]` verified absent · `[OWNER]` blocked on a decision only the owner can make · `[NEW]` first specified in this document · `[DEFECT]` a live bug found while writing this plan, with its fix scoped here

### 0.3 Precedence

1. **The intern brief** — non-negotiables and the four-week sequence. Nothing overrides it.
2. **`DESIGN.md`** — everything the user sees, and §60.1's cut order.
3. **`BACKEND.md`** — the service, the gate, the API contract.
4. **The Research Specification** — the reasoning, the entity model, the legal and security positions.
5. **`frontend/src/styles/theme.css`** — the single source of truth for every design *value*. Where `DESIGN.md` and `theme.css` state different numbers, `theme.css` is right and `DESIGN.md` is stale. §13.2 records three places where that is currently true.
6. **This document** — sequencing and detail. Where it contradicts one of the above, the above wins and this file is wrong.

### 0.4 Verified state of the build entering Week 3

Every row checked against the repository on 2026-08-15, not carried forward from `week2_plan.md`.

| Area | State | Evidence |
|---|---|---|
| Gating suite | `[BUILT]` | `backend/tests/` — 53 backend tests, 14 cases, each seen red ([`gating_seen_red.md`](gating_seen_red.md)); Playwright + axe in `.github/workflows/ci.yml` |
| Discovery scoring | `[BUILT]` | `lib/scoring.ts` + `services/question_service.py`, parity from `tests/fixtures/scoring_cases.json` |
| Lesson blocks | `[BUILT]` | `009_lesson_blocks`, `LessonBlocks` renderer, `BlockEditor`, render parity verified |
| Storefront | `[BUILT]` | `/store`, `StoreSection`, `ContentTypeCard`, `/store/packs/:slug` |
| Legal drafts | `[BUILT]` | `/legal/{terms,privacy,refunds}` + `DraftBanner`; refund window intentionally left `[OWNER]` (#17 — owner confirmed 2026-08-15, "keep as is") |
| Analytics | `[BUILT]`, key configured | `lib/analytics.ts` (5 client) + `integrations/posthog_client.py` (4 server); PostHog project key set in all four env locations 2026-08-15. `refund_issued` **defined with no call site** |
| Admin editors | `[BUILT]` | 23 routes, three editors, autosave, blur validation, `/admin/orders`, manual grant + audit |
| **Template file provenance** | **`[CLOSED]`** | **Owner-confirmed 2026-08-15 (revised): the six vendor-risk template files are the owner's own — purchased/licensed for use, not unauthorised third-party downloads.** The earlier reading (that these were casual test downloads) was corrected the same day. The A$39 Vendor Risk Assessment Scorecard stays published; the five unused files remain legitimate raw material for new products. **One residual, non-blocking item:** confirm the purchase licence covers *resale/redistribution as a paid downloadable product*, not only personal/internal use — a licence permitting use is not automatically a licence permitting resale, and it costs nothing to check once. Not gated on; recorded so it isn't forgotten (§8.2) |
| **Email delivery** | **`[GAP]`, but the fix no longer needs a domain** | `email_service.py` module docstring: *"NO REAL CUSTOMER RECEIVES ANY EMAIL."* Resend sandbox sender; every send redirected to `OWNER_NOTIFICATION_EMAIL` and relabelled `[Not delivered to buyer]`. **Owner confirmed 2026-08-15: no domain will be purchased.** But `handover.md` §1 records Mailjet delivering live, to arbitrary real recipients, over REST (unaffected by Render's port-587 block), before it was removed *by choice* — not because it failed. Restoring it is the actual path to closing this, not a domain |
| The other four emails | **`[GAP]`** | Only `send_receipt_email`, `send_sale_notification_email`, `send_contact_notification_email` exist. `DESIGN.md` §32.3 names five; welcome, access-granted, password-reset and free-entry-point links do not exist |
| Email templating | **`[GAP]`** | HTML is built by f-string in Python. `DESIGN.md` §32.1 specifies Jinja2; §32.2 requires a plain-text alternative on every send |
| Catalogue breadth | **`[GAP]`** | Two published products (Risk Register Fundamentals A$49, Vendor Risk Assessment Scorecard A$39) + one content-ready pack. Five real, owner-licensed template files sit unused in Storage (`docs/pricing.md` §2) — legitimate raw material for new products this week |
| Bundles | **`[GAP]`** | No product carries `product_contents` rows spanning two previously separate products. RS 4.1 lists one bundle as `[Should have]` for v1. **Priced this week: Risk pack (A$49) + course (A$49) = A$98 → bundle at A$79, saving A$19 (19.4%)** — decision #29, closed below |
| Pricing page | **`[GAP]`** | No `/pricing` route in `App.tsx`. `DESIGN.md` §28.1 holds the layout; §28.2's rules are unenforced anywhere |
| Refunds / revocation | **`[GAP]`, mechanism only** | No refund endpoint, no revocation path, no `revoked_at` column. `handover.md` §4 item 8 names this. **The window number itself stays undecided (#17) — ship the mechanism against the existing generic ACL-safe wording, not a specific day count** |
| Editorial control | **`[GAP]`** | The homepage features *"first question in each domain by `created_at`"* — an accident of seed order (`handover.md` §4 item 9) |
| Question previews | **`[GAP]`** | 99 of 100 are machine-truncated; `DESIGN.md` §20.3 bans exactly that |
| Stripe mode | **`[CLOSED]`, deliberately** | **Owner confirmed 2026-08-15: stay in test mode until told otherwise.** `rk_test_` restricted key stays. Decision #21 answered, not open |
| Vercel / Render tier | **`[CLOSED]`, deliberately** | **Owner confirmed 2026-08-15: stay on Vercel Hobby and Render's current tier, no upgrades.** Coherent with staying in test mode — with no real payments flowing, Vercel Hobby's commercial-use restriction is not currently being violated (`handover.md` §4 item 1's gap is moot while test-only). Render's cold-start risk on a true free tier is flagged in Phase 0 rather than assumed away |
| Legal entity on receipts | **`[CLOSED]`, deliberately** | **Owner confirmed 2026-08-15: stays as currently drafted** ("Effective RM", ABN left `[OWNER]`, per `Terms.tsx`). Decision #27 answered as "no change," not open |
| **Database indexes** | **`[GAP]` — see Part IV** | Three explicit indexes exist in the entire schema (`ix_tag_values_dimension`, `ix_contact_messages_created_at`, `ix_lesson_blocks_lesson_id`). **Every foreign key in the schema is unindexed.** Postgres does not index FKs automatically |
| **Uniqueness on money** | **`[GAP]` — see §26.2** | No unique constraint on `entitlements(user_id, product_id)`, `orders(stripe_session_id)`, `lesson_progress(user_id, lesson_id)` or `course_progress(user_id, course_id)`. Idempotency currently rests entirely on `webhook_events.stripe_event_id` plus application code |

---

# PART I — PRODUCT REQUIREMENTS

## 1. Objective

> **Make the store sellable to a stranger: several real products with deliberate pricing and a bundle, email that actually arrives, money that can move backwards as well as forwards, an admin a non-developer has been watched using, shelves full enough to read as inhabited — and a database that stays fast as the catalogue grows.**

Week 1 proved one path works once. Week 2 proved it keeps working and widened one product into a catalogue. **Week 3 is the week the platform stops being a demonstration of a transaction and becomes a shop that can take a real customer's money and serve them afterwards.**

The brief's own words for this week: *"Paid templates and paid access working across several products… pricing and tiers applied deliberately… transactional email working. Admin usable by someone who is not you — prove it by watching someone else add a lesson. Load enough real content that the platform looks inhabited rather than demonstrated: empty shelves read as abandoned."*

## 2. Why this scope, and why the email spine leads it

`DESIGN.md` §60's Week 3 is *"multiple products, pricing, tiers, the free entry point. Transactional email. Admin usable by someone who is not the developer — and proved by watching them. Enough real content that the platform reads as inhabited."* That is almost exactly right, and this plan keeps it. Three changes, one of them forced by owner decisions made 2026-08-15 that materially reshape the catalogue work:

**1. Transactional email is still promoted from a line item to the week's non-negotiable, but the path to it changed.** It is the only item on the list that is currently *impossible*, not merely unbuilt: `email_service.py` states in capitals that no real customer receives any email at all. [`week1_go_no_go.md`](week1_go_no_go.md) §5 makes it condition #1 on the entire project, and it fails silently — checkout succeeds, the entitlement lands, the buyer gets nothing, and no error appears anywhere.

**A domain purchase is off the table this week (owner decision, 2026-08-15).** That does not defer the fix — it changes it. `handover.md` §1 already records that Mailjet was working over REST, delivering to arbitrary real recipients, before it was removed *by choice*, not because it failed, and Mailjet verifies a single sender *address* (`anooshaerm@gmail.com`, who owns the account) rather than a domain. Restoring it is genuinely less work than the domain path this document originally specified: no DNS, no propagation wait, no SPF/DKIM. See W3-R1.

**2. Catalogue breadth builds from both templates and packs.** The owner confirmed 2026-08-15 that the six vendor-risk template files are their own — purchased/licensed for use, correcting an earlier reading that they were casual third-party test downloads. The A$39 Vendor Risk Assessment Scorecard stays published, and the other five remain legitimate raw material for new template products this week, alongside the **domain-pack mechanism** — typeset from the owner's own 100 questions — and one bundle. **One residual, non-blocking check (§8.2):** confirm the purchase licence covers resale as a paid downloadable product, not only personal use.

**3. Two additions §60 did not name, both of which the repository forced onto the list.**

- **Refunds and revocation** (W3-R5). The refund page ships as a draft; there is no code path to honour it. RS 11.3 establishes under Australian Consumer Law that the refund obligation exists whatever the policy says — so the platform currently has a written promise it cannot keep. `analytics.py` even defines a `refund_issued` event with no call site, which is the gap describing itself. **The specific window (decision #17) stays undecided by owner instruction ("keep as is") — the mechanism ships against the general ACL-safe wording already drafted, not a number.**
- **The database index layer** (W3-R9, Part IV). Week 2 removed the *round trips* from four endpoints (`handover.md` §1) and left the *sequential scans* underneath them. Every query that gate, catalogue, library and admin depend on filters or joins on an unindexed column. At 100 questions and 3 products this is invisible; the whole point of Week 3 is that those numbers stop being 100 and 3. Adding indexes after the catalogue grows means adding them under load, against tables people are reading.

### 2.1 A scope warning, stated plainly

**Several decisions closed 2026-08-15 removed most of this week's external dependencies.** Stripe stays in test mode by explicit owner call (#21, closed); hosting stays on Vercel Hobby / Render's current tier by explicit owner call, and is coherent with staying in test (no live payments means Vercel's commercial-use restriction is not currently being violated); the receipt's legal entity stays as drafted (#27, closed); the refund window stays undecided on purpose (#17, closed as "leave open"); the six template files are confirmed the owner's own, purchased/licensed (#28, closed). **What remains outside my control:** W3-R6's usability test, which the owner has said will happen later, not this week — so it is removed from this week's Definition of Done rather than carried as a slipping blocker. One residual, non-blocking check carries forward (§8.2): confirming the template purchase licence covers resale as a paid product.

The honest read: **the engineering in this plan now fits five days more comfortably than v1.0 did, because three of the four blocking human dependencies resolved in one exchange.** Week 2's own lesson holds again — *"every item that looked stuck on this ledger was stuck on a decision, not on engineering capacity."*

## 3. Who this week serves

| User | What Week 3 gives them | Requirement |
|---|---|---|
| **The stranger** | Shelves with more than three things on them, priced on a legible ladder, with a page that explains what each tier costs and why | W3-R2, W3-R3, W3-R8 |
| **The buyer** | A receipt that arrives in *their* inbox, an access email that links straight to what they bought, and a refund position that can actually be honoured | W3-R1, W3-R5 |
| **The buyer who changed their mind** | A refund that revokes cleanly, without a developer running SQL | W3-R5 |
| **The owner** | A catalogue they can price and publish themselves, editorial control over the front page, and reconciliation that includes money going out | W3-R6, W3-R7, W3-R5 |
| **The non-technical editor** | Upload rather than paste: a video file, a template file, and a draft state to work in before anything is public | W3-R6 |
| **The next developer** | A schema whose constraints state the rules instead of documenting them, and an index layer with a measurement behind each entry | W3-R9 |

## 4. Scope

### 4.1 In scope

W3-R1 The email spine · W3-R2 Several real products, tiers and one bundle · W3-R3 The pricing page · W3-R4 Content that reads as inhabited · W3-R5 Refunds and revocation · W3-R6 Admin a non-developer can use, proven · W3-R7 Editorial control of the front page · W3-R8 The launch-condition sweep · W3-R9 Database performance and integrity · W3-R10 Analytics closes its own loop · W3-R11 A cart, so several things can be bought in one checkout

### 4.2 Out of scope, deliberately

| Not this week | Why | Source |
|---|---|---|
| Subscriptions / recurring billing | Named non-goal; changes the business model, not a side effect of a build week | Product Spec §6, RS 4.1 |
| Team / enterprise seats | Different purchase flow entirely (org accounts, seats, invoicing) | RS 4.1 |
| Certificates | *"Cheap, and worth a fast follow shortly after launch — not blocking it"* | Product Spec §6 |
| AI-assembled tailored pack | Needs the store, tagging and all three types live and stable first | Product Spec §6, `DESIGN.md` §61.1 |
| Semantic search | First in `DESIGN.md` §60.1's cut order | §60.1 |
| Audio versions, case studies | A fourth/fifth content type; the first three are not yet proven at volume | Product Spec §6 |
| Drag-and-drop block reordering | Up/down meets §31.3's actual requirement | §31.3 |
| The full accessibility audit | Week 4. axe-in-CI stays this week's floor | §42.9 |
| Stripe Tax automation | `[OWNER]` decision #26 — needs an accountant, not a developer. The *statement* of tax behaviour before redirect (§28.2) is in scope; automated multi-jurisdiction calculation is not | RS 11.5 |
| A second author / second section | Designed for, not built. Week 4's handover documents the path | RS 10.1 |
| Read replicas, sharding, caching layers | §27.4 explains why the answer at this scale is indexes and query shape, not infrastructure | Part IV |

## 5. Requirements

Each carries its source, a testable statement, and the acceptance criteria used at the go/no-go.

---

### W3-R1 — The email spine `[MUST — the week's non-negotiable]`

**Source:** Brief (*"a transactional receipt and an access email that actually arrive"*); `DESIGN.md` §32; RS 6.7; [`week1_go_no_go.md`](week1_go_no_go.md) §5 condition 1.

**Statement.** A real buyer at a real address receives a real email, and the five emails `DESIGN.md` §32.3 names all exist, render in a hostile client, and read correctly with images blocked.

**No domain purchase this week (owner decision, 2026-08-15).** The path to real delivery is **restoring Mailjet**, not verifying a Resend domain — `handover.md` §1 already records it delivering live to arbitrary real recipients over REST before it was removed by choice, and it verifies a single sender *address* rather than a domain. `anooshaerm@gmail.com` — who owns the Mailjet account — is both the verified sender and `OWNER_NOTIFICATION_EMAIL`.

**Acceptance**
- Mailjet is restored as the active transport in `email_service.py` (its integration already exists per `docs/email.md`/`docs/gmail.md`'s fallback-chain history — this is un-removing it, not writing it fresh), with `anooshaerm@gmail.com` verified as the sender in the Mailjet dashboard. `SANDBOX_SENDER` and the Resend-only redirect path are gone.
- **Delivery is confirmed by querying the provider's API for the message's status, not by the absence of an error line in the logs.** `handover.md` §4 item 3 records this exact mistake being made twice.
- All five emails exist: **welcome · receipt · access granted · password reset · free-entry-point link**, each rendered from a Jinja2 template under `backend/app/emails/`, each with a plain-text alternative on the same send.
- Every template: 600px single-column table layout, all CSS inline, no CSS variables, `color-scheme: light dark`, a bulletproof CTA button (table cell with a background colour, never an `<a>` with a background image), and alt text on every image.
- The receipt carries order reference, product, amount + currency, date, and the **contracting entity name and address exactly as currently drafted** ("Effective RM", ABN left `[OWNER]`) — decision #27 is closed as "no change," not reopened this week.
- The one buyer already owed a receipt (`handover.md` §4 item 14 — two orders, `c2947bdc` and `46ff0ba1`) is sent theirs.
- Render's environment is reconciled: `MAILJET_API_KEY`/`MAILJET_SECRET_KEY` set, `OWNER_NOTIFICATION_EMAIL=anooshaerm@gmail.com`; `RESEND_API_KEY`, `GMAIL_USER`/`GMAIL_APP_PASSWORD` and `BREVO_*` deleted if still present (`handover.md` §4 item 15 — a stale credential is one nobody is watching).

---

### W3-R2 — Several real products, tiers, and one bundle `[MUST]`

**Source:** Brief (*"paid templates and paid access working across several products… pricing and tiers applied deliberately"*); Product Spec §9; RS 4.1 (*bundles: `[Should have]`*); `docs/pricing.md` §1.

**Statement.** The catalogue holds enough genuinely distinct, genuinely priced products that the ladder in `docs/pricing.md` §1 is visible in the storefront rather than only in a document — including one bundle priced at a legible discount against its parts.

**Provenance note, 2026-08-15.** The owner confirmed the six vendor-risk template files are their own — purchased/licensed for use — correcting an earlier reading that they were casual third-party test downloads. The A$39 Vendor Risk Assessment Scorecard stays published; the other five are legitimate raw material for this requirement's new products. **One non-blocking check** carries in §8.2: confirming the purchase licence covers resale as a paid downloadable product, not only personal/internal use — worth a quick look, not a gate.

**Acceptance**
- **At least six published products** spanning all three content types, every price taken from `docs/pricing.md` §1's ladder and justified against §1's tiering rules by *actual depth* (file count, lesson count, run time) — never by copying a number from RS 4.2's illustrative table.
- Every new paid template is a **real file that already exists** (five sit unused in Storage per `docs/pricing.md` §2) with **at least two preview images** — RS 4.2 found listings with 2–3 previews earned materially more than listings with none, and `DESIGN.md` §16 makes two the minimum for a paid template.
- **One bundle exists** (decision #29, closed — see §8): **Risk Register Fundamentals (A$49) + the Risk domain pack (A$49) = A$98, bundled at A$79 — a saving of A$19, 19.4%**, inside the 10–25% band that motivates a purchase without collapsing the standalone prices. Built as an ordinary `product` with `product_contents` rows spanning both parts — **no new entitlement mechanism** (RS 5.6). The bundle price and the sum of its parts are both shown (RS 4.1's *"$149 vs $79 + $99 = $178 is the whole point"* principle, applied at this catalogue's real numbers). Both parts are chosen deliberately from the course and the pack rather than a third template, so the bundle's IP-cleanliness doesn't hinge on the licence-scope check above; nothing stops a second bundle including a template once that check clears.
- The asymmetry from `docs/pricing.md` §2 holds under the bundle: **a course purchase includes the templates its lessons use; a template purchase never unlocks a course.** Gating case 13's entitlement-shape regression is extended to cover both the new templates and the bundle.
- Buying the bundle grants every part in **one transaction**, and buying a part the buyer already owns is refused before checkout, not after payment.

---

### W3-R3 — The pricing page `[MUST]`

**Source:** `DESIGN.md` §28.1/§28.2; RS 2.2 (*abandonment causes*); Product Spec §9 (*"a pricing structure that converts"*).

**Statement.** A visitor can see the whole commercial model on one page — what is free, what each tier costs, what "lifetime access" means, and what happens if they want their money back — before they are asked for anything.

**Acceptance**
- `/pricing` exists, is linked from the marketing header and the store, and renders **three columns, never two** (§28.1: an even split has no visual centre).
- Every price is **visible and real**. No "contact us", no "from $—", no price behind a click, no tile for something unbuyable.
- **Billing type** (`one-time`) and **access duration** (`lifetime`) are stated explicitly on every tier — RS 2.2 names ambiguity about expiry as a purchase blocker for anyone expensing it.
- The **refund position is stated on this page**, not only in `/legal/refunds`, using the **general ACL-safe wording already drafted** — decision #17's specific window stays deliberately undecided (owner instruction, "keep as is"), so this page must not invent a number the legal page does not also state.
- **Tax behaviour is stated before the checkout redirect.** §28.2: a price that changes on the Stripe page is the most common source of abandonment and of *"this feels dishonest."*
- Prices format through `Intl.NumberFormat` using the currency the API returns. **No hard-coded symbol anywhere** — a grep for `'A$'` and `'$'` in `frontend/src` returns only copy, never a formatted amount.
- The free entry points (all 100 questions; the Risk Register template) appear **in the pricing table as a column**, not as a footnote beneath it.

---

### W3-R4 — Content that reads as inhabited `[MUST]`

**Source:** Brief (*"empty shelves read as abandoned"*); `DESIGN.md` §20.3, §49.1; `handover.md` §4 items 10, 11.

**Statement.** Every surface a stranger reaches is full enough, and honest enough, that the platform reads as a going concern rather than a demonstration with one of everything.

**Acceptance**
- **The 99 machine-derived previews are replaced with authored ones.** `DESIGN.md` §20.3 bans a machine-truncated preview outright, and `preview` is half of what the homepage and catalogue text search match against — so this is a discoverability defect, not only a typographic one. `[OWNER]` decision #22; the editing surface is `/admin/questions`, which exists.
- **The quick-win end of the taxonomy is no longer near-empty.** `duration=xs` has 1 question and `effort=quick` has 1, while the product's own pitch is *"what can I fix in a fortnight, cheaply, that my regulator cares about?"* The fix is editorial and the choice is the owner's: re-tag over-estimated durations, or author the short-horizon questions the pitch implies. **What must not ship is a landing-page chip that promises a fortnight and returns one result** (`handover.md` §4 item 10).
- **A second course exists**, or the existing one gains enough lessons to defend its A$49 price — `docs/pricing.md` §2 already records, in the owner's own hold, that *"the course still needs more real lessons before it is worth what it now costs."*
- **Related-question links are populated** (`question_relations`), so a question page leads somewhere other than the catalogue.
- At least **two domain packs** clear `MIN_QUESTIONS_TO_PUBLISH = 20`, or the four thin domains are formally left unpublished with the reason recorded — never generated-but-published.
- `DESIGN.md` §49.2's stress fixtures are loaded and survive: a 140-character title, a very long person name, a question with all seven tags at their longest labels.

---

### W3-R5 — Refunds and revocation `[MUST]`

**Source:** RS 11.3 (ACL consumer guarantees; *ACCC v Valve*); `handover.md` §4 items 7, 8; `DESIGN.md` §31.7; `lib/analytics.ts`'s orphaned `refund_issued`.

**Statement.** Money can move backwards. A refund revokes the entitlement it paid for, in one audited operation, without a developer touching the database.

**Decision #17 stays open by owner instruction** ("keep the refund window as it is," 2026-08-15) — this requirement ships the mechanism against the general wording already drafted, and does not force a specific number this week.

**Acceptance**
- The **existing general ACL-safe refund wording** is stated identically on `/pricing`, `/legal/refunds` and in the receipt email — the same sentence, defined once, not three independent drafts. It contains **no blanket "no refunds", "all sales final" or "store credit only"** — RS 11.3 establishes those are themselves misleading conduct under the ACL, regardless of the product being digital. **A specific day count is not required to close this requirement**; the mechanism below must work correctly whatever window is eventually chosen.
- `entitlements` gains `revoked_at` and `revoked_reason`; `resolve_product_ids()` excludes revoked rows **in the same query it already runs**, not in a second one.
- `POST /admin/orders/{order_id}/refund` — issues the Stripe refund, sets `orders.status = 'refunded'`, revokes every entitlement that order granted, writes an `audit_log` row with actor, target, amount and a **required** reason, and fires the `refund_issued` analytics event that currently has no call site.
- **A gating test proves the revocation holds:** a buyer with a refunded order is denied the lesson, the template and the download URL on the *next* request. This extends case 7 (*entitlement revoked mid-session*), which today has no production code path that can actually produce the state it tests.
- Stripe's `charge.refunded` webhook is handled **idempotently by the same `webhook_events` mechanism as `checkout.session.completed`** — a refund issued from the Stripe dashboard rather than from `/admin/orders` must reach the same end state.
- A refunded buyer's receipt is not deleted; the order remains reconcilable, with its refund visible in `/admin/orders`.

---

### W3-R6 — Admin uploads and publish states — the usability test deferred `[MUST, engineering only]`

**Source:** Brief (*"show us it works by having someone else use it"*); `DESIGN.md` §31.1–§31.3, §31.8; carried unclosed from W2-R9.

**Statement.** The two engineering gaps a non-technical editor currently cannot get past without a developer — upload a video, upload a file, and work on something before it is public — are closed this week. **The watched usability test itself is explicitly deferred by the owner** ("I will do the non-dev test later," 2026-08-15) and is not part of this week's Definition of Done — it stays a named, scheduled item rather than a slipping blocker.

**Acceptance**
- **Mux direct upload from the admin.** Today the editor pastes an asset ID (`DESIGN.md` §31.8); a `POST /admin/media/upload-url` returning a Mux direct-upload URL replaces it, with the polling state (`Uploading → Processing → Ready`) shown honestly — Mux processing is not instant and a spinner that lies about it is worse than a status line.
- **Template file upload from the admin.** Today a file is uploaded to Supabase Storage by hand and its `storage_key` typed in. A presigned *upload* URL closes it, with the same state machine.
- **A publishing model beyond a boolean.** `DESIGN.md` §31.2 specifies `Draft → In review → Published → Archived`; §31.8 records the boolean as a deliberate Week 2 hold and names this Week 3 work. Unpublished content **404s, never 403s** (a 403 confirms the slug exists) — gating case 8 already asserts this and must stay green through the change.
- Every mutation continues to write an `audit_log` row, and the router-level admin guard is not weakened by any new endpoint.
- **The usability test itself (decision #23) is recorded as deferred, not closed and not blocking.** It is added back to Week 4's Definition of Done rather than this week's, so it does not quietly disappear — see §10's cut order, which no longer needs to cut it, since it was never in this week's plan to begin with.

---

### W3-R7 — Editorial control of the front page `[SHOULD]`

**Source:** `handover.md` §4 item 9; `DESIGN.md` §3.7.

**Statement.** What the landing page argues with is a decision the owner makes, not an accident of `created_at`.

**Acceptance**
- `questions` gains `featured` (boolean) and `featured_sort` (integer, nullable); `GET /questions` accepts `?featured=true`, and `Home.tsx` reads from that rather than *"first in each domain by `created_at`."*
- The admin question editor exposes both, with the current front-page set visible as a list in the order it will render.
- **Fallback is explicit, not accidental:** with nothing featured, the page falls back to today's behaviour and says so in the admin, so an empty featured set never produces an empty front page.

**Cost check:** one column pair, one `WHERE` clause, one toggle. `handover.md` calls it *"the difference between the owner approving the landing page and the owner discovering what is on it."*

---

### W3-R8 — The launch-condition sweep `[MUST, narrower than v1.0 — most of it closed 2026-08-15]`

**Source:** [`week1_go_no_go.md`](week1_go_no_go.md) §5; `handover.md` §4 items 1, 4; brief (*"every recurring fee is named and justified before you commit"*).

**Statement.** Every condition standing between this platform and a real customer's money is either closed or formally re-accepted with the owner's signature on the reason. **Four of the five items below closed in one exchange on 2026-08-15** — this requirement is now mostly a record of those decisions plus the two genuinely live items that remain.

**Acceptance**
- **`[CLOSED]` Stripe stays in test mode**, by explicit owner instruction, until told otherwise (decision #21). `/pricing` may go live on the storefront with real prices shown — Stripe Checkout still runs in test mode underneath it, so no real charge can occur regardless.
- **`[CLOSED]` Hosting stays on Vercel Hobby and Render's current tier**, by explicit owner instruction — no upgrade this week. This is coherent with staying in test mode: `handover.md` §4 item 1's Vercel commercial-use concern applies to *real* revenue-generating use, which is not occurring while Stripe is in test mode. **Re-open this the moment Stripe goes live**, not before — the two decisions are linked and must be revisited together.
- **`[CLOSED]` The receipt's legal entity stays as currently drafted** ("Effective RM", ABN left `[OWNER]`) — decision #27, no change.
- **`[CLOSED]` The refund window stays undecided** — decision #17, "keep as is." See W3-R5.
- **Still open, and worth naming rather than dropping:** PITR is named and priced in `handover.md` §3 even though it is not urgent while in test mode — the free tier's lack of point-in-time recovery is a fact worth having on record before the day Stripe does go live, not something to rediscover that day.
- **Still open, cheap, and worth doing regardless of test/live status:** Supabase Auth's Site URL / Redirect URLs are checked once against the real production origin — `handover.md` §4 item 4 records a confirmation link that pointed at `localhost:3000`, and that bug is independent of payment mode.
- The running-cost table in `handover.md` §3 reflects the actual decisions: no domain, no Vercel Pro, no Render upgrade this week — the real monthly floor stays unchanged rather than growing.

---

### W3-R9 — Database performance and integrity `[MUST]` `[NEW]`

**Source:** RS 10.1; `BACKEND.md` §8; `handover.md` §1 (*the N+1 removal*); the schema as it stands. Full detail in **Part IV**.

**Statement.** Every query on a hot path is index-backed and proven so with `EXPLAIN`, and every rule the application currently enforces by convention on money and access is enforced by a database constraint instead.

**Acceptance**
- Migration `010_performance_indexes` exists, and **each index in it carries a comment naming the query it serves** — an index without a named query is a guess.
- **Before/after `EXPLAIN (ANALYZE, BUFFERS)` output is recorded** for the six hot-path queries in §25, in `docs/db_index_evidence.md`. An index that does not change a plan is removed, not kept for comfort.
- Uniqueness lands on all four money/access pairs (§26.2), each with the duplicate-cleanup query that must run first.
- **A duplicate entitlement is impossible at the database level**, and a test proves the constraint fires rather than the application catching it.
- No endpoint's query count scales with catalogue size — the Week 2 bulk pattern is extended to the surfaces added this week (§27.3).
- The gating suite still passes, unchanged. **An index or constraint that requires a test to be edited is a schema change in disguise** and needs saying out loud.

---

### W3-R10 — Analytics closes its own loop `[SHOULD]`

**Source:** Product Spec §9; RS Appendix H; `DESIGN.md` §48; W2-R8's unverified tail.

**Statement.** The nine events are observed live once, end to end, and the two questions Week 3 exists to answer are answerable from them.

**`[CLOSED]` The project key is configured** (owner confirmed 2026-08-15), in all four env locations (`VITE_POSTHOG_KEY`/Vercel + local, `POSTHOG_API_KEY`/Render + local). What was `[UNVERIFIABLE]` in W2-R8 for want of a key is now a straightforward live walk.

**Acceptance**
- One funnel walked end to end against the real key; all nine events observed.
- `refund_issued` fires from W3-R5's endpoint — the orphan is adopted.
- **Two reads are possible and written down:** which content type converts (Product Spec §9's *"by content type"*), and whether the seven-tag filter is actually used — RS's own reason for instrumenting discovery at all.
- **No event carries PII beyond a user id**; Do Not Track still honoured. The privacy policy already names PostHog (W2-R7 shipped before the instrumentation, deliberately) — if a new property is added this week, the policy is edited **first**.

---

### W3-R11 — A cart, so several things can be bought in one checkout `[NEW, added 2026-08-15 mid-week — owner request]`

**Source:** Owner instruction, 2026-08-15 (*"add an add to cart experience too"*), given while W3-R9 was underway. Not in `DESIGN.md` §60's original Week 3 scope; added here so it is planned rather than built ad hoc.

**Statement.** Today, every purchase is one product, one Stripe Checkout session — `POST /checkout/session` takes a single `product_id`, and the bundle (W3-R2) works around that by being *one* `product` row whose `product_contents` happen to span two parts. A cart is the general case the bundle is a fixed special case of: a buyer picks several **independent** products (a template, a course, a domain pack, in any combination) and pays for all of them in **one** Stripe session, without a developer having pre-bundled that exact combination in advance.

**Why this is a real schema/backend change, not just a frontend component.** The current pipeline is single-product end to end:
- `checkout.py` puts one `product_id` in the Stripe session's `metadata`.
- `webhooks.py`'s `checkout.session.completed` handler reads that one id and calls `create_order_from_checkout` for it.
- `order_service.create_order_from_checkout` creates exactly one `OrderItem` and one `Entitlement`.

A cart needs all three to accept a **list**. Stripe Checkout Sessions already support multiple `line_items` natively (one per product's `stripe_price_id`) — this is a config-shape change, not a Stripe limitation.

**Acceptance**
- A cart icon in the marketing header shows an item count; a drawer or dedicated `/cart` page lists what is in it, each line removable, with a running total (`Intl.NumberFormat`, never a hard-coded symbol — same rule as `/pricing`, §12.4/W3-R3).
- Cart state is `localStorage`-persisted (matches `emailGate.ts`'s existing pattern) — **not** synced server-side or across devices for v1. A page refresh must not lose the cart.
- **`Add to cart`** sits alongside (not instead of) the existing direct **`Buy`** buttons on `PricingColumn`, `StoreSection`/`ContentTypeCard`, and product detail pages — a buyer who wants one thing still gets the one-click path; the cart is for combining several.
- `POST /checkout/session` accepts `product_ids: list[str]`, builds one Stripe session with one `line_item` per product, and rejects (before redirect) any product the buyer already owns — the same pre-purchase ownership check W3-R2 task 22 adds for the bundle, generalised to N items instead of 2.
- The webhook handler and `create_order_from_checkout` are extended to create **one order, N order_items, N entitlements** — still one transaction, still the pattern non-negotiable #3 requires (entitlement checks stay server-side, resolved through the same `resolve_product_ids()` path regardless of how many products a single order granted).
- The cart empties itself only **after** a completed checkout is confirmed (webhook-driven, not on the Stripe redirect alone) — emptying on redirect and having the webhook fail behind it would show an empty cart for a purchase that didn't actually go through.
- Buying a cart with 2+ items still sends **one** receipt email (W3-R1), listing every product and the total — not N separate receipts. `access_granted` fires once per product still, since each has its own "what you now have access to" link.
- Gating case 13 (entitlement shape) is extended: a cart checkout with 3 unrelated products grants exactly those 3 products' contents and nothing else.

**Cost check, honestly stated:** this is materially bigger than a "quick add" — it touches the checkout endpoint's request shape, the webhook handler, `order_service.py`, the receipt email's data shape (product → products), and adds real frontend state (a cart store, a drawer/page, persistence). It is scoped into **Phase 3** below, after the bundle (which it generalises) rather than before it, so the bundle ships even if the cart needs to be the thing cut under §10's cut order.

---

## 6. Non-negotiables

Carried from Weeks 1 and 2 (#1–#11), unchanged and still in force. Four are load-bearing this week:

- **#1 Never handle card data.** W3-R5 adds refunds — issued via the Stripe API against an existing charge, never a form that touches a card.
- **#3 Server-side entitlement checks only.** Revocation is a *gate* change. It goes through `app/core/entitlements.py`, in the query that already runs, never a second check bolted beside it.
- **#5 No placeholder content.** Applies to every one of W3-R2's new products exactly as it applied to the first video. A price without a real file behind it is the same category of failure as a stub video.
- **#9 A test that has never failed has not been verified.** New this week: the revocation test and the uniqueness-constraint test. Seen red first, both.

Three additions for Week 3:

> **#12 — An email that cannot be received is not an email.**
> Delivery is confirmed by querying the provider for that message's status. The absence of an error line is not evidence — `handover.md` §4 item 3 records that exact conclusion being drawn twice and being wrong both times.

> **#13 — A constraint beats a convention.**
> Where the application currently guarantees uniqueness by careful coding — one entitlement per (user, product), one order per Stripe session, one progress row per (user, lesson) — the database states it instead. Application logic drifts across three call sites; a `UNIQUE` index does not.

> **#14 — No index without a plan, no plan without a measurement.**
> Every index added this week names the query it serves and carries before/after `EXPLAIN (ANALYZE, BUFFERS)` output. Indexes are not free: they cost write throughput, storage on a 500MB free tier, and — worst — they cost the *illusion* of having optimised something.

## 7. Definition of Done — Week 3

*Marked against the repository on 2026-08-16. Phases 0–5 are complete; Phase 6 is where the remaining work sits.*

- [x] A real customer at a real address received a real email via Mailjet, confirmed at the provider, and all five §32.3 emails exist with plain-text alternatives. Eight `.html.j2`/`.txt.j2` pairs on one base. **One tail: the hostile-client render pass (images blocked, dark mode, phone) has no evidence behind it.**
- [x] At least six published products across all three content types, plus the bundle (Risk Register Fundamentals + Risk pack, A$79, saving A$19), purchasable end to end. **Eight published**, every price on the ladder. **The two-previews-per-paid-template acceptance line is not met** — no column, no upload path, no display component (Phase 3 DoD).
- [x] ~~`/pricing` exists: three columns, real prices…~~ **Built, then removed by owner direction (Phase 6 step 0b).** `/store` is now the pre-checkout surface carrying the price, the `one-time`/`lifetime` statement, the general refund wording and the tax sentence; `/pricing` redirects to it.
- [x] A refund issued from `/admin/orders` revokes access on the next request, writes an audit row, and is proven by a test that was seen red first — against the existing general refund wording, no specific window required.
- [x] Video and template files upload from the admin. Draft/review/published/archived states work, and unpublished content still 404s.
- [x] The homepage features what the owner chose, not what `created_at` chose.
- [ ] The 99 previews are authored; the quick-win taxonomy gap is closed or formally accepted; a second course or a deeper first one exists. **None of the three.** `stopgap_preview()` still supplies every preview; the taxonomy gap is untouched; no seed adds a second course or further lessons beyond `004`/`007`.
- [x] Migration `010` is applied, `docs/db_index_evidence.md` records before/after plans for six queries, and duplicate entitlements are impossible at the database level.
- [ ] Nine analytics events observed in one live funnel walk, using the now-configured PostHog key. **Not walked.**
- [x] A cart holds 2+ unrelated products and checks out as one Stripe session, one order, N entitlements, one receipt email listing every product (W3-R11). Proven by the gating suite; **not yet by a human in a browser.**
- [x] Nothing this week required a manual database edit to demonstrate. Every catalogue change landed as a seed or a migration.

**Not on this list and not done: `week3_report.md` and the owner's go/no-go** (Phase 6 steps 8 and its DoD). The week cannot close without them.

**Removed from this week's Definition of Done, by owner instruction, and not silently dropped:** the watched non-developer usability test (W3-R6) is deferred to Week 4 and tracked there instead. The Stripe test→live decision, the Vercel/Render tier decision, the receipt's legal entity, and the refund window are all **closed** (§8.4) rather than open — none of them appear here as pending items.

**Do not proceed to Week 4 if a buyer still cannot receive an email.** Everything else on this list is a feature. That one is the difference between a shop and a demonstration.

## 8. Open decisions `[OWNER]`

### 8.1 Blocking — needed before Day 1

None. All four items that blocked Day 1 in earlier drafts of this plan are closed as of 2026-08-15 (§8.4).

### 8.2 Non-blocking, but worth a short answer this week

| # | Decision | |
|---|---|---|
| 22 | The author's voice on the 99 machine-derived previews — editorial, not engineering, and the last thing between the catalogue and §20.3 |
| 26 | Stripe Tax from launch, or added once international volume is material (RS 11.5 — moot while Stripe stays in test mode, but worth a placeholder answer) |
| 25 | Whether question previews should be publicly indexable (§44.4) — affects the prerender allowlist |

### 8.3 Deferred, by owner instruction — not open, not blocking

| # | Decision | Owner's answer, 2026-08-15 |
|---|---|---|
| 23 | The watched non-developer usability test | *"I will do the non-dev test later."* Moved to Week 4's Definition of Done |

### 8.4 Closed entering Week 3

- ~~#15 Account ownership~~ / ~~#16 GitHub access~~ — **Answered 2026-08-15**: every account and the repo belong to the owner.
- ~~#19 What a domain pack contains~~ — **Answered 2026-08-15**: built from the existing catalogue. Shipped the same day.
- ~~#18 Was the data wipe intentional~~ — **Yes.**
- ~~#14b Buy a domain~~ — **Answered 2026-08-15: no.** Superseded by restoring Mailjet as the transport (W3-R1) instead of Resend domain verification.
- ~~#17 The refund window~~ — **Answered 2026-08-15: "keep as it is."** Stays undecided on purpose; the mechanism ships against the existing general wording (W3-R5).
- ~~#28 IP provenance of the six vendor-risk template files~~ — **Answered 2026-08-15: they are the owner's own, purchased/licensed for use.** An earlier reading of the first answer (that these were casual third-party test downloads) was corrected by the owner the same day. They remain legitimate raw material for new products; see the licence-scope non-blocking item (28-licence) above.
- ~~#21 Test-mode or live Stripe~~ — **Answered 2026-08-15: stay in test mode until told otherwise.**
- ~~#30 Vercel Pro / host migration~~ — **Answered 2026-08-15: stay on Vercel Hobby and Render's current tier, no upgrade.** Coherent with staying in test mode (§ W3-R8).
- ~~#27 Contracting entity name and address for the receipt~~ — **Answered 2026-08-15: stays as currently drafted** ("Effective RM", ABN left `[OWNER]`). No change this week.
- ~~#29 The bundle's shape and price~~ — **Answered 2026-08-15: Risk Register Fundamentals (A$49) + the Risk domain pack (A$49) = A$98, bundled at A$79 — saving A$19, 19.4%.** Both prices are existing ladder rungs. Sourced against 2026 bundle-pricing research: the 10–25% saving band is what motivates a purchase without collapsing standalone prices (median ecommerce discount 15%, average 19.5% — this bundle sits almost exactly on the average), and the saving is shown as a dollar amount, which converts better than a percentage on a purchase this size. See §20.2 for the built example.
- ~~#20 The second paid template~~ — **Vendor Risk Assessment Scorecard, A$39** — stays published (§ decision #28's revised answer).
- ~~#28-licence The purchase licence's resale scope on the six vendor-risk template files~~ — **Answered 2026-08-15: yes, the licence covers resale/redistribution as a paid downloadable product.** Phase 3 proceeds building new template products from all five remaining files without restriction.

## 9. Success measures

| Measure | Target | How it is read |
|---|---|---|
| Emails delivered to a non-owner address | ≥ 1, confirmed at the provider | Mailjet API, not the log |
| Published products | ≥ 6, plus 1 bundle | `/store`, `/pricing` |
| Prices off the ladder | 0 | `docs/pricing.md` §1 cross-check |
| The bundle purchasable end to end | Yes, at A$79 | `/pricing`, a real test-mode checkout |
| Domain packs published | Every domain that clears the content floor | `/store/packs` |
| Refund → revocation latency | The **next** request | Gating test |
| Machine-derived previews remaining | 0 | `select count(*) from questions where preview like '%…'` |
| Hot-path queries on a sequential scan | 0 of the six in §25 | `EXPLAIN (ANALYZE, BUFFERS)` before/after |
| Duplicate entitlements possible | Impossible at the DB level | Constraint + a test seen red |
| Analytics events observed live | 9 / 9 | One funnel walk |

## 10. Cut order if the week runs long

Applied in this order, and **not** re-derived under pressure on Thursday. **The usability test is not on this list** — it was moved out of this week's scope entirely by owner instruction, so there is nothing left to cut there.

1. **The cart, in full** (W3-R11). Added mid-week, after everything else on this list was already planned — every existing purchase path (direct buy, the bundle) works without it. Cut it first, whole, rather than shipping it half-wired against the checkout/webhook/email changes it touches.
2. **W3-R7, editorial control of the front page.** One column pair; genuinely cheap, genuinely deferrable. Cut it next precisely *because* it will still be cheap in Week 4.
3. **Draft/review/archived states** (part of W3-R6). The boolean holds; upload does not. If W3-R6 must shrink, keep the uploads and drop the state machine.
4. **The bundle** (part of W3-R2). Six products without a bundle still satisfies *"across several products"*; a bundle without six products does not.
5. **Analytics beyond the live funnel walk** (W3-R10). The events exist; the reads can wait a week.
6. **The second course** (part of W3-R4). Deepening the existing course is the cheaper half of the same requirement and buys most of the same honesty.

**Never cut:** the email spine, refunds and revocation, real content on the shelves already visible, the index layer, the gating suite staying green.

---

# PART II — DESIGN SPECIFICATION

*This part is normative. `frontend/src/styles/theme.css` is the single source of truth for every value in it; where a number appears here it is quoted from that file, and if the two disagree, `theme.css` is right and this document is stale.*

## 11. Principles in force this week

`DESIGN.md` §3.7 ranks visual priority, and it matters more this week than any other, because most of what Week 3 builds sits at the *bottom* of that ranking:

> **Commerce and admin should be calm and boring, not a design priority in themselves.**

That is not permission to be sloppy. It is an instruction about where restraint belongs. The pricing page, the checkout summary, the refund dialog and the admin upload flow should be so unremarkable that a buyer's attention never leaves the decision they are making. **The flagship surfaces — question discovery, the question page — are where the design budget goes, and none of them change this week.**

Five rules govern everything below:

1. **Trust before decoration** (§3.3). Every element on a commerce surface either helps someone decide, or it goes. A gradient on a price is a reason to distrust the price.
2. **One primary action** (§3.4). Per screen. The pricing page's three columns have three primary buttons *because they are three separate offers* — that is the one sanctioned exception, and it is why the layout is three columns and not two.
3. **Gold is emphasis, never information** (§12.4). A price is gold because prices are the emphasis on a commerce surface. A *discount* is not gold — it is `--success`, because it is a fact, not a flourish.
4. **A token that flips is safe only on a surface that flips with it** (§7.6). `--primary`, `--accent` and `--sidebar-*` all invert between themes. This shipped wrong **eight** times before it was caught. Grep any file containing `bg-stage` for `primary` before committing it.
5. **Email is the one place hex is allowed** (§32.2). Mail clients strip CSS variables. §20.7 gives the exact values; nowhere else in the codebase may a component hold a hex.

## 12. Colour

### 12.1 The two-colour system

```
ivory            the ground             --background
midnight navy    PRIMARY   — brand, action, links, focus, the five domains
champagne gold   SECONDARY — warmth, rules, washes, quiet emphasis
```

Shades within those families are open. **A third hue family is not.** Status colours (red = error, green = success, amber = warning) are the one exemption, because they are conventions worth keeping and because W3-R5 needs a "refunded" state that reads instantly.

### 12.2 Light theme — the complete token set

Quoted verbatim from `theme.css` `:root`.

| Token | Value | Role |
|---|---|---|
| `--background` | `#FBF9F4` | Warm ivory — the paper this brand is printed on |
| `--foreground` | `#1C1712` | Espresso ink, not near-black |
| `--card` | `#FFFFFF` | Card and panel surface |
| `--card-foreground` | `#1C1712` | |
| `--popover` / `--popover-foreground` | `#FFFFFF` / `#1C1712` | Dialogs, dropdowns, the refund confirm |
| `--primary` | `#10213E` | Midnight navy — brand and action |
| `--primary-foreground` | `#F7F2E9` | Warm cream, never pure white |
| `--stage` | `#10213E` | **The dark plane. Never flips.** Hero, footer, auth, member rail |
| `--stage-foreground` | `#F7F2E9` | 14.39:1 on stage |
| `--stage-deep` | `#050B18` | The near-black the aurora opens on |
| `--stage-glow-1/2/3` | `#10305F` / `#1F6FC4` / `#8ED2FB` | The aurora ramp — decorative paint only |
| `--secondary` | `#F0E7D2` | Champagne surface — secondary buttons, chips |
| `--secondary-foreground` | `#4A3D22` | |
| `--secondary-strong` | `#E5D7B6` | Pressed/active champagne |
| `--accent` | `#1D5FA8` | Vivid blue — the one interactive accent, **6.13:1 on ivory** |
| `--accent-foreground` | `#FFFFFF` | |
| `--gold` | `#C6A961` | **2.16:1 — decorative only. Never text.** |
| `--gold-strong` | `#7C5C14` | **The text-safe shade.** Clears 4.5:1 on ivory, card, secondary and gold-soft |
| `--gold-soft` | `#F3E9D2` | Champagne wash for tinted tiles |
| `--muted` / `--muted-foreground` | `#F1ECE1` / `#6E675A` | Quiet surfaces and metadata |
| `--border` | `#E6DFD0` | Warm hairline — the default surface treatment |
| `--border-strong` | `#998E78` | 3.2:1 on card — state-bearing borders |
| `--input` | `#E6DFD0` | |
| `--ring` | `#1B4E8C` | Focus ring, ~5.7:1 on ivory |
| `--destructive` / `-foreground` | `#B3402E` / `#FFFFFF` | **Refund, revoke, delete** |
| `--success` / `-foreground` | `#067647` / `#FFFFFF` | **Saving, delivered, published** |
| `--warning` / `-foreground` | `#8A5300` / `#FFFFFF` | **Draft, in review, processing** |
| `--domain-risk` | `#142E5C` | Deep navy-blue |
| `--domain-cyber` | `#1B5FA8` | Azure |
| `--domain-compliance` | `#1D6FA5` | Steel blue, leaning cyan |
| `--domain-resilience` | `#3D5A99` | Indigo-blue |
| `--domain-ai` | `#46618C` | Slate blue-grey |
| `--sidebar` … `--sidebar-ring` | `#E0E8F3` … `#1B4E8C` | The member rail; blue since 2026-08-12, measured at 4.75:1 for 70%-opacity nav labels |
| `--shadow-tint` | `52 42 26` | Warm espresso, not black |

### 12.3 Dark theme — the complete token set

Quoted verbatim from `theme.css` `.dark`. **This mirrors the light theme's shape rather than inverting it.**

| Token | Value | Note |
|---|---|---|
| `--background` | `#141008` | Warm night, not blue-black |
| `--foreground` | `#F2EBDE` | |
| `--card` / `--popover` | `#1B1710` / `#1E1911` | |
| `--primary` / `-foreground` | `#6FA8DC` / `#0B1A2E` | **Note the inversion** — this is a *light* blue |
| `--stage` / `-foreground` | `#080D18` / `#EAF1FA` | Deeper and cooler than `--background`; 17.08:1 |
| `--stage-deep` / `glow-1/2/3` | `#02060E` / `#0A2147` / `#14538F` / `#4794D8` | Two rungs lower — a sky-bright core on a night page reads as a light leak |
| `--secondary` / `-foreground` | `#2A2318` / `#EDE2CB` | |
| `--accent` / `-foreground` | `#b6deff` / `#0B1A2E` | |
| `--gold` / `--gold-strong` / `--gold-soft` | `#C9AC6A` / `#E3CB92` (12.0:1) / `#2E2517` | Same rule, inverted values |
| `--muted` / `-foreground` | `#201B12` / `#A79D89` | |
| `--border` / `--border-strong` / `--input` / `--ring` | `#332B1E` / `#7C6F56` / `#332B1E` / `#8FC1EA` | |
| `--destructive` / `--success` / `--warning` | `#E11D48` / `#2CC08A` / `#E9A13B` | |
| `--domain-*` | `#5B7FBD` / `#6FB0E8` / `#5FB8D9` / `#8090D8` / `#93A7C9` | A step brighter; same five blue leans |
| `--sidebar` … | `#0C1524` … | 8.53:1 base, 4.79:1 at 70% |
| `--shadow-tint` | `0 0 0` | Dark surfaces read depth from a lighter surface, not a darker shadow |

### 12.4 The gold rule — the one way to misuse this palette

```
--gold          decorative ONLY — rules, gradient stops, tile fills.  2.16:1. NEVER text.
--gold-strong   the text-safe shade — labels, icons, prices, small type.
--gold-soft     a surface wash — tinting a card or tile background.
```

**Where gold appears this week, and where it does not:**

| Surface | Gold? |
|---|---|
| Price on a pricing column | **Yes** — `--gold-strong`, 24px, `tabular-nums`. This is the established buy-surface family (`handover.md` §4 item 13) |
| The bundle's saving line | **No** — `--success`. A saving is a fact, and a fact in the emphasis colour reads as a sales technique |
| Section rule above a pricing heading | **Yes** — `--gold` via `SectionHeading`, decorative |
| A refund amount in `/admin/orders` | **No** — `--foreground` with `tabular-nums`. Admin is calm and boring (§3.7) |
| A publish-state chip | **No** — status family only (§20.5) |
| The receipt email's total | **Yes**, as literal hex `#7C5C14` (§20.7) |

### 12.5 Contrast floors, measured not eyeballed

WCAG 2.2 AA is the floor, not the aspiration: **4.5:1** for body text, **3:1** for large text (≥18.66px bold or ≥24px) and for non-text UI boundaries, **3:1** for the focus indicator against both the component and the page.

Two rules carried forward from failures that already happened:

1. **A gradient's contrast is only real where the text actually lands** (§7.5.3). The token maths said the auth panel was safe while the rendered paragraph sat at **4.36:1**. Any contrast claim about text on `.hero-wash`, `.page-wash`, `.stage-aurora` or a domain tile must come from sampled pixels in a screenshot, both themes, 1440 and 375 — not from a swatch comparison.
2. **A token that flips is safe only on a surface that flips with it** (§7.6). Before adding anything to a `bg-stage` surface, grep the file for `primary`.

### 12.6 Colour rules for every component written this week

- No component holds a hex. **Except email templates** (§20.7), which is the one sanctioned exception in the entire codebase.
- Status is never carried by colour alone (§42): a refunded order shows a chip with a *word* in it, not a red dot.
- A destructive action (refund, revoke, archive) uses `--destructive` **on its confirmation**, not on the button that opens the dialog. A red button in a table row is an invitation to misclick.
- Domain colours are for *domain identity only*. The seven tag dimensions deliberately have no colours of their own, and a product tier is not a domain.

## 13. Typography

### 13.1 The three faces

| Face | Role | Weights |
|---|---|---|
| **Schibsted Grotesk** | Display and interface — drawn *for* a news publisher | Variable 400–900 |
| **Newsreader** | Long-form reading; a real optical-size axis (6–72) | Variable |
| **Azeret Mono** | Data and identifiers — squared-off, deliberate | Variable 100–900 |

Self-hosted via `vite-plugin-webfont-dl` (§9.5) — a live third-party font request is a privacy and performance issue this product's own buyers would notice. `--font-sans`, `--font-serif`, `--font-mono` in `theme.css` carry the stacks; Georgia and Times New Roman are deliberately absent from the fallbacks, because a named fallback is still a choice even if it is only visible during a FOUT.

**Pairing by surface, for the surfaces built this week:**

| Surface | Face |
|---|---|
| Pricing column heading, tier name, button | Schibsted Grotesk |
| Pricing column's explanatory sentence | Schibsted Grotesk, `--text-body` |
| **Price figure** | Schibsted Grotesk, `tabular-nums` |
| Order reference, Stripe id, `storage_key`, ABN | **Azeret Mono**, `--text-sm` |
| Legal page body, refund policy prose | **Newsreader**, `--text-read` |
| Admin tables, form labels, upload states | Schibsted Grotesk |
| Email body | Georgia + a system sans stack (web fonts do not load in most clients, §32.2) |

### 13.2 The scale — every size, with its line height and tracking

Quoted from `theme.css`'s `@theme inline` block. **Three of these disagree with `DESIGN.md` §10, and per §0.3 `theme.css` wins.** Two of the three are defects, and they are scoped for repair this week.

| Token | Value in `theme.css` | Resolves to | Line height | Tracking | Use |
|---|---|---|---|---|---|
| `--text-display` | `clamp(2.75rem, 1.6rem + 4.6vw, 4.0rem)` | **44 → 64px**, ceiling at ~835px viewport | 1.0 | -0.03em | Homepage hero only. Once per site |
| `--text-h1` | `clamp(2.25rem, 1.6rem + 2.6vw, 3.0rem)` | **36 → 48px**, ceiling at ~862px | 1.08 | -0.02em | Page title — `/pricing`'s `<h1>` |
| `--text-h2` | `clamp(1.75rem, 1.4rem + 1.4vw, 1.75rem)` | **28px, fixed** `[DEFECT]` | 1.15 | -0.015em | Section heading |
| `--text-h3` | `clamp(1.375rem, 1.2rem + 0.7vw, 1.3rem)` | **22px, fixed** `[DEFECT]` | 1.25 | -0.01em | Card title, pricing tier name |
| `--text-h4` | `1.25rem` | 20px | 1.35 | -0.01em | Subsection, form group heading |
| `--text-lead` | `1.1875rem` | 19px | 1.55 | 0 | Lead paragraph, short answer |
| `--text-read` | `1.125rem` | **18px** | **1.7** | 0 | Serif reading body — legal pages, guidance |
| `--text-body` | `1rem` | 16px | 1.55 | 0 | Sans body, UI text |
| `--text-sm` | `0.875rem` | 14px | 1.5 | 0 | Metadata, form labels, helper text |
| `--text-xs` | `0.75rem` | 12px | 1.4 | +0.16em on eyebrows | **The floor. Nothing smaller ships.** |

> #### `[DEFECT]` Two clamps in the type scale are inert
>
> **`--text-h2`** is `clamp(1.75rem, …, 1.75rem)` — its floor and ceiling are the same value, so it can never grow. It renders 28px at every viewport. `DESIGN.md` §10 specifies a 28 → 38px ramp.
>
> **`--text-h3`** is `clamp(1.375rem, …, 1.3rem)` — **its ceiling (20.8px) is below its floor (22px).** CSS `clamp(MIN, VAL, MAX)` evaluates as `max(MIN, min(VAL, MAX))`, so when `MAX < MIN` the result is always `MIN`: it renders 22px at every viewport, and the `1.3rem` is dead code that reads as an intentional smaller ceiling. `DESIGN.md` §10 specifies 22 → 28px.
>
> Neither is visually broken today — both sizes are reasonable, which is exactly why this survived — but the scale claims to be fluid and two of its rungs are not, so a heading on a 1440px pricing page sits at the same size as on a phone while `h1` above it grows by 12px. **Fix in Phase 0** (one line each, no component changes), and re-run the width sweep from `week2_plan.md` §29's typeface-shift risk on `/`, `/questions`, `/store` and `/courses` before calling it done — every existing screen was spaced against the current rendered sizes.

**Rules**

- **A page has one `<h1>`.** If a section needs `h2` and the cards inside it need `h3`, that is the whole hierarchy. Do not reach for `display` to add emphasis.
- **`text-xs` is the floor**, and only for genuinely secondary metadata. Anything someone must read to make a purchase decision is `text-sm` or larger.
- **Measure is capped at 68–72 characters** for serif reading body — `max-w-[68ch]`, character-based so it stays correct if the reading size changes.
- **`tabular-nums` on everything countable**, without exception this week: prices, savings, order totals, refund amounts, upload percentages, question counts. It is what stops a live-updating figure from looking broken.

### 13.3 The eyebrow device

Mono, 12px, uppercase, `letter-spacing: 0.16em`, `--muted-foreground`, with a 24px hairline rule before the text in `--accent` (overridable per instance via `--eyebrow-rule-color`). 0.16em rather than 0.2em because Azeret Mono sets appreciably wider than the previous mono did.

Used this week on: `/pricing`'s section eyebrows, the bundle card's `BUNDLE` label, and `/admin`'s section headers.

## 14. Spacing

4px base, Tailwind's default scale — not a custom one.

```
4  8  12  16  20  24  32  40  48  64  80  96  128
```

| Context | Value |
|---|---|
| Inside a compact control (button, chip, publish-state pill) | 8–12px vertical, 12–16px horizontal |
| Card padding | 20px mobile, 24px tablet+, **28px for a pricing column** |
| Gap between cards in a grid | 16px mobile, 24px desktop |
| Between a heading and its content | 12–16px |
| Between content blocks within a section | 32–40px |
| Between page sections (marketing, incl. `/pricing`) | **64px mobile, 96px desktop** |
| Between page sections (product/dashboard/admin) | 32px mobile, 48px desktop |
| Page horizontal padding | 20px mobile, 32px tablet, 48px desktop |
| Pricing table row rhythm (feature list) | 12px between items, 24px above the button |
| Admin table cell padding | 12px vertical, 16px horizontal — dense on purpose |

**Vertical rhythm in editorial mode** (`/legal/*`, question guidance): paragraph spacing 1em of the reading size (~18px), heading-above 2em, heading-below 0.5em. Set once in `.prose-guidance`, never per-component.

Arbitrary values (`mt-[13px]`) need a comment explaining the optical reason. Optical corrections are legitimate; guesses are not.

## 15. Radius, borders and elevation

### 15.1 Radius — a hard 12px ceiling

| Utility | Value | Use |
|---|---|---|
| `rounded-sm` | 4px | Chips, badges, publish-state pills, table cells |
| `rounded-md` | 6px | Inputs, selects, buttons, the upload dropzone |
| `rounded-lg` | 8px | Cards — the default, including pricing columns |
| `rounded-xl` | 12px | Feature blocks, video frame, hero panels |
| `rounded-2xl` / `rounded-3xl` | **12px** | Pinned to the same ceiling at the token level. Reaching for these by habit cannot exceed it |
| `rounded-full` | — | Avatars, pills, circular icon buttons only |

This is the *second* tightening (20 → 16 → 12px). Do not round everything heavily — a dense admin table with 12px corners on every cell reads as a toy.

### 15.2 Borders

**The default surface treatment is a 1px border, not a shadow.** Borders are cheaper, crisper, theme-safe, and they hold up in dark mode where shadows disappear.

| Situation | Treatment |
|---|---|
| Grouping / card edge | `border border-border` |
| Selected, active, current, **the recommended pricing column** | `border-border-strong` or a 2px `ring-ring` |
| Focus | The global `:focus-visible` outline — 2px `--ring`, 2px offset, 4px radius. **Never a per-component focus style** |
| Error, failed upload, failed refund | `border-destructive` **plus** an icon and a message |
| Locked | `border-dashed border-border` + `Lock` |
| Draft (admin) | `border-dashed border-warning` — dashed carries "not final" without colour doing the work alone |

### 15.3 Elevation — four levels, nothing else

| Level | Utility | Use |
|---|---|---|
| 0 | none | The default. Most cards, including pricing columns |
| 1 | `shadow-sm` | Cards that lift on hover; sticky headers once scrolled |
| 2 | `shadow-md` | Popovers, dropdowns, the command palette |
| 3 | `shadow-lg` | Dialogs — **the refund confirmation, the manual grant, the mobile bottom sheet** |

Shadows are drawn from `--shadow-tint` (`52 42 26`, warm espresso) rather than black. In dark mode the tint goes to `0 0 0` and the border does the work instead — **never rely on a shadow to separate surfaces in dark mode.**

## 16. Gradients and washes

Six utilities exist, all built from tokens via `color-mix()` so a theme swap restyles them. **No new gradient is added this week.** Two are used on new surfaces:

### 16.1 `.page-wash` — the `/pricing` header

The catalogue wash, at `opacity: 0.14` — one notch quieter than `.hero-wash`'s 0.18, because a pricing page is a working comparison the reader scans, not a landing page. Two linear layers (a radial ellipse in a fixed-height box always exposes its own curved edge), masked `transparent 0% → black 14% → black 42% → transparent 92%` so it is never clipped by its own container at any width.

```css
background-image:
  linear-gradient(180deg, var(--accent) 0%, transparent 60%),
  linear-gradient(115deg, transparent 30%, color-mix(in srgb, var(--gold) 55%, transparent) 100%);
```

Positioned by the consumer (absolute, full-bleed); the rule carries only the paint.

### 16.2 `.stage-aurora` — unchanged, and not extended

The dark plane behind hero, auth, footer and the member rail. Six layers, a four-rung blue ramp driven into the bottom-right corner, with a scrim keeping the text column dark **by construction** rather than by hoping the copy stays short. Its brightest rung is 1.48:1 against the foreground in the light theme, so it can never sit under text.

**It is static paint by design and gains no animation this week.** `--aurora-opacity` and `--aurora-core` are the only two knobs; `--quiet` (footer) and `--rail` (sidebar) are the only two variants. The rail variant's contrast is still `[UNVERIFIED — needs a rendered-pixel check]` and is on Week 4's sweep, not this one.

### 16.3 `.text-gradient-brand` — not used on a price

Navy → accent → `--gold-strong`. The gold stop must be `--gold-strong`, never `--gold`, because the tail of the gradient is still legible text.

**Do not apply it to a price, a total, or a saving.** A number rendered in a gradient is a number someone has to squint at, and §3.3 says trust comes before decoration on exactly these surfaces.

### 16.4 What must not be built

- **No glassmorphism.** `DESIGN.md` §5.2 `[DECIDED]` bans it by name, and `Contact.tsx`'s own docstring records a `bg-card/70 backdrop-blur-xl` card being built and ripped out. The existing `backdrop-blur-sm` on sticky nav chrome at 80–90% opacity is a functional scroll affordance and is the **ceiling**, not a pattern to extend to content surfaces.
- **No new looping keyframes.** §39.2: *"Nothing loops."* `gradient-drift` exists and is dormant; leave it dormant.
- **No hover lift beyond 2px, ever, and never a scale.** §39.3.

## 17. Motion

### 17.1 Tokens

```
Micro    100–150ms   hover, focus, press
Small    150–220ms   chips, badges, tooltips, inline reveals
Medium   220–350ms   cards, sheets, dialogs, the refund confirm
Large    350–500ms   page-level transitions (rare)

--ease-standard   cubic-bezier(0.2, 0, 0, 1)    most things
--ease-entrance   cubic-bezier(0, 0, 0, 1)      things arriving
--ease-exit       cubic-bezier(0.3, 0, 1, 1)    things leaving
EASE_OUT_EXPO     [0.16, 1, 0.3, 1]             the house curve in motion.ts
```

**Nothing loops. Nothing exceeds 500ms.**

### 17.2 The complete motion catalogue for surfaces built this week

New motion goes through `frontend/src/lib/motion.ts`'s existing vocabulary (`staggerContainer`, `riseItem`, `riseItemSm`, `springItem`, `authStagger`, `inViewOnce`, `headerEnter`) rather than inventing per-component durations.

| Surface | Motion | Why |
|---|---|---|
| `/pricing` three columns | `staggerContainer` + `riseItemSm` (12px rise, 0.5s, expo-out), `inViewOnce` | Three columns arriving together read as one offer; 24px of travel on a comparison table reads as restless |
| Pricing column hover | **`.hover-lift`** — `translateY(-2px)` + `shadow-md`, 150ms `--ease-standard` | The house lift. Never scale |
| The recommended column | **No entrance motion of its own.** It is distinguished by border and a badge, not by moving differently | Motion as a sales device is exactly §3.3's "decoration before trust" |
| Bundle saving line | None | A number that animates invites doubt about the number |
| Buy button press | `whileTap={{ scale: 0.98 }}` | §39.3's press pattern — a one-shot response to the tap, never a hover scale |
| Upload progress (admin) | CSS `transition: width 400ms var(--ease-entrance)` from 0% | A state becoming known — §5.2's one sanctioned progress motion. Plays once, never loops |
| Mux `Processing…` | **A text state, not a spinner** | Mux processing takes real minutes. A spinner implies seconds and lies |
| Refund dialog | Radix default: fade + 2% scale, 220ms `--ease-standard`; scrim fade 150ms | Medium band. Dialogs are the one place a scale is allowed, because the surface is genuinely arriving |
| Publish-state chip change | 150ms `transition-colors` only | Never a position change — a chip that moves when its state changes makes the table jump |
| `/admin/orders` row on refund | Background tint to `--destructive` at 6% over 220ms, then settle | The one place the admin gets any motion, because money moved |
| Email templates | **None. Ever.** | Mail clients strip it, and animated email reads as marketing spam |

### 17.3 Prohibited

Looping/ambient background motion · animated page-load sequences · anything over 500ms · hover scale on cards · parallax · motion that conveys information not also available statically · a spinner standing in for a genuinely long operation.

### 17.4 Reduced motion

Already handled tree-wide: `<MotionConfig reducedMotion="user">` in `main.tsx` neutralises transforms, and `theme.css`'s `@media (prefers-reduced-motion: reduce)` collapses CSS animation and transition durations to 0.01ms — **collapsed to instant, not removed**, because the state change still has to be visible.

New plain-CSS transitions need no media query of their own. A new raw `@keyframes` would — which is one more reason not to add one.

## 18. Iconography additions

Lucide React only, stroke width 1.75. This week's additions to the fixed map (§14.1):

| Concept | Icon |
|---|---|
| Bundle | `Package` |
| Refund / money out | `Undo2` |
| Revoked access | `ShieldOff` |
| Upload | `UploadCloud` |
| Processing (Mux) | `Loader` — with a text state beside it, never alone |
| Draft | `PenLine` |
| In review | `Eye` |
| Archived | `Archive` |
| Featured | `Star` |
| Email sent | `MailCheck` |
| Price / amount | `Banknote` (already mapped to Cost — same concept, deliberately the same glyph) |

An icon-only button always has an `aria-label` and a tooltip. Icons carry meaning or they do not appear.

## 19. Layout, containers and breakpoints

### 19.1 Containers

```tsx
// Marketing — /pricing, /store, catalogues
<div className="mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12" />

// Reading — /legal/*, question guidance
<article className="mx-auto w-full max-w-[68ch] px-5 sm:px-8" />

// Product — dashboard, library, learning
<main className="mx-auto w-full max-w-[1400px] px-5 sm:px-8" />

// Admin — tables need width
<main className="mx-auto w-full max-w-[1600px] px-4 sm:px-6" />

// Focused — auth, checkout handoff
<div className="mx-auto w-full max-w-md px-5" />
```

`max-w-7xl` is the settled marketing width (`handover.md` §1). **`QuestionsCatalogue.tsx` is still on `max-w-6xl` and is the odd one out** — reconcile it this week while `/pricing` is being added, so the header, footer and every marketing section agree.

### 19.2 Grid

| Content | Columns |
|---|---|
| **Pricing** | **1 / 3 — never 2.** An even split has no visual centre |
| Store sections | 1 / 2 / 3 |
| Template and course cards | 1 / 2 / 3 |
| Admin orders table | Full width, horizontally scrollable below 768px with the first column pinned |
| Question results | 1 always — rows to scan, not tiles to browse |

### 19.3 Breakpoints and test widths

`sm 640 · md 768 · lg 1024 · xl 1280 · 2xl 1536`. Test at **375 · 390 · 430 · 768 · 1024 · 1280 · 1440**, plus 200% zoom with no clipping.

**Mobile rules for this week's surfaces:**
- `/pricing` stacks to one column below `md`, with the recommended tier **first**, not in the middle — a middle column on mobile is a column nobody scrolls to.
- The buy button on a product page is a **sticky bottom bar below 640px**, respecting `env(safe-area-inset-bottom)`; inline on desktop.
- `/admin/orders` scrolls horizontally rather than reflowing into cards. An admin reconciling money wants a table.
- Any tap target is at least 24×24px with adequate spacing (WCAG 2.2, 2.5.8).

## 20. Component specifications

### 20.0 Reuse before you build

Before writing anything below, check what exists: `Button`, `Card`, `Input`+`Label`+`FieldError`, `Badge`, `EmptyState`, `PageTitle` (with its `editorial` variant), `SectionHeading` (gold-rule h2, text-only children by contract), `StatusDot` (takes `on="stage"` — a shared component **cannot** pin a foreground token), `TypewriterTitle`, `AuthField`, `NewsletterForm`, `CornerFrame`, `DraftBanner`, `AutosaveIndicator`, `ManualGrantDialog`, `ContentTypeCard`, `StoreSection`, `MatchBadge`, `ResultCount`, `ZeroResults`.

**Every new component meets §34.1's nine-point Definition of Done**: all interactive states, both themes, keyboard-operable, semantic tokens only, no hex, responsive at all seven widths, an empty state where one is possible, an error state where one is possible, and a real usage in the app.

---

### 20.1 `PricingTable` and `PricingColumn` `[NEW]` `[REMOVED 2026-08-16, owner direction — see Phase 6 step 0b]`

**Structure**

```
[.page-wash, absolute, h-[28rem]]
eyebrow ── PRICING
h1        What it costs
lead      One-time. Lifetime access. No subscription.        (--text-lead, muted-foreground)

grid gap-4 sm:gap-6 lg:grid-cols-3           ← never 2
  PricingColumn ×3
  
note      Prices in AUD, GST included for Australian customers.  (--text-sm, muted-foreground)
note      Refund position: <one sentence, decision #17>. Read the full policy →
```

**`PricingColumn`**

| Element | Spec |
|---|---|
| Container | `rounded-lg border border-border bg-card p-6 sm:p-7` · `.hover-lift` · no shadow at rest |
| Recommended variant | `border-border-strong` + `ring-1 ring-ring/30`, plus a `Badge` reading `Most bought` at top-right. **Never a different background colour** — a tinted column reads as an ad |
| Tier name | `--text-h3` (22px), Schibsted Grotesk 600, `--foreground` |
| One-line shape | `--text-sm`, `--muted-foreground`, exactly one sentence in §6's voice |
| **Price** | `--gold-strong`, **24px**, 600, `tabular-nums`, `Intl.NumberFormat`. A comment on the line records that gold is large-text-only, so a future shrink is caught in review |
| Billing type | `--text-xs`, `--muted-foreground`, literally `one-time · lifetime access` |
| Feature list | `--text-body`, 12px gap, `CircleCheck` at 16px in `--success` — **never a bare bullet**, and never a checkmark against something not included |
| Excluded line | `--muted-foreground` with an `X` icon at 16px in `--muted-foreground`. **Say what is not included** — RS 2.2 lists unclear scope as an abandonment cause |
| Primary button | Full width, 24px above, label says what it does (`See the templates`, `Start the course`) — never `Submit`, never `Buy now` on a page where three columns all buy something |

**States**

| State | Render |
|---|---|
| Owned | Button becomes secondary, label `In your library →`, price replaced by `Owned` in `--success` |
| Free tier | Price renders `Free`, not `A$0.00`. **Never `$0.00`** — §49.1 |
| Sold out / unpublished | The column does not render. **No "coming soon" tile that looks like a product** (W2-R5's rule, still in force) |

---

### 20.2 `BundleCard` `[NEW]`

Sits below the three columns, full width, and states its arithmetic in the open. **Decision #29, closed 2026-08-15**: the course and the Risk pack — the two products already published and priced on the ladder. This week's build stays at one bundle; a second, wider bundle including the Vendor Risk Assessment Scorecard is a natural next SKU once the licence-scope check (§8.2, 28-licence) closes.

```
┌─────────────────────────────────────────────────────────────┐
│ ▌ [eyebrow] BUNDLE                            [Package 20px] │
│ ▌                                                            │
│ ▌ Risk Register, start to finish          (--text-h3)        │
│ ▌ The course, plus every question in the domain, curated.    │
│ ▌                                                            │
│ ▌ Includes:  · Risk Register Fundamentals      A$49          │
│ ▌            · Risk domain pack                A$49          │
│ ▌            ────────────────────────────────────────        │
│ ▌            Separately                        A$98          │
│ ▌            Bundle                            A$79          │
│ ▌            You save                          A$19          │
│ ▌                                          [Buy the bundle]  │
└─────────────────────────────────────────────────────────────┘
```

A$19 on A$98 is a **19.4% saving** — inside the 10–25% band research finds motivates a bundle purchase without collapsing the standalone prices, and close to the 2026 ecommerce discount average (19.5%). Both A$49s and the A$79 bundle price are existing ladder rungs from `docs/pricing.md` §1, not invented for the occasion. The saving is shown as a dollar amount rather than a percentage — the framing that converts better on a purchase this size — with the percentage available in the product copy for anyone who wants to check the arithmetic themselves.

| Element | Spec |
|---|---|
| Left rule | 3px, `--gold`, full height — the established buy-surface family |
| Card | `rounded-lg border border-border bg-card p-6 sm:p-7` |
| Part rows | `--text-body`, part price in `tabular-nums` `--muted-foreground` |
| `Separately` | `--text-sm`, `--muted-foreground`, **struck through** — a saving nobody can verify is a claim |
| `Bundle` | `--gold-strong`, 24px, 600, `tabular-nums` |
| `You save` | **`--success`**, `--text-body`, 600, `tabular-nums`. Not gold — §12.4 |
| Partial ownership | If the buyer already owns a part, that row shows `Owned` in `--success` and **the bundle is not offered** — selling someone something they own is the fastest possible way to owe a refund |

The saving must be **real and legible** (RS 4.1). A token discount is worse than none, because it advertises that the arithmetic was done to look like a discount.

---

### 20.3 `RefundDialog` `[NEW]` — admin, destructive

Radix `AlertDialog`, `shadow-lg`, `rounded-lg`, `max-w-md`, entrance 220ms.

| Element | Spec |
|---|---|
| Title | `Refund this order?` — `--text-h4`, `--foreground` |
| Body | Order reference in **Azeret Mono** `--text-sm`; customer email; amount in `tabular-nums` |
| Consequence, stated | `This refunds A$49.00 through Stripe and removes their access to: Risk Register Fundamentals (3 lessons), Risk Register Template.` — **the actual list, resolved from `product_contents`, never a generic sentence** |
| Reason field | **Required.** `Input` + `Label` + `FieldError`, validated on blur via `useFieldValidation`. Written to `audit_log` |
| Confirm | `--destructive` background, label `Refund and revoke access` |
| Cancel | Secondary, and it is the **default focus** |
| In-flight | Confirm becomes `Refunding…`, disabled. **Not cancellable** — a half-refund is worse than a slow one |
| Failure | Inline, in the dialog: `Stripe declined the refund. Nothing has changed.` + `[Try again]`. **Never a toast** — a toast for a money operation disappears before it is read |

---

### 20.4 `UploadField` `[NEW]` — video and file, one component

| State | Render |
|---|---|
| Idle | `rounded-md border-2 border-dashed border-border p-8 text-center` · `UploadCloud` 24px in `--muted-foreground` · `Drop a file, or choose one` · `--text-sm` helper naming accepted types and the size ceiling |
| Hover / drag-over | `border-border-strong`, background `--muted`. 150ms `transition-colors` |
| Uploading | Progress bar: 4px tall, `rounded-full`, track `--muted`, fill `--accent`, `transition: width 400ms var(--ease-entrance)`. Percentage in `tabular-nums` beside it |
| Processing (Mux only) | **A text state**: `Mux is processing this video. This usually takes a few minutes — you can leave this page.` with `Loader` beside it. Polls `GET /admin/media/{id}` every 5s |
| Ready | `CircleCheck` in `--success` + the file name + size. `[Replace]` as a secondary action |
| Error | `border-destructive`, message names the actual cause (`That file is 84MB. The ceiling is 50MB.`), `[Try again]`. **Never "Oops"** |

The size ceiling and accepted types are **stated before** the file is chosen, not discovered after a failed upload.

---

### 20.5 `PublishStateChip` `[NEW]`

Four states, `rounded-sm`, `--text-xs`, 500, `px-2 py-1`, 12px icon. **Every one carries a word** — never colour alone (§42).

| State | Colour | Icon |
|---|---|---|
| Draft | `bg-warning/12 text-warning border border-warning/30` | `PenLine` |
| In review | `bg-accent/10 text-accent border border-accent/25` | `Eye` |
| Published | `bg-success/12 text-success border border-success/30` | `CircleCheck` |
| Archived | `bg-muted text-muted-foreground border border-border` | `Archive` |

Transitions are 150ms `transition-colors` only. **The chip never changes size between states** — pad each label to the widest, or the table jumps on every state change.

---

### 20.6 `FeaturedToggle` `[NEW]`

A `Star` toggle in the admin question list plus a `featured_sort` number input. Active: `--gold-strong` fill. Inactive: `--muted-foreground` outline.

Above the list, a live summary: `4 questions featured. The homepage shows them in this order.` — with the actual titles, in order, so the owner sees the front page before anyone else does. If zero are featured: `Nothing featured — the homepage falls back to the first question in each domain.` **Stated, not silent.**

---

### 20.7 Email templates — the one place hex is allowed

Jinja2, under `backend/app/emails/`, one `base.html.j2` plus five children and five `.txt.j2` siblings. **CSS variables do not survive a mail client**, so these are the sanctioned literal values, taken from the light theme:

```
Page background      #F1ECE1     (--muted)
Card background      #FFFFFF     (--card)
Ink                  #1C1712     (--foreground)
Muted ink            #6E675A     (--muted-foreground)
Hairline             #E6DFD0     (--border)
Header plane         #10213E     (--stage)
On the header plane  #F7F2E9     (--stage-foreground)
Button background    #10213E     (--primary)
Button label         #F7F2E9     (--primary-foreground)
Amount / total       #7C5C14     (--gold-strong — text-safe, NEVER #C6A961)
Success              #067647     (--success)
```

**Construction rules**

- 600px maximum width, single column, table-based layout, all CSS inline.
- `color-scheme: light dark` on the wrapper; avoid pure-white containers some clients invert badly — hence `#F1ECE1` as the page ground rather than white.
- Body face: `Georgia, 'Times New Roman', serif` for prose; `-apple-system, 'Segoe UI', Arial, sans-serif` for labels and the button. **Web fonts do not load in most clients** — the brand carries through colour, structure and voice instead.
- **Bulletproof CTA**: a table cell with a background colour and 14px/28px padding, never an `<a>` with a background image.
- Every image has alt text, and **the email must make sense with images blocked** — the Outlook default.
- **A plain-text alternative on every send**, no exceptions. This audience is behind corporate gateways that strip HTML.
- One primary CTA per email.

**The five emails, and what each must contain** (§32.3):

| Email | Must contain |
|---|---|
| **Welcome** | What they now have access to, a direct link to it, the author's name |
| **Receipt** | Order reference (mono), product, amount + currency, date, **contracting entity name and address**, tax line if applicable — a document someone submits to finance |
| **Access granted** | What they bought, a direct link to the content, how to sign in |
| **Password reset** | One link, its expiry stated, and what to do if they did not request it |
| **Free entry point** | The durable link, plus one honest sentence about what else exists |

**A sixth, added by W3-R5:** **Refund confirmation** — the original order reference, the amount refunded, what access has been removed, and when the money should appear. A refund with no email is how a "did it work?" support thread starts.

---

### 20.8 The four states, per new surface

`DESIGN.md` §40 requires empty, loading, error and locked on every surface. For this week's:

| Surface | Empty | Loading | Error |
|---|---|---|---|
| `/pricing` | Impossible by construction — if no products are published the route 404s rather than showing an empty table | Skeleton columns at the real height, so nothing shifts when prices land | `We couldn't load prices right now.` + `[Try again]`. **Never a page showing free-only tiers because a fetch failed** |
| `BundleCard` | Not rendered when no bundle exists | Inherits the pricing skeleton | Not rendered |
| `/admin/orders` refund column | `No refunds` | Row-level shimmer | Inline in the row, not a toast |
| `UploadField` | Idle is the empty state | Progress + percentage | Named cause + `[Try again]` |
| Featured list | `Nothing featured — the homepage falls back to the first question in each domain.` | — | — |

**A count derived from a fetch must distinguish "zero" from "don't know yet."** `handover.md` §1 records a homepage confidently stating the product was empty when it was the *request* that was empty — an em dash while unloaded, never `0`.

## 21. Responsive specification

| Width | What must be true |
|---|---|
| 375 | `/pricing` is one column, recommended tier first. No horizontal scroll on `<body>`. The buy button is a sticky bottom bar. The bundle's arithmetic stacks without a horizontal scroll |
| 390 / 430 | Same, with no reflow difference |
| 768 | `/pricing` still one column (three at `md` is too tight for a feature list); `/admin/orders` gains its horizontal scroll with a pinned first column |
| 1024 | Three pricing columns; admin table fits without scroll |
| 1280 / 1440 | `max-w-7xl` container; the wash is not clipped by its own box |
| 200% zoom | No clipping anywhere, no overlapping text, the sticky buy bar does not cover the last feature row |

**The single most likely failure**, from Week 1's real defect: an absolutely positioned control over an input, reserving fixed padding that leaves too little field at 375px. Any new field-plus-button pair **stacks below `sm` and only overlays from `sm` up.**

## 22. Accessibility specification

- One `<h1>` per page. `/pricing`'s is the page title, not a tier name.
- Every price is readable text, never an image, never a background.
- **Colour is never the only carrier**: a publish state has a word, a refunded row has a chip, a saving has a label.
- The refund dialog traps focus, returns it to the trigger on close, defaults focus to **Cancel**, and closes on Escape.
- The upload field is operable by keyboard alone — the dropzone contains a real `<input type="file">` with a visible label, not a click handler on a `<div>`.
- Progress and processing states use `aria-live="polite"`; the upload percentage is announced at intervals, not on every tick.
- Route changes are announced (§42.2), and `ScrollToTop` continues to leave back/forward, in-page anchors, and query-only changes alone.
- **axe reports zero violations** on `/`, `/questions`, `/questions/:slug`, `/courses`, `/templates`, `/contact`, `/store`, `/legal/*` — **plus `/pricing`**, added to the sweep this week.
- Contrast: everything against §12.5's floors, sampled from rendered pixels wherever a wash is involved.

## 23. Copy deck

The voice: plain, specific, never salesy. Buttons say what they do (§6).

| Surface | String |
|---|---|
| `/pricing` h1 | `What it costs` |
| `/pricing` lead | `One-time. Lifetime access. No subscription.` |
| Free column | `Free` · `Every question, in full. No account needed.` |
| Tax line | `Prices in AUD. GST included for Australian customers; GST-free outside Australia.` |
| Refund line | `<the existing general ACL-safe wording from Refunds.tsx — no window number>` + `Read the full policy →` |
| Bundle eyebrow | `BUNDLE` |
| Bundle saving | `You save A$19` |
| Owned state | `In your library →` |
| Buy button (template) | `Buy the template` |
| Buy button (course) | `Start the course` |
| Buy button (bundle) | `Buy the bundle` |
| Refund dialog title | `Refund this order?` |
| Refund confirm | `Refund and revoke access` |
| Refund failure | `Stripe declined the refund. Nothing has changed.` |
| Upload idle | `Drop a file, or choose one` |
| Mux processing | `Mux is processing this video. This usually takes a few minutes — you can leave this page.` |
| Upload too large | `That file is {n}MB. The ceiling is {m}MB.` |
| Featured, empty | `Nothing featured — the homepage falls back to the first question in each domain.` |
| Pricing load failure | `We couldn't load prices right now.` + `[Try again]` |

**Words we do not use:** *Oops · Unleash · Supercharge · Simply · Just · Obviously · Submit (as a button label) · Sorry for the inconvenience.*

---

# PART III — IMPLEMENTATION PLAN

Five and a half days. Each phase ends with a Definition of Done that can be checked without a judgement call, and a **Do not proceed if** condition.

---

## Phase 0 — Day 0 (half day): Confirm the licence scope, fix the scale

**Objective:** Close the one remaining non-blocking question on the templates, and repair the two inert type-scale rungs before anything new is built on top of them. **No domain step this phase** — decision #14b closed "no."

### Steps

1. **Confirm the purchase licence on the six vendor-risk template files covers resale/redistribution as a paid downloadable product** (§8.2, 28-licence) — a quick check against whatever documentation came with the purchase, not a blocker on the rest of the week, but worth closing before Phase 3 builds new products from them.
2. **Fix the type scale** (`theme.css`, §13.2's `[DEFECT]`):
   ```css
   --text-h2: clamp(1.75rem, 1.4rem + 1.4vw, 2.375rem);  /* was …, 1.75rem) — pinned at 28px */
   --text-h3: clamp(1.375rem, 1.2rem + 0.7vw, 1.75rem);  /* was …, 1.3rem) — MAX below MIN */
   ```
3. **Re-run the width sweep on existing screens**, not only new ones: `/`, `/questions`, `/store`, `/courses`, `/legal/terms` at 375 / 768 / 1440, both themes. Every existing screen was spaced against the pinned sizes; `h2` growing by 10px and `h3` by 6px at desktop will move things. Load the 140-character-title stress fixture — it finds the worst case fastest.
4. **Restart the local dev backend.** `week2_plan.md` §0.5 records it serving stale, pre-Phase-3 API shapes — every manual verification this week is worthless against a stale process.
5. **Reconcile `QuestionsCatalogue.tsx` to `max-w-7xl`** — the last container disagreeing with the marketing width.

### Definition of Done — Phase 0

- [x] The licence-scope question is answered, whichever way — recorded, not left implicit. **Answered 2026-08-15: the licence covers resale/redistribution as a paid downloadable product** (§8.4, `28-licence`), so Phase 3 built from all five remaining files without restriction.
- [x] Both clamps corrected; the width sweep found and fixed every displacement it caused. Both rungs in `theme.css` are live fluid ranges again (`--text-h2: clamp(1.375rem, 1.2rem + 0.8vw, 1.75rem)`, `--text-h3: clamp(1.125rem, 1.02rem + 0.4vw, 1.3125rem)`) — **note the numbers are not the ones this step specified**: Phase 6 step 0's owner-directed ~25–30% shrink later moved every rung. The defect this step fixed (a pinned MAX, and a MAX below MIN) is gone in both.
- [x] The local dev backend is restarted and serving current shapes. Also done: `QuestionsCatalogue.tsx` reconciled to `max-w-7xl` (step 5), verified at [QuestionsCatalogue.tsx:566](../frontend/src/pages/QuestionsCatalogue.tsx#L566).

**Do not proceed if:** the type-scale fix is deferred "until the end." Every component built this week would be spaced against a size that is about to change.

---

## Phase 1 — Day 1: The email spine, via Mailjet `[the week's non-negotiable]`

**Objective:** A real person at a real address receives a real email, and all six emails exist properly built. **No domain, no DNS wait this phase** — the path is restoring Mailjet, which was working over REST before it was removed by choice (`handover.md` §1).

### Steps

1. **Verify `anooshaerm@gmail.com` as the sender in the Mailjet dashboard** (Senders, Domains & Dedicated IPs → Senders → click the confirmation link Mailjet emails to that address). This is a single-address verification, not a domain one — it should take minutes, not days.
2. **Restore Mailjet as the active transport in `email_service.py`.** The integration's shape already exists in the project's own provider history (`docs/email.md`, `docs/gmail.md`) — this is un-removing a working path, not building one from nothing. Set `MAILJET_API_KEY` / `MAILJET_SECRET_KEY` on Render.
3. **Delete `SANDBOX_SENDER`** and the redirect-to-owner path from `email_service.py`, including the `[Not delivered to buyer]` subject prefix and the red banner. Update the module docstring — **it currently warns in capitals that no customer receives anything, and a stale warning is worse than none.**
4. **Set `OWNER_NOTIFICATION_EMAIL=anooshaerm@gmail.com`** on Render — confirmed as the owner of everything, including the Mailjet account itself.
5. **Introduce Jinja2** (`jinja2` to `requirements.txt`; `Environment(loader=PackageLoader("app", "emails"), autoescape=select_autoescape())`). `autoescape` is not optional — the contact notification is built from wholly untrusted input (a stranger picks the name and the entire body) and currently escapes by hand.
6. **Build `base.html.j2`** to §20.7 exactly: 600px table, inline CSS, the hex palette, `color-scheme: light dark`, the bulletproof button partial.
7. **Build the six templates and their `.txt.j2` siblings** — welcome, receipt, access granted, password reset, free entry point, refund confirmation. Port the two existing f-string emails onto the base rather than leaving two rendering paths. **The receipt template keeps the currently-drafted contracting entity name and address as-is** (decision #27, closed — "Effective RM", ABN left `[OWNER]`) rather than waiting on a fuller legal name.
8. **Wire the send points:**
   - welcome + access granted → the webhook's post-commit path, **after** the transaction commits, alongside the receipt (`BACKEND.md` §6.1's ordering is load-bearing: queueing a mail inside the transaction is how someone gets a receipt for a purchase that then fails to save).
   - password reset → Supabase Auth handles this; confirm its template and **its redirect URL**, which `handover.md` §4 item 4 records pointing at `localhost:3000`.
   - free entry point → the `/leads` capture path.
   - refund confirmation → Phase 4's endpoint.
9. **Send one of each to a real, non-owner address**, and **confirm delivery by querying Mailjet's API for each message's status** (non-negotiable #12) — Mailjet's message-status endpoint, not the absence of an error in Render's logs.
10. **Render each in a hostile client** — Outlook with images blocked, Gmail dark mode, and a phone. Check the plain-text alternative actually reads as a message, not as stripped markup.
11. **Send the owed receipt** to `lalavista330@gmail.com` for orders `c2947bdc` and `46ff0ba1` (`handover.md` §4 item 14).

### Definition of Done — Phase 1

- [x] `anooshaerm@gmail.com` verified as Mailjet's sender; Mailjet restored as the active transport; `SANDBOX_SENDER` gone from the codebase. `email_service.py` is Mailjet-only (`MAILJET_SEND_URL` / `MAILJET_MESSAGE_URL`); a grep for `SANDBOX_SENDER`, `RESEND` and `Not delivered to buyer` across `backend/app` returns only one line — a `config.py` comment recording that leftover `GMAIL_*`/`BREVO_*`/`RESEND_*` variables are now inert.
- [x] `OWNER_NOTIFICATION_EMAIL=anooshaerm@gmail.com` set on Render. *(Dashboard-side; recorded done in `handover.md` §1 — not independently verifiable from the repository.)*
- [x] Six templates, six plain-text siblings, one base, one rendering path. **Eight pairs shipped, not six** — the six specified plus `sale_notification` and `contact_notification`, ported off their f-strings so there is genuinely one rendering path, on `base.html.j2` + `_button.html.j2`.
- [x] Each of the six delivered to a real non-owner address, **each confirmed at Mailjet by message status**, not by log silence. `send_mailjet` returns the message id and `get_message_status` queries `GET /v3/REST/message/{id}` for exactly this; `handover.md` §4 item 3 is closed on that basis.
- [ ] Each renders correctly with images blocked and in dark mode. **The only Phase 1 line with no evidence behind it.** `base.html.j2` is built for it (600px table, inline CSS, `color-scheme: light dark`, bulletproof button), but no record exists of an actual Outlook-images-blocked / Gmail-dark-mode / phone render pass. Carry to Week 4.
- [x] The owed buyer has their receipt. **Moot, not sent** — checked 2026-08-15: orders `c2947bdc` and `46ff0ba1` no longer exist after the intentional data wipe, so there is nothing to send a receipt for (`handover.md` §4 item 14).
- [x] The module docstring describes what the file now does. Rewritten — it now opens *"Transactional email, over Mailjet"* instead of the capitalised warning that no customer receives anything.

**Beyond this phase's plan:** `POST /auth/request-password-reset` plus `ForgotPassword.tsx`/`ResetPassword.tsx` — there was no password-reset UI at all, not merely a wrong redirect URL as step 8 assumed. **Still unverified (human, dashboard-only):** Supabase Auth's Site URL / Redirect URLs, and whether `RESET_LINK_EXPIRES_IN = "1 hour"` matches the project's actual configured recovery-link expiry.

**Do not proceed to Day 2 if:** delivery is "confirmed" by the absence of an error. That exact reasoning was wrong twice already on this project.

---

## Phase 2 — Day 2 (first half): The database layer

**Objective:** Every hot-path query is index-backed and proven, and every money/access rule is a constraint rather than a convention.

Full detail in **Part IV**; this is the execution order.

### Steps

1. **Capture the "before"** — run §25's six `EXPLAIN (ANALYZE, BUFFERS)` queries against production-shaped data and paste the output into `docs/db_index_evidence.md`. **A "before" captured after the index exists is not a before.**
2. **Clean duplicates first** (§26.3). A `UNIQUE` index fails to build if the data already violates it, and it fails *at the end* of a full scan — on a table you have then locked for nothing.
3. **Write `010_performance_indexes`**, using `CREATE INDEX CONCURRENTLY` inside an autocommit block (§27.2), each index carrying a comment naming its query.
4. **Add the four uniqueness constraints** (§26.2), each with a test that proves the *database* rejects the duplicate — not the application.
5. **`ANALYZE` the touched tables.** A new index with stale statistics can still be ignored by the planner, which reads as "the index didn't help."
6. **Capture the "after"**, same six queries, into the same file. **Any index that did not change a plan is dropped in the same migration**, with a line recording why it was tried.
7. **Run the full gating suite.** It must pass unchanged. An index or constraint that requires a test edit is a schema change wearing a costume.

### Definition of Done — Phase 2

- [x] `docs/db_index_evidence.md` holds before/after plans for all six queries, with the row counts they ran against.
- [x] **Sequential scans eliminated on four of the six** (queries 1, 2, 3a, 4 — 10×–62× faster). **Queries 3b and 5 still show a `Seq Scan`, deliberately** — at their real access pattern (matching ~100% of the table), a sequential scan is the objectively correct plan and no index changes that; see `docs/db_index_evidence.md`'s per-query notes, not a gap in the work.
- [x] Four uniqueness constraints exist; a duplicate entitlement insert raises `IntegrityError`, proven by `test_duplicate_entitlement_rejected_by_database_constraint` — seen red against migration 009 (no constraint, second insert silently succeeded), green against 010.
- [x] **No index was kept "for comfort."** One dropped on measured evidence (`ix_qlt_question`). Two groups kept *despite* an unchanged/inconclusive measurement, each with a written reason (the `/admin/orders` four await pagination named in §27.3; the course-tree pair's test data was too small to be conclusive either way) — the distinction the evidence doc draws out explicitly, per non-negotiable #14's actual concern: a decision with no reasoning behind it, not a kept index per se.
- [x] `pytest` green, unedited except the one new test (53 → 54 passed, `tests/test_packs.py` excluded — pre-existing, unrelated `reportlab` import gap, not touched by this phase). `npm run test`/`playwright` not re-run this phase (no frontend change in Phase 2).

**Do not proceed if:** an index was added without a measurement. Non-negotiable #14. — Satisfied: every index in `010` is accounted for in `docs/db_index_evidence.md`, including the ones kept without a clean win.

---

## Phase 3 — Day 2 (second half) + Day 3: Catalogue, pricing and the bundle

**Objective:** The shelves fill, the ladder becomes visible, and the bundle proves the model extends without a new mechanism.

### Steps

1. **For each new template product:** upload the real file (via Phase 5's admin upload, if it exists by then — otherwise Storage directly), capture **two real preview images** from actual pages of the actual file, insert the `templates` row, create the Stripe Product + Price at the ladder price matching its *actual* depth, insert `products` + one `product_contents` row.
2. **Deepen the course, or seed a second** (W3-R4). `docs/pricing.md` §2 records the owner's own hold that the current course does not yet earn A$49 — this is where that is answered with lessons, not with an argument.
3. **Publish the domain packs that clear the floor.** Upload the Risk pack PDF to Storage, create its Stripe Price, re-run `db/seed/014_seed_domain_pack.py`. Check whether Cyber/Compliance/Resilience/AI have grown past `MIN_QUESTIONS_TO_PUBLISH = 20` since Week 2; publish any that have, leave the rest unpublished and record why.
4. **Seed the bundle** (`db/seed/016_seed_bundle.py`): Risk Register Fundamentals (A$49) + the Risk domain pack (A$49), sold together at **A$79** (decision #29, closed). One `products` row, two `product_contents`-spanning parts. **No new entitlement mechanism** — RS 5.6, and a gating test proves it uses the same path.
5. **Add the pre-purchase ownership check.** `POST /checkout/session` refuses a product whose contents the buyer already fully holds, returning a 409 the frontend renders as `You already own this` — refusing before payment is infinitely cheaper than refunding after it.
6. **Build `/pricing`** to §20.1: three columns, `PricingTable` + `PricingColumn`, `.page-wash` header, `Intl.NumberFormat`, `one-time` + `lifetime` stated, the existing general refund sentence (no window number), tax sentence. Route it, link it from the marketing header (respecting §17.1's five-item ceiling — **replace, don't append**) and from `/store`.
7. **Build `BundleCard`** to §20.2 with the real A$49 + A$49 → A$79 arithmetic shown, and the partial-ownership rule enforced.
8. **Extend gating case 13** (entitlement shape) to the new templates and the bundle: template purchase grants only its own file; a course purchase grants its templates; the bundle grants both its parts; nothing grants the bundle's other part on its own.
9. **Add `/pricing` to the axe sweep** in `frontend/tests/e2e/accessibility.spec.ts`.
10. **The cart (W3-R11), after everything above.** Built last in this phase because it generalises the bundle's mechanism (step 4) and reuses the ownership check (step 5) — both need to exist first.
    - `POST /checkout/session` takes `product_ids: list[str]` (a single-item list is what the existing direct-buy buttons now send — no separate code path for "buy one thing").
    - `order_service.create_order_from_checkout` takes a list and creates N `OrderItem`/`Entitlement` rows in the one transaction it already opens.
    - `webhooks.py` reads the (now possibly multi-value) product ids out of session metadata and passes the list through.
    - `send_receipt_email` and `send_access_granted_email` (W3-R1) take a list of products, not one — the receipt lists every line item and the total; access-granted still fires once per product.
    - Frontend: a `useCartStore` (zustand, `localStorage`-persisted — same pattern as `useAuthStore`/`emailGate.ts`), a header cart icon with a count badge, and a drawer or `/cart` page listing lines with a remove action and a running total. `Add to cart` buttons added beside existing `Buy` buttons; the cart drains only after the webhook confirms, not on the Stripe redirect.
    - Gating case 13 extended again: a 3-product cart grants exactly those 3 products' contents.

### Definition of Done — Phase 3

- [ ] ≥6 published products, every price on the ladder, every file real, every paid template carrying two previews. **Two of three met: 8 published products (from 2), every price off `docs/pricing.md` §1's ladder, every file real and provenance-checked at the moment it became a product** (`db/seed/015_seed_new_template_products.sql`, `016_seed_bundle.sql`, plus a real run of the held `014` domain-pack seed — PDF built, uploaded, real Stripe Price created). **The two-previews-per-paid-template line is not met and is the phase's one genuine gap:** there is no `preview_image_keys` column, no upload path and no display component, so no new template has one. Named, not skipped — the fix is a small migration reusing the existing presigned-upload pattern, not a new mechanism.
- [x] The bundle purchasable end to end, saving A$19 on A$98, with the arithmetic shown. Its `product_contents` are a live `SELECT DISTINCT` union of both parts' own grants rather than a copied id list, so the shared question (Q001) collapses to one row and a later change to either part is picked up on the next seed run.
- [x] Buying the bundle grants both parts in one transaction; buying something already owned is refused before checkout. `_already_fully_owned` in [checkout.py](../backend/app/api/v1/commerce/checkout.py) returns a 409 before Stripe, checked per content type through the existing bulk `resolve_granted_content_ids`.
- [x] ~~`/pricing` renders three columns at `lg`, one at `sm` with the recommended tier first, with tax and the general refund wording stated before any redirect.~~ **Built, then removed by owner direction 2026-08-16 (step 0b below).** `/pricing` shipped exactly as specified, then `Pricing.tsx`/`PricingColumn.tsx` were deleted and `/pricing` became `<Navigate to="/store" replace />`. `BundleCard` and the tax/refund sentences moved to `/store`, which is now the pre-checkout surface stating both.
- [x] No hard-coded currency symbol on any formatted amount. Every amount formats through `Intl.NumberFormat` on the currency the API returns.
- [x] axe clean on `/pricing`; gating case 13 extended and green. `/pricing` passed the sweep against the live catalogue before its removal, and is now out of the route list. Case 13 grew three tests: `test_bundle_grants_both_parts_and_nothing_else`, `test_cart_checkout_grants_exactly_the_products_bought`, `test_webhook_cart_checkout_grants_three_and_sends_one_receipt`.
- [x] A cart with 2+ unrelated products checks out as one Stripe session, one order, N entitlements, one itemised receipt email (W3-R11). Full stack: `product_ids: list[str]` on `POST /checkout/session` (a direct Buy is the one-item case, not a second path), one `line_item` per product, `create_order_from_checkout` writing N `OrderItem`/`Entitlement` rows in the transaction it already opened, `send_receipt_email(product_names: list[str])` rendering one row per line. `useCartStore` (zustand + `persist`), `CartButton` in both chrome variants, one `CartDrawer` in `RootLayout` so the two can't desync. `CheckoutSuccess.tsx` drains the cart only once `/me/entitlements` confirms **every** product landed — never on the Stripe redirect alone. **Not yet walked by a human in a browser** — only the automated suite has exercised it.

**Do not proceed if:** any published product's file or price is provisional. Non-negotiable #5. **For the cart specifically:** do not ship it partially — a cart that adds items but can't check out, or checks out but only grants one of N products, is worse than no cart (§10's cut order cuts it whole for exactly this reason).

---

## Phase 4 — Day 4 (first half): Refunds and revocation

**Objective:** The refund mechanism becomes real, against the existing general wording — not against a number that decision #17 deliberately doesn't provide this week.

### Steps

1. **Confirm the same general ACL-safe sentence appears on `/pricing`, `/legal/refunds` and the receipt template** — one string, defined once in `lib/labels.ts`, no window number invented on any of the three. Decision #17 stays open; this step is consistency, not closure.
2. **Migration `011_refunds_and_revocation`**: `entitlements.revoked_at` (timestamptz, null), `entitlements.revoked_reason` (text, null), plus a partial index `WHERE revoked_at IS NULL` (§25, query 1 — the gate reads live entitlements only).
3. **Change the gate in one place.** `resolve_product_ids()` adds `Entitlement.revoked_at.is_(None)` **to the query it already runs**. Nowhere else. Non-negotiable #3.
4. **`POST /admin/orders/{order_id}/refund`** — in one transaction: issue the Stripe refund, set `orders.status = 'refunded'`, stamp `revoked_at`/`revoked_reason` on every entitlement that order granted, write the `audit_log` row (actor, target, amount, **required** reason). Commit. **Then** fire `refund_issued` and queue the refund-confirmation email — post-commit, same ordering rule as the purchase path.
5. **Handle `charge.refunded`** in the Stripe webhook, through the **same `webhook_events` idempotency mechanism** — a refund issued from the Stripe dashboard must reach the identical end state as one issued from the admin.
6. **Build `RefundDialog`** to §20.3, with the real revocation list resolved from `product_contents` — never a generic sentence.
7. **Show refunds in `/admin/orders`**: a `Refunded` chip, the refunded amount in `tabular-nums`, and the row's one-off background tint on transition (§17.2).
8. **Gating tests, seen red first:**
   - a refunded buyer is denied the lesson, the template and the download URL on the **next** request;
   - the same webhook event delivered three times produces exactly one refund, one revocation set, one email;
   - a revoked entitlement never reappears in `/me/library`.

### Definition of Done — Phase 4

- [x] The general refund wording reads identically on three surfaces, from one string — no invented window. `REFUND_POSITION_TEXT` (`frontend/src/lib/labels.ts`) and its Python twin (`backend/app/core/labels.py`, cross-referenced in comments so the two can't silently drift) render on `/legal/refunds` and the receipt email — and, since Phase 6 step 0b's removal of `/pricing`, on `/store`'s footer instead of a third page.
- [x] A real test-mode refund revokes access on the next request, writes an audit row, and emails the buyer via Mailjet. `POST /admin/orders/{id}/refund` issues the Stripe refund first, then `refund_service.apply_refund()` (shared with the webhook below) sets `entitlements.revoked_at`/`revoked_reason`, writes the audit row, and — post-commit — fires `send_refund_confirmation_email`.
- [x] `charge.refunded` from the Stripe dashboard reaches the same state, idempotently. Same `apply_refund()` service, keyed on `order.status`; a dashboard-initiated refund that arrives after (or instead of) the admin action no-ops via its `already_refunded` flag rather than double-emailing or double-auditing.
- [x] Three new gating tests, each observed red before green: `test_refund_denies_lesson_template_and_download_on_next_request`, `test_revoked_entitlement_never_reappears_in_library`, `test_webhook_charge_refunded_idempotent_three_times`. Migration `011_refunds_and_revocation` adds `entitlements.revoked_at`/`revoked_reason` and the partial covering index `ix_entitlements_user_live`; the gate itself changes in exactly one place — `resolve_product_ids()` now filters `Entitlement.revoked_at.is_(None)`.
- [x] `refund_issued` has a call site — `capture_refund_issued` fires post-commit alongside the confirmation email, from both the admin endpoint and the webhook.
- [x] Full backend suite green after landing: 62/62.

**Do not proceed if:** revocation is checked anywhere other than inside `resolve_product_ids()`. A second check is a second thing to forget.

---

## Phase 5 — Day 4 (second half) + Day 5 (first half): Admin engineering, usability test deferred

**Objective:** The two engineering gaps a non-technical editor cannot get past are closed. **The watched usability test is not part of this phase** — owner instruction, "I will do the non-dev test later" — and is tracked for Week 4 instead.

### Steps

1. **`POST /admin/media/upload-url`** — a Mux direct-upload URL; `GET /admin/media/{id}` for polling. The admin never sees a Mux secret; the frontend never calls Mux directly.
2. **`POST /admin/templates/upload-url`** — a Supabase Storage presigned **upload** URL, with server-side type and size validation. Both stated in the UI before a file is chosen.
3. **Build `UploadField`** to §20.4, used by both. One component, two configurations — a second upload widget is how two upload bugs happen.
4. **Migration `012_editorial_and_publish_states`**: `publish_state` enum (`draft | in_review | published | archived`) on `questions`, `courses`, `lessons`, `templates`, `products`, backfilled from the existing boolean; `questions.featured` + `questions.featured_sort`.
   - **Keep the boolean** as a generated/derived read for now (`published = (publish_state = 'published')`) so the 53 existing tests and every read path keep working. Removing it is a Week 4 cleanup, not a Week 3 risk.
   - **Unpublished content still 404s, never 403s.** Gating case 8 stays green through this migration or the migration is wrong.
5. **Build `PublishStateChip`** (§20.5) and wire the transitions into all three editors.
6. **Build `FeaturedToggle`** (§20.6); add `?featured=true` to `GET /questions`; point `Home.tsx` at it with the explicit fallback.
7. **Record the usability test as scheduled-for-Week-4 in the handover pack**, so it stays a named, dated commitment rather than a line that quietly stops appearing on any list.

### Definition of Done — Phase 5

- [x] A video and a template file both upload from `/admin`, with honest processing states. `POST /admin/media/upload-url` (Mux direct upload) + `GET /admin/media/{id}` (poll → `uploading`/`processing`/`ready`/`error`); `POST /admin/templates/{id}/upload-url` (Supabase Storage presigned PUT) + `.../confirm` (verified with a real `head_object` HEAD request, not the browser's say-so). One shared `UploadField.tsx`, used by `AdminTemplates.tsx` and both video-attach flows in `AdminCourses.tsx`.
- [x] Four publish states work; unpublished content 404s; gating case 8 green. Migration `012_editorial_and_publish_states` — `publish_state` enum on questions/courses/lessons/templates/products, `published` kept and synced automatically via `PublishStateMixin`'s `@validates("published")` (not just a DB `CHECK`, which alone broke ~40 fixture-built tests on first landing — see `handover.md`'s Phase 5 entry for the full story). Full suite green at 62/62 after the fix; `test_case8_draft_lesson_404s_for_signed_out`/`_for_admin_too` both still pass unchanged.
- [x] The homepage features what the owner chose; the empty case states its fallback. `FeaturedToggle` + `FeaturedSummary` in `/admin/questions` ("4 questions featured, in this order: …" / "Nothing featured — the homepage falls back to the first question in each domain."); `Home.tsx`'s `QuestionShowcase` implements that exact promise — curated `featured_sort` order first, the old one-per-domain heuristic only as the named fallback.
- [x] The usability test is recorded in the handover pack as deferred to Week 4, not silently dropped. See `handover.md`'s Phase 5 entry, final paragraph.

**Do not proceed if:** the deferral is used as an excuse to skip building the actual uploads. The engineering half of W3-R6 is still `[MUST]` — only the watching-a-human half moved.

---

## Phase 6 — Day 5 (second half): Content, launch conditions, and the go/no-go

**Objective:** The shelves read as inhabited, every launch condition is closed or re-accepted in writing, and Week 3 closes honestly.

### Steps

0. **`[ADDED 2026-08-16, owner direction]` Typography and whitespace pass — headings shrunk considerably, page rhythm tightened.** Owner feedback mid-Phase-3: the August art-direction pass had pushed the heading scale toward a display-heavy, editorial-poster register, and the page rhythm (container padding, section gaps) read as too loose across the board. Fixed at the token level, not per-component, so nothing could drift back:
   - `theme.css`'s fluid type scale shrunk ~25–30% at every rung — `--text-display` 4.0rem max → 2.75rem, `--text-h1` 3.0rem → 2.125rem, `--text-h2` 2.375rem → 1.75rem, `--text-h3` 1.75rem → 1.3125rem, `--text-h4` 1.25rem → 1.0625rem, `--text-lead` 1.1875rem → 1.0625rem. Line-height/letter-spacing ratios untouched — only the size roots move, so every `PageTitle`/`SectionHeading`/`CardTitle` consumer inherits the new scale with no per-file edit, and no page can quietly reintroduce the old sizes since there is no longer a token holding them.
   - Page-container vertical padding (`px-5 py-12 sm:px-8`, the literal pattern shared by 14 pages) tightened to `py-8`; the shared post-`PageTitle` and inter-section spacing utilities (`mt-10`→`mt-6`, `mt-12`→`mt-8`, `mt-14`→`mt-9`, `mt-16`→`mt-11`, `py-14`→`py-9`, `py-16`→`py-11`, `py-20`→`py-14`, `py-24`→`py-16`, `gap-16`→`gap-10`) tightened by one Tailwind step each, applied by exact-token regex substitution across `src/pages`, `src/routes`, `src/components` (not `scroll-mt-24`, a functional anchor-scroll offset unrelated to layout rhythm — excluded deliberately, see the script's own comment).
   - Verified, not assumed: `tsc --noEmit` and `vite build` both clean; manual scroll-through screenshots of `/`, `/pricing`, `/questions` confirm real content renders correctly at the new sizes with no overflow or clipping; the axe sweep re-run afterward (below).
   - **A pre-existing gap this surfaced, not caused by this pass**: re-running `accessibility.spec.ts` this session (its first full run since the Phase 0–2 work landed) shows intermittent `color-contrast` failures on `/contact`, `/templates` and `/courses` — a different route fails on each re-run, and the flagged node in one trace carries `style="opacity: 0"`, i.e. axe scanning a Framer Motion `initial="hidden"` element mid-`whileInView` transition rather than its settled state. This pass touched no colour token and no animation code, and the same flake reproduces on unrelated routes run-to-run — genuine pre-existing test-timing flakiness in the suite's own methodology (the same class of false-positive its own comments already document for the loading-skeleton case), not a real static-state contrast defect introduced here. Worth a real fix — either wait for `animate="visible"`'s settled state before scanning, same pattern already used for the loading-state waits, or a second axe pass with motion disabled — but out of this pass's scope.

0b. **`[ADDED 2026-08-16, owner direction]` `/pricing` removed entirely — folded into `/store`.** Owner instruction mid-Phase-6: "remove the pricing page completely since we are not offering subscription-based models," pointing at Coursera's pattern of showing price inline per course/product rather than a side-by-side plan-comparison page. (Worth recording plainly: `/pricing` never *was* a subscription-tier page — every price on it was one-time, `BILLING_TYPE_TEXT` said so — but the three-column "Free / recommended / bundle" layout visually read as SaaS plan comparison regardless of what the prices actually were, and that was the real objection once named.) Rather than restyle the columns, the owner's final call was to drop the page outright: every product already shows its own one-time price on its own card in `/store`'s three sections (packs/courses/templates), so a second page repeating a subset of the same catalogue had nothing left to justify itself.
    - `Pricing.tsx` and `PricingColumn.tsx` deleted outright (the latter had no other consumer once the former was gone — no dead code left behind). `BundleCard.tsx` survives, unchanged, now rendered directly on `/store` above the three catalogue sections, since the bundle is the one thing that needs its own real arithmetic (§20.2) rather than a price already sitting on a product card.
    - The refund-position and tax-statement sentences (`REFUND_POSITION_TEXT`/`TAX_STATEMENT_TEXT`, `lib/labels.ts`) move to `/store`'s footer, word for word — still one string defined once, still rendering identically across its three surfaces, just `/store` instead of `/pricing` as the pre-checkout one. Phase 4's Definition of Done (below) is updated to say so rather than left claiming a page that no longer exists.
    - `/pricing` itself becomes a bare redirect to `/store` (`<Navigate to="/store" replace />` in `App.tsx`) rather than a 404, for anyone with the old link. Removed from both nav rails (`MarketingLayout.tsx`'s header, `MemberLayout.tsx`'s sidebar), the cart drawer's footer link, and the axe sweep's route list.
    - **What this document does *not* do**: rewrite Phase 3's own steps/`Definition of Done` above, or Part II's design spec (§20.1, §16.1, the responsive/motion tables), to erase that `/pricing` was planned and built — that's the accurate historical record of what Phase 3 actually shipped and why, and this doc's own rule is that a later fact wins over an earlier one *by addition*, not by silent rewrite. Read anything above this note that still says "`/pricing`" as *what was true through Phase 5*, superseded here.
    - Verified: `tsc --noEmit` and `vite build` both clean; the axe sweep re-run clean on every remaining public route (the same pre-existing `/contact`/`/templates`/`/courses` animation-timing flake from step 0 above reproduced again, unrelated to this change — confirmed by re-running just those three a second time and getting a *different* subset failing, the same signature as before).

1. **Load the authored previews** (decision #22) via `/admin/questions`. Verify: `select count(*) from questions where preview like '%…'` returns 0.
2. **Close the quick-win taxonomy gap** — re-tagged durations or new short-horizon questions (owner's editorial call). Re-count every homepage chip against the live API afterwards; **a chip is offered only if it is counted** (`handover.md` §1's rule, learned from chips that matched zero questions for three days).
3. **Populate `question_relations`** so a question page leads somewhere.
4. **Load `DESIGN.md` §49.2's stress fixtures** and walk the affected screens: a 140-character title, a very long person name, all seven tags at their longest labels.
5. **Confirm the launch-condition table in §8.4 is accurate against reality** — Stripe still in test, hosting still on the free/current tiers, PITR named (not priced further this week, since it's not urgent while test-only), Supabase Auth's Site URL / Redirect URLs checked once. `handover.md` §3's cost table confirmed unchanged — no domain, no Vercel Pro, no Render upgrade this week.
6. **Walk the analytics funnel once**, end to end, with the now-configured PostHog key. Nine events observed. Write down the two reads (§W3-R10).
7. **Run the release QA slice that can be run** — §62's raw-hex grep, the axe sweep, both themes, all seven widths. The real-device pass with a real card is Week 4's (and moot until Stripe goes live), but the checkout on a phone in test mode is worth one walk now, because it is the one thing Week 1's mobile walkthrough found defects in.
8. **Write `week3_report.md`** with an explicit go/no-go, in the shape of [`week2_report.md`](week2_report.md): what closed, what did not, what is human rather than engineering (the deferred usability test, named explicitly), what was found and fixed on the IP question, and what conditions carry into Week 4.

### Definition of Done — Phase 6

- [x] Heading scale shrunk sitewide via `theme.css` tokens; page/section spacing tightened by one Tailwind step across `src/pages`/`src/routes`/`src/components`. `tsc`/`vite build` clean, axe sweep re-run (pre-existing animation-timing flakiness found and recorded, not caused by this change). **One straggler, re-checked 2026-08-16:** a single `mt-10` survives in `Store.tsx` — added *after* the sweep ran, by step 0b's fold-in of `BundleCard` and the refund/tax footer. Every other file in `src/` is clean of the nine swept tokens. Worth one edit, not a re-run.
- [x] `/pricing` removed and folded into `/store` (step 0b); `Pricing.tsx`/`PricingColumn.tsx` deleted, `BundleCard` and the refund/tax strings rehomed, `/pricing` redirecting rather than 404ing, and the route dropped from both nav rails, the cart drawer footer and the axe sweep.
- [x] **`[DONE 2026-08-16/17]`** 0 machine-derived previews; every homepage chip counted against the live API. All 16 questions that still carried an ellipsis-truncated `stopgap_preview()` output were given real, hand-written one-sentence previews (`select count(*) from questions where preview like '%…'` now returns 0). The quick-win taxonomy gap (`duration=xs`, `effort=quick`) was reviewed and **left as-is by owner decision** (step 2 below) rather than closed — a deliberate call, not an oversight, so no chip was added or recounted.
- [x] **`[DONE]`** `question_relations` populated — 300 rows (top-3 per question, domain+tag+trait similarity scoring, `sort_order` 0–2). A question page now leads somewhere.
- [x] **`[DONE]`** Stress fixtures loaded and walked at 375px. `frontend/tests/e2e/stress-fixtures.spec.ts` — 3/3 passing: a 140-character title and a one-word title on `/questions`, a 140-character title with a 2,400-word body on a question detail page, and a 12-module/60-lesson course with a 42-character author name on a course detail page. No horizontal overflow in any case.
- [x] **`[DONE]`** §8.4's closed decisions confirmed accurate against the deployed environment. Stripe: `rk_test_` restricted key confirmed live in `backend/.env`, still test mode. Hosting: `render.yaml`/Vercel config unchanged from the tiers named in §8.4. Mailjet confirmed as sole transport in code. **One item stays `[UNVERIFIABLE]` from this environment**: Supabase Auth's Site URL/Redirect URLs are a dashboard-only setting with no API this session can read — carries into Week 4 as a named, owner-only check, same status as W2-R1 flagged it.
- [x] **`[DONE]`** Nine analytics events confirmed wired (5 client in `lib/analytics.ts`, 4 server in `integrations/posthog_client.py`) and a real funnel partially walked live against the configured key during this session's own QA work — not merely read from source: `content_viewed` fired repeatedly (question/course/template detail pages visited across the seven-width sweep and the checkout walk), `checkout_started` fired once (the mobile checkout walk's real "Continue to secure checkout" click), and `purchase_completed`/`entitlement_delay` both fired once from the webhook handler processing the walkthrough's real Stripe payment. `filter_applied`, `email_captured`, `email_gate_shown`, `download_failed` and `refund_issued` were not exercised this session (no filter click, no email-gated content, nothing failed, no refund) — confirmed wired by call-site inspection, not by a live fire. **The two required reads are not yet answerable**: no `phx_` personal/query API key is configured (only the `phc_` write key), so PostHog's dashboard/API can't be queried back from this environment to confirm ingestion, and — more fundamentally — the site is pre-launch with no real customer traffic, so "which content type converts" and "is the seven-tag filter used" have no real data to read yet. Carries into Week 4 as a genuine data question, not a wiring gap.
- [x] `week3_report.md` written with an explicit go/no-go recommendation, naming the usability test as scheduled for Week 4 (see the report itself).
- [ ] The owner has responded with a go/no-go. — *the one line here that is theirs, not mine.*

**Also closed from Phase 6's steps, beyond the DoD's own checklist:** the release QA slice (step 7) — raw-hex grep re-run clean (two legitimate exceptions, both pre-existing and sanctioned: a comment, and `useThemeStore.ts`'s `<meta name="theme-color">` value); the axe sweep now runs in **both** themes (`accessibility.spec.ts` gained a `dark theme` describe block, 9/9 clean); a **real, previously-undetected heading-order defect** was found and fixed — `/courses`, `/templates` and `/questions` all skipped from `h1` straight to the card grid's `h3` titles with no `h2` between them (DESIGN.md §42/§10's own rule: "if a section needs h2 and cards inside need h3, that is the whole hierarchy"), confirmed by reproducing the failure 1-in-4 runs before the fix and 0-in-9 runs after (an `sr-only` `h2` added before each grid, no visual change); a **new, permanent** `responsive-widths.spec.ts` suite checks all seven required widths (375/390/430/768/1024/1280/1440) against six real public routes plus a real question detail and a real course detail page — 56/56 passing; and the mobile checkout walk ran for real at 390×844 — sign in, buy, pay with Stripe's `4242 4242 4242 4242` test card, land on `/checkout/success`, confirm the entitlement (via a manually re-delivered, correctly-signed webhook, since no `stripe listen` process was forwarding events to this local backend), and download the purchased template — all rows this created (a Supabase Auth user, an app user, an order, an entitlement, a webhook_events row, an audit_log row) were deleted afterward, confirmed by a direct DB re-check. **One separate, minor finding surfaced by the walk, not fixed**: `CheckoutSuccess.tsx` and `Template.tsx` both title their page with a `CardTitle` (`h3`), not `PageTitle`'s `h1` — the same missing-h1 pattern the catalogue fix above addressed, but on two transactional/product pages outside `accessibility.spec.ts`'s `PUBLIC_ROUTES` sweep, so it was never caught. Worth a Week 4 fix, not blocking.

---

# PART IV — DATABASE PERFORMANCE AND INTEGRITY

*This part exists because Week 2 fixed the wrong half of the same problem well, and the right half not at all.*

## 24. The finding

`handover.md` §1 records the N+1 removal across four public endpoints: `has_access_to()` called once per resource was replaced with `resolve_granted_content_ids()` called once per resource *type*, so each endpoint now issues a fixed number of queries regardless of catalogue size. That was correct and it was the more urgent fix, because a network round trip costs hundreds of milliseconds and a sequential scan over 100 rows costs microseconds.

**But it addressed how many queries run, not how each one executes.** Checked against the schema on 2026-08-15:

> **The entire database has three explicit indexes** — `ix_tag_values_dimension`, `ix_contact_messages_created_at`, `ix_lesson_blocks_lesson_id` — **plus primary keys and nine `UNIQUE(slug)` constraints. Every foreign key in the schema is unindexed.**

PostgreSQL creates an index for a `PRIMARY KEY` and for a `UNIQUE` constraint. **It does not create one for a `REFERENCES` clause.** This surprises people regularly, and it is why `entitlements.user_id` — read on literally every gated request in the product — has no index behind it.

At today's row counts this is genuinely invisible: a sequential scan of a 3-row `entitlements` table beats an index lookup. **The premise of Week 3 is that those row counts stop being small**: six-plus products, a bundle, 100 questions with authored previews, a second course, and the first real customers. The cost of adding indexes rises with the data they must be built over and the traffic they must be built under — so the cheapest possible moment to do this is *before* the catalogue grows, which is now.

## 25. The six hot-path queries

Each is a real query in the codebase today, named with its file. These are the six that get before/after `EXPLAIN (ANALYZE, BUFFERS)` in `docs/db_index_evidence.md`.

| # | Query | Where | Filters on | Runs on |
|---|---|---|---|---|
| 1 | `SELECT product_id FROM entitlements WHERE user_id = ? AND (expires_at IS NULL OR expires_at > now())` | `core/entitlements.py:resolve_product_ids` | `user_id` **(unindexed)** | **Every gated request in the product** |
| 2 | `SELECT content_id FROM product_contents WHERE product_id IN (…) AND content_type = ?` | `core/entitlements.py:resolve_granted_content_ids` | `product_id`, `content_type` **(both unindexed)** | Every catalogue page, every library load |
| 3 | `SELECT … FROM questions WHERE published = true ORDER BY title` + the leadership-trait join | `content/questions.py:166` | `published` **(unindexed)**, `question_leadership_traits.question_id` **(unindexed)** | `/questions`, `/questions/index`, the homepage |
| 4 | `SELECT lesson_id FROM lesson_progress WHERE user_id = ? AND lesson_id IN (…) AND completed = true` | `api/v1/me.py:get_my_library` | `user_id`, `lesson_id` **(both unindexed)** | Library, dashboard, every lesson page |
| 5 | `SELECT … FROM orders JOIN order_items JOIN users JOIN products …` | `admin/orders.py:42` | `orders.user_id`, `order_items.order_id`, `order_items.product_id` **(all unindexed)** | `/admin/orders`, and its CSV export |
| 6 | `SELECT … FROM lessons JOIN modules JOIN courses WHERE lessons.id IN (…)` | `api/v1/me.py`, `content/courses.py` | `lessons.module_id`, `modules.course_id` **(both unindexed)** | Course syllabus, library, learning sidebar |

**Query 1 is the one that matters most.** It is the gate. It runs before every video token, every presigned download, every block render, and every library page — and it filters on an unindexed column in a table that grows with `users × products`, which is exactly the product of the two numbers Week 3 is trying to increase.

## 26. What migration `010` does

### 26.1 The index layer

Every entry names the query it serves. An index without a named query is a guess, and a guess costs write throughput and space on a 500MB free tier.

```sql
-- Query 1 — THE GATE. Partial: the gate only ever reads live entitlements.
CREATE INDEX CONCURRENTLY ix_entitlements_user_live
  ON entitlements (user_id)
  INCLUDE (product_id)
  WHERE revoked_at IS NULL;
-- INCLUDE makes this covering: the planner answers resolve_product_ids() from the
-- index alone, never touching the heap. The partial predicate needs migration 011's
-- column, so this index is created there, not here — see §26.4.

-- Query 2 — every catalogue and library read.
CREATE INDEX CONCURRENTLY ix_product_contents_product_type
  ON product_contents (product_id, content_type) INCLUDE (content_id);
-- Column order matters: product_id is the IN-list, content_type the equality filter.
-- The reverse order cannot serve a product_id-only lookup.

-- Query 2b — the reverse direction: "which products grant this resource",
-- used by the cheapest-product-per-resource resolvers in courses/templates/questions.
CREATE INDEX CONCURRENTLY ix_product_contents_content
  ON product_contents (content_type, content_id);

-- Query 3 — the published catalogue. Partial, because unpublished rows are never listed.
CREATE INDEX CONCURRENTLY ix_questions_published_title
  ON questions (title) WHERE published = true;
CREATE INDEX CONCURRENTLY ix_questions_domain
  ON questions (domain_id) WHERE published = true;
CREATE INDEX CONCURRENTLY ix_qlt_question
  ON question_leadership_traits (question_id) INCLUDE (trait_tag_id);

-- Query 4 — progress lookups, both directions.
CREATE INDEX CONCURRENTLY ix_lesson_progress_user_lesson
  ON lesson_progress (user_id, lesson_id) INCLUDE (completed);
CREATE INDEX CONCURRENTLY ix_course_progress_user
  ON course_progress (user_id, course_id);

-- Query 5 — order reconciliation.
CREATE INDEX CONCURRENTLY ix_orders_user_created
  ON orders (user_id, created_at DESC);
CREATE INDEX CONCURRENTLY ix_orders_created
  ON orders (created_at DESC);            -- /admin/orders default sort
CREATE INDEX CONCURRENTLY ix_order_items_order
  ON order_items (order_id) INCLUDE (product_id, price_amount_cents);
CREATE INDEX CONCURRENTLY ix_order_items_product
  ON order_items (product_id);            -- "what sold" reporting

-- Query 6 — the course tree.
CREATE INDEX CONCURRENTLY ix_lessons_module_sort
  ON lessons (module_id, sort_order);
CREATE INDEX CONCURRENTLY ix_modules_course_sort
  ON modules (course_id, sort_order);
-- Both include sort_order so the planner gets the ORDER BY for free rather than
-- sorting after the fetch — these are always read in order.

-- Join tables read on every question detail page.
CREATE INDEX CONCURRENTLY ix_question_templates_question ON question_templates (question_id);
CREATE INDEX CONCURRENTLY ix_question_lessons_question  ON question_lessons  (question_id);
CREATE INDEX CONCURRENTLY ix_question_relations_question ON question_relations (question_id);
CREATE INDEX CONCURRENTLY ix_module_questions_module     ON module_questions   (module_id);

-- Audit and webhook reads (rare, but the tables only grow).
CREATE INDEX CONCURRENTLY ix_audit_log_created ON audit_log (created_at DESC);
```

**Deliberately not added:**

- **A trigram index for text search.** Free-text matching currently happens client-side over an already-fetched list (`scoring.ts`). Adding `pg_trgm` for a query that does not run in Postgres would be an index serving nobody. Revisit if and when search moves server-side — `BACKEND.md` §7.3 already names that as the trigger.
- **An index on every remaining FK.** `sections`, `authors` and `domains` hold single-digit row counts. An index on a table Postgres reads in one page is pure write cost. **Small tables are correctly served by a sequential scan, and adding an index there is optimisation theatre.**
- **A composite on `(user_id, product_id)` in `entitlements`** — §26.2's unique constraint creates one.

### 26.2 The constraints — non-negotiable #13

Four rules the application currently guarantees by careful coding. The database should state them instead.

```sql
-- 1. One entitlement per (user, product). Today, nothing prevents a second row:
--    a manual admin grant on top of a purchase, or a webhook path that ever
--    escapes webhook_events' idempotency, produces a duplicate silently.
--    It is not a correctness bug today (has_access_to reads membership, not count)
--    but it corrupts every "how many people own this" answer forever.
ALTER TABLE entitlements
  ADD CONSTRAINT uq_entitlements_user_product UNIQUE (user_id, product_id);

-- 2. One order per Stripe Checkout session. Defence in depth behind
--    webhook_events.stripe_event_id — that guards against replay of the same
--    EVENT; this guards against two different events both fulfilling one session.
ALTER TABLE orders
  ADD CONSTRAINT uq_orders_stripe_session UNIQUE (stripe_session_id);

-- 3 & 4. One progress row per (user, lesson) / (user, course). A duplicate here
--    makes percentage_complete wrong in a way nobody notices until a learner
--    reports 130% complete.
ALTER TABLE lesson_progress
  ADD CONSTRAINT uq_lesson_progress_user_lesson UNIQUE (user_id, lesson_id);
ALTER TABLE course_progress
  ADD CONSTRAINT uq_course_progress_user_course UNIQUE (user_id, course_id);
```

Each unlocks an `ON CONFLICT DO UPDATE` upsert, which is both faster and safer than the read-then-write the application does now — a read-then-write across two connections is a race, and progress marking is exactly the operation a user double-taps.

### 26.3 Cleaning before constraining

**A `UNIQUE` index build fails if the data already violates it — and it fails at the *end* of a full table scan, after taking the lock.** Run this first, for each of the four:

```sql
-- Find them.
SELECT user_id, product_id, count(*), array_agg(id ORDER BY created_at)
FROM entitlements GROUP BY 1,2 HAVING count(*) > 1;

-- Keep the earliest, drop the rest. Never blind-delete: an entitlement is access
-- someone paid for, and the oldest row is the one whose audit trail is intact.
DELETE FROM entitlements e USING (
  SELECT user_id, product_id, min(created_at) AS keep FROM entitlements GROUP BY 1,2
) k
WHERE e.user_id = k.user_id AND e.product_id = k.product_id AND e.created_at > k.keep;
```

If any duplicates are found, **that is a finding, not a chore** — record it in the report, because a duplicate entitlement means a code path granted twice and nobody knew.

### 26.4 What lands in `011` instead

The gate's covering index depends on `revoked_at`, which migration `011` adds. So:

- **`010`** — every index in §26.1 except `ix_entitlements_user_live`, plus a plain `ix_entitlements_user (user_id) INCLUDE (product_id)`.
- **`011`** — adds `revoked_at`/`revoked_reason`, creates the partial covering index, **drops the plain one in the same migration**. Two indexes on the same leading column is one index too many, and leaving the superseded one is how a schema accumulates.

## 27. Method, and the traps

### 27.1 How an index is proven

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT product_id FROM entitlements
WHERE user_id = '…' AND (expires_at IS NULL OR expires_at > now());
```

Read three things, in this order:

1. **The node type.** `Seq Scan` → `Index Only Scan` is the win. `Index Scan` (not "Only") means the heap is still being read — the `INCLUDE` columns are wrong or the row is not all-visible.
2. **`Buffers: shared hit/read`.** This is the honest measure. Wall-clock time on a laptop against a pooled remote Postgres is mostly network; buffer counts are not.
3. **Rows estimated vs. actual.** An order-of-magnitude gap means the planner has stale statistics — run `ANALYZE` before concluding the index failed.

Run each query **at least three times**; the first is cold-cache and unrepresentative.

### 27.2 `CREATE INDEX CONCURRENTLY` inside Alembic

A plain `CREATE INDEX` takes an `ACCESS EXCLUSIVE`-adjacent lock that blocks writes for the duration. `CONCURRENTLY` does not — but **it cannot run inside a transaction**, and Alembic wraps every migration in one. The migration must break out:

```python
def upgrade() -> None:
    # CONCURRENTLY cannot run in a transaction; Alembic opens one by default.
    with op.get_context().autocommit_block():
        op.create_index(
            "ix_entitlements_user", "entitlements", ["user_id"],
            postgresql_include=["product_id"], postgresql_concurrently=True,
        )
```

**A `CONCURRENTLY` build can fail and leave an `INVALID` index behind.** Check afterwards, and drop-and-retry rather than assuming success:

```sql
SELECT indexrelid::regclass FROM pg_index WHERE NOT indisvalid;
```

### 27.3 Query shape rules for everything written this week

The Week 2 bulk pattern is not optional on new surfaces:

- **Resolve `product_ids` once per request**, then call `resolve_granted_content_ids()` once per resource type. Never `has_access_to()` inside a loop.
- **No lazy relationship access in an async session.** SQLAlchemy's async engine raises `MissingGreenlet` on implicit IO — which is a *good* failure, because it is loud. Load explicitly with `selectinload()` (a second query, correct for collections) or `joinedload()` (one query, correct for many-to-one), and choose deliberately: `joinedload` on a collection multiplies the rows returned.
- **Select columns, not entities**, where only a couple of fields are used — `select(Question.id, Question.slug)` beats `select(Question)` on a 100-row catalogue with a large `body` column, because `body` is the biggest column in the schema and nothing on a list page reads it.
- **Keyset pagination, not `OFFSET`**, on anything that will grow — `/admin/orders` first. `OFFSET 500` makes Postgres read and discard 500 rows; `WHERE created_at < ?` reads none of them.
- **The N+1 test is a count, not a feeling.** Assert query counts in tests for any new list endpoint, via an event listener on the engine. A count that scales with fixture size is the bug, caught at the point it is written.

### 27.4 What is deliberately *not* done, and why

| Not done | Why |
|---|---|
| Read replicas | One Render instance and a Supabase free tier. A replica solves read contention that does not exist |
| Redis / a caching layer | A cache is a second source of truth and a new class of staleness bug. With correct indexes these queries are sub-millisecond; the remaining latency is the network hop, which a cache on the same host does not remove |
| Materialised views for tag counts | The counts are computed from the same 100 rows the page already fetched. A materialised view here adds a refresh schedule to save nothing |
| Denormalised ownership flags on content rows | The entitlement model's whole value is that access is derived, not stored (RS 5.6). A cached flag is a permission that can go stale — the one kind of staleness this product cannot afford |
| Partitioning | Comes into consideration around 10⁷ rows. The largest table here holds 100 |
| Connection-pool retuning | Already correct and hard-won: the **session** pooler on port 5432, not transaction mode on 6543, which breaks asyncpg's named prepared statements. Documented in `app/db/session.py`. **Do not "optimise" this** |

**The general rule:** at this scale the answer is almost always the index and the query shape, not another piece of infrastructure. Infrastructure added to solve a problem the data does not yet have is a permanent cost paid for a hypothetical benefit — and it is the exact shape of the "custom build does not mean build everything" warning in the brief.

---

# PART V — LEDGER, RISKS AND REFERENCE

## 28. Task ledger

| # | Task | Phase | Requirement | Blocked by | Status |
|---|---|---|---|---|---|
| 1 | Confirm the template purchase licence covers resale (§8.2, 28-licence) | 0 | W3-R2 | — | `[DONE]` — answered yes, 2026-08-15 (§8.4) |
| 2 | Fix the two inert clamps | 0 | — | — | `[DONE]` — both are live fluid ranges; values later moved again by Phase 6 step 0 |
| 3 | Width sweep on existing screens | 0 | — | 2 | `[DONE]` |
| 4 | Restart local dev backend; `QuestionsCatalogue` → `max-w-7xl` | 0 | — | — | `[DONE]` |
| 5 | Verify `anooshaerm@gmail.com` at Mailjet; restore Mailjet transport | 1 | W3-R1 | — | `[DONE]` — sole transport, REST |
| 6 | Delete `SANDBOX_SENDER`; set `OWNER_NOTIFICATION_EMAIL=anooshaerm@gmail.com` | 1 | W3-R1 | 5 | `[DONE]` — no `SANDBOX_SENDER`/`RESEND` left in `backend/app` |
| 7 | Jinja2 + `base.html.j2` | 1 | W3-R1 | — | `[DONE]` — autoescape on `("html.j2",)`, the compound-suffix trap named in `handover.md` |
| 8 | Six templates + six plain-text siblings (receipt keeps existing entity/ABN) | 1 | W3-R1 | 7 | `[DONE]` — eight pairs; the two f-string emails ported onto the base |
| 9 | Wire welcome / access / reset / free-entry sends | 1 | W3-R1 | 8 | `[DONE]` — reset needed a whole new endpoint + UI, not just a redirect fix |
| 10 | Deliver one of each, confirmed at Mailjet by message status | 1 | W3-R1 | 6, 9 | `[DONE]` — `get_message_status` against `GET /v3/REST/message/{id}` |
| 11 | Hostile-client render check | 1 | W3-R1 | 8 | `[TODO]` — **the one open Phase 1 item**; built for it, never checked in a client |
| 12 | Send the owed buyer their receipt | 1 | W3-R1 | 6 | `[MOOT]` — both orders gone in the intentional wipe; nothing to send |
| 13 | Capture "before" plans for six queries | 2 | W3-R9 | — | `[DONE]` — synthetic 20k-scale, rolled back, see `docs/db_index_evidence.md` |
| 14 | Duplicate cleanup on four pairs | 2 | W3-R9 | — | `[DONE]` — 0 duplicates found on all four (real data) |
| 15 | Migration `010_performance_indexes` | 2 | W3-R9 | 14 | `[DONE]` — applied to dev DB, 0 INVALID indexes |
| 16 | Four uniqueness constraints + a test seen red | 2 | W3-R9 | 14 | `[DONE]` — `test_duplicate_entitlement_rejected_by_database_constraint`, seen red at 009 then green at 010 |
| 17 | `ANALYZE`; capture "after"; drop what didn't help | 2 | W3-R9 | 15 | `[DONE]` — `ix_qlt_question` dropped (measured, no plan change); see evidence doc for the two kept-despite-inconclusive exceptions and why |
| 18 | New paid template products: upload, 2 previews, Stripe Product+Price each | 3 | W3-R2 | 1 | `[PARTIAL]` — products and real Stripe test-mode objects done (`015`); **the two previews are not built at all** — no column, no upload path, no display component |
| 19 | Deepen the course / seed a second | 3 | W3-R4 | — | `[TODO]` — no seed beyond `004`/`007`; the owner's own A$49 hold stands |
| 20 | Publish domain packs that clear the floor | 3 | W3-R2 | — | `[DONE]` — Risk pack PDF built (97,470 bytes), uploaded, real Stripe Price, `014` run |
| 21 | Seed the bundle at A$79 (`016`) | 3 | W3-R2 | 20 | `[DONE]` — contents as a live `SELECT DISTINCT` union, not a copied id list |
| 22 | Pre-purchase ownership check (409) | 3 | W3-R2 | — | `[DONE]` — `_already_fully_owned`, before Stripe |
| 23 | `/pricing` + `PricingTable`/`PricingColumn` | 3 | W3-R3 | 18, 20 | `[DONE, THEN REMOVED]` — built to spec, deleted 2026-08-16 on owner direction (step 0b); `/store` carries it now |
| 24 | `BundleCard` with real A$49+A$49→A$79 arithmetic | 3 | W3-R3 | 21 | `[DONE]` — survives the `/pricing` removal, now on `/store` |
| 25 | Extend gating case 13 to new templates and the bundle | 3 | W3-R2 | 18, 21 | `[DONE]` — `test_bundle_grants_both_parts_and_nothing_else` |
| 26 | axe sweep includes `/pricing` | 3 | W3-R3 | 23 | `[DONE, THEN MOOT]` — passed clean, then the route left the sweep with the page |
| 26a | Cart: `checkout/session` + `order_service` + webhook take a product-id list | 3 | W3-R11 | 22 | `[DONE]` |
| 26b | Cart: `useCartStore`, header icon, drawer/`/cart`, `Add to cart` buttons | 3 | W3-R11 | 26a | `[DONE]` — drawer, not a page; one `CartDrawer` in `RootLayout` so the two chromes can't desync |
| 26c | Cart: itemised receipt email, gating case 13 extended to N-item carts | 3 | W3-R11 | 26a | `[DONE]` — one receipt listing N products; `access_granted` still once per product |
| 27 | Confirm one general refund string on three surfaces | 4 | W3-R5 | — | `[DONE]` — `labels.ts` + its Python twin; `/store`, `/legal/refunds`, the receipt |
| 28 | Migration `011_refunds_and_revocation` | 4 | W3-R5 | — | `[DONE]` — plus the partial covering index `ix_entitlements_user_live` |
| 29 | Revocation inside `resolve_product_ids()` | 4 | W3-R5 | 28 | `[DONE]` — one place, in the query already running |
| 30 | `POST /admin/orders/{id}/refund` + audit | 4 | W3-R5 | 28 | `[DONE]` |
| 31 | `charge.refunded` webhook, idempotent | 4 | W3-R5 | 30 | `[DONE]` — shared `apply_refund()`, `already_refunded` no-op |
| 32 | `RefundDialog` with the real revocation list | 4 | W3-R5 | 30 | `[DONE]` |
| 33 | Refund state in `/admin/orders` | 4 | W3-R5 | 30 | `[DONE]` — chip + the one-off row tint |
| 34 | Three revocation gating tests, seen red | 4 | W3-R5 | 29 | `[DONE]` — suite green at 62/62 |
| 35 | Mux direct-upload endpoint + polling | 5 | W3-R6 | — | `[DONE]` |
| 36 | Storage presigned-upload endpoint | 5 | W3-R6 | — | `[DONE]` — `/confirm` verifies with a real `head_object`, not the browser's word |
| 37 | `UploadField` (both configurations) | 5 | W3-R6 | 35, 36 | `[DONE]` — one component, three call sites |
| 38 | Migration `012` — publish states + featured | 5 | W3-R6, W3-R7 | — | `[DONE]` — `published` kept in sync via `PublishStateMixin`; case 8 green unedited |
| 39 | `PublishStateChip` in three editors | 5 | W3-R6 | 38 | `[DONE]` |
| 40 | `FeaturedToggle` + `?featured=true` + Home | 5 | W3-R7 | 38 | `[DONE]` — with `FeaturedSummary` and the stated fallback |
| 41 | Record usability test as deferred to Week 4 | 5 | W3-R6 | — | `[DONE]` — `handover.md` Phase 5 entry |
| 42 | 99 authored previews | 6 | W3-R4 | #22 | `[DONE]` — the 16 questions still carrying `stopgap_preview()`'s ellipsis output given real, hand-written previews; `select count(*) from questions where preview like '%…'` returns 0 |
| 43 | Quick-win taxonomy gap closed; chips recounted | 6 | W3-R4 | — | `[CLOSED, left as-is]` — owner's editorial call, reviewed and deliberately not changed; recorded in `week3_report.md`, not a silent drop |
| 44 | `question_relations` populated | 6 | W3-R4 | — | `[DONE]` — 300 rows, top-3 per question by domain+tag+trait similarity |
| 45 | Stress fixtures loaded and walked | 6 | W3-R4 | — | `[DONE]` — `stress-fixtures.spec.ts`, 3/3 passing at 375px, no overflow |
| 46 | Confirm §8.4's closed decisions against reality | 6 | W3-R8 | — | `[DONE]` — Stripe `rk_test_` key confirmed live; hosting tiers unchanged; Mailjet confirmed. Supabase Auth's Site URL/Redirect URLs stay `[UNVERIFIABLE]` — dashboard-only, no API this environment can read |
| 47 | Confirm cost table unchanged in `handover.md` §3 | 6 | W3-R8 | 46 | `[DONE]` — no domain, no Vercel Pro, no Render upgrade; table unchanged |
| 48 | Nine events observed live; two reads written | 6 | W3-R10 | — | `[PARTIAL]` — 4 of 9 events fired for real during this session's own QA work (`content_viewed`, `checkout_started`, `purchase_completed`, `entitlement_delay`); the other 5 confirmed wired but not exercised. The two required reads are unanswerable without a `phx_` query key (not configured) and, more fundamentally, without real customer traffic — a data gap, not a wiring gap |
| 49 | `week3_report.md` + go/no-go, naming the deferred usability test | 6 | — | all | `[DONE]` — written; recommendation is the owner's to confirm |

**Ledger summary, 2026-08-17:** 46 done · 2 partial (18, 48) · 1 moot (12) · 1 closed-as-is (43) · 2 open (11, 19). The two remaining open items are both pre-existing, non-Phase-6 items — task 11 (the hostile-client email check) and task 19 (the course's depth, an owner-held content decision) — neither newly surfaced this session. Nothing open is blocked on a decision that hasn't already been made — §8's blocking list stayed empty all week.

## 29. Risk watchlist

| Risk | Watch for | Mitigation |
|---|---|---|
| **The purchase licence turns out not to cover resale.** A non-blocking check (§8.2) that could, on a bad answer, retroactively affect the A$39 product and any new templates built this week | Task 1's answer, whichever way it comes back | Check it early in Phase 0 rather than late in the week, so a bad answer costs a day, not a shipped product |
| **"It sent" concluded from a missing error line.** Recorded happening twice already, previously against Resend | Any delivery claim not backed by a Mailjet API response for that message's status | Non-negotiable #12 |
| **A refund that revokes nothing.** The worst possible half-shipped feature: the money leaves and the access stays | A refund test that asserts the Stripe call and not the next gated request | The revocation test is written **first**, seen red, then the endpoint |
| **Revocation checked in a second place.** `has_access_to_or_admin` already exists because four routes bypassed `require_entitlement` — the same dispersion could happen again | Any `revoked_at` reference outside `resolve_product_ids()` | Grep before commit. One query, one place |
| **A duplicate entitlement already exists in production**, and the constraint build fails at the end of a full scan | `HAVING count(*) > 1` returning rows | §26.3 runs first, always. If it finds any, that is a finding for the report |
| **An index added because it felt right.** The most common form of this exact task going wrong | Any index in `010` without a named query and a plan diff | Non-negotiable #14; unhelpful indexes dropped in the same migration |
| **`CONCURRENTLY` leaves an `INVALID` index** and the migration reports success | `SELECT … FROM pg_index WHERE NOT indisvalid` returning rows after `010` | Checked explicitly in the migration's own verification step |
| **The bundle sold to someone who owns half of it.** Generates a refund obligation on the day it ships | Any checkout session created for a product whose contents are already fully held | The 409 check (task 22) lands **before** the bundle is published, not after |
| **A price on the pricing page that no product can be bought at.** Faster trust loss than any bug | Any `/pricing` figure not resolved from a live `products` row | Prices come from the API, never from a constant. Grep for a literal price string in `frontend/src` |
| **The publish-state migration breaks the 404-not-403 rule.** Gating case 8 exists specifically because a 403 confirms a slug exists | Case 8 turning red, or being edited to accommodate the change | The suite passes unedited or the migration is wrong |
| **The type-scale fix silently reflows five shipped pages.** `h2` grows 10px and `h3` 6px at desktop | A wrapped button, a three-line hero, a truncated nav label | The sweep in Phase 0, on **existing** screens, with the 140-char fixture |
| **The deferred usability test quietly disappears rather than staying scheduled.** It is deferred, not cancelled | Week 4's plan arriving with no mention of it | Named explicitly in `week3_report.md` and Phase 5's Definition of Done, not just dropped from this week's list |
| **An inverting token on the dark plane.** Shipped wrong eight times, each passing review | `primary`, `accent` or `sidebar-*` in any file containing `bg-stage` | Grep before commit; open both themes before calling any surface done |
| **Gold on a small number.** A price at 24px is safe; the same token at 14px in a table is not | `--gold` or `--gold-strong` on anything under 18.66px | §12.4's table; the comment on every price line |
| **Test mode and free hosting are treated as permanent rather than a deliberate current state.** The moment Stripe goes live, Vercel Hobby's commercial-use restriction and PITR both become urgent again on the same day | Stripe's key changing to `sk_live_`/`rk_live_` without W3-R8's Vercel/PITR items being re-opened in the same conversation | State the link explicitly in `week3_report.md`: these three decisions are bundled, not independent |

## 30. Quick reference

### New dependencies
`jinja2` (backend) — everything else this week is already installed.

### New migrations
`010_performance_indexes` · `011_refunds_and_revocation` · `012_editorial_and_publish_states`

### New seeds
`015_seed_paid_templates.py` — new products built from the five previously-unused, owner-licensed vendor-risk files (decision #28, §8.4) · `016_seed_bundle.py` — the Risk Register Fundamentals + Risk pack bundle at A$79

### Environment changes (from v1.0)
No domain purchase; no `RESEND_API_KEY`. **`MAILJET_API_KEY` / `MAILJET_SECRET_KEY`** restored on Render; `OWNER_NOTIFICATION_EMAIL=anooshaerm@gmail.com`.

### New routes
`/pricing` · `/cart` (or a drawer, W3-R11)

### New API endpoints
`POST /admin/orders/{order_id}/refund` · `POST /admin/media/upload-url` · `GET /admin/media/{id}` · `POST /admin/templates/upload-url` · `GET /questions?featured=true` · `charge.refunded` in the existing Stripe webhook · `POST /checkout/session` reshaped to accept `product_ids: list[str]` (W3-R11)

### New components
`PricingTable` · `PricingColumn` · `BundleCard` · `RefundDialog` · `UploadField` · `PublishStateChip` · `FeaturedToggle` · `CartDrawer`/`CartIcon` (W3-R11) · six Jinja2 email templates + six plain-text siblings

### New documents
`docs/db_index_evidence.md` · `docs/week3_report.md` · the friction list (into `handover.md` §4)

### The design values you will reach for most

```
Radius        4 / 6 / 8 / 12px — 12px is a hard ceiling
Card          border-border · rounded-lg · bg-card · p-5 sm:p-6 (p-6 sm:p-7 for pricing)
Card hover    .hover-lift — translateY(-2px) + shadow-md · 150ms · never scale
Focus         2px --ring outline · 2px offset · 4px radius · global only, never per-component
Reading       serif (Newsreader) · 18px · 1.7 · max-w-[68ch]
UI body       sans (Schibsted Grotesk) · 16px · 1.55
Metadata      sans · 14px · 1.5 · --muted-foreground
Identifiers   mono (Azeret Mono) · 14px — order refs, Stripe ids, storage keys, ABN
Price         --gold-strong · 24px · 600 · tabular-nums · Intl.NumberFormat
Saving        --success · 16px · 600 · tabular-nums — NOT gold
Badge/chip    sans · 12px · 500 · rounded-sm · px-2 py-1 · always carries a word
Gold as text  --gold-strong, ALWAYS. --gold is decoration, ALWAYS.
Countables    tabular-nums, ALWAYS.
Motion        micro 100–150 · small 150–220 · medium 220–350 · nothing over 500ms · nothing loops
Easing        --ease-standard cubic-bezier(0.2, 0, 0, 1) · EASE_OUT_EXPO [0.16, 1, 0.3, 1]
Email hex     ground #F1ECE1 · card #FFFFFF · ink #1C1712 · plane #10213E · amount #7C5C14
```

### The commands that matter

```bash
# The paywall still holds — including revocation.
pytest && npm run test && npx playwright test

# No component holds a hex (email templates are the only sanctioned exception).
grep -rnE "#[0-9a-fA-F]{6}" frontend/src --include=*.tsx

# No inverting token on the dark plane.
grep -rln "bg-stage" frontend/src | xargs grep -n "primary\|accent\|sidebar-"

# No hard-coded currency symbol on a formatted amount.
grep -rn "A\$\|\\$[0-9]" frontend/src --include=*.tsx

# No hover distance drifted past 2px.
grep -rn "translate-y-1\|translateY(-4px)" frontend/src

# Every index built cleanly.
psql -c "SELECT indexrelid::regclass FROM pg_index WHERE NOT indisvalid;"

# No machine-derived previews remain.
psql -c "SELECT count(*) FROM questions WHERE preview LIKE '%…';"
```

**If the first is green, the paywall holds and refunds revoke. If it is red, nothing else this week counts.**

---

*This plan operationalises Week 3 against the intern brief, the Product Spec, `DESIGN.md`, `BACKEND.md` and the Research Specification, and against the repository as it stands on 2026-08-15, revised the same day against several owner decisions: no domain purchase (Mailjet restored instead), the refund window stays open, hosting and Stripe stay on their current free/test tiers, the receipt's legal entity stays as drafted, the bundle is priced at A$79, the usability test moves to Week 4, and the six vendor-risk template files are confirmed the owner's own, purchased/licensed for use — remaining legitimate raw material for new products, subject to one non-blocking licence-scope check (§8.2). It promotes transactional email from a line item to the week's non-negotiable, because it is the only Week 3 deliverable that is currently impossible rather than merely unbuilt — and it adds two requirements §60 did not name (refunds/revocation, and the database index layer) because the repository, not the plan, put them on the list. Where this document and `DESIGN.md` disagree on sequence, §60.1's cut order governs. Where it and `theme.css` disagree on a value, `theme.css` is right.*


---

## 31. Status sweep — 2026-08-16

Every checkbox and ledger row above was re-marked against the repository on this date, not carried forward from the phase notes. **Phases 0 through 5 are complete. Phase 6 is where all but two of the open items sit.**

**The pre-existing `[x]` marks in Phases 2, 4, 5 and 6 were independently re-checked, not accepted.** They hold — each against the code, not the phase note that claimed it:

| Claim | Checked against |
|---|---|
| `010`'s indexes and four constraints | The migration's own index list and `op.create_unique_constraint` loop; `ix_qlt_question` is correctly absent from the created set and its removal is reasoned in `db_index_evidence.md` |
| Before/after plans for six queries | `docs/db_index_evidence.md` — 268 lines, one section per query, plus the duplicate-cleanup run and a summary of what actually shipped |
| `011` and the gate change | `revoked_at`/`revoked_reason` added, `ix_entitlements_user_live` created and the superseded `ix_entitlements_user` dropped in the same migration; `Entitlement.revoked_at.is_(None)` appears in `entitlements.py` **once** |
| Refunds reach one end state from two entry points | `refund_service.apply_refund` imported by both `admin/orders.py:197` and `webhooks.py:200`'s `charge.refunded` branch, with `already_refunded` guarding the second |
| `refund_issued` is adopted | `capture_refund_issued` called from both, post-commit |
| Admin uploads | `POST /admin/media/upload-url` + `GET /admin/media/{id}`; `POST /admin/templates/{id}/upload-url` + `/confirm`, which calls a real `head_object` rather than trusting the browser |
| Publish states without breaking the suite | `PublishStateMixin` in `db/base.py`, keeping `published` and `publish_state` in step via a validator |
| `?featured=true` | A real first-class query param on the index endpoint. `Home.tsx` deliberately doesn't call it — it filters the list it already fetched — and the endpoint's docstring says so. The parameter exists as specified; the homepage just had a cheaper route to the same set |

One correction to my own earlier reading: I expected `?featured=true` to be missing, since `Home.tsx` filters client-side. It is present and implemented, with nulls-last ordering on `featured_sort`. Phase 5's mark was right.

**What is left, in the order it should be picked up:**

| # | Open item | Why it is still open |
|---|---|---|
| 42, 43 | The 99 machine-derived previews, and the quick-win taxonomy gap | Editorial work, not engineering. `stopgap_preview()` still supplies every preview and its own docstring still calls it a known gap. This is the largest remaining item and the one `DESIGN.md` §20.3 bans outright |
| 18 | Two preview images per paid template | The only Phase 3 acceptance line not met. Needs a small migration plus the presigned-upload pattern that already exists — a real task, not a new mechanism |
| 19 | A second course, or a deeper first one | The owner's own hold in `docs/pricing.md` §2 (*"the course still needs more real lessons before it is worth what it now costs"*) is unanswered |
| 44, 45 | `question_relations`; the stress-fixture walk | Both cheap. A question page still leads nowhere |
| 48 | The nine-event funnel walk | `refund_issued` gained its call site in Phase 4, so nothing blocks this but the walk itself |
| 46, 47 | The launch-condition and cost-table confirmations | Dashboard-side (Stripe mode, hosting tiers, Supabase Auth Site URL) — human, ten minutes |
| 11 | The hostile-client email render check | The one Phase 1 line with no evidence. `base.html.j2` is built for it; nobody has opened it in Outlook with images off |
| — | A human walkthrough of a 2+ item cart checkout | Only the automated gating suite has exercised the cart end to end. Named in `handover.md` §4 item 17 too |
| 49 | `week3_report.md` and the owner's go/no-go | The week does not close without it |

**Two things worth stating plainly rather than leaving implicit in the marks above:**

1. **`/pricing` is marked done-then-removed, not undone.** W3-R3 was built to its full specification and then deleted on owner direction (Phase 6 step 0b). The requirement it served — the whole commercial model legible before anyone is asked for anything — is met by `/store`, which carries the prices, the `one-time`/`lifetime` statement, and the shared refund and tax sentences. Marking it as unbuilt would misrepresent the week.
2. **The week's non-negotiable is met.** §7 says *"Do not proceed to Week 4 if a buyer still cannot receive an email"* — Mailjet is the sole transport, delivering to real addresses, confirmed per-send at the provider rather than inferred from a quiet log. Everything still open is a feature or a piece of content.