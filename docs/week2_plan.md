# Week 2 Implementation Plan — "Deciding in the Dark" Platform
**Prove it holds, then finish the store · Days 0–5 · v1.0 · 2026-08-12**

*Derived from `DESIGN.md` (§19, §21, §23–§24, §27–§31, §42, §57–§58, §60, §62), `Deciding_in_the_Dark_Research_Specification.md` (3.3, 3.5, 5.x, 6.10, 7.6, 8.1–8.4, 11.x, 13.4) and `Deciding_in_the_Dark_Product_Spec.md` (§4, §7, §8, §9).*

---

## Read this first — Week 2 is not what it was planned to be

`DESIGN.md` §60 defines Week 2 as *"learning, access and gating: course outline, modules, mixed lesson types, progress and resume. Real content loaded from the 100 questions. Sign-in and access control finished properly."*

**Almost all of that already exists.** It was pulled forward during Week 1 and the days after (`week1_plan.md`'s two post-Week-1 updates). So did most of §60's Week 3: the admin editor, transactional email, and multiple products are built. Re-running the original Week 2 would be re-planning finished work.

What §60 named for Week 2 and is **genuinely not done** is the single most important item on it:

> **"The gating test suite written and passing (§58.2)… Run these in Week 2, not Week 4. 'Access control discovered to be wrong in week four invalidates everything built on top of it' (brief)."**

There is currently **no test infrastructure at all** — no Vitest, no Playwright, no pytest, no axe. Every gating claim made so far is a hand-run `curl` from a session that is now closed. That is the honest starting position for this week.

So Week 2 is re-scoped to: **prove the thing holds, then finish the three storefront must-haves the product spec names and the platform still lacks.**

### What this week closes

| Source | Requirement | State entering Week 2 |
|---|---|---|
| `DESIGN.md` §58.2 | The gating suite, 10 cases, failing closed | ❌ No tests exist |
| Product Spec §9 | Course reader with mixed **blocks** (text + video + file in one flow) | ❌ Rigid `lesson_type` enum |
| Product Spec §9 | Storefront separating and labelling the three content types | ❌ Three separate catalogues, no store |
| Product Spec §9 | Domain-based bundles as a purchasable unit | ❌ Not built |
| Product Spec §9 | Legal pages (terms, privacy, refund) | ❌ Footer says "coming soon" |
| Product Spec §9 | Basic analytics — what's viewed, what's bought, drop-off | ❌ Nothing instrumented |
| `DESIGN.md` §31.3 | Admin autosave; order reconciliation; the non-developer usability test | ❌ Named gaps in §31.8 |
| `week1_plan.md` | The last unchecked Week 1 box (mobile) + go/no-go | ❌ Outstanding |

---

## Open decisions and inputs needed from you (owner)

Same rule as Week 1: none of these is a formality, and each blocks a named task.

### Blocking — needed before Day 1

| # | Decision needed | What it blocks |
|---|---|---|
| **14** | **The Gmail App Password** (`docs/gmail.md`, ~5 minutes). Until this exists, email falls through to Mailjet and the "first transport" path has never actually run. | Phase 0 step 2; every receipt assertion in Phase 1. |
| **15** | **Decision #9, still unanswered since Day 1 — who owns the Vercel / Render / Supabase / Stripe / Mux accounts?** Asked twice; never resolved. | The handover pack (Week 4). This is now the largest non-technical risk on the project. |
| **16** | **Decision #10 — GitHub repo access.** Who else can see this code today? | Handover continuity. Blocks nothing technical. |
| **17** | **Refund policy — the actual position.** Research 11.3 requires one at launch; Australian Consumer Law does not permit "no refunds on digital goods" as a blanket term. I can draft it, but the commercial call (14 days? on unopened downloads only? none once a course is started?) is yours. | Phase 4, step 3. A legal page drafted around a policy you haven't decided is a page you'd have to rewrite. |
| ~~**18**~~ | ~~Was the data wipe intentional?~~ **ANSWERED 2026-08-12: yes, intentional.** No recovery needed; Phase 0 may recreate accounts freely. The consequence still stands and is recorded in `week1_plan.md` — Week 1's cited evidence (the buyer, order, entitlement and audit rows) describes records that no longer exist. The code paths are unchanged; Phase 0 step 4 regenerates the proof. | — |

### Needed by Day 3

| # | Decision needed | Why |
|---|---|---|
| **19** | **What a "domain pack" actually contains.** You chose (2026-08-12) that reference packs are a purchasable **artefact** — a formatted PDF of a domain's questions plus a curated working order — rather than a paywall over free text. Engineering can build the product/checkout/delivery path this week. **Producing the PDF is content work only you can do.** Confirm: one PDF per domain? Priced at which ladder tier (`docs/pricing.md` §1)? | Phase 3, steps 5–7. |
| ~~**20**~~ | ~~The second, paid template.~~ **RESOLVED 2026-08-12** — Vendor Risk Assessment Scorecard, A$39 (`db/seed/013`), built from a file already in Storage. Paywall verified: anonymous 401, course-buyer denied, template-buyer allowed. Phase 5 step 5 is done. | — |
| **21** | **Test-mode or live Stripe by end of Week 2?** The key in use is a *restricted test* key (`rk_test_`). Going live is its own verification pass and changes what Phase 1's purchase test means. | Phase 0 step 4; Phase 5 go/no-go. |

### Nice to have, not blocking

| # | |
|---|---|
| 22 | Your voice on the 99 machine-derived question previews (Phase 5, step 6) — this is editorial, not engineering, and it is the last thing standing between the catalogue and `DESIGN.md` §20.3. |
| 23 | A 30-minute slot where I watch you add a lesson in the admin without helping (§31.3 — "the usability test is a deliverable"). |

---

## Week 2 objective

> **Prove the paywall holds automatically, not anecdotally — then make the store a store: three labelled content types, bundles, legal cover, and enough measurement to know what's working.**

Week 1 proved one path works once. Week 2 proves it **keeps** working, and widens it from one product to a catalogue.

### Definition of Done for Week 2 (all must be true)

- [ ] The §58.2 gating suite exists, runs in one command, and all 10 cases pass — and each one has been seen to **fail** when the protection is deliberately removed.
- [ ] A course lesson can interleave text, video and a file download in one flowing view (Product Spec §7.2), and existing lessons still render.
- [ ] `/store` exists: one page, three labelled content types, honest prices, no dead "coming soon" tiles.
- [ ] At least one domain pack is purchasable end to end with a real artefact behind it.
- [ ] Terms, privacy and refund pages exist as **drafts for your review**, linked in the footer, not self-published as final.
- [ ] Analytics records content views, checkout starts, purchases and drop-off, by content type.
- [ ] Admin autosave works, and someone who is not the developer has added a lesson unaided while I watched and took notes.
- [ ] The Week 1 mobile walkthrough is done and the Week 1 go/no-go is closed.
- [ ] Nothing in this week required a manual database edit to demo.

**Do not proceed to Week 3 planning if the gating suite is not passing.** Everything else on this list is a feature; that one is the brief's hardest requirement.

---

## Non-negotiables carried forward from Week 1

Unchanged and still in force — 1–8 in `week1_plan.md`. Two are load-bearing this week specifically:

- **#3 Server-side entitlement checks only.** Phase 2 adds a new content shape (blocks). Every block that carries a file or a video is a new gated surface, and each one must go through `app/core/entitlements.py`, not a new bespoke check.
- **#5 No placeholder content.** Applies to the domain-pack PDF and the second template as much as it did to the first video.

One addition for Week 2:

9. **A test that has never failed has not been verified.** Every gating test must be seen red before it is trusted green — comment out the check, watch it fail, restore it. A suite that passes because it asserts nothing is worse than no suite, because it manufactures confidence.

---

## Phase 0 — Day 0 (half day): Restore ground truth

**Objective:** Make the system verifiable again before building on it. Nothing in Phases 1–5 can be trusted while there is no account, no purchase and no working first-choice email transport.

**Why this is Phase 0 and not "admin":** the 2026-08-12 wipe removed the buyer, the order, the entitlement and the audit row that Week 1's Definition of Done cites as evidence. The code paths are unchanged, but *the proof is gone*. Rebuilding it takes an hour and everything downstream depends on it.

### Step-by-step

1. ~~**Confirm decision #18**~~ — **answered: the wipe was intentional.** No backup check needed; go straight to step 2.
2. **Configure Gmail SMTP** (decision #14). Paste `GMAIL_USER` / `GMAIL_APP_PASSWORD` into `backend/.env`, **restart the backend** (settings load once at process start — a stale process is the most likely cause of the original misdelivery), then run the send test in `docs/gmail.md` §6 to a non-Gmail address.
3. **Recreate an account and grant admin:** sign up in the app, then `.venv\Scripts\python.exe scripts/grant_admin.py <your email>`. Confirm `/admin` loads and the sidebar shows *Content editor*.
4. **Run one real purchase** of Risk Register Fundamentals (A$49 — the A$29 product is unpublished). Confirm, by querying the database rather than trusting the UI: an `orders` row, an `entitlements` row with `granted_via='purchase'`, an `audit_log` row, and a receipt email that arrived **from Gmail**, not from `onboarding@resend.dev`.
5. **Walk the whole path on a phone** — the last unchecked box in `week1_plan.md`. Sign-up, question, course, checkout, download, on a real device at 375px. Note every place it feels wrong; those notes feed Week 4's polish list, not this week's.
6. **Close Week 1:** write the go/no-go report and get an explicit answer (decisions from `week1_plan.md` Phase 5, steps 6–7).

### Definition of Done — Phase 0

- [ ] A receipt email has arrived via **Gmail SMTP**, to an address that is not the sender.
- [ ] A real `orders` + `entitlements` + `audit_log` triple exists again, from a real checkout.
- [ ] `/admin` is reachable by a real admin account.
- [ ] The mobile walkthrough is done; Week 1's Definition of Done is 12/12.
- [ ] Week 1 is formally closed with a go/no-go.

**Do not proceed to Phase 1 if:** the purchase path does not complete. Phase 1 writes tests that assert its behaviour; writing them against a broken path bakes the break into the suite.

---

## Phase 1 — Day 1: The gating suite `[§58.2 — the week's non-negotiable]`

**Objective:** The claim "paid content is genuinely inaccessible" becomes a command anyone can run, not a story about a `curl` someone ran once.

### Step-by-step

1. **Install the test stack** — this does not exist yet:
   - **Backend:** `pytest`, `pytest-asyncio`, `httpx` (ASGI transport, so tests hit the real app without a live server). Add to `requirements.txt`.
   - **Frontend:** `vitest`, `@testing-library/react`, `@testing-library/user-event`, `jsdom`.
   - **E2E:** `@playwright/test` + `@axe-core/playwright`.
2. **Build the fixtures** the suite needs, as code, not as hand-made rows: a signed-out client, a signed-in-but-unentitled user, an entitled user, and an admin. Seed and tear down inside the test transaction — a suite that leaves rows behind will drift and start lying.
   *Auth note:* JWTs are ES256 via Supabase JWKS and cannot be minted locally. Either point tests at a dedicated Supabase test project and use real sign-ins, or inject a `verify_jwt` dependency override in the FastAPI app for backend tests. **Prefer the dependency override for unit/integration; use real sign-in for the Playwright pass**, so at least one layer exercises the real token path.
3. **Write the 10 cases from §58.2, in order.** Each is listed verbatim there; the shape is one test per case, each asserting a *denial*:

   | # | Case | Layer |
   |---|---|---|
   | 1 | Logged-out request for a gated lesson → locked, no lesson body in HTML | pytest + Playwright |
   | 2 | Signed-in, unentitled → same | pytest |
   | 3 | Direct storage URL with no presigned credential → denied | pytest |
   | 4 | Presigned URL reused after 60 s → denied | pytest (freeze/wait) |
   | 5 | Mux token for an unentitled lesson → never issued | pytest |
   | 6 | Token issued for lesson A used on lesson B → denied | pytest |
   | 7 | Entitlement revoked mid-session → next request denied | pytest |
   | 8 | Draft content by direct URL, signed out → 404, not a preview | pytest |
   | 9 | View-source on an unentitled **lesson** contains no body text — **question pages are exempt by design** (§21.3) | Playwright |
   | 10 | The question **filter index** never contains `body`; the question **detail** always does | pytest |

   **Case 9 and 10 are the two most likely to be got wrong**, because they invert the usual rule: the question body being publicly present is *correct* (§21.3, §27), and a test written from the old paywall model would fail a system that is behaving properly.
4. **Add the free-template case — new since §58.2 was written.** `templates.is_free = true` must serve without auth; `is_free = false` must 401 anonymously and 403 for a signed-in non-owner. This is the newest gating surface and the one with no test history at all.
5. **Add the entitlement-shape regression test.** The template/course split bug (`db/seed/012`) was a *catalogue* defect the engine could not catch: assert that holding the template product grants the template and **not** any lesson, and that holding the course grants both. This is the test that would have caught a bug that reached production.
6. **Prove each test can fail.** Comment out the check it guards, watch it go red, restore. Record the list in the PR description — per Non-negotiable #9.
7. **Wire it into CI** (GitHub Actions): backend suite, frontend unit suite, Playwright, and axe on every public route. Fail the build on any red.

### Definition of Done — Day 1

- [ ] `pytest` and `npm run test` and `npx playwright test` all exist and all pass.
- [ ] All 10 §58.2 cases plus the free-template and entitlement-shape cases are implemented.
- [ ] Every test has been observed failing when its protection was removed.
- [ ] CI runs the whole thing on push and blocks a red build.
- [ ] axe reports no violations on `/`, `/questions`, `/questions/:slug`, `/courses`, `/templates`, `/store`.

**Do not proceed to Phase 2 if:** any gating case fails. A failing case is a live vulnerability, not a failing test — fix the system, never the assertion.

---

## Phase 2 — Day 2: The course reader as content blocks

**Objective:** Product Spec §7.2 — *"video sits within the reading wherever it's useful, rather than being a separate video-only step."* Today a lesson is one rigid type; a lesson that is "a paragraph, then a short video, then another paragraph" cannot be authored at all.

This is the largest remaining **architectural** gap, and the only item this week that touches the data model.

### Step-by-step

1. **Add the `lesson_blocks` table** (migration `008`). Deliberately a table, not a JSON column: blocks are ordered, individually addressable, and one of them (`file`) points at a `templates` row — a foreign key that JSON cannot enforce.
   ```
   lesson_blocks
     id, lesson_id (FK), sort_order
     block_type  : 'text' | 'video' | 'file' | 'callout'
     text_body   : text, null unless text/callout
     media_id    : FK → media,     null unless video
     template_id : FK → templates, null unless file
   ```
2. **Keep `lessons.lesson_type` — do not drop it.** It becomes a *display hint* (what icon the outline shows), not the content contract. Dropping it would break the course outline, the library's `is_ready` checks, and `docs/handover.md`'s description of the syllabus in one migration. §31.8's publish-guard logic keys off it.
3. **Backfill existing lessons into blocks**, in the same migration: a `reading` lesson becomes one `text` block from `lessons.body`; a `video` lesson becomes one `video` block from its `media` row; a `download` lesson becomes one `file` block from `download_template_id`. **After the backfill, verify all 3 existing lessons render identically to before** — a migration that silently changes live content is worse than no migration.
4. **Update `GET /courses/{slug}` and the lesson endpoint** to return ordered blocks. Entitlement is checked **once per lesson**, not per block — but each `video` block still mints its own short-lived Mux token and each `file` block its own 60-second presigned URL, on demand, exactly as today (`BACKEND.md` §4.1: the check runs before the URL is minted).
5. **Build the block renderer** in `Learn.tsx`. Reading measure stays at 68ch (§13.1); a video block breaks out wider; a file block is the §26.4 download state machine, inline. Captions default on (§25.2).
6. **Extend the admin lesson editor** to add, reorder and delete blocks. Reordering is drag-free for now — up/down buttons — because drag-and-drop is a day of work on its own and §31.3's real requirement is that a non-developer can do it at all.
7. **Extend the publish guard** (§31.8): a lesson with zero blocks, or a `video` block with no media, or a `file` block with no template, cannot be published.

### Definition of Done — Day 2

- [ ] A lesson can be authored as text → video → text → file, in the admin, and reads as one flowing view.
- [ ] All three pre-existing lessons render exactly as they did before the migration.
- [ ] Each video block plays via its own signed token; each file block downloads via its own presigned URL.
- [ ] A logged-out or unentitled user gets no block content — added to the Phase 1 suite as case 11.
- [ ] The publish guard refuses an incomplete lesson.

**Do not proceed to Phase 3 if:** existing lessons render differently than before. Roll back the backfill and fix it — this is live content someone has paid for.

---

## Phase 3 — Day 3: The storefront and domain packs

**Objective:** Product Spec §9's *"a storefront that clearly separates and labels the three content types"* and *"domain-based bundles as a purchasable unit."* Today there are three separate catalogues and no page that presents the store as a store.

### Step-by-step

1. **Build `/store`** — one page, three clearly labelled sections in the product spec's own order: **Reference packs · Courses · Templates**. Not a merged grid: §0.8's rule is that the three types must not be flattened, and a store that renders them identically teaches the visitor they are the same thing.
2. **Each section states its shape**, in one line, in the §6 voice — "look something up" / "learn a domain properly" / "one thing you need right now" (Product Spec §4). This is the sentence that stops a visitor asking "what's the difference?"
3. **Honest empty sections.** If a type has nothing purchasable yet, say so plainly and link to the free thing instead. **Never a "coming soon" tile that looks like a product** — §49.1's rule against padding a section with anything invented.
4. **Show the free entry points inside the store, not hidden below it**: all 100 questions free, and the free template. The store's job is to make the free path obvious, because it is the top of the funnel (§27, §27.4).
5. **Build the domain-pack product type.** Architecturally this is already supported — a pack is a `product` whose `product_contents` rows are `content_type='question_set'` for that domain's questions, plus a `template` row for the PDF artefact. **No new entitlement mechanism** (Research 5.6, `week1_plan.md` Scalability). Seed one pack for the Risk domain once decision #19 lands.
6. **Be precise about what a pack sells.** Per your 2026-08-12 decision, the questions stay free — the pack sells the *artefact and the curation*. The product page must say that in plain words. Selling a "pack" that a visitor discovers is free on the site is the fastest way to lose the trust the whole catalogue depends on.
7. **Add the pack to My Library's Reference section** (§30.4) — it already renders `question_set` grants; the pack's PDF appears via its `template` grant, downloadable like any other.
8. **Update the marketing header** to point at `/store` alongside the individual catalogues (§17.1's five-item ceiling — replace, don't append).

### Definition of Done — Day 3

- [ ] `/store` lists all three types, labelled, with a one-line explanation each.
- [ ] Every price shown is real and matches `docs/pricing.md`; empty sections are honest.
- [ ] One domain pack is purchasable end to end: checkout → webhook → entitlement → the PDF downloads from My Library.
- [ ] The pack's product page states plainly that the questions themselves are free.
- [ ] Gating suite extended: a pack's PDF is denied to a non-purchaser.

**Do not proceed to Phase 4 if:** the store shows a price for anything that cannot actually be bought.

---

## Phase 4 — Day 4: Legal cover and analytics

**Objective:** Two Product Spec §9 must-haves that are entirely absent. Neither is glamorous; the first is a launch blocker in Australia and the second is how Week 3's priorities get decided from evidence rather than instinct.

### Step-by-step — legal (Research 11.1–11.5)

1. **Terms of service** — drafted, covering: what is being sold (a licence to use the content, not a transfer of IP), one-time purchase with lifetime access, acceptable use (no redistribution of templates or course material), account termination, and the contracting entity from Week 1's decision #4.
2. **Privacy policy** — what is collected (email, name, purchase history, lesson progress, lead captures), why, who processes it (Supabase, Stripe, Mux, the email transports), retention per Research 7.6's table, and the access/deletion route. **Name the sub-processors** — a privacy policy that omits them is inaccurate the day it ships.
3. **Refund policy** — per decision #17. Research 11.3 is explicit that a blanket "no refunds" is not available under Australian Consumer Law for digital goods.
4. **Ship them as `[DRAFT — FOR REVIEW]`**, visibly marked, linked from the footer, replacing the two "coming soon" placeholders. Per the brief: *drafted for review, not self-published*. **I am not qualified to give legal advice, and these are a starting point for a lawyer, not a substitute for one** — that caveat goes in the handover pack, not just in this sentence.
5. **Add the data-export / delete request route** (§30.3) — an email link is an acceptable v1, a missing route is not.

### Step-by-step — analytics (Research 6.10)

6. **Install PostHog** (product analytics, free tier). One provider this week; Plausible for marketing is a Week 3 nice-to-have, not a must.
7. **Instrument exactly the events the spec asks for** — *"what's viewed, what's bought, by content type, and where people drop off"*:
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
8. **Resist instrumenting everything else.** A dashboard nobody reads is worse than no dashboard; these nine answer real questions this month.
9. **Respect the privacy policy written in step 2** — no PII in event properties beyond the user id, and honour Do Not Track. Writing the policy first and the instrumentation second is deliberate.

### Definition of Done — Day 4

- [ ] `/terms`, `/privacy`, `/refunds` exist, are linked in the footer, and are marked as drafts.
- [ ] The privacy policy names every sub-processor actually in use.
- [ ] The nine events fire and are visible in PostHog, verified by walking the funnel once.
- [ ] No event carries PII beyond a user id.
- [ ] A data export/delete request route exists.

---

## Phase 5 — Day 5: Admin hardening, content, and go/no-go

**Objective:** Close the §31.8 gaps that make the admin genuinely usable by someone else, fill the content holes, and make an honest call.

### Step-by-step

1. **Admin autosave** (§31.3) — the highest-value gap in §31.8. Every 20 seconds, with a visible `Saved 14:22`. §31.3 is right that losing 40 minutes of typed guidance is the fastest way to lose an author's willingness to use the tool.
2. **Inline validation on blur**, not on submit, and never clear a valid field because another failed (§31.3).
3. **`/admin/orders`** (§31.7) — date, customer email, product, amount, Stripe reference in mono, entitlement status, CSV export. Plus the **manual entitlement grant** with a required reason, written to `audit_log`. This is the escape hatch for the payment that succeeds while the webhook fails — a risk already on the Week 1 watchlist with no mitigation built.
4. **The usability test as a deliverable** (§31.3, decision #23): watch a non-developer add a lesson. Do not help. Write down every place they stop. Fix those places. **The list goes in the handover pack**, including what was not fixed.
5. ~~**Seed the second, paid template** (decision #20)~~ — **done 2026-08-12**, ahead of the week. Vendor Risk Assessment Scorecard, A$39. What remains here: confirm the **IP position** on the vendor-risk files (see the risk watchlist).
6. **The 99 previews** (decision #22) — the last standing violation of §20.3. This is editorial work in your voice; I can prepare a worksheet of the machine-derived text beside each question so it is an editing task, not a writing-from-scratch one.
7. **Run `DESIGN.md` §62's release QA checklist** against everything built this week.
8. **Write the Week 2 report** with an honest go/no-go for Week 3.

### Definition of Done — Day 5 / Week 2 overall

- [ ] Autosave works and is visible; validation is inline.
- [ ] `/admin/orders` reconciles real orders and can grant an entitlement manually, audited.
- [ ] A non-developer has added a lesson unaided; the friction list is written down.
- [ ] A second, real, paid template is live and its purchase path is tested.
- [ ] §62's checklist is run and its failures are either fixed or named.
- [ ] The Week 2 report is written with a go/no-go.

---

## Scope guardrails — what NOT to build in Week 2

- **The AI-assembled tailored pack.** Product Spec §6 parks it explicitly and is right: it needs the store, the tagging and all three content types live and stable first. It is the most exciting idea in the brief and the easiest way to lose a week.
- **Subscriptions, team seats, certificates, audio, case studies** — all Product Spec §6 non-goals.
- **Semantic search** — `DESIGN.md` §60.1 lists it first in the cut order.
- **A second course.** More course *depth* is content (decision #20 territory), not engineering.
- **Drag-and-drop block reordering.** Up/down buttons this week; drag is polish.
- **Plausible alongside PostHog.** One analytics provider until there is a marketing site worth measuring separately.
- **The full accessibility audit** — §42.9 keeps it in Week 4. axe-in-CI (Phase 1) is this week's floor, not the audit.
- **Refactoring `lesson_type` away.** Phase 2 step 2 is a deliberate decision to keep it; revisit only when blocks have proven themselves.

---

## Week 2 risk watchlist

| Risk | Watch for | Mitigation this week |
|---|---|---|
| **The gating suite passes without testing anything.** The classic failure: assertions that never could have failed. | A test that stays green when you delete the check it guards. | Non-negotiable #9 — every test observed red first, listed in the PR. |
| **Case 9/10 written from the old paywall model.** A test that asserts question bodies are hidden would fail a correctly-behaving system and invite someone to "fix" §21.3. | Any test asserting a question body is absent from HTML. | The §58.2 table above states the exemption inline; repeat it in the test's own docstring. |
| **The block migration silently changes live content.** Three lessons exist and one course has been sold. | Any rendering difference before/after backfill. | Phase 2 step 3's explicit before/after check is a gate, not a nicety. |
| **A domain pack that sells something already free.** The fastest possible way to lose buyer trust. | Product copy that implies the questions are unlocked by purchase. | Phase 3 step 6 — say it plainly on the product page. |
| **Legal drafts read as final.** | Any page without the `[DRAFT — FOR REVIEW]` marker. | Phase 4 step 4, and the caveat repeated in the handover pack. |
| **Analytics collecting PII into a third party** before the privacy policy names it. | Any event property beyond a user id. | Policy written first (step 2), instrumentation second (step 7) — deliberate ordering. |
| **Decision #15 (account ownership) still unanswered at Week 4.** | Nothing technical fails; handover does. | Escalate on Day 1, not Week 4. |
| **Data loss once there are real customers.** The 2026-08-12 wipe was intentional and cost nothing. An unintentional one after the first live order would destroy purchase records there is no way to reconstruct. | Supabase's free tier has no point-in-time recovery. | Name PITR (Pro tier) as a cost **before** the first live transaction, per the brief's "every recurring fee is named and justified". Ties to decision #21. |
| **Stripe still in test mode at launch.** | `rk_test_` in production env. | Decision #21 — make it an explicit call, not a discovery. |
| **IP provenance of the vendor-risk template files.** The six files in Storage carry an `IC-…-10772` naming pattern typical of a third-party template library. The brief's non-negotiable is "the author's voice and IP… published work under a real name". Selling a third party's template as your own is a different problem from any bug on this list. | Any paid artefact whose origin you cannot state. | **Owner confirmation before the A$39 product takes real money.** It is live in *test* mode only; unpublishing is one flag. |

---

## Quick-reference

### New this week
`pytest` · `pytest-asyncio` · `httpx` · `vitest` · `@testing-library/react` · `@playwright/test` · `@axe-core/playwright` · `posthog-js` · GitHub Actions CI

### New migrations
`008_lesson_blocks` (blocks table + backfill of the 3 existing lessons)

### New routes
`/store` · `/terms` · `/privacy` · `/refunds` · `/admin/orders`

### New product type
Domain pack — a `product` with `question_set` grants for a domain plus a `template` grant for its PDF artefact. **No new entitlement mechanism** (Research 5.6).

### The one command that matters
```
pytest && npm run test && npx playwright test
```
If that is green, the paywall holds. If it is red, nothing else this week counts.

---

*This plan operationalises Week 2 against `DESIGN.md`, the Research Specification and the Product Spec. It deliberately re-scopes §60's original Week 2, because most of that scope was pulled forward and completed during and after Week 1 — the exception being the gating suite, which §60 itself insists must not slip to Week 4. Where this plan and `DESIGN.md` disagree on sequence, `DESIGN.md` §60.1's cut order governs what gets dropped if the week gets tight.*


Things I put in deliberately
A "prove it can fail" rule (Non-negotiable #9). A gating suite that passes because its assertions can't fail is worse than no suite — it manufactures confidence. Every test gets seen red first.

A warning about §58.2 cases 9 and 10. They invert the usual rule: a question body being publicly present in HTML is correct now (§21.3). A test written from the old paywall model would fail a correctly-behaving system and invite someone to "fix" it back. That's flagged in the case table, the risk watchlist, and as a required test docstring.

A gate on the block migration. Three lessons exist and a course has been sold. Phase 2 step 3 makes "renders identically to before" a blocking check, not a nicety.

Keeping lesson_type. Dropping it when blocks arrive would break the outline, the library's readiness checks, and the publish guards in one migration. It becomes a display hint.

Eight decisions I need from you
Five block Day 1 — most urgently #18: was the data wipe intentional? If not, stop and check Supabase backups before Phase 0 recreates accounts over it. Also the Gmail app password (#14), the refund policy position (#17 — Australian Consumer Law rules out a blanket "no refunds"), and #15: who owns the hosting accounts — asked on Day 1, asked again, still unanswered, and now the largest non-technical risk on the project.

Three by Day 3: what a domain pack actually contains, the second paid template, and whether Stripe goes live this week.

Two caveats worth stating plainly: the 99 previews and the domain-pack PDF are content work in your voice — I can prepare the previews as an editing worksheet rather than a blank page, but I shouldn't write them. And the legal drafts are a starting point for a lawyer, not a substitute for one.

