# Week 1 Implementation Plan — "Deciding in the Dark" Platform
**The Slice · Days 1–5 · v1.1**

*Derived from `Deciding_in_the_Dark_Platform_Intern_Brief.md` (Week 1 — the slice) and `Deciding_in_the_Dark_Research_Specification.md` (Executive Summary, Parts Five–Seven, Ten, Twelve, Thirteen, Appendices A, B, C, F, G, J, M).*

---

## Stack

Per your direction: **React (Vite, TypeScript) + FastAPI (Python) + Tailwind CSS**, as a decoupled frontend/backend rather than a single integrated framework.

- **Frontend:** React (Vite, TypeScript), Tailwind CSS — deployed on **Vercel**
- **Backend/API:** FastAPI (Python) — deployed on **Render**, owning all entitlement checks, the Stripe webhook, Mux signed-JWT generation, and R2 presigned-URL generation. This is the sole source of truth for access control; React renders only what this API returns.
- **Database/Auth:** Supabase (PostgreSQL, Row-Level Security, Auth) — React calls Supabase Auth directly for sign-up/sign-in; FastAPI verifies the resulting JWT on every call rather than relying on a Next.js-style SSR helper.

TypeScript (not plain JavaScript) is used on the frontend: the seven-tag taxonomy, Stripe/webhook payload shapes, and FastAPI response contracts are exactly the kind of thing a type checker catches at build time that a four-week timeline can't afford to catch at runtime.

Every non-negotiable from the brief applies identically regardless of framework — server-side entitlement checks, no card data touching our code, signed video only, no secrets in the repo. What a decoupled stack changes is *where* that code lives (FastAPI, not a single integrated backend) and *what new failure modes it introduces* (CORS between two services, secrets split across two environments) — both addressed explicitly below.

---

## How to use this document

This is an execution plan, not a restatement of the research. Every day below ends with a **Definition of Done** you can check against without judgement calls, and a **Do not proceed if** condition — because per the brief, "ugly is acceptable this week, broken is not," and a soft Week 1 that quietly slips is the single highest-leverage risk on this project.

Read the **Open Decisions Needed From You** section first. Several of Day 1's tasks are blocked until you answer them — that is intentional, per the brief's own instruction to confirm brand, domain, and content values on day one, "not invent one."

---

## Open decisions and inputs needed from you (owner)

Nothing below is a formality. Each row blocks a specific, named task later in this plan.

### Blocking — needed before Day 1 work begins

| # | Decision needed | Why it blocks Day 1 |
|---|---|---|
| 1 | **Brand name and domain.** Confirmed, not invented by me. **PROVIDED:**
   - **Brand name:** Practicable
   - **Tagline:** "Practicable: Practical answers for risk practitioners" | Vercel project, GitHub repo(s), Render service name, Stripe account display name, email sending domain, and every public-facing string depend on this. |
