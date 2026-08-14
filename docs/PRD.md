# Product Requirements Document

**Product:** Deciding in the Dark — Platform
**Source:** `docs/Deciding_in_the_Dark_Platform_Intern_Brief.md` (Project 03 · Intern Brief)
**Status:** Draft for review
**Timebox:** Four weeks, end to end

> **Scope note.** This PRD is derived exclusively from the intern brief. Where the brief does not decide something (brand name, domain, stack, prices, specific vendors), this document records it as an **Open decision** with an owner and a deadline rather than inventing an answer. Several of those are explicitly reserved to the client by the brief.

---

## 1. Summary

*Deciding in the Dark* is a body of published work: 100 real questions from risk leaders across five domains, 20,000+ words of original guidance, and a seven-way tag on every question — effort, duration, cost, payback, tier, regulator pressure, and leadership traits.

Today that content sits on a page with a register-interest form and no way to buy anything.

This product gives it a home of its own: a separate brand on its own domain, custom-built so the interface is fully under our control. Risk practitioners will **learn, watch, download and buy** on it. The book is the platform's first section — not its only one.

The seven-way taxonomy is the differentiator. It is a structured dataset, not decoration. It lets a buyer ask *"what can I fix in a fortnight, cheaply, that my regulator cares about?"* and get an answer. **No PDF does that**, and that capability is the reason the platform justifies its own build.

---

## 2. Goals

### 2.1 The single success test

> A stranger finds the site, understands within seconds what it is and who it is for, buys something receives it, and learns from it — **without anyone helping them.**

That is the whole test. Every part of it has to hold. A break anywhere in that chain is a product failure, not a polish item.

### 2.2 The five conditions of "good"

| # | Condition | What it means concretely |
|---|-----------|--------------------------|
| G1 | **It works end to end** | Sign-up, purchase, payment, delivery, access, video playback and progress all function **on a real device with a real card** — not just on the developer's machine. |
| G2 | **The gating actually holds** | Paid content is genuinely inaccessible without paying. A logged-out user, a signed-out link, and a direct file URL all **fail closed**. |
| G3 | **It looks worth paying for** | Consistent, considered, confident. Someone should assume a team built it. The design bar is part of the product — people pay for this. |
| G4 | **It extends without the builder** | A non-technical person adds a course, a lesson or a template. A developer adds a whole new section from the documentation, without asking the builder how. |
| G5 | **The thinking is visible** | Stack choice, content model and design decisions written down with the reasoning behind them. **Assessed as seriously as the build.** |

### 2.3 Non-goals

- Building payment infrastructure. Card data is never handled or seen.
- Building authentication, video hosting or transactional email from scratch.
- Publishing legal pages or committing to a brand/domain/recurring cost on our own authority.
- Breadth at the cost of one complete path. *If the four weeks get tight, protect the slice, not the surface area.*

---

## 3. Users

The brief names these users explicitly. Each maps to requirements below.

| User | Who they are | What they need |
|------|--------------|----------------|
| **The stranger** | A risk practitioner who has never heard of us, arriving cold — most likely on a phone | To understand in seconds what this is and who it's for; to find the answer to a question they're stuck on; to buy and receive it unaided |
| **The learner** | A buyer working through paid content | Video, reading and downloadable lessons; visible progress; the ability to leave and resume; captions |
| **The non-technical editor** | Someone on the client side maintaining content | To add and edit content, upload a video, and publish — without touching code or calling the builder |
| **The next developer** | Whoever inherits this | To add an entire new section — different subject, different author, different audience — from documentation alone |
| **The client / author** | Owns brand, legals, pricing instinct, voice and IP | Review and sign-off before anything public ships; a purchase record that reconciles; analytics on what people look at, buy, and abandon |

---

## 4. Product requirements

Requirements are grouped by the brief's six deliverables. **Each is assessed on whether it works for a stranger, not whether it demonstrates on a laptop.**

### 4.1 The platform

| ID | Requirement | Priority |
|----|-------------|----------|
| P-1 | Live site on its own domain | Must |
| P-2 | Public marketing pages that explain the offer | Must |
| P-3 | Sign-up and sign-in | Must |
| P-4 | A member area | Must |
| P-5 | Legal pages present — terms, privacy, and a refund position — **drafted for client review, never published on the builder's authority** | Must |
| P-6 | Basic analytics: what people look at, what they buy, where they stop | Must |

### 4.2 Learning

| ID | Requirement | Priority |
|----|-------------|----------|
| L-1 | Courses broken into modules and lessons | Must |
| L-2 | More than one lesson type: **video, reading, and a downloadable artefact** | Must |
| L-3 | Progress tracked and visible — a learner knows where they are | Must |
| L-4 | Resume: a learner can leave and pick up where they stopped | Must |
| L-5 | At least one course a person can **genuinely start and finish** | Must |
| L-6 | Captions on video | Must |
| L-7 | Completion recognition (certificate or similar) — **propose it if cheap to add; do not build it at the cost of the core** | Could |

### 4.3 Commerce

