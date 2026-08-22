# Practicable — Redesign Strategy

**Status: strategy. Phase 0 (flow fixes, §8) is implemented; everything else
is still a plan.** This document is the complete strategy — tokens,
components, screens, additions and removals. The phased execution plan lives
in `Practicable_Redesign.md`.

**Inputs.** `design-research/PLATFORM_UI_UX_RESEARCH.md` (14 platforms, 86
live screenshots) · `design-research/FRAMER_MOTION_REFERENCE.md` (9 Framer
templates, owner-nominated motion brief) · `design-research/USER_FLOW_AUDIT.md`
(flow tracing) · direct inspection of the frontend.

**Owner decisions recorded 2026-08-21:**
1. Hero graphic = **generative from the real taxonomy** (5 domains, 99
   questions), not stock photography or AI-startup 3D.
2. Buy-flow fix = **return path only**; keep account-before-purchase.
3. Product ratings = **no** (see §9).

---

## 1. The diagnosis, restated precisely

"Bland" is not vagueness — it has four measurable causes in the code.

### 1.1 The five domain colours are all the same colour

`theme.css:283-287`:

```
--domain-risk:       #142E5C   deep navy-blue
--domain-cyber:      #1B5FA8   azure
--domain-compliance: #1D6FA5   steel blue, leaning cyan
--domain-resilience: #3D5A99   indigo-blue
--domain-ai:         #46618C   slate blue-grey
```

These are called "domain **signature** colours" and are wired through
`domainVisuals.ts` to every card, badge and artwork. **All five are blue.**
Four sit within roughly 25° of hue. A grid of mixed-domain cards therefore
reads as one undifferentiated blue field — the system is doing the work of
colour-coding while delivering none of the benefit.

This is the single largest, cheapest-to-fix cause of blandness.

### 1.2 Display type stops short of the reference

`--text-display` is `clamp(2.625rem, 1.9rem + 3.4vw, 4.25rem)` — **68px max**.
The Framer references run 72–110px, Utomic's outline word ~180px. The comment
at `theme.css:139` even records that 44px was "supporting-player size"; the
scale was raised once but not far enough.

### 1.3 Motion has no ambient or positional layer

`lib/motion.ts` is well-built but contains **only entrance animations** —
`staggerContainer`, `riseItem`, `riseItemSm`, `springItem`, `headerEnter`.
There is no parallax, no ambient loop, no word-level stagger. Once a section
has revealed, the page is completely static. The references are never fully
static: something in the background is always slowly moving.

### 1.4 Depth is uniform

Cards are flat with hairline borders on a flat field. The references almost
always float content **over** a rich background — Galilee's glass cards over
the valley being the clearest case. Practicable owns the right foundation
(`--stage` + `.stage-aurora`) but uses it on only three surfaces.

---

## 2. Design principles for this pass

Carried from the research, with one addition from the Framer brief.

1. **Facts on the surface** — a card answers the decision question without a click.
2. **Colour means something** — domain colour must actually distinguish domains.
3. **Density is respect** — professionals scan; do not pad.
4. **The artefact is the payoff** — the template/register is the product.
5. **The author is present** — one named practitioner, not a consortium.
6. **Progressive disclosure over vertical growth** — never solve blandness with length.
7. **Never invent credibility** — no fabricated ratings, urgency or counts.
8. **Front-load richness** *(new, from Galilee)* — a maximal hero, then calm.

---

## 3. Colour system

### 3.1 Keep unchanged

The core settlement is good and owner-approved. Ivory ground `#FBF9F4`,
midnight navy `--primary/--stage #10213E`, champagne gold in three shades
(`--gold` decorative, `--gold-strong #7C5C14` text-safe, `--gold-soft`),
accent blue `--accent #1D5FA8`, band plane, aurora paint. **No change.**

The discipline around these — `--stage` not inverting between themes,
`--gold` banned from text, contrast ratios recorded in comments — is a real
asset and must survive the redesign.

### 3.2 Change: re-hue the five domain colours

**The only palette change proposed.** Keep navy/gold/ivory exactly; give the
five domains genuinely separable hues at equivalent weight and contrast.

