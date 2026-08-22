# Product Strategy — *Deciding in the Dark*

**Status:** working strategy document. Rewritten 2026-08-12.
**Supersedes:** the previous contents of this file in full (a 3,157-line accretion of four
separate brainstorming passes — a strategy doc, two raw idea dumps, and a critique of the
dumps — with two conflicting section numberings and two conflicting price tables).

---

## 0. How to read this, and what it does not decide

### 0.1 What this file is

This is the **commercial strategy**: who buys, why, what we sell them, in what order, and
what has to be true before each thing can be sold. It is deliberately opinionated. Where it
recommends against something, the reason is stated so the recommendation can be argued with.

### 0.2 What this file is not

It is **not** the pricing authority. `docs/pricing.md` is. The previous version of this file
carried its own price table in bare `$`, with a proposed floor of `$19` and Decision Packs at
`$99–$199`, while `docs/pricing.md` §1 carries an **owner-adopted ladder in AUD**. Two
documents asserting different prices for the same catalogue is the same class of defect as
the template/course entitlement bug fixed in `db/seed/012`: one fact, two sources of truth,
and the cheaper source silently wins. Every price in this document is quoted **in AUD, from
the adopted ladder**. Where this document wants a price the ladder does not contain, it says
so explicitly and raises it as a decision rather than inventing a number.

It is also not the architecture authority — `docs/DESIGN.md` is — nor the delivery plan.
`docs/week1_plan.md` and `docs/week2_plan.md` hold what is actually being built and when.

### 0.3 The standing authorities this document defers to

| Question | Authority |
|---|---|
| What does a product cost? | `docs/pricing.md` |
| What is free vs paid? | `docs/pricing.md` §2, "The commercial model" `[OWNER-DECIDED 2026-08-12]` |
| How is access granted? | `app/core/entitlements.py` + `DESIGN.md` |
| Who is the buyer? | `docs/Deciding_in_the_Dark_Research_Specification.md` Part Two |
| What ships this week? | `docs/week2_plan.md` |

If this document ever disagrees with one of those, that document wins and this one is stale.

### 0.4 The one-sentence position

> **Not a store that sells risk documents. A platform that helps a risk practitioner think through a hard question, decide, act, and be able to show later why they decided that way.**

Everything below is an argument about how to get there without going broke, without drowning
a single author in maintenance, and without shipping a catalogue that looks full and converts
badly.

---

# PART ONE — THE BUYER

*The previous version of this file was written almost entirely from the seller's chair:
catalogue size, production days, margin. This part is the correction. Nothing in Parts Two
onward is valid if this part is wrong.*

## 1. The buyer is not a segment. The buyer is a person on a bad week.

The research spec (Part Two §2.1) segments by role — Practitioner, Compliance/Governance, Consultant, Executive. That segmentation is correct and stays. But role is a poor predictor of *purchase*. Two risk managers with identical titles behave completely differently depending on what is in their calendar.

**The better predictor is the trigger.** Purchases in this category are event-driven, not interest-driven. Nobody browses a risk platform for pleasure.

### 1.1 The five triggers

| # | Trigger | What just happened | Time they have | What they will pay for |
|---|---|---|---|---|
| **T1** | **The meeting** | A board or committee paper is due, and they have nothing good | Hours to days | Something they can put in front of leadership *tomorrow* |
| **T2** | **The regulator** | A question arrived that they cannot answer with what they have | Days to weeks | Evidence, alignment, defensible structure |
| **T3** | **The incident** | Something has actually gone wrong — a vendor, a breach, a breach of appetite | Hours | Sequence, escalation, who to tell and when |
| **T4** | **The new job** | Newly appointed into the role, inherited a mess, 90 days to show progress | Weeks to months | A plan, a diagnostic, a sense of what "good" is |
| **T5** | **The review** | Annual planning, audit season, framework refresh | Weeks | Structure and completeness, less urgency |

**This is the segmentation that should drive the catalogue.** It maps onto the format
question directly:

- T1 and T3 buy **artefacts and sequences**. They are in a hurry. They will pay more, not
  less, under time pressure — but only if it is obvious in ten seconds that it fits.
- T2 and T5 buy **structure and completeness**. Slower, more comparison shopping, more
  likely to need finance approval.
- T4 buys **programmes**. Highest lifetime value, lowest urgency, most likely to buy
  repeatedly over a year.

A catalogue sorted by price and production cost — which is what the previous version
proposed — ignores the only axis the buyer actually feels.

### 1.2 The urgency ladder

Sort the catalogue by **when the buyer needs it by**, not by what it costs to make:

```text
TONIGHT          →  I have a meeting tomorrow morning
                    Artefact + example + "what they'll ask you" prep
                    Must be usable within 30 minutes of purchase

THIS WEEK        →  I have to produce or respond to something
                    Artefact + method + sequence + evidence checklist

THIS QUARTER     →  I have to fix or build something
                    Diagnostic + plan + tools + review cycle

THIS YEAR        →  I have to change how the function works
                    Programme, and honestly: probably a consultant, not us
```

**The last row matters.** The platform should be honest that it does not replace a
consultant for year-long transformation. Overclaiming there is how professional buyers
learn to distrust a brand. The strong position is *tonight, this week, this quarter* — and
being unambiguously the best option in "tonight."

## 2. The ninety seconds before payment

