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
