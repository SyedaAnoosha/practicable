1. # **Deciding in the Dark — Product Spec**

   1. ## **1\. What This App Is, In One Line**

A website where a risk professional signs up, browses real risk-management content, and buys whatever form of it fits them — a reference answer, a full structured course, or a standalone downloadable template — then comes back anytime to keep reading, watching, and downloading what they bought.

Think: **a content store**, not a book store. The 100 questions are the first and biggest piece of content in it, but they are one product type among several — not the whole app.

2. ## **2\. How It Works — A Walkthrough Anyone Can Follow**

Imagine "Sarah," a risk manager at a mid-size company, hears about the site from a colleague.

1. **She lands on the homepage.** In a few seconds she understands: this is real, practical risk-management guidance, written by someone credible, sold in a few different formats depending on what she needs.

2. **She browses for free, without an account.** The storefront shows a few kinds of things: the searchable question library (free preview), full courses (video-led, structured), and standalone templates (a risk register format, an appetite statement, etc.) sold on their own. She's not locked into "buy the whole book" — she can see everything separately.

3. **She creates an account.** Quick sign-up — email and password, or a hosted login screen so we never touch her password directly.

4. **She buys two different things in one session.** A **template** ($15, instant download, solves a problem she has today) and a **course** (a structured, multi-lesson path through one domain — e.g. Cyber — with video and readings). Payment goes through a hosted checkout (like Stripe) — we never see or store her card details.

5. **She gets a receipt and instant access.** An email confirms the purchase, and both items appear immediately in her account, even though they're different types of content.

6. **She goes to "My Library."** Her personal panel shows everything she's bought — clearly labeled by type (Course / Template / Reference) — with a "continue where you left off" section at the top for anything she's partway through.

7. **She opens the course.** It's structured — modules, then lessons — but within a lesson, reading and video are woven together rather than being separate steps: a paragraph, then a short video where the author explains the idea, then another paragraph. She can download the related template right there if one exists.

8. **She opens the template she bought separately.** No "lesson," no video, no progress bar — it's just a clean download page with a preview and a button. Different content type, different, simpler experience — the app doesn't force every purchase into the same course-shaped box.

9. **She comes back a week later.** Her course progress is saved. Her template is still in her library to redownload anytime. She can also still freely search the 100-question library at any time, independent of anything she's bought — it isn't gated behind "start at lesson 1."

That's the whole product: one store, three kinds of content, one library where they all show up.

3. ## **3\. The Problem We're Solving**

Right now, this content — 100 real risk questions, structured guidance, an author's real expertise — sits on a single webpage with a "register your interest" form. There's no way to actually buy anything, no way to learn from it in a structured way, and no way to grow it into more than one static page. Meanwhile the underlying content is genuinely differentiated: it's tagged across 7 dimensions (effort, cost, time, regulatory pressure, etc.), which means it can answer a real question like "what should I fix first?" — something no PDF or generic course can do. That advantage is currently invisible, unmonetized, and — as built today — trapped in a single format. The fix isn't just "let people buy the book." It's building a store that can sell this content (and future content) in whatever shape actually sells.

4. ## **4\. The Types of Content This App Sells**

This is the part that was under-represented before — the app is not "a book with a paywall." It's a small content marketplace with room to grow. Three types, from day one:

**1\. Reference Library (the 100 questions)** Searchable and filterable using the 7 tags (effort, cost, duration, tier, regulator pressure, ROI, leadership traits). Free to browse. Individual domain packs (Risk, Compliance, Cyber, Resilience, AI) are purchasable on their own, and the full set is purchasable as one bundle. This is the "look something up" product — no fixed order, no progress bar forcing completion.

**2\. Courses** A structured, sequential learning path — modules made of lessons, each lesson a mix of text, embedded video, and downloadable material. This is the "learn a whole domain properly" product — has progress tracking and a resume point, because completion is the goal, not lookup. A course can be built from the same underlying question content, regrouped and ordered, or can be original material — the platform should support either.

**3\. Templates** Standalone downloadable artifacts — a risk register format, an appetite statement template, a controls inventory sheet — sold individually, with a preview, no course structure attached. This is the "I need this one thing right now" product — cheapest, fastest, easiest first purchase, and the natural free-entry-point / email-capture item.

**Room to grow (not built now, but the store should be able to hold them later without a rebuild):** case studies, audio versions, diagnostics/assessments, a second author's content entirely. The point of treating this as a "content store" instead of "a book" is exactly so that adding a new content type later is a catalog decision, not an architecture decision.

5. ## **5\. What We're Building (Goals)**

1. **A real, working store that sells more than one kind of thing** — reference content, courses, and templates, each with the experience that actually fits it, not one format stretched over all three.

2. **A genuine learning experience for courses specifically** — structured, mixed media, progress-tracked, resumable.

3. **A frictionless experience for templates specifically** — no course wrapper, no unnecessary steps, just preview and download.

4. **Content that's easy to grow** — a non-technical person can add a new question, course, or template without a developer. A developer can add a whole new content type or subject without rebuilding the platform.

5. **A paywall that actually holds**, across all three content types — no logged-out access, no guessable file links, no leaks.

6. **A pricing structure that converts** — a cheap/free entry point (a template), mid-sized purchases (domain packs, single courses), and no single expensive all-or-nothing product blocking a first purchase.

   6. ## **6\. What We're Deliberately NOT Building Yet (Non-Goals)**

