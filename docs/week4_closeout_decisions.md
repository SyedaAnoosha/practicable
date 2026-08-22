# Week 4 close-out — autonomous engineering decisions

**Pass date: 2026-08-22. Owner away; no questions could be asked.**

Per the owner's instruction, every judgment call in this pass was made using best
senior-engineer / UX / usability practice and recorded here for review afterwards.
Same format as [`phase10_engineering_decisions.md`](phase10_engineering_decisions.md):
each entry states **what**, **why**, and **the reasonable objection and why it was
rejected anyway**.

The pass began by re-verifying every row of `week4_plan.md` §28's task ledger against
the actual repository rather than trusting the ledger's own marks — the same standing
rule the ledger itself applies to `handover.md`. Most rows marked ⚠️/❌ on 2026-08-20
had in fact been closed by the Phase 8/9 commits since. What follows is the work for
those that had not, plus three defects found while doing it that were on no ledger at
all, and one the owner reported mid-pass (§10).

---

## 0. Summary for someone reading this in a hurry

**Five real defects were found and fixed this pass. Three were on no ledger row at all;
the fourth was reported by the owner mid-pass.**

| # | Severity | What was broken |
|---|---|---|
| 1 | **Severe — money** | A buyer who refunded and then bought again was **charged and given nothing**. Silent: order and order_item both written, no error anywhere. |
| 2 | **Blocking CI** | `npm run build` / `tsc -b` exited non-zero on 20 pre-existing type errors. The CI "typecheck and build" job could not have been green. |
| 3 | **Product-facing** | Every published template had `page_count` / `sheet_count` / `is_editable` NULL and zero previews, so W4-R1's entire pre-purchase evidence layer rendered nearly empty in production. |
| 4 | **Product-facing** | Editor formatting (h2, bullets, bold) did not reach the reading page — a plain-text body stored in an HTML-rendered column collapsed into one wall of text. Owner-reported. See §9. |
| 5 | **Never ran** | `scripts/backfill_stripe_product_ids.py` had three fatal bugs and had never executed, despite a ledger row citing it. Now run: 9 products resolved, 0 failures. See §10. |

**Plus a content finding the owner should read (§7), which is a business decision, not
an engineering one.** The owner instructed mid-pass to keep the templates regardless;
that instruction was followed and the finding is recorded for visibility only.

---

## 1. Template evidence is *measured from the files*, never typed

**Decision:** `backend/scripts/derive_template_evidence.py` opens each template's real
file in Storage and writes only what it can measure — PDF page count via `pypdf`,
visible worksheet count via `openpyxl`, editability from whether the bytes actually
parse as an editable format, `has_macros` only when a `vbaProject.bin` is genuinely
present. Anything unmeasurable is left NULL and reported as skipped.

**Why:** W4-R1's `EvidencePanel` is built on an absence rule — an unset column renders
no row at all. Ledger rows 23/24 were open because the columns were empty, and the
obvious "fix" is to have someone type plausible numbers in. That would make the buy page
*look* complete while quietly turning the evidence layer into marketing copy. These
facts are properties of a file that already exists; measuring them is both more accurate
and permanently re-runnable when a file is replaced.

Result: 9 of 10 templates now carry real evidence. The tenth (`cyber-related-issues`)
has no file uploaded at all and was correctly left blank.

**Objection considered:** *a blank row on a paid product looks unfinished.* Rejected — a
blank row is a content gap someone can see and fix; a fabricated row is a false claim on
a page taking money, and W4-R1's absence rule exists precisely to prefer the former.

---

## 2. Preview images are rendered from the artefact, and two page-selection rules were changed after *looking* at the output

**Decision:** `backend/scripts/generate_template_previews.py` rasterises real pages from
real files. Two non-obvious choices inside it:

**2a. Not "the first two pages".** The naive rule produced actively harmful previews. I
rendered them and looked, which is the only way this was ever going to surface:
`vendor-risk-assessment-template` page 2 is nothing but empty numbered rows, and page 3
is a third-party disclaimer. A preview of a blank page tells a buyer the artefact is
empty. The rule is now: page 1 always (it carries the title), then the densest remaining
page that is neither near-empty nor boilerplate. Where no such page exists, the gallery
gets **one** honest image rather than a padded pair.

