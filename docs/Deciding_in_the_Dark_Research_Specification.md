# Deciding in the Dark — Research & Product Specification
**Pre-Build Decision Document · v2.2 · August 2026**

*Prepared for: Effective Risk Management*
*Status: Research finding / Inference / Recommendation clearly marked throughout*

---

## DOCUMENT HISTORY

This is the **single, canonical specification** for the platform. v1.0 was the initial research pass; v1.1 (7 August 2026) audited it against the full 16-section research brief and current official pricing, patching gaps in place (marked `[AUDIT v1.1]`). v2.0 (7 August 2026) consolidated every earlier draft specification produced during this project's research phase into this one document — competitor detail, a formal project risk register, and a budget-constrained stack alternative. **v2.1 (7 August 2026) records an owner-directed stack pivot**, marked `[STACK PIVOT v2.1]`: the frontend/backend framework changed from Next.js to a decoupled React (Vite, TypeScript) frontend and FastAPI (Python) backend, with the FastAPI backend hosted on Render — Supabase, Stripe, Mux, Cloudflare R2, Resend, and PostHog are unaffected; the pivot changes *where* entitlement-checking code lives, not *whether or how* it happens. **v2.2 (7 August 2026) elevates scalability and extensibility to an explicit, standing owner directive**, marked `[OWNER DIRECTIVE]`: the system must always be scalable for new features and extensible, not merely tolerant of extension as a nice-to-have. Sections carrying old Next.js-specific detail are corrected in place rather than left to contradict later decisions.

---

## NOTATION USED IN THIS DOCUMENT

> **[FINDING]** — A conclusion drawn from research evidence, with sources cited.
> **[INFERENCE]** — A reasoned conclusion where direct evidence is partial.
> **[RECOMMENDATION]** — A specific recommendation from the research team.
> **[WARNING]** — A risk or challenge to the brief or assumptions.
> **[OPEN DECISION]** — A decision that must be made by the owner before building begins.

---

# EXECUTIVE SUMMARY

## What the product should be

"Deciding in the Dark" should become a **structured knowledge platform for risk practitioners** — not a course catalogue, not a book website, and not a clone of Teachable or Kajabi. The differentiating asset is the taxonomy: 100 real questions, seven structured tags, and the ability to answer "what can I fix in a fortnight, cheaply, that my regulator cares about?" in seconds. That query capability is the product. Everything else — videos, templates, courses — is the delivery layer around it.

The platform should be built custom because no off-the-shelf LMS supports a faceted, tag-filtered question discovery interface combined with gated content and a commerce layer that can extend to multiple subjects and authors. Buying Kajabi or Teachable forfeits the interface — and the interface *is* the differentiator.

## Core system requirement: scalability and extensibility `[OWNER DIRECTIVE, v2.2]`

**The system must always be scalable (for new features) and extensible.** This is a standing requirement against which every architectural decision in this document is judged — not a post-v1 aspiration to revisit once revenue justifies it. Concretely, it means:

- A **new feature** can be added without a rewrite of the entities it touches — the data model in Part Five/Appendix C is deliberately more normalised than a one-book, one-course MVP strictly needs, precisely so this holds.
- A **new subject, author, or audience** is configuration, not a migration — the `Section` entity (3.4, 10.1) exists specifically for this; see 12.2's warning about what happens if this is treated as optional.
- A **new commerce model** (bundles, subscriptions, team licences) plugs into the existing `ENTITLEMENT` mechanism (5.6) rather than requiring a parallel access-control system — the entitlement model is deliberately decoupled from product type for this reason.
- A **pricing change** never requires a content migration, because price is stored on the `Product`, never on the content it sells (10.1).

