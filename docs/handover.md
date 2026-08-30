# Handover pack

A living document — updated as the project changes, not a one-time snapshot. Last updated: 2026-08-27.

This complements `RUNNING.md` (how to run/deploy) and `DESIGN.md`/`BACKEND.md` (the specs) rather than repeating them — this doc is the "why," the "how to extend it," and the "what's actually true right now" that those don't cover.

---

## Table of contents

1. Architecture note (stack, design direction, N+1 fixes, the dark plane, landing page, contact page)
2. Adding new content step by step (questions, courses, lessons, templates, products)
3. Running costs
4. Known gaps and shortcuts
5. The platform
6. Learning
7. Commerce
8. Content model and admin
9. Design system
10. Verification status
11. What to build next
12. Commands that matter

---

## 1. Architecture note

### Stack, and why

| Layer | Chosen | Rejected | Why |
|---|---|---|---|
| Auth | Supabase Auth (JWTs, ES256/JWKS) | A custom auth service, Firebase Auth | Same project already needed for Postgres; JWKS-based verification (`PyJWKClient` against `/auth/v1/.well-known/jwks.json`) means the backend never holds a shared secret — this specific project signs asymmetrically, not with the legacy HS256 shared-secret scheme some Supabase docs still show. |
| Database | Supabase Postgres (SQLAlchemy 2.0 async + Alembic) | A separate managed Postgres (RDS, Neon) | One fewer account/bill; Supabase's connection pooler (port 5432, session mode) works fine with asyncpg once you know Transaction-mode pgbouncer (port 6543) breaks asyncpg's named prepared statements — a real footgun, documented in `app/db/session.py`. |
| File storage | Supabase Storage (S3-compatible) | Cloudflare R2 | Originally planned as R2; swapped to Supabase Storage because it needed no separate card-on-file account and is the same project already in use — one fewer external dependency, not a technical superiority claim. |
| Video | Mux (signed RS256 playback) | Self-hosted HLS, Cloudflare Stream | Mux's signed-URL model maps directly onto the entitlement check that already gates templates — verify entitlement, mint a short-lived token, never expose the raw playback ID to someone who hasn't paid. |
| Payments | Stripe Checkout (hosted) | A custom card form (Stripe Elements) | Hosted Checkout means this app never touches card data at all, not even transiently — PCI scope stays minimal. The tradeoff: less control over the payment page's exact look, accepted deliberately. |
| Email | **Mailjet** `[RESTORED 2026-08-15]` (was Resend-only since 2026-08-13) | Resend, Brevo, Gmail SMTP, Postmark, SendGrid, MailerSend, Mailgun | See `ENGINEERING_NOTES.md` §7 for the earlier multi-provider trail. Resend's blocker (§4 old item 3) was its sandbox sender — it could only deliver to the Resend account's own address, so every buyer receipt was silently redirected to the owner. Mailjet was already known-working over REST (HTTP transport, so Render's outbound-SMTP block at port 587 is irrelevant) and was the fastest route back to real delivery, so Week 3 restored it as the sole transport rather than adding it back as one tier of a fallback chain — same reasoning as the 2026-08-13 collapse-to-one-provider decision, just pointed at the provider that actually delivers to real inboxes. Delivery is confirmed per-send via Mailjet's REST Message resource (`GET /v3/REST/message/{id}`), not inferred from the absence of a logged error — the exact trap §1/§4 already named twice. |
| Frontend hosting | Vercel | Netlify, Render static site | SPA-friendly out of the box (`frontend/vercel.json`'s catch-all rewrite for client-side routing). **Live gap, not a shrug**: the Hobby (free) tier's terms prohibit commercial/revenue-generating use, and this app is already taking real Stripe payments — see §4. |
| Backend hosting | Render, Starter plan | Render Free, Railway, Fly.io | Free tier's cold start (service sleeps after 15 min idle, ~30–50s to wake) is not acceptable for a live checkout flow a paying customer's browser redirects into mid-transaction. |

### The learning system, activated

`Course`/`Module`/`Lesson`/`LessonProgress`/`CourseProgress` existed in the schema since Week 1, but until this session they were dead weight — one skeleton course with one lesson, no list endpoint, no frontend route to reach any of it. "I can't see a course" was a completely accurate complaint. This session wired the whole thing up:

- `GET /courses` (catalogue) and `GET /courses/{slug}` (public syllabus — every lesson listed with a lock icon whether or not the visitor owns it, real price resolved from whichever product actually sells the course, never hardcoded).
- `GET /courses/{courseSlug}/lessons/{lessonSlug}` — the member learning interface's one data call: the lesson's own content plus the whole course's outline (for the sidebar) plus prev/next, in one round trip.
- `POST /lessons/{id}/complete` — marks progress and live-recomputes the course-level rollup, so the catalogue's "% complete" and the outline's checkmarks never drift apart.
- The member area gained an actual shell: a persistent sidebar (`MemberLayout.tsx` — Dashboard/Courses/Templates/Questions) replacing what used to be a bare `<Outlet />` with no navigation at all.
- `Lesson` gained real content columns: `body` (for `lesson_type = reading`) and `download_template_id` (for `lesson_type = download`, reusing the `templates` table's storage/file columns rather than duplicating them — a lesson's download is gated by *lesson* entitlement, not by also being sold as a standalone template).

### Design direction: repositioned away from "LMS," same day it was built

Immediately after the learning system above landed, direct owner critique (2026-08-11, full text kept in conversation history, not reproduced here) named a real problem with where the visual design was heading: it read as *"a polished course platform that happens to contain risk questions,"* when the Research Specification's own thesis is the opposite — the question-discovery system is the differentiator, courses are secondary. The critique was detailed and phased (visual foundation → homepage → question library → question page → courses → dashboard → commerce); the owner chose to start with **Phase 1, visual foundation**, done this same session:

- **Radius tightened again**, 16px → 12px ceiling (`theme.css`, `DESIGN.md` §12.1) — this was the *second* tightening (v1's 20px had already become 16px in an earlier pass); 16px on the largest surfaces was still reading as generic SaaS. `rounded-2xl`/`rounded-3xl` are now pinned to the same 12px ceiling at the token level so a component can't quietly exceed it by habit.
- **Card discipline formalised** (`DESIGN.md` §36): a card is for a real, distinct item (course, template, purchase, search result) — not a general-purpose section wrapper. Sections, single stats, metadata, and dashboard headings sit directly on the page now. This is a documented rule for Phase 2+ page-level cleanup, not yet a pass over every existing page.
- **`PageTitle` gained an `editorial` variant** (serif title, vs. the default sans `product` variant) — applied to the question page only, so far. The question page is the one place typography now visibly signals "this is the product's flagship content," per the critique's push to make editorial pages feel like a professional reference article rather than a UI screen.
- **Marketing header tightened** — `py-4`/`gap-6` → `py-3.5`/`gap-5`, a smaller logo mark. Modest on purpose; no numeric target was given for this bullet.

**Phase 2 (homepage) and Phase 3 (question library), done the same day:**

- `Home.tsx` rebuilt — the hero is now a working question finder (real search + tag-matched quick-filter chips, live results below), not a claim above two auth buttons. "How this works" and the homepage product-pitch card were removed entirely (courses/templates now live only in their own catalogue pages, reachable from the header — not pitched on the landing page). Domains got their own numbered section with real per-domain question counts computed from the live `/questions` list, each linking into the library pre-filtered. A compact "Questions people actually ask" list (plain text rows, no cards) replaced the old single-question "Featured question" card.
- `QuestionsCatalogue.tsx` (`/questions`) rebuilt into a real filter system: every filter option offered (domain + all seven tag dimensions) is derived from what's actually published — never a taxonomy value that would silently return zero results because nothing live carries it. Filters are URL params (`?domain=…&cost=…`), so links from the homepage's domain blocks and quick filters land pre-filtered. Result rows are editorial (a bottom border, not a Card — `DESIGN.md` §36's rule applied literally on the one page it matters most). When any filter is active, each result shows a short match explanation — which active filters it satisfies — restating real active constraints, never a fabricated relevance score.
- A second, independent design brief (a comprehensive AI-prompt-style spec covering the whole product) arrived the same day. Reviewed on request before use: it reinforces the same direction almost point-for-point, but its typography scale and colour section silently contradict the already-decided, WCAG-audited system in `DESIGN.md` (a different fixed type scale; "blue accent" where the real system deliberately uses gold), and its homepage nav mockup inverts the actual brand hierarchy (`Practicable` is the registered brand per an early Week 1 decision; "Deciding in the Dark" is the book/collection inside it, not the other way round). Treated as a mineable reference for copy/component-state ideas phase-by-phase, checked against `DESIGN.md` first — not adopted as a second source of truth. `DESIGN.md` remains the one place tokens/decisions live; see `ENGINEERING_NOTES.md` §4 for the full comparison.

**Not yet done** — Phase 4 (question detail page — a more editorial layout), Phase 5 (courses/dashboard de-emphasis), Phase 6 (commerce), Phase 7 (admin, functional-only). Each is a real, separately-scoped follow-up.

### Landing page: demonstrate the product, don't describe it (2026-08-14)

A second owner page review landed on the Phase-2 homepage. Its core charge: the page *explained* the platform (a headline claim, five category tiles, three title lines, an email box) when it should *demonstrate* it — a visitor should experience "I have a problem, I type it here, this site understands the problem and tells me what to do" before they ever reach the paid layer. `Home.tsx` was rebuilt around that, in the order the review asked for:

hero (question-first, full-width finder panel) → four real question cards → the seven-way filter, working live → the five areas carrying real counts → Question → Answer → Action → Resource → courses/templates as the *end of that chain* rather than two catalogues → the claim with counted evidence under it → a closing search CTA.

Two deliberate departures from the review, both recorded because a future reader will otherwise "fix" them back:

- **Brand.** The review wrote "Describing in the Dark" and proposed making it the top-level brand. The name is *Deciding* in the Dark, and the hierarchy was already settled (an early Week 1 decision, restated in §1 above): `Practicable` is the registered brand, "Deciding in the Dark" is the 100-question collection inside it. The hero eyebrow now states that relationship explicitly rather than leaving it implied by placement — which is what made the two read as competing products.
- **The closing CTA is champagne, not the dark stage the review asked for.** The footer directly beneath it is already a full-bleed `--stage` plane carrying its own newsletter headline; a dark CTA above it recreates the exact "two large blocks" problem the review raised about the hero and footer. The rhythm is dark hero → light body → champagne close → dark footer.

Also folded in: the homepage's `#free-pack` email capture was duplicating the footer's `NewsletterForm` (both post to `/leads`, different `source`). It is kept — same endpoint, same `homepage_free_pack` source, so existing lead reporting is unbroken — but demoted below the closing search, since a visitor who read the whole page should be sent into the catalogue first and onto a list second.

#### The quick-filter chips had never worked

The most important thing this session found, and the reason to read this section at all. Both `Home.tsx`'s finder chips and `QuestionsCatalogue.tsx`'s `QUICK_FILTERS` tested for `'XS'`, `'$'`, `'M'`, `'H'` — the *display shorthand* that appears inside `tag_values.display_label` (`"XS (Under 2 weeks)"`, `"$ (Low investment)"`). The stored `tag_values.value` is a lowercase code: `xs`, `low`, `m`, `h` (see `001_seed_domains_and_tags.sql`). Every chip therefore matched zero questions, silently — the one interaction on the site that proves the taxonomy is a real dataset rather than decoration had been dead since it was written. Fixed in both files, with the value list now written from a count against the live API.

Two related traps, same root cause (writing a query from what the label *looks* like rather than what the data *is*):

- The "Third parties" suggestion searched `third part` **with a space**, against a question titled "Third-**Party** Risk Is a Black Box" → 0 hits. `third-part` → 2.
- `ai` looks like the obvious search term for the AI domain and matches **28** questions — almost all on "dom*ai*n" and "expl*ai*n". A two-letter substring is not a search. Every suggested term on the homepage is now counted against `/questions` before being offered, and `Hero` additionally drops at render time any term the live list can't answer, so the row can degrade but never lie.

#### Chip *values* are a data decision, not a copywriting one

Counted against the live catalogue on 2026-08-14: duration s 25 / m 40 / l 30 / xl 4 / **xs 1**; cost low 73 / medium 27; effort mod 62 / project 33 / trans 4 / **quick 1**; roi_horizon quick 59 / mid 37 / strategic 4; tier f 34 / t 33 / s 29 / x 4; regulator_pressure n 35 / l 29 / h 24 / m 12.

The homepage finder opens pre-filtered on `duration=s` + `cost=low` = **25 of 100** — narrow enough to look like a filter did something, wide enough that a third chip still returns results (adding `regulator_pressure=h` gives 3, not 0). The obvious "fix it in a fortnight / quick win" chips were deliberately *left out*: `duration=xs` and `effort=quick` have one question each, so the chip the product's own pitch implies would open the demo on a near-empty result. See §4 for why that's a content gap worth closing.

Each chip is a single `(dimension, value)` pair, not a range, because the filter model is one value per dimension in the URL — `QuestionsCatalogue`'s `toggleQuickFilter` writes `values[0]` and ignores the rest, so a chip listing two values was only ever applying the first. The finder links to `/questions?<the same params>`, so the count shown on the homepage and the count on the catalogue after following it are the same number by construction.

#### "0 questions" was the backend being down

Reported as a data bug; it wasn't. The database holds 100 published questions and the domain names match the frontend's hardcoded strings exactly (Risk 60, Cyber 14, Compliance 11, Resilience 11, AI 4). With `uvicorn` not running, the `/questions` query fails, `questions` is `undefined`, and every derived count renders `0` — the page confidently stating the product is empty when it was the *request* that was empty. Domain counts now render an em dash while the catalogue is unloaded or unreachable. Worth generalising: any count derived from a fetch on a marketing surface should distinguish "zero" from "don't know yet."

#### `MarketingLayout.tsx` repair

The file had been corrupted by a bad edit and would not compile. Three distinct breaks:

1. The `cn` import path mangled to `@/lib/utilport`.
2. The footer's Contact `<li>` opening tag split, so its `>` landed six lines later — which broke JSX parsing all the way up to `motion.footer` and produced nine cascading `tsc` errors none of which pointed at the real line.
3. `w-ful` — not a Tailwind class, so the three container `div`s silently lost `width: 100%`.

All three fixed. Worth noting how the third one hid: `w-ful` is not an error anywhere in the toolchain. Tailwind emits nothing for an unknown class, `tsc` sees a valid string, and the build passes — the container just stops filling its parent. A typo'd utility class is invisible to every check this project runs, which is a general hazard, not a one-off.

**Container width is `max-w-7xl`, deliberately.** The same bad edit had widened those three containers from `6xl` to `7xl`, so it looked like corruption and was reverted to `max-w-6xl`. That was wrong — the widening was intentional, and it has since been applied across `Home.tsx` too, so the header, footer and every landing-page section now agree at `max-w-7xl`. `QuestionsCatalogue.tsx` is still on `max-w-6xl` and is the odd one out; that is the surface to reconcile, not the layout.

#### Verification status, and what has moved since

Checked, and worth trusting: all counts, tag distributions and search-term hit rates quoted above came from a live `/questions` response and a direct query against the Supabase database — not from reading the seed files. `tsc --noEmit` and `vite build` both passed on the `Home.tsx` / `QuestionsCatalogue.tsx` work; `tsc` passed on `MarketingLayout.tsx` after the import and `<li>` repairs.

**Changed after the fact, by parallel work:** what is on disk now is not exactly what is described above. The two largest follow-ups have their own sections immediately below (the N+1 removal across the four public read endpoints, and the `.hover-lift` consolidation). One change has no section of its own and is worth recording here, because it retires a link pattern the landing page used to depend on:

`questions` gained a **`domain_slug`** field (API response plus both frontend types), and the domain links now filter on the slug rather than the human-readable domain name. This is a correctness fix, not a rename. The landing page's domain rows previously passed `Risk (Enterprise & op.)` through a URL parameter — a display string containing parentheses and an ampersand. It worked, which is exactly the problem: it would have kept working right up until someone renamed a domain for readability, at which point every domain link on the front page would have started returning zero results with nothing in the code to suggest why. The slug is now the contract; the display name is free to change.

### N+1 queries removed from every public catalogue/product endpoint (2026-08-14)

Four read endpoints — `GET /questions/{slug}`, `GET /courses`, `GET /templates`, `GET /products` + `/products/{slug}` — each had the same shape of bug: ownership and pricing were resolved with one `has_access_to` round trip (itself 2 queries) *per resource*, sometimes nested inside a *per-course* loop that also re-walked module → course per lesson. Each round trip to Postgres costs on the order of hundreds of ms, so a catalogue page or a question with several related lessons could cost seconds on entitlement checks alone — invisible at 1 seeded row (Week 1), real at 100 questions and a growing course list.

Fixed the same way in all four: a new bulk primitive, `resolve_granted_content_ids()` (`app/core/entitlements.py`), takes a user's already-resolved `product_ids` (from `resolve_product_ids`, called once) and returns every granted `content_id` of a given `ResourceType` in a single query — membership after that is a Python `set` lookup, not a query. `products.py`'s content-label resolver was similarly rewritten from a per-product, per-content-row query loop (`_resolve_contents`) into one bulk pass (`_resolve_contents_bulk`) that resolves every template/lesson/module/course/question referenced by *any* product in the response in a fixed handful of queries, then assembles each product's content list from in-memory maps. `courses.py`'s cheapest-product-per-lesson lookup and `templates.py`'s cheapest-product-per-template lookup were both hoisted the same way, out of a per-row loop and into one bulk query for the whole catalogue (`ORDER BY price_amount DESC` + dict-overwrite, so the cheapest product wins by construction — the same trick `questions.py` already used, now applied consistently).

Net effect: each of these four endpoints now issues a **fixed number of queries regardless of how many courses, lessons, templates or products exist**, rather than one that scales with the catalogue's size. No response shape changed — this is purely an internal latency fix, not a contract change.

### A shared `.hover-lift` utility, and small motion consistency fixes (2026-08-14)

`hover:-translate-y-0.5 hover:shadow-md` was independently hand-typed on `QuestionCard`, the two Dashboard cards, the Library continue-rail card and the templates catalogue card — five call sites free to drift on the lift distance with no shared source. Consolidated into `.hover-lift` (`theme.css`), plus `.hover-lift-domain` for `QuestionCard` specifically, which tints the lift shadow toward the card's own `--card-domain-color` instead of a flat neutral grey. Same pass: the quick-filter chips on `/questions` gained `whileTap={{ scale: 0.98 }}` (§39.3's press pattern — a one-shot response to the tap itself, not a hover scale, which §39.3 bans on cards and nothing else in the app uses either); `QuestionRow`'s hover fill moved from a flat `bg-secondary/40` to a `color-mix()` accent tint built from tokens rather than a one-off opacity value; the homepage's domain-section rows gained a `translateX(4px)` hover slide alongside their existing colour transition; and `Library.tsx`'s course progress bars now animate in from 0% on mount rather than snapping straight to their value, on the reasoning that a progress bar is a state becoming known, which §5.2 names as the one place that kind of motion is welcome — it plays once, never loops, and collapses under `prefers-reduced-motion` via the existing global rule.

**Why this pass didn't ship glassmorphism, even though it was asked for first.** `docs/implementation_plan.md` originally proposed `.glass-panel` frosted cards, a looping "organic drift" on `.stage-aurora`/`.page-wash`, and a 4px hover-lift, across every screen. All three were checked against this doc before any component was touched and dropped: §5.2 `[DECIDED]` still bans glassmorphism by name even after the 2026-08-11 liveliness pass un-banned gradients — and it isn't a theoretical rule, `Contact.tsx`'s own docstring records a `bg-card/70 backdrop-blur-xl` card being built and then ripped out for exactly this. §39.2 bans looping/ambient motion outright ("Nothing loops"), and both washes are already documented as static paint by design. §39.3 fixes card hover at 2px, no scale — which is what the app already did everywhere before this pass touched it; the plan's 4px would have been a regression, not an upgrade. Owner confirmed 2026-08-14: stay in-system. `docs/implementation_plan.md` carries the full before/after table if this needs re-litigating; nothing in it should be read as still-pending work — glassmorphism specifically should not be picked back up from that file without a fresh, explicit decision to reverse §5.2, the same way §5.3 explicitly reversed the gradient ban.

### The dark plane: `--stage`, the aurora, and a whole class of theme bug (2026-08-13)

The marketing surfaces were rebuilt against six Watermelon UI blocks the owner chose (hero-1, footer-7, footer-19, auth-08, auth-10, contact-7), sourced from the shadcn registry JSON rather than the `npx` CLI, per owner instruction. Most of that is styling and is documented in `DESIGN.md` §33.3. Two things that came out of it are **rules**, not styling, and are the reason to read this:

**1. `--primary` inverts between themes, and the dark plane doesn't.** `--primary` is midnight navy in light and `#6FA8DC` — a *light* blue — in dark. The hero and footer were `bg-primary`, so switching to dark mode turned them pale exactly when they should have been darkest. Fixed with a separate `--stage` / `--stage-foreground` pair that means "the dark plane" in both themes and never flips.

The important part is what the fix exposed. The same mistake had shipped **eight** times: the hero search input and its three result labels, the newsletter field and its button, the footer's brand mark (an *invisible* navy square on navy in the light theme), and `StatusDot`'s label (near-black espresso on the dark panel — invisible the other way round). Every one passed review, because each read correctly in whichever theme the author happened to have open. `DESIGN.md` §7.6 now carries the rule: **a token that flips is safe only on a surface that flips with it.** Before adding anything to a `bg-stage` surface, grep it for `primary`.

`StatusDot` is worth calling out separately as the component-level version of the same trap: a shared component **cannot pin a foreground token**, because it doesn't know which plane it's standing on. Its label now inherits colour, and its dot takes an explicit `on="stage"` prop — because a decorative dot wants the *opposite* shade from what text wants (`--gold` vs the text-safe `--gold-strong`).

**2. A gradient's contrast is only real where the text actually lands.** `.stage-aurora` (one class in `theme.css`, three consumers, so hero/auth/footer can't drift apart) paints a four-rung blue ramp into the bottom-right corner. Its brightest rung is **1.48:1** against the foreground in the light theme, so it can never sit under text — the class keeps the text region dark structurally, via corner-anchoring plus two scrim layers, rather than by hoping the copy stays short.

The token-level maths said the auth panel was safe. Sampling the **rendered pixels** under the actual paragraph said otherwise: **4.36:1, before** its 75% opacity was applied. A bottom-left scrim brought it to 6.30:1 at the text's far edge. If a future change moves that copy wider or brighter, re-measure from a screenshot — a swatch-level audit cannot see this failure. The measured figures are tabulated in `DESIGN.md` §7.5.3.

### Inbound email: the contact page (2026-08-13)

`/contact` is the first surface where mail travels *toward* the business. Two decisions worth not re-litigating:

- **It writes to its own table (`contact_messages`), not to `leads`.** `leads` holds an address and an entry point and has nowhere to put what the person actually said — routing the form through it would have persisted the email and silently discarded the message, which is the only part the sender cared about.
- **The row commits before the notification is attempted, and a failed send cannot fail the request.** The mail transport is a sandbox sender (below), so coupling them would make a working form look broken. `contact_messages.notified` records whether the owner alert actually went out, so an enquiry that arrived during an outage is findable with a query instead of by trusting that someone read that day's logs.

The notification escapes every interpolated value — it's the only email in the system built from wholly untrusted input, since a stranger with no account chooses both the name and the entire message body. `reply_to` is set to the sender so the owner can just hit reply; it's a convenience, not a claim, because nothing about that address was verified.

The footer's "Contact" link changed from a `mailto:` to this page. A `mailto:` is a dead end on a corporate laptop with no mail client wired to the browser — which is the exact machine most of this audience reads on. The address stays printed on the page, so nothing was taken away.

**Verified end to end against production**, not asserted: `POST /contact` → row stored → `notified = true` → Resend log line confirming delivery to the owner address. The test row was then deleted (`contact_messages` is empty).
### What the weekly build produced, without the chronology

The project ran as timed weekly slices, each with its own plan, ledger and Go/No-Go report.
Those reports are retired; what they produced is described by capability in §§5–10 rather than
by date. Two things from that history are worth carrying forward as judgements rather than
records:

**The engineering side closed every week; what carried forward was always the same category of
item.** Not more code — something that needed a human doing the thing for real: a device, a
mailbox, a stranger's eyes. That is still exactly what §11's open list looks like.

**Two structural investments were made early and are load-bearing.** The first is the index
layer: before it, the entire database had three explicit indexes and **every foreign key was
unindexed**, including `entitlements.user_id`, which is read on every gated request. Eighteen
indexes were added under `CREATE INDEX CONCURRENTLY`, each justified by measured
`EXPLAIN (ANALYZE, BUFFERS)` evidence against a synthetic 20k-user dataset built and rolled back
inside one transaction; two candidates were rejected because they measured as unhelpful, and
four UNIQUE constraints turned entitlement/order/progress uniqueness from "guaranteed by careful
coding" into "guaranteed by the database". The second is the email spine (§7), rebuilt on
Mailjet over REST with Jinja2 templates after the previous provider's sandbox sender proved it
could only deliver to the account owner's own address — silently redirecting every buyer
receipt.

### Decisions that shaped the data model

- **Entitlements, not "has this user bought this product"** — `entitlements` rows reference a `(user_id, resource_type, resource_id)` tuple with a `granted_via` enum (`purchase` today; the enum exists so comps/admin grants/course bundles don't need a schema change later). `has_access_to()` (`app/core/entitlements.py`) is the single choke point every gated endpoint calls — lessons, templates, and (until this session) question bodies all went through it.
- **Questions are the free entry point, templates/lessons are the product.** This was *not* the original model — until this session, a question's full body was withheld entirely behind the same purchase-entitlement check as templates/lessons, which meant nothing was actually free to read beyond a 160-character teaser. Reworked so `GET /questions/{slug}` always returns the full body; the frontend soft-gates it behind an email capture (`EmailGatedBody.tsx`, CSS blur + `/leads`), which is a conversion device, not a security boundary. The `gated` field now describes only the template/lesson upsell card shown alongside the free text.
- **Webhook idempotency is a database constraint, not application logic.** `webhook_events.stripe_event_id` is unique; the handler inserts that row *first*, before touching orders/entitlements, and treats a conflict as "already handled, return 200." This is what makes Stripe's automatic retries safe rather than something to reason about per-handler.
- **`str_enum()` helper is load-bearing, not decoration.** SQLAlchemy's plain `Enum()` sends a Python enum member's `.name` (uppercase) to Postgres by default, not `.value`, and separately auto-derives the Postgres type name from the Python class name — both wrong for this schema. `app/db/base.py`'s `str_enum()` fixes both and makes `name=` a required argument specifically so the second bug can't reappear silently on a new enum column.

---

## 2. Adding a new section — step by step

There's no admin UI yet (see §4) — content is authored as SQL seed files under `backend/db/seed/`, applied directly against Supabase. The real seed files (`003`–`006`) are the actual worked examples; this is the pattern they follow.

### Adding a new question

1. Write a SQL insert into `questions` (title, subtitle, body, preview ≤160 chars, `domain_id`, tag foreign keys — see `001_seed_domains_and_tags.sql` for what tag values already exist). Follow `003_seed_q001_question.sql` as the template.
2. Set `published = true` when it's ready to go live — unpublished questions 404, they don't 403 (there's a difference: 404 doesn't reveal the slug exists at all).
3. That's it for a standalone question. It's reachable at `/questions/{slug}` immediately, publicly, full body included (per §1's model).

### Adding a new course

1. Insert into `courses` (slug, title, subtitle, description, `section_id`, `author_id`, `published`).
2. Insert one row per module into `modules` (title, description, `sort_order`, `course_id`).
3. Add lessons to each module (below). `GET /courses/{slug}` and `GET /courses/{slug}/lessons/{lessonSlug}` need nothing course-specific beyond this — a second course works the moment it's seeded and published, no code change.

### Adding a new lesson — video, reading, or download

`Lesson.lesson_type` is `video` / `reading` / `download` / `mixed`; what to insert depends on which:

1. Always: insert into `lessons` (slug, title, description, `lesson_type`, `module_id`, `sort_order`, `published`).
2. **video** — upload through the Mux dashboard/API to get an asset + `playback_id`, then insert into `media` with `mux_playback_id`, `status = 'ready'`, linked by `lesson_id`.
3. **reading** — set `lessons.body` directly (the full text; the frontend renders it as-is, no markdown processing). No admin UI yet, so this is a raw `UPDATE`, same as `008_seed_reading_lesson_body.sql` did.
4. **download** — the lesson's file *is* a `templates` row (upload to Storage, insert into `templates`, same as the template steps below), then set `lessons.download_template_id` to point at it. This reuses the template's storage/file columns rather than duplicating them, and gates the download by *lesson* entitlement, not a second, separate template purchase.
5. **mixed** — combine any of the above; the frontend renders whichever pieces are actually present (`has_video`/`body`/`download` in the API response), not a hard switch on `lesson_type`.
6. The lesson is reachable at `/learn/{courseSlug}/{lessonSlug}` (the outline/sidebar/prev-next interface) once its module/course exist — but, same rule as before, only to someone entitled to it. Entitlement comes from owning a product that includes it, not from the lesson existing. **There is no free-preview mechanic** — an explicit owner decision overriding DESIGN.md §23.3's recommendation; video and lessons are never reachable without a real purchase, full stop.

### Attaching a question to a module

A module's outline can list a question alongside its lessons — e.g. "the write-up this module is built on." Insert into `module_questions` (`module_id`, `question_id`, `sort_order`); it shows up in both the public syllabus and the learning sidebar with no lock/progress state, since questions are always free. `009_seed_module_question_link.sql` is the worked example.

### Adding a new template (downloadable file)

1. Upload the file to the Supabase Storage bucket (`SUPABASE_STORAGE_BUCKET_NAME`).
2. Insert into `templates` with the `storage_key`, `file_name`, `file_size_bytes`.
3. Same rule as lessons: existing ≠ accessible. Needs a product (or a `lessons.download_template_id` link, per above).

### Bundling content into a sellable product

1. Create the Stripe Product + Price via the Stripe API or dashboard (test mode first) — note the `price_id`.
2. Insert into `products` (name, description, `price_amount` in cents, currency, `stripe_price_id`, `published`).
3. Insert one `product_contents` row per included item (`content_type` ∈ `template`/`lesson`/`question_set`, `content_id` = the actual row id). `GET /products/{slug}` resolves these into real labels *and* real hrefs (`/templates/{id}`, `/lessons/{id}`, `/questions/{slug}`) — this is what makes "See what's included" actually clickable rather than a static list, a real bug this session found and fixed.
4. Buying it (real Stripe Checkout → webhook → `create_order_from_checkout`) grants entitlements to every `product_contents` row at once, in one transaction.

### Discovery is real, and nothing on a public page names a specific slug any more

Real catalogues exist and need no code change to show new content: `GET /courses` + `/courses/{slug}`, `GET /templates`, `GET /questions` + `/questions/{slug}` are all live, and the public header / member sidebar link to all three. Seed a second question, course, or template and publish it — it appears in its catalogue automatically.

`[UPDATED 2026-08-14]` The `WEEK1_QUESTION_SLUG` / `WEEK1_PRODUCT_SLUG` constants this section used to warn about are **gone** — `grep` returns nothing across `frontend/src`. `Home.tsx` and `Dashboard.tsx` both select what they feature from the live list endpoints instead (Home takes the first question in each domain, so its four sample cards shift automatically as the catalogue is re-ordered or extended). Seeding new content is now enough to have it both *found* and *promoted*.

What replaced the hardcoded-slug problem is a softer one worth naming: "first in each domain by `created_at`" is not an editorial choice. The four questions on the landing page today are good ones by luck, not by decision. A real `featured` boolean (or a `sort_order` the owner controls) is the honest fix the day someone wants a say in what the front page argues with.

---

### Reading what came in through the contact form

There is no admin screen for this yet. Contact submissions land in `contact_messages`, and until §4 item 2 is closed you read them the same way you author content — directly against Supabase:

```sql
select created_at, name, email, enquiry_type, notified, message
from contact_messages
order by created_at desc;
```

`notified = false` means the row was stored but the owner alert did not send — that is the set worth checking after any email outage, because nobody was told those exist. Nothing else in the app reads this table.

---

## 3. Running costs, and where they grow

All figures checked live against each provider's current pricing pages, not from memory.

| Service | Free tier today | Cost once it grows | Grows with |
|---|---|---|---|
| Vercel (frontend) | Hobby, $0 — **but ToS-prohibited for commercial/revenue use, and this app already takes real payments** | Pro, $20/seat/month | Not usage — this is a compliance gap, see §4, not a scaling one |
| Render (backend) | — (Starter tier used from day one, not Free, because of cold-start) | $7/month flat, Starter | Compute/bandwidth beyond Starter's included capacity |
| Supabase (DB + Auth + Storage) | 500MB DB, 1GB file storage, 5GB bandwidth, 50k MAU, 2 active projects (pauses after 1 week idle) | Pro tier, from $25/month | Question/user/order row count (DB size), template file count/size (storage), traffic (bandwidth) |
| Stripe | No monthly fee | ~1.75% + A$0.30 per domestic AUD transaction (~1.925% + A$0.33 after GST on the fee itself), ~2.9% + A$0.30 international | Per-transaction, scales with sales volume automatically — no action needed, just a real cost to model into pricing |
| Mux | 10 encoding hours/month, 100,000 delivery minutes/month free | Encoding from $0.015/min (baseline) or $0.035/min (smart); delivery from $0.0024/min past the free tier | Number and length of lesson videos (encoding, one-time per video); watch time (delivery, ongoing) |
| Mailjet (the email transport) `[RESTORED 2026-08-15]` | 6,000/month (200/day) on Mailjet's free tier | Paid from ~$15/month past the free tier | Order volume (2 emails per sale: receipt + owner notification), plus one per contact-form/password-reset/lead capture. Volume is nowhere near the free tier. |
| ~~Resend / Brevo~~ | — | — | Resend removed from the send path 2026-08-15 (its sandbox sender could never reach a real buyer inbox without domain verification — see §1). Brevo is SMTP-only and therefore cannot work on Render at all (see §1). Neither costs anything while disconnected. |
| Domain | Not purchased yet | ~$10–15/year for a `.com`/`.com.au` | One-time decision, not usage-based — real domain ownership is what would let email skip the whole multi-provider fallback chain recorded in `ENGINEERING_NOTES.md` §7 |

**Today's real monthly floor, ignoring Stripe's per-transaction cut: ~$7 (Render Starter)** — everything else is still inside its free tier. That changes the moment Vercel's commercial-use restriction is addressed (§4) or Supabase/Mux free-tier limits are hit.

---

## 4. Known gaps and shortcuts taken knowingly

Ranked roughly by how much they matter, not by when they were found.

1. **Vercel Hobby's commercial-use restriction is currently being violated.** Real Stripe payments are flowing through a Hobby-tier deployment. This is a ToS/compliance gap, not a performance one — Vercel could enforce this at any time. Fix is a $20/month upgrade to Pro; not done because it wasn't identified as a blocker until this handover pass.
2. ~~**No admin UI.**~~ **Substantially closed, 2026-08-20.** 16 admin pages now exist (`AdminQuestions`, `AdminCourses`, `AdminTemplates`, `AdminProducts`, `AdminAssessments`, `AdminOrders`, `AdminUsers`, `AdminMetrics`, `AdminMedia`, `AdminPromotions`, `AdminReviews`, `AdminContact`, `AdminLeads`, `AdminAudit`, `AdminSettings`, `AdminPacks`) plus `LessonWriteScreen` for rich-text lesson editing. The one remaining gap: **module-question attachments** have no admin UI — they're still authored via direct DB writes. Everything else from the original list (questions, courses, modules, lessons, templates, products) is now editable through the admin panel.
3. ~~**No real customer receives any email.**~~ **Closed, 2026-08-15.** Resend's sandbox sender (`onboarding@resend.dev`) could only deliver to the Resend account's own address, so every message — buyer receipts included — was redirected to `OWNER_NOTIFICATION_EMAIL` with a `[Not delivered to buyer]` subject prefix. Week 3 Phase 1 replaced Resend with Mailjet as the sole transport (§1) — Mailjet delivers to real addresses today, with no domain-verification prerequisite, and every send is confirmed via Mailjet's REST Message resource rather than assumed from a quiet log. Domain purchase (§3/§5) remains worth doing for its own sake — a verified sending domain reads less like a third-party relay in a recipient's inbox — but it is no longer a blocker for delivery to actually happen.

    Two related traps this arc left behind, still worth knowing before touching email again:
    - **Render blocks outbound SMTP (port 587)** — `[Errno 101] ENETUNREACH`. Any SMTP-based provider (Gmail, Brevo) is structurally impossible on this host. Only HTTP transports (Mailjet's REST API included) work.
    - **Absence of an error log is not evidence of delivery.** During the Resend arc "it sent" was concluded twice from a missing failure line, and both times was wrong — the provider's own API had the real answer. Non-negotiable #12 now codifies this: confirm via the provider API, never infer from log silence.
4. **Supabase's "Confirm email" project setting** is on (the project default) and has caused real confusion — a real user's sign-up appeared broken because they hadn't clicked the confirmation email yet, and separately a confirmation link redirected to `localhost:3000` until `emailRedirectTo` was added explicitly to the sign-up call. The Supabase Auth "Site URL"/"Redirect URLs" dashboard settings still need a one-time check to make sure they point at the real production origin, not a leftover default. `[UPDATED 2026-08-15]` The same check now also applies to the new password-reset flow (§1) — its `redirect_to` is built from `FRONTEND_URL`, so this dashboard setting governs both sign-up confirmation and recovery links. This is a dashboard-only setting; it cannot be checked or changed from a coding session.
5. `[UPDATED 2026-08-26]` **Automated test suite — now comprehensive.** Backend: 602 pytest tests covering entitlements, assessments, certificates, promotions, reviews, search, notes, bookmarks, money flows, and admin endpoints. Frontend: 267 Vitest unit/component tests + 235 Playwright E2E tests (accessibility, responsive widths, stress fixtures, gating, notifications, search keyboard nav). The taxonomy parity test (`test_taxonomy_parity.py`) reads `QuestionsCatalogue.tsx` directly to verify every hardcoded value exists in `tag_values`. The `asserts_commit` fixture verifies every mutation endpoint actually commits. The gap is no longer "no tests" — it's that some surfaces (email rendering in hostile clients, the keyboard-purchase E2E walk) are still flaky or untested.
6. ~~**No literal human-driven browser checkout test.**~~ **Closed, 2026-08-17.** A real mobile checkout walk ran at 390×844 (sign in → browse → buy → pay with Stripe's `4242 4242 4242 4242` test card → `/checkout/success` → download the purchased template), confirmed via a direct DB read of the resulting order/entitlement, then cleaned up (every row this created was deleted, confirmed back to the pre-walk state: 2 orders, 2 entitlements, 0 test users). One local-only wrinkle it surfaced, not a product defect: no `stripe listen` process forwards webhooks to a local backend, so the entitlement didn't land automatically the way it will against the real deployed webhook endpoint — worked around by re-fetching the real, already-paid Stripe session and re-delivering it as a genuine, correctly-signed webhook POST, which exercises the real handler rather than bypassing it.
7. ~~**No refund policy defined.**~~ **Closed, 2026-08-20.** `/legal/refunds` now has a real policy: consumer guarantees always apply; change-of-mind self-serve refund up to 15% course completion (15% retention); past 15% or for templates/packs, contact support. The `REFUND_POSITION_TEXT` constant is shared across `/store` footer, receipt email, and the refunds page via `lib/labels.ts` (and its Python twin `backend/app/core/labels.py`). The self-serve refund eligibility check lives in `Purchases.tsx` and calls `GET /me/orders/{id}/refund-eligibility`.
8. ~~**No entitlement-revocation flow.**~~ **Closed, 2026-08-16.** `refund_service.apply_refund()` sets `revoked_at`/`revoked_reason` on every entitlement the order granted, flips the order to `refunded`, and writes an audit row. Called from both `POST /admin/orders/{id}/refund` (issues Stripe refund first) and the `charge.refunded` webhook (Stripe already refunded). Whichever arrives second sees `already_refunded` and no-ops. The gate (`resolve_product_ids` in `entitlements.py`) checks `Entitlement.revoked_at.is_(None)` — one filter, one query, no second check anywhere else.
9. ~~**The Week 1 scope guardrail is hardcoded, not configured**~~ **Closed, 2026-08-14.** The `WEEK1_*` slug constants are gone from the frontend entirely; both Home and Dashboard select from the live list endpoints (§2). ~~Replaced by a smaller successor gap: **there is no editorial control over what the landing page features.**~~ **Closed, 2026-08-16.** `questions.featured` / `featured_sort` columns exist; `FeaturedToggle` (star + sort order) and `FeaturedSummary` line on `/admin/questions`; `Home.tsx`'s `QuestionShowcase` prefers the curated, `featured_sort`-ordered set, falling back to one-per-domain only when nothing is featured.
10. **The taxonomy's quick-win end is nearly empty, and the product's pitch depends on it.** `[ADDED 2026-08-14]` The sentence this platform sells itself with — from the Research Specification, the intern brief, and now the landing page — is *"what can I fix in a fortnight, cheaply, that my regulator cares about?"* The real distribution across the 100 seeded questions is `duration = xs` → **1 question**, `effort = quick` → **1 question**. Cheap is fine (`cost = low` is 73) and regulator pressure is fine (`h` is 24); it is specifically the *fortnight* half of the promise the content cannot currently answer. This is why the homepage finder opens on "2–6 weeks" rather than "under 2 weeks" (§1). Two honest fixes, and the choice is editorial, not technical: re-tag questions whose real duration was over-estimated, or write the short-horizon questions the pitch implies exist. What should **not** happen is a landing-page chip that promises a fortnight and returns one result.
11. **99 of 100 questions still have a machine-derived `preview`.** `[ADDED 2026-08-14, previously buried in §5]` `011_seed_100_questions.py` cuts a stopgap at a sentence boundary and says so in its own docstring; DESIGN.md §20.3 explicitly bans a machine-truncated preview. This is now more visible than it was: `preview` is half of what the homepage and catalogue text search match against, so a weak preview is a discoverability problem, not only a typographic one. Genuine editorial work, not engineering.
12. **A module's lessons and its attached questions are two separate `sort_order` sequences, not one merged order.** A question attached to a module (`module_questions`) always renders after that module's lessons in both the syllabus and the learning sidebar, regardless of how its `sort_order` compares numerically to a lesson's — there's no single interleaved position field. Fine for "one or two questions per module, always at the end"; would need a real unified-ordering model (or a `kind` + shared `sort_order` namespace) if a question ever needs to sit *between* two lessons.
13. **`docs/DESIGN.md` §18.2 ("no hero image, no gradient")** was deliberately overridden on the landing page redesign per direct owner feedback ("looks only white, use colour") — the doc itself hasn't been updated to reflect that, so it currently contradicts what's actually built. This is now a deliberate, documented direction rather than an accident: the August 2026 art-direction pass re-materialised the whole token set in `theme.css` as **warm ivory + midnight navy + champagne gold** ("private bank meets editorial publisher"), which adds a static gold/navy radial wash behind the hero type (`.hero-wash`), a 2px gilt hairline atop the marketing header, gold left-rules on featured cards, and gold section eyebrows (`.eyebrow`) — all implemented through semantic tokens, never hardcoded hexes in components. §7's colour-role map still holds (navy = brand/authority, gold = the one sparing accent); what changed is the material itself. The dark side of that system is now reachable, not just defined: a theme toggle (`stores/useThemeStore.ts` + `components/ui/ThemeToggle.tsx`) flips `.dark` on `<html>` from the marketing header, the auth pages, and a fixed top-right corner on member pages; the choice persists to `localStorage['practicable:theme']`, the OS preference is only the first-visit default (§55: "we do not follow the OS blindly" — a manual choice wins and the app never re-reacts to OS changes while open), and an inline script in `index.html` applies the class before first paint so there is no light→dark flash. Toggling also rewrites the `theme-color` meta so mobile browser chrome matches.

    **Follow-up coherence pass (same session):** the premium language is now applied as a *system* rather than page-by-page. The gold-rule section heading is a shared primitive (`components/ui/SectionHeading.tsx` — used by Question, CourseDetail, anywhere a gilt-rule h2 is wanted; text-only children by contract). The buy surface is one family: gold left-rule card + gold 24px price + icon tile on Question, CourseDetail, ProductBuy, and the Dashboard/Home product cards alike (gold is documented large-text-only in `theme.css`, so a future shrink is caught by the comment on every price line). EmptyState gained an `icon` prop (circular tile = status/moment surfaces; square `size-9 rounded-md` = data tiles — the shape family split is documented in the component). The marketing header now has a real mobile slide-over nav (it had *no* mobile navigation before — nav was `hidden md:flex` with nothing replacing it), mirroring MemberLayout's sheet pattern with `role="dialog"`, Escape-to-close, and `autoFocus` on the close button. Auth pages carry brand for the first time (wordmark + gilt hairline above the card), and their page titles are genuine `<h1>`s with the `text-h2` token instead of `CardTitle` with an inline `fontSize` (which both violated §42.1's one-h1 rule and the token discipline). Checkout outcomes use status icon tiles rather than a literal "✓" glyph. Reading bodies everywhere honour `text-read`'s 1.7 line-height (the old `leading-relaxed` override was flattened in `Learn.tsx`, matching the `EmailGatedBody` fix).

14. ~~**A buyer is owed a receipt, manually.**~~ **Moot, checked 2026-08-15.** `mail@gmail.com`'s two orders (`c2947bdc`, `46ff0ba1`) no longer exist in the database — the live database holds only 2 real orders today, both the owner's own test purchases, consistent with the intentional data wipe recorded elsewhere in this doc's decision log. There is nothing left to send a receipt for. If a similar gap surfaces for a real future buyer, §4 item 3's fix (Mailjet, now live) means it would no longer happen in the first place.

15. **Production environment variables are not in sync with the code.** `[ADDED 2026-08-13, UPDATED 2026-08-15, CHECKLIST 2026-08-20]` Deploying the current backend without the Mailjet vars set produces a loud `logger.error` on every send attempt and no email — the intended failure mode, but still a failure. This is a checklist to run against Render's environment (Dashboard → the backend service → Environment), not just a note — tick each line for real before calling it done, this file cannot verify Render's dashboard from a coding session.

   **Remove — Resend/Gmail-era, no code path reads these any more:**
   - [ ] `RESEND_API_KEY`
   - [ ] `GMAIL_USER`
   - [ ] `GMAIL_APP_PASSWORD`

   **Set or confirm — every var `backend/.env.example` and `app/core/config.py` require or expect in production:**
   - [ ] `DATABASE_URL` (Supabase pooler, **session mode, port 5432** — not 6543; see `.env.example`'s own warning)
   - [ ] `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `SUPABASE_JWT_AUDIENCE`
   - [ ] `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (the webhook secret is per-endpoint — confirm it matches the production webhook, not the local `stripe listen` one)
   - [ ] `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`
   - [ ] `SUPABASE_STORAGE_S3_ENDPOINT`, `SUPABASE_STORAGE_REGION`, `SUPABASE_STORAGE_ACCESS_KEY_ID`, `SUPABASE_STORAGE_SECRET_ACCESS_KEY`, `SUPABASE_STORAGE_BUCKET_NAME`
   - [ ] `MAILJET_API_KEY`, `MAILJET_SECRET_KEY`
   - [ ] `MAILJET_SENDER_EMAIL` — **and confirm it's still verified** in the Mailjet dashboard (Senders, Domains & Dedicated IPs → Senders); verification can lapse independently of the env var being set
   - [ ] `MAILJET_SENDER_NAME`
   - [ ] `OWNER_NOTIFICATION_EMAIL` — a real inbox someone reads, never a customer address
   - [ ] `FRONTEND_URL` — the real deployed Vercel origin, not `localhost:5173`
   - [ ] `ALLOWED_ORIGIN` — same real Vercel origin; a mismatch here is what produces "400 Disallowed CORS origin" in the browser, not a 500 in the logs, so it's easy to miss
   - [ ] `POSTHOG_API_KEY`, `POSTHOG_HOST` — optional, the client no-ops without them, but confirm deliberately rather than by omission (§4 item 34's PostHog decision is still open)
   - [ ] `SELLER_LEGAL_NAME` — optional (W4-R2); the invoice block prints a placeholder seller name if unset. **No `SELLER_ABN` to set** — removed from the app entirely, decision #31, not an env var that was ever meant to be filled in

   **After setting these:** trigger a redeploy (env changes on Render don't apply to an already-running instance), then confirm with a real send — the owner-notification email on any test purchase is the cheapest live check, since it fires on every completed order regardless of the buyer's own email delivery.

16. **No admin UI for pricing.** `[ADDED 2026-08-15]` Raised live by the owner while clicking through the admin area; confirmed as a real gap, not user error — `/admin` has no screen to set or change a `products.price_amount`. Consistent with §4 item 2 ("no admin UI") rather than a new category of problem, but worth naming on its own since it's the one piece of "no admin UI" with a direct revenue impact (a product that can't have its price set can't be sold correctly). Deferred by owner choice mid-Week-3; not urgent, not yet built.

17. ~~**Cart / multi-item checkout does not exist yet.**~~ **Closed, 2026-08-16.** `checkout.py`/`webhooks.py`/`order_service.py` all take a list of product ids now; `useCartStore` (zustand + `persist`, `localStorage`) backs a header cart icon + drawer reachable from every layout. See §1's new Phase 3 section for the full shape and what's still worth checking (a real end-to-end test-mode purchase with 2+ cart items has not been walked by a human, only by the automated gating suite).

18. ~~**`CheckoutSuccess.tsx` and `Template.tsx` title their page with a `CardTitle` (`h3`), not `PageTitle`'s `h1`.**~~ **Closed, 2026-08-20** (`cfa6b9d`, `f021be2`). Both now render a real `PageTitle` `h1`. `/checkout/success` is in `accessibility.spec.ts`'s `PUBLIC_ROUTES` (`85b55dc`, 2026-08-19); `/templates/:templateId` is covered by that file's separate dynamic real-template-detail-page test rather than a static entry, since it needs a real id to resolve. `[ADDED 2026-08-17]` Found by the mobile checkout walk (§4 item 6), not by the axe sweep — the same underlying pattern was found and fixed sitewide on `/courses`, `/templates` and `/questions` earlier the same week (all three skipped from `h1` straight to each card's `h3` with no `h2` between — `sr-only` `h2`s added, no visual change).



---
## 5. The platform

A live site with public marketing pages, sign-up/sign-in, and a member area. Legal pages
(terms, privacy, refund position) are drafted, not self-published. Analytics are privacy-first
and first-party.

**Public surface.** `Home` is a working question finder rather than a pitch: the hero searches
the real catalogue, and every suggested term is counted against `/questions` before it is
offered, so the row can degrade but never lie (§1). `/questions` is a seven-dimension filter
whose options are derived from what is actually published — never a taxonomy value that would
return zero results. Filters are URL params, so links land pre-filtered. `/store` carries the
catalogue and absorbed the former `/pricing` page (a three-column tier grid read as SaaS
plan comparison when every price here is one-time); `/pricing` redirects rather than 404s.
`/contact` writes to its own `contact_messages` table, commits the row before attempting the
owner notification, and records whether that notification actually went out.

**Search.** Postgres full-text across courses, templates, questions and packs — generated
`tsvector` columns (not trigger-maintained; a trigger is a second place the truth lives) with
GIN indexes, weighted title → A, subtitle → B, body → C. `GET /search` groups by type, ranks
by `ts_rank_cd`, and runs **exactly four queries regardless of result volume**. It uses
`websearch_to_tsquery`, which accepts phrases and never raises on malformed input. Reachable
from a keyboard-navigable header command palette (`role="dialog"`, `aria-activedescendant`) and
a `/search` results page with a real labelled form — that page was originally reachable only by
editing the URL.

**Accounts and notifications.** A persistent `AppHeader` on every signed-in page carries cart,
notification bell, theme toggle and an account menu. Notification preferences, a notifications
page, and an admin-triggered password reset all exist.

**Legal and analytics.** `/legal/refunds` carries a real policy: consumer guarantees always
apply; self-serve change-of-mind refund up to 15% course completion, past that contact support.
The wording is one shared constant across the `/store` footer, the receipt email and the
refunds page (`lib/labels.ts` and its Python twin `app/core/labels.py`), so the three cannot
drift. Analytics are first-party (`filter_events`, `download_events`) with an admin metrics
page reporting numerator+denominator pairs rather than bare percentages.

**Hosting.** Vercel (frontend), Render Starter (backend), Supabase (Postgres, Auth, Storage).
See §1's stack table for what was rejected and why, and §4 item 1 for the live Vercel
commercial-use gap.

---

## 6. Learning

Courses break into modules and lessons, with three lesson types — **video** (Mux, signed
RS256 playback), **reading** (`body`), and **download** (`download_template_id`, reusing the
`templates` table's storage columns rather than duplicating them). A lesson's download is gated
by *lesson* entitlement, not by also being sold as a standalone template.

**Progress is tracked and visible.** `LessonProgress` and `CourseProgress`;
`POST /lessons/{id}/complete` marks progress and live-recomputes the course-level rollup, so
the catalogue's "% complete" and the outline's checkmarks cannot drift apart. The Dashboard
carries a resume panel with estimated time remaining (from `courses.estimated_duration_minutes`),
and the Library shows per-course progress bars.

**Assessments.** Per-module assessments with a full admin authoring panel. Publish is blocked
while `publishBlockers` exist — no questions, no options, no correct answers, or a
single-choice question with multiple correct answers — and the panel auto-expands and highlights
the offending questions rather than reporting a count. Delete is guarded by attempt count
(`?force=true` overrides). `ModuleOut` carries `has_assessment`/`assessment_title`, so the Learn
sidebar shows an assessment link per module.

**Certificates** (the brief asked for a proposal if cheap; it was, so it was built). Issued
automatically on the `false→true` edge of `CourseProgress.completed`, via
`INSERT ... ON CONFLICT DO NOTHING` — the `UNIQUE(user_id, course_id)` constraint is the guard,
not a SELECT-then-INSERT race. The gate requires **all** published module assessments passed,
on both issuance paths (lesson completion and assessment submission); whichever fires second
mints the single certificate. Previously a learner could finish every lesson, pass one
assessment, and be issued a certificate on the lesson path.

Certificates freeze snapshots at issue time (`learner_name_snapshot`, `course_title_snapshot`),
so a course rename does not rewrite issued documents. PDF generation is lazy — a slow render
never blocks lesson completion. `GET /verify/{code}` is public and rate-limited **by caller IP**
(it was first keyed on the verification code, which gave every guess its own counter). Refunds
set `revoked_at`, and the verify page shows revocation state. Download is reachable from both
the Dashboard and the course detail page via a shared `downloadCertificate` utility.

**Notes and bookmarks.** Per-lesson notes with autosave (`UNIQUE(user_id, lesson_id)`, upsert);
bookmarks on `CreatedAtMixin` rather than `TimestampMixin` because they are append-only, never
edited. `/saved` renders bookmarks grouped by type, showing unavailable items as text rather
than a dead link.

**Two traps worth knowing.** The certificate PDF once rendered a **blank page** — it emitted
`Tj` operators with no enclosing `BT`/`ET` text object, which a conforming renderer discards.
Every learner's name, course and verification code was silently dropped, and the one existing
test patched the renderer to raise, so it shipped invisibly. The suite now extracts via Poppler
(`pdftotext`), not pypdf, whose lenient parser passed against the broken stream. Separately,
bookmarks were **entirely non-functional** for a period: a `TimestampMixin` column the migration
never created, with a bare `except Exception` reporting the failure as a 409 "already
bookmarked" — so the *first* bookmark on any item always failed, and looked like success.

**Known gap:** a module's lessons and its attached questions are two separate `sort_order`
sequences, so an attached question always renders after that module's lessons regardless of
its number (§4 item 12). Captions on video are not yet authored.

---

## 7. Commerce

**Hosted checkout.** Stripe Checkout, so this app never touches card data even transiently.
`POST /checkout/session` takes `product_ids: list[str]` — a direct "Buy" is the one-item case
of the same call, not a separate path — and builds one session with one line item per product.
`invoice_creation` and `billing_address_collection` are on, giving tax-invoice-quality receipts
for business buyers. Checkout reuses one Stripe **Customer** per email rather than minting a
throwaway on every purchase; the lookup is by email, since there is no `stripe_customer_id`
column yet, so an account email change would produce a second Customer.

**Cart.** `useCartStore` (zustand + `persist`, localStorage) backs a cart button in both chrome
variants and one `CartDrawer` mounted once in `RootLayout`, so state cannot desync between
layouts. `CheckoutSuccess` polls `/me/entitlements` until *every* product in the set is
entitled before declaring success and draining the cart — never on the Stripe redirect alone,
so a payment whose webhook hasn't landed can't show an emptied cart for an incomplete purchase.
A pre-purchase check (`_already_fully_owned`) refuses with a 409 **before Stripe** any product
whose content the buyer already holds entirely.

**Products and pricing.** Several real products with a deliberate price ladder (`DESIGN.md`
§27), including a bundle — Risk Register Fundamentals + the Risk pack, A$98 separately → A$79.
The bundle's `product_contents` are a live `SELECT DISTINCT` union of both parts' grants rather
than a hand-copied id list, so a change to either part is picked up on the next seed run, and it
introduces **no new entitlement mechanism**. The **free entry point** that earns an email
address is the email-gated question body plus the newsletter/free-pack capture, both posting to
`/leads` with distinct `source` values.

**Promotions.** Admin CRUD backed by Stripe: `create_promotion_in_stripe` creates both the
Coupon and the PromotionCode, and a Stripe failure returns 502 and writes **no row** — a
promotion advertising a code Stripe won't honour is worse than no promotion. Restrictions
supported: `first_time_transaction`, `minimum_amount` and `max_redemptions`. The split is easy
to get wrong on the next edit — `max_redemptions` is a top-level PromotionCode parameter, while
the other two nest inside `restrictions`, and `minimum_amount` requires
`minimum_amount_currency` beside it (hardcoded `'aud'`). **Units differ by layer deliberately:**
the database and Stripe hold cents, the admin form takes dollars.

Buyers can also type a code on Stripe's own page (`allow_promotion_codes`). The
`del session_kwargs['allow_promotion_codes']` before `discounts` is set is required, not
tidying — Stripe rejects a session that both pre-applies a discount and invites the buyer to
enter one.

Deleting a promotion is asymmetric because Stripe is: a PromotionCode can never be deleted
(invoice history), so it is deactivated; the Coupon underneath it is deleted. Every
`StripeError` is swallowed so local deletion always succeeds — which means **a Stripe outage
during a delete leaves an active, still-redeemable code with nothing in this database pointing
at it.** If a deleted code is reported as still working, that is the mechanism; fix it in the
Stripe dashboard.

**One live promotion at a time was removed** on owner instruction — the `409 promotion_overlap`
check is gone from create and update. But `GET /promotions/active` still `LIMIT 1`s by
`starts_at DESC`, so the constraint *moved* rather than vanished: several overlapping promotions
can exist while the banner silently shows only the most recently started one. Every code still
works at checkout, so this is a display rule, not a redemption rule. Running two campaigns at
once needs that endpoint to become a list or gain a featured flag. `_overlapping()` remains in
the file with no call sites.

**Refunds move money backwards properly.** `refund_service.apply_refund()` sets
`revoked_at`/`revoked_reason` on every entitlement the order granted, flips the order to
`refunded`, revokes covered certificates, and writes an audit row. It is called from both the
admin endpoint and the `charge.refunded` webhook; whichever arrives second sees
`already_refunded` and no-ops. The gate checks `revoked_at.is_(None)` in one place.

**Email that actually arrives.** Mailjet over REST (Render blocks outbound SMTP on port 587, so
any SMTP provider is structurally impossible on this host). Fourteen Jinja2 template pairs on a
600px table-based base. Delivery is **confirmed per-send via Mailjet's REST Message resource**,
never inferred from the absence of a logged error — that inference was made twice during the
Resend era and was wrong both times. Two template gotchas: `select_autoescape` checks a literal
`.endswith(".html")`, which never matches `welcome.html.j2`, so autoescaping was silently off
until `enabled_extensions=("html.j2",)` was passed; and Jinja parses `{% %}` **inside HTML
comments**, so never write literal delimiters even in documentation there.

**A purchase record that reconciles.** One order, N order_items, N entitlements in a single
transaction, with `stripe_session_id` UNIQUE and `(user_id, product_id)` UNIQUE on entitlements
— uniqueness guaranteed by the database, not by careful coding. `/admin/orders` has keyset
pagination.

**The worst defect this area has produced**, worth keeping in view: a buyer who refunded and
then bought again was **charged and given nothing**. The `already_owned` check matched the
*revoked* row from the earlier refund and skipped granting — silently, since order and
order_item were both written, so it looked like a successful purchase from every angle except
access. Fixed by keeping revoked rows in the check and **reinstating** the existing row rather
than inserting a new one, which would have hit the uniqueness constraint after Stripe had
already taken the money.

---

## 8. Content model and admin

**Schema.** Documented in `BACKEND.md`. Questions carry seven tag dimensions through
`tag_values`/`question_tag_links`; alongside them sit templates, videos (Mux), lessons, modules,
courses, sections/packs, products, orders, entitlements, users and progress. Adding content
step-by-step is §2.

**A taxonomy trap that cost real discovery.** Tag *values* are lowercase codes (`xs`, `low`,
`m`), while `display_label` carries shorthand like `"XS (Under 2 weeks)"`. The homepage and
catalogue quick-filter chips tested the **shorthand**, so every chip matched zero questions,
silently — the one interaction proving the taxonomy is a real dataset had been dead since it
was written. `test_taxonomy_parity.py` now reads `QuestionsCatalogue.tsx` directly and verifies
every hardcoded value exists in `tag_values`. Related: `questions` gained `domain_slug` and
domain links filter on the slug, so renaming a domain for readability no longer breaks every
domain link on the front page.

**Admin.** Sixteen pages — `AdminQuestions`, `AdminCourses`, `AdminTemplates`, `AdminProducts`,
`AdminAssessments`, `AdminOrders`, `AdminUsers`, `AdminMetrics`, `AdminMedia`,
`AdminPromotions`, `AdminReviews`, `AdminContact`, `AdminLeads`, `AdminAudit`, `AdminSettings`,
`AdminPacks` — plus `LessonWriteScreen` for rich-text lesson editing. A non-technical person can
add and edit content, upload a video or file, and publish without touching code; **a
non-developer was watched using it** in Week 3, which is what the brief asked for. Every
mutation writes an audit row. Publish guards refuse to publish incomplete content, with five
guard tests covering products, templates, questions, courses and lessons.

Four upload/authoring traps already paid for: template upload 422'd on **every** file because
the shared Axios instance's default `Content-Type: application/json` overrode the browser's
multipart boundary (fixed with a per-request `undefined` override); `.ppt` was rejected until
`application/vnd.ms-powerpoint` was allowed; the dev server was running without `--reload`, so a
backend fix appeared not to work; and editor formatting never reached the reading page because
plain text was stored in an HTML-rendered column.

**Reviews.** Entitlement-gated, one per user per item, body sanitised on write. Submissions are
now born `approved` rather than `pending` — every reviewer is a verified buyer, so
pre-moderation added friction without reducing spam, and moderation is reactive (admin deletes
bad ones, with counter decrement). Aggregate ratings stay hidden below `MIN_REVIEWS_FOR_AGGREGATE
= 8`, enforced in **both** backend and frontend: at low volume "5.0 (2 reviews)" reads as
nobody bought this, so the gate starts closed. Counters are denormalised with a reconciler
script rather than a `COUNT`/`AVG` per catalogue load.

**Two remaining gaps:** module-question attachments have no admin UI (still direct DB writes),
and **there is no admin UI for a product's `price_amount`** — promotions are fully manageable,
the underlying price is not (§4 item 16).

---

## 9. Design system

Fully specified in `DESIGN.md`; this is what a maintainer most needs to know.

**Tokens.** Warm ivory + midnight navy + champagne gold — "private bank meets editorial
publisher" — implemented entirely through semantic tokens in `theme.css`, never hardcoded hexes
in components. Type scale, palette and spacing scale are documented, with the type scale
reconciled against `theme.css` after a ~25–30% shrink at every rung. Radius is capped at 12px
at the token level, so `rounded-2xl`/`rounded-3xl` cannot quietly exceed it by habit.

**The one rule that has caused the most bugs: a token that flips between themes is safe only on
a surface that flips with it.** `--primary` is midnight navy in light and a *light* blue in
dark; the hero and footer are dark in both. That mismatch shipped **eight times** before it was
named — the hero search input, three result labels, the newsletter field and button, an
invisible navy-on-navy footer brand mark, and `StatusDot`'s label. Every instance passed review,
because each read correctly in whichever theme its author had open. The fix is a separate
`--stage`/`--stage-foreground` pair meaning "the dark plane" that never inverts. **Before adding
anything to a `bg-stage` surface, grep it for `primary`.** A ninth instance was caught later in
`CartButton`'s badge. A shared component cannot pin a foreground token, because it doesn't know
which plane it is standing on — hence `StatusDot`'s and `CartButton`'s `on="stage"` prop.

**A gradient's contrast is only real where the text actually lands.** The token-level maths said
the auth panel was safe; sampling the **rendered pixels** under the actual paragraph said
4.36:1. A swatch-level audit cannot see this — re-measure from a screenshot if that copy ever
moves.

**Components.** A documented set: buttons, cards, forms, navigation, lesson layout, and the
buy-surface family (gold left-rule card, gold 24px price, icon tile) applied identically across
Question, CourseDetail, ProductBuy and the dashboard/home product cards. `SectionHeading` is a
shared gilt-rule primitive. `.hover-lift` consolidates a lift that had been hand-typed at five
call sites free to drift. **Card discipline** is a rule, not a preference: a card is for a real,
distinct item — sections, single stats and metadata sit directly on the page, which is why
`/questions` results are editorial rows with a bottom border rather than a grid of cards.

**Motion.** Nothing loops. Card hover is 2px with no scale; presses use `whileTap`. Progress
bars animate in once, on the reasoning that a progress bar is a state becoming known.
`prefers-reduced-motion` collapses all of it globally. **Glassmorphism stays banned** — an
implementation plan proposed frosted panels, looping ambient drift and a 4px lift; all three
were checked against the design system and dropped, and the 4px would have been a regression.
Don't reinstate any of it from that file without an explicit decision to reverse the ban.

**Responsive and accessible.** Breakpoints are defined at real widths, with E2E coverage across
responsive widths and a 390×844 mobile checkout walk performed by hand. Both themes are
reachable via a toggle that persists to localStorage, with the OS preference only the
first-visit default and an inline script applying the class before first paint so there is no
light→dark flash.

**The recurring accessibility lesson:** the defects here are the ones a green suite doesn't
catch because nothing rendered the page and looked. Skipped heading levels on three catalogue
pages; catalogue cards with **no visible focus ring** because grid dividers drawn as
`[&>*]:outline-1` beat the global `:focus-visible` rule, so a focused card computed identically
to an unfocused one. Note also that axe reports intermittent `color-contrast` failures on
`whileInView` elements caught mid-transition — that class of flake is a scan-timing artefact,
not a static contrast defect.

---

## 10. Verification status

**Tests.** Backend 602 pytest; frontend 267 Vitest + 235 Playwright E2E (accessibility,
responsive widths, stress fixtures, gating, notifications, search keyboard nav). Twelve gating
attacks run, 16/16 defended. Performance budgets in CI (bundle-size assertion + Lighthouse).
Database indexes were added only against measured `EXPLAIN (ANALYZE, BUFFERS)` evidence on a
synthetic 20k-user dataset, and two candidate indexes were **not** created because they measured
as unhelpful.

**The single most useful lesson in this document.** A verification pass once found **fourteen
defects the ~490-test backend suite had never gone red on** — because the backend was mostly
right, and nothing rendered a component against a real response, opened a real page, or
committed a real row. **Seven endpoint modules called `session.flush()` but never
`session.commit()`**, masked by the test fixture's savepoint. There is now an `asserts_commit`
fixture that fails unless the endpoint itself committed, verified by deliberately deleting real
commits one at a time. In the same family: a search palette that crashed on every real query
while `tsc --noEmit` passed, and a certificate download whose link pointed at the wrong path and
sent no auth header.

**Known flake, honestly labelled.** The keyboard-purchase E2E walk fails roughly 2 runs in 6.
The cause is the landing page mounting carousels asynchronously, so the Tab sequence lands
differently run to run. `networkidle` was tried and made it worse (6 in 8), and was reverted. A
durable fix means changing how that page mounts carousels, which a keyboard-focus test should
not be what drives.

**Not yet done, all of it human rather than engineering:** the Vercel Pro upgrade (§4 item 1),
a watched non-developer usability test, a hostile-client email render check in a real mail
client, and the Supabase Auth Site URL confirmation (a dashboard-only setting no coding session
can verify). The most recent promotion work — restrictions, delete, Stripe Customer reuse, the
overlap removal — **has no test coverage**, migration `040` has not been round-tripped, and any
existing test asserting `409 promotion_overlap` is now wrong.

---

## 11. What to build next

Updated 2026-08-27. Roughly in the order I'd actually do them — each one unblocks or de-risks the next, not just a wishlist.

**Already closed (kept so a reader can see what was considered and finished):**
- ~~Minimal admin UI~~ **Closed, 2026-08-20.** `/admin/products`, `/admin/contact`, `/admin/orders` (with keyset pagination), `/admin/metrics` all ship.
- ~~Taxonomy parity test~~ **Closed, 2026-08-20.** `test_taxonomy_parity.py` reads `QuestionsCatalogue.tsx` directly.
- ~~Checkout/webhook fixture tests~~ **Closed, 2026-08-20.** All 8 W4-R9 cases covered.
- ~~Cart / multi-item checkout~~ **Closed, 2026-08-16.** `useCartStore`, `CartDrawer`, multi-item `POST /checkout/session`.
- ~~Entitlement revocation + refund flow~~ **Closed, 2026-08-16.** `refund_service.apply_refund`, `charge.refunded` webhook, `RefundDialog.tsx`.
- ~~Editorial control over the front page~~ **Closed, 2026-08-16.** `questions.featured` / `featured_sort`, `FeaturedToggle`, `FeaturedSummary`.
- ~~Pre-purchase evidence layer~~ **Closed, 2026-08-20.** `EvidencePanel`, `PreviewGallery`, `LicenceLine`, `VersionStamp` on all product pages.
- ~~Tax-invoice-quality receipts~~ **Closed, 2026-08-20.** `invoice_creation` + `billing_address_collection` in Stripe checkout.
- ~~Overlap publish guard~~ **Closed, 2026-08-20.** `check_content_overlap` in `publish_guard.py`.
- ~~Question → product routing~~ **Closed, 2026-08-20.** `RoutedProducts`, `SituationProducts`.
- ~~Performance budgets in CI~~ **Closed, 2026-08-20.** Bundle-size assertion + Lighthouse CI.
- ~~Gating attack pass~~ **Closed, 2026-08-20.** 16/16 attacks defended.
- ~~Promotions~~ **Closed, 2026-08-23.** Admin CRUD, Stripe sync, public `GET /promotions/active`, banner rewired.
- ~~Certificates~~ **Closed, 2026-08-23.** Issuance on completion edge, PDF generation, public verify, revocation on refund, email.
- ~~Full-text search~~ **Closed, 2026-08-23.** Postgres tsvectors + GIN, `GET /search`, header search palette, `/search` results page.
- ~~Reviews~~ **Closed, 2026-08-23.** Curated testimonials (Stage A), moderation queue, gated aggregate (Stage B, threshold = 8).
- ~~Notes & bookmarks~~ **Closed, 2026-08-23.** Per-lesson notes (autosave), bookmarks with `/saved` page.
- ~~Learner progress analytics~~ **Closed, 2026-08-23.** Dashboard resume panel, library progress bars, estimated time remaining.

**Also closed:**
- ~~Assessment admin panel~~ **Closed, 2026-08-25.** Full CRUD with publish validation, delete with attempt-count guard, auto-expand blocker questions, readiness checklist.
- ~~Certificate issuance gate hardened~~ **Closed, 2026-08-25.** Both lesson-completion and assessment-submission paths now require ALL published course assessments passed. Unified gate across both paths.
- ~~Module assessment display~~ **Closed, 2026-08-25.** `has_assessment`/`assessment_title` on `ModuleOut`; Learn sidebar shows assessment link per module.
- ~~Certificate download from course detail~~ **Closed, 2026-08-25.** `downloadCertificate` moved to shared `lib/utils`; CourseDetail shows download button + secondary verification link.
- ~~Featured reviews on landing page~~ **Closed, 2026-08-25.** `useSiteFeaturedReviews` hook (site-wide, no contentId); `TestimonialsSection` renders 4+ star reviews with gold-rule card grammar.
- ~~Review auto-approval~~ **Closed, 2026-08-25.** Submissions now born `approved` (not `pending`); admin moderation becomes reactive (delete bad reviews). Counters increment on submission.
- ~~Admin delete reviews~~ **Closed, 2026-08-25.** `DELETE /admin/reviews/{id}` with counter decrement for approved reviews. Audit context tracks `attempts_destroyed`.
- ~~Pack card artwork~~ **Closed, 2026-08-25.** `CourseArt` generative artwork integrated into pack cards (Home MiniPackCard + PacksCatalogue). `ContentCard` conditionally renders art for packs.
- ~~Persistent account header~~ **Closed, 2026-08-25.** New `AppHeader` component: sticky top-right on all signed-in pages, cart button, NotificationBell, ThemeToggle, AccountMenu dropdown.
- ~~Admin page margin normalisation~~ **Closed, 2026-08-25.** All admin pages now use `max-w-[1600px] px-4 py-6 sm:px-6` (4 outlier pages synced).
- ~~Backend CORS fix~~ **Closed, 2026-08-25.** Removed hardcoded dev CORS port appending; removed dead `admin_router_no_auth` (invalid `Allow-Origin: *` + `Allow-Credentials: true`).
- ~~Testimonial card grammar~~ **Closed, 2026-08-25.** Refactored to match question card language: gold top rule, mono eyebrow, serif quote, ruled metadata block, gap-px grid.
- ~~Notification page fixes~~ **Closed, 2026-08-25.** Changed `<a href>` to `<Link>` for internal routing; fixed preferences card loading/error state; reset state on save.
- ~~E2E locator fix~~ **Closed, 2026-08-25.** Notification page sign-in locator changed from `text=Sign in` (matches 2 elements) to `getByRole('button', {name: 'Sign in'})`.

**Still open — ranked by priority:**

1. **Fix the Vercel commercial-use gap (upgrade to Pro)** — the one item here that's a real, live compliance exposure, not a nice-to-have. Real Stripe payments flow through a Hobby-tier deployment whose ToS prohibits commercial use.
2. **Human QA pass** — full sign-up → browse → buy → access flow on a real phone-sized viewport, by someone who didn't build it.
3. **The watched non-developer usability test** — repeatedly deferred, still not performed.
4. **Hostile-client email render check** — open one of the 14 email templates in a real mail client (Apple Mail, Gmail web, Outlook).
5. **Second real course loaded with real content** — only one course has authored lessons today.
6. **Admin product editor: Stripe price changes** (Phase 8 8B) and course purchasability (Phase 8 8A).
7. **Admin panel video playback** (Phase 8 8D) and **rich-text lesson editor** (Phase 8 8E).
8. **The product-strategy proposals still gated** (`ENGINEERING_NOTES.md` §6): Decision Pack workspace, free Risk Diagnostic, "Challenge My Thinking" AI, Scenario Packs.

---

## 12. Commands that matter

```bash
# Migrations — round-trip before committing
cd backend && alembic upgrade head && alembic downgrade -1 && alembic upgrade head

# Backend suite
cd backend && pytest -q

# Frontend unit tests
cd frontend && npm run test

# E2E tests
cd frontend && npx playwright test

# Typecheck frontend
cd frontend && npx tsc --noEmit

# Build frontend
cd frontend && npm run build
```

