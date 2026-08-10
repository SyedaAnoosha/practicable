# Deciding in the Dark — Backend Structure & API Specification

**Version 1.0** · Companion to `DESIGN.md` v2.0
**Stack:** FastAPI (Python 3.12) · SQLAlchemy 2.0 · Alembic · Supabase Postgres · Stripe · Mux · Cloudflare R2 · Resend · Render

---

## 0. Where this sits

| Document | Owns |
|---|---|
| `Deciding_in_the_Dark_Platform_Intern_Brief.md` | Scope, deliverables, non-negotiables, the four-week sequence |
| `Deciding_in_the_Dark_Research_Specification.md` | Research, entity model, service selection, security model, pricing, legal |
| `DESIGN.md` v2.0 | Everything the user sees; the frontend structure (§52) and its API expectations |
| **This document** | The FastAPI service: structure, boundaries, the entitlement gate, and the API contract the frontend consumes |

`DESIGN.md` §52 is the frontend tree. This is its counterpart. Cross-references marked `DESIGN §n` point there; `RS n.n` points at the Research Specification.

---

## 1. Five principles that shape the structure

### 1.1 There is exactly one gate

The `entitlements` table is the single source of truth for access (RS 5.6). Every gated resource passes through **one dependency, in one file** — `app/core/entitlements.py`. Not a decorator repeated per router, not a check copied into each service, not a mixin.

This matters structurally because the failure mode is dispersion: a codebase with entitlement logic in nine places has nine chances to get it wrong, and the ninth one is the leak found in week four. One file means one audit, one test suite, and one place to look when something is wrong.

### 1.2 The response schema *is* the gate

FastAPI's `response_model` strips fields not declared on it. So gating is enforced twice — once by the dependency that decides whether to serve, and once by a Pydantic model that structurally cannot carry the guarded field.

```python
class QuestionIndexOut(BaseModel):     # cannot carry `body`. Ever.
class QuestionPreviewOut(BaseModel):   # first paragraph + gated: true
class QuestionFullOut(BaseModel):      # the whole thing, entitled only
```

`DESIGN.md` §21.3 requires that gated guidance never reaches the browser. This is how that requirement becomes structural rather than a rule someone has to remember.

### 1.3 Routes decide, services do, integrations call

Three layers, and the boundary is enforced by import direction:

```
api/        thin. Parse, authorise, delegate, shape the response. No business logic,
            no ORM queries beyond a trivial get, and never a third-party SDK call.
services/   the business logic. Owns transactions. Knows the domain. Knows nothing
            about HTTP.
integrations/ the outside world. Stripe, Mux, R2, Resend, PostHog. One module each,
            each one the only place its SDK is imported.
```

A route that imports `stripe` is a bug. A service that imports `Request` is a bug. This keeps the Stripe SDK swappable, keeps services testable without a client, and keeps every outbound credential in one importable place.

### 1.4 Sections are a foreign key, not an assumption

RS 3.4 and the owner directive: a second subject, author and audience must be configuration. Concretely, in the backend:

- Every content query is scoped by `section_id`. No query assumes one section exists.
- No enum, constant, or route path hard-codes a domain name or the word "risk".
- Tag values live in reference tables, not Python enums — the owner still owns those lists (RS 12.2), and changing them must be a data edit, not a deploy.

### 1.5 Money and access are audited

Every entitlement grant, every manual override, every publish and every refund writes an `audit_log` row with actor, action, target and timestamp. This is a five-line service and it is the difference between "we think the webhook fired" and knowing.

---

## 2. The tree

