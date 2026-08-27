# Practicable — Digital Product Marketplace

**Practicable** is a full-stack digital product marketplace for risk management professionals, built around *Deciding in the Dark*: 100 real risk-management questions from practising risk leaders, each tagged across seven dimensions (effort, duration, cost, payback, tier, regulator pressure, leadership traits).

It sells questions, courses, templates, and reference packs through Stripe-powered commerce, with signed video playback (Mux), certificate issuance, and a non-technical admin panel managing all content, orders, and analytics.

![License](https://img.shields.io/badge/license-MIT-blue.svg) ![Backend](https://img.shields.io/badge/backend-FastAPI%20%2B%20Python%203.12-009688.svg) ![Frontend](https://img.shields.io/badge/frontend-React%2019%20%2B%20Vite%205-646CFF.svg) ![Database](https://img.shields.io/badge/database-Postgres%2016%20(Supabase)-3ECF8E.svg) ![Payments](https://img.shields.io/badge/payments-Stripe-635BFF.svg) ![Tests](https://img.shields.io/badge/tests-1104+-brightgreen.svg)

---

## Table of Contents

- [What It Does](#what-it-does)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Running Locally](#running-locally)
- [Testing](#testing)
- [API Reference](#api-reference)
- [Configuration](#configuration)
- [Deployment](#deployment)
- [Design Principles](#design-principles)
- [Known Gaps](#known-gaps)
- [Contributing](#contributing)
- [License](#license)

---

## What It Does

Risk practitioners today get *Deciding in the Dark*'s guidance as static content with no way to act on it or pay for more depth. This platform turns the book's 100 tagged questions into a real product:

- **Visitors** can filter questions by what they can actually fix — "cheap, two weeks, my regulator cares about this" — and get an answer, not a search result.
- **Buyers** purchase templates, courses, or bundles through Stripe, get instant access to gated content, and earn PDF certificates on course completion.
- **Admins** manage the full catalogue — courses, lessons, templates, products, orders, users, promotions, reviews, assessments, and analytics — through a non-technical CMS-style admin panel.

The platform supports two audiences: buyers who browse, sign up, purchase, and learn; and an internal admin who manages the catalogue, orders, and content behind it.

---

## Features

### Learning System
- **Courses** broken into modules and lessons, with multiple lesson types (video, reading, downloadable artefact, mixed)
- **Signed video playback** via Mux — no public file URLs, entitlement-checked playback tokens
- **Per-module assessments** with single-choice and multi-choice questions, all-or-nothing scoring, configurable pass marks, and attempt limits
- **Certificate issuance** on course completion (100% lessons + passing all module assessments), with PDF generation, public verification, and revocation on refund
- **Progress tracking** with live course-level rollup, resume panel, estimated time remaining
- **Lesson notes** with autosave and per-lesson bookmarks
- **Related products** surfaced on question and course pages

### Commerce
- **Hosted checkout** via Stripe — card data never touches this application
- **Multi-item cart** with zustand-backed persistence, cart drawer, and multi-product checkout sessions
- **Multiple product types**: paid templates, course access, question packs, and bundled products
- **Bundle pricing guard** — bundles must cost less than the sum of their parts
- **Idempotent webhook handling** — `webhook_events.stripe_event_id` uniqueness constraint makes Stripe retries safe
- **Promotions** — admin-managed discount codes backed by Stripe coupons, with overlap prevention and date-window validity
- **Refund flow** — admin-initiated and self-serve, with automatic entitlement revocation
- **Pre-purchase evidence layer** — page count, sheet count, editable status, preview galleries, licence info, version stamps
- **Tax-invoice-quality receipts** with seller legal name

### Content & Discovery
- **100 questions** from the book, each tagged across seven dimensions, filterable and searchable
- **Full-text search** across courses, templates, questions, and packs (Postgres tsvectors + GIN indexes)
- **Header search palette** with debounced input, keyboard navigation, and screen-reader announcements
- **Domain packs** — curated reading views grouped by risk domain
- **Reviews** — entitlement-gated submissions, auto-approved on submission, admin moderation, featured testimonials, aggregate rating (hidden below 8 reviews)
- **Homepage finder** — working question finder with tag-matched quick-filter chips, live result counts
- **Featured questions** — admin-controlled editorial curation of landing page content
- **Question-to-product routing** — related products on question detail pages, situation-based recommendations

### Access Control
- **Supabase Auth** backed JWT authentication end-to-end (ES256/JWKS verification)
- **Entitlement-based gating** — buying a product grants access to all linked content; the gate checks entitlements, revoked state, and user deactivation in one query
- **Fail-closed by design** — no token → 401, valid token without purchase → 403, unpublished content → 404 (never reveals slug existence)
- **Admin bypass with audit trail** — admins can access gated content, leaving an audit record
- **Bulk entitlement resolution** — fixed query count regardless of catalogue size (no N+1)
- **Course-grants-lessons rule** — lessons added after purchase are automatically granted to existing buyers

### Notifications
- **In-app notification bell** with unread count badge, dropdown panel, and polling (60s interval)
- **Toast system** — real-time pop-up alerts for new notifications
- **Notification sound** — two-tone chime via Web Audio API (toggleable)
- **Email notifications** — certificate issued, course updated, product purchased, system announcements
- **Notification preferences** — email marketing/product updates toggles, sound preference

### Admin Panel (17 pages)
| Page | What it manages |
|------|----------------|
| Questions | Create, edit, feature, and publish practice questions |
| Courses | Full course CRUD with modules, lessons, blocks, video attachment |
| Templates | Document template management with file upload and evidence fields |
| Packs | Reference pack curation |
| Assessments | Quiz authoring per module with publish validation |
| Products | Product CRUD with pricing, evidence fields, Stripe sync |
| Orders | View orders, process refunds, manual grants, keyset pagination |
| Users | User management, role changes, deactivation |
| Metrics | Revenue charts, order stats, user growth, funnel analytics |
| Media | Video upload + Mux status tracking |
| Promotions | Discount code management with Stripe coupon sync |
| Reviews | Review moderation, featuring, aggregate management |
| Contact | Contact form message inbox |
| Leads | Lead capture list |
| Audit | Admin action audit trail |
| Settings | Site-wide key-value settings |

### Email System
- **14 Jinja2 template pairs** (HTML + text) covering: welcome, receipt, access granted, password reset, free entry point, refund confirmation, sale notification, contact notification, certificate issued, notification, product update, security alert
- **Mailjet transport** over REST (survives Render's outbound SMTP block)
- **Best-effort delivery** — emails never block requests; failures are logged, not thrown

### Analytics & Monitoring
- **Filter events** — privacy-first tracking of question filter usage
- **Download events** — audit trail for template/course downloads
- **Recommendation events** — tracking product recommendation impressions
- **Admin metrics** — 10+ metrics endpoints returning numerator/denominator pairs

---

## Tech Stack

### Frontend — [frontend/package.json](frontend/package.json)

| Technology | Role |
|-----------|------|
| React 19 + TypeScript | UI framework with type safety |
| Vite 5 | Dev server + production build |
| React Router v8 (data mode) | Client-side routing (60+ routes) |
| TanStack React Query v5 | Server state management with cache keys |
| Zustand | Client state (auth, cart, theme, toast) |
| Tailwind CSS v4 | Styling with CSS custom properties in `theme.css` |
| Framer Motion (motion/react) | Animations |
| Axios | HTTP client with auth interceptor |
| Tiptap | Rich text editor for lesson content |
| Recharts | Admin metrics charts |
| Mux Player | Signed video playback |
| Splide | Carousel components |
| Lucide React | Icon library |

**Testing**: Vitest + Testing Library (267 unit/component tests), Playwright (235 E2E tests), axe-core (accessibility), Lighthouse CI

### Backend — [backend/requirements.txt](backend/requirements.txt)

| Technology | Role |
|-----------|------|
| Python 3.12 | Runtime |
| FastAPI | Async web framework |
| SQLAlchemy 2.0 (async) | ORM + database queries via asyncpg |
| Alembic | Database migrations (39 migrations) |
| Pydantic v2 / pydantic-settings | Request/response validation + config |
| Supabase Auth | JWT verification (ES256/JWKS) |
| Stripe SDK | Payment processing + webhooks |
| Mux Python | Video playback token signing |
| boto3 (S3-compatible) | Supabase Storage file operations |
| Jinja2 | Email template rendering |
| python-docx, openpyxl | Document processing |
| pypdf, pypdfium2 | PDF generation + preview rendering |
| Pillow | Spreadsheet preview image composition |
| bleach | HTML sanitisation |
| python-jose, PyJWT | JWT handling |

**Testing**: pytest + pytest-asyncio (602 backend tests)

### Infrastructure

| Service | Role |
|---------|------|
| PostgreSQL 16 (Supabase) | Database with asyncpg + session-mode pooling |
| Supabase Auth | Authentication (JWT, JWKS) |
| Supabase Storage | File hosting (S3-compatible) |
| Stripe | Payments + webhooks |
| Mux | Video hosting + signed playback |
| Mailjet | Transactional email (REST API) |
| Render | Backend deployment (Starter tier) |
| Vercel | Frontend deployment (SPA) |

---

## Project Structure

```
.
├── backend/                          # FastAPI application
│   ├── main.py                       # Entry point: CORS, router mounting, health check
│   ├── requirements.txt              # Python dependencies
│   ├── render.yaml                   # Render deployment blueprint
│   ├── alembic.ini                   # Alembic configuration
│   ├── alembic/
│   │   └── versions/                 # 39 migrations (001–039)
│   ├── app/
│   │   ├── api/v1/
│   │   │   ├── content/              # Public + gated: questions, lessons, courses, templates, packs, search, reviews, assessments, notes, bookmarks, verify
│   │   │   ├── commerce/             # Checkout, webhooks, products
│   │   │   ├── admin/                # 18 admin modules (router + CRUD for each entity)
│   │   │   ├── me.py                 # Profile, orders, notifications, certificates, entitlements
│   │   │   ├── auth.py               # Password reset
│   │   │   ├── contact.py            # Contact form
│   │   │   ├── leads.py              # Lead capture
│   │   │   └── filter_events.py      # Analytics event tracking
│   │   ├── core/
│   │   │   ├── config.py             # Environment-backed settings (pydantic-settings)
│   │   │   ├── deps.py               # Auth dependencies (get_current_user, require_admin)
│   │   │   ├── entitlements.py       # THE access gate — single source of truth for all access control
│   │   │   ├── security.py           # JWT verification (Supabase JWKS)
│   │   │   ├── publish_guard.py      # Content publishing rules (overlap, pricing, macros, previews)
│   │   │   └── publish_state.py      # Draft/in_review/published/archived state machine
│   │   ├── db/
│   │   │   ├── models/               # 31 SQLAlchemy models
│   │   │   ├── session.py            # Async database session (asyncpg, session-mode pooling)
│   │   │   └── base.py               # Shared mixins (timestamps, publish state, str_enum)
│   │   ├── emails/                   # 14 Jinja2 template pairs (HTML + text)
│   │   ├── integrations/
│   │   │   ├── stripe_client.py      # Payment intents, customers, invoices
│   │   │   ├── mux_client.py         # Video playback tokens (RS256)
│   │   │   └── storage_client.py     # Supabase Storage (S3-compatible)
│   │   └── services/                 # 15 service modules
│   │       ├── assessment_service.py     # Quiz scoring + certificate gate
│   │       ├── certificate_service.py    # Certificate issuance (idempotent)
│   │       ├── certificate_pdf.py        # PDF generation (A4 landscape)
│   │       ├── email_service.py          # Transactional email (Mailjet REST)
│   │       ├── notification_service.py   # In-app + email notifications
│   │       ├── order_service.py          # Purchases, refunds
│   │       ├── refund_service.py         # Entitlement revocation
│   │       ├── audit_service.py          # Admin action logging
│   │       ├── freshness_service.py      # Content freshness tracking
│   │       ├── question_service.py       # Question relation scoring
│   │       ├── stamping.py              # Watermarking downloads
│   │       ├── template_evidence.py      # Template evidence extraction
│   │       ├── download_events.py        # Download audit trail
│   │       └── link_rate_limit.py        # Rate limiting for signed links
│   ├── db/seed/                      # Idempotent SQL seed files (001–016)
│   ├── scripts/                      # Seed scripts, reconciliation, preview generation
│   └── tests/                        # 602 pytest tests
│       ├── gating/                   # Entitlement/gating attack tests
│       ├── admin/                    # Admin endpoint tests
│       └── fixtures/                 # Test data factories
│
├── frontend/                         # React + Vite application
│   ├── src/
│   │   ├── App.tsx                   # Route tree (60+ routes, lazy-loaded)
│   │   ├── main.tsx                  # React root (ToastProvider, MotionConfig)
│   │   ├── pages/                    # 57 route pages
│   │   │   ├── admin/                # 17 admin pages + LessonWriteScreen
│   │   │   ├── account/              # Profile, security, purchases, notifications, data privacy
│   │   │   └── legal/                # Terms, privacy, refunds
│   │   ├── components/
│   │   │   ├── ui/                   # 42 reusable primitives (Button, Card, Badge, Toast, etc.)
│   │   │   ├── layout/               # AppHeader (sticky, with cart/notifications/theme/account menu)
│   │   │   ├── notifications/        # NotificationBell with dropdown + sound + toast triggers
│   │   │   ├── cart/                 # Shopping cart UI (CartButton, CartDrawer)
│   │   │   ├── content/              # Course cards, question cards, content display
│   │   │   ├── admin/                # Admin-specific (AutosaveIndicator, RefundDialog, etc.)
│   │   │   ├── marketing/            # Marketing-specific components
│   │   │   ├── nav/                  # Navigation components
│   │   │   ├── pricing/              # Pricing-related components
│   │   │   ├── product/              # Product display components
│   │   │   ├── purchases/            # Purchase-related components
│   │   │   └── store/                # Storefront components
│   │   ├── hooks/                    # useActivePromotion, useBookmarks, useCertificates, useNotes, useFeaturedReviews, useAdminPlaybackToken
│   │   ├── stores/                   # useAuthStore, useCartStore, useThemeStore, useToastStore
│   │   ├── lib/
│   │   │   ├── api/client.ts         # Axios instance with auth interceptor
│   │   │   ├── auth/supabase.ts      # Supabase client
│   │   │   ├── query/keys.ts         # React Query cache key factory
│   │   │   ├── tags.ts               # Tag dimension definitions
│   │   │   ├── scoring.ts            # Assessment scoring logic
│   │   │   ├── labels.ts             # Shared UI strings (refund position, tax statement)
│   │   │   └── utils/                # cn, downloadCertificate, etc.
│   │   ├── routes/_layouts/          # 6 layout shells (Root, Marketing, Catalogue, Auth, Member, Admin)
│   │   ├── styles/theme.css          # Global styles, animations, design tokens
│   │   └── types/                    # TypeScript type definitions
│   ├── tests/e2e/                    # 235 Playwright E2E tests across 12 spec files
│   ├── vitest.config.ts              # Vitest configuration
│   ├── playwright.config.ts          # Playwright configuration
│   └── vercel.json                   # Vercel SPA rewrite rules
│
├── docs/                             # Documentation
│   ├── handover.md                   # Comprehensive handover pack (architecture, decisions, gaps)
│   ├── RUNNING.md                    # How to run/deploy locally and in production
│   ├── DESIGN.md                     # Design system, tokens, component grammar
│   ├── BACKEND.md                    # Backend spec and conventions
│   ├── ENGINEERING_NOTES.md          # Engineering decisions, index evidence, comparison tables
│   ├── REDESIGN.md                   # Redesign specifications
│   ├── week5_report.md              # Week 5 verification report and close-out
│   ├── Deciding_in_the_Dark_Platform_Intern_Brief.md  # Original internship brief
│   └── questions/                    # Question data and parsing scripts
│       ├── questions.json            # 100 questions dataset
│       ├── Deciding_in_the_Dark_100_Questions.md  # Questions documentation
│       └── parse_questions.py        # Question parsing script
│
└── LICENSE                           # MIT License
```

---

## Getting Started

### Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Python | 3.12+ | Backend runtime |
| Node.js | 20+ | Frontend build/dev |
| Git | any recent | Version control |
| Stripe CLI | latest | Local webhook testing (optional) |

You also need accounts and API keys for:
- **Supabase** — Postgres database, Auth, and Storage
- **Stripe** — Payment processing (test keys for development)
- **Mux** — Video hosting (optional, for video lessons)
- **Mailjet** — Transactional email (free tier: 6,000/month)

### 1. Clone the repository

```bash
git clone <repository-url>
cd Deciding-In-The-Dark-Platform
```

### 2. Backend setup

```bash
cd backend
python -m venv .venv

# Activate virtualenv
# Windows (PowerShell):
.venv\Scripts\Activate.ps1
# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
copy .env.example .env    # cp .env.example .env on macOS/Linux
```

Fill in `backend/.env` — see [Configuration](#configuration) for the required variables.

Apply database migrations:

```bash
alembic upgrade head
```

### 3. Frontend setup

```bash
cd frontend
npm install
copy .env.local.example .env.local    # cp .env.local.example .env.local on macOS/Linux
```

Fill in `frontend/.env.local` with your Supabase URL, anon key, and API base URL.

---

## Running Locally

Run backend and frontend in **separate terminals**.

**Terminal 1 — Backend** (from `backend/`, virtualenv active):

```bash
python -m uvicorn main:app --reload --port 8000
```

- Swagger UI: [http://localhost:8000/docs](http://localhost:8000/docs)
- Health check: [http://localhost:8000/health](http://localhost:8000/health) → `{"status":"healthy"}`

**Terminal 2 — Frontend** (from `frontend/`):

```bash
npm run dev
```

- App: [http://localhost:5173](http://localhost:5173)

**Webhook testing** (optional, requires Stripe CLI):

```bash
# Terminal 3:
stripe listen --forward-to localhost:8000/webhooks/stripe

# Terminal 4:
stripe trigger checkout.session.completed
```

### Common Commands

| Task | Command |
|------|---------|
| Start backend | `cd backend && python -m uvicorn main:app --reload` |
| Start frontend | `cd frontend && npm run dev` |
| Run all backend tests | `cd backend && python -m pytest tests/ -x` |
| Run specific test file | `cd backend && python -m pytest tests/test_assessments.py -v` |
| Run frontend type check | `cd frontend && npx tsc --noEmit` |
| Run frontend unit tests | `cd frontend && npm run test` |
| Run frontend e2e tests | `cd frontend && npx playwright test` |
| Build for production | `cd frontend && npx vite build` |
| Run migrations | `cd backend && alembic upgrade head` |
| Create new migration | `cd backend && alembic revision --autogenerate -m "description"` |
| Seed assessments | `cd backend && python -m scripts.seed_assessments` |

---

## Testing

### Backend — 602 tests (pytest)

```bash
cd backend
python -m pytest tests/ -x              # Full suite
python -m pytest tests/test_certificates.py -v   # Specific file
python -m pytest -k "gating" -v         # By keyword
```

| Test category | Coverage |
|---------------|----------|
| `tests/gating/` | Entitlement attacks, cross-content access, bulk resolution |
| `tests/test_assessments.py` | Quiz scoring, attempt limits, certificate gate |
| `tests/test_certificates.py` | Issuance, idempotency, snapshots, revocation |
| `tests/test_certificate_pdf.py` | PDF generation, cache, failure resilience |
| `tests/test_money.py` | Checkout, webhooks, refund flows |
| `tests/test_promotions.py` | Discount codes, Stripe sync, overlap prevention |
| `tests/test_reviews.py` | Submission, moderation, aggregates, threshold gate |
| `tests/test_search.py` | Full-text search, unpublished filtering |
| `tests/test_notes_bookmarks.py` | Notes CRUD, bookmarks CRUD |
| `tests/test_endpoints_commit.py` | Verifies every mutation actually commits |
| `tests/test_taxonomy_parity.py` | Frontend taxonomy matches database values |
| `tests/test_routing_query_count.py` | Verifies fixed query count per endpoint |
| `tests/admin/` | Admin endpoint tests, publish guards, user management |

Tests run against the real dev database with isolated transactions (rolled back after each test). Auth uses synthetic JWTs — no Supabase round-trip needed.

### Frontend — 267 unit tests (Vitest) + 235 E2E tests (Playwright)

```bash
cd frontend
npm run test                    # Unit/component tests
npx playwright test             # E2E tests (requires backend running)
npx playwright test tests/e2e/accessibility.spec.ts   # Accessibility only
```

| Test file | Coverage |
|-----------|----------|
| `e2e/accessibility.spec.ts` | WCAG compliance, heading hierarchy, focus management, both themes |
| `e2e/responsive-widths.spec.ts` | 7 viewport widths × 6 routes = 42 layout checks |
| `e2e/stress-fixtures.spec.ts` | Synthetic extreme content at 375px floor |
| `e2e/gating.spec.ts` | End-to-end entitlement enforcement |
| `e2e/notification-bell.spec.ts` | Bell rendering, dropdown, polling |
| `e2e/notification-page.spec.ts` | Notification page routing and display |
| `e2e/search-keyboard.spec.ts` | Search palette keyboard navigation |
| `e2e/screen-overview.spec.ts` | Visual regression baseline |
| `e2e/a11y-manual-checks.spec.ts` | Manual accessibility checks |
| `e2e/rail-contrast.spec.ts` | Continue-rail contrast verification |
| `e2e/lesson-prose-roundtrip.spec.ts` | Lesson content rendering fidelity |
| `e2e/admin-screen-overview.spec.ts` | Admin page rendering |

---

## API Reference

The backend exposes a versioned REST API documented interactively via Swagger at `/docs` once running locally.

### Route Groups

| Prefix | Purpose | Auth |
|--------|---------|------|
| `/questions/*` | Public question catalogue and detail | Optional (body always returns; `gated` field shows upsell) |
| `/courses/*` | Course catalogue, syllabus, learning interface | Optional for public; gated for member content |
| `/templates/*` | Template catalogue and download | Gated for downloads |
| `/packs/*` | Domain pack catalogue and detail | Optional |
| `/search` | Full-text search across all content | None |
| `/reviews/*` | Review submission and featured lists | Gated for submission |
| `/assessments/*` | Module quiz (learner-facing) | Gated |
| `/verify/{code}` | Public certificate verification | None |
| `/promotions/active` | Active promotion (for banner) | None |
| `/checkout/*` | Stripe checkout session creation | User |
| `/webhooks/stripe` | Stripe webhook handler | Stripe signature |
| `/products/*` | Product catalogue | None |
| `/me/*` | Profile, orders, notifications, certificates, notes, bookmarks | User |
| `/auth/*` | Password reset | Public |
| `/contact` | Contact form submission | None |
| `/leads` | Lead capture | None |
| `/filter-events` | Analytics event tracking | None |
| `/admin/*` | Full admin CRUD (17 modules) | Admin only |

### Access Control Responses

| Response | Meaning |
|----------|---------|
| `200` | Success — data returned |
| `401` | Missing or invalid JWT token |
| `403` | Valid token, but no entitlement (`not_entitled`) |
| `404` | Resource doesn't exist (or is unpublished — never reveals slug existence) |
| `409` | Conflict (e.g., already owned, overlap detected) |

### Error Shape

All errors follow a consistent format:

```json
{
  "error": {
    "code": "not_entitled",
    "message": "This content is part of a product you don't have yet."
  }
}
```

---

## Configuration

### Backend (`backend/.env`)

See [backend/.env.example](backend/.env.example) for the full annotated list. Key variables:

```env
# Database — MUST use port 5432 (Session mode), NOT 6543 (Transaction mode)
DATABASE_URL=postgresql+asyncpg://practicable:password@host:5432/practicable

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Mux (optional — video lessons won't work without these)
MUX_TOKEN_ID=
MUX_TOKEN_SECRET=

# Supabase Storage (S3-compatible)
SUPABASE_STORAGE_S3_ENDPOINT=
SUPABASE_STORAGE_ACCESS_KEY_ID=
SUPABASE_STORAGE_SECRET_ACCESS_KEY=
SUPABASE_STORAGE_BUCKET_NAME=

# Email (Mailjet — REST API, not SMTP)
MAILJET_API_KEY=
MAILJET_SECRET_KEY=
MAILJET_SENDER_EMAIL=
MAILJET_SENDER_NAME=Practicable

# App
ALLOWED_ORIGIN=http://localhost:5173
FRONTEND_URL=http://localhost:5173
OWNER_NOTIFICATION_EMAIL=
```

> **Critical**: `DATABASE_URL` must use Supabase's pooler on **port 5432 (Session mode)**. Transaction mode (port 6543) breaks asyncpg's prepared statements — see `app/db/session.py` for the full explanation.

### Frontend (`frontend/.env.local`)

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_BASE_URL=http://localhost:8000
```

---

## Deployment

### Backend → Render

`backend/render.yaml` is a Render Blueprint that defines the Starter-tier service, build command (`alembic upgrade head`), and health check path.

1. Render dashboard → **New → Blueprint** → connect this GitHub repo
2. Set every `sync: false` env variable from `backend/.env`
3. Deploy — first build runs migrations automatically

### Frontend → Vercel

`frontend/vercel.json` includes the SPA rewrite rule needed for client-side routing.

1. Vercel dashboard → **New Project** → import repo → Root Directory: `frontend`
2. Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL` (pointing at Render)
3. Deploy

### Post-Deploy Checklist

1. Set `ALLOWED_ORIGIN` in Render to the real Vercel URL, then redeploy
2. Configure Stripe webhook endpoint: `https://your-app.onrender.com/webhooks/stripe`
3. Verify Mailjet sender is still verified in the Mailjet dashboard
4. Run the full smoke test (§4.6 in `docs/RUNNING.md`) against production

---

## Design Principles

The platform follows a deliberate visual and architectural design documented in `docs/DESIGN.md`:

- **Private bank meets editorial publisher** — warm ivory + midnight navy + champagne gold palette, serif editorial titles on flagship content, sans-serif product UI elsewhere
- **Cards are for distinct items only** — sections, stats, and metadata sit directly on the page; cards are reserved for courses, templates, purchases, and search results
- **No glassmorphism, no looping motion** — gradients are static paint; hover lifts are 2px with no scale; progress bars animate once on mount
- **Dark mode is a first-class theme** — `--stage` / `--stage-foreground` tokens flip independently of `--primary`; theme persists to localStorage; inline script prevents flash
- **Accessibility is enforced in CI** — axe-core scans in both themes, heading hierarchy checks, keyboard navigation tests, focus-visible rings on all interactive elements
- **Tokens, not hex** — all colours come from CSS custom properties; Tailwind utilities reference tokens; components never hardcode hex values

---

## Known Gaps

Ranked by impact. All are documented in detail in `docs/handover.md` §4:

1. **Vercel Hobby commercial-use restriction** — Real Stripe payments flow through a Hobby-tier deployment whose ToS prohibits commercial use. Fix: $20/month Pro upgrade.
2. **Module-question attachments have no admin UI** — Questions can be attached to modules via DB writes, but there's no admin page for it. Everything else (courses, lessons, templates, products, assessments, orders, users, promotions, reviews) has full admin CRUD.
3. **Quick-win taxonomy nearly empty** — `duration=xs` and `effort=quick` each have only 1 question. The product's pitch ("fix in a fortnight") depends on content that doesn't exist yet. Editorial gap, not engineering.
4. **99 of 100 questions have machine-derived previews** — Half of search discoverability; needs editorial rewrite.
5. **Second course not authored** — Only one course has real lessons. The content model supports unlimited courses; editorial gap.
6. **Keyboard-purchase E2E flaky** — ~1 in 3 runs; caused by async carousel mounting affecting Tab sequence.
7. **Supabase Auth Site URL** — Needs one-time manual verification that redirect URLs point to production, not localhost.
8. **DESIGN.md §18.2 contradicts built reality** — The doc says "no hero image, no gradient" but the landing page uses a gold/navy wash. The doc needs updating to match the current art direction.
9. **Module lessons and questions are separate sort_order sequences** — Questions always render after lessons in the sidebar, regardless of `sort_order`. Would need a unified ordering model to interleave them.

---

## Contributing

This is an internal project, but the workflow applies to any contribution:

1. Create a feature branch off `main`: `git checkout -b feature/your-change`
2. Make your change, matching the conventions in the surrounding code
3. Run the relevant checks before opening a PR:

```bash
# Backend
cd backend && python -m pytest tests/ -x

# Frontend
cd frontend && npx tsc --noEmit && npm run test
```

4. Commit with a clear message and open a PR describing what changed and why

### Non-negotiables

- Never handle raw card data — use Stripe Checkout (hosted)
- Never serve paid video from a public URL — Mux signed playback only
- Never commit real credentials, customer data, or `.env` files
- Every admin mutation must call `record_audit()` before committing
- Every gated route must go through `require_entitlement()` or `has_access_to()`
- Tests must be genuinely red before green (no assumed regressions)

---

## License

This project is licensed under the MIT License — see [LICENSE](LICENSE) for details.