**2b. `pypdfium2`, not PyMuPDF.** PyMuPDF was already importable in the environment and
would have been the zero-friction choice. It is **AGPL**, which is not a licence a
commercial platform should take a dependency on without the owner deciding to.
`pypdfium2` is BSD-3/Apache-2.0 and ships as a self-contained wheel needing no system
poppler. Both new dependencies are pinned in `requirements.txt` with the reason in a
comment beside them.

**Objection considered:** *AGPL only bites on distribution, and this is a server.* True
and still rejected — it is exactly the kind of licence decision that should be made
deliberately by the owner, not absorbed silently by an intern pass, and the
BSD-licensed alternative cost nothing.

---

## 3. Spreadsheet previews: the data is the artefact's, the styling is ours — and the page says so

**Decision:** XLSX templates could not be rasterised without a headless office suite (a
dependency far too heavy for a preview image), which would have left the two
highest-value paid templates with no preview at all. Instead
`backend/scripts/_sheet_preview.py` reads the real cells and composes them in the
platform's own table treatment (theme.css §12.2 light tokens).

Three honesty guards make this defensible rather than a mockup:

- Every cell, header and column order is the file's own. Nothing is invented.
- The alt text states the composition explicitly: *"…shown in this site's table
  styling"*, so a screen-reader user is never told they are seeing the file's design.
- A footer discloses scope — *"Preview of the first 16 rows of 104 · 3 sheets in the
  file"*, and *"N blank columns hidden"* when any were dropped.

**Sub-decision — dropping empty columns, but only sometimes.** A blank checklist renders
as a wall of whitespace that undersells the artefact. Empty columns are therefore
dropped *unless* fewer than two would remain — because at that point the emptiness **is**
the artefact (it is a fill-in-yourself form), and hiding it would misrepresent what the
buyer receives. `tprm-due-diligence-checklist` correctly keeps all six columns under
this rule; the scorecards correctly drop none because all theirs are populated.

**Objection considered:** *restyling someone's spreadsheet is a form of misrepresentation.*
Taken seriously — it is why the alt text and footer disclose it rather than staying
silent. The alternative was no preview at all on the most expensive templates, which
serves the buyer worse.

**Deliberately not done:** `.ppt` and headers-only blank forms get no preview and say so
in the script output. `risk-register-template` is headers with no data rows; a picture of
empty cells answers nothing.

---

## 4. `recommendation_clicked` is a server-side table, not a PostHog event

**Decision:** Ledger row 29 (absent everywhere). Closed with migration `024`, a
`recommendation_events` table, `POST /recommendation-events`,
`frontend/src/lib/recommendationEvents.ts`, wiring in both routing components, 7 tests,
and a rendered section on `/admin/metrics`.

**Why server-side:** W4-R10's 2026-08-17 amendment already moved the tag-filter counter
server-side so the admin page answers with no PostHog key set. A routing metric that
needed an external project key would reintroduce exactly the dependency that amendment
removed.

**Three sub-decisions worth review:**

- **Not debounced**, unlike `filterEvents.ts`. A filter is dragged through five values
  and only the settled one matters; a recommendation click happens once and is
  immediately followed by a navigation, so a 500 ms debounce would drop the very event
  it was meant to record.
- **`surface` is stored** (`question` vs `catalogue`) rather than collapsed to one
  count. A click from a question the reader is actually reading and a click from a
  filter result set are different signals; averaging them hides which one works.
- **A separate rate-limit bucket** from filter events, so a reader who filters heavily
  does not spend the budget that records their one click.

**The privacy constraint is pinned by a test.** `test_no_identifying_column_exists_on_the_table`
asserts the exact column set. A future well-meaning *"just add user_id so we can
segment"* now breaks a test and becomes a deliberate act, rather than a quiet change to
what the platform records about its readers.

---

## 5. W4-R4's "as a link" was taken literally

**Decision:** W4-R4's acceptance says every recommendation must name a real question
*"by title, as a link"*. Both routing panels rendered the titles as inert `<strong>`.
Added `frontend/src/components/content/QuestionLink.tsx`, used by both.

