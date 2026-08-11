# Handover pack

A living document — updated as the project changes, not a one-time snapshot. Last updated: 2026-08-11.

This complements `RUNNING.md` (how to run/deploy) and `DESIGN.md`/`BACKEND.md` (the specs) rather than repeating them — this doc is the "why," the "how to extend it," and the "what's actually true right now" that those don't cover.

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
| Email | Mailjet (primary), Brevo (fallback), Resend (last resort) | Postmark, SendGrid, MailerSend, Mailgun | See `docs/email.md` for the full trail — six providers were actually tested live, not just read about. The short version: Resend/Postmark/SendGrid/MailerSend/Mailgun each gate real (non-test) recipients behind either domain ownership or a manual approval process; Mailjet was the only one that sent to an arbitrary real address immediately on a fresh free account. Brevo works too but its account needed manual activation (ticket submitted, pending) — kept as tier 2, not deleted. |
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
- A second, independent design brief (`docs/design_again.md`, a comprehensive AI-prompt-style spec covering the whole product) arrived the same day. Reviewed on request before use: it reinforces the same direction almost point-for-point, but its typography scale and colour section silently contradict the already-decided, WCAG-audited system in `DESIGN.md` (a different fixed type scale; "blue accent" where the real system deliberately uses gold), and its homepage nav mockup inverts the actual brand hierarchy (`Practicable` is the registered brand per week1_plan.md decision #1; "Deciding in the Dark" is the book/collection inside it, not the other way round). Treated as a mineable reference for copy/component-state ideas phase-by-phase, checked against `DESIGN.md` first — not adopted as a second source of truth. `DESIGN.md` remains the one place tokens/decisions live.

**Not yet done** — Phase 4 (question detail page — a more editorial layout), Phase 5 (courses/dashboard de-emphasis), Phase 6 (commerce), Phase 7 (admin, functional-only). Each is a real, separately-scoped follow-up.

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

### Discovery is real now; the homepage/dashboard spotlight is still hardcoded

Real catalogues exist and need no code change to show new content: `GET /courses` + `/courses/{slug}`, `GET /templates`, `GET /questions` + `/questions/{slug}` are all live, and the public header / member sidebar link to all three. Seed a second question, course, or template and publish it — it appears in its catalogue automatically.

What's still hardcoded: `Home.tsx` and `Dashboard.tsx` each spotlight *one specific* question/product via `WEEK1_QUESTION_SLUG` / `WEEK1_PRODUCT_SLUG` constants — that's a "what do we feature on the landing page" decision, not a reachability gap anymore. A second product doesn't need those constants touched to be *found*; it would need them touched (or replaced with a real "featured" flag) to be *promoted*.

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
| Mailjet (primary email) | 6,000/month (200/day) | Paid tiers scale by volume | Order volume (2 emails per sale: receipt + owner notification) |
| Brevo (fallback) | 300/day (~9,000/month) | Paid tiers scale by volume | Same driver as Mailjet, only exercised if Mailjet is down |
| Resend (last resort) | 3,000/month (100/day) | Paid from $20/month | Only exercised if both Mailjet and Brevo fail |
| Domain | Not purchased yet | ~$10–15/year for a `.com`/`.com.au` | One-time decision, not usage-based — see `docs/email.md` for why this keeps coming up (real domain ownership is what would let email skip the whole multi-provider fallback chain) |

**Today's real monthly floor, ignoring Stripe's per-transaction cut: ~$7 (Render Starter)** — everything else is still inside its free tier. That changes the moment Vercel's commercial-use restriction is addressed (§4) or Supabase/Mux free-tier limits are hit.

---

## 4. Known gaps and shortcuts taken knowingly

Ranked roughly by how much they matter, not by when they were found.

1. **Vercel Hobby's commercial-use restriction is currently being violated.** Real Stripe payments are flowing through a Hobby-tier deployment. This is a ToS/compliance gap, not a performance one — Vercel could enforce this at any time. Fix is a $20/month upgrade to Pro; not done because it wasn't identified as a blocker until this handover pass.
2. **No admin UI.** All content authoring (questions, courses, modules, lessons of all three types, templates, products, module-question links) is raw SQL/direct `UPDATE`s against Supabase, by hand, per §2. Fine at 1 question / 1 course / 1 product; not fine at 100 — and the surface area this now covers (module ordering, lesson-type-specific fields, module-question attachments) is bigger than it was in Week 1, which makes this gap more expensive with every new content type, not less.
3. **Brevo is integrated but not fully live** — its SMTP account activation is pending manual approval from Brevo's team (support ticket submitted). Kept wired up as tier 2 in the email fallback chain rather than ripped out, since it may activate at any time and costs nothing to leave configured.
4. **Supabase's "Confirm email" project setting** is on (the project default) and has caused real confusion — a real user's sign-up appeared broken because they hadn't clicked the confirmation email yet, and separately a confirmation link redirected to `localhost:3000` until `emailRedirectTo` was added explicitly to the sign-up call. The Supabase Auth "Site URL"/"Redirect URLs" dashboard settings still need a one-time check to make sure they point at the real production origin, not a leftover default.
5. **No automated test suite.** No `pytest` for the backend, no `vitest`/testing-library for the frontend. Everything verified this session was verified *live* against real Stripe/Supabase/Mux/email-provider APIs rather than against a fixture — genuinely good evidence the thing works, but it's not repeatable/regression-proof the way a test suite would be.
6. **No literal human-driven browser checkout test.** The full payment → webhook → order → entitlement → email pipeline has been proven multiple times with real money-adjacent flows (`stripe trigger` with real metadata, and now genuinely real customer purchases), but nobody has sat down with a phone-sized viewport and clicked through sign-up → browse → buy → watch/download as a first-time user would.
7. **No refund policy defined.** The footer says "one-time purchase, lifetime access" (a confirmed decision) but a specific refund window is explicitly not decided — stated nowhere a buyer can see it as a real policy.
8. **No entitlement-revocation flow.** Entitlements are granted (purchase, or in principle an admin override via the same `granted_via` enum) but there's no code path to revoke one — relevant the day a refund actually needs to happen.
9. **The Week 1 scope guardrail is hardcoded, not configured** — `WEEK1_QUESTION_SLUG`/`WEEK1_PRODUCT_SLUG` constants, duplicated across three frontend files (§2). Deliberate for Week 1 (a real discovery/search UI was explicitly out of scope), but it's string literals to change, not a settings toggle.
10. **A module's lessons and its attached questions are two separate `sort_order` sequences, not one merged order.** A question attached to a module (`module_questions`) always renders after that module's lessons in both the syllabus and the learning sidebar, regardless of how its `sort_order` compares numerically to a lesson's — there's no single interleaved position field. Fine for "one or two questions per module, always at the end"; would need a real unified-ordering model (or a `kind` + shared `sort_order` namespace) if a question ever needs to sit *between* two lessons.
11. **`docs/DESIGN.md` §18.2 ("no hero image, no gradient")** was deliberately overridden on the landing page redesign per direct owner feedback ("looks only white, use colour") — the doc itself hasn't been updated to reflect that, so it currently contradicts what's actually built. This is now a deliberate, documented direction rather than an accident: the August 2026 art-direction pass re-materialised the whole token set in `theme.css` as **warm ivory + midnight navy + champagne gold** ("private bank meets editorial publisher"), which adds a static gold/navy radial wash behind the hero type (`.hero-wash`), a 2px gilt hairline atop the marketing header, gold left-rules on featured cards, and gold section eyebrows (`.eyebrow`) — all implemented through semantic tokens, never hardcoded hexes in components. §7's colour-role map still holds (navy = brand/authority, gold = the one sparing accent); what changed is the material itself. The dark side of that system is now reachable, not just defined: a theme toggle (`stores/useThemeStore.ts` + `components/ui/ThemeToggle.tsx`) flips `.dark` on `<html>` from the marketing header, the auth pages, and a fixed top-right corner on member pages; the choice persists to `localStorage['practicable:theme']`, the OS preference is only the first-visit default (§55: "we do not follow the OS blindly" — a manual choice wins and the app never re-reacts to OS changes while open), and an inline script in `index.html` applies the class before first paint so there is no light→dark flash. Toggling also rewrites the `theme-color` meta so mobile browser chrome matches.

    **Follow-up coherence pass (same session):** the premium language is now applied as a *system* rather than page-by-page. The gold-rule section heading is a shared primitive (`components/ui/SectionHeading.tsx` — used by Question, CourseDetail, anywhere a gilt-rule h2 is wanted; text-only children by contract). The buy surface is one family: gold left-rule card + gold 24px price + icon tile on Question, CourseDetail, ProductBuy, and the Dashboard/Home product cards alike (gold is documented large-text-only in `theme.css`, so a future shrink is caught by the comment on every price line). EmptyState gained an `icon` prop (circular tile = status/moment surfaces; square `size-9 rounded-md` = data tiles — the shape family split is documented in the component). The marketing header now has a real mobile slide-over nav (it had *no* mobile navigation before — nav was `hidden md:flex` with nothing replacing it), mirroring MemberLayout's sheet pattern with `role="dialog"`, Escape-to-close, and `autoFocus` on the close button. Auth pages carry brand for the first time (wordmark + gilt hairline above the card), and their page titles are genuine `<h1>`s with the `text-h2` token instead of `CardTitle` with an inline `fontSize` (which both violated §42.1's one-h1 rule and the token discipline). Checkout outcomes use status icon tiles rather than a literal "✓" glyph. Reading bodies everywhere honour `text-read`'s 1.7 line-height (the old `leading-relaxed` override was flattened in `Learn.tsx`, matching the `EmailGatedBody` fix).