| 2 | **The five domain names** (the book's five risk domains — exact titles as they should appear to a buyer). **PROVIDED:**
   - Governance & Leadership
   - Risk Management & Decision-Making
   - Compliance & Regulatory
   - Technology, Security & Resilience
   - AI Governance & Emerging Technology | The database schema (`domains` table) is built Day 1–2. Changing a domain name after content is loaded is a migration, not an edit. |
| 3 | **Authoritative values for all seven tags** (the exact enum values for effort, duration, cost, payback, tier, regulator pressure, leadership traits — the actual finalised lists, not examples). **PROVIDED:**
   - **Effort:** low, medium, high, very_high
   - **Duration:** days, fortnight, 1_3_months, 3_6_months, 6_12_months, 12_plus_months
   - **Cost:** one, two, three, four, five (displayed as $, $$, $$$, $$$$, $$$$$)
   - **Payback:** immediate, short_term, medium_term, long_term, indirect
   - **Tier:** baseline, improve, advance, reimagine
   - **Regulator pressure:** none, low, moderate, high, direct_requirement
   - **Leadership traits (multi-select):** accountability, courage, clarity, collaboration, curiosity, discipline, empathy, judgement, influence, resilience | The `questions` table schema is committed Day 1–2 with these as enums. |
| 4 | **Contracting entity** — who legally accepts payment? **PROVIDED:** I personally | Determines the Stripe account country/entity, the name on receipts and the terms of service, and cannot be changed trivially after the Stripe account exists and has processed transactions. |
| 5 | **Currency** (AUD by default given the Australian context, unless you specify otherwise). **PROVIDED:** AUD by default, with options for USD, GBP, EUR | Set once at Stripe Checkout and product-price configuration; changing it later means re-creating every Stripe Price object. |
| 6 | **One real question, with real guidance text and all seven tag values filled in** — the single question that goes into the Week 1 slice. Not a placeholder. **PROVIDED:**
   - **Question ID:** Q001
   - **Domain:** Risk Management & Decision-Making
   - **Title:** We Have a Risk Register, But No One Uses It
   - **Subtitle:** How do you make a risk register that people actually use?
   - **Body:** Most risk registers fail because they live in a spreadsheet that is owned by the risk team and read by no-one. The fix is to make the register useful in decisions people are already making, not a parallel artefact for compliance. Five moves change the dynamic. First, link every risk to a live business objective so it ties to something the executive cares about. Second, assign business owners, not risk team members - risk facilitates, the business owns. Third, surface the top risks in monthly operating meetings with trend arrows, not in a quarterly risk-only forum. Fourth, embed the register where decisions happen - strategy reviews, project gates, investment committees. Fifth, archive stale risks ruthlessly; a register of 400 risks signals nothing, a register of 25 live risks demands attention. ISO 31000 frames this as integrating risk into governance and decision-making rather than treating it as a process. Practitioners who get this right keep the register short, current, and visibly used by the people whose names are on it.
   - **Tags (using new taxonomy):**
     - Effort: medium
     - Duration: 3_6_months
     - Tier: baseline
     - Cost: one ($)
     - Payback: short_term
     - Regulator pressure: low
     - Leadership traits: accountability, collaboration, courage | The brief explicitly prohibits "test test," "asdf," or placeholder content — it hides bugs in overflow, gating, and checkout that only show up with real-length text. |
| 7 | **One real lesson's worth of content** — the actual video (or a script/talking points I can film informally if a polished video isn't ready) and the actual template file (a real PDF/Excel artefact, not a stub), plus its real price. **STATUS:** Will provide before starting | This is what gets uploaded to Mux and Cloudflare R2 on Day 3 and sold through Stripe on Day 4. A stand-in file with a placeholder price does not prove the commerce path the brief is testing. |

**If any of #1–3, 6, or 7 are not available by Day 1 morning, Day 1 does not proceed as planned** — this is a scope conversation to have immediately, per the brief's own instruction, not something to work around with a placeholder.

### Needed by Day 3 (does not block Day 1, but blocks Day 3–4 if not resolved by then)

| # | Decision needed | Why |
|---|---|---|
| 8 | **Guest checkout, or account-required before purchase?** Recommendation: account-required for v1 (simpler entitlement linking) — confirm or override. | Affects the Stripe Checkout configuration and the sign-up flow order built Day 2–4. |
| 9 | **Who creates/owns the third-party accounts** — Vercel, Render, Supabase, Stripe, Mux, Cloudflare, Resend? Under a company billing account, or created by me and handed over at the end of Week 1? | Every recurring fee must be "named and justified before you commit," per the brief's non-negotiable — this includes Render (~$7/month) alongside Vercel. |
| 10 | **GitHub organisation/repo access** — one monorepo, or separate frontend/backend repos, and who needs access from day one? | Blocks nothing technical, but blocks handover continuity if only I have access. |

### Nice to have before Day 5, not blocking