**Why it matters beyond compliance:** the link is what makes the explanation *checkable*.
A reader who doubts a recommendation can open the question and judge for themselves;
without the link, the panel is asking for trust it has not earned. It takes the in-prose
link treatment rather than the standalone link style, matching the correction
`LicenceLine` received on 2026-08-20 after axe flagged link-in-text-block contrast.

---

## 6. `access_ended_at` on course detail — and the money bug it uncovered

**Decision (ledger row 92):** `/courses/{slug}` now returns `access_ended_at`, and
`CourseDetail.tsx` renders a muted "Access ended — refunded {date}" block with a route
to `/purchases`.

**Why:** `/library` and the dashboard genuinely did already handle refunds — both read
through `resolve_product_ids`, which excludes revoked entitlements, so a refunded course
just stops appearing. Course detail is a **public** page, so a refunded buyer got the
ordinary buy page back with no acknowledgement they had ever owned it. That reads as the
site having lost their purchase, which is worse than the refund.

Tone follows 9B step 7 exactly: `muted`, never `destructive`. A refund the buyer asked
for is a completed transaction, not an error; colouring it red says something went wrong
when nothing did. The buy rail below is left untouched, so buying again is one scroll
away rather than a dead end.

**The copy claims "your progress is kept if you do" — and that was verified, not
assumed.** `refund_service.py` only sets `revoked_at`; `LessonProgress` rows are never
deleted.

### 6a. The severe bug this uncovered — re-purchase after refund charged the buyer and granted nothing

Writing a test for "bought, refunded, bought again" hit
`uq_entitlements_user_product` — a unique constraint permitting exactly one entitlement
row per (user, product). Following that thread found a genuine money bug in
`order_service.create_order_from_checkout`:

```
1. buyer purchases          -> entitlement row created, access works
2. buyer refunds            -> SAME row gets revoked_at; access correctly ends
3. buyer purchases AGAIN    -> Stripe charges them
4. `already_owned` matched the REVOKED row  -> the grant was skipped
5. the revoked row was never cleared        -> the gate still denied access
```

The buyer paid and received nothing, and **nothing raised an error** — the order and
order_item were both written, so it looked like a successful purchase from every angle
except the only one that mattered.

**The fix, and why this shape:** `already_owned` now loads whole rows rather than ids,
keeps revoked rows rather than filtering them out, and **reinstates** the existing row.
That is the only correct shape available: filtering revoked rows out and inserting would
have raised an `IntegrityError` against the unique constraint *after Stripe had already
taken the money*, turning a silent failure into a loud one without fixing it.
`revoked_reason` is cleared alongside `revoked_at` — a live entitlement still labelled
"refund" is a contradiction that misleads the audit trail. The reinstatement writes a
distinct `reinstate_entitlement` audit action rather than reusing `grant_entitlement`,
so the two are distinguishable afterwards.

Proven red first (`tests/test_repurchase_after_refund.py`, 4 tests): two failed against
the pre-fix code with the buyer holding no access, and all four pass after. The
pre-existing duplicate-purchase guard is pinned by its own test so the fix could not
quietly remove it.

---

## 7. Content provenance — a finding, not a decision `[OWNER]`

While rendering previews I read the actual files. Several paid templates are
third-party documents:

| Template | Price | Source visible in the file |
|---|---|---|
| `risk-assessment-template` | A$39 | **NEBOSH Unit IG2** assessment, a worked exemplar; carries a malpractice declaration |
| `cyber-risk-assessment-standard` | paid | **Boston University** internal policy document |
| `vendor-risk-assessment-template` | in bundle | **Smartsheet** — branded, plus a disclaimer page |
| `tprm-due-diligence-checklist` | A$49 | **Smartsheet** (`IC-…-10772`, disclaimer sheet) |
| `vendor-risk-assessment-scorecard` | A$39 | **Smartsheet** (disclaimer sheet) |
| `vendor-evaluation-with-scorecard` | paid | **Smartsheet** (disclaimer sheet) |
| `risk-enterprise-op-question-pack` | A$49 | Own content, "PRACTICABLE" branded ✓ |

