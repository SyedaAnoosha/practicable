# Screen-by-Screen Implementation Plan: Elevating Design Within the System

`[REVISED 2026-08-14]` This plan originally proposed glassmorphism, continuously-looping ambient
motion, and a wider hover-lift than the app currently ships. Before touching any component, this
revision was checked against `docs/DESIGN.md` and the real code, and three things in the original
draft turned out to conflict with decisions the owner has already made and, in one case, already
enforced by reverting a shipped bug:

| Original idea | Conflicts with | Resolution |
|---|---|---|
| Glassmorphism (`.glass-panel`, frosted cards) everywhere | [DESIGN.md §5.2](../docs/DESIGN.md#52-what-premium-is-not--the-anti-pattern-list-decided) `[DECIDED]`: *"Glassmorphism or neon anywhere."* Still banned even after the 2026-08-11 liveliness pass un-banned gradients. [Contact.tsx:39-41](../frontend/src/pages/Contact.tsx#L39-L41) documents this exact pattern (`bg-card/70 backdrop-blur-xl`) being built, then ripped out. | Dropped. Owner confirmed 2026-08-14: stay in-system — deliver "premium" through the tools §5.3 already approved (token-based gradients, domain colour, deliberate one-shot motion, refined shadow/hover), not translucency. |
| `organic-drift` / shimmer keyframes looping forever on `.stage-aurora` / `.page-wash` | [DESIGN.md §39.2](../docs/DESIGN.md#392-principles): *"Nothing loops... No animated page-load sequence."* Both washes are documented in `theme.css` as **static paint by design** ("no reduced-motion branch" because there's nothing to reduce). | Dropped. Washes stay static. Motion is scoped to genuine state changes (hover, mount, filter toggle), never ambient background loops. |
| `.hover-lift` at `translateY(-4px)` | [DESIGN.md §39.3](../docs/DESIGN.md#393-the-examples): *"Card hover — 2px, no scale... Do not scale cards on hover."* The app already ships this correctly — `hover:-translate-y-0.5` (2px) + `hover:shadow-md` at [Home.tsx:538](../frontend/src/pages/Home.tsx#L538), [Dashboard.tsx:181](../frontend/src/pages/Dashboard.tsx#L181) and [:213](../frontend/src/pages/Dashboard.tsx#L213). | Corrected to 2px. The work becomes *consolidating* the repeated Tailwind string into one utility, not changing the distance. |

What's still true and still worth doing: the app under-uses the motion vocabulary and domain-colour
system it already has (`frontend/src/lib/motion.ts`, `--domain-*`), and a few interaction states
(filter chips, catalogue rows, sticky nav) can be more tactile without leaving the token layer or
the "nothing loops" rule. That's what the rest of this document scopes.

> [!IMPORTANT]
> **User Review Required**
> This revision trades "frosted, ambient" for "tactile, deliberate, in-system." Confirm this is the
> right trade before implementation starts — it's a materially different look from the original
> draft, not just a toned-down version of it.

## Design law checklist (apply to every phase below)

- No `backdrop-filter` / `bg-*/NN backdrop-blur-*` on cards, panels, or the finder box. The existing
  `backdrop-blur-sm` on sticky nav chrome ([Learn.tsx:430](../frontend/src/pages/Learn.tsx#L430),
  [MemberLayout.tsx:238](../frontend/src/routes/_layouts/MemberLayout.tsx#L238),
  [MarketingLayout.tsx:75](../frontend/src/routes/_layouts/MarketingLayout.tsx#L75)) is a functional
  scroll-affordance at 80–90% opacity, not a glass aesthetic — leave that pattern as the ceiling, don't extend it to content surfaces.
- No CSS `@keyframes` that runs `infinite` outside the two that already exist and are already unused
  in components (`gradient-drift`, dormant). Don't wire it up to `.stage-aurora` or `.page-wash`.
- Hover lift is 2px (`-translate-y-0.5`), never scale, never exceeding `shadow-md` → `shadow-lg`.
- New motion goes through `frontend/src/lib/motion.ts`'s existing vocabulary (`riseItem`,
  `riseItemSm`, `springItem`, `staggerContainer`/`authStagger`, `EASE_OUT_EXPO`) rather than inventing
  new durations/eases per component.
- Every animation collapses under `prefers-reduced-motion` — already true tree-wide via
  `<MotionConfig reducedMotion="user">` and the `theme.css` CSS backstop; new plain-CSS transitions
  don't need their own media query, new `@keyframes` would.
- Checkout and admin stay visually quiet — [DESIGN.md §3.7](../docs/DESIGN.md#37-visual-priority-decided) ranks commerce and admin lowest for design attention ("should be calm and boring, not a design priority in itself").

## Phase 1: Global Foundation (`theme.css`)

- **[ADD] `.hover-lift`** — consolidates the identical Tailwind string already duplicated at
  [Home.tsx:538](../frontend/src/pages/Home.tsx#L538), [Dashboard.tsx:181](../frontend/src/pages/Dashboard.tsx#L181),
  [Dashboard.tsx:213](../frontend/src/pages/Dashboard.tsx#L213), and elsewhere:
  ```css
  .hover-lift {
    transition: transform 150ms var(--ease-standard), box-shadow 150ms var(--ease-standard);
  }
  .hover-lift:hover {
    transform: translateY(-2px); /* §39.3: 2px, no scale */
    box-shadow: var(--shadow-md);
  }
  ```
  Same distance, same duration, same easing token already in use — this is a DRY pass, not a redesign.
  Existing call sites swap their inline Tailwind hover utilities for this class; no visual diff expected.
- **[ADD] `.hover-lift-domain`** — the one genuinely new visual idea in this phase: a card's shadow
  picks up its domain colour on hover instead of the generic neutral `shadow-md`, using the
  `--card-domain-color` custom property `QuestionCard` already sets at [Home.tsx:539](../frontend/src/pages/Home.tsx#L539):
  ```css
  .hover-lift-domain:hover {
    box-shadow: 0 10px 24px -8px color-mix(in srgb, var(--card-domain-color, var(--accent)) 35%, transparent);
  }
  ```
  Decorative shadow colour, not text — no contrast audit needed. Stays inside the two-colour family
  because `--domain-*` already is one (§5.3).
- **No `.glass-panel`, no `organic-drift` keyframes.** Explicitly out of scope per the table above.

## Phase 2: Landing Page (`Home.tsx`)

- **Hero (`.stage-aurora`)**: no change. It's documented as static paint in `theme.css` and stays that way.
- **Finder box** ([Home.tsx:343](../frontend/src/pages/Home.tsx#L343)): already `bg-stage-foreground/8 backdrop-blur-sm` —
  a near-opaque functional tint for legibility over the aurora, not a frosted card. No change.
- **`QuestionCard`** ([Home.tsx:531-569](../frontend/src/pages/Home.tsx#L531-L569)): swap its inline
  `hover:-translate-y-0.5 hover:shadow-md` for `.hover-lift-domain` (Phase 1). Net effect: the lift
  distance is unchanged, but the shadow now reads as the card's own domain colour instead of a flat
  grey — a real "premium" upgrade that stays entirely inside the token system.
- **Domain rows**: on hover, `transform: translateX(4px)` with a 150ms transition — a small, one-shot,
  non-looping state change, well inside the 500ms ceiling. Pair with `transition-colors` already used
  elsewhere so the row's text/icon colour and position move together.

## Phase 3: Catalogue Pages (`QuestionsCatalogue.tsx`, `CoursesCatalogue.tsx`, `Store.tsx`)

- **Page atmosphere**: `.page-wash` stays static (per Phase 1's law checklist) — no shimmer keyframe.
- **Filter chips** ([QuestionsCatalogue.tsx:318-372](../frontend/src/pages/QuestionsCatalogue.tsx#L318-L372),
  `aria-pressed` toggle buttons): replace the current CSS-only active-state colour swap with a
  `motion/react` press animation, `whileTap={{ scale: 0.98 }}` — the exact pattern already used for
  buttons in `motion.ts`'s vocabulary and explicitly listed as safe in
  [DESIGN.md §39.3](../docs/DESIGN.md#393-the-examples). No scale-on-hover, only on the press itself.
- **Mobile filter sheet**: stays on the standard Radix/shadcn overlay scrim already in place. Not
  upgraded to a blurred backdrop — an overlay scrim's job is to dim, and the existing near-opaque
  pattern from Phase 1's checklist is the ceiling for blur anywhere in this app.
- **`QuestionRow` hover**: replace a flat `bg-secondary/40` fill with a `color-mix(in srgb, var(--accent)
  6%, var(--card))` tint — still an opaque, token-built colour (not a translucency effect over content
  behind it), just a warmer, more deliberate hover colour than the current flat secondary fill.

## Phase 4: Member Dashboard & Library (`Dashboard.tsx`, `Library.tsx`)

- **Dashboard cards** ([Dashboard.tsx:181](../frontend/src/pages/Dashboard.tsx#L181),
  [:213](../frontend/src/pages/Dashboard.tsx#L213)): swap onto `.hover-lift` (Phase 1) — consolidation,
  not a new distance.
- **`ProgressBar`** ([Library.tsx:80-93](../frontend/src/pages/Library.tsx#L80-L93)): animate the fill
  width on mount with a CSS `transition: width 400ms var(--ease-entrance)` from `0%` to its real value
  — a state change (unknown progress → known progress), not a decorative loop, and it's the one place
  §5.2 explicitly allows progress motion ("off the one place progress is real").

## Phase 5: Detail & Learning Pages (`Question.tsx`, `Lesson.tsx`)

- **Content entrance**: apply the existing `staggerContainer` / `riseItemSm` pair from `motion.ts` to
  the question header, tag row, and first answer block — reusing the exact vocabulary already proven
  on the homepage hero, capped at the first ~6 elements per [DESIGN.md §39.3](../docs/DESIGN.md#393-the-examples)'s
  own example ("stagger the first 6 only, then render the rest immediately"). Not a new pattern; an
  extension of one that's already shipped and already reduced-motion-safe.
- **Sticky elements**: `Question.tsx` and `Lesson.tsx` don't currently have a sticky action bar or
  table of contents — the original plan assumed one existed. This is out of scope as a *design*
  change; it would be a new feature. **If** one is built later, it should follow the pattern already
  shipped and audited at [Learn.tsx:430](../frontend/src/pages/Learn.tsx#L430) (`bg-background/90
  backdrop-blur-sm`, near-opaque, functional) — not a new "glass panel" treatment.

## Phase 6: Authentication & Checkout (`SignIn.tsx`, `SignUp.tsx`, `ProductBuy.tsx`)

- **Auth forms**: no change. [SignIn.tsx:10-18](../frontend/src/pages/SignIn.tsx#L10-L18) deliberately
  removed the card wrapper ("a card inside a half-screen column is a box inside a box") and already
  uses `springItem`/`AuthField` stagger against the static aurora panel. Wrapping it back in a glass
  card would both violate §5.2 and undo a documented, deliberate decision.
- **Checkout summary (`ProductBuy.tsx`)**: no lift, no shadow escalation. [DESIGN.md §3.7](../docs/DESIGN.md#37-visual-priority-decided)
  ranks commerce lowest for design attention and asks for "calm and boring." The only change: ensure
  price/line-item rows use the same static, token-built surfaces as the rest of the app — no new
  treatment to design here.

## Verification Plan

1. **Anti-pattern grep**: before merging, run
   `grep -rn "backdrop-blur\|backdrop-filter" frontend/src` and confirm every hit is still one of the
   pre-existing sticky-nav call sites, not a new content card. Run
   `grep -rn "translate-y-1\|translateY(-4px)\|translateY(-6px)" frontend/src` to catch any hover
   distance that drifted past 2px.
2. **Visual inspection**: `npm run dev`, walk all 6 phases. Confirm the aurora and washes are static
   (no drift), `QuestionCard`'s hover shadow now tints toward its domain colour, filter chips give a
   tap-down spring, and the question page's header content stages in on load.
3. **Accessibility**: force `prefers-reduced-motion`, confirm the chip press and progress-bar fill
   collapse to instant per the existing global backstop; confirm nothing added here needs a new media
   query because nothing here is a raw `@keyframes` animation outside Motion's tree.
4. **Design-doc sync**: if any of Phase 1–6 changes stick and prove out, fold the durable ones back
   into `docs/DESIGN.md` (§36 cards, §39 motion) the way the 2026-08-11 liveliness pass did — this
   plan is scratch work, DESIGN.md is the system of record.