The research spec names the #1 abandonment cause as *"unclear what they will receive before
payment."* This is under-served in every version of the product catalogue proposed so far,
because each product was described by **its component list to the seller** ("agenda, pre-read
checklist, dashboard, minutes template…") rather than by **the evidence a buyer needs**.

A professional buyer about to spend organisational money runs an unconscious checklist. Every
item that fails costs conversion:

| They check | They want to see | Today's platform |
|---|---|---|
| **What is it, literally** | Page count, file count, file formats, a real screenshot or sample page | ❌ Not specified anywhere |
| **Can I edit it** | `.xlsx`/`.docx`, not a locked PDF | ⚠️ Format shown, editability not claimed |
| **Will it open at work** | No macros, no exotic formats, reasonable file size | ❌ Not considered |
| **Who wrote it** | A named practitioner with real credentials | ✅ Author model exists |
| **Is it current** | A version and a last-reviewed date | ❌ Does not exist |
| **What if it's wrong** | A refund position they can read | ❌ Open — `week2_plan.md` decision #17 |
| **Can I expense it** | A tax invoice, business name, ABN | ⚠️ Stripe config, not yet verified |
| **Can I use it with a client** | Licence terms on the product page | ❌ Open — research spec §11.4 |

**Six of the eight are content or configuration, not engineering.** That is the cheapest
conversion work available and none of it is in any product plan. It is worth more than the
next three products.

### 2.1 The preview is a product feature, not marketing

For every paid artefact, the product page must show **actual content** — one real page, one
real sheet, one real slide — not a blurred thumbnail. The buyer's question is not "is this
nice" but "is this the shape of the thing I need." Blurring is a conversion tax paid to
prevent a theft that mostly does not happen at this price point.

## 3. The corporate laptop is a real constraint

This audience does not open files on a personal machine. They open them on a managed
corporate device, and that device is hostile:

- **Macros are blocked** by default in most regulated organisations. An `.xlsm` is, for a
  meaningful share of buyers, an unopenable file and therefore a refund.
- **Downloads from unrecognised domains** may be blocked or quarantined.
- **SharePoint/OneDrive round-trips** can strip formatting, break links, and mangle
  conditional formatting.
- **Old Excel versions** still exist in government and health. Dynamic arrays, `XLOOKUP`,
  and newer functions silently fail.
- **Corporate email filters** may quarantine the receipt containing the download link.

**Rules that follow:**

1. No macros in any sold artefact. Ever. If logic is needed, use formulas that degrade
   visibly rather than silently.
2. Ship `.xlsx` and `.docx`, not `.xlsm`, `.numbers`, `.pages`, or Notion links.
3. State the minimum Office version on the product page if anything modern is used.
4. Where a product is genuinely visual (a board deck), ship **both** the editable source and
   a PDF, because half of them will not have the fonts.
5. The download must work from inside the library **without** relying on the email arriving.
   The email is a convenience; the library is the delivery mechanism.

**This is not a nitpick.** "It didn't open" is the single most likely refund cause for a
digital artefact sold into corporate environments, and it is entirely preventable.

## 4. The expense path decides the price ceiling

The research spec (§2.4) already establishes that Segment B spends organisational budget and
often needs a tax invoice with an ABN before finance approves. What the previous strategy
missed is the consequence:

> **Every price increase moves the purchase from a personal card to a finance approval.**

The threshold varies by organisation, but the pattern is consistent:

| Price band | Who approves | What must be true |
|---|---|---|
| **Under ~A$50** | Nobody. Personal card, expensed later, nobody looks | Card receipt is enough |
| **A$50–150** | Self-approved but visible; will be seen on a statement | Itemised receipt, recognisable merchant name |
| **A$150–500** | Manager approval, often a purchase order | **Proper tax invoice, ABN, business name.** Possibly a supplier record |
| **Over A$500** | Procurement | Supplier onboarding, insurance, possibly security review |

The previous strategy proposed raising the price floor to `$19` and launching a flagship at
`$99–$199` **without noting that the flagship sits precisely where finance approval begins.**

**The conclusion is not "don't charge A$199."** It is: *you cannot charge A$199 until the
tax-invoice path is verified end to end.* A buyer who cannot expense your product does not
haggle — they silently leave. This is a hard prerequisite on the flagship, and it is
configuration work, not development work.

**Open question for the owner:** the contracting entity is still undecided (research spec
§11, `[OPEN DECISION]`). Whether invoices read as the author personally, the brand, or
Effective RM determines what appears on every receipt. This blocks the >A$150 tier, so it
should be answered before the flagship is priced, not after.

## 5. Refunds: raising prices raises exposure

Australian Consumer Law does not permit a blanket "no refunds on digital goods." The refund policy is still open (`week2_plan.md` decision #17), and the previous strategy raised prices
without touching it.

The exposure is asymmetric and price-dependent:

- A refunded **A$29 template** is noise.
- A refunded **A$249 implementation kit**, fully downloaded on day one, is a real loss with
  no way to claw back the goods.

**Mitigations, in order of usefulness:**

1. **Preview honestly** (§2.1). Most refunds are expectation failures, not quality failures.
2. **Format guarantees** (§3). Most of the rest are "it didn't open."
3. **Stage the value** for high-price products. A programme delivered in weekly instalments
   has a natural, defensible refund boundary that a one-shot zip does not.
4. **A stated policy** the buyer can read before paying. Professional buyers check. A clear
   14-day position converts better than silence, even though silence sounds safer.

This is another reason the flagship should not be the first thing built at the top price.

## 6. What brings them back

The research spec's answer (§2.3) is: the first purchase gave a specific answer they actually
used. That is right, and it argues against breadth. But there is a second mechanism worth
naming, because it is the one the platform is structurally able to own:

> **They come back because their work is here.**

A file they downloaded lives in their Downloads folder and is gone from your platform forever. A decision they recorded, a diagnostic they completed, a register they built inside your product — that is a reason to log in again in six months.

This is the strategic argument for Part Three.

---

# PART TWO — PRODUCT PRINCIPLES

## 7. Sell outcomes — but name for search

The original document's central principle is correct and stays:

> **Sell outcomes, not files.**

`Build Your Risk Appetite Framework` beats `Risk Appetite Template` because it names the job.

**But the original took this too far, and it costs discovery.** The research spec documents
Segment A's discovery path as *Google search on a specific question ("ISO 31000 risk appetite
statement template")*. Nobody searches for "Decision Pack." Nobody has ever typed "Review and Improve Your Risk Function in 30 Days" into a search bar.

Optimising the product name for the product page while pessimising it for the search that brings people to the page is a bad trade.

**The resolution — both, in fixed positions:**

```text
Page title  (search-findable, literal artefact language)
    Risk Appetite Statement Template — ISO 31000 aligned

Product name (outcome language, what they're buying)
    Build Your Risk Appetite Framework

Subhead      (the outcome, concretely, with a time)
    Produce a board-ready appetite statement in a week —
    with the questions leadership will ask you, and your answers.
```

The outcome framing does the *converting*. The literal framing does the *finding*. The
previous version only had one of the two.

## 8. The question is the spine

Preserved from the original, because it is the strongest structural idea in it. Each of the
100 questions is a content node, and everything else hangs off it:

```text
                         QUESTION
                            │
             ┌──────────────┼──────────────┐
           Learn           Use            Apply
             │              │              │
          Lesson        Template       Checklist
             └──────────────┼──────────────┘
                            │
                       THINK / TEST
                            │
                       Scenario Pack
                            ↓
                         DECIDE
                            │
                      Decision Pack
                            ↓
                           ACT
                            │
                       Action Plan
                            ↓
                         REVIEW
```

**Why this is worth protecting:** it is the only part of the model a competitor cannot copy
in an afternoon. Anyone can sell risk templates. The 100 questions, tagged across seven
dimensions, with products routed off them, is a structure — and structure is defensible in a
way that files are not.

**The practical rule:** every paid product must link to at least one question, and every
question should be able to name what you would buy if you wanted help with it. If a product
cannot be attached to a question, that is a signal it belongs to a different business.

## 9. The six product families

Preserved from the original's best section (its §21), because six families is the right
order of magnitude and twenty formats is not.

| Family | The buyer's words | Formats |
|---|---|---|
| **1. Assess** | "Where are we?" | Diagnostic, maturity review, gap assessment |
| **2. Decide** | "What should we do?" | **Decision Packs**, decision trees, question packs, **Scenario Packs** |
| **3. Build** | "Help me create the thing" | Templates, template packs, policy starters, board packs |
| **4. Run** | "Help me run the session" | Workshop kits, tabletop exercises, meeting packs |
| **5. Implement** | "Help me actually execute" | 30/90-day kits, trackers, action plans, review tools |
| **6. Professional** | "I need more than a file" | Consultant licences, expert review, team licences |

**Family 2 is the brand.** Families 3 and 4 pay the bills early. Family 6 is the best
unbuilt revenue opportunity (§20). Family 1 is the acquisition engine.

## 10. The ten tests

Every proposed product scores against these before anything is produced. Preserved from the
original — it was the most useful thing in the critique section.

| Test | Question |
|---|---|
| **Urgency** | Does someone need this *now*, on a trigger from §1.1? |
| **Value** | Does it save meaningful time or reduce real uncertainty? |
| **Specificity** | Does it solve one clearly defined problem? |
| **Differentiation** | Why buy this instead of the first Google result? |
| **Production cost** | How many author-days? |
| **Maintenance** | How often does it go stale, and who notices? |
| **Reuse** | Can the same research power more than one product? |
| **Upsell** | Does it naturally lead to another purchase? |
| **B2B fit** | Can a professional expense it without a conversation? |
| **Brand fit** | Does it reinforce *deciding under uncertainty*? |

A product failing three or more should not be built, however useful it sounds.

## 11. The no-overlap rule `[NEW]`

The original diagnosed product proliferation well — "60 products that are actually 8 pieces of
content" — but treated it as a discipline problem. It is worse than that: **the schema makes
proliferation frictionless.** `product_contents` is polymorphic, so spinning up a new product
over existing content rows takes seconds and no new content at all. A convenience becomes a
trap.

So the rule needs to be mechanical, not aspirational:

> **No two published products may grant overlapping content, unless one is explicitly a
> superset of the other and is sold as a bundle at a visible discount.**

This is checkable in SQL, and belongs as an **admin publish guard** alongside the ones already
built (a template cannot publish without a file; a video lesson cannot publish without a Mux
asset). Attempting to publish a product whose `product_contents` intersect a published
product's should fail closed with a message naming the conflict.

**This rule would have caught the A$29-template-grants-the-whole-course bug before a customer
did.** That is the argument for it.

## 12. The one-author constraint

Every artefact ships under a real practitioner's name — the brief's non-negotiable. This is
the brand's main asset and its hardest production limit.

**Consequences the catalogue must respect:**

- The catalogue can only grow as fast as one person can write and stand behind.
- "Spin up 40 SKUs" is not available at any budget, because ghost-written volume under a real
  name is precisely the thing that destroys the asset.
- Anything bought in from a third-party template library is a brand risk, not a shortcut.
  *(Live example: the current paid template's source files carry `IC-…-10772` naming typical
  of a commercial template library. Provenance is unconfirmed and flagged in
  `week2_plan.md`'s risk watchlist. This is exactly the failure mode this section is about.)*
- AI-assisted drafting is fine for structure; AI-generated *substance* under the author's name
  is the fastest way to lose the audience the research spec describes, who explicitly
  distrust "obvious AI-generated padding."

**Design the catalogue for depth, because breadth is not physically available.**

---

# PART THREE — THE FLAGSHIP

## 13. The problem with the Decision Pack as specified

The original names the Decision Pack as the signature format and says:

> "The customer is buying a structured decision process, not nine individual files."

Then it specifies exactly nine files: a lesson, seven questions, a worksheet, a comparison,
a framework, a board template, a decision log, an action plan, and a review checklist.

**As specified, the customer receives nine files.** Calling a zip a process does not make it
one. At A$99–199 — the top of what an individual can approve without finance — the buyer
opens it, finds nine documents, and reasonably concludes they bought a template pack with a
narrative. That is a refund, or worse, a quiet non-recommendation.

This is the single most important gap in the previous strategy, and it is fixable.

## 14. What a Decision Pack has to be instead

A Decision Pack should be **a workspace that produces a record**.

```text
START
  │   Creates a decision record in My Library.
  │   Dated. Named. Owned. Resumable.
  ↓
FRAME          What are we actually deciding? Who owns it? By when?
  ↓
ASK            The relevant questions, one at a time.
               The user types their answer. Their words, saved.
  ↓
EVIDENCE       What supports that? What's missing?
               Checklist, with gaps visible rather than implied.
  ↓
OPTIONS        The realistic choices, and what each costs.
  ↓
DECIDE         The call, the reasoning, the dissent, the review date.
  ↓
OUTPUT         Generated, not blank:
                 • a decision summary that pastes into a board paper
                 • a decision log entry
                 • a 30-day action plan seeded from the answers
  ↓
REVIEW         Reopens on the review date. "Is this still true?"
```

The templates, checklists and board deck are still there. They are **components**, filled in
from what the user already typed, rather than nine blank things to reconcile by hand.

### 14.1 Why this is the right product

**For the buyer:**
- It survives them. Six months later, when the board or a regulator asks *"why did we decide
  that?"*, the answer exists with a date on it. That is worth real money to someone in a
  regulated organisation, and no PDF provides it.
- It produces the deliverable, which is what T1 and T2 buyers are actually short of.
- It reduces the blank-page problem, which is the real reason template packs go unused.

**For the business:**
- **It is defensible.** A competitor can clone nine files in an afternoon. They cannot clone a
  customer's decision history.
- **It creates the return visit** (§6). The user's own work lives here.
- **It justifies the price.** A$199 for nine documents is a stretch. A$199 for a decision
  record you can put in front of a regulator is not.
- **It is the natural host for the AI feature** (Part Six) — there is finally something to
  challenge, because the user has typed their actual reasoning.
- **It feeds the diagnostic**: a gap identified in Family 1 becomes a decision record in
  Family 2.

### 14.2 The architecture already supports it

`product_contents` is polymorphic (`template` | `lesson` | `question_set`). A fourth type —
`decision_workspace` — is an enum addition and a new table, not a rebuild. The entitlement
choke point in `app/core/entitlements.py` does not change at all: a product grants whatever
its rows point at, and it would now be able to point at a workspace.

**This matters because it means the recommendation is buildable rather than aspirational.**
The `DESIGN.md` content-store framing — "adding a content type is a catalogue decision, not an
architecture decision" — is exactly the promise being cashed in here.

### 14.3 But it is real engineering, so sequence it honestly

A template is a file upload. A workspace is a schema, an editor, autosave, a generator, and a
review scheduler. Weeks, not days — and it lands on a codebase that currently has **no
automated test coverage at all** (`week2_plan.md` Phase 1 exists to fix that).

**So do not launch the flagship at the flagship price.**

| Stage | What ships | Price | What it proves |
|---|---|---|---|
| **v0** | The files, well made, honestly described as a structured pack. No workspace claim. | **A$79** (adopted ladder) | Does anyone want this decision framed this way? |
| **v1** | Workspace: framing, questions, saved answers, decision record in My Library | **A$149** | Does saved reasoning change usage and retention? |
| **v2** | Generated outputs, review scheduling, AI challenge | **A$199** | Is it worth the top of the ladder? |

v0 is producible now with author time only. It is also a real demand test: if A$79 does not
sell, A$199 with a workspace will not either, and you will have learned that for the cost of
a few author-days rather than a month of engineering.

**Every price above is on `docs/pricing.md` §1's adopted ladder.** No new numbers invented.

## 15. Scenario Packs, and how they differ

Kept from the original — it is the second-strongest idea in it — with one correction.

| | Decision Pack | Scenario Pack |
|---|---|---|
| Question | "What should we do?" | "What do I do *right now*?" |
| Trigger | T2, T4, T5 | **T3 — the incident** |
| Time | Days to weeks | Hours |
| Shape | Linear process | **Branching** |
| Output | A decision record | A response log |

The original's insistence on **specificity** is right and worth repeating:

> Weak: "A critical vendor fails."
> Strong: **"It is 5pm on Thursday. Your payroll provider emails to say it has had a
> cybersecurity incident."**

**The correction:** the original proposed a five-pack initial catalogue. That is wrong for
T3. An incident buyer is not shopping — they are in the middle of something and will buy the
*one* thing that matches. Five half-researched scenarios serve nobody; one excellent one
serves the person it fits completely. Ship one. Its usage will tell you whether the format
works before you fund the second.

There is also a hard constraint the original acknowledged for tabletops but not for scenario
packs: **branching content that touches regulation, contracts, or jurisdiction goes stale and
becomes a liability.** Keep the branches on *internal governance* — escalate, notify whom,
what evidence, who decides — and treat external legal/regulatory obligations as "consult, and
here is what to ask," never as answers.

---

# PART FOUR — PRICING

## 16. One authority

`docs/pricing.md` §1 holds the owner-adopted ladder. It is reproduced here **for reference
only** — if these ever differ, `pricing.md` is right:

```text
FREE     Free question / resource
A$29     Individual template
A$49     Professional checklist
A$79     Short practical course
A$99     Template pack
A$149    Full professional course
A$199    Course + resources
A$279    Practitioner bundle
A$399    Complete programme
```

**All amounts AUD.** Currency was settled in `week1_plan.md` decision #5 and matches what is
live in Stripe. The previous version of this file quoted bare `$`, which reads as USD and
would have produced a real mispricing the first time someone copied a number from it.

## 17. Mapping the proposed formats onto the adopted ladder

The previous version invented a parallel price table. Instead, here is every format it
proposed, placed on the **existing** ladder:

| Format | Ladder tier | Reasoning |
|---|---:|---|
| Free question / free template | **FREE** | Settled 2026-08-12 |
| Individual template | **A$29** | Ladder's named tier |
| Better professional template | **A$39–49** | `pricing.md` tiering rules; the live paid template sits at A$39 |
| Question Pack | **A$49** | "Professional checklist" tier |
| Meeting Pack | **A$79** | More than a checklist, less than a course |
| Template Pack | **A$99** | Ladder's named tier |
| Scenario Pack | **A$99–149** | Higher than a pack; needs the branching to earn A$149 |
| **Decision Pack v0 (files)** | **A$79** | Honest price for a well-made structured pack |
| **Decision Pack v1 (workspace)** | **A$149** | Now genuinely more than documents |
| **Decision Pack v2 (+ outputs, AI)** | **A$199** | Top of the individual-purchase range |
| Workshop / Tabletop kit | **A$199** | Runs a leadership session; highest per-use value |
| Implementation Kit (30/90-day) | **A$279** | "Practitioner bundle" tier |
| Full programme | **A$399** | Ladder ceiling |

**Nothing here requires a new tier.** That is a sign the adopted ladder was well chosen.

## 18. The price-floor argument, and what it actually costs

The original argued against $5–15 products and for a ~$19 floor. **The direction is right**
for the reasons it gives: professional buyers read very low prices as low credibility, and a
platform that trains its audience to expect A$9 downloads cannot later sell A$199 decision
support to the same people.

**But the original stated only the benefit.** The costs of a higher floor, all of which land
on the buyer side:

1. **Finance approval enters** above ~A$150 (§4). Tax invoice becomes a hard prerequisite.
2. **Refund exposure scales** (§5), against an unresolved ACL position.
3. **Trust apparatus must scale with price.** At A$29 nobody checks who you are. At A$199 they
   check for a real business, a refund policy, a privacy policy, and an author with a
   verifiable track record. **Raising prices without raising the trust apparatus lowers
   conversion.**
4. **Support load scales.** Every paid product generates "it won't open," "which version is
   this," "can I use this with a client." A solo author selling at A$199 has a support job
   nobody has costed.

**The recommendation stands, with a precondition:** hold the floor at **A$29**, and treat
**A$99** as the ceiling until the tax-invoice path, refund policy and licence terms are live.
Those three unlock the A$149–399 range. They are cheap. They are also, currently, nobody's
job.

## 19. Free is already decided — stop re-litigating it

The previous version spent a section (its §21) debating which domain should be the free entry
point, weighing Governance vs Risk Appetite vs Third-Party Risk.

**That question was answered on 2026-08-12** and is live in the product:

```text
Questions (all 100)             — free, no account
Risk Register Template          — free, email capture
All other templates             — paid
Courses                         — paid
```

The open question is not *what* is free. It is whether the free tier **demonstrates the
differentiator**. Today a visitor can read questions and download one template — which proves
the content is real but never shows them the thing no competitor has: multi-dimensional tag
filtering that answers *"what should I fix first?"*.

**The free experience should route:**

```text
Question → its seven tags → related questions → "what would help here"
```

That is the demo. It costs no new content — the tags and relations already exist in the
database — and it is worth more than another free giveaway.

## 20. Licensing: the best unbuilt revenue `[PRIORITY]`

The original put consultant licensing under "delay." **That is the wrong call**, and it is
the most valuable disagreement in this rewrite.

**The reasoning:**

- Segment C (consultants) buys **multiple** artefacts, to adapt for clients. Highest revenue
  per buyer in the research.
- The research spec's own recommendation (§2.4) is that visible licence terms are a **v1**
  item because their absence *stalls* repeat purchase — the consultant who cannot tell whether
  client use is permitted buys **one** template and stops.
- It is a **content task, not an engineering task**: a licence field on the product and a
  paragraph on the page.
- It monetises **existing** artefacts. No new content required — the rarest property in this
  entire document.

**The tiering:**

| Licence | What it permits | Indicative |
|---|---|---:|
| **Standard** | Use inside your own organisation; adapt freely | Product price |
| **Client delivery** | Use with named client engagements, adapted, attributed | ~3× |
| **Multi-client** | Use across engagements, white-label rights defined | Negotiated |

**The warning from the original is correct and must be kept:** licence terms have to be
precise about modification, client distribution, white-label, resale, client count,
attribution and redistribution. *Never* casually write "commercial use allowed."

**Two open decisions this needs** — both the owner's, not engineering's: whether client
delivery is permitted at all, and at what multiple. Research spec Appendix J flags the first
as `[OPEN DECISION]` and it has not moved.

---

# PART FIVE — DISCOVERY AND RECOMMENDATION

## 21. What the seven tags actually are `[CORRECTION]`

The previous version repeatedly claimed the seven tags could power product recommendation:

> "I have two weeks, a low budget and high regulatory pressure" → recommend products.

**That cannot be built on the tags that exist.** Here is what is actually in the database
(`db/seed/001`, 26 values across 7 dimensions):

| Dimension | Values | What it describes |
|---|---|---|
| `effort` | quick / mod / project / trans | Effort to address **the risk issue** |
| `duration` | xs / s / m / l / xl | Elapsed time to address **the issue** |
| `cost` | low / medium / high | Cost of **the remediation** |
| `roi_horizon` | quick / mid / strategic | Payback of **the fix** |
| `tier` | f / t / s / x | Foundational → transformational |
| `regulator_pressure` | n / l / m / h | Regulatory attention on **the topic** |
| `leadership_traits` | 1–5 | Accountability / change / collaboration / technical / strategic |

**These tags describe the work the question implies — not the product.** `cost: low` means
*fixing this risk issue is cheap*, not *this product is cheap*. `duration: xs` means *the
remediation takes under two weeks*, not *this is a short course*.

Reading them as product attributes would produce actively wrong recommendations: a
`cost: high, duration: xl` question is a **transformational programme** for the customer, and
the right product for it may well be a A$29 template that helps them scope the business case.

## 22. The routing model that does work

Do not add a parallel product taxonomy. Route **through** the questions:

```text
The user's situation
   ("two weeks, low budget, high regulatory pressure")
        ↓
   filter QUESTIONS on the seven tags        ← already built, already indexed
        ↓
   the questions that match their reality
        ↓
   products linked to those questions        ← product_contents already does this
        ↓
   "Here's what would help with these"
```

**Why this is better than tagging products:**

1. **It works today.** Both halves exist. Question tag filtering is built; `product_contents`
   already links products to content. What is missing is the join and the UI.
2. **It stays honest.** The recommendation is derived from the user's *situation*, not from a
   marketing tag someone set on a product page.
3. **It has no second taxonomy to maintain.** One set of tags, on the content that has them
   naturally.
4. **It explains itself.** "We're suggesting this because it addresses questions 14, 31 and
   62 — which match your constraints" is a far stronger recommendation than "customers also
   bought."
5. **It makes the questions more valuable the more products exist**, which is exactly the
   compounding property you want from the spine.

**One honest limitation:** this only recommends products that are linked to questions. That is
a feature — see §8's rule that every product must attach to at least one question — but it
means the linking work is load-bearing, not optional metadata.

---

# PART SIX — AI, HONESTLY

## 23. "Challenge My Thinking" is the right AI feature

The original's judgement here is good and is preserved. A generic risk chatbot is a
commodity and a liability. An AI that **tests the user's reasoning** is neither.

```text
User:  "Risk ownership is clear — every risk has a named owner in the register."

AI:    What evidence shows those owners actively manage them?
       How are overdue actions handled?
       When was ownership last challenged?
```

The AI is not answering. It is doing what a good senior colleague does: asking the question
that reveals the answer is thinner than it sounded. That is on-brand in a way a chatbot never
is, and it is genuinely hard to copy.

## 24. Three prerequisites the original skipped

### 24.1 It is blocked on editorial capacity, not engineering

The guardrails require, **per question**: expected reasoning areas, common weak answers,
follow-up questions, evidence requests, red flags.

That is 100 questions × real editorial work by the author — **on a content base where 99 of
the 100 questions still carry a machine-derived preview** rather than a hand-written one
(`docs/handover.md`). The AI feature is downstream of an editorial backlog that has not been
started.

**Implication:** it cannot be "early V2" as the original proposed. It arrives after the
preview backlog, and it should launch on **one** question set — the one the flagship Decision
Pack covers — not all 100.

### 24.2 The confidentiality problem `[NEW — unaddressed in the original]`

The feature asks a risk professional to type their **organisation's actual risk position**
into a text box. Real weaknesses. Real vendor names. Possibly incident detail.

That is confidential third-party information leaving a regulated organisation and going to a
model provider. For this audience specifically — people whose job is third-party risk — this
is the exact thing they assess other vendors on. They will ask, and "we hadn't thought about
it" ends the sale.

**Prerequisites before this ships:**

- An explicit statement of where the text goes, who processes it, and how long it is retained.
- A no-training-on-customer-data commitment from the provider, stated on the page.
- The ability to use a Decision Pack **fully without AI**. The AI is an accelerant, never a
  gate — many buyers will be contractually unable to use it.
- Privacy policy coverage before launch, not after (`week2_plan.md` Phase 4).

**This is not a legal footnote. It is a product requirement**, and for a meaningful share of
the target market it determines whether the flagship is usable at all.

### 24.3 It must not become the product

The original's closing line on AI is right and worth keeping verbatim:

> **The AI should follow the product rather than becoming the product.**

## 25. AI sequencing

| Stage | Feature | Gate |
|---|---|---|
| **Now** | Nothing | Editorial backlog, no test coverage |
| **After Decision Pack v1** | Challenge My Thinking, **one** question set | Guardrails authored; privacy position published |
| **Later** | Contextualised questioning (role, industry, regulator) | Demand proven |
| **Later still** | Executive brief generator | Workspace holds enough structured input |
| **Speculative** | Board pack builder | Everything above works |

---

# PART SEVEN — THE CATALOGUE, AGAINST REAL CAPACITY

## 26. What exists today

An honest inventory, because every plan in the previous version was written as if the shelf
were fuller than it is:

| | Live | Note |
|---|---|---|
| Questions | **100** | Free. 99 have machine-derived previews |
| Domains | **5** | Risk, Cyber, Compliance, Resilience, AI |
| Tag values | **26** across 7 dimensions | Built, filterable |
| Courses | **1** | 2 modules, 3 lessons, 1 real video |
| Templates | **2** | 1 free (email capture), 1 paid at A$39 |
| Paid products | **2** | Course A$49, template A$39 |
| Bundles | **0** | Nothing to bundle yet |
| Decision Packs | **0** | — |
| Scenario Packs | **0** | — |
| Diagnostics | **0** | — |
| Stripe | **test mode** | `rk_test_`; going live is its own pass |
| Automated tests | **none** | `week2_plan.md` Phase 1 |

## 27. The capacity arithmetic

The previous version's "Phase 1 catalogue" proposed **eight products**. At its own stated
production estimates:

```text
Template Pack        2–3 days
Meeting Pack         1–2 days
Question Pack        1–2 days
TPRM Toolkit         2–3 days
Decision Pack        3–5 days
Scenario Pack        2–4 days
Diagnostic           "higher technical/content effort"
30-Day Kit           4–6 days
                     ──────────
                     ~25 author-days, plus engineering for the diagnostic
```

Against this, Week 2 alone is already committed to: the gating test suite, lesson content
blocks, the storefront, legal pages, analytics, and admin hardening. There is no author-week
in that plan, and there is no engineering week available for a diagnostic.

**So the previous "Phase 1" was not a plan. It was a wish list with a heading.** Eight
products is roughly a quarter of solo author time with nothing else happening — and something
else is always happening.

## 28. The next three products, and why exactly these

Not eight. **Three**, sequenced so each one earns the next.

### Product 1 — Risk Committee Meeting Pack · **A$79** · ~2 author-days

**Trigger:** T1 — the meeting. The single most common, most urgent, most repeated trigger.
**Why first:**
- Highest urgency-to-effort ratio in the whole catalogue.
- Recurs. Committee meetings happen every quarter, forever.
- Reuses existing question content (the governance questions are already written and tagged).
- It is the natural upsell from the free template — same buyer, same week, bigger problem.
- Cheap to make well because the components are documents, which the author can produce.

**Ships:** agenda, pre-read checklist, top-risk summary format, decisions-required page,
action tracker, minutes template, follow-up checklist — **plus a completed worked example**,
which is what separates this from the thousands of free agendas online.

### Product 2 — Decision Pack v0: "Should We Change Our Risk Appetite?" · **A$79** · ~4 days

**Trigger:** T2/T4.
**Why second:** it tests the flagship *format* at a non-flagship price, with no engineering.
If this does not sell at A$79 as files, it will not sell at A$199 as a workspace, and you
will have learned that cheaply. If it does sell, the workspace build is justified by evidence
rather than by this document.

### Product 3 — Risk Function Diagnostic · **FREE** · engineering + ~3 author-days

**Trigger:** T4, and everyone else at the top of the funnel.
**Why third — and why free:**
- It is the acquisition engine. The original was right that this is one of the strongest
  ideas, and right that the output must be *"what should I do next"* rather than a maturity
  chart.
- It produces the **recommendation** that §22's routing model was built for — this is the
  feature that finally makes the seven tags visible to a buyer.
- It generates the email list that everything else sells to.
- Free removes every objection at the exact moment someone is deciding whether this platform
  is serious.

**Note it is the only one of the three requiring engineering** — so it is correctly last, and
correctly scoped after `week2_plan.md`'s Phase 1 test suite exists to protect it.

**Total: ~9 author-days plus one engineering feature.** That is a real quarter, honestly
sized, against a plan that already has other commitments.

## 29. The twelve-month shape

Directional, and explicitly not a commitment:

```text
Now      →  Meeting Pack · Decision Pack v0 · Diagnostic (free)
            + licence terms + tax invoice + refund policy   ← unblocks everything above A$99

Then     →  Whichever of the three sold. Second in that family.
            Decision Pack v1 (workspace) if v0 proved demand.
            One Scenario Pack — one, not five.

Later    →  Workshop kit (highest per-use value, Family 4)
            Consultant licensing tiers on the existing catalogue
            Challenge My Thinking on one question set
            First real bundle, once two products deserve bundling

Not yet  →  Everything in §30
```

## 30. What is cut and what is deferred

Preserved from the original's critique, which was largely correct.

### Cut — do not build

| Idea | Why |
|---|---|
| **Glossaries** as paid products | Low perceived value, trivially reproducible. Use free, for SEO |
| **Interview / career products** | Different customer job. Blurs a brand that should own *doing* risk work, not *getting* risk jobs |
| **Standalone generic checklists** | "I could make this myself." Strong *inside* a larger product, weak alone |
| **Seasonal packs** | Many small products each needing their own marketing push |
| **"Advanced" versions** | Artificial differentiation. If the difference is more columns, the buyer notices |
| **Large generic policy/control libraries** | Maintenance with no defensible edge |
| **Broad AI chatbot** | A commodity and a liability. §23 is the better feature |

### Deferred — good, but not now

| Idea | Gate |
|---|---|
| **Framework crosswalks** (ISO/NIST/DORA/SOC 2) | Genuine maintenance trap: every framework revision means re-research, re-verify, re-publish, notify, maintain old versions. Also risks implying false equivalence. Start with **one** mapping after demand is proven, never ten |
| **Clause banks** | Drifts toward legal drafting: jurisdiction, contract context, liability. If ever built, name it a *risk consideration* bank and require legal review explicitly |
| **Expert review / doc critique** | Turns a product business into a services business: scheduling, capacity, turnaround, confidentiality, liability. If 100 people buy, someone reviews 100 documents. Only ever as strictly limited monthly slots |
| **Tabletop exercises** | Excellent format, high production cost. Needs realistic timelines, conflicting priorities, incomplete evidence, facilitator notes. Launch **one** and see |
| **Industry-specific variants** | Content multiplication before product-market fit |
| **Team/organisation licensing** | Sequence after individual demand is proven |
| **Benchmark reports** | The original's analysis is right and worth keeping: sample size, selection bias, and the fact that purchase data shows what people *bought*, not whether their risk function improved. Also consent and privacy exposure. Gate: 500–1,000 engaged users, explicit research consent, documented methodology, defensible statistics. **A weak benchmark under the author's real name damages more than it earns** |
| **Annual update subscriptions** | Changes the business model; needs its own decision |

---

# PART EIGHT — RETENTION

## 31. Question of the Week

One recurring mechanism, not the two near-identical sections the previous version carried.

```text
This week's question:
  "Do your risk owners actually own the risks assigned to them?"

  Effort: Quick      Regulator pressure: Moderate
  Duration: XS       Leadership: Accountability

  → Read it
  → One thing to do about it this week
  → What would help
```

**Why it works:** it gives the free email list a reason to stay subscribed, keeps the
100-question asset in circulation instead of sitting in an archive, and makes the tags
visible every single week. It is also the cheapest retention mechanism available — the
content already exists.

**One constraint:** 52 of these a year is a real editorial commitment. Better fortnightly and
sustained than weekly and abandoned by March.

## 32. The second purchase

The commercial question the catalogue must answer is *why does someone buy a second time?*

```text
Free question / free template
        ↓  they hit a real problem
Meeting Pack             (T1 — the meeting is next week)
        ↓  the meeting exposes a weak spot
Decision Pack            (T2 — now they have to decide something)
        ↓  the decision needs implementing
Implementation Kit       (T4 — 30/90 days of work)
        ↓  a year later
Annual Review Pack
```

Each step is triggered by the **previous product doing its job**, not by a discount. That is
the difference between a catalogue and a system, and it is only possible because of §8's rule
that products attach to questions.

**The metric that tells you whether this works is in §34.**

## 33. Versioning and the update promise `[NEW]`

The original mentions versioning once, in a list, and never resolves it. For products
claiming regulatory relevance this is a **trust** question, not a housekeeping one.

A buyer six months out asks: *is what I downloaded still current?* Today there is no answer.

**Minimum viable position:**

1. Every sold artefact carries a **version** and a **last-reviewed date**, visible before
   purchase and inside the file.
2. `pricing.md` already promises *"lifetime access, including future updates to whatever was
   purchased."* **That is a real commitment and nobody has costed it.** Ten products × two
   revisions a year is a standing obligation on the author.
3. When a product updates, buyers are notified and My Library serves the new version.
4. Old versions remain downloadable — someone's board paper cites what they had at the time.

**Point 2 is the one to think hard about.** The update promise is already made in a live
document. It is a good promise — it is a large part of why professional buyers accept
one-time pricing over subscription — but it should be made deliberately, with a known
maintenance load, rather than inherited from a sentence.

---

# PART NINE — WHAT THIS MEANS FOR THE BUILD

## 34. Engineering implications

Ordered by leverage, mapped to what exists:

| # | Change | Exists? | Effort |
|---|---|---|---|
| 1 | **Tax-invoice-quality receipts** (business name, ABN, itemised) | Stripe config | Hours. Blocks everything >A$150 |
| 2 | **Licence field + terms on product pages** | New field, content | Hours. Unblocks Segment C repeat purchase |
| 3 | **Version + last-reviewed on artefacts** | New fields | Hours |
| 4 | **Overlap publish guard** (§11) | Pattern exists in admin guards | ~Half a day. Prevents a repeat of the 012 bug |
| 5 | **Question → product routing** (§22) | Both halves exist; join + UI missing | ~1–2 days. Makes the tags visible |
| 6 | **Preview/sample assets on product pages** | Storage exists | Content work |
| 7 | **Diagnostic** | New | Real feature |
| 8 | **`decision_workspace` content type** | `product_contents` is polymorphic — enum + table | Real feature, no rebuild |
| 9 | **Analytics events** (below) | PostHog planned, `week2_plan.md` Phase 4 | Config |

**Items 1–4 total roughly one engineering day and unblock the entire upper price range.**
They should not queue behind any new product.

### 34.1 Analytics worth having

Keep it small enough to actually read:

```text
question_viewed          (question, domain, tags)
tag_filter_used          (dimensions, values)      ← is the differentiator being used?
product_viewed           (product, referrer)
product_purchased        (product, price, trigger if known)
template_downloaded      (template, first-time vs repeat)
recommendation_clicked   (source question → product)  ← does §22 routing work?
second_purchase          (days since first)            ← the one that matters
```

## 35. The metrics that matter

Five. Not the twenty-five the previous version listed, because a metric nobody reads is
overhead.

| # | Metric | Why |
|---|---|---|
| **1** | **Second-purchase rate** | Is this a system or a series of one-off transactions? The single most informative number |
| **2** | **Free → paid conversion** | Is the free tier earning its keep or just giving things away? |
| **3** | **Tag-filter usage** | Is the actual differentiator being used, or is everyone browsing a list? |
| **4** | **Refund rate by product** | Where is the expectation gap? A single product refunding is a description problem, not a quality one |
| **5** | **Time from signup to first purchase** | Are we serving urgency (§1.2) or hoping for slow consideration? |

**Metric 1 is the thesis of this document.** If people buy once and never return, the
outcome-based catalogue is not working, and the honest response is to sell better individual
artefacts rather than to add more product families.

---

# PART TEN — OPEN DECISIONS

Continuing the project's decision-log convention. `week1_plan.md` and `week2_plan.md` hold
#1–23; these start at **#24**. All are the owner's calls, not engineering's.

| # | Decision | Blocks |
|---|---|---|
| **24** | **The contracting entity** — author personally, the brand, or Effective RM? Determines what appears on every invoice and legal page. Already flagged `[OPEN DECISION]` in the research spec and unmoved | Every price above ~A$150 (§4) |
| **25** | **Client-delivery licence** — may buyers use artefacts with their clients? At what multiple? Research spec Appendix J | Segment C repeat purchase (§20) — the best unbuilt revenue |
| **26** | **The update promise** — `pricing.md` already commits to lifetime updates. Confirm deliberately, with a maintenance budget, or narrow it before more products inherit it | §33; the cost of every future product |
| **27** | **Decision Pack v0 at A$79** — is the file-based version worth shipping as a demand test, or wait and build the workspace? This document argues strongly for the test | §14.3, the flagship sequence |
| **28** | **Which decision** the first Decision Pack covers. This document assumes risk appetite because the question content is strongest there — confirm or redirect | Product 2 (§28) |
| **29** | **AI confidentiality position** — will the platform commit publicly to no-training-on-customer-data and state retention? If not, Challenge My Thinking cannot ship to regulated buyers | §24.2 |
| **30** | **Editorial capacity** — realistically, how many author-days per month? Every plan in this document is a guess without it, and the previous version's 25-day "Phase 1" is what happens when nobody asks | §27, everything |

---

# APPENDIX A — Every idea from the previous version, scored

Nothing is lost. The previous file's ~50 proposed formats, collapsed into one table and
scored against §10. **Verdict** is this document's recommendation; **§** points to the
reasoning.

| Idea | Verdict | § |
|---|---|---|
| Decision Packs | **Build — flagship**, but as a workspace, staged v0→v2 | §13–14 |
| Scenario Packs | **Build — one**, not five | §15 |
| Interactive diagnostic | **Build — free**, acquisition engine | §28 |
| Meeting Packs | **Build first** — highest urgency-to-effort | §28 |
| Question Packs | Build — good entry point, reuses the spine | §17 |
| Template Packs | Build — cheap, but watch §11 overlap | §11 |
| Standalone templates | Keep — the workhorse | §17 |
| Workshop kits | Later — strong format, higher production cost | §29 |
| Tabletop exercises | Later — launch exactly one | §30 |
| Implementation kits (30/90-day) | Later — high value, expensive to produce | §29 |
| Consultant licensing | **Sooner than the original said** — best unbuilt revenue | §20 |
| Challenge My Thinking AI | Later — blocked on editorial + privacy, not engineering | §24 |
| Board packs | Component of a Decision/Meeting Pack, not a product | §17 |
| Decision trees | Component of Scenario Packs, not a product | §15 |
| Annotated templates / worked examples | **Yes — as a standard**, in every artefact | §28 |
| Trackers, action plans | Components | §9 |
| Communication kits | Components of Scenario Packs | §15 |
| Policy starters | Deferred — maintenance, drifts toward legal | §30 |
| Control libraries | Cut — generic, no edge | §30 |
| Assessment rubrics | Fold into the diagnostic | §28 |
| Framework crosswalks | Deferred — maintenance trap, false-equivalence risk | §30 |
| Clause banks | Deferred — legal exposure | §30 |
| Expert review | Deferred — becomes a services business | §30 |
| Industry-specific packs | Deferred — multiplication before fit | §30 |
| Role-specific packs | Deferred — same reason | §30 |
| Micro-courses | Neutral — only if a real course exists to cut down | — |
| Premium/"advanced" versions | **Cut** — artificial differentiation | §30 |
| Glossaries | **Cut as paid** — free/SEO instead | §30 |
| Interview guides / career products | **Cut** — brand dilution | §30 |
| Seasonal packs | **Cut** — reframe as a real Annual Review Pack | §30 |
| Generic standalone checklists | **Cut alone**, strong embedded | §30 |
| Benchmark reports | Deferred hard — sample size, bias, consent | §30 |
| Annual update subscriptions | Deferred — model change | §30 |
| Team/org licensing | Deferred — after individual demand | §30 |
| Question of the Week | **Yes** — cheapest retention available | §31 |
| Post-purchase recommendations | **Yes** — via §22 routing, not "also bought" | §22 |

---

# APPENDIX B — What changed in this rewrite

For anyone who read the previous version.

| Previous position | Now | Why |
|---|---|---|
| Own price table in bare `$`, floor `$19` | **AUD, from `pricing.md`'s adopted ladder** | Two pricing authorities is the 012 bug in a document |
| Decision Pack `$99–199` (and `$79–149` in a second table) | **A$79 → A$149 → A$199, staged** | The file contradicted itself; and the flagship shouldn't launch at flagship price |
| Decision Pack = nine files | **Workspace producing a decision record** | "A process, not nine files" then specified nine files |
| Seven tags recommend products | **Tags describe questions; route products through questions** | The tags are about the risk work, not the product |
| Eight products in "Phase 1" | **Three, ~9 author-days** | 25 author-days against a calendar with no author-weeks in it |
| Debated which free tier to choose | **Already decided 2026-08-12** | Stale; the live model is questions free + one free template |
| Consultant licensing "delay" | **Priority** | Content task, monetises existing artefacts, unblocks the best buyer |
| Outcome-first naming | **Outcome name + literal search title** | Original naming pessimised the documented discovery path |
| Buyer barely present | **Part One is the buyer** | The whole document was written from the seller's chair |
| Tax invoice / ABN | **Hard prerequisite above ~A$150** | Unbuyable is worse than unattractive |
| Refunds unmentioned | **§5 — exposure scales with price, ACL constrains** | Raising prices without touching refund policy |
| File format unmentioned | **§3 — the corporate laptop constraint** | "It didn't open" is the top preventable refund |
| Versioning, one line | **§33 — plus the uncosted update promise** | `pricing.md` already commits to lifetime updates |
| AI "early V2" | **After editorial backlog + privacy position** | 99/100 questions lack hand-written previews |
| AI confidentiality unmentioned | **§24.2 — a product requirement** | Users type their org's real risk position into a box |
| Two sets of §1–26 | One numbering, one position | It was four documents stapled together |

---

## Status footer — updated 2026-08-20 after Week 4

What shipped, what is gated, and on what. An addition, not a rewrite.

### Shipped in Week 4

| § | Proposal | Status | Notes |
|---|---|---|---|
| §2, §2.1, §3, §16, §20, §33, §34 | **Pre-purchase evidence layer** | ✅ Shipped | `EvidencePanel`, `PreviewGallery`, `LicenceLine`, `VersionStamp` on all product pages. Admin write path via `/admin/products`. |
| §4, §34 item 1 | **Tax-invoice-quality receipts** | ✅ Shipped | `invoice_creation` + `billing_address_collection` in Stripe checkout. Invoice block in email templates. No ABN (decision #31). |
| §11, §34 item 4 | **Overlap publish guard** | ✅ Shipped | `check_content_overlap` in `publish_guard.py`. Bundle escape hatch. |
| §8, §19, §22, §34 item 5 | **Question → product routing** | ✅ Shipped | `RoutedProducts`, `SituationProducts`, `GET /questions/{slug}/related-products`, `GET /products/for-questions`. |
| §35 (five metrics) | **Metrics from the database** | ✅ Shipped | `/admin/metrics` with numerator/denominator pairs, revenue gross/refunded/net, enrollment splits, revenue series chart. |
| §3 (corporate-laptop constraints) | **Format guarantee on product pages** | ✅ Shipped | Rendered from columns (`is_editable`, `has_macros`, `min_office_version`), never typed per product. |
| §34 item 6, §16 | **Real preview assets** | ✅ Shipped | Two preview images minimum per paid template, uploaded through presigned path. |
| §7 | **Search title / outcome name** | ✅ Shipped | `search_title` column on products, renders as `<title>`/`og:title`, falls back to `name`. |

### Still gated

| § | Proposal | Gate | |
|---|---|---|---|
| §13–14 | **Decision Pack workspace** | Schema + editor + autosave + generator + review scheduler. Weeks, not days. Prerequisites (overlap guard, evidence layer) now ship. |
| §23–25 | **"Challenge My Thinking" AI** | 100 questions × editorial guardrails + confidentiality position (decision #29). Not engineering-blocked. |
| §28 | **Free Risk Diagnostic** | Scoring model, result page, recommendation output. W4-R4's routing model is its output layer. |
| §15 | **Scenario Packs** | Content. Ship one, not five. |
| §20 | **Consultant licence tiers** | Decision #25 (may buyers use artefacts with clients). `client_delivery` / `multi_client` defined-but-unused. |
| §31 | **Question of the Week** | Decision #30 (editorial capacity). 52/year is a real commitment. |
| §60.1 | **Semantic search** | First in DESIGN.md's cut order. |

### Deliberately not taken

| § | Proposal | Why not |
|---|---|---|
| §18 pricing change | Price ceiling removal | `pricing.md` is the price authority; W4-R2 and W4-R1 remove the ceiling. Changing prices is the owner's call afterwards. |
| §33 point 2 | Narrowing lifetime-update promise | Decision #26, owner's call. `version` + `last_reviewed_at` machinery now ships. |
