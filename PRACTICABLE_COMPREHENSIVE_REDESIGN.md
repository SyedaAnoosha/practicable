I'll synthesize the existing research in the knowledge base, then produce the comprehensive screen-by-screen, component-by-component redesign document.

## Research phase

I've reviewed the full knowledge base. The research foundation already exists across four documents: `PLATFORM_UI_UX_RESEARCH.md` (14 platforms, 86 captures), `FRAMER_MOTION_REFERENCE.md` (9 templates), `USER_FLOW_AUDIT.md`, and `competitor-ui-analysis.md`. I'll synthesize those into design-driving insights rather than repeat them, then build the redesign on top.

Let me write the document to disk so it persists alongside the project docs.

```markdown
# PRACTICABLE
## Comprehensive Screen-by-Screen, Component-by-Component Redesign
**Version 1.0 · Redesign Research → Design System → Screens**
**Prepared for:** Effective Risk Management
**Supersedes:** DESIGN.md v2.4 screen specs (retained as token source of truth)
```

---

# PART I — RESEARCH SYNTHESIS

## 1.1 What the competitive research actually found

Fourteen platforms were captured live (86 screenshots). The findings below are the ones that change design decisions — not the ones that describe.

### The five load-bearing patterns (appear on ≥3 platforms)

| Pattern | Where it appears | What it does | Practicable application |
|---|---|---|---|
| **Fact strip** | edX, Coursera, DataCamp | 3–5 icon+value pairs in one row under the title | The purchase decision, surfaced before any prose. **Highest-value addition.** |
| **Sticky buy card** | Udemy, Coursera, DataCamp, Pluralsight | Price + CTA + inclusions in one bordered box that follows scroll | Applied to course, template, and pack detail pages |
| **Curriculum accordion with counts** | Udemy, DataCamp | Collapsed modules showing "9 lectures · 37 min" | Course detail syllabus |
| **Author-as-authority** | MasterClass, Maven, LinkedIn Learning | Photo + name + credential line above content | The author is Practicable's single strongest trust asset — currently near-invisible |
| **Currency / version stamps** | O'Reilly, Pluralsight | "Reviewed March 2026 · v2.1" on professional content | Critical for risk/compliance content — trust signal, currently buried |

### The density insight that reframes everything

The blandness is **not** a spacing problem. DataCamp's catalogue runs on a **two-column** grid yet reads denser than Practicable's two-column grid — because density comes from **card anatomy**, not column count. DataCamp packs seven facts per card in ~150px of height. Practicable's cards carry an eyebrow, a title, and a muted line.

> **The fix is metadata richness per card, not more columns.**

### The four measurable causes of blandness (from the source audit)

1. **Five domain colors were all blue** — a 17° hue spread doing the work of color-coding while delivering none of the benefit. **Re-hued to five distinct families.**
2. **Display type topped out at 44px** — supporting-player size for a desktop marketing headline. **Restored toward 96px.**
3. **No ambient or positional motion** — pages went fully static after reveal. **Parallax + ambient drift added to hero only.**
4. **Depth was uniform** — flat cards with hairline borders on a flat field. **Layered surfaces + tinted panels added.**

### What NOT to copy

| Anti-pattern | Why rejected |
|---|---|
| Fake star ratings / review counts | A young product with 2 reviews signals "nobody bought this." Principle 7: never invent credibility. |
| Discount urgency ("40% off, ends Aug 12") | Practicable sells one-time professional resources to practitioners who expense them. Urgency damages the "private bank" register. |
| Skillshare's slab architecture | 8,397px of alternating full-width panels — the exact §15A failure. |
| Everything-is-a-rounded-card | Reads as a stack of boxes, not a designed hierarchy. |
| Generic course-marketplace look | Practicable is a question-first reference instrument, not a course catalog. |
| Cohort scarcity (Maven) | Content is evergreen and self-serve; artificial scarcity would be dishonest. |

## 1.2 The user, restated from research

**A risk manager, three coffees into a Tuesday, with a specific problem and roughly four minutes of patience.**

- Searching, not browsing
- Judging credibility in ~5 seconds on typography, density, and confidence
- Possibly on a phone
- Possibly expensing the purchase → needs a receipt with a real company name
- Not impressed by animation. Impressed by a clear answer, a visible price, and a page that doesn't waste their time.

**The one test:** *A stranger finds the site, understands within seconds what it is and who it is for, buys something, receives it, and learns from it — without anyone helping them.*

## 1.3 The product model (the loop every screen serves)

```
I have a question
      ↓
I find the question          ← discovery (homepage finder, /questions)
      ↓
I understand the answer      ← question detail (free)
      ↓
I see what else would help   ← related template/course (buy surface)
      ↓
I buy it, or start learning  ← commerce → learning
      ↓
I use it at work this week   ← template download / lesson
      ↓
I come back with another question
```

## 1.4 The commercial model (four lines, from §28.0)

| What | Access | Where enforced |
|---|---|---|
| All 100 question bodies | Free to everyone, no account | API always returns body |
| Risk Register Template | Free, email requested | `templates.is_free` |
| Every other template | Paid | entitlements → product_contents |
| Courses (all lessons) | Paid, no free preview | entitlements → product_contents |

## 1.5 Information-density benchmarks (measured from captures)

| Platform | Detail-page height | Above-the-fold facts | Verdict |
|---|---|---|---|
| Udemy | 3,025px | 8 facts + video preview | **Best above-the-fold** |
| Coursera | 6,749px | Fact strip (4 criteria) | Best fact strip |
| edX | 6,943px | Fact strip below fold | Cleanest fact strip, but buried |
| Skillshare | 8,397px | Headline + signup only | Anti-pattern |

**Target:** Udemy's above-the-fold density + edX's clean fact strip, at half the height.

---

# PART II — DESIGN DIRECTION

## 2.1 Brand personality

Practicable should feel: **authoritative, practical, editorial, dense, quietly premium, legible under pressure.**

