# Practicable — Design Change Set 2 (Second Pass)

**Status:** proposal, to slot after Phase 8.
**Organising principle:** Change Set 1 fixed the *marketing shell* and the *tokens*. This pass fixes the **working surfaces** — discovery, reading, learning, commerce — where the audit found the product still reads flat, plus the state system and wayfinding that were named as problems but never assigned.

## Priority legend
`P0` removes a trust/conversion blocker · `P1` high leverage, bounded · `P2` polish, do if the week allows.

---

## Theme A — Discovery is still the flagship `[P0]`

DESIGN.md §3.7 ranks question discovery #1 and §19 calls it "the most important screen in the product," yet the redesign doc gives `/questions` only generic token inheritance. The headline promise — *"what can I fix in a fortnight, cheaply, that my regulator cares about?"* — lives or dies here.

**A1 · Per-value counts in the filter rail `[P0]`**
Each filter option shows its live count inline — `Weeks (34)` — before the user commits to a click. This is the taxonomy proving it's real (§19.5) and it's the single highest-value discovery change. Counts recompute from the cached question index (~40 KB, §57.1), no extra fetch.
- Counts in `text-xs` mono, `--muted-foreground`.
- Groups collapse to 5 values with a `Show all` expander.
- Each group gets a per-group `Clear` that appears only when active.
- Above the rail: `4 filters active` + a single `Clear all`.

**A2 · Live result count with two zones `[P0]`**
`12 exact · +9 close`, updating on every filter change, in `tabular-nums` so it doesn't jitter (§10 rule). Exact and close matches are separated by a divider row, not blended (§19.3). Close-match rows get `border-border` (not `border-strong`) and a `MatchBadge`.

**A3 · Quick-goal chips as toggles, not links `[P0]`**
`Do it in a fortnight` / `Do it cheaply` / `Show your regulator` / `Build leadership support`. Tapping one sets its filters **and visibly ticks the corresponding rail controls**, so the user learns what the chip did (§19.7). Chips are `secondary` when active, `outline` when idle. One-tap, no debounce — a tap must recount immediately or the control feels broken (§19.6).

**A4 · Zero-result recovery, computed not hardcoded `[P0]`**
When filters return nothing, rank the active filters by how few questions each admits alone and offer the two most restrictive as relaxations (§19.4, §57.5):
```
No questions match all four filters.
The tightest constraint is Duration: under 2 weeks —
only 6 of 100 questions are that fast.
[Relax Duration]  [Relax Regulator pressure]  [Clear all]
```
This turns a dead end into a two-tap recovery and teaches the taxonomy's shape.

**A5 · `MatchBadge` close-match explanation `[P1]`**
A small informational badge naming the dimension that missed and its actual value — `Duration: 3-6 months` when the user asked for `2-6 weeks`. Never an error state, never `--destructive`, no warning icon (§19.3). Text opacity is never reduced.

**A6 · Mobile filter summary bar `[P1]`**
Sticky `bottom-right` `Filters · 3` button (above the safe area, §13.3) that opens the same rail as a bottom sheet. Changes apply live per tap (the shipped `toggle()` model, §19.9) — no separate "Show N results" commit step.

---

## Theme B — The question reading experience `[P0 / P1]`

This is §3.7 priority #2, the moment credibility is judged (§1.2). The editorial variant exists but is under-used.

**B1 · Serif editorial headline + serif short answer `[P0]`**
Question title in Newsreader, large, tight — an editorial headline, not a card title (§9.4 `editorial` variant). The 2–3 sentence short answer as a serif `text-lead` in `--muted-foreground`. This is the one place serif earns its keep and it's the product's credibility anchor.

**B2 · Seven-tag definition grid, not a badge row `[P0]`**
All seven tags as a compact definition grid — icon, dimension name in `text-xs` muted, value in `text-sm` foreground — two columns desktop, one mobile (§21.2). Seven badges in a line is unreadable and hides the structure that *is* the product. The card-level three-tag cap (§20.2) stays; the detail page shows all seven properly.

**B3 · `EmailGateFade` refinement `[P1]`**
The blur → form transition is the conversion moment (§27.2). Keep: one field only, privacy line in plain words next to the button (not a buried checkbox), no pre-ticked consent. Add a visible gradient fade from readable text into the form so the gate reads as an invitation, not a wall. Copy, sentence case:
```
Keep reading — free
Enter your email to unlock the rest of this guidance.
[you@example.com]  [Unlock the rest]
No spam, unsubscribe any time.
```
Unlock is instant and site-wide (one `localStorage` flag), so a returning reader is never asked twice.

