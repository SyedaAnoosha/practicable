# Deciding in the Dark — Design System & UI Specification

**Version 2.0** · Supersedes v1.0 · Status: working specification, Week 1 build-ready
**Stack:** React 19 · TypeScript · Tailwind CSS v4 (frontend) → FastAPI · Supabase · Stripe · Mux · R2 (backend, per Research Spec)

---

## 0. About this document

### 0.1 What this is

This is the **single source of truth for everything visible**: the visual system, the interaction rules, the component contracts, the copy voice, the responsive and accessibility floor, and the frontend implementation patterns that keep all of it consistent.

It is written to be built against on Day 1, not read once and filed. Every section is either a **rule** (do this), a **contract** (this component behaves like this), or a **decision** (this is what we chose and what we rejected).

### 0.2 What this is not

It is not the product specification and it is not the architecture document. Those exist:

| Document | Owns |
|---|---|
| `Deciding_in_the_Dark_Platform_Intern_Brief.md` | Scope, deliverables, non-negotiables, the four-week sequence |
| `Deciding_in_the_Dark_Research_Specification.md` | Market and user research, content model, entity schema, backend stack, security model, pricing, legal |
| **This document** | Everything the user sees or touches, and the frontend code patterns that produce it |

Where this document and the Research Specification appear to disagree, the Research Specification wins on *data model, security and backend*; this document wins on *interface, interaction and frontend structure*. Section 0.6 lists the places the two were reconciled and how.

### 0.3 How to use it

- **Before building any screen** — read §46 (Screen readiness checklist). A screen that cannot answer those questions is not ready to be coded.
- **Before adding a colour, size, radius or duration** — it is already in Part B. If it is not, it needs a decision, not an improvisation.
- **Before adding a dependency** — check §51. The stack is closed for v1; additions need a written reason.
- **Before shipping** — run Part G's QA checklist against a real device, a real card and a logged-out browser.

### 0.4 Status legend

Used throughout so a reader can tell settled ground from open ground:

| Marker | Meaning |
|---|---|
| `[DECIDED]` | Settled. Build to this. Changing it is a change request, not a preference. |
| `[OWNER]` | Blocked on the owner or author. Named in §60 with the date it must be resolved. |
| `[PROVISIONAL]` | Chosen so work can start; expected to be revisited once real content or real users exist. |
| `[V2]` | Deliberately out of scope for v1. Designed *for*, not built. |

### 0.5 Changelog — what changed in v2.0 and why

The v1.0 document was structurally sound: the principles, the surface inventory and the token discipline were right and are retained. v2.0 fixes correctness problems, closes gaps against the brief, and makes the document buildable without interpretation.

| # | Change | Why it mattered |
|---|---|---|
| 1 | **Contrast audit of the supplied palette, with corrected token values** (§7.4–7.6) | Six token pairs failed WCAG 1.4.11 in dark mode, including the focus ring (1.65:1). The brief requires "readable contrast" and "keyboard navigation" — an invisible focus ring fails both. |
| 2 | **Light-theme sidebar tokens rebuilt** (§7.5) | The supplied light theme's `--sidebar-accent` (`#1a1d42`) and `--sidebar-border` (`#1b1a42`) are near-black — dark-theme values pasted into the light block. The hover state of a light sidebar item would have gone near-black. |
| 3 | **React Router v6 → v8** (§53) | React Router v6 was declared **End of Life in June 2026** and no longer receives security updates. `react-router-dom` no longer exists as a package. Shipping a paid product on an EOL router is not defensible in a handover pack. |
| 4 | **React 18 → React 19 + React Compiler** (§51) | 19.x is the current line; the compiler is stable and removes most manual memoisation, which matters on the discovery page's live-filtering render path. |
| 5 | **SEO strategy rewritten around prerendering** (§44) | v1 §64 required canonical URLs, Open Graph and "crawlable question pages" — none of which a plain Vite SPA delivers. The public question pages are the top of the acquisition funnel (Research Spec 8.2). Fixed with build-time prerendering of public routes. |
| 6 | **Question scoring bug fixed** (§57) | v1's `isExact: close === 0 && exact > 0` marks a question exact when one constraint matches perfectly and another misses by three steps. It must compare exact matches against the count of *active* constraints. |
| 7 | **Client-side filtering contradiction resolved** (§57.1) | v1 §63 forbade "client-side filtering of the entire database" while §57 required instant filter counts. At 100 questions these are not in conflict — the index is ~40 KB. The rule is now stated with its cutover threshold. |
| 8 | **Route and naming contradictions fixed** (§47, §52, §53) | v1 used `/learning/` and `/learn/`, `/terms` and `/legal/terms`, `/login` and `/sign-in`, and both `QuestionCard.tsx` and `question-card.tsx`. One of each now. |
| 9 | **Paywall preview designed** (§21) | The gated-preview experience is the conversion moment (Research Spec 8.2 step 3) and v1 covered it in five lines. Now specified, including what must *not* be sent to the client. |
| 10 | **Free entry point designed** (§27) | A named deliverable in the brief ("at least one free entry point that earns an email address") with no design in v1. |
| 11 | **Session, token and URL expiry states designed** (§29.4, §26.5, §45.3) | Mux tokens expire in 15–30 min and R2 presigned URLs in 60 s. v1 had no design for a token expiring *mid-playback* — a guaranteed real-world failure on a 40-minute lesson. |
| 12 | **Typography resolved** (§9) | v1 specified Bricolage Grotesque + Georgia; the Research Spec (12.5) recommended a serif-heading pairing. Resolved explicitly rather than left as two documents disagreeing. |
| 13 | **Fluid type scale with tokens** (§10) | v1 gave a table of rem values and one example class. Now a token set with `clamp()` values that can be applied without per-screen decisions. |
| 14 | **Email templates re-specified for Jinja2/HTML** (§32) | Research Spec 6.7: the backend is Python, so React Email cannot render at send time. v1's email section assumed otherwise by omission. |
| 15 | **Analytics events given a property schema** (§48) | v1 listed event names. Names without properties cannot answer "which filter combination precedes a purchase" — the one question the funnel exists to answer. |
| 16 | **Performance budgets given numbers** (§43) | "Avoid large bundles" is not a budget. Now: LCP, INP, CLS and route-chunk targets that fail CI. |
| 17 | **SPA accessibility gaps closed** (§42) | Route-change announcement, focus management on navigation, skip link, and WCAG 2.2 target size — none present in v1, all invisible to a component-level audit and all required for keyboard users. |
| 18 | **Component contracts and Definition of Done added** (§33–§34) | "It extends without you" (brief) requires the next developer to know a component's props and states without reading its source. |
| 19 | **Copy and voice rules added** (§6) | The brief assesses whether the product "looks worth paying for". Interface copy is half of that judgement and v1 covered only button verbs. |
| 20 | **Design tokens exported as code** (§50) | The brief's design-system deliverable is a *documented component set*, not a document describing one. Tokens now live in one CSS file and one TS file, generated from the same source. |

### 0.6 Reconciliations with the Research Specification

| Tension | Resolution |
|---|---|
| Research 12.5 recommends serif headings; v1 chose Bricolage Grotesque | §9 `[DECIDED]`: Bricolage Grotesque for display/UI, **Source Serif 4** for long-form reading. The serif carries the editorial credibility the research asks for, in the place where it actually earns its keep — the 200–500 word guidance body. |
| Research 3.2 specifies a Postgres `WHERE` query; v1 §57 requires instant client-side counts | §57.1 `[DECIDED]`: FastAPI owns the query contract and the authoritative result. The client caches the published question **index** (title, slug, domain, seven tags, 160-char preview) for instant recount. Bodies are never in the index. |
| Research 9.2 offers semantic search as "should have"; v1 does not mention it | §22.4 `[V2]`: the discovery UI reserves the layout slot and the empty-state copy for it, so adding pgvector later is a query change, not a redesign. |
| Research 12.6 says do not build certificates; brief says propose if cheap | §59 `[DECIDED]`: not built. §24.4 specifies the completion moment that delivers the same psychological payoff for roughly an hour of work. |

---

# PART A — FOUNDATIONS

## 1. What we are designing

A paid professional knowledge platform for risk, compliance, governance and security practitioners, built on 100 real questions tagged seven ways.

The interface should feel: **professional, editorial, calm, trustworthy, clear, content-first, fast to understand, comfortable to read at length, and premium without looking luxurious.**

It should not feel like a generic LMS, a corporate dashboard, or a marketing landing-page template.

### 1.1 The one test

> A stranger finds the site, understands within seconds what it is and who it is for, buys something, receives it, and learns from it — without anyone helping them.

Every design decision in this document is downstream of that sentence. When a choice is genuinely balanced, pick the option that makes that sentence more likely to be true for someone who has never heard of the author.

### 1.2 Who is on the other side of the screen

A risk manager, three coffees into a Tuesday, with a specific problem and roughly four minutes of patience. They are **searching, not browsing**. They will judge credibility in about five seconds, largely on typography, density and how confidently the thing states what it is. They may be on a phone. They may be expensing it, which means they need a receipt with a real company name on it.

They are not impressed by animation. They are impressed by a clear answer, a price they can see without hunting, and a page that does not waste their time.

## 2. Product constraints the design must satisfy

These come from the brief and the research and are not negotiable at the design level.

| # | Constraint | Design consequence |
|---|---|---|
| C1 | Paid content genuinely inaccessible without paying — logged-out user, signed-out link and direct file URL all fail closed | §45. Gating is server-enforced; the UI never treats a client-side flag as authority. |
| C2 | Never handle card data; hosted checkout only | §26. There is no card form anywhere in this design. |
| C3 | Video through a provider with signed, access-controlled playback | §25. Mux Player, short-lived tokens, and a designed expiry state. |
| C4 | A non-technical person adds a course, lesson or template without calling the developer | §31. Admin is designed as a product, with help text, error recovery and a usability test as a deliverable. |
| C5 | A new section — different subject, author, audience — is configuration, not a rebuild | §3.5. Nothing in the UI hard-codes "the book", "the author" or "risk". |
| C6 | It must look worth paying for | Part B, applied from the first screen in Week 1 (Research 12.3, 12.5). |
| C7 | Speed to answer — how few steps from landing to owning it | §4. A published step budget per journey, measured in analytics. |
| C8 | Real content, real prices, real names — no placeholder junk | §49.2. Including the long-title and long-name stress cases. |
| C9 | Accessible: contrast, keyboard, captions, sensible text sizes | §42, and a token set that cannot produce a failing pair (§7). |
| C10 | Mobile including checkout and video | §40–§41. Mobile is a designed layout, not a narrowed desktop one. |

## 3. Design principles

### 3.1 Answer first

The product is questions. The path is:

```
Question → useful answer → related content → template or course → purchase
```

Never make someone walk through a course catalogue to reach useful information. The catalogue is how content is *consumed*; the question index is how it is *found*. These are different flows and the homepage serves the second one.

### 3.2 Two modes, one system

**Editorial mode** — questions, guidance, articles, book content, reading lessons, author pages.
Large readable type, generous vertical rhythm, narrow measure, strong hierarchy, almost no chrome.

**Product mode** — dashboard, courses, progress, pricing, checkout, downloads, account, admin.
Clear cards, compact controls, strong states, obvious actions, consistent spacing.

They share every token and every primitive. What differs is density and measure, not palette or typeface. A user should never feel they have crossed into a different product — only into a different task.

### 3.3 Trust before decoration

Priority order when they conflict:

1. Readability
2. Clear pricing
3. Clear ownership — what have I bought, what do I still not have
4. Clear access state
5. Clear actions
6. Consistent interaction
7. Motion

Never use animation to compensate for weak hierarchy. If a screen needs movement to be legible, the layout is wrong.

### 3.4 One primary action

Most screens have exactly one obvious primary action: `Read the answer`, `Start the module`, `Buy the template`, `Continue lesson`, `Download template`.

Secondary actions are visually quieter. Two primary buttons in one visual group is a bug.

### 3.5 Assume it grows

The book is the first section, not the only one. Every screen and every component must survive the question: *what happens when we add a second subject, with a different author, for a different audience?*

Concretely, in the UI:

- No component hard-codes the section title, the author name, or the word "risk".
- Domain and tag values are rendered from data, never from a TypeScript union of the current five domains — except where a value's *display label* needs a human-written string, which lives in one lookup file (§50.3).
- Navigation renders the section list; a second section adds a nav item, not a nav rewrite.
- Any screen that would need a redesign when a second author appears is flagged now, not discovered in month six.

### 3.6 Explain, don't just rank

Where the product makes a judgement on the user's behalf — a close match, a recommendation, a suggested next lesson — the interface says **why** in plain words. `Because you were reading about risk reporting` beats `Recommended for you`. This audience distrusts opaque relevance, and a transparent rule is also dramatically cheaper to build and debug (Research 3.5).

## 4. The speed-to-answer budget

The brief asks: *how few steps from landing to owning it?* This is the answer, and it is a design constraint with numbers attached.

| Journey | Step budget | Target time | Instrumented as |
|---|---|---|---|
| Land → find a relevant question | 1 interaction | < 30 s | `question_search` or `question_filter_applied` → `question_opened` |
| Question → own the related template | 3 steps | < 4 min | `question_opened` → `checkout_started` → `purchase_completed` → `download_started` |
| Land → free entry point captured | 2 steps | < 60 s | `page_view` → `lead_captured` |
| Purchase → first lesson playing | 1 step | < 30 s | `purchase_completed` → `video_started` |

**Rules that follow from the budget:**

- The question finder is on the homepage itself, not behind a `/questions` click.
- Buying a template does not require browsing to a catalogue first — the question page's related-template card is a buy surface.
- Account creation happens *at* checkout or after it, never as a gate before someone can see whether the product is any good. `[OWNER]` guest-checkout vs account-required is an open decision (Research Appendix J); this design assumes **account-required but created inside the checkout flow**, which keeps the budget at three steps.
- Any new step added to these journeys must remove one.

## 5. Brand personality

**The interface should communicate:** practical, experienced, direct, useful, calm, authoritative, human, considered.

**Avoid:** loud startup aesthetics, gradient washes, neon, glassmorphism, animated backgrounds, generic corporate stock photography, dashboard overload, everything-is-a-rounded-card, decorative motion.

The register to aim for is a good professional publisher — confident enough not to shout.

## 6. Voice and interface copy

Copy is design material. It is assessed the same way as spacing.

### 6.1 Rules

- **Sentence case everywhere.** Headings, buttons, labels, table headers. No Title Case, no ALL CAPS except the small eyebrow label above a question or card title (§18.2), which is a deliberate typographic device.
- **Name things by what the user controls,** not how the system works. "Your downloads", not "Entitled assets". "Question", not "Content item".
- **Active voice, and the verb survives the flow.** The button says `Publish course`; the toast says `Course published`; the badge says `Published`. Same word, three states.
- **Buttons say what happens.** `Start the module`, not `Submit`. `Buy the template`, not `Proceed`. `Download the checklist`, not `Get`.
- **No filler.** Delete "simply", "just", "easily", "seamlessly", "unlock", "empower", "revolutionise". If a sentence survives its own deletion, delete it.
- **Errors explain and instruct; they do not apologise.** "Payment wasn't completed. Your card has not been charged." — not "Oops! Something went wrong."
- **Empty states are invitations.** They say what would be here and give the one action that puts something here.
- **Prices are always visible and always formatted with currency.** `US$149`, not `149` and never `$0.00` in a real fixture.
- **One job per element.** A label labels. A helper text explains. Neither sells.

### 6.2 Words we use, and words we don't

| Use | Not |
|---|---|
| Question | Article, post, item, content |
| Guidance | Answer key, solution |
| Template | Asset, resource, download (as a noun for the file) |
| Course, module, lesson | Class, unit, chapter |
| Domain | Category, topic, tag group |
| Buy / purchase | Enroll, unlock, get instant access |
| Sign in / sign up | Log in / register (pick one pair; this is the pair) |
| Your library | My stuff, dashboard content |

### 6.3 The author's voice

The guidance text is published work under a real name. **It is reproduced, never rewritten.** No component may truncate guidance body text with an ellipsis in a way that changes its meaning; previews use a purpose-written 160-character summary field (`preview`), authored separately, not a machine-cut first paragraph (§20.3).

Anything public — marketing copy, product descriptions, email copy, legal pages — is drafted for owner review before it ships, per the brief. `[OWNER]`

---

# PART B — THE VISUAL SYSTEM

## 7. Colour

### 7.1 How colour is used

The palette is small on purpose. Deep navy carries authority and does the work of a brand colour; a single blue accent carries interactivity; everything else is a near-neutral with a faint violet cast that keeps the greys from looking cold and institutional.

| Role | Meaning in this product |
|---|---|
| `primary` | The brand and the primary action. Buttons that cost money or start learning. |
| `accent` | Interactive emphasis and the "regulator pressure" tag family. Used sparingly. |
| `secondary` | Quiet surfaces that still need to read as interactive-adjacent. |
| `muted` | Non-interactive surfaces and de-emphasised text. |
| `destructive` | Irreversible actions and payment failure. Never used for a locked state. |
| `chart-1…5` | Data visualisation only. Never for UI chrome. |

**Locked content is not an error.** It uses `muted` and a lock icon, never `destructive`. A user who has not bought something has not done anything wrong.

### 7.2 The rule that prevents drift

Components use **semantic utilities only**:

```tsx
<div className="bg-background text-foreground" />
<Card className="border-border bg-card" />
<Button className="bg-primary text-primary-foreground" />
```

Never `bg-[#03035e]`, never `text-blue-700`, never a hex in a component file. A raw colour value appearing outside `src/styles/theme.css` fails review. This is enforceable — see §50.4 for the lint rule.