Measured 2026-08-21. Current hues span only **204-221 degrees** - a 17 degree
spread across five "signature" colours. The dark theme has the same defect
(196-229 degrees).

| Domain | Current | Proposed light | Hue | bg | card | band | Dark |
|---|---|---|---|---|---|---|---|
| Risk (Enterprise & op.) | `#142E5C` | `#142E5C` *(keep)* | 218 | 12.67 | 13.33 | 11.93 | `#7C9CD6` |
| Cyber (Tech & security) | `#1B5FA8` | `#1B6E7A` teal | 188 | 5.61 | 5.90 | 5.28 | `#4FB3C4` |
| Compliance (Regulatory) | `#1D6FA5` | `#6B4E9B` violet | 263 | 6.26 | 6.59 | 5.90 | `#A98BD6` |
| Resilience (Continuity) | `#3D5A99` | `#1F6B47` green | 152 | 6.14 | 6.46 | 5.78 | `#4FB584` |
| AI (Governance) | `#46618C` | `#8A3F16` rust | 22 | 7.12 | 7.49 | 6.71 | `#D9905A` |

Hue spread 17 -> **111 degrees**. Greyscale spread 52. All values clear 4.5:1
on `--background`, `--card` and `--band` in both themes.

**Finding that changes the requirement.** Simulating dichromacy across all ten
pairs, **six fall below 1.5:1 separation**; the worst (Cyber/Resilience) is
**1.08 - effectively identical**. An earlier AI candidate (`#A35A2A`) collapsed
onto Resilience at 1.02 under protanopia. This is structural: **no five-hue
palette survives dichromacy on hue alone.** Darkening AI to `#8A3F16` separates
it on luminance (which dichromacy does not affect) but does not solve the rest.

**Therefore domain identity must be carried by colour + icon + label together,
never colour alone.** `domainVisuals.ts` already maps a distinct icon per
domain (ShieldAlert / Radar / ClipboardCheck / Activity / Sparkles), but
`ContentCard` never uses it - its icon is keyed to content *kind*, and only
question cards show the domain name. Closing that gap is task E4.2 in
`Practicable_Redesign.md` and is **not optional**: without it the re-hue
improves the palette for most users while leaving colour-blind users exactly
where they started.

Constraints on the replacements: each must clear **4.5:1 on `--background`,
`--card` and `--band`**; each must have a tested dark-theme counterpart; none
may collide with `--accent` (interactive) or the success/warning/error family.
Contrast must be measured and recorded in `theme.css` comments in the same
style as the existing tokens.

**Blast radius is small** because the indirection already exists — every
consumer goes through `domainVisuals.ts` and the `--domain-*` tokens, so this
is a token-level edit, not a component sweep.

### 3.3 Add: surface-depth tokens

Three tokens to support floating/glass surfaces over the stage plane:

```
--glass-fill    stage-foreground at ~8%   panel fill over the aurora
--glass-edge    stage-foreground at ~18%  its hairline
--glass-blur    12px                      backdrop-filter amount
```

Alphas of `--stage-foreground`, never of raw white — §7.6 bans raw white, and
the stage foreground carries the plane's warm/cool cast in each theme.

### 3.4 Remove

- Nothing from the palette. No token is unused or wrong; the domain family is
  re-hued in place rather than deleted.

---

## 4. Typography

| Token | Current max | Proposed max | Note |
|---|---|---|---|
| `--text-display` | 68px | **~96px** | Hero only. Raise the whole clamp, not just the cap |
| `--text-h1` | 48px | 56px | Page titles |
| `--text-h2` | 34px | 38px | Section openers |
| `--text-outline` | — | **~180px** *(new)* | Utomic device: oversized outline word, decorative, `aria-hidden` |
| everything else | — | unchanged | Body/read/sm/xs/stat are well-tuned |

Families stay: Schibsted Grotesk (interface), Newsreader (long-form reading),
Azeret Mono (numeric metadata). This pairing is distinctive and correct.

`--text-outline` must never carry meaning — it is decoration behind real
content and gets `aria-hidden="true"`.

---

## 5. Motion system