**B4 · Related template as a full buy surface `[P1]`**
The related-template card on a question page is a purchase surface, not a link to a catalogue (§21.4, keeps the 3-step budget in §4). Show: name, format, page count, two preview thumbnails, price, `Buy the template`. If already owned: `Download the template` with a `CircleCheck` and `In your library`.

**B5 · Author byline with credential `[P1]`**
`author_name` is currently a muted string. Replace with name + one credential line. Authority is transmitted by a named practitioner (§6.3, Research 1.2). This is the platform's strongest trust asset and it's near-invisible today.

---

## Theme C — The learning experience `[P1]`

Phase 7 deliberately keeps `Learn`/`Lesson` logic untouched. These are **chrome and feedback** changes that don't alter outline or progress logic.

**C1 · Lesson-type icon consistency `[P1]`**
Fixed icons per type (§14.1): video `PlayCircle`, reading `BookOpen`, download `FileDown`. Used identically in the outline, the lesson header, and any "what's included" list. One lock, one download, one check — the concept-to-icon map is product-wide.

**C2 · Sticky outline, auto-scroll current into view `[P1]`**
The outline is `sticky`, independently scrollable (`max-h-[calc(100vh-6rem)]`), and scrolls the current lesson into view on load (§24.1). Lesson states: `✓` complete · `→` current · `○` not started · `🔒` not entitled.

**C3 · The completion moment `[P1]`**
`Mark complete` is explicit, never inferred (§24.4). On completion: the button becomes `✓ Completed` with an `Undo` affordance for 8 seconds, the outline item ticks, the progress bar animates its width, and focus moves to `Next lesson`. This is the psychological payoff that replaces certificates (§0.6, DESIGN.md §59 row 14) — it needs to *feel* like something landed. A single 220ms `--ease-entrance` transition on the bar, nothing more.

**C4 · Video frame + token-expiry state `[P1]`**
16/9, `rounded-xl`, black background both themes, full-bleed below 640px (§25.1). Captions on by default. The mid-playback token-expiry state is a *normal* case, not an edge case (§25.4): silent refresh at 60% lifetime; on failure, play to the buffer end then pause with `Your session timed out. [Sign in and continue from 12:34]`, position preserved. Losing someone's place in a paid 40-minute lesson is a refund-generator.

**C5 · Mobile lesson nav `[P1]`**
The outline opens as a sheet from `☰`; `Mark complete` sits in a sticky bottom bar that respects `env(safe-area-inset-bottom)` (§24.2). `← Previous` / `Next →` above it.

---

## Theme D — Commerce & evidence `[P0 / P1]`

The `product/*` evidence components exist (`EvidencePanel`, `LicenceLine`, `PreviewGallery`, `VersionStamp`, `WhyThis`) but live only on `ProductBuy`. The audit found catalogue cards and course pages don't surface them. This theme is "spend the trust assets you already built."

