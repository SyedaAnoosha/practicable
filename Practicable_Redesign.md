# Practicable Redesign — Implementation Plan

Phase-by-phase, step-by-step. Design tasks and engineering tasks are
interleaved, because several engineering steps are blocked on a design
decision that must be settled first.

**Source documents.**
`REDESIGN_SUMMARY.md` — strategy ·
`design-research/PLATFORM_UI_UX_RESEARCH.md` — 14 platforms, 86 live captures ·
`design-research/FRAMER_MOTION_REFERENCE.md` — 9 Framer templates, motion brief ·
`design-research/USER_FLOW_AUDIT.md` — flow tracing ·
`docs/competitor-analysis/competitor-ui-analysis.md` — earlier pass, 27 captures.

**Owner decisions (2026-08-21).** Hero graphic generative from the real
taxonomy · buy-flow fix is return-path only · no product ratings.

---

## Contents

| Phase | Title | Blocking? | Ships |
|---|---|---|---|
| 0 | Unblock the revenue path | — | ✅ done |
| 1 | Design decisions (no code) | **blocks 2–6** | specs |
| 2 | Token foundation | blocks 3–7 | tokens |
| 3 | Motion system | blocks 5–6 | `lib/motion.ts` |
| 4 | Component layer | blocks 5–7 | components |
| 5 | Home rebuild | — | page |
| 6 | Dashboard rebuild | — | page |
| 7 | Inherit across remaining screens | — | polish |
| 8 | Evidence and close-out | — | docs |
| 9 | Content Editor | — | admin |
| 10 | Collapsible sidebar | — | ✅ done |

---

## Working agreements

- Phases run in order; each ends with a **gate** that must pass before the
  next starts.
- **D** = design task (produces a value or spec). **E** = engineering task.
  A D blocking an E is stated explicitly.
- Every phase is independently shippable. Nothing is left half-applied.
- Commit per numbered task, message referencing the task ID (`E2.1`).

**Standing constraints:**

1. No API contract changes. Frontend-only unless a task says otherwise.
2. Never regress: auth · entitlements · signed video · downloads · Stripe ·
   cart persistence · orders · emails · admin.
3. Every colour token ships with a **measured** contrast ratio in a
   `theme.css` comment, matching the existing house style. No unmeasured token.
4. Motion sits behind `<MotionConfig reducedMotion="user">`; looping and
   parallax motion additionally need their **own explicit guard** — the
   transform backstop does not stop a CSS loop.
5. Before every gate: `npm run lint && npm test && npm run build`.

**Commands.**

```bash
cd frontend
npm run lint          # eslint .
npm test              # vitest run
npm run build         # tsc -b && vite build
npm run e2e           # playwright: accessibility, gating,
                      # responsive-widths, stress-fixtures
cd ../design-research
node capture-practicable.js   # needs API on :8000, dev server on :5173
```

---

# Phase 0 — Unblock the revenue path ✅ COMPLETE

Done first: a broken purchase path outranks appearance. This was the
highest-severity finding in the audit.

## What was wrong

`/buy/:slug` sits inside `MemberLayout`. The guard redirected logged-out
visitors to `/sign-in` recording nothing, and `SignIn`/`SignUp` then navigated
unconditionally to `/dashboard`. A reader clicking any of **16 buy CTAs**
across 9 files was delivered to an empty dashboard with their product
forgotten — and `replace` on the redirect meant the back button didn't
recover it either.

A repo-wide grep for `returnTo|redirectTo|next|location.state.from` returned
nothing: there was no mechanism to repair, only one to introduce.

## E0.1 — `frontend/src/lib/utils/nextPath.ts` ✅

One validated helper instead of three ad-hoc implementations.

| Export | Purpose |
|---|---|
| `NEXT_PARAM`, `DEFAULT_AFTER_AUTH` | Constants, so call sites cannot drift |
| `safeNextPath()` | The security boundary |
| `signInUrlFor(from)` | Build `/sign-in?next=…` |
| `resolveNextPath(search)` | Read it back, or fall back |

`safeNextPath` rejects, each for its own reason:

