# Screen sweep — findings and decisions

**Date:** 2026-08-22 → 2026-08-23
**Branch:** `fix/screen-sweep-and-owner-reports`
**Why this file exists:** you asked to be away and for me to make the senior
engineering / UI-UX / usability calls myself, and to write down the ones you would
otherwise have been asked about. This is that record. Every judgement call below is
stated with the reason, so you can overrule any of it on one reading.

---

## 1. The method, and why it found things nothing else did

Everything in this pass was found by **opening pages in a real browser and measuring
them**, not by reading code. That distinction matters, because the repo was already
green: TypeScript clean, ESLint clean, 235 unit tests passing, and the docs marked the
relevant work done.

Three of the worst defects had shipped straight through all of that:

- `ErrorState`, `AuthorCard` and `LockedState` were built, marked ✅ in two separate
  logs, and had **zero call sites**. Nothing in `tsc`, `eslint` or the test suite reports
  an unused component.
- The router had no catch-all, so any mistyped URL showed react-router's developer
  screen — *"💿 Hey developer 👋"* — to real visitors.
- Course cards rendered a bare `<span />` where the price belongs.

So the durable output of this pass is not the individual fixes; it is
`tests/e2e/screen-overview.spec.ts` and `tests/e2e/admin-screen-overview.spec.ts`, which
open **every** public, admin and member screen and assert the cheap things a human
notices in the first second. Those two files found the 404 gap, the templates 500, an
AdminMetrics crash, a Purchases crash, and the collapsed sidebar's real scroll cause.

**Current state:** 35 sweep checks, 34 passing. The one failure is environmental, not a
code defect — see §6.

---

## 2. Decisions you would otherwise have been asked about

### 2.1 Duration: the authored number beats the measured one

`Course.estimated_duration_minutes` is set by the seed scripts and was never read; the
API instead summed `Media.duration_seconds` and returned it under a field named
`…_minutes`. Three minutes of video read as **"184 min"**.

**Decision:** the authored value wins where it exists, with computed video time (properly
converted, rounded up) as the fallback.

**Why:** the authored figure includes reading time, which no encoder can measure. A
reading-only course has no media at all, so the computed path can only ever return
`null` for it — which is what all five seeded courses were showing.

**Related call:** a course with *unknown* duration now **fails** a `max_duration` filter
rather than passing it. It previously scored `0`, so the courses we knew least about were
presented as the shortest. Excluding them is the honest default.

### 2.2 Packs no longer require a question — enforced in three places

You asked for this. Worth recording that the rule lived in **three** places and all three
had to change together:

1. pack creation (422),
2. the publish gate (409), and
3. `_pack_product_ids` in the **public catalogue**, which required a `question_set` row.

Number 3 is the one worth knowing about: had I fixed only the first two, you could have
created and published a question-less pack and it would simply never have appeared on
`/packs`, with nothing anywhere explaining why. The template requirement stays — a pack
with no file is nothing to sell.

### 2.3 Money-ness is declared by the caller, not inferred from a label

`MetricTile` decided whether a number was money by testing
`name === 'total_revenue'`. The Revenue Breakdown tiles pass display strings
("Gross revenue", "Refunded", "Net revenue"), so all three printed **raw cents** —
A$177.00 shown as `17700`, under a heading that says Revenue. The descriptions said
"(cents)" out loud, which documented the leak rather than fixing it.

**Decision:** added an explicit `money` prop. Inferring a value's *unit* from its *label*
was the bug; the caller knows the unit, so the caller states it.

### 2.4 A missing Stripe price is repaired, not refused

Your report: *"price is not updating, after setting price still Not yet for sale."*

Setting a price retrieves the existing Price to find its Stripe Product. When that id
does not resolve, the endpoint raised 409 and you got "Something went wrong. Please try
again" — and **retrying could never work**, because the stored id will never start
resolving. It happens when the `price_…` ids were issued by a different Stripe account.

**Decision:** a missing Price is now recovered by minting a fresh Product/Price pair and
adopting it.

**Why:** the database is the source of truth for what a thing costs; the Stripe objects
are only how it gets charged. Re-minting them is the correct repair, and the old id is
already gone, so nothing is lost. **This is the one change here with real-money
consequences — say the word and I will make it prompt for confirmation instead.**

### 2.5 The "Mode mismatch" warning was the guard's bug, not your config

The guard tested `startswith("sk_test_")`. A **restricted** key is `rk_test_` / `rk_live_`,
and the project was configured with one — so it concluded "live key", and every product
with a correct test price reported a mode mismatch.

**Decision:** mode now comes from the `_test_` / `_live_` infix, which every Stripe key
form carries. An unrecognised key shape reports *no* mismatch rather than guessing.

**Why the stricter-looking option was rejected:** a payment-safety check that cries wolf
is worse than no check, because it trains you to click past the one that matters.

*(You have since switched `STRIPE_SECRET_KEY` to an `sk_test_` key, which clears the
warning independently. The fix still matters: `rk_` keys now work correctly, and
`STRIPE_RESTRICTED_SECRET_KEY` is declared in `Settings` so it is typed and documented
rather than silently swallowed by `extra = "ignore"`.)*

### 2.6 Lists are paged, never virtualised

`/questions` was 14,846px (16.5 viewports). The 60-question pack page was 6,345px (7.0).

**Decision:** page them with an explicit "show N more" expander. **Not** virtualised.

**Why:** a windowed list breaks find-in-page (Ctrl+F), tab order, and the scroll
restoration that E4 depends on. On this product those matter more than the render cost of
a few dozen collapsed rows.