It should read like **a well-made professional handbook that happens to be software** — closer to the Financial Times or a Lloyd's market publication than to a course marketplace.

It should **not** feel: playful, gamified, urgent, salesy, enterprise-generic, minimal-for-its-own-sake, or like a generic LMS / corporate dashboard / landing-page template.

## 2.2 Design principles (in priority order)

1. **Facts on the surface** — a card answers the decision question without a click.
2. **Color means something** — domain, state, tier. Never decoration.
3. **Density is respect** — professionals scan; do not pad.
4. **The artifact is the payoff** — the template/register is the product.
5. **The author is present** — one named practitioner, not a consortium.
6. **Progressive disclosure over vertical growth** — never solve blandness with length.
7. **Never invent credibility** — no fabricated ratings, urgency, or counts.
8. **Front-load richness** — a maximal hero, then calm.

## 2.3 The two modes, one system

| | Editorial mode | Product mode |
|---|---|---|
| Surfaces | Questions, guidance, reading lessons, author pages | Dashboard, courses, checkout, downloads, account, admin |
| Type | Large, generous rhythm, narrow measure, strong hierarchy | Clear cards, compact controls, strong states |
| Chrome | Almost none | Obvious actions, consistent spacing |
| Shared | Every token, every primitive | Every token, every primitive |

What differs is **density and measure**, not palette or typeface. A user should never feel they crossed into a different product — only into a different task.

## 2.4 The speed-to-answer budget (a hard constraint)

| Journey | Step budget | Target |
|---|---|---|
| Land → find a relevant question | 1 interaction | < 30s |
| Question → own the related template | 3 steps | < 4 min |
| Land → free entry point captured | 2 steps | < 60s |
| Purchase → first lesson playing | 1 step | < 30s |

**Rules:** the question finder is on the homepage, not behind a click. Buying a template doesn't require browsing a catalog first. Any new step must remove one.

---

# PART III — DESIGN SYSTEM (tokens)

`theme.css` remains the single source of truth. This section restates the settled values for reference; where this document and `theme.css` disagree, **`theme.css` wins**.

## 3.1 Color

**Two brand families + status.** Ivory ground, midnight-navy primary, champagne-gold secondary. A third hue family is not permitted. Status colors (red/green/amber) and chart colors are exempt.

| Token | Light | Role |
|---|---|---|
| `--background` | `#FBF9F4` | Warm ivory ground |
| `--foreground` | espresso | Ink |
| `--primary` / `--stage` | `#10213E` | Brand + primary action + the dark plane (never inverts) |
| `--accent` | vivid blue | Interactive emphasis, sparing |
| `--gold` | champagne | **Decorative only** — rules, gradient stops. Never text. |
| `--gold-strong` | antique | Text-safe gold — labels, icons, small type |
| `--gold-soft` | wash | Tinting a card or tile |

**The gold rule:** `--gold` is decorative-only (2.5:1 on ivory). `--gold-strong` carries gold as text. `--gold-soft` is a surface wash. Putting `--gold` on a text node is the one way to misuse the family.