I raised this mid-pass. **The owner's instruction was "keep the templates no matter what
its an order", and that instruction was followed** — previews were generated and the
templates ship as they are. It is recorded here only so the decision is visible and
deliberate rather than accidental, since it is a licensing question the owner is the
right person to answer and I am not.

Worth noting for whoever picks this up: the Smartsheet previews render the branding, so
it now appears on the platform's own buy pages where before the gallery was empty.

---

## 8. The CI typecheck gate was red, and had been

**Decision:** Fixed all 20 pre-existing `tsc -b` errors so `npm run build` exits 0.

**How it was missed:** `tsc -b` prints errors and, when a stale `.tsbuildinfo` marks the
project up to date, can still exit 0 — and piping it through `head` masks the real exit
code. Reading the exit code directly showed **2**. The CI "Frontend — typecheck, build,
and bundle-size budget" job therefore could not have been passing.

**The structural half of the fix:** most errors were test files using `fs`, `path` and
`__dirname` while `tsconfig.app.json` gave them only `vite/client` types. Rather than
add `node` types to the app project — which would let a *component* import `fs` and
still typecheck — tests now live in their own `tsconfig.test.json` with Node and Vitest
types, and are excluded from the app project. That keeps app code strict and makes the
separation real rather than nominal.

The rest were unused imports/variables and one genuine type error in
`Purchases.test.tsx`, where a mock narrowed axios's `config` parameter so tightly it
became structurally incompatible with `AxiosRequestConfig`.

**Objection considered:** *these were pre-existing and out of scope.* Rejected — the
week's own Definition of Done requires the frontend to compile, and a build that does
not is not something to leave for the owner to discover.

---

## 9. The lesson editor bug — h2, bullets and bold not reaching the reading page

**Owner report, mid-pass:** *"if i am selecting h2, bullets, bold nothing is shown in the
actual reading lesson."*

Traced the whole chain — editor toolbar, `getHTML()`, admin save, `sanitize_html`,
`lessons.prose_sanitized`, the public lesson API, `RichText`, the `.rich-text` CSS. The
toolbar, the CSS and the render path were all correct. **Two faults sat in the middle.**

### 10a. Plain text was being stored in a column only ever rendered as HTML

`sanitize_html()` passed tag-free text through unchanged. But `prose_sanitized` is
rendered with `dangerouslySetInnerHTML`, and `Learn.tsx` switches to that path the moment
the column is non-null — so a pasted plain-text body was stored raw, the browser collapsed
every newline into a single space, and the reader got one undifferentiated wall of text.
Worse, the `whitespace-pre-line` fallback that renders plain text *correctly* was skipped
precisely **because** the column was set.

Found live on `asset-inventory-what-you-don-t-know-can-hurt-you`: 15,060 characters, zero
HTML tags.

**Fix:** `sanitize_html()` now promotes tag-free input to real paragraphs *before*
sanitizing — one `<p>` per blank-line-separated block, single newlines becoming `<br>`.
Done inside the sanitizer rather than at each call site, so every writer of this column
(lesson body, block text, anything added later) inherits the guarantee that
`prose_sanitized` is always renderable HTML.

**What it deliberately does NOT do:** guess structure. A line reading "1. First step"
stays a paragraph line; a short title-case line does not become an `<h2>`. Silently
restructuring content the author never asked to have restructured is a worse failure than
a flat paragraph — the same rule `plainTextToEditorHtml.ts` already states for the
editor's load path.

**Existing data repaired** by `scripts/repair_plaintext_prose.py` (dry-run by default).
One lesson, 245 paragraphs recovered. A verification query confirms no row still holds
raw text.

**A test had to change, because it asserted the bug.**
`test_plain_text_survives_unchanged` required plain text to come back byte-identically.
That is exactly the requirement that made this failure possible. "Byte-identical" is the
wrong contract for a column whose only consumer is an HTML renderer; the replacement
asserts that *structure and meaning* survive instead.

### 10b. A detector that matched nothing — caught before shipping

While implementing 10a, a shell-escaping accident turned the tag-detection regex's ``
word boundary into a literal backspace character (``). The pattern then matched
**nothing**, so *real editor HTML* was classified as plain text and escaped — every
heading and bullet would have rendered as visible angle brackets. Caught by testing the
sanitizer against real editor output before it went anywhere near the database.

