# Practicable — Redesign record

A single merged record of the visual/UX redesign pass — the decisions, what actually shipped,
and what's still open, checked against the code rather than the plan.

**Status as of the last verification pass (2026-08-22): the redesign substantially shipped.**
Phases 0–7 of the original plan and most of the follow-on "Change Set 2" proposal are implemented and verified against a running stack, not just against `tsc`/`eslint`/tests — which matters, because that verification pass is what found the real defects (§4 below).

---

## 1. Why this happened, and the research behind it

The product read as "bland" against its price point. Diagnosis, from live-site research
(14 competitor platforms, 86 screenshots — Coursera, edX, Udemy, Skillshare, Kajabi,
Brilliant, Maven, MasterClass, O'Reilly, Pluralsight, Teachable, Thinkific, DataCamp,
LinkedIn Learning — plus 9 Framer motion references the owner nominated directly) plus a
source-level flow audit, had four measurable causes:

1. **The five domain colours were all the same colour.** `--domain-risk/cyber/compliance/resilience/ai` spanned only a 17° hue range — a mixed-domain grid read as one undifferentiated blue field despite being called "signature" colours.
2. **Display type stopped short of the reference.** `--text-display` capped at 68px; the researched references ran 72–110px.
3. **Motion had no ambient or positional layer.** Only entrance animations existed; once a section revealed, the page went completely static.
4. **Depth was uniform.** Cards were flat with hairline borders; the references almost always floated content over a rich background.

**Owner decisions, 2026-08-21** (non-negotiable, carried through the whole pass):
- Hero graphic = generative from the real taxonomy (5 domains, ~99 questions), not stock photography or generic 3D.
- Buy-flow fix = return-path only; keep account-before-purchase (no guest checkout).
- Product ratings = **no** — see §3.9.

---

## 2. What actually shipped

### 2.1 Phase 0 — the revenue path (done first, ahead of anything visual)

A logged-out visitor clicking any of 16 buy CTAs was bounced to sign-in and dumped on an
empty `/dashboard`, product forgotten — `CartDrawer` does a full `window.location.assign`,
which discards router state, so nothing survived the redirect. Fixed with a single validated
helper, `frontend/src/lib/utils/nextPath.ts`:

- `safeNextPath()` rejects absolute URLs, protocol-relative (`//evil.example`), backslash
  variants, `javascript:`/`data:`, bare relative paths, control-character bypasses of
  `startsWith('/')`, and auth routes themselves — then re-resolves against a throwaway origin
  as a second independent check. **This is a security requirement** (open-redirect
  prevention), not polish.
- Wired through `MemberLayout.tsx`'s guard, `SignIn.tsx`, `SignUp.tsx` (including the emailed
  confirmation link's `emailRedirectTo`, which silently dropped the destination otherwise),
  and `CartDrawer.tsx`.
- 18 tests, weighted to the open-redirect boundary.

### 2.2 Colour — the domains were re-hued

All five domain tokens changed from a 17°-wide blue cluster to a 111°+ spread while keeping
navy/gold/ivory untouched:

| Domain | Old | New | Hue |
|---|---|---|---|
| Risk (Enterprise & op.) | `#142E5C` | `#142E5C` *(kept — it was already fine)* | 218° |
| Cyber (Tech & security) | `#1B5FA8` | `#136B75` teal | 186° |
| Compliance (Regulatory) | `#1D6FA5` | `#5B3E8F` violet | 261° |
| Resilience (Continuity) | `#3D5A99` | `#1C6B3F` green | 147° |
| AI (Governance) | `#46618C` | `#8A4A12` rust | 28° |

Confirmed in `frontend/src/styles/theme.css`, both light and dark, all ≥4.5:1 on
`--background`/`--card`/`--band`.

**The finding that changed the requirement:** simulating dichromacy across all ten colour
pairs, six fell below 1.5:1 separation — the worst (Cyber/Resilience) was 1.08, effectively
identical. No five-hue palette survives colour-blindness on hue alone. **Domain identity
therefore has to be carried by colour + icon + label together, never colour alone** —
`ContentCard` was updated to surface the domain icon and label on every domain-bearing card,
not just questions, closing the gap `domainVisuals.ts` already had the data for.

### 2.3 Typography, motion, new components

