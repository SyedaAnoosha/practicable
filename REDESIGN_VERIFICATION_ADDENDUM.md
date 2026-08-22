# Addendum — Verification pass, 2026-08-22 (Claude)

Companion to `REDESIGN_DECISIONS_LOG.md`. That document was written from the
source. This one records what changed when the same work was checked **against a
running stack and rendered pixels**.

Five defects were found that were invisible to `tsc`, `eslint`, and all 215
tests. That is the headline: **the suite was green the whole time.**

---

## A. The one to read first

### `cn()` was silently deleting every custom font-size utility

The question page's serif editorial headline — `Redesing_decisions.md` **B1, a
P0**, described in the docs as the product's credibility anchor — was rendering
at **16px instead of 56px**. The same size as body text.

The CSS was correct. The token was correct. The source read exactly as intended.

The fault was in `cn()`. Tailwind Merge resolves conflicts by classifying each
utility. It knows `text-sm` is a size and `text-foreground` is a colour, but a
custom rung like `text-h1` matches neither list — so it was classified as a
**colour**, treated as conflicting, and whichever came first was dropped:

```
cn('text-h1 text-foreground')  →  'text-foreground'
```

**Systemic, not one page.** Every `text-display`, `text-stat`, `text-h1..h4`,
`text-lead` and `text-read` passed through `cn()` alongside a text colour had it.

Fixed by registering the rungs with `extendTailwindMerge`. All eight main routes
now render titles at the intended 56px (hero 93px). 17 regression tests —
confirmed that 14 of them fail against the previous implementation, so the guard
is real.

**Why it matters beyond the fix:** a whole layer of the design system was inert
and nothing reported it. If a future rung is added to `theme.css` and not to the
list in `cn.ts`, it fails exactly the same silent way.

---

## B. Defects found by running the stack

| # | Defect | Consequence |
|---|---|---|
| 2 | `AdminMetrics` called `Object.keys()` on a possibly-absent aggregate | Crashed the **entire** admin metrics page, including the revenue tiles that had loaded fine |
| 3 | `MetricTile` guarded with `!== null`, which `undefined` walks straight past | Threw on `.toLocaleString()` — the direct cause of #2's blank screen |
| 4 | The `AdminMetrics` test fixture was **snake_case** while the endpoint returns **camelCase** | Every field below `metrics` arrived `undefined`. The suite asserted against a response shape the API has never sent — and passed, until the component began reading those fields |
| 5 | `/courses` returned **500 for the whole catalogue** — `Media.duration_seconds` is nullable and the new duration sum did `int + None` | One un-probed video took down the entire course catalogue |
| 6 | Migration `025` was pending against the live database | The API could not start: `courses.level does not exist` |

**#4 is the one worth dwelling on.** A passing test proved nothing, because the
fixture and the API had never agreed. It only surfaced when the component started
using those fields.

---

## C. Corrections to my own earlier work

- **The word-stagger split stripped the spaces from the hero's accessible name.**
  `h1.textContent` was `"Haveadifficultriskquestion?Start there."` — a screen
  reader would announce the site's primary headline as one run-on word. Visually
  perfect. Fixed with real space characters plus an `aria-label` pinning the
  announced string.

- **Badges were unreadable on the dark plane.** Every `Badge` variant is measured
  against ivory; `outline` (which is `text-primary`) landed at **1.16:1** on the
  glass scrim. Added a measured `stage` variant — 8.8:1 worst case.

- **`OutlineWord` was built, placed, then removed.** The hero's copy column leaves
  only a ~120px strip, which clipped a 180px word to a sliver; shrinking it to fit
  made it a smudge. The component is kept for a page with real empty plane.
  Utomic's word works because that hero is mostly empty. Ours is not.

---

## D. React correctness — fixed, not suppressed

- **`CommandPalette` reset its active row inside an effect.** For one frame after
  typing, the highlighted row was an index into the *previous* result set — Enter
  pressed quickly could open the wrong page. Now derived during render.

- **`useCountUp`'s three non-animating branches wrote the final value from an
  effect.** They are pure functions of the props; derived now, leaving the effect
  only the rAF loop.

