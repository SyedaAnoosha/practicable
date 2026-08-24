# Intern Brief — Deciding in the Dark, Platform

*A standalone, custom-built platform where risk practitioners learn, watch, download and buy —
built on the book's 100 questions, and designed to take far more.*

## The opportunity

"Deciding in the Dark" holds 100 real questions from risk leaders across five domains,
20,000-plus words of original guidance, and every question tagged seven ways — effort,
duration, cost, payback, tier, regulator pressure and leadership traits. That taxonomy is a
structured dataset, not decoration: it lets a buyer ask "what can I fix in a fortnight,
cheaply, that my regulator cares about?" and get an answer. No PDF does that. Today the
content sits on a page with a register-interest form and no way to buy anything.

We are giving it a home of its own — a separate brand, a separate site, custom-built so we
control the interface completely. Learning with video, paid templates, training material, and
deliberate room for sections we have not thought of yet: another subject, another author,
another audience. The design bar is part of the product. People pay for this, and it has to
look like it.

**Four weeks, end to end.** That is deliberately hard, and the shape of the work matters more
than the hours. Build the thinnest possible slice all the way through in week one — then
widen. Narrow and complete beats wide and half-finished, every time.

## What good looks like

A stranger finds the site, understands within seconds what it is and who it is for, buys
something, receives it, and learns from it — without anyone helping them. That is the whole
test, and every part of it has to hold.

- **It works end to end.** Sign-up, purchase, payment, delivery, access, video playback and
  progress all function on a real device with a real card — not just on your machine.
- **The gating actually holds.** Paid content is genuinely inaccessible without paying. A
  logged-out user, a signed-out link and a direct file URL all fail closed.
- **It looks worth paying for.** Consistent, considered and confident. Someone should assume
  a team built it.
- **It extends without you.** A non-technical person adds a course, a lesson or a template;
  a developer adds a whole new section from your documentation, without asking you how.
- **The thinking is visible.** Your stack choice, content model and design decisions are
  written down with the reasoning behind them — we assess that as seriously as the build.

## How we want you to work

### Approach & non-negotiables

*Thin slice, then widen. We care as much about how you reason as about what you ship — and
here, sequencing is the reasoning.*

- **Get one slice working end to end in week one** — one course, one lesson, one video that
  plays, one template behind a paywall, one real transaction, one gated download, one receipt
  email. Everything after that is repetition of a path you have already proven.
- **Model the content before you code it** — questions, templates, videos, lessons, modules,
  courses, sections, products, purchases, progress. Get the model right and a new section is
  configuration; get it wrong and it is a rewrite in week three.
- **Custom build does not mean build everything** — authentication, payments, video hosting
  and transactional email are bought, not written. Custom means the interface and the
  experience are ours; it does not mean reinventing solved infrastructure with real money
  attached.
- **Design deliberately, then apply it everywhere** — decide the type scale, palette, spacing
  and component set early and hold to them. A paid product that looks like a template will
  not sell like one, and retrofitting consistency in week four never works.
- **Assume it grows** — the book is the first section, not the only one. Every schema and
  screen should answer: what happens when we add a second subject with a different author?

### Non-negotiables

- **Never handle card data.** Use a hosted checkout from an established provider. We are not
  writing a payment engine, and you should never see a card number.
- **Video through a real provider.** Signed, access-controlled playback — not files in a
  public bucket. Paid video that anyone can download is not a paid product.
- **The author's voice and IP.** Published work under a real name. Keep the voice, reproduce
  the substance faithfully, and get anything public reviewed before it ships.
- **Handle customer data properly.** Real names, emails and purchase records. Collect only
  what you need, secure it, and never put it in a repository, a screenshot or a test fixture.
- **Name, legals and costs come to us.** Brand and domain are our decision — ask in week one.
  Legal pages are drafted for our review, never published on your authority. Every recurring
  fee is named and justified before you commit.

## Deliverables

### What you'll show us

*Six things. Each is assessed on whether it works for a stranger, not whether it demonstrates
on your laptop.*

**The platform** — A live site on its own domain: public marketing pages that explain the
offer, sign-up and sign-in, and a member area. Legal pages present — terms, privacy and a
refund position — drafted for us to review, not published on your own authority. Basic
analytics so we can see what people look at, what they buy, and where they stop.

**Learning** — Courses broken into modules and lessons, with more than one lesson type: video,
reading, and a downloadable artefact. Progress tracked and visible, so a learner knows where
they are and can resume. A course a person can genuinely start and finish. Captions on video.
If completion recognition (a certificate or similar) is cheap to add, propose it — do not
build it at the cost of the core.