**Related call on PackDetail:** the copy said "All 60 questions" while 12 render. That
page's entire argument is that it does not hide what it sells, so the sentence now reads
"The first 12 of 60 questions". A collapsed list is fine; a sentence that misdescribes it
is not.

### 2.7 The pack buy rail carried the argument instead of the action

Measured, the rail stacked WhyThis (815px) and the objection block (612px) **above** the
button, pushing "Buy the pack" roughly 2,000px down a sticky column — so the one control
the rail exists to present was below the fold at every screen size, and the stickiness
bought nothing.

**Decision:** the rail keeps the commitment (price, file, evidence, button); the argument
for buying moves to the reading column. Rail: 2,416px → 949px. Nothing was removed.

### 2.8 "Not on sale yet" is stated, not left blank

Six of the seven courses in the database have no published product. The card rendered an
empty `<span />` where every other card shows a price, and the **detail page rendered
nothing at all** in its buy rail — no price, no CTA, no explanation, with the mobile buy
bar vanishing too. A visitor reached a full syllabus with no way to tell whether they had
missed a button or the page was broken.

**Decision:** both surfaces now say "Not on sale yet" and offer the way back.

**Not done, and why:** I did **not** create products for those five seeded courses.
Products carry real Stripe price IDs, which I will not fabricate. That is an owner action
— see §5.

### 2.9 The admin rail borrows the member rail's surface

You asked for colour. It was bare `bg-background` — the same cream as the page beside it,
so it had no edge of its own. **Decision:** it now uses the same `bg-stage` navy as the
member rail, so the two shells read as one product.

---

## 3. Things that looked like defects and were not

Recorded so nobody re-investigates them.

- **Dark-theme contrast failures on four routes.** Axe was sampling *during* the page's
  entry fade, when a computed colour is a partway blend with the background. It measured
  `#8b867b` (3.59:1) where the resting colour is `#6e675a` (4.61:1, passing). Fixed in the
  *test*, by waiting for animations to settle. The tokens were always correct.
- **"Overlapping icons" in the collapsed sidebar.** The two overlapping SVGs were the
  theme toggle's sun and moon, which crossfade by design. The real defect underneath was
  the scroll extent (§4), and the test now compares controls rather than raw `<svg>` boxes.
- **Three lessons with no body.** They are video lessons; their content is the Mux asset.
- **CORS errors in the browser console.** FastAPI attaches no CORS headers to an unhandled
  exception, so a 500 presents as a CORS failure. Every one of these was the templates
  slug crash wearing a disguise — and it sent the diagnosis at the middleware config for a
  while before I measured it.

---

## 4. The collapsed sidebar, in full

Three reports pointed at the same component, and the cause turned out to be one line
repeated in three files:

```
className="… absolute left-full …"
```

`left-full` deliberately positions the label flyout *outside* its parent — but the
containing `<aside>` is `overflow-y-auto overflow-x-hidden`, and **a scroll container
clips absolutely positioned descendants**. So:

- the tooltip never appeared, which is why a collapsed rail was a column of unlabelled
  icons with no way to discover what any of them did; and
- every hidden label still contributed its full width to the scroll extent. Measured: a
  **63px** rail with a **142px** `scrollWidth`. That is the horizontal scrollbar in your
  report.

Fixed by extracting one `RailTooltip` component positioned `fixed`, which escapes the clip
and contributes nothing to `scrollWidth`. Plus: `.scrollbar-none` on both rails (a classic
scrollbar takes ~15px of a 64px column — a quarter of it), and the brand rows stacked and
centred when collapsed instead of `justify-center` fighting an `ml-auto` chevron.

---

## 5. Owner actions still outstanding

Things I could not or should not do unattended.

1. **Restart the backend on port 8000.** It is running pre-fix code. This alone clears the
   "Mode mismatch" warnings, the templates 500, and the last failing sweep check.
2. **Attach products to the five seeded courses**, if you want them purchasable. They are
   published and readable but unbuyable, and every lesson is locked with no way to unlock.
   Requires real Stripe price IDs.
3. **Create WELCOME15 in Stripe** with *both* redemption-limit boxes unchecked — coupon
   `max_redemptions` is global, not per-customer; `restrictions.first_time_transaction` is
   the per-customer control.
4. **The watched non-developer usability test.** 30 minutes, unaided, adding a lesson and
   setting a price. No automated pass can produce this and none should claim to.
5. **Gate 0 manual buy-flow and Gate 6 real signup.**

---

## 6. Verification at time of writing

| Check | Result |
|---|---|
| Frontend unit tests | 237 / 237 |
| Backend tests | 403 passing before this pass; +19 added, full re-run in progress |
| `tsc --noEmit` | clean |
| `eslint src` | clean |
| `npm run build` | clean |
| Public screen sweep | 16 / 16 |
| Admin + member sweep | 19 / 19 |
| Product detail sweep | 2 / 3 — see below |

The single failure is `/templates/risk-register-template`, and it is **environmental**:
the dev backend on `:8000` predates the slug-lookup fix. Verified against a freshly
started server on `:8011`, the same URL returns **200** and the page renders with one
`<h1>` at 2,187px (2.4 viewports, down from 3,213px / 3.6). It will pass on restart.

---

## 7. If you want to overrule something

The calls most worth a second opinion, in order:

1. **§2.4** — auto-repairing a missing Stripe price. It touches real money. I think it is
   right, and it is the only change here I would understand you reversing on principle.
2. **§2.6** — 20 questions and 12 pack questions before the expander. Those numbers are
   judgement, not measurement.
3. **§2.9** — the admin rail going navy. It is a taste call; the alternative is a lighter
   tint that keeps admin visually distinct from the member area.
4. **§2.1** — trusting the authored duration over measured video length. If you would
   rather the number always reflect real runtime, the fallback order flips.
