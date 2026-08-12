# Week 1 Implementation Plan — "Deciding in the Dark" Platform
**The Slice · Days 1–5 · v1.1**

*Derived from `Deciding_in_the_Dark_Platform_Intern_Brief.md` (Week 1 — the slice), `Deciding_in_the_Dark_Research_Specification.md` (Executive Summary, Parts Five–Seven, Ten, Twelve, Thirteen, Appendices A, B, C, F, G, J, M), `DESIGN.md` (§7–§10, §33–34, §51, §60, §80–82) and `BACKEND.md` (§1–§2, §4, §8, §15).*

---

## Stack

Per your direction: **React (Vite, TypeScript) + FastAPI (Python) + Tailwind CSS**, as a decoupled frontend/backend rather than a single integrated framework. The frontend package list below is `DESIGN.md` §51's `[DECIDED]` stack, not a placeholder — install it in full on Day 1, not incrementally as each screen needs a new library.

- **Frontend:** React 19 (Vite 7, TypeScript, strict mode) — deployed on **Vercel**
  - Styling: Tailwind CSS v4 (`@tailwindcss/vite`, CSS-first `@theme`, no `tailwind.config.js`) + shadcn/ui (New York, CSS variables, neutral base) + `class-variance-authority` + `clsx`/`tailwind-merge` + `lucide-react` + `motion` (`motion/react`)
  - Routing: **`react-router` v8** (data mode, `createBrowserRouter`) — **not** `react-router-dom`, which was removed in v8; see `DESIGN.md` §51.6
  - Data/state: `@tanstack/react-query` v5 (server state) + `zustand` v5 (client-only UI state) + `axios` (HTTP, JWT interceptor) + `zod` + `react-hook-form`/`@hookform/resolvers` (forms)
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
   - Risk (Enterprise & op.)
   - Cyber (Tech & security)
   - Compliance (Regulatory)
   - Resilience (Continuity)
   - AI (Governance) | The database schema (`domains` table) is built Day 1–2. Changing a domain name after content is loaded is a migration, not an edit. |
| 3 | **Authoritative values for all seven tags** (the exact enum values for effort, duration, cost, ROI horizon, tier, regulator pressure, leadership traits — the actual finalised lists, not examples; renamed from "payback" to "ROI horizon" to match the label actually used in the 100 real questions, `Deciding_in_the_Dark_100_Questions.md`). **PROVIDED:**
   - **Effort:** Quick (Days to weeks), Mod. (Weeks to months), Project (Multi-month), Trans. (Year+ change)
   - **Duration:** XS (Under 2 weeks), S (2–6 weeks), M (6–12 weeks), L (3–6 months), XL (Over 6 months)
   - **Cost:** $ (Low investment), $$ (Medium investment), $$$ (High investment)
   - **ROI horizon:** Quick, Mid, Strategic *(matches the 100-question content exactly; note "Strategic" is also a Tier value and a Leadership trait — a deliberate, accepted overlap, not a typo — so it must stay dimension-scoped in `tag_values`, never rendered as a bare unlabelled badge)*
   - **Tier:** F (Foundational basics), T (Tactical improvements), S (Strategic uplift), X (Transformational)
   - **Regulator pressure:** N (None), L (Low), M (Moderate), H (High pressure)
   - **Leadership traits:** 1 (Accountability), 2 (Change), 3 (Collaboration), 4 (Technical), 5 (Strategic) | The `questions` table schema is committed Day 1–2 with these as enums. |
| 4 | **Contracting entity** — who legally accepts payment? **PROVIDED:** I personally | Determines the Stripe account country/entity, the name on receipts and the terms of service, and cannot be changed trivially after the Stripe account exists and has processed transactions. |
| 5 | **Currency** (AUD by default given the Australian context, unless you specify otherwise). **PROVIDED:** AUD by default, with options for USD, GBP, EUR | Set once at Stripe Checkout and product-price configuration; changing it later means re-creating every Stripe Price object. |
| 6 | **One real question, with real guidance text and all seven tag values filled in** — the single question that goes into the Week 1 slice. Not a placeholder. **PROVIDED:**
   - **Question ID:** Q001
   - **Domain:** Risk (Enterprise & op.)
   - **Title:** We Have a Risk Register, But No One Uses It
   - **Subtitle:** How do you make a risk register that people actually use?
   - **Body:** Most risk registers fail because they live in a spreadsheet that is owned by the risk team and read by no-one. The fix is to make the register useful in decisions people are already making, not a parallel artefact for compliance. Five moves change the dynamic. First, link every risk to a live business objective so it ties to something the executive cares about. Second, assign business owners, not risk team members - risk facilitates, the business owns. Third, surface the top risks in monthly operating meetings with trend arrows, not in a quarterly risk-only forum. Fourth, embed the register where decisions happen - strategy reviews, project gates, investment committees. Fifth, archive stale risks ruthlessly; a register of 400 risks signals nothing, a register of 25 live risks demands attention. ISO 31000 frames this as integrating risk into governance and decision-making rather than treating it as a process. Practitioners who get this right keep the register short, current, and visibly used by the people whose names are on it.
   - **Tags:**
     - Effort: Mod. (Weeks to months)
     - Duration: M (6–12 weeks)
     - Tier: F (Foundational basics)
     - Cost: $ (Low investment)
     - ROI horizon: Quick
     - Regulator pressure: L (Low)
     - Leadership traits: 1 (Accountability), 3 (Collaboration), 2 (Change) | The brief explicitly prohibits "test test," "asdf," or placeholder content — it hides bugs in overflow, gating, and checkout that only show up with real-length text. |
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

