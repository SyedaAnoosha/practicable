# Running the Platform Locally

Practical, copy-pasteable commands for backend, frontend, database, and testing. All
shell examples are PowerShell (this project's primary shell on Windows) — Bash
equivalents are one-line notes where the syntax actually differs.

---

## 0. Prerequisites

| Tool | Version used in this repo | Check with |
|---|---|---|
| Python | 3.12 | `python --version` |
| Node | 20+ (built with v26.4) | `node --version` |
| Git | any recent | `git --version` |
| Stripe CLI | latest | `stripe --version` (only needed for webhook testing, §4.2) |

You also need the values in `backend/.env` (already populated with real credentials —
see `docs/week1_plan.md`'s Open Decisions section for where each one comes from) and
`frontend/.env.local` (copy from `frontend/.env.local.example`).

---

## 1. Backend (FastAPI)

### 1.1 First-time setup

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

If `Activate.ps1` is blocked by execution policy, either run
`Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` first, or skip activation
and call the venv's Python directly everywhere below:
`.venv\Scripts\python.exe -m uvicorn main:app ...`.

### 1.2 Environment variables

Copy `backend/.env.example` to `backend/.env` and fill in every value — see
`docs/RUNNING.md#4-getting-credentials` below if you're missing any. `backend/.env` is
gitignored; it should never be committed.

**One thing that isn't obvious from the variable name alone:** `DATABASE_URL` must use
Supabase's pooler on **port 5432 (Session mode)**, not 6543 (Transaction mode).
Transaction-mode pooling breaks asyncpg's prepared statements for a persistent server
like this one — see the comment in `app/db/session.py` if you want the full reason.
Get the exact connection string from Supabase → Project Settings → Database →
Connection string → URI, then confirm the port is 5432.

### 1.3 Run it

```powershell
cd backend
.venv\Scripts\Activate.ps1
python -m uvicorn main:app --reload --port 8000
```

- `--reload` restarts on file changes — drop it for anything resembling a production run.
- Swagger UI: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/health` → `{"status":"healthy",...}`

**If port 8000 is already taken** (common if another process/session is also running
this repo — check with `netstat -ano | findstr :8000` before assuming it's stale),
just pick a different `--port` and update `VITE_API_BASE_URL` in
`frontend/.env.local` to match.

---

## 2. Frontend (React + Vite)

### 2.1 First-time setup

```powershell
cd frontend
npm install
copy .env.local.example .env.local
```

Fill in `frontend/.env.local`:

```
VITE_SUPABASE_URL=https://kcayjhnbxlvqsmdzqoez.supabase.co
VITE_SUPABASE_ANON_KEY=<the anon key, not the service role key — Supabase dashboard -> Project Settings -> API>
VITE_API_BASE_URL=http://localhost:8000
```

### 2.2 Run it

```powershell
cd frontend
npm run dev
```

Opens on `http://localhost:5173` by default. The backend's CORS (`main.py`) is
restricted to `ALLOWED_ORIGIN` in `backend/.env` plus `localhost:5173` — if you change
the frontend's port, add it there too or CORS will fail silently in a way that looks
like "the API is down" (the exact risk named in `week1_plan.md`'s risk watchlist).

### 2.3 Build check (what CI/Vercel will run)

```powershell
cd frontend
npx tsc -b        # type-check only, no output
npm run build     # tsc -b && vite build — production bundle to dist/
npm run lint
```

---

## 3. Database (Supabase Postgres via Alembic)

### 3.1 Apply migrations

```powershell
cd backend
.venv\Scripts\Activate.ps1
alembic upgrade head
```

This runs every migration in `backend/alembic/versions/` in order against
`DATABASE_URL`. Current head: `003` (see `alembic history` for the full chain).

Useful variants:

```powershell
alembic current          # what revision is the live DB actually on
alembic history           # the full chain, oldest to newest
alembic upgrade +1        # one step forward
alembic downgrade -1      # one step back (only if you're sure)
```

**Never hand-edit an already-applied migration file and re-run `upgrade head`** —
Alembic tracks what's applied by revision id, not by file content, so a stale
revision id makes edited-in-place changes silently invisible to the DB. Write a new
revision instead (`alembic revision -m "description"`, then hand-edit `upgrade()`/
`downgrade()` — this repo does not use `--autogenerate` unreviewed, per
`BACKEND.md` §8.1).

### 3.2 Seed data

Seed files live in `backend/db/seed/` and are plain `.sql`, run in numeric order.
They're written to be idempotent (`ON CONFLICT DO NOTHING` / `WHERE NOT EXISTS`
guards), so re-running is safe.

```powershell
cd backend
.venv\Scripts\Activate.ps1
python -c "
import psycopg2, os
from dotenv import load_dotenv
load_dotenv()
conn = psycopg2.connect(os.environ['DATABASE_URL'])
for fname in [
    'db/seed/001_seed_domains_and_tags.sql',
    'db/seed/002_enable_rls.sql',
    'db/seed/003_seed_q001_question.sql',
    'db/seed/004_seed_course_skeleton.sql',
]:
    with open(fname, encoding='utf-8') as f:
        conn.cursor().execute(f.read())
    conn.commit()
    print(f'{fname}: OK')
"
```

What each one does:

| File | What it seeds |
|---|---|
| `001_seed_domains_and_tags.sql` | The 5 domains + all 26 tag_values rows across the 7 tag dimensions (decisions #2/#3) |
| `002_enable_rls.sql` | Row-Level Security policies on `users`, `orders`, `order_items`, `entitlements`, `lesson_progress`, `course_progress` |
| `003_seed_q001_question.sql` | The one real question (decision #6), resolved against 001's domain/tag rows by subquery |
| `004_seed_course_skeleton.sql` | The section/author/course/module/lesson skeleton for the one real lesson |

**Not seeded by any of the above** (still open, per `docs/week1_plan.md` Phase 3/4):
the real Mux `media` row, the real `templates` row and its Supabase Storage upload,
and the `products`/`product_contents` rows that make the checkout flow actually sell
something. Those need real assets before they can be seeded meaningfully.

### 3.3 Inspecting the database

Supabase Studio (Table Editor / SQL Editor) at your project's dashboard URL is the
fastest way to eyeball data without writing a script. For quick one-off queries from
the terminal:

```powershell
python -c "
import psycopg2, os
from dotenv import load_dotenv
load_dotenv()
conn = psycopg2.connect(os.environ['DATABASE_URL'])
cur = conn.cursor()
cur.execute('SELECT slug, title, published FROM questions;')
for row in cur.fetchall(): print(row)
"
```

### 3.4 Resetting to empty (destructive — confirm before running)

There is no `alembic downgrade base` script prepared here on purpose — this repo's
non-negotiables treat destructive DB operations as something to confirm, not
script-and-forget. If you genuinely need a clean slate: `alembic downgrade base` drops
every table Alembic knows about, then `alembic upgrade head` + the seed step above
rebuilds it.

---

## 4. Testing

There is no automated test suite yet (no `pytest`/`vitest` configured) — Week 1's
verification is the manual smoke test in `docs/week1_plan.md` Phase 5, plus the
targeted checks below. Add automated tests as a named Week 2+ task rather than
retrofitting them under deadline pressure.

### 4.1 Backend smoke checks (curl)

With `uvicorn` running on port 8000:

```powershell
# Health
curl http://localhost:8000/health

# The one real question — should return QuestionPreviewOut (gated:true, no body)
curl http://localhost:8000/questions/we-have-a-risk-register-but-no-one-uses-it

# Unknown slug -> 404, not 500
curl -i http://localhost:8000/questions/does-not-exist

# No auth header -> 401, not 403 (week1_plan.md Phase 2 DoD)
curl -i http://localhost:8000/me

# With a real Supabase JWT (copy from the browser's network tab after signing in,
# or from supabase.auth.getSession() in the frontend console) -> 200 + your user id
curl -i http://localhost:8000/me -H "Authorization: Bearer <jwt>"
```

Interactive alternative: `http://localhost:8000/docs` (Swagger) — click "Authorize" and
paste a JWT to test protected routes without hand-building curl commands.

### 4.2 Webhook testing (Stripe CLI — do this before relying on a live test)

```powershell
stripe login
stripe listen --forward-to localhost:8000/webhooks/stripe
```

This prints a `whsec_...` secret — put it in `backend/.env` as `STRIPE_WEBHOOK_SECRET`
for local testing (it's different from, and only valid alongside, a running
`stripe listen` session — the dashboard-configured production secret is separate).
Then in a second terminal:

```powershell
stripe trigger checkout.session.completed
```

Check `webhook_events` in the DB — a row should appear with `processed = true`.
Trigger the same event again and confirm a **second row is not created** for the same
Stripe event id (week1_plan.md Phase 4 DoD: idempotency).

### 4.3 Full manual smoke test (the actual Week 1 acceptance test)

This is `docs/week1_plan.md` Phase 5's script, run against `localhost` before it's
ever run against production:

1. Open the site in a private/incognito window.
2. Navigate to the one real question's page — confirm all seven tags render.
3. Click through to the course, then the lesson — video must **not** play (logged out).
4. Sign up with a real, new email and password.
5. Return to the lesson — video **still** must not play (logged in, not entitled).
6. Navigate to the template product, click "Buy now," complete Stripe Checkout with
   `4242 4242 4242 4242`.
7. Confirm the success page's entitlement poll resolves and the receipt email arrives.
8. Return to the lesson and the download — both should now work.
9. Open a second, logged-out session; call the gated endpoints directly with no token
   and with a non-entitled account's token — both must fail closed (401 / 403).
10. Repeat on a real mobile device before calling Week 1 done.

### 4.4 Gating-break attempts (do these deliberately, not accidentally)

```powershell
# Valid JWT, but this user has no entitlement -> expect 403 with {"error":{"code":"not_entitled",...}}
curl -i http://localhost:8000/templates/<template-id>/download-url -H "Authorization: Bearer <non-entitled-jwt>"

# Tampered JWT -> expect 401
curl -i http://localhost:8000/templates/<template-id>/download-url -H "Authorization: Bearer garbage.garbage.garbage"

# No JWT at all -> expect 401
curl -i http://localhost:8000/templates/<template-id>/download-url
```

Log what you tried and the result — `week1_plan.md` Phase 5 step 5 asks for this
explicitly, not just "it seemed fine."

---

## 5. Common problems

| Symptom | Cause | Fix |
|---|---|---|
| `DuplicatePreparedStatementError` on any DB call | `DATABASE_URL` using pgbouncer port 6543 (Transaction mode) | Switch to port 5432 (Session mode) — see §1.2 |
| CORS error in the browser console | Frontend origin not in `ALLOWED_ORIGIN` | Add it to `backend/.env`'s `ALLOWED_ORIGIN`, restart uvicorn |
| `/me` returns 403 instead of 401 with no token | Shouldn't happen — `HTTPBearer(auto_error=False)` in `app/core/security.py` is what prevents this | If you see this, something regressed; check `security.py` wasn't reverted |
| `alembic upgrade head` hangs or times out | Usually still using port 6543, or a firewalled network | Same fix as the prepared-statement error above |
| First purchase fails with a foreign-key violation on `entitlements.user_id` | The local `users` row was never created for that Supabase auth user | Only happens if a route uses `get_current_user_id` (string only) where it needed `get_current_user` (get-or-create) — `checkout.py` already does this correctly |
| `npm run dev` frontend can't reach the backend | `VITE_API_BASE_URL` mismatch, or backend not running | Confirm both, and that `frontend/.env.local` isn't still pointing at a different port from a previous session |

---

## 6. Deploying to production (Phase 5)

Both config files are already in the repo — deploying is a dashboard/CLI step, not a
code-writing one, and needs accounts Claude doesn't have (week1_plan.md decision #9
never actually got answered — who owns these accounts is still open).

### 6.1 Backend → Render

`backend/render.yaml` is a Render Blueprint — every setting (Starter tier, not Free;
build command runs `alembic upgrade head` automatically; health check path) is already
defined there.

1. Render dashboard → **New → Blueprint** → connect this GitHub repo. Render reads
   `render.yaml` automatically.
2. It'll prompt for every `sync: false` env var — copy each value straight from
   `backend/.env` (never commit that file; this is the one place its values are meant
   to be pasted). Leave `ALLOWED_ORIGIN` for last — you don't have the real Vercel URL
   until step 6.2 is done.
3. Deploy. First build runs the Alembic migration against the real database — watch
   the build log for it, don't assume it succeeded silently.

### 6.2 Frontend → Vercel

`frontend/vercel.json` already has the SPA rewrite rule Vercel needs (without it,
directly loading a deep link like `/questions/some-slug` 404s — Vercel's static
hosting doesn't know react-router owns that path).

1. Vercel dashboard → **New Project** → import this repo → set **Root Directory** to
   `frontend`. Framework preset (Vite) is auto-detected.
2. Environment variables → add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (from
   `frontend/.env.local`), and `VITE_API_BASE_URL` set to the real Render URL from
   6.1 (`https://practicable-api.onrender.com`, or whatever Render assigned).
3. Deploy.

### 6.3 Close the loop

1. Back in Render, set `ALLOWED_ORIGIN` to the real Vercel URL from 6.2, and redeploy
   — until this is set, every request from the deployed frontend fails CORS (week1_plan.md's own risk watchlist names this exact failure mode: "fails silently in a way
   that looks like the API is down").
2. Stripe Dashboard → Webhooks → the `we_...` endpoint already configured
   (`https://practicable.onrender.com/webhooks/stripe` — confirm this matches your
   real Render URL, update it if Render assigned a different subdomain) → this is
   what makes production checkouts actually grant entitlements, since `stripe listen`
   was a local-only workaround.
3. Run the full smoke test (§4.3) again against the real URLs, desktop then mobile —
   this is Phase 5 step 4, and it's a different test than the local one: CORS, cold
   starts, and real DNS are all things `localhost` can't catch.