These are good ideas — several came directly out of brainstorming.

| Idea | Why it's parked for now |
| :---- | :---- |
| **AI-assembled "tailored pack"** (user answers a few questions about their role/sector, and the platform auto-builds a custom bundle across content types) | The single most exciting idea from brainstorming, and it matches the director's brief almost word for word. But it needs the store, the tagging, and all three content types live and stable first. Strong candidate for the next phase. |
| **Subscription pricing** | Changes the whole business model — needs its own decision, not a side effect of this build. |
| **Certificates / badges** | Cheap, and worth a fast follow shortly after launch — not blocking it. |
| **Audio versions** | A new format on the reference/course content — zero risk to add later. |
| **Case studies / narrative playbooks** | A fourth content type, worth adding once the first three are proven. |
| **Team/enterprise seats** | A B2B motion on top of a consumer product — sequence after individual demand is proven. |
| **Community / discussion features** | High effort, unclear payoff before there's an actual user base. |

7. ## **7\. What's Improved From the Original Idea**

Four refinements worth calling out, because they change how this gets built:

1. **This is a content store, not a book with a paywall.** Reference content, courses, and templates are three distinct product types with three distinct experiences — not one format (the book) stretched to cover everything. This reframing is itself the biggest improvement: it's what lets the platform "extend without you," per the brief, because adding a new content type later is a catalog addition, not a rebuild.

2. **Content is "blocks," not rigid lesson types.** Inside a course lesson, video sits *within* the reading wherever it's useful, rather than being a separate video-only step. Small change to the data model, big improvement to how natural the content feels.

3. **The reference library and the courses are different consumption modes on purpose.** Reference content stays freely browsable and searchable, with no forced order. Courses are the structured, sequential, progress-tracked experience. Same underlying question data can power both, depending on how it's packaged.

4. **Pricing is tiered by content type and domain, not "buy the whole book."** A $15 template, a domain-specific course, and a domain-specific reference pack all sit below the price of the full 100-question set — more entry points, more first-purchase opportunities.

   8. ## **8\. Who Uses This (User Stories)**

**Visitor (not signed up)**

* As a visitor, I want to search and filter the reference library for free, so I can tell if this is actually useful before I pay for anything.

* As a visitor, I want to see courses and templates listed separately from the reference library, so I understand these are different products, not the same thing packaged differently.

**Buyer / New Signup**

* As a new user, I want to sign up quickly (or with a hosted login), so creating an account isn't a barrier to buying.

* As a buyer, I want to grab one free template in exchange for my email, so I can try the format before spending money.

* As a buyer, I want to buy a single domain pack or a single course, instead of the whole thing, so I only pay for what's relevant to me.

* As a buyer, I want to buy a template on its own, without being routed through a course, so a quick purchase stays quick.

* As a buyer, I want an instant receipt and access regardless of what type of content I bought, so I trust the purchase went through.

**Learner (after purchase)**

* As a learner, I want a "My Library" panel showing everything I've bought, labeled by type, so I can tell my courses apart from my templates and reference packs.

* As a learner, I want a "continue where you left off" section for anything with progress, so I don't lose my place in a course.

* As a learner, I want video to appear inline within a course lesson, not as a separate detour, so the content flows naturally.

* As a learner, I want to redownload a template I've already bought at any time, without hunting for it.

* As a learner, I want to browse the reference library freely regardless of what I've purchased, so I can use it as a lookup tool, not just a course.

**Admin (non-technical content editor)**

* As an admin, I want to add a new question, course, or template — tag it, attach a video or file, and publish — without writing code.

* As an admin, I want to group existing questions into a new domain pack or course, so growing the catalog doesn't require rebuilding anything.

* As an admin, I want to add a template as a standalone product, without needing to attach it to a course first.

  9. ## **9\. Requirements**

     1. ### **Must-Have (v1 — the platform doesn't work without these)**

* User sign-up / sign-in (via a hosted auth provider)

* Public browsing and filtering of the reference library (the 7-tag system), free and unauthenticated

* A storefront that clearly separates and labels the three content types: reference packs, courses, templates

* Hosted checkout (e.g. Stripe) — the app never touches raw card data

* Purchase → instant access → receipt email, working for all three content types, with a real transaction

* Paywall that fully blocks unpaid content across all three types — no logged-out access, no direct file links, no workaround

* Course reader that supports mixed blocks (text, embedded video, downloadable file) in one flowing view, with progress and resume

* A simple, no-frills template purchase/download flow, distinct from the course experience

* "My Library" panel: purchased items across all types, clearly labeled, with progress and resume where relevant

* At least one free template that captures an email

* Domain-based bundles as a purchasable unit for both reference packs and courses

* Admin interface: add/edit a question, course, or template; upload a video; attach a file; publish — no code required

* Legal pages present (terms, privacy, refund position) — drafted for review, not self-published

* Basic analytics: what's viewed, what's bought, by content type, and where people drop off

### **Nice-to-Have (v1 if time allows, otherwise immediate fast-follow)**

* Suggested "path" ordering through a domain's reference questions, offered as an optional guided route

* Certificate/badge on completing a course

* Captions on all video

### **Future Considerations (not built now, but the design shouldn't block them later)**

* AI-assembled tailored pack based on role/sector, spanning all three content types

* Subscription pricing model

* Audio versions of reference answers

* Case study / narrative content as a fourth content type

* Team and enterprise seats

* A second subject/author entirely, added as configuration rather than a rewrite