Extends `lib/motion.ts`. **Every addition sits behind the existing
`<MotionConfig reducedMotion="user">` backstop** (`main.tsx`) plus the CSS
duration collapse in `theme.css`.

### 5.1 Keep

`EASE_OUT_EXPO`, `staggerContainer`, `riseItem`, `riseItemSm`, `springItem`,
`authStagger`, `inViewOnce`, `headerEnter`. The house curve and the 0.12s
stagger are good; nothing here is replaced.

### 5.2 Add

| Name | Behaviour | Used by |
|---|---|---|
| `wordStagger` | Headline words rise + fade, ~45ms apart | Hero H1 |
| `useParallax(speed)` | Background translates slower than scroll | Hero aurora, band graphics |
| `ambientDrift` | 20–30s looped gradient drift, background only | Stage plane |
| `hoverLift` | 2–4px rise + shadow bloom, 150ms | Cards |
| `arrowNudge` | Arrow translates 3px on hover | Pill CTAs |
| `countUp` | Number counts to value once in view | Stat tiles |

### 5.3 Rules

- Ambient loops run **only** on background layers, never on or near text.
- Parallax and ambient loops **stop entirely** under `prefers-reduced-motion`
  — continuous background movement is a vestibular trigger. The existing
  transform-neutralising backstop is not sufficient for a looping animation;
  it needs its own explicit guard.
- One reveal per section, `once: true`. No re-animation on scroll-back.
- `countUp` animates a real number only; it never counts to a fabricated one.

---

## 6. Components

### 6.1 Keep as-is (23)

`Accordion` · `AuthField` · `AuthorCard` · `Badge` · `Breadcrumb` · `Button` ·
`Card` · `ContentCard` · `CornerFrame` · `EmptyState` · `FactStrip` ·
`FieldError` · `Input` · `Meta` · `PageTitle` · `ProgressBar` · `RelatedRail` ·
`SectionHeading` · `ShowMore` · `StatTiles` · `StatusDot` · `ThemeToggle` ·
plus all `product/*` evidence components.

The evidence layer (`EvidencePanel`, `LicenceLine`, `PreviewGallery`,
`VersionStamp`, `WhyThis`) is Practicable's strongest trust asset and is
**more valuable than any rating system** — see §9.

### 6.2 Restyle (no API change)

| Component | Change |
|---|---|
| `ContentCard` | Re-hued domain accent; `hoverLift`; domain tint wash on the artwork block |
| `CourseArt` | Replace the flat provisional panel with a generative duotone using the re-hued domain colour |
| `StatTiles` | `countUp` on entry; mono numerals |
| `Button` | Add `pill` variant — dark pill + circular arrow chip, with `arrowNudge` |
| `Card` | Add `glass` variant using the §3.3 tokens, for use over the stage plane |

### 6.3 Add (7)

| Component | Purpose | Source |
|---|---|---|
| `TaxonomyCanvas` | **The hero graphic.** 99 nodes in 5 domain clusters, gold connective lines, slow ambient drift, parallax | Owner decision; Utomic's force, our data |
| `GlassPanel` | Frosted surface floating over the stage | Galilee |
| `PillEyebrow` | Bordered lozenge section label | All nine refs |
| `TrustStrip` | Honest facts under the hero CTA — real counts only | Parley/FintechX device, our constraint |
| `OutlineWord` | Oversized decorative word, `aria-hidden` | Utomic |
| `Tabs` | Consolidates Store/Library sections | Research P2 |
| `SaveButton` | Bookmarking (needs backend) | Research P2 — defer |

`TaxonomyCanvas` is the piece that makes the page unmistakably Practicable's
rather than a well-executed template. It must be **driven by the real API
counts**, degrade to a static SVG under reduced motion, and never render a
number the database cannot support.

### 6.4 Remove

| Component | Reason |
|---|---|
| `TypewriterTitle` | Typewriter effects delay reading, re-animate on revisit, and read as consumer-playful. Superseded by `wordStagger`. Verify call sites before deleting. |

Nothing else is dead. This is a small removal list because the component
layer is genuinely in good shape — the problem is tokens and motion, not
component sprawl.

---

## 7. Screens