**Commerce** — Paid templates and paid access working across several products, using a hosted
checkout. Pricing and tiers applied deliberately — including at least one free entry point
that earns an email address. A transactional receipt and an access email that actually
arrive. A purchase record we can reconcile: who bought what, when, for how much.

**Content model and admin** — A documented schema covering questions and their seven tags,
templates, videos, lessons, modules, courses, sections, products, purchases, users and
progress. An admin interface where a non-technical person adds and edits content, uploads a
video, and publishes — without touching code or calling you. Show us it works by having
someone else use it.

**Design system** — Type scale, palette, spacing scale, and a documented component set —
buttons, cards, forms, navigation, lesson layout, pricing table. Responsive behaviour defined
at real breakpoints. Written down so the next person stays consistent instead of inventing a
seventh shade of blue.

**Handover pack** — An architecture note (what you chose, what you rejected, and why), a
step-by-step guide to adding a new section, a full list of running costs and where they will
grow, known gaps and shortcuts you knowingly took, and what you would build next with another
four weeks.

## The four weeks

*Four weeks is short. This sequence is not a suggestion — it is what makes the deadline
survivable.*

### Week 1 — the slice

Confirm the brand name and domain with us on day one; do not invent one. Choose the stack and
justify it in a paragraph, not a report. Draft the content model. Then build one course with
one lesson, one video that plays, one template behind a paywall, one real test transaction
that produces a real download and a real receipt email.

**Ugly is acceptable this week. Broken is not.** If the slice is not working end to end by the
end of week one, tell us immediately — that is a scope conversation, not a late night.

### Week 2 — learning and access

Widen the slice into a real learning experience: modules, multiple lessons, mixed lesson
types, progress and resume. Load the first genuine content drawn from the 100 questions.
Finish sign-in and access control properly — this is the week to get gating right. Access
control discovered to be wrong in week four invalidates everything built on top of it.

### Week 3 — commerce and content

Paid templates and paid access across several products, with pricing, tiers and the free
entry point applied. Transactional email working. Admin usable by someone who is not you —
prove it by watching someone else add a lesson. Load enough real content that the platform
looks inhabited rather than demonstrated: empty shelves read as abandoned.

### Week 4 — design, hardening and handover

Apply the design system across every screen. Hunt the small things: empty states, failed
payments, expired sessions, broken links, a video that will not load, the checkout on a
phone. Try to break your own gating and fix what gives. Write the handover pack. Ship
something a stranger can find, buy from and learn on.

### Working rhythm

Four weeks is too short for a weekly check-in to catch a wrong turn. A short daily note — what
moved, what is blocked, what you decided — a review at the end of week two, and a handover at
the end. The author is in the building: use that for voice, substance and pricing instinct,
and get anything public reviewed early rather than at launch. Ask the same day your confidence
drops, not the following week.

## Standards & future direction

*These apply to everything you ship for us. Read them before you start — not at the end.*

### Future direction — think beyond v1

- **AI integration.** Find natural places where AI does work the learner would otherwise do
  by hand — shaping a question into their own organisation's context, or drafting a first-pass
  answer they can edit. Don't bolt it on.
- **Agentic AI.** Go beyond answering. Where could the platform act for the learner —
  assembling a tailored pack or learning path from their role and sector, and delivering it,
  rather than making them pick from a shelf?
- **Speed to answer.** Design around the goal: the answer to a question they are stuck on.
  How few steps from landing to owning it? Every extra click loses a sale.
- **Room to grow.** A new section — different subject, different author, different audience —
  should be something we add, not something we rebuild for.

### Craft — what makes it client-ready, not a prototype

- **The small things.** Empty states, error messages, loading indicators and sensible
  defaults — especially a failed payment, an expired session, or a video that will not load.
- **Clear labelling.** Make it obvious what is a heading and what is an action. Buttons
  should say what they do ("Start the module", not "Submit").
- **Consistency.** Spacing, fonts, colours and wording consistent everywhere. Inconsistency
  reads as unfinished — and on a paid product, as untrustworthy.
- **Mobile and resize.** Most people will meet this on a phone, including the checkout and
  the video player. Check both.
- **Accessibility basics.** Readable contrast, sensible text sizes, keyboard navigation, and
  captions on video.
- **Realistic test data.** Don't shortcut with "test test", "asdf" or a zero-value order. Use
  real question text, real course names, real prices, a real transaction, a real video, and a
  very long title. Placeholder junk hides bugs: overflowing fields, untested checkout, broken
  gating.

**If the four weeks get tight, protect the slice, not the surface area.** One complete,
polished, sellable path through the platform is worth more to us than four unfinished ones —
and it is the version we can actually launch.