### 7.3 Contrast audit of the supplied palette `[DECIDED]`

Every foreground/background pair in the supplied token set was measured against WCAG 2.2 (4.5:1 for body text, 3:1 for large text and non-text UI including focus indicators and meaningful borders).

**Light theme — all text pairs pass.**

| Pair | Ratio | Verdict |
|---|---:|---|
| `foreground` / `background` | 19.7 | Pass |
| `muted-foreground` / `background` | 6.2 | Pass |
| `muted-foreground` / `muted` | 5.5 | Pass |
| `primary-foreground` / `primary` | 17.8 | Pass |
| `secondary-foreground` / `secondary` | 6.1 | Pass |
| `accent-foreground` / `accent` | 6.0 | Pass |
| `destructive-foreground` / `destructive` | 4.7 | Pass |
| `ring` / `background` | 3.65 | Pass (3:1 floor), but see 7.5 |

**Dark theme — six failures, all in non-text UI, all invisible to a text-only audit.**

| Pair | Ratio | Verdict | Consequence if shipped |
|---|---:|---|---|
| `ring` / `background` | **1.65** | **Fail** | The focus ring is effectively invisible in dark mode. Keyboard navigation is unusable — a direct failure of a brief non-negotiable. |
| `primary` / `background` | **1.94** | **Fail** | A primary button has no discernible edge against the page. The label is readable; the button is not findable. |
| `destructive` / `background` | **2.11** | **Fail** | Destructive text and icons disappear. "Payment failed" would read as body text. |
| `sidebar-border` / `sidebar` | **1.05** | **Fail** | The sidebar has no visible edge. |
| `border` / `card`, `input` / `card` | 1.20–1.26 | Fail *if load-bearing* | Acceptable for decorative grouping; not acceptable where a border is the only signal of an input's boundary or a card's selected state. |

**Light theme — two structural errors, not contrast failures.** The light block's `--sidebar-accent: #1a1d42` and `--sidebar-border: #1b1a42` are near-black values that appear to have been copied from the dark block. Against a `#e2ebfd` sidebar they measure 16:1 and 13.8:1 — meaning the hover state of a light sidebar item would render as a near-black bar, and the sidebar edge as a hard black rule. These are corrected below.

### 7.4 Light theme `[DECIDED]`

```css
:root {
  /* Surfaces */
  --background: #FDFCFE;
  --foreground: #0A050D;
  --card: #FFFFFF;
  --card-foreground: #0A050D;
  --popover: #FFFFFF;
  --popover-foreground: #0A050D;

  /* Brand */
  --primary: #03035e;
  --primary-foreground: #FFFFFF;
  --secondary: #e2ebfd;
  --secondary-foreground: #0248d4;
  --accent: #e5e8ff;
  --accent-foreground: #0248d4;

  /* Quiet */
  --muted: #F0EEF2;
  --muted-foreground: #635D69;

  /* Lines and fields */
  --border: #E6E1E9;
  --border-strong: #8F8896;   /* CHANGED: added — 3.4:1 on card, for state-bearing borders */
  --input: #E6E1E9;
  --ring: #2F6BF0;            /* CHANGED from #3d7eff — 4.6:1 on background, 4.1:1 on muted */

  /* Status */
  --destructive: #E11D48;
  --destructive-foreground: #FFFFFF;
  --success: #067647;         /* ADDED — 5.6:1 on background */
  --success-foreground: #FFFFFF;
  --warning: #8A5300;         /* ADDED — 5.4:1 on background */
  --warning-foreground: #FFFFFF;

  /* Sidebar */
  --sidebar: #e2ebfd;
  --sidebar-foreground: #02173b;
  --sidebar-primary: #03035e;                /* CHANGED from #FDFCFE — was inverted */
  --sidebar-primary-foreground: #FFFFFF;     /* CHANGED from #11172c */
  --sidebar-accent: #D3E0FB;                 /* CHANGED from #1a1d42 — dark value in light block */
  --sidebar-accent-foreground: #02173b;      /* CHANGED from #FFFFFF */
  --sidebar-border: #C3D6F7;                 /* CHANGED from #1b1a42 */
  --sidebar-ring: #2F6BF0;                   /* CHANGED from #232986 — matches --ring */

  /* Charts — data visualisation only */
  --chart-1: #0248d4;
  --chart-2: #6D3BD6;   /* CHANGED from #8B5CF6 — 4.2:1 was borderline for a labelled series */
  --chart-3: #B02BC4;   /* CHANGED from #D946EF */
  --chart-4: #F43F5E;
  --chart-5: #B4530C;   /* CHANGED from #F97316 — 2.8:1 on white failed as a legend swatch */

  /* Type */
  --font-sans: 'Bricolage Grotesque', ui-sans-serif, system-ui, sans-serif;
  --font-serif: 'Source Serif 4', Georgia, 'Times New Roman', serif;
  --font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, monospace;
  --letter-spacing: -0.01em;

  /* Geometry */
  --radius: 1.25rem;
  --spacing: 0.25rem;

  /* Elevation */
  --shadow-color: 0 0 0;
  --shadow-opacity: 0.10;
  --shadow-blur: 10px;
  --shadow-offset-x: 0px;
  --shadow-offset-y: 4px;
  --shadow-spread: 0px;
}
```

### 7.5 Dark theme `[DECIDED]`

```css
.dark {
  /* Surfaces */
  --background: #020409;
  --foreground: #FDFCFE;
  --card: #060a13;
  --card-foreground: #FDFCFE;
  --popover: #060913;
  --popover-foreground: #FDFCFE;

  /* Brand */
  --primary: #2F5BD8;          /* CHANGED from #0f2ea9 — 3.5:1 vs background (was 1.9:1),
                                  white label 5.8:1 on the button */
  --primary-foreground: #FFFFFF;
  --secondary: #11172c;
  --secondary-foreground: #FDFCFE;
  --accent: #1a1f42;
  --accent-foreground: #FDFCFE;

  /* Quiet */
  --muted: #0c1022;
  --muted-foreground: #9999a8;

  /* Lines and fields */
  --border: #232A52;           /* CHANGED from #1b1a42 — visible edge without becoming a rule */
  --border-strong: #6D74A8;    /* ADDED — 4.4:1 on card */
  --input: #232A52;            /* CHANGED from #1a2142 */
  --ring: #5F78F7;             /* CHANGED from #232686 — 5.4:1 vs background (was 1.65:1) */

  /* Status */
  --destructive: #E11D48;      /* CHANGED from #811D33 — 4.3:1 vs background (was 2.1:1),
                                  white label 4.7:1 */
  --destructive-foreground: #FFFFFF;
  --success: #2CC08A;          /* ADDED */
  --success-foreground: #04140D;
  --warning: #E9A13B;          /* ADDED */
  --warning-foreground: #150C02;

  /* Sidebar */
  --sidebar: #0a0e1e;
  --sidebar-foreground: #A9ACC4;             /* CHANGED from #81839c — 5.2:1 → 7.4:1 */
  --sidebar-primary: #2F5BD8;                /* CHANGED — matches --primary */
  --sidebar-primary-foreground: #FFFFFF;
  --sidebar-accent: #171D3C;                 /* CHANGED from #11132c — visible hover state */
  --sidebar-accent-foreground: #FFFFFF;
  --sidebar-border: #232A52;                 /* CHANGED from #11122c — 1.05:1 was invisible */
  --sidebar-ring: #5F78F7;

  /* Charts */
  --chart-1: #5f78f7;
  --chart-2: #ef9b4d;
  --chart-3: #F43F5E;
  --chart-4: #F97316;
  --chart-5: #A78BFA;   /* CHANGED from #232686 — was indistinguishable from the background */

  /* Elevation — dark surfaces read depth from a lighter surface, not a darker shadow */
  --shadow-opacity: 0.5;
  --shadow-blur: 20px;
  --shadow-offset-y: 10px;
}
```

### 7.6 Colour rules

- **Colour is never the only carrier of meaning.** Every status has an icon or a word alongside it. Every tag has a label. Every chart series has a direct label, not just a legend swatch.
- **`--border` is decorative; `--border-strong` is meaningful.** Use `--border` to group. Use `--border-strong` (or `--ring`) whenever the border *is* the message: selected filter chip, focused input, error field, current lesson.
- **Dark mode is not an inversion.** Check imagery, video posters and template previews at both themes (§16.3).
- **Never hard-code white.** `bg-white` in a component is a dark-mode bug in waiting.
- **Charts are exempt from the semantic-token rule** only inside chart components, and only using `--chart-*`.

## 8. Tailwind theme mapping `[DECIDED]`

Tailwind CSS v4 uses a CSS-first configuration. There is no `tailwind.config.js`. Do not mix v3 config syntax into this project.

```css
/* src/styles/theme.css — the only file in the repo containing colour values */
@import "tailwindcss";

/* Class-based dark mode (we toggle .dark on <html>, we do not follow the OS blindly — §55) */
@custom-variant dark (&:where(.dark, .dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);

  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);

  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);

  --color-border: var(--border);
  --color-border-strong: var(--border-strong);
  --color-input: var(--input);
  --color-ring: var(--ring);

  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-success: var(--success);
  --color-success-foreground: var(--success-foreground);
  --color-warning: var(--warning);
  --color-warning-foreground: var(--warning-foreground);

  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);

  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);

  --font-sans: var(--font-sans);
  --font-serif: var(--font-serif);
  --font-mono: var(--font-mono);

  --radius-sm: calc(var(--radius) - 0.75rem);  /* 8px  — compact controls */
  --radius-md: calc(var(--radius) - 0.5rem);   /* 12px — inputs, small cards */
  --radius-lg: calc(var(--radius) - 0.25rem);  /* 16px — cards */
  --radius-xl: var(--radius);                  /* 20px — feature blocks */

  /* Motion tokens — see §39 */
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --ease-entrance: cubic-bezier(0, 0, 0, 1);
  --ease-exit: cubic-bezier(0.3, 0, 1, 1);
}

@layer base {
  * { border-color: var(--color-border); }
  body {
    background-color: var(--color-background);
    color: var(--color-foreground);
    font-family: var(--font-sans);
    letter-spacing: var(--letter-spacing);
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }
  /* One focus style, everywhere, no exceptions */
  :focus-visible {
    outline: 2px solid var(--color-ring);
    outline-offset: 2px;
    border-radius: 4px;
  }
}
```

## 9. Typefaces `[DECIDED]`

Three faces, three jobs. Adding a fourth needs a written reason.

### 9.1 Bricolage Grotesque — display and interface

Headings, navigation, buttons, labels, product names, card titles, short interface copy.

Bricolage has an optical-size axis (`opsz` 12–96), which is the specific reason it earns its place: the same family gives a tightly-set 96px hero and a legible 12px badge without either looking like the other stretched. It has enough character to not read as a default, and enough restraint to not read as a startup.

Set headings with negative tracking (`--letter-spacing: -0.01em`, tightening to `-0.02em` at display sizes). Weight range in use: **400, 500, 600, 700**. Not 300 — it goes soft at body sizes and undermines the authority we want.

### 9.2 Source Serif 4 — long-form reading

Question guidance bodies, reading lessons, book excerpts, the author's essays.

This is the reconciliation of the Research Spec's serif recommendation (12.5) with v1's sans-only direction. The serif is confined to the place where it does real work — 200–500 words of guidance a practitioner will actually read — where it signals published work rather than web copy, and where a serif genuinely improves sustained reading.