| # | Decision needed |
|---|---|
| 11 | Any existing brand assets (logo, exact brand colours, an existing typeface preference) — if none exist yet, Week 1 proceeds on the placeholder design tokens below and these get swapped in later without a rebuild. |
| 12 | Confirmation you're available for a short async review of the one real question/lesson/template before it goes live in the Week 1 demo — per the brief, "get anything public reviewed before it ships." |
| 13 | Preferred channel and time for the daily short note (what moved / what's blocked / what I decided) — the brief specifies daily written check-ins, not a weekly call. |

---

## Week 1 objective

One complete, working, ugly-is-fine path, proven with a real Stripe test card:

> **Sign up → see one real question with all seven tags → find the related course → watch one signed video lesson → buy one real template through Stripe Checkout → receive a receipt email → download the file → confirm a logged-out user is blocked from all of it.**

This is **Auth → Purchase → Entitlement check → Signed video playback → Gated download → Receipt email.** If every link in that chain works by Friday, Week 2 is widening a proven path. If one link is missing, Week 2 becomes Week 1 again.

### Definition of Done for Week 1 (all must be true)

- [ ] A stranger can sign up with a real email and password (React calling Supabase Auth directly).
- [ ] A logged-in, non-entitled user cannot view the gated video or download the gated file (direct FastAPI endpoint call, direct URL, and UI all fail closed).
- [ ] A real Stripe **test** card completes checkout for the one real template product.
- [ ] The Stripe webhook, received by FastAPI, creates an `ENTITLEMENT` row — verified in the database, not assumed.
- [ ] A receipt email actually arrives in a real inbox within ~30 seconds.
- [ ] The now-entitled user can download the real template file via a presigned R2 URL, obtained by calling a FastAPI endpoint.
- [ ] The now-entitled user can watch the one real video lesson via a signed Mux JWT, obtained by calling a FastAPI endpoint.
- [ ] The React frontend (Vercel) and FastAPI backend (Render) are both deployed, and React can successfully call the deployed FastAPI without a CORS error.
- [ ] The whole path has been walked once, start to finish, on a phone-sized viewport — not just desktop.
- [ ] Nothing above depends on a manual database edit to "make it work for the demo."
- [ ] Nothing built this week creates a foreseeable rewrite when a second course, domain, or product type is added later (see **Scalability and extensibility**, below).

**Do not proceed to Week 2 planning if any box above is unchecked.** Escalate the same day — this is a scope conversation, not a late night.

---

## Scalability and extensibility — a standing requirement, not a Week 1 task

**The system must always be scalable (for new features) and extensible.** This applies from Day 1, not from the week a second subject actually gets built. Concretely, for this week:

- Build the **full database schema** (every entity, Phase 1) even though Week 1 only populates a fraction of it — a second course, domain, or product type should be a data-entry task in Week 2+, not a schema change.
- Keep `Product` price and metadata **separate from content** — a template's price lives on its `Product` row, never hard-coded into the template or the checkout call.
- Route all access control through the single `ENTITLEMENT` table, checked in FastAPI — never a bespoke, feature-specific check. A second product type (a course, a bundle) must be able to reuse this same mechanism without a parallel one being invented for it.
- Where a Week 1 shortcut would violate any of the above under time pressure (e.g. hard-coding a value that should be a foreign key), that's a named trade-off to flag in the daily note, not something to take silently — see Non-negotiable #7 below.

---

## Scope guardrails — what NOT to build this week

- Multiple courses, modules, or lessons — one of each only.
- The full question-discovery / multi-tag filter UI. Week 1 needs exactly one question page to exist and be reachable.
- Admin CRUD interface (Week 3). Content goes in via Supabase Studio directly this week.
- Progress tracking / resume (Week 2).
- Multiple products, bundles, or pricing tiers — one template product only.
- Certificates of any kind — not cheap to add correctly; do not start.
- Polished visual design — but **do** apply the Week 1 design tokens (below) from the first screen, since retrofitting consistency later never works.
- Analytics instrumentation beyond what's trivial to add alongside — full instrumentation is a Week 2 task.
- Semantic search, AI features, subscriptions, team licensing — all explicitly later.
- **Any attempt to consolidate the frontend and backend onto one host/one framework "to save time."** The two-service split was an explicit decision — if it's genuinely slowing Week 1 down, that's a scope conversation to have, not a unilateral reversion mid-build.

---

## Non-negotiables in force from Day 1

1. **Never handle card data.** Stripe Checkout only, hosted. No custom payment form, ever.
2. **Video through Mux, signed playback only.** Never a public video file.
3. **Server-side entitlement checks only, in FastAPI.** A client-side "if (hasAccess)" in React is not a control — it is, at best, a UX nicety layered on top of a real FastAPI check.
4. **No secrets in either repo.** `.env.local` (frontend) and `.env` (backend), both gitignored, from the first commit. Backend secrets (Stripe, Mux, Supabase service role, R2) live only in Render's environment variables — never in Vercel's, since anything in a Vercel env var can end up in the browser-shipped JS bundle.
5. **No test/placeholder content in anything a reviewer might see** — real question text, real price, real file.
6. **CORS on FastAPI restricted to the known frontend origin(s) only** — never a wildcard `*`.
7. **The system must always be scalable and extensible.** Any shortcut that would compromise this needs the owner's explicit sign-off before it ships, not a silent trade-off under deadline pressure.

---

## Phase 1 — Day 1: Foundations, Accounts, and Schema Draft

**Objective:** Every account exists, both projects boot, and the full database schema is drafted and reviewed with you — before any feature code is written.

### Step-by-step

1. **Confirm decisions #1–7** from the Open Decisions section above. Do not proceed past this step without them.
2. **Create accounts** (or confirm access, per decision #9): Vercel, Render, Supabase, GitHub, Stripe (test mode), Mux, Cloudflare (R2 bucket), Resend.
3. **Scaffold the frontend:** `npm create vite@latest` (React, TypeScript); install Tailwind CSS per Vite's official setup, plus `@supabase/supabase-js` and a fetch wrapper for calling FastAPI. Push to GitHub, connect to Vercel.
4. **Scaffold the backend:** Python virtual environment; install `fastapi`, `uvicorn`, `supabase` (or `psycopg2`/`sqlalchemy`), `python-jose`/`pyjwt` (JWT verification), `stripe`, `mux-python`, `boto3` (R2), `resend`. A minimal `/health` endpoint. Push to GitHub, connect to Render.
5. **Set up environment variables**, split correctly (never mixed):
   - **Frontend (`.env.local` → Vercel):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL`.
   - **Backend (`.env` → Render):** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `RESEND_API_KEY`, `ALLOWED_ORIGIN`.
6. **Configure FastAPI's CORS middleware** immediately, restricted to the Vercel URL and `localhost:5173` — do this Day 1, not when the first cross-origin error appears.
7. **Establish the Week 1 design tokens** in the Tailwind config — type scale (12/14/16/20/25/31/39px), 4px-based spacing scale, a placeholder 1 primary + 1 accent + neutral-grey + success/warning/error colour set, **sans-heading/serif-body typeface pairing** (Bricolage Grotesque for display/UI, Source Serif 4 for long-form reading — the `[DECIDED]` pairing in `DESIGN.md` §7/§9, chosen over the research spec's original serif-heading placeholder). Placeholder hex values, swappable for real brand colours later, not redesigned later.
8. **Draft the full database schema** — every entity (`users`, `sections`, `authors`, `domains`, `questions`, `question_relations`, `tag_values`, `courses`, `modules`, `lessons`, `templates`, `question_templates`, `question_lessons`, `products`, `product_contents`, `orders`, `order_items`, `entitlements`, `lesson_progress`), even the ones Week 1 won't populate — this is what makes a second course in Week 2 configuration instead of a migration (see Scalability, above). Note `tag_values` and `product_contents`, not a `bundle_items` table: per `BACKEND.md` §1.4/§8, the seven tag dimensions are **rows in a `tag_values` reference table, not Postgres/Python enums**, so the owner can add or rename a value without a deploy; and a bundle is just a `product` with multiple `product_contents` rows, needing no separate mechanism.
9. **Review the schema with you** — specifically the `questions` table's seven tag **reference values** (decision #3, seeded into `tag_values`, not hard-coded as enums) and the `domains` seed rows (decision #2). Get explicit sign-off before running the migration.
10. **Run the migration** in Supabase; enable Row-Level Security on every user-data table immediately.

### Definition of Done — Day 1

- [ ] All required accounts exist and credentials are correctly split between `.env.local` (frontend) and `.env` (backend).
- [ ] `npm run dev` (frontend) and `uvicorn` (backend) both run locally; the frontend can call the backend's `/health` endpoint without a CORS error.
- [ ] The full schema is migrated into Supabase, with RLS enabled on user-data tables.
- [ ] You have reviewed and approved the domain names and tag reference values (`tag_values` rows) in the actual schema, not a proposal.
- [ ] Blank deploys are live for both services.

**Do not proceed to Day 2 if:** the schema has not been reviewed with you, any account/credential is missing, or the frontend cannot reach the backend locally.

---

## Phase 2 — Day 2: Authentication and the First Real Content

**Objective:** A real user can sign up and sign in via Supabase Auth (called directly from React), FastAPI can verify the resulting session token, and the one real question and one real course/module/lesson skeleton exist in the database.

### Step-by-step

1. **Implement Supabase Auth in React**: sign-up, sign-in, sign-out, calling Supabase's JS client directly. Attach the resulting JWT as `Authorization: Bearer <jwt>` on every FastAPI call.
2. **Implement the FastAPI auth dependency**: verifies the JWT against `SUPABASE_JWT_SECRET`, extracts the user ID — used by every protected endpoint from here on. Build and test this in isolation first.
3. **Build the auth pages using the Week 1 design tokens** — Button, Card, Form-input components built once, reused everywhere.
4. **Insert the one real domain row and the one real question row** with its real guidance text and all seven real tag values — via Supabase Studio directly; no admin UI yet.
5. **Insert the one real course → module → lesson (type: video)** skeleton rows.
6. **Smoke-test auth end to end**: sign up, session persists on refresh, a protected FastAPI test endpoint returns the correct user ID when called with a valid token, sign out, and — critically — calling the protected FastAPI endpoint **without** a token returns 401.

### Definition of Done — Day 2

- [ ] A real account can be created, signed into, and signed out of via Supabase Auth, session surviving a refresh.
- [ ] A logged-out visit to a placeholder member-area route redirects to sign-in.
- [ ] A logged-out direct call to the protected FastAPI test endpoint returns 401 — proven with a real request, not assumed from the UI.
- [ ] The one real question and the course → module → lesson skeleton exist in Supabase.

**Do not proceed to Day 3 if:** the FastAPI 401 check does not work. Every later gating check builds on this exact pattern.

---

## Phase 3 — Day 3: The Content Slice — Video, Reading, and the Template Product

**Objective:** The one lesson has a real, signed-playback video; the one template exists as a real, gated file; both are served through FastAPI endpoints that will (Day 4) enforce entitlement.

### Step-by-step

1. **Upload the one real video** to Mux; confirm it finishes processing and returns a playback ID.
2. **Build `GET /lessons/{id}/playback-token`** in FastAPI — will verify the JWT and generate a signed Mux JWT (15–30 min expiry) once entitlement checking is wired Day 4. Build the shape now.
3. **Build the React lesson page** using `<MuxPlayer>`, calling this endpoint — never call Mux directly from React, never let React hold a Mux secret.
4. **Upload the one real template file** to R2; create the `templates` row.
5. **Build `GET /templates/{id}/download-url`** in FastAPI — generates an R2 presigned URL (60-second TTL) once entitlement checking is wired Day 4.
6. **Build the React question page** — tags visible, body text present, links to the related course.
7. **Wire the related-question → course → template links** so the journey is clickable end to end.

### Definition of Done — Day 3

- [ ] The video plays via `<MuxPlayer>` using a signed JWT from the FastAPI endpoint (verify in the network tab — React calls FastAPI, not Mux directly).
- [ ] The FastAPI presigned-URL endpoint returns a working, time-limited download link when called directly.
- [ ] The question, course, and lesson pages exist and link to each other correctly.

**Do not proceed to Day 4 if:** the video plays from an unsigned or non-expiring URL, or React ever calls Mux/R2 directly instead of going through FastAPI.

---

## Phase 4 — Day 4: The Commerce Slice — Stripe, Webhook, Entitlement, Gating, Email

**Objective:** Money moves. A real Stripe test-card purchase, processed by FastAPI, creates an entitlement — and that entitlement is what, and only what, unlocks the video and download endpoints.

### Step-by-step

1. **Create the Stripe Product and Price** for the one real template, at its real price, in test mode.
2. **Build `POST /checkout/session`** in FastAPI — creates a Stripe Checkout Session and returns the URL to React, which redirects. Never build a custom card form.
3. **Build `POST /webhooks/stripe`** — verify the `stripe-signature` header with `stripe.Webhook.construct_event()`; reject anything unsigned.
4. **Make the webhook handler idempotent** — check for an existing entitlement before inserting.
5. **Test the webhook locally** with the Stripe CLI before testing against the deployed app.
6. **On success, create the `ENTITLEMENT` row** (`granted_via: 'purchase'`).
7. **Wire the entitlement check** into both Day 3 endpoints — they now query `entitlements` for the authenticated user before generating the Mux JWT or R2 URL.
8. **Wire the "Buy now" button** in React to the Checkout Session endpoint.
9. **Build and trigger the Resend receipt email** from the webhook handler — plain HTML/Jinja2 rendered in Python, sent via Resend's Python SDK (not a React Email component, which cannot render inside FastAPI). Real subject, amount, product name.
10. **Configure DKIM/SPF** on the sending domain in Resend.

### Definition of Done — Day 4

- [ ] "Buy now" reaches Stripe's real hosted checkout for the real product/price via the FastAPI-created session.
- [ ] A Stripe **test** card (`4242 4242 4242 4242`) completes checkout and redirects back.
- [ ] The webhook fires, signature verifies, and an `ENTITLEMENT` row appears in Supabase — checked directly, not inferred.
- [ ] Sending the same webhook event twice does **not** create a second entitlement row.
- [ ] A receipt email with real details arrives.
- [ ] Before purchase: both FastAPI endpoints return 403 for that user. After purchase: both succeed, for that user only.

**Do not proceed to Day 5 if:** a non-entitled logged-in user can still reach the video or download by any route.

---

## Phase 5 — Day 5: Integration, the Stranger Test, and Go/No-Go

**Objective:** Prove the whole chain end-to-end, on a real device, against both deployed services, and make an honest go/no-go call.

### Step-by-step

1. **Run the full smoke test** below locally first.
2. **Deploy both services** — React to Vercel production, FastAPI to Render (Starter tier, not free — the free tier's cold start is not acceptable for a live checkout flow). Update `ALLOWED_ORIGIN` and `VITE_API_BASE_URL` to point at each other's real URLs, redeploy both.
3. **Specifically re-verify CORS in production** — confirm a request from the deployed Vercel URL succeeds, and a request from an arbitrary other origin is rejected.
4. **Repeat the full smoke test against production**, desktop then mobile.
5. **Deliberately try to break the gating**: direct FastAPI calls with a valid-but-non-entitled JWT, a missing JWT, a tampered JWT. Log what you tried.
6. **Write the Day 5 / end-of-Week-1 report** and send it with an honest go/no-go recommendation.
7. **Get an explicit go/no-go response** before treating Week 1 as closed.

### The end-to-end smoke test script (run this literally, in order)

1. Open the site in a private/incognito window.
2. Navigate to the one real question's page. Confirm tags are visible.
3. Click through to the course, then the lesson. Confirm the video does **not** play (logged out).
4. Sign up with a real, new email and password.
5. Return to the lesson. Confirm the video **still does not play** (logged in, not entitled).
6. Navigate to the template product page. Click "Buy now."
7. Complete Stripe Checkout with a test card, real-looking billing details.
8. Confirm redirect back with a clear "purchase complete" state.
9. Check the inbox: confirm the receipt email arrived with correct details.
10. Return to the lesson: confirm the video **now plays** via the FastAPI-issued signed URL.
11. Return to the download: confirm it **now works**, and expires after 60+ seconds if retested.
12. Open a **second**, logged-out session. Call both FastAPI endpoints directly with no token, and separately with a non-entitled account's token. Confirm both fail closed (401 / 403).
13. Repeat steps 1–12 on a real mobile device.

**Definition of Done — Day 5 / Week 1 overall:**

- [ ] The smoke test passes in full, desktop and mobile, against production.
- [ ] CORS is confirmed correctly restricted, not just "not currently broken."
- [ ] Deliberate gating-break attempts all failed closed, or any that didn't are logged as a named, owned bug.
- [ ] The Week 1 report is written and sent with an explicit go/no-go recommendation.
- [ ] You have responded with a go/no-go decision.

**If the answer is "no-go":** this is a scope conversation to have immediately — not a reason to quietly extend into Week 2's time.

---

## Week 1 risk watchlist

| Risk | Watch for |
|---|---|
| **Content protection.** The one non-negotiable in the whole brief. | Any point where a video or download URL works without a fresh, valid, FastAPI-enforced entitlement check. |
| **Silent webhook failure.** A customer pays, gets nothing, nobody notices. | Test with the Stripe CLI before relying on a live test; enable Stripe's webhook-failure email alert Day 4. |
| **CORS misconfiguration between the two services.** Fails silently in a way that looks like "the API is down." | Explicitly test cross-origin behaviour in Day 5, not just "it worked when I clicked around." |
| **A backend secret leaking into the frontend build.** Two `.env` files makes this easier to get wrong than one. | Audit the Vercel environment variables before Day 5's deploy — Supabase URL/anon key and API base URL only. |
| **Render free-tier cold starts**, if used before decision #9 resolves who's paying for Starter. | Confirm which Render tier is active before Day 4's checkout testing begins. |
| **Supabase free-tier project pausing after 7 days idle.** A build-phase risk, not just a launch-time one. | If idle over a weekend inside the four weeks, upgrade to Pro or set a reminder. |
| **Placeholder content hiding real bugs.** | Use the real content and real price from Day 1, per decisions #6–#7. |
| **Client-side-only gating checks.** Easier to write by accident in a decoupled SPA than in a framework with a server-component default. | Every entitlement check in Days 3–4 must be inside FastAPI. |
| **A shortcut that quietly compromises scalability/extensibility** — e.g. a hard-coded value that should be a foreign key. | Flag it in the daily note rather than taking it silently under deadline pressure (Non-negotiable #7). |

---

## Communication and check-in cadence

- **Daily, end of day:** a short written note — what moved, what's blocked, what was decided.
- **The same day confidence drops** on any Definition of Done item — not the following day.
- **End of Day 1:** schema sign-off, explicitly requested above.
- **End of Day 5:** the Week 1 report and go/no-go request.
- **Anything public** gets a review pass from you before it's part of the Day 5 smoke test.

---

## Quick-reference

### Stack
React (Vite, TypeScript) + Tailwind CSS, on Vercel · FastAPI (Python), on Render · Supabase (Postgres + Auth + RLS) · Stripe (Checkout + webhooks) · Mux (signed JWT video) · Cloudflare R2 (presigned downloads) · Resend (plain HTML/Jinja2 templates, Python SDK)

### Entity list for the Day 1 schema
`users` · `sections` · `authors` · `domains` · `questions` · `question_relations` · `tag_values` · `courses` · `modules` · `lessons` · `templates` · `question_templates` · `question_lessons` · `products` · `product_contents` · `orders` · `order_items` · `entitlements` · `lesson_progress`

`tag_values` (not enums) and `product_contents` (not a separate `bundle_items`) per `BACKEND.md` §1.4/§8 — see Phase 1, step 8.

### Environment variables

**Frontend (`.env.local` → Vercel):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL`

**Backend (`.env` → Render):** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `RESEND_API_KEY`, `ALLOWED_ORIGIN`

**Never cross these two lists** — a backend secret in the frontend list ships to every visitor's browser.

### Gating flow to build
```
AUTH:              React → Supabase Auth directly → JWT stored in React,
                   attached as Authorization: Bearer <jwt> on every FastAPI call

VIDEO REQUEST:     React → FastAPI GET /lessons/{id}/playback-token
                   → verify JWT → check ENTITLEMENT (server-side, in FastAPI)
                   → entitled: generate Mux signed JWT (≤30 min) → return to React → play
                   → not entitled: 403 → React shows product page / CTA

DOWNLOAD REQUEST:  React → FastAPI GET /templates/{id}/download-url
                   → verify JWT → check ENTITLEMENT (server-side, in FastAPI)
                   → entitled: generate R2 presigned URL (≤60 sec) → return to React → browser fetches from R2
                   → not entitled: 403

WEBHOOK:           Stripe → FastAPI POST /webhooks/stripe
                   → verify signature → idempotency check
                   → create ENTITLEMENT → trigger Resend email (Python SDK)
```

---

*This plan operationalises Week 1 of `Deciding_in_the_Dark_Research_Specification.md`, for the React + FastAPI stack and the standing scalability/extensibility requirement. It does not restate the reasoning behind the stack or content-model choices — see the research specification for that.*
