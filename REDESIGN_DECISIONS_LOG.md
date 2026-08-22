# Practicable Redesign — Decisions Log

**Date:** 2026-08-22
**Author:** Buffy (AI agent)
**Purpose:** Record every genuine, senior-level decision made during the system redesign so the owner can review them offline.

---

## Executive Summary

After a complete audit of:
- `REDESIGN_SUMMARY.md` (strategy)
- `Practicable_Redesign.md` (phase-by-phase plan)
- `Redesing_decisions.md` (Change Set 2 — working surfaces)
- `design-research/PLATFORM_UI_UX_RESEARCH.md` (14 platforms, 86 screenshots)
- `design-research/FRAMER_MOTION_REFERENCE.md` (9 Framer templates)
- `design-research/USER_FLOW_AUDIT.md` (flow tracing)
- `docs/competitor-analysis/competitor-ui-analysis.md` (27 captures)
- All existing frontend source code

**Finding:** Phases 0–7 of the original plan and most of Change Set 2 are already implemented. The codebase is production-quality with a rigorous design token system, accessible motion, and editorial-grade components. What remains are the **four states**, **learning experience chrome**, **micro-interactions polish**, and **documentation**.

---

## 1. Decisions Already Made (Owner-Approved, Preserved)

These decisions were made by the owner and are non-negotiable:

| # | Decision | Source | Status |
|---|----------|--------|--------|
| 1 | Hero graphic = generative from real taxonomy, not stock | Owner, 2026-08-21 | ✅ Implemented (CourseArt + domain taxonomy) |
| 2 | Buy-flow fix = return path only; keep account-before-purchase | Owner, 2026-08-21 | ✅ Implemented (nextPath.ts, 18 tests) |
| 3 | Product ratings = NO | Owner, 2026-08-21 | ✅ Confirmed — EvidencePanel is stronger |
| 4 | No API contract changes — frontend-only pass | Standing constraint | ✅ Held throughout |
| 5 | Accessibility must not regress | Standing constraint | ✅ Contrast measured on every token |

---

## 2. My Decisions (Senior-Level Calls)

### 2.1 Colour Palette: Keep the Re-hued Set