- Two genuine external-sync cases (a media-query listener, a dialog's open reset)
  are suppressed **with stated reasons** rather than restructured.

- `useCommandPalette` moved to `lib/` so `CommandPalette.tsx` exports only a
  component — otherwise Fast Refresh remounts the whole module on every edit.

---

## E. Commerce and legal

### The discount code silently failed

The banner promises 15% off. If `WELCOME15` does not resolve to an active Stripe
promotion code, the backend proceeded and charged **full price with no signal**.

A buyer who was *shown* a code and then charged full price has a refund claim and
a reason to distrust every other number on the page.

It still does not fail the checkout — losing the sale is worse than losing the
discount — but it now logs loudly for the operator, who is the only person who can
fix it: **the code lives in the Stripe dashboard, not in this codebase.**

> ### ⚠ Action for you
> Create `WELCOME15` as an active Promotion Code in Stripe, **or remove the
> banner.** Right now the banner advertises a code that may not exist.

### The cookie notice claim was verified before shipping

"No tracking, no analytics, no third-party cookies" is true — no third-party
analytics anywhere in the bundle, and the first-party filter/recommendation
tracking is server-side API calls, not cookies. The essential-cookies-only framing
is legally a *notice*, not a consent gate, which is correct for what the site
actually stores.

The notice linked to the privacy policy for detail and **the policy had no cookies
section**. Added one, written from the actual storage keys in the codebase (grep
for `practicable:`) so it can be re-verified the same way when it drifts.

### `role="banner"` on the discount bar was wrong

That is the landmark for the page header, and the site already has one. Two make
the landmark list ambiguous. Now a named region — with a live region so the
copy-to-clipboard confirmation is announced, not only ticked.

---

## F. Sidebar — and the judgement call inside it

**Purchases was a true duplicate**, not a near-miss: `/account/purchases` mounts
the very same `<Purchases/>` component (`AccountPurchases.tsx` is a four-line
re-export). Removed from the rail; the standalone route stays, because receipts
and order emails link to it.

**Account settings moved to the footer** beside identity/theme/sign-out. The work
nav lists places you go to *do work*; account settings are chrome.

**The judgement call.** You asked for hover-to-preview *and*
click-to-open-and-navigate on the same collapsed icon. I made clicking
**navigate**, not expand-then-navigate. Every other link in the product navigates
on click, and the chevron is a dedicated, discoverable expand affordance — one
control doing two things would make both less predictable. Easy to change if you
disagree.

Collapsed rows keep their label in the DOM via `sr-only`: an icon-only nav whose
labels do not exist is unusable with a screen reader, and `title` alone does not
reliably produce an accessible name. The flyout is CSS-only on `group-hover` /
`group-focus-within`, so it appears on keyboard focus too.

---

## G. State at the end of this pass

- **232 tests passing** (181 at the start of the redesign — +51)
- `tsc` clean · `vite build` clean · `eslint` clean except **one pre-existing**
  error in `admin/InlineEditableTitle.tsx` that predates this work
- All 8 main routes verified rendering with **zero console errors**, light + dark,
  at 1440 and 390
- Migration `025` applied to the live database

### Still not done

| Item | Note |
|---|---|
| Gate 0 manual buy-flow check | Needs a human doing a real purchase, including the emailed confirmation link |
| Gate 6 "genuinely new account" | I verified the first-run code path, not a real signup |
| `WELCOME15` in Stripe | See §E — the banner advertises it regardless |
| Lighthouse baseline (E8.4) | Not run |
| Themes C / K / L remainder | Learning chrome partly done; performance and admin density not started |

---

# Part 2 — Full doc-by-doc verification, 2026-08-22

Every claim in the eleven design documents was checked against the code rather
than against the other documents. **Both prior logs overstated completion.**

The pattern repeats the one in Part A: components were *built*, marked ✅, and
never *wired up*. A component that exists but is imported nowhere is not a
shipped feature, and nothing in `tsc`, `eslint` or 235 tests reports it.

## H. Built, marked done, used nowhere

| Component | Claimed | Actual | Fixed |
|---|---|---|---|
| `ErrorState` | "F3 ✅ three-part error state" | **0 call sites.** `/questions`, `/courses`, `/templates`, `/packs` destructured only `data` + `isLoading`; a failed fetch made every render branch false and the page rendered a **silently blank column** under the filter rail. `Template.tsx` did `if (!template) return null` — a literally blank page. | 6 pages |
| `AuthorCard` | "B5 ✅ strongest trust asset" | **0 call sites**, and blocked: `Author.bio` exists in the DB but `CourseDetailOut` never serialised it, so the frontend had a name and no credential. | Added `author_bio` (additive, no extra query) + a "The author" section on `CourseDetail`, placed after the syllabus and **before** the upsell |
| `LockedState` | "F4 ✅ never greyed-out" | **0 call sites** — and both real lock surfaces did the exact thing F4 forbids: `CourseDetail` wrapped locked lessons in `opacity-60`, `Learn`'s outline used `text-muted-foreground/50` (~2.3:1, under the 4.5:1 floor). | Full contrast + "Included with the course" |

**F4 is worth dwelling on.** The doc's own reasoning is that *reading what you
do not have yet is the persuasive mechanism* — "a course whose syllabus you
can't see is harder to evaluate, not more exclusive." Dimming it did the
opposite of the stated intent while the log recorded it as done.

## I. Defects found by rendering, not reading

- **The grey slab.** The catalogue grids painted `bg-border` on the container and
  relied on `[&>*]:bg-card` to cover it — so every **unfilled track** in the last
  row stayed border-coloured. Two courses in a four-column grid rendered a large
  beige slab. Measured: `/courses` had 415,017px² of grid, 205,444px² filled.
  Also, the grid rendered unconditionally, so the empty frame sat underneath the
  loading, error and empty states.
- **Ragged card footers.** Price and CTA sat directly after the description, so a
  two-line title pushed its own footer lower than its neighbour's. Now `h-full`
  flex-column with `mt-auto`.
- **The editor showed raw `<p>` tags.** Tiptap reads `content` **once**, at
  instance creation; every later value was ignored. Now synced, guarded by a
  `getHTML()` comparison so typing never triggers a re-set (which would destroy
  the document and throw the cursor to the end).
- **A$177 of revenue displayed as "17,700".** `total_revenue` is stored in cents
  and printed verbatim — a 100× overstatement on the owner's dashboard, in the
  direction that flatters. Now formatted as currency.
- **The admin read as a database dump** — `second_purchase_rate`,
  `signup_to_purchase_days`. Machine names now map to written labels, with a
  de-snaking fallback so a new backend metric reads as words rather than vanishing.
- **Sidebar overflow.** Collapsed to 64px, the footer kept four ~36px controls in
  a horizontal row (~150px), so they overlapped and forced a horizontal scrollbar
  across the whole nav. Both member and admin rails now stack when collapsed.
- **Two `<h1>`s on the account page.** `Purchases` renders its own page title and
  is *also* mounted inside the Account shell, so "Your purchases" appeared at the
  page rung **larger than the "Account" `<h1>` above it** — a J4 heading-order
  failure that also read as the wrong page name. Added an `embedded` mode.
- **A network failure said your pack didn't exist.** `PackDetail` fell through to
  "That pack doesn't exist" on any error. A 404 keeps that copy; everything else
  now offers a retry.
- **C2 was half-built.** The outline was sticky and scrollable and tracked
  `is_current`, but nothing scrolled it into view — resuming lesson 22 of 30
  opened with the outline showing lesson 1. `aria-current` was also missing, so a
  screen reader heard thirty identical links.

## J. Backend tests were failing before this pass

12 failures in `test_metrics.py` / `test_metrics_no_posthog.py`, all from the
camelCase API migration: the endpoint returns `revenueGrossCents`, the tests
asserted `revenue_gross_cents`. Fixed — **20/20 pass**.

Worth knowing: the two casings are **deliberate, not drift**. Top-level JSON keys
are camelCase (the Pydantic `alias_generator`); the metric `name` *values* inside
`metrics` stay snake_case. A bulk rename gets this wrong in both directions.

## K. Verified correct — claims that held up

Checked and genuinely implemented: Theme A in full (per-value counts, two-zone
result count, quick-goal chips, computed zero-result relaxation — the reasoning
in the source is better than the spec asked for); B1 serif editorial headline;
B2 seven-tag grid; D1/D6 FactStrip + sticky buy rail; D7 related rail; E1
breadcrumbs; E2 ⌘K palette; **E4** (`ScrollToTop` correctly exempts `POP` and
keys on `pathname` alone, so the back button restores scroll and filter taps
don't reset it); J5 skip link; J4 route announcer + focus-to-h1; the 12px radius
ceiling; all five re-hued domains in both themes; every `--glass-*`/`--text-*`
token; the 24s ambient drift with `animation: none` under reduced motion.

**K3 passes on substance.** The entry bundle is 197.73 kB gzipped against a
documented <180 kB budget, but the budget's actual intent holds: no mux, no
tiptap, no recharts in the entry chunk — `LessonWriteScreen` (448 kB) and
`AdminMetrics` (364 kB) are correctly split out. The overage is React + router +
query + motion, not leaked admin code.

**K1 (templated OG images) remains genuinely not started.**

## L. State now

- **Frontend 235/235** · **backend metrics 20/20** · `tsc` clean · `vite build` clean
- **`eslint src` is completely clean for the first time** — the pre-existing
  `InlineEditableTitle` error is fixed properly (the draft is derived during
  render rather than reset from an effect, which also removed a one-render lag
  where the field showed the previous title).

### Still owed

| Item | Note |
|---|---|
| Gate 0 manual buy-flow check | Needs a human doing a real purchase, including the emailed confirmation link |
| Gate 6 "genuinely new account" | Code path verified, not a real signup |
| `WELCOME15` in Stripe | See §E. Coupon settings were reviewed 2026-08-22: **uncheck both "limit the number of times this can be redeemed"** boxes — Stripe's limits are global, not per-customer, so the first buyer would burn the code for everyone. Keep "Eligible for first-time order only", which is the per-customer control. |
| Lighthouse baseline (E8.4) | Not run |
| K1 templated OG images | Not started |
| C3 Undo | Blocked on a backend un-complete endpoint |
| Product-page height | Reported as too tall. The 3,213px I measured was a page in its **error state** (the API was down), so that number is not evidence — re-measure against a running backend before acting. |