**D1 · `FactStrip` on every product page `[P0]`**
3–5 icon+value pairs in one horizontal row — the most consistent pattern across all 14 researched platforms (RESEARCH §5). For a course: modules · lessons · duration · level. For a template: format · page/sheet count · editable · version. This is the purchase decision; it must not be a run-on muted line (the current `CourseDetail` failure, RESEARCH §7.1 #3).

**D2 · Surface the evidence fields that already exist `[P0]`**
The columns are in the schema but un-rendered outside `ProductBuy`: `page_count`, `sheet_count`, `is_editable`, `has_macros`, `min_office_version`, `version`, `last_reviewed_at`, `preview_image_keys` (W4-R1). Render every populated field; the absence rule means an unset field renders *nothing*, not `—`. A panel with four honest rows beats six rows with two "unknown."

**D3 · `VersionStamp` — the currency signal `[P0]`**
`v1.2 · reviewed 17 Aug 2026` in mono. For risk/compliance content this is a major trust signal (RESEARCH §7.1 #13) and it's currently buried. Show it on product pages and stamp it into the receipt. An unset `version` renders nothing; unset `last_reviewed_at` with a set `version` renders `v1.2` alone.

**D4 · `LicenceLine` `[P1]`**
One sentence, `text-sm`, `Scale` icon in `--gold-strong`, linking to terms. `standard`: "Use and adapt this inside your own organisation." Undecided tiers render nothing (W4-R16, decision #25). Never casually write "commercial use allowed."

**D5 · `PreviewGallery`, 2-up with lightbox `[P1]`**
Two real preview images minimum per paid template (Research 4.2, DESIGN §16). `aspect-[3/4]`, `object-top`, `rounded-md`, dark-mode plate `bg-muted p-3 rounded-md` behind a white document page (never a CSS filter, §16.3). Alt text describes what the page shows — never `alt="preview"`.

**D6 · Sticky buy card on `CourseDetail` `[P0]`**
`ProductBuy` already does the correct `lg:grid-cols-[1fr_380px]` sticky-rail layout. `CourseDetail` is `max-w-4xl` with no sidebar (RESEARCH §7.1 #10). Match `ProductBuy`: content left, sticky price/CTA/inclusions right. One buy card, never repeated inline.

**D7 · Render the `related_products` rail `[P1]`**
`CourseDetail` types and fetches `related_products` but never renders it (RESEARCH §7.1 #8). Add a horizontal related-content rail — compact cards with type badge, title, one line, price. This is the question→product bridge made visible on the course side.

---

## Theme E — Wayfinding `[P1]`

Named as confirmed gaps in RESEARCH §7.1, never assigned.

**E1 · Breadcrumbs on detail pages `[P1]`**
`Questions / Third-party risk` on every detail page (RESEARCH §7.1 #12). `text-xs`, `--muted-foreground`, current item in foreground. Cheap, and it fixes the "no way back to the parent except the browser" problem.

**E2 · Command palette polish `[P1]`**
`⌘K` opens the palette searching questions, courses, templates, lessons — grouped by type with the type as a section header, each row carrying its type icon (§22.1). Arrow keys navigate, Enter opens, Escape closes and returns focus to the trigger. Make the `⌘K` chip a visible affordance in the header, not a hidden shortcut (§17.1).

**E3 · Sticky bottom action bar, mobile `[P1]`**
On product pages below 640px, the buy button becomes a sticky bottom bar respecting the safe area (§13.3). `ProductBuy` has this; `CourseDetail` and `PackDetail` don't.

**E4 · Preserve discovery state on return `[P1]`**
Returning from a question page must restore the exact result list *and* scroll position (§19.8). Filter state lives in the URL, so this is mostly free — verify it actually works end to end, because a broken back-button on the flagship surface is a bounce-generator.

---

## Theme F — The four states, designed once `[P0]`

DESIGN.md §40 specifies these but they're currently a generic `animate-pulse` grey block. This is where "client-ready, not a prototype" is actually decided.

**F1 · Empty `[P0]`**
Names what would be here + the one action that puts something here. Never a blank region, never an illustration with no action.
```
Nothing in your library yet.
Templates and courses you buy appear here.
[Browse the templates]
```

**F2 · Loading `[P0]`**
Skeletons match the real layout's dimensions so nothing shifts when data arrives (§40.2). Delay rule: if a load resolves in under 200ms, show nothing. No full-page spinner on a route with cached data.

**F3 · Error `[P0]`**
Three things, in order: what failed, whether the user must act, what to try. Errors explain and instruct; they don't apologise (§6.1).
```
We couldn't load these questions.
[Try again]  If this keeps happening, [contact us].
```
Scoped to what failed — a failed recommendation block doesn't blank the lesson.

**F4 · Locked `[P0]`**
Locked is not broken and not an error. `muted` surface, dashed `border-border`, lock icon, the name of what unlocks it, and its price — **never** a greyed-out, disabled-looking title (§40.4). The user should read clearly what they're missing; that's the persuasive mechanism. Locked never uses `--destructive` (§7.1).

---

## Theme G — Micro-interactions & feedback `[P1 / P2]`

All within the existing motion envelope (nothing loops except guarded ambient, nothing >500ms, §39).

**G1 · Filter chip → immediate recount `[P1]`**
Chip and checkbox changes recount instantly; only the search input debounces at 250ms (§19.6). A tap that doesn't visibly move the count feels broken.

**G2 · Progress bar width transition `[P1]`**
CSS transition on `width`, not a transform hack. Retains `role="progressbar"` with `aria-valuenow` (the existing a11y contract).

**G3 · Async button states `[P1]`**
Disables, keeps its width, swaps label for spinner + present-tense verb — `Preparing…`, `Redirecting…`, `Publishing…` (§35.3). On success shows the completed state ~4s. Never spins with no words.

**G4 · Card hover, 2px, no scale `[P1]`**
The whole card is one link or one button (not a card with a separate link inside — that's two tab stops for one destination, §36). Hover raises 2px + `shadow-sm`. Never scale — a card that grows 4% pushes its neighbours and reads consumer-app (§39.3).

**G5 · Live-region announcements `[P1]`**
Result-count changes → `aria-live="polite"`; toasts → `role="status"`; payment failure → `role="alert"` (§42.8). Autosave confirmation is polite, not a toast.

---

## Theme H — Numeric & metadata discipline `[P1]`

RESEARCH §7.1 #7: counts, durations, percentages and prices use the body sans; the distinctive mono is used only for eyebrows.

**H1 · Azeret Mono for all numerics `[P1]`**
Question IDs, order numbers, timestamps, file sizes, durations, page counts, prices in tables — anything read character-by-character (§9.3). Mono is the signal that a string is data, not prose. Used at `text-xs`/`text-sm` only.

**H2 · `tabular-nums` on anything countable `[P1]`**
Prices, progress percentages, durations, order totals, and the live result count. Prevents width jitter (§10 rule) — this is what makes a live-updating count look intentional rather than broken.

**H3 · Metadata as a distinct tier `[P1]`**
Stop using `text-sm text-muted-foreground` as the default for everything. Metadata gets its own treatment: mono where numeric, `text-xs` for labels, `text-sm` foreground for values. The fact strip (D1) is the place this matters most.

---

## Theme I — Dark mode & stage plane `[P1 / P2]`

**I1 · Glass surfaces in dark `[P1]`**
The `--glass-*` tokens (Change Set 1, D1.5) must be verified in dark — alphas of `--stage-foreground`, never raw white (§7.6). Confirm text-over-glass clears 4.5:1 against the lightest aurora point beneath it; `--stage-glow-3` is the failure case.

**I2 · Verify re-hued domain colours in dark `[P1]`**
Change Set 1 re-hued light; confirm the dark counterparts (§3.2 table) hold ≥4.5:1 on dark `--background`/`--card`, and that the five still read as distinct at small sizes.

**I3 · Elevation reads from a lighter surface, not a shadow `[P2]`**
In dark mode, shadows contribute almost nothing. Depth comes from `--card` above `--background` plus a border (§12.3, §7.5). Don't add shadow to "fix" a flat dark card — raise the surface.

---

## Theme J — Accessibility & motion polish `[P0 / P1]`

The floor is WCAG 2.2 AA and several items are invisible to a component-level audit (§42).

**J1 · One focus style, everywhere `[P0]`**
`:focus-visible` 2px `--ring`, 2px offset, 4px radius — no per-component overrides (§8). Confirm visible in both themes (the original 1.65:1 dark focus ring was a brief non-negotiable failure).

**J2 · Target sizes `[P0]`**
≥24×24 CSS px, ≥44×44 on touch (§42.6). Filter chips, close buttons, outline rows and pagination are where this fails in practice. Pad the hit area, don't inflate the visual.

**J3 · Reduced motion on every new animation `[P0]`**
The `MotionConfig reducedMotion="user"` backstop plus the explicit loop/parallax guard (Change Set 1, E3.2). Under reduced motion, transitions become instant *state changes*, never removed — the state change still has to be visible (§39.4).

**J4 · Heading order, one `h1` `[P0]`**
Enforced via `PageTitle`/`SectionHeading`. Detail pages that use an `h2`-as-`h1` need the `sr-only` rung fix. Route changes announce the new title and move focus to the `h1` (§42.2, §42.3).

**J5 · Skip link first-focusable `[P0]`**
Present on every page (§42.4). Cheap, and keyboard users depend on it.

---

## Theme K — Performance & sharing `[P2]`

**K1 · Templated OG images per content type `[P2]`**
Generated at build time from title, domain and section — same treatment as course artwork (§44.5). A shared link rendering as a bare URL undercuts "worth paying for" before anyone arrives.

**K2 · Image discipline `[P2]`**
Explicit `width`/`height` or `aspect-ratio` on every image (layout shift is a budget failure, §43); `loading="lazy"` below the fold, `fetchpriority="high"` on the hero only (§16.1).

**K3 · Verify route-level code splitting `[P2]`**
Admin, the rich-text editor and the Mux player must stay out of the learner's initial bundle (§43.1, §53.3). Confirm against the budgets in CI, not by eye.

---

## Theme L — Admin density `[P2]`

DESIGN.md scopes admin as functional-not-decorative (§3.7, §31). These preserve density.

**L1 · Tighter padding, table-first `[P2]`**
`max-w-[1600px]`, `text-sm` throughout, `rounded-sm` on table cells. Admin inherits page-level padding today — tighten it. Tables over cards for lists.

**L2 · Status chips `[P2]`**
`PublishStateChip` semantics: published `success`, draft `warning`, archived `muted`. Every badge carries a word (§37).

**L3 · No atmosphere in admin `[P2]`**
No aurora, no stage plane, no parallax. Density and speed matter there; atmosphere does not (RESEARCH §7.1 #17).

---

## Consolidated priority matrix

| # | Change | Benefit | Impact | Effort | Priority |
|---|--------|---------|--------|--------|----------|
| A1 | Filter-rail counts | No dead-end filtering | Very high | Med | P0 |
| A2 | Live count + two zones | Taxonomy legibility | Very high | Low | P0 |
| A4 | Zero-result recovery | Turns dead end into 2 taps | High | Low | P0 |
| B1 | Serif editorial headline | Credibility anchor | Very high | Low | P0 |
| B2 | Seven-tag definition grid | Structure = product | High | Low | P0 |
| D1 | `FactStrip` | Purchase facts on surface | Very high | Low | P0 |
| D2 | Evidence fields surfaced | Trust already built | Very high | Med | P0 |
| D3 | `VersionStamp` | Currency signal | High | Very low | P0 |
| D6 | Sticky buy card on courses | Matches ProductBuy | High | Med | P0 |
| F1–F4 | The four states | Client-ready, not prototype | Very high | Med | P0 |
| A3 | Quick-goal chips | Teach the taxonomy | High | Low | P0 |
| J1/J2/J4/J5 | A11y floor | Brief non-negotiable | High | Low | P0 |
| C1–C3 | Lesson icons/outline/completion | Learning feels intentional | High | Med | P1 |
| B4 | Related-template buy surface | 3-step budget intact | High | Med | P1 |
| B5 | Author byline + credential | Strongest trust asset | High | Low | P1 |
| D4/D5 | Licence + preview gallery | Pre-purchase confidence | Med | Med | P1 |
| D7 | Related-content rail | Uses fetched data | Med | Very low | P1 |
| E1/E2/E3 | Breadcrumbs / palette / mobile bar | Wayfinding | Med | Med | P1 |
| G1–G4 | Micro-interactions | Feels responsive | Med | Low | P1 |
| H1/H2/H3 | Mono numerics + tabular | Distinctive, stable | Med | Very low | P1 |
| C4 | Video token-expiry state | Prevents refund trigger | High | Med | P1 |
| B3 | EmailGateFade | Conversion moment | Med | Low | P1 |
| I1/I2 | Dark glass + domains | Theme integrity | Med | Low | P1 |
| A5 | MatchBadge | Explain close matches | Med | Low | P1 |
| A6 | Mobile filter bar | Mobile discovery | Med | Med | P1 |
| C5 | Mobile lesson nav | Mobile learning | Med | Low | P1 |
| K1/K2/K3 | OG images, images, splitting | Perf + share | Low | Med | P2 |
| I3 | Dark elevation | Depth in dark | Low | Very low | P2 |
| L1–L3 | Admin density | Faster editing | Low | Med | P2 |

---

## How this slots into the existing phases

- **Fold the P0 items into Phases 4–7** rather than creating a new phase — A/B/D/F are component-and-page work that belongs with the component layer (Phase 4) and the per-screen inheritance (Phase 7).
- **Keep Phase 5 (home) and 6 (dashboard) as scoped.** This pass deliberately does not touch them; it covers the surfaces Change Set 1 left at "token inheritance."
- **The four states (F) are the one item to do early and once.** They're consumed by every other screen, so designing them mid-Phase-4 prevents each page inventing its own empty/error treatment.
- **Nothing here changes an API contract, the gate, or entitlement logic.** C4 (token expiry) is the closest, but it's client-side behaviour against the existing endpoint.

## Two honest caveats

1. **A1's per-value counts assume the question index is already client-cached** (§57.1, ~40 KB at 100 questions). If the catalogue grows past ~500 questions / 250 KB, counting moves server-side behind a debounced endpoint — the UI doesn't change, but the implementation path does. Write that threshold into the handover pack.
2. **D2's "render every populated field" depends on the evidence fields actually being filled in.** The columns exist but the content pass is an owner/author task (W4-R1 task 23). Until real page counts, formats and review dates are entered, the evidence panel renders honestly short — which is correct, but means the visual payoff waits on content, not code.