The detector was then simplified to ask one question — *"is there any HTML tag here?"* —
rather than checking a list of block-level tags. Two benefits: it also correctly routes
`<img>`/`<body onload=…>` payloads to bleach (which strips them) instead of escaping them
into visible markup, and it removes a tag list that would have had to stay in sync with
`ALLOWED_TAGS` forever.

### 10c. The coverage gap that let this through

Every link in the chain had its own test. **Nothing tested the chain.**
`tests/test_lesson_prose_round_trip.py` (12 tests) now covers admin save → sanitize →
database → public API → response, and asserts h2, bold and bullets individually so a
future failure names which one broke. `test_real_editor_html_survives_untouched` is
specifically the test that would have caught 10b in CI.

---

## 10. The Stripe backfill script had never actually run (ledger row 69)

Row 69 said the migration and `scripts/backfill_stripe_product_ids.py` both existed, but
that *"whether it has been run, and its unresolved-id list, is unrecorded."* Running it
answered that: **it had never run, and could not have.** Three bugs, each fatal before the
script reached a single row:

1. No `sys.path` insert, so it died immediately on `ModuleNotFoundError: No module named
   'app'`. Every other script in that directory already carries the line.
2. `async with get_session() as session` — `get_session` is a FastAPI *dependency* (an
   async generator), not a context manager, so this raised `TypeError` before touching the
   database. Replaced with a directly-built session, matching the other scripts.
3. Status output used `✗` / `✓` glyphs that raise `UnicodeEncodeError` on a
   Windows console (cp1252) — so even the failure path crashed.

After the fixes it ran against real Stripe: **9 products resolved, 0 failures**, the tenth
already had an id. The unresolved-id list the row asked to record is empty.

**Why this is worth writing down.** A script that exists in the tree reads as done. This
one was cited in a ledger row as evidence, and no one had executed it. The lesson matches
§9c's: presence is not proof — the only evidence that a thing works is having run it.

---

## 11. What was deliberately NOT done

- **No preview for `.ppt` or blank-form templates.** Would need a headless office suite,
  or would show a picture of empty cells. The script reports each skip with its reason.
- **`--chart-*` tokens, the gate, `products`/`product_contents`/`entitlements` schema,
  the admin manual refund path, and the 15% rule were not touched.** None needed
  changing, and all are named non-negotiables.
- **Row 104 (Stripe invoice number on orders) left deferred** as Phase 10 recorded it —
  it needs a schema column and a webhook change, and fabricating an invoice number is
  precisely what its own ledger note forbids.
- **The human-only ledger rows** (34, 49, 50, 51 — manual a11y checks, a watched
  non-developer usability test, an email opened in a real client, the Supabase Site URL)
  remain open. They are marked `[HUMAN]` / `[UNVERIFIABLE]` for good reason and no
  automated pass can honestly close them.


Is week4_plan.md done?
Yes for engineering — 108 of 116 ledger rows are ✅. The 8 that remain are all things software cannot honestly close:

Row	Item	Why it stays open
31	Route × state matrix	3 of 7 columns automated & green (axe both themes, 7 widths); Empty/Loading/Error/Locked need a human driving the app
32	Nine failure modes	Needs inducing real failures (Stripe down mid-checkout, Mux encode failure)
34	Six manual a11y checks	[HUMAN]
35	.stage-aurora--rail pixel check	[HUMAN]
44c	014 index vs spec	Schema deviates from spec but works; changing it is a migration decision for you
49 / 50 / 51	Usability test · email in a real client · Supabase Site URL	[HUMAN] / [UNVERIFIABLE]
104	Receipt link	Deferred — needs a column + webhook change; fabricating an invoice number is what its own note forbids
Your editor bug — fixed
sanitize_html() passed plain text straight through into prose_sanitized. That column renders as HTML, and Learn.tsx switches to that path the moment it's non-null — so a pasted body was stored raw, the browser ate every newline, and the plain-text fallback that would have rendered it properly was skipped because the column was set.