| Input | Why rejected |
|---|---|
| `https://evil.example` | absolute URL |
| `//evil.example` | protocol-relative — browsers treat as cross-origin |
| `/\evil.example` | backslash; several browsers normalise `\` → `/` |
| `javascript:`, `data:` | script/data URL |
| `dashboard` | bare relative; resolves against current path |
| `\n/evil`, ` /library` | control chars — the classic `startsWith('/')` bypass |
| `/sign-in`, `/sign-up` | auth routes; would bounce back to the form just completed |

It then re-resolves against a throwaway origin as a second, independent check.

**Why a query parameter, not router state:** `CartDrawer` navigates via
`window.location.assign` (full document load) and `SignUp`'s confirmation
email routes back through `/sign-in`. Router state survives neither.

## E0.2 — Four call sites wired ✅

| File | Change |
|---|---|
| `routes/_layouts/MemberLayout.tsx` | Guard records `pathname + search` via `signInUrlFor` |
| `pages/SignIn.tsx` | `navigate(resolveNextPath(search))`; sign-up link carries `next` |
| `pages/SignUp.tsx` | Same; **plus `emailRedirectTo` carries `next` through the inbox** |
| `components/cart/CartDrawer.tsx` | Returns to the page the drawer was opened over |

Three things found during implementation that were **not** in the audit:

1. **The confirmation email dropped the destination.** `SignUp` sets
   `emailRedirectTo: …/sign-in`; without `next` on that URL, a new user who
   confirms via their inbox loses it — and sign-up is the *common* path for a
   first purchase.
2. **Cross-links needed it.** "Already have an account? Sign in" and its
   reciprocal discard `next` when switching forms mid-purchase.
3. **The cart's right destination isn't `/buy`.** The drawer opens over the
   current page, so it returns there with the cart intact.

## E0.3 — Tests ✅

`nextPath.test.ts`, 18 cases, weighted to the open-redirect boundary rather
than the happy path. Includes the inverse case — a path is not rejected
merely because an auth route name appears inside it
(`/courses/how-to-sign-in-securely` is valid).

## E0.4 — Capture script ✅

`reducedMotion: 'reduce'` on the Playwright context, so `whileInView`
sections render their settled state rather than 4,000px of blank ivory. Added
an `expectBelowFold` assertion: a page blank for a mechanical reason would
otherwise satisfy a hero-only content check — the same class of false-pass
that let 18 empty skeletons through previously.

## Gate 0

`eslint src` clean · `vitest run` 61/61 · `tsc --noEmit` clean · `vite build`
succeeds.

**Manual verification still owed** — needs a running stack; do at the start of
Phase 1:

| # | Steps | Expected |
|---|---|---|
| 1 | Signed out → buy CTA on `/questions/:slug` → sign in | Land on `/buy/:slug` |
| 2 | Same via sign-up, **including the emailed confirmation link** | Land on `/buy/:slug` |
| 3 | Cart → "Sign in to checkout" → authenticate | Return to originating page, cart intact |
| 4 | Bare `/sign-in` | `/dashboard` |
| 5 | `/sign-in?next=https://evil.example` | `/dashboard`, no external navigation |
| 6 | `/sign-in?next=/buy/x%23top` | `/buy/x#top` — hash survives |

---

# Phase 1 — Design decisions (no code)

Blocking. Colour and type values chosen mid-build drift; settle them here.

## D1.1 — Re-hue the five domain colours

### The problem, measured

`theme.css` light theme, with computed hue angles and contrast on
`--background #FBF9F4`:

| Domain | Current | Hue | Contrast |
|---|---|---|---|
| Risk | `#142E5C` | 218° | 12.67 |
| Cyber | `#1B5FA8` | 211° | 6.14 |
| Compliance | `#1D6FA5` | 204° | 5.16 |
| Resilience | `#3D5A99` | 221° | 6.40 |
| AI | `#46618C` | 217° | 5.96 |

**All five hues fall within 204–221° — a 17° spread.** These are called
"signature" colours and are wired to every card, badge and artwork, so the
system pays the full cost of colour-coding and delivers none of the benefit.

**The dark theme has the identical defect** (196–229°): `#5B7FBD`, `#6FB0E8`,
`#5FB8D9`, `#8090D8`, `#93A7C9`.

### Proposed light values — computed, not asserted