Source Serif 4 over Georgia because it is a variable font with a proper optical-size axis, it has a text-grade design (Georgia's large x-height and wide set were drawn for 1996 screens), and self-hosting one variable file is cheaper than the fallback risk. Georgia stays as the fallback so an FOUT degrades gracefully rather than reflowing dramatically.

**Do not use the serif for the whole application.** Never for navigation, buttons, labels, tables, admin, or anything under 16px.

### 9.3 JetBrains Mono — data and identifiers

Question IDs, tag values in admin, order numbers, timestamps, file sizes, API identifiers, anything a person might need to read character by character or copy exactly.

Mono is a signal that a string is *data*, not prose. Used at `text-xs` and `text-sm` only.

### 9.4 Pairing rules

| Context | Face |
|---|---|
| Hero, page titles, section headings, card titles | Sans (Bricolage) |
| The question itself, on a question page | Sans, large, tight — it is a headline, not body |
| Guidance body, reading lesson body, author essay | Serif (Source Serif 4) |
| Lead paragraph / summary answer | Serif, `text-lg`, `--muted-foreground` |
| Every control, label, nav item, table, admin screen | Sans |
| IDs, prices in a reconciliation table, timestamps | Mono |
| Prices on marketing surfaces | Sans, tabular figures (`font-variant-numeric: tabular-nums`) |

### 9.5 Loading the fonts `[DECIDED]`

Vite has no `next/font` equivalent, so this is done by hand — and done wrong it costs both the performance budget (§43) and the "worth paying for" first impression, because a fallback-to-webfont reflow on the hero is the most visible possible sign of an unfinished build.

**Self-host the variable font files.** Do not link to Google Fonts in production.

```ts
// vite.config.ts
import webfontDownload from 'vite-plugin-webfont-dl'

export default defineConfig({
  plugins: [
    react({ babel: { plugins: [['babel-plugin-react-compiler', {}]] } }),
    tailwindcss(),
    webfontDownload([
      'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..700&display=swap',
      'https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400..600&display=swap',
      'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap',
    ]),
  ],
})
```

Self-hosting is preferred for three reasons, in this order of importance here:

1. **Privacy.** A Google Fonts request leaks every visitor's IP to a third party on page load. For a platform whose privacy policy is a reviewed legal deliverable and whose buyers are compliance professionals, that is an avoidable liability.
2. **Performance.** One origin, no extra DNS and TLS handshake, and the files are covered by the app's own cache headers.
3. **Reliability.** No third-party dependency on the critical rendering path.

**Rules**

- `font-display: swap`, and preload **only** the two weights used above the fold — Bricolage 600 and Source Serif 4 400. Preloading all nine files is slower than preloading none.
- Variable fonts only, one file per family. Do not ship nine static weight files.
- Subset to Latin plus Latin-Extended. The author names and question text need the extended range (§49.2's fixture with `Ní Bhraonáin` exists partly to catch a bad subset).
- Set the fallback stacks so an FOUT degrades gracefully rather than reflowing: Georgia behind Source Serif 4, `ui-sans-serif`/`system-ui` behind Bricolage. Check the swap visually on a throttled connection — if the hero jumps, adjust `size-adjust` on the fallback.

## 10. Type scale `[DECIDED]`

A 1.25 (major third) ratio at the base, loosening at display sizes, expressed as fluid `clamp()` tokens so headings do not need per-breakpoint classes.

```css
@theme inline {
  --text-display: clamp(2.75rem, 1.6rem + 4.6vw, 4.5rem);   /* 44 → 72px */
  --text-h1:      clamp(2.25rem, 1.6rem + 2.6vw, 3.25rem);  /* 36 → 52px */
  --text-h2:      clamp(1.75rem, 1.4rem + 1.4vw, 2.375rem); /* 28 → 38px */
  --text-h3:      clamp(1.375rem, 1.2rem + 0.7vw, 1.75rem); /* 22 → 28px */
  --text-h4:      1.25rem;    /* 20px */
  --text-lead:    1.1875rem;  /* 19px — lead paragraphs, serif */
  --text-body:    1rem;       /* 16px */
  --text-read:    1.0625rem;  /* 17px — serif reading body, optically matched to 16px sans */
  --text-sm:      0.875rem;   /* 14px */
  --text-xs:      0.75rem;    /* 12px — the floor. Nothing smaller ships. */
}
```

| Token | Use | Line height | Tracking |
|---|---|---|---|
| `display` | Homepage hero only. Once per site. | 1.0 | -0.03em |
| `h1` | Page title, the question on a question page | 1.08 | -0.02em |
| `h2` | Section heading | 1.15 | -0.015em |
| `h3` | Card title, lesson title | 1.25 | -0.01em |
| `h4` | Subsection, form group heading | 1.35 | -0.01em |
| `lead` | Lead paragraph, short answer | 1.55 | 0 |
| `read` | Serif reading body | **1.7** | 0 |
| `body` | Sans body, UI text | 1.55 | 0 |
| `sm` | Metadata, form labels, helper text | 1.5 | 0 |
| `xs` | Eyebrows, badges, table meta | 1.4 | **+0.06em** (uppercase eyebrows only) |

**Rules**

- **Not every heading is huge.** A page has one `h1`. If a section needs `h2` and the cards inside it need `h3`, that is the whole hierarchy — do not reach for `display` to add emphasis.
- **`text-xs` is the floor.** 12px, and only for genuinely secondary metadata. Anything a user must read to make a decision is `text-sm` or larger.
- **Measure is capped at 68–72 characters** for serif reading body. This is what `max-w-[68ch]` is for (§13.2).
- **Tabular figures on anything countable** — prices, progress percentages, durations, order totals. `tabular-nums` prevents the width jitter that makes a live-updating result count look broken.

## 11. Spacing `[DECIDED]`

4px base. Tailwind's default scale, not a custom one — inventing one costs Week 1 time for no benefit.

```
4  8  12  16  20  24  32  40  48  64  80  96  128
```

| Context | Value |
|---|---|
| Inside a compact control (button, chip) | 8–12px vertical, 12–16px horizontal |
| Card padding | 20px mobile, 24px tablet+, 28px for feature cards |
| Gap between cards in a grid | 16px mobile, 24px desktop |
| Between a heading and its content | 12–16px |
| Between content blocks within a section | 32–40px |
| Between page sections (marketing) | 64px mobile, 96px desktop |
| Between page sections (product/dashboard) | 32px mobile, 48px desktop |
| Page horizontal padding | 20px mobile, 32px tablet, 48px desktop |

**Vertical rhythm in editorial mode:** paragraph spacing is 1em of the reading size (about 17px), heading-above spacing is 2em, heading-below is 0.5em. Set once in a `.prose-guidance` class (§20.4), never per-component.

Arbitrary spacing values (`mt-[13px]`) need a comment explaining the optical reason. Optical corrections are legitimate; guesses are not.

## 12. Radius, borders and elevation `[DECIDED]`

### 12.1 Radius

Base `--radius: 1.25rem` (20px), stepped down for smaller elements.

| Utility | Value | Use |
|---|---|---|
| `rounded-sm` | 8px | Chips, badges, small buttons, table cells |
| `rounded-md` | 12px | Inputs, selects, buttons, small cards |
| `rounded-lg` | 16px | Cards — the default |
| `rounded-xl` | 20px | Feature blocks, video frame, hero panels |
| `rounded-full` | — | Avatars, pills, circular icon buttons only |

Do not round everything heavily. A dense admin table with 20px corners on every cell reads as a toy.

### 12.2 Borders

The default surface treatment is **a 1px border, not a shadow**. Borders are cheaper, crisper, theme-safe, and they hold up in dark mode where shadows disappear.

| Situation | Treatment |
|---|---|
| Grouping / card edge | `border border-border` |
| Selected, active, current | `border-border-strong` or a 2px `ring-ring` |
| Focus | `:focus-visible` outline (§8), never a custom per-component focus style |
| Error | `border-destructive` **plus** an icon and message |
| Locked | `border-dashed border-border` + lock icon |

### 12.3 Elevation

Four levels. Nothing else.

| Level | Utility | Use |
|---|---|---|
| 0 | none | The default. Most cards. |
| 1 | `shadow-sm` | Cards that lift on hover; sticky headers when scrolled |
| 2 | `shadow-md` | Popovers, dropdowns, the command palette |
| 3 | `shadow-lg` | Dialogs, mobile bottom sheets |

Never a permanent heavy shadow on every card. In dark mode, elevation reads from a lighter surface (`--card` above `--background`) plus a border — the shadow contributes almost nothing and should not be relied on.

## 13. Layout and containers `[DECIDED]`

### 13.1 Containers

```tsx
// Marketing — homepage, catalogues, pricing, about
<div className="mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12" />

// Reading — question guidance, reading lessons, legal pages
<article className="mx-auto w-full max-w-[68ch] px-5 sm:px-8" />

// Product — dashboard, learning, downloads, account
<main className="mx-auto w-full max-w-[1400px] px-5 sm:px-8" />

// Admin — tables need width
<main className="mx-auto w-full max-w-[1600px] px-4 sm:px-6" />

// Focused — auth, checkout handoff, single-purpose forms
<div className="mx-auto w-full max-w-md px-5" />
```

`max-w-[68ch]` is deliberate: character-based, so it stays correct if the reading size changes. Do not replace it with a px value.

### 13.2 Grid

```tsx
<div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
```

| Content | Columns |
|---|---|
| Question results | 1 column always — these are rows to scan, not tiles to browse |
| Course cards | 1 / 2 / 3 |
| Template cards | 1 / 2 / 3 |
| Pricing | 1 / 3 (never 2 — an even split has no visual centre) |
| Dashboard modules | 1 / 2, with "Continue" full-width |
| Discovery page | `lg:grid-cols-[280px_1fr]` — filter rail + results |
| Learning | `lg:grid-cols-[320px_1fr]` — course outline + lesson |

### 13.3 Sticky behaviour

| Element | Behaviour |
|---|---|
| Public header | Sticky, `shadow-sm` appears after 8px of scroll |
| Filter rail (desktop) | `sticky top-20`, independently scrollable, `max-h-[calc(100vh-6rem)]` |
| Course outline (desktop) | Same pattern |
| Mobile filter button | Fixed bottom-right, above the safe area |
| Mobile lesson nav | Sticky bottom bar, respects `env(safe-area-inset-bottom)` |
| Buy button on a product page | Sticky bottom bar on mobile below 640px; inline on desktop |

## 14. Iconography `[DECIDED]`

**Lucide React, only.** Mixing icon libraries is the fastest way to look assembled rather than designed.

| Size | Use |
|---|---|
| 14px | Inline with `text-xs` metadata |
| 16px | Inside buttons and compact controls |
| 18px | Standalone controls, list markers |
| 20px | Navigation, tab bars |
| 24px | Feature icons, empty-state marks |

**Rules**

- Icons carry meaning or they do not appear. No decorative icons beside headings.
- An icon-only button always has an `aria-label` and a tooltip.
- The icon for a concept is fixed across the whole product — one lock, one download, one check, one lesson-type set. §50.3 holds the map.
- Stroke width 1.75 (Lucide default 2 is slightly heavy next to Bricolage at small sizes).

### 14.1 The fixed icon map

| Concept | Icon |
|---|---|
| Question | `HelpCircle` |
| Guidance / reading lesson | `BookOpen` |
| Video lesson | `PlayCircle` |
| Downloadable lesson / template | `FileDown` |
| Locked | `Lock` |
| Owned / entitled | `CircleCheck` |
| In progress | `CircleDashed` |
| Regulator pressure | `Landmark` |
| Duration | `Clock` |
| Cost | `Banknote` |
| Effort | `Gauge` |
| Payback | `TrendingUp` |
| Tier | `Layers` |
| Leadership traits | `Users` |
| Search | `Search` |
| Filter | `SlidersHorizontal` |

## 15. Motion tokens

Full motion rules are in §39. The tokens live here so they are with the rest of the system.

```
Micro    100–150ms   hover, focus, press
Small    150–220ms   chips, badges, tooltips, inline reveals
Medium   220–350ms   cards, sheets, dialogs, filter panel
Large    350–500ms   page-level transitions (rare)
```

Easing: `--ease-standard` for most, `--ease-entrance` for things arriving, `--ease-exit` for things leaving. Nothing loops. Nothing exceeds 500ms.

## 16. Imagery `[DECIDED]`

The platform is content-led. Images are used where they carry information, not to fill space.

| Image | Treatment |
|---|---|
| Author portrait | Real photograph, square, `rounded-full` at small sizes, `rounded-lg` on the about page |
| Course artwork | Consistent treatment across all courses — one system, decided once (§16.2) |
| Template preview | An actual page from the actual file. Research 4.2 found listings with 2–3 preview images earned materially more than listings with none. Two previews minimum per paid template. |
| Video poster | Frame from the video, not a generic thumbnail |
| Editorial illustration | Sparingly, and only if a real illustrator is involved `[OWNER]` |

**Never generic corporate stock photography.** A photo of four people pointing at a laptop is worse than no image; it actively signals that the content is generic too.

### 16.1 Rules

- Every meaningful image has alt text describing what it shows. Decorative images get `alt=""`.
- Always set explicit `width`/`height` or `aspect-ratio` — layout shift is a performance budget failure (§43).
- Serve modern formats with a fallback; `loading="lazy"` below the fold, `fetchpriority="high"` on the hero image only.

### 16.2 Course artwork system `[PROVISIONAL]`

Until there is a real art direction: a flat panel using `--primary` at full bleed, the domain name in mono `text-xs` uppercase at top-left, and the course title in Bricolage 600 at 28px, ranged left, with 32px padding. Generated from data, so a new course does not need a designer. Revisit once there are more than four courses.

### 16.3 Dark mode check

Every image ships checked against both themes. A PNG template preview with a white background sitting on `--card: #060a13` needs a light plate behind it (`bg-muted p-3 rounded-md`), not a filter.

---

# PART C — THE SURFACES

## 17. Navigation

### 17.1 Public header

```
[Logo]   Questions   Courses   Templates   About        [⌘K]  Sign in  [Get started]
```

- Sticky. Gains `shadow-sm` and a `border-b` after 8px of scroll.
- Five items maximum. If a sixth is needed, something is wrong with the information architecture, not the header.
- `⌘K` is a visible affordance, not a hidden shortcut — a small bordered chip showing the key, which is also a button for people who do not use keyboard shortcuts.
- `Get started` is the only primary button in the header. It routes to the free entry point (§27), not to sign-up — the free thing is the better first ask.

**Mobile:** `[Logo] [Search] [Menu]`. The menu is a full-height sheet, not a dropdown. Sign in and Get started sit at the bottom of the sheet where a thumb reaches.

### 17.2 Member navigation

```
Dashboard   My library   Questions   Courses   Templates   Downloads   [Avatar ▾]
```

"My library" replaces v1's "My learning" — it holds courses *and* templates, and "learning" implied only courses.

Desktop is a horizontal bar until the item count exceeds seven, then a collapsible sidebar. Mobile is a bottom tab bar with four items — Dashboard, Library, Questions, Account — because a member is task-switching, not browsing.

### 17.3 Admin navigation

A persistent left sidebar, grouped. The grouping mirrors the content model so that learning the admin teaches the schema:

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

`Sections` and `Domains` sit under Structure rather than being hidden in Settings — they are the extensibility mechanism (§3.5) and burying them teaches the next person that the platform is single-subject.

### 17.4 Footer

Three columns plus a legal row. Includes: the section list (extensibility again), the free entry point, contact, and terms / privacy / refunds. The refund position gets a link, not fine print — visible refund terms measurably reduce checkout abandonment for professional buyers.

## 18. Homepage

The homepage answers three questions in the first viewport: **what is this, who is it for, what can I get.** Then it puts the question finder directly under the fold — not a link to it, the finder itself.

### 18.1 Structure

```
Header
↓
Hero — the claim, and the finder
↓
Question finder (live, working, on this page)
↓
Featured questions — 3, real, from different domains
↓
How this works — 3 steps, honest
↓
Courses and templates — 2 or 3 real products with real prices
↓
The author — name, credentials, photograph
↓
Free entry point — email capture
↓
Footer
```

### 18.2 Hero

The hero is a thesis, not a decoration. The most characteristic thing in this product's world is **the question itself** — so the hero shows one.

```
DECIDING IN THE DARK                          ← eyebrow, mono, xs, tracked

Practical answers to the questions             ← display, sans, tight
risk leaders actually have.

100 questions from real risk leaders,          ← lead, serif, muted
tagged by effort, cost, timescale and
regulator pressure — so you can find the
one you need in about thirty seconds.

[ What are you trying to solve?          ⌘K ]  ← the finder, live
Try:  [Do it in a fortnight]  [Do it cheaply]  [Show your regulator]
```

No hero image. No gradient. The type, the claim and a working input are the hero — which is also the fastest possible route to §4's 30-second target.

`[OWNER]` Final hero copy is the owner's and the author's. The structure above is the design constraint: eyebrow, claim in two lines, one qualifying paragraph, a live input, three preset chips.

### 18.3 What the homepage must not do

- Not lead with a course catalogue.
- Not require an account to reach anything on it.
- Not hide the price of anything it shows.
- Not carry a testimonial carousel, a logo wall of companies who have not agreed to appear, or a counter that animates up to 100.

## 19. Question discovery — the flagship surface

This is the most important screen in the product. It is built in Week 1, receives more design attention than any other surface, and is treated as its own deliverable (Research 12.4).

The headline promise — *"what can I fix in a fortnight, cheaply, that my regulator cares about?"* — is the differentiating claim of the whole platform. A static filter that returns zero results on a three-constraint query does not fulfil it.

### 19.1 Page structure

```
┌──────────────────────────────────────────────────────────────────┐
│ What are you trying to solve?                                    │
│ [ Search the 100 questions…                              ⌘K ]    │
│                                                                  │
│ [Do it in a fortnight] [Do it cheaply] [Show your regulator]     │
│ [Build leadership support]                                       │
└──────────────────────────────────────────────────────────────────┘

Desktop:  [ Filter rail 280px ] │ [ Results ]
Mobile:   [ Results ] + sticky [Filters · 3] button → bottom sheet
```

### 19.2 The scoring model `[DECIDED]`

A strict `WHERE` across three constraints will return nothing, at exactly the moment the product is meant to prove itself. So the filter is a *ranking*, not a gate.

1. Each ordinal tag maps to a numeric scale: effort/cost/payback/regulator pressure `low=1, medium=2, high=3`; duration `days=1, weeks=2, months=3, quarters=4`.
2. With filters active, each question gets a **match score**: 2 points per exact match, 1 point for an adjacent value, 0 beyond that.
3. A question is **exact** only when it matches *every active constraint* exactly. (See §57 — v1's implementation had this wrong.)
4. Results are sorted by score and split into two zones with a divider.

This is application-layer logic. No new tables, no AI, no opaque relevance. The user can see why a result ranked where it did — which for this audience is worth more than a better-hidden ranking (Research 3.5).

### 19.3 Results — two zones

```
┌─────────────────────────────────────────────┐
│ 4 exact matches                             │
│ ─────────────────────────────────────────── │
│ [Question row]                              │
│ [Question row]                              │
│ [Question row]                              │
│ [Question row]                              │
│                                             │
│ 7 close matches                             │
│ Relax one filter to see these as exact      │
│ ─────────────────────────────────────────── │
│ [Question row — with "Duration: months"]    │
│ [Question row — with "Cost: medium"]        │
│ [Show all 7 close matches]                  │
└─────────────────────────────────────────────┘
```

**Close-match rows** differ from exact rows by:
- `border-border` instead of `border-border-strong` on the left rule
- A small `Badge` naming the dimension that missed and its actual value — `Duration: months` when the user asked for weeks
- Nothing else. **Text opacity is never reduced** — that would be a contrast failure and would make a perfectly good answer look broken.

The badge is informational. It is not an error state, does not use `--destructive`, and does not carry a warning icon.

### 19.4 Zero results

```
No questions match all four filters.

The tightest constraint is Duration: days —
only 6 of 100 questions are that fast.

[Relax Duration]  [Relax Regulator pressure]  [Clear all]
```

The suggested relaxations are computed, not hard-coded: rank the active filters by how few questions each one alone admits, and offer the two most restrictive. This turns a dead end into a two-tap recovery and it teaches the user how the taxonomy behaves.

### 19.5 Filter rail

Seven groups, in the order a practitioner actually reasons:

1. **Domain** — where do I work
2. **Duration** — how long have I got
3. **Cost** — what can I spend
4. **Effort** — how much of my own time
5. **Regulator pressure** — does anyone external care
6. **Payback** — how quickly does it pay off
7. **Tier** — strategic / operational / project

`[OWNER]` The authoritative value list for each tag is an open decision (Research 12.2, Appendix J). The UI renders whatever the API returns; **no tag value is hard-coded in a component.**

Each group:
- Shows the count of questions per value inline — `Weeks (34)` — which makes the taxonomy legible before the user commits to a click
- Collapses to five values with a `Show all` if longer
- Single-select groups use radio semantics; `Tier` and `Leadership traits` are multi-select checkboxes
- Has a per-group `Clear` that appears only when that group is active

Above the rail: `4 filters active` and a single `Clear all`.

### 19.6 Live result count

```
12 exact  ·  +9 close
```

Updates on every filter change without a page reload, using `tabular-nums` so the number does not jitter. Debounce the *search* input at 250ms; **do not debounce chip and checkbox changes** — a tap should recount immediately or the control feels broken.

The count is a trust signal as much as a utility: it is the proof that the taxonomy is real and the filter actually queries something.

### 19.7 Quick-goal chips

One-tap filter presets, phrased as goals rather than parameters:

| Chip | Preset |
|---|---|
| Do it in a fortnight | `duration: days,weeks` + `effort: low` |
| Do it cheaply | `cost: free,low` |
| Show your regulator | `regulator_pressure: high` |
| Build leadership support | `tier: strategic` + `leadership_traits: any` |
| Quick wins | `effort: low` + `payback: immediate` |

They are toggles, not links. Tapping one sets its filters and visibly ticks the corresponding rail controls, so the user learns what the chip did.

### 19.8 State persistence and shareability `[DECIDED]`

Filter state lives in **the URL** and is mirrored into Zustand, not the other way round.

```
/questions?duration=weeks&cost=low&regulator_pressure=high&q=third+party
```

This gives, free: browser back works, refresh works, the state is shareable and linkable, and a practitioner can bookmark "my constraints". Zustand holds the same state for components that need it without prop-drilling, and is rehydrated from the URL on mount.

Returning from a question page must restore the exact result list and scroll position.

### 19.9 Mobile

```
[Search…]
[Filters · 3]         ← sticky, bottom-right, shows active count

[Results]
```

The sheet is a bottom drawer at 90% height with the seven groups. **Changes apply on close, not per tap** — a full-screen recount on every tap is disorienting and burns requests. The sheet's footer holds `Clear all` and `Show 12 results`, with the count live inside the sheet so the user knows before committing.

## 20. Question card and row

### 20.1 The row (discovery results)

```
THIRD-PARTY RISK                                          ← eyebrow, mono, xs

How do I know whether my risk reporting                   ← h3, sans, 600
is actually useful?

Most reporting answers questions nobody asked. Start      ← preview, serif, sm, muted
by finding out what your board actually decides with it.

[⏱ 2 weeks]  [💷 Low cost]  [🏛 High regulator pressure]  ← 3 tags max

Read the answer →
```

### 20.2 Tag display rules

- **Three tags on a card, never seven.** Show the three most decision-relevant: duration, cost, and whichever of regulator pressure / payback / effort is highest-signal for that question. All seven appear on the detail page.
- **When filters are active, show the tags that were filtered on** — so the user can verify the match without opening the question.
- Tags are labelled, not colour-coded (§7.6). The semantic mapping:

| Dimension | Treatment |
|---|---|
| Duration | `secondary` |
| Cost | `secondary` |
| Effort | `muted` |
| Payback | `outline` with `--primary` text |
| Regulator pressure | `accent` — the only dimension that gets emphasis, because it is the one that creates urgency |
| Tier | `muted` |
| Leadership traits | `muted`, and only on the detail page |

### 20.3 The preview field

Cards show a **purpose-written `preview` field** (≤160 characters, authored), never a machine-truncated first paragraph. Truncating an author's opening sentence mid-clause misrepresents published work and reads as cheap. This is a schema requirement, and admin enforces it (§31.4).

### 20.4 Reading typography for guidance

Guidance bodies render inside a `.prose-guidance` class: Source Serif 4 at `--text-read`, line-height 1.7, measure capped at 68ch, paragraph spacing 1em, `h2`/`h3` in sans for contrast against the serif body, blockquotes with a `--border-strong` left rule, and lists with proper hanging indents.

## 21. Question detail page

### 21.1 Structure

```
Breadcrumb:  Questions / Third-party risk

THIRD-PARTY RISK

How do I know whether my risk reporting          ← h1
is actually useful?

[The short answer — 2–3 sentences, serif, lead]

All seven tags, laid out as a small definition grid

──────────────────────────────────────────────

Guidance                                          ← the author's full text
[Serif reading body, 68ch]

What to do next                                   ← the practical steps

──────────────────────────────────────────────

Related templates    (buy surface — §21.4)
Related questions    (3, from the same or adjacent domains)
Related lessons      (with entitlement state shown)

The author

[Primary CTA]
```

### 21.2 The seven tags, laid out properly

On the detail page all seven appear as a compact definition grid — icon, dimension name in `text-xs` muted, value in `text-sm` foreground — in two columns on desktop and one on mobile. Not a row of badges: seven badges in a line is unreadable and hides the structure that *is* the product.

### 21.3 The paywall preview `[DECIDED]`

This is the conversion moment (Research 8.2 step 3) and it has to be handled precisely.

**Public, always:** the question title, the domain, all seven tags, the short answer, and the names of related templates and courses with their prices.

**Gated:** the full guidance body and the "what to do next" steps.

**Presentation of the gate:**

```
[Short answer — fully readable]

Guidance
────────────────────────────────────────
[First paragraph — fully readable]

[Second paragraph fading to transparent over ~120px]

        ┌────────────────────────────────────┐
        │ 🔒 The rest of this guidance is    │
        │    part of Third-Party Risk        │
        │    Foundations.                    │
        │                                    │
        │    6 modules · 3 templates · 2h 40m│
        │    US$149 · lifetime access        │
        │                                    │
        │    [See what's included]           │
        │    Already bought it? Sign in      │
        └────────────────────────────────────┘
```

**Non-negotiable implementation rule:** the gated text is **not in the HTML**. The API returns the first paragraph and a `gated: true` flag; it does not return the body with a CSS blur applied. A blur is a decoration over data the user already has — View Source defeats it in four seconds, and on a paid product that is not a design flaw, it is the product leaking. See §45.

The fade is applied to the *last returned paragraph*, so the fade is honest: there genuinely is more text, and the user can see that there is.

### 21.4 Related templates as a buy surface

The related-template card on a question page is a full purchase surface — name, format, page count, two preview thumbnails, price, and `Buy the template`. It does not route to a catalogue first. This is what keeps §4's three-step budget intact.

If the user already owns it: `Download the template` with a `CircleCheck` and `In your library`.

## 22. Search

### 22.1 Command palette

`⌘K` / `Ctrl+K` opens a command palette searching questions, courses, templates and lessons. Results are grouped by type with the type as a section header, and each row carries a type icon (§14.1).

```
QUESTIONS
  How should risk appetite be reviewed?
  How do I know whether my risk reporting is useful?

COURSES
  Risk Leadership Essentials              US$149

TEMPLATES
  Risk Appetite Review Pack               US$79   ✓ owned
```

Arrow keys navigate, Enter opens, Escape closes, and focus returns to whatever opened it. Recent searches persist for the session.

### 22.2 In-page search

The discovery page's search input is a separate control from the palette and searches question titles and previews only. It is debounced at 250ms and never blocks the filter controls while in flight.

### 22.3 Search results page

`/search` exists for deep links and for the mobile case where a palette is awkward. Same grouping, same row treatment, with a result count per group.

### 22.4 Reserved slot for semantic search `[V2]`

Research 9.2 recommends pgvector semantic search as a "should have". The UI reserves it now so adding it later is a query change:

- The empty state for a zero-keyword-match search reads `No questions match those words` and has room for a `Questions about similar things` block below it.
- The API contract for search results already carries an optional `matchType: 'keyword' | 'semantic'` field, rendered as a small `Similar meaning` badge when present.

Nothing else changes. Do not build it in v1 unless all 100 questions are loaded by end of Week 2.

## 23. Courses

### 23.1 Course card

```
RISK LEADERSHIP                                   ← eyebrow

Making risk decisions with better evidence        ← h3

For risk managers who present to a board and      ← outcome, sm, muted
suspect the board isn't using it.

6 modules · 2h 40m · 3 templates included

US$149                          [View the course]
```

The **outcome line is required**. "What you will be able to do" sells a professional course; a feature list does not.

### 23.2 Access state on cards

Every course card shows one of four states, and the state changes the primary action:

| State | Badge | Action |
|---|---|---|
| Not owned | Price | `View the course` |
| Owned, not started | `✓ In your library` | `Start the course` |
| In progress | `45% complete` + progress bar | `Continue — Module 3, Lesson 2` |
| Complete | `✓ Completed` | `Review the course` |

Never show a price on something the user already owns. This is the single most common trust-damaging bug in learning platforms.

### 23.3 Course detail page

```
Course title (h1)
Outcome — one sentence, serif lead
Author — photo, name, credentials

What's included:  6 modules · 14 lessons · 2h 40m video · 3 templates
Access: lifetime          Refund: 14 days, no questions

Full syllabus — modules expanded, lessons listed with type icon and duration
  · One lesson marked "Free preview" and genuinely playable

Included templates — with preview thumbnails
Related questions — the questions this course answers

Price · [Buy the course]

Refund position, plainly stated
```

**The free preview lesson is not optional.** Research 8.3 has the buyer watching 30 ungated seconds before committing. A course product page with no playable content asks for US$149 on trust alone.

The page must answer, without the buyer hunting: what do I get, how long does it take, is access permanent, what can I download, is there video, and what happens if I want a refund.

## 24. Learning interface

### 24.1 Desktop

```
┌──────────────────────────────────────────────────────────┐
│ ← Third-Party Risk Foundations          45% · 6 of 14    │
├─────────────────┬────────────────────────────────────────┤
│ MODULE 1        │  Lesson 3 of 14                        │
│ ✓ What good     │                                        │
│ ✓ Mapping       │  Building a supplier register          │
│ → Building a…   │                                        │
│ ○ Tiering       │  [ Video 16:9 ]                        │
│                 │                                        │
│ MODULE 2        │  [ Reading body, serif, 68ch ]         │
│ ○ Contracts     │                                        │
│ ○ Monitoring    │  [ Download: Supplier Register.xlsx ]  │
│ 🔒 Escalation   │                                        │
│                 │  [Mark complete]                       │
│                 │  ← Previous          Next lesson →     │
└─────────────────┴────────────────────────────────────────┘
```

The outline is `sticky`, independently scrollable, and auto-scrolls the current lesson into view on load. Lesson states: `✓` complete, `→` current, `○` not started, `🔒` not entitled.

### 24.2 Mobile

The outline is **not** a squeezed sidebar. It is:

```
[← Course]   Lesson 3 of 14   [☰ Outline]     ← sticky top

Building a supplier register

[ Video, full-bleed ]

[ Reading body, 20px page padding ]

[ Download ]

[Mark complete]                                ← sticky bottom
← Previous              Next →
```

The outline opens as a sheet from `☰`. The bottom bar respects `env(safe-area-inset-bottom)`.

### 24.3 Lesson types

Three types, each with its own layout and its own icon (§14.1):

| Type | Layout |
|---|---|
| **Video** | Player at the top, transcript or notes below, download list last |
| **Reading** | Serif body at 68ch, no player, optional pull-quote treatment |
| **Download** | A short framing paragraph, then the file card with format, size and page count, then what to do with it |

A lesson may combine types — video plus a downloadable worksheet is common and should not require a second lesson.

### 24.4 Completion

`Mark complete` is an explicit button, not inferred from scroll depth or video progress. Professionals resent a system that decides for them whether they have finished. Video progress is *tracked* (§48) but never *substituted* for completion.

On completion: the button becomes `✓ Completed` with an `Undo` affordance for 8 seconds, the outline item ticks, the progress bar animates its width, and focus moves to `Next lesson`.

## 25. Video

### 25.1 Frame

```
Aspect ratio    16 / 9
Radius          rounded-xl
Background      black (both themes)
Max width       full column width; full-bleed below 640px
```

### 25.2 Requirements

Captions on by default `[DECIDED]` — the brief requires captions, and defaulting them off means most people never discover them. Plus: play/pause, volume, playback speed, fullscreen, keyboard control, a poster frame, a loading state and an error state.

Use the provider's player (Mux Player). **Do not build a custom video pipeline.** The provider handles streaming, adaptive bitrate, captions and access control.

### 25.3 Loading and error

```
Loading:   Poster frame + centred spinner, no layout shift

Error:     We couldn't load this video.
           Check your connection and try again.
           [Try again]   [Report a problem]
```

### 25.4 Token expiry mid-playback `[DECIDED]`

Playback tokens are short-lived — 15 to 30 minutes (Research 6.5). A 40-minute lesson will therefore expire *during* playback. This is not an edge case; it is the normal case, and v1 of this document had no design for it.

**Behaviour:**

1. The client requests a fresh playback token at **60% of the token's lifetime**, silently, in the background.
2. If the refresh succeeds, nothing is visible to the user. This is the path 99% of sessions take.
3. If the refresh fails (session expired, entitlement revoked, network gone), playback continues to the end of the current buffer and then pauses with:

```
Your session timed out.

[Sign in and continue from 12:34]
```

4. The playback position is preserved and restored after sign-in. Losing someone's place in a paid 40-minute lesson because of a token refresh is the kind of failure that produces a refund request.

### 25.5 Mobile

Full-bleed at the top of the lesson, native fullscreen, no autoplay ever, and never a picture-in-picture that follows the user out of the entitled context.

## 26. Templates and downloads

### 26.1 Template card — owned

```
TEMPLATE

Supplier Risk Review Checklist

XLSX + PDF · 12 pages · 240 KB

Included with Third-Party Risk Foundations

[Download the checklist]
```

### 26.2 Template card — for sale

```
TEMPLATE

Vendor Risk Review Pack

DOCX + XLSX · 4 files · 38 pages

[preview thumb] [preview thumb]

US$79                    [Buy the pack]
```

Always state the format and the size. A risk manager on a corporate laptop needs to know it is an XLSX before they click, and "12 pages" is the difference between a checklist and a token.

### 26.3 Template product page

Per Research 4.2's finding that long descriptions and multiple preview images correlate strongly with sales, the template product page is a real page, not a card blown up:

- What problem it solves, in the author's words (target 400+ words, not 40)
- Two to three genuine preview images
- What is in each file, listed
- Who it is for, and who it is not for
- The related questions it answers, linked
- Format, size, page count, licence position `[OWNER]`
- Price, refund position, buy button

### 26.4 Download flow

```
[Download] pressed
   ↓
Button → loading state ("Preparing…"), stays disabled
   ↓
Server: check session → check entitlement → mint a 60-second presigned URL
   ↓
Browser fetches the file directly
   ↓
Button → "Downloaded ✓" for 4 seconds, then back to "Download again"
```

### 26.5 Presigned URL expiry

The URL is valid for 60 seconds and is single-use (Research 6.6). If the user's browser is slow, the tab is backgrounded, or they right-click → Save link as and come back later, it will fail.

**So:** never render the presigned URL as a visible `href` the user can copy. Fetch it on click, use it immediately, discard it. If the fetch fails, the button returns to its normal state with an inline message — `That link expired. Press download again.` — and not an error toast that implies something is broken.

Re-downloading is always allowed for an entitled user, with no limit and no counter. A download cap on a professional template is a support ticket generator.

## 27. Free entry point `[DECIDED]`

A named deliverable — "at least one free entry point that earns an email address" — with no design in v1.

### 27.1 What it is

One complete domain of questions, freely readable in full, in exchange for an email address. Not a sample chapter, not a blurred teaser: a genuinely useful, complete thing. `[OWNER]` which domain.

Plus one free template — the lowest-effort, highest-payback artefact in the library — as the proof that the paid templates are worth what they cost.

### 27.2 The capture

Not a modal. Not an exit-intent popup. An inline block, on the homepage and at the foot of every public question page:

```
────────────────────────────────────────────────

Read the Third-Party Risk domain free

20 questions, in full, plus the Supplier
Register template. No card, no trial.

[ your@work-email.com ]  [Send me the link]

We'll email you the link and occasional notes
from the author. Unsubscribe any time.
────────────────────────────────────────────────
```

**Rules:** one field only. The privacy statement is *above* the button and in plain words, not a checkbox burying a link. No pre-ticked marketing consent. `[OWNER]` confirm the consent model against the jurisdiction the contracting entity sits in.

### 27.3 After capture

Immediate access — do not make them go to their inbox to read what you just promised. The email arrives too, as the durable link, but the content unlocks on the page instantly. Every gate between "I gave you my email" and "I got the thing" loses people.

## 28. Pricing

### 28.1 Structure

Three columns. Never two (no visual centre), never five (Research: the audience is not shopping tiers).

```
Free                    Template                Course
One domain, in full     A single artefact       The complete thing
US$0                    from US$79              from US$149

· 20 questions          · The file, forever     · 6 modules, 14 lessons
· 1 template            · Every format          · 2h 40m of video
· Email required        · Related questions     · 3 templates included
                          unlocked                · Every related question
                                                  · Lifetime access

[Start reading]         [See the templates]     [See the courses]
```

### 28.2 Rules

- **Price is always visible.** No "contact us", no "from $—", no price behind a click.
- State the **billing type** explicitly: `one-time` on everything in v1. There are no subscriptions.
- State **access duration** explicitly: `lifetime`. Ambiguity about whether access expires is a purchase blocker for someone expensing it.
- State the **refund position** on the pricing page, not only in the terms.
- Format prices with `Intl.NumberFormat` using the currency the API returns. Never hard-code a symbol. `[OWNER]` currency is an open decision (Research Appendix J).
- If tax is added at checkout, say so *before* the checkout redirect. A price that changes on the Stripe page is the most common source of abandonment and of "this feels dishonest".

## 29. Checkout

### 29.1 Pre-redirect summary

The checkout is hosted by Stripe. There is **no card form in this codebase** (C2). What we own is the moment before the handoff:

```
Third-Party Risk Foundations

6 modules · 14 lessons · 2h 40m
3 templates included
Lifetime access

Subtotal                    US$149.00
Tax                          calculated at checkout

[Continue to secure checkout]

Payment is handled by Stripe. We never see your card details.
14-day refund — see our refund policy.
```

The Stripe attribution line is not legal boilerplate; it is a trust device, and it converts.

### 29.2 Success

```
✓ You're in.

Third-Party Risk Foundations
Payment confirmed · Receipt sent to name@work.com

[Start the first lesson]
Or browse everything in your library
```

The success page must state **what** was bought, **where** it now lives, and **what happens next**. Then it gets out of the way with one primary action straight into the content.

### 29.3 Failure

```
Payment wasn't completed.

Your card has not been charged.

[Try checkout again]   Or use a different card
Still stuck? [Contact us]
```

Never "Oops". Never blame the user. Always state affirmatively that no money moved — that is the thing they are anxious about.

### 29.4 The webhook race `[DECIDED]`

Stripe redirects the user back before the webhook that creates their entitlement necessarily arrives. Designing as though the entitlement is ready is how a paying customer sees "you don't have access to this".

**Behaviour on the success page:**

1. Poll the entitlement endpoint every 1.5 s for up to 20 s.
2. While polling, show the success state with the primary action in a loading state: `Setting up your access…`
3. On success, the button becomes `Start the first lesson`.
4. If 20 s elapses without an entitlement:

```
✓ Payment confirmed.

Your access is still being set up — this usually
takes a few seconds. We've emailed your receipt
to name@work.com and we'll email again the moment
your course is ready.

[Refresh]   [Contact us]
```

Never leave the user on a spinner, and never show them a locked screen after they have paid.

### 29.5 Mobile

Test the whole flow on a real phone with a real card (brief non-negotiable). The Stripe page is already mobile-optimised; what breaks is *our* pre- and post-redirect pages — sticky buy bars overlapping the safe area, and success pages that assume a wide viewport.

## 30. Member dashboard and account

### 30.1 Dashboard hierarchy `[DECIDED]`

```
Good morning, Sarah

Continue                          ← always first, always full width
[Third-Party Risk Foundations · Module 3, Lesson 2 · Continue →]

Your library
[Course card] [Course card] [Template card]

Recent downloads
[Compact list, most recent first, each re-downloadable]

Because you were reading about supplier registers
[Question card] [Question card]

Explore
[Browse all 100 questions →]
```

**Recommendations never appear above active learning.** Someone who is 45% through a course they paid for came back to finish it, not to be sold something else.

### 30.2 Empty dashboard

A brand new account, or one that bought only a template, still needs a dashboard that reads as intentional:

```
Welcome, Sarah

You haven't started a course yet.

[Your downloads]
Supplier Register Template — downloaded 2 minutes ago

Where to start
The three questions most people open first:
[Question] [Question] [Question]

[Browse all 100 questions →]
```

### 30.3 Account

Profile, email, password, purchase history, and a data export / delete request route. Purchase history rows: date, product, amount with currency, order reference in mono, and a receipt link. This is what someone expensing the purchase will screenshot.

## 31. Admin

Admin is a product inside the product, and it is assessed on whether **someone who is not the developer** can add a course, a lesson and a template without asking for help (C4).

### 31.1 What a non-technical person must be able to do

Create and edit: section, author, domain, course, module, lesson, question, template, product, price. Upload a video. Upload a file. Link related content. Publish and unpublish.

### 31.2 Publishing model `[DECIDED]`

```
Draft → In review → Published → Archived
```

- Publishing is always an explicit, confirmed action with a summary of what will become public.
- Unpublishing is one click and never destructive.
- Draft content is never reachable on a public URL, even by direct link, even by an admin who is not signed in.
- A published item shows where it is live, as a real link.

### 31.3 Making it usable by someone else

These are requirements, not nice-to-haves:

- **Inline help under every non-obvious field.** "Preview — the 160 characters shown on cards and search results. Write it; don't paste the first line of the guidance."
- **Save draft is always available**, and autosaves every 20 seconds with a visible `Saved 12:04` timestamp. Losing 40 minutes of typed guidance is the fastest way to lose an author's willingness to use the tool.
- **Validation happens inline, on blur, not on submit.** Never clear a valid field because a different field failed.
- **Errors say what to do.** "This slug is already used by *How should risk appetite be reviewed?* Try adding the domain." — not "Constraint violation".
- **Destructive actions require typed confirmation** and say exactly what will happen: "This will unpublish 3 lessons and remove them from 41 learners' course outlines."
- **Uploads show progress, byte size and an explicit success state.** Video upload additionally shows the provider's processing state — a video that has uploaded but not finished encoding is not yet playable, and an admin who doesn't know that will think it is broken.
- **The usability test is a deliverable.** Watch a non-developer add a lesson, in Week 3, without helping. Write down every place they stopped. Fix those places. That list goes in the handover pack.

### 31.4 Question editor

The seven dimensions are **explicit typed fields with controlled vocabularies**, never free-form tags. Free-text tagging destroys the taxonomy within a month.

```
Question *              [                                  ]
Slug                    [auto-generated, editable]
Domain *                [Select ▾]
Preview *               [160 chars max, live counter]      ← required, §20.3
Short answer *          [rich text, 2–3 sentences]
Guidance *              [rich text — the author's full text]
What to do next         [rich text]

The seven dimensions
  Effort *              ( ) Low  ( ) Medium  ( ) High
  Duration *            ( ) Days ( ) Weeks ( ) Months ( ) Quarters
  Cost *                ( ) Free ( ) Low ( ) Medium ( ) High
  Payback *             ( ) Immediate ( ) Short ( ) Medium ( ) Long
  Tier *                [ ] Strategic [ ] Operational [ ] Project
  Regulator pressure *  ( ) Low ( ) Medium ( ) High
  Leadership traits     [ ] … multi-select from the controlled list

Related questions       [searchable multi-select]
Related templates       [searchable multi-select]
Related lessons         [searchable multi-select]

Status                  Draft ▾            [Save draft] [Publish]
```

Every dimension is required except leadership traits — an untagged question is invisible to the discovery interface, which makes it worthless.

### 31.5 Lesson editor

Structure first, so the shape of the content model is visible in the tool:

```
Course ▸ Module ▸ Lesson

Lesson title *          [                     ]
Type *                  ( ) Video  ( ) Reading  ( ) Download  ( ) Mixed
Estimated duration      [  ] minutes
Free preview            [ ] Make this lesson playable without purchase

Video                   [Upload or select existing]
                        Status: Ready · 14:22 · Captions: generated ✓
Reading                 [rich text editor]
Attached templates      [select]
Related questions       [select]

[Save draft]  [Publish]
```

### 31.6 Admin lists

Every list: search, filter by status, sort, and the columns someone actually needs — title, status, last edited, and where it lives. Bulk publish/unpublish. Row click opens the editor; no separate "edit" pencil to hunt for.

### 31.7 Order reconciliation

`/admin/orders`: date, customer email, product, amount + currency, Stripe reference (mono, copyable), entitlement status. Exportable as CSV. This is what "a purchase record we can reconcile" means in the brief.

Plus a **manual entitlement grant** — the escape hatch for the inevitable payment that succeeded while the webhook failed. It logs who granted it, when and why.

## 32. Transactional email

### 32.1 Constraint

The backend is Python (FastAPI), so React Email cannot render at send time (Research 6.7). **Templates are Jinja2-rendered HTML.** v1 of this document did not say this, and a developer following it would have built the wrong thing.

### 32.2 Rules for email HTML

Email is not the web. The design system applies in spirit, not in implementation:

- Table-based layout, 600px maximum width, single column
- **All CSS inline.** No CSS variables — clients strip them. Hex values are hard-coded *in email templates only*, and that is the one sanctioned exception to §7.2.
- Web fonts do not load in most clients. Use Georgia and a system sans stack; the brand carries through colour, structure and voice instead.
- Every email has a plain-text alternative. Some corporate mail gateways strip HTML entirely, and this audience is behind exactly those gateways.
- One primary CTA, as a bulletproof button (table cell with background colour), not an `<a>` with a background image
- Dark mode: set `color-scheme: light dark` and avoid pure-white containers that some clients invert badly
- Alt text on every image; the email must make sense with images blocked, which is the default in Outlook

### 32.3 The five emails

| Email | Must contain |
|---|---|
| **Welcome** | What they now have access to, a direct link to it, and the author's name |
| **Receipt** | Order reference, product, amount + currency, date, contracting entity name and address, tax line if applicable — this is a document someone will submit to their finance team |
| **Access granted** | What they bought, a direct link to the content, and how to sign in |
| **Password reset** | One link, expiry stated, and what to do if they did not request it |
| **Free entry point link** | The durable link to the free domain, plus one honest sentence about what else exists |

`[OWNER]` The contracting entity name and address on the receipt is an open decision and blocks launch.

---

# PART D — THE COMPONENT SYSTEM

## 33. Component inventory

Use shadcn/ui wherever a suitable primitive exists. Components are copied into the repo, so they are ours to edit — but edit them in `components/ui/`, once, rather than overriding them at every call site.

### 33.1 Primitives (shadcn/ui)

```
Accordion      Alert          AlertDialog    Avatar
Badge          Breadcrumb     Button         Card
Checkbox       Command        Dialog         DropdownMenu
Drawer         Form           Input          Label
Pagination     Popover        Progress       RadioGroup
ScrollArea     Select         Separator      Sheet
Skeleton       Sonner         Switch         Table
Tabs           Textarea       Tooltip
```

Add only what is used. Do not run the CLI's "add everything" at init.

### 33.2 Product components

| Component | Job |
|---|---|
| `QuestionRow` | A question in a result list (§20.1) |
| `QuestionCard` | A question in a grid or recommendation slot |
| `QuestionMeta` | The seven-dimension definition grid (§21.2) |
| `QuestionTags` | The three-tag badge row, filter-aware |
| `MatchBadge` | The close-match explanation badge (§19.3) |
| `QuestionReader` | Guidance body with `.prose-guidance` typography |
| `PaywallFade` | The gated-content boundary (§21.3) |
| `FilterRail` | Desktop filter sidebar |
| `FilterSheet` | Mobile filter drawer |
| `QuickGoalChips` | Preset filter chips |
| `ResultCount` | Live exact + close count |
| `CourseCard` | Course in a catalogue or library, with access state |
| `CourseOutline` | Module/lesson tree with progress and lock states |
| `LessonLayout` | Shell shared by the three lesson types |
| `VideoLesson` / `ReadingLesson` / `DownloadLesson` | Type-specific bodies |
| `LessonNav` | Previous / Mark complete / Next |
| `ProgressBar` | Course and module progress |
| `TemplateCard` | Template, owned or for sale |
| `PricingTable` | The three-column pricing block |
| `ProductSummary` | Pre-checkout summary (§29.1) |
| `EntitlementGate` | Renders children, a paywall, or a loading state |
| `DownloadButton` | The full mint-fetch-discard flow (§26.4) |
| `SearchCommand` | ⌘K palette |
| `EmptyState` / `ErrorState` / `LoadingState` | The three non-happy paths |
| `LeadCapture` | Free entry point form (§27.2) |
| `AdminTable` / `AdminForm` / `PublishStatusBadge` | Admin shells |

## 34. Component contracts

Every product component ships with a contract, written as its TypeScript props plus a comment block. This is what "it extends without you" means at the component level — the next developer reads the contract, not the implementation.

```tsx
/**
 * QuestionRow — a single question in a result list.
 *
 * States:   default · hover · focus · close-match · locked
 * Empty:    n/a (never rendered without a question)
 * Loading:  use <QuestionRowSkeleton />
 * Mobile:   full width, tags wrap to a second line below 380px
 * A11y:     the whole row is a single link; tags are not focusable
 */
interface QuestionRowProps {
  question: QuestionSummary
  /** When set, the row shows why it was a close match rather than exact. */
  match?: MatchResult
  /** Which tag dimensions to surface. Defaults to the filtered ones, then duration/cost/regulator. */
  emphasise?: TagDimension[]
}
```

### 34.1 Definition of Done for a component

A component is not finished until all nine are true:

1. Default, hover, focus-visible, active, disabled and loading states exist
2. Empty and error states exist where the component can encounter them
3. It renders correctly at 375px and at 1440px
4. It is reachable and operable by keyboard alone
5. It uses only semantic tokens — no hex, no arbitrary colour
6. It renders correctly in both themes
7. It survives the stress fixtures (§49.2): a 140-character title, a missing image, a zero-length list, a very long author name
8. It has no `console.log`, no `any` without a comment, and no `// TODO` without a name
9. Its props are documented as above

## 35. Buttons

### 35.1 Hierarchy

| Variant | Use | Example |
|---|---|---|
| `primary` | The one action this screen exists for | `Buy the course` |
| `secondary` | A real alternative | `See what's included` |
| `outline` | Tertiary, or a pair of equals | `Previous` / `Next` |
| `ghost` | Low-emphasis, in-context | `Clear filters` |
| `destructive` | Irreversible | `Delete this lesson` |
| `link` | Inline in prose | `refund policy` |

One primary per visual group. Two primaries means the screen has not decided what it is for.

### 35.2 Sizes

| Size | Height | Use |
|---|---|---|
| `sm` | 32px | Inside cards, table rows, filter chips |
| `default` | 40px | Everywhere |
| `lg` | 48px | Primary CTAs, mobile full-width actions |

Minimum touch target 44×44px on mobile regardless of visual size — pad the hit area, don't inflate the button (§42.6).

### 35.3 Loading and async

A button that triggers async work: disables, keeps its width (no reflow), swaps its label for a spinner plus a present-tense verb — `Preparing…`, `Redirecting…`, `Publishing…` — and never simply spins with no words. On success it shows the completed state for ~4 seconds before returning.

### 35.4 Labels

Say what happens. `Start the module`, not `Submit`. `Buy the template`, not `Proceed`. `Send me the link`, not `Go`. `Learn more` is banned unless the surrounding sentence makes the destination unambiguous.

## 36. Cards

Cards group things that are decided about together. They are not a wrapper for every paragraph.

Use for: questions, courses, templates, purchases, dashboard modules, pricing tiers.
Do not use for: body copy, a single statistic, form sections, or anything already inside a card.

Every card answers three questions in this order: **what is this, why should I care, what can I do.** If it cannot answer all three, it is a list item, not a card.

**Interactive cards:** the whole card is one link or one button — not a card with a separate link inside it, which produces two tab stops for one destination and confuses screen readers. Hover raises by 2px with a `shadow-sm`; that is the entire hover treatment.

## 37. Badges and tags

| Variant | Use |
|---|---|
| `secondary` | Duration, cost — neutral facts |
| `muted` | Effort, tier, leadership traits |
| `outline` | Payback |
| `accent` | Regulator pressure — the only emphasised dimension |
| `success` | Owned, completed, published |
| `warning` | Draft, in review, processing |
| `destructive` | Failed, expired — never "locked" |

Every badge carries a word. A badge that is only a colour is a bug (§7.6). The seven dimensions do not each get their own colour — that produces a rainbow that means nothing and fails at a glance.

## 38. Forms

Built with React Hook Form + Zod. The Zod schema is the single definition of what is valid, and it is shared with the TypeScript types.

### 38.1 Rules

- Labels above fields, always visible. No placeholder-as-label — it disappears on focus and fails for screen readers.
- Helper text under the label, above the field.
- Required marked with `*` **and** the word "required" in the accessible name.
- Validate on blur, revalidate on change once a field has errored. Never validate on every keystroke of a field the user has not left.
- Error message directly under the field, with an icon, `aria-describedby` wired, and `aria-invalid` set.
- **Never clear valid input because a different field failed.**
- Disable submit only when there is a stated reason; otherwise let them submit and show what is wrong. A permanently greyed button with no explanation is a dead end.
- On a failed submit, move focus to the first invalid field and announce the error count.
- Autocomplete attributes on every real-world field: `email`, `current-password`, `new-password`, `name`, `organization`.

### 38.2 Layout

Single column. Multi-column forms are harder to scan and break badly at mobile. Group related fields under an `h4` with a `Separator` between groups.

## 39. Motion

### 39.1 What animates, with what

| Use | Tool |
|---|---|
| Hover colour, border, background, opacity | CSS transition |
| Focus ring | None — instant |
| Mount / unmount, presence | `motion/react` |
| Layout shifts, shared element movement | `motion/react` (`layout`) |
| Sheets, dialogs, drawers | shadcn primitives (Radix) with our tokens |
| Progress bar width | CSS transition on `width` |

### 39.2 Principles

Animation exists to explain a state change and preserve spatial context. It must feel quick, never delay the user, and never block interaction.

- Nothing loops.
- Nothing exceeds 500ms.
- No parallax, no scroll-jacking, no reveal-on-scroll for body content. Content that only appears when scrolled to is content that does not exist for a screen reader user who jumped there.
- No animated page-load sequence. This audience arrived to find something.

### 39.3 The examples

```tsx
// List entrance — stagger the first 6 only, then render the rest immediately
<motion.div
  initial={{ opacity: 0, y: 8 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.22, delay: Math.min(i, 6) * 0.03 }}
/>

// Card hover — 2px, no scale
<motion.div whileHover={{ y: -2 }} transition={{ duration: 0.16 }} />

// Press
<motion.button whileTap={{ scale: 0.98 }} />
```

Do not scale cards on hover. A card that grows 4% pushes its neighbours and reads as a consumer app.

### 39.4 Reduced motion `[DECIDED]`

```tsx
<MotionConfig reducedMotion="user">
  <RouterProvider router={router} />
</MotionConfig>
```

Plus a CSS backstop for anything outside Motion's tree:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

Under reduced motion, transitions become instant state changes — never removed entirely, because the state change itself still needs to be visible.

## 40. Empty, loading, error and locked states

Four states, designed once, applied everywhere. This is where "client-ready, not a prototype" is actually decided.

### 40.1 Empty

Every collection has one. It names what would be here and gives the single action that puts something here.

```
No questions match all four filters.

The tightest constraint is Duration: days.

[Relax Duration]  [Clear all filters]
```

```
Nothing in your library yet.

Templates and courses you buy appear here.

[Browse the templates]
```

Never a blank region. Never an illustration with no action.

### 40.2 Loading

Skeletons for content-shaped things, matching the real layout's dimensions so nothing shifts when data arrives:

```tsx
<div className="space-y-4">
  {Array.from({ length: 6 }).map((_, i) => (
    <div key={i} className="rounded-lg border border-border p-5">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-6 w-3/4" />
      <Skeleton className="mt-2 h-4 w-full" />
      <Skeleton className="mt-4 h-6 w-48" />
    </div>
  ))}
</div>
```

Spinners only inside buttons and for genuinely indeterminate waits. Do not put a full-page spinner on a route that has cached data — show the cached data and refresh underneath.

**Delay rule:** if a load resolves in under 200ms, show nothing. A skeleton that flashes for 80ms is worse than no skeleton.

### 40.3 Error

Three things, in order: what failed, whether the user must act, what to try.

```
We couldn't load these questions.

[Try again]      If this keeps happening, [contact us].
```

Errors are inline and scoped to what failed. A failed recommendation block does not take down the lesson the user is reading — every async region has its own boundary.

### 40.4 Locked

Locked is not broken and is not an error. `muted` surface, dashed border, lock icon, the name of what would unlock it, and its price.

```
🔒 Escalation and exit

Part of Third-Party Risk Foundations
US$149 · lifetime access

[See what's included]
```

Never show a locked item with a disabled-looking, greyed-out title. The user should be able to read *what they are missing* clearly — that is the whole persuasive mechanism.

### 40.5 Access denied

Reached by direct URL to something the user is not entitled to. Fails closed, explains, and offers the route in:

```
This lesson is part of a course you don't have yet.

Third-Party Risk Foundations — US$149

[See what's included]   Already bought it? [Sign in]
```

Never a bare 403. Never a redirect to the homepage — that loses the user's intent.

---

# PART E — QUALITY GATES

## 41. Responsive

### 41.1 Breakpoints

Tailwind defaults. Do not invent custom breakpoints without evidence from a real layout failure.

```
base   < 640px   phone
sm     640px+    large phone / small tablet
md     768px+    tablet
lg     1024px+   desktop — sidebars appear here
xl     1280px+   wide desktop
2xl    1536px+   containers stop growing
```

### 41.2 Test widths

`375 · 390 · 430 · 768 · 1024 · 1280 · 1440`

375 is the floor and it is not optional — it is still a very common real device width and it is where a two-column card grid, a seven-column admin table and a 14-character price all break.

### 41.3 Mobile rules

Mobile is a designed layout, not a narrowed desktop.

Priority order on a small screen: **content → primary action → search → progress → navigation.**

- Bottom sheets for filters, not squeezed sidebars
- Full-width primary buttons
- Sticky lesson navigation, respecting `env(safe-area-inset-bottom)`
- Tables become stacked cards below `md`; horizontal scroll is a last resort and needs a visible scroll affordance
- No hover-only interactions anywhere — everything reachable by hover must be reachable by tap or focus
- Test the checkout and the video player on a real phone, not a resized browser window

## 42. Accessibility

The floor is **WCAG 2.2 AA**. These are requirements, not aspirations, and several of them are invisible to a component-level audit.

### 42.1 The basics

Semantic HTML. Buttons are `<button>`, links are `<a>`. One `h1` per page, headings in order, no skipped levels. Every input has a label. Every image has alt text or `alt=""`. Contrast per §7.3. Captions on all video. No colour-only meaning.

### 42.2 SPA route changes `[DECIDED]`

A single-page app does not announce navigation, so a screen reader user who follows a link is told nothing. This must be built once, in the root layout:

```tsx
// A polite live region that announces the new page title on every navigation
function RouteAnnouncer() {
  const location = useLocation()
  const [message, setMessage] = useState('')
  useEffect(() => {
    setMessage(`${document.title} — page loaded`)
  }, [location.pathname])
  return <div role="status" aria-live="polite" className="sr-only">{message}</div>
}
```

### 42.3 Focus on navigation `[DECIDED]`

After a route change, focus moves to the new page's `<h1>` (given `tabIndex={-1}`), not left on the link that was clicked. Without this, a keyboard user's next Tab continues from the old header, which on a long page means tabbing through the entire navigation again.

**Exception:** filter changes on the discovery page are not navigations. Focus stays on the control; the result count is announced through the same live region.

### 42.4 Skip link

First focusable element on every page:

```tsx
<a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-card focus:px-4 focus:py-2 focus:outline focus:outline-2 focus:outline-ring">
  Skip to content
</a>
```

### 42.5 Focus management in overlays

Dialogs, sheets and the command palette trap focus while open, close on Escape, and return focus to the trigger on close. The Radix primitives underneath shadcn handle this — do not reimplement it, and do not disable it.

### 42.6 Target size (WCAG 2.2, 2.5.8)

Every interactive target is at least 24×24 CSS pixels, and at least 44×44 on touch. Filter chips, close buttons, lesson outline rows and pagination controls are where this fails in practice.

### 42.7 Forms

`aria-describedby` links helper text and errors to the field. `aria-invalid` on failure. Error summary on submit with focus moved to the first invalid field. Fieldsets with legends for the radio and checkbox groups in the filter rail and the question editor.

### 42.8 Live regions

- Result count changes → `aria-live="polite"`
- Toasts → `role="status"`
- Payment failure → `role="alert"` (assertive; this one genuinely interrupts)
- Autosave confirmations → `aria-live="polite"`, not a toast

### 42.9 What gets tested

Automated checks catch roughly a third of what matters. In Week 4 also do, by hand:

- Complete a purchase using only the keyboard
- Complete a lesson using only the keyboard
- Navigate the discovery page with VoiceOver or NVDA and confirm the result count is announced
- Zoom to 200% and confirm nothing is clipped or requires horizontal scrolling
- Force `prefers-reduced-motion` and confirm nothing becomes unusable
- Force dark mode and re-check every state, especially focus and error

## 43. Performance budgets `[DECIDED]`

"Avoid large bundles" is not a budget. These are, and they fail CI.

| Metric | Budget | Measured on |
|---|---|---|
| Largest Contentful Paint | < 2.0 s | Homepage and question detail, 4G throttled |
| Interaction to Next Paint | < 200 ms | Filter chip tap on the discovery page |
| Cumulative Layout Shift | < 0.05 | Every public route |
| Initial JS (gzipped) | < 180 KB | Homepage route |
| Any route chunk (gzipped) | < 120 KB | Per lazy-loaded route |
| Question index payload | < 60 KB | `/questions` first load |

### 43.1 How they are met

- Every route is lazy-loaded (§53.3). The admin bundle is never in a learner's download.
- The Mux player is dynamically imported inside `VideoLesson`, not at the app root — it is a large dependency that most sessions never need.
- The rich text editor is imported only inside admin.
- Images: explicit dimensions, modern formats, lazy below the fold, `fetchpriority="high"` on the hero only.
- Fonts: self-hosted variable files, `font-display: swap`, preloaded for the two faces used above the fold (§9.5).
- No autoplay video. No hero video.
- TanStack Query caching means a return to the discovery page is instant, not a refetch.

### 43.2 Anti-patterns

- Do not load all 100 question **bodies** anywhere, ever. The index carries summaries only.
- Do not put the whole question list on the homepage — the finder queries, it does not enumerate.
- Do not add an animation library beyond Motion.
- Do not import all of Lucide; import the icons used.

## 44. SEO and prerendering `[DECIDED]`

### 44.1 The problem v1 did not name

v1 §64 required titles, meta descriptions, canonical URLs, Open Graph metadata and crawlable question pages. **A plain Vite SPA delivers none of them.** It ships one `index.html` with an empty root div and identical metadata for every URL. Since the public question pages are the top of the acquisition funnel (Research 8.2 has the buyer arriving from a Google search), this is not a polish issue — it is the difference between the platform being findable and not.

### 44.2 The fix

**Prerender the public routes at build time.** Use `vite-react-ssg` (or Vercel's prerender for a static build) to emit real HTML for:

```
/  /questions  /questions/:slug (all published)  /courses  /courses/:slug
/templates  /templates/:slug  /pricing  /about  /legal/*
```

Member, admin and auth routes stay client-only — they must not be prerendered, indexed or cached.

Because content changes when the author publishes, the build is triggered by a deploy hook on publish. Until that hook exists, a nightly rebuild is acceptable and must be written into the handover pack as a known shortcut.

### 44.3 Per-route metadata

Managed with a head library (`@unhead/react` or `react-helmet-async`) so every route sets its own:

```
<title>            Question title — Deciding in the Dark
<meta description> The 160-character preview field. Already written (§20.3).
<link canonical>   Absolute URL, no query params
og:title / og:description / og:image / og:type
twitter:card       summary_large_image
JSON-LD            Question → QAPage; Course → Course; Template → Product
```

### 44.4 What must not be indexed

- Any gated body text — which is automatic, because it is never sent to the client (§21.3)
- Every member, admin and auth route: `noindex, nofollow` plus a `robots.txt` disallow
- Draft content, on any URL

`[OWNER]` Whether question *previews* are publicly indexable is the owner's call. The design assumes yes, because it is the acquisition mechanism, and gating the preview would make the platform invisible to search.

### 44.5 Open Graph images

One templated OG image per content type, generated at build time from the title, domain and section — same treatment as course artwork (§16.2). A shared link that renders as a bare URL undercuts the "worth paying for" judgement before anyone reaches the site.

## 45. Security in the interface

### 45.1 The rule

**The UI is never the authority.** It hides what a user cannot use; the server decides what they can have.

```
UI request
   ↓
Authenticated call (JWT attached)
   ↓
Server validates the token
   ↓
Server checks the entitlement table
   ↓
Server mints a short-lived, single-purpose credential
   ↓
Resource delivered
```

This is wrong on its own:

```tsx
{hasAccess && <DownloadButton />}   // a UX convenience, not a control
```

It is fine *as a convenience*, provided the endpoint behind the button performs the real check.

### 45.2 What must never reach the client

- Gated guidance bodies, gated lesson content, gated transcripts
- Permanent storage URLs for any paid artefact
- Playback IDs or tokens for lessons the user is not entitled to
- Any secret. **No key in a `VITE_` variable** — those are compiled into the bundle and readable by anyone (§56.3).

### 45.3 Session expiry

A JWT will expire while someone is reading. Design for it:

- Refresh in the background before expiry.
- If a refresh fails, do not silently redirect — the user may be mid-form. Show a non-blocking bar: `Your session expired. [Sign in]` — and preserve their draft, their scroll position and their filter state through the sign-in round trip.
- After signing back in, return them to exactly where they were, not the dashboard.

### 45.4 Analytics and privacy

PostHog session replay must mask or exclude: the checkout pages, every password field, the account page and the admin area (Research 6.10). Configure this before the first recording, not after.

### 45.5 Customer data in the interface

Real names, emails and purchase records. Never in a screenshot, a test fixture, a commit, a Storybook story or a bug report. Fixtures use invented people with plausibly awkward names (§49.2).

## 46. Screen readiness checklist

A screen is not ready to code until all ten have answers.

1. What is the user trying to accomplish here?
2. What is the single primary action?
3. What must be visible immediately, without scrolling, on a phone?
4. What can be secondary?
5. What does it look like with no data?
6. What does it look like while loading?
7. What does it look like when the request fails?
8. What does it look like for a user without entitlement?
9. What does it look like at 375px?
10. Can the whole task be completed with a keyboard?

If any answer is "we'll work that out when we build it", the screen is not ready.

## 47. Page inventory

### 47.1 Public

```
/                       Homepage
/questions              Discovery
/questions/:slug        Question detail
/courses                Course catalogue
/courses/:slug          Course product page
/templates              Template catalogue
/templates/:slug        Template product page
/pricing                Pricing
/about                  Author and publisher
/search                 Search results
/free                   Free entry point landing
/legal/terms            Terms of service
/legal/privacy          Privacy policy
/legal/refunds          Refund policy
```

### 47.2 Auth

```
/sign-in  /sign-up  /forgot-password  /reset-password
```

### 47.3 Member

```
/dashboard
/library
/learn/:courseSlug
/learn/:courseSlug/:lessonSlug
/downloads
/purchases
/account
/purchase-success
```

### 47.4 Admin

```
/admin
/admin/questions        /admin/questions/new        /admin/questions/:id
/admin/courses          /admin/courses/new          /admin/courses/:id
/admin/lessons/:id
/admin/templates        /admin/templates/new
/admin/products         /admin/products/:id
/admin/sections         /admin/domains              /admin/authors
/admin/users            /admin/users/:id
/admin/orders
/admin/settings
```

**These are the canonical paths.** v1 of this document contained `/learning/` and `/learn/`, `/terms` and `/legal/terms`, `/login` and `/sign-in` in different sections. Anything not on this list does not exist.

## 48. Analytics event schema `[DECIDED]`

Event names without properties cannot answer the one question the funnel exists to answer: *which filter combination precedes a purchase?* Each event carries its properties.

| Event | Properties |
|---|---|
| `page_view` | `path`, `referrer`, `section_slug` |
| `question_search` | `query_length`, `result_count`, `has_filters` |
| `question_filter_applied` | `dimension`, `value`, `active_filter_count`, `exact_count`, `close_count` |
| `quick_goal_used` | `chip_id`, `resulting_count` |
| `zero_results` | `active_filters` (object), `suggested_relaxation` |
| `question_opened` | `question_slug`, `domain`, `from` (`search`/`filter`/`related`/`direct`), `rank`, `was_close_match` |
| `paywall_viewed` | `question_slug`, `product_id`, `price` |
| `lead_captured` | `source_path`, `domain_offered` |
| `product_viewed` | `product_id`, `product_type`, `price`, `from` |
| `checkout_started` | `product_id`, `price`, `currency`, `from` |
| `purchase_completed` | `order_id`, `product_id`, `amount`, `currency`, `is_first_purchase` |
| `purchase_failed` | `product_id`, `reason` |
| `entitlement_delay` | `order_id`, `seconds_waited` |
| `lesson_started` / `lesson_completed` | `course_slug`, `lesson_slug`, `lesson_type`, `position` |
| `video_progress` | `lesson_slug`, `percent` (25/50/75/100) |
| `video_error` | `lesson_slug`, `error_code` |
| `download_started` / `download_failed` | `template_id`, `format`, `reason` |
| `course_completed` | `course_slug`, `days_since_purchase` |

### 48.1 The funnels that matter

```
Landing → question search → question opened → paywall viewed → checkout → purchase → download
Landing → free entry point → lead captured → return visit → purchase
Purchase → first lesson → 50% → completion
```

`entitlement_delay` and `download_failed` are deliberately instrumented: they are the two silent failures that produce refund requests and never produce a support ticket.

Track intent, not clicks. Twelve well-propertied events beat sixty bare ones.

## 49. Content and test data

### 49.1 Real content, always

"Empty shelves read as abandoned" (brief). Load real questions, real course names, real prices, a real video, a real transaction. Never `test test`, `asdf`, `Lorem ipsum`, or a zero-value order.

### 49.2 The stress fixtures `[DECIDED]`

Placeholder junk hides bugs. Every list and card component is tested against a fixture set that deliberately includes:

| Fixture | Catches |
|---|---|
| A 140-character question title | Card overflow, truncation, line-height collapse |
| A one-word question title | Cards that assume two lines and collapse |
| A guidance body of 2,400 words | Reading measure, scroll performance, prose spacing |
| A question with only the required tags | Tag rows that assume seven |
| A course with 1 module and 1 lesson | Outline layouts that assume depth |
| A course with 12 modules and 60 lessons | Sidebar scrolling, sticky behaviour |
| A template with 4 files and no preview image | Missing-image handling |
| An author name of 42 characters | Byline wrapping |
| A price of `US$1,499.00` | Tabular alignment, sticky-bar overflow |
| A user named `Ms. Aoife Ní Bhraonáin-Whitfield` | Truncation, initials, avatar fallback |
| An empty domain | Empty states inside otherwise-populated screens |

These live in the repo as fixtures and are the default data in component development.

## 50. Tokens as code

### 50.1 One source

Colour, type, spacing, radius, elevation and motion values exist in exactly one place: `src/styles/theme.css`. Everything else consumes them through Tailwind utilities.

### 50.2 The TypeScript mirror

A small number of values are needed in JS — chart colours, motion durations for Motion, breakpoints for a resize hook. These live in `src/styles/tokens.ts` and are **derived from the CSS at runtime** where possible:

```ts
export const motion = {
  micro:  0.12,
  small:  0.18,
  medium: 0.26,
  large:  0.4,
} as const

export const breakpoints = { sm: 640, md: 768, lg: 1024, xl: 1280 } as const

export function chartColor(n: 1|2|3|4|5) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(`--chart-${n}`).trim()
}
```

Duplicating hex values into TypeScript is what breaks theming. Read them.

### 50.3 The label map

Display labels for enumerated values — tag dimensions, lesson types, statuses, icons — live in one file, `src/lib/labels.ts`, so a wording change is one edit and a new section does not need a code hunt.

```ts
export const dimensionLabels: Record<TagDimension, { label: string; icon: LucideIcon }> = {
  effort:             { label: 'Effort',             icon: Gauge },
  duration:           { label: 'Duration',           icon: Clock },
  cost:               { label: 'Cost',               icon: Banknote },
  payback:            { label: 'Payback',            icon: TrendingUp },
  tier:               { label: 'Tier',               icon: Layers },
  regulator_pressure: { label: 'Regulator pressure', icon: Landmark },
  leadership_traits:  { label: 'Leadership traits',  icon: Users },
}
```

Note that the *values* within each dimension are not listed here — they come from the API (§19.5), because they are the owner's to define and may differ per section.

### 50.4 Enforcement

Two lint rules, both failing the build:

1. No hex colour literal in `src/components/**` or `src/routes/**` (email templates and `theme.css` exempt).
2. No `text-[`, `bg-[`, `p-[` arbitrary values without an adjacent `// optical:` comment.

Consistency that depends on remembering is not consistency.

---

# PART F — IMPLEMENTATION

## 51. The stack `[DECIDED]`

Versions are those current at the time of writing (August 2026). Verify at install; do not downgrade without a note in the handover pack.

### 51.1 Core

| Package | Version | Purpose |
|---|---|---|
| `react` / `react-dom` | 19.2.x | UI. Current line; the React Compiler is stable in this version. |
| `typescript` | 5.x | Strict mode from day one — `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride` |
| `vite` | 7.x | Build and dev server |
| `@vitejs/plugin-react` | latest | With `babel-plugin-react-compiler` enabled |

**React 19 over 18** (v1 specified 18): 19 is the current line, and the React Compiler removes most manual `useMemo`/`useCallback`. That matters specifically on the discovery page, where the filter → score → partition → render path runs on every chip tap and is exactly the kind of code that gets hand-memoised badly.

### 51.2 Styling and UI

| Package | Version | Purpose |
|---|---|---|
| `tailwindcss` | 4.3.x | CSS-first `@theme`. No `tailwind.config.js`. |
| `@tailwindcss/vite` | 4.3.x | The Vite plugin — not the PostCSS path |
| `shadcn/ui` | CLI | New York style, CSS variables, neutral base, Lucide icons |
| `class-variance-authority` | latest | Component variants — **required by shadcn and missing from v1's list** |
| `clsx` + `tailwind-merge` | latest | The `cn()` helper |
| `lucide-react` | latest | Icons. One library. |
| `motion` | latest | `motion/react` — animation |
| `@tailwindcss/typography` | latest | Base for `.prose-guidance` (§20.4) |

### 51.3 Routing, data and state

| Package | Version | Purpose |
|---|---|---|
| `react-router` | **8.x** | Routing. See §51.6. |
| `@tanstack/react-query` | 5.x | All server state |
| `@tanstack/react-query-devtools` | 5.x | Dev only |
| `zustand` | 5.x | Client-only UI state |
| `axios` | 1.x | HTTP client with JWT interceptors |
| `zod` | 4.x | Schemas — validation and inferred types |
| `react-hook-form` + `@hookform/resolvers` | 7.x | Forms |

### 51.4 Product-specific

| Package | Purpose |
|---|---|
| `@supabase/supabase-js` | Auth only — sign-up, sign-in, session, token refresh |
| `@mux/mux-player-react` | Video playback. **Dynamically imported** (§43.1). |
| `sonner` | Toasts (shadcn's default) |
| `cmdk` | ⌘K palette (via shadcn `Command`) |
| `vaul` | Mobile bottom sheet (via shadcn `Drawer`) |
| `date-fns` | Dates. Tree-shakeable; do not add moment. |
| `@unhead/react` | Per-route metadata (§44.3) |
| `vite-react-ssg` | Build-time prerender of public routes (§44.2) |
| `posthog-js` | Product analytics, with replay masking (§45.4) |
| `@tiptap/react` | Admin rich text. Admin bundle only. |
| `@dnd-kit/core` | Reordering modules and lessons in admin |

### 51.5 Quality tooling

| Package | Purpose |
|---|---|
| `vitest` + `@testing-library/react` | Component tests |
| `@playwright/test` | End-to-end — and specifically the gating tests (§58.2) |
| `eslint` + `eslint-plugin-jsx-a11y` + `eslint-plugin-react-hooks` | Lint, including the a11y and compiler rules |
| `@axe-core/playwright` | Automated accessibility assertions in E2E |
| `prettier` + `prettier-plugin-tailwindcss` | Formatting and class ordering |

### 51.6 React Router v8, not v6 `[DECIDED]`

v1 of this document specified React Router v6. **v6 reached End of Life in June 2026 and no longer receives security updates.** Shipping a commercial platform on an EOL router, and then documenting that choice in a handover pack, is not defensible.

Use **React Router v8** in data mode:

- The package is `react-router`. `react-router-dom` was removed in v8 — DOM-specific exports come from `react-router/dom`.
- Baseline: Node 22+, Vite 7+, React 19+, ESM only. All of which this stack already meets.
- `createBrowserRouter`, nested layouts, loaders and `Navigate` all work as they did in v6/v7. The upgrade is close to a rename.
- **Do not** adopt framework mode (file routing + SSR) in a four-week build. We are prerendering public routes at build time (§44.2), which gets the SEO benefit without adopting a server runtime the backend architecture does not have room for.

### 51.7 What we are not adding, and why

| Rejected | Reason |
|---|---|
| Next.js | The Research Spec's stack pivot decided React + FastAPI. Reopening it costs a week and gains nothing the prerender does not. |
| Redux / Redux Toolkit | Zustand covers the three genuinely global pieces of client state in about 60 lines. |
| Storybook | Real value, wrong month. Four weeks. Revisit at v2. |
| A CSS-in-JS library | Tailwind v4 plus CSS variables is the system. A second styling mechanism is how consistency dies. |
| A component library (MUI, Chakra, Ant) | The interface *is* the differentiator (Research 3.1). A recognisable component library makes the product look like everyone else's. |
| A second icon set | §14. |
| A drag-and-drop page builder for admin | Enormous. The admin is forms over a known schema. |
| GSAP or Lottie | Motion covers everything §39 permits, and §39 permits little. |

## 52. Project structure `[DECIDED]`

```
src/
  routes/
    _layouts/
      RootLayout.tsx          ← providers, skip link, route announcer, MotionConfig
      MarketingLayout.tsx     ← public header + footer
      AuthLayout.tsx          ← centred, minimal
      MemberLayout.tsx        ← member nav + auth guard
      AdminLayout.tsx         ← admin sidebar + role guard
    marketing/
      home.tsx
      questions.tsx
      question-detail.tsx
      courses.tsx
      course-detail.tsx
      templates.tsx
      template-detail.tsx
      pricing.tsx
      about.tsx
      search.tsx
      free.tsx
      legal/{terms,privacy,refunds}.tsx
    auth/
      sign-in.tsx  sign-up.tsx  forgot-password.tsx  reset-password.tsx
    member/
      dashboard.tsx  library.tsx  course.tsx  lesson.tsx
      downloads.tsx  purchases.tsx  account.tsx  purchase-success.tsx
    admin/
      overview.tsx
      questions/{list,new,edit}.tsx
      courses/{list,new,edit}.tsx
      lessons/edit.tsx
      templates/{list,new}.tsx
      products/{list,edit}.tsx
      structure/{sections,domains,authors}.tsx
      users/{list,detail}.tsx
      orders/list.tsx
      settings.tsx
    not-found.tsx

  components/
    ui/                       ← shadcn primitives, unmodified except by intent
    questions/                ← question-row, question-card, filter-rail,
                                filter-sheet, quick-goal-chips, result-count,
                                match-badge, question-meta, question-reader,
                                paywall-fade
    courses/                  ← course-card, course-outline, lesson-layout,
                                lesson-nav, progress-bar
    lessons/                  ← video-lesson, reading-lesson, download-lesson
    templates/                ← template-card, template-preview
    commerce/                 ← pricing-table, product-summary, checkout-button,
                                entitlement-gate, download-button
    marketing/                ← hero, featured-questions, author-bio, lead-capture
    admin/                    ← admin-table, admin-form, publish-status-badge,
                                media-upload
    shared/                   ← page-title, empty-state, error-state,
                                loading-state, error-boundary, search-command,
                                route-announcer, skip-link

  lib/
    api/
      client.ts               ← the single Axios instance
      questions.ts  courses.ts  lessons.ts  templates.ts
      auth.ts  payments.ts  entitlements.ts  admin.ts
    query/
      client.ts               ← QueryClient
      keys.ts                 ← query key factory
    auth/supabase.ts
    labels.ts                 ← §50.3
    format.ts                 ← currency, date, duration, file size
    scoring.ts                ← §57
    analytics.ts              ← PostHog wrapper, typed against §48

  stores/
    use-auth-store.ts
    use-filter-store.ts
    use-ui-store.ts

  hooks/
    use-entitlement.ts  use-progress.ts  use-filters.ts
    use-media-query.ts  use-debounced-value.ts

  types/
    content.ts  commerce.ts  user.ts  api.ts

  styles/
    theme.css               ← THE only file with colour values
    tokens.ts               ← §50.2

  fixtures/                 ← §49.2 stress fixtures

  App.tsx    main.tsx    vite-env.d.ts
```

### 52.1 Naming `[DECIDED]`

v1 contained both `QuestionCard.tsx` and `question-card.tsx` in different sections. One convention:

- **Files: kebab-case.** `question-row.tsx`, `use-filter-store.ts`.
- **Components: PascalCase.** `export function QuestionRow()`.
- **Hooks: `use-` prefix, camelCase export.** `useFilterStore`.
- **Types: PascalCase**, in `types/`, no `I` prefix.
- **One component per file** unless a sub-component is used only by its parent and is under 20 lines.

Kebab-case files because they are case-safe across macOS and Linux — a PascalCase import that works locally and fails in CI is a real and tedious bug.

## 53. Routing

```tsx
// src/App.tsx
import { createBrowserRouter, RouterProvider } from 'react-router'
import { lazy, Suspense } from 'react'

const Home            = lazy(() => import('./routes/marketing/home'))
const Questions       = lazy(() => import('./routes/marketing/questions'))
const QuestionDetail  = lazy(() => import('./routes/marketing/question-detail'))
// … one lazy import per route

const router = createBrowserRouter([
  {
    element: <RootLayout />,          // providers, skip link, announcer, error boundary
    errorElement: <RouteError />,
    children: [
      {
        element: <MarketingLayout />,
        children: [
          { index: true,                     element: <Home /> },
          { path: 'questions',               element: <Questions /> },
          { path: 'questions/:slug',         element: <QuestionDetail /> },
          { path: 'courses',                 element: <Courses /> },
          { path: 'courses/:slug',           element: <CourseDetail /> },
          { path: 'templates',               element: <Templates /> },
          { path: 'templates/:slug',         element: <TemplateDetail /> },
          { path: 'pricing',                 element: <Pricing /> },
          { path: 'about',                   element: <About /> },
          { path: 'search',                  element: <Search /> },
          { path: 'free',                    element: <FreeEntry /> },
          { path: 'legal/terms',             element: <Terms /> },
          { path: 'legal/privacy',           element: <Privacy /> },
          { path: 'legal/refunds',           element: <Refunds /> },
        ],
      },
      {
        element: <AuthLayout />,
        children: [
          { path: 'sign-in',         element: <SignIn /> },
          { path: 'sign-up',         element: <SignUp /> },
          { path: 'forgot-password', element: <ForgotPassword /> },
          { path: 'reset-password',  element: <ResetPassword /> },
        ],
      },
      {
        element: <MemberLayout />,   // redirects to /sign-in, preserving intent
        children: [
          { path: 'dashboard',                        element: <Dashboard /> },
          { path: 'library',                          element: <Library /> },
          { path: 'learn/:courseSlug',                element: <Course /> },
          { path: 'learn/:courseSlug/:lessonSlug',    element: <Lesson /> },
          { path: 'downloads',                        element: <Downloads /> },
          { path: 'purchases',                        element: <Purchases /> },
          { path: 'account',                          element: <Account /> },
          { path: 'purchase-success',                 element: <PurchaseSuccess /> },
        ],
      },
      {
        element: <AdminLayout />,    // auth + role
        children: [ /* §47.4 */ ],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
])

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="user">
        <Suspense fallback={<RouteSkeleton />}>
          <RouterProvider router={router} />
        </Suspense>
      </MotionConfig>
    </QueryClientProvider>
  )
}
```

### 53.1 Guards at the layout, not the page

```tsx
// MemberLayout.tsx
export default function MemberLayout() {
  const { user, loading } = useAuthStore()
  const location = useLocation()

  if (loading) return <RouteSkeleton />
  if (!user) {
    // Preserve intent — after sign-in they land where they were going,
    // not on the dashboard. §45.3.
    return <Navigate to="/sign-in" state={{ from: location }} replace />
  }
  return <Outlet />
}
```

`AdminLayout` adds `if (user.role !== 'admin') return <Navigate to="/dashboard" replace />`.

**These guards are UX, not security.** Every endpoint behind them performs its own check (§45.1). A guard that is the only thing between a user and paid content is a bug, not a feature.

### 53.2 Route error boundaries

`errorElement` at the root catches route-level failures. Each async region inside a page has its own boundary (§40.3) so a failed recommendation block does not blank a lesson.

### 53.3 Code splitting

Every route lazy-loads. The admin tree, the rich text editor and the Mux player are all outside the learner's initial bundle. Verify against §43's budgets in CI, not by eye.

## 54. Server state — TanStack Query

### 54.1 Client

```ts
// src/lib/query/client.ts
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      retry: (failureCount, error) => {
        // Never retry auth or entitlement failures — they are answers, not errors
        const status = (error as AxiosError)?.response?.status
        if (status === 401 || status === 403 || status === 404) return false
        return failureCount < 2
      },
      refetchOnWindowFocus: false,
    },
  },
})
```

The retry predicate matters: retrying a 403 three times means a user without entitlement waits three round trips to be told no.

### 54.2 Key factory

```ts
export const queryKeys = {
  questions: {
    all:      ['questions'] as const,
    index:    (sectionSlug: string) => ['questions', 'index', sectionSlug] as const,
    list:     (filters: QuestionFilters) => ['questions', 'list', filters] as const,
    detail:   (slug: string) => ['questions', 'detail', slug] as const,
  },
  courses: {
    all:    ['courses'] as const,
    detail: (slug: string) => ['courses', 'detail', slug] as const,
    outline:(slug: string) => ['courses', 'outline', slug] as const,
  },
  lessons: {
    detail:        (slug: string) => ['lessons', 'detail', slug] as const,
    playbackToken: (id: string)   => ['lessons', 'playback', id] as const,
  },
  progress:     { forCourse: (slug: string) => ['progress', slug] as const },
  entitlements: { mine: () => ['entitlements', 'mine'] as const },
  downloads:    { url: (templateId: string) => ['downloads', 'url', templateId] as const },
  admin:        { orders: (page: number) => ['admin', 'orders', page] as const },
}
```

### 54.3 Rules

- API calls live in `lib/api/*.ts`, never in a component body.
- The playback token query sets `staleTime: 0` and `gcTime: 0` — a cached playback token is a security problem.
- The download URL is a **mutation**, not a query: it has a side effect (minting a credential), it must not be cached, and it must not refetch on remount (§26.5).
- On sign-out, `queryClient.clear()`. On sign-in, invalidate everything user-scoped.
- Optimistic updates on `Mark complete` only. Nothing involving money is optimistic.

## 55. Client state — Zustand

Three stores. Nothing that comes from the server lives here.

```ts
// src/stores/use-auth-store.ts
interface AuthState {
  user: User | null
  loading: boolean
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null })
    // Imported lazily to avoid a circular dependency between the store and the
    // query client — v1's version imported queryClient at module scope, which
    // creates a cycle with the Axios interceptor that reads this store.
    const { queryClient } = await import('@/lib/query/client')
    queryClient.clear()
  },
}))
```

```ts
// src/stores/use-filter-store.ts — mirrors the URL, which is authoritative (§19.8)
export interface QuestionFilters {
  search: string
  domain: string | null
  effort: string | null
  duration: string | null
  cost: string | null
  payback: string | null
  regulator_pressure: string | null
  tier: string[]
  leadership_traits: string[]
}
```

The store exposes `setFilter`, `clearDimension`, `clearAll`, `activeCount()` and `toSearchParams()`. The `useFilters` hook owns synchronisation with the URL in both directions; components never touch `URLSearchParams` directly.

```ts
// src/stores/use-ui-store.ts
interface UIState {
  filterSheetOpen: boolean
  commandOpen: boolean
  outlineSheetOpen: boolean
  theme: 'light' | 'dark' | 'system'
}
```

Theme is persisted to `localStorage` and applied to `<html>` before first paint by a small inline script in `index.html`, so there is no flash of the wrong theme.

## 56. API client

```ts
// src/lib/api/client.ts
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
})

api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`
  }
  return config
})

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Do not hard-navigate — that discards unsaved admin work and the user's
      // scroll and filter state. v1 used window.location.href here.
      // Surface it and let §45.3's session bar handle recovery.
      useAuthStore.getState().setUser(null)
      useUIStore.getState().setSessionExpired(true)
    }
    return Promise.reject(error)
  }
)
```

### 56.1 API modules

```ts
// src/lib/api/questions.ts
export async function fetchQuestionIndex(sectionSlug: string) {
  const { data } = await api.get<QuestionIndexResponse>(
    `/sections/${sectionSlug}/questions/index`
  )
  return questionIndexSchema.parse(data)   // Zod at the boundary
}