---

## 5. What I'd build next, with another four weeks

Roughly in the order I'd actually do them — each one unblocks or de-risks the next, not just a wishlist.

**Week 1 of the next four:**
- Fix the Vercel commercial-use gap (upgrade to Pro) — the one item here that's a real, live compliance exposure, not a nice-to-have.
- Human QA pass: full sign-up → browse → buy → access flow on a real phone-sized viewport, by someone who didn't build it.
- Resolve Brevo's activation (or don't — Mailjet already solves real delivery; Brevo's only value now is redundancy, so this is genuinely optional, not blocking).

**Week 2:**
- A minimal admin UI — even a plain internal-only page to create/edit questions, courses/modules/lessons (all three lesson types), templates, products, and module-question links would remove the single biggest scaling bottleneck (§2's "everything is raw SQL"), and it's a bigger bottleneck today than it was in Week 1 now that courses have real internal structure to author.
- ~~Load the real 100-question catalogue~~ **Done, 2026-08-11.** All 100 questions from `docs/questions/questions.json` are seeded and published (`backend/db/seed/011_seed_100_questions.py`, idempotent — re-run is a no-op against already-present slugs). One real content gap this exposed: 99 of the 100 have no hand-authored `preview` field (only Q1 did), and DESIGN.md §20.3 explicitly bans a machine-truncated preview. The seed script derives a sentence-boundary-cut stopgap instead and says so in its own docstring — replacing those 99 with real authored 160-character summaries is genuine editorial work, not engineering, and is the next real gap here, not "load the questions" (that part's done). Domain split from the real data: Risk 60, Cyber 14, Compliance 11, Resilience 11, AI 4 — lopsided because the source content is, not because of anything in the loader. Loading this also exposed and fixed a real N+1 query bug in `GET /questions` (`app/api/v1/content/questions.py`) — invisible at 1 seeded row, ~90s at 100; now four fixed queries regardless of row count. A second real course is still not loaded — that one remains open.

**Week 3:**
- Real discovery: search/filter UI across the full question catalogue, replacing the hardcoded single-question guardrail. The tag dimensions (effort, cost, duration, ROI horizon, regulator pressure, leadership traits) already exist in the schema specifically to support this — they're just not surfaced as filters yet.
- Basic automated test coverage on the payment/entitlement path specifically — the highest-consequence code in the system, and the part most likely to silently regress.

**Week 4:**
- Entitlement revocation + a real refund flow (policy decision first, code second).
- A "my library" page that's a genuine hub — not just the current single-product dashboard card, but a real list of everything owned with progress state, once there's more than one product to make that meaningful.