| Domain | Proposed | Hue | bg | card | band | Grey |
|---|---|---|---|---|---|---|
| Risk | `#142E5C` *(keep)* | 218° | 12.67 | 13.33 | 11.93 | 43 |
| Cyber | `#1B6E7A` teal | 188° | 5.61 | 5.90 | 5.28 | 87 |
| Compliance | `#6B4E9B` violet | 263° | 6.26 | 6.59 | 5.90 | 95 |
| Resilience | `#1F6B47` green | 152° | 6.14 | 6.46 | 5.78 | 80 |
| AI | `#8A3F16` rust | 22° | 7.12 | 7.49 | 6.71 | 81 |

Hue spread 17° → **111°**. All clear 4.5:1 on all three surfaces.

### Proposed dark counterparts

Measured against `--background #141008` / `--card #1B1710` — derived and
tested, **not** auto-lightened:

| Domain | Dark | bg | card |
|---|---|---|---|
| Risk | `#7C9CD6` | 6.85 | 6.44 |
| Cyber | `#4FB3C4` | 7.75 | 7.29 |
| Compliance | `#A98BD6` | 6.64 | 6.25 |
| Resilience | `#4FB584` | 7.47 | 7.03 |
| AI | `#D9905A` | 7.30 | 6.87 |

### ⚠ Finding: colour alone cannot carry this

Simulating dichromacy over all ten pairs of the light set, **six pairs fall
below 1.5:1 separation**; the worst (Cyber/Resilience) is **1.08 — effectively
identical**. An earlier AI candidate (`#A35A2A`) collapsed onto Resilience at
**1.02** under protanopia.

This is structural, not a tuning problem: **no five-hue palette survives
dichromacy on hue alone.** Darkening AI to `#8A3F16` helps by separating on
*luminance* (which no dichromacy affects) but does not solve it.

**Therefore the requirement changes, and this is a real design decision:**
domain identity must be carried by **colour + icon + label together**, never
colour alone.

The good news is that the pieces exist. `domainVisuals.ts` already maps a
distinct icon per domain — ShieldAlert / Radar / ClipboardCheck / Activity /
Sparkles — but **`ContentCard` never uses it**: line 137's icon is keyed to
content *kind*, and only question cards show the domain name at all. Task
**E4.2** closes this.

**Acceptance for D1.1:** final light + dark hex, every ratio ≥4.5:1 on
`--background`/`--card`/`--band`, greyscale spread ≥50 (currently 52), and an
explicit note that colour is never the sole domain signal.

## D1.2 — Type scale ceiling

`--text-display` is `clamp(2.625rem, 1.9rem + 3.4vw, 4.25rem)` — **68px max**;
references run 72–110px.

Proposal: cap ~96px (`6rem`), raising the whole clamp rather than only the
ceiling. Also decide whether `--text-outline` (~180px, decorative,
`aria-hidden`) earns its place.

**Must check before accepting:** the longest *real* headline at 390 / 768 / 1440px. A 96px cap is only safe if actual copy doesn't wrap to four lines on mobile — test with the live string, not lorem ipsum.

## D1.3 — Motion specification

Fix duration, easing and reduced-motion behaviour for each of `wordStagger`, `useParallax`, `ambientDrift`, `hoverLift`, `arrowNudge`, `countUp`.

Starting proposal — house curve `EASE_OUT_EXPO [0.16, 1, 0.3, 1]` throughout:

| Variant | Duration | Reduced-motion |
|---|---|---|
| `wordStagger` | 0.5s, 45ms stagger | render final state, no stagger |
| `useParallax` | scroll-linked, ≤12% travel | **disabled** |
| `ambientDrift` | 24s loop | **disabled** |
| `hoverLift` | 150ms, 2–4px | opacity only |
| `arrowNudge` | 150ms, 3px | none |
| `countUp` | 0.9s | final value immediately |

## D1.4 — `TaxonomyCanvas` spec

Node layout for 99 questions in 5 clusters · gold connective lines · drift · parallax · static-SVG fallback. Must read at 390px, and must degrade honestly if the API returns a count other than 99 (**never render a hardcoded 99**).

## D1.5 — Glass surface tokens

`--glass-fill` / `--glass-edge` / `--glass-blur` as alphas of
`--stage-foreground`, never raw white (§7.6). **Verify text over glass clears
4.5:1 against the lightest point of the aurora beneath it** — `--stage-glow-3`
is `#8ED2FB` at 1.48:1, so a glass panel drifting over that corner is the
failure case.

## Reduce Vertical Scrolling

- The current app has too much vertical scrolling reduce it by showing more content in a single view.
- Bento grids, small components, small font size for headings and paragraphs are preferred.

