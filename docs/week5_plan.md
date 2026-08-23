# Week 5 — Commercial Control Surfaces, Credibility and Discovery

**"Deciding in the Dark" Platform · v1.0 · 2026-08-23 · follows [`week4_report.md`](week4_report.md) and the screen sweep recorded in [`SCREEN_SWEEP_DECISIONS.md`](SCREEN_SWEEP_DECISIONS.md)**

*Every `[BUILT]` and `[GAP]` below was checked by direct read of the repository on 2026-08-23, not carried forward from an earlier plan. Where this document contradicts `DESIGN.md`, `BACKEND.md`, the intern brief, or `frontend/src/styles/theme.css`, the precedence rule in [`week4_plan.md`](week4_plan.md) §0.3 decides and this file is wrong.*

---

## 0. How to read this document

| Part | Contains | Read it when |
|---|---|---|
| **I — Requirements** | What Week 5 must produce, priority order, and the acceptance line each item is judged against | Before you start; before you cut anything |
| **II — Verified state** | What exists today, with the file and line that proves it | Before you write a line of code |
| **III — Database** | Migrations `026`–`029`, index evidence method, the pgbouncer constraint, and the query budget per new endpoint | Phase 0, and before any query is called "fast" |
| **IV — Implementation phases** | Phase by phase, step by step, with file paths and the tests that must go red first | While you build |
| **V — Ledger, risks, decisions needed** | The task ledger, the risk watchlist, and the three calls only the owner can make | Daily |

**Status markers.** `[BUILT]` verified present 2026-08-23 · `[GAP]` verified absent 2026-08-23 · `[OWNER]` blocked on an owner decision · `[NEW]` first specified here · `[DEFERRED]` deliberately not built this week, with the reason · `[CONSTRAINT]` a property of the environment that binds the design.

---

# PART I — REQUIREMENTS

## 1. Priority order, and why

The order is by **value per engineering hour**, not by size. Two of the five items are control surfaces over plumbing that already works — those come first because the marginal cost is a form, not a system.

| # | Item | Size | Why it sits here |
|---|---|---|---|
| **W5-R1** | Admin control over promotions | ~1–2 days | The discount path already reaches Stripe end to end (`stripe_client.py:53–84`). Only the *control surface* is missing. Highest value per hour on the board. |
| **W5-R2** | Certificates on course completion | ~4–6 days | Completion is already computed on the `false→true` edge (`lessons.py:598`). This is the one item that converts existing tracked state into a thing a learner can show an employer. Directly serves the brief's "ship something a stranger can … learn on." |
| **W5-R3** | Public search | ~2–3 days | Four catalogues filter but none searches. This is a discovery gap on the *buying* path, so it outranks credibility work that only helps once traffic exists. |
| **W5-R4** | Reviews and ratings | ~3–5 days | Built as **curated testimonials first**, open reviews behind a volume gate. See §2.4 — the caveat about low volume is real, and this plan acts on it rather than noting it. |
| **W5-R5** | Smaller absences (notes, bookmarks, learner progress analytics) | 1–3 days each | Sequenced last and explicitly scoped; a blog/CMS and a newsletter are `[DEFERRED]` with reasons in §2.5. |

**Sequencing rule.** W5-R1 ships and is verified before W5-R2 starts. Do not run two phases concurrently — every one of them touches `app/db/models/__init__.py` and `App.tsx`, and a merge conflict in the router is how a route silently loses its admin guard.

---

## 2. Requirements in detail

### 2.1 W5-R1 — Admin control over promotions

**Gap, verified.** `frontend/src/components/ui/DiscountBanner.tsx:5–6` hardcodes `const PROMO_CODE = 'WELCOME15'` and `const DISCOUNT_PERCENT = 15`. There is no `promotions` table, no admin screen, no scheduling. Changing an offer today is a frontend deploy.

**What already works, verified.** `CheckoutRequest.discount_code` exists (`app/api/v1/commerce/checkout.py:29`), travels to `create_checkout_session(..., discount_code=...)`, and is resolved server-side against `stripe.PromotionCode.list(code=..., active=True)` with a fallback to full price on failure (`app/integrations/stripe_client.py:53–84`). `frontend/src/lib/promo.ts` persists the copied code to `localStorage` and `ProductBuy.tsx` / `CartDrawer.tsx` read it back at checkout. **The money path is done.** This requirement adds a control surface and nothing else — which is exactly why it is first.

**Acceptance.**
1. An admin creates a promotion (message, code, percent, `starts_at`, `ends_at`, `active`) at `/admin/promotions` without touching the database or the Stripe dashboard.
2. `GET /promotions/active` returns at most one promotion, date-filtered **in SQL**, with no authentication required and no admin-only fields in the body.
3. The banner renders from that endpoint; when it returns `null` or errors, the banner renders nothing and the page layout does not shift.
4. Creating with `sync_to_stripe: true` calls `stripe.Coupon.create` then `stripe.PromotionCode.create` and stores both ids. A Stripe failure fails the create with a 502 and writes **no** row — a promotion advertising a code Stripe will not honour is worse than no promotion.
5. Every create, update and deactivate writes an `audit_log` row via `record_audit`.
6. Two promotions active over the same instant is a 409 at write time, not a coin flip at read time.