```text
backend/
  app/
    main.py                        ← app factory, middleware, router mount, health
    __init__.py

    core/
      config.py                    ← Settings (pydantic-settings). The ONLY os.environ reader.
      security.py                  ← Supabase JWT verification against JWKS
      deps.py                      ← shared dependencies: db, current_user, require_admin
      entitlements.py              ← THE GATE. §4. Read this file first.
      errors.py                    ← exception types + handlers + the error response shape
      logging.py                   ← structured logging, request IDs, secret redaction
      rate_limit.py                ← per-IP and per-user limits (RS 7.6)
      pagination.py                ← cursor/offset helpers, one implementation

    db/
      session.py                   ← async engine, sessionmaker, get_session dependency
      base.py                      ← DeclarativeBase, shared mixins (id, timestamps)
      models/
        __init__.py                ← imports every model so Alembic sees them
        user.py                    ← users (profile extending Supabase auth), Role enum
        section.py                 ← sections  ← the extensibility root
        author.py                  ← authors
        domain.py                  ← domains
        question.py                ← questions + question_relations
        tag_value.py               ← controlled vocabularies for the seven dimensions
        course.py                  ← courses
        module.py                  ← modules
        lesson.py                  ← lessons (video | reading | download | mixed)
        template.py                ← templates (files in R2)
        media.py                   ← video assets (Mux ids, status, captions)
        product.py                 ← products + prices + product_contents
        order.py                   ← orders
        entitlement.py             ← entitlements  ← the access source of truth
        progress.py                ← lesson_progress, course_progress
        lead.py                    ← free entry point email captures
        audit.py                   ← audit_log
        webhook_event.py           ← processed Stripe event ids (idempotency)

    schemas/                       ← Pydantic v2. Separate In/Out. Separate gated/ungated.
      common.py                    ← Page[T], ErrorOut, IdOut
      question.py                  ← QuestionIndexOut, QuestionPreviewOut,
                                     QuestionFullOut, QuestionIn, QuestionFilters
      course.py                    ← CourseCardOut, CourseDetailOut, CourseIn
      lesson.py                    ← LessonOut, LessonGatedOut, LessonIn
      template.py                  ← TemplateCardOut, TemplateDetailOut, TemplateIn
      product.py                   ← ProductOut, PriceOut, ProductIn
      order.py                     ← OrderOut, CheckoutSessionOut
      entitlement.py               ← EntitlementOut
      progress.py                  ← ProgressOut, ProgressIn
      media.py                     ← PlaybackTokenOut, UploadTicketOut
      user.py                      ← UserOut, UserAdminOut
      admin.py                     ← admin-only shapes (audit rows, reconciliation)

    api/
      v1/
        router.py                  ← mounts every sub-router with its prefix and tags
        public/
          sections.py              ← GET /sections
          questions.py             ← GET /questions/index, /questions, /questions/{slug}
          courses.py               ← GET /courses, /courses/{slug}
          templates.py             ← GET /templates, /templates/{slug}
          search.py                ← GET /search
          leads.py                 ← POST /leads  (free entry point)
        member/
          me.py                    ← GET /me, PATCH /me
          library.py               ← GET /me/library, /me/purchases
          entitlements.py          ← GET /me/entitlements
          progress.py              ← GET/PUT /me/progress/{lesson_id}
          lessons.py               ← GET /lessons/{slug}  (gated body)
          playback.py              ← POST /lessons/{id}/playback   ← signed Mux token
          downloads.py             ← POST /templates/{id}/download ← presigned R2 URL
        commerce/
          checkout.py              ← POST /checkout/session
          webhooks.py              ← POST /webhooks/stripe        ← no auth, signature-verified
          orders.py                ← GET /me/orders/{id}
        admin/
          questions.py  courses.py  lessons.py  templates.py
          products.py   users.py    orders.py
          structure.py             ← sections, domains, authors, tag values
          media.py                 ← Mux upload tickets, R2 uploads
          audit.py

    services/
      question_service.py          ← index build, filter query, scoring parity (§7)
      catalog_service.py           ← courses, modules, lessons, templates
      search_service.py            ← keyword now; pgvector slot reserved (RS 9.2)
      entitlement_service.py       ← grant, revoke, resolve-for-user
      order_service.py             ← checkout session, webhook fulfilment, reconciliation
      progress_service.py          ← lesson completion, course percentage, resume point
      media_service.py             ← playback tokens, upload tickets, caption status
      download_service.py          ← presigned URL minting, expiry policy
      email_service.py             ← renders Jinja2 templates, sends via Resend
      lead_service.py              ← capture, dedupe, grant free-section entitlement
      audit_service.py             ← write-only append log
      publishing_service.py        ← draft → review → published → archived transitions

    integrations/
      stripe_client.py             ← the only `import stripe`
      mux_client.py                ← the only `import mux_python`
      r2_client.py                 ← the only boto3 S3 client
      resend_client.py             ← the only `import resend`
      posthog_client.py            ← server-side events (purchase, entitlement_delay)
      supabase_admin.py            ← service-role client: user lookup, admin ops

    emails/
      _base.html                   ← the shared shell (600px, table layout, inline CSS)
      welcome.html          welcome.txt
      receipt.html          receipt.txt
      access_granted.html   access_granted.txt
      password_reset.html   password_reset.txt
      free_access.html      free_access.txt

    workers/
      __init__.py
      tasks.py                     ← background jobs (email send, index rebuild)
      scheduler.py                 ← nightly prerender trigger (DESIGN §44.2)

  alembic/
    env.py
    versions/                      ← one migration per schema change, all reviewed

  tests/
    conftest.py                    ← test db, factories, an authenticated client
    factories/                     ← model factories mirroring DESIGN §49.2 fixtures
    unit/
      test_scoring.py              ← parity with the frontend (§7.3)
      test_entitlement_resolution.py
      test_progress_calculation.py
    integration/
      test_questions_api.py
      test_checkout_flow.py
      test_webhook_idempotency.py
      test_publishing_transitions.py
    gating/                        ← the ten tests from DESIGN §58.2. Non-negotiable.
      test_gating.py

  scripts/
    load_questions.py              ← bulk import from the author's spreadsheet
    seed_dev.py                    ← realistic dev data, incl. the stress fixtures
    grant_entitlement.py           ← operational escape hatch, audited
    check_orphans.py               ← orders without entitlements — the silent failure

  pyproject.toml
  alembic.ini
  .env.example                     ← every var named, no values
  Dockerfile
  render.yaml
  README.md
```