## Gate 1

Every value written into `REDESIGN_SUMMARY.md` §3–§5 with measured ratios.
No code this phase.

---

# Phase 2 — Token foundation

Small, high-leverage, changes every screen at once.

## E2.1 — Domain colours

Apply D1.1 to `theme.css` (`:root` ~283–287 and the `.dark` block ~71–75).
Record measured ratios in comments, house style.

`domainVisuals.ts` needs **no change** — every consumer already goes through
`domainColorVar()` and the `--domain-*` tokens. This is why the change is
cheap; verify by grepping for hardcoded domain hexes before starting.

## E2.2 — Type scale

Apply D1.2. Grep for components hardcoding a display size instead of the token.

## E2.3 — Glass tokens

Add D1.5 tokens. No consumers yet — Phase 4 introduces them.

## E2.4 — Visual regression sweep

Re-run `capture-practicable.js` across all 10 routes × light/dark/mobile and
diff against the pre-change set.

## Gate 2

Lint/test/build clean · ratios recorded · **no layout shift** (colour and type
size only) · dark theme verified on every route · mixed-domain grids visibly
differentiate.

**Risk:** the type change can overflow tight headers. E2.4 is the check that
catches it — do not skip it.

---

# Phase 3 — Motion system

## E3.1 — Extend `lib/motion.ts`

Add the D1.3 variants. **Leave existing exports untouched** — the house curve
and 0.12s stagger are good and widely used.

## E3.2 — Reduced-motion guard

`<MotionConfig reducedMotion="user">` neutralises transforms but **does not
stop a CSS loop or a scroll-linked parallax**. Add explicit guards; a
continuously-moving background is a vestibular trigger.

## E3.3 — Hover and CTA

`hoverLift` on `Card`/`ContentCard`; `Button` gains a `pill` variant with
`arrowNudge`. Note `ContentCard:111` already carries `hover-lift
hover-lift-domain` classes — reconcile with the new variant rather than
stacking a second mechanism.

## E3.4 — `countUp`

On `StatTiles`, real values only.

## Gate 3

With `prefers-reduced-motion: reduce` set in DevTools (**not** by reading the
code): nothing loops, nothing parallaxes, `countUp` shows its final value.
`tests/e2e/accessibility.spec.ts` passes. No CLS regression from hover
transforms.

---

# Phase 4 — Component layer

## E4.1 — New primitives

`GlassPanel` · `PillEyebrow` · `TrustStrip` · `OutlineWord`.

**`TrustStrip` shows real counts only.** This is the FintechX device with its
fabricated `4.9/5` explicitly removed — principle 7, and the same reason
ratings were declined.

## E4.2 — `ContentCard`: pair colour with icon + label

Implements D1.1's finding. Currently the icon is keyed to content *kind* and
only question cards name their domain, so **colour is the sole domain signal**
— which dichromacy defeats.

Change: surface `domainVisual(domain).icon` and the domain label on every
domain-bearing card, not just questions. Colour becomes reinforcement.

## E4.3 — `CourseArt`

Generative duotone replacing the flat provisional panel. Caveat: courses carry
`section.name` (`Risk Management`), questions carry `domain.name`
(`Risk (Enterprise & op.)`); `domainVisuals.ts` bridges by leading keyword. A
section not leading with a domain word falls back to `--primary` and loses its
colour — acceptable, but do not widen the bridge here.

## E4.4 — `Tabs`

For Store/Library consolidation.

## E4.5 — Remove `TypewriterTitle`

**Verified: zero call sites.** It is already dead code — deletion is safe and
needs no migration. (The strategy doc's "verify call sites before deleting"
is hereby discharged.)

## Gate 4

Every component renders in light + dark, at 390/768/1440, across loading,
empty, error and populated states. Domain identity legible in greyscale.

---

# Phase 5 — Home rebuild

Rebuild from scratch. 7 sections → 6, richness front-loaded.

```
1  Hero            stage plane · 96px word-staggered H1 · question search
                   · TrustStrip · parallax + ambient
2  Question entry  glass cards over the lower hero gradient
3  How it works    CALM band — Question → Answer → Learning → Template → Apply
4  Products        courses / templates / packs, 3-col
5  Author          AuthorCard, given real space
6  Free pack CTA   single close
```

- **E5.1 — Hero without `TaxonomyCanvas`.** Aurora + `OutlineWord` first, so
  the page is never blocked on the most expensive component.