**[POST-WEEK-1 UPDATE, 2026-08-11]** Several items this plan explicitly deferred to
Week 2 (Scope guardrails, below) have since been pulled forward and built: multiple
lessons per course with all three lesson types (video/reading/download), a real
learning interface (`/learn/:courseSlug/:lessonSlug` — sticky outline sidebar,
prev/next, progress), and lesson-level progress tracking with a live course-percentage
rollup. A module can also attach a question as a free syllabus item. Full detail in
`docs/handover.md` §1/§2 — this document's own Day 1–5 record below is left as-is,
since it's an accurate account of what Week 1 specifically proved, not a place to
retrofit later work into.

One related, deliberate product decision made the same day, overriding
`DESIGN.md` §23.3's "free preview lesson" recommendation: **video and lessons are
never free, with no exceptions** — a `Lesson.is_free_preview` bypass was built to
spec, then the column was dropped hours later (migration `005`) on direct owner
instruction. Only a question's written guidance is free (see the Research
Specification's §4.1/8.2 annotations for how that model itself changed from the
original "teaser paragraph" design to "full body, email-gated client-side").

**[POST-WEEK-1 UPDATE, 2026-08-12]** A second wave of work, again pulling items
forward from later weeks, and again recorded here rather than retrofitted into the
Day 1–5 record below:

- **The commercial model is now settled** (owner instruction, `DESIGN.md` §28.0):
  questions free · one template (Risk Register) free behind an email · other templates
  paid · courses paid. Migration `007` adds `templates.is_free`; the free template's
  download endpoint serves it with no account and no entitlement, because a server-side
  check on an unverified email address would be theatre. Consequence handled rather
  than ignored: the A$29 template product was **unpublished**, since it had come to
  charge for two things anyone can now have.
- **The template/course entitlement bug is fixed** — one product had bundled both, so
  a template purchase granted the whole course. Split into two separately-priced
  products (`db/seed/012`), existing buyers grandfathered, verified directly against
  the entitlement engine (template-only holder: template ✓, lessons ✗).
- **The admin content editor is built** (was Week 3) — see the Scope guardrails note.
- **My Library** (`/library`) — purchased items across all three content types with
  progress and resume.
- **Gmail SMTP added as the first email transport** (`docs/gmail.md`), after a real
  order delivered both of its emails from Resend's sandbox sender: the buyer received
  nothing and the owner received two, one of which was the buyer's receipt. The Resend
  fallback now labels a redirected copy `[Not delivered to buyer]` instead of letting
  it read as a normal receipt.
- **A layout bug worth recording** because it was invisible to every automated check:
  the member sidebar linked to `/questions`, `/courses` and `/templates`, which were
  registered under the *public* layout — so every click from the sidebar navigated out
  of the layout drawing the sidebar. Fixed by making the chrome follow the visitor
  (`CatalogueLayout.tsx`), **not** by putting the catalogue behind the auth guard,
  which would have broken the funnel to fix a cosmetic bug.

**A data note, not a build note:** on 2026-08-12 every user-data table was found empty
(`auth.users`, `users`, `orders`, `entitlements`, `lesson_progress`, `leads`,
`audit_log`), while all content tables were intact. This was an external wipe of the
Supabase Auth accounts, not a migration or a code path. It means the Week 1 evidence
below — the real buyer, the real order, the real entitlement — describes rows that no
longer exist. The verifications were genuine when made; the records are gone.
`backend/scripts/grant_admin.py` re-establishes an admin once an account exists again.

**[STATUS, updated 2026-08-11]** Every item in this chain is now either verified
working against real production infrastructure, or explicitly named as the one thing
left that only a human on a physical device can do. The three blockers named in the
previous version of this note — a human browser checkout, deployment account access,
and email sender verification — have all been resolved: both services are deployed
and live, real (not simulated) purchases have completed against production, and
receipt/owner-notification emails are delivering (via Mailjet, after Resend and
Brevo were each tried and found gated behind domain ownership or account approval —
see `docs/email.md`). What remains is genuinely just the mobile-viewport
click-through, below.