### 7.1 Home — rebuild from scratch *(owner-directed)*

**Current problem.** Seven sections with correct band rhythm, but a hero that
under-uses the stage plane, 68px display type, no parallax, no ambient
motion, and uniform richness across all seven sections.

**New structure — 6 sections, front-loaded:**

```
1  Hero            TaxonomyCanvas full-bleed on stage; 96px word-staggered H1;
                   question search; TrustStrip (real counts); parallax + ambient
2  Question entry  Glass cards floating over the lower hero gradient (Galilee)
3  How it works    CALM band — Question → Answer → Learning → Template → Apply
4  Products        Courses / templates / packs, re-hued domain colour, 3-col
5  Author          AuthorCard — the credibility asset, given real space
6  Free pack CTA   Single clear close
```

Down from 7 sections, and shorter overall: richness is concentrated in 1–2,
then the page goes quiet. This directly implements principle 8 and satisfies
"visually rich but reasonably compact."

**Removed:** the separate stats strip (folded into `TrustStrip`), and one
product section (merged into a single 3-column band).

### 7.2 Dashboard — rebuild from scratch *(owner-directed)*

**Current problem.** The resume panel (`:202`) and library grid (`:401`) are
both conditional, so **a new account sees neither** — the emptiest screen in
the product, and exactly where the broken buy flow (§8) currently dumps
people.

**New structure:**

```
1  Greeting + resume   Stage-plane panel, named next lesson, progress.
                       Falls back to a designed first-run state, never nothing.
2  Stat row            countUp on real values only
3  Two-column          Left: library w/ progress · Right: routed next steps
4  Recommended         Explained recommendations ("because you read X"),
                       not bare ranking — LinkedIn Learning's device
```

**Critical rule:** every panel needs a designed empty state. The dashboard's
job is to give a reason to return; for a new account it must orient rather
than present a blank field.

Motion here is **restrained** — `countUp` and `hoverLift` only. No parallax,
no ambient loop. Signed-in users want speed, not atmosphere; the Framer
references are landing pages and are not the model for this screen.

### 7.3 Other screens — restyle, do not rebuild

These already follow the blueprint (`FactStrip`, sticky rails, accordions,
breadcrumbs). They inherit the re-hued domain colour, `hoverLift`, and the
new `Button` pill variant, and otherwise stay:

`Question` · `QuestionsCatalogue` · `CourseDetail` · `CoursesCatalogue` ·
`Template` · `TemplatesCatalogue` · `PackDetail` · `PacksCatalogue` ·
`Store` · `ProductBuy` · `Library` · `Learn` · `Lesson` · `Purchases` ·
`CheckoutSuccess` · auth pages.

**`CheckoutSuccess` must not be touched beyond token inheritance.** Its
content-aware `nextStep()`, entitlement polling and timeout fallback are
better than most of the competitor set.

**Admin** gets token inheritance only — no restructure. Density and speed
matter there; atmosphere does not.

---

## 8. Flow fixes (from USER_FLOW_AUDIT.md) — ✅ IMPLEMENTED 2026-08-21

Not cosmetic. Shipped ahead of the visual work, because a broken revenue path
outranks appearance.

| # | Fix | Files | Status |
|---|---|---|---|
| 1 | Record return path on the auth redirect | `MemberLayout.tsx` | ✅ |
| 2 | Honour it after sign-in | `SignIn.tsx` | ✅ |
| 3 | Honour it after sign-up, incl. confirmation email | `SignUp.tsx` | ✅ |
| 4 | Validate `next` as same-origin relative path | `lib/utils/nextPath.ts` | ✅ 18 tests |
| 5 | Fix motion artifact in screenshot capture | `capture-practicable.js` | ✅ |
| 6 | Cart drawer returns to the originating page | `CartDrawer.tsx` | ✅ |

Verified: `eslint src` clean · `vitest run` 61/61 · `vite build` succeeds ·
`tsc --noEmit` clean. Manual end-to-end verification against a running stack
is still owed — see `Practicable_Redesign.md` Gate 0.

Currently a logged-out user clicking any of **16 buy CTAs** is bounced to
sign-in and delivered to an empty `/dashboard`, product forgotten. Use
`?next=` rather than route state — `CartDrawer` performs a full page load via
`window.location.assign`, which discards route state.

