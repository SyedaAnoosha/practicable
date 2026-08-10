# Database Migrations and Seed Data

See `docs/RUNNING.md` §3 for the full step-by-step (setup, running, inspecting,
resetting). This file is the quick reference for what's in `db/seed/`.

## Running migrations + seeds

```powershell
cd backend
.venv\Scripts\Activate.ps1
alembic upgrade head
```

Then run the seed files in `db/seed/`, in numeric order — they're plain SQL, not
Alembic migrations, and are idempotent (safe to re-run). `docs/RUNNING.md` §3.2 has
the exact command.

**Do not** copy `upgrade()` SQL by hand into Supabase Studio — `alembic upgrade head`
against `DATABASE_URL` is the only path that keeps Alembic's revision tracking
accurate. A migration applied outside Alembic makes `alembic current` lie about what
schema state the database is actually in.

## Seed files

| File | Seeds |
|---|---|
| `001_seed_domains_and_tags.sql` | 5 domains, 26 `tag_values` rows (7 dimensions) — week1_plan.md decisions #2/#3 |
| `002_enable_rls.sql` | RLS policies on `users`, `orders`, `order_items`, `entitlements`, `lesson_progress`, `course_progress` |
| `003_seed_q001_question.sql` | The one real question (decision #6), FKs resolved by subquery against 001's rows |
| `004_seed_course_skeleton.sql` | section → author → course → module → lesson skeleton for the one real lesson |

## Verifying

```powershell
python -c "
import psycopg2, os
from dotenv import load_dotenv
load_dotenv()
conn = psycopg2.connect(os.environ['DATABASE_URL'])
cur = conn.cursor()
cur.execute(\"SELECT count(*) FROM domains;\"); print('domains:', cur.fetchone()[0])       # expect 5
cur.execute(\"SELECT count(*) FROM tag_values;\"); print('tag_values:', cur.fetchone()[0])   # expect 26
cur.execute(\"SELECT slug, published FROM questions;\"); print(cur.fetchall())
"
```

RLS status: Supabase Studio → Authentication → Policies, or query
`pg_tables.rowsecurity` for the six tables listed above.

## Not seeded yet

`media` (the real Mux asset), `templates` (the real file in Supabase Storage), and
`products`/`product_contents` (the Stripe product + what it unlocks) — these need the
real video, template file, and price before they mean anything. See
`docs/week1_plan.md` Phase 3/4.