Fixed in the sanitizer, so every writer of that column inherits it
Repaired your data: asset-inventory… — 15,060 chars → 245 real paragraphs
Removed dead prose prose-sm classes from the editor pane (that Tailwind plugin isn't installed)
Caught a second bug mid-fix: a mangled regex would have escaped all real editor HTML into visible angle brackets — caught before it touched data
12 backend round-trip tests + 3 frontend tests now assert h2/bold/bullets individually
Five defects found that were on no ledger
Money, severe — refund→repurchase charged the buyer and granted nothing. Silent: order written, no error, gate still denied access. Proven red first, then fixed.
CI was red — tsc -b exited 2 on 20 pre-existing errors; npm run build could not have passed.
Evidence layer empty — every template had NULL page/sheet counts and zero previews.
Your editor bug.
backfill_stripe_product_ids.py had never run — three fatal bugs. Now run: 9 products resolved, 0 failures.
Test status
Frontend: tsc -b 0, build succeeds, 181/181 tests
Backend: 82/82 on gating/money/refund/repurchase/recommendation/posthog; full suite was 354 passed earlier
Two things needing your decision
Content provenance (week4_closeout_decisions.md §7) — several paid templates are third-party: risk-assessment-template is a NEBOSH IG2 exam paper, cyber-risk-assessment-standard is a Boston University policy, four are Smartsheet-branded. You said keep them, and I did. Flagging only because previews now render that branding on your own buy pages.

AGPL avoided — I used pypdfium2 (BSD) over PyMuPDF for PDF rendering rather than absorb an AGPL dependency on your behalf.
---

## §12 — Refund eligibility: a course product that lists its lessons is still a course

**Reported by you, 2026-08-22, against the live database.** Order `0b29c5e4`, "Risk
Register Fundamentals", A$49, dated 14 Aug 2026 — plainly a course — showed a
**Refund request** link that answered:

> This order doesn't include a course. Contact us and we'll sort it out.

### What was actually wrong

`product_contents` is polymorphic. Both refund endpoints asked only for
`content_type = 'course'`. But a course product may enumerate its **lessons** instead of
the course row, and on your live catalogue that is the normal case, not the exception:

| content_type | rows |
|---|---|
| `question_set` | 122 |
| `template` | 11 |
| `lesson` | 11 |
| `course` | **1** |

| product | course | lesson | template | qset |
|---|---|---|---|---|
| `risk-register-fundamentals` | **0** | 3 | 1 | 1 |
| `risk-register-bundle` | **0** | 3 | 2 | 60 |
| `managing-cyber-risk-…-course` | 1 | 5 | 0 | 0 |

So the check matched **one product in ten**. Every other course product was told it
contained no course. The real ownership chain is `lesson → module → course`
(`lessons` has no `course_id` of its own), and that is what the fix walks.

The codebase already knew this — `admin/courses.py:353` says entitlements key on the
lesson row "never on the course-level `content_type="course"` row". The refund path was
simply written against the other assumption.

### Why the tests never caught it

`test_refund_selfserve.py::_create_course_order` builds `content_type="course"`. The
fixture encoded the one shape production mostly does **not** use, so 18 green tests sat
on top of a broken query. New file `test_refund_course_via_lessons.py` builds the real
shape (lessons + a template, no course row) — 4 of its 7 tests were seen red first.

### The second finding, which matters more than the first

**That buyer is at 33% complete.** The policy cut-off is 15%, so the order is *genuinely
ineligible* — but for a completely different reason, and they were never shown it. The
broken check was hiding the real one.

This is why the fix was not just "make it return true". A buyer refused for a false
reason cannot argue with it and support cannot explain it. After the fix that order
returns `progress_exceeded, progress_percent = 33` — refused, but honestly, and with the
consumer-guarantee sentence intact.

### Decisions I made without asking

1. **One shared `_resolve_course_ids()`, not two patched queries.** Both endpoints
   carried their own copy and both were wrong identically. A GET saying "eligible"
   followed by a POST saying "no course" is the worst version of this bug — the buyer is
   invited to click and then refused. Phase 10 §10D's own rule ("no parallel refund logic
   exists anywhere") applies to reads as well as writes.
2. **De-duplicated the resolved course ids.** A product carrying both a direct course row
   *and* that course's lessons must not count the course twice.
3. **The refusal now names the buyer's real percentage.** The *eligible* branch already
   said "You've completed 33% of this course"; the *ineligible* branch — the one place a
   buyer wants to check the figure — said only "more than 15%". The server already sends
   `progress_percent`. Falls back to the general sentence when there is no number, rather
   than rendering `null%` or inventing one.
4. **Left the genuinely-ineligible shapes refused.** Template-only and question-pack-only
   orders still return `no_course_in_order`; three tests pin that, so "resolve courses
   properly" cannot drift into "everything is a course".

### Still open — your call, not mine

- **`admin/metrics.py:353` has the same flaw.** Its enrolment count joins on
  `content_type == "course"`, so **9 of your 10 course products report zero enrolled**
  while their progress rows count normally. It is a reporting understatement, not a money
  bug, and it is outside what you asked me to fix — so I have flagged it rather than
  changed your dashboard's numbers unannounced.
- **`reportlab` is missing from `requirements.txt`.** `tests/test_packs.py` cannot import
  and so the full suite refuses to collect. Pre-existing, unrelated to this fix.

### Test status for this fix, measured rather than assumed

`test_refund_course_via_lessons.py` — **8 passed**. Four were seen red first.
Together with the existing refund suites (`test_refund_selfserve.py`,
`test_refunded_course_state.py`, `test_repurchase_after_refund.py`) — **36 passed**.

**Full backend suite: 12 failed, 382 passed, 1 error** (`test_packs.py` excluded — it
cannot import, see below). None of the failures are in the refund path:

| file | count | cause |
|---|---|---|
| `test_metrics.py` | 11 | The endpoint returns **camelCase** (`revenueGross`, `enrollmentSplits`, `courseEnrollmentRankings`); the tests assert **snake_case** (`revenue_gross_cents`). A serialisation-convention change that never reached these tests. Pre-existing, unrelated to this fix. |
| `test_metrics_no_posthog.py` | 1 | Same cause. |
| `test_html_sanitizer.py` | 1 error | Passes in isolation — a teardown artefact of the 38-minute run, not a real failure. |

**A correction worth recording, because it nearly became a false all-clear.** An earlier
run of mine was reported as "exit code 0". That was the shell *pipeline's* status, not
pytest's — the `| tail -8` swallowed the summary and returned `tail`'s exit code. The real
result of that run was 36 failed / 84 errors, which on a clean re-run resolved to the 12
above (the rest was contention from running while other suites were active). Two lessons
kept here rather than quietly fixed: never read an exit code through a pipe, and never
report a suite as green from a truncated tail.

`tests/test_packs.py` still cannot be collected — `ModuleNotFoundError: reportlab`, and
`reportlab` is absent from `requirements.txt`. Pre-existing and unrelated.

---

## §13 — Closing the Definition of Done: what I ticked, and the four I refused to

`2026-08-22`. The last pass over `week4_plan.md` took the unticked count from **112 → 30
→ 5**. This section records the judgement calls in that final step, because most of them
were about *not* ticking something.

### The count, honestly

| | Count |
|---|---|
| `[x]` closed with evidence | 281 |
| `[~]` partial or superseded, with the reason written in | 13 |
| `[ ]` genuinely open | **5** |

All five open items are `[HUMAN]` or `[OWNER]`. None of them can be closed by an
engineering session, and none of them should be closed by one.

### Four decisions where the honest answer was "no"

**1. `/admin/products` — superseded, struck through, not ticked.** The §7 line reads *"A
price is set and republished entirely through `/admin/products`"*. W4-R19 requires that
route's **absence**. Ticking it would have asserted the opposite of what the plan now
asks; deleting it would have hidden that a requirement was reversed. So it is struck
through and marked `[~] SUPERSEDED`, with a pointer to W4-R19 and a note that the
underlying price-control capability *was* built and tested (`a49eec5`, Phase 8B). A
reversed requirement should stay legible as a reversal.

**2. "≥2 real preview images" — `[~]`, not `[x]`.** Every published paid template has
complete evidence: page/sheet count, `is_editable`, `has_macros`, licence. But 4 of 8
carry exactly **one** preview image. The DoD line is conjunctive, so half-true is false.
`[OWNER]`: four more preview images is a content task. I did not fabricate them and did
not round the line up.

**3. Six manual a11y checks — `[~]` at four of six.** Keyboard-only purchase, keyboard-only
lesson, 200% zoom and `prefers-reduced-motion` are now measured against a running build
(`tests/e2e/a11y-manual-checks.spec.ts`). **Screen reader** and **dark mode, every state**
are left `[HUMAN]`. I could have written assertions that pass for both. They would have
produced a green tick and no assurance — a screen-reader check is a human listening, and
"every state looks right in dark mode" is a human looking.

**4. Font FOUT — left `[ ]` with the reason.** LCP measured 1425ms against a 2.0s budget,
which is tempting to read as closing the font line. It does not: that run was unthrottled,
and the line asks about the *jump* (CLS attributed to text), not the load. Inferring a
pass from an adjacent green metric is precisely the "reasoned about, not exercised"
failure W4-R6 exists to catch, so it stays open.

### Three lines that were stale in the *other* direction

`week4_plan.md` had three Phase-DoD lines asserting `NOT DONE` for work finished later in
the same session. A stale "not done" misleads exactly as much as a premature "done", so
all three were corrected rather than left alone:

- **Rail contrast (line 2057)** claimed `theme.css` still carried the `[UNVERIFIED]`
  marker. It does not — the marker is replaced by `[VERIFIED 2026-08-22]` and a measured
  table. Now `[x]`.
- **Six a11y checks (line 2055)** claimed none were done. Four are. Now `[~]`, with both
  my own measurement errors recorded alongside the app defect found.
- **Video watched in admin (line 2454)** claimed no human had watched one. The owner
  stated they had. Now `[x]`, recorded explicitly as **the owner's attestation, attributed
  to them** — not as an engineering verification, because this session did not observe it.

### Verified this pass, not assumed

Four §7 lines were cross-references I had not personally checked in this window, so I
checked them rather than inheriting the claim:

- **`h1` + axe route list.** Both halves separately: `CheckoutSuccess.tsx:121` and
  `Template.tsx:220` render `PageTitle`, and `PageTitle.tsx:33` is a real `<h1>`. A bare
  `grep "<h1"` on either page returns **nothing**, which would have read as a failure —
  the heading is one component away. Both routes are in `accessibility.spec.ts`'s
  `PUBLIC_ROUTES`.
- **Migration 013 / `CONCURRENTLY`.** `alembic_version` reads `025`. The clause that
  matters is the concurrency one: a failed `CREATE INDEX CONCURRENTLY` leaves an
  **invalid** index that still appears in `pg_indexes`, so listing indexes proves nothing.
  `SELECT count(*) FROM pg_index WHERE indisvalid = false` returns **0**. That is the
  evidence.
- **Mailjet, not Resend.** `ci.yml:39–42` export the four `MAILJET_*` vars; no `RESEND_*`
  appears anywhere in the workflow.
- **Topic-scoped commits.** Read the log. Each commit names one phase and one concern;
  `5bea74d` and `35226cd` each carry a single fix. The working tree still holds the
  in-flight redesign pass uncommitted — expected, not a violation.

### Still owed to you

1. **Four preview images** for the templates that have one (content).
2. **The non-developer usability test** — a real stranger, 30 minutes, unaided, every
   place they stop written down. Carried since Week 3; the single most valuable open item
   on this list.
3. **Screen-reader pass** and **dark-mode every-state pass**.
4. **Throttled font/FOUT profile.**
5. **Render env checklist**, ticked against the live dashboard.
6. **One of the nine email templates** opened in a real mail client.
7. **Supabase Auth Site URL / Redirect URLs** confirmed by an owner dashboard login.
8. **Renegotiate or fix the bundle budget** — CI is red on a real ~537KB-vs-180KB entry
   chunk. That red is correct and should stay red until one of the two happens in writing.

Two known-unrelated failures remain visible rather than suppressed: 12 `test_metrics*`
failures (endpoint serialises camelCase, tests assert snake_case) and `test_packs.py`
uncollectable on a missing `reportlab` in `requirements.txt`.