- Display scale raised toward ~96px (from 68px), applied as a clamp not just a ceiling cap.
- `lib/motion.ts` extended: `wordStagger` (headline words), `useParallax`, `ambientDrift`
  (24s loop, background layers only), `hoverLift`, `arrowNudge`, `countUp`. All sit behind
  `<MotionConfig reducedMotion="user">` **plus an explicit stop-guard** for anything looping
  or scroll-linked — the reduced-motion backstop neutralises transforms but does not stop a
  CSS loop or scroll-linked parallax on its own.
- New components, confirmed present in `frontend/src/components/ui/`: `TaxonomyCanvas` (the
  hero graphic — real node/cluster counts driven by the live taxonomy, degrades to a static
  SVG under reduced motion, never renders a hardcoded count), `GlassPanel`, `PillEyebrow`,
  `TrustStrip` (real counts only — the fabricated-rating device this pass explicitly avoids),
  `OutlineWord`.
- `TypewriterTitle` removed — zero call sites, confirmed dead before deletion.

### 2.4 Home and Dashboard rebuilt

- **Home**: 7 sections → 6, richness front-loaded into the hero and question-entry sections,
  then calm. `TaxonomyCanvas` full-bleed on the stage plane behind a word-staggered ~96px H1.
- **Dashboard**: the resume panel and library grid were *both* conditional, so a brand-new
  account saw neither — the emptiest screen in the product, and exactly where the Phase 0 fix
  now delivers people on purpose. Rebuilt with a designed first-run fallback, a real stat row
  (`countUp` on genuine values only), and explained recommendations ("because you read X")
  rather than bare ranking. Motion here is deliberately restrained — `countUp`/`hoverLift`
  only, no parallax or ambient loop; a signed-in screen wants speed, not atmosphere.

### 2.5 Admin — collapsible sidebar

Sidebar collapses to a 64px icon rail (from a fixed 256px), `localStorage`-persisted,
CSS-only flyout tooltips that also appear on keyboard focus (not just hover). "Purchases" was
removed from the rail as a true duplicate of `/account/purchases` (`AccountPurchases.tsx` is
a four-line re-export of the same component); account settings moved to the footer beside
theme toggle and sign-out, matching the Chrome/Notion/Figma convention of separating "do work"
navigation from account chrome.

### 2.6 "Change Set 2" (the working-surfaces pass)

A follow-on proposal covering discovery (`/questions`), the question reading page, learning
chrome, commerce/evidence surfaces, wayfinding, the four UI states (empty/loading/error/
locked), micro-interactions, numeric/metadata discipline, dark-mode glass, and accessibility
polish. Per the final decisions log, **most of this was already implemented** by the time it
was audited — including the seven-tag definition grid, `FactStrip`, sticky buy rail, related
rail, breadcrumbs, the ⌘K palette, skip link, route announcer + focus-to-h1, and all five
re-hued domains in both themes. The three components that were *built but never wired up*
(`ErrorState`, `AuthorCard`, `LockedState` — see §4) are the reason "implemented" and "used"
had to be checked separately rather than taken on trust.

---

## 3. Standing decisions and constraints (still binding)

- **No API contract changes** — this was a frontend-only pass; the backend continues to
  enforce entitlement server-side regardless of client navigation changes.
- **Must not regress:** auth · entitlements · course access · signed video · downloads ·
  Stripe checkout · cart persistence (`practicable:cart`) · orders · emails · admin.
- **Every colour token ships with a measured contrast ratio** recorded as a `theme.css`
  comment — no unmeasured token.
- **Ambient/parallax motion needs its own explicit reduced-motion guard**, not just the
  `MotionConfig` backstop (§2.3).
- **`TaxonomyCanvas` must never render a hardcoded count** — it degrades honestly if the API
  returns something other than the expected node count.
- **Locked content is shown, never disabled-looking.** Reading what you don't have yet is the
  persuasive mechanism — dimming a locked syllabus does the opposite of the intent (the
  earlier `opacity-60`/low-contrast implementations of this were bugs, fixed — see §4).
- **§3.9 — product ratings: decided no.** No `Review`/`Rating` model existed at redesign time
  (reviews shipped later, in Week 5, deliberately gated below 8 — see `week5_report.md`). A
  young catalogue showing "★4.5 (2 reviews)" signals nobody bought this; a fake rating is
  worse than no rating. The stronger instruments already built — `EvidencePanel`,
  `AuthorCard`, `VersionStamp`, `LicenceLine` — outperform a star average for this audience.