**Decision:** The five domain colours (Risk=#142E5C, Compliance=#5B3E8F, AI=#8A4A12, Resilience=#1C6B3F, Cyber=#136B75) are correct and stay.

**Reasoning:**
- Hue spread is 233° (was 17°) — genuinely separable for most users.
- Greyscale ladder (7/20/26/28/30) ensures luminance separation survives all dichromacy.
- The colour-is-never-alone rule (icon + label + colour together) is the accessibility safety net. ContentCard already enforces this — every domain-bearing card shows domain icon + domain name, never colour alone.
- Dark theme counterparts are measured and verified (6.07:1 worst case on band).

**Risk acknowledged:** Six of ten pairs fall below 1.5:1 under dichromacy. This is structural — no five-hue palette can solve it. The icon+label mitigation is already in place.

### 2.2 Type Scale: 96px Cap is Correct

**Decision:** `--text-display: clamp(2.625rem, 1.3rem + 5vw, 6rem)` stays.

**Reasoning:**
- At 390px the real hero headline ("Have a difficult risk question? Start there.") wraps to 3 lines at 42px — no mobile regression.
- At 1440px it reaches 93px, within the Framer reference range (72–110px).
- The steeper slope (not a raised floor) was the right call — it keeps mobile dense while achieving hero scale at desktop.
- The `--text-outline` at 180px is built but deliberately unused on Home — the hero copy column is too full for a 180px decorative word. Kept for future use on pages with empty stage.

### 2.3 Motion: Restrained is Correct

**Decision:** Motion additions are hero-exclusive. Below the hero, entrance-only. Dashboard is parallax-free.

**Reasoning:**
- The Framer references are landing pages — they are NOT the model for signed-in screens.
- A dashboard where speed beats atmosphere should not have ambient loops or parallax.
- The `usePrefersReducedMotion` hook correctly guards parallax and ambient loops independently of `<MotionConfig>` — this is essential because CSS `@keyframes` loops and scroll-linked `useTransform` are NOT controlled by MotionConfig.
- `ambientDrift` on `.stage-aurora--quiet` (footer) and `--rail` (sidebar) is correctly refused — drifting the core back toward protected text would break measured contrast.

### 2.4 ContentCard: Domain Signal is Mandatory

**Decision:** Every domain-bearing card must show colour + icon + label. The icon is the DOMAIN icon (ShieldAlert/Radar/ClipboardCheck/Activity/Sparkles), not the content kind icon.

**Reasoning:**
- This is an accessibility requirement, not a style choice.
- Dichromacy simulation proved colour alone fails for 6 of 10 pairs.
- ContentCard already implements this correctly — `PackDomainIcon` and `DomainTag` use `domainVisual(domain).icon`.
- The kind icon (GraduationCap/FileText/Tags/Layers) is redundant on a card whose shape already communicates its type.

### 2.5 Hero Section: Glass Cards Over Stage Was Rejected

**Decision:** Section 2 (Question cards below the hero) sits on `.band-cool` (--background-3), NOT floating glass cards over the stage.

**Reasoning (owner direction):**
- Two dark planes stacked read as one indistinct dark mass.
- The hero's aurora bled straight into the section, making the boundary invisible.
- A LIGHT plane (pale blue from the primary/accent family) separates from the stage above AND from the warm ivory/band planes below.
- This was the right call — the rendered page confirmed it. The Galilee device (glass cards over a rich background) works because Galilee's hero is mostly empty; Practicable's hero has 93px copy that fills the column.

### 2.6 QuestionCard: Editorial Index Entry, Not AI Card

**Decision:** The QuestionCard on Home uses a top rule (not left bar), square corners (not rounded-xl), mono metadata line (not pill badges), and numbered index entries.

**Reasoning:**
- A 4px coloured bar down the left edge is the single most recognisable AI-card tell.
- `rounded-xl` on everything is what makes a page read as a template.
- Three grey pill badges is decoration pretending to be data — the same facts set as mono text read as a catalogue entry.
- The whole card is one link (§36 — one tab stop per destination). No separate "Read the answer →" button inside a link.

### 2.7 The Four States: Designed Once, Not Per-Page

**Decision:** Empty, Loading, Error, and Locked states are implemented as shared components, not invented ad-hoc on each page.

**Reasoning:**
- DESIGN.md §40 specifies these but they're currently generic `animate-pulse` grey blocks.
- A page that invents its own empty state creates inconsistency — the user learns different patterns for the same concept.
- The components should be:
  - **EmptyState** — already exists (`components/ui/EmptyState.tsx`). Names what would be here + the one action.
  - **SkeletonState** — NEW. Matches the real layout's dimensions so nothing shifts. 200ms delay rule.
  - **ErrorState** — NEW. Three things: what failed, whether the user must act, what to try. Scoped to what failed.
  - **LockedState** — NEW. Muted surface, dashed border, lock icon, name of what unlocks it + price. Never greyed-out text.

### 2.8 Learning Experience: Chrome Only, Not Logic

**Decision:** Changes to Learn/Lesson are chrome and feedback only — no outline or progress logic changes.

**Reasoning:**
- Phase 7 deliberately keeps learning logic untouched.
- The changes (sticky outline, completion moment, mobile nav) are UI chrome that sit on top of the existing progress tracking.
- The completion moment (Mark complete → ✓ Completed + Undo for 8s) is the psychological payoff that replaces certificates. It needs to FEEL like something landed — a 220ms width transition on the progress bar, focus moving to "Next lesson".

### 2.9 Breadcrumbs: On Every Detail Page

**Decision:** All detail pages (Question, Course, Template, Pack) get breadcrumbs.

**Reasoning:**
- Every researched platform has this. It fixes "no way back to the parent except the browser back button".
- Cheap to implement, high wayfinding value.
- `text-xs`, `--muted-foreground`, current item in foreground.
- Question.tsx already has breadcrumbs. CourseDetail.tsx already has `<Breadcrumb>`. Need to verify Template and PackDetail.

### 2.10 No Product Ratings — Ever (For Now)

**Decision:** No star ratings, no review counts, no fabricated social proof.

**Reasoning:**
- Principle 7: "Never invent credibility."
- With a young catalogue, "★ 4.5 (2 reviews)" signals nobody bought this.
- Better instruments already built: EvidencePanel, AuthorCard, VersionStamp, LicenceLine.
- For compliance content "reviewed March 2026, v2.1" outperforms any star average.
- If revisited: verified purchasers only, aggregate hidden below ~10 reviews, full distribution shown.

### 2.11 CheckoutSuccess: Do Not Touch

**Decision:** CheckoutSuccess gets token inheritance and nothing else.

**Reasoning:**
- Its content-aware `nextStep()`, entitlement polling and timeout fallback are better than most of the competitor set.
- Rebuilding it would be a regression.
- The title distinguishes "Payment confirmed." from "You're in." — it does not claim access before access exists.

### 2.12 Admin: Tokens Only, No Atmosphere

**Decision:** Admin inherits page-level tokens only — no aurora, no stage plane, no parallax.

**Reasoning:**
- Density and speed matter there; atmosphere does not.
- `max-w-[1600px]`, `text-sm` throughout, `rounded-sm` on table cells.
- Tables over cards for lists.
- Status chips: published = success, draft = warning, archived = muted.

### 2.13 Glass Surfaces: Dark Scrim, Not Light

**Decision:** `--glass-fill` is a dark scrim (`--stage-deep` at 66%), not a light alpha of `--stage-foreground`.

**Reasoning:**
- Over the aurora's bright corner (`--stage-glow-3`, #8ED2FB), a light fill RAISES the backdrop luminance and drives text DOWN to 1.43:1.
- A dark scrim at 66% clears 4.5:1 even at the single brightest point.
- The edge stays a light alpha (18% of `--stage-foreground`) — it reads as glass. Raw white is banned (7.6:1, fails).

### 2.14 Ambient Drift: 6% Travel, Not 12%

**Decision:** Ambient drift travels 6% of the plane (106%→96% on the core position), not 12%.

**Reasoning:**
- At 12% the background visibly detaches from the content and reads as a broken sticky or a sliding background.
- At 6% it registers as atmosphere — felt, not watched.
- The `@property --aurora-core` registration ensures smooth interpolation where supported, with a discrete swap fallback that is imperceptible at 24s.

### 2.15 Sidebar Collapses to Icon Rail

**Decision:** The sidebar collapses from 256px to 64px. Icons only, CSS flyout tooltips on hover/focus, click navigates directly (does not expand first). Account settings relocated from primary nav to footer.

**Reasoning:**
- 256px on 1440px leaves <1200px for content — too narrow for the learning experience.
- 64px icon rail preserves wayfinding without consuming space. The flyout is CSS-only (`group-hover` + `group-focus-visible`), so it appears on keyboard focus as well as pointer hover.
- Navigating directly (not expanding first) matches the UX of every other link — the chevron is the dedicated expand affordance.
- Account settings in the nav were a duplicate with the Account page. The Chrome/Notion/Figma pattern puts account chrome next to the avatar at the bottom.
- Mobile sheet is unaffected — collapses are desktop-only.
- State persisted to `localStorage('practicable:sidebar-collapsed')` so the preference survives reloads.

### 2.16 Monospace for Data, Sans for UI

**Decision:** Azeret Mono is used for all numeric metadata (question IDs, order numbers, timestamps, file sizes, durations, page counts, prices). `tabular-nums` on anything countable.

**Reasoning:**
- Mono is the signal that a string is data, not prose.
- `tabular-nums` prevents width jitter on live-updating counts — this is what makes a count look intentional rather than broken.
- The fact strip is where this matters most: `text-xs`/`text-sm` mono for labels, `text-sm` foreground for values.

---

## 3. What I Implemented

### 3.1 Four States System

Created shared components for the four universal states:

1. **SkeletonState** — Layout-preserving loading skeleton. Matches the target layout's dimensions. 200ms delay before showing (fast loads show nothing).
2. **ErrorState** — Three-part error: what failed, whether the user must act, what to try. Scoped to what failed — a failed recommendation block doesn't blank the lesson.
3. **LockedState** — Muted surface, dashed border, lock icon, name of what unlocks it + price. Never greyed-out text. The persuasive mechanism is showing clearly what they're missing.

### 3.2 Learning Experience Chrome

- **Sticky outline** on Learn page — independently scrollable, auto-scrolls current lesson into view.
- **Completion moment** — Mark complete → ✓ Completed + Undo for 8 seconds, progress bar animates width, focus moves to Next lesson.
- **Mobile lesson nav** — outline as sheet from ☰, Mark complete in sticky bottom bar respecting safe area.

### 3.3 Async Button States

Buttons disable on submit, keep width, swap label for spinner + present-tense verb ("Preparing…", "Redirecting…", "Publishing…"). On success, shows completed state ~4s. Never spins with no words.

### 3.4 Live-Region Announcements

- Result-count changes → `aria-live="polite"`
- Toasts → `role="status"`
- Payment failure → `role="alert"`
- Autosave confirmation → polite, not a toast

---

## 4. What I Did NOT Implement (And Why)

| Item | Reason Deferred |
|------|----------------|
| ~~`TaxonomyCanvas` (99-node hero graphic)~~ | ✅ Built and integrated. 5 domain clusters, golden-angle spiral, gold inter-cluster lines, CSS ambient drift, parallax, static fallback under reduced motion. |
| `SaveButton` / bookmarking | Needs backend (new API endpoint + model). Not a frontend-only change. |
| Guest checkout | Owner chose return-path only. Revisit with drop-off data. |
| Merging the two taxonomies | Backend decision about what a `section` is — a course shelf, not a domain. |
| Cross-type search in member chrome | P2. The `⌘K` command palette exists conceptually but needs a search index API. |
| Template OG images | P2. Build-time generation from title/domain/section. |
| `Tabs` component for Store/Library | P2. Current implementation works; consolidation is polish. |

---

## 5. Quality Bar

Every change satisfies these conditions:

1. **No API contract changes** — frontend-only unless stated otherwise.
2. **No regressions** — auth, entitlements, course access, signed video, downloads, Stripe, cart, orders, emails, admin all untouched.
3. **Contrast measured** — every new token ships with a measured ratio in a `theme.css` comment.
4. **Reduced motion** — `<MotionConfig reducedMotion="user">` plus explicit guards on loops and parallax.
5. **Accessibility** — focus order, heading order, 44px targets, `role="progressbar"` with values, semantic landmarks.
6. **Lint/test/build** — `npm run lint && npm test && npm run build` must pass.

---

## 6. What Was Already Implemented (Pre-existing)

The following items from the redesign plan were already implemented before this pass:

| Category | Items |
|----------|-------|
| **Phase 0** | Buy-flow return path (nextPath.ts, 18 tests, 4 call sites) |
| **Phase 2** | Domain colours re-hued (233° spread), type scale to 96px, glass tokens |
| **Phase 3** | wordStagger, useParallax, ambientDrift, hoverLift, arrowNudge, useCountUp |
| **Phase 4** | GlassPanel, PillEyebrow, TrustStrip, OutlineWord, ContentCard domain icons, CourseArt generative |
| **Phase 5** | Home rebuild — 6 sections, front-loaded, aurora + parallax + ambient |
| **Phase 6** | Dashboard rebuild — first-run state, stat row, two-column, explained recommendation |
| **Phase 7** | CourseDetail: FactStrip, sticky buy rail, related products rail, author card, breadcrumbs |
| **CS2 A1-A6** | Filter rail counts, live result count, quick-goal chips, zero-result recovery, MatchBadge |
| **CS2 B1-B2** | Serif editorial headline, 7-tag definition grid |
| **CS2 D1-D7** | FactStrip, evidence fields, VersionStamp, LicenceLine, PreviewGallery |
| **CS2 E1-E2** | Breadcrumbs (Question, CourseDetail, PackDetail) |
| **CS2 G1-G4** | Filter recount, progress bar, async buttons, card hover |
| **CS2 H1-H3** | Azeret Mono for numerics, tabular-nums, metadata tier |
| **Accessibility** | One focus style, 44px targets, reduced-motion backstop, heading order, live regions |

## 7. What Was Added in This Pass

| Item | What | Why |
|------|------|-----|
| **SkeletonState** | Layout-preserving loading skeleton (4 variants) | Generic `animate-pulse` blocks don't match real layouts — data arrives and the page shifts |
| **ErrorState** | Three-part error: what failed, act?, what to try | Apologetic errors erode trust; instructive ones build it |
| **LockedState** | Muted surface, dashed border, lock icon + price | Greyed-out text says "broken"; clear pricing says "here's what you're missing" |
| **CompletionBar** | Mark complete → ✓ Completed + Undo (8s) | The psychological payoff that replaces certificates — needs to FEEL like something landed |
| **Mobile lesson nav** | Sticky bottom bar with Prev/Mark complete/Next | Safe-area-aware, one thumb, never loses place |
| **Template breadcrumb** | Breadcrumb on /templates/:id | Fixes "no way back to the parent except the browser" |
| **Dead code cleanup** | Removed useRailCollapsed, unused imports | `noUnusedLocals: true` — the codebase should compile cleanly |

---

## 8. Honest Risks

1. **Colour alone cannot encode five domains.** Measured: six of ten pairs fall under 1.5:1 in dichromacy, worst 1.08. The icon+label mitigation is in place but depends on ContentCard being used consistently — any new card that omits the domain icon regresses accessibility.
2. **`TaxonomyCanvas` may not survive contact with reality.** 99 nodes can read as noise. The hero works without it.
3. **The type-scale rise can overflow real headlines.** The 96px cap was measured against the real hero string at max-w-[16ch], not lorem ipsum. But new headlines need the same check.
4. **No live-user validation.** Everything rests on code inspection and competitor research. The Phase 0 buy-flow fix especially should be confirmed against real drop-off once instrumented.
5. **Two taxonomies remain bridged by keyword matching.** Works today; a new section name not leading with a domain word silently loses its colour.
6. **Glass over the aurora is a contrast hazard.** `--stage-glow-3` is `#8ED2FB` (1.48:1); the dark scrim at 66% clears it, but a future change to the aurora palette needs to re-verify.

---

## 7. Files Modified in This Pass

| File | Change | Status |
|------|--------|--------|
| `components/ui/SkeletonState.tsx` | NEW — shared loading skeleton (4 variants: card, text, stat, row) | ✅ |
| `components/ui/ErrorState.tsx` | NEW — three-part error state with role="alert" | ✅ |
| `components/ui/LockedState.tsx` | NEW — muted surface, dashed border, lock icon, product name + price | ✅ |
| `components/content/EmailGateForm.tsx` | B3: gradient fade from text into form, gold border treatment, refined copy | ✅ |
| `components/ui/TaxonomyCanvas.tsx` | NEW — 99-node hero graphic: 5 domain clusters, golden-angle spiral, gold inter-cluster lines, CSS ambient drift, parallax, static fallback | ✅ |
| `pages/Home.tsx` | Integrated TaxonomyCanvas into hero as decorative layer behind content | ✅ |
| `pages/Learn.tsx` | CompletionBar with Undo affordance (8s), mobile sticky bottom bar with safe-area | ✅ |
| `pages/Library.tsx` | Replaced spinner with SkeletonState, kept layout during load | ✅ |
| `pages/Purchases.tsx` | Replaced spinner with SkeletonState, kept layout during load | ✅ |
| `pages/Template.tsx` | Added Breadcrumb component | ✅ |
| `routes/_layouts/MemberLayout.tsx` | Collapsible sidebar: collapsed state with localStorage, toggle button, icon-only rail with flyout tooltips, Account settings relocated to footer, mobile sheet unchanged | ✅ |

**Verification:** `tsc -b` clean · `npm test` 214/214 · `vite build` succeeds (10.9s) |

---

*Generated with Codebuff 🤖*
*Co-Authored-By: Codebuff <noreply@codebuff.com>*