export async function fetchQuestionBySlug(slug: string) {
  const { data } = await api.get<QuestionDetailResponse>(`/questions/${slug}`)
  return questionDetailSchema.parse(data)
}
```

Parsing responses with Zod at the boundary means a backend field rename fails loudly in development rather than silently rendering `undefined` in production.

### 56.2 CORS

Two hosts means CORS (Research 6.9). FastAPI must allow the deployed frontend origin and `localhost` in development. A missing origin fails in a way that looks exactly like "the API is down" — check this first when the API appears dead.

### 56.3 Environment variables

```
VITE_API_BASE_URL=https://api.example.com
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ…
VITE_POSTHOG_KEY=phc_…
VITE_POSTHOG_HOST=https://eu.posthog.com
```

**Anything prefixed `VITE_` is compiled into the bundle and is public.** The Mux signing key, the Stripe secret key, the R2 access key and the Resend key belong only in the FastAPI environment. A secret in a `VITE_` variable is a published secret, and this is the single most common way a build like this leaks.

## 57. Question scoring — corrected implementation `[DECIDED]`

### 57.1 Where it runs

The **API owns the query and the authoritative result**. At 100 questions, the published index (title, slug, domain, preview, seven tags) is roughly 40 KB gzipped, so the client also caches it and recomputes counts locally for instant feedback (§19.6).

This resolves v1's contradiction between §63's "no client-side filtering of the entire database" and §57's live-count requirement — at this scale they do not conflict.

**The cutover:** when the index exceeds ~500 questions or 250 KB, move counting server-side behind a debounced endpoint. Write that threshold into the handover pack so the next developer knows the rule and its expiry.

**The bodies are never in the index.** Only summaries. Gating is not affected by any of this.

### 57.2 The bug in v1

v1's implementation ended with:

```ts
isExact: close === 0 && exact > 0
```

Consider a user filtering on `effort: low` and `duration: weeks`, and a question tagged `effort: low, duration: quarters`. The effort match scores exact (`exact = 1`); the duration is three steps away, so it contributes nothing and does **not** increment `close`. The result is `exact = 1, close = 0` → `isExact = true`. A question that misses one of the user's two constraints entirely is presented as an exact match.

This is the failure mode the whole two-zone design exists to prevent, and it would present at the exact moment the product's headline claim is being tested.

### 57.3 The correction

```ts
// src/lib/scoring.ts

