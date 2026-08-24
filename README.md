# Deciding in the Dark — Platform

**Practicable** is a standalone learning-and-commerce platform built around *Deciding in the Dark*: 100 real risk-management questions from practising risk leaders, each tagged across seven dimensions (effort, duration, cost, payback, tier, regulator pressure, leadership traits). It's a structured, filterable dataset presented as a full learning product — video courses, downloadable templates, and paid access — not just a book on a page.

The platform is built to extend past the book: new sections, authors, and subjects can be added through the content model and admin interface without a rewrite.

![License](https://img.shields.io/badge/license-MIT-blue.svg) ![Backend](https://img.shields.io/badge/backend-FastAPI-009688.svg) ![Frontend](https://img.shields.io/badge/frontend-React%2019%20%2B%20Vite-646CFF.svg) ![Database](https://img.shields.io/badge/database-Postgres%20(Supabase)-3ECF8E.svg) ![Payments](https://img.shields.io/badge/payments-Stripe-635BFF.svg)

## Table of Contents

- [Project Overview](#project-overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Usage](#usage)
- [API Reference](#api-reference)
- [Configuration](#configuration)
- [Testing](#testing)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

## Project Overview

Risk practitioners today get *Deciding in the Dark*'s guidance as static content with no way to act on it or pay for more depth. This platform turns the book's 100 tagged questions into a real product:

- A visitor can filter questions by what they can actually fix — e.g. "cheap, two weeks, my regulator cares about this" — and get an answer, not a search result.
- Paid templates and paid video courses sit behind real access control: authentication, entitlement checks, and signed video playback, not files in a public bucket.
- A non-technical admin can add a course, lesson, or template and publish it without touching code.

The system is deliberately built for two audiences: buyers who browse, sign up, purchase, and learn, and an internal admin who manages the catalogue, orders, and content behind it.

## Features

**Learning**
- Courses broken into modules and lessons, with multiple lesson types (video, reading, downloadable artefact)
- Signed, access-controlled video playback via Mux — no public file URLs
- Progress tracking and resume, plus completion certificates (PDF)
- Lesson notes and bookmarks per learner

**Commerce**
- Hosted checkout via Stripe — card data never touches this application
- Multiple product types: paid templates, course access, and bundled "packs"
- Idempotent webhook handling that grants entitlements and survives duplicate/replayed events
- Promotions/discount codes, and a free entry point designed to capture an email address
- Reconcilable purchase records (who bought what, when, for how much) and a refund flow

**Content & discovery**
- The 100 questions from the book, each tagged across seven dimensions, filterable and searchable
- Domain "packs" — curated reading views grouped by risk domain
- Reviews on courses/templates
- Full-text search across content (Postgres search vectors)

**Access control**
- Supabase Auth-backed JWT authentication end to end
- Entitlement checks fail closed: no token → 401, valid token without purchase → 403
- Rate-limited signed download/streaming links, with download-event auditing

**Admin**
- Non-technical CMS-style admin: courses, lessons, templates, products, packs, promotions, users, orders, reviews, contact/lead capture, and platform settings
- Audit logging for admin actions and an admin metrics view

**Marketing & platform**
- Public marketing pages, legal pages (terms, privacy, refund position), and a lead-capture contact flow
- Transactional email (order receipts, access emails, owner sale notifications) via Mailjet
- Accessibility and performance checks wired into CI (axe-core, Lighthouse)

## Tech Stack

**Frontend** — [frontend/package.json](frontend/package.json)
- React 19 + TypeScript, built with Vite
- Tailwind CSS 4
- React Router 8, TanStack Query, Zustand
- React Hook Form + Zod for forms/validation
- Tiptap (rich text), Recharts (charts), Mux Player, Splide (carousels), Framer Motion
- Testing: Vitest + Testing Library, Playwright (E2E), axe-core (a11y), Lighthouse CI

**Backend** — [backend/requirements.txt](backend/requirements.txt)
- FastAPI (Python) + Uvicorn
- SQLAlchemy 2.0 (async, via asyncpg) + Alembic migrations
- Pydantic v2 / pydantic-settings
- PostgreSQL via Supabase, with Supabase Auth (JWT) and Supabase Storage (S3-compatible)
- Stripe (checkout + webhooks), Mux (video), Mailjet (transactional email)
- python-docx, openpyxl, pypdf/pypdfium2, Pillow — document/template generation and preview rendering

**Infrastructure**
- Backend deploys to Render ([backend/render.yaml](backend/render.yaml))
- Frontend deploys to Vercel ([frontend/vercel.json](frontend/vercel.json))
- Database migrations and RLS policies managed through Alembic + SQL seed files

## Project Structure

```
.
├── backend/                 # FastAPI application
│   ├── app/
│   │   ├── api/v1/          # Routes: content, commerce, admin, auth, me, leads...
│   │   ├── core/            # Config, security/auth dependencies
│   │   ├── db/              # SQLAlchemy models/session
│   │   ├── emails/          # Transactional email templates
│   │   ├── integrations/    # Stripe, Mux, Supabase Storage clients
│   │   └── services/        # Orders, certificates, refunds, audit, etc.
│   ├── alembic/              # DB migrations
│   ├── db/seed/               # Idempotent SQL seed files
│   ├── scripts/              # One-off maintenance/generation scripts
│   ├── tests/                 # Pytest suite
│   └── main.py                # App entry point (CORS, router mounting)
├── frontend/                 # React + Vite application
│   ├── src/
│   │   ├── pages/            # Route-level pages (incl. admin, account, legal)
│   │   ├── components/       # UI, marketing, pricing, cart, admin components
│   │   ├── routes/            # Router configuration/layouts
│   │   ├── lib/                # API client, auth, query setup, utils
│   │   └── stores/             # Zustand stores
│   └── tests/                 # Playwright E2E tests
└── docs/                      # Handover pack, design system, backend spec, engineering notes
```

## Installation

### Prerequisites

| Tool | Version |
|---|---|
| Python | 3.12 |
| Node.js | 20+ |
| Git | any recent |
| Stripe CLI | latest (only needed for local webhook testing) |

You'll also need a Supabase project (Postgres + Auth + Storage), a Stripe account, a Mux account, and a Mailjet account — credentials for each go into the env files below.

### 1. Clone the repository

```bash
git clone <repository-url>
cd Deciding-In-The-Dark-Platform
```

### 2. Backend setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1        # Windows PowerShell
# source .venv/bin/activate       # macOS/Linux
pip install -r requirements.txt
copy .env.example .env            # cp .env.example .env on macOS/Linux
```

Fill in `backend/.env` — see [Configuration](#configuration) below for the required variables.

Apply database migrations and seed data:

```bash
alembic upgrade head
```

### 3. Frontend setup

```bash
cd frontend
npm install
copy .env.local.example .env.local   # cp .env.local.example .env.local on macOS/Linux
```

Fill in `frontend/.env.local` (Supabase URL/anon key, API base URL).

## Usage

Run backend and frontend in separate terminals.

**Backend** (from `backend/`, with the virtualenv active):

```bash
python -m uvicorn main:app --reload --port 8000
```

- Swagger UI: [http://localhost:8000/docs](http://localhost:8000/docs)
- Health check: [http://localhost:8000/health](http://localhost:8000/health)

**Frontend** (from `frontend/`):

```bash
npm run dev
```

- App: [http://localhost:5173](http://localhost:5173)

**Production build check** (what CI/Vercel runs):

```bash
cd frontend
npx tsc -b
npm run build
npm run lint
```

## API Reference

The backend exposes a versioned REST API under `/`, documented interactively via Swagger at `/docs` once running locally. Route groups (see [backend/app/api/v1/](backend/app/api/v1/)):

| Group | Example | Description |
|---|---|---|
| Content | `GET /questions/{slug}` | Questions, lessons, templates, courses, packs, search |
| Commerce | `POST /checkout/*`, `POST /webhooks/stripe` | Hosted checkout sessions and Stripe webhook handling |
| Auth/User | `GET /me` | Current user, protected via Supabase JWT |
| Admin | `/admin/*` | Courses, products, orders, users, promotions, metrics (auth-gated) |

Example — health check:

```http
GET /health
```

Example — a gated download requires a valid bearer token and an active entitlement:

```http
GET /templates/{template_id}/download-url
Authorization: Bearer <supabase_jwt>
```

| Response | Meaning |
|---|---|
| `200` | Signed, time-limited download URL returned |
| `401` | Missing or invalid token |
| `403` | Valid token, but the user has no entitlement (`not_entitled`) |

## Configuration

### Backend (`backend/.env`)

See [backend/.env.example](backend/.env.example) for the full annotated list. Key variables:

```env
DATABASE_URL=postgresql://...supabase pooler, port 5432 (Session mode)...
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
MUX_TOKEN_ID=
MUX_TOKEN_SECRET=
SUPABASE_STORAGE_S3_ENDPOINT=
MAILJET_API_KEY=
MAILJET_SECRET_KEY=
MAILJET_SENDER_EMAIL=
ALLOWED_ORIGIN=http://localhost:5173
```

> `DATABASE_URL` must use Supabase's pooler on **port 5432 (Session mode)** — Transaction mode (6543) breaks asyncpg's prepared statements for this persistent server.

### Frontend (`frontend/.env.local`)

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_API_BASE_URL=http://localhost:8000
```

## Testing

**Backend:**

```bash
cd backend
pytest
```

**Frontend (unit/component):**

```bash
cd frontend
npm run test         # vitest run
npm run test:watch
```

**Frontend (end-to-end):**

```bash
cd frontend
npm run e2e           # Playwright
```

## Deployment

- **Backend → Render**, via the checked-in Blueprint at [backend/render.yaml](backend/render.yaml) (build step runs `alembic upgrade head` automatically).
- **Frontend → Vercel**, via [frontend/vercel.json](frontend/vercel.json) (SPA rewrite rule included), with Root Directory set to `frontend`.

## Contributing

This is an internal project built under a defined internship brief, but the workflow below applies to any contribution:

1. Create a feature branch off `main`: `git checkout -b feature/your-change`
2. Make your change, following the conventions already in the surrounding code
3. Run the relevant checks before opening a PR:
   ```bash
   cd backend && pytest
   cd frontend && npx tsc -b && npm run lint && npm run test
   ```
4. Commit with a clear message and open a pull request describing what changed and why

Non-negotiables carried over from the project brief: never handle raw card data (use Stripe Checkout), never serve paid video from a public URL (Mux signed playback only), and never commit real credentials, customer data, or `.env` files.

## License

This project is licensed under the MIT License — see [LICENSE](LICENSE) for details.