**Five re-hued domain colors** (the fix for blandness cause #1):

| Domain | Hue family | Light | Dark |
|---|---|---|---|
| Risk (Enterprise & op.) | deep navy | `#142E5C` | `#7C9CD6` |
| Cyber (Tech & security) | teal | `#1B6E7A` | `#4FB3C4` |
| Compliance (Regulatory) | violet | `#6B4E9B` | `#A98BD6` |
| Resilience (Continuity) | green | `#1F6B47` | `#4FB584` |
| AI (Governance) | rust | `#8A3F16` | `#D9905A` |

**Accessibility constraint:** color is never the only carrier of meaning. Six of ten domain pairs fall below 1.5:1 under dichromacy. **Domain identity = color + icon + label together, always.** The icon comes from `domainVisuals.ts` (ShieldAlert / Radar / ClipboardCheck / Activity / Sparkles).

**Stage-plane rule:** on `bg-stage`, use `stage` tokens, never `primary`. `--primary` inverts between themes. This shipped as a bug seven times before being caught.

## 3.2 Typography

Three faces, three jobs:

| Face | Job | Use at |
|---|---|---|
| **Schibsted Grotesk** | Display + interface | Headings, nav, buttons, card titles, labels |
| **Newsreader** | Long-form reading | Question guidance bodies, reading lessons, author essays |
| **Azeret Mono** | Data + identifiers | Question IDs, order numbers, timestamps, prices, eyebrows |

**Type scale** (fluid `clamp()`, top three rungs restored toward hero scale):

| Token | Size | Use |
|---|---|---|
| `--text-display` | clamp(2.625rem → 4.25rem) | Homepage hero only. Once per site. |
| `--text-h1` | clamp(2rem → 3rem) | Page title, the question on a question page |
| `--text-h2` | clamp(1.5rem → 2.125rem) | Section heading |
| `--text-stat` | clamp(1.5rem → 2rem) | Fact-strip / stat-tile figure. Mono + `tabular-nums`. |
| `--text-h3` | clamp(1.125rem → 1.3125rem) | Card title, lesson title, **the price** |
| `--text-read` | 1.125rem (18px) | Serif reading body, 68ch measure |
| `--text-sm` / `--text-xs` | 14px / 12px | Metadata, labels. `xs` is the floor. |

**Pairing rule:** the question itself is set in serif (editorial variant). Product/commerce titles stay sans. This is the single targeted exception that gives the product its editorial authority.

## 3.3 Spacing & layout

- **4px base.** Tailwind default scale.
- **Containers:** marketing `max-w-7xl` (1280px) · reading `max-w-[68ch]` · product `max-w-[1400px]` · admin `max-w-[1600px]` · focused `max-w-md`.
- **Section rhythm:** 40–56px between page sections (not 96–128px).
- **Grids:** question results = 1 column (rows to scan). Course/template cards = 1/2/3. Pricing = 1/3 (never 2).

## 3.4 Radius, borders, elevation

- **Radius ceiling: 12px.** `rounded-2xl`/`3xl` are pinned to 12px. Nothing rounds past it.
- **Default surface treatment: 1px border, not shadow.** Borders are cheaper, crisper, theme-safe.
- `--border` is decorative (grouping). `--border-strong` is meaningful (selected, focused, error, current).
- **Elevation: four levels.** Level 0 (none) is the default. Dark-mode depth reads from a lighter surface + border, not shadow.

## 3.5 Iconography

Lucide React only. Stroke width 1.75. Icons carry meaning or don't appear. One icon per concept, fixed product-wide. Sizes: 14px inline · 16px in controls · 18px standalone · 20px nav · 24px feature.

## 3.6 Motion

**House curve:** `EASE_OUT_EXPO [0.16, 1, 0.3, 1]`. Nothing loops. Nothing exceeds 500ms. No parallax/scroll-jacking/reveal-on-scroll on body content.

| Variant | Duration | Use |
|---|---|---|
| `wordStagger` | 0.5s, 45ms stagger | Hero H1 |
| `useParallax` | scroll-linked ≤12% | Hero aurora only |
| `ambientDrift` | 24s loop | Stage plane only |
| `hoverLift` | 150ms, 2–4px | Cards (never scale) |
| `countUp` | 0.9s | Stat tiles, real values only |

**Motion is hero-only for ambiance.** Below the hero, entrance-only. Dashboard/learning = speed beats atmosphere. All behind `MotionConfig reducedMotion="user"` + explicit loop/parallax guards.

## 3.7 Imagery

Content-led. Images carry information, not fill space. Author = real photograph. Course artwork = consistent generative treatment. Template preview = **an actual page from the actual file** (2 previews minimum per paid template). Never generic corporate stock.

---

# PART IV — COMPONENT LIBRARY

Each component below documents purpose, variants, states, and usage rules. Shadcn primitives are the base; product components compose them.

## 4.1 Foundation primitives (from shadcn)

`Accordion · Badge · Breadcrumb · Button · Card · Checkbox · Command · Dialog · Drawer · Input · Label · Progress · RadioGroup · ScrollArea · Select · Separator · Sheet · Skeleton · Sonner · Switch · Table · Tabs · Textarea · Tooltip`

## 4.2 Buttons

| Variant | Use | Example |
|---|---|---|
| `primary` | The one action the screen exists for | Buy the course |
| `secondary` | A real alternative | See what's included |
| `outline` | Tertiary / pair of equals | Previous / Next |
| `ghost` | Low-emphasis, in-context | Clear filters |
| `destructive` | Irreversible | Delete this lesson |
| `link` | Inline in prose | refund policy |
| **`pill`** `[NEW]` | Dark pill + circular arrow chip | Hero CTA, with `arrowNudge` |

**Sizes:** `sm` 32px (cards, table rows) · `default` 40px · `lg` 48px (primary CTAs). Min touch target 44×44px on mobile — pad the hit area, don't inflate.

**Async behavior:** disables, keeps width (no reflow), swaps label for spinner + present-tense verb (`Preparing…`, `Redirecting…`). On success, shows completed state ~4s. **Never spins with no words.**

**Labels:** say what happens. `Buy the template`, not `Proceed`. `Learn more` is banned unless the destination is unambiguous.

## 4.3 Cards

**Rule:** a card is a container for a real, decided-about thing — a course, template, purchase, search result. **Not** a page section, single paragraph, single statistic, or filter control. Those sit directly on the page.

Every card answers: *what is this → why should I care → what can I do.* If it can't answer all three, it's a list item, not a card.

**Interactive cards:** the whole card is one link/button (not a card with a separate link inside). Hover raises 2px + `shadow-sm`. **Never scale.**

### `ContentCard` `[NEW]` — the unified content card

One card with a `type` variant. This is the fix for the card monoculture.

| Prop | Type | Purpose |
|---|---|---|
| `type` | `question \| course \| template \| pack` | Drives layout + metadata |
| `domain` | `Domain` | Color + icon + label (all three, always) |
| `title` | `string` | |
| `meta` | `FactItem[]` | Icon + label + value pairs |
| `price` | `number` | Hidden if owned |
| `ownedState` | `none \| owned \| in_progress \| complete` | Drives badge + CTA |
| `outcome` | `string` | "What you'll be able to do" |

**Variants by type:**

- **Question card:** domain eyebrow + serif preview + 3 tags (duration, cost, + highest-signal). "Read the answer →"
- **Course card:** outcome line (required) + `6 modules · 2h 40m · 3 templates included` + price/owned badge.
- **Template card:** gold icon tile + format badge (XLSX/PDF) + page/sheet count + price.
- **Pack card:** domain rule + type badge + item count + price + saving vs. parts.

## 4.4 `FactStrip` `[NEW]` — the highest-value addition

3–5 icon+value pairs in one horizontal row. The purchase decision, surfaced before prose. Modeled on edX's clean bordered fact-strip card.

| Prop | Type |
|---|---|
| `items` | `{ icon, label, value, explainer? }[]` |

**Usage:** course detail, template detail, pack detail. For a course: modules · lessons · duration · level · templates included. For a template: format · pages/sheets · editable · version · license.

## 4.5 Evidence components (the trust layer)

These exist and live only on `ProductBuy`. The redesign surfaces them on catalog cards and detail pages.

| Component | Job | Renders when |
|---|---|---|
| `EvidencePanel` | The pre-purchase facts | Always on detail pages |
| `LicenceLine` | One-sentence license | `licence` is set |
| `PreviewGallery` | 2-up real preview images + lightbox | ≥2 `preview_image_keys` |
| `VersionStamp` | `v1.2 · reviewed 17 Aug 2026` (mono) | `version` is set |
| `WhyThis` | Six claims, each backed by a column | Always on buy surfaces |

**The absence rule:** an unset field renders **nothing**, not `—`. A panel with four honest rows beats six rows with two "unknown."

## 4.6 Discovery components

| Component | Job |
|---|---|
| `FilterRail` | Desktop filter sidebar. Per-value live counts. Groups collapse to 5 + "Show all." Per-group Clear + global Clear all. |
| `FilterSheet` | Mobile drawer. Changes apply **live per tap** (not on close). |
| `QuickGoalChips` | One-tap presets phrased as goals. Toggles that visibly tick the rail controls. |
| `ResultCount` | `12 exact · +9 close` in `tabular-nums`. |
| `MatchBadge` | Close-match explanation — informational, never error. No `--destructive`, no warning icon. |
| `QuestionRow` | A question in a result list. Whole row = one link. |

## 4.7 Learning components

| Component | Job |
|---|---|
| `CourseOutline` | Module/lesson tree with progress + lock states. Sticky, independently scrollable, auto-scrolls current into view. |
| `LessonLayout` | Shell shared by the three lesson types. |
| `VideoLesson` / `ReadingLesson` / `DownloadLesson` | Type-specific bodies. |
| `LessonNav` | Previous / Mark complete / Next. |
| `ProgressBar` | `role="progressbar"` with `aria-valuenow`. CSS width transition. |

## 4.8 Wayfinding `[NEW]`

| Component | Job |
|---|---|
| `Breadcrumb` | `Questions / Third-party risk` on every detail page. `text-xs`, current item in foreground. |
| `SearchCommand` | ⌘K palette. Grouped by type. Arrow keys, Enter, Escape returns focus. |

## 4.9 The four states (designed once, applied everywhere)

| State | Rule |
|---|---|
| **Empty** | Names what would be here + the one action that puts something here. Never a blank region. Never an illustration with no action. |
| **Loading** | Skeletons matching the real layout's dimensions. Delay rule: <200ms → show nothing. No full-page spinner on cached routes. |
| **Error** | What failed → whether the user must act → what to try. Inline, scoped to what failed. |
| **Locked** | `muted` surface, dashed border, lock icon, name of what unlocks it + price. **Never greyed-out.** Never `--destructive`. |

---

# PART V — SCREEN-BY-SCREEN REDESIGN

Priority follows §3.7: question discovery → question reading → product connection → course learning → commerce → member library → admin.

---

## A. PUBLIC SCREENS

## A.1 Homepage (`/`)

**User goal:** understand what this is + find a relevant question in <30s.

### Layout (6 sections, front-loaded — richness in 1–2, then calm)

```
┌─────────────────────────────────────────────────────┐
│ 1. HERO — stage plane                                 │
│    TaxonomyCanvas (full-bleed, generative)           │
│    96px word-staggered H1                             │
│    "What are you trying to solve? ⌘K"  ← live finder │
│    [Do it in a fortnight] [Do it cheaply]             │
│    TrustStrip (real counts only)                      │
├─────────────────────────────────────────────────────┤
│ 2. QUESTION ENTRY — glass cards over lower gradient   │
│    3 real questions from different domains            │
├─────────────────────────────────────────────────────┤
│ 3. HOW IT WORKS — calm band                          │
│    Question → Answer → Learning → Template → Apply   │
├─────────────────────────────────────────────────────┤
│ 4. PRODUCTS — courses/templates/packs, 3-col         │
│    Re-hued domain colors, real prices                 │
├─────────────────────────────────────────────────────┤
│ 5. THE AUTHOR — AuthorCard, given real space         │
├─────────────────────────────────────────────────────┤
│ 6. FREE PACK CTA — single clear close                │
└─────────────────────────────────────────────────────┘
```

### Component breakdown

| Section | Components | States |
|---|---|---|
| Hero | `TaxonomyCanvas`, `StatusDot`, word-staggered H1, `SearchCommand` trigger, `QuickGoalChips`, `TrustStrip` | Reduced-motion → static SVG |
| Question entry | 3× `ContentCard type="question"` over glass | |
| How it works | 5-step horizontal diagram | |
| Products | 3× `ContentCard` (course/template/pack) | Owned badge |
| Author | `AuthorCard` | |
| Free pack | `Button pill` + email capture | |

### Component spotlight: `TaxonomyCanvas`

The hero graphic. 99 nodes in 5 domain clusters, gold connective lines, slow ambient drift, parallax. **Driven by real API counts** — never render a hardcoded 99. Degrades to a static SVG under reduced motion. Must read at 390px. This is the piece that makes the page unmistakably Practicable's.

### Interaction patterns

- Finder is **live on the page**, not a link to `/questions`.
- `TrustStrip` shows real counts only (100 questions · 5 domains · N templates). No fabricated metrics.
- Parallax + ambient drift **only** in the hero.

### Responsive

- Hero stacks. Finder becomes full-width. Quick-goal chips wrap.
- Product grid: 3 → 2 → 1.

### Accessibility

- Finder input is keyboard-operable. `aria-live="polite"` on result count.
- `TaxonomyCanvas` is `aria-hidden` (decorative) with a text alternative.

### What it must NOT do

Not lead with a course catalog. Not require an account. Not hide any price. Not carry a testimonial carousel, logo wall, or animated counter to 100.

---

## A.2 Question Discovery (`/questions`) — **THE FLAGSHIP**

**User goal:** "What can I fix in a fortnight, cheaply, that my regulator cares about?"

This is the most important screen. A static filter returning zero results on a three-constraint query fails the product's headline promise.

### Layout

```
┌─────────────────────────────────────────────────────┐
│ What are you trying to solve?                          │
│ [ Search the 100 questions… ⌘K ]                       │
│ [Do it in a fortnight] [Do it cheaply]                 │
│ [Show your regulator] [Build leadership support]       │
├──────────────┬──────────────────────────────────────┤
│ FILTER RAIL  │  12 exact · +9 close                  │
│ (280px)      │  ─────────────────────                │
│ Domain       │  [QuestionRow]                        │
│ Duration     │  [QuestionRow]                        │
│ Cost         │  ─────────────────────                │
│ Effort       │  7 close matches                      │
│ Regulator    │  [QuestionRow + MatchBadge]           │
│ ROI horizon  │  [Show all 7]                         │
│ Tier         │                                       │
└──────────────┴──────────────────────────────────────┘
```

### Component breakdown

| Component | Key behavior |
|---|---|
| `FilterRail` | Per-value counts inline (`Weeks (34)`). Groups collapse to 5 + "Show all." Per-group + global Clear. |
| `QuickGoalChips` | Tapping one sets filters **and visibly ticks the rail controls**, so the user learns what the chip did. |
| `ResultCount` | `tabular-nums`. Updates without reload. |
| `QuestionRow` | Exact rows: `border-border-strong` left rule. Close rows: `border-border` + `MatchBadge`. |
| `MatchBadge` | `Duration: 3-6 months` when user asked `2-6 weeks`. Informational only. |

### The scoring model (the differentiator)

The filter is a **ranking, not a gate**. Each ordinal tag maps to a numeric scale. With filters active, each question scores: 2 per exact match, 1 per adjacent value. A question is **exact only when it matches every active constraint exactly**. Results sort by score, split into two zones with a divider.

**Zero-result recovery:** rank the active filters by how few questions each admits alone, offer the two most restrictive as relaxations. "The tightest constraint is Duration: under 2 weeks — only 6 of 100 are that fast. [Relax Duration] [Relax Regulator pressure] [Clear all]"

### State persistence

Filter state lives in the **URL**, mirrored into Zustand. Shareable, bookmarkable, back-button-correct. Returning from a question page restores the exact result list + scroll position.

### Responsive

Mobile: results + sticky `[Filters · 3]` bottom-right → bottom sheet. Changes apply live per tap. No "Show N results" commit step.

### Accessibility

Filter changes are **not** navigations — focus stays on the control; result count announced via `aria-live="polite"`. Radio semantics for single-select groups; checkboxes for Tier + Leadership traits. Fieldsets with legends.

---

## A.3 Question Detail (`/questions/:slug`)

**User goal:** understand the answer, then see what else would help. **The moment credibility is judged.**

### Layout

```
Breadcrumb: Questions / Third-party risk

THIRD-PARTY RISK                    ← eyebrow, mono
How do I know whether my risk        ← H1, SERIF (editorial)
reporting is actually useful?
[The short answer — 2–3 sentences, serif, lead]

[Seven-tag definition grid — 2 cols desktop, 1 mobile]
─────────────────────────────────────
Guidance                             ← the author's full text
[Serif reading body, 68ch]
What to do next                      ← the practical steps
─────────────────────────────────────
Related templates   ← BUY SURFACE
Related questions   ← 3, same/adjacent domains
Related lessons     ← with entitlement state
The author          ← AuthorCard
[Primary CTA]
```

### Component breakdown

| Component | Key behavior |
|---|---|
| `Breadcrumb` | Wayfinding back to discovery |
| `PageTitle variant="editorial"` | **Serif title + serif lead** — the one place serif earns its keep |
| `QuestionMeta` | Seven tags as a **definition grid** (icon + dimension name `xs` muted + value `sm` foreground). Not a badge row. |
| `QuestionReader` | Guidance body in `.prose-guidance` (Newsreader 18px, 68ch) |
| `EmailGateFade` | Soft email capture over the tail of long answers. Not a security boundary. |
| `ContentCard type="template"` | The related-template card is a **full buy surface** — name, format, page count, 2 previews, price, `Buy the template`. Does not route to catalog. |
| `AuthorCard` | Photo + name + credential |

### The seven tags, laid out properly

All seven appear as a compact definition grid. Seven badges in a line is unreadable and hides the structure that **is** the product.

### The email gate

The question body is **public, always, in full** in the API. The email capture is a lead-magnet device, not access control. One shared unlock (`localStorage`), site-wide, so a returning reader is never asked twice. Short questions render with no gate.

### What's still paid (connected from this page)

The related course's video/lessons and any related template. Those follow entitlement rules — server-checked, no free preview. "Never free" there is as absolute as "always free" is here.

---

## A.4 Course Catalog (`/courses`) & Course Detail (`/courses/:slug`)

### Course Detail — the commerce + learning bridge

```
┌──────────────────────────────────┬──────────────────┐
│ Breadcrumb                        │ STICKY BUY CARD   │
│ Course title (H1)                │ [CourseArt]        │
│ Outcome — one sentence, serif    │ A$149              │
│ Author — photo, name, credential │ [Buy the course]   │
│                                   │ ────────────      │
│ FactStrip:                        │ What's included:   │
│  6 modules · 14 lessons ·        │  6 modules         │
│  2h 40m · 3 templates ·          │  14 lessons        │
│  lifetime access                  │  3 templates       │
│                                   │  Lifetime access   │
│ What you'll learn                 │  14-day refund     │
│ [2-col checklist]                 │                    │
│                                   │                    │
│ Full syllabus (accordion)         │                    │
│  MODULE 01 · Making risk useful   │                    │
│   🔒 Why risk registers fail  12m │                    │
│   🔒 Making ownership real     8m │                    │
│   🔒 Reporting that gets used  6m │                    │
│                                   │                    │
│ Included templates (previews)     │                    │
│ Related questions                 │                    │
│ Related products (rail)           │                    │
└──────────────────────────────────┴──────────────────┘
```

### Component breakdown

| Component | Key behavior |
|---|---|
| `FactStrip` | The purchase decision, before prose. |
| **Sticky buy card** | `lg:grid-cols-[1fr_380px]`. Matches `ProductBuy`. One buy card, never repeated inline. |
| `CourseOutline` (accordion) | Collapsed modules with counts. Every lesson shown, all locked until purchased. Locked = `🔒 Included with the course`, not disabled. |
| `PreviewGallery` | Included templates with preview thumbnails. |
| `RelatedRail` | Related questions this course answers + related products. |
| `AuthorCard` | Authority. |

### Key rules

- **No free preview lesson.** Video and lesson content are never free, no exceptions. Built structurally — the `is_free_preview` column was dropped so it can't be re-enabled with one line.
- **Every lesson shown, all locked.** A course whose syllabus you can't see is harder to evaluate, not more exclusive.
- **The related question is the ungated sample.** A visitor reaches a course from a question they already read in full.

---

## A.5 Template Catalog (`/templates`) & Template Detail (`/templates/:slug`)

### Template Detail — a real page, not a card blown up

Research 4.2: long descriptions + multiple preview images correlate strongly with sales.

| Section | Content |
|---|---|
| What problem it solves | In the author's words (target 400+ words, not 40) |
| `PreviewGallery` | **2–3 genuine preview images** (actual pages from the actual file) |
| What's in each file | Listed |
| Who it's for / not for | |
| Related questions | Linked |
| Format · size · page count · license | `[OWNER]` license position |
| Price · refund · buy button | Sticky buy card |

**The free Risk Register Template:** `templates.is_free` is an explicit column. The gate is a conversion device, not a boundary — `GET /templates/{id}/download-url` serves it to anyone. The email form is client-side only.

---

## A.6 Packs (`/packs`) — Reference packs & domain packs

**The next pack shape** (from §30A): a pack is not a type, it's a **shape a product can be in** — a published product whose `product_contents` include ≥1 template row + ≥1 question_set row.

A **problem-scoped pack** groups questions, guides, and working materials around a specific problem (e.g., vendor evaluation). Instead of buying several individual templates, a buyer purchases one reference pack.

| Concern | Domain pack (built) | Problem pack (new) |
|---|---|---|
| Selection rule | one Domain | a curated list, crossing domains |
| Templates in pack | exactly 1 (the PDF) | 1 PDF + N working files |
| Question ordering | `_WORKING_ORDER` | **editorial** — the order you'd work the problem |

**Two problems to solve:** (1) overlap is the commercial risk, not technical — W4-R3's guard decides whether overlap is permitted when a pack's price exceeds the sum of its parts. (2) ordering has no algorithm — needs `sort_order` on content rows.

**Do NOT:** make "pack" a `content_type` (would fork the entitlement path). Paywall the questions (`HONESTY_NOTICE` prevents this). Ship without the overlap decision.

---

## A.7 Supporting public screens

| Screen | Key design |
|---|---|
| `/pricing` | Three columns (never 2). Free · Template · Course. State billing type (`one-time`), access (`lifetime`), refund position. `[OWNER]` currency. |
| `/about` | The author. Real photograph, credential, the book's story. `AuthorCard` given real space. |
| `/search` | `SearchCommand` results page for deep links + mobile. Grouped by type with counts. |
| `/free` | Free entry point landing. |
| `/contact` | Form + support address. Writes to `contact_messages` table. Success replaces the form. |
| `/legal/*` | Terms, privacy, refunds. Drafted for owner review, never published on designer's authority. |

---

## B. AUTH SCREENS

## B.1 Sign in / Sign up (`/sign-in`, `/sign-up`)

### Layout

Split-screen: brand panel (stage aurora) left, form right. Built on Watermelon UI `auth-08`/`auth-10`.

### Component breakdown

| Component | Key behavior |
|---|---|
| `AuthField` | Icon-prefixed input + password reveal toggle. |
| Email/password fields | Progressive disclosure — email first, then password. |

### Critical rule: preserve intent

After sign-in/sign-up, the user lands **where they were going**, not on the dashboard. The guard records `pathname + search` via `signInUrlFor`; the confirmation email carries `next` through the inbox. This was the P0 flow bug — a logged-out user clicking a buy CTA was bounced to sign-in and delivered to an empty dashboard, product forgotten.

### Accessibility

Labels above fields, always visible. No placeholder-as-label. `autocomplete` on every field (`email`, `current-password`, `new-password`, `name`).

---

## C. MEMBER SCREENS

## C.1 Dashboard (`/dashboard`)

**User goal:** continue where I left off. A returning user's home base.

### Layout

```
Good morning, Sarah
Continue                          ← always first, always full width
[Third-Party Risk Foundations · Module 3, Lesson 2 · Continue →]
Your library
[CourseCard] [CourseCard] [TemplateCard]
Recent downloads
[Compact list, most recent first]
Because you were reading about supplier registers
[QuestionCard] [QuestionCard]
Explore
[Browse all 100 questions →]
```

### Component breakdown

| Component | Key behavior |
|---|---|
| `ContinueRail` | Named next lesson + `ProgressBar`. **Courses only.** |
| `ContentCard` (library) | Per-type verb: `Continue` / `Start` / `Review`. |
| Stat tiles | `countUp`, real values only. |

### Key rules

- **Recommendations never appear above active learning.** Someone 45% through a paid course came back to finish it, not be sold something else.
- **Empty dashboard is designed.** "You haven't started a course yet. [Your downloads] … Where to start: the three questions most people open first."
- **Motion is restrained** — `countUp` + `hoverLift` only. No parallax, no ambient loop. Speed beats atmosphere.

---

## C.2 My Library (`/library`)

**The organising rule: do not flatten the types.** Each content type keeps its own row treatment and its own verb.

| Type | Carries | Verb | Deliberately absent |
|---|---|---|---|
| Course | Progress bar, n of m lessons, % | `Continue` / `Start` / `Review` | — |
| Template | File name + size | `Download` | No progress bar, no resume |
| Reference | Domain | `Read` | No progress, no order |

**Continue-where-you-left-off** sits at the top, **courses only**. A template has no progress; reference has no fixed order.

**Progress counts only what you're entitled to.** A partial purchase reports against granted lessons, never the full course count.

**Honesty about Reference:** question guidance is free for everyone, so this section is a record of what a purchase included, not an access list.

---

## C.3 Learning (`/learn/:courseSlug`, `/learn/:courseSlug/:lessonSlug`)

### Layout (desktop)

```
┌────────────────────────────────────────────────────┐
│ ← Third-Party Risk Foundations    45% · 6 of 14    │
├─────────────────┬──────────────────────────────────┤
│ MODULE 1        │  Lesson 3 of 14                  │
│ ✓ What good     │  Building a supplier register     │
│ ✓ Mapping       │                                   │
│ → Building a…   │  [ Video 16:9 ]                   │
│ ○ Tiering       │  [ Reading body, serif, 68ch ]    │
│ MODULE 2        │  [ Download: Supplier Register ]  │
│ ○ Contracts     │  [Mark complete]                  │
│ 🔒 Escalation   │  ← Previous      Next lesson →   │
└─────────────────┴──────────────────────────────────┘
```

### Component breakdown

| Component | Key behavior |
|---|---|
| `CourseOutline` | Sticky, independently scrollable, auto-scrolls current into view. Lesson states: `✓` `→` `○` `🔒`. |
| `LessonLayout` | Shell for the three types. |
| `VideoLesson` | Mux Player. Captions on by default. 16:9, `rounded-xl`, black bg, full-bleed <640px. |
| `ReadingLesson` | Serif 68ch. |
| `DownloadLesson` | Framing paragraph + file card (format, size, page count). |
| `LessonNav` | Previous / Mark complete / Next. |

### Completion

`Mark complete` is an **explicit button**, not inferred from scroll/video progress. On completion: button becomes `✓ Completed` + `Undo` for 8s, outline ticks, progress bar animates, focus moves to Next lesson. This replaces certificates.

### Token expiry mid-playback (the normal case)

Playback tokens last 15–30 min; a 40-minute lesson will expire. Client requests a fresh token at 60% lifetime silently. On refresh failure: play to end of buffer, pause with `Your session timed out. [Sign in and continue from 12:34]`. Position preserved.

### Mobile

Outline opens as a sheet from `☰`. Bottom bar respects `env(safe-area-inset-bottom)`. Video full-bleed, native fullscreen, no autoplay, no PiP.

---

## C.4 Commerce member screens

| Screen | Key design |
|---|---|
| `/purchases` | Date · product · amount+currency · order ref (mono) · receipt link. This is what someone expensing screenshots. |
| `/downloads` | All purchased templates, each re-downloadable. |
| `/account` | Profile, email, password, purchase history, data export/delete route. |
| `/purchase-success` | "✓ You're in." State what was bought, where it lives, what happens next. One primary action into the content. **Handles the webhook race** — polls entitlement for up to 20s. |

### The webhook race (critical)

Stripe redirects back before the entitlement webhook arrives. The success page polls the entitlement endpoint every 1.5s for 20s. While polling: `Setting up your access…`. On success: `Start the first lesson`. If 20s elapses: `Your access is still being set up… [Refresh] [Contact us]`. **Never leave the user on a spinner or a locked screen after paying.**

---

## D. ADMIN SCREENS

Admin is a product inside the product. **Functional, not decorative.** Density and speed matter; atmosphere does not. No aurora, no stage plane, no parallax.

### Layout

Persistent left sidebar, grouped to mirror the content model (learning the admin teaches the schema):

```
Overview
Content
  Questions
  Courses
  Modules & lessons
  Templates
  Videos
Catalogue
  Products
  Pricing
People
  Users
  Purchases
Structure
  Sections
  Domains
  Authors
  Tag values
Settings
```

`Sections` and `Domains` sit under Structure, not hidden in Settings — they're the extensibility mechanism.

### Admin density pass (Theme L)

- `max-w-[1600px]`, `text-sm` throughout, `rounded-sm` on table cells.
- Tables over cards for lists.
- `PublishStateChip`: published=`success`, draft=`warning`, archived=`muted`. Every badge carries a word.
- Tighter padding than page-level.

### The question editor

Seven dimensions as **explicit typed fields with controlled vocabularies, never free-form tags.** Free-text tagging destroys the taxonomy within a month. Every dimension required except leadership traits — an untagged question is invisible to discovery.

### Publishing model

Draft → In review → Published → Archived. Publishing is explicit + confirmed. Unpublishing is one click, never destructive. Draft content is never reachable on a public URL.

---

# PART VI — CROSS-CUTTING CONCERNS

## 6.1 Accessibility (WCAG 2.2 AA floor)

- Semantic HTML. One `h1` per page. Every input labeled. Every image alt-texted.
- Contrast per the measured token set. Captions on all video.
- **SPA route changes announced** via `aria-live="polite"` route announcer.
- **Focus moves to the new page's `h1`** (`tabIndex={-1}`) after navigation. Exception: filter changes are not navigations.
- **Skip link** first focusable on every page.
- **Target size:** ≥24×24 CSS px, ≥44×44 on touch.
- Overlays trap focus, close on Escape, return focus to trigger.

**Manual tests (Week 4):** keyboard-only purchase · keyboard-only lesson · VoiceOver/NVDA on discovery (result count announced) · 200% zoom · forced reduced-motion · forced dark mode.

## 6.2 Responsive

| Breakpoint | Behavior |
|---|---|
| base <640 | Phone. Single column. Bottom sheets for filters. Full-width primary buttons. Sticky lesson nav. |
| sm 640+ | Large phone / small tablet |
| md 768+ | Tablet. Tables → stacked cards. |
| lg 1024+ | Desktop. Sidebars appear. 3-col grids. |
| xl 1280+ | Wide desktop. Containers stop growing at 2xl. |

**Test widths:** 375 · 390 · 430 · 768 · 1024 · 1280 · 1440. **375 is the floor and not optional.**

**Mobile is a designed layout, not a narrowed desktop.** Priority: content → primary action → search → progress → navigation. No hover-only interactions.

## 6.3 Performance budgets

| Metric | Budget |
|---|---|
| LCP | <2.0s (homepage + question detail, 4G) |
| INP | <200ms (filter chip tap) |
| CLS | <0.05 |
| Initial JS (gzipped) | <180KB |
| Any route chunk | <120KB |
| Question index payload | <60KB |

**How:** every route lazy-loaded. Admin bundle never in a learner's download. Mux player dynamically imported. Rich text editor admin-only. Fonts self-hosted, variable, `font-display: swap`. No autoplay video.

## 6.4 SEO & prerendering

Prerender public routes at build time (`vite-react-ssg`). Member/admin/auth stay client-only. Per-route metadata via head library. Question pages are fully public + indexable (the acquisition mechanism). Templated OG images per content type.

## 6.5 Security in the interface

**The UI is never the authority.** It hides what a user can't use; the server decides what they can have. A client-side `hasAccess` check is a UX convenience, not a control. Gated lesson content, permanent storage URLs, and playback tokens for non-entitled lessons **never reach the client.** No secret in a `VITE_` variable.

---

# PART VII — REDESIGN PRIORITIES

## 7.1 Consolidated priority matrix

| # | Change | Benefit | Impact | Effort | Priority |
|---|---|---|---|---|---|
| A1 | Filter-rail counts | No dead-end filtering | Very high | Med | **P0** |
| A2 | Live count + two zones | Taxonomy legibility | Very high | Low | **P0** |
| A4 | Zero-result recovery | Turns dead end into 2 taps | High | Low | **P0** |
| B1 | Serif editorial headline | Credibility anchor | Very high | Low | **P0** |
| B2 | Seven-tag definition grid | Structure = product | High | Low | **P0** |
| D1 | `FactStrip` | Purchase facts on surface | Very high | Low | **P0** |
| D2 | Evidence fields surfaced | Trust already built | Very high | Med | **P0** |
| D3 | `VersionStamp` | Currency signal | High | Very low | **P0** |
| D6 | Sticky buy card on courses | Matches ProductBuy | High | Med | **P0** |
| F1–F4 | The four states | Client-ready, not prototype | Very high | Med | **P0** |
| A3 | Quick-goal chips | Teach the taxonomy | High | Low | **P0** |
| J1/J2/J4/J5 | A11y floor | Brief non-negotiable | High | Low | **P0** |
| C1–C3 | Lesson icons/outline/completion | Learning feels intentional | High | Med | P1 |
| B4 | Related-template buy surface | 3-step budget intact | High | Med | P1 |
| B5 | Author byline + credential | Strongest trust asset | High | Low | P1 |
| D4/D5 | License + preview gallery | Pre-purchase confidence | Med | Med | P1 |
| D7 | Related-content rail | Uses fetched data | Med | Very low | P1 |
| E1/E2/E3 | Breadcrumbs / palette / mobile bar | Wayfinding | Med | Med | P1 |
| G1–G4 | Micro-interactions | Feels responsive | Med | Low | P1 |
| H1/H2/H3 | Mono numerics + tabular | Distinctive, stable | Med | Very low | P1 |
| C4 | Video token-expiry state | Prevents refund trigger | High | Med | P1 |
| K1/K2/K3 | OG images, images, splitting | Perf + share | Low | Med | P2 |
| L1–L3 | Admin density | Faster editing | Low | Med | P2 |

## 7.2 What this redesign deliberately does NOT do

- No product ratings (Principle 7 — never invent credibility)
- No discount urgency
- No cohort scarcity
- No certificates (not built; completion moment replaces them)
- No generic course-marketplace look
- No glassmorphism / neon
- No gamification / streaks / confetti
- No fabricated social proof

## 7.3 The two honest caveats

1. **A1's per-value counts** assume the question index is client-cached (~40KB at 100 questions). If the catalog grows past ~500 questions / 250KB, counting moves server-side. Write that threshold into the handover pack.
2. **D2's "render every populated field"** depends on the evidence fields actually being filled in. The columns exist but the content pass is an owner/author task. Until real page counts, formats, and review dates are entered, the evidence panel renders honestly short — the visual payoff waits on content, not code.

---

*End of comprehensive redesign document. Version 1.0.*
*Design authority: this document for screens/components; `theme.css` for token values.*

I've completed the research synthesis and produced the comprehensive screen-by-screen, component-by-component redesign document. Here's what I delivered:

## What I did

**Research phase (synthesized, not repeated):**
- Distilled the 14-platform competitive research (86 captures) into five load-bearing patterns and the anti-patterns to avoid
- Extracted the density insight that reframes the whole redesign: density comes from card anatomy, not column count
- Restated the four measurable causes of blandness and their fixes
- Benchmarked information density against Udemy/Coursera/edX/Skillshare

**Design document structure:**
- **Part I** — Research synthesis (competitive findings, user, product model, commercial model, density benchmarks)
- **Part II** — Design direction (brand personality, principles, two modes, speed-to-answer budget)
- **Part III** — Design system (color, typography, spacing, radius/borders/elevation, iconography, motion, imagery)
- **Part IV** — Component library (buttons, cards, FactStrip, evidence components, discovery, learning, wayfinding, four states)
- **Part V** — Screen-by-screen redesign (all public, auth, member, and admin screens with layout diagrams, component breakdowns, interaction patterns, responsive behavior, and accessibility notes)
- **Part VI** — Cross-cutting concerns (accessibility, responsive, performance, SEO, security)
- **Part VII** — Priorities and what NOT to do

The document ties every design decision back to a research finding or a settled token, and respects the hard constraints (two color families, 12px radius ceiling, no fabricated credibility, question-first model). It's written to be built against, with ASCII layouts and component props for each screen.