- [x] A stranger can sign up with a real email and password (React calling Supabase Auth directly). Verified with a real account; also just added a required name field to sign-up (captured into `users.name` via Supabase's `user_metadata`, previously always NULL).
- [x] A logged-in, non-entitled user cannot view the gated video or download the gated file (direct FastAPI endpoint call, direct URL, and UI all fail closed). Verified directly: `has_access_to()` returns `False` across all three resource types for a stranger user id, and the Mux playback URL returns 403/400 without a valid signed token.
- [x] A real Stripe **test** card completes checkout for the one real template product. **Now genuinely done** — not a synthetic `stripe trigger` event, a real completed Checkout session against production (`payment_status: paid`), confirmed directly against the Stripe API and cross-checked into a real `orders` row in Supabase for a real signed-up buyer.
- [x] The Stripe webhook, received by FastAPI, creates an `ENTITLEMENT` row — verified in the database, not assumed. Confirmed directly by querying Supabase: a real order, a real entitlement (`granted_via: purchase`), and a real `audit_log` row all landed correctly from a genuine, signature-verified webhook delivery — both from a synthetic `stripe trigger` event during earlier testing and, since, from a real completed purchase in production.
- [x] A receipt email actually arrives in a real inbox within ~30 seconds. **Resolved** — Resend's sandbox sender only ever reached one whitelisted test address (real buyers 403'd); Brevo was integrated next but its account sits in a manual-review "not yet activated" state pending Brevo's own approval (ticket submitted, not blocking). Mailjet, tried third, delivers to arbitrary real recipients immediately on a fresh free account — confirmed live, both the buyer receipt and the owner sale-notification email, delivered to a real non-whitelisted address with zero errors. `email_service.py` tries Mailjet → Brevo → Resend in order, so this upgrades further automatically if/when Brevo activates, with no code change needed.
- [x] The now-entitled user can download the real template file via a presigned R2 URL, obtained by calling a FastAPI endpoint. (R2 → Supabase Storage, see below.) Verified: fetched the actual presigned URL and downloaded the real 24,486-byte file.
- [x] The now-entitled user can watch the one real video lesson via a signed Mux JWT, obtained by calling a FastAPI endpoint. Verified about as completely as possible short of a browser: generated a real signed RS256 token server-side and used it to fetch the actual HLS manifest from `stream.mux.com` — 200 OK, English captions track present. Confirmed the negative case too: no token → 403, garbage token → 400.
- [x] The React frontend (Vercel) and FastAPI backend (Render) are both deployed, and React can successfully call the deployed FastAPI without a CORS error. **Done** — both services are live (`https://practicable.vercel.app`, `https://practicable.onrender.com/health` returns healthy). CORS confirmed in both directions directly against production: a preflight from the real Vercel origin succeeds (200), and one from an arbitrary origin is rejected (400, "Disallowed CORS origin") — not just "not currently broken," the restriction was actually exercised.
- [ ] The whole path has been walked once, start to finish, on a phone-sized viewport — not just desktop. **Not done** — needs a real device/browser. This is the one item in this entire Definition of Done that is not code, not infrastructure, and cannot be verified by any API call — it needs a human holding a phone.
- [x] Nothing above depends on a manual database edit to "make it work for the demo." The one manual insert made during this build (a `users` row, before `get_current_user`'s get-or-create path existed) is superseded — that path now creates the row itself on first API call from any new signup, same as it will for every future user.
- [x] Nothing built this week creates a foreseeable rewrite when a second course, domain, or product type is added later (see **Scalability and extensibility**, below).

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

- Multiple courses, modules, or lessons — one of each only. **[SUPERSEDED, 2026-08-11]** Multiple lessons per course (all three lesson types) and a real multi-module course are now built — see the post-Week-1 update above and `docs/handover.md`. Still true: only one *course* exists (a second is data entry, not new engineering).
- The full question-discovery / multi-tag filter UI. Week 1 needs exactly one question page to exist and be reachable. **[RECONCILED]** `DESIGN.md` §60 originally listed the functional discovery page as a Week 1 item too — the owner confirmed keeping this exclusion instead, deferring it to Week 2 so the five-day budget stays protected for the commerce chain. `theme.css`, the six core components, and header/footer/layout (also §60) remain Week 1 work regardless, since Day 1's design-tokens step (Phase 1, step 7) already covers them.
- Admin CRUD interface (Week 3). Content goes in via Supabase Studio directly this week. **[SUPERSEDED, 2026-08-12]** Built and live: 23 admin routes plus a React editor for questions, courses and templates (`/admin/*`), with the guard applied at the *router* level so a new endpoint cannot ship unauthenticated, and an `audit_log` row written on every mutation — that table had existed since migration 001 with zero writers. Content no longer goes in via hand-written SQL seed files. `DESIGN.md` §31.8 lists what was built **and what was not** (no autosave, no draft/review/archive states, no `/admin/orders`, video ids pasted rather than uploaded).
- Progress tracking / resume (Week 2). **[SUPERSEDED, 2026-08-11]** Lesson-level completion and a live course-percentage rollup are now built — see the post-Week-1 update above. **[EXTENDED, 2026-08-12]** Surfaced to the user as **My Library** (`/library`) — purchased items across all three content types, labelled by type, with a "continue where you left off" rail. `DESIGN.md` §30.4.
- Multiple products, bundles, or pricing tiers — one template product only. **[SUPERSEDED, 2026-08-12]** There are now two products, because the original single product was a real bug: it bundled the template *and* the whole course, so buying the A$29 template silently granted the A$49 course (owner-reported: "a real major bug"). Split in `db/seed/012`, with existing buyers grandfathered. The template has since become the free lead magnet, so that product is unpublished and the course is the only published one — see `docs/pricing.md` §2 and `DESIGN.md` §28.0.
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
8. **Accessibility basics are not deferred to Week 4.** `DESIGN.md` §42 states WCAG 2.2 AA as "the floor... requirements, not aspirations." The full audit (VoiceOver/NVDA pass, 200% zoom, forced dark mode) is genuinely Week 4 (§42.9) — but semantic HTML, one `<h1>` per page, labelled inputs, contrast per the §7.4/§7.5 tokens, alt text, and keyboard operability (§34.1's Definition of Done, item 4) are Day-1-of-that-component requirements, because retrofitting them into six components built without them is slower than building them in.

---

## Phase 1 — Day 1: Foundations, Accounts, and Schema Draft

**Objective:** Every account exists, both projects boot, and the full database schema is drafted and reviewed with you — before any feature code is written.

### Step-by-step

1. **Confirm decisions #1–7** from the Open Decisions section above. Do not proceed past this step without them.
2. **Create accounts** (or confirm access, per decision #9): Vercel, Render, Supabase, GitHub, Stripe (test mode), Mux, Cloudflare (R2 bucket), Resend.
3. **Scaffold the frontend:** `npm create vite@latest` (`react-ts` template); install the full `DESIGN.md` §51 stack now, not incrementally — Tailwind v4 (`tailwindcss` + `@tailwindcss/vite`), shadcn/ui (`New York` style, CSS variables, neutral base, Lucide icons — see §51.2), `react-router` v8 (**not** `react-router-dom`, removed in v8 — §51.6), `@tanstack/react-query`, `zustand`, `axios`, `zod`, `react-hook-form` + `@hookform/resolvers`, `motion`, `class-variance-authority`, `clsx` + `tailwind-merge`, `@supabase/supabase-js`. Push to GitHub, connect to Vercel.
4. **Scaffold the backend:** Python virtual environment; install `fastapi`, `uvicorn`, `sqlalchemy` + `asyncpg` (async ORM/driver) + `alembic` (migrations — `BACKEND.md` §8.1), `supabase` (service-role client, admin ops only — `BACKEND.md` §6), `python-jose` (JWT verification), `stripe`, `mux-python`, `boto3` (R2), `resend`. A minimal `/health` endpoint. This scaffold and the full 22-model schema already exist in `backend/` — this step is confirming `pip install -r requirements.txt` actually installs everything the models import (it didn't, until this pass added `sqlalchemy`/`asyncpg`/`alembic`), not building from zero. Push to GitHub, connect to Render.
5. **Set up environment variables**, split correctly (never mixed):
   - **Frontend (`.env.local` → Vercel):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL`.
   - **Backend (`.env` → Render):** `DATABASE_URL` (session-pooler port 5432, not transaction-pooler 6543 — see `docs/RUNNING.md`'s troubleshooting table), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_AUDIENCE` (JWT verification itself is now via Supabase's JWKS endpoint, not a shared secret — `SUPABASE_JWT_SECRET` is unused), `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`, `MUX_SIGNING_KEY_ID`, `MUX_SIGNING_KEY_PRIVATE`, `SUPABASE_STORAGE_S3_ENDPOINT`, `SUPABASE_STORAGE_REGION`, `SUPABASE_STORAGE_ACCESS_KEY_ID`, `SUPABASE_STORAGE_SECRET_ACCESS_KEY`, `SUPABASE_STORAGE_BUCKET_NAME`, `GMAIL_USER`, `GMAIL_APP_PASSWORD` (the first email transport tried, `docs/gmail.md`), `MAILJET_API_KEY`, `MAILJET_SECRET_KEY`, `BREVO_API_KEY`, `BREVO_SMTP_LOGIN`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`, `RESEND_API_KEY`, `OWNER_NOTIFICATION_EMAIL`, `ALLOWED_ORIGIN`.
6. **Configure FastAPI's CORS middleware** immediately, restricted to the Vercel URL and `localhost:5173` — do this Day 1, not when the first cross-origin error appears.
7. **Establish `theme.css` first, per `DESIGN.md` §60's own Week 1 sequence** ("half a day, and it governs everything after") — this is not a placeholder step to revisit later, it is a `[DECIDED]`, contrast-audited system:
   - **Colour**: the full light/dark token set in `DESIGN.md` §7.4/§7.5 verbatim — not the placeholder hex values from earlier drafts. It has already been through a WCAG 2.2 contrast audit (six dark-mode pairs, including the focus ring, were corrected there); do not re-derive or simplify it.
   - **Type scale**: the fluid `clamp()`-based token set in §10 (`--text-display` through `--text-xs`), not fixed pixel breakpoints.
   - **Typefaces**: Bricolage Grotesque (display/UI, sans) + Source Serif 4 (long-form reading body) + JetBrains Mono (data/IDs) — §9's three-face system, self-hosted via `vite-plugin-webfont-dl` per §9.5 (not linked from Google Fonts — a live third-party font request is a privacy/performance issue this product's own buyers would notice).
   - **Spacing**: 4px-based scale, as before.
8. **Draft the full database schema** — every entity (`users`, `sections`, `authors`, `domains`, `questions`, `question_relations`, `question_templates`, `question_lessons`, `tag_values`, `courses`, `modules`, `lessons`, `templates`, `products`, `product_contents`, `orders`, `order_items`, `entitlements`, `lesson_progress`), even the ones Week 1 won't populate — this is what makes a second course in Week 2 configuration instead of a migration (see Scalability, above). All 22 model classes already exist as SQLAlchemy models in `backend/app/db/models/` — this step is running `alembic revision --autogenerate`, hand-reviewing the diff (`BACKEND.md` §8.1 — autogenerate misses constraint/index changes and happily drops columns), and migrating, not drafting from scratch. Two things to specifically confirm are present: `entitlements.granted_via` (`'purchase' | 'manual' | 'free'` — Phase 4 step 6 depends on it) and the `question_relations`/`question_templates`/`question_lessons` join tables (added to the models this pass; not yet in a migration). Note `tag_values` and `product_contents`, not a `bundle_items` table: per `BACKEND.md` §1.4/§8, the seven tag dimensions are **rows in a `tag_values` reference table, not Postgres/Python enums**, so the owner can add or rename a value without a deploy; and a bundle is just a `product` with multiple `product_contents` rows, needing no separate mechanism.
9. **Review the schema with you** — specifically the `questions` table's seven tag **reference values** (decision #3, seeded into `tag_values`, not hard-coded as enums) and the `domains` seed rows (decision #2). Get explicit sign-off before running the migration.
10. **Run the migration** in Supabase; enable Row-Level Security on every user-data table immediately.

### Definition of Done — Day 1

- [x] All required *service* accounts (Supabase, Stripe, Mux, Brevo) exist with real credentials correctly split between `.env.local` and `.env`. **Exception:** Vercel/Render — decision #9 (who owns hosting accounts) was never actually answered.
- [x] `npm run dev` (frontend) and `uvicorn` (backend) both run locally; the frontend can call the backend's `/health` endpoint without a CORS error — verified repeatedly this pass.
- [x] The full schema is migrated into Supabase (migrations 001–003), with RLS enabled on `users`, `orders`, `order_items`, `entitlements`, `lesson_progress`, `course_progress`.
- [x] Domain names and tag reference values are the ones you provided (decisions #2/#3) and are seeded exactly as specified — confirmed by querying the live `domains`/`tag_values` tables, not the proposal.
- [x] Blank deploys are live for both services. **Done** — both are now real, populated production deployments, not blank ones: `practicable.vercel.app` and `practicable.onrender.com`, confirmed reachable and healthy directly.

**Do not proceed to Day 2 if:** the schema has not been reviewed with you, any account/credential is missing, or the frontend cannot reach the backend locally.

---

## Phase 2 — Day 2: Authentication and the First Real Content

**Objective:** A real user can sign up and sign in via Supabase Auth (called directly from React), FastAPI can verify the resulting session token, and the one real question and one real course/module/lesson skeleton exist in the database.

### Step-by-step

1. **Build the shared frontend layer first, in `DESIGN.md` §60's order — components and layout before pages, pages before auth logic:**
   - **The route tree** (`DESIGN.md` §51.6, §52): `src/App.tsx` with `createBrowserRouter` in data mode, and the layout shells under `src/routes/_layouts/` — `RootLayout` (providers, skip link), `MarketingLayout` (public header + footer), `AuthLayout`, `MemberLayout` (auth guard). Week 1 only needs these four, not the Admin layout (Week 3).
   - **The six core components** named explicitly in §60's Week 1 sequence — `Button`, `Card`, `Input`+`Label`+error, `Badge`, `EmptyState`, `PageTitle` — each built to the nine-point Definition of Done in §34.1 (all interactive states, both themes, keyboard-operable, semantic tokens only), not copy-pasted from a shadcn example and left unaudited.
   - **Header, footer, and the marketing layout shell** that wraps the question page — this is what's missing if Day 2 jumps straight to auth pages with nowhere to put them.
   - **`src/lib/api/client.ts`** — the single Axios instance with the Supabase-JWT request interceptor and the 401-redirect response interceptor (`DESIGN.md` §81), and **`src/lib/query/queryClient.ts`** — the TanStack Query client (§79). Every FastAPI call from here on goes through this client; no raw `fetch`.
   - **`src/stores/useAuthStore.ts`** — the Zustand store holding `user`/`loading`/`signOut` (§80), which `MemberLayout`'s guard reads.
2. **Implement Supabase Auth in React**: sign-up, sign-in, sign-out, calling Supabase's JS client directly, writing the resulting session into `useAuthStore`. The Axios client's interceptor (step 1) attaches the JWT as `Authorization: Bearer <jwt>` on every FastAPI call — do not hand-roll a second way of attaching it.
3. **Implement the FastAPI auth dependency**: verifies the JWT against `SUPABASE_JWT_SECRET`, extracts the user ID — used by every protected endpoint from here on. Build and test this in isolation first.
4. **Build the auth pages** (`SignInPage`, `SignUpPage`) inside `AuthLayout`, using the step-1 components — no new one-off inputs or buttons.
5. **Insert the one real domain row and the one real question row** with its real guidance text and all seven real tag values — via Supabase Studio directly; no admin UI yet.
6. **Insert the one real course → module → lesson (type: video)** skeleton rows.
7. **Smoke-test auth end to end**: sign up, session persists on refresh, a protected FastAPI test endpoint returns the correct user ID when called with a valid token, sign out, and — critically — calling the protected FastAPI endpoint **without** a token returns 401.

### Definition of Done — Day 2

- [x] The route tree, the four Week 1 layout shells, and the six core components exist and meet the §34.1 Definition of Done.
- [x] The Axios client, TanStack Query client, and Zustand auth store exist as the single, named way to call FastAPI and hold session state.
- [x] A real account can be created, signed into, and signed out of via Supabase Auth, session surviving a refresh.
- [x] A logged-out visit to a placeholder member-area route redirects to sign-in (`MemberLayout`'s guard).
- [x] A logged-out direct call to the protected FastAPI test endpoint returns 401 — proven with a real `curl` request repeatedly this pass, not assumed from the UI.
- [x] The one real question and the course → module → lesson skeleton exist in Supabase — and, since this pass, so does the real media/template/product data that Phase 3/4 needed (see those sections).

**Do not proceed to Day 3 if:** the FastAPI 401 check does not work. Every later gating check builds on this exact pattern.

---

## Phase 3 — Day 3: The Content Slice — Video, Reading, and the Template Product

**Objective:** The one lesson has a real, signed-playback video; the one template exists as a real, gated file; both are served through FastAPI endpoints that will (Day 4) enforce entitlement.

### Step-by-step

1. **Build `GET /questions/{slug}`** in FastAPI — this endpoint was missing from earlier drafts of this plan and it is not optional: per the research spec's own primary user journey (8.2, step 3), *"Body text is blurred/locked"* even for the one demo question — this is not video/download-only gating. Implement the two response shapes from `BACKEND.md` §4.2/§1.2: **not entitled** → 200 with `QuestionPreviewOut` (title, domain, all seven tags, the short answer, related-content names and prices — never the full guidance body, structurally absent from the response model, not hidden in CSS); **entitled** → 200 with `QuestionFullOut` (adds the full guidance + "what to do next"). A paywall is a 200 with a `gated: true` flag, not a 403 — it's a conversion surface, not an error (`DESIGN.md` §21.3). **[RECONCILED]** This split-response model was later replaced by direct owner instruction: `QuestionPreviewOut`/`QuestionFullOut` were merged into a single `QuestionOut` with `body` always present, for everyone, entitled or not — the question's guidance became the free entry point itself (Research Specification §4.1's annotation), not a teaser gated behind purchase. `gated` now describes only the template/lesson upsell card shown alongside the free text; the actual soft-gate (email capture, CSS blur) moved entirely client-side into `EmailGatedBody.tsx`. See `docs/handover.md` §1.
2. **Build the React question page** to `DESIGN.md` §21.1's structure — breadcrumb, domain, title, short answer (always visible), the seven tags as a definition grid (not seven loose badges — §21.2), then the guidance section. When ungated: first paragraph visible, second paragraph fades over ~120px, then the lock card (§21.3) naming the product, its contents, its price, and `[See what's included]` / `Already bought it? Sign in`. **Non-negotiable per §21.3: the gated text must never be present in the page's HTML for a non-entitled request** — a CSS blur over data already sent to the browser is defeated by View Source in four seconds, which on a paid product is the product leaking, not a styling bug.
3. **Upload the one real video** to Mux; confirm it finishes processing and returns a playback ID.
4. **Build `GET /lessons/{id}/playback-token`** in FastAPI — will verify the JWT and generate a signed Mux JWT (15–30 min expiry) once entitlement checking is wired Day 4. Build the shape now.
5. **Build the React lesson page** using `<MuxPlayer>` — **dynamically imported** inside the lesson component, not at the app root (`DESIGN.md` §43.1: it's a large dependency most sessions never load) — calling the step-4 endpoint, never Mux directly, never holding a Mux secret. Captions on by default (§25.2 `[DECIDED]` — defaulting them off means most people never discover them).
6. **Upload the one real template file** to R2; create the `templates` row.
7. **Build `GET /templates/{id}/download-url`** in FastAPI — generates an R2 presigned URL (60-second TTL) once entitlement checking is wired Day 4.
8. **Build the download button to the exact state machine in `DESIGN.md` §26.4/§26.5**: click → `Preparing…` (disabled) → fetch the URL → browser fetches the file directly → `Downloaded ✓` for 4 s → back to `Download again`. **Never render the presigned URL as a visible `href`** — a user right-clicking "save link as" or returning to a backgrounded tab will hit an expired 60-second link; fetch on click, use immediately, discard. A failed fetch returns the button to normal with an inline `That link expired. Press download again.` — not an error toast implying something is broken.
9. **Wire the related-question → course → template links** so the journey is clickable end to end, per §21.4: the related-template card on the question page is itself a full buy surface (name, format, price, `Buy the template`) — it does not route through a catalogue first, which is what keeps the brief's three-step speed-to-answer budget intact.

**Deferred, named rather than silently dropped:** `DESIGN.md` §25.4's mid-playback token-refresh behaviour (silent refresh at 60% of token lifetime, pause-and-resume on failure) is real and `[DECIDED]`, but Week 1's one demo lesson is short enough that a 15–30 min token is unlikely to expire during it. Building the full refresh/resume flow this week would be scope beyond what the slice needs — it's a named Week 2 task, not an oversight.

### Definition of Done — Day 3

- [x] `GET /questions/{slug}` returns `QuestionPreviewOut` (no guidance body, `gated: true`) for a non-entitled request and `QuestionFullOut` for an entitled one — confirmed by inspecting the raw JSON directly via `curl`. **[RECONCILED — see step 1's annotation above]** True as originally built; since superseded by owner instruction. `GET /questions/{slug}` now returns a single `QuestionOut` with `body` always present, verified again post-change via the same method.
- [x] The question page matches §21.1's structure and the gated guidance fades into a lock card, never present in the HTML when ungated (the response models are structurally different shapes — `QuestionPreviewOut` has no `body` field at all, not a hidden one). **[RECONCILED]** The lock card now gates only the template/lesson upsell, not the guidance text — the guidance is intentionally present in the HTML for everyone (it's the free entry point), soft-gated by a client-side email capture instead.
- [x] The video plays via `<MuxPlayer>` (dynamically imported) using a signed JWT from the FastAPI endpoint, with captions on by default. Verified the signed-token path about as thoroughly as possible without a browser: a real RS256 token, generated server-side, was accepted by Mux's real playback endpoint (200, English captions track present in the manifest); an absent or garbage token was correctly rejected (403/400).
- [x] Storage (Supabase Storage, replacing the planned R2 — see decision below) presigned-URL endpoint returns a working, time-limited download link when called directly — verified by fetching the real file. The download button's Preparing → Downloaded ✓ state machine is built with no visible `href`.
- [x] The question, course, and lesson pages exist and link to each other correctly, and the related-template card on the question page is a direct buy surface — verified live: `GET /questions/{slug}` now returns the real product's name/price in `related_content` once the product existed (Phase 4).

**Do not proceed to Day 4 if:** the video plays from an unsigned or non-expiring URL, or React ever calls Mux/R2 directly instead of going through FastAPI. **[RECONCILED]** This item originally also listed "the question's guidance body is present in the page source for a logged-out request" as a blocker — inverted by the later owner-directed model change: the guidance body being present for a logged-out request is now the *correct*, required behaviour (it's the free entry point), not a leak.

---

## Phase 4 — Day 4: The Commerce Slice — Stripe, Webhook, Entitlement, Gating, Email

**Objective:** Money moves. A real Stripe test-card purchase, processed by FastAPI, creates an entitlement — and that entitlement is what, and only what, unlocks the video and download endpoints.

### Step-by-step

1. **Create the Stripe Product and Price** for the one real template, at its real price, in test mode. **Create three `product_contents` rows against it**, not one — `content_type: 'template'` (the file), `content_type: 'lesson'` (the video), and `content_type: 'question_set'` pointing at Q001 (research spec 8.2, step 3: the same purchase that unlocks the template also unlocks the question's gated guidance body built in Phase 3). Missing the third row is the one mistake that would make Phase 3's paywall work correctly in isolation and then silently never unlock.
2. **Build `POST /checkout/session`** in FastAPI — creates a Stripe Checkout Session and returns the URL to React, which redirects. Never build a custom card form. Frontend: the pre-redirect summary per `DESIGN.md` §29.1 — product name, what's included, subtotal, the Stripe-attribution trust line ("Payment is handled by Stripe. We never see your card details.") — not a bare "Buy now" button with no context.
3. **Build `POST /webhooks/stripe`** — verify the `stripe-signature` header with `stripe.Webhook.construct_event()`; reject anything unsigned.
4. **Make the webhook handler idempotent, in the order `BACKEND.md` §6.1 specifies** (this order is load-bearing, not incidental): insert the Stripe event ID into `webhook_events` first — on conflict, return early, already handled; then create the order and the `ENTITLEMENT` row(s) **in the same transaction**; commit; **only then** queue the receipt email. Queuing the email inside the transaction, or before it commits, is how a customer gets a receipt for a purchase that then fails to save.
5. **Test the webhook locally** with the Stripe CLI before testing against the deployed app.
6. **On success, create the `ENTITLEMENT` row(s)** — one per `product_contents` row from step 1 that Week 1's schema actually gates (question, lesson, template) — with `granted_via: 'purchase'`, and **write an `audit_log` row** (`BACKEND.md` §1.5: every entitlement grant is audited — this is a five-line service and it's the difference between "we think the webhook fired" and knowing).
7. **Wire the entitlement check** into all three gated endpoints now (the question, lesson, and template endpoints from Phase 3) — they query `entitlements` for the authenticated user before returning the full question body, generating the Mux JWT, or generating the R2 URL.
8. **Wire the "Buy now" button** in React to the Checkout Session endpoint.
9. **Build the purchase-success page's entitlement poll**, per `DESIGN.md` §29.4 `[DECIDED]` — Stripe redirects the user back *before* the webhook necessarily arrives, so the success page cannot assume the entitlement already exists: poll `GET /me/entitlements` every 1.5 s for up to 20 s, showing `Setting up your access…` on the primary action while polling; on success the button becomes `Start the first lesson`; if 20 s elapses with nothing, show the confirmed-payment-but-still-provisioning state (§29.4) with `[Refresh]` and `[Contact us]` — never a bare spinner, and never a locked screen after money has moved. This is what actually protects against the "silent webhook failure" risk already named in the Week 1 risk watchlist below — the risk was named without this being built.
10. **Build the checkout failure state** per §29.3 — "Payment wasn't completed. Your card has not been charged." with `[Try checkout again]` — never "Oops," never implying the user did something wrong; the FastAPI error contract's `payment_incomplete` (402) code (`BACKEND.md` §9) is what the frontend branches on to show it.
11. **Build and trigger the receipt email** from the webhook handler, after commit (step 4) — plain HTML rendered in Python, sent via Brevo's transactional email API (`requests`, not a React Email component, which cannot render inside FastAPI). **[RECONCILED]** Originally planned as Resend; switched to Brevo mid-build because Resend (and every domain-gated provider — SendGrid, Postmark, SES) needs a verified sending *domain*, which this project doesn't have, while Brevo verifies a single sender *email address* instead — see `docs/email.md` for the full reasoning. Real subject, amount, product name, and the contracting-entity name from decision #4 (a receipt without a real company name on it is the thing someone expensing the purchase screenshots and rejects).
12. **Verify the sender email in Brevo** (Senders, Domains & Dedicated IPs → Senders → click the confirmation link Brevo emails to that address) — the equivalent step to the originally-planned "configure DKIM/SPF," except it verifies one address instead of a whole domain, and only the person with access to that inbox can complete it.

### Definition of Done — Day 4

- [x] "Buy now" reaches Stripe's real hosted checkout for the real product/price via the FastAPI-created session, from a pre-redirect summary page that states what's included and the Stripe trust line. (`ProductBuy.tsx` + `POST /checkout/session`, which creates a real Stripe Checkout Session against the real `price_1U2veKLTNkwhOECvC60VAsdJ` — A$29, Risk Register Template.)
- [x] A Stripe **test** card completes checkout and redirects back. **Done** — a real completed Checkout session exists in production (`payment_status: paid`), redirecting correctly to `practicable.vercel.app/checkout/success` (once `ALLOWED_ORIGIN` was corrected on Render — an earlier real deploy bug, since fixed, that had this redirecting to `localhost` instead).
- [x] The webhook fires, signature verifies, and an `ENTITLEMENT` row **for the product** appears in Supabase, alongside an `audit_log` row — checked directly by querying the database, not inferred. (One entitlement row per (user, product), resolved against `product_contents` for all three gated resource types — the architecturally simpler, equally-correct alternative to one row per resource named in this plan; see `app/core/entitlements.py`'s own doc comment.)
- [x] Sending the same webhook event twice does **not** create a second entitlement row. Verified directly: the same genuinely-signed event, delivered three times total, produced exactly one order and one entitlement.
- [x] The purchase-success page polls for the entitlement rather than assuming it, and never shows a locked screen or a bare spinner to someone who has already paid. (`CheckoutSuccess.tsx` — built to §29.4 exactly: 1.5s poll, 20s timeout, `Refresh`/`Contact us` fallback. Not yet exercised by a literal browser session.)
- [x] A receipt email with real details arrives. **Done, via Mailjet** (see the Week 1 objective status note) — confirmed live: both the buyer receipt and the owner sale-notification email delivered to a real recipient with real order details.
- [x] Before purchase: all three gated endpoints (question body, video, download) return the correct not-entitled response for that user. After purchase: all three succeed, for that user only. Verified directly against the entitlement-checking function for both a real purchaser and a stranger, across all three resource types.

**Do not proceed to Day 5 if:** a non-entitled logged-in user can still reach the full question body, the video, or the download by any route.

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

- [ ] The smoke test passes in full, desktop and mobile, against production. **Desktop: effectively proven, piecewise rather than as one continuous session** — every individual step (sign-up, gating, real checkout, webhook, entitlement, email, video, download, production CORS, production gating-break attempts) has been independently verified against real production infrastructure this pass. **Mobile: not done** — the one genuinely-remaining item, see the Week 1 objective status note.
- [x] CORS is confirmed correctly restricted, not just "not currently broken." **Done** — verified directly against production, both directions: a preflight from `https://practicable.vercel.app` succeeds (200), and one from an arbitrary origin (`https://evil-attacker.example.com`) is rejected (400, "Disallowed CORS origin").
- [x] Deliberate gating-break attempts all failed closed, tested this pass: a stranger's user id against all three gated resources (denied), a Mux playback URL with no token (403) and a garbage token (400) — and, separately, directly against the live production API: a request with no token (401) and one with a garbage token (401).
- [ ] The Week 1 report is written and sent with an explicit go/no-go recommendation. This document's own status annotations (above) are that report in substance — a dedicated summary is one message away once you want it as a standalone artifact.
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
React 19 (Vite, TypeScript) + Tailwind v4 + shadcn/ui + react-router v8 + TanStack Query + Zustand + Axios, on Vercel · FastAPI (Python), on Render · Supabase (Postgres + Auth + RLS) · Stripe (Checkout + webhooks) · Mux (signed JWT video) · Supabase Storage (presigned downloads — swapped in for the originally-planned Cloudflare R2; same S3-compatible API, no card required on the free tier, one fewer external account) · Email: **Gmail SMTP first** (app password, reaches any real recipient with no provider review — `docs/gmail.md`), then Mailjet, then Brevo, then Resend as a labelled last resort. Originally planned as Resend alone, which needs a verified sending *domain* this project doesn't have; see `docs/email.md` for the full provider trail.

### Entity list for the Day 1 schema
`users` · `sections` · `authors` · `domains` · `questions` · `question_relations` · `tag_values` · `courses` · `modules` · `lessons` · `templates` · `question_templates` · `question_lessons` · `products` · `product_contents` · `orders` · `order_items` · `entitlements` · `lesson_progress`

`tag_values` (not enums) and `product_contents` (not a separate `bundle_items`) per `BACKEND.md` §1.4/§8 — see Phase 1, step 8.

### Environment variables

**Frontend (`.env.local` → Vercel):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL`

**Backend (`.env` → Render):** `DATABASE_URL` (session-pooler port 5432, not transaction-pooler 6543 — see `docs/RUNNING.md`'s troubleshooting table), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_AUDIENCE` (JWT verification itself is now via Supabase's JWKS endpoint, not a shared secret — `SUPABASE_JWT_SECRET` is unused), `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`, `MUX_SIGNING_KEY_ID`, `MUX_SIGNING_KEY_PRIVATE`, `SUPABASE_STORAGE_S3_ENDPOINT`, `SUPABASE_STORAGE_REGION`, `SUPABASE_STORAGE_ACCESS_KEY_ID`, `SUPABASE_STORAGE_SECRET_ACCESS_KEY`, `SUPABASE_STORAGE_BUCKET_NAME`, `GMAIL_USER`, `GMAIL_APP_PASSWORD` (the first email transport tried, `docs/gmail.md`), `MAILJET_API_KEY`, `MAILJET_SECRET_KEY`, `BREVO_API_KEY`, `BREVO_SMTP_LOGIN`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`, `RESEND_API_KEY`, `OWNER_NOTIFICATION_EMAIL`, `ALLOWED_ORIGIN`

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
                   → entitled: generate Supabase Storage presigned URL (≤60 sec) → return to React → browser fetches from Storage
                   → not entitled: 403

WEBHOOK:           Stripe → FastAPI POST /webhooks/stripe
                   → verify signature → idempotency check
                   → create ENTITLEMENT → trigger Brevo email (REST API)
```

---

*This plan operationalises Week 1 of `Deciding_in_the_Dark_Research_Specification.md`, for the React + FastAPI stack and the standing scalability/extensibility requirement. It does not restate the reasoning behind the stack or content-model choices — see the research specification for that.*