---

## 3. Why feature-grouped routes and layer-grouped everything else

The `api/` tree groups by **audience** — public, member, commerce, admin — because that is how authorisation is applied, and grouping by audience means a whole directory shares one dependency stack. `api/admin/*` cannot be reached without `require_admin`; that is visible from the tree, and it is enforced once at mount time in `router.py` rather than per endpoint.

Everything below `api/` groups by **layer**, not feature, because the entities are heavily interlinked (a product grants access to a course *and* a template *and* a set of questions). Feature-siloed vertical slices would put `entitlement` logic in four silos, which violates §1.1.

The one thing not worth arguing about in a four-week build: pick this, and don't reorganise it in week three.

---

## 4. The gate

`app/core/entitlements.py` is the most important file in the backend. It is short on purpose.

```python
# app/core/entitlements.py

async def resolve_entitlements(user_id: UUID, session: AsyncSession) -> set[UUID]:
    """Every product_id this user currently holds. Cached per-request only."""


async def has_access_to(
    *, user_id: UUID, resource_type: ResourceType, resource_id: UUID,
    session: AsyncSession,
) -> bool:
    """Does any product the user holds grant this specific resource?"""


def require_entitlement(resource_type: ResourceType):
    """FastAPI dependency factory. The ONLY way a gated route is protected."""
    async def _dep(
        resource_id: UUID,
        user: CurrentUser = Depends(get_current_user),
        session: AsyncSession = Depends(get_session),
    ) -> UUID:
        if user.role == Role.ADMIN:
            return resource_id                      # audited elsewhere
        if not await has_access_to(
            user_id=user.id, resource_type=resource_type,
            resource_id=resource_id, session=session,
        ):
            raise NotEntitled(resource_type, resource_id)
        return resource_id
    return _dep
```

Used like this, and only like this:

```python
@router.post("/lessons/{resource_id}/playback", response_model=PlaybackTokenOut)
async def create_playback_token(
    lesson_id: UUID = Depends(require_entitlement(ResourceType.LESSON)),
    media: MediaService = Depends(get_media_service),
):
    return await media.mint_playback_token(lesson_id)
```

### 4.1 Order of operations, which is not negotiable

The check runs **before** the endpoint does anything else — before Mux is called, before R2 is called, before a query for the body. A signed URL minted and then discarded on a failed check is a signed URL that existed, and existing is enough (RS 5.6).

### 4.2 What the gate protects

| Resource | Endpoint | On failure |
|---|---|---|
| Lesson body | `GET /lessons/{slug}` | 403 + `LessonGatedOut` (title, type, product, price — no content) |
| Video playback | `POST /lessons/{id}/playback` | 403, no token issued |
| Template file | `POST /templates/{id}/download` | 403, no URL minted |
| Question guidance | `GET /questions/{slug}` | 200 + `QuestionPreviewOut` — see below |