| ID | Requirement | Priority |
|----|-------------|----------|
| C-1 | Paid templates and paid access working across **several** products | Must |
| C-2 | Hosted checkout from an established provider | Must |
| C-3 | Pricing and tiers applied deliberately | Must |
| C-4 | **At least one free entry point that earns an email address** | Must |
| C-5 | A transactional receipt that actually arrives | Must |
| C-6 | An access email that actually arrives | Must |
| C-7 | A purchase record that reconciles: **who bought what, when, for how much** | Must |
| C-8 | At least one **real** transaction on a **real** card on a **real** device | Must |

### 4.4 Content model and admin

| ID | Requirement | Priority |
|----|-------------|----------|
| M-1 | A **documented** schema covering: questions and their seven tags, templates, videos, lessons, modules, courses, sections, products, purchases, users, progress | Must |
| M-2 | Admin interface where a non-technical person adds and edits content, uploads a video, and publishes — without touching code or calling the builder | Must |
| M-3 | **Proven by having someone else use it** — not by the builder demonstrating it | Must |
| M-4 | Adding a new section is **configuration, not a rewrite** | Must |

The seven tags, per the brief, are: **effort, duration, cost, payback, tier, regulator pressure, leadership traits.** The five domains of the 100 questions are a first-class dimension of the model.

### 4.5 Design system

| ID | Requirement | Priority |
|----|-------------|----------|
| D-1 | Type scale, palette, spacing scale — decided **early** and held to | Must |
| D-2 | Documented component set: buttons, cards, forms, navigation, lesson layout, pricing table | Must |
| D-3 | Responsive behaviour defined at real breakpoints | Must |
| D-4 | Written down so the next person stays consistent "instead of inventing a seventh shade of blue" | Must |
| D-5 | Applied across **every** screen | Must |

### 4.6 Handover pack

| ID | Requirement | Priority |
|----|-------------|----------|
| H-1 | Architecture note: what was chosen, **what was rejected, and why** | Must |
| H-2 | Step-by-step guide to adding a new section | Must |
| H-3 | Full list of running costs and where they will grow | Must |
| H-4 | Known gaps and shortcuts knowingly taken | Must |
| H-5 | What you would build next with another four weeks | Must |

---

## 5. Non-negotiables

These are constraints, not preferences. Violating one fails the project regardless of what else works.

| ID | Non-negotiable | Rule |
|----|----------------|------|
| N-1 | **Never handle card data** | Hosted checkout from an established provider. We are not writing a payment engine. **You should never see a card number.** |
| N-2 | **Video through a real provider** | Signed, access-controlled playback — not files in a public bucket. *Paid video that anyone can download is not a paid product.* |
| N-3 | **The author's voice and IP** | Published work under a real name. Keep the voice, reproduce the substance faithfully, and get **anything public reviewed before it ships**. |
| N-4 | **Handle customer data properly** | Real names, emails, purchase records. Collect only what's needed, secure it, and **never** put it in a repository, a screenshot, or a test fixture. |
| N-5 | **Name, legals and costs come to the client** | Brand and domain are the client's decision — **ask in week one**. Legal pages drafted for review, never self-published. **Every recurring fee named and justified before commitment.** |

### Buy, don't build

**Custom build does not mean build everything.** Authentication, payments, video hosting and transactional email are **bought, not written**. Custom means the interface and the experience are ours. It does not mean reinventing solved infrastructure with real money attached.

---

## 6. Approach

The brief is emphatic that sequencing *is* the reasoning. These are requirements on method, not suggestions.

1. **Thin slice, then widen.** Build the thinnest possible slice all the way through in week one, then widen. **Narrow and complete beats wide and half-finished, every time.**
2. **Model the content before coding it.** Get the model right and a new section is configuration; get it wrong and it is a rewrite in week three.
3. **Buy the solved infrastructure.** See §5.
4. **Design deliberately, then apply it everywhere.** *Retrofitting consistency in week four never works.*
5. **Assume it grows.** Every schema and every screen must answer: *what happens when we add a second subject with a different author?*

---

## 7. Delivery plan

### Week 1 — the slice

- **Day one:** confirm brand name and domain with the client. **Do not invent one.**
- Choose the stack and justify it **in a paragraph, not a report**.
- Draft the content model.
- Build the slice: one course · one lesson · one video that plays · one template behind a paywall · one real test transaction producing a real download and a real receipt email.

> **Ugly is acceptable this week. Broken is not.** If the slice is not working end to end by the end of week one, **tell the client immediately** — that is a scope conversation, not a late night.

### Week 2 — learning and access

- Widen into a real learning experience: modules, multiple lessons, mixed lesson types, progress and resume.
- Load the first genuine content drawn from the 100 questions.
- **Finish sign-in and access control properly. This is the week to get gating right.**

> Access control discovered to be wrong in week four **invalidates everything built on top of it**.

### Week 3 — commerce and content

- Paid templates and paid access across several products, with pricing, tiers and the free entry point applied.
- Transactional email working.
- Admin usable by someone who is not the builder — **prove it by watching someone else add a lesson**.
- Load enough real content that the platform looks **inhabited rather than demonstrated**. *Empty shelves read as abandoned.*

