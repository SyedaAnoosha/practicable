# DESIGN.md vs design_again.md — where each one wins

Two different kinds of document. `DESIGN.md` is a build-ready design system with token values, contrast math, and code. `design_again.md` is a creative brief/prompt describing what the finished product should feel like and avoid, with no implementation detail. Judged on their own terms, below is where each is genuinely stronger, and where they flatly disagree.

---

## Where DESIGN.md wins

- **Contrast is actually audited, not asserted.** §7.3 measures every token pair against WCAG 2.2 and finds six real dark-mode failures (`ring` 1.65:1, `primary` 1.94:1, `sidebar-border` 1.05:1) with corrected hex values in §7.4–7.5. design_again.md only says "use semantic CSS variables" and "improve visual balance" — no numbers, no proof the dark theme is usable by a keyboard user.
- **The taxonomy-matching bug is caught and fixed in code.** §57 identifies that v1's `isExact: close === 0 && exact > 0` logic breaks the moment one filter misses by three steps, and rewrites it against active-constraint count. design_again.md §16 describes the *desired outcome* ("show why a result matches") but never engages with how matching is computed or where it breaks.
- **A real decision-status system.** Every clause is tagged `[DECIDED]` / `[OWNER]` / `[PROVISIONAL]` / `[V2]` (§0.4), so a builder always knows what's settled vs. blocked. design_again.md has no such marker system — everything reads with equal authority whether it's a firm rule or a suggestion.
- **Concrete, numbered constraints.** §4's speed-to-answer budget gives step counts and time targets per journey, each tied to an actual analytics event (`question_search → question_opened`). design_again.md's equivalent (§80, the "5/15/30/60-second test") is a gut-check, not something CI or analytics can verify.
- **Copy has a real glossary.** §6.2's "words we use / words we don't" table (Question not Article, Buy not Enroll, Your library not Dashboard content) is enforceable; design_again.md gestures at tone ("avoid marketing language") without giving the actual vocabulary.
- **It reconciles with a second source-of-truth document.** §0.6 explicitly resolves tensions with a Research Specification (typography, client-side filtering, semantic search). design_again.md exists in isolation and doesn't acknowledge any other governing document.
- **Stack-specific and buildable.** Tailwind v4 CSS-first config (§8), font self-hosting via `vite-plugin-webfont-dl` (§9.5), Zustand + URL state for filters (§19.8), TanStack Query, routing, project structure, testing (§51–58) are all specified. design_again.md never names a framework, state library, or routing approach — it can't be handed to an engineer as-is.
- **Performance and analytics are numeric.** §43 gives LCP/INP/CLS budgets that "fail CI"; §48 gives an analytics event schema with *properties*, not just names. design_again.md's §72 lists event names only ("question_search", "purchase_completed") with no property schema — not enough to answer "which filter combination precedes a purchase."
- **Component-level rigor.** §33–34 define component contracts and a Definition of Done; §60 defines component *states* (default/hover/focus/disabled/locked/etc.) as a checklist applied per component. design_again.md's §60 lists the same state vocabulary but as prose, not as a contract any component is checked against.

## Where design_again.md wins

- **A genuine brand-concept section.** §4 ("Brand Concept") interprets what "Deciding in the Dark" should *mean* visually — clarity, signal, evidence, decision points — while explicitly banning the literal trap (moons, stars, dark rooms). DESIGN.md never once addresses what the product name itself should evoke; §5 covers personality adjectives only, not the name's metaphor.
- **A sharper, longer "what to avoid" list.** §78 is a 20-item anti-pattern list (circular progress everywhere, seven taxonomy badges per result, fake testimonials/metrics/reviews, "Test test" content) that reads as hard-won practical knowledge of what makes learning platforms look cheap. DESIGN.md has no single consolidated anti-pattern list of this length or specificity.
- **Better negative-space discipline on cards.** §8 states plainly: "A paragraph should never be inside a card simply because it is a 'section'... A question result can be a bordered row. A course can be a card." This rule is crisper and more quotable than DESIGN.md's equivalent scattered across §12.3 and §20.1.
- **A cleaner, single end-to-end prototype spec.** §76 lays out one unbroken journey (home → search → filter → question → related product → purchase → member area → lesson → progress) as the single thing to prototype before anything else. DESIGN.md's closest equivalent (§4's budget table, §46's readiness checklist) is more rigorous but more fragmented — no single "build this path first" statement.
- **Explicit visual-priority ranking of the whole IA.** §77 ranks all seven functional areas (discovery > reading > product connection > learning > commerce > library > admin) in one place. DESIGN.md's priority ordering is implied by section order and the §3.3 "trust before decoration" list, but never stated as a single ranked list of surfaces.
- **More disciplined on "seven-dimension" display everywhere.** §17 explicitly bans exposing all seven filters at once on mobile and prescribes chip-based active-filter display cleanly in a few lines. DESIGN.md reaches similar behavior (§19.5, §19.9) but needs several longer subsections to say it.
- **Reads faster and is easier to hand to a non-technical stakeholder** (author, owner, marketer) for a gut check — it's a product/creative brief, not an engineering spec, so it's the better document for aligning taste before DESIGN.md's implementation work begins.

---

## Where they flatly disagree

| Topic | DESIGN.md | design_again.md |
|---|---|---|
| **Free question content** | §21.3 `[DECIDED]`: guidance body and "what to do next" steps are **gated** behind entitlement/lead capture; only title, tags, and short answer are public. | §20 "Current product direction": **question body is fully public**; email capture is "a soft conversion mechanism, not the security boundary." |
| **Serif usage** | §9.4: serif (Source Serif 4) is confined to long-form reading body only — **never for headings or the question title itself**, which is set in sans (Bricolage). | §5: recommends serif "for major question titles, editorial headlines" — i.e. the question title itself should be serif, contradicting DESIGN.md's explicit ban. |
| **Mobile filter apply behaviour** | §19.9: sheet changes apply **on close**, not per tap — explicitly rejects live recount on every tap as "disorienting." | §13/§17: "Clicking a quick filter should immediately update the question library" — implies live/instant apply, no batching. |
| **Border radius ceiling** | §12.1: tightened twice, now pinned at a hard **12px ceiling** across the entire product, including `rounded-2xl/3xl`. | §8: "6px–12px for most controls, larger radius only for major product surfaces" — explicitly allows going *above* 12px for hero/feature surfaces. |
| **Colour source** | §7.4–7.5: supplies **corrected, final hex values**, treating the existing palette as broken in six places and replacing them. | §7: "Use the existing project palette as the implementation source, but improve visual balance" — treats the existing palette as basically sound, only needing restraint in application. |

---

## Bottom line

If the question is "which document should an engineer build from," **DESIGN.md wins clearly** — it's the only one with audited tokens, a fixed scoring bug, a real stack, and enforceable rules. If the question is "which document better captures the *feel* and *positioning* the product should have before a pixel is drawn," **design_again.md wins** — it's shorter, sharper on brand meaning and anti-patterns, and easier for a non-engineer to react to. The two should be reconciled, not merged as-is: the free-content gating and serif-usage disagreements in particular need an explicit owner decision before both documents can be treated as one source of truth.
