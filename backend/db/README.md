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
| `005_seed_media_and_template.sql` | The real Mux asset + the real template file in Supabase Storage |
| `006_seed_product.sql` | The first Stripe product. **Superseded in part by 012** — the three `lesson` rows it adds here are deleted there. |
| `007_seed_course_module2_and_free_preview.sql` | Module 2 + its two lessons |
| `008_seed_reading_lesson_body.sql` | The reading lesson's body copy |
| `009_seed_module_question_link.sql` | `module_questions` link rows |
| `010_seed_module2_product_contents.sql` | Linked module 2's lessons to a product. **Also superseded by 012.** |
| `011_seed_100_questions.py` | The real 100-question catalogue (Python, not SQL — reads `docs/questions/questions.json`) |
| `012_split_template_and_course_products.sql` | Splits the one bundled product into template (A$29) + course (A$49) so a template purchase no longer grants the course; grandfathers existing buyers. See `docs/pricing.md` §2. |
| `013_seed_paid_vendor_risk_template.sql` | The paid template (Vendor Risk Assessment Scorecard, A$39) — restores the brief's "one template behind a paywall" after the risk register became the free lead magnet. Uses a file already in Storage. |

### Gotcha: running a multi-statement `.sql` seed from Python

`asyncpg` (what this app's engine uses) sends everything through a prepared
statement, and Postgres rejects multiple commands in one of those — you get
`cannot insert multiple commands into a prepared statement`. Feeding a whole seed
file to `session.execute(text(...))` therefore fails even when the SQL is valid.
Either run these through `psql`, or split on `;` and execute statement by statement:

```powershell
.venv\Scripts\python.exe -c "
import asyncio
from sqlalchemy import text
from app.db.session import engine
raw = open('db/seed/012_split_template_and_course_products.sql', encoding='utf-8').read()
body = '\n'.join(l for l in raw.splitlines() if not l.strip().startswith('--'))
stmts = [s.strip() for s in body.split(';') if s.strip()]
async def main():
    async with engine.begin() as c:
        for s in stmts: print((await c.execute(text(s))).rowcount)
asyncio.run(main())
"
```

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

Everything listed here as "not seeded" has since been seeded (005–013). A second
template now exists too (013, paid). What is genuinely absent is *content*, not rows:
a second course, and any bundle/domain-pack product — neither exists to sell yet.
`docs/pricing.md` §3 holds the target catalogue and the standing rule that nothing
gets a price before real content sits behind it.

Five further vendor-risk artefacts sit unused in Storage (uploaded 2026-08-10) and
are the obvious source for the next templates — see `013`'s header.

The one known data gap: 99 of the 100 questions carry a machine-derived `preview`
rather than a hand-written one (`docs/handover.md`) — editorial work, not a migration.