type Ordinal  = 'low' | 'medium' | 'high'
type Cost     = 'free' | 'low' | 'medium' | 'high'
type Duration = 'days' | 'weeks' | 'months' | 'quarters'
type Payback  = 'immediate' | 'short' | 'medium' | 'long'

const scales = {
  effort:             { low: 1, medium: 2, high: 3 },
  regulator_pressure: { low: 1, medium: 2, high: 3 },
  cost:               { free: 0, low: 1, medium: 2, high: 3 },
  duration:           { days: 1, weeks: 2, months: 3, quarters: 4 },
  payback:            { immediate: 1, short: 2, medium: 3, long: 4 },
} as const

type OrdinalDimension = keyof typeof scales

const EXACT_POINTS = 2
const CLOSE_POINTS = 1

export interface DimensionResult {
  dimension: OrdinalDimension | 'domain' | 'tier' | 'leadership_traits'
  requested: string | string[]
  actual: string | string[]
  distance: number          // 0 = exact, 1 = adjacent, 2+ = far
}

export interface ScoredQuestion {
  question: QuestionSummary
  score: number
  activeConstraints: number
  exactCount: number
  isExact: boolean
  misses: DimensionResult[]   // drives the MatchBadge (§19.3)
}

function distance(dim: OrdinalDimension, requested: string, actual: string): number {
  const scale = scales[dim] as Record<string, number>
  const a = scale[requested]
  const b = scale[actual]
  if (a === undefined || b === undefined) return Infinity   // unknown value: no credit
  return Math.abs(a - b)
}

