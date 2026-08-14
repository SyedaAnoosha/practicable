# Week 2 — PRD, Design Specification and Implementation Plan
**"Deciding in the Dark" Platform · v2.1 · 2026-08-13 · supersedes v1.0 (2026-08-12)**

> ### Reconciliation with `DESIGN.md`, 2026-08-13 (v2.0 → v2.1)
>
> `DESIGN.md` gained 131 lines after v2.0 of this plan was written — §7.5.3, a new §7.6 rule, §32.4, §33.3 and a route-inventory addition. **Five of those changes contradicted this plan, two of them in ways that would have caused real defects.** All are corrected in place below; they are listed here so the corrections are visible rather than silent.
>
> | # | What changed in `DESIGN.md` | Effect here | Severity |
> |---|---|---|---|
> | 1 | `/contact` shipped, carrying migration **`008_contact_messages`** | This plan's lesson-blocks migration was numbered 008; it **is now `009_lesson_blocks`.** Two migrations numbered 008 is a broken Alembic chain, not a naming quibble | **Would have broken the build** |
> | 2 | §7.6 gained the **stage-token inversion rule** | New Part II rule (§12.6) and a new risk-watchlist row. `--primary`/`--accent`/`--sidebar-*` all invert between themes; using any of them on the dark plane is correct in one theme and broken in the other. It shipped **seven times** before being caught | **Would have shipped a defect** |
> | 3 | §7.5.3 established that aurora contrast must be **measured from rendered pixels**, not token values | New rule in §12.5. The token maths said the auth panel was safe while the real paragraph sat at 4.36:1 | High |
> | 4 | §47.1 lists legal routes as **`/legal/terms`**, `/legal/privacy`, `/legal/refunds` | This plan said `/legal/terms`, `/legal/privacy`, `/legal/refunds`. Corrected in §20.7, Phase 5 and the route quick-reference | Medium |
> | 5 | §33.3 documented five **existing marketing devices** (`StatusDot`, `TypewriterTitle`, `AuthField`, `NewsletterForm`, `CornerFrame`) | Added to §20 so this week's components reuse them instead of rebuilding them. `StatusDot` takes `on="stage"` — see rule 2 | Medium |
>
> **Also folded in this revision** (owner direction, same day, outside `DESIGN.md`): the three typefaces were replaced and the member rail moved onto the `--stage` plane. §13 and §19.4 are rewritten accordingly.

*Sourced from `Deciding_in_the_Dark_Platform_Intern_Brief.md`, `BACKEND.md` v1.0, `DESIGN.md` v2.0 and `Deciding_in_the_Dark_Research_Specification.md`. Every requirement below traces to at least one of those four; where they disagree, §0.3's precedence rule decides.*

---
# Check:

Structure: PRD (§1–10) → Design specification (§11–23) → Phase-by-phase implementation (Phases 0–6) → The gating suite (§24–27) → Ledger, risks, quick reference (§28–30).

Design detail is pulled from theme.css as the source of truth, not paraphrased: both complete colour token sets with measured contrast ratios, the gold three-shade rule, the full type scale with min/max px and the viewport at which each clamp() reaches its ceiling, the spacing table including editorial vertical rhythm, the 12px radius ceiling, all four gradient utilities with their construction and where each may be used, a motion catalogue naming every animation on every surface built this week (including where the answer is deliberately no motion), and component specs for all sixteen new components with their exact type sizes, colours, borders and states.

Three substantive changes from v1.0 beyond depth:

I added a phase v1.0 missed. frontend/src/lib/scoring.ts and backend/app/services/question_service.py don't exist — /questions filters client-side with a strict every(), so three active filters return an empty page. That's the exact failure DESIGN.md §19.2 exists to prevent, and it's the brief's own stated proof of value ("what can I fix in a fortnight, cheaply, that my regulator cares about?"). §60's Week 1 reconciliation explicitly moved the discovery page to Week 2, and §60.1 lists it under "never cut". It's now Phase 3.

I flagged the scope honestly rather than quietly absorbing it. Seven phases in 5.5 days is over budget, and §2.1 says so plainly with a recommended cut order (§10) that defers the domain-pack SKU — blocked on owner content anyway — before touching gating, discovery or blocks.

I found a real gap in the gate itself. entitlements.py:83 carries # TODO: no admin bypass without an audit row — which BACKEND.md §4.3 lists under Never. Closing it is Phase 1 step 6, with a test.

Two things worth your attention: the state table in §0.4 is verified against the repo today rather than carried forward from v1.0, and decision #15 (who owns the hosting accounts) has now been asked three times across two weeks — it breaks nothing technical but it breaks the Week 4 handover.

## 0. How to read this document

### 0.1 What each part is for

| Part | Contains | Read it when |
|---|---|---|
| **I — PRD** | What Week 2 must produce and how each item is judged | Before you start; before you cut anything |
| **II — Design specification** | Every colour, size, space, gradient, easing and string used this week | Before you write a component; while you write a component |
| **III — Implementation plan** | Phase by phase, step by step, with file paths and code | While you build |
| **IV — Testing** | The gating suite, test by test | Phase 1, and again before the go/no-go |
| **V — Ledger, risks, reference** | The checklist, the watchlist, the one command that matters | Daily |

### 0.2 Status markers

`[BUILT]` verified present in the repository on 2026-08-13 · `[GAP]` verified absent · `[OWNER]` blocked on a decision only the owner can make · `[NEW]` first specified in this document

### 0.3 Precedence

1. **The intern brief** — non-negotiables and the four-week sequence. Nothing overrides it.
2. **`DESIGN.md`** — everything the user sees, and §60.1's cut order.
3. **`BACKEND.md`** — the service, the gate, the API contract.
4. **The Research Specification** — the reasoning, the entity model, the legal and security positions.
5. **This document** — sequencing and detail. Where it contradicts one of the above, the above wins and this file is wrong.

### 0.4 Verified state of the build entering Week 2

Every row below was checked against the repository on 2026-08-13, not carried forward from a previous plan.

| Area | State | Evidence |
|---|---|---|
| Test infrastructure | **`[GAP]` — none at all** | No `pytest`/`pytest-asyncio`/`httpx` in `backend/requirements.txt`; no `vitest`/`@playwright/test`/`@axe-core/playwright` in `frontend/package.json`; no `tests/` directory |
| The gate | `[BUILT]` | `backend/app/core/entitlements.py` — one dependency, one file, per `BACKEND.md` §1.1 |
| Admin bypass audit | **`[GAP]`** | `entitlements.py:83` carries `# TODO: no admin bypass without an audit row` — `BACKEND.md` §4.3 forbids exactly this |
| Question scoring | **`[GAP]`** | No `frontend/src/lib/scoring.ts`; no `backend/app/services/question_service.py`. `GET /questions` returns the whole list unscored; `QuestionsCatalogue.tsx` filters client-side with a strict `every()` — the exact dead end `DESIGN.md` §19.2 exists to prevent |
| Two-zone results, live count, zero-result recovery | **`[GAP]`** | `DESIGN.md` §19.3, §19.4, §19.6 — none implemented |
| Lesson content model | **`[GAP]`** | Migrations stop at `008_contact_messages`; `lessons` carries a rigid `lesson_type`. Product Spec §7.2's mixed blocks cannot be authored |
| Storefront | **`[GAP]`** | No `/store` route in `App.tsx`; three separate catalogues only |
| Legal pages | **`[GAP]`** | No `/legal/terms`, `/legal/privacy`, `/legal/refunds` routes |
| Analytics | **`[GAP]`** | No `posthog-js` dependency; nothing instrumented |
| Order reconciliation | **`[GAP]`** | No `/admin/orders` route; `DESIGN.md` §31.8 records manual grants as raw SQL |
| Admin autosave | **`[GAP]`** | `DESIGN.md` §31.8 names it "the highest-value gap" |
| Admin editors | `[BUILT]` | 23 routes, three editors, publish guards, audit rows on mutation |
| Commerce chain | `[BUILT]` | Checkout → webhook → entitlement → signed playback → presigned download → receipt |
| Free entry points | `[BUILT]` | Free questions (§27.1) + free Risk Register template (§27.4) |

### 0.5 Completion status, verified against the repository on 2026-08-14

Marked from the files themselves, not from the plan's own intentions. `[DONE]` the artefact exists and does what the step asked · `[PART]` the code exists but a stated acceptance criterion is unmet or unverifiable from the repository · `[TODO]` verified absent · `[UNVERIFIABLE]` an operational or human step that leaves no trace in the code (a purchase, an email, a person watching another person)