- **Two taxonomies remain bridged by keyword matching, not merged.** Questions/packs carry
  `domain.name`; courses carry `section.name` from a separate table. `domainVisuals.ts`
  bridges them by leading keyword — works today, but a section name that doesn't lead with a
  domain word silently loses its colour. Merging the vocabularies is a backend decision about
  what a "section" is, deliberately left outside this pass.
- **Glass-over-aurora is a known contrast hazard, not a solved one.** `--stage-glow-3`
  (`#8ED2FB`) sits at 1.48:1 — a glass panel drifting across that corner is the failure case
  any new glass surface must be checked against, not just the static average.

---

## 4. Defects the verification pass found (invisible to `tsc`/`eslint`/the test suite)

The pattern worth remembering, stated in the addendum itself: **the suite was green the whole
time.** Everything below was found by rendering the pages, not by reading the code.

**The one to know:** `cn()` (the Tailwind-merge helper) was silently deleting every custom
font-size utility whenever it appeared alongside a text-colour class — `text-h1` isn't in
Tailwind's built-in size/colour classification, so it got misclassified as a colour and
dropped in a conflict. The question page's serif editorial headline — the product's stated
credibility anchor — was rendering at 16px instead of 56px, and every `text-display`,
`text-stat`, `text-h1..h4`, `text-lead`, `text-read` combined with a colour class had the same
silent failure. Fixed by registering the custom rungs with `extendTailwindMerge`; 17
regression tests, 14 of which are confirmed to fail against the prior implementation.

**Built, marked done, wired up nowhere:**
- `ErrorState` — zero call sites; `/questions`, `/courses`, `/templates`, `/packs` only
  destructured `data`/`isLoading`, so a failed fetch rendered a silently blank column.
- `AuthorCard` — zero call sites, and blocked upstream: `Author.bio` existed in the database
  but `CourseDetailOut` never serialised it.
- `LockedState` — zero call sites, and both real lock surfaces did the exact thing the spec
  forbids (`opacity-60` on locked lessons; ~2.3:1 contrast on the locked outline, under the
  4.5:1 floor).

**Other defects found by running the stack, not reading it:** `AdminMetrics` crashed the
entire metrics page on `Object.keys()` over a possibly-absent aggregate; the same page's test
fixture was snake_case against a camelCase API and passed anyway; `/courses` 500'd for the
whole catalogue on one video with a null `duration_seconds`; a pending migration (`025`)
blocked the API from starting at all; catalogue grids painted a visible "grey slab" behind
unfilled grid cells; revenue displayed as `17,700` instead of `A$177` (cents printed
unconverted, a 100× overstatement in the direction that flatters); the lesson outline never
auto-scrolled the current lesson into view; a network failure on `PackDetail` claimed the
product didn't exist.

**Corrections to the redesign's own earlier claims:** the hero's word-stagger split had
stripped spaces from its accessible name (a screen reader would announce it as one run-on
word); `Badge`'s `outline` variant was unreadable on the dark stage plane (1.16:1); backend
`test_metrics.py` had 12 pre-existing failures from a camelCase migration the tests were never
updated for.

**All of the above were fixed**, not just logged. State at the end of that pass: 235/235
frontend tests, 20/20 backend metrics tests, `tsc`/`eslint`/`vite build` all clean.

---

## 5. Confirmed still open

- **Gate 0 manual buy-flow check** — needs a human completing a real purchase, including
  following the emailed confirmation link. Never performed; code-path verified only.
- **`WELCOME15` discount code** — the banner advertises it, but whether it exists as an active
  Stripe Promotion Code was never confirmed at redesign time. If configuring it: uncheck both
  "limit the number of times this can be redeemed" boxes (Stripe's redemption limit is global,
  not per-customer — the first buyer would burn it for everyone); keep "Eligible for
  first-time order only" as the actual per-customer control.
- **Lighthouse baseline** — never run.
- **Templated OG images per content type** — not started; a shared link still renders as a
  bare URL.
- **`TaxonomyCanvas`'s long-term robustness** — 99 nodes risk reading as noise; not
  independently load-tested beyond the initial build.
- **"Undo" on lesson completion** — blocked on a backend un-complete endpoint that doesn't
  exist yet.

---

## 6. Provenance

This document consolidates six overlapping redesign drafts and the competitor/UX research
that fed them — 14 competitor platforms (86 live screenshots), 9 owner-nominated Framer
motion references, and a source-level user-flow audit — into one record. The originals and
the screenshot archives were working artefacts for producing the findings above; they have
served their purpose and are not carried forward independently of this summary.