**[RECOMMENDATION]** Treat this directive the same way the brief treats "never handle card data" — a constraint every subsequent decision is checked against, not a value to be traded off under schedule pressure. Where a shortcut would violate it (e.g. hard-coding a value that should be a foreign key, or coupling a new feature's access control to a bespoke check instead of the `ENTITLEMENT` table), that shortcut needs the owner's explicit, informed sign-off before it ships — silently taking it under Week 1–4 time pressure is exactly the kind of decision Part Twelve warns compounds into an expensive rewrite later. Part Ten expands on which extensibility-supporting decisions matter *now* (Week 1) versus which can safely wait until a second subject is actually being built.

## Who it should serve (v1)

**Primary:** Risk practitioners and risk leaders in mid-to-large organisations. CROs, risk managers, and compliance officers who have a specific problem, need a practical answer, and can expense or self-fund a purchase under $200. They are not browsing; they are searching. They value credibility and author authority above production values.

**Secondary:** Consultants who advise on risk, governance, and compliance; professionals in adjacent functions (legal, audit, IT) who need risk vocabulary and frameworks.

**Not v1:** Teams purchasing seat licenses. Enterprise procurement. Students seeking certification.

## The recommended v1

A live, purchasable platform with:
- A question discovery interface (all 100 questions, filterable by all seven tags simultaneously)
- At least one full course with module/lesson/video structure and progress tracking
- A paid template store (PDF downloads, gated by purchase)
- Free entry point (one domain's questions or a sample resource) that earns an email address
- Stripe-hosted checkout
- Signed-URL video via Mux
- Gated file downloads via Cloudflare R2 presigned URLs
- Transactional email (receipt + access)
- Admin interface for a non-technical person to add content

## Recommended architecture

**[STACK PIVOT v2.1]** The original research (Part Six) evaluated and recommended Next.js as a single integrated frontend+backend. The owner has since directed a decoupled architecture instead. Both are legitimate; the decoupled version requires more explicit discipline to keep entitlement checks server-side (Part 5.6), since there is no server-component pattern doing it implicitly — every check is now an explicit FastAPI dependency, not a framework default.

- **Frontend:** React (Vite, TypeScript), Tailwind CSS — deployed on Vercel (static/SPA hosting; Vercel is not Next.js-exclusive)
- **Backend/API:** FastAPI (Python), hosted on Render — owns all entitlement checks, Stripe webhook handling, Mux signed-JWT generation, and R2 presigned-URL generation. This is the sole source of truth for access control; the React frontend renders only what this API returns.
- **Database:** Supabase (PostgreSQL, Row-Level Security, connection pooling) — unchanged; consumed from FastAPI via a Postgres connection, with FastAPI verifying Supabase-issued JWTs rather than relying on Next.js/Supabase SSR helpers
- **Authentication:** Supabase Auth (Email/Password + Magic Link) — unchanged as the identity provider; the React frontend calls Supabase Auth directly for sign-up/sign-in, then attaches the resulting JWT as a Bearer token on every FastAPI call
- **Payments:** Stripe (hosted Checkout, webhook-driven entitlements) — unchanged; Checkout Session creation and the webhook endpoint both move to FastAPI
- **Video:** Mux (signed JWT playback, auto-captions, pay-as-you-go) — unchanged
- **File storage:** Cloudflare R2 (zero egress fees, presigned URLs for gated downloads) — unchanged
- **Email:** Resend (transactional email, 3 K free/month) — unchanged in provider; see 6.7 for a template-format change now that the backend is Python, not Next.js/React
- **Admin/CMS:** Custom admin section as a protected area of the React app, calling FastAPI for all writes
- **Analytics:** PostHog (free tier, event tracking + funnels) — unchanged

## Biggest risks

1. **The four-week timeline is real but fragile.** Every day spent debating tools or building custom auth is a day not spent on the slice. Commit to the stack on day one.
2. **The admin interface will be underdone.** A fully usable non-technical admin for this data model takes longer than it looks. Week 3 is where this bites if not planned for in week 1.
3. **Content volume.** "100 questions" is the product, but loading them all with proper tagging while building the platform simultaneously requires either the author's direct contribution or a content-loading sprint that delays the build.
4. **Gating complexity.** Server-side entitlement checks must be built correctly in Week 2. Every other feature sits on top of them. A leak discovered in Week 4 means rebuilding, not patching.
5. **The question discovery interface is technically the hardest part of the product.** Multi-dimensional faceted filtering at the database level, with performant queries and a clean UI, is more complex than a standard course list. Plan for it explicitly.

## What should be cut

| Feature | Verdict | Reason |
|---|---|---|
| Completion certificates | Cut | Cheap to add but steals time from gating and commerce. Propose post-v1. |
| Subscription/recurring billing | Cut | Adds Stripe Billing complexity. Deliver as one-time purchases; add subscriptions in v2. |
| Team/seat licences | Cut | Enterprise purchasing is a different product and sales motion. |
| AI question-matching | Cut from v1 | Requires prompt engineering + testing. High accuracy risk. Add post-v1 when question database is stable. |
| Social/community features | Cut | No evidence the audience needs this yet. |
| Multiple authors in v1 | Schema only | Design the data model to support multi-author; do not build the UI for it in v1. |
| Mobile app | Cut | Web-responsive is sufficient. Native app is a later decision. |

## What must be built first

The slice, in this exact order: **Auth → Single product purchase (Stripe checkout) → Entitlement check → Signed video playback (Mux) → Gated download (R2) → Receipt email (Resend).** If every one of these works by end of Week 1, the rest of the build is widening a proven path. If even one is missing, Week 2 becomes Week 1 again.

---

# PART ONE — PRODUCT AND MARKET RESEARCH

## 1.1 Comparable platforms examined

The following platforms were examined for patterns relevant to this build. They are not direct competitors (none serves the specific risk practitioner audience with this content model), but they provide proven patterns to adopt or avoid.

### Masterclass
**[FINDING]** Masterclass pioneered the "premium expert, high production value" professional content model. It charges a flat annual subscription ($120–$180/year) for access to all content, with no à-la-carte purchases. Revenue is built on perceived access to authority (Shonda Rhimes on writing, Gordon Ramsay on cooking), not the depth of the curriculum.

*What to copy:* The authority-forward presentation (author name and credibility above content description), the cinematic lesson presentation that communicates quality before a purchase. Masterclass proved that professional audiences pay for access to genuine expertise.

*What to avoid:* The subscription model (locks out practitioners who want a specific answer, not unlimited browsing); the production cost (this platform cannot justify $100K+ per course video at launch); the marketplace model (Masterclass has no taxonomy or filtering — it is a catalogue, not a query system).

### Kajabi / Teachable / Thinkific
**[FINDING]** These all-in-one course platforms dominate the individual-creator space. Kajabi's pricing has risen significantly; the Basic plan is reported at approximately $143/month (2025 pricing). Teachable offers better course-specific features but requires third-party tools for marketing. Thinkific is noted for corporate training.

**[INFERENCE]** None of these platforms supports the faceted query interface this product requires. Their content model is: creator → course → lesson. The "Deciding in the Dark" model is: question → domain → tag-set → course → lesson → template. The mismatch is fundamental, not cosmetic.

*What to copy:* Progress tracking UI patterns, checkout flow structure (Teachable's is particularly clean), lesson type differentiation (video, reading, download), certificate-of-completion consideration.

*What to avoid:* Buying any of these. The interface cannot be owned; the taxonomy cannot be expressed; the gating model is too rigid. Custom build is justified here.

### LearnWorlds
**[FINDING]** LearnWorlds offers more sophisticated course-building features including interactive video, built-in tests, and more customisable admin than Teachable. It is noted for its AI course creation tools. Pricing starts at approximately $24/month.

*What to copy:* Interactive progress indicators; the concept of mixing lesson types within a single course.

### Circle (community-driven learning)
**[FINDING]** Circle ($89/month) combines courses, community, email, and payments in one platform. It is well-regarded for completion rates due to peer accountability. It does not support the kind of faceted content discovery this product needs.

### GARP, IRM, ISC2 (professional risk/compliance bodies)
**[FINDING]** These established professional bodies (Global Association of Risk Professionals, Institute of Risk Management, ISC2 Risk Management Certificate) serve the same audience with certification pathways, exam prep, and CPD content. GARP's FRM certification is the standard financial risk credential. IRM covers enterprise risk broadly.

**[INFERENCE]** These are not direct competitors in the same content format, but they shape the audience's credibility expectations. The risk practitioner audience is accustomed to paying for quality professional content ($500–$2,000+ for GARP exam prep). A well-presented $79–$199 product with genuine practitioner value is well within their willingness to pay.

*What to copy:* The authority signals (authored by a named practitioner, tied to real standards like ISO 31000); the structured domain approach (GARP segments financial risk by type; this platform segments by domain).

### O'Reilly Learning / Pluralsight
**[FINDING]** O'Reilly Learning provides access to thousands of technical books and courses via subscription ($499/year individual). It is a content library, not a query tool. Pluralsight focuses on technology skills with role-based learning paths.

*What to copy:* The "learning path" concept — a sequence of content curated for a specific role or goal — is a natural v2 feature for this platform given the seven-tag taxonomy.

### Risk-specific e-learning platforms `[CONSOLIDATED v2.0]`

**[FINDING]** Three platforms serving risk-adjacent audiences directly were examined for domain-specific patterns, distinct from the generalist platforms above:

**Grail Learning** (healthcare risk management) rebuilt its positioning around a single clear workflow — education → analytics → risk metrics — after finding its original site had broad messaging and abstract claims that did not convert. *What to copy:* evidence-driven, trust-focused language over abstract claims; site architecture that mirrors the practitioner's real workflow rather than a generic course catalogue; calm, professional visual design with clear hierarchy — directly applicable to this platform's homepage and question-to-guidance flow.

**StoneX eLearning Risk Management Academy** (grain origination and merchandising risk) uses a custom LMS with SCORM-conformant modules, progress badges, and certification at an 80%+ completion score. *What to copy:* the finding that gamified progress (badges, completion thresholds) measurably increases engagement in risk-specific training — a candidate for v2, not v1, given Part 12.6's assessment that certificates are not cheap to build correctly. *What to avoid:* the certification-gate model requires a scored assessment engine this platform does not need for v1.

**NIST Cyber Risk Portal** pairs each assessment tool with its own short tutorial (video, slides, narrated walkthrough) rather than one generic onboarding flow. *What to copy:* consider a short, tool-specific walkthrough for the question-discovery filter interface specifically (Part 3.3) rather than a single generic product tour, since that interface is unfamiliar even to practitioners who have used other learning platforms.

### MOOC usability findings `[CONSOLIDATED v2.0]`

**[FINDING]** Baymard Institute's e-commerce UX benchmarking places the "Online Learning" category in the top 1% for both desktop and mobile UX performance, evaluated across homepage, navigation, search, product page, and checkout. Separate cognitive-walkthrough research comparing Coursera, Udemy, and Udacity found Coursera had the fewest usability problems and Udacity the most, with the dominant failure pattern being **necessary functions not visible in the interface** — not functions that don't exist, but functions the learner cannot find. Udemy is specifically noted for better findability and search than Coursera, despite Coursera's stronger credibility perception.

**[RECOMMENDATION]** Two implications for this build: (1) prioritise visibility of key actions ("Get full access," "Download template," "Continue where you left off") over adding more functions — the research pattern across all three platforms is functions failing because they're hidden, not because they're missing; (2) treat search/filter findability as seriously as Udemy does, since Part 3.3 already identifies the question-discovery interface as the platform's most important UX surface.

## 1.2 Key patterns to apply

**[FINDING]** Across all comparable platforms, the highest-converting professional content sites share five structural patterns:

1. **Value-above-the-fold:** Within 5 seconds, the visitor understands what the content is, who it is for, and what problem it solves. Author credibility and domain authority are visible immediately.
2. **Free entry point:** A free sample lesson, a free question, or a lead-magnet PDF that earns an email address and demonstrates content quality. Every successful paid content site has one.
3. **Transparent pricing:** Professional audiences do not like price-on-request. Clear pricing on the product page increases conversion.
4. **Progress visibility:** A learner who can see where they are and what remains is significantly more likely to complete. Completion drives trust and repeat purchase.
5. **Mobile checkout:** A checkout experience that fails on mobile loses a material fraction of impulse purchases. Professional audiences discover content on mobile frequently.

---

# PART TWO — USER RESEARCH

## 2.1 User segments and jobs-to-be-done

### Segment A: The Risk Practitioner (Primary)
**Who they are:** Risk manager, CRO, risk analyst, or operational risk lead in a financial services, healthcare, government, or professional services organisation. Mid-career. Likely holds or is working toward ISO 31000 familiarity, CISA, or CRISC. Has a board meeting, a regulator visit, or an audit in their diary.

**Primary job:** Solve a specific problem now. "The regulator is asking about our third-party risk programme. What should I do first?"

**Secondary job:** Build credibility and professional vocabulary. Stay current on what peers are thinking about.

**Willingness to pay:** High for specific answers. An hour's consulting rate is $150–$500; a $99 template or short course that saves two hours of work is an easy decision for someone who can expense it.

**What makes them trust a platform:** Author credibility (named practitioner, not "the team"), real-world examples, ISO/regulatory alignment, no obvious AI-generated padding.

**What makes them distrust:** Stock photography of people in offices staring at screens; generic content that could apply to any industry; a website that looks like a Kajabi template.

**Discovery path:** LinkedIn, professional association newsletters, word-of-mouth from peers, Google search on a specific question ("ISO 31000 risk appetite statement template").

### Segment B: The Compliance and Governance Professional (Primary)
**Who they are:** Compliance officer, legal counsel, governance lead, or internal auditor who works adjacent to risk. May not hold the "risk" title but owns significant risk-adjacent decisions.

**Primary job:** Understand risk frameworks well enough to contribute intelligently in meetings and reviews.

**Secondary job:** Find templates and frameworks that save them building from scratch.

**Willingness to pay:** Moderate to high. Often spending organisational budget rather than personal funds — this matters for pricing and invoicing.

### Segment C: The Consultant (Secondary)
**Who they are:** Independent risk or governance consultant, or a team within a consulting firm, seeking practical tools and content to use with clients.

**Primary job:** Find credible, usable frameworks and templates they can adapt and deliver under their own brand.

**What they buy:** Templates and guides more than courses. They know the theory; they need the artefacts.

**[INFERENCE]** This segment is underserved by existing platforms. Templates priced at $49–$149 each (with clearly commercial licensing terms) could generate significant revenue from consultants who buy multiple templates.

### Segment D: The Executive (Tertiary)
**Who they are:** CEO, CFO, Board member who needs enough risk vocabulary to govern effectively without becoming a practitioner.

**Primary job:** Understand what their risk function is telling them. Ask better questions.

**[INFERENCE]** This segment is appealing but hard to reach and design for simultaneously with Segment A. The content tone differs significantly. v1 should serve Segment A and trust that Segment D occasionally finds their way in.

## 2.2 What causes practitioners to abandon a purchase

**[INFERENCE]** Based on patterns from professional SaaS and content platforms:
- Unclear what they will receive before payment (no preview, no table of contents)
- Price mismatch (too expensive for an individual purchase without a team-license option; too cheap to feel credible)
- No author bio or credentials — anonymous content is low-credibility content
- Login-before-browse friction — demanding account creation before any content is seen
- No refund clarity — professional purchasers note this before buying

## 2.3 What drives return and repeat purchase

**[INFERENCE]** For professional content platforms:
- The first purchase delivered a direct, specific answer they used
- The author responded to a comment or question (personal connection)
- An email arrived with new relevant content (the free entry point earns this permission)
- A colleague recommended it after getting value from it

## 2.4 Individual vs. team purchasing needs `[AUDIT v1.1]`

**[FINDING]** The four segments researched in 2.1 split cleanly on this dimension, and it materially affects checkout design even in v1 where only individual purchase is built:

| Segment | Who pays | Purchase trigger | v1 implication |
|---|---|---|---|
| Risk Practitioner (A) | Self, then expenses; or a personal card for anything under ~$100 | Immediate, individual problem | Needs a fast, no-friction checkout; card receipt must be expense-report-ready (itemised, company name on receipt) |
| Compliance/Governance (B) | Organisational budget, even for a single seat | Needs to justify the spend, sometimes needs a tax invoice/ABN on the receipt before finance will approve it | Stripe Checkout receipt must show a proper tax invoice with ABN/business details, not a generic "thank you" email |
| Consultant (C) | Personal or firm budget; buys multiple templates for reuse across clients | Needs clarity on **commercial licence terms** before buying more than one | Template licence terms (11.4) must be visible on the product page, not buried in ToS, or repeat/bulk purchases stall |
| Executive (D) | Rarely pays directly | N/A for v1 | No design implication for v1 |

**[RECOMMENDATION]** Even though team/seat licensing itself is correctly deferred to post-v1 (Part 4), two individual-purchase-flow details should be built in v1 because they unlock Segment B and C spend without any subscription/seat-management complexity:
1. **Tax-invoice-quality Stripe receipts** (business name, ABN if applicable, itemised line item) — a Stripe Checkout configuration setting, not custom development.
2. **Visible licence terms on every template product page** ("You may use this template within your own organisation and adapt it for client delivery under a [named] licence") — a content/copy task, not an engineering task.

**[OPEN DECISION]** Whether "for client delivery" is permitted under the template licence, and at what price tier, is a business decision for the owner (see Appendix J).

---

# PART THREE — CONTENT MODEL RESEARCH

## 3.1 The content model is the product

**[FINDING]** The seven-tag taxonomy (effort, duration, cost, ROI horizon, tier, regulator pressure, leadership traits) is the primary differentiator. **[UPDATED]** The sixth tag was originally researched here as "payback"; the owner's 100 finalised questions (`Deciding_in_the_Dark_100_Questions.md`) use "ROI horizon" with three values (Quick / Mid / Strategic) rather than the four-value Immediate/Short/Medium/Long scale proposed below in 3.2 — the schema follows the real content, not this early placeholder. It enables a query that no PDF, book, or standard course catalogue can answer: "Show me questions that are cheap to address, take less than two weeks, and are relevant to APRA-regulated organisations at the operational tier." This is the product's core value proposition, and the information architecture must lead with it — not bury it behind a course catalogue.

**[RECOMMENDATION]** Design the primary discovery interface around multi-dimensional tag filtering, not course browsing. The course structure is how content is *consumed* once discovered; the tag filter is how it is *found*. These are different flows and should not be conflated.

## 3.2 Proposed information architecture for the 100 questions

### Entity hierarchy (content)

```
Section  (e.g., "Deciding in the Dark")
  └── Domain  (5 domains, e.g., "Third-Party Risk", "AI Governance")
        └── Question  (100 questions total)
              ├── Body text (guidance, 200–500 words per question)
              ├── Tags: effort | duration | cost | roi_horizon | tier | regulator_pressure | leadership_traits
              ├── Related questions (many-to-many self-referential)
              ├── Related templates (many-to-many)
              ├── Related lessons (many-to-many)
              └── Related courses (many-to-many)
```

### Why domains matter

Domains are the top-level navigation for the practitioner who knows their problem area ("I work in cyber risk — show me that domain"). Questions within a domain should be visible as a flat list, then filterable by tag.

### The seven tags — recommended implementation

| Tag | Type | Values | Query pattern |
|---|---|---|---|
| Effort | Ordinal enum | Low / Medium / High | Filter, sort |
| Duration | Range or enum | Days / Weeks / Months / Quarters | Filter |
| Cost | Ordinal enum | Free / Low / Medium / High | Filter |
| ROI horizon | Ordinal enum | Quick / Mid / Strategic — **[UPDATED]** supersedes the Immediate/Short/Medium/Long placeholder; see 3.1 | Sort |
| Tier | Multi-select enum | Strategic / Operational / Project | Filter |
| Regulator pressure | Boolean or scale | Low / Medium / High (or by regulator name) | Filter |
| Leadership traits | Multi-select enum | (list of traits) | Filter |

**[RECOMMENDATION]** All seven tags should be filterable simultaneously. The UI should show the count of questions matching the current filter set in real-time as the user adjusts filters. This is the "configured search experience" described in the brief. It requires a PostgreSQL query with `WHERE` clauses on indexed columns — not full-text search. This is straightforward but must be designed before coding begins.

**[WARNING]** The current brief does not specify the exact values for each tag. Before any database schema is committed, the owner must provide the authoritative value lists for all seven tags. Changing these after content is loaded is a migration, not a configuration.

## 3.3 The discovery query UX

**[FINDING]** Research into faceted search UX (patterns used by major e-commerce and content platforms) establishes that:
- Filters should appear as a persistent sidebar (desktop) or a modal/drawer (mobile)
- Active filter count should be visible in a persistent badge
- "Clear all filters" should be a single tap away
- Results should update without a page reload (client-side state management with server-side data)
- Zero-result states should be handled gracefully: "No questions match all filters — try removing Regulator Pressure"

**[RECOMMENDATION]** The question discovery interface is the single most important UX surface in the product. Invest disproportionately in it. The goal is: a practitioner can arrive with a specific constraint ("I have two weeks and no budget") and receive a ranked list of relevant questions within 30 seconds of landing, without creating an account.

**[INFERENCE]** Allowing access to the question list (with tags visible) without requiring login — while gating the full question body and related templates behind a purchase — creates a powerful free-to-preview experience that demonstrates the taxonomy's value and reduces bounce.

## 3.4 Content model extensibility

**[RECOMMENDATION]** The schema must include a `Section` entity at the top of the hierarchy, with each section having its own author, domain set, and question set. This is the architectural mechanism that allows a second book, second author, and second audience without a schema change. Every piece of content should be scoped to a section. Every product should be purchasable at the section level or question level. If the schema treats the current book as the implicit root, adding a second book requires a migration.

## 3.5 Scoring and ranking for partial matches `[AUDIT v1.1]`

**[WARNING]** The brief's headline query — *"What can I fix in a fortnight, cheaply, that my regulator cares about?"* — implies a **ranked answer**, not a strict filter. A strict `WHERE effort='low' AND duration='weeks' AND regulator_pressure='high'` query has two failure modes that a pure faceted-filter UI (as specified in 3.2/3.3) does not solve on its own:

1. **Zero results.** If no question satisfies all constraints simultaneously (likely, with only ~20 questions per domain), the user hits a dead end exactly at the moment the product is supposed to prove its value.
2. **No sense of "closest fit."** A question that is low-effort, two-and-a-half-weeks, and medium regulator pressure is a near-miss the user would want to see — a strict filter hides it entirely.

**[RECOMMENDATION]** Layer a lightweight scoring model on top of the filter, rather than relying on filtering alone:

- Treat each ordinal tag (effort, duration, cost, ROI horizon, regulator pressure) as a numeric scale internally (e.g. effort: low=1/medium=2/high=3; ROI horizon: quick=1/mid=2/strategic=3).
- When a user sets filter constraints, compute a per-question **match score** = count of exactly-satisfied constraints, with partial credit for adjacent values (e.g. "duration: weeks" requested, question tagged "days" scores higher partial credit than one tagged "quarters").
- Sort results by match score descending; visually distinguish "exact matches" from "close matches" (e.g. a divider row: "3 exact matches" / "5 close matches — relax one filter to see these").
- This requires no additional infrastructure beyond the Part 5/Appendix C schema already proposed — it is a query/application-layer concern, not a new table — but it **is** a specific UI and query pattern that must be designed before Week 2, not discovered during it.

**[WARNING]** Do not build this as a black-box "AI ranking" feature. A transparent, explainable scoring rule (users can see *why* a question ranked where it did) is more trustworthy for a professional audience than an opaque relevance score, and is dramatically cheaper to build and debug in four weeks.

---

# PART FOUR — MONETISATION RESEARCH

## 4.1 Revenue model options assessed

### Individual one-time purchases (per product)

**Assessment:** Highest fit for v1. Zero recurring-billing complexity. Stripe Checkout handles the full flow. A learner buys access to a course, a template, or a bundle and owns it. No subscription to cancel, no renewal anxiety.

- Complexity: Low
- Revenue potential: Moderate (each purchase is a discrete event; no compounding MRR)
- User friction: Low (pay once, access immediately)
- v1 fit: **Must have**

### Paid templates (standalone)

**Assessment:** Extremely high fit. Templates are a low-friction, high-trust first purchase. A $49–$99 template is an impulse buy for someone who needs that artefact today. Templates also serve consultants who buy multiple. Template sales can fund the platform before course revenue materialises.

- v1 fit: **Must have** — these should be the first products to exist

### Course access (one-time)

**Assessment:** High fit. A standalone course purchase ($79–$199) with clear scope (e.g., "Third-Party Risk Fundamentals — 4 modules, 12 lessons, 3 templates included") is the standard professional learning purchase.

- v1 fit: **Must have** — at least one course with real content

### Bundles (course + templates)

**Assessment:** Moderate fit for v1. A bundle priced at a visible discount versus buying separately ($149 vs $79 + $99 = $178) increases average order value. Easy to implement once individual products exist.

- v1 fit: **Should have** — one bundle is achievable if individual products are built first

### Free lead magnet (email capture)

**Assessment:** Essential. A free tier that earns an email address is how discovery converts to relationship. Options: one domain's question list freely browsable (body text gated); a free sample template; a PDF guide. Must require email registration.

**[OWNER OVERRIDE, 2026-08-11]** Implemented differently, and more generously, than any option above: *every* published question's full guidance body is public and free (`GET /questions/{slug}` always returns `body`, no server-side purchase check on it at all) — the email address is earned by a client-side blur + capture form over roughly the back half of the text (`EmailGatedBody.tsx`), a conversion device, not an access control. The corresponding tightening: video and lesson content are *never* free, no sample-lesson exception (see the 8.3 and 13.4 annotations below) — the free/paid line in this product is drawn at content type (question vs. lesson/template), not per-item. See `docs/handover.md` §1.

- v1 fit: **Must have** — non-negotiable for list building

### Subscriptions / memberships

**Assessment:** Wrong for v1. Stripe Billing subscriptions add complexity (proration, cancellation, dunning, failed payment recovery). The audience is comfortable with one-time professional purchases. Subscriptions are a v2 consideration once the content volume justifies them.

- v1 fit: **Later**

### Team / seat licenses

**Assessment:** Significant revenue potential but requires a fundamentally different purchase flow (organisation account, seat management, invoice-based payment). Not achievable in four weeks.

- v1 fit: **Later** — but the data model should support it (user → organisation relationship)

### AI-powered personalised packs

**Assessment:** Strong post-v1 opportunity. An agentic flow that generates a tailored learning pack from a user's role, sector, and current challenge could command $49–$149 as a one-off premium. Requires the content model to be stable first.

- v1 fit: **Do not build** — but design the data model to enable it

## 4.2 Recommended v1 pricing

**[INFERENCE]** Based on comparable professional content pricing (GARP, IRM, PMI courses; O'Reilly subscriptions; consulting deliverables):

| Product | Suggested range | Notes |
|---|---|---|
| Individual template | $49–$99 | Consultant-friendly pricing; below expense threshold |
| Short course access | $79–$149 | Single domain, 3–6 modules |
| Full course + templates bundle | $149–$249 | Best value positioning |
| Free entry point | $0, email required | One domain browsable; one sample template |

**[OPEN DECISION]** Actual pricing is a business decision for the owner. The ranges above are research-informed estimates. The author should set pricing based on their knowledge of what practitioners pay for comparable consulting and training.

### Cross-check against digital-template marketplace data `[AUDIT v1.1]`

**[FINDING]** Analysis of public creator-economy revenue data (146,271 tracked Gumroad products, spanning categories) found that the **$30–49 price band converts approximately 28% better than pricing under $10** — low prices read as disposable/low-trust for a professional buyer, while $30–49 signals quality without triggering price resistance. The same dataset shows "Business & Money" category products averaging $10,267 per product (driven by a small number of high-ticket B2B sales) and "Writing & Publishing" averaging $15,750 with the lowest competition of any category examined. Two further findings from the same analysis are directly relevant to the product page (Part Eight): listings with 5,000+ character descriptions earned roughly 20× more than listings under 500 characters, and listings with 2–3 cover images earned roughly 15× more than listings with none — both point toward investing real effort in template/course product-page copy and imagery rather than treating them as a formality.

### Marketplace vs. direct-platform fee structures `[CONSOLIDATED v2.0]`

**[FINDING]** For context on the "build vs. list on a marketplace" decision (already resolved in favour of build, per the Executive Summary), digital-product marketplace fee models vary widely:

| Platform | Fee model | Effective fee | Best fit |
|---|---|---|---|
| Gumroad | 10% + 2.9% processing | ~13.2% | Audience-first creators, no listing fee |
| Whop | 3% flat | ~3% | Community-driven sellers |
| Etsy | 6.5% + $0.20/listing + 3% + $0.25 | Higher, marketplace-dependent | Sellers relying on marketplace discovery traffic |
| Payhip | 5% (free plan) / 0% at $29/month | 5% or 0% | Growing creators |
| **This platform (direct, Stripe)** | ~1.7–3.5% + $0.30 (Part 6.4) | Lowest of all options | Full control, already has (or is building) discovery via the taxonomy itself |

**[INFERENCE]** Etsy-style marketplaces trade a materially higher fee for built-in buyer traffic (Etsy reports roughly 4× the buyer traffic of Gumroad); Gumroad-style direct platforms keep more margin but require the seller to bring their own audience. Since this platform's differentiator is a proprietary taxonomy that cannot be listed on a third-party marketplace anyway (3.1), the "build direct" decision is not really a fee-optimisation choice — it is forced by the product itself. The fee comparison mainly confirms that Stripe's ~2–4% is inexpensive relative to any marketplace alternative, not that a marketplace was ever a live option.

**[INFERENCE]** This partially conflicts with, and partially supports, this document's $49–99 individual-template recommendation in the table above:
- It **supports** pricing template products above $30 rather than near $10–20 — low pricing would read as low-trust for this audience, consistent with Part 2's finding that anonymous/generic-looking content is a trust-killer.
- It **does not directly validate** the $49–99 range specifically, since Gumroad's data mixes consumer and B2B creators across all niches, not risk-management professional content specifically. The $10,267 B2B average suggests professional/business buyers tolerate materially higher prices than the general Gumroad population when the artefact is credibly tied to a real business outcome.

**[RECOMMENDATION]** Treat $49–99 as a reasonable **starting** range for individual templates, not a proven optimum. Once 10–20 real purchases have occurred, review actual conversion-by-price data in PostHog/Stripe rather than continuing to rely on marketplace-wide benchmarks from an unrelated audience. Do not delay launch to "get pricing right" — this is a post-launch iteration, not a pre-launch blocker.

---

# PART FIVE — LEARNING PLATFORM ARCHITECTURE

## 5.1 Content entity model

```
SECTION          One per book/subject. Author-scoped.
  AUTHOR         Named, credentialled individual. Linked to sections.
  DOMAIN         5 domains per section. Top-level categorisation.
    QUESTION     100 per section. The core content unit.

COURSE           Purchasable learning experience. Belongs to a section.
  MODULE         Ordered group of lessons within a course.
    LESSON       Atomic learning unit. Has a type.
      VIDEO      Mux asset ID + signed playback. Has captions.
      READING    Rich text content.
      DOWNLOAD   Template or artefact. R2 object key.

TEMPLATE         Standalone purchasable artefact. R2 object key.
```

## 5.2 Commerce entity model

```
PRODUCT          A purchasable item: course, template, or bundle.
  PRODUCT_TYPE   Enum: course | template | bundle | free
  PRICE          Amount, currency, Stripe Price ID
  
ORDER            A completed Stripe Checkout session.
  ORDER_ITEM     Line item linking ORDER → PRODUCT
  
ENTITLEMENT      Links USER → PRODUCT (the access record).
                 Created by webhook on Stripe payment_intent.succeeded.
                 This is the authoritative gating record.
```

## 5.3 Progress entity model

```
PROGRESS         Links USER → LESSON, with completion boolean and timestamp.
COURSE_PROGRESS  Derived: % of lessons in a course marked complete.
```

## 5.4 User entity model

```
USER             Auth record (Supabase Auth). Name, email.
  ORGANISATION   Optional. For future team licensing.
  ROLE           Enum: learner | admin. Row-level security enforced in Supabase.
```

## 5.5 Key relationships (ERD summary)

```
USER ──< ENTITLEMENT >── PRODUCT
USER ──< PROGRESS >── LESSON
USER ──< ORDER >── ORDER_ITEM >── PRODUCT

SECTION ──< DOMAIN ──< QUESTION
SECTION ──< COURSE ──< MODULE ──< LESSON
SECTION ──< TEMPLATE

QUESTION >──< QUESTION (self-referential, related questions)
QUESTION >──< TEMPLATE (question-to-template mapping)
QUESTION >──< LESSON (question-to-lesson mapping)

PRODUCT ──< BUNDLE_ITEM >── PRODUCT (bundles)
```

## 5.6 The entitlement model — how gating works

**[RECOMMENDATION]** The `ENTITLEMENT` table is the single source of truth for access. Every request for a gated resource must check this table server-side. The flow:

1. User attempts to access a lesson, video, or download
2. Server middleware checks: does `ENTITLEMENT` contain `(user_id, product_id)` where `product_id` grants access to this resource?
3. If yes: serve the resource (or generate a signed URL)
4. If no: redirect to the product page

**[WARNING]** Client-side-only checks (JavaScript checks in the browser) provide zero security. A user who inspects the source code or disables JavaScript bypasses them. Every gated resource endpoint must perform the entitlement check server-side.

**`[STACK PIVOT v2.1]`** With the React/FastAPI split, "server-side" specifically means: a **FastAPI path operation function**, guarded by a dependency that (a) validates the Supabase-issued JWT from the request's `Authorization: Bearer` header, then (b) queries the `entitlements` table for that user_id + product_id, *before* the endpoint does anything else — including before it calls Mux to generate a signed playback JWT, or R2 to generate a presigned download URL. React never sees, and never needs to see, the `entitlements` table directly; it only ever calls the FastAPI endpoint and renders whatever comes back (a signed URL, or a 403). A React-side "does the user look entitled" check is permitted only as a UX convenience (e.g. hiding the "Play" button before the API call even happens) — it is never a substitute for the FastAPI check.

---

# PART SIX — TECHNOLOGY RESEARCH

## 6.1 Frontend — original recommendation: Next.js 15 (App Router); **superseded `[STACK PIVOT v2.1]` by React (Vite) + FastAPI**

**[FINDING — original research, retained for the reasoning trail]** Next.js remains the dominant React framework for content + commerce SaaS platforms. The App Router (introduced in Next.js 13, mature by Next.js 15) enables server components that can perform database queries and entitlement checks before rendering — eliminating the client-side flicker pattern that makes gating vulnerable.

**Why Next.js was originally recommended:**
- Server components allow entitlement checks with no client-side exposure
- File-system routing is fast to build against
- API routes handle Stripe webhooks, Mux webhook processing, and signed URL generation
- Vercel deployment is first-class, with zero-configuration for Edge Middleware
- Ecosystem maturity: Mux, Stripe, Supabase, and Resend all publish official Next.js examples

**Alternatives originally considered:**

| Framework | Assessment |
|---|---|
| Remix | Excellent server-first model; smaller ecosystem; slightly more setup time than Next.js |
| SvelteKit | Lighter, excellent DX, but smaller ecosystem for the required integrations |
| Astro | Better for content-heavy/static; not suited for authenticated member areas |
| T3 Stack (Next.js + tRPC + Prisma) | Solid foundation; tRPC adds type safety at the cost of onboarding time for a 4-week build |

### `[STACK PIVOT v2.1]` Owner-directed decision: React + FastAPI

**[RECOMMENDATION]** The owner has directed a decoupled stack: **React (Vite, TypeScript) for the frontend, FastAPI (Python) for the backend/API**, rather than Next.js's single integrated framework.

**What is lost by moving off Next.js:**
- No server-component pattern that makes "check entitlement before rendering" the framework default — every gated route/component in React needs an explicit client-side guard *plus* the FastAPI endpoint it calls doing the real check. The React-side guard is a UX nicety; the FastAPI-side check is the actual control.
- Two deployable services instead of one — CORS configuration, two sets of environment variables, one more service in the dependency chain (Appendix M R3).
- No first-party Vercel Edge Middleware for auth redirects; the equivalent becomes a React-side effect/guard, strictly a UX convenience layer, never a security boundary.

**What is unaffected:** every backend service choice (6.2–6.10) and the entire content model, security model (Part Seven), and monetisation research are unchanged. FastAPI has mature Python SDKs for Stripe, Mux, and Resend, and works with Cloudflare R2 via any S3-compatible client (`boto3`). Supabase is fully usable from FastAPI: FastAPI validates Supabase-issued JWTs (using Supabase's JWT secret/JWKS endpoint) on every request rather than relying on Supabase's Next.js SSR helper package.

**Frontend tooling:** Vite + React + TypeScript (not Create React App, deprecated).

**[RECOMMENDATION]** Use TypeScript, not plain JavaScript. The seven-tag taxonomy (3.2), the Stripe/webhook payload shapes, and the FastAPI response contracts are exactly the kind of thing a type checker catches at build time that a four-week timeline cannot afford to catch at runtime.

## 6.2 Database — Recommendation: Supabase (PostgreSQL)

**[FINDING]** Supabase provides managed PostgreSQL with Row-Level Security (RLS), a connection pooler (Supavisor), a dashboard for content management during development, built-in auth, edge functions, and file storage — all in a single service. The free tier includes 500 MB database, 1 GB file storage, and 2 projects; the Pro plan costs $25/month and increases to 8 GB database.

**Why Supabase over alternatives:**

| Service | Assessment |
|---|---|
| **Supabase** | PostgreSQL + auth + storage + dashboard. Highest feature density per service. RLS enforces access at the database layer. |
| Neon | Excellent serverless PostgreSQL with branching. Pure database — no auth or storage bundled. Good choice if Clerk is used for auth and R2 for storage. |
| PlanetScale | Removed free tier (2024). Now positioned enterprise. Not suitable for v1. |
| Railway (PostgreSQL) | Managed PostgreSQL from $5/month. Simple but no bundled auth. |

**[RECOMMENDATION]** Supabase. It consolidates three services (auth, database, file storage) into one, which is the right trade for a four-week build. Use Row-Level Security for all tables from day one. A Supabase project takes under an hour to configure correctly.

**[WARNING]** Supabase's file storage (backed by S3-compatible storage) is suitable for small files. For large video files, use Mux. For large downloadable templates (PDFs, spreadsheets), Cloudflare R2 is cheaper at scale due to zero egress fees. Do not use Supabase Storage for video.

**[WARNING — AUDIT v1.1]** Free-tier Supabase projects **pause automatically after 7 days of inactivity**. This is an operational risk during the build itself, not just at launch: a project left untouched over a weekend, or during a gap between Week 1 and Week 2 work, can pause and silently break local development or a staging deploy until manually resumed. Either upgrade to Pro ($25/month) before Week 1 ends, or set a recurring reminder to touch the project at least weekly. (Source: Supabase pricing documentation, verified August 2026.)

## 6.3 Authentication — Recommendation: Supabase Auth

**[FINDING]** Because Supabase is already recommended for the database, using Supabase Auth eliminates a separate service dependency. Supabase Auth supports email/password, magic-link email, and social OAuth providers. It integrates natively with RLS, so a `user_id` from the auth session automatically gates database queries.

**Alternatives:**

| Service | Assessment |
|---|---|
| **Supabase Auth** | Free. Native RLS integration. Email/password + magic link. No per-MAU fee. |
| Clerk | Excellent Next.js integration with pre-built components. **[RESOLVED — AUDIT v1.1]** Free tier was raised to 50,000 MRU (Monthly *Retained* Users, not MAU — a user only counts once they return 24+ hours after signup, so this is a narrower and more generous unit than it first appears) on 5 February 2026. Pro is $20/month billed annually, includes 50K MRUs + 1 Enterprise SSO connection, with published overage rates beyond that. Adds a third service and $20+/month. Justified only if the team wants Clerk's polished pre-built UI components over Supabase Auth's. (Source: clerk.com/pricing, verified August 2026.) |
| Auth.js (formerly NextAuth) | Open-source, free, self-managed. No user management dashboard. More setup time than Supabase Auth. |
| Better Auth | Auth.js successor (Auth.js team joined Better Auth, September 2025). Self-hosted, zero cost, full control. Higher setup overhead. |

**[RECOMMENDATION]** Supabase Auth for v1. If the team finds Supabase Auth's pre-built UI components insufficient and wants Clerk's polished components, Clerk is a reasonable upgrade — but add $25/month and account for the session/RLS bridging work required (Supabase + Clerk is doable but requires a Clerk JWT template configured to work with Supabase's JWT verification).

## 6.4 Payments — Recommendation: Stripe

**[FINDING]** Stripe is the clear choice. It is the only hosted checkout provider that satisfies all brief requirements: no card data handling, PCI compliance by default, excellent webhook infrastructure, and a Stripe Dashboard that functions as a reconcilable purchase record.

**Pricing — [CORRECTED, AUDIT v1.1]:** The figures below were incorrectly sourced from Stripe's **US** pricing page in the original draft; the platform's contracting entity and audience are Australian (per Part Eleven), so the applicable rates are Stripe's **Australian** pricing, verified directly against stripe.com/au/pricing in August 2026:

- **Domestic card (AUD, issued in Australia):** 1.7% + A$0.30 per transaction (falling further from 1 October 2026 per Stripe's published schedule)
- **International card:** 3.5% + A$0.30 per transaction
- **Currency conversion** (customer paying in a currency other than the account's settlement currency): +2%
- **Stripe Tax:** two options — "Tax Basic" pay-as-you-go at 0.5% per transaction (no-code) or A$0.75/transaction (API integration), versus "Tax Complete" at a flat A$140/month on a 1-year contract. For v1 volume, Tax Basic pay-as-you-go is the only sensible choice; the A$140/month plan is not justified until GST/VAT volume is material.
- For a $99 domestic-card purchase: approximately $2.08 in processing fees (excluding Tax add-on).

**[WARNING — AUDIT v1.1]** All prior cost tables in this document that cite "2.9% + $0.30" (the US figure) should be read as 1.7% + A$0.30 domestic / 3.5% + A$0.30 international for this platform, unless the owner decides to incorporate as a US entity — which is itself one of the open decisions in Appendix J (contracting entity) and should be resolved before the Stripe account is created, since account country is not trivially changed after transactions have processed.

**Stripe Billing** (for future subscriptions) adds 0.7% of billing volume — unverified for the AU account in this pass; re-confirm at the point subscriptions are actually built (v2).

**[RECOMMENDATION]** Use Stripe Checkout (hosted) for all purchases. Never build a custom payment form. Stripe Checkout is PCI-compliant, mobile-optimised, and continuously A/B-tested by Stripe for conversion.

**Stripe webhook setup is critical:** The `payment_intent.succeeded` (or `checkout.session.completed`) webhook is what creates the `ENTITLEMENT` record. This must be tested with real webhooks (using Stripe CLI for local testing) before Week 1 is declared done. A failed webhook silently means a user paid but received no access — the worst possible failure mode.

**Webhook security:** Stripe signs all webhooks with a secret. Verify the `stripe-signature` header on every incoming webhook using `stripe.webhooks.constructEvent()`. Never process unsigned webhook payloads.

## 6.5 Video — Recommendation: Mux

**[FINDING]** Mux provides:
- Signed JWT playback URLs (time-limited, user-specific)
- Domain and referrer restrictions
- Automatic captions in 22 languages (free)
- Adaptive bitrate streaming
- Built-in quality analytics
- A `<MuxPlayer>` React component (works identically whether the app is Next.js or a Vite SPA) and a Python SDK (`mux-python`) for server-side signed-JWT generation from FastAPI `[UPDATED, STACK PIVOT v2.1]`

**Pricing (from mux.com/pricing, current as of August 2026):**
- Input: Free
- Storage: $0.0024/minute (720p)
- Delivery: $0.0008/minute after the first 100,000 free delivery minutes/month
- On-demand captions: Free
- Signed URLs (Smart security): Free
- DRM: $100/month + $0.003/play (not required for this use case)
- Launch pre-pay plan: $20/month for $100 credit

**For v1:** With a small content library and limited early traffic, Mux will likely cost under $20/month. The free delivery minute allowance (100 K minutes/month) is generous for an early-stage platform.

**[RECOMMENDATION]** Mux with signed JWT playback. Generate short-lived tokens (15–30 minutes) server-side, per authenticated and entitled user, per lesson view. Never expose a Mux playback URL that is valid for more than the current session.

**[FINDING — AUDIT v1.1, sharpening the "why not Vimeo" rationale]** **Wistia and Vimeo's self-serve plans protect the *page* the video sits on, not the video stream itself.** Once an authenticated user's browser loads the player, the underlying video is a standard HTTP-accessible file with no per-user signing — "private" or "password-protected" on these platforms controls who can *navigate to* the video, not who can *extract* it. Vimeo's actual stream-level protection (domain-restricted, tokenised delivery closer to what Mux/Gumlet/VdoCipher provide) is gated behind Enterprise contracts (~$6,000/year base). This is the concrete, sourced reason "paid video that anyone can download is not a paid product" (per the brief's non-negotiables) rules out Vimeo/Wistia self-serve plans for this build, not just a generic preference for Mux.

**Alternative:** Cloudflare Stream is a legitimate alternative, especially if the team is already using Cloudflare for R2. It charges per minute stored and delivered. Mux's Python SDK and React player component are both well-documented regardless of frontend/backend framework, which keeps it the stronger choice under the React+FastAPI stack `[UPDATED, STACK PIVOT v2.1]` for the same reason it was preferred under Next.js.

**Alternative:** Vimeo Pro ($20/month) has per-seat storage limits, page-level (not stream-level) protection on self-serve plans, and less developer-friendly access control. Not recommended for a gated content model.

**Alternative:** Gumlet and VdoCipher both offer genuine multi-DRM (Widevine + FairPlay) and dynamic watermarking on paid plans, at lower cost than Mux's DRM add-on. Worth a second look post-v1 if screen-recording/leakage of premium video content becomes a demonstrated problem — not justified for v1 given the brief does not require DRM and Mux's signed-URL model is proportionate to the threat (see Part Seven, 7.1).

## 6.6 File Storage — Recommendation: Cloudflare R2

**[FINDING]** Cloudflare R2 is an S3-compatible object storage service with zero egress fees. Competing services (AWS S3, Google Cloud Storage) charge $0.09/GB for data transfer out.

**Pricing (from cloudflare.com, current):**
- Storage: $0.015/GB-month
- Class A operations (writes): $4.50 per million
- Class B operations (reads): $0.36 per million
- Egress: $0.00
- Free tier: 10 GB storage, 1 million Class A ops, 10 million Class B ops per month

**For v1:** A library of 50–100 PDF/Excel templates averaging 2 MB each is under 200 MB storage — effectively free.

**Presigned URLs:** R2 supports presigned URLs with TTL (time-to-live). The recommended pattern: when an entitled user requests a download, the server generates a presigned URL valid for 60 seconds. The user's browser fetches the file directly from R2. The presigned URL cannot be reused, shared, or cached. This is the correct gating mechanism for paid downloads.

**[RECOMMENDATION]** Cloudflare R2 for all file downloads (templates, supplementary PDFs). If the team is not already on Cloudflare, this is a five-minute setup with the Cloudflare dashboard.

## 6.7 Transactional Email — Recommendation: Resend

**[FINDING]** Resend is the developer-preferred transactional email service in 2025–2026. It was originally recommended partly because it was built by the creator of React Email, meaning templates are written as React components — a benefit that assumed a Next.js/Node backend able to render JSX server-side.

**`[UPDATED, STACK PIVOT v2.1]`** With FastAPI (Python) as the backend, React Email templates cannot be rendered directly at send-time — there is no JS runtime inside the Python process calling Resend. **Recommended for v1:** plain HTML/Jinja2 templates rendered in Python, sent via Resend's Python SDK (`resend-python`) — simplest, no build-step dependency; Resend accepts raw HTML regardless of how it was generated. (Alternative: pre-compile React Email templates to static HTML as a one-off Node build step — preserves the original templating DX but adds a build dependency the FastAPI service doesn't otherwise need.)

**Pricing:** Free tier is 3,000 emails/month (sufficient for all of v1 and well into early growth). Paid plans start at approximately $20/month for higher volumes.

**Alternatives:**
- **Postmark:** Best-in-class deliverability (transactional-only infrastructure). $15/month minimum. Justified if deliverability issues arise, but unlikely for a new platform.
- **Amazon SES:** Cheapest at scale ($0.10/1,000 emails) but requires significant infrastructure setup and DKIM/SPF configuration from scratch.
- **SendGrid:** Retired its free plan in 2025. No longer suitable for a v1 with no existing email volume.

**[RECOMMENDATION]** Resend, using plain HTML/Jinja2 templates rendered in Python. Free tier is sufficient for v1. SPF, DKIM, and DMARC must be configured on the sending domain — Resend provides step-by-step guides for this.

**Required email types for v1:**
1. Welcome email (on sign-up)
2. Purchase receipt (triggered by Stripe webhook)
3. Content access confirmation (post-purchase, with login link)
4. Password reset
5. Magic link sign-in (if enabled)

## 6.8 Admin / CMS — Recommendation: Custom admin, protected React routes calling FastAPI `[UPDATED, STACK PIVOT v2.1]`

**[FINDING]** The content model for this platform (questions + 7 tags + lessons + templates + products + entitlements + users) is specific enough that a generic headless CMS (Sanity, Contentful, Strapi) would require significant custom configuration to match it — configuration that takes nearly as long as building a custom admin.

**Headless CMS options assessed:**

| Option | Assessment |
|---|---|
| **Sanity** | Excellent editorial UX; real-time collaboration; GROQ query language; $0 for 3 users/month free. Requires mapping the entire content model to Sanity's schema — feasible but ~2 days of setup. Framework-agnostic — unaffected by the stack pivot. |
| **Payload CMS v3** | TypeScript-native, runs inside Next.js App Router specifically. `[UPDATED]` No longer applicable — Payload requires a Next.js host and cannot run inside a Python backend. Removed from consideration under the current stack. |
| **Strapi** | Open-source, self-hosted (Node.js). Technically usable alongside a Python backend as an independent third service, but that's a third deployable service on top of the two the pivot already added — more DevOps overhead than under the original single-service plan. |
| **Custom admin (React + FastAPI)** | Fastest to build for this specific model. Admin pages are React routes, protected by a Supabase-session guard on the frontend and a role check on every FastAPI call (the FastAPI check is the actual control, per 5.6). CRUD forms submitting to FastAPI endpoints. |

**[RECOMMENDATION]** For v1: build a minimal custom admin as a protected route section of the React application, backed entirely by FastAPI endpoints for reads and writes. This is achievable because:
- The entities are well-defined (questions, lessons, templates, products)
- Supabase provides a dashboard that can handle bulk data entry during the build
- The admin section only needs to support: add/edit content, upload videos (via Mux, through a FastAPI endpoint), upload files (to R2, through a FastAPI endpoint), publish/unpublish products

The Supabase Studio (the Supabase dashboard) can serve as a secondary admin for power users who need to run queries or handle edge cases. Document this in the handover pack.

**[WARNING]** "Non-technical person adds a course" is achievable in the custom admin; "non-technical person adds a course without calling you" requires the admin to handle errors gracefully, have inline help text, and have been tested by someone who is not the developer. Allocate real time in Week 3 for this test and for fixing the failures.

**Post-v1:** Sanity is the strongest candidate for a full editorial upgrade. The free tier supports 3 users; Growth is $15/user/month. A Sanity Studio could be added in v2 without disrupting the core architecture.

## 6.9 Deployment — Recommendation: Vercel (frontend) + Render (backend) `[UPDATED, STACK PIVOT v2.1]`

**[FINDING]** With the decoupled React/FastAPI stack, deployment splits into two services rather than one:

**Frontend (React/Vite build):** Vercel remains a reasonable choice — it is not Next.js-exclusive and hosts static/SPA builds from any framework, including Vite. The Pro plan costs $20/seat/month, includes a $20 monthly usage credit; overage $0.15/GB after 1 TB. Hobby (free) prohibits commercial use, so Pro is still required.

**Backend (FastAPI):** Render is the recommended host. Render's free web-service tier spins down after 15 minutes idle, causing a 30–60 second cold start on the next request — **this directly conflicts with a stranger completing a live checkout that calls the FastAPI webhook/entitlement endpoints mid-flow**, so the free tier is not appropriate once real transactions are being tested. Render's paid Starter tier (~$7/month) removes the cold-start behaviour.

**[RECOMMENDATION]** Vercel (Pro, $20/month) for the frontend; Render (Starter, ~$7/month) for FastAPI from the point real checkout testing begins — budget both from Week 1.

**[WARNING — NEW, STACK PIVOT v2.1]** Two hosts means a new failure mode the single-host architecture didn't have: **CORS misconfiguration.** FastAPI must explicitly allow the deployed Vercel frontend's origin (and `localhost` during development); a missed or wrong CORS origin fails silently in a way that looks like "the API is down."

**Alternative:** Self-hosted on a VPS (Hetzner, DigitalOcean, Vultr) via Coolify or a similar PaaS, for either or both services. Cheaper at scale, but adds DevOps overhead not appropriate for a four-week build.

**Alternative considered and not recommended:** Vercel's Python serverless functions could host FastAPI on the same platform as the frontend, avoiding a second host — not chosen because Vercel's Python runtime is materially less mature than its Next.js/Node support.

## 6.10 Analytics — Recommendation: PostHog (product) + Plausible (marketing)

**[FINDING]** The brief requires analytics covering: page views, content engagement, search/filter usage, funnel drop-off, purchases, course starts, course completion, downloads, and video engagement.

These require two different analytics tools:

| Tool | Purpose | Pricing |
|---|---|---|
| **PostHog** | Product analytics: events (lesson started, video played, template downloaded, purchase completed, filter applied), funnels, session replay | Free for 1 M events/month |
| **Plausible** | Web/marketing analytics: page views, referrers, traffic sources, bounce rate | ~$9/month (100 K pageviews) |

**[RECOMMENDATION]** PostHog for all in-product event tracking. It is cookieless by default, GDPR-compliant, and free for an early-stage platform. Plausible for the public marketing pages where simple, privacy-first traffic analytics are sufficient. Both can run concurrently with minimal overhead.

**[WARNING]** PostHog session replay captures user interactions. Do not record checkout pages, password fields, or any screen containing sensitive data. Configure PostHog to mask or exclude these routes explicitly.

---

# PART SEVEN — SECURITY RESEARCH

## 7.1 The gating model — how paid content is genuinely inaccessible

**The threat model:** A user who has not paid attempts to access paid video, paid downloads, or paid reading content by:
- Directly navigating to a lesson URL while logged out
- Sharing a lesson URL with a non-paying friend
- Opening browser DevTools and copying a video URL from the network tab
- Calling the API directly with their own credentials
- Attempting to share a presigned download URL
- Accessing content from a cached page

**For each threat:**

| Attack | Mitigation |
|---|---|
| Direct URL navigation (logged out) | React route guard redirects to sign-in for UX; the FastAPI endpoint backing the page independently checks the JWT and returns 401 regardless of what the frontend does `[UPDATED, STACK PIVOT v2.1]` |
| Sharing a lesson URL | Server component checks entitlement on render; redirects without entitlement |
| Copying video URL from network | Mux signed JWTs expire (15–30 minutes); the URL is user-specific |
| Direct API call | API routes check authentication + entitlement; return 401/403 |
| Sharing a presigned download URL | Presigned URL expires in 60 seconds; single-use semantics enforced by R2 |
| Cached page | Server-side rendering means no static cache of gated content |
| Browser extension | Cannot be fully prevented; signed URLs expire and do not play without the originating session |

**[WARNING]** DRM (Widevine/FairPlay) is the only mechanism that genuinely prevents screen recording of video. Signed URLs prevent URL sharing but not screen recording. For most professional content at this price point, signed URLs are the appropriate and proportionate control. Full DRM adds $100/month plus $0.003/play on Mux. The brief does not require DRM.

## 7.2 Authentication security

- **Passwords:** Supabase Auth handles hashing (bcrypt). Never store or log passwords.
- **Sessions:** Use Supabase's secure HTTP-only cookie session (server-side). Never store the access token in localStorage.
- **Password reset:** Implement via Supabase's built-in password reset email flow. Use a short-lived (1 hour) token.
- **Rate limiting:** Apply rate limiting to login and password-reset endpoints. `[UPDATED, STACK PIVOT v2.1]` With FastAPI as the backend, enforce this with a library such as `slowapi` at the endpoint level, rather than Vercel Edge Middleware (which only fronts the React static assets, not the FastAPI service on Render). Alternatively, use Supabase Auth's built-in rate limiting for the sign-in/sign-up calls React makes directly to Supabase.
- **MFA:** Not required for v1, but Supabase Auth supports TOTP MFA. Add as an admin option.

## 7.3 Payment security

- **Never handle card data.** Use Stripe Checkout exclusively. No custom payment forms.
- **Webhook verification:** Always verify Stripe webhook signatures using `stripe.webhooks.constructEvent()`. Reject unsigned or invalid payloads.
- **Idempotency:** Design the webhook handler to be idempotent. Stripe may deliver the same event more than once. Check for existing entitlement before creating a duplicate.
- **Secrets:** Stripe secret keys, Mux API keys, Supabase service role key, and R2 credentials must never appear in client-side code, version control, logs, or test fixtures. `[UPDATED, STACK PIVOT v2.1]` These are all *backend* secrets and belong exclusively in **Render's** environment variables (the FastAPI service), never in Vercel's — the React app should hold only the Supabase URL and anon/public key, plus the FastAPI base URL. If a secret intended for FastAPI ends up in a Vercel environment variable, it is shipped to every visitor's browser in the built JS bundle. Use a `.env.local` (frontend) and `.env` (backend) for local development, and `.gitignore` both.

## 7.4 Content security headers

`[UPDATED, STACK PIVOT v2.1]` Configuration now splits across two services:
- **Frontend (Vercel):** configure response headers via a `vercel.json` `headers` block (not `next.config.js`, which no longer exists in a Vite project) — `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.
- **Backend (FastAPI on Render):** add these as FastAPI middleware: `Content-Security-Policy` (whitelist Mux, Stripe, Resend, Cloudflare, and the Vercel frontend origin), `Strict-Transport-Security`, plus CORS restricted to the known Vercel frontend URL.

## 7.5 Data handling

- **Collect only what you need:** Name, email, purchase history. No phone numbers, physical addresses, or payment card details.
- **Row-Level Security (RLS):** Every Supabase table that contains user data must have RLS policies. A user must only be able to read their own orders, entitlements, and progress records.
- **Backups:** Supabase Pro includes daily backups with 7-day retention. Verify this is enabled and test a restore before launch.
- **Logging:** `[UPDATED, STACK PIVOT v2.1]` Log application errors (not user data) on both services — Vercel's built-in logging covers the React build/runtime; Render's built-in logging (or Sentry, which supports both) covers FastAPI, where entitlement checks and webhook handling actually run. Never log email addresses, tokens, or payment details on either side.

## 7.6 Rate limiting, dependency management, monitoring, and audit trails `[AUDIT v1.1]`

The brief's security section (§7) asks explicitly for rate limiting, logging, audit trails, dependency management, and production monitoring beyond what 7.1–7.5 above cover. Each is addressed narrowly here — deliberately scoped to what a four-week build can actually sustain, not a general enterprise security programme:

**Rate limiting — beyond auth endpoints.** 7.2 covers login/password-reset. Two additional surfaces need it:
- The question-discovery filter API (`/api/questions?...`) is public and unauthenticated by design (3.3) — without a rate limit, it is scrapeable, which undermines the "the taxonomy is the product" value proposition (Part 1, 3.1). A simple per-IP limit (e.g. 60 requests/minute via Vercel Edge Middleware or Upstash Redis) is sufficient for v1; do not over-engineer this.
- The R2 presigned-download-URL generation endpoint should be rate-limited per user (e.g. 10 downloads/hour) to blunt automated bulk-download abuse by a single paying account, even though the underlying URLs already expire in 60 seconds.

**Dependency management.** Enable GitHub Dependabot (or `npm audit` in CI) from the first commit, not retrofitted in Week 4. A four-week build accumulates dependencies fast; a known-vulnerable package discovered post-launch is a much more expensive fix than a Dependabot PR merged during the build.

**Production monitoring.** Beyond error logging (7.5), add: Vercel's built-in uptime/deployment monitoring (free, no setup cost) and a Stripe webhook failure alert (Stripe Dashboard supports email alerts on failed webhook deliveries — enable this in Week 1, since a silently failing webhook is "the worst possible failure mode" per 6.4). A dedicated APM tool (Sentry, Datadog) is a **should-have**, not a must-have, for v1 — the free tier of Sentry is sufficient if time allows in Week 4.

**Audit trails.** Two specific logs the brief's "genuinely inaccessible without paying" test implies but which are easy to omit: (1) log every successful gated-download URL generation (user_id, template_id, timestamp) — this is the record that lets the team investigate a suspected leak after the fact, and (2) log every admin action that changes published content or grants a manual entitlement (Appendix E/Appendix C already has `granted_via: manual` on the entitlement row — ensure the admin UI records *who* granted it, not just that it happened).

**Data retention.** Recommended retention periods by data type:

| Data type | Retention | Rationale |
|---|---|---|
| User account | While active + 12 months post-inactivity | Operational need |
| Purchase/order records | 7 years | Australian tax record-keeping requirement (ATO) |
| Lesson progress | While active + 90 days post-inactivity | No ongoing purpose after account lapses |
| Download/audit logs | 12 months | Balances leak-investigation utility against data minimisation |
| Backups | 30 days rolling (Supabase: 7-day PITR on Pro) | Disaster recovery only |

**[OPEN DECISION]** The 7-year order-record retention should be confirmed with the platform's accountant as part of the Appendix I tax review — it is stated here as a common Australian business record-keeping norm, not verified tax advice.

---

# PART EIGHT — UX AND INFORMATION ARCHITECTURE

## 8.1 Site structure (proposed)

```
PUBLIC (no login required)
  /                       — Marketing homepage
  /questions              — Question discovery (list + filters; body text gated [OVERRIDDEN 2026-08-11 — full body public])
  /questions/[slug]       — Question preview (tags visible; full text gated [OVERRIDDEN 2026-08-11 — full body public, email-gated client-side])
  /courses                — Course catalogue
  /courses/[slug]         — Course product page (syllabus, instructor, price)
  /templates              — Template catalogue
  /templates/[slug]       — Template product page
  /pricing                — Pricing overview
  /about                  — Author + Effective RM
  /legal/terms            — Terms of service
  /legal/privacy          — Privacy policy
  /legal/refunds          — Refund policy

AUTH
  /sign-in                — Sign in
  /sign-up                — Create account
  /forgot-password        — Password reset

MEMBER (authenticated)
  /dashboard              — Progress summary; recent activity; purchases
  /learn/[course-slug]    — Course overview + module list
  /learn/[course]/[lesson] — Lesson view (video / reading / download)
  /downloads              — All purchased templates
  /account                — Profile; purchase history; password change

ADMIN (authenticated + admin role)
  /admin                  — Dashboard
  /admin/questions        — CRUD: questions + tags
  /admin/courses          — CRUD: courses, modules, lessons
  /admin/templates        — CRUD: templates (upload to R2)
  /admin/videos           — Upload/link Mux videos
  /admin/products         — CRUD: products, pricing, bundles
  /admin/users            — View users, grants (manual entitlement override)
  /admin/orders           — Order history, reconciliation view
```

## 8.2 Primary user journey: from search to purchase

1. Practitioner searches Google for "risk appetite statement template ISO 31000"
2. Lands on `/questions?tags=effort:low,duration:weeks,regulator_pressure:high` (or a specific question page)
3. Sees the question title and tags. Body text is blurred/locked. A clear CTA: "Get full access — $99" **[OWNER OVERRIDE, 2026-08-11: body text is not purchase-gated — it's fully public, soft-gated behind an email capture instead; see Part Four §4.1 "Free lead magnet"'s annotation]**
4. Clicks CTA → `/templates/risk-appetite-template` (product page) → clear description, preview image, price, buy button
5. Click "Buy now" → Stripe Checkout (hosted)
6. Payment succeeds → Stripe webhook → entitlement created → redirect to `/downloads`
7. Receipt email arrives within 30 seconds
8. Template is available immediately for download

**Time from landing to owning the answer: target under 4 minutes, 3 steps.**

## 8.3 Primary user journey: from browse to course

1. Practitioner registers for the free entry point (one domain freely browsable)
2. Explores 20 questions in the Third-Party Risk domain; reads the guidance
3. Sees a "Related Course" card: "Third-Party Risk Foundations — 4 modules, 3 templates — $149"
4. Clicks → course product page → syllabus, author bio, sample lesson video (30 seconds, ungated) **[OWNER OVERRIDE, 2026-08-11]** No ungated sample: video and lessons are never free, no exceptions, including a marketing preview — a deliberate, explicit reversal of this step and of `DESIGN.md` §23.3's "free preview lesson is not optional" recommendation. A `Lesson.is_free_preview` bypass was built to spec, then the column was dropped the same day on direct owner instruction (migration `005`) so it can't be silently re-enabled later. The syllabus itself (module/lesson titles, types, durations) stays fully visible pre-purchase — only the content behind each lesson is gated.
5. Buys → checkout → entitlement → redirect to `/learn/third-party-risk`
6. Progresses through modules; resume tracking persists across sessions

## 8.4 Mobile-first considerations

**[FINDING]** Professional audiences increasingly discover and purchase content on mobile. The checkout flow (Stripe Checkout) is already mobile-optimised. The video player (`<MuxPlayer>`) is responsive by default. The areas requiring explicit mobile design:

- The filter sidebar on the question discovery page (should collapse to a bottom drawer or modal on mobile)
- The lesson layout (video should be full-width on mobile; reading content should be adequately padded)
- The dashboard (simple list layout; no horizontal scroll)
- The checkout redirect (confirm the Stripe-hosted page renders correctly on iPhone Safari)

---

# PART NINE — AI OPPORTUNITIES

## 9.1 Assessment framework

AI features are assessed against: user value, technical complexity, accuracy risk, cost, and v1 suitability.

| Feature | Value | Complexity | Accuracy risk | Cost | v1? |
|---|---|---|---|---|---|
| Natural language question matching | High | Medium | Medium | Low | Later |
| Personalised learning path | High | High | Medium | Low | Later |
| "Adapt this to my organisation" | Very high | Medium | High | Medium | Later |
| AI-assisted admin (tag suggestions) | Medium | Low | Low | Low | Should have |
| Semantic search over questions | High | Low | Low | Low | Should have |
| Chatbot / Q&A on content | Medium | Medium | High | Medium | Do not build v1 |
| Agentic pack assembly | Very high | Very high | Medium | Medium | Post-v1 |

## 9.2 Recommendations

**Should have for v1 (with caveats):**

**Semantic search over questions:** Using `pgvector` (PostgreSQL extension, supported by Supabase) to embed question titles and bodies and perform similarity search. A user types "what do I do when my third-party supplier has a data breach?" and receives semantically relevant questions rather than keyword-matched results. This is achievable with OpenAI `text-embedding-3-small` at very low cost ($0.020/million tokens) and adds meaningful discovery value. However, it requires the question content to be loaded and embedded before launch — an additional content-loading task in Week 3.

**[RECOMMENDATION]** Include semantic search only if the question content is fully loaded by end of Week 2. If not, defer to post-v1. Do not delay gating or commerce to implement this.

**Post-v1 (design for but do not build):**

**"Adapt this to my organisation":** User selects a question or template, provides context (industry, organisation size, regulatory regime), and Claude generates a first-pass adapted version they edit and own. This is the highest-value AI feature identified — it transforms generic guidance into actionable, organisation-specific output. It requires careful prompt engineering, IP clarity (what does the user own?), and review by the author before launch. Target v2.

**Agentic pack assembly:** User states their role, sector, and current challenge; the platform assembles a tailored learning path and template pack. This requires the content model to be stable and the question tagging to be accurate. Significant value, significant complexity. Target v3.

---

# PART TEN — SCALABILITY AND EXTENSIBILITY

`[OWNER DIRECTIVE, v2.2]` **The system must always be scalable (for new features) and extensible.** This Part is where that directive (see Executive Summary) becomes concrete: which decisions have to be made now to keep that promise, and which genuinely can wait without compromising it.

## 10.1 Decisions that matter now

| Decision | Why it matters now |
|---|---|
| `Section` as a top-level entity | Without it, every query, route, and product assumes one book. Adding a second book requires a migration. |
| `Author` as a first-class entity | Without it, author attribution is a string field — you cannot filter by author, pay royalties, or give author-specific admin access. |
| Product price stored separately from content | Today's course price will change. Do not hard-code prices in the course record. |
| Entitlement model decoupled from product type | Today's entitlements cover courses and templates. Bundles, subscriptions, and team licenses need the same entitlement check mechanism. |
| Admin role separate from learner role | Adding an author role, a moderator role, or a reseller role later requires the role field to exist now. |

## 10.2 Decisions that can wait

| Decision | Why it can wait |
|---|---|
| Multi-region database | Not needed until traffic is sustained and latency is measured |
| CDN for static assets | Vercel provides a CDN for all static assets by default |
| Subscription billing | Stripe supports it; add Stripe Billing when needed |
| Organisation/team model | Schema placeholder is sufficient; full implementation is a separate sprint |
| Second author/section | Schema supports it; UI does not need to in v1 |

---

# PART ELEVEN — LEGAL AND OPERATIONAL REQUIREMENTS

**[WARNING]** This section identifies areas for legal review. It is not legal advice. All items below should be reviewed with qualified legal and/or tax professionals before launch.

## 11.1 Terms of service (required at launch)

Should cover:
- What the user is purchasing (access licence, not ownership)
- Permitted use (personal and organisational use; not for redistribution or resale without a licence)
- Prohibited use (sharing login credentials, scraping, reproducing content)
- Termination of access
- Limitation of liability
- Governing law and jurisdiction

**[OPEN DECISION]** Who is the contracting entity? The brand, the author personally, or the Effective RM company? This affects who appears on the terms, on invoices, and who processes payments via Stripe.

## 11.2 Privacy policy (required at launch)

Must address:
- What personal data is collected (name, email, purchase history)
- How it is used (delivery of services, transactional email)
- Third parties who process data (Stripe, Mux, Supabase, Resend, Cloudflare, Vercel, PostHog)
- Data retention periods
- User rights (access, correction, deletion)
- Cookie and analytics use (PostHog, Plausible)
- Australian Privacy Act 1988 obligations (primary jurisdiction)
- GDPR applicability (if serving EU residents — even incidentally, the platform should be prepared for GDPR data subject requests)

## 11.3 Refund policy

**[FINDING — upgraded from INFERENCE, AUDIT v1.1]** Verified directly against the ACCC's published consumer guarantee guidance: the Australian Consumer Law's automatic consumer guarantees (acceptable quality, fit for purpose, matching description) **apply to digital products**, and they exist independently of whatever a seller's stated refund policy says. The ACCC's explicit, current position is that signage or policy text stating **"no refunds," "all sales final," or "store credit only" is itself misleading conduct** and a breach of the ACL, regardless of the product being digital — this was tested and confirmed in *ACCC v Valve Corporation*. Where a "major failure" occurs (content materially not as described, or genuinely inaccessible due to a platform fault), the consumer is entitled to choose a refund; for a "minor failure," the seller may instead offer repair/re-supply within a reasonable time.

**[RECOMMENDATION]** This changes the refund policy from a discretionary business choice into a compliance requirement: the policy **cannot** state "no refunds on digital products" or "all sales final" without breaching the ACL. Recommended position, updated to align with the ACCC finding above:

- Refund available where the product materially differs from its description, or technical access fails and cannot be resolved within a reasonable time (this is the ACL "major failure" pathway, not a goodwill gesture).
- No refund obligation exists purely for "changed my mind" once a digital product has been fully accessed/downloaded — but this must be stated as company policy on top of the statutory guarantees, not as a substitute for them; the policy page should not imply it excludes ACL rights, since a clause that purports to exclude a statutory guarantee is itself void and risks being read as further misleading conduct.
- State the policy in plain language rather than legal boilerplate; ACCC guidance elsewhere in this same research area notes that vague or absolute "no refund" language is the single most common ACL breach pattern the regulator sweeps for.

**[OPEN DECISION]** Owner (with legal review) must approve the exact refund policy wording before publication — the above is a research-informed starting position, not legal advice, and should be reviewed against current ACCC guidance at time of drafting since enforcement sweeps and guidance are updated periodically.

## 11.4 Intellectual property

- The author's content (questions, guidance, frameworks) is the owner's IP. The platform is the delivery mechanism.
- Confirm that the platform licence to use the content is in writing between the author and the operating entity.
- Templates sold must include clear licence terms: what the buyer can do with the template (personal organisational use, client delivery, sublicensing).

## 11.5 Tax obligations

- **Australian GST — [CORRECTED, AUDIT v1.1]:** Verified directly against ATO guidance. GST applies to digital-product sales **to Australian consumers**, provided the business is GST-registered (registration is generally required once turnover exceeds A$75,000/year — confirm current threshold and whether voluntary early registration is advisable given B2B customers may prefer a GST-inclusive tax invoice regardless of turnover). Critically, **sales to customers outside Australia are GST-free** — this matters because the audience research in Part Two anticipates practitioners discovering the platform via LinkedIn/Google globally, not only in Australia, so the checkout must correctly distinguish AU-billed customers (GST applies) from international customers (GST-free) rather than applying GST uniformly. Stripe Tax (see Part 6.4) can automate this distinction; the Tax Basic pay-as-you-go tier (0.5%/transaction) is the appropriate v1 choice.
- **EU VAT:** Sales to EU residents of digital products require VAT collection in the country of the buyer (the EU's "place of supply" digital-services rules). At small scale, Stripe Tax can manage this within the same integration used for GST.
- **US sales tax:** Complex and state-specific, driven by economic nexus thresholds that vary by state. At early scale, monitoring volume by state and addressing when thresholds are approached is a reasonable approach; Stripe Tax also tracks nexus thresholds automatically once enabled.

**[OPEN DECISION]** Tax treatment of digital product sales — specifically, current GST registration status/threshold, and whether to enable Stripe Tax from launch versus adding it once international volume is material — must be confirmed with an accountant familiar with cross-border digital goods before the platform begins selling internationally. (Sources: ato.gov.au GST on imported services and digital products; ato.gov.au GST for non-resident businesses; both verified August 2026.)

---

# PART TWELVE — CHALLENGING THE BRIEF

## 12.1 The four-week timeline is achievable but only with strict prioritisation

**[WARNING]** The brief describes six deliverables (platform, learning, commerce, content model/admin, design system, handover pack). Delivering all six at production quality in four weeks requires zero scope creep, a decision on day one (brand, domain, stack), and real content loaded by the author no later than end of Week 2. If any of these conditions fail, the timeline does not survive.

**The most dangerous assumption in the brief is that "admin usable by someone who is not you" is a Week 3 deliverable.** A usable admin — one that handles errors gracefully, has help text, and has been tested — takes longer than it appears. If Week 1 and 2 overrun (which they will), the admin is what gets cut. This must be scoped as a minimum viable admin (add/edit content, upload video, upload template, publish product) rather than a full CMS.

## 12.2 The content model decision must happen before day one

**[WARNING]** The brief says "model the content before you code it" — this is correct, but it requires a decision the owner must make: exactly what are the five domains, and what are the authoritative values for each of the seven tags? The developer cannot guess these; a wrong schema requires a migration. Day 1 of Week 1 should include a 30-minute schema review session with the author.

## 12.3 "Design system" in Week 4 is too late

**[WARNING]** The brief places the design system in Week 4 ("apply the design system across every screen"). This is backwards. A design system applied after screens are built is called a retrofit, and it always results in inconsistency, because some screens were built with assumptions the system later contradicts.

**[RECOMMENDATION]** Establish the type scale, colour palette, spacing scale, and core component tokens in Week 1 (can be done in under a day with a design tool or Tailwind CSS configuration). Apply them as the first screen is built. The design system document is written in Week 4 — but the system itself must govern every screen from Week 1.

## 12.4 The "question discovery interface" is underspecified

**[WARNING]** The brief describes the ability to ask "what can I fix in a fortnight, cheaply, that my regulator cares about?" — this is the product's differentiating feature and it is not scoped as a distinct deliverable. A functional multi-tag filter on 100 questions is not trivial: it requires database indexing, a performant query with multiple `WHERE` clauses (or a `jsonb` approach), a UI with real-time filter updates, a zero-results state, and mobile-friendly filter controls.

**[RECOMMENDATION]** Treat the question discovery interface as a named deliverable with its own week allocation. It should be functional (even if ugly) in Week 1 as part of the slice. The slice should include: auth → one question with all tags → filter by one tag → purchase related template. Not just the video lesson flow.

## 12.5 "Looks worth paying for" requires a design bar set in Week 1

**[WARNING]** The brief correctly identifies that a paid product that looks like a template will not sell like one. This bar cannot be retrofitted in Week 4. The typography choice, colour palette, and component style must be set in Week 1 and held across every subsequent screen. Retrofitting consistency from a week-4 design review is how "it's 90% done" becomes "it looks unfinished at launch."

**[RECOMMENDATION]** The developer should make concrete design decisions in Week 1:
- Choose a professional typeface combination (e.g., a serif for headings, a sans-serif for body — this is a signature of credibility in professional publishing)
- Choose a restricted colour palette (maximum 3 brand colours, with functional colours for success/error/warning)
- Define spacing as a Tailwind CSS scale
- Build the button, card, and form components once, in Week 1, and reuse them everywhere

## 12.6 Certificates are a low-value distraction

The brief says "if completion recognition (a certificate or similar) is cheap to add, propose it — do not build it at the cost of the core." The honest assessment: certificates are not cheap to add correctly. A real certificate (user-specific, PDF-generated, with a course name and completion date) requires a PDF generation library, a certificate template, server-side generation, and delivery logic. This is at minimum 2–3 hours of work. In a four-week build, those hours belong to the slice. **Do not build certificates in v1.**

## 12.7 The biggest hidden risk: real content load time

**[INFERENCE]** The brief says "load enough real content that the platform looks inhabited rather than demonstrated." Loading 100 real questions with all seven tags, accurate guidance text, related templates, and related lessons is a significant content operation that must happen alongside the build. This is not a developer task — it is an author and content task. If the author cannot commit to having content loaded and reviewed by end of Week 2, the platform will launch with placeholder content, which the brief explicitly prohibits.

**[RECOMMENDATION]** Establish a content loading schedule with the author in Week 1. Determine: who enters the questions into the admin? Who tags them? Who reviews before launch? This is as important as the technical build plan.

---

# PART THIRTEEN — V1 PRODUCT SPECIFICATION

## 13.1 Product vision

A professional-grade knowledge and learning platform for risk practitioners, led by a named author's genuine expertise. The primary experience is discovery — finding a specific, relevant answer to a real risk question — not catalogue browsing. The commercial model is direct purchase: practical templates and expert courses, bought individually, priced for professional budgets, delivered immediately.

`[OWNER DIRECTIVE, v2.2]` Underpinning this vision is a standing architectural requirement: **the system must always be scalable for new features and extensible.** v1 is scoped to one book, one author, one audience — but nothing in the schema, the entitlement model, or the admin should assume that stays true. See Part Ten for the specific decisions this requires now versus later.

## 13.2 Target users (v1)

1. Risk managers, CROs, and risk analysts in mid-to-large organisations
2. Compliance, governance, and audit professionals
3. Risk and governance consultants

## 13.3 Primary jobs-to-be-done

1. "Find a specific, relevant answer to a risk question I'm stuck on today."
2. "Get a usable template or framework I can implement this week."
3. "Build my own knowledge in a structured, credible way."

## 13.4 Feature list (v1)

### Must have
- Question discovery: all 100 questions filterable by all 7 tags simultaneously
- Question pages: preview (title + tags) public; full body gated **[OWNER OVERRIDE, 2026-08-11: full body is public too, soft-gated by an email capture, not a purchase — see Part Four §4.1]**
- Course with modules and lessons (video, reading, download types) **[BUILT, 2026-08-11]** All three lesson types are live — `lessons.body` (reading), `lessons.download_template_id` (download, reusing the templates table's file rather than duplicating it), plus Mux video. A module can also attach a question as a free syllabus item (`module_questions`) alongside its lessons. See `docs/handover.md` §1/§2.
- Template store with gated purchase and download
- Free entry point (one domain freely browsable, email required)
- Stripe-hosted checkout (one-time purchases only)
- Entitlement system (server-side gating)
- Mux video with signed JWT playback and auto-captions
- Cloudflare R2 for paid downloads with presigned URLs
- Resend transactional emails (receipt, access, welcome, password reset)
- Progress tracking (lesson-level completion, course-level % visible to user) **[BUILT, 2026-08-11]** `POST /lessons/{id}/complete` marks `lesson_progress` and live-recomputes `course_progress`'s percentage in the same call — the outline's checkmarks and the catalogue's "% complete" can't drift apart from a background job that hasn't run yet, because there isn't one.
- Member dashboard (purchases, in-progress courses, downloads)
- Admin: add/edit questions+tags, lessons, templates, products, view users/orders
- Legal pages: terms, privacy, refund policy (drafted for owner review)
- PostHog event tracking: purchases, lesson completions, filter usage
- Mobile-responsive across all pages
- Accessibility: WCAG AA contrast, keyboard navigation, video captions

### Should have if time permits
- Related questions (many-to-many links visible on question page)
- One product bundle (course + templates)
- Order reconciliation view in admin
- Empty states for all zero-content scenarios
- Plausible analytics on public pages
- Manual entitlement override in admin (give access to a user without payment)

### Later (post-v1)
- Subscriptions / memberships
- Team/seat licensing
- Second section (second author or subject)
- Certificates of completion
- Semantic search (pgvector)
- AI "adapt to my organisation" feature
- Agentic learning path assembly
- Author-specific admin access
- API for external integrations

### Do not build
- Community / forums / comments
- Mobile native app
- Live cohort sessions
- Affiliate programme

## 13.5 Design-system requirements — a concrete starting kit `[AUDIT v1.1]`

**[WARNING]** Nowhere in this document (prior to this audit pass) are actual type-scale, spacing, or palette *values* proposed — only the recommendation that they be decided in Week 1 (12.5). Section 12.5's warning that "design system in Week 4 is too late" is correct but does not, on its own, give a developer something to build against on Day 1. The brief's deliverables explicitly require "type scale, palette, spacing scale, and a documented component set" as one of six assessed deliverables — this needs a concrete proposal, not only a process recommendation.

**[RECOMMENDATION]** Adopt the following as the Week 1 Day 1 starting configuration (a Tailwind CSS `theme` config, since Part Six recommends Tailwind/React `[UPDATED, STACK PIVOT v2.1]`). This is a **placeholder system to build against immediately**, not a final brand decision — swap the actual hex values and typeface names for the owner's brand choice (an open decision, Appendix J) without needing to redesign the scale itself:

**Type scale** (major-third ratio, 1.25× — a standard, credible ratio for professional/editorial content):
| Token | Size | Use |
|---|---|---|
| `text-xs` | 12px | Metadata, tag labels |
| `text-sm` | 14px | Secondary body, form labels |
| `text-base` | 16px | Body copy (question guidance, lesson reading content) |
| `text-lg` | 20px | Lede/intro paragraphs |
| `text-xl` | 25px | H3 / card titles |
| `text-2xl` | 31px | H2 / section headings |
| `text-3xl` | 39px | H1 / page titles |

**Typeface pairing (placeholder, brand-swappable):** A serif for headings (signals editorial/publishing credibility, consistent with the "author's voice and IP" non-negotiable) paired with a highly legible sans-serif for body and UI (e.g. system font stack or Inter) for screen readability at length. Exact typeface selection is a brand decision (Appendix J); the pairing *pattern* is the recommendation.

**Spacing scale** (4px base unit, matches both prior drafts in this repo — retained as consistent):
`4, 8, 12, 16, 24, 32, 48, 64, 96` px — expose as Tailwind's default spacing scale rather than inventing a custom one; inventing one costs Week 1 time for no benefit over the framework default.

**Colour palette structure (placeholder values — replace with brand colours before Week 4, not before Week 1):**
- 1 primary brand colour (CTAs, links, active states)
- 1 accent colour (used sparingly — badges, highlights)
- A neutral grey scale (5–7 steps, text/background/border)
- Functional colours: success (green), warning (amber), error (red) — these should be decided once and never improvised per-screen

**Core component set to build once in Week 1 and reuse everywhere** (matches the brief's explicit list): Button (primary/secondary/text variants), Card, Form input + label + validation state, Navigation (header + mobile drawer), Lesson layout (video/reading/download variants), Pricing table, Tag/filter chip (specific to this product's discovery UI — not a generic component library default), Empty state, Error/alert banner.

**[RECOMMENDATION]** Build these as actual reusable components (not copy-pasted markup) from the first screen in Week 1, even though the brief's own Week 1 language says "ugly is acceptable." "Ugly" can mean unstyled or visually plain; it should not mean *inconsistent* — inconsistency is what has to be retrofitted later, plainness does not.

---

# APPENDIX A — RECOMMENDED V1 ARCHITECTURE `[UPDATED, STACK PIVOT v2.1]`

```
┌───────────────────────────┐        ┌──────────────────────────────────┐
│   Vercel                  │        │   Render                          │
│   React (Vite) + TS       │  HTTPS │   FastAPI (Python)                │
│   Tailwind CSS            │───────▶│   Entitlement checks              │
│   Calls FastAPI via       │◀───────│   Stripe webhook handling         │
│   fetch/axios + Bearer    │  JSON  │   Mux signed-JWT generation       │
│   JWT (from Supabase Auth)│        │   R2 presigned-URL generation     │
└─────────────┬─────────────┘        └───────────────┬────────────────────┘
              │                                       │
              │ direct (sign-up/sign-in only)         │
              ▼                                       ▼
     ┌──────────────────┐                  ┌──────────────────────────┐
     │  Supabase Auth    │                 │  Supabase PostgreSQL      │
     │  (issues JWTs)     │◀── verified ───│  RLS · entitlements table │
     └──────────────────┘   by FastAPI     └──────────┬────────────────┘
                                                       │
                        ┌──────────────────────────────┼──────────────────────────────┐
                        │                              │                              │
                        ▼                              ▼                              ▼
                ┌──────────────┐            ┌─────────────────┐            ┌──────────────────┐
                │   Stripe     │            │   Mux            │           │ Cloudflare R2     │
                │   Checkout   │            │   Video API      │           │ (files)           │
                │   Webhooks   │            │   Signed JWTs    │           │ Presigned URLs    │
                └──────────────┘            └──────────────────┘           └──────────────────┘
                        │
                        ▼
                ┌──────────────┐        ┌──────────────┐
                │   Resend     │        │  PostHog     │
                │   (email)    │        │  (analytics) │
                └──────────────┘        └──────────────┘
```

**Data flows for gated access:**

```
AUTH:
User → React app → Supabase Auth (sign-up/sign-in, called directly, not via FastAPI)
  → Supabase returns a JWT → React stores it and attaches it as
    `Authorization: Bearer <jwt>` on every subsequent FastAPI call

VIDEO REQUEST:
User → React lesson page → FastAPI endpoint (e.g. GET /lessons/{id}/playback-token)
  → FastAPI dependency verifies the Supabase JWT
  → FastAPI checks Supabase ENTITLEMENT table (server-side, in FastAPI, not in React)
  → if entitled: FastAPI generates Mux signed JWT (expires 30 min) → returns to React → passed to <MuxPlayer>
  → if not entitled: FastAPI returns 403 → React shows the product page / CTA

DOWNLOAD REQUEST:
User → React downloads page → FastAPI endpoint (e.g. GET /templates/{id}/download-url)
  → FastAPI verifies JWT + checks ENTITLEMENT table
  → if entitled: FastAPI generates R2 presigned URL (expires 60 sec) → returns URL to React → browser fetches directly from R2
  → if not entitled: 403

WEBHOOK (purchase):
Stripe → FastAPI endpoint (POST /webhooks/stripe)
  → verify Stripe signature (stripe.Webhook.construct_event, Python SDK)
  → look up product in Supabase by Stripe Price ID
  → idempotency check (does an entitlement already exist for this user+product?)
  → create ENTITLEMENT record in Supabase
  → trigger Resend access email (Resend's Python SDK)
```

**[WARNING]** The video and download requests above are deliberately routed through FastAPI, not called by React directly against Mux or R2 — this is what keeps the entitlement check as the actual gate rather than a UI-only decision. React should never hold a Mux API secret or an R2 access key; those live only in FastAPI's environment.

---

# APPENDIX B — TECHNOLOGY AND SERVICE STACK `[UPDATED, STACK PIVOT v2.1]`

## Free / freemium tier (usable at launch, monitoring required)

| Service | What it provides | Free limit | Note |
|---|---|---|---|
| Supabase | PostgreSQL, Auth, storage | 500 MB DB, 1 GB storage, 50 K MAU | Upgrade to Pro ($25/month) when content grows |
| Mux | Video delivery | 100 K delivery minutes/month | Effectively free for early traffic |
| Cloudflare R2 | File storage | 10 GB, 1 M Class A ops | Sufficient for v1 content library |
| Resend | Transactional email | 3,000 emails/month | Sufficient for early user base |
| PostHog | Product analytics | 1 M events/month | Sufficient indefinitely for an early platform |
| Vercel | Frontend deployment | Hobby (non-commercial) — must use Pro | See paid tier |
| Render | Backend (FastAPI) hosting | Free web service | **Spins down after 15 min idle; 30–60 sec cold start** — usable for early development only. See paid tier. |

## Paid tiers required

| Service | Plan | Cost | Notes |
|---|---|---|---|
| Vercel | Pro | $20/seat/month | Required for commercial use; hosts the React build |
| Render | Starter | ~$7/month | **New line item, `[STACK PIVOT v2.1]`.** Removes the free tier's cold start; required once FastAPI handles real or demo checkout traffic. |
| Stripe | Per transaction | **1.7% + A$0.30 domestic / 3.5% + A$0.30 international** `[CORRECTED, AUDIT v1.1 — was US rate]` | No monthly fee; charged per sale. See Part 6.4 for full breakdown including currency conversion and Stripe Tax. |
| Domain | Per year | ~$15–$30/year | Owner's decision on registrar |

## Estimated monthly running costs (early stage, <500 MAU) `[REVISED, STACK PIVOT v2.1]`

| Item | Cost |
|---|---|
| Vercel Pro (1 seat, frontend) | $20 |
| Render Starter (backend) | $7 |
| Supabase Free (upgrade to Pro if needed) | $0–$25 |
| Mux (within free minutes) | $0–$5 |
| Cloudflare R2 (within free tier) | $0 |
| Resend (within free tier) | $0 |
| PostHog (within free tier) | $0 |
| **Total infrastructure** | **~$27–$57/month** |

**[WARNING]** This is $7/month higher than the pre-pivot estimate (~$20–50/month) purely because the decoupled architecture requires a second host — a small, known, named cost, exactly what the brief's "every recurring fee is named and justified before you commit" non-negotiable requires.

**Note:** All pricing figures are from official sources researched in August 2026 and will change. Verify current pricing on each provider's website before committing.

## Budget-constrained alternative (near-$0/month) `[CONSOLIDATED v2.0, REVISED v2.1]`

**[RECOMMENDATION]** The stack above is the recommended path and should not be swapped out mid-build without good reason. If the owner needs a genuinely near-$0-recurring-cost variant, the following substitutions apply, at the cost of real operational trade-offs that must be accepted knowingly, not discovered in Week 4:

| Service | Recommended (main stack) | Free-tier substitute | Trade-off accepted |
|---|---|---|---|
| Frontend deployment | Vercel Pro ($20/month) | Vercel Hobby, or Cloudflare Pages | Hobby explicitly prohibits commercial use — acceptable for pre-revenue validation only. |
| Backend deployment | Render Starter (~$7/month) | Render free web service | **The same cold-start trade-off now applies to the FastAPI backend specifically**, `[STACK PIVOT v2.1]` — a customer's browser calling a cold FastAPI endpoint mid-checkout stalls the entitlement check and webhook path, not just a page load. Mitigate with an external keep-alive ping (UptimeRobot/cron-job.org) hitting a FastAPI health-check endpoint every 10 minutes. |
| Video | Mux (pay-as-you-go) | A budget video host with a free tier (e.g. ~5 GB storage, ~1,000 playback minutes/month, 720p cap) | 720p ceiling; generous enough for MVP content volume. |
| Database/Auth | Supabase Pro ($25/month) | Supabase Free | Free-tier projects **pause after 7 days of inactivity** (Part 6.2) — present on both paths during idle periods, but only the free tier requires manual resume. No automatic backups on the free tier. |
| Everything else (Stripe, Resend, R2, PostHog) | Same as main stack | Same as main stack, already free at this scale | No difference. |

**[WARNING]** The free-tier backend substitute (cold starts) directly conflicts with the brief's "it works end to end … on a real device" success test. This should not be adopted without the owner explicitly accepting that risk.

**[RECOMMENDATION]** Use the budget path only as a pre-revenue validation environment, and plan a migration to the main recommended stack — specifically, upgrading Render off its free tier — before the platform is presented as ready for a real, unattended stranger to buy from.

---

# APPENDIX C — CONCEPTUAL DATA MODEL

```sql
-- USERS (managed by Supabase Auth; extended with profile)
users
  id           uuid PK (Supabase Auth UID)
  email        text
  full_name    text
  role         enum('learner', 'admin', 'author')
  created_at   timestamptz

-- CONTENT HIERARCHY
sections
  id           uuid PK
  title        text
  slug         text UNIQUE
  author_id    uuid FK → authors
  published    boolean

authors
  id           uuid PK
  name         text
  bio          text
  credentials  text
  avatar_url   text

domains
  id           uuid PK
  section_id   uuid FK → sections
  title        text
  slug         text
  description  text
  position     integer

questions
  id           uuid PK
  domain_id    uuid FK → domains
  title        text
  body         text (full guidance, gated) -- [OWNER OVERRIDE, 2026-08-11] always returned by
  -- GET /questions/{slug}, entitled or not — never withheld server-side. Soft-gated
  -- client-side by an email capture instead (EmailGatedBody.tsx); see Part Four §4.1.
  slug         text UNIQUE
  -- Seven tags: stored as `tag_values` reference-table rows, not Postgres/Python enums
  -- [RESOLVED, per BACKEND.md §1.4/§8] — a reference table lets the owner add or rename a
  -- tag value as a data edit, consistent with this document's standing extensibility directive
  -- (Executive Summary, Part Ten). An enum would require a schema migration for the same change.
  effort       text  (e.g., 'low', 'medium', 'high')
  duration     text  (e.g., 'days', 'weeks', 'months', 'quarters')
  cost         text  (e.g., 'free', 'low', 'medium', 'high')
  roi_horizon  text  (e.g., 'quick', 'mid', 'strategic') -- renamed from 'payback'; see 3.1
  tier         text[] (multi-select: 'strategic', 'operational', 'project')
  regulator_pressure text (e.g., 'low', 'medium', 'high')
  leadership_traits  text[] (multi-select)
  published    boolean

question_relations  (self-referential many-to-many)
  question_a_id  uuid FK → questions
  question_b_id  uuid FK → questions

-- LEARNING
courses
  id           uuid PK
  section_id   uuid FK → sections
  title        text
  slug         text UNIQUE
  description  text
  thumbnail_url text
  published    boolean

modules
  id           uuid PK
  course_id    uuid FK → courses
  title        text
  position     integer

lessons
  id           uuid PK
  module_id    uuid FK → modules
  title        text
  type         enum('video', 'reading', 'download')
  position     integer
  -- Type-specific fields
  mux_asset_id    text   (for video)
  reading_body    text   (for reading)
  r2_object_key   text   (for download; also templates)
  file_name       text
  published    boolean

templates
  id           uuid PK
  section_id   uuid FK → sections
  title        text
  slug         text UNIQUE
  description  text
  r2_object_key text
  file_name    text
  preview_url  text
  published    boolean

-- CROSS-REFERENCES
question_templates  (many-to-many)
  question_id  uuid FK → questions
  template_id  uuid FK → templates

question_lessons  (many-to-many)
  question_id  uuid FK → questions
  lesson_id    uuid FK → lessons

-- COMMERCE
products
  id              uuid PK
  type            enum('course', 'template', 'bundle', 'free')
  title           text
  description     text
  price_cents     integer
  currency        text (default 'AUD' or 'USD' — owner decision)
  stripe_price_id text
  -- References (only one populated per type)
  course_id       uuid FK → courses (nullable)
  template_id     uuid FK → templates (nullable)

bundle_items  (for bundle products)
  bundle_product_id  uuid FK → products
  child_product_id   uuid FK → products

orders
  id                uuid PK
  user_id           uuid FK → users
  stripe_session_id text UNIQUE
  stripe_payment_id text
  total_cents       integer
  currency          text
  status            enum('pending', 'complete', 'refunded')
  created_at        timestamptz

order_items
  id          uuid PK
  order_id    uuid FK → orders
  product_id  uuid FK → products
  price_cents integer

entitlements
  id          uuid PK
  user_id     uuid FK → users
  product_id  uuid FK → products
  granted_at  timestamptz
  granted_via enum('purchase', 'manual', 'free')
  UNIQUE(user_id, product_id)

-- PROGRESS
lesson_progress
  id           uuid PK
  user_id      uuid FK → users
  lesson_id    uuid FK → lessons
  completed    boolean
  completed_at timestamptz
  UNIQUE(user_id, lesson_id)
```

**RLS policies required on:** users, questions, orders, order_items, entitlements, lesson_progress (each user can only see/modify their own records).

---

# APPENDIX D — CORE USER JOURNEYS

## Journey 1: Discovery → Purchase → Access (template)

1. Google → `/questions?effort=low&duration=weeks` — filtered question list
2. Click question title → `/questions/risk-appetite-statement` — preview (body gated)
3. Click "Download the template — $79" → `/templates/risk-appetite-template`
4. Click "Buy now" → Stripe Checkout (no account required; Stripe collects email)
5. Payment complete → webhook creates entitlement + sends receipt email
6. Redirect to `/downloads` (or sign-up prompt if not already registered)
7. Template downloads via R2 presigned URL

**[OPEN DECISION]** Can a user purchase without creating an account? Stripe Checkout allows guest checkout. However, if no account is created, the entitlement must be linked to the email address — and subsequent login must match that email. This is feasible but adds complexity. For v1, requiring account creation before checkout is simpler to implement and gives the platform a user record.

## Journey 2: Discovery → Course purchase → Learning

1. Email list → "New course: Third-Party Risk Foundations" → `/courses/third-party-risk`
2. Course page: syllabus, free sample lesson, author bio, price ($149)
3. Buy → Stripe Checkout → Entitlement created
4. `/learn/third-party-risk` — module list; first lesson available
5. Watch video (Mux signed JWT); mark complete
6. Return next day → dashboard shows progress; lesson where they left off

## Journey 3: Admin adds a new lesson

1. Admin logs in → `/admin`
2. Navigate to "Courses" → select course → select module
3. Click "Add lesson" → form: title, type (video)
4. Upload video → processed by Mux (async; admin sees "Processing") → Mux returns asset ID
5. Admin saves lesson → visible to entitled users immediately (or after publish toggle)

---

# APPENDIX E — FEATURE PRIORITY MATRIX

| Feature | Type | Priority | Week |
|---|---|---|---|
| React (Vite) + FastAPI + Supabase project setup `[UPDATED, STACK PIVOT v2.1]` | Technical | Must have | 1 |
| Auth (sign up, sign in, password reset) | Technical | Must have | 1 |
| Stripe hosted checkout + webhook | Technical | Must have | 1 |
| Entitlement creation from webhook | Technical | Must have | 1 |
| Mux video upload + signed JWT playback | Technical | Must have | 1 |
| R2 file upload + presigned download | Technical | Must have | 1 |
| Resend receipt email | Technical | Must have | 1 |
| One question with all 7 tags | Content | Must have | 1 |
| One lesson (video type) | Content | Must have | 1 |
| One template product + purchase | Product | Must have | 1 |
| Database schema (all entities) | Technical | Must have | 1 |
| Design tokens (type, colour, spacing) | Design | Must have | 1 |
| Module/lesson structure + progress | Technical | Must have | 2 |
| Multi-lesson course with resume | Product | Must have | 2 |
| Question discovery with multi-tag filter | Product | Must have | 2 |
| Server-side entitlement gating (all routes) | Technical | Must have | 2 |
| Real content load (questions 1–50) | Content | Must have | 2 |
| Member dashboard | Product | Must have | 2 |
| Admin: questions + tags CRUD | Technical | Must have | 3 |
| Admin: lessons + video upload | Technical | Must have | 3 |
| Admin: templates + file upload | Technical | Must have | 3 |
| Admin: products + pricing | Technical | Must have | 3 |
| Free entry point (email capture) | Product | Must have | 3 |
| Transactional email (all types) | Technical | Must have | 3 |
| Real content load (questions 51–100) | Content | Must have | 3 |
| Non-developer admin test | Operational | Must have | 3 |
| Design system applied across all screens | Design | Must have | 4 |
| Mobile responsive all pages | Design | Must have | 4 |
| Accessibility audit (contrast, keyboard, captions) | Design | Must have | 4 |
| Empty states all screens | Design | Must have | 4 |
| Error states (failed payment, expired session, video fail) | Design | Must have | 4 |
| Gating penetration test | Security | Must have | 4 |
| Legal pages (drafted for review) | Operational | Must have | 4 |
| Handover documentation | Operational | Must have | 4 |
| Related questions on question page | Product | Should have | 3–4 |
| One bundle product | Product | Should have | 3 |
| Admin: order reconciliation view | Technical | Should have | 4 |
| Plausible on public pages | Technical | Should have | 3 |
| PostHog event tracking | Technical | Should have | 2–3 |
| Manual entitlement override in admin | Technical | Should have | 4 |
| Semantic search (pgvector) | Technical | Later | Post-v1 |
| Subscriptions | Product | Later | Post-v1 |
| Certificates | Product | Later | Post-v1 |
| Team licensing | Product | Later | Post-v1 |
| AI features | Product | Later | Post-v1 |
| Second section/author | Product | Later | Post-v1 |

---

# APPENDIX F — FOUR-WEEK IMPLEMENTATION PLAN

## Week 1 — The Slice (Days 1–5)

**Day 1 (non-negotiable):**
- [ ] Confirm brand name and domain with owner
- [ ] Confirm stack (use this document)
- [ ] Owner provides: five domain names, authoritative values for all seven tags
- [ ] Set up Vercel project, Supabase project, GitHub repo (private), Stripe account, Mux account, Cloudflare R2 bucket, Resend account
- [ ] Establish design tokens (type scale, colour palette, spacing scale) in Tailwind config
- [ ] Draft database schema and review with owner

**Days 2–5:**
- [ ] Implement Supabase Auth (sign up, sign in, sign out, session middleware)
- [ ] Build database schema (all entities, even those not yet used)
- [ ] Build one question record (with all 7 tags) in Supabase
- [ ] Build one course → one module → one lesson (video type)
- [ ] Upload one video to Mux; implement signed JWT playback in `<MuxPlayer>`
- [ ] Build one template product; upload file to R2
- [ ] Implement Stripe Checkout for one product; implement webhook handler; create entitlement
- [ ] Implement server-side entitlement check on lesson route
- [ ] Implement R2 presigned URL for template download
- [ ] Implement Resend receipt email triggered by webhook
- [ ] Smoke test the full slice end-to-end with a real test card

**End of Week 1 deliverable:** A logged-in user can purchase a template with a real Stripe test card, receive a receipt email, and download the file. The same user can watch a signed video. A logged-out user is blocked from both.

## Week 2 — Learning and Access (Days 6–10)

- [ ] Expand to multiple modules and lessons (video, reading, and download types)
- [ ] Implement progress tracking (per-lesson completion, course-level percentage)
- [ ] Implement resume (dashboard shows last lesson in progress)
- [ ] Build the question discovery interface with multi-tag filtering (all 7 tags)
- [ ] Implement question body gating (preview public, body requires entitlement or free registration)
- [ ] Load first 50 real questions with accurate tags (content task — author-led)
- [ ] Verify all entitlement checks are server-side (no client-side-only gates)
- [ ] Build member dashboard (purchases list, course progress, downloads)
- [ ] Begin PostHog integration (page views, lesson starts, filter usage events)

## Week 3 — Commerce and Content (Days 11–15)

- [ ] Admin: questions + tags CRUD (add, edit, publish/unpublish)
- [ ] Admin: lesson + video upload (Mux integration from admin)
- [ ] Admin: template + file upload (R2 integration from admin)
- [ ] Admin: product management (pricing, publish, link to course/template)
- [ ] Admin: user and order view (read-only for reconciliation)
- [ ] Build free entry point (one domain freely browsable; email capture for full access)
- [ ] Implement all remaining Resend transactional emails (welcome, access, password reset)
- [ ] Load remaining 50 questions; related question links
- [ ] Build one product bundle (course + templates)
- [ ] Non-developer admin test: watch a non-technical person add a lesson and fix failures
- [ ] Public: course catalogue page, template catalogue page

## Week 4 — Design, Hardening, and Handover (Days 16–20)

- [ ] Apply design system consistently across every screen (audit each page)
- [ ] Mobile layout review and fix (phone-sized viewport on all pages and checkout)
- [ ] Accessibility audit: contrast ratios, keyboard navigation, video captions verified
- [ ] Empty states: every list, every zero-result filter, every empty dashboard section
- [ ] Error states: failed payment, expired session, video load failure, 404, 500
- [ ] Gating penetration test: try every attack vector in Security section 7.1; fix failures
- [ ] Verify Stripe webhook is idempotent (duplicate event test)
- [ ] Draft legal pages: terms, privacy, refund policy (submit to owner for review)
- [ ] Configure domain and SSL
- [ ] Final end-to-end test with a real payment card on a real mobile device
- [ ] Handover documentation: architecture decision record, add-a-section guide, cost schedule, known gaps, what to build next

---

# APPENDIX G — SECURITY CHECKLIST

| Item | Status | Owner |
|---|---|---|
| Supabase Auth: HTTP-only cookie sessions | Built | Developer |
| Supabase Auth: password hashing (bcrypt) | Built-in | Supabase |
| RLS enabled on all user-data tables | Configured | Developer |
| Stripe webhook signature verification | Built | Developer |
| Stripe webhook idempotency (no duplicate entitlements) | Built | Developer |
| Mux signed JWT expiry ≤ 30 minutes | Configured | Developer |
| R2 presigned URL expiry ≤ 60 seconds | Configured | Developer |
| Server-side entitlement check on all gated routes | Built | Developer |
| No card data handled anywhere in codebase | Verified | Developer |
| No secrets in version control (`.gitignore`) | Verified | Developer |
| Environment variables in Vercel (not hard-coded) | Configured | Developer |
| Content-Security-Policy headers configured | Configured | Developer |
| X-Frame-Options: DENY | Configured | Developer |
| HTTPS enforced (Vercel handles; HSTS header set) | Configured | Developer |
| Rate limiting on auth endpoints | Configured | Developer |
| Admin routes protected by admin role check | Built | Developer |
| PostHog session replay excludes checkout + auth | Configured | Developer |
| Supabase daily backups enabled | Verified | Developer |
| Input validation on all form submissions | Built | Developer |
| CSRF: not applicable in the classic sense — Bearer-token JWT auth (not cookies) means the browser never auto-attaches credentials cross-origin; enforce this by keeping CORS restricted to the known Vercel frontend origin only `[UPDATED, STACK PIVOT v2.1]` | Configured | Developer |
| CORS on FastAPI restricted to the exact Vercel frontend origin (and `localhost` in dev) — not a wildcard `*` `[NEW, STACK PIVOT v2.1]` | Configured | Developer |
| Backend secrets (Stripe, Mux, Supabase service role, R2) live only in Render's environment variables, never Vercel's `[NEW, STACK PIVOT v2.1]` | Verified | Developer |
| SQL injection prevention (parameterised queries via Supabase client) | Built-in | Framework |
| A shortcut that compromises the standing scalability/extensibility directive (Executive Summary, Part Ten) is flagged for explicit owner sign-off, never taken silently `[NEW, OWNER DIRECTIVE v2.2]` | Documented | Developer + Owner |
| Rate limiting on public question-discovery API (anti-scraping) `[AUDIT v1.1]` | Configured | Developer |
| Rate limiting on download-URL generation endpoint (per user) `[AUDIT v1.1]` | Configured | Developer |
| Dependabot / `npm audit` enabled in CI from first commit `[AUDIT v1.1]` | Configured | Developer |
| Stripe webhook failure email alert enabled `[AUDIT v1.1]` | Configured | Developer |
| Audit log: gated-download URL generation (user, resource, timestamp) `[AUDIT v1.1]` | Built | Developer |
| Audit log: admin content changes and manual entitlement grants (who, what, when) `[AUDIT v1.1]` | Built | Developer |
| Data retention periods documented and enforced (see Part 7.6 table) `[AUDIT v1.1]` | Documented | Developer + Owner |

---

# APPENDIX H — ANALYTICS CHECKLIST

## PostHog events to instrument

| Event | Properties | When |
|---|---|---|
| `page_viewed` | path, referrer | Every page load |
| `filter_applied` | tag_name, value, result_count | Each tag filter change |
| `question_viewed` | question_id, domain, gated_body | Question page load |
| `lesson_started` | lesson_id, lesson_type, course_id | Lesson page load |
| `video_played` | lesson_id, mux_asset_id | MuxPlayer play event |
| `video_completed` | lesson_id | MuxPlayer ended event |
| `lesson_completed` | lesson_id, course_id | Mark complete clicked |
| `course_completed` | course_id | All lessons complete |
| `template_downloaded` | template_id | Presigned URL generated |
| `checkout_started` | product_id, product_type, price | Checkout button clicked |
| `purchase_completed` | product_id, order_id, revenue | Stripe webhook confirmed |
| `free_signup` | entry_point, domain | Free registration |
| `search_performed` | query_text | If semantic search added |

## Funnels to configure in PostHog

1. Discovery → Checkout → Purchase (main conversion funnel)
2. Course page → Checkout started → Purchase completed
3. Free signup → Login → First purchase
4. Lesson started → Lesson completed → Next lesson started (engagement funnel)

---

# APPENDIX I — LEGAL AND OPERATIONAL CHECKLIST

| Item | Action required | Who |
|---|---|---|
| Brand name and domain confirmation | Decision by owner | Owner |
| Contracting entity for Stripe | Decision by owner | Owner |
| Terms of service (draft) | Developer drafts; owner reviews/approves | Both |
| Privacy policy | Developer drafts; owner reviews/approves | Both |
| Refund policy | Owner sets position; developer publishes | Both |
| GST/VAT treatment | Review with accountant | Owner |
| US sales tax position | Review with accountant | Owner |
| Content ownership agreement (author ↔ entity) | Legal review | Owner |
| Template licence terms | Owner decides scope; developer publishes | Both |
| Cookie/analytics disclosure | Include in privacy policy | Developer |
| Data deletion process (GDPR/Privacy Act) | Document and test | Developer |
| DKIM/SPF/DMARC for email domain | Configure | Developer |
| Supabase data region | Choose region appropriate to user base | Developer |
| Stripe account country | Set matching contracting entity | Owner |
| Refund policy wording — cannot state "no refunds"/"all sales final" per ACL (11.3) `[AUDIT v1.1]` | Legal review before publish | Owner |
| Stripe Checkout configured for tax-invoice-quality receipts (ABN, itemised) `[AUDIT v1.1]` | Configure | Developer |
| Template licence terms visible on product page (11.4, 2.4) `[AUDIT v1.1]` | Owner decides scope; developer publishes | Both |
| Stripe Tax enabled (GST for AU customers, GST-free for export sales) `[AUDIT v1.1]` | Configure + confirm with accountant | Both |

---

# APPENDIX J — OPEN DECISIONS FOR THE OWNER

These must be resolved before or during Week 1. Each unresolved decision blocks a part of the build.

| Decision | Blocker for | Default if not decided |
|---|---|---|
| Brand name and domain | Week 1 Day 1 | Cannot start |
| Five domain names (exact titles) | Schema on Day 1 | Cannot model content |
| Authoritative values for all seven tags | Schema on Day 1 | Cannot model content |
| Contracting entity (who accepts payment) | Stripe setup | Cannot launch |
| Currency (AUD, USD, GBP, or multi-currency) | Stripe Checkout | Default USD unless specified |
| Pricing for each product | Week 3 | Cannot publish products |
| Which domain is free (lead magnet) | Week 3 | No free entry point |
| Refund policy position | Week 4 | Legal page not publishable |
| Tax treatment (collect GST/VAT?) | Week 3 | Risk of non-compliance |
| Guest checkout or account-required | Week 1 | Recommend account-required |
| Who loads content into admin? | Week 2 | Developer loads from spreadsheet provided by author |
| Are templates commercially licensable? | Week 4 | Terms page not publishable |
| Launch date | Week 1 | Cannot set external deadlines |

---

# APPENDIX K — POST-V1 ROADMAP

## v2 (recommended 4–8 weeks after v1 launch)

- Subscriptions / membership (Stripe Billing)
- Completion certificates (PDF generation)
- Semantic question search (pgvector embeddings)
- Related questions UX improvements
- Sanity Studio editorial upgrade (replace custom admin for content editing)
- Team licence (basic: one purchase, multiple named seats)
- Plausible analytics on all public pages
- Stripe Tax for GST/VAT automation

## v3 (3–6 months post-launch)

- Second section (new subject, new author)
- AI "adapt to my organisation" feature (Claude API)
- Author-specific admin access and dashboard
- Learning path recommendations (rule-based first, then AI-assisted)
- Advanced analytics (cohort analysis, completion rates, revenue reporting)

## v4 (6–12 months post-launch)

- Agentic pack assembly (user describes problem; platform assembles tailored pack)
- Enterprise team licensing with invoicing
- API for integrators (HR systems, LMS integrations)
- Mobile app (if web engagement data justifies it)

---

# APPENDIX L — RESEARCH SOURCES

All pricing figures and feature claims were verified against official documentation in August 2026. Pricing changes frequently; re-verify before committing to any service.

**Platforms and competitors:**
- Circle.so/blog/best-online-course-platforms — "11 Best Online Course Platforms in 2026"
- GARP.org — Global Association of Risk Professionals, certification and learning products
- IRM theirm.org — Institute of Risk Management, CPD programmes
- ISC2.org/professional-development/certificates/risk-management — Risk Management Certificate
- Gumroad/Etsy template-marketplace revenue and pricing analysis (146,271 tracked products across categories) — informs Part 4.2 and 1.2
- Vimeo/Wistia/Gumlet/VdoCipher video access-control and DRM comparison — informs Part 6.5
- Baymard Institute e-commerce/online-learning UX benchmarking; Coursera/Udemy/Udacity cognitive-walkthrough usability studies — informs Part 1.1 and Part Eight
- Grail Learning, StoneX eLearning Risk Management Academy, NIST Cyber Risk Portal — risk-sector e-learning case studies, informs Part 1.1

**Technology documentation — official primary sources, re-verified `[AUDIT v1.1]`:**
- mux.com/pricing — Official Mux pricing, **directly fetched and confirmed August 2026**: storage $0.0024/min (720p), delivery from $0.0008/min after 100K free minutes/month, captions free, Smart Security (signed URLs) free, DRM $100/month + $0.003/play
- mux.com/docs/guides/secure-video-playback — Mux signed URL guide
- clerk.com/pricing — **[RESOLVED, AUDIT v1.1]** Free tier raised to 50,000 MRU (Monthly Retained Users) effective 5 February 2026; Pro $20/month billed annually + 50K MRU + 1 SSO connection
- stripe.com/au/pricing — **[CORRECTED, AUDIT v1.1]** Directly fetched and confirmed August 2026: Australian domestic cards 1.7% + A$0.30 (falling further from 1 Oct 2026), international cards 3.5% + A$0.30, currency conversion +2%, Stripe Tax Basic 0.5%/transaction pay-as-you-go or A$0.75/transaction (API), Tax Complete A$140/month (1-year contract). Supersedes the original draft's use of US pricing (2.9% + $0.30).
- vercel.com/docs/plans/pro-plan — Vercel Pro $20/seat/month, 1TB data transfer + 10M edge requests included, $0.15/GB overage — confirmed current August 2026
- cloudflare.com/r2/pricing — $0.015/GB storage, $0 egress, $4.50/million Class A ops, $0.36/million Class B ops, free tier 10GB/1M/10M ops/month — confirmed current August 2026
- supabase.com/pricing — Free: 500MB DB, 5GB egress, 50K MAU, 1GB storage, 2 projects, **projects pause after 7 days' inactivity** (new finding, `[AUDIT v1.1]`); Pro $25/month: 8GB DB, 250GB egress, 100K MAU, 100GB storage, $10/month compute credit — confirmed current August 2026
- resend.com/pricing — Free: 3,000 emails/month, capped 100/day, one domain — confirmed current August 2026
- posthog.com/pricing — Free: 1M events/month, 5,000 session replays, 1,500 survey responses/month — confirmed current August 2026
- accc.gov.au — Consumer rights and guarantees; ACCC position on "no refunds" claims as misleading conduct; *ACCC v Valve Corporation* — verified August 2026, informs Part 11.3
- ato.gov.au — "GST on imported services and digital products" and "GST for non-resident businesses" — verified August 2026, informs Part 11.5

**Analytics comparison:**
- buildmvpfast.com/blog/posthog-vs-plausible-vs-fathom-privacy-analytics-saas-2026
- faurya.com/blog/posthog-vs-plausible-for-saas

**CMS comparison:**
- digitalapplied.com/blog/headless-cms-2026-sanity-contentful-payload-comparison
- payloadcms.com/compare/sanity

**Auth comparison:**
- designrevision.com/blog/auth-providers-compared (February 2025)
- futurepicker.com/en/saas-authentication-tool-comparison-2026

**Database comparison:**
- coderfile.io/blog/neon-vs-planetscale-vs-supabase
- makerkit.dev/blog/tutorials/best-database-software-startups

**Storage comparison:**
- cloudflare.com/r2/pricing (official)
- tech-insider.org/cloudflare-r2-vs-s3-vs-backblaze-b2-2026

**Transactional email:**
- emailsendx.com/blog/best-transactional-email-api-2026
- ventureharbour.com — "7 Best Transactional Email Services in 2026"

**[AUDIT v1.1 NOTE ON SOURCE QUALITY]** The comparison sections above (Analytics, CMS, Auth, Database, Storage, Transactional email) still lean on third-party SEO/aggregator blogs rather than official documentation, contrary to the brief's source-priority instruction ("1. Official documentation, 2. Official pricing pages... 7. Practitioner/community discussions where useful" — aggregator blogs rank below all of these). During this audit, one such aggregator figure was checked directly against the vendor's official page and found to be materially wrong (a third-party site reported Mux delivery at $0.024/minute — 30× the official $0.0008/minute confirmed directly on mux.com/pricing). **[RECOMMENDATION]** Before this document is finalised for the owner, re-verify every remaining aggregator-sourced figure (Auth, Database, Storage, Email, CMS comparisons) directly against each vendor's own pricing page, the same way the Technology documentation sources above were corrected in this pass. This was not done for all rows in this audit due to time constraints, but the Mux discrepancy found is a concrete demonstration that it matters.

---

# APPENDIX M — PROJECT RISK REGISTER `[CONSOLIDATED v2.0]`

Part Twelve challenges the brief narratively. This appendix restates the project's own delivery risks formally — cause / event / consequence statements, likelihood and consequence rated against the same five-point scales used elsewhere at Effective Risk Management, and treatment split between reducing likelihood and reducing consequence. This is the register a first-line owner (the developer) would bring to a check-in, not a compliance artefact filed and forgotten.

## Register summary

| ID | Risk | Likelihood | Consequence | Rating | Velocity |
|---|---|---|---|---|---|
| R1 | Four-week timeline compounds into a broken or late launch | 4 Likely | 4 Major | **High** | High |
| R2 | A content-protection vector outside the documented threat model leaks paid content | 3 Possible | 5 Severe | **Extreme** | Medium |
| R3 | A third-party outage or silent webhook failure denies a paying customer access | 3 Possible | 3 Moderate | Medium | High (webhook) / Low (cost drift) |
| R4 | Unvalidated pricing, or a non-compliant refund policy, causes lost revenue or an ACL breach | 3 Possible | 3–4 Moderate–Major | Medium–High | High (refund wording) / Low (pricing) |
| R5 | Inconsistent or unreviewed content undermines the taxonomy's credibility | 3 Possible | 4 Major | **High** | Medium |
| R6 | The "second subject is configuration" claim proves false when actually tested | 2 Unlikely | 3 Moderate | Medium | Low |
| R7 | Incomplete privacy/consent handling leaves a data-subject request unanswerable | 2 Unlikely | 3 Moderate | Medium | Low |
| R8 | The question-discovery interface fails to convert because it is not understood | 3 Possible | 3 Moderate | Medium | High |

**Reading the register:** R2 (content protection) is the only Extreme-rated risk and is also the platform's sole hard non-negotiable per the brief — it should receive disproportionate attention relative to its likelihood score. R1 and R5 are both High and share a root cause (schedule pressure crowding out review and hardening time), which is why Part Twelve treats sequencing, not feature scope, as the primary lever.

## Treatment detail

**R1 — Timeline and scope.** *Statement:* Because the four-week build compresses six substantial deliverables into parallel work with no schedule slack, the slice may not be complete and hardened by end of Week 1, causing schedule pressure to compound through every later week and resulting in a late launch or one that ships with broken gating. *Confidence:* Moderate — based on comparable build patterns, not yet this project's own execution data.
- *Reduce likelihood:* a formal Week 1 go/no-go gate (if the slice is not working end-to-end with real gating by end of Week 1, stop and replan rather than push forward); commit to the stack on day one with no re-litigation; treat content loading as a dedicated, named task rather than a parallel afterthought (12.7).
- *Reduce consequence:* protect the slice over surface area if time runs short, exactly as the brief itself instructs; raise a confidence drop with the owner the same day it happens, not the following week.

**R2 — Content protection (Extreme).** *Statement:* Because signed URLs and server-side entitlement checks are necessary but not sufficient — shared legitimate accounts, screen recording, and pre-expiry token capture remain open vectors — paid content may become accessible outside the documented threat model, resulting in loss of the platform's one hard non-negotiable. *Confidence:* Moderate — Part 7.1's threat model is thorough for URL-based attacks and explicitly does not cover screen recording.
- *Reduce likelihood:* server-side entitlement checks on every gated route (5.6, 7.1); short-lived signed URLs (Mux 15–30 min, R2 60 sec); rate limiting on download-URL generation (7.6); automated gating penetration tests completed before Week 2 ends, not discovered in Week 4.
- *Reduce consequence:* audit logging of every download-URL generation (7.6) so a suspected leak can be investigated after the fact; explicit, written acceptance from the owner that screen recording is an accepted residual risk rather than an implied promise the platform cannot keep; DRM (Part 6.5) as a costed, ready escalation path if leakage is later demonstrated.

**R3 — Third-party dependency.** *Statement:* Because the platform depends on five to seven third-party services with no documented fallback or monitoring thresholds, a single-service outage or a silently failing webhook during a launch traffic spike may leave a paying customer without access. *Confidence:* Low — no operational history yet with this specific combination of services.
- *Reduce likelihood:* Stripe webhook failure email alerts enabled in Week 1 (7.6); idempotent webhook handling (6.4, 7.3); a named owner and escalation path for each third-party service.
- *Reduce consequence:* a written runbook for "customer paid, entitlement missing" using the admin's manual entitlement override (6.8, Appendix E); hard monthly cost alerts at 80% of the Appendix B budget to catch overage before it becomes a billing surprise.

**R4 — Commercial and payment.** *Statement:* Because pricing, refund policy, and tax treatment are research-informed estimates rather than validated or fully confirmed positions, the platform may launch with pricing that under-converts, a refund policy that breaches the Australian Consumer Law, or an incorrect GST treatment. *Confidence:* Moderate on the legal findings (sourced directly from ACCC/ATO guidance, 11.3 and 11.5); low on pricing, which remains an estimate.
- *Reduce likelihood:* adopt 11.3's corrected refund-policy position before publication — it cannot state "no refunds" or "all sales final"; confirm GST/tax treatment with an accountant before the first real transaction (11.5, Appendix I); treat pricing as a post-launch iteration rather than a pre-launch blocker (4.2).
- *Reduce consequence:* Stripe Tax enabled for automatic GST/VAT handling lowers the cost of an initial tax-treatment mistake (6.4); monitor actual conversion-by-price data in PostHog/Stripe post-launch rather than re-litigating pricing pre-launch.

**R5 — Content, IP, and author voice (High).** *Statement:* Because there is no defined review gate or version-control process for published guidance, inconsistent tagging or a substance/voice error discovered after a question has been purchased may undermine the taxonomy's credibility — the platform's core differentiator — and require a costly correction to already-sold content. *Confidence:* Low — no content has been loaded and reviewed at the time of this document.
- *Reduce likelihood:* a formal author review gate before any question is published (12.7); validate tag-value consistency before loading the first 50 questions, not after (12.2); the author reviews anything public before it ships, per the brief's own non-negotiable.
- *Reduce consequence:* version published guidance so a correction is a tracked update, not a silent edit; document the content-loading schedule and named owner explicitly in Week 1 so gaps surface early rather than in Week 3.

**R6 — Data model and extensibility.** *Statement:* Because the claim that "a second subject is configuration, not a rewrite" has not been tested against a real second-section admin and discovery flow, the schema may prove insufficient once a second author or subject is actually added. *Confidence:* Low — a design-time judgement, not a proven one.
- *Reduce likelihood:* prototype the multi-subject admin and discovery surfaces before claiming extensibility is solved, rather than deferring that validation indefinitely; keep price, entitlement, and role fields decoupled from content as specified (10.1).
- *Reduce consequence:* this is explicitly a Later item (10.2) — accept the residual risk for v1 rather than over-engineering for a second section that may never arrive.

**R7 — Legal and privacy.** *Statement:* Because cookie/consent handling, data-deletion timelines, and a formal subprocessor list are not yet fully finalised, the platform may launch without complete Privacy Act 1988 readiness, resulting in an inability to correctly action a data-subject access or deletion request. *Confidence:* Moderate.
- *Reduce likelihood:* publish the subprocessor list (Stripe, Supabase, Mux, Resend, Cloudflare, Vercel, PostHog — already named in 11.2) in the privacy policy; document and test the data-deletion process before launch, not after a request arrives.
- *Reduce consequence:* confirm exact Privacy Act applicability with legal counsel (Appendix I) rather than assuming the strictest interpretation by default — but build basic data minimisation and retention discipline regardless, since it costs little to do correctly from day one.

**R8 — User adoption and discovery.** *Statement:* Because the question-discovery interface is technically the hardest and most novel part of the product and has not been tested with real target users, practitioners may not discover or understand the multi-tag filter quickly enough to convert. *Confidence:* Low — no user testing has occurred at the time of this document.
- *Reduce likelihood:* the scoring/ranking model (3.5) directly reduces the "zero results" dead end; treat the discovery interface as a named Week 1 deliverable, not an afterthought (12.4); test the homepage and filter UX with a small number of real target users before Week 4 if at all possible.
- *Reduce consequence:* the Discovery → Checkout → Purchase funnel (Appendix H) is instrumented from Week 2 specifically so a low-converting discovery flow is visible and actionable quickly rather than discovered only in a post-launch review.

**Bottom line:** proceed with this specification as the baseline, but treat the four-week plan as carrying genuine delivery risk, not a routine schedule. The two controls with the highest leverage across the register are the **Week 1 go/no-go gate** (R1) and **automated gating tests completed before Week 2** (R2) — both single points that, if skipped, let every other risk in this register compound on top of them.

---

# APPENDIX N — GLOSSARY `[CONSOLIDATED v2.0]`

| Term | Definition |
|---|---|
| ACL | Australian Consumer Law — the consumer-guarantee regime discussed in Part 11.3 |
| Entitlement | This platform's access record: links a user to a product they are allowed to consume (5.2, 5.6) |
| ERD | Entity-Relationship Diagram — the relationship map in Appendix C |
| GST | Goods and Services Tax (Australia) — discussed in Part 11.5 |
| JWT | JSON Web Token — the signed, time-limited token format Mux uses for video playback access (6.5) |
| MAU | Monthly Active Users — the usage unit most services (Supabase, PostHog) meter pricing against |
| MRU | Monthly Retained Users — Clerk's narrower billing unit; a user counts only after returning 24+ hours post-signup (6.3) |
| Presigned URL | A time-limited, single-purpose download link generated server-side (used for R2 file downloads, 6.6) |
| RLS | Row-Level Security — PostgreSQL/Supabase's database-enforced access control (5.6, 7.5) |
| SaaS | Software as a Service |
| Section | The top-level content entity scoping a subject/book/author (3.4, 10.1) — the mechanism for future multi-subject growth |
| WCAG | Web Content Accessibility Guidelines — the accessibility standard referenced in the v1 feature list (13.4) |

---

*Document version 2.0 · August 2026 · Consolidated 7 August 2026*
*Prepared as a research and pre-build specification document. All pricing figures should be re-verified from official sources before committing to any service. Sections marked `[AUDIT v1.1]` were added or corrected in the 7 August 2026 audit pass; sections marked `[CONSOLIDATED v2.0]` were merged in from earlier draft specifications on the same date. All other content is unchanged from v1.0.*