Question previews are a **200, not a 403**. The paywall is a designed conversion surface (DESIGN §21.3), not an error. The response carries the first paragraph, `gated: true`, and the product that would unlock it. The remaining body is never serialised.

### 4.3 Never

- No route reads `entitlements` directly.
- No response model carries a gated field "and then we filter it in the route".
- No client-supplied flag influences the check.
- No admin bypass without an audit row.

---

## 5. Authentication

Supabase issues the JWT; FastAPI verifies it. There is no session store here.

```python
# app/core/security.py
# - Fetch and cache Supabase's JWKS (refresh on unknown kid, not per request)
# - Verify signature, exp, aud, iss
# - Map sub → users.id, load role
# - Return CurrentUser(id, email, role) or raise Unauthenticated
```

`deps.py` exposes three, and nothing else needs writing:

```python
get_current_user          # 401 if absent or invalid
get_current_user_optional # None if absent — for public routes that personalise
require_admin             # 403 unless role == admin
```

`require_admin` is applied at the router level in `api/v1/router.py`, not per endpoint:

```python
api_router.include_router(
    admin_router, prefix="/admin", tags=["admin"],
    dependencies=[Depends(require_admin)],
)
```

Adding an admin endpoint therefore cannot accidentally ship unguarded.

---

## 6. Integrations — one module each

### 6.1 `stripe_client.py`

Creates Checkout Sessions and verifies webhook signatures. Nothing else touches the SDK.

**Webhook idempotency is mandatory.** Stripe retries; a naive handler double-grants and double-emails.

```python
# order_service.fulfil_checkout(event)
#  1. INSERT event.id INTO webhook_events; on conflict → return early, already done
#  2. Load or create the order
#  3. Create the entitlement(s)  ← inside the same transaction
#  4. Commit
#  5. THEN queue the receipt email  ← after commit, never inside the transaction
#  6. Write the audit row
```

Steps 3 and 4 in one transaction is what prevents the "paid but no access" state that DESIGN §29.4 designs a recovery UI for. The UI handles the delay; the backend must not create the permanent version of it.

### 6.2 `mux_client.py`