- **E5.2 — Sections 2–6.**
- **E5.3 — `TaxonomyCanvas`**, swapped in once it stands on its own.

## Gate 5

Page is **shorter** than the current one — measure it; solving blandness with
length is explicitly forbidden · LCP not regressed · keyboard path through the
hero search intact · the capture script's `expectBelowFold` assertion passes.

---

# Phase 6 — Dashboard rebuild

```
1  Greeting + resume   named next lesson + progress; designed first-run
                       fallback, never nothing
2  Stat row            countUp, real values
3  Two-column          library w/ progress · routed next steps
4  Recommended         explained ("because you read X"), not bare ranking
```

- **E6.1 — First-run state.** Today the resume panel (`Dashboard.tsx:202`) and
  library grid (`:401`) are **both conditional**, so a new account sees
  neither — the emptiest screen in the product, and precisely where Phase 0
  now delivers people *intentionally*.
- **E6.2 — Sections 2–4.**
- **E6.3 — Restrained motion only:** `countUp`, `hoverLift`. No parallax, no
  ambient loop. The Framer references are landing pages and are not the model
  for a signed-in screen where speed beats atmosphere.

## Gate 6

Verify with a **genuinely new account**, not a seeded one.
`role="progressbar"` retains `aria-valuenow`. Every panel has a designed
empty state.

---

# Phase 7 — Inherit across remaining screens

Restyle only. No restructuring.

- **E7.1** Catalogues + detail pages inherit tokens, `hoverLift`, pill CTAs.
- **E7.2** Learning (`Learn`, `Lesson`) — tokens only. Do not touch outline
  or progress logic.
- **E7.3** Commerce — **`CheckoutSuccess` gets token inheritance and nothing
  else.** Its content-aware `nextStep()`, entitlement polling and timeout
  fallback are better than most of the competitor set; rebuilding it would be
  a regression.
- **E7.4** Admin — tokens only. Density beats atmosphere.
- **E7.5** P1 flow gap: signal the account requirement on buy CTAs for
  logged-out visitors — "See what's included" doesn't hint at it. 

## Gate 7

Full e2e suite passes: `accessibility`, `gating`, `responsive-widths`,
`stress-fixtures`. Entitlement and gating behaviour unchanged.

---

# Phase 8 — Evidence and close-out

- **E8.1** Re-capture all Practicable routes with the fixed script. **The
  existing PNGs predate the fix and are still the blank-below-fold set** —
  they are not yet valid before/after evidence.
- **E8.2** Rewrite `REDESIGN_SUMMARY.md` from strategy into a record of what
  shipped (currently future-tense).
- **E8.3** Full a11y pass: contrast · focus order · heading order · 44px
  targets · reduced motion · landmarks.
- **E8.4** Lighthouse against the pre-redesign baseline.

## Gate 8

Research doc §26 quality bar answered yes-by-yes, with the screenshot backing
each answer.

---

# Phase 9 — Admin Panel ✅ COMPLETE

## What changed

Replaced the horizontal top-bar navigation with a collapsible sidebar, matching
the MemberLayout pattern. The admin panel now has the same visual language as
the member dashboard: sidebar nav, icon-rail mode, grouped sections.

## E9.1 — Rename "Content editor" → "Admin Panel" ✅

- `MemberLayout.tsx`: RailLink label changed from "Content editor" to "Admin Panel"
- `AdminLayout.tsx`: Brand area shows "Admin Panel" with ShieldCheck icon
- Non-admin error message changed from "content editors" to "administrators"

## E9.2 — Collapsible sidebar ✅

- Sidebar width: expanded = 240px, collapsed = 64px
- Same `localStorage` persistence pattern as member sidebar
  (`practicable:admin-sidebar-collapsed`)
- Toggle button between brand and nav sections (left/right chevron)
- Three grouped sections preserved: Content, Commerce, System
- CSS-only flyout tooltips on hover/focus for collapsed state
- Section headings collapse to `<hr>` rule (same as member sidebar)

## E9.3 — Brand + footer area ✅

- Brand: ShieldCheck icon + "Admin Panel" text (links back to /dashboard)
- Footer: ThemeToggle, "← Dashboard" link, Sign out button
- Standard `bg-background` surface (not the dark stage) — admin reads as
  the app's native chrome, not a separate environment

