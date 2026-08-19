# Database index evidence — Week 3 Phase 2 (W3-R9)

**Method:** the real dataset today is ~100 questions and 2 orders — at that size Postgres
correctly prefers a sequential scan regardless of what indexes exist, so a before/after
comparison run against it would show no difference and (read literally) argue for
deleting every index in this migration. That is backwards: the point of this work is to
add the index layer *before* the data that needs it exists (§24).

So every query below was measured against a **synthetic, production-shaped dataset**
built and torn down inside a single Postgres transaction, on the real project database,
via `EXPLAIN (ANALYZE, BUFFERS)` — then the whole transaction was **rolled back**.
Nothing synthetic was committed; verified afterwards by re-counting `users` (1 before,
1 after, on both runs). Scale used: 20,000 users, 2,000 products, 5,000 questions, 20
courses × 5 modules × 5 lessons (500 lessons), and entitlements/orders/progress rows
sized off those (~40,000 entitlements/lesson_progress rows, ~20,000 orders). The build
script was a one-off (bulk `INSERT ... SELECT ... FROM generate_series`, `ANALYZE`, the
six queries, `CREATE INDEX`, `ANALYZE`, the six queries again, `ROLLBACK`) — not kept in
the repo, since re-running it safely depends on remembering never to `COMMIT` before the
final rollback; re-create from this document's method description if this needs
reproducing.

Every plan below is the **real query text** from the file/line named in `week3_plan.md`
§25, not an approximation.

---

## Query 1 — the gate (`app/core/entitlements.py:resolve_product_ids`)

```sql
SELECT product_id FROM entitlements
WHERE user_id = :uid AND (expires_at IS NULL OR expires_at > now());
```

**Before** — `Seq Scan on entitlements`, filtering 20,001 of 20,002 rows away to find the
one that matches:

```
Seq Scan on entitlements  (cost=0.00..598.04 rows=1 width=16) (actual time=0.950..1.975 rows=1 loops=1)
  Filter: ((user_id = '0002329e-...'::uuid) AND ((expires_at IS NULL) OR (expires_at > now())))
  Rows Removed by Filter: 20001
  Buffers: shared hit=248
Execution Time: 2.003 ms
```

**After** — `ix_entitlements_user (user_id) INCLUDE (product_id)`:

```
Index Scan using ix_entitlements_user on entitlements  (cost=0.29..2.51 rows=1 width=16) (actual time=0.026..0.027 rows=1 loops=1)
  Index Cond: (user_id = '0002329e-...'::uuid)
  Filter: ((expires_at IS NULL) OR (expires_at > now()))
  Buffers: shared hit=1 read=2
Execution Time: 0.047 ms
```

**Seq Scan → Index Scan. 248 buffers → 3. ~43× faster.** This is the single most
important result in this file — every gated request in the product runs this query.

---

## Query 2 — bulk content resolve (`app/core/entitlements.py:resolve_granted_content_ids`)

```sql
SELECT content_id FROM product_contents
WHERE product_id = ANY(:product_ids) AND content_type = 'template';
```

**Before** — `Seq Scan`, 79 buffers, 0.798 ms.
**After** — `ix_product_contents_product_type (product_id, content_type) INCLUDE (content_id)`:

```
Bitmap Heap Scan on product_contents  (cost=13.95..24.77 rows=10 width=16) (actual time=0.041..0.052 rows=10 loops=1)
  Heap Blocks: exact=9
  Buffers: shared hit=9 read=2
  ->  Bitmap Index Scan on ix_product_contents_product_type ...
Execution Time: 0.076 ms
```

**Seq Scan → Bitmap Index Scan. 79 buffers → 11. ~10× faster.**

---

## Query 3a — published questions, ordered (`app/api/v1/content/questions.py:_load_published_questions`)

```sql
SELECT * FROM questions WHERE published = true ORDER BY title;
```

**Before** — `Seq Scan` + a separate `Sort` node over all 5,100 matching rows:

```
Sort  (cost=552.07..564.82 rows=5100 width=345) (actual time=8.154..8.667 rows=5100 loops=1)
  Sort Method: quicksort  Memory: 1576kB
  Buffers: shared hit=187
  ->  Seq Scan on questions ...
Execution Time: 8.898 ms
```

**After** — `ix_questions_published_title (title) WHERE published = true`:

