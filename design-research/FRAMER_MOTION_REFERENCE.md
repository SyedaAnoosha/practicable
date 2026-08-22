# Framer Reference Analysis — Motion & Graphics Direction

Owner direction, 2026-08-21: *"the 10 framer links are the actual design
motion animation graphics i want."*

These URLs sat unattributed at the end of `PLATFORM_UI_UX_RESEARCH.md`. They
are the motion/graphics brief, not stray notes.

**Method.** WebFetch returns only copy for these — Framer renders through JS.
Captured with `capture-framer.js` at 1440×900: a hero shot at rest, and a
second after driving the scroll through four viewports so
IntersectionObserver reveals actually fire. 9 of 10 captured; the tenth link
was the Framer marketplace index, not a template.

Screenshots: `screenshots/_framer-refs/`.

---

## 1. What these nine actually have in common

Reading them together, the shared devices are consistent — and none of them
is "add more sections."

### 1.1 The hero owns a full-bleed graphic

Every one. Not a decorative flourish beside text — the graphic **is** the
hero, and the type sits on top of it.

| Template | Hero graphic |
|---|---|
| Parley | Painterly desert landscape, inset with a large radius, warm ochre/rust |
| Verity | Near-black with a cyan volumetric light sweep from lower-left |
| Galilee | Photographic valley, washed to near-sepia, cards floating over it |
| FintechX | Photographic sky + grass, product UI rising from the bottom edge |
| Utomic | 3D contour-line sculpture on a violet gradient, huge outline word behind |

**The device that recurs most: content floats *over* a rich background**, at
partial opacity or with a blur, rather than sitting in a bordered box on a
flat field. Galilee's four glass cards over the valley photo is the clearest
instance.

### 1.2 Typography is much larger than ours

Display type runs roughly **72–110px** at 1440. Utomic's outline word is
~180px. All are tight-tracked, mostly a geometric/grotesque sans, with
occasional italic emphasis inside the headline (Parley's *"with"* / *"you"*).

Ours currently sets its H1 near 48–56px after the scale was reduced 25–30%.
**This is the single biggest measurable gap.**

### 1.3 Motion vocabulary

Consistent and restrained — this is *not* a case for animating everything:

1. **Entrance** — headline words rise + fade in sequence, ~40–60ms stagger.
2. **Scroll reveal** — sections rise ~24–32px and fade at ~15% visibility,
   once. *(We already do exactly this.)*
3. **Parallax** — background moves slower than content. Galilee and FintechX
   both do it; **we do not.**
4. **Ambient loop** — the only continuously-moving thing, and always in the
   background: Verity's light sweep, Utomic's gradient drift. Never on text.
5. **Hover** — 2–4px lift, slight shadow bloom, arrow translate on buttons.
6. **Product-UI float** — a mock interface rising past the fold edge
   (FintechX, Galilee), signalling "there is a real product here."

### 1.4 Section rhythm

Alternating full-bleed graphic bands against quiet neutral bands. Galilee's
scrolled shot is instructive: after a maximal hero it drops to a **calm
two-column feature** — tinted panel left, heading + prose + text link right,
huge whitespace. The richness is *front-loaded*, not uniform.

### 1.5 Small consistent devices

- **Pill eyebrow** above section headings (`FEATURES`, `FALL RELEASE`) —
  bordered lozenge, uppercase, tracked, small. We have `.eyebrow` already.
- **Trust strip** directly under the hero CTA — Parley's logo row, FintechX's
  `4.9/5 · Bank-level security · Real-time AI insights` with icons.
- **Dark pill CTA** with a contrasting circular arrow chip inside it.
- **Rounded-inset hero** — Parley insets the hero graphic from the page edge
  with a ~16px radius rather than bleeding to the viewport edge.

---

## 2. The tension — and how to resolve it

**These are all SaaS marketing sites. Practicable is a learning platform for
risk practitioners.** Adopting them wholesale conflicts with findings the
research document already established:

- §1 "What Practicable must NOT copy" warns against marketing theatre.
- Principle 7: *"Never invent credibility."* FintechX's `4.9/5 Rating` is
  exactly the fabricated social proof ruled out — and the same reason the
  ratings question was answered *no* earlier today.
- The audience judges by evidence, not polish. A hero that looks like an AI
  startup's launch page can *reduce* credibility with a head of risk.

There is also a scope distinction worth stating plainly: **these templates
are all landing pages.** None shows a dashboard, a course player, a
catalogue, or a checkout. They are a legitimate reference for the homepage
and for the motion system; they are *not* a reference for the signed-in
product, where density and speed matter more than atmosphere.

### The resolution

Take the **devices**, not the **register**:

| Take | Leave |
|---|---|
| Full-bleed hero graphic, type over it | Stock photography / AI-startup 3D |
| 72–110px display type | Consumer-playful voice |
| Parallax + ambient background loop | Looping motion anywhere near text |
| Glass cards floating over the graphic | Fabricated rating strips |
| Pill eyebrows, dark pill CTA + arrow chip | Countdown/urgency devices |
| Front-loaded richness, calm bands after | Uniform maximalism on every section |
| Product-UI float | Marketing-site information density |

**The graphic must be Practicable's own.** The strongest option is a
generative/abstract treatment of the product's actual substance — the
five-domain taxonomy, the 99-question collection — rendered in the existing
navy/gold/ivory system. That gets Utomic's visual force without borrowing
Utomic's meaning, and it stays honest: the hero depicts what is really there.

The existing `--stage` navy plane with `.stage-aurora` is already the right
foundation. It is currently used on three surfaces and is too quiet; the
reference shows it should be **more atmospheric, parallaxed, and much bigger
in type.**

---

## 3. Concrete deltas against what we ship today

Measured against `pages/Home.tsx` and `styles/theme.css`:

| # | Change | Evidence | Effort |
|---|---|---|---|
| 1 | Display scale to ~72–96px at ≥1024px | All nine; ours ~48–56 | Low |
| 2 | Parallax on the hero aurora | Galilee, FintechX | Low |
| 3 | Ambient loop in the stage background | Verity, Utomic | Low |
| 4 | Word-level staggered headline entrance | All nine; ours fades whole blocks | Low |
| 5 | Glass cards floating over the hero plane | Galilee | Medium |
| 6 | Honest trust strip under the CTA (real counts only) | Parley, FintechX | Low |
| 7 | Dark pill CTA with arrow chip | Parley, Galilee, FintechX | Low |
| 8 | Own hero graphic from the domain taxonomy | Utomic's force, our substance | **High** |
| 9 | Front-load richness; keep later bands calm | Galilee scrolled | Medium |
| 10 | Product-UI float showing the real interface | FintechX, Galilee | Medium |

Items 1–4 and 7 are cheap and deliver most of the visible change. Item 8 is
the one that makes the page unmistakably Practicable's rather than a
well-executed template.

**Accessibility constraint that does not bend:** every motion above must sit
behind the existing `<MotionConfig>` reduced-motion backstop
(`lib/motion.ts:6`). Ambient loops and parallax must stop entirely under
`prefers-reduced-motion: reduce` — a continuously-moving background is a
vestibular trigger, and the blueprint's accessibility rules say do not
regress.