## Gate 9

- `npx tsc --noEmit` clean
- `npm run build` succeeds
- `npx vitest run` passes
- Sidebar collapses and persists across reloads
- Flyout tooltips appear on hover and keyboard focus in collapsed mode
- Non-admin users see a clear error message with back link

# Phase 10 — Collapsible sidebar

Owner direction: the sidebar is too wide at rest. A 256px column on a 1440px
laptop leaves less than 1200px for content — the width of a 13" laptop with
browser chrome.

## What changed

The sidebar collapses to a 64px icon rail. Expanded it remains 256px.
Width transitions with a 200ms ease-standard so content doesn't jump.

## E10.1 — Collapse state + toggle

- `useState` initialised from `localStorage('practicable:sidebar-collapsed')`
- Toggle button: left chevron (expanded → collapsed), right chevron (collapsed → expanded)
- The toggle sits between brand and nav sections — not at the bottom, not floating
- State persisted to localStorage on every toggle

## E10.2 — Collapsed rail behaviour

- Each `RailLink` shows icon only (`justify-center px-0`), label hidden via `sr-only`
  (always in DOM for screen readers, never removed)
- CSS-only flyout tooltip on `group-hover` / `group-focus-visible` — appears on
  keyboard focus as well as pointer hover, so the collapsed rail is not
  unreachable from keyboard
- Section headings collapse to a `<hr>` rule (a 64px column cannot hold
  uppercase-tracked text); `sr-only` text preserves the grouping for assistive tech
- Clicking an icon **navigates directly** — does not expand first. The chevron
  is the dedicated expand affordance; navigating is the link's job.

## E10.3 — Account settings relocated

"Purchases" removed from sidebar nav (duplicate of Account page).
"Account settings" moved from primary nav to the footer area — above the
identity row, beside ThemeToggle and Sign out. This is the Chrome/Notion/Figma
pattern: account chrome sits next to the avatar, not in the work navigation.

## E10.4 — Mobile sheet unchanged

The mobile sheet always renders full-width (collapsed state is desktop-only).
`SidebarBrand` and `SidebarAccount` receive `collapsed={false}` in the sheet.

## Gate 10

- `npx tsc --noEmit` clean
- `npm run build` succeeds
- Collapsed state persists across page reloads (localStorage)
- Flyout tooltips appear on hover and keyboard focus in collapsed mode
- Clicking a collapsed icon navigates to the target page
- Mobile sheet renders without errors
- Account settings accessible from sidebar footer

## Deferred

| Item | Why |
|---|---|
| `SaveButton` / bookmarking | Needs backend |
| Guest checkout | Owner chose return-path only; revisit with drop-off data |
| Product ratings | Declined — `REDESIGN_SUMMARY.md` §9 |
| Merging the two taxonomies | Backend decision about what a `section` is |
| Cross-type search in member chrome | P2 |

---

## Sequencing rationale

Phase 0 first: a broken revenue path outranks appearance. Phase 1 before any
code, because values chosen mid-build drift. Tokens (2) → motion (3) →
components (4) → pages (5–6), so each layer is stable before the next consumes
it. `TaxonomyCanvas` is deliberately last within Phase 5 — highest cost,
highest iteration, and the hero must not be blocked on it.

## Honest risks

1. **Colour alone cannot encode five domains.** Measured, not assumed: six of
   ten pairs fall under 1.5:1 in dichromacy, worst 1.08. E4.2 is the mitigation
   and is **not optional** — without it the re-hue improves the palette for
   most users while leaving colour-blind users exactly where they started.
2. **`TaxonomyCanvas` may not survive contact with reality.** 99 nodes can
   read as noise. E5.1 exists so the hero works without it.
3. **The type-scale rise can overflow real headlines.** D1.2 tests live copy;
   E2.4 catches what slips through.
4. **No live-user validation anywhere in this plan.** Everything rests on code
   inspection and competitor research. The Phase 0 fix especially should be
   confirmed against real drop-off once instrumented.
5. **Two taxonomies remain bridged by keyword matching.** Works today; a new
   section name not leading with a domain word silently loses its colour.
6. **Glass over the aurora is a contrast hazard.** `--stage-glow-3` is
   `#8ED2FB` (1.48:1); a panel drifting across that corner can fail text
   contrast even though the token set is compliant. D1.5 must test the moving
   worst case, not the static average.