### Week 4 — design, hardening and handover

- Apply the design system across every screen.
- Hunt the small things: empty states, failed payments, expired sessions, broken links, a video that will not load, **the checkout on a phone**.
- **Try to break your own gating and fix what gives.**
- Write the handover pack.
- Ship something a stranger can find, buy from, and learn on.

### Working rhythm

Four weeks is too short for a weekly check-in to catch a wrong turn.

- A **short daily note**: what moved, what is blocked, what was decided.
- A **review at the end of week two**.
- A **handover at the end**.
- The author is in the building — use that for voice, substance and pricing instinct.
- Get anything public reviewed **early rather than at launch**.
- **Ask the same day your confidence drops, not the following week.**

---

## 8. Quality standards

These apply to everything shipped. *Read them before you start — not at the end.*

| ID | Standard | Detail |
|----|----------|--------|
| Q-1 | **The small things** | Empty states, error messages, loading indicators, sensible defaults — **especially a failed payment, an expired session, or a video that will not load** |
| Q-2 | **Clear labelling** | Obvious what is a heading and what is an action. Buttons say what they do — *"Start the module"*, not *"Submit"* |
| Q-3 | **Consistency** | Spacing, fonts, colours and wording consistent everywhere. Inconsistency reads as unfinished — and on a paid product, as **untrustworthy** |
| Q-4 | **Mobile and resize** | Most people will meet this on a phone, **including the checkout and the video player**. Check both |
| Q-5 | **Accessibility basics** | Readable contrast, sensible text sizes, keyboard navigation, captions on video |
| Q-6 | **Realistic test data** | No *"test test"*, *"asdf"* or zero-value orders. Real question text, real course names, real prices, a real transaction, a real video, **and a very long title**. *Placeholder junk hides bugs: overflowing fields, untested checkout, broken gating* |

---

## 9. Future direction (v2 thinking, designed for now)

The brief asks for these to shape v1's architecture even where they are not built in v1.

- **AI integration.** Find natural places where AI does work the learner would otherwise do by hand — shaping a question into their own organisation's context, or drafting a first-pass answer they can edit. **Don't bolt it on.**
- **Agentic AI.** Go beyond answering. Where could the platform *act* for the learner — assembling a tailored pack or learning path from their role and sector, and delivering it, rather than making them pick from a shelf?
- **Speed to answer.** Design around the goal: the answer to a question they are stuck on. **How few steps from landing to owning it?** *Every extra click loses a sale.*
- **Room to grow.** A new section — different subject, different author, different audience — should be something we **add**, not something we **rebuild for**.

---

## 10. Open decisions

Reserved to the client or deliberately undecided by the brief. Nothing here should be invented by the builder.

| # | Decision | Owner | Needed by |
|---|----------|-------|-----------|
| O-1 | Brand name | Client | Day 1 |
| O-2 | Domain | Client | Day 1 |
| O-3 | Stack choice (with a one-paragraph justification) | Builder → client | Week 1 |
| O-4 | Checkout / payments provider | Builder → client (cost sign-off) | Week 1 |
| O-5 | Video hosting provider (signed playback) | Builder → client (cost sign-off) | Week 1 |
| O-6 | Auth and transactional email providers | Builder → client (cost sign-off) | Week 1 |
| O-7 | Every recurring fee — **named and justified before commitment** | Builder → client | Before commitment |
| O-8 | Pricing, tiers, and the free entry point | Client / author | Week 3 |
| O-9 | Legal pages — terms, privacy, refund position | Drafted by builder, **published only on client authority** | Week 4 |
| O-10 | Completion recognition (certificate) — build or defer | Client, on builder's proposal | Week 3 |

---

## 11. Acceptance criteria

The product is accepted when **all** of the following are demonstrable by someone other than the builder:

1. A stranger, unaided, on a phone, lands on the site and can state what it is and who it is for within seconds.
2. That stranger signs up, buys, pays through hosted checkout with a real card, and receives a receipt email and an access email that **arrive**.
3. The purchased download and the purchased video are accessible to them — and the video plays with captions.
4. **Gating fails closed** under all three attacks: logged-out user, signed-out link, direct file URL.
5. A learner starts a course, leaves, returns, sees their progress, resumes, and **finishes**.
6. Several products are purchasable, and at least one free entry point captures an email address.
7. The client can reconcile a purchase record: who bought what, when, for how much.
8. A **non-technical person** adds a lesson, uploads a video, and publishes it — observed, without help.
9. Every screen reflects the documented design system, at real breakpoints, on a phone.
10. The handover pack (§4.6) is complete, including rejected options and their reasoning.
11. Legal pages exist in draft, and nothing public shipped without author review.
12. No card number was ever seen; no customer data appears in the repository, a screenshot, or a test fixture.

---

## 12. Prioritisation rule

> **If the four weeks get tight, protect the slice, not the surface area.**

> One complete, polished, sellable path through the platform is worth more than four unfinished ones — and it is the version we can actually launch.

Any de-scoping decision must be tested against this rule before it is taken, and recorded in the handover pack as a known gap (H-4).