Signed JWT playback tokens, 20-minute expiry (RS 6.5). Tokens are scoped to one playback ID — a token for lesson A must be rejected for lesson B, which is a gating test (DESIGN §58.2, #6). Also owns upload tickets and caption status for admin.

### 6.3 `r2_client.py`

Presigned GETs with a 60-second TTL (RS 6.6). One URL per request; never stored, never logged, never returned in a list response. Admin uploads go through presigned PUTs so files never transit the API process.

### 6.4 `resend_client.py`

Sends pre-rendered HTML plus its plain-text alternative. Rendering is `email_service`'s job (Jinja2, per RS 6.7 — React Email cannot render in a Python process, which is why `app/emails/` holds `.html` and not `.tsx`).

### 6.5 `posthog_client.py`

Server-side events only for the ones the client cannot be trusted to report: `purchase_completed`, `entitlement_delay`, `download_failed`, `refund_issued`. Client-side events stay client-side (DESIGN §48).

---

## 7. Question discovery — the one performance-sensitive path

### 7.1 Two endpoints, deliberately

```
GET /sections/{slug}/questions/index   → the whole published index, cacheable, ~40 KB
GET /questions?<filters>               → server-side filtered + scored, authoritative
```

The index exists because DESIGN §19.6 requires a result count that updates on every filter tap without a round trip. It carries `id, slug, title, preview, domain, and the seven tags` — and structurally cannot carry `body`, because `QuestionIndexOut` has no such field (§1.2).

The filtered endpoint is the authority and the thing analytics measures. Both must produce the same partition, which is why §7.3 exists.

### 7.2 The query

Indexed columns, `WHERE` clauses, no full-text search for tag filtering (RS 3.2). Composite index on `(section_id, published, domain_id)` plus single-column indexes on the five ordinal tags. `tier` and `leadership_traits` are arrays — GIN indexes.

Keyword search filters on `title` and `preview` before scoring, never as a scored dimension (DESIGN §57.4).

### 7.3 Scoring parity

`services/question_service.py` implements the same scoring rules as `src/lib/scoring.ts` (DESIGN §57): exact = 2 points, adjacent = 1, beyond = 0, and **a question is exact only when every active constraint matched exactly** — the bug corrected in DESIGN §57.2.

Two implementations of one rule will drift. Two defences:

1. A shared fixture file — `tests/fixtures/scoring_cases.json` — consumed by both the Python and the Vitest suites. Same inputs, same expected partition, both languages.
2. The API returns `exact_count`, `close_count` and a `misses` array. The client renders those rather than recomputing for display; it recomputes only for the instant pre-response count.

If a third consumer ever appears, delete the client implementation and accept the round trip. Two is the limit.

---

## 8. Data model notes

The conceptual model is RS Appendix C. Four structural points that belong here:

**Tag values are rows, not enums.** `tag_values(dimension, value, label, position, section_id)`. The owner still owns these lists (RS 12.2) and a change must not require a deploy. The five ordinal scales used by scoring live on the row as `ordinal_rank`, so §7.3's arithmetic reads its scale from the database.

**Price lives on `products`, never on content** (RS 10.1). A price change must never touch a course row.

**`product_contents` is a join table**, so one product can grant a course, three templates and a domain of questions — and a bundle needs no new mechanism (RS 5.6).

**Publishing state is a column with a transition service**, not a boolean. `draft | in_review | published | archived`, and `publishing_service` is the only writer. Draft content must 404 on a public route, not render a preview (DESIGN §58.2, #8).

### 8.1 Migrations

Alembic, one migration per change, autogenerate reviewed by hand every time — autogenerate misses constraint and index changes and happily drops columns. Migrations run on deploy as a Render pre-deploy command, never at app start (two instances racing the same migration is a bad afternoon).

---

## 9. Errors, and the shape the frontend expects

One error shape, everywhere. `DESIGN.md` §40.3 renders these, so the contract matters:

```json
{
  "error": {
    "code": "not_entitled",
    "message": "This lesson is part of a course you don't have yet.",
    "detail": { "product_id": "…", "product_slug": "third-party-risk-foundations" }
  }
}
```

| Code | Status | Frontend behaviour |
|---|---|---|
| `unauthenticated` | 401 | Session bar, preserve state (DESIGN §45.3) |
| `not_entitled` | 403 | Paywall with the named product (§40.5) |
| `not_found` | 404 | Not-found route |
| `validation_error` | 422 | Inline field errors (§38.1) |
| `rate_limited` | 429 | Retry message with the retry-after |
| `payment_incomplete` | 402 | Checkout failure state (§29.3) |
| `internal_error` | 500 | Generic error state, no detail leaked |

`message` is user-facing prose and is written to DESIGN §6's voice rules. `code` is what the client branches on. The client never parses `message`.

---

## 10. Configuration and secrets

`core/config.py` is the only module that reads the environment. Everything else takes `settings` by import.

```
DATABASE_URL
SUPABASE_URL  SUPABASE_JWT_AUDIENCE  SUPABASE_SERVICE_ROLE_KEY
STRIPE_SECRET_KEY  STRIPE_WEBHOOK_SECRET
MUX_TOKEN_ID  MUX_TOKEN_SECRET  MUX_SIGNING_KEY_ID  MUX_SIGNING_PRIVATE_KEY
R2_ACCOUNT_ID  R2_ACCESS_KEY_ID  R2_SECRET_ACCESS_KEY  R2_BUCKET
RESEND_API_KEY  EMAIL_FROM  EMAIL_REPLY_TO
POSTHOG_API_KEY  POSTHOG_HOST
CORS_ORIGINS         # exact frontend origins — RS 6.9's silent failure mode
FRONTEND_BASE_URL    # for checkout redirects and email links
ENVIRONMENT          # local | preview | production
```

**Every one of these belongs only here.** None of them may appear in a `VITE_` variable — that compiles the secret into the public bundle (DESIGN §56.3). This is the single most likely way a build of this shape leaks.

### 10.1 CORS

Two hosts means CORS, and a wrong origin fails in a way that looks exactly like a dead API (RS 6.9). `CORS_ORIGINS` is an explicit list — the deployed frontend origin plus `http://localhost:5173`. Never `["*"]` on a service that reads an `Authorization` header.

---

## 11. Testing

### 11.1 The gating suite

`tests/gating/test_gating.py` implements the ten cases in DESIGN §58.2 against the real app with a real database. Written in **Week 2**, not Week 4 — "access control discovered to be wrong in week four invalidates everything built on top of it" (brief).

The two that catch the subtlest bugs:

- Assert the serialised body of every index and preview response contains no `body` key, by inspecting the JSON — not by trusting the response model.
- Replay a Stripe webhook three times and assert exactly one entitlement, one order and one email.

### 11.2 Everything else

Unit tests on scoring, entitlement resolution and progress calculation, because they are pure functions carrying product-critical rules. Integration tests on the checkout flow and the publishing transitions. No pursuit of a coverage number in four weeks — test what is expensive and silent when it fails.

---

## 12. Frontend ↔ backend map

Each frontend API module in DESIGN §52 has exactly one backend counterpart. If a new frontend module needs three backend routers, one of them is in the wrong place.

| `src/lib/api/*.ts` | `app/api/v1/*` | Service |
|---|---|---|
| `questions.ts` | `public/questions.py` | `question_service` |
| `courses.ts` | `public/courses.py`, `member/library.py` | `catalog_service` |
| `lessons.ts` | `member/lessons.py`, `member/playback.py` | `catalog_service`, `media_service` |
| `templates.ts` | `public/templates.py`, `member/downloads.py` | `catalog_service`, `download_service` |
| `auth.ts` | `member/me.py` | — (Supabase owns sign-in) |
| `payments.ts` | `commerce/checkout.py`, `commerce/orders.py` | `order_service` |
| `entitlements.ts` | `member/entitlements.py` | `entitlement_service` |
| `admin.ts` | `admin/*` | various |

Note what is absent: there is no `auth` service. Sign-up, sign-in, password reset and session refresh are Supabase's, called directly from the browser (RS 6.3). FastAPI only ever *verifies* the resulting token. Building a login endpoint here would be reimplementing solved infrastructure with real accounts attached — precisely what the brief's "custom build does not mean build everything" rules out.

---

## 13. Deployment

Render (Starter, ~$7/month — the free tier's cold start breaks live checkout, RS 6.9). One web service, one pre-deploy migration step.

```yaml
# render.yaml
services:
  - type: web
    name: ditd-api
    env: python
    plan: starter
    buildCommand: pip install -e .
    preDeployCommand: alembic upgrade head
    startCommand: uvicorn app.main:app --host 0.0.0.0 --port $PORT
    healthCheckPath: /health
```

`/health` checks the database connection, not just that the process is alive.

---

## 14. Build order

Mirrors the four weeks in DESIGN §60 and the brief's slice ordering.

**Week 1 — the slice.** `core/` in full (config, security, deps, entitlements, errors). Models and the first migration. `public/questions.py` with the index endpoint. `commerce/checkout.py` + `webhooks.py`. `member/playback.py` and `member/downloads.py`. `email_service` with the receipt. One product, one course, one lesson, one template, end to end.

**Week 2 — gating.** Entitlement resolution complete across all product types. The gating test suite, passing. Progress. Full question filtering and scoring with parity fixtures. Content load begins.

**Week 3 — commerce and admin.** Multiple products, bundles via `product_contents`, pricing. All five emails. The admin routers and the media upload path. Order reconciliation and the manual grant.

**Week 4 — hardening.** Rate limits. Audit coverage. Orphan check script. Error message pass against DESIGN §6. Load the remaining content. Write down what was skipped.

---

## 15. Open decisions this backend is waiting on

Carried from DESIGN §64 — these block schema, not styling, so they are the more urgent half.

| Decision | Blocks |
|---|---|
| The five domain names, exactly | First migration |
| Authoritative values for all seven tags | `tag_values` seed, and the ordinal ranks scoring depends on |
| Contracting entity name and address | Receipt template; Stripe account; launch |
| Currency | `products.currency`, Stripe price objects |
| Which domain is free | `lead_service`'s grant target |
| Guest checkout or account-required | Whether `orders.user_id` is nullable — a schema question, so it must be answered in week one |
| Tax treatment | Stripe Tax configuration and the receipt line |
| Template licence position | Terms, and whether downloads need per-user watermarking |

---

*End of specification. Version 1.0.*