```
Index Scan using ix_questions_published_title on questions  (cost=0.28..311.97 rows=5100 width=345) (actual time=0.025..1.481 rows=5100 loops=1)
  Buffers: shared hit=1192 read=27
Execution Time: 1.689 ms
```

**Sort node eliminated entirely — the index already returns title order. ~5× faster,
despite touching more buffer pages** (1,219 vs 187): the index walks the heap in title
order rather than sequentially, so it visits more distinct pages, but avoiding an
in-memory sort over the full 5,100-row result still wins on wall time. Recorded honestly
rather than only reporting the win that looks clean — this is exactly the buffer-vs-time
trade-off §27.1 says to read in order (node type, then buffers, then estimate accuracy).

---

## Query 3b — leadership traits, bulk (`app/api/v1/content/questions.py:_load_leadership_traits`)

```sql
SELECT question_id, trait_tag_id FROM question_leadership_traits
WHERE question_id IN (SELECT id FROM questions WHERE published = true);
```

**Before and after are the same plan** — `Hash Join` with a `Seq Scan` on both sides,
essentially unchanged (3.664 ms → 3.896 ms, noise-level difference). `ix_qlt_question
(question_id) INCLUDE (trait_tag_id)` was created but **never chosen** by the planner.

**Why, and why that's the correct planner decision, not a missed opportunity:** this
query's real call site always asks for traits belonging to *every currently-loaded
published question* — at this data shape, "5,100 of 5,100 questions." No index beats a
sequential scan when the query matches essentially the whole table; an index only pays
for itself when it lets Postgres skip rows, and here there are none to skip.