**Item 4 is a security requirement, not polish.** An unvalidated `next`
accepting an absolute URL is an open redirect. Accept only values starting
with a single `/` and not `//`.

---

## 9. Product ratings — decided: no

Asked directly; answering here since it is a design-system question.

There is no `Review`/`Rating` model in the backend, so this would be net-new.
Against it:

- Research line 82: *"A fake 4.7 is worse than no rating."*
- With a young catalogue, "★ 4.5 (2 reviews)" signals *nobody bought this*.
  Ratings build trust at volume and destroy it below volume.
- Principle 7 forbids it, and FintechX's `4.9/5` hero strip is precisely the
  device being declined.

Better instruments already built: `EvidencePanel`, `AuthorCard`,
`VersionStamp`, `LicenceLine`. For compliance content *"reviewed March 2026,
v2.1"* outperforms any star average.

**If revisited later:** verified purchasers only, aggregate hidden below ~10
reviews, full distribution shown including the 1-star bar (research line 1269
— a rating that hides its tail reads as marketing). Maven's named testimonials
with job titles are the stronger pattern for this audience.

---

## 10. Priority

| P | Item | Effort | Why |
|---|---|---|---|
| **P0** | Re-hue domain colours (§3.2) | Low | Biggest bland-fix per line changed |
| **P0** | Display scale to ~96px (§4) | Low | Largest measurable gap vs reference |
| **P0** | Motion additions (§5.2) | Medium | Parallax/ambient/word-stagger |
| **P0** | Home rebuild (§7.1) | High | Owner-directed |
| **P0** | Dashboard rebuild (§7.2) | Medium | Owner-directed; fixes first-run |
| ~~P0~~ | ~~Buy-flow return path (§8)~~ | — | ✅ **Done** 2026-08-21 |
| ~~P0~~ | ~~Capture-script fix (§8.5)~~ | — | ✅ **Done** 2026-08-21 |
| **P1** | `TaxonomyCanvas` (§6.3) | High | Makes it ours, not a template |
| **P1** | `GlassPanel`, `PillEyebrow`, `TrustStrip`, `OutlineWord` | Medium | Framer devices |
| **P1** | `ContentCard` / `CourseArt` restyle | Medium | Domain colour becomes visible |
| **P2** | `Tabs`; remove `TypewriterTitle` | Low | Consolidation |
| **P3** | `SaveButton` | High | Needs backend |

---

## 11. Preserved — must not regress

Auth · entitlements · course access · signed video · downloads · Stripe
checkout · cart persistence (`practicable:cart`) · orders · emails · admin ·
all API contracts. This is a frontend pass; §8 changes client-side
navigation only, and the API continues to enforce entitlement server-side.

**Accessibility must not regress**: measured contrast on every new token, one
focus style, heading order, 44px touch targets, `role="progressbar"` with
values, semantic landmarks, and the reduced-motion backstop extended to cover
the new looping animations.

---

## 12. Known limitations

1. **Two taxonomies.** Questions/packs carry `domain.name`
   (`Risk (Enterprise & op.)`); courses carry `section.name` from a separate
   table (`Risk Management`). `domainVisuals.ts` currently bridges this with
   keyword matching. It works, but merging the vocabularies is a backend
   decision about what a section *is* — a course shelf, not a domain — and is
   outside this pass.
2. **`TaxonomyCanvas` cost.** The most expensive item and the one most likely
   to need iteration. Ship the Home rebuild with the aurora + `OutlineWord`
   first so the page is never blocked on it.
3. **Practicable screenshots must be re-captured.** The capture script is
   fixed (§8), but the existing PNGs in `screenshots/_practicable/` predate
   the fix and are still the blank-below-fold set. Re-run before using them
   as before/after evidence.
4. **No live-user validation.** Every claim here is from code inspection and
   competitor research, not usage data. The buy-flow fix in particular should
   be verified against real drop-off once instrumented.
5. **Dark-theme values for the re-hued domains are unspecified** — each needs
   a measured counterpart, not an automatic lightening.