| Phase | Status | Evidence |
|---|---|---|
| **0 — Restore ground truth** | **`[PART]` — email decision superseded, not just unresolved** | `email_service.py` and `config.py` show the transport story moved past decision #14 entirely: Gmail/Brevo/Mailjet were tried and deliberately removed (`config.py:30`, `docs/gmail.md`, `docs/email.md`) in favour of **Resend as the sole transport, by the owner's stated current choice.** But `email_service.py`'s own module docstring is explicit: Resend is still running on its **sandbox sender**, which cannot reach any address but the owner's own — every send is redirected to `OWNER_NOTIFICATION_EMAIL` and relabelled `[Not delivered to buyer]`. **No real customer has received an email from this codebase as it stands.** W2-R1's acceptance line — *"a receipt email has arrived… to an address that is not the sender"* — is not merely unverified, it is currently **impossible** until a sending domain is verified with Resend. The mobile walkthrough (`week1_plan.md:181`) and the Week 1 go/no-go (`week1_plan.md:393–394`) are also still unticked |
| **1 — The gating suite** | **`[DONE]`** | `backend/tests/` (conftest + gating + admin + service, 1112 lines), `requirements-dev.txt`, vitest/playwright/axe in `package.json`, `frontend/tests/e2e/{gating,accessibility}.spec.ts`, `.github/workflows/ci.yml` with four blocking jobs. All 13 cases present. **Non-negotiable #9 closed 2026-08-14** — every guard disabled, observed red, restored, re-confirmed green; see [`gating_seen_red.md`](gating_seen_red.md) |
| **2 — Lesson blocks** | **`[DONE]`** | `009_lesson_blocks.py`, `db/models/lesson_block.py`, block-aware endpoints + up/down move + publish guard in `admin/courses.py:571–740`, `LessonBlocks` renderer in `Learn.tsx:235`, `BlockEditor` in `AdminCourses.tsx:115`, gating case 11 (6 tests). **Non-negotiable #11 closed 2026-08-14** — all three pre-existing lessons' content verified byte-exact against their backfilled blocks; see [`lesson_block_render_parity.md`](lesson_block_render_parity.md) |
| **3 — Discovery** | **`[DONE]`** | `lib/scoring.ts` (262 lines) + `services/question_service.py`, both reading `backend/tests/fixtures/scoring_cases.json` — parity enforced in CI from both sides. `ResultCount`, `MatchBadge`, `ZeroResults` with `rankRelaxationCandidates`, two-zone results, URL-as-source-of-truth, all in `QuestionsCatalogue.tsx`. `/questions/index` split from the scored `/questions` |
| **4 — Storefront and packs** | **`[PART]`** | `/store` shipped 2026-08-14: `Store.tsx`, `StoreSection`, `ContentTypeCard` (`components/store/`), routed in `App.tsx`, header nav consolidated (`MarketingLayout.tsx`), member rail updated (`MemberLayout.tsx`), axe sweep extended. `/courses` gained real price data (`CourseSummaryOut.product`) so the course card can show one. **Not done:** the domain-pack product type/page (W2-R6) — correctly deferred, blocked on `[OWNER]` decision #19, no artefact exists |
| **5 — Legal and analytics** | **`[DONE]`** | `/legal/{terms,privacy,refunds}` shipped 2026-08-14: `LegalLayout`, `DraftBanner`, footer-linked, axe-swept. `posthog-js` (frontend) + `posthog` 7.39.0 (backend) installed; `lib/analytics.ts` + `integrations/posthog_client.py`. **Nine-event reconciliation:** the plan's own Phase 5 step 7/8 contradict each other (9 client names in step 7, then 4 *different* server names in step 8 — 13 if both are literal); resolved by trusting `BACKEND.md §6.5`'s four server names as fixed and picking 5 client events from step 7's list — see `analytics.ts`'s own note. Do Not Track honoured (script never loads); no PII beyond a user id anywhere |
| **6 — Admin hardening** | **`[PART]`** | Autosave (`useAutosave.ts` + `AutosaveIndicator.tsx`, wired into the lesson-body and block-text editors — the two rich-text drafts, per §31.8's own "40 minutes of typed guidance" rationale), `/admin/orders` (table + CSV export, `admin/orders.py`), and the manual-grant dialog + audit row (`ManualGrantDialog.tsx`, `POST /admin/entitlements/grant`) all shipped 2026-08-14. **Not done, and not code:** the non-developer usability test (§31.3), the vendor-risk IP confirmation, the 99 preview edits, and the §62 device QA sweep are human/owner actions this session cannot perform — see §7's DoD and the ledger for what's left of each |

**Where the week actually stands:** Phases 1–5 are built and fully accepted, non-negotiables included, with the domain-pack SKU correctly deferred rather than faked (§2.1's own recommended cut, #1 in §10's order). Phase 6 is half done: autosave, `/admin/orders` and the manual grant are shipped; inline blur validation is genuinely unstarted; the usability test, the IP confirmation, the real-device QA pass and the Week 2 report itself all need a human or an owner decision this session cannot substitute for. Phase 0's mobile walkthrough and Week 1 sign-off are the same kind of gap — not code, a person.

**Non-negotiables #9 and #11 closed 2026-08-14**, both against the actual codebase rather than by inspection: every one of the 25 pytest gating cases plus case 9's Playwright anonymous half had its guard disabled in place, was observed failing, then restored and re-confirmed green ([`gating_seen_red.md`](gating_seen_red.md)); all three pre-existing lessons' backfilled content was queried live and found byte-exact against their pre-migration fields ([`lesson_block_render_parity.md`](lesson_block_render_parity.md)). Case 3 (bucket ACL) has no in-repo guard to disable and is spot-checked against live infrastructure by the test itself; case 9's signed-in half still needs a provisioned test account. One unrelated finding surfaced in the process: the locally running dev backend is serving stale, pre-Phase-3 API shapes and should be restarted before it's used for any further manual verification.

---

# PART I — PRODUCT REQUIREMENTS

## 1. Objective

> **Prove the paywall holds automatically rather than anecdotally; make the flagship discovery surface behave the way the taxonomy promises; and make the store a store — three labelled content types, mixed-media lessons, legal cover, and enough measurement to decide Week 3 from evidence.**

Week 1 proved one path works once. Week 2 proves it **keeps** working, and widens one product into a catalogue.

## 2. Why this scope, and not `DESIGN.md` §60's original Week 2

§60 defines Week 2 as *"course outline, modules, mixed lesson types, progress and resume; real content from the 100 questions; sign-in and access control finished properly."*

Most of that was pulled forward into Week 1 and the days after — the course outline, progress, resume, sign-in, the 100 questions and even parts of §60's Week 3 (admin editors, transactional email, multiple products) are built. Re-running the original plan would be re-planning finished work.

Four things §60 named for Week 2 are **genuinely not done**, and they are not small:

1. **The gating suite** (§58.2) — §60 itself insists it must not slip to Week 4.
2. **The discovery page to spec** (§19.2–§19.6, §57) — §60's Week 1 reconciliation explicitly moved it here, and §60.1 lists it under *"never cut"*. The page exists; the scoring model that makes it worth having does not.
3. **Mixed lesson types as blocks** (Product Spec §7.2) — §60 says "mixed lesson types"; a rigid `lesson_type` enum cannot express "paragraph, video, paragraph, file".
4. **Access control finished properly** — including the admin-bypass audit row that `BACKEND.md` §4.3 requires and `entitlements.py` currently marks `TODO`.

To those, Week 2 adds the four Product Spec §9 must-haves the platform still lacks entirely: the storefront, domain packs, legal pages and analytics.

### 2.1 A scope warning, stated plainly

**This is more than five days of work.** Seven phases across 5.5 days is over budget, and pretending otherwise would make the plan useless as a planning instrument.

The discovery work (Phase 3) is the addition that pushes it over. I am including it because §60.1 forbids cutting it and because the brief's single stated proof of value — *"what can I fix in a fortnight, cheaply, that my regulator cares about?"* — is exactly what an unscored strict filter cannot answer. Today, asking that question in the live UI returns an empty list.

**The recommendation, if the week runs long:** cut in §10's order, which defers the domain-pack *product* (blocked on owner content anyway, decision #19) and the analytics beyond the nine events, before touching gating, discovery or blocks. **Phases 0, 1 and 2 are not cuttable.**

## 3. Who this week serves

| User | What Week 2 gives them | Requirement |
|---|---|---|
| **The stranger** | A store that names its three content types and prices them honestly; a question filter that returns near answers instead of nothing | W2-R5, W2-R4 |
| **The learner** | Lessons that read as one flowing piece rather than three separate steps | W2-R3 |
| **The buyer** | Legal cover they can read before paying; a paywall proven to hold | W2-R7, W2-R2 |
| **The owner** | Evidence of what is viewed and bought; orders they can reconcile without SQL | W2-R8, W2-R9 |
| **The non-technical editor** | Autosave, inline validation, and block authoring | W2-R9, W2-R3 |
| **The next developer** | A test suite that documents the access model executably | W2-R2 |

## 4. Scope

### 4.1 In scope

W2-R1 Restore verifiable ground truth · W2-R2 The gating suite · W2-R3 Lesson blocks · W2-R4 Discovery scoring and two zones · W2-R5 The storefront · W2-R6 Domain packs · W2-R7 Legal pages · W2-R8 Analytics · W2-R9 Admin hardening

### 4.2 Out of scope, deliberately

| Not this week | Why | Source |
|---|---|---|
| AI-assembled tailored pack | Needs the store, tagging and all three types live and stable first | Product Spec §6 |
| Semantic search | First in the cut order | `DESIGN.md` §60.1 |
| Subscriptions, team seats, certificates, audio, case studies | Named non-goals | Product Spec §6 |
| A second course | Content work, not engineering | — |
| Drag-and-drop block reordering | Up/down buttons meet §31.3's actual requirement; drag is a day | §31.3 |
| Plausible alongside PostHog | One provider until there is a marketing site worth measuring separately | RS 6.10 |
| The full accessibility audit | Week 4. axe-in-CI is this week's floor, not the audit | §42.9 |
| `Draft → In review → Published → Archived` | The boolean holds; the review state is Week 3 admin work | §31.2 |
| Refactoring `lesson_type` away | Kept deliberately as a display hint — see Phase 2, step 2 | §31.8 |
| Mux direct upload from the admin | Pasted asset IDs work today and are isolated to one endpoint | §31.8 |

## 5. Requirements

Each carries its source, a testable statement, and the acceptance criteria used at the go/no-go.

---

### W2-R1 — Restore verifiable ground truth `[MUST]`

**Source:** Week 1 Definition of Done; the intentional data wipe of 2026-08-12.

**Statement.** The purchase → entitlement → delivery → receipt chain is demonstrable again from live records, not from a transcript of a session that has closed.

**Acceptance**
- A receipt email has arrived via the first-choice transport, to an address that is not the sender.
- A real `orders` + `entitlements` (`granted_via='purchase'`) + `audit_log` triple exists, created by a real checkout, verified by querying the database rather than trusting the UI.
- `/admin` is reachable by a real admin account.
- The mobile walkthrough is complete at 375px on a real device; Week 1's Definition of Done reads 12/12.
- Week 1 is formally closed with a written go/no-go.

---

### W2-R2 — The gating suite `[MUST — the week's non-negotiable]`

**Source:** Brief (*"the gating actually holds"*); `DESIGN.md` §58.2; `BACKEND.md` §11.1.

**Statement.** "Paid content is genuinely inaccessible" becomes a command anyone can run, covering all ten §58.2 cases plus three the spec was written before.

**Acceptance**
- `pytest`, `npm run test` and `npx playwright test` all exist and pass.
- All 10 §58.2 cases implemented, plus: the free-template case, the entitlement-shape regression, and block-level gating (case 11).
- **Every test has been observed failing** when the protection it guards was removed. The list goes in the PR description.
- CI runs all three suites on push and blocks a red build.
- axe reports zero violations on `/`, `/questions`, `/questions/:slug`, `/courses`, `/templates`, `/contact`, `/store`.
- The admin-bypass path in `entitlements.py` writes an `audit_log` row, and a test asserts it.

---

### W2-R3 — Lesson blocks `[MUST]`

**Source:** Product Spec §7.2, §9; `DESIGN.md` §24.3 (*"a lesson may combine types… should not require a second lesson"*).

**Statement.** A lesson can interleave text, video, file and callout blocks in one flowing view, authored in the admin, without a developer.

**Acceptance**
- A lesson authored as text → video → text → file reads as one continuous lesson at 375px and 1440px.
- **All three pre-existing lessons render identically to before the migration** — verified by comparison, not by assumption.
- Each video block mints its own short-lived playback token; each file block its own 60-second presigned URL; the entitlement check runs once per lesson, before either.
- A logged-out or unentitled request returns no block content of any kind (gating case 11).
- The publish guard refuses a lesson with zero blocks, a video block with no media, or a file block with no template.

---

### W2-R4 — Discovery: scoring, two zones, live count, zero-result recovery `[MUST]` `[NEW]`

**Source:** `DESIGN.md` §19.2–§19.6, §57; `BACKEND.md` §7; RS 3.5; brief (*"what can I fix in a fortnight, cheaply, that my regulator cares about?"*).

**Statement.** The filter is a **ranking, not a gate**. Three active constraints return the best available answers with a visible explanation of what missed, never an empty page.

**Acceptance**
- Scoring implemented per §57.3 in both `frontend/src/lib/scoring.ts` and `backend/app/services/question_service.py`, with **a question exact only when every active constraint matched exactly** (§57.2's corrected rule).
- Both implementations consume the same fixture file and produce the same partition — `backend/tests/fixtures/scoring_cases.json`, read by pytest and Vitest.
- Results render in two zones with a divider, exact above close, close rows carrying a `MatchBadge` naming the dimension that missed and its actual value.
- The live count reads `12 exact · +9 close`, in `tabular-nums`, updating on every chip and checkbox tap with no round trip. Search input debounced 250ms; **filter taps never debounced**.
- Zero results offers the two most restrictive active filters as computed one-tap relaxations, never a hard-coded list.
- Filter state lives in the URL; back, refresh and share all restore the exact result list.

---

### W2-R5 — The storefront `[MUST]`

**Source:** Product Spec §9 (*"a storefront that clearly separates and labels the three content types"*); `DESIGN.md` §0.8.

**Statement.** `/store` presents the catalogue as a store: three labelled content types in the product spec's own order, each explained in one line, with honest prices and honest empty sections.

**Acceptance**
- Three labelled sections — **Reference packs · Courses · Templates** — not a merged grid.
- Each section states its shape in one line in the §6 voice.
- Every price shown is real and matches `docs/pricing.md`. **No "coming soon" tile that looks like a product.**
- Free entry points appear inside the store, not below it.
- The marketing header links `/store`, replacing rather than appending (§17.1's five-item ceiling).

---

### W2-R6 — Domain packs `[SHOULD — content-blocked]`

**Source:** Product Spec §4.1, §9; RS 5.6.

**Statement.** A domain pack is purchasable end to end, using **no new entitlement mechanism** — a `product` whose `product_contents` rows are `question_set` for that domain plus a `template` row for the PDF artefact.

**Acceptance**
- One pack purchasable end to end: checkout → webhook → entitlement → the PDF downloads from My Library.
- The product page states plainly that the questions themselves are free, and that the pack sells the artefact and the curation.
- Gating suite extended: the pack's PDF is denied to a non-purchaser.

**Blocked on `[OWNER]` decision #19** — the engineering path can be built without the artefact; the product cannot be published without it.

---

### W2-R7 — Legal pages `[MUST]`

**Source:** Brief (*"drafted for us to review, never published on your authority"*); Product Spec §9; RS 11.1–11.5.

**Statement.** Terms, privacy and a refund position exist as visibly marked drafts, linked in the footer, replacing the "coming soon" placeholders.

**Acceptance**
- `/legal/terms`, `/legal/privacy`, `/legal/refunds` exist, are footer-linked, and carry the `[DRAFT — FOR REVIEW]` banner.
- The privacy policy **names every sub-processor actually in use**.
- The refund position complies with RS 11.3: no blanket "no refunds", no clause purporting to exclude ACL statutory guarantees.
- A data export / deletion request route exists (an email link is acceptable for v1; nothing is not).
- The handover pack records that these are a starting point for a lawyer, not a substitute for one.

---

### W2-R8 — Analytics `[MUST]`

**Source:** Product Spec §9 (*"what's viewed, what's bought, by content type, and where people drop off"*); RS 6.10, Appendix H; `DESIGN.md` §48.

**Statement.** Nine events, no more, answering real questions this month — including whether the seven-tag system is actually used.

**Acceptance**
- The nine events fire and are visible in PostHog, verified by walking the funnel once end to end.
- **No event carries PII beyond a user id.** Do Not Track honoured.
- Server-side events for the four the client cannot be trusted to report (`BACKEND.md` §6.5).
- The privacy policy (W2-R7) was written **before** the instrumentation, and names PostHog.

---

### W2-R9 — Admin hardening `[MUST]`

**Source:** `DESIGN.md` §31.3, §31.7, §31.8.

**Statement.** The two gaps that decide whether a non-developer will actually use the tool — losing work, and reconciling money — are closed, and the usability test is run.

**Acceptance**
- Autosave every 20 seconds with a visible `Saved 14:22`; inline validation on blur; a valid field is never cleared because another failed.
- `/admin/orders`: date, customer email, product, amount + currency, Stripe reference in mono, entitlement status, CSV export.
- Manual entitlement grant with a **required** reason, written to `audit_log` with actor, target and timestamp.
- **A non-developer has added a lesson unaided while being watched**; the friction list is written down, including what was not fixed.

---

## 6. Non-negotiables

Carried from Week 1 (1–8), unchanged and still in force. Three are load-bearing this week:

- **#3 Server-side entitlement checks only.** Phase 2 adds a new gated surface shape. Every block carrying a file or a video goes through `app/core/entitlements.py`, never a new bespoke check.
- **#5 No placeholder content.** Applies to the domain-pack PDF and every store price exactly as it applied to the first video.
- **#7 Never handle card data.** Unchanged; nothing this week touches the payment path.

Three additions for Week 2:

> **#9 — A test that has never failed has not been verified.**
> Every gating test is seen red before it is trusted green: comment out the check, watch it fail, restore it. A suite that passes because it asserts nothing is worse than no suite, because it manufactures confidence.

> **#10 — Two implementations of one rule must share one fixture.**
> Scoring runs in Python and in TypeScript. They will drift. `scoring_cases.json` is consumed by both suites, and a third consumer means deleting the client implementation and accepting the round trip (`BACKEND.md` §7.3).

> **#11 — A migration that changes live content silently is worse than no migration.**
> Three lessons exist and a course has been sold. "Renders identically to before" is a blocking gate on Phase 2, not a nicety.

## 7. Definition of Done — Week 2

- [x] The §58.2 gating suite exists, runs in one command, all 13 cases pass, and each has been seen to fail when its protection was removed. — *see [`gating_seen_red.md`](gating_seen_red.md), closed 2026-08-14*
- [x] A course lesson can interleave text, video and a file download in one flowing view, and existing lessons render unchanged. — *see [`lesson_block_render_parity.md`](lesson_block_render_parity.md), closed 2026-08-14*
- [x] Three active filters return ranked results with a visible reason, never an empty page; the live count updates on every tap.
- [x] `/store` exists: three labelled content types, honest prices, no dead tiles. — shipped 2026-08-14; domain packs (the fourth, content-blocked SKU) deferred, not faked
- [ ] At least one domain pack is purchasable end to end with a real artefact behind it — **or** it is formally deferred with the owner's agreement and the reason recorded.
- [x] Terms, privacy and refund pages exist as marked drafts, footer-linked. — shipped 2026-08-14
- [~] Analytics records content views, checkout starts, purchases and drop-off, by content type. — code shipped and reconciled against `BACKEND.md §6.5`; live PostHog verification is `[UNVERIFIABLE]` without a real project key (see Phase 5 DoD)
- [ ] Admin autosave works; `/admin/orders` reconciles; a non-developer has added a lesson unaided while watched.
- [ ] The Week 1 mobile walkthrough is done and the Week 1 go/no-go is closed. — *both still unticked in `week1_plan.md`*
- [x] Nothing this week required a manual database edit to demonstrate. — *migration `009` carries its own backfill; the test suite seeds and tears down in-transaction*

**Do not proceed to Week 3 planning if the gating suite is not passing.** Everything else on this list is a feature; that one is the brief's hardest requirement.

## 8. Open decisions `[OWNER]`

### 8.1 Blocking — needed before Day 1

| # | Decision | Blocks |
|---|---|---|
| **14** | **`[SUPERSEDED, 2026-08-14]`** — Gmail was the plan when this row was written; the owner has since settled on **Resend as the one transport** (`config.py:30` ignores any leftover Gmail/Mailjet/Brevo vars). The decision that actually blocks now: **verify a sending domain with Resend**, so `_send_via_resend` can address the real buyer instead of the sandbox-only `onboarding@resend.dev`. `docs/email.md` has the domain options already researched. | Phase 0 step 1 (rewritten); every receipt assertion in Phase 1 |
| **15** | **Account ownership — who owns Vercel / Render / Supabase / Stripe / Mux?** Asked on Day 1 of Week 1, asked again, still unanswered. This is now the largest non-technical risk on the project. | The Week 4 handover pack |
| **16** | **GitHub repo access** — who else can see this code today? | Handover continuity. Blocks nothing technical |
| **17** | **The refund position, commercially.** RS 11.3 rules out a blanket "no refunds" under Australian Consumer Law. I can draft the page; 14 days / unopened downloads only / none once a course is started is a commercial call. | Phase 5, step 3 |

### 8.2 Needed by Day 4

| # | Decision | Blocks |
|---|---|---|
| **19** | **What a domain pack contains.** Reference packs are a purchasable *artefact* — a formatted PDF of a domain's questions plus a curated working order — not a paywall over free text. Engineering can build product/checkout/delivery this week; **producing the PDF is content work only the author can do.** Confirm: one PDF per domain? Which ladder tier (`docs/pricing.md` §1)? | Phase 4, steps 5–8 |
| **21** | **Test-mode or live Stripe by end of Week 2?** The key in use is a restricted test key (`rk_test_`). Going live is its own verification pass and changes what Phase 1's purchase test means. | Phase 0 step 4; the go/no-go |
| **24** | **Which domains ship as packs first** — all five, or one as a proof? | Phase 4 seeding |

### 8.3 Non-blocking

| # | |
|---|---|
| 22 | The author's voice on the 99 machine-derived question previews (Phase 6 step 6) — editorial, not engineering, and the last thing standing between the catalogue and §20.3 |
| 23 | A 30-minute slot where a non-developer adds a lesson while being watched, unaided (§31.3 — the usability test is a deliverable) |
| 25 | Whether question previews should be publicly indexable (§44.4) — affects the prerender allowlist, not this week's build |

### 8.4 Closed since v1.0

- ~~#18 Was the data wipe intentional?~~ **Answered 2026-08-12: yes.** No recovery needed. The consequence stands: Week 1's cited evidence describes rows that no longer exist, and Phase 0 regenerates the proof.
- ~~#20 The second paid template.~~ **Resolved 2026-08-12** — Vendor Risk Assessment Scorecard, A$39, from a real 398 KB file already in Storage.

## 9. Success measures

| Measure | Target | How it is read |
|---|---|---|
| Gating cases passing | 13 / 13, each seen red first | CI |
| Scoring parity | 0 divergences across the fixture set | Both suites |
| Zero-result rate on `/questions` | Any three-filter combination returns ≥1 ranked result | Manual sweep + a property test |
| Lesson render parity | 3 / 3 pre-existing lessons unchanged | Before/after comparison |
| Store honesty | 0 prices shown for anything unbuyable | Manual |
| Analytics | 9 / 9 events observed in one live funnel walk | PostHog |
| Admin usability | Friction list written, with fixes and non-fixes named | Handover pack |

## 10. Cut order if the week runs long

Per `DESIGN.md` §60.1, and applied in this order:

1. **The domain-pack PDF product** (W2-R6) — blocked on owner content regardless; build the mechanism, defer the SKU.
2. **CSV export** on `/admin/orders` — the table reconciles without it.
3. **The callout block type** — text, video and file carry the requirement; callout is polish.
4. **Server-side scoring** (`question_service.py`) — ship the client implementation and the fixture; the round trip stays a Week 3 item. **Only if** the fixture file still exists so parity can be added without rework.
5. **Analytics beyond the four server-side events.**

**Never cut:** the gating suite, the discovery scoring model, lesson blocks, the legal drafts, mobile checkout, accessibility basics, real content.

---

# PART II — DESIGN SPECIFICATION

*This part is normative. `frontend/src/styles/theme.css` is the single source of truth for every value in it; where a number appears here it is quoted from that file, and if the two disagree, `theme.css` is right and this document is stale.*

## 11. Principles in force this week

| # | Principle | What it decides this week |
|---|---|---|
| §3.1 | **Answer first** | The store leads with what each type *is*, not with pricing tiers. Close matches appear above the fold, not behind "show more" |
| §3.3 | **Trust before decoration** | Motion never compensates for weak hierarchy. A close-match badge explains; it does not decorate |
| §3.4 | **One primary action** | `/store` has three sections and therefore three primaries — one per section, never two within a section |
| §3.6 | **Explain, don't just rank** | The whole reason Phase 3 exists. A close match must say *why* it is close |
| §7.2 | **Semantic utilities only** | No hex in any component written this week. A raw colour value outside `theme.css` fails review |
| §36 | **Card only for a real boundary** | Store sections are not cards. Products within them are |
| §7.6 | **Colour is never the only carrier of meaning** | Every badge carries a word. Every status carries an icon |

## 12. Colour

### 12.1 The two-colour system

Settled `[DECIDED, 2026-08-11, third and final revision]`: **two brand colours, not one and not five.**

| Role | Family | Tokens |
|---|---|---|
| Ground | Ivory / espresso | `--background`, `--card`, `--popover`, `--muted` |
| **Primary** | Blue | `--primary`, `--accent`, `--ring`, the five `--domain-*`, `--stage*` |
| **Secondary** | Champagne gold | `--gold`, `--gold-strong`, `--gold-soft`, `--secondary*` |

Shades and hues *within* those two families are open. **A third hue family is not.** Status colours (`--destructive`, `--success`, `--warning`) and `--chart-*` are the only exemptions.

### 12.2 Light theme — the complete token set

```css
:root {
  /* Surfaces — warm ivory, not violet-white: the paper this brand is printed on */
  --background: #FBF9F4;   --foreground: #1C1712;   /* espresso ink, not near-black */
  --card:       #FFFFFF;   --card-foreground: #1C1712;
  --popover:    #FFFFFF;   --popover-foreground: #1C1712;

  /* Brand */
  --primary: #10213E;      --primary-foreground: #F7F2E9;
  --secondary: #F0E7D2;    --secondary-foreground: #4A3D22;
  --accent: #1D5FA8;       --accent-foreground: #FFFFFF;

  /* The dark full-bleed plane the hero, auth panel and footer stand on.
     A SEPARATE token from --primary: --primary inverts between themes, --stage never does. */
  --stage: #10213E;        --stage-foreground: #F7F2E9;
  --stage-deep:   #050B18;  /* the near-black the aurora opens on */
  --stage-glow-1: #10305F;  /* deep blue — the widest, quietest bloom */
  --stage-glow-2: #1F6FC4;  /* azure — the body of the ramp */
  --stage-glow-3: #8ED2FB;  /* sky — the corner core only. 1.48:1. NEVER under text */

  /* Champagne gold, three shades. Contrast decides which, not taste. */
  --gold:        #C6A961;  /* decorative only — 2.16:1. NEVER a text node */
  --gold-strong: #7C5C14;  /* the text-safe antique shade — ≥5.02:1 on all four surfaces */
  --gold-soft:   #F3E9D2;  /* a surface wash for tinting a card or tile */

  /* Quiet */
  --muted: #F1ECE1;        --muted-foreground: #6E675A;

  /* Lines and fields — warm hairlines, not grey-violet */
  --border: #E6DFD0;       --border-strong: #998E78;  /* 3.2:1 on card — state-bearing */
  --input:  #E6DFD0;       --ring: #1B4E8C;           /* ~5.7:1 on ivory */

  /* Status — the one exception to the two-colour constraint */
  --destructive: #B3402E;  --destructive-foreground: #FFFFFF;
  --success:     #067647;  --success-foreground: #FFFFFF;
  --warning:     #8A5300;  --warning-foreground: #FFFFFF;

  /* Component-level */
  --primary-edge: color-mix(in srgb, var(--primary-foreground) 16%, transparent);
  --secondary-strong: #E5D7B6;

  /* Five shades of blue, not five hues */
  --domain-risk:       #142E5C;  /* deep navy-blue        12.67:1 */
  --domain-cyber:      #1B5FA8;  /* azure                  6.14:1 */
  --domain-compliance: #1D6FA5;  /* steel blue, leaning cyan 5.16:1 */
  --domain-resilience: #3D5A99;  /* indigo-blue            6.40:1 */
  --domain-ai:         #46618C;  /* slate blue-grey        5.96:1 */

  /* Sidebar — blue, not champagne [CHANGED 2026-08-12] */
  --sidebar: #E0E8F3;              --sidebar-foreground: #1A2E4A;
  --sidebar-primary: #10213E;      --sidebar-primary-foreground: #F7F2E9;
  --sidebar-accent: #CBD9EC;       --sidebar-accent-foreground: #10213E;
  --sidebar-border: #BDCEE5;       --sidebar-ring: #1B4E8C;

  --radius: 0.75rem;  --spacing: 0.25rem;  --letter-spacing: -0.01em;
  --shadow-tint: 52 42 26;   /* warm espresso, not pure black */
}
```

### 12.3 Dark theme — the complete token set

Dark is **not an inversion**. It mirrors the two-colour shape on a warm espresso night.

```css
.dark {
  --background: #141008;   --foreground: #F2EBDE;
  --card:       #1B1710;   --card-foreground: #F2EBDE;
  --popover:    #1E1911;   --popover-foreground: #F2EBDE;

  --primary: #6FA8DC;      --primary-foreground: #0B1A2E;
  --secondary: #2A2318;    --secondary-foreground: #EDE2CB;
  --accent: #b6deff;       --accent-foreground: #0B1A2E;

  --stage: #080D18;        --stage-foreground: #EAF1FA;
  --stage-deep:   #02060E;  --stage-glow-1: #0A2147;
  --stage-glow-2: #14538F;  --stage-glow-3: #4794D8;

  --gold: #C9AC6A;         --gold-strong: #E3CB92;   --gold-soft: #2E2517;

  --muted: #201B12;        --muted-foreground: #A79D89;
  --border: #332B1E;       --border-strong: #7C6F56;
  --input:  #332B1E;       --ring: #8FC1EA;

  --destructive: #E11D48;  --destructive-foreground: #FFFFFF;
  --success:     #2CC08A;  --success-foreground: #04140D;
  --warning:     #E9A13B;  --warning-foreground: #150C02;

  --primary-edge: color-mix(in srgb, var(--primary-foreground) 18%, transparent);
  --secondary-strong: #2E271B;

  --domain-risk: #5B7FBD;  --domain-cyber: #6FB0E8;  --domain-compliance: #5FB8D9;
  --domain-resilience: #8090D8;  --domain-ai: #93A7C9;

  --sidebar: #0C1524;              --sidebar-foreground: #9FB3CC;
  --sidebar-primary: #6FA8DC;      --sidebar-primary-foreground: #0B1A2E;
  --sidebar-accent: #17243A;       --sidebar-accent-foreground: #EAF1FA;
  --sidebar-border: #22314A;       --sidebar-ring: #8FC1EA;

  --shadow-tint: 0 0 0;   /* dark reads depth from a lighter surface, not a darker shadow */
}
```

### 12.4 The gold rule — the one way to misuse this palette

| Shade | Light | Dark | Permitted use |
|---|---|---|---|
| `--gold` | `#C6A961` · 2.16:1 | `#C9AC6A` · 8.66:1 | **Decorative only, in both themes.** Rules, gradient stops, tile fills, ring accents |
| `--gold-strong` | `#7C5C14` · 5.02–6.18:1 | `#E3CB92` · 9.49–11.94:1 | **Gold as text.** Labels, icons, small type, the terminating stop of `.text-gradient-brand` |
| `--gold-soft` | `#F3E9D2` | `#2E2517` | A surface wash for tinting a card or tile |

`--gold` passes contrast in dark and fails in light. **The rule is kept absolute anyway** — a token whose safety depends on the active theme is a token that will eventually be used in the wrong one.

### 12.5 Contrast floors, measured not eyeballed

| Pair | Ratio | Requirement |
|---|---|---|
| `foreground` / `background` (light) | 14.4:1 | AA body ✓ |
| `muted-foreground` / `background` | 4.9:1 | AA body ✓ |
| `accent` / `background` | 6.13:1 | AA body ✓ |
| `ring` / `background` | 7.94:1 | 3:1 non-text ✓ with margin |
| `border-strong` / `card` | 3.2:1 | 3:1 non-text ✓ |
| `domain-risk` / `background` (dark) | **4.71:1** | AA ✓ — **narrowest margin in the set** |
| `stage-foreground` / scrimmed aurora | 13.45:1 worst case | AA ✓ |

**The one to watch:** dark `--domain-risk` at 4.71:1. Any use of it on `--card` rather than the page background must be re-measured, not assumed.

> #### Gradients are measured from rendered pixels, not from tokens `[ADDED v2.1, DESIGN.md §7.5.3]`
>
> The table above is token-to-token, which is the right instrument for flat surfaces and **the wrong one for anything sitting on a gradient.**
>
> `DESIGN.md` §7.5.3 records what that costs: the token-level maths said the auth panel was safe, while the composited pixels under the actual paragraph — at its actual 75% opacity, at its actual width — sat at **4.36:1**. Below AA, on a shipped page, with a passing swatch audit.
>
> **A gradient's contrast claim is only meaningful at the point the text lands on it.** Screenshot the rendered page, sample the pixels under the real copy, in both themes, at 1440×900 and 375px. Anything built this week that puts text on `.hero-wash`, `.page-wash`, `.stage-aurora` or a domain tile is subject to this — including `/store`'s header wash.

### 12.6 Colour rules for every component written this week

> #### The inversion trap — read this before writing anything that touches a dark surface `[ADDED v2.1, DESIGN.md §7.6]`
>
> **`--primary`, `--primary-foreground`, `--accent` and every `--sidebar-*` token invert between themes. `--stage` and `--stage-foreground` do not.**
>
> Any inverting token used on the dark plane is correct in one theme and broken in the other. This is not hypothetical — it shipped **seven times** on the hero and footer: the hero search input and its three result labels, the newsletter field and button, and a footer mark square that rendered as an *invisible navy square on navy* in the light theme. **Every one passed review**, because each read correctly in whichever theme its author had open.
>
> **The rule:** a token that flips is safe only on a surface that flips with it. On anything carrying `bg-stage` — now including the member sidebar (§19.4) — use `stage` tokens and alphas of `--stage-foreground`. Never raw `white`.
>
> **The check:** grep for `primary`, `accent` and `sidebar` inside any file that also contains `bg-stage`, and open both themes before calling it done.
>
> **This week's exposure:** the `/store` page and the pack product page if either takes a dark band; any `StatusDot` placed on a dark surface (it needs `on="stage"` — §33.3 records that it pinned `text-foreground` and vanished); and the member rail, which this revision moved onto the plane.

- **`--border` groups; `--border-strong` means something.** Use `--border-strong` (or `--ring`) whenever the border *is* the message: an exact-match row's left rule, a selected filter chip, a focused input, an error field, the current lesson.
- **Locked is `muted` + `Lock`, never `destructive`.** A user who has not bought something has not done anything wrong.
- **Never hard-code white.** `bg-white` is a dark-mode bug in waiting.
- **The seven tag dimensions get no colours.** Five domains do; seven dimensions do not — that is a rainbow that means nothing (§20.2, §37).
- **Charts are exempt** from the semantic-token rule, inside chart components only, using `--chart-*` only. Nothing renders a chart yet.

## 13. Typography

### 13.1 The three faces `[REPLACED 2026-08-13 — owner direction, DESIGN.md §9.0]`

All three faces changed after v2.0 of this plan. The owner ruled out the typefaces AI site builders default to, naming *Inter, Roboto, Open Sans, Playfair Display, Lora, Instrument Serif, Space Grotesk, Manrope, Space Mono, JetBrains Mono, Fira Code, Source Serif 4, Times New Roman, Georgia* — which struck two of the three directly, plus both serif fallbacks. Bricolage Grotesque went with them because a type system is a set, not three independent picks.

| Face | Job | Weights | Never |
|---|---|---|---|
| **Schibsted Grotesk** (`--font-sans`) | Headings, navigation, buttons, labels, product names, card titles, all interface copy | 400 · 500 · 600 · 700 — **not 300, not 800/900** | — |
| **Newsreader** (`--font-serif`) | Question guidance, reading lessons and **text blocks**, legal pages, the question title on a question page | 400 · 500 · 600 | Navigation, buttons, labels, tables, admin, anything under 16px |
| **Azeret Mono** (`--font-mono`) | Question IDs, order numbers, Stripe references, timestamps, file sizes, the `.eyebrow` device, **rail section headings** | 400 · 500 · 600 | Above `text-sm` |

They tell **one story** — a professional publisher's masthead, its reading page, and its data tables. Schibsted Grotesk was drawn as the brand face for a news publisher; Newsreader is a text-grade serif with a real optical-size axis (`opsz` 6–72) drawn for sustained on-screen reading; Azeret Mono is squared-off enough to read as a choice rather than as the default "technical" mono.

**Two knock-on changes this plan must carry, both already applied to `theme.css`:**

| Change | Why |
|---|---|
| **`--text-read`: 17px → 18px** | Newsreader has a smaller x-height than Source Serif 4, so 17px of it read *smaller* than the 16px sans beside it — the opposite of the optical match the token exists to hold. Also answers the owner's review note that too much of the product is set small to scan confidently |
| **`.eyebrow` tracking: 0.2em → 0.16em** | Azeret Mono sets appreciably wider. The tracking that made the old mono read as a deliberate device made this one read as spaced-out letters |

**What was given up, stated plainly:** Bricolage was justified on its `opsz` axis and Schibsted Grotesk has none. The mitigation is that §13.2's scale already carries per-token tracking, so the correction `opsz` automated is now specified by hand. It is more to hold.

**Loading:** self-hosted variable files via `vite-plugin-webfont-dl`. `font-display: swap`. Preload **only** Schibsted Grotesk 600 and Newsreader 400. Subset Latin + Latin-Extended (the `Ní Bhraonáin` stress fixture exists partly to catch a bad subset). Fallbacks are `ui-sans-serif`/`system-ui` and `ui-serif`/`serif` — **Georgia and Times New Roman are struck by name and must not reappear.**

> `theme.css` and `vite.config.ts` must name the same three families. The plugin fetches at build time, so a face named in CSS but absent from the config fails silently to a system fallback — which looks like a rendering bug and gets debugged as one.

### 13.2 The scale — every size, with its line height and tracking

A 1.25 major-third ratio at the base, loosening at display sizes, expressed as fluid `clamp()` so headings need no per-breakpoint classes.

| Token | Min | Max | Clamps min below | Reaches max at | Line height | Tracking | Use |
|---|---:|---:|---:|---:|---:|---:|---|
| `text-display` | 44px | 72px | 400px | 1009px | 1.0 | −0.03em | Homepage hero **only**. Once per site |
| `text-h1` | 36px | 52px | 400px | 1015px | 1.08 | −0.02em | Page title; the question on a question page |
| `text-h2` | 28px | 38px | 400px | 1114px | 1.15 | −0.015em | Section heading — **each store section** |
| `text-h3` | 22px | 28px | 400px | 1257px | 1.25 | −0.01em | Card title, lesson title, block heading |
| `text-h4` | 20px | 20px | — | — | 1.35 | −0.01em | Subsection, form group heading |
| `text-lead` | 19px | 19px | — | — | 1.55 | 0 | Lead paragraph, short answer — serif |
| `text-read` | **18px** | **18px** | — | — | **1.7** | 0 | Serif reading body, **text blocks** |
| `text-body` | 16px | 16px | — | — | 1.55 | 0 | Sans body, UI text |
| `text-sm` | 14px | 14px | — | — | 1.5 | 0 | Metadata, form labels, helper text, `MatchBadge` |
| `text-xs` | 12px | 12px | — | — | 1.4 | +0.06em when uppercase | Eyebrows, badges, table meta. **The floor** |

**Below 400px viewport width, every fluid size is pinned to its minimum.** That is the design, not a bug: 375px gets 36px h1s, not 30px ones.

### 13.3 Typographic rules

- **`text-xs` is the floor.** 12px, and only for genuinely secondary metadata. Anything a user must read to make a decision is `text-sm` or larger.
- **One `h1` per page.** If a section needs `h2` and its cards need `h3`, that is the whole hierarchy — do not reach for `display` to add emphasis.
- **Measure capped at 68ch** for serif reading body. `max-w-[68ch]`, character-based, so it stays correct if the reading size changes. Do not replace it with a px value.
- **`tabular-nums` on anything countable** — prices, progress percentages, durations, order totals, **and the live result count**. Without it, `12 exact · +9 close` jitters on every tap and reads as broken.
- **Sentence case everywhere.** The only exception is the small uppercase eyebrow, which is a deliberate typographic device.

### 13.4 The eyebrow device

```css
.eyebrow {
  font-family: var(--font-mono);
  font-size: 0.75rem;        /* 12px */
  line-height: 1.4;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  color: var(--muted-foreground);
  gap: 0.625rem;             /* 10px between the rule and the text */
}
.eyebrow::before {
  content: ""; width: 1.5rem; height: 1px;   /* a 24px hairline */
  background: var(--eyebrow-rule-color, var(--accent));
}
```

`PageTitle`'s `eyebrowColor` prop overrides the rule colour per instance — a question page passes its domain colour. **New this week:** `/store` uses `Store`; each store section uses its type name; legal pages use `Legal`.

### 13.5 Face pairing, by surface

| Surface | Title | Body |
|---|---|---|
| `/store` and its three sections | Sans | Sans |
| Product and pack pages | Sans | Sans, with a serif `lead` for the author's framing paragraph |
| Question detail | **Serif** (`variant="editorial"`) | Serif |
| Lesson — text block | Sans `h3` | **Serif** `text-read` at 68ch |
| Lesson — callout block | Sans `h4` | Sans `text-body` |
| Legal pages | Sans `h1`/`h2` | **Serif** `text-read` at 68ch |
| Admin, tables, orders | Sans throughout | Sans; **mono** for Stripe references, order ids, timestamps |

## 14. Spacing

4px base. **Tailwind's default scale, not a custom one** — inventing one costs time for no benefit.

```
4  8  12  16  20  24  32  40  48  64  80  96  128
```

| Context | Value |
|---|---|
| Inside a compact control (button, chip, badge) | 8–12px vertical · 12–16px horizontal |
| Card padding | 20px mobile · 24px tablet+ · 28px feature cards |
| Gap between cards in a grid | 16px mobile · 24px desktop |
| Between a heading and its content | 12–16px |
| Between content blocks within a section | 32–40px |
| **Between lesson blocks** `[NEW]` | 32px mobile · 40px desktop |
| Between page sections (marketing, `/store`) | 64px mobile · 96px desktop |
| Between page sections (product, dashboard, admin) | 32px mobile · 48px desktop |
| Page horizontal padding | 20px mobile · 32px tablet · 48px desktop |
| Between store sections | 64px mobile · 96px desktop |
| Filter rail group spacing | 24px between groups · 8px between values |

**Vertical rhythm in editorial mode** — set once in `.prose-guidance`, never per component:

| Relationship | Value |
|---|---|
| Paragraph to paragraph | 1em of the reading size (≈18px) |
| Space above a heading | 2em (≈34px) |
| Space below a heading | 0.5em (≈8.5px) |

Arbitrary values (`mt-[13px]`) need a comment explaining the optical reason. **Optical corrections are legitimate; guesses are not.**

## 15. Radius, borders and elevation

### 15.1 Radius — a hard 12px ceiling

`--radius: 0.75rem` (12px). This is the **second** tightening: 20px → 16px → 12px, because 16px on the largest surfaces still read as "modern SaaS template" rather than the editorial register this product wants.

| Utility | Value | Use |
|---|---|---|
| `rounded-sm` | 4px | Chips, badges, small buttons, table cells |
| `rounded-md` | 6px | Inputs, selects, buttons |
| `rounded-lg` | 8px | **Cards — the default** |
| `rounded-xl` | 12px | Feature blocks, video frame, hero panels |
| `rounded-2xl` / `rounded-3xl` | **12px** | Pinned to the same ceiling at the token level. Reaching for these gets you nothing rounder |
| `rounded-full` | — | Avatars, pills, circular icon buttons, filter chips only |

Do not round everything heavily. A dense admin table with 12px corners on every cell reads as a toy — `/admin/orders` uses `rounded-sm` on cells and `rounded-lg` on the table container.

### 15.2 Borders

The default surface treatment is **a 1px border, not a shadow.** Borders are cheaper, crisper, theme-safe, and hold up in dark mode where shadows disappear.

| Situation | Treatment |
|---|---|
| Grouping / card edge | `border border-border` |
| Selected, active, current, **exact-match row** | `border-border-strong`, or a 2px `ring-ring` |
| Focus | The global `:focus-visible` outline. **Never a custom per-component focus style** |
| Error | `border-destructive` **plus** an icon and a message |
| Locked | `border-dashed border-border` + `Lock` icon |
| **Close-match row** `[NEW]` | `border-border` — the *absence* of `border-strong` is the signal. **Text opacity is never reduced** |

### 15.3 Elevation — four levels, nothing else

| Level | Utility | Use |
|---|---|---|
| 0 | none | **The default.** Most cards |
| 1 | `shadow-sm` | Cards that lift on hover; sticky headers once scrolled |
| 2 | `shadow-md` | Popovers, dropdowns, the command palette, the autosave toast |
| 3 | `shadow-lg` | Dialogs, mobile bottom sheets, the filter sheet, the manual-grant dialog |

```css
--shadow-sm: 0 1px 2px 0 rgb(var(--shadow-tint) / 0.05), 0 2px 6px -1px rgb(var(--shadow-tint) / 0.06);
--shadow-md: 0 4px 10px -2px rgb(var(--shadow-tint) / 0.08), 0 2px 5px -2px rgb(var(--shadow-tint) / 0.05);
--shadow-lg: 0 10px 24px -6px rgb(var(--shadow-tint) / 0.13), 0 4px 10px -4px rgb(var(--shadow-tint) / 0.07);
```

The tint is **warm espresso** (`52 42 26`), not pure black — depth cast by warm materials. In dark it goes `0 0 0` and the border does the work instead.

## 16. Gradients and washes

Every gradient is built from tokens via `color-mix()` / `linear-gradient()`. **A one-off hex picked in a component is a review failure**, gradients included.

**All washes are linear, not radial.** Every radial version exposed its own elliptical edge somewhere inside its fixed-height box — a visible curved seam. A vertical linear gradient has no edge to expose, and a mask fades both ends so nothing is clipped at any viewport width.

### 16.1 `.hero-wash` — the homepage atmosphere

```css
.hero-wash {
  position: absolute; inset-inline: 0; top: 0; height: 44rem;
  pointer-events: none; opacity: 0.18;
  background-image:
    linear-gradient(180deg, var(--accent) 0%, transparent 60%),
    linear-gradient(115deg, color-mix(in srgb, var(--primary) 70%, transparent) 0%, transparent 45%),
    linear-gradient(250deg, color-mix(in srgb, var(--gold)    75%, transparent) 0%, transparent 55%);
  mask-image: linear-gradient(to bottom, transparent 0%, black 12%, black 45%, transparent 94%);
}
```

Three stops: blue down, navy from the left, champagne from the right. **Blue alone desaturates to grey over ivory** — the champagne pass is what keeps it reading as a deliberate warm tint rather than a dirty smudge. Static, so no reduced-motion branch is needed.

### 16.2 `.page-wash` — catalogue and store headers `[applies to /store this week]`

Same construction, deliberately **one notch quieter** — `opacity: 0.14` against the hero's `0.18`, and two layers instead of three:

```css
.page-wash {
  pointer-events: none; opacity: 0.14;
  background-image:
    linear-gradient(180deg, var(--accent) 0%, transparent 60%),
    linear-gradient(115deg, transparent 30%, color-mix(in srgb, var(--gold) 55%, transparent) 100%);
  mask-image: linear-gradient(to bottom, transparent 0%, black 14%, black 42%, transparent 92%);
}
```

A catalogue is a working index the reader scans, not a landing page — the atmosphere should be **felt rather than noticed**. Positioning is the consumer's job; this rule carries only the paint.

**`/store` uses `.page-wash`, not `.hero-wash`.** It is an index, and giving it hero treatment would tell the visitor it is the landing page.

**Applied full-bleed inside a `max-w` container** — `inset-x-0` stops at the container edge, so:

```tsx
<div aria-hidden="true"
     className="page-wash absolute left-1/2 top-0 -z-10 h-[30rem] w-screen -translate-x-1/2" />
```

The parent needs `relative isolate` so `-z-10` stays behind the content without wrapping every child.

### 16.3 `.stage-aurora` — the dark plane

Six layers on the `--stage` plane: a base ramp on the 148° diagonal, three nested blooms anchored at the bottom-right corner, a plume across the upper third, and a scrim strongest at the left edge.

**The scrim is the load-bearing layer.** `--stage-glow-3` is 1.48:1 against `--stage-foreground` in light, so it can never sit under text; the scrim plus corner anchoring keeps the text column dark **by construction** rather than by hoping the copy stays short.

| Measured, alpha-composited (light, worst case) | Ratio |
|---|---:|
| `stage-foreground` on scrim(70%) + `glow-2` | 13.45:1 |
| same, if `glow-3` reached it | 9.23:1 |
| same @75% (the lead paragraph) | 8.13:1 |
| `--gold` on the scrimmed plane | 6.61:1 |

`.stage-aurora--quiet` (footer) sets `--aurora-opacity: 0.5` and pushes the core off-canvas to `108% 155%`, because the footer's content spans the full width and reaches the bright corner.

**Not used by any surface built this week.** Listed so nobody rebuilds it inline.

### 16.4 `.text-gradient-brand` — the headline device

```css
.text-gradient-brand {
  color: var(--foreground);   /* the fallback where background-clip:text is missing */
  background-image: linear-gradient(100deg,
    var(--primary) 0%, var(--accent) 50%, var(--gold-strong) 100%);
  background-clip: text; -webkit-text-fill-color: transparent;
}
```

**The terminating stop must be `--gold-strong`, never `--gold`.** A gradient's tail is still body-legible text; ending a headline on champagne leaves its last few letters at ~2:1.

Permitted on **one headline per page, maximum.** Not on `/store`'s section headings — three gradient headings on one page is decoration, not emphasis.

### 16.5 `.bg-gradient-brand` and `.bg-gradient-animated`

```css
.bg-gradient-brand {
  background-image: linear-gradient(135deg, var(--primary) 0%,
    color-mix(in srgb, var(--primary) 70%, var(--domain-compliance)) 100%);
}
.bg-gradient-animated {
  background-image: linear-gradient(120deg, var(--accent) 0%,
    var(--domain-compliance) 33%, var(--domain-cyber) 66%, var(--accent) 100%);
  background-size: 300% 300%;
  animation: gradient-drift 18s ease infinite;
}
```

`.bg-gradient-animated` is a **backdrop only** — felt, not watched. It collapses to static under `prefers-reduced-motion` via the global backstop. Not permitted behind text without a scrim.

### 16.6 Domain tiles

Domain colours at low opacity as icon-tile backgrounds:

```tsx
style={{ backgroundColor: `color-mix(in srgb, ${domainColorVar(name)} 12%, transparent)` }}
```

The **icon** carries the full-strength token colour — that is what the §7.5.1 audit measures. A 12% wash is a non-text, non-meaning-bearing surface and has no contrast requirement, which stays true only because colour is never the sole carrier of meaning.

Domain colour is set through `domainColorVar()` in `lib/domainVisuals.ts` — the one place a domain maps to a colour and an icon. **Tailwind's JIT cannot see a runtime-interpolated class name**, so data-driven domain colour goes through an inline `var()`, never a constructed class string.

## 17. Motion

### 17.1 Tokens

```css
--ease-standard: cubic-bezier(0.2, 0, 0, 1);   /* most things */
--ease-entrance: cubic-bezier(0, 0, 0, 1);     /* things arriving */
--ease-exit:     cubic-bezier(0.3, 0, 1, 1);   /* things leaving */
```

```ts
EASE_OUT_EXPO = [0.16, 1, 0.3, 1]   // lib/motion.ts — the house curve, slow settle, no overshoot
```

| Band | Duration | Applies to |
|---|---|---|
| **Micro** | 100–150ms | Hover, focus, press |
| **Small** | 150–220ms | Chips, badges, tooltips, inline reveals |
| **Medium** | 220–350ms | Cards, sheets, dialogs, the filter panel |
| **Large** | 350–500ms | Page-level transitions (rare) |

**Nothing loops. Nothing exceeds 500ms.** The one exception is `gradient-drift` at 18s, which is a backdrop, not an interaction.

### 17.2 What animates, with what

| Use | Tool |
|---|---|
| Hover colour, border, background, opacity | CSS transition |
| **Focus ring** | **None — instant** |
| Mount / unmount, presence | `motion/react` |
| Layout shifts, shared-element movement | `motion/react` (`layout`) |
| Sheets, dialogs, drawers | Radix primitives with our tokens |
| Progress bar width | CSS transition on `width` |

### 17.3 The complete motion catalogue for surfaces built this week

| Surface | Motion | Spec |
|---|---|---|
| Store section entrance | Staggered rise, first 6 only | `initial={{opacity:0,y:8}}` · `duration: 0.22` · `delay: min(i,6)*0.03` |
| Product card hover | **2px lift, no scale** | `whileHover={{y:-2}}` · `duration: 0.16` · plus `shadow-sm` |
| Any button press | Scale | `whileTap={{scale:0.98}}` |
| Filter chip toggle | Background + border colour | CSS transition · 150ms · `--ease-standard` |
| **Result zone change** | **None on the rows.** The count updates instantly | Re-sorting 100 rows with `layout` is 300ms of visual noise on every tap |
| **Live result count** | **None.** `tabular-nums` prevents jitter | An animated counter on a filter tap reads as lag |
| Exact→close divider | Fade in when the close zone becomes non-empty | 180ms · `--ease-entrance` |
| Lesson block reveal | **None.** Blocks render immediately | §39.2 — no reveal-on-scroll for body content; a screen-reader user who jumped there would find nothing |
| Video block load | Poster + centred spinner, **no layout shift** | The 16/9 box is reserved before the player mounts |
| Download button states | Label swap, width held | See §20.4 |
| Progress bar on complete | Width transition | 300ms · `--ease-standard` |
| Autosave indicator | Fade in, hold, fade out | 150ms in · 2s hold · 300ms out |
| Filter sheet (mobile) | Slide-over from the right | Radix `Sheet` · 300ms · `--ease-standard` |
| Manual-grant dialog | Radix default with our tokens | 220ms |
| Legal page | **None.** It is a document | — |

### 17.4 Prohibited

- No parallax. No scroll-jacking.
- **No reveal-on-scroll for body content.** Content that only appears when scrolled to does not exist for a screen-reader user who jumped there.
- No animated page-load sequence. This audience arrived to find something.
- **No card scale on hover.** A card that grows 4% pushes its neighbours and reads as a consumer app.
- No confetti, no streaks, no gamification — including on purchase success.

### 17.5 Reduced motion

Two layers, both already in place:

```tsx
<MotionConfig reducedMotion="user">   {/* main.tsx — neutralises transforms tree-wide */}
```

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

**Transitions become instant state changes — never removed entirely**, because the state change itself still needs to be visible. Nothing written this week needs its own `prefers-reduced-motion` branch.

## 18. Iconography

**Lucide React, only.** Stroke width **1.75** (Lucide's default 2 is slightly heavy next to Bricolage at small sizes).

| Size | Use |
|---|---|
| 14px | Inline with `text-xs` metadata |
| 16px | Inside buttons and compact controls |
| 18px | Standalone controls, list markers |
| 20px | Navigation, tab bars |
| 24px | Feature icons, empty-state marks |

### 18.1 The fixed map, plus this week's additions

| Concept | Icon | |
|---|---|---|
| Question | `HelpCircle` | |
| Guidance / reading lesson / text block | `BookOpen` | |
| Video lesson / video block | `PlayCircle` | |
| Downloadable lesson / template / file block | `FileDown` | |
| Locked | `Lock` | |
| Owned / entitled / complete | `CircleCheck` | |
| In progress | `CircleDashed` | |
| Regulator pressure | `Landmark` | |
| Duration | `Clock` | |
| Cost | `Banknote` | |
| Effort | `Gauge` | |
| ROI horizon | `TrendingUp` | |
| Tier | `Layers` | |
| Leadership traits | `Users` | |
| Search | `Search` | |
| Filter | `SlidersHorizontal` | |
| **Store** | `Store` | `[NEW]` |
| **Reference pack** | `Library` | `[NEW]` — not `BookOpen`, which is already reading |
| **Callout block** | `Info` | `[NEW]` |
| **Close match** | *(none)* | `[NEW]` — the badge carries a word; adding an icon makes it read as a warning |
| **Autosaved** | `Check` | `[NEW]` at 14px, beside the timestamp |
| **Order / receipt** | `Receipt` | `[NEW]` |
| **Manual grant** | `KeyRound` | `[NEW]` |

**Rules.** Icons carry meaning or they do not appear — no decorative icons beside headings. An icon-only button always has an `aria-label` and a tooltip. The icon for a concept is fixed across the whole product; `Lock` is reserved for gating, which is why Cyber's domain icon is `Radar` and not `Lock`.

## 19. Layout, containers and breakpoints

### 19.1 Containers

```tsx
// Marketing — homepage, /store, pricing, about
<div className="mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12" />

// Reading — question guidance, text blocks, legal pages
<article className="mx-auto w-full max-w-[68ch] px-5 sm:px-8" />

// Product — dashboard, learning, downloads, account
<main className="mx-auto w-full max-w-[1400px] px-5 sm:px-8" />

// Admin — tables need width
<main className="mx-auto w-full max-w-[1600px] px-4 sm:px-6" />

// Focused — auth, checkout handoff, single-purpose forms
<div className="mx-auto w-full max-w-md px-5" />
```

### 19.2 Grid

| Content | Columns |
|---|---|
| Question results | **1 always** — these are rows to scan, not tiles to browse |
| Course cards | 1 / 2 / 3 |
| Template cards | 1 / 2 / 3 |
| **Store — reference packs** `[NEW]` | 1 / 2 / 3 |
| Pricing | 1 / 3 (**never 2** — an even split has no visual centre) |
| Dashboard modules | 1 / 2, with "Continue" full-width |
| Discovery page | `lg:grid-cols-[280px_1fr]` — filter rail + results |
| Learning | `lg:grid-cols-[320px_1fr]` — course outline + lesson |
| **Lesson blocks** `[NEW]` | Single column. Text at 68ch; video and file break out to the full column |

### 19.3 Breakpoints

Tailwind defaults. Do not invent custom breakpoints without evidence from a real layout failure.

```
base   < 640px   phone
sm     640px+    large phone / small tablet
md     768px+    tablet
lg     1024px+   desktop — sidebars appear here
xl     1280px+   wide desktop
2xl    1536px+   containers stop growing
```

**Test widths:** 375 · 390 · 430 · 768 · 1024 · 1280 · 1440 · and 200% zoom with no clipping.

### 19.4 Sticky behaviour

| Element | Behaviour |
|---|---|
| Public header | Sticky; `shadow-sm` appears after 8px of scroll |
| Filter rail (desktop) | `sticky top-20`, independently scrollable, `max-h-[calc(100vh-6rem)]` |
| Course outline (desktop) | Same pattern |
| Mobile filter button | Fixed bottom-right, above the safe area, showing the active count |
| Mobile lesson nav | Sticky bottom bar, respects `env(safe-area-inset-bottom)` |
| Buy button on a product page | Sticky bottom bar below 640px; inline on desktop |
| **Autosave indicator** `[NEW]` | Sticky in the admin editor header, never a floating toast that covers a field |

### 19.5 The member rail is a stage plane `[CHANGED 2026-08-13 — owner direction]`

The member sidebar now stands on `--stage` and carries the same aurora as the hero, the auth panel and the footer, via a rail-tuned modifier:

```css
.stage-aurora--rail { --aurora-opacity: 0.42; --aurora-core: 50% 128%; }
.stage-aurora--rail::after { content: none; }   /* filaments are a wide-canvas device */
```

**The rail is the hardest shape the aurora has been asked to fill.** It is ~256px wide and a full viewport tall with content running edge to edge — the hero and auth panel both keep copy in a column that leaves the bright corner empty, and the footer at least has its bright corner at the *end* of its content. A rail has no empty corner: the account row sits exactly where the default class puts `glow-3`. Hence the core pushed off-canvas *below* the rail, re-centred horizontally (an off-centre bloom in a narrow column reads as a lighting error), and dimmed harder than the footer's.

**This is a plane change, not a colour tweak, and that is the part that matters for anything built this week.** The rail is now dark in *both* themes, so every child moved to `stage` tokens in the same pass — nav labels, the account row, the theme toggle, the dividers, and the brand mark, which was `bg-sidebar-primary` (midnight navy) and would have rendered an invisible navy square on navy in the light theme. That is §12.6's inversion trap, and it is exactly the footer-mark defect `DESIGN.md` §7.6 records.

Nav is now grouped under three mono-uppercase section headings — **Your work · Browse · Manage** — rather than run as one flat list of five. The split is the one My Library already exists to make: what you own, versus what you could.

> **`[UNVERIFIED]`** The rail aurora's numbers are reasoned, not sampled. Per §12.5, sample the nav labels (80% opacity) and the account row (70%) from the rendered page in both themes before treating this as audited. **This is an open item on the Phase 6 QA sweep.**

## 20. Component specifications

Every component here ships against §34.1's nine-point Definition of Done: all six interaction states, empty and error where reachable, correct at 375px and 1440px, keyboard-operable, semantic tokens only, both themes, survives the stress fixtures, no `console.log` / bare `any` / unnamed `TODO`, props documented.

### 20.0 Reuse before you build `[ADDED v2.1, DESIGN.md §33.3]`

Five marketing devices already exist, extracted from the reference blocks the marketing surfaces were rebuilt on. **Check this list before writing a new component this week** — three of them are directly usable by `/store` and the pack page.

| Existing component | Use it this week for |
|---|---|
| `StatusDot` | The pulsing dot + label opening each `/store` section, if a section wants one |
| `CornerFrame` | The bracketed corner rule — a candidate for the pack page's honesty notice |
| `NewsletterForm` | Already posts to the real `/leads`; the store's free-entry-point block should reuse it, not re-implement lead capture |
| `TypewriterTitle` | Marketing headlines only. **Not** on `/store` — a store is an index, and an animating headline on an index delays the scan |
| `AuthField` | Auth screens only |

> **`StatusDot` carries a trap worth repeating.** It originally pinned `text-foreground` for its label — near-black espresso, invisible on the dark plane — and its `gold` tone used `--gold-strong`, the *text-safe* shade, which is likewise near-invisible as a decorative dot on navy. The label now inherits its colour and the dot takes an explicit **`on="stage"`** prop. **A shared component cannot pin a foreground token, because it does not know which plane it is standing on** — the same §12.6 rule in a different costume. Any component written this week that could appear on both planes must take the plane as a prop rather than guess.

---

### 20.1 `StorePage` and `StoreSection` `[NEW]`

**Route:** `/store` · **Layout:** marketing container, `max-w-7xl` · **Wash:** `.page-wash` at `h-[30rem]`

```
┌──────────────────────────────────────────────────────────────┐
│  ── STORE                                                    │  eyebrow, mono 12px
│  Everything, in the shape you need it                        │  h1, sans
│  Look something up, learn a domain, or take one file          │  lead, serif 19px
│                                                              │
│  ── REFERENCE PACKS ────────────────────────────────────     │  h2 + hairline
│  Look something up. All 100 questions are free to read;      │  text-sm muted
│  a pack is the formatted artefact and the working order.     │
│  [ pack card ] [ pack card ] [ pack card ]                   │  grid 1/2/3, gap 16/24
│                                                              │  ↕ 64px / 96px
│  ── COURSES ───────────────────────────────────────────      │
│  Learn a domain properly — modules, lessons, progress.       │
│  [ course card ] [ course card ]                             │
│                                                              │
│  ── TEMPLATES ─────────────────────────────────────────      │
│  One thing you need right now. Preview it, buy it, use it.   │
│  [ free template ] [ paid template ]                         │
└──────────────────────────────────────────────────────────────┘
```

**Order is fixed** — Reference packs · Courses · Templates, the product spec's own order. **Not a merged grid:** the three types must not be flattened, and a store that renders them identically teaches the visitor they are the same thing.

| Element | Spec |
|---|---|
| Page eyebrow | `.eyebrow`, `STORE`, rule colour `--accent` |
| Page title | `text-h1`, sans, `--foreground`. **No gradient** — save it for the homepage |
| Page lead | `text-lead`, serif, `--muted-foreground`, `max-w-[52ch]` |
| Section heading | `text-h2`, sans, `--foreground`, with a `border-t border-border` above at 24px |
| Section explainer | `text-sm`, sans, `--muted-foreground`, `max-w-[60ch]`, 8px below the heading |
| Section gap | 64px mobile · 96px desktop |
| Card grid gap | 16px mobile · 24px desktop |
| Section entrance | Stagger, first 6 cards, `duration 0.22`, `delay min(i,6)*0.03` |

**Sections are not cards** (§36). A heading, an explainer, a hairline rule and spacing is the whole treatment. The products inside them are cards, because a product is a real boundary with its own identity, state and primary action.

**Honest empty sections.** If a type has nothing purchasable, say so plainly and link to the free thing:

```
Reference packs

Look something up. All 100 questions are free to read; a pack is the
formatted artefact and the working order.

No packs are on sale yet.
The 100 questions are free to read in the meantime.

[Browse the questions]
```

**Never a "coming soon" tile that looks like a product.** A greyed card with a price and a disabled button is padding a section with something invented — the exact thing §49.1 forbids.

---

### 20.2 `ContentTypeCard` — three variants `[NEW]`

One component, three variants, because the three types must read as related but distinct.

| | Reference pack | Course | Template |
|---|---|---|---|
| Eyebrow | `REFERENCE PACK` | `COURSE` | `TEMPLATE` |
| Icon | `Library` 18px | `BookOpen` 18px | `FileDown` 18px |
| Icon tile | Domain colour @12% | Domain colour @12% | `--gold-soft` |
| Title | `text-h3` sans | `text-h3` sans | `text-h3` sans |
| Sub-line | `24 questions · PDF · 38 pages` | `2 modules · 3 lessons · 24 min` | `XLSX · 12 pages · 240 KB` |
| Meta face | Sans, `text-sm`, `--muted-foreground` | Sans, `text-sm` | Sans, `text-sm` |
| Price | `A$99` sans, `tabular-nums`, `text-h4` | `A$49` | `A$39` or `Free` |
| Primary action | `Buy the pack` | `See what's included` | `Buy the template` / `Download the template` |
| Owned state | `CircleCheck` + `In your library` | `Continue — 45%` | `Download again` |

**Card shell, all variants**

```
border border-border · rounded-lg (8px) · bg-card
padding 20px mobile / 24px tablet+
hover: translateY(-2px) + shadow-sm, 160ms — no scale
the whole card is ONE link — never a card with a separate link inside it
```

Every card answers three questions in this order: **what is this, why should I care, what can I do.** If it cannot answer all three it is a list item, not a card.

**Price formatting:** always visible, always with currency, always `tabular-nums`. `A$99`, never `99`, and never `$0.00`. Free is the word `Free`, not `A$0`.

---

### 20.3 Lesson blocks `[NEW]`

Four block types, rendered in `sort_order` into one flowing view. **Gap between blocks: 32px mobile · 40px desktop.**

#### `TextBlock`

```
font-family : var(--font-serif)     Source Serif 4
font-size   : var(--text-read)      18px
line-height : 1.7
measure     : max-w-[68ch]
colour      : var(--foreground)
rhythm      : .prose-guidance — 1em between paragraphs, 2em above a heading, 0.5em below
```

An optional `h3` heading in **sans**, `text-h3`, sits above the serif body. The face change is the signal that one is structure and the other is the author's prose.

#### `VideoBlock`

```
aspect-ratio : 16 / 9              reserved BEFORE the player mounts — no layout shift
radius       : rounded-xl (12px)
background   : black, both themes
width        : full column on desktop; FULL-BLEED below 640px
captions     : ON by default
```

Breaks out wider than the 68ch text measure — a video constrained to reading width looks like an afterthought. Loading is a poster frame plus a centred spinner. Error state per §20.9. Each video block mints **its own** playback token, on demand, after the lesson-level entitlement check has already passed.

#### `FileBlock`

The §26.4 download state machine, inline:

```
┌────────────────────────────────────────────────┐
│  📄  Supplier Register Template                │  text-h4, sans
│      XLSX · 12 pages · 240 KB                  │  text-sm, muted, mono for the size
│                                    [Download]  │  primary, sm
└────────────────────────────────────────────────┘
border border-border · rounded-lg · bg-muted/40 · padding 16px/20px
```

**Always state format and size.** A risk manager on a corporate laptop needs to know it is an XLSX before they click, and "12 pages" is the difference between a checklist and a token.

#### `CalloutBlock`

```
border-left  : 3px solid var(--gold)      decorative — the ONE place --gold is correct
background   : var(--gold-soft)
padding      : 16px 20px
radius       : rounded-lg, but rounded-l-none so the rule reads as a rule
title        : text-h4, sans, --gold-strong        ← strong, because it is TEXT
body         : text-body, sans, --foreground
icon         : Info, 18px, --gold-strong
```

The single clearest illustration of the gold rule: the **rule** is `--gold` because it is decoration; the **title** is `--gold-strong` because it is text.

---

### 20.4 `DownloadButton` — the state machine

Used by `FileBlock`, template pages and pack pages.

| State | Label | Visual |
|---|---|---|
| Idle | `Download the checklist` | `primary`, `sm` or `default` |
| Pressed | `Preparing…` | Disabled, **width held**, spinner 16px + the word |
| Success | `Downloaded ✓` | `success` tint, 4 seconds |
| Returned | `Download again` | Back to `primary` |
| Expired | `That link expired. Press download again.` | Inline `text-sm` under the button, **not a toast** |

**Never render the presigned URL as a visible `href`.** It is valid for 60 seconds and single-use: fetch it on click, use it immediately, discard it. A URL the user can right-click and save is a URL that will fail later and look broken.

Re-downloading is always allowed for an entitled user, **with no limit and no counter.** A download cap on a professional template is a support-ticket generator.

---

### 20.5 Discovery — two zones, `MatchBadge`, `ResultCount`, `ZeroResults` `[NEW]`

#### `ResultCount`

```
12 exact  ·  +9 close
```

`text-sm` · sans · `tabular-nums` · `--muted-foreground`, with the numerals in `--foreground` at weight 600. Updates on **every** chip and checkbox tap with no round trip and no animation. Search input debounced 250ms; **filter taps never debounced** — a tap that does not recount immediately feels broken.

`aria-live="polite"` so a screen-reader user hears the recount.

#### Two-zone results

```
┌──────────────────────────────────────────────────┐
│  4 exact matches                                 │  text-sm, 600, --foreground
│  ────────────────────────────────────────────    │  border-t border-border-strong
│  [ QuestionRow ]                                 │
│  [ QuestionRow ]                                 │
│                                        ↕ 32px    │
│  7 close matches                                 │  text-sm, 600
│  Relax one filter to see these as exact          │  text-xs, --muted-foreground
│  ────────────────────────────────────────────    │  border-t border-border
│  [ QuestionRow  · Duration: 3–6 months ]         │
│  [ QuestionRow  · Cost: medium ]                 │
│  [ Show all 7 close matches ]                    │  ghost button
└──────────────────────────────────────────────────┘
```

**Close rows differ from exact rows in exactly two ways:**

1. `border-border` on the left rule instead of `border-border-strong`
2. A `MatchBadge` naming the dimension that missed and its actual value

**Nothing else.** Text opacity is never reduced — that would be a contrast failure and would make a perfectly good answer look broken.

#### `MatchBadge`

```
variant     : secondary
face        : sans, text-xs (12px), weight 500
padding     : 4px 8px
radius      : rounded-sm (4px)
colour      : --secondary-foreground on --secondary
icon        : NONE
content     : "Duration: 3–6 months"  — the dimension label, a colon, the actual value
```

**Informational, not an error.** It does not use `--destructive`, does not carry a warning icon, and does not appear on exact rows. It says *what this question actually is*, not *what is wrong with it*.

#### `ZeroResults`

```
No questions match all four filters.

The tightest constraint is Duration: under 2 weeks —
only 6 of 100 questions are that fast.

[Relax Duration]  [Relax Regulator pressure]  [Clear all]
```

**The suggested relaxations are computed, not hard-coded.** Rank the active filters by how few questions each one alone admits; offer the two most restrictive. This turns a dead end into a two-tap recovery and teaches the user how the taxonomy behaves.

| Element | Spec |
|---|---|
| Headline | `text-h3`, sans, `--foreground` |
| Explanation | `text-body`, sans, `--muted-foreground`, `max-w-[52ch]` |
| The count in the explanation | `tabular-nums` |
| Relax buttons | `outline`, `sm` — real alternatives, so not `ghost` |
| Clear all | `ghost`, `sm` |
| Container | Centred, 48px vertical padding, `border border-dashed border-border`, `rounded-lg` |

**Never a blank region. Never an illustration with no action.**

---

### 20.6 Pack product page `[NEW]`

Per RS 4.2 — long descriptions and multiple previews correlate strongly with sales, so this is a real page, not a card blown up.

```
── REFERENCE PACK
Risk (Enterprise & op.) — the working pack          h1, sans

[ lead, serif 19px ]
What this pack is, in the author's words. 400+ words, not 40.

⚠ The 24 questions in this pack are free to read on this site.
  What you are buying is the formatted artefact and the working order.

[ preview image ] [ preview image ]

What's inside          — the 24 questions, listed and linked
Who it's for           — and who it is not for
Format                 PDF · 38 pages · 2.1 MB
Licence                [OWNER]

A$99                                        [Buy the pack]
```

**The honesty notice is not optional, and it is not fine print.** It sits above the previews, in `text-body` on a `--gold-soft` surface with a `--gold` left rule — the callout treatment. Selling a "pack" that a visitor discovers is free on the site is the fastest possible way to lose the trust the whole catalogue depends on.

Mobile: the buy button becomes a sticky bottom bar below 640px, respecting `env(safe-area-inset-bottom)`.

---

### 20.7 Legal pages `[NEW]`

**Routes:** `/legal/terms`, `/legal/privacy`, `/legal/refunds` · **Container:** `max-w-[68ch]` reading container · **Body:** serif `text-read` 18px / 1.7

#### The draft banner — required on all three

```
┌────────────────────────────────────────────────────────┐
│  ⚠  DRAFT — FOR REVIEW                                 │
│     This page has not been reviewed by a lawyer and    │
│     is not published on the author's authority.        │
└────────────────────────────────────────────────────────┘
```

| Element | Spec |
|---|---|
| Surface | `--warning` @ 10% via `color-mix`, `border border-warning`, `rounded-lg` |
| Label | `.eyebrow` style, `--warning`, uppercase, mono 12px, tracking 0.16em |
| Body | `text-sm`, sans, `--foreground` |
| Padding | 16px mobile · 20px desktop |
| Placement | Directly under the `h1`, above the first paragraph. **Never in the footer of the page** |
| Motion | None |

**Not `--destructive`.** The page is not broken and the reader has done nothing wrong — it is provisional, which is exactly what `--warning` means in this system.

#### Content requirements

| Page | Must cover | Source |
|---|---|---|
| `/legal/terms` | A licence to use, not a transfer of IP · one-time purchase, lifetime access · no redistribution of templates or course material · account termination · limitation of liability · governing law · **the contracting entity** `[OWNER]` | RS 11.1 |
| `/legal/privacy` | What is collected (email, name, purchase history, lesson progress, lead captures) · why · **every sub-processor named** (Supabase, Stripe, Mux, Cloudflare R2, the email transport, PostHog, Vercel, Render) · retention per RS 7.6's table · access/correction/deletion route · Australian Privacy Act 1988 · GDPR readiness | RS 11.2 |
| `/legal/refunds` | The ACL statutory guarantees, stated as applying **independently of this policy** · the major-failure refund pathway · the change-of-mind position stated as company policy **on top of** the guarantees, never as a substitute · plain language, no boilerplate | RS 11.3 |

**RS 11.3 is explicit:** "no refunds", "all sales final" and "store credit only" are themselves misleading conduct under the ACL and were tested in *ACCC v Valve*. A clause purporting to exclude a statutory guarantee is void **and** risks being read as further misleading conduct. The refund page cannot say any of those things.

---

### 20.8 Admin — autosave, orders, manual grant `[NEW]`

#### `AutosaveIndicator`

```
✓ Saved 14:22        idle, after a successful save
  Saving…            in flight
⚠ Not saved — retrying          on failure
```

| Element | Spec |
|---|---|
| Placement | Sticky in the editor header. **Never a floating toast that covers a field** |
| Face | `text-sm` sans for the word; **mono for the timestamp** — it is data |
| Colour | `--muted-foreground` idle · `--success` for the tick · `--warning` on retry |
| Icon | `Check` 14px · none while saving · `AlertTriangle` 14px on failure |
| Cadence | Every 20 seconds, and on blur of any field |
| Motion | 150ms fade in · 2s hold · 300ms fade out |

Losing 40 minutes of typed guidance is the fastest way to lose an author's willingness to use the tool. This is the highest-value gap in §31.8.

#### Inline validation

Validate **on blur**, revalidate on change once a field has errored. Never on every keystroke of a field the user has not left. **Never clear a valid field because a different field failed.** Error message directly under the field, with an icon, `aria-describedby` wired and `aria-invalid` set.

Errors say what to do: *"This slug is already used by* How should risk appetite be reviewed? *Try adding the domain."* — not "Constraint violation".

#### `/admin/orders`

```
Date         Customer            Product                    Amount   Stripe ref        Entitlement
2026-08-12   sarah@example.com   Risk Register Fundamentals  A$49    cs_test_a1B2c3…   ✓ Granted
2026-08-11   long.name@…         Vendor Risk Scorecard       A$39    cs_test_d4E5f6…   ⚠ Missing  [Grant]
```

| Column | Face |
|---|---|
| Date | Mono, `text-sm` |
| Customer email | Sans, `text-sm`, truncated with a `title` attribute |
| Product | Sans, `text-sm` |
| Amount | Sans, `text-sm`, **`tabular-nums`**, right-aligned, always with currency |
| Stripe reference | **Mono**, `text-xs`, copyable on click with a `Copied` confirmation |
| Entitlement | Badge — `success` "Granted" / `warning` "Missing" |

Table container `rounded-lg border border-border`; cells `rounded-sm`. Row height 44px minimum (touch target). Sticky header row. CSV export as a `ghost` button above the table.

#### `ManualGrantDialog`

```
Grant an entitlement manually

Customer      sarah@example.com          (read-only)
Product       Risk Register Fundamentals (read-only)
Reason *      [                                    ]   required
              Why this grant is being made. Recorded in the audit log
              with your name and the time.

              [Cancel]  [Grant the entitlement]
```

**The reason field is required and is not a formality.** It is written to `audit_log` with actor, action, target and timestamp. This is the escape hatch for the payment that succeeded while the webhook failed — a risk already on the watchlist with no mitigation built. `BACKEND.md` §1.5: this is the difference between "we think the webhook fired" and knowing.

Dialog `shadow-lg`, `rounded-lg`, `max-w-md`, focus trapped, focus returned to the triggering row on close.

---

### 20.9 The four states, per new surface

#### Empty

Every collection has one. It names what would be here and gives the single action that puts something here.

| Surface | Copy |
|---|---|
| `/store` section | `No packs are on sale yet.` / `The 100 questions are free to read in the meantime.` / `[Browse the questions]` |
| Zero filter results | §20.5's `ZeroResults` |
| `/admin/orders` | `No orders yet.` / `Orders appear here as soon as someone buys something.` |
| A lesson with no blocks | Admin-only; the publish guard prevents this reaching a learner |

#### Loading

Skeletons for content-shaped things, **matching the real layout's dimensions** so nothing shifts when data arrives.

```tsx
<div className="space-y-4">
  {Array.from({ length: 6 }).map((_, i) => (
    <div key={i} className="rounded-lg border border-border p-5">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-6 w-3/4" />
      <Skeleton className="mt-2 h-4 w-full" />
      <Skeleton className="mt-4 h-6 w-48" />
    </div>
  ))}
</div>
```

**Delay rule: if a load resolves in under 200ms, show nothing.** A skeleton that flashes for 80ms is worse than no skeleton. Spinners only inside buttons and for genuinely indeterminate waits.

#### Error

Three things, in order: what failed, whether the user must act, what to try.

```
We couldn't load these questions.

[Try again]      If this keeps happening, [contact us].
```

Errors are **inline and scoped to what failed.** A failed video block does not take down the reading blocks around it — every async region has its own boundary. This matters more with blocks than it did with rigid lesson types, because one lesson now contains several independently-failing regions.

Errors explain and instruct; they do not apologise. *"Payment wasn't completed. Your card has not been charged."* — never "Oops! Something went wrong."

#### Locked

Locked is not broken and is not an error. `muted` surface, dashed border, `Lock` icon, the name of what would unlock it, and its price.

```
🔒 Escalation and exit

Part of Risk Register Fundamentals
A$49 · lifetime access

[See what's included]
```

**Never grey out the title.** The user must be able to read *what they are missing* clearly — that is the entire persuasive mechanism.

#### Access denied (direct URL)

```
This lesson is part of a course you don't have yet.

Risk Register Fundamentals — A$49

[See what's included]   Already bought it? [Sign in]
```

Never a bare 403. Never a redirect to the homepage — that loses the user's intent.

## 21. Responsive specification

| Surface | 375px | 768px | 1024px+ |
|---|---|---|---|
| `/store` | 1 column per section; 20px page padding; sections 64px apart | 2 columns; 32px padding | 3 columns; 48px padding; sections 96px apart |
| Discovery | Filter sheet behind a fixed bottom-right button showing the active count; results full width | Same as 375 | `lg:grid-cols-[280px_1fr]` — rail appears, sticky at `top-20` |
| Two-zone results | Zone headings full width; `MatchBadge` wraps to a second line below 380px | — | — |
| Lesson blocks | Video **full-bleed**; text at page padding; file block full width; nav sticky bottom | Video within the column | Text 68ch; video breaks out to full column width |
| Pack page | Buy button **sticky bottom bar**; previews stack | Previews side by side | Two-column: content + a sticky buy panel |
| Legal | 68ch container, 20px padding | 32px padding | Unchanged — a document does not need a wide layout |
| `/admin/orders` | **Horizontally scrollable table** inside its own `overflow-x-auto` container; the page body never scrolls sideways | Same | Full table, sticky header |

**Mobile rules that are not negotiable:** minimum touch target 44×44px regardless of visual size — pad the hit area, do not inflate the button. Most people will meet this on a phone, **including the checkout and the video player.**

## 22. Accessibility specification

| Requirement | How it is met this week |
|---|---|
| Contrast | Every pair in §12.5 measured, not eyeballed. AA (4.5:1 text, 3:1 non-text) |
| Focus | **One** `:focus-visible` style, globally: 2px `--ring` outline, 2px offset, 4px radius. No per-component focus styles |
| Keyboard | Every filter chip, zone toggle, block action, order row and dialog reachable and operable. The manual-grant dialog traps focus and returns it |
| Target size | 44×44px minimum (WCAG 2.2 §2.5.8) |
| Live regions | `ResultCount` is `aria-live="polite"`; the autosave indicator is `aria-live="polite"`; error summaries announce the error count |
| Route changes | Announced on SPA navigation — `/store` and the three legal routes included |
| Captions | On by default on every video block |
| Colour alone | Never. Every badge carries a word; every status carries an icon or a word |
| Forms | Labels above fields, always visible. No placeholder-as-label. Required marked with `*` **and** the word "required" in the accessible name. Autocomplete attributes on every real-world field |
| Reduced motion | `<MotionConfig reducedMotion="user">` plus the CSS backstop. Transitions become instant, never absent |
| axe | Clean on `/`, `/questions`, `/questions/:slug`, `/courses`, `/templates`, `/contact`, `/store`, `/legal/terms`, `/legal/privacy`, `/legal/refunds` — **in CI**, from Phase 1 |

## 23. Copy deck

Voice rules in force: sentence case everywhere · buttons say what happens · no filler (`simply`, `just`, `easily`, `seamlessly`, `unlock`, `empower`) · errors explain and instruct without apologising · prices always visible and always formatted with currency.

| Surface | String |
|---|---|
| `/store` title | `Everything, in the shape you need it` |
| `/store` lead | `Look something up, learn a domain properly, or take the one file you need today.` |
| Reference packs explainer | `Look something up. All 100 questions are free to read; a pack is the formatted artefact and the working order.` |
| Courses explainer | `Learn a domain properly — modules, lessons, and a progress bar that remembers where you stopped.` |
| Templates explainer | `One thing you need right now. Preview it, buy it, use it this week.` |
| Pack honesty notice | `The 24 questions in this pack are free to read on this site. What you're buying is the formatted artefact and the working order.` |
| Empty pack section | `No packs are on sale yet.` / `The 100 questions are free to read in the meantime.` |
| Close-match zone heading | `7 close matches` |
| Close-match zone sub | `Relax one filter to see these as exact` |
| Zero results | `No questions match all four filters.` |
| Zero results explanation | `The tightest constraint is Duration: under 2 weeks — only 6 of 100 questions are that fast.` |
| Relax button | `Relax Duration` |
| Download idle | `Download the checklist` |
| Download in flight | `Preparing…` |
| Download expired | `That link expired. Press download again.` |
| Autosave | `Saved 14:22` |
| Autosave failed | `Not saved — retrying` |
| Manual grant | `Grant the entitlement` |
| Manual grant helper | `Why this grant is being made. Recorded in the audit log with your name and the time.` |
| Draft banner | `DRAFT — FOR REVIEW` / `This page has not been reviewed by a lawyer and is not published on the author's authority.` |
| Locked lesson | `Part of Risk Register Fundamentals` / `A$49 · lifetime access` / `[See what's included]` |
| Access denied | `This lesson is part of a course you don't have yet.` |
| Video error | `We couldn't load this video.` / `Check your connection and try again.` |
| Session expired mid-video | `Your session timed out.` / `[Sign in and continue from 12:34]` |

**Banned words in this product:** `unlock` (except the email gate's `Unlock the rest`, which is literal), `enroll`, `get instant access`, `revolutionise`, `seamless`, `Learn more` as a bare button label.

---

# PART III — IMPLEMENTATION PLAN

## Phase 0 — Day 0 (half day): Restore ground truth

> **Objective:** make the system verifiable again before building on it. Nothing in Phases 1–6 can be trusted while there is no account, no purchase and no working first-choice email transport.

**Why this is Phase 0 and not "admin":** the intentional wipe of 2026-08-12 removed the buyer, order, entitlement and audit rows that Week 1's Definition of Done cites as evidence. The code paths are unchanged, but **the proof is gone.** Rebuilding it takes an hour and everything downstream depends on it.

### Steps

1. **`[REWRITTEN 2026-08-14 — decision #14 superseded]`** Verify a sending domain with Resend (`docs/email.md`'s domain options), point `_send_via_resend`'s `SANDBOX_SENDER` at a verified `from` address, **restart the backend**, then send a real receipt to an address that is not `OWNER_NOTIFICATION_EMAIL` and confirm it lands with no `[Not delivered to buyer]` prefix. Until this is done, `email_service.py`'s own docstring is the standing proof that no real customer can be emailed.
2. **Recreate an account and grant admin.** Sign up in the app, then `.venv\Scripts\python.exe scripts/grant_admin.py <email>`. Confirm `/admin` loads and the sidebar shows *Content editor*.
   *Role escalation stays outside the UI deliberately:* `grant_admin.py` requires `DATABASE_URL`, i.e. whoever runs it already has full database access. "Any signed-in user can make themselves an admin" is not a bootstrap, it is a hole.
3. **Run one real purchase** of Risk Register Fundamentals (A$49 — the A$29 product is unpublished). Confirm **by querying the database, not by trusting the UI**:
   ```sql
   SELECT o.id, o.amount, o.currency, e.granted_via, a.action, a.created_at
   FROM orders o
   JOIN entitlements e ON e.user_id = o.user_id
   JOIN audit_log a ON a.target_id = e.id
   WHERE o.user_id = :uid;
   ```
   Expect an `orders` row, an `entitlements` row with `granted_via='purchase'`, an `audit_log` row, and a receipt that arrived **from the first-choice transport**.
4. **Walk the whole path on a phone** — the last unchecked box in `week1_plan.md`. Sign-up, question, course, checkout, download, at 375px on a real device. Note every place it feels wrong; those notes feed **Week 4's** polish list, not this week's.
5. **Close Week 1** with a written go/no-go.

### Definition of Done

- [ ] A receipt has arrived via the first-choice transport, to an address that is not the sender. — *Not unverifiable — **falsified by the code.** `email_service.py`'s docstring: "NO REAL CUSTOMER RECEIVES ANY EMAIL — every send is redirected to the owner's inbox." The sandbox sender structurally cannot reach any other address. Resend is the settled transport (superseding decision #14); a verified sending domain is the remaining blocker*
- [~] A real `orders` + `entitlements` + `audit_log` triple exists, from a real checkout. — *`[UNVERIFIABLE]` — this is a database claim, not a code one*
- [~] `/admin` is reachable by a real admin account. — *`[UNVERIFIABLE]`*
- [ ] The mobile walkthrough is done; Week 1's DoD reads 12/12. — *`week1_plan.md:181` and `:390` are still unticked*
- [ ] Week 1 is formally closed. — *`week1_plan.md:393–394` are still unticked*

> **Do not proceed to Phase 1 if the purchase path does not complete.** Phase 1 writes tests asserting its behaviour; writing them against a broken path bakes the break into the suite.

---

## Phase 1 — Day 1: The gating suite `[the week's non-negotiable]`

> **Objective:** "paid content is genuinely inaccessible" becomes a command anyone can run, not a story about a `curl` someone ran once.

### Steps

**1. Install the test stack.** None of this exists today.

```
# backend/requirements-dev.txt  (new)
pytest==8.3.3
pytest-asyncio==0.24.0
httpx==0.27.2          # ASGI transport — tests hit the real app with no live server
```

```bash
# frontend
npm i -D vitest @testing-library/react @testing-library/user-event jsdom \
         @playwright/test @axe-core/playwright
```

Add to `frontend/package.json`:
```json
"test": "vitest run",
"test:watch": "vitest",
"e2e": "playwright test"
```

**2. Build the fixtures as code, not as hand-made rows.** Four actors: a signed-out client, a signed-in-but-unentitled user, an entitled user, and an admin. Seed and tear down **inside the test transaction** — a suite that leaves rows behind will drift and start lying.

> **Auth note.** JWTs are ES256 via Supabase JWKS and cannot be minted locally. Two options, and the answer is *both*: inject a `verify_jwt` dependency override in the FastAPI app for unit and integration tests, and use **real sign-ins** for the Playwright pass — so at least one layer exercises the real token path.

```python
# backend/tests/conftest.py
@pytest.fixture
async def client_anon() -> AsyncClient: ...
@pytest.fixture
async def client_member() -> AsyncClient:        # signed in, no entitlements
@pytest.fixture
async def client_entitled() -> AsyncClient:      # holds the course product
@pytest.fixture
async def client_admin() -> AsyncClient:
```

**3. Write the 10 §58.2 cases, in order.** See Part IV for the full table with assertions.

**4. Add the free-template case** — new since §58.2 was written. `templates.is_free = true` must serve with no auth; `is_free = false` must 401 anonymously and 403 for a signed-in non-owner. This is the newest gating surface and the one with no test history at all.

**5. Add the entitlement-shape regression test.** The template/course split bug (`db/seed/012`) was a **catalogue** defect the engine could not catch: assert that holding the template product grants the template and **not** any lesson, and that holding the course grants both. This is the test that would have caught a bug that reached production.

**6. Close the admin-bypass audit gap.** `entitlements.py:83` carries `# TODO: no admin bypass without an audit row`. `BACKEND.md` §4.3 lists this under **Never**. Write the audit row, and a test asserting an admin's gated access produces one.

```python
if user.role == Role.ADMIN:
    await audit_service.record(
        actor_id=user.id, action="admin_access_bypass",
        target_type=resource_type.value, target_id=resource_id, session=session,
    )
    return resource_id
```

**7. Prove each test can fail.** Comment out the check it guards, watch it go red, restore it. **Record the list in the PR description** — Non-negotiable #9.

**8. Wire it into CI** (GitHub Actions): backend suite, frontend unit suite, Playwright, and axe on every public route. Fail the build on any red.

### Definition of Done

- [x] `pytest`, `npm run test` and `npx playwright test` all exist and pass. — *`requirements-dev.txt`, `package.json`'s `test`/`e2e` scripts, `playwright.config.ts`*
- [x] All 10 §58.2 cases plus free-template and entitlement-shape implemented. — *`backend/tests/gating/test_gating.py` (cases 1–8, 10–13) + `frontend/tests/e2e/gating.spec.ts` (case 9), plus the webhook-idempotency assertion of §26*
- [x] **Every test observed failing when its protection was removed; the list is in the PR.** — *non-negotiable #9, closed 2026-08-14. See [`gating_seen_red.md`](gating_seen_red.md)*
- [x] The admin bypass writes an audit row and a test asserts it. — *`entitlements.py:85,117` via `record_admin_bypass`; `test_admin_bypass_writes_an_audit_row`. The `# TODO` at the old line 83 is gone*
- [x] CI runs the whole thing on push and blocks a red build. — *`.github/workflows/ci.yml`, four blocking jobs plus a ≥25-test collection tripwire. **Green requires the Actions secrets to be set**, which the workflow's own header says has not happened*
- [~] axe reports no violations on the seven public routes (incl. `/contact`, built 2026-08-13). — *`accessibility.spec.ts` sweeps `/`, `/questions`, `/questions/:slug`, `/courses`, `/templates`, `/contact`. `/store` is missing because it does not exist yet (Phase 4)*

> **Do not proceed to Phase 2 if any gating case fails.** A failing case is a live vulnerability, not a failing test — **fix the system, never the assertion.**

---

## Phase 2 — Day 2: The course reader as content blocks

> **Objective:** Product Spec §7.2 — *"video sits within the reading wherever it's useful, rather than being a separate video-only step."* Today a lesson is one rigid type; "a paragraph, then a short video, then another paragraph" cannot be authored at all.

This is the largest remaining **architectural** gap and the only item this week that touches the data model.

### Steps

**1. Add the `lesson_blocks` table** — migration `009`. Deliberately a table, not a JSON column: blocks are ordered, individually addressable, and one of them points at a `templates` row — **a foreign key JSON cannot enforce.**

```
lesson_blocks
  id, lesson_id (FK), sort_order
  block_type   : 'text' | 'video' | 'file' | 'callout'
  text_body    : text,        null unless text/callout
  heading      : text,        null unless text/callout
  media_id     : FK → media,     null unless video
  template_id  : FK → templates, null unless file
  UNIQUE (lesson_id, sort_order)
```

**2. Keep `lessons.lesson_type` — do not drop it.** It becomes a *display hint* (which icon the outline shows), not the content contract. Dropping it would break the course outline, the library's readiness checks, `docs/handover.md`'s description of the syllabus, and §31.8's publish-guard logic, all in one migration.

**3. Backfill existing lessons into blocks, in the same migration.** A `reading` lesson becomes one `text` block from `lessons.body`; a `video` lesson becomes one `video` block from its `media` row; a `download` lesson becomes one `file` block from `download_template_id`.

> **Then verify all three existing lessons render identically to before** (Non-negotiable #11). Screenshot before, screenshot after, compare. This is live content someone has paid for.

**4. Update the lesson endpoints** to return ordered blocks. Entitlement is checked **once per lesson**, not per block — but each `video` block still mints its own short-lived Mux token and each `file` block its own 60-second presigned URL, on demand. `BACKEND.md` §4.1: **the check runs before the URL is minted.** A signed URL minted and then discarded on a failed check is a signed URL that existed, and existing is enough.

**5. Build the block renderer** in `Learn.tsx`, to §20.3's specification. Text at 68ch serif 18px/1.7; video breaks out wider and goes full-bleed below 640px; file is the §26.4 state machine inline; callout uses the gold rule. **32px gap mobile, 40px desktop.** Each block gets its own error boundary — one failing video must not take down the reading around it.

**6. Extend the admin lesson editor** to add, reorder and delete blocks. Reordering is **up/down buttons, not drag** — drag-and-drop is a day of work on its own, and §31.3's real requirement is that a non-developer can do it at all.

**7. Extend the publish guard** (§31.8): a lesson with zero blocks, a `video` block with no media, or a `file` block with no template cannot be published.

**8. Add gating case 11:** a logged-out or unentitled request returns no block content of any kind.

### Definition of Done

- [x] A lesson can be authored as text → video → text → file in the admin and reads as one flowing view. — *`BlockEditor` in `AdminCourses.tsx:115` (add / up-down / edit / delete); `LessonBlocks` in `Learn.tsx:235`*
- [x] **All three pre-existing lessons render exactly as before the migration.** — *non-negotiable #11, closed 2026-08-14 as a data-level parity check (a screenshot diff is no longer reconstructable post-migration — see the doc for why that's the stronger check anyway). See [`lesson_block_render_parity.md`](lesson_block_render_parity.md)*
- [x] Each video block plays via its own signed token; each file block downloads via its own presigned URL. — *`/lesson-blocks/{id}/playback-token` and `/lesson-blocks/{id}/download-url`, minted per block after one lesson-level check*
- [x] A logged-out or unentitled user gets no block content (case 11 passes). — *six case-11 tests in `test_gating.py:226–307`*
- [x] The publish guard refuses an incomplete lesson. — *`admin/courses.py:134` — zero blocks, an unattached video block or an unattached file block all fail `is_ready`*
- [~] Blocks render correctly at 375px and 1440px, in both themes. — *`[UNVERIFIABLE]` from the repository; a visual check, not an assertion*

> **Do not proceed to Phase 3 if existing lessons render differently than before.** Roll back the backfill and fix it.

---

## Phase 3 — Day 3: Discovery — scoring, two zones, recovery `[NEW]`

> **Objective:** `DESIGN.md` §19.2 — *"A strict `WHERE` across three constraints will return nothing, at exactly the moment the product is meant to prove itself. So the filter is a ranking, not a gate."*

Today `QuestionsCatalogue.tsx` filters with a strict `every()`. Three constraints return an empty page. The brief's one stated proof of value — *"what can I fix in a fortnight, cheaply, that my regulator cares about?"* — currently returns nothing.

### Steps

**1. Write `frontend/src/lib/scoring.ts` to §57.3.** The ordinal scales, from the live 100-question content — not generic low/medium/high placeholders:

```ts
const SCALES = {
  cost:                { low: 1, medium: 2, high: 3 },
  effort:              { quick: 1, moderate: 2, project: 3, transformation: 4 },
  regulator_pressure:  { none: 1, low: 2, moderate: 3, high: 4 },
  duration:            { under_2_weeks: 1, '2_6_weeks': 2, '6_12_weeks': 3,
                         '3_6_months': 4, over_6_months: 5 },
  roi_horizon:         { quick: 1, mid: 2, strategic: 3 },
}
```

Scoring: **2 points per exact match, 1 for adjacent, 0 beyond.**

> **The bug §57.2 corrects, and the one thing to get right here:** a question is **exact only when every active constraint matched exactly.** v1 counted a question as exact if its *score* cleared a threshold, which let a question with two exact matches and one adjacent miss into the exact zone. Read §57.3 before writing this, not after.

**2. Create the shared fixture** — `backend/tests/fixtures/scoring_cases.json`, consumed by **both** the pytest and the Vitest suites. Same inputs, same expected partition, both languages. Non-negotiable #10.

**3. Write `backend/app/services/question_service.py`** implementing the same rules, reading `ordinal_rank` from the `tag_values` rows rather than a Python enum — so the scale lives in the database and the owner still owns those lists.

**4. Split the questions API into two endpoints, deliberately:**

```
GET /sections/{slug}/questions/index   → the whole published index, cacheable, ~40 KB
GET /questions?<filters>               → server-side filtered + scored, authoritative
```

The index exists because §19.6 requires a result count that updates on every filter tap **without a round trip**. It carries `id, slug, title, preview, domain` and the seven tags — and **structurally cannot carry `body`**, because `QuestionIndexOut` has no such field. That is gating case 10.

**5. Return the explanation, not just the ranking.** The API returns `exact_count`, `close_count` and a `misses` array. **The client renders those rather than recomputing for display**; it recomputes only for the instant pre-response count. Two implementations of one rule is the limit — if a third consumer appears, delete the client one and accept the round trip.

**6. Build the two-zone results view** to §20.5: exact above, divider, close below with `MatchBadge`, `Show all N close matches`. Close rows differ in exactly two ways — the left rule and the badge. **Text opacity is never reduced.**

**7. Build `ResultCount`** — `12 exact · +9 close`, `tabular-nums`, `aria-live="polite"`, updating on every chip and checkbox tap with no round trip. Debounce the **search input** at 250ms; **never debounce a filter tap.**

**8. Build `ZeroResults` with computed relaxations.** Rank the active filters by how few questions each one alone admits; offer the two most restrictive. Hard-coding this defeats the point — it must teach the user how the taxonomy actually behaves.

**9. Keep the URL as the source of truth.** Filter state lives in the URL and is mirrored into Zustand, not the other way round. Back, refresh, share and bookmark all work for free. Returning from a question page restores the exact result list **and scroll position**.

**10. Add the parity test to CI** — both suites reading the same fixture, failing on any divergence.

### Definition of Done

- [x] `scoring.ts` and `question_service.py` implement §57.3, including the exact-match correction. — *`frontend/src/lib/scoring.ts` (262 lines) and `backend/app/services/question_service.py`*
- [x] Both consume `scoring_cases.json` and agree on every case. — *non-negotiable #10 held: `scoring.test.ts:15` imports `../../../backend/tests/fixtures/scoring_cases.json`; `test_question_service.py:24` reads the same path. Both suites run in CI*
- [x] Two zones render with a divider; close rows carry a `MatchBadge`; exact rows do not. — *`QuestionsCatalogue.tsx:156,413,431` — the left rule is the only other difference, opacity untouched*
- [x] The live count updates on every tap, in `tabular-nums`, with no round trip. — *`ResultCount` at `QuestionsCatalogue.tsx:123`, `aria-live="polite"`, computed client-side off the cached index*
- [x] Zero results offers two computed relaxations and a clear-all. — *`ZeroResults` at `:174`, fed by `rankRelaxationCandidates` — computed, not hard-coded*
- [x] **Any three-filter combination returns at least one ranked result.** — *structural: the strict `every()` is gone, scoring partitions rather than excludes*
- [x] The filter index response contains no `body` key (gating case 10 passes). — *`/questions/index` split out in `content/questions.py:198`; asserted against the serialised JSON, not the response model*
- [x] URL state survives back, refresh and share. — *`filtersFromSearchParams` at `:102`; the URL is the source of truth, mirrored into state rather than the reverse*

---

## Phase 4 — Day 4 (first half): The storefront and domain packs

> **Objective:** Product Spec §9's *"a storefront that clearly separates and labels the three content types"* and *"domain-based bundles as a purchasable unit."*

### Steps

1. **Build `/store`** to §20.1 — one page, three labelled sections in the product spec's order: **Reference packs · Courses · Templates**. Not a merged grid.
2. **Each section states its shape in one line** in the §6 voice (§23's copy deck). This is the sentence that stops a visitor asking "what's the difference?"
3. **Honest empty sections.** If a type has nothing purchasable, say so plainly and link to the free thing. **Never a "coming soon" tile that looks like a product.**
4. **Show the free entry points inside the store, not below it** — all 100 questions free, and the free template. The store's job is to make the free path obvious, because it is the top of the funnel.
5. **Build the domain-pack product type.** Architecturally this is already supported: a pack is a `product` whose `product_contents` rows are `content_type='question_set'` for that domain's questions plus a `template` row for the PDF artefact. **No new entitlement mechanism** (RS 5.6).
6. **Build the pack product page** to §20.6, including the honesty notice.
7. **Add the pack to My Library's Reference section** — it already renders `question_set` grants; the pack's PDF appears via its `template` grant, downloadable like any other.
8. **Update the marketing header** to point at `/store` alongside the individual catalogues — §17.1's five-item ceiling means **replace, don't append**.
9. **Extend the gating suite:** a pack's PDF is denied to a non-purchaser.

> **Blocked on `[OWNER]` decision #19.** Steps 1–4 and 8 ship regardless. Steps 5–7 build the mechanism; the SKU cannot be *published* without a real PDF. If the artefact is not ready, seed nothing and record the deferral — do not publish a pack whose download 404s.

### Definition of Done

> **`[PART]` — storefront shipped 2026-08-14; the domain-pack SKU is formally deferred**, per this section's own instruction ("if the artefact is not ready, seed nothing and record the deferral"). No PDF artefact exists (decision #19 unanswered), so nothing is seeded and no pack product/page/gating case exists — correctly, not by omission.

- [x] `/store` lists all three types, labelled, with a one-line explanation each. — `Store.tsx`, fixed order (Reference packs · Courses · Templates), each with its §23 copy-deck explainer line
- [x] Every price shown is real and matches `docs/pricing.md`; empty sections are honest. — Courses/Templates prices come straight off `Product.price_amount` (Courses' price is new — see §0.5); Reference packs renders the honest empty state, no invented tile
- [ ] One domain pack is purchasable end to end — checkout → webhook → entitlement → PDF downloads from My Library — **or** formally deferred with the reason recorded. — **Formally deferred**, reason recorded above and in the risk watchlist (§29)
- [ ] The pack's product page states plainly that the questions themselves are free. — N/A while deferred; no pack page exists to state it
- [ ] A pack's PDF is denied to a non-purchaser. — N/A while deferred; nothing to deny access to yet

> **Do not proceed if the store shows a price for anything that cannot actually be bought.**

---

## Phase 5 — Day 4 (second half): Legal cover and analytics

> **Objective:** two Product Spec §9 must-haves that are entirely absent. Neither is glamorous; the first is a launch blocker in Australia and the second is how Week 3's priorities get decided from evidence rather than instinct.

### Legal (RS 11.1–11.5)

1. **Terms of service** — a licence to use, not a transfer of IP; one-time purchase, lifetime access; no redistribution of templates or course material; account termination; limitation of liability; governing law; and the contracting entity from Week 1's decision #4.
2. **Privacy policy** — what is collected, why, retention per RS 7.6's table, the access/deletion route, and **every sub-processor named.** A privacy policy that omits them is inaccurate the day it ships.
3. **Refund policy** — per decision #17 and RS 11.3. A blanket "no refunds" is not available under Australian Consumer Law for digital goods, and a clause purporting to exclude a statutory guarantee is void.
4. **Ship all three as `[DRAFT — FOR REVIEW]`**, visibly marked per §20.7, footer-linked, replacing the "coming soon" placeholders. **I am not qualified to give legal advice; these are a starting point for a lawyer, not a substitute for one** — and that caveat goes in the handover pack, not only in this sentence.
5. **Add the data export / deletion request route.** An email link is acceptable for v1; a missing route is not.

### Analytics (RS 6.10, Appendix H)

6. **Install PostHog.** One provider this week.
7. **Instrument exactly the nine events the spec asks for:**

```
content_viewed        { type: question|course|template|pack, slug }
filter_applied        { dimension, value }        ← is the 7-tag system actually used?
email_gate_shown      { source: question|template }
email_captured        { source }
checkout_started      { product_slug, price }
checkout_completed    { product_slug, price }
checkout_abandoned    { product_slug }
lesson_started        { course, lesson }
lesson_completed      { course, lesson }
```

8. **Four of these are server-side**, because the client cannot be trusted to report them: `purchase_completed`, `entitlement_delay`, `download_failed`, `refund_issued` (`BACKEND.md` §6.5).
9. **Resist instrumenting anything else.** A dashboard nobody reads is worse than no dashboard; these nine answer real questions this month.
10. **Respect the policy written in step 2** — no PII in event properties beyond the user id, and honour Do Not Track. **Writing the policy first and the instrumentation second is deliberate**, not incidental ordering.

### Definition of Done

> **`[DONE]`, shipped 2026-08-14.** One item needs a human, not code: walking the live funnel once against a real PostHog project to confirm the nine events actually arrive (the code paths are exercised by typecheck/lint/unit tests, not by a live PostHog send — no `POSTHOG_API_KEY` is configured in this environment, deliberately, so nothing here has been sent to a real project yet).

- [x] `/legal/terms`, `/legal/privacy`, `/legal/refunds` exist, footer-linked, marked as drafts. — `App.tsx`, `MarketingLayout.tsx`'s footer, `DraftBanner` on all three
- [x] The privacy policy names every sub-processor actually in use. — Supabase, Stripe, Mux, Resend, PostHog, Vercel, Render — Cloudflare R2 deliberately excluded (superseded by Supabase Storage in Week 1, per `week1_plan.md`)
- [x] The refund page complies with RS 11.3. — states the ACL guarantees apply independently, no "no refunds"/"all sales final" language; the change-of-mind window is marked `[OWNER]` pending confirmation, per RS 11.3's own instruction that this is a commercial call
- [~] The nine events fire and are visible in PostHog, verified by walking the funnel once. — Code-complete and reconciled (see §0.5); **the live PostHog verification itself is `[UNVERIFIABLE]` from the repository** — needs a real project key and a human walking the funnel
- [x] No event carries PII beyond a user id. — every `track()`/`capture_*()` call site checked; DNT honoured by never loading the script at all when set
- [x] A data export/delete request route exists. — the Privacy page's "Your rights" section, a `mailto:` per `lib/support.ts`, explicitly acceptable for v1 per this section's own instruction

---

## Phase 6 — Day 5: Admin hardening, content, and the go/no-go

> **Objective:** close the §31.8 gaps that make the admin genuinely usable by someone else, fill the content holes, and make an honest call.

### Steps

1. **Admin autosave** to §20.8 — every 20 seconds, with a visible `Saved 14:22`. The highest-value gap in §31.8.
2. **Inline validation on blur**, not on submit, and **never clear a valid field because another failed.**
3. **Build `/admin/orders`** to §20.8: date, customer email, product, amount + currency, Stripe reference in mono, entitlement status, CSV export.
4. **Add the manual entitlement grant** with a **required** reason, written to `audit_log`. This is the escape hatch for the payment that succeeds while the webhook fails — a risk already on the watchlist with no mitigation built.
5. **Run the usability test as a deliverable** (§31.3, decision #23). Watch a non-developer add a lesson. **Do not help.** Write down every place they stop. Fix those places. **The list goes in the handover pack, including what was not fixed.**
6. **Confirm the IP position on the vendor-risk template files** — see the risk watchlist. This blocks taking real money for the A$39 product, not the build.
7. **The 99 previews** (decision #22) — the last standing violation of §20.3. Editorial work in the author's voice; I can prepare a worksheet of the machine-derived text beside each question so it is an **editing** task rather than a writing-from-scratch one.
8. **Run `DESIGN.md` §62's release QA checklist** against everything built this week.
9. **Write the Week 2 report** with an honest go/no-go for Week 3.

### Definition of Done

> **`[PART]`, shipped 2026-08-14 as far as code can go.** The remaining four steps (5–9 below) need a human in the room, an owner decision, or both — none are code gaps.

- [~] Autosave works and is visible; validation is inline on blur. — *Autosave: done, on the two rich-text drafts (lesson body, block text/callout) — every 20s plus on blur, "Saved HH:MM" visible, never clears the draft on failure. **Narrower than the full spec**: not extended to every admin field (titles, slugs, video/file pickers) — those are single-action selects or short fields with negligible loss-on-refresh risk, not the "40 minutes of typed guidance" case §31.8 names. Inline-blur validation: not built — the existing admin forms validate on submit only; adding real per-field blur rules (slug-uniqueness, required-field messaging) to `AdminQuestions.tsx`/`AdminCourses.tsx` beyond what's here is unstarted*
- [x] `/admin/orders` reconciles real orders and can grant an entitlement manually, audited. — `admin/orders.py`, `ManualGrantDialog.tsx`; the manual grant writes an `audit_log` row via the same `record_audit()` the admin-bypass path uses
- [ ] A non-developer has added a lesson unaided; the friction list is written down. — `[BLOCKED — needs a human]`. Requires a real non-developer, watched, unaided, per §31.3 — not something this session can perform or simulate honestly
- [ ] §62's checklist is run and its failures are either fixed or named. — `[PART, BLOCKED — needs a human]`. The one automatable slice was run: a repo-wide grep for raw hex outside `theme.css` found none introduced this session (`useThemeStore.ts`'s two hex values are the `<meta name="theme-color">` tag, which cannot reference a CSS custom property — a legitimate exception, not a violation). Axe is covered continuously by `accessibility.spec.ts`, now including `/store` and all three `/legal/*` routes. Real-device visual/responsive/commerce/performance passes need an actual phone and a real card, which this environment doesn't have
- [ ] The Week 2 report is written with a go/no-go. — not written; §0.5 above and this ledger together are the substance of that report, a dedicated write-up is one more step once Phase 0's two human items close

---

# PART IV — THE GATING SUITE

## 24. The thirteen cases

| # | Case | Layer | The assertion |
|---|---|---|---|
| 1 | Logged-out request for a gated lesson | pytest + Playwright | 401/locked state; **no lesson body text anywhere in the response HTML** |
| 2 | Signed-in but unentitled, same lesson | pytest | 403 + `LessonGatedOut` (title, type, product, price — no content) |
| 3 | Direct storage URL, no presigned credential | pytest | Denied by the bucket, not by the app |
| 4 | Presigned URL reused after 60s | pytest (freeze/wait) | Denied |
| 5 | Mux token for an unentitled lesson | pytest | **Never issued** — assert no call reached the Mux client |
| 6 | Token issued for lesson A used on lesson B | pytest | Denied — tokens are scoped to one playback ID |
| 7 | Entitlement revoked mid-session | pytest | The **next** gated request is denied |
| 8 | Draft content by direct URL, signed out | pytest | **404, not a preview** |
| 9 | View-source on an unentitled **lesson** | Playwright | No lesson body text. **Question pages are exempt by design** |
| 10 | The question **filter index** response | pytest | Contains **no `body` key** — inspect the serialised JSON, do not trust the response model. The question **detail** always contains the full body |
| 11 | Block content for an unentitled user `[NEW]` | pytest | No `text_body`, no `media_id`, no `template_id` in any block |
| 12 | Free vs paid template `[NEW]` | pytest | `is_free=true` serves with no auth; `is_free=false` → 401 anonymous, 403 signed-in non-owner |
| 13 | Entitlement shape regression `[NEW]` | pytest | Template product grants the template and **not** any lesson; course product grants both |

## 25. The two cases most likely to be got wrong

**Cases 9 and 10 invert the usual rule.** A question body being publicly present in the HTML is **correct** — every question's full guidance is free by design (§21.3, §27), gated only by a client-side email prompt. A test written from the old paywall model would fail a correctly-behaving system and invite someone to "fix" §21.3 back.

> **Put this in the test's own docstring**, not only in this document. The next person to read a red test will read the docstring first.

## 26. Additional assertions worth the five minutes

- **Webhook idempotency.** Replay a Stripe webhook three times; assert exactly one entitlement, one order and one email. Stripe retries, and a naive handler double-grants and double-emails.
- **JSON inspection, not model trust.** For cases 10 and 11, assert against the serialised response body. A response model that *should* strip a field and a response that *did* strip it are different claims.
- **Admin bypass audit.** An admin reaching gated content produces exactly one `audit_log` row with actor, action, target and timestamp.

## 27. Non-negotiable #9 in practice

For each of the thirteen: comment out the check it guards, run it, **watch it go red**, restore, run again. Record the list in the PR description. A test that has never failed has not been verified.

---

# PART V — LEDGER, RISKS AND REFERENCE

## 28. Task ledger

**Status column marked against the repository on 2026-08-14.** 37 of 49 done · 5 blocked on a human/owner action, not code · 7 not started. Non-negotiables #9 and #11 (tasks 12, 15), Phase 4's storefront (29–31), Phase 5's legal + analytics (35–41), and half of Phase 6 (autosave, orders, manual grant — tasks 42, 44, 45) all closed this session. Everything left — inline blur validation (43), the usability test (46), the IP confirmation (47), the device QA sweep (48) and the report (49) — is either genuinely unstarted engineering or requires a human/owner this session cannot substitute for. See §0.5.

| # | Task | Phase | Requirement | Blocked by | Status |
|---|---|---|---|---|---|
| 1 | Configure first-choice email transport | 0 | W2-R1 | #14 (superseded — see §0.5) | **`[TODO]`** — Resend sandbox only; no real recipient reachable until a sending domain is verified |
| 2 | Recreate admin account | 0 | W2-R1 | — | `[UNVERIFIABLE]` |
| 3 | One real purchase, verified in SQL | 0 | W2-R1 | #21 | `[UNVERIFIABLE]` |
| 4 | Mobile walkthrough at 375px | 0 | W2-R1 | — | **`[TODO]`** — `week1_plan.md:181` unticked |
| 5 | Week 1 go/no-go | 0 | W2-R1 | — | **`[TODO]`** — `week1_plan.md:393–394` unticked |
| 6 | Install pytest / vitest / playwright / axe | 1 | W2-R2 | — | **`[DONE]`** |
| 7 | Four-actor fixtures + JWT override | 1 | W2-R2 | — | **`[DONE]`** — `conftest.py`; anon/member/entitled/admin + `content_graph` |
| 8 | The 10 §58.2 cases | 1 | W2-R2 | — | **`[DONE]`** — 1–8, 10 in pytest; 9 in Playwright |
| 9 | Free-template case | 1 | W2-R2 | — | **`[DONE]`** — case 12, three tests |
| 10 | Entitlement-shape regression | 1 | W2-R2 | — | **`[DONE]`** — case 13, two tests |
| 11 | Admin-bypass audit row + test | 1 | W2-R2 | — | **`[DONE]`** — `record_admin_bypass`; the `# TODO` is gone |
| 12 | Prove every test can fail | 1 | W2-R2 | — | **`[DONE]`** — non-negotiable #9, closed 2026-08-14, see [`gating_seen_red.md`](gating_seen_red.md) |
| 13 | CI wiring | 1 | W2-R2 | #16 | **`[DONE]`** — `ci.yml`; needs Actions secrets to go green |
| 14 | Migration 008 — `lesson_blocks` | 2 | W2-R3 | — | **`[DONE]`** — renumbered `009` per the v2.1 reconciliation |
| 15 | Backfill + render-parity check | 2 | W2-R3 | — | **`[DONE]`** — non-negotiable #11, closed 2026-08-14, see [`lesson_block_render_parity.md`](lesson_block_render_parity.md) |
| 16 | Block-aware lesson endpoints | 2 | W2-R3 | — | **`[DONE]`** — per-block token and presigned URL |
| 17 | Block renderer in `Learn.tsx` | 2 | W2-R3 | — | **`[DONE]`** — all four block types |
| 18 | Admin block editor (up/down) | 2 | W2-R3 | — | **`[DONE]`** — `BlockEditor`, three-step swap under the UNIQUE constraint |
| 19 | Publish guard for blocks | 2 | W2-R3 | — | **`[DONE]`** |
| 20 | Gating case 11 | 2 | W2-R2 | — | **`[DONE]`** — six tests |
| 21 | `scoring.ts` per §57.3 | 3 | W2-R4 | — | **`[DONE]`** |
| 22 | `scoring_cases.json` | 3 | W2-R4 | — | **`[DONE]`** — one file, both suites |
| 23 | `question_service.py` | 3 | W2-R4 | — | **`[DONE]`** |
| 24 | Split index / filtered endpoints | 3 | W2-R4 | — | **`[DONE]`** — `/questions/index` + scored `/questions` |
| 25 | Two-zone results + `MatchBadge` | 3 | W2-R4 | — | **`[DONE]`** |
| 26 | `ResultCount` live | 3 | W2-R4 | — | **`[DONE]`** — `tabular-nums`, `aria-live` |
| 27 | `ZeroResults` computed relaxations | 3 | W2-R4 | — | **`[DONE]`** — `rankRelaxationCandidates` |
| 28 | Parity test in CI | 3 | W2-R4 | — | **`[DONE]`** — both jobs, one fixture |
| 29 | `/store` page + three sections | 4 | W2-R5 | — | **`[DONE]`** — `Store.tsx`, 2026-08-14 |
| 30 | `ContentTypeCard` three variants | 4 | W2-R5 | — | **`[DONE]`** — `components/store/ContentTypeCard.tsx`; `pack` variant styled but unused (no packs exist) |
| 31 | Header nav update | 4 | W2-R5 | — | **`[DONE]`** — `MarketingLayout.tsx` nav consolidated to Questions/Store/About; member rail also updated |
| 32 | Pack product type + page | 4 | W2-R6 | #19 | **`[TODO]`** |
| 33 | Pack in My Library | 4 | W2-R6 | #19 | **`[TODO]`** |
| 34 | Pack gating case | 4 | W2-R2 | #19 | **`[TODO]`** |
| 35 | Terms draft | 5 | W2-R7 | #4 | **`[DONE]`** — `pages/legal/Terms.tsx`; contracting entity stated as Effective RM, ABN left `[OWNER]` |
| 36 | Privacy draft + sub-processors | 5 | W2-R7 | — | **`[DONE]`** — `pages/legal/Privacy.tsx`, all 7 real sub-processors named |
| 37 | Refund draft | 5 | W2-R7 | #17 | **`[DONE]`** — `pages/legal/Refunds.tsx`; change-of-mind window left `[OWNER]` per decision #17 |
| 38 | Draft banner component | 5 | W2-R7 | — | **`[DONE]`** — `components/legal/DraftBanner.tsx` |
| 39 | Data export/delete route | 5 | W2-R7 | — | **`[DONE]`** — `mailto:` in Privacy's "Your rights" section |
| 40 | PostHog + nine events | 5 | W2-R8 | — | **`[DONE]`** — `posthog-js` + `posthog==7.39.0`; 5 client events (`lib/analytics.ts`) + 4 server events, reconciled against `BACKEND.md §6.5` (see §0.5) |
| 41 | Four server-side events | 5 | W2-R8 | — | **`[DONE]`** — `purchase_completed`/`entitlement_delay` wired into `webhooks.py`; `download_failed` into `templates.py`/`lessons.py`; `refund_issued` defined, no call site (no refund mechanism exists yet) |
| 42 | Admin autosave | 6 | W2-R9 | — | **`[DONE]`** — `lib/useAutosave.ts` + `components/admin/AutosaveIndicator.tsx`, wired into the lesson-body and block-text editors |
| 43 | Inline validation on blur | 6 | W2-R9 | — | **`[TODO]`** — not built; existing admin forms validate on submit only |
| 44 | `/admin/orders` + CSV | 6 | W2-R9 | — | **`[DONE]`** — `api/v1/admin/orders.py`, `pages/admin/AdminOrders.tsx` |
| 45 | Manual grant + audit | 6 | W2-R9 | — | **`[DONE]`** — `POST /admin/entitlements/grant`, `ManualGrantDialog.tsx`, `record_audit()` |
| 46 | Non-developer usability test | 6 | W2-R9 | #23 | **`[TODO]`** — `[BLOCKED]`, needs a human, unaided, watched |
| 47 | Vendor-risk IP confirmation | 6 | — | `[OWNER]` | **`[TODO]`** — `[BLOCKED]`, owner-only |
| 48 | §62 release QA sweep | 6 | — | — | `[PART]` — the code-checkable slice (raw-hex grep, axe sweep) run clean; real-device passes `[BLOCKED]`, needs a phone and a real card. §19.5's rail aurora still unverified |
| 49 | Week 2 report + go/no-go | 6 | — | — | **`[TODO]`** — this document's §0.5 is the substance; a standalone write-up is one step away |

## 29. Risk watchlist

| Risk | Watch for | Mitigation this week |
|---|---|---|
| **`[ADDED 2026-08-14]` No real customer can be emailed at all.** `email_service.py`'s own docstring: every send is redirected to the owner's inbox on Resend's sandbox sender. Not a code gap — this is the settled transport (Resend, superseding decision #14's Gmail plan) sitting on an unverified domain | Any receipt or sale-notification email arriving `[Not delivered to buyer]`-prefixed at `OWNER_NOTIFICATION_EMAIL` instead of the buyer | Verify a sending domain with Resend (`docs/email.md`'s options already researched) before the next real purchase is used as evidence of anything |
| **The gating suite passes without testing anything.** The classic failure: assertions that never could have failed | A test that stays green when you delete the check it guards | Non-negotiable #9 — every test observed red first, listed in the PR |
| **Cases 9/10 written from the old paywall model.** A test asserting question bodies are hidden would fail a correctly-behaving system and invite someone to "fix" §21.3 | Any test asserting a question body is absent from HTML | Stated in §24's table, §25, and required in the test's own docstring |
| **The block migration silently changes live content.** Three lessons exist and a course has been sold | Any rendering difference before/after backfill | Non-negotiable #11 — a blocking gate, not a nicety |
| **Scoring drifts between Python and TypeScript.** Two implementations of one rule always do | Any divergence on the fixture set | Non-negotiable #10 — one shared fixture, both suites, in CI |
| **§57.2's exact-match bug reintroduced.** The most likely single defect in Phase 3 | A question with two exact matches and one adjacent appearing in the exact zone | A fixture case specifically for it; read §57.3 before writing |
| **A domain pack that sells something already free.** The fastest possible way to lose buyer trust | Product copy implying purchase unlocks the questions | §20.6's honesty notice, above the previews, not in fine print |
| **Legal drafts read as final** | Any page without the `[DRAFT — FOR REVIEW]` banner | §20.7, and the caveat repeated in the handover pack. **`[CLOSED 2026-08-14]`** — all three carry it |
| **Analytics collecting PII** before the privacy policy names it | Any event property beyond a user id | Policy written first, instrumentation second — deliberate ordering. **`[CLOSED 2026-08-14]`** — Privacy shipped before `analytics.ts`/`posthog_client.py` existed |
| **`[ADDED 2026-08-14]` The plan's own nine-event list is internally inconsistent** — Phase 5 step 7 names nine client-side events; step 8 then calls four *different* names (from `BACKEND.md §6.5`) "four of these," which would total 13 if both were taken literally | Anyone re-reading step 7's code block and instrumenting all nine of it on top of the server four | `lib/analytics.ts`'s own module docstring records the reconciliation actually shipped — BACKEND.md's four server names kept fixed, five of step 7's nine picked for the client. Re-read that note before adding a sixth client event |
| **Decision #15 (account ownership) still unanswered at Week 4** | Nothing technical fails; **handover does** | Escalate on Day 1, not Week 4. This is the largest non-technical risk on the project |
| **Data loss once there are real customers.** The 2026-08-12 wipe was intentional and cost nothing; an unintentional one after the first live order would destroy purchase records that cannot be reconstructed | Supabase's free tier has no point-in-time recovery | Name PITR (Pro tier) as a cost **before** the first live transaction, per the brief's "every recurring fee is named and justified". Ties to #21 |
| **Stripe still in test mode at launch** | `rk_test_` in a production env | Decision #21 — make it an explicit call, not a discovery |
| **IP provenance of the vendor-risk template files.** The six files in Storage carry an `IC-…-10772` naming pattern typical of a third-party template library. The brief's non-negotiable is "the author's voice and IP… published work under a real name" | Any paid artefact whose origin cannot be stated | **Owner confirmation before the A$39 product takes real money.** It is live in *test* mode only; unpublishing is one flag |
| **An inverting token used on the dark plane** `[ADDED v2.1]`. It has already shipped seven times and every instance passed review, because each read correctly in whichever theme its author had open | `primary`, `accent` or `sidebar-*` inside any file that also contains `bg-stage` | §12.6. Grep before commit; open both themes before calling any surface done |
| **A gradient signed off from a swatch audit rather than the rendered page** `[ADDED v2.1]`. The token maths said the auth panel was safe while the real paragraph sat at 4.36:1 | Any contrast claim about text on `.hero-wash`, `.page-wash`, `.stage-aurora` or a domain tile that cites token values | §12.5. Screenshot, sample the pixels under the real copy, both themes, 1440 and 375 |
| **The rail aurora is unverified** `[ADDED v2.1]` | Nav labels at 80% and the account row at 70%, on the new rail | Phase 6 QA sweep. It is reasoned, not measured — §19.5 says so explicitly rather than implying it was audited |
| **The new typefaces shift every layout slightly** `[ADDED v2.1]`. Schibsted Grotesk and Newsreader have different x-heights and set widths from the faces every existing screen was spaced against | Wrapped buttons, a hero headline breaking to three lines, truncated nav labels, `.eyebrow` rules sitting off the cap height | Re-run §21's width sweep on **existing** screens, not only new ones. The 140-character-title stress fixture is the fastest way to find the worst case |
| **The week is over-scoped** (§2.1) | Phase 4 not started by end of Day 4 | Cut in §10's order. Phases 0–2 are not cuttable |

## 30. Quick reference

### New dependencies
`pytest` · `pytest-asyncio` · `httpx` · `vitest` · `@testing-library/react` · `@testing-library/user-event` · `jsdom` · `@playwright/test` · `@axe-core/playwright` · `posthog-js` · GitHub Actions

### New migrations
`009_lesson_blocks` — the blocks table, the unique `(lesson_id, sort_order)` constraint, and the backfill of the three existing lessons

### New routes
`/store` · `/store/packs/:slug` · `/legal/terms` · `/legal/privacy` · `/legal/refunds` · `/admin/orders`

### New API endpoints
`GET /sections/{slug}/questions/index` · `GET /questions?<filters>` (scored) · block-aware lesson detail · `GET /admin/orders` · `POST /admin/entitlements/grant`

### New components
`StorePage` · `StoreSection` · `ContentTypeCard` · `TextBlock` · `VideoBlock` · `FileBlock` · `CalloutBlock` · `MatchBadge` · `ResultCount` · `ZeroResults` · `PackProductPage` · `LegalPage` · `DraftBanner` · `AutosaveIndicator` · `AdminOrdersTable` · `ManualGrantDialog`

### New product type
Domain pack — a `product` with `question_set` grants for a domain plus a `template` grant for its PDF artefact. **No new entitlement mechanism** (RS 5.6).

### The design values you will reach for most

```
Radius        4 / 6 / 8 / 12px — 12px is a hard ceiling
Card          border-border · rounded-lg · bg-card · p-5 sm:p-6
Card hover    translateY(-2px) + shadow-sm · 160ms · no scale
Focus         2px --ring outline · 2px offset · 4px radius · global only
Reading       serif · 18px · 1.7 · max-w-[68ch]
UI body       sans · 16px · 1.55
Metadata      sans · 14px · 1.5 · --muted-foreground
Badge         sans · 12px · 500 · rounded-sm · 4px 8px
Gold as text  --gold-strong, ALWAYS. --gold is decoration, ALWAYS.
Countables    tabular-nums, ALWAYS.
Motion        micro 100–150 · small 150–220 · medium 220–350 · nothing over 500ms
Easing        --ease-standard cubic-bezier(0.2, 0, 0, 1)
```

### The one command that matters

```bash
pytest && npm run test && npx playwright test
```

**If that is green, the paywall holds. If it is red, nothing else this week counts.**

---

*This plan operationalises Week 2 against the intern brief, `DESIGN.md`, `BACKEND.md` and the Research Specification. It re-scopes §60's original Week 2 because most of that scope was pulled forward and completed during and after Week 1 — the exceptions being the gating suite and the discovery scoring model, which §60 itself insists must not slip. Where this plan and `DESIGN.md` disagree on sequence, §60.1's cut order governs what gets dropped if the week gets tight.*