**Finding, not kept for comfort (non-negotiable #14): `ix_qlt_question` is dropped from
migration `010`.** If a single-question lookup (e.g. a question detail page fetching
just its own traits) ever becomes a real hot path, it should get its own index measured
against that access pattern — not this one, kept on the hope it might someday apply.

---

## Query 4 — lesson progress lookup (`app/api/v1/me.py`, `app/api/v1/content/courses.py`)

```sql
SELECT lesson_id FROM lesson_progress
WHERE user_id = :uid AND lesson_id = ANY(:lesson_ids) AND completed = true;
```

**Before** — `Seq Scan`, removing 40,001 of 40,002 rows:

```
Seq Scan on lesson_progress  (cost=0.05..1195.07 rows=1 width=16) (actual time=3.649..3.650 rows=0 loops=1)
  Rows Removed by Filter: 40001
  Buffers: shared hit=495
Execution Time: 3.677 ms
```

**After** — `ix_lesson_progress_user_lesson (user_id, lesson_id) INCLUDE (completed)`:

```
Index Only Scan using ix_lesson_progress_user_lesson on lesson_progress  (cost=0.41..31.61 rows=1 width=16) (actual time=0.036..0.036 rows=0 loops=1)
  Heap Fetches: 0
  Buffers: shared read=3
Execution Time: 0.059 ms
```

**Seq Scan → Index Only Scan (zero heap fetches — fully covered by the index). 495
buffers → 3. ~62× faster.** Second only to Query 1 in how much this matters: every
library page and course-syllabus load runs this.

---

## Query 5 — admin orders reconciliation (`app/api/v1/admin/orders.py:_order_rows`)

```sql
SELECT o.*, oi.*, u.*, p.*
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
JOIN users u ON u.id = o.user_id
JOIN products p ON p.id = oi.product_id
ORDER BY o.created_at DESC;
```

**Before and after are the same plan** — `Hash Join` × 3 with `Seq Scan` on every table,
`Sort` spilling to disk (`external merge Disk: 1616kB`). 42.152 ms → 47.223 ms (no real
change; the small increase is run-to-run noise, not a regression). None of
`ix_orders_user_created`, `ix_orders_created`, `ix_order_items_order`,
`ix_order_items_product` were chosen.

**Why: this query has no `WHERE` and no `LIMIT`.** `/admin/orders` fetches *every* order
unconditionally — at 100% selectivity, a full join across 4 tables is always cheaper via
Hash Join than driving from any single index, and an index on `created_at` cannot help
an `ORDER BY` that still has to materialise and sort all 20,002 rows for a Hash Join's
output regardless.

**These four indexes are kept in migration `010` anyway — this is a deliberate exception
to "drop what doesn't change the plan," not an oversight.** `week3_plan.md` §27.3 names
`/admin/orders` by name as the next candidate for keyset pagination (`WHERE created_at <
?` instead of fetching everything). The moment that ships, `ix_orders_created` is what
makes it an Index Scan with early termination instead of a full sort — these indexes are
prerequisite infrastructure for a named, planned follow-up, not indexes kept on the hope
they might someday apply (contrast with Query 3b above, which has no such follow-up on
record). **Recorded as a finding: `/admin/orders` needs pagination to actually benefit
from these indexes — the indexes alone do not fix its scaling behaviour.**

---

## Query 6 — course tree join (`app/api/v1/me.py`, `app/api/v1/content/courses.py`)

```sql
SELECT l.*, m.*, c.*
FROM lessons l
JOIN modules m ON m.id = l.module_id
JOIN courses c ON c.id = m.course_id
WHERE l.id = ANY(:lesson_ids) AND l.published = true AND c.published = true
ORDER BY m.sort_order, l.sort_order;
```

**Before and after are effectively identical** (0.173 ms → 0.154 ms) — both already used
`lessons_pkey` for the `id = ANY(...)` lookup, with tiny `Seq Scan`s on `modules` (102
rows) and `courses` (21 rows) either side. **Inconclusive at this synthetic scale**: 500
lessons across 100 modules is too small for `ix_lessons_module_sort` /
`ix_modules_course_sort` to show a measurable difference — the two supporting tables
never got big enough to matter in this run.

**Kept anyway.** Both indexes are cheap (small tables, low write volume), match the
`ORDER BY` the query already needs, and the table-only-grows argument (§24) applies
independent of whether this particular synthetic run proved it — a course catalogue
with real growth (more courses, deeper modules) is exactly the shape that would show the
win this test was too small to demonstrate. Flagged honestly as unproven-by-this-test
rather than claimed as a measured win.

---

## Duplicate cleanup (§26.3) — run for real, against the live data, before constraining

```sql
SELECT user_id, product_id, count(*) FROM entitlements GROUP BY 1,2 HAVING count(*) > 1;
SELECT stripe_session_id, count(*) FROM orders GROUP BY 1 HAVING count(*) > 1;
SELECT user_id, lesson_id, count(*) FROM lesson_progress GROUP BY 1,2 HAVING count(*) > 1;
SELECT user_id, course_id, count(*) FROM course_progress GROUP BY 1,2 HAVING count(*) > 1;
```

**Result: zero duplicate groups on all four pairs.** No cleanup DELETE was needed. (The
real dataset is small post-wipe — 2 orders total — so this is a low-confidence "clean,"
not a stress-tested one; the four `UNIQUE` constraints below are what makes it stay
clean regardless of scale.)

---

## Summary — what's actually in migration `010`

| Index | Query it serves | Verdict |
|---|---|---|
| `ix_entitlements_user` | 1 | **Kept — 43× win, Seq Scan → Index Scan** |
| `ix_product_contents_product_type` | 2 | **Kept — 10× win** |
| `ix_product_contents_content` | 2b (reverse direction, not directly benchmarked) | Kept — same reasoning as its forward twin, small/cheap |
| `ix_questions_published_title` | 3a | **Kept — 5× win, eliminates a Sort node** |
| `ix_questions_domain` | domain-filtered reads (not one of the six) | Kept — cheap partial index, real filter used elsewhere |
| `ix_qlt_question` | 3b | **Dropped — measured, doesn't change the plan, no near-term access pattern that would** |
| `ix_lesson_progress_user_lesson` | 4 | **Kept — 62× win, Index Only Scan** |
| `ix_course_progress_user` | not directly benchmarked | Kept — same shape as its lesson_progress twin |
| `ix_orders_user_created`, `ix_orders_created`, `ix_order_items_order`, `ix_order_items_product` | 5 | **Kept despite no measured plan change — prerequisite for the named pagination follow-up (§27.3); see Query 5's note** |
| `ix_lessons_module_sort`, `ix_modules_course_sort` | 6 | Kept — inconclusive at this test's scale, cheap, matches a real `ORDER BY` |
| Join-table indexes (`question_templates`, `question_lessons`, `question_relations`, `module_questions`), `ix_audit_log_created` | question detail page / audit reads | Kept per §26.1's own reasoning — small, cheap, not independently re-benchmarked here (not among the six named queries) |

**One index dropped on measured evidence** (`ix_qlt_question`), **two groups kept
despite an inconclusive or unchanged measurement** with an explicit, written reason each
(`/admin/orders`' four indexes await pagination; the course-tree pair's test data was
too small) — not silently kept "for comfort," which is exactly what non-negotiable #14
is guarding against.