**Non-goals.** No per-product promotions, no usage caps enforced in our database (Stripe's `max_redemptions` is authoritative), no first-purchase-only logic. The banner's current copy claims "your first purchase"; §V.3 records that as an `[OWNER]` decision — either Stripe enforces it or the copy changes.

### 2.2 W5-R2 — Certificates

**Gap, verified.** `CourseProgress.completed` and `completed_at` exist (`app/db/models/progress.py:35–36`) and are written on the completion edge in `app/api/v1/content/lessons.py:598–620`. Nothing is issued. No `certificates` table, no PDF, no verify page.

**What already works, verified.** `app/services/stamping.py` is a direct precedent for the entire PDF pipeline: it composes a PDF with `pypdf`, uploads it via `storage_client.upload_file`, caches it under a deterministic key, and serves it with `generate_presigned_url`. `pypdf==4.3.1`, `pypdfium2==4.30.0` and `Pillow==11.0.0` are already in `requirements.txt` — **no new dependency**. Email delivery has eleven Jinja2 template pairs in `app/emails/` and a `_send` spine at `email_service.py:130`.

**Acceptance.**
1. On the `false→true` transition of `CourseProgress.completed`, exactly one `Certificate` row is created. Re-completing, un-completing then re-completing, or replaying the request never creates a second row — enforced by `UNIQUE(user_id, course_id)`, not by an application check.
2. The row is **frozen**: it stores the learner name, course title and issue date *as they were at issue time*. A later course rename does not rewrite an issued certificate.
3. The PDF is generated once, cached under `certificates/{certificate_id}.pdf`, and served through a presigned URL. Generation failure does not fail the lesson-completion request — the row is written, the PDF is rendered lazily on first fetch.
4. `GET /verify/{verification_code}` is public, unauthenticated, and returns learner name, course title, issue date and revocation state. No email, no user id, no order data.
5. A revoked entitlement (the refund path, `entitlements.revoked_at`) marks the certificate `revoked_at`, and the verify page says so plainly.
6. The completion email uses the existing `_send` spine and the existing `base.html.j2`.

### 2.3 W5-R3 — Public search

**Gap, verified.** `ilike` search exists in `app/api/v1/admin/users.py:105`, and a scored free-text filter exists in `app/api/v1/content/questions.py:260–290`. The four public catalogues (`CoursesCatalogue`, `TemplatesCatalogue`, `PacksCatalogue`, `QuestionsCatalogue`) filter by taxonomy but none takes a text query, and there is no header search field anywhere.

**Acceptance.**
1. `GET /search?q=…` returns results across courses, templates, questions and packs in one response, grouped by type, ranked by `ts_rank_cd`.
2. Only published rows appear. A draft, in-review or archived row is never returned — asserted by a test that creates one of each.
3. Postgres full-text with a **generated `tsvector` column plus a GIN index** per table, not `ilike`. §III.4 records the evidence method.
4. Query count is bounded and constant: one query per entity type, four total, regardless of result count.
5. The header field is keyboard reachable, has an accessible name, announces result counts to a live region, and Enter with no selection lands on a full `/search?q=` page.

### 2.4 W5-R4 — Reviews and ratings, built in the right order

**Gap, verified.** No model, no table, no API, no UI. The star ratings described in the product documents do not exist anywhere in the repository.

**The caveat, acted on rather than noted.** At current volume, "5.0 (2 reviews)" reads as *nobody bought this*. An aggregate rating is a credibility instrument that only starts paying above roughly 8–10 reviews per item, and below that it actively costs credibility. So this requirement ships in two stages behind **one** schema:

- **Stage A `[NEW]`, this week.** The `reviews` table, an admin moderation screen, and rendering of **`is_featured` reviews only, as named testimonials with no star aggregate**. This is the curated-testimonial product, and it is cheaper than the open one because on day one it needs no public submission form at all.
- **Stage B `[NEW]`, built but gated.** Buyer-submitted reviews, the entitlement gate and the rating component are all built. The aggregate is hidden behind `MIN_REVIEWS_FOR_AGGREGATE = 8`. When the eighth review on an item is approved, stars appear for that item with **no deploy**.

**Acceptance.**
1. Only a user holding a live, unrevoked entitlement to the content can submit a review — enforced through `app/core/entitlements.py:has_access_to`, the same gate as everything else, not a bespoke check.
2. One review per user per content item, enforced by `UNIQUE(user_id, content_type, content_id)`.
3. A submitted review is `pending` and invisible until an admin approves it. Body text passes through `app/core/html_sanitizer.py` on write.
4. Aggregates are computed from **denormalised counters on the content row**, updated in the same transaction as the moderation transition — not a `COUNT`/`AVG` join on every catalogue load. §III.5 states why.
5. An item with fewer than `MIN_REVIEWS_FOR_AGGREGATE` approved reviews renders **no rating element at all** — not "no reviews yet", which is worse than silence.

### 2.5 W5-R5 — The smaller absences, scoped

| Item | Call | Reason |
|---|---|---|
| **Notes and bookmarks** | `[NEW]`, build | Two tables, four endpoints, one panel in `Lesson.tsx`. Serves the learning product directly, and a note is retention. |
| **Learner progress analytics** | `[NEW]`, build | `CourseProgress.percentage_complete` is already written and already read by `Dashboard.tsx`; `courses.estimated_duration_minutes` was added in migration `025` and is barely read. This is a **presentation** task over existing columns — the cheapest real item on the list. |
| **Wishlist** | `[DEFERRED]` | With 8 published products, a wishlist is a second cart with no purchase intent behind it. Revisit above ~25 products. |
| **Blog / CMS** | `[DEFERRED]` | A second content system with its own editor, publish states, SEO surface and moderation. That is a week on its own, not "1–3 days". If content marketing is the goal, it gets its own plan. |
| **Newsletter** | `[DEFERRED]`, partly `[OWNER]` | `leads` already captures emails (`app/db/models/lead.py`) and Mailjet is already the transport. What is missing is not engineering: it is consent records, an unsubscribe surface, and a sending cadence someone owns. A compliance and editorial commitment, not a table. |

---

# PART II — VERIFIED STATE ENTERING WEEK 5

| Area | State | Evidence, read 2026-08-23 |
|---|---|---|
| Discount code → Stripe | `[BUILT]` | `stripe_client.py:53–84` resolves the code against `PromotionCode.list(active=True)`, falling back to full price on failure |
| Promotion storage / scheduling / admin | `[GAP]` | `DiscountBanner.tsx:5–6` — two module constants. No table, no route, no endpoint |
| Course completion edge | `[BUILT]` | `lessons.py:598–620` computes `percentage_complete` and sets `CourseProgress.completed` |
| Certificate issue / PDF / verify | `[GAP]` | No model in `app/db/models/`, no route in `main.py`, no template in `app/emails/` |
| PDF toolchain | `[BUILT]` | `pypdf`, `pypdfium2`, `Pillow` in `requirements.txt`; `services/stamping.py` is the working precedent |
| Storage + presigned URLs | `[BUILT]` | `integrations/storage_client.py` — `upload_file`, `generate_presigned_url`, `download_file` |
| Email spine | `[BUILT]` | `services/email_service.py:130` `_send`; 11 template pairs on `base.html.j2` |
| Admin gate, single choke point | `[BUILT]` | `api/v1/admin/router.py` — `APIRouter(dependencies=[Depends(require_admin)])`; every module below is guarded whether or not its handler remembers |
| Audit trail | `[BUILT]` | `services/audit_service.py:21` — `record_audit(session, actor, action, target_type, target_id, context)` |
| Admin screen pattern to copy | `[BUILT]` | `api/v1/admin/settings.py` + `pages/admin/AdminSettings.tsx` — react-query + `useAutosave` + `AutosaveIndicator` |
| Public text search | `[GAP]` | `ilike` in `admin/users.py:105` only; `content/questions.py:260` scores but is questions-only and is not site search |
| Reviews, any part | `[GAP]` | Nothing in models, API or components |
| Notes / bookmarks / wishlist | `[GAP]` | Nothing |
| Index layer | `[BUILT]`, 2 passes | Migrations `010`, `011`, each `EXPLAIN`-proven in [`db_index_evidence.md`](db_index_evidence.md). Latest migration on disk is `025` |
| DB connection | `[CONSTRAINT]` | `db/session.py` — Supabase **pgbouncer** pooler, both statement caches disabled. Binds every migration below; see §III.1 |

---

# PART III — DATABASE

## III.1 The pgbouncer constraint, stated once

`app/db/session.py` connects through Supabase's transaction-mode pooler with `statement_cache_size: 0` and `prepared_statement_cache_size: 0`. Two consequences bind every migration in this plan:

1. **`CREATE INDEX CONCURRENTLY` cannot run inside a transaction.** Migration `010` already solved this: the index half runs inside an explicit autocommit block, and a verification pass afterwards catches any index left `INVALID` by a failed concurrent build. **Copy that structure exactly.** Do not invent a second approach, and do not take the autocommit block without the verification pass — an `INVALID` index is silent, it simply never gets used.
2. **Every DDL step must be idempotent.** `CREATE INDEX ... IF NOT EXISTS`, guarded `ADD COLUMN`. A partially applied migration against a pooled connection is a live possibility here, not a hypothetical.

## III.2 Migration `026` — promotions

```
revision = "026"; down_revision = "025"
```

**Table `promotions`**

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | `IdMixin` |
| `code` | varchar(64) NOT NULL | The code a buyer types. `UNIQUE` |
| `message` | varchar(255) NOT NULL | Banner copy, admin-authored. Not a template string |
| `percent_off` | integer NOT NULL | `CHECK (percent_off > 0 AND percent_off <= 100)` |
| `starts_at` | timestamptz NOT NULL | |
| `ends_at` | timestamptz NULL | NULL = open-ended |
| `active` | boolean NOT NULL DEFAULT false | Admin kill switch, independent of the dates |
| `stripe_coupon_id` | varchar(255) NULL | Set when created through Stripe sync |
| `stripe_promotion_code_id` | varchar(255) NULL | |
| `created_by` | varchar(255) NULL | Admin email, matching the `settings.updated_by` convention |
| `created_at` / `updated_at` | timestamptz | `TimestampMixin` |

**Constraints and indexes**
- `CHECK (ends_at IS NULL OR ends_at > starts_at)` — a promotion that ends before it starts is a data error, not a UI validation.
- `ix_promotions_active_window` on `(starts_at, ends_at)` `WHERE active` — partial, because the only hot query filters on `active` first. This is the index `GET /promotions/active` exists to use.
- **No `EXCLUDE` constraint for overlap.** Postgres could enforce non-overlap natively with `btree_gist`, but that extension is not currently enabled and enabling one on Supabase is an owner action. The overlap check therefore runs in the endpoint, inside the same transaction as the insert. The reason is recorded here so a later reader knows it was considered and rejected on a specific ground, not overlooked.

**Query budget.** `GET /promotions/active`: **one** query, on the partial index, `LIMIT 1`, `ORDER BY starts_at DESC`.

**Evidence to capture.** `EXPLAIN (ANALYZE, BUFFERS)` for the active-window query at a synthetic 5,000-row scale, appended to `docs/db_index_evidence.md` under a `Migration 026` heading. At today's real scale no index changes a plan — which is exactly why it is measured at synthetic scale, per the method migration `010` established.

## III.3 Migration `027` — certificates

**Table `certificates`**

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → users.id NOT NULL | |
| `course_id` | uuid FK → courses.id NOT NULL | |
| `verification_code` | varchar(32) NOT NULL UNIQUE | `secrets.token_urlsafe(16)` — unguessable. **Not** sequential and **not** derived from the ids |
| `learner_name_snapshot` | varchar(255) NOT NULL | Frozen at issue |
| `course_title_snapshot` | varchar(500) NOT NULL | Frozen at issue |
| `issued_at` | timestamptz NOT NULL | Frozen at issue |
| `pdf_storage_key` | varchar(500) NULL | NULL until first generation; filled lazily |
| `revoked_at` | timestamptz NULL | Set by the refund path |
| `revoked_reason` | text NULL | Required whenever `revoked_at` is set, mirroring `entitlements` |

**Constraints and indexes**
- **`UNIQUE (user_id, course_id)`** — this, not application logic, is what makes issuance idempotent under a replayed request or a double-click. The service catches `IntegrityError` and treats it as success. A `SELECT`-then-`INSERT` pre-check would race; the constraint cannot.
- `UNIQUE (verification_code)` gives the public verify lookup its index for free. No second index for it.
- `ix_certificates_user` on `(user_id)` `INCLUDE (course_id)` — serves the learner's "my certificates" list, the same covering shape as `ix_entitlements_user` in migration `010`.

**Why snapshots.** A certificate is a claim about a moment. If the course is renamed in November, a certificate issued in August must still read what the learner actually completed. Joining to `courses.title` at render time would silently rewrite history — frozen columns make that impossible rather than merely discouraged.

**Query budget.** Issue: one `INSERT ... ON CONFLICT DO NOTHING`, with no `SELECT` first. Verify: one query on the unique index.

## III.4 Migration `028` — full-text search

Four generated columns and four GIN indexes. **Generated columns, not trigger-maintained** — a trigger is a second place the truth lives and a second thing to forget on a bulk update.

```sql
ALTER TABLE courses ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(subtitle, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'C')
  ) STORED;

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_courses_search
  ON courses USING GIN (search_vector);
```

The same shape for `templates` (`title` A, `description` C), `questions` (title A, preview/body C) and `products` (`name` A, `search_title` B, `description` C).

> **Read the models first.** `questions` and `products` column names must be confirmed against `app/db/models/question.py` and `app/db/models/product.py` before this migration is written. `products.search_title` is referenced at `app/api/v1/content/packs.py:81,195` and is expected to exist; the question body column is **not** assumed by this plan. Do not write migration `028` from memory of the schema.

**Weighting rationale.** A title match must outrank a description match, or a long description full of common words wins every query. `ts_rank_cd` with the default weight vector `{0.1, 0.2, 0.4, 1.0}` gives an A-weighted title match roughly ten times the weight of a C-weighted body match.

**Index build.** `CONCURRENTLY`, inside the autocommit block, with the `INVALID` verification pass from migration `010`. A GIN build across four tables at current volume is sub-second — the pattern is there for the volume it is being built for, not today's.

**Query budget.** Four queries, one per entity type, each `WHERE search_vector @@ websearch_to_tsquery('english', :q) AND published` with `ORDER BY ts_rank_cd(...) DESC LIMIT 5`. Constant regardless of result count.

**`websearch_to_tsquery`, not `plainto_tsquery`.** It accepts quoted phrases and `or`, and — the operative reason — it never raises on malformed input. The input here is a public query string, so a parser that can throw is a 500 waiting for the first person who types a stray quote.

## III.5 Migration `029` — reviews, notes, bookmarks

**Table `reviews`**

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → users.id NOT NULL | |
| `content_type` | varchar(50) NOT NULL | `CHECK (content_type IN ('course','template','pack'))` |
| `content_id` | uuid NOT NULL | Polymorphic — no FK, see below |
| `rating` | smallint NOT NULL | `CHECK (rating BETWEEN 1 AND 5)` |
| `body` | text NULL | Sanitised on write |
| `display_name` | varchar(120) NULL | What the reviewer is shown as; falls back to a first-name-plus-initial derivation |
| `state` | enum `review_state` | `pending \| approved \| rejected`, default `pending` |
| `is_featured` | boolean NOT NULL DEFAULT false | Drives the Stage A testimonial rendering |
| `moderated_by` / `moderated_at` | varchar(255) / timestamptz NULL | |

**On the missing foreign key.** A polymorphic `content_id` cannot carry a Postgres FK, so referential integrity is the application's job here — the one place in this schema where that is true. The mitigation is explicit, and belongs in the model docstring in these terms so that a later reader does not "fix" it by adding an FK to one of the three tables:

- The submission endpoint resolves the content through `resolve_granted_content_ids` before inserting, so a review can only be written against content the user provably has access to — which implies the row exists.
- The `CHECK` on `content_type` stops the other failure mode (a typo'd type string) at the database.

**Constraints and indexes**
- `UNIQUE (user_id, content_type, content_id)` — one review per person per item.
- `ix_reviews_content_approved` on `(content_type, content_id)` `WHERE state = 'approved'` — partial; the public read only ever wants approved rows, and indexing the pending ones wastes the index.
- `ix_reviews_state_created` on `(state, created_at DESC)` — the moderation queue.

**Denormalised aggregates.** `courses`, `templates` and `products` each gain `review_count integer NOT NULL DEFAULT 0` and `rating_sum integer NOT NULL DEFAULT 0`.

**Why sum and count, not a stored average.** `rating_sum` makes every moderation transition an exact integer `UPDATE ... SET rating_sum = rating_sum + :delta`, with no floating-point drift across thousands of increments, and the average is computed on read. A stored float average would accumulate error and make an un-approval impossible to reverse exactly. `scripts/reconcile_review_aggregates.py` (§IV Phase 4, Step 4.4) recomputes both from `reviews` and is the authority if they ever disagree.

**Why denormalise at all.** A catalogue page loads 8–40 cards. A `COUNT`/`AVG` correlated subquery per card is precisely the N+1 shape `handover.md` §1 documents. Two integer columns on a row that is already being selected cost nothing.

**Table `user_notes`.** `id`, `user_id` FK, `lesson_id` FK → lessons.id, `body` text NOT NULL, timestamps. `UNIQUE (user_id, lesson_id)` — one note per lesson per learner, edited in place. `ix_user_notes_user` on `(user_id)` `INCLUDE (lesson_id)`.

**Table `bookmarks`.** `id`, `user_id` FK, `content_type` varchar(50) with the same `CHECK`, `content_id` uuid, `created_at`. `UNIQUE (user_id, content_type, content_id)`.

## III.6 Migration hygiene, applying to all four

1. Every migration has a working `downgrade()`. A migration that cannot be reversed is a migration that cannot be deployed on a Friday.
2. Every migration's docstring names the requirement it serves (`W5-R1`…`W5-R5`) and the query it exists for, matching the house style of `010` and `013`.
3. The round trip runs clean, locally, **before** the migration is committed:
   ```
   cd backend && alembic upgrade head && alembic downgrade -1 && alembic upgrade head
   ```
4. **Enums follow `app/db/base.py:14–33` exactly.** Lowercase values, an explicit snake_case type name, and `str_enum(ReviewState, name="review_state")` in the model. That docstring documents at length why guessing either the casing or the type name fails at insert time with two different and easily-misread errors. `review_state` is the only new enum this week; it gets no exceptions.

---

# PART IV — IMPLEMENTATION PHASES

Each phase lists the tests that must be **seen red first**, matching the practice recorded in [`gating_seen_red.md`](gating_seen_red.md).

## Phase 0 — Preflight (0.5 day)

1. Confirm the head: `cd backend && alembic current` — must report `025`.
2. Run the existing suites and record the counts. Anything already red is fixed, or explicitly recorded, **before** new work starts — so that a Week 5 failure is unambiguously a Week 5 failure.
   ```
   cd backend && pytest -q
   cd frontend && npm run test
   ```
3. Read `app/db/models/question.py` and `app/db/models/product.py` and write down the real column names the search vectors will cover (§III.4).
4. Branch: `feat/week5-promotions-certificates-search`.

## Phase 1 — W5-R1 Promotions (1–2 days)

### Backend

**Step 1.1 — Model.** `app/db/models/promotion.py`, per §III.2. Register in `app/db/models/__init__.py` — **both** the import and the `__all__` entry. That file lists every model in both places; a missing `__all__` entry is the kind of omission that only surfaces months later on a star-import path.

**Step 1.2 — Migration `026`,** per §III.2, including the partial index and both `CHECK` constraints.

**Step 1.3 — Public endpoint.** New file `app/api/v1/content/promotions.py`:

```python
@router.get("/promotions/active", response_model=PromotionOut | None)
async def get_active_promotion(session: AsyncSession = Depends(get_session)):
    """The one promotion in force right now, or null. Public and unauthenticated —
    the banner renders for a visitor who has never signed in.

    Date filtering happens in SQL, not Python: the server's clock is the authority
    on whether an offer is live, and a client that filtered would let a wrong local
    clock show an expired code.
    """
    now = datetime.now(timezone.utc)
    stmt = (
        select(Promotion)
        .where(
            Promotion.active.is_(True),
            Promotion.starts_at <= now,
            or_(Promotion.ends_at.is_(None), Promotion.ends_at > now),
        )
        .order_by(Promotion.starts_at.desc())
        .limit(1)
    )
    promo = (await session.execute(stmt)).scalar_one_or_none()
    return PromotionOut.model_validate(promo) if promo else None
```

`PromotionOut` exposes `code`, `message`, `percent_off`, `ends_at` — **and nothing else**. Not `id`, not `stripe_coupon_id`, not `created_by`. A public response model is an allowlist, and a test asserts the serialised body has exactly those four keys. This mirrors the discipline `admin/settings.py` already applies to config status.

Mount it in `main.py` alongside the other content routers.

**Step 1.4 — Admin endpoints.** `app/api/v1/admin/promotions.py`, mounted in `admin/router.py` — which supplies `require_admin` at router level. Do not add a per-route guard and do not create a second router; that file's docstring explains why the single choke point exists.

- `GET /admin/promotions` — all promotions, newest first, with a computed `status` field (`scheduled` / `live` / `expired` / `inactive`) so the admin screen does not re-derive date logic in TypeScript.
- `POST /admin/promotions` — overlap check → Stripe sync (if requested) → insert → `record_audit` → one commit.
- `PATCH /admin/promotions/{id}` — same overlap check, excluding self.
- `POST /admin/promotions/{id}/deactivate` — sets `active = false`. Separate from `PATCH` because it is the one action taken in a hurry, and it should be a single button that cannot accidentally rewrite the percentage on the way through.

**Step 1.5 — Overlap check.** One helper, shared by create and update:

```python
async def _overlapping(*, session, starts_at, ends_at, exclude_id=None) -> Promotion | None:
    """Two active promotions covering the same instant means GET /promotions/active
    picks one arbitrarily by sort order. That is a coin flip over which discount a
    visitor is offered, so it is refused at write time with a 409 naming the
    conflicting promotion.

    Half-open intervals [starts_at, ends_at): one ending at noon and one starting at
    noon do not overlap. A NULL ends_at is +infinity.
    """
```

Tested across five interval cases: both open-ended, one open-ended, exact-boundary abutment, partial overlap, full containment.

**Step 1.6 — Stripe sync.** In `app/integrations/stripe_client.py`, alongside the existing lookup:

```python
def create_promotion_in_stripe(*, code: str, percent_off: int, expires_at: datetime | None) -> tuple[str, str]:
    """Create the Coupon and the PromotionCode that references it, returning both ids.

    Two calls, not one: Stripe models the *discount* (Coupon) separately from the
    *string a buyer types* (PromotionCode). Checkout resolves the typed string, which
    is why create_checkout_session looks up PromotionCode and not Coupon.

    Raises on failure. The caller must not write a promotions row for a code Stripe
    will not honour — a banner advertising a dead code is worse than no banner.
    """
```

The endpoint wraps this in `try/except stripe.StripeError` and returns a 502 naming the error, with no row inserted.

**Note the deliberate asymmetry** with the *read* path in `create_checkout_session`, which swallows a Stripe failure and continues at full price. A failed lookup at checkout must not block a sale; a failed create at admin time must not produce a lie. Same integration, opposite failure postures, both correct — worth a comment at each site so neither gets "made consistent" later.

### Frontend

**Step 1.7 — Public hook.** Add `promotions: { active: () => ['promotions','active'] as const }` to `src/lib/query/keys.ts` (the file exists precisely so cache keys cannot drift between call sites). `useActivePromotion()` with `staleTime: 5 * 60 * 1000` — a banner does not need second-level freshness, and this keeps the request off every navigation.

**Step 1.8 — Rewire `DiscountBanner.tsx`.** Delete both module constants; render from the hook. Four things to get right:

- **While loading, render nothing** — not a skeleton. A banner that appears a beat after paint pushes the whole page down, which is a CLS regression against the `DESIGN.md` §43 budget of 0.05.
- On error or `null`, render nothing.
- **Keep the existing accessibility work verbatim**: the `role="region"` with `aria-label`, the `role="status"` copy confirmation, and the comment explaining why `role="banner"` was wrong there. Those were deliberate fixes; they must survive the rewrite.
- **Key the dismissal on the code** (`practicable:discount-banner-dismissed:{code}`), so a *new* offer is not pre-dismissed for everyone who closed the old one. This is the non-obvious part — comment it.

**Step 1.9 — `AdminPromotions.tsx`.** Follow `AdminSettings.tsx`: `PageTitle`, react-query, `Badge` for the status field, `FieldError` + `useFieldValidation` for the form. A list plus a create form. Lazy-route it in `App.tsx` beside the other admin pages, and add the nav entry in `AdminLayout.tsx:70`.

### Tests, red first

| Test | File |
|---|---|
| Active promotion returned inside the window | `backend/tests/test_promotions.py` |
| Not returned before `starts_at`, after `ends_at`, or when `active=false` | same |
| Public body has exactly the four allowlisted keys | same |
| Overlap create → 409, all five interval cases | same |
| Stripe failure → 502 **and zero rows** | same |
| Create / update / deactivate each write an `audit_log` row | `backend/tests/admin/` |
| `/admin/promotions` unauthenticated → 401/403 | same |
| Banner renders nothing while loading and on error | `frontend/src/components/ui/__tests__/DiscountBanner.test.tsx` |
| Dismissal is per-code | same |

## Phase 2 — W5-R2 Certificates (4–6 days)

**Step 2.1 — Model + migration `027`,** per §III.3.

**Step 2.2 — `app/services/certificate_service.py`,** modelled on `stamping.py`, which already does this job for a different artefact.

```python
async def issue_certificate_if_newly_complete(
    *, session, user, course, was_complete: bool, is_complete: bool
) -> Certificate | None:
    """Issue on the false→true edge only. Called from the lesson-completion path with
    the before/after state that path already computed — the caller knows the edge, so
    this function does not re-derive it from the database and therefore cannot
    disagree with the transition that actually happened.

    Idempotent by UNIQUE(user_id, course_id): a replayed request hits the constraint
    and is treated as success, not as an error. The constraint is the guard; a
    SELECT-then-INSERT pre-check would race.

    Does NOT generate the PDF. Issue is a database write on the request path;
    rendering is deferred to first fetch, so a slow or failed render can never cost
    someone the lesson completion they actually performed.
    """
```

**Step 2.3 — Wire the edge in `lessons.py`.** Around line 598 the code already computes `is_complete` and loads the existing `CourseProgress`. Capture `was_complete = course_progress.completed if course_progress else False` **before** mutating it, then call the service after the commit. The refactor is three lines; the ordering is the entire thing.

**Step 2.4 — PDF renderer, `app/services/certificate_pdf.py`.**

- A base A4 landscape PDF at `backend/assets/certificate_template.pdf` carrying the border, wordmark and static copy.
- `pypdf` overlays the four dynamic values, reading the **snapshot columns**, never a join.
- `render_and_cache(certificate)` uploads to `certificates/{certificate_id}.pdf` via `storage_client.upload_file`, sets `pdf_storage_key`, and returns it. A second call short-circuits on the existing key — the same cache shape as `stamping.py:_stamp_key`.
- Colours and type come from `frontend/src/styles/theme.css`, which §0.3 makes the authority for every design value. Copy the hex values into a module constant with a comment naming the token each came from, so a later theme change has one findable place to follow.

**Step 2.5 — Endpoints.**

- `GET /me/certificates` — the learner's list. Authenticated. One query.
- `GET /me/certificates/{id}/download` — renders on first call, then presigns. **404, not 403,** when the certificate belongs to someone else: a 403 confirms the id exists.
- `GET /verify/{verification_code}` — **public**, unauthenticated. Returns learner name, course title, issue date, `revoked_at`. Nothing else, ever. Rate-limited through the existing `app/core/rate_limit.py`, because an unauthenticated lookup keyed on a short code is exactly what gets enumerated.

**Step 2.6 — Revocation.** In `app/services/refund_service.py`, where entitlements are revoked, also set `certificates.revoked_at` for courses covered by the refunded product. A certificate for a refunded course must not verify clean — that is the whole point of having a verify page.

**Step 2.7 — Email.** `app/emails/certificate_issued.html.j2` + `.txt.j2` on `base.html.j2`, sent through `_send`. It **links** to the certificate rather than attaching it: attachments hurt deliverability, and a link works from any device.

**Step 2.8 — Frontend.** A certificates panel in `Dashboard.tsx`, a completion state on `CourseDetail.tsx`, and a public `/verify/:code` page mounted in `MarketingLayout` — a stranger checking a certificate is not a member and must not land in member chrome.

### Tests, red first

| Test | Note |
|---|---|
| Completing the last lesson issues exactly one certificate | the core case |
| Completing it twice issues one | replay |
| Un-completing then re-completing issues one | the edge a naive `if is_complete` gets wrong |
| Snapshot survives a course rename | frozen columns |
| PDF rendered once; second fetch reuses `pdf_storage_key` | cache |
| PDF failure does not fail lesson completion | the promise in §2.2.3 |
| Verify returns only the public fields | allowlist assertion, same shape as the promotions one |
| Another user's certificate → 404, not 403 | enumeration |
| Refund marks the certificate revoked | end to end through the refund service |
| Verify is rate-limited | |

## Phase 3 — W5-R3 Public search (2–3 days)

**Step 3.1 — Migration `028`,** per §III.4. Read the real column names first (Phase 0, step 3).

**Step 3.2 — `app/api/v1/content/search.py`.** One `GET /search`, four bounded queries, `websearch_to_tsquery`, the `published` filter on every one, `LIMIT 5` per type, plus a `total` per group so the UI can offer "see all in courses".

Guard the input: an empty or whitespace-only `q` returns empty groups **without touching the database**. Cap `q` at 200 characters.

**Step 3.3 — Header search.** A field in the header with `role="search"` on its wrapper, a real visually-hidden `<label>`, results in a listbox with proper `aria-activedescendant` keyboard handling, and a `role="status"` announcing "N results". Debounce 250ms. Enter with no selection navigates to a full `/search?q=` results page — **which must exist**, because a search box that only ever shows five results per type is a dead end for a real query.

### Tests, red first

- Draft, in-review and archived rows never appear (one test creating all four publish states).
- A title match outranks a description match.
- A phrase query (`"risk register"`) is handled without raising.
- Empty and whitespace queries return empty groups and issue **zero** database queries.
- Query count is exactly four regardless of result volume — asserted with the counting fixture already used by `test_routing_query_count.py`.
- Keyboard-only navigation of the results listbox, in `frontend/tests/e2e/`.

## Phase 4 — W5-R4 Reviews (3–5 days)

**Step 4.1 — Migration `029` (reviews half),** per §III.5, including the denormalised counters and the `str_enum` type.

**Step 4.2 — Submission endpoint,** entitlement-gated through `has_access_to`. Body sanitised through `html_sanitizer`. `state = pending` on write, always — there is no path by which a submission is born approved.

**Step 4.3 — Moderation screen** `AdminReviews.tsx`, following `AdminContact.tsx` (the existing queue-shaped admin screen). Approve / reject / feature. Every transition writes an audit row **and** adjusts `review_count` / `rating_sum` **in the same transaction as the state change** — the counter and the state can never be committed apart.

**Step 4.4 — `scripts/reconcile_review_aggregates.py`.** Recomputes both counters from `reviews` and reports drift. This exists because a denormalised counter with no reconciler is a number nobody can ever check.

**Step 4.5 — Stage A rendering.** A `<Testimonial>` component rendering `is_featured` approved reviews as named quotes on `CourseDetail`, `Template` and `PackDetail`. **No star aggregate anywhere yet.**

**Step 4.6 — Stage B, built but gated.** `MIN_REVIEWS_FOR_AGGREGATE = 8` in one shared constant, exported from `frontend/src/lib/reviews.ts` and **mirrored in the API serialiser** so the backend does not ship a rating the frontend then hides. Below the threshold the API returns `rating: null` and the card renders no rating element at all. One constant to change; §2.4 records why it starts closed.

### Tests, red first

- No entitlement → 403 on submit.
- Revoked entitlement → 403.
- A second review by the same user on the same item → 409.
- A pending review is invisible on the public endpoint.
- Approve → counters increment; un-approve → counters decrement exactly; the reconciler reports zero drift after a random sequence of transitions.
- Below the threshold, the API returns `rating: null` and the card renders no rating element.
- Review body is sanitised on write (extend `test_html_sanitizer.py`).

## Phase 5 — W5-R5 Notes, bookmarks, learner analytics (2–3 days)

**Step 5.1 — Migration `029` (notes/bookmarks half)** — or a separate `030` if Phase 4 has already shipped anywhere. **Never amend a migration that has run.**

**Step 5.2 — Endpoints.** `PUT /me/notes/{lesson_id}` (upsert; one note per lesson), `GET /me/notes`, `POST` / `DELETE /me/bookmarks`, `GET /me/bookmarks`.

**Step 5.3 — Notes panel** in `Lesson.tsx`, autosaving through the existing `useAutosave` + `AutosaveIndicator` pair rather than a new save mechanism.

**Step 5.4 — Learner progress view.** Per-course completion bars, lessons remaining, and estimated time left from `courses.estimated_duration_minutes` (added in migration `025`, currently written and barely read). Pure presentation over existing columns — no new tables, no new writes.

## Phase 6 — Close-out (0.5 day)

1. Full backend, frontend and e2e suites. Record the counts in `docs/week5_report.md`.
2. Append the `EXPLAIN` evidence for migrations `026` and `028` to `db_index_evidence.md`.
3. Extend `frontend/tests/e2e/screen-overview.spec.ts` and `admin-screen-overview.spec.ts` with the new routes — the sweep is only as good as its route list.
4. Run `accessibility.spec.ts` and `responsive-widths.spec.ts` over the four new screens, in both themes.
5. Write `docs/week5_report.md` naming what shipped, what did not, and why.

---

# PART V — LEDGER, RISKS, DECISIONS

## V.1 Task ledger

| ID | Task | Phase | Est. | Depends on |
|---|---|---|---|---|
| W5-T01 | Preflight, branch, baseline counts | 0 | 0.5d | — |
| W5-T02 | Promotion model + migration `026` | 1 | 0.5d | T01 |
| W5-T03 | `GET /promotions/active` | 1 | 0.25d | T02 |
| W5-T04 | Admin promotions CRUD + overlap + audit | 1 | 0.5d | T02 |
| W5-T05 | Stripe coupon / promotion-code sync | 1 | 0.25d | T04 |
| W5-T06 | `DiscountBanner` rewire + `AdminPromotions.tsx` | 1 | 0.5d | T03, T04 |
| W5-T07 | Certificate model + migration `027` | 2 | 0.5d | T01 |
| W5-T08 | Issue service + completion-edge wiring | 2 | 1d | T07 |
| W5-T09 | PDF renderer + storage cache | 2 | 1.5d | T07, `[OWNER]` §V.3.2 |
| W5-T10 | Certificate + verify endpoints, rate limit | 2 | 0.5d | T08, T09 |
| W5-T11 | Revocation on refund | 2 | 0.5d | T08 |
| W5-T12 | Email template + send | 2 | 0.5d | T08 |
| W5-T13 | Dashboard panel + public verify page | 2 | 1d | T10 |
| W5-T14 | Migration `028`, tsvectors + GIN | 3 | 0.5d | T01 |
| W5-T15 | `GET /search` | 3 | 0.5d | T14 |
| W5-T16 | Header search + `/search` results page | 3 | 1.5d | T15 |
| W5-T17 | Migration `029` reviews + counters | 4 | 0.5d | T01 |
| W5-T18 | Submit endpoint, entitlement-gated | 4 | 0.5d | T17 |
| W5-T19 | `AdminReviews.tsx` + counter transitions | 4 | 1d | T17 |
| W5-T20 | Reconciler script | 4 | 0.25d | T19 |
| W5-T21 | Testimonial component (Stage A) | 4 | 1d | T19 |
| W5-T22 | Gated aggregate (Stage B, closed) | 4 | 0.5d | T21 |
| W5-T23 | Notes + bookmarks | 5 | 1d | T01 |
| W5-T24 | Learner progress view | 5 | 1d | — |
| W5-T25 | Close-out: suites, evidence, report | 6 | 0.5d | all |

**Total ≈ 18 working days.** Phases 1–3 alone are ≈ 9 days and carry most of the value; if the week has to be cut, cut from the back.

## V.2 Risk watchlist

| Risk | Likelihood | Consequence | Mitigation |
|---|---|---|---|
| `CREATE INDEX CONCURRENTLY` fails through pgbouncer, leaving an `INVALID` index | Medium | Silent — the index exists and is never used | Copy migration `010`'s autocommit block **and its `INVALID` verification pass**. Not one without the other |
| Certificate issued twice on a double-click | Medium | Two certificates for one course | `UNIQUE(user_id, course_id)` is the guard; catch `IntegrityError`. Never a pre-check |
| PDF render fails, learner loses the completion | Low | High — the learner did the work | Issue and render are separated: the row on the request path, the render on first fetch |
| Review counters drift from `reviews` | Medium | A wrong rating shown publicly | Same-transaction updates, plus a reconciler that can prove it |
| Verify code enumerated | Low | Learner names leak | `token_urlsafe(16)` (~128 bits) + the existing rate limiter |
| Search returns unpublished content | Low | Severe — a paid or draft item exposed | `published` filter on all four queries, plus one test creating a row in each publish state |
| Two live promotions | Medium | An arbitrary discount is offered | 409 at write time, inside the insert's transaction |
| Stripe create succeeds, our insert then fails | Low | Orphan coupon in Stripe | Create in Stripe *after* the overlap check and *inside* the endpoint's error handling; log the orphan id explicitly so it is findable |

## V.3 Decisions only the owner can make

1. **`[OWNER]` "your first purchase."** The banner copy live in production promises a first-purchase discount that nothing enforces — a returning buyer can reuse `WELCOME15` today. Either set a per-customer redemption limit on the Stripe coupon, or change the copy. This is a consumer-law-adjacent claim, not a preference. **Recommendation: change the copy to "your next purchase" as part of Step 1.8**, and add per-customer limits only if the offer is genuinely meant to be first-purchase-only. This does not block Phase 1.

2. **`[OWNER]` Certificate wording and signature.** What the certificate asserts ("has completed", not "is certified in"), whose name signs it, and whether any accreditation is implied. A certificate that overstates is a liability the platform then issues at scale, automatically. The template cannot be drawn without this answer, so **Step 2.4 (W5-T09) is blocked on it — Steps 2.1–2.3 are not.** That is why issuance is deliberately sequenced before rendering: the blocking decision sits behind 1.5 days of work that can proceed regardless.

3. **`[OWNER]` Reviews, Stage A or full.** This plan builds curated testimonials first and gates the aggregate at 8 reviews, for the reason in §2.4. If open reviews with visible stars from day one are wanted instead, Phase 4 simply drops the gate — the schema supports both, so this can be decided as late as Step 4.6.

## V.4 Commands that matter

```
# Migrations — round-trip before committing
cd backend && alembic upgrade head && alembic downgrade -1 && alembic upgrade head

# Suites
cd backend && pytest -q
cd frontend && npm run test
cd frontend && npx playwright test
```