export function scoreQuestion(
  question: QuestionSummary,
  filters: QuestionFilters
): ScoredQuestion {
  let score = 0
  let activeConstraints = 0
  let exactCount = 0
  const misses: DimensionResult[] = []

  // --- Ordinal dimensions: graded distance ---
  for (const dim of Object.keys(scales) as OrdinalDimension[]) {
    const requested = filters[dim]
    if (!requested) continue
    activeConstraints++

    const actual = question[dim]
    const d = distance(dim, requested, actual)

    if (d === 0) {
      exactCount++
      score += EXACT_POINTS
    } else if (d === 1) {
      score += CLOSE_POINTS
      misses.push({ dimension: dim, requested, actual, distance: d })
    } else {
      misses.push({ dimension: dim, requested, actual, distance: d })
    }
  }

  // --- Categorical dimensions: binary, no adjacency ---
  if (filters.domain) {
    activeConstraints++
    if (question.domain_slug === filters.domain) {
      exactCount++
      score += EXACT_POINTS
    } else {
      misses.push({
        dimension: 'domain',
        requested: filters.domain,
        actual: question.domain_slug,
        distance: Infinity,
      })
    }
  }

  // --- Multi-select: any overlap counts as satisfied ---
  for (const dim of ['tier', 'leadership_traits'] as const) {
    const requested = filters[dim]
    if (!requested.length) continue
    activeConstraints++

    const actual = question[dim] ?? []
    const overlap = requested.filter((v) => actual.includes(v))

    if (overlap.length === requested.length) {
      exactCount++
      score += EXACT_POINTS
    } else if (overlap.length > 0) {
      score += CLOSE_POINTS
      misses.push({ dimension: dim, requested, actual, distance: 1 })
    } else {
      misses.push({ dimension: dim, requested, actual, distance: Infinity })
    }
  }

  return {
    question,
    score,
    activeConstraints,
    exactCount,
    // THE FIX: exact means every active constraint was satisfied exactly,
    // not merely that nothing landed in the "adjacent" bucket.
    isExact: activeConstraints > 0 && exactCount === activeConstraints,
    misses,
  }
}

export function partitionQuestions(
  questions: QuestionSummary[],
  filters: QuestionFilters
): { exact: ScoredQuestion[]; close: ScoredQuestion[]; hasFilters: boolean } {
  const hasFilters = countActiveFilters(filters) > 0

  if (!hasFilters) {
    return {
      exact: questions.map((q) => ({
        question: q, score: 0, activeConstraints: 0,
        exactCount: 0, isExact: true, misses: [],
      })),
      close: [],
      hasFilters: false,
    }
  }

  const scored = questions.map((q) => scoreQuestion(q, filters))
  const byScore = (a: ScoredQuestion, b: ScoredQuestion) =>
    b.score - a.score || a.question.title.localeCompare(b.question.title)

  return {
    exact: scored.filter((s) => s.isExact).sort(byScore),
    // A question scoring zero shares nothing with the query and is not shown at all.
    close: scored.filter((s) => !s.isExact && s.score > 0).sort(byScore),
    hasFilters: true,
  }
}
```

### 57.4 Free-text search

Search is applied **before** scoring, as a filter over title and preview, not as a scored dimension. Mixing keyword relevance into the constraint score produces a ranking nobody can explain — and explicability is the point (§3.6, Research 3.5).

### 57.5 Which relaxation to suggest

For the zero-result state (§19.4), rank the active filters by how few questions each admits *on its own* against the full index, and offer the two most restrictive. This is computed from the cached index, costs nothing, and turns a dead end into a two-tap recovery.

### 57.6 Tests

`scoring.ts` is the one piece of pure logic in the frontend that carries the product's core claim. It gets unit tests, including explicitly:

- Two constraints, one exact and one far → **not** exact (the v1 bug)
- Two constraints, one exact and one adjacent → close, with one miss reported
- Zero active filters → everything returned as exact, original order preserved
- Unknown tag value from the API → no credit, no crash
- Multi-select partial overlap → close, not exact

## 58. Testing

### 58.1 What gets tested

Not everything. In four weeks, test the things whose failure is expensive and silent.

| Layer | Coverage |
|---|---|
| Unit (Vitest) | `scoring.ts`, `format.ts`, filter/URL serialisation, Zod schemas |
| Component (Testing Library) | `EntitlementGate`, `DownloadButton`, `PaywallFade`, `FilterRail`, forms |
| E2E (Playwright) | The gating suite (below), the purchase path, the learning path |
| Accessibility (axe) | Every public route and the lesson page, in CI |

### 58.2 The gating suite — non-negotiable

The brief's hardest requirement is that paid content is genuinely inaccessible. That is a test suite, not a hope. Each of these must fail closed:

1. Logged-out user requests a gated lesson URL → paywall, no body text in the HTML response
2. Signed-in but unentitled user requests the same → paywall, no body text
3. Direct request to a template's storage URL without a presigned credential → denied
4. A presigned download URL reused after 60 seconds → denied
5. A Mux playback token for a lesson the user is not entitled to → never issued
6. A playback token issued for lesson A used for lesson B → denied
7. Entitlement revoked mid-session → next gated request denied
8. Draft content requested by direct URL, signed out → 404, not a preview
9. `View source` on a gated question page contains no gated text
10. The API's question index response contains no `body` field, ever

Run these in Week 2, not Week 4. "Access control discovered to be wrong in week four invalidates everything built on top of it" (brief).

---

# PART G — PLAN, DECISIONS, HANDOVER

## 59. Design decisions and rejected alternatives

The brief assesses reasoning as seriously as the build. Each decision states what was chosen, why, and what was rejected.

| # | Decision | Reasoning | Rejected |
|---|---|---|---|
| 1 | **Tailwind v4 + shadcn/ui** | CSS-variable theming gives light/dark for free; shadcn components are copied in, so we own and edit them; `@theme inline` puts the whole system in one file; composable primitives beat a custom library in four weeks | MUI/Chakra (recognisable, and the interface is the differentiator); fully custom (no time); CSS-in-JS (second styling mechanism) |
| 2 | **React 19 + React Compiler** | Current line; the compiler removes hand-memoisation on the discovery render path, which is the one performance-sensitive surface | React 18 (v1's choice — a year behind and forgoing the compiler) |
| 3 | **React Router v8** | v6 is EOL as of June 2026 and receives no security updates. v8's data mode is what v6 was, with a maintained future | v6 (EOL); framework mode (an SSR runtime the backend architecture has no room for); TanStack Router (excellent, but a new-tool tax in a four-week build) |
| 4 | **Build-time prerender of public routes** | The public question pages are the acquisition funnel. An SPA cannot serve them to a crawler with per-page metadata. Prerendering gets that without a server runtime | Client-only SPA (v1's implicit position — silently forfeits organic acquisition); full SSR (a second server); dynamic rendering for bots (fragile and penalised) |
| 5 | **Questions as the primary object** | The taxonomy is the differentiator (Research 3.1). Courses are how content is consumed; questions are how it is found. Two different flows | A course-catalogue homepage (which is every competitor, and forfeits the one thing no PDF can do) |
| 6 | **Transparent scoring, not AI ranking** | This audience distrusts opaque relevance. A visible rule is more trustworthy, and vastly cheaper to build and debug (Research 3.5) | Embedding-based relevance in v1 (accuracy risk, prompt-engineering time, and unexplainable) |
| 7 | **URL as filter source of truth** | Shareable, bookmarkable, back-button-correct, and free of a whole class of state-sync bugs | Zustand-only (v1's position — loses shareability and breaks the back button) |
| 8 | **Serif for reading only** | Reconciles Research 12.5's editorial-credibility recommendation with a sans interface. The serif works where a practitioner reads 400 words; sans works everywhere they act | All-sans (v1 — forfeits the editorial signal); all-serif (unreadable in admin and controls) |
| 9 | **Gated text never sent to the client** | A CSS blur over delivered text is decoration, not gating. View Source defeats it instantly, and this is a paid product | Blur/overlay on delivered content (common, and wrong) |
| 10 | **Semantic tokens, lint-enforced** | One source of truth means a brand change is one file. Enforcement matters because consistency that relies on remembering is not consistency | Convention alone (v1 — the seventh shade of blue arrives in week three) |
| 11 | **Corrected palette rather than the palette as supplied** | Six dark-mode pairs failed WCAG including the focus ring at 1.65:1, and the light sidebar tokens were dark-theme values. Both are brief non-negotiables, not preferences | Shipping as supplied (fails accessibility); a full repalette (the supplied palette is good; it needed six fixes, not a redesign) |
| 12 | **TanStack Query + Zustand + Axios** | Server state and client state are different problems and should not share a mechanism. Axios interceptors put JWT attachment and 401 handling in one file | Redux (weight); raw `fetch` + `useEffect` (reinvents caching, badly); SWR (fine, but Query's mutation and invalidation story is stronger for admin) |
| 13 | **React Hook Form + Zod** | One schema validates the form, types the payload, and parses the API response. Admin has ~12 forms; this is where it pays | Formik (heavier, less TS-native); hand-rolled validation (drifts from the backend within a week) |
| 14 | **No certificates** | Research 12.6 is right: a real certificate needs PDF generation, a template, server-side delivery. Those hours belong to the slice | Building them (steals from gating and commerce) |
| 15 | **Explicit "Mark complete"** | Professionals resent a system deciding on their behalf whether they finished something | Scroll-depth or video-percentage auto-completion |

## 60. Four-week design sequence

The design system governs from Week 1. Only the *document* is finished in Week 4 (Research 12.3).

### Week 1 — the slice, in the system

Day 1: confirm brand name and domain `[OWNER]`; confirm the five domain names and the authoritative values for all seven tags `[OWNER]` — the schema cannot be committed without them.

Then, in this order:

1. `theme.css` with the corrected tokens (§7) — half a day, and it governs everything after
2. Fonts loaded and the type scale applied (§9, §10)
3. Six components built properly, not copy-pasted: Button, Card, Input+Label+error, Badge, EmptyState, PageTitle
4. Header, footer, marketing layout
5. **The discovery page, functional** — filters, live count, two-zone results. Ugly is acceptable; missing is not (Research 12.4)
6. One question detail page with a real paywall
7. Sign-in / sign-up
8. One product page → hosted checkout → success → entitlement
9. One lesson with a real video that plays
10. One gated template download
11. One receipt email that arrives

**Ugly is acceptable this week. Inconsistent is not.** Plainness does not need retrofitting; inconsistency does. If the slice is not working end to end by Friday, that is a scope conversation on Friday, not a late night.

### Week 2 — learning, access and gating

Course outline, modules, mixed lesson types, progress and resume. Real content loaded from the 100 questions. Sign-in and access control finished properly. **The gating test suite written and passing (§58.2).**

Design work: the learning interface at both widths, locked states, the paywall, empty states for the library and dashboard.

### Week 3 — commerce, content and admin

Multiple products, pricing, tiers, the free entry point. Transactional email. Admin usable by someone who is not the developer — and proved by watching them (§31.3). Enough real content that the platform reads as inhabited.

Design work: pricing table, checkout states including the webhook race (§29.4), admin forms and tables, order reconciliation.

### Week 4 — hardening, polish, handover

The design system is *applied* by now; this week is where the small things are hunted:

- Empty, loading, error and locked states on every surface
- Failed payment, expired session, expired download URL, expired playback token
- Checkout on a real phone with a real card
- Try to break your own gating and fix what gives
- Keyboard-only purchase and keyboard-only lesson completion
- 375px pass on every screen
- Dark mode pass on every screen
- Both stress-fixture passes (§49.2)
- Write the handover pack

### 60.1 If it gets tight

Protect the slice, not the surface area. One complete, polished, sellable path is worth more than four unfinished ones — and it is the version that can actually launch.

The order things get cut, in this order:

1. Semantic search `[V2]`
2. Recommendation blocks — replace with "Browse all questions"
3. The search results page (`/search`) — the ⌘K palette covers it
4. Course completion recognition (§24.4)
5. Admin bulk actions
6. Dark mode polish — **not dark mode itself**, which is already in the tokens

Never cut: gating, the discovery page, the purchase path, mobile checkout, accessibility basics, real content.

## 61. What we are not designing in v1

Designed *for* — meaning the schema and the layouts leave room — but not built:

AI assistant · AI-generated learning paths · agentic pack assembly · "adapt this to my organisation" · team dashboards and seat licences · enterprise procurement · subscriptions and recurring billing · certificates · community, comments and forums · advanced recommendation engines · author portals · a native mobile app.

Each of these gets a paragraph in the handover pack: where it would go, what already supports it, and what would have to change.

### 61.1 Where the AI features will land

The brief asks for AI to be considered, not bolted on. Three specific, designed-for slots:

| Feature | Where it lands | What already supports it |
|---|---|---|
| **Semantic search** | The discovery search input, as a second result group below keyword matches | §22.4's reserved `matchType` field and empty-state copy |
| **"Adapt this to my organisation"** | A secondary action on the question detail page, below "What to do next", producing an editable draft the user owns | The question body is already a discrete, addressable object with structured tags describing its context |
| **Agentic pack assembly** | A guided entry on the homepage — role, sector, current problem → an assembled path | The seven-dimension taxonomy is exactly the input such an agent needs; that is why it must stay a controlled vocabulary (§31.4) |

The thing that makes all three cheap later is the same thing that makes the product work now: clean, controlled, complete tagging. Protecting the taxonomy is protecting the roadmap.

## 62. Release QA checklist

Run before every release, on a real device.

**Visual** — correct fonts loaded (no fallback flash) · spacing from the scale · no raw hex in components · consistent radii · no stray shadows · no overflowing text at 375px · both themes checked

**Interaction** — one obvious primary action per screen · hover, focus-visible, active, disabled all present · loading state · error state · empty state · no dead-end disabled buttons

**Responsive** — 375 · 390 · 430 · 768 · 1024 · 1280 · 1440 · 200% zoom with no clipping

**Accessibility** — keyboard-only purchase · keyboard-only lesson completion · visible focus in both themes · route changes announced · skip link works · captions present · no colour-only meaning · axe clean on every public route

**Commerce** — price visible and correctly formatted · tax behaviour stated before redirect · checkout works on a real phone with a real card · failed payment state · success state · receipt arrives · entitlement delay handled · purchase record reconcilable

**Paid content** — logged-out blocked · unentitled blocked · direct file URL blocked · playback token scoped and expiring · expired session handled without data loss · refresh preserves correct access state · gated text absent from the HTML

**Content** — real questions · real prices · real names · a very long title present · a very long person name present · no `test`, no `asdf`, no `$0.00`

**Performance** — LCP < 2.0s · CLS < 0.05 · initial JS < 180KB · no layout shift on image load

## 63. Handover pack — the design portion

The brief asks for an architecture note, an extension guide, running costs, known gaps and what comes next. This document supplies the design half:

1. **This file**, current — the system, the decisions and the reasoning
2. **Adding a new section, from the design side** — which components render section-scoped data, which strings live in `labels.ts`, what a second author changes on the about page and the question detail byline, and what it does not change (everything else)
3. **Known shortcuts, named honestly** — the prerender rebuild trigger (§44.2), the provisional course artwork (§16.2), any stress fixture that revealed a bug that was deferred rather than fixed
4. **The non-developer admin test results** (§31.3) — every place someone stopped, and whether it was fixed
5. **What I would build next, with another four weeks** — in priority order, with the reasoning
6. **Open decisions still outstanding** — every `[OWNER]` marker in this document that was not closed, and what it blocks

## 64. Open decisions `[OWNER]`

Carried forward from the Research Specification's Appendix J, plus the design-specific ones this document raises. Each blocks something.

| Decision | Blocks | Section |
|---|---|---|
| Brand name and domain | Everything. Week 1, Day 1. | — |
| The five domain names, exactly | Schema and the filter rail | §19.5 |
| Authoritative values for all seven tags | Schema, filter rail, scoring scales | §19.5, §57 |
| Contracting entity name and address | The receipt email; launch | §32.3 |
| Currency | Every price on every surface | §28.2 |
| Price for each product | Pricing page, product pages | §28 |
| Which domain is the free entry point | The free entry point and its copy | §27 |
| Refund position | Pricing page, checkout, terms | §28.2, §29.1 |
| Guest checkout or account-required | The three-step purchase budget | §4 |
| Are question previews publicly indexable | The SEO and acquisition model | §44.4 |
| Template licence position | Template product pages, terms | §26.3 |
| Marketing consent model and jurisdiction | The lead capture form | §27.2 |
| Approved hero copy | Homepage | §18.2 |
| Whether an illustrator is involved | Imagery direction, course artwork | §16, §16.2 |

## 65. The loop this all serves

Every decision in this document exists to make one loop turn faster and more often:

```
I have a question
      ↓
I find the question
      ↓
I understand the answer
      ↓
I see what else would help
      ↓
I buy it, or I start learning
      ↓
I use it — at work, this week
      ↓
I come back with another question
```

The finished product should feel like **professional publishing + a modern learning product + a practical interface.** It should not feel like a generic LMS, a corporate dashboard, or a landing-page template.

When a design choice is genuinely balanced, pick the one that makes a risk manager, three coffees into a Tuesday, come back on Thursday with another question.

---

*End of specification. Version 2.0.*
