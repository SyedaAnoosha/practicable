# Platform UI/UX Research — Learning & Digital-Product Platforms

**Prepared for:** Practicable (formerly *Deciding in the Dark*)
**Date:** 2026-08-20
**Method:** Live-site capture via Playwright (headless Chromium, 1440×900 viewport, full-page screenshots), plus a source-level audit of the Practicable frontend at `frontend/src`.

---

## Method & Evidence Base

Every screenshot in `screenshots/` was captured from the live site on the date above. No stock images, no Google Image results, no reconstructions. Where a page could not be reached, that is recorded rather than guessed.

| Platform | Public pages captured | Authenticated pages | Notes |
|---|---|---|---|
| Coursera | Home, Browse, Course detail, Coursera Plus pricing, Search results | ✗ | Login blocked by reCAPTCHA Enterprise at the "Continue" step. Not circumvented. |
| edX | Home, Search, Course detail, Programs | ✗ | Login returned "Too many failed login attempts. Try again later" — account lockout. Not retried. |
| Udemy | Home, Category, Course detail | ✗ | Cloudflare interstitial cleared with a realistic UA; the credential submit then returned "Sorry, something went wrong" (server-side bot detection). Not circumvented. |
| Skillshare | Home, Browse, Class detail | ✗ | No credentials supplied. |
| Kajabi | Home, Pricing, Features, Templates | ✗ | No credentials supplied. |
| LinkedIn Learning | Home, Topic browse, Course detail | ✗ | Requires LinkedIn account. |
| MasterClass | Home, Category, Class detail, Pricing | ✗ | Subscription wall. |
| Maven | Home, Course browse, Course detail | ✗ | — |
| Teachable | Home, Pricing, Features | ✗ | Creator-platform marketing site; the *product* is behind a trial signup. |
| Thinkific | Home, Pricing | ✗ | As above. |
| Brilliant | Home, Courses catalog, Pricing | ✗ | — |
| O'Reilly | Home, Online Learning, Pricing | ✗ | Enterprise/library auth. |
| DataCamp | Home, Course catalog, Course detail, Pricing | ✗ | — |
| Pluralsight | Home, Browse library, Pricing | ✗ | — |

**Consequence for this document:** claims about *marketing, discovery, catalogue, course-detail and pricing* surfaces are evidence-backed. Claims about *in-product learning interfaces and dashboards* are drawn from publicly visible previews, product tour pages, and the platforms' own marketing screenshots — and are labelled as such where they appear. This distinction matters and is not smoothed over.

---

## 1. Executive Summary

### Why Practicable currently feels bland

The blandness is **not** in the design tokens. `frontend/src/styles/theme.css` is a genuinely rigorous 727-line design system — a warm ivory/espresso ground rather than the default violet-white, a two-colour brand (midnight navy + champagne gold) with a documented rule that a third hue family is not permitted, five domain signature colours, a bespoke three-font stack (Schibsted Grotesk / Newsreader / Azeret Mono) chosen explicitly to escape "the default palette every AI mockup reaches for", a fluid `clamp()` type scale with per-rung line-height and tracking, warm-tinted elevation, and — unusually — **contrast ratios measured and recorded in comments rather than eyeballed**. This is better token work than any of the fourteen platforms reviewed here.

The problem is that **the tokens are not being spent**. Specifically:

1. **The marketing surface and the product surface are two different products.** `Home.tsx` (1281 lines) has a dark full-bleed aurora stage, staggered Motion entrances, rotating placeholder problems, a domain grid with signature colours, and an editorial rhythm. `Dashboard.tsx` (275 lines) — the page a paying member sees every session — is a search box, one question card, one product card, and a sentence. The visitor is sold an editorial publication and then handed a utility.

2. **One card shape does almost all the work.** `Card.tsx` is a single `rounded-xl border border-border bg-card` div. Every catalogue renders it in a `sm:grid-cols-2` grid. Courses, templates, questions and products are *materially different things* with different decision criteria, and they currently look near-identical. The `--domain-*` colours exist and are used on the homepage and question cards, but the courses and templates catalogues never touch them.

3. **The authenticated pages have no facts.** `CourseDetail.tsx` shows author, module count, lesson count and "lifetime access" as a single run-on line of muted 14px text. Every competitor reviewed puts these in a dedicated horizontal fact strip with icons — because these *are* the purchase decision. Practicable has the data (`lesson_count`, `modules.length`, `duration_seconds` per lesson) and renders it as an afterthought.

4. **Two-column grids on 1440px screens.** `CoursesCatalogue`, `TemplatesCatalogue` and the Library all cap at `sm:grid-cols-2` inside a `max-w-7xl` (1280px) container. That is ~600px per card for content that needs ~340px, producing large, empty, low-information cards — the exact "oversized cards" failure §15A names. Coursera and DataCamp run 3–4 across at this width.

5. **`related_products` is fetched and never rendered.** `CourseDetail.tsx` types it, fetches it, uses `related_products[0]` for the price, and drops the rest. Every platform reviewed has a related-content rail. This is a built feature that isn't shown.

6. **No progress anywhere except Library and Learn.** The Dashboard — the member's home — has no progress bar, no "continue where you left off", no completion state. `Library.tsx` has an excellent `ContinueRail` with an animated `role="progressbar"`; the Dashboard doesn't import it. Every competitor's signed-in home leads with resume state.

7. **Vertical stacking where horizontal grouping belongs.** The Dashboard stacks: search card → question card → product card → sentence. Four full-width blocks, one item each. The same information fits in one viewport as a stat row + two-column grid.

### The major patterns across successful learning platforms

Recurring in **three or more** of the fourteen platforms:

1. **A fact strip under the title.** 3–5 icon+value pairs in one horizontal row (level, duration, format, credential). edX renders it as a bordered card; Coursera as a white panel overlapping the hero; Udemy as an inline metadata line. It is the single most consistent pattern in the set.
2. **Dark hero band on detail pages.** Udemy, edX (partially), LinkedIn Learning and MasterClass all put course identity on a dark plane and the content on light below it. Creates a hard hierarchy break with zero extra scroll.
3. **Collapsed curriculum accordion with per-section counts.** Udemy: "45 sections • 374 lectures • 61h 53m" then collapsed rows each showing "9 lectures • 37min". Compresses a 374-item list into ~10 rows.
4. **Sticky in-page tab nav on long detail pages.** Coursera's About/Outcomes/Modules/Recommendations/Testimonials/Reviews bar. Turns a 6749px page into six addressable destinations.
5. **A self-contained, sticky buy card.** Price, CTA, and inclusions in one bordered box that follows the scroll. Udemy, Coursera, DataCamp, Pluralsight.
6. **The instructor as a face.** Photo, name, credential line. Coursera, edX, Udemy, LinkedIn Learning, MasterClass, Maven. Authority is transmitted by a human, not a byline.
7. **Horizontal carousels instead of vertical sections.** Coursera's homepage carries ~9 content groups in 6317px because each is a horizontally-scrolling row of 4–6 cards rather than a stacked slab.
8. **"Show more" on long prose.** Udemy and edX both truncate the description to ~4 lines with an expand link.
9. **FAQ accordion immediately before the footer.** Coursera, Skillshare, Teachable, Thinkific, DataCamp.

### What Practicable should learn

- **The fact strip.** Highest value-to-effort item in this document. The data already exists.
- **Density through horizontal grouping**, not through more sections.
- **Progressive disclosure** — accordions and tabs — as the answer to page length.
- **Differentiated card shapes per content type**, using the `--domain-*` colours that already exist.
- **Progress and resume as the dashboard's lead**, not a feature of a separate page.
- **Render the related content that is already being fetched.**

### What should NOT be copied

- **Coursera and Udemy's discount urgency.** "40% off", "Offer ends August 12", countdown banners. Practicable sells one-time professional resources to practitioners who expense them. Urgency theatre would actively damage the "private bank" positioning `theme.css` documents.
- **Fabricated social proof.** No star ratings, no "1,585,781 students", no testimonial carousels until there are real ones. A fake 4.7 is worse than no rating.
- **Skillshare's slab architecture.** 8397px of alternating full-width marketing panels — the anti-pattern §15A is written against.
- **MasterClass's cinematic scale.** Full-bleed video heroes and giant portrait typography. Beautiful, and wrong for a reference tool people use at work.
- **Udemy's visual noise.** Five competing accent colours, badge stacking, inconsistent type sizes.
- **Kajabi/Teachable/Thinkific's SaaS-marketing look.** Gradient blobs, floating UI screenshots, logo walls. These sell *software to creators*; Practicable sells *expertise to practitioners*.

### Recommended design direction

> **An editorial reference instrument.** Practicable should read like a well-made professional handbook that happens to be software — closer to the Financial Times or a Lloyd's market publication than to a course marketplace. Dense, typographically confident, quietly premium. Colour carries meaning (domain, state, tier), never decoration. Every page answers a practitioner's question with facts on the surface, not behind a scroll.

The existing brand direction in `theme.css` — *"private bank meets editorial publisher"* — is correct and should be **kept and extended into the authenticated product**, which is where it currently stops.

---

# 2. Platform-by-Platform Analysis

---

# Coursera

## Overall Design Character
Institutional-academic with an aggressive consumer-commerce layer bolted on. Blue (#0056D2) as a single dominant brand colour, Source Sans Pro throughout, heavy use of partner logos (Google, IBM, Stanford, Meta) as the primary trust device. The tension between "university credential" and "40% off this week" is visible and unresolved.

## Homepage
Content width ~1340px, centred. Total height **6317px** — but note *what* fills it: roughly nine distinct content groups, most of them horizontal carousels rather than vertical slabs. Structure:

1. Two side-by-side promotional cards (Coursera Plus 40% off / Coursera for Teams 30% off) in a carousel with dot pagination — the hero is a *promo slot*, not a value proposition.
2. "New and popular" — three columns, each a mini-list of 3 courses with provider logo, title, type and rating.
3. "Get job-ready" — tabbed (Data / Business / Sales & Marketing / IT / Software Engineering) with 4 certificate cards below. **One section carrying five categories via tabs** — a §15A pattern executed well.
4. Repeat of the two promo cards.
5. Partner logo strip — "Learn from 350+ leading universities and companies".
6. Three-up utility cards: Launch a new career / Try Coursera for Business / Earn a degree.
7. "Explore categories" — 12 pill-shaped category chips in two rows. Very high information density for ~80px of height.
8. Google Career Collection — dark blue panel, 4 cards.
9. "Trending searches" — three columns of mini-lists.
10. Learn AI skills — dark panel with tab chips, 4 cards.
11. "What brings you to Coursera today?" — 4 intent chips.
12. "Explore careers" — 5 role cards with illustration.
13. Outcome stat panel — "91% of learners achieved a positive career outcome" with a large donut chart. Dark navy.
14. "Why people choose Coursera" — 4 testimonials with photos.
15. FAQ accordion — 6 questions.
16. Footer.

**The lesson:** ~16 groups in 6317px, because carousels and multi-column mini-lists carry 3–6 items in the vertical space one card would take.

## Navigation
Two-tier header. Top strip: For Individuals / For Businesses / For Universities / For Governments (audience segmentation). Main bar: logo, "Explore" mega-menu trigger, "Degrees", a wide search field with a blue circular submit, then language, Log In, and a "Join for Free" outlined button. Sticky. The search field is ~500px wide and visually dominant — search is the primary discovery mechanism, not category browsing.

## Course Discovery
Search results use a **left filter sidebar** (~280px) with collapsible groups and inline result counts per option, and a results column of full-width horizontal cards. Filters appear on search/browse pages only, never on marketing pages.

## Course Cards
In carousels: ~230px wide. Structure top-to-bottom: 16:9 thumbnail → provider logo (small, ~20px) → course title (2 lines, semibold ~15px) → credential type ("Professional Certificate") → star rating with numeric value. Roughly 300px tall. No price on the card — price is deferred to the detail page, which suits a subscription-led model.

## Course Detail Page
The strongest single page in the set. **6749px**, structured as:

- Breadcrumb row (Browse › Data Science › Machine Learning).
- Blue promo bar (dismissible).
- **Hero on pale blue (#EFF6FF-ish)**: provider logos (DeepLearning.AI + Stanford Online), H1 at ~36px, "This course is part of [Specialization]" link, instructor avatars + names inline, a prominent blue **"Enroll for Free — Starts Aug 31"** button, then "1,235,235 already enrolled".
- **The fact strip** — a white card overlapping the hero's lower edge, four columns: *3 modules* (with "Gain insight into a topic and learn the fundamentals") / *4.9 ★ (11,613 reviews)* / *Beginner level* / *Flexible schedule (3 weeks at 10 hours a week)*. Each has a label, a value, and a one-line explainer. This is the pattern to steal.
- **Sticky tab bar**: About · Outcomes · Modules · Recommendations · Testimonials · Reviews.
- "What you'll learn" — two-column checklist.
- "Skills you'll gain" — pill chips with a "Show all" expander.
- "Details to know" — three columns (Shareable certificate / Assessments / Taught in English).
- Curriculum — collapsed accordion, one row per week with duration.
- **Right sidebar**: Instructors (photo, name, rating, learner count, "View all 41 instructors"), then "Offered by" with both partner logos.
- "Explore more from Machine Learning" — related course cards with a Related/Degrees tab toggle.
- Testimonials — 4 with photos.
- **Reviews block** — a 4.9 aggregate with a horizontal 5-to-1 star distribution bar chart beside three full reviews.
- Promo cards, FAQ accordion, footer.

## Learning Experience
*Not captured — authentication blocked.* From public course-preview pages: left outline rail with week/module grouping and per-item completion checkmarks, video centre, tabbed content below the player.

## Dashboard
*Not captured — authentication blocked.*

## Commerce
Subscription-first (Coursera Plus) with individual course purchase secondary. Pricing page leads with an annual/monthly toggle and a savings callout. Heavy discount framing throughout.

## Typography
Source Sans Pro. H1 ~36px/1.2 semibold, section H2 ~24px semibold, body 16px/1.5, metadata 14px, micro-labels 12px. Conservative and legible; not distinctive.

## Color
Brand blue #0056D2 for all primary actions and links. Pale blue washes for hero and section backgrounds. Dark navy (#00369E-ish) for emphasis panels. Magenta/pink for promotional urgency — a deliberate off-brand colour reserved for discounting, which is an interesting containment strategy.

## Spacing
Section rhythm ~64–80px. Card grid gap 24px. Generous but not wasteful; sections are internally dense.

## Components
Card, carousel with arrow + dot controls, accordion, tab bar (sticky), star-rating with distribution chart, pill chip, filter sidebar with counts, breadcrumb, logo strip, testimonial card, dismissible promo bar.

## Interaction Patterns
Sticky tab nav with scroll-spy; carousel arrows appearing on hover; accordion single-open; "Show all" expanding chip lists in place; filter counts updating live.

## What Works
- The fact strip. Four decision criteria, one row, ~120px.
- Sticky tab nav making a 6749px page navigable.
- Carousels producing high density without height.
- Review distribution chart — credible because it shows the 1-star tail.
- Tabbed category sections collapsing five sections into one.

## What Does Not Work
- Promotional cards *are* the hero. A first-time visitor learns "there's a sale" before "what this is".
- Two near-identical promo blocks repeated within one scroll.
- Trust signals are diffuse — logos, ratings, enrolment counts, testimonials, outcome stats all compete.
- Magenta discount styling reads as consumer-retail and undercuts the university framing.

## What Practicable Should Borrow
1. **The fact strip.** Directly applicable to CourseDetail, ProductBuy, PackDetail and Template.
2. **Sticky in-page tab nav** for CourseDetail and Question.
3. **Tabbed sections** to collapse Store's three type-sections into one.
4. **Related-content rail** — for the `related_products` already being fetched.
5. **Curriculum accordion** with per-module counts.

## What Practicable Should Avoid
- Promo-led hero, discount urgency, countdowns.
- Enrolment-count social proof (Practicable doesn't have the numbers and shouldn't invent them).
- Diffuse trust signalling.

## Screenshots
- `screenshots/coursera/01-home.png`
- `screenshots/coursera/02-browse.png`
- `screenshots/coursera/03-course-detail.png`
- `screenshots/coursera/04-plus-pricing.png`
- `screenshots/coursera/05-search-results.png`
- `screenshots/coursera/10-login-page.png` — progressive-disclosure login modal
- `screenshots/coursera/99-error.png` — reCAPTCHA block, documented

---

# Udemy

## Overall Design Character
Marketplace-utilitarian. Purple (#A435F0) brand, Suisse-style grotesque, extremely high information density, minimal decoration. Everything is optimised for comparison and conversion. It is not beautiful, but it is *efficient* — and it is the density benchmark in this set.

## Homepage
~4600px. Persistent top promo bar. Hero is a carousel of large promotional panels. Below: multiple horizontal course carousels grouped by "Recommended for you", topic, and category, interleaved with a "Top categories" tile grid and a trust-logo strip ("Trusted by over 16,000 companies").

## Navigation
Single-tier, sticky. Logo · Explore (mega-menu) · Subscribe · **wide rounded search field** · Udemy Business · Teach on Udemy · cart icon · Log in · Sign up (filled purple) · language globe. The search field is the widest element in the bar.

## Course Discovery
Category pages: left filter rail (Ratings / Video duration / Topic / Subcategory / Level / Language / Price / Features), sort dropdown, result count, and full-width horizontal result cards. The filter rail uses radio groups with counts.

## Course Cards
The most information-dense card in the set. ~340px wide in carousels: thumbnail → title (2 lines, bold) → instructor name (12px muted) → **rating number + star glyphs + review count in parentheses** → **current price bold + struck-through original price** → optional "Bestseller" / "Premium" badge. Roughly eight discrete data points in ~330px of height.

## Course Detail Page
**3025px — less than half Coursera's height, carrying comparable information.** This is the density model.

- Promo bar, then header.
- **Dark hero band (#1C1D1F)**, left ~62%: breadcrumb → H1 (~32px) → subtitle → **"Bestseller" badge + 4.7 ★★★★½ + "(473,628 ratings)" + "1,585,781 students"** all on one line → "Created by [instructor link]" → metadata row (last updated, language, captions, "28 more").
- Right ~38%: **floating sticky buy card** overlapping the hero band — video preview thumbnail with play overlay, then price, CTA stack, and inclusions.
- **"What you'll learn"** — a bordered box, **two columns**, 8 checklist items. ~150px for eight outcomes.
- "Explore related topics" — 5 tag chips.
- Feature callout (Coding Exercises) — two-column, text left, screenshot right.
- **"Course content"** — "45 sections • 374 lectures • 61h 53m total length" + "Expand all sections" link, then the first section expanded showing per-lecture rows (icon, title, optional Preview link, duration), remaining sections collapsed each showing "N lectures • Nhr Nmin", then a **"35 more sections"** button. **374 lectures in ~700px.**
- "Requirements" — 4 bullets.
- "Description" — truncated with **"Show more"**.
- Footer.

## Learning Experience
*Not captured — bot detection blocked login.* From public preview: video player left/centre, right rail with collapsible curriculum and completion checkboxes, tab strip below the player (Overview / Q&A / Notes / Announcements / Reviews / Learning tools).

## Dashboard
*Not captured.* Publicly documented as "My learning" with tabs (All courses / My Lists / Wishlist / Archived) and progress rings on course cards.

## Commerce
Individual purchase with permanent discounting. Cart, wishlist, and a subscription tier. Checkout is a single page with order summary right, payment left.

## Typography
Udemy Sans. H1 32px bold, H2 24px bold, body 16px, metadata 14px, micro 12px. Tight line-heights (~1.3 on headings). The tightness is a large part of why the page is short.

## Color
Purple #A435F0 primary. Near-black #1C1D1F for the hero band and text. Teal promo bar. Orange/amber for rating stars. Green for "Bestseller"-adjacent badges. Five accent families competing — the weakest part of the design.

## Spacing
Section gaps ~48px — noticeably tighter than Coursera's 64–80px. Card padding 16px. Content width ~1340px but the main column is constrained to ~1180px with the buy card floating outside it.

## Components
Sticky buy card, two-column checklist box, curriculum accordion with counts and preview links, "Show more" prose truncation, rating + review-count inline unit, filter rail, badge, breadcrumb, tag chip, promo bar.

## Interaction Patterns
Buy card sticks through the entire scroll; accordion sections expand in place; "Expand all sections" toggles all at once; hover on carousel cards reveals a popover with full description and CTA (a real density win — detail without navigation).

## What Works
- **Density.** Half the height of Coursera for the same decision-relevant content.
- The dark hero band creating instant hierarchy with no extra scroll.
- Two-column "What you'll learn" box.
- Curriculum accordion with counts — 374 items made scannable.
- "Show more" on prose.
- Sticky buy card.

## What Does Not Work
- Colour discipline. Purple, teal, orange, green and near-black all fight.
- Permanent "sale" pricing destroys price credibility.
- Badge inflation ("Bestseller", "Highest rated", "Hot & new") on nearly every card.
- Typographic hierarchy is carried almost entirely by weight and size — no serif, no case, no rule devices, so long pages read flat.

## What Practicable Should Borrow
1. **The whole density model** for CourseDetail — dark band, two-column outcomes box, accordion with counts, "Show more".
2. **Sticky buy card** — `ProductBuy.tsx` already does this (`lg:grid-cols-[1fr_380px]`); CourseDetail should too.
3. **Per-module counts** on collapsed accordion rows.
4. **Hover-preview popover** on catalogue cards — high value for question cards specifically.

## What Practicable Should Avoid
- Everything about the pricing presentation.
- Badge inflation.
- The five-accent palette.

## Screenshots
- `screenshots/udemy/01-home.png`
- `screenshots/udemy/02-category.png`
- `screenshots/udemy/03-course-detail.png` — **the density reference**
- `screenshots/udemy/10-login-page.png`
- `screenshots/udemy/99-error.png` — bot-detection block, documented

---

# edX

## Overall Design Character
Academic-institutional, the most restrained of the three MOOC platforms. Deep green (#00262B) and orange-red (#D23228) on white and warm off-white. Serif display type on some surfaces. Reads as a university extension office — appropriate, slightly dated.

## Homepage
~5000px. Search-led hero, then category tiles, then partner university logos, then program-type explainers (MicroMasters / Professional Certificate / Bachelor's / Master's), then trust and testimonial blocks.

## Navigation
Two-tier. Top: edX logo, "Learn" dropdown, wide search field, then edX for Business / edX for Learners / Sign in / **"Register for free"** (filled orange-red). A dismissible promo bar sits above.

## Course Discovery
Search page with a **left filter sidebar** — Subject, Partner, Program, Level, Language, Availability — each with counts, plus a result count and sort control. Results are wide horizontal cards: thumbnail left, title/partner/type/duration right.

## Course Detail Page
**6943px.** Structure:

- Breadcrumb (Home › Learn › Computer Science › HarvardX CS50).
- Promo bar with a discount code.
- **White hero card on a pale blue-grey ground**: Harvard shield logo → H1 (~34px, "HarvardX: CS50's Introduction to Computer Science") → one-line description → an opt-in checkbox for partner emails. Right column: "Next course starts Aug 20 / Ends Dec 31", **"Enroll HarvardX certificate"** (orange-red), "7,438,646 already enrolled", and an "Audit course" secondary link.
- **The fact strip — as a distinct bordered card below the hero**, four columns each icon + label + sublabel: *Introductory (No prior experience required)* / *Self-paced (Progress at your own speed)* / *12 weeks (6-18 hours per week)* / *Earn a certificate (Advance your career today!)*. Cleaner than Coursera's version because it is a self-contained card with a visible border rather than an overlapping panel.
- Dark green promotional band with a discount code and a photo.
- "About this course" — prose with **"Show More"**, video thumbnail right.
- "Awards" — small badge images.
- "Earn a school-verified certificate" — two-column feature panel on a tinted ground, certificate mockup right.
- "What you'll learn" — **two-column checklist**, 6 items.
- "Grow these skills" — ~14 skill chips.
- **"Want a deeper learning experience?"** — a tinted panel with three upsell program cards, each showing course count, pace, **price with struck-through original**, and a "Learn more" button. Then "Show more programs".
- **"Meet your instructors"** — three cards, each photo + name + full academic title + institution.
- Repeated enrol CTA with the date and enrolment count.
- "Hear what other learners have to say" — three testimonial cards with photo, name, location, and carousel dots.
- "Share this course" — social icons.
- "Interested in this course for your business or team?" — B2B band.
- Very large footer (four columns of ~10 links each).

## Learning Experience
*Not captured — account lockout.* edX's Open edX interface is publicly documented: left course-outline rail with unit-level completion, a horizontal sequence navigator ("unit ribbon") above the content, and Previous/Next controls.

## Dashboard
*Not captured.* Documented as a course-card list with progress and "Resume course".

## Commerce
Free-to-audit with a paid verified certificate — a genuinely different model. The "Audit course" link sits *beside* the paid CTA, which is unusually honest and worth noting.

## Typography
Inter-like sans for UI; a serif appears in some marketing headings. H1 ~34px, H2 ~24px, body 16px/1.6. Comfortable, slightly loose.

## Color
Deep green #00262B for dark bands and text. Orange-red #D23228 for primary CTA — high-contrast, unambiguous, used sparingly. Warm off-white grounds. **The most disciplined palette of the three MOOCs.**

## Spacing
Generous — section gaps ~72–96px. This is why the page is 6943px for less content than Udemy's 3025px. The looseness reads as academic calm but costs a great deal of scroll.

## Components
Fact-strip card, two-column checklist, instructor card with credentials, upsell program card with pricing, testimonial carousel, skill chips, "Show More" truncation, filter sidebar, breadcrumb, dismissible promo bar.

## Interaction Patterns
Prose truncation; testimonial carousel with dots; accordion on FAQ; filter checkboxes with live counts.

## What Works
- **The bordered fact-strip card.** The cleanest execution of this pattern in the set — this is the one to model.
- Instructor cards with real academic credentials — authority done properly.
- One restrained CTA colour used consistently.
- "Audit course" beside the paid CTA — honest access framing.
- Two-column outcome checklist.

## What Does Not Work
- Excessive vertical spacing — 6943px for content Udemy fits in 3025px.
- No sticky in-page nav on a very long page.
- The enrol CTA repeats three times with the same content.
- Struck-through pricing on the upsell cards conflicts with the institutional tone.
- Footer is enormous.

## What Practicable Should Borrow
1. **The bordered fact-strip card** — the primary model for Practicable's implementation.
2. **Instructor/author card with credentials** — Practicable has `author_name` as a text fragment; this should become a proper card.
3. **The disciplined single-CTA-colour** approach (Practicable already does this).
4. **"Audit" framing** — Practicable's free questions alongside paid courses is the same honest structure and should be surfaced as clearly.

## What Practicable Should Avoid
- The spacing. This is the closest platform to Practicable's current failure mode.
- Repeated identical CTAs.
- The oversized footer.

## Screenshots
- `screenshots/edx/01-home.png`
- `screenshots/edx/02-search.png`
- `screenshots/edx/03-course-detail.png` — **the fact-strip reference**
- `screenshots/edx/04-programs.png`
- `screenshots/edx/10-login-page.png`, `11-login-filled.png`
- `screenshots/edx/12-after-login.png` — the lockout error, documented

---

# Skillshare

## Overall Design Character
Creative-consumer. Black grounds, bright saturated illustration, rounded geometric sans, playful. Aimed at hobbyists and creatives. The furthest of any platform from Practicable's audience — useful mainly as a **counter-example**.

## Homepage
**8397px — the longest page in the set, carrying the least information.** Structure is a sequence of alternating full-width slabs:

1. Hero — headline over an abstract green squiggle, with a signup card (Google/Facebook/Apple/email) right.
2. Full-bleed category image strip (5 photo tiles: Graphic Design, Illustration, Animation, Film & Video, Freelance).
3. Black slab — "Creative Learning Made Easy" with 4 checkmark bullets.
4. **Stat row** — 425k+ members / 30k+ classes / 9k+ teachers / 4.8★ app rating, in four bordered tiles on black. *This one is good.*
5. "Explore Inspiring Online Courses" — filter chips + a 2×4 card grid.
6. "Explore Your Creative Feed" — three icon+text blocks with a photo collage.
7. "Learn from Creative Experts" — 2×4 grid of teacher portrait cards.
8. "Why Students Love Skillshare" — 4 testimonials.
9. "Skillshare for Teams" — black slab.
10. FAQ accordion.
11. "Featured In" — logo strip.
12. Social follow.
13. Very large footer with ~40 SEO links.

Nine of these thirteen are full-width slabs containing one idea each.

## Navigation
Minimal, sticky. Logo · Browse · wide search · Sign in · **Sign up** (filled green). Deliberately sparse.

## Course Discovery
Filter chips (Featured / Music / Drawing & Painting / Marketing / Animation / Social Media / Creative Writing / Digital Illustration / Film & Video / Crafts / Freelance & Entrepreneurship / Graphic Design / Photography / Productivity) above a card grid. **No left filter rail** — chips only. Appropriate for browsing-by-mood, wrong for finding-by-criteria.

## Class Cards
4-up grid. Large 16:9 thumbnail with a duration overlay → "Staff Pick" badge → title (2 lines) → teacher name → student count. Image-dominant; the thumbnail is ~55% of card height. This works because *creative work is visual*. It would not work for risk-management content, where a thumbnail carries no information.

## Class Detail Page
Video preview hero, title, teacher, class length, "About this class" prose, lesson list, projects & resources tab, reviews, related classes.

## Learning Experience
*Not captured.* Documented as: video left/centre, right rail with lesson list and a "Projects & Resources" tab, community discussion below.

## Dashboard
*Not captured.*

## Commerce
Subscription only — "Get 7 free days of Skillshare" is the single conversion goal, present in the hero and repeated. No individual purchase, no cart.

## Typography
Rounded geometric sans throughout. Very large display headings (~48px+) in the slabs. Body 16–18px. Generous line-heights. Friendly, low-authority.

## Color
Black and white grounds alternating, with saturated green as the action colour and multi-coloured illustration. High contrast, high energy.

## Spacing
Extremely loose. Slab padding ~96–128px vertical. This is the primary cause of the 8397px height.

## Components
Stat tile row, filter chip row, image-dominant card, teacher portrait card, testimonial card, FAQ accordion, logo strip, social signup card.

## Interaction Patterns
Filter chips swap the grid in place; FAQ accordion; hover states on cards reveal a play affordance.

## What Works
- **The stat tile row** — four bordered tiles on a dark ground, each a number + label. Compact, credible, ~100px. Directly adaptable.
- Filter chips above the grid — lighter than a filter rail when criteria are few.
- Social-signup-first auth card.

## What Does Not Work
- **The slab architecture.** Nine full-width single-idea sections. This is the failure mode §15A exists to prevent.
- Image-dominance without informational images.
- Testimonials with no attribution beyond a first name.
- The footer's ~40 SEO links.

## What Practicable Should Borrow
1. **The stat tile row.** Practicable has real numbers — 100 questions, 5 domains, 7 filter dimensions, N templates. Four tiles on the dark stage plane, on the homepage and dashboard.
2. **Filter chips** where the criteria set is small.

## What Practicable Should Avoid
- The entire vertical architecture.
- Image-led cards.
- Unattributed testimonials.

## Screenshots
- `screenshots/skillshare/01-home.png` — **the length anti-pattern**
- `screenshots/skillshare/02-browse.png`
- `screenshots/skillshare/03-class-detail.png`

---

# Kajabi

## Overall Design Character
Modern B2B SaaS marketing. Gradient washes, floating product screenshots at an angle, rounded cards with soft shadows, a friendly geometric sans. Sells *software to creators*, so the entire site is about the creator's earnings, not the learner's outcome. Structurally instructive; tonally irrelevant to Practicable.

## Homepage
~7000px. Hero with a headline, dual CTA and an angled product screenshot; then creator earnings stats; then feature blocks alternating text/screenshot; then testimonials with creator photos and revenue figures; then pricing preview; then FAQ; then footer.

## Navigation
Products / Solutions / Resources / Pricing mega-menus, "Log in", "Start free trial" (filled). Standard SaaS.

## Course Discovery
N/A — no learner-facing catalogue.

## Cards
Feature cards with an icon, a heading, two lines of body, and a link. Soft shadow, 12–16px radius, generous padding. Pricing cards with a highlighted "most popular" tier.

## Product Detail
Feature pages: alternating two-column text/visual blocks, each with an eyebrow, a heading, body, and a bulleted list.

## Learning Experience
Kajabi's *learner* interface is shown only in marketing screenshots: a clean course player with a left lesson outline and completion checkmarks — visually similar to Teachable and Thinkific.

## Dashboard
Creator dashboard shown in marketing: revenue stat cards top, chart, recent activity list.

## Commerce
Tiered subscription pricing with a monthly/annual toggle and a savings badge. Comparison table below the tier cards.

## Typography
Geometric sans, H1 ~56px, H2 ~40px. Large and airy.

## Color
Blue-to-purple gradients, white and very pale grey grounds, high-saturation accents.

## Spacing
Very loose — 96–120px section gaps.

## Components
Gradient hero, angled screenshot mockup, feature card, pricing tier card, comparison table, testimonial with metric, FAQ accordion, logo strip.

## Interaction Patterns
Monthly/annual toggle recalculating prices in place; comparison-table row highlighting; mega-menu.

## What Works
- **Pricing comparison table** — genuinely the clearest way to compare tiers.
- **Testimonials carrying a metric** ("$2M in course sales") rather than a sentiment. Specific claims are credible; vague praise isn't.
- Monthly/annual toggle.

## What Does Not Work
- Gradient-and-floating-screenshot aesthetic is generic SaaS.
- Enormous type at the expense of information.
- The learner experience is entirely invisible.

## What Practicable Should Borrow
1. **The comparison table** — for the bundle vs. individual-product decision that `Store.tsx` currently expresses only as a `BundleCard`.
2. **Specific-metric testimonials** — when Practicable has real ones, quote a *specific outcome*, not praise.

## What Practicable Should Avoid
- The entire visual language. This is the "generic SaaS dashboard" the quality bar in §26 explicitly rules out.

## Screenshots
- `screenshots/kajabi/01-home.png`
- `screenshots/kajabi/02-pricing.png` — comparison table reference
- `screenshots/kajabi/03-features.png`
- `screenshots/kajabi/04-templates.png`

---

# LinkedIn Learning

## Overall Design Character
Corporate-professional. LinkedIn's blue-and-white system, tight information density, everything framed around career advancement and skills. **Tonally the closest platform in this set to Practicable's audience** — professionals learning for work, not hobbyists.

## Homepage
Search-led. Topic tiles, "Most popular courses", role-based paths, and a strong emphasis on the skills graph. Content width ~1128px — narrower than the MOOCs, which increases perceived density.

## Navigation
Integrated into LinkedIn's global nav. Within Learning: Browse (topic mega-menu), search, "My Learning".

## Course Discovery
Topic pages combine a short editorial intro with a filterable course list. Filters: Level, Duration, Software, Type. Left rail.

## Course Cards
Compact and text-led. Small thumbnail, title, instructor, duration, level, and a "Saved" bookmark toggle. Ratings shown as a numeric average. **Lower image-dominance than Skillshare — appropriate for professional content**, and the right model for Practicable.

## Course Detail Page
Title, instructor with photo and headline, duration, level, release date, "Skills you'll gain" chips, a collapsed contents accordion, and a right-rail card with the CTA and inclusions. Notably includes **"People also viewed"** and a "Related courses" rail.

## Learning Experience
*Not captured — requires a LinkedIn account.* Publicly documented: video left, right rail with contents/transcript/notes tabs, per-video completion, and a course progress percentage in the header.

## Dashboard
"My Learning" with In Progress / Saved / Learning History tabs and progress bars per course.

## Commerce
Subscription, bundled with LinkedIn Premium.

## Typography
LinkedIn's system sans. Tight, small, dense — body 14px in many places. Professional-utility register.

## Color
LinkedIn blue for actions, near-black text, white and very pale grey grounds. Minimal decoration. Green for completion states.

## Spacing
Tight. Section gaps ~40–56px. Card padding 12–16px.

## Components
Compact course card with bookmark toggle, skills chips, contents accordion, right-rail CTA card, tabbed "My Learning", progress bar, "People also viewed" rail.

## What Works
- **Text-led compact cards.** The right density model for professional content.
- **Bookmark/save affordance on every card** — a low-commitment action that builds a return reason.
- Skills chips as a scannable capability summary.
- Progress percentage in the learning header.
- Tabbed "My Learning" (In Progress / Saved / History) — three states, one page.

## What Does Not Work
- 14px body text in long-form contexts is genuinely hard to read.
- Very little visual personality — it is *efficient* and *forgettable*.
- Discovery is weak if you don't already know the skill name.

## What Practicable Should Borrow
1. **Compact text-led cards** for the courses and templates catalogues.
2. **A save/bookmark affordance** — currently entirely absent from Practicable, and the single strongest "reason to return" mechanism in the set. §21's "dead ends" and §26's "reason to return" both point here.
3. **Tabbed My Learning** — the model for consolidating Practicable's Library sections.
4. **"People also viewed" / related rail.**

## What Practicable Should Avoid
- The 14px body size.
- The absence of visual personality — this is precisely the "bland" failure Practicable is trying to escape, and LinkedIn Learning demonstrates that density alone doesn't solve it. **Density plus typographic character is the target.**

## Screenshots
- `screenshots/linkedin-learning/homepage.png`
- `screenshots/linkedin-learning/topics-browse.png`
- `screenshots/linkedin-learning/course-detail.png`

---

# MasterClass

## Overall Design Character
Cinematic-premium. Full-bleed video, black grounds, large serif/display typography, instructor portraits treated as film posters. Perceived value is manufactured almost entirely through **production quality and the fame of the instructor**. The most "premium-feeling" platform in the set, and the one whose methods are least transferable.

## Homepage
Full-bleed autoplay video hero with an instructor portrait and name, then horizontally-scrolling category rails (exactly Netflix's shelf model), then a membership pitch, then testimonials.

## Navigation
Minimal and overlaid on the hero. Logo, categories, search, Sign In, "Get Started".

## Course Discovery
Category pages are horizontal shelves of portrait-orientation instructor cards. Browsing is by *person*, not by topic.

## Class Cards
Portrait aspect (~2:3), full-bleed instructor photograph, name in large type overlaid, discipline as a small label. Essentially a film poster. Extremely high visual appeal, extremely low information content — the card tells you *who*, not *what you'll learn*.

## Class Detail Page
Video trailer hero, instructor name and discipline, a short editorial description, lesson list with durations, "Meet your instructor" with a long-form bio, a downloadable workbook mention, and related classes.

## Learning Experience
*Not captured — subscription wall.* Marketing shows a full-width video player with a lesson rail below and a workbook download.

## Commerce
Subscription only, with tiered plans. Pricing page uses a three-tier comparison.

## Typography
A high-contrast display serif for names and headings, clean sans for UI. Headings are very large (60px+). This is the source of the premium feel.

## Color
Black, white, and the photography. Almost no chrome colour at all. **Restraint as luxury signalling.**

## Spacing
Cinematic — huge. Full-viewport heroes.

## Components
Video hero, portrait poster card, horizontal shelf, instructor bio block, lesson list, tiered pricing.

## What Works
- **Restraint as a premium signal.** Almost no UI colour; the content is the decoration. Practicable's `theme.css` already reasons this way.
- **The instructor as the product.** Authority is a person with a face and a track record.
- **Horizontal shelves** — high density, zero vertical cost.
- **A downloadable workbook per class** — the artefact that makes the video feel substantial. *Practicable's templates are exactly this, and are currently undersold.*

## What Does Not Work
- Cards carry no information. You cannot compare two classes.
- No search-by-criteria.
- Full-viewport heroes are wasteful for anything used as a reference.

## What Practicable Should Borrow
1. **The author-as-authority treatment.** Practicable's `author_name` is currently a string in a muted metadata line. It should be a proper card with a photograph and a practitioner credential — this is the platform's single strongest trust asset and it is currently near-invisible.
2. **The workbook/artefact framing.** Practicable's templates should be presented as *the thing you take away and use*, prominently, on every course and question page.
3. **Restraint.** Let typography and content carry the premium feel.

## What Practicable Should Avoid
- Cinematic heroes.
- Information-free cards.
- Person-led rather than problem-led discovery — Practicable's entire proposition is **question-first**, which is the opposite axis.

## Screenshots
- `screenshots/masterclass/homepage.png`
- `screenshots/masterclass/category-business.png`
- `screenshots/masterclass/class-detail.png`
- `screenshots/masterclass/pricing.png`

---

# Maven

## Overall Design Character
Cohort-based, expert-led, editorial. Clean sans, generous whitespace, strong emphasis on the instructor's professional credibility ("ex-Airbnb", "ex-Stripe"). Sells **scarcity through cohorts** — courses have start dates and limited seats. Structurally the most interesting comparison for Practicable because it also sells expertise from named practitioners rather than institutions.

## Homepage
Search/browse-led, with course cards showing instructor, company pedigree, next cohort date, and price. Notably **price is on the card**, which the MOOCs avoid.

## Navigation
Simple: logo, browse, search, "For Teams", Log in, Sign up.

## Course Discovery
Filterable browse with categories, price ranges, and start dates. Cards are text-led.

## Course Cards
Instructor photo (small, circular) + name + credential line ("Product Lead at Stripe") → course title → next cohort date → duration → price → rating. **Roughly seven data points, text-led, ~280px.** The credential line does enormous work.

## Course Detail Page
Long-form and editorial: hero with title, instructor, cohort dates and price; "Who is this for" with persona bullets; a detailed curriculum; a long instructor bio with career history; testimonials from named professionals with their job titles; and an FAQ. **Testimonials cite the reviewer's role and company**, which makes them credible in a way anonymous star ratings are not.

## Learning Experience
Cohort-based — live sessions, so less of a self-serve interface. Not directly comparable.

## Commerce
One-time purchase per cohort, at professional price points (often $1000+). No discounting. **Price is stated plainly and never struck through** — this is the correct model for Practicable.

## Typography
Clean sans, comfortable sizes, strong hierarchy. Editorial but not showy.

## Color
Restrained — near-black text, white grounds, a single accent. Instructor photography provides the colour.

## Spacing
Generous but purposeful.

## Components
Instructor credential card, cohort date badge, curriculum outline, named testimonial with role, price display, persona-targeting bullets.

## What Works
- **Named testimonials with job titles.** Far more credible than star ratings for a professional audience.
- **"Who is this for" persona bullets.** Directly answers a question every Practicable visitor has.
- **Credential lines on the instructor.** "Ex-Stripe" does more than a 4.8 rating.
- **Plain, confident pricing** with no discount theatre.
- Price on the catalogue card.

## What Practicable Should Borrow
1. **"Who is this for"** — a short persona block on course and pack pages. Practicable's audience (risk, cyber, compliance, resilience, AI practitioners) is well-defined and currently never stated on a product page.
2. **Named testimonials with role and organisation** — when real ones exist.
3. **Practitioner credential line** for the author.
4. **Plain pricing.** Practicable already does this — it is a strength and should be kept.
5. **Price on the catalogue card** — `CoursesCatalogue` currently shows no price at all.

## What Practicable Should Avoid
- Cohort scarcity mechanics — Practicable's content is evergreen and self-serve; artificial scarcity would be dishonest.

## Screenshots
- `screenshots/maven/homepage.png`
- `screenshots/maven/course-browse.png`
- `screenshots/maven/course-detail.png`

---

# Teachable & Thinkific

*(Grouped — near-identical positioning, structure and visual language.)*

## Overall Design Character
Creator-platform SaaS marketing, structurally almost identical to Kajabi. Bright, rounded, gradient-touched, screenshot-led. Both sell course-hosting software to creators.

## Homepage
Hero with headline + CTA + product screenshot; feature blocks alternating text/visual; creator testimonials with earnings figures; pricing preview; FAQ; footer. ~6000–7000px.

## Navigation
Product / Pricing / Resources / Customers mega-menus, Log in, "Get started free".

## Pricing Page
The most useful page on either site: **three or four tier cards with a highlighted recommended tier, a monthly/annual toggle showing the annual saving, and a full feature-comparison table below**. Both execute this well.

## Learning Experience
Visible only in marketing screenshots: a clean player with a left lesson outline, completion checkmarks, and a progress bar. Both are notably plainer than the MOOC players — which is instructive: **a simple, uncluttered player is a legitimate design position.**

## Typography / Color / Spacing
Geometric sans, large headings, blue or green accents, pale grounds, loose spacing.

## What Works
- The pricing tier + comparison table combination.
- The annual/monthly toggle with a computed saving.
- Clean, uncluttered course players.

## What Does Not Work
- Interchangeable visual identity. Teachable, Thinkific and Kajabi are difficult to tell apart — a direct demonstration that generic-SaaS styling produces exactly the blandness Practicable is trying to escape.

## What Practicable Should Borrow
1. **The comparison table** for bundle vs. parts.
2. **The computed saving** — `BundleCard.tsx` already does real arithmetic on this, which is correct and better than most.

## What Practicable Should Avoid
- The visual language, entirely.

## Screenshots
- `screenshots/teachable/homepage.png`, `pricing.png`, `features.png`
- `screenshots/thinkific/homepage.png`, `pricing.png`

---

# Brilliant

## Overall Design Character
Interactive-first, playful-but-rigorous. Bright accent colours on white and dark grounds, heavy use of custom interactive diagrams and illustration. The proposition is *learning by doing*, and every design decision serves it.

## Homepage
Comparatively short and focused. Hero states the proposition and shows an interactive widget; then course category tiles with distinctive illustrations; then a "how it works" sequence; then testimonials; then pricing. **Notably tighter than the MOOCs.**

## Course Discovery
Category tiles with strong, distinct illustration per subject. **The illustration system is the differentiator** — each course is visually identifiable.

## Course Cards
Illustration-led with a title and a lesson count. The illustrations are custom and subject-specific, which makes the catalogue genuinely scannable — you recognise "Logic" or "Probability" by its image.

## Learning Experience
The strongest in the set for non-video learning: a single interactive problem per screen, immediate feedback, a visible progress bar for the lesson, and streak/completion mechanics. Minimal chrome.

## Typography
Clean geometric sans, comfortable sizes, strong hierarchy.

## Color
A distinct accent per subject area — **the same strategy as Practicable's `--domain-*` tokens**, executed visibly and consistently across catalogue, course and lesson surfaces.

## What Works
- **Per-subject colour and illustration identity**, applied consistently. This is what Practicable's domain colours are *for* and currently under-deliver on.
- **One idea per screen** in the learning interface.
- Visible per-lesson progress.
- A short, focused homepage.

## What Does Not Work
- Gamification (streaks) reads as consumer-app and would be wrong for a professional tool.

## What Practicable Should Borrow
1. **Consistent domain identity across every surface.** Practicable has five documented domain colours used on the homepage and question cards but *not* on the courses catalogue, templates catalogue, library, or dashboard. Extending them is the highest-value "less bland" change available that costs no vertical space.
2. **Per-lesson progress visibility.**
3. **A short, focused homepage.**

## What Practicable Should Avoid
- Streaks and gamification.

## Screenshots
- `screenshots/brilliant/homepage.png`
- `screenshots/brilliant/courses-catalog.png`
- `screenshots/brilliant/pricing.png`

---

# O'Reilly Learning

## Overall Design Character
Reference-library. Dense, text-led, utilitarian, built for professionals who need to *look something up*. Red accent on white, minimal decoration, very high information density. **The closest platform in the set to Practicable's actual job-to-be-done** — reference material for working professionals.

## Homepage
Marketing-led (it sells enterprise subscriptions), but the product itself is a searchable library.

## Course Discovery
Search-dominant, with format filters (Book / Video / Live event / Course / Audiobook / Article) and topic filters. **Format is a first-class filter dimension** — which is exactly Practicable's question/course/template/pack distinction.

## Cards
Text-led with a small book/video cover, title, author, publisher, publication date, and format label. Very compact — 6+ data points in a tight row. Optimised for scanning a long result list.

## Learning Experience
*Not captured — enterprise auth.* The reading interface is publicly documented: a table-of-contents rail, the content column, and controls for font size, highlighting and notes. **Highlighting and note-taking are first-class features** — appropriate for reference material.

## Typography
Utilitarian sans for UI, a serif for long-form reading content. **The same sans/serif split as Practicable's Schibsted Grotesk + Newsreader.**

## Color
Red accent, near-black text, white ground. Almost no decoration.

## Spacing
Tight. This is a working tool.

## What Works
- **Format as a primary filter dimension.**
- **Sans UI / serif content split** — validates Practicable's existing choice.
- **Extreme density in result lists** — the right model for a reference catalogue.
- Notes and highlights as first-class reading features.
- Publication/review dates shown prominently — **currency of information is a trust signal for reference material.**

## What Does Not Work
- Visually dry. Efficient, unmemorable — the same trap as LinkedIn Learning.

## What Practicable Should Borrow
1. **Format/type as a first-class filter** across a unified search.
2. **Date currency signals.** `VersionStamp.tsx` and `last_reviewed_at` already exist in the codebase — surface them prominently. For risk and compliance content, "reviewed August 2026" is a *major* trust signal and is currently buried.
3. **Dense list views** as an alternative to card grids for catalogues.

## What Practicable Should Avoid
- Total absence of visual character.

## Screenshots
- `screenshots/oreilly/homepage.png`
- `screenshots/oreilly/online-learning.png`
- `screenshots/oreilly/pricing.png`

---

# DataCamp

## Overall Design Character
Technical-professional, well-organised, notably **denser than the MOOCs while staying visually warm**. Green accent, dark navy sections, clean sans. A good middle point between Udemy's density and edX's calm.

## Homepage
Value proposition hero with a dual CTA, then a stat row, then role-based paths ("Data Analyst", "Data Scientist", "Data Engineer"), then a technology logo strip, then testimonials, then pricing. Moderate length, high density.

## Course Catalog
A dense filterable list: left filters (Technology, Topic, Level, Duration) with a "Clear All" control, a live "778 Courses" count, an in-page search field, and a paginated card grid.

**Correction to a common assumption:** DataCamp runs **two columns**, not three or four, and the catalogue page is **8188px** with pagination at the bottom. The density does *not* come from column count — it comes from **card anatomy**. Each card carries, in ~150px of height:

```
COURSE                          ← type eyebrow, mono-ish, muted
Introduction to Python          ← title, ~20px semibold
▮ Basic │ ★ 4.8+ │ 9,463 reviews ← level + rating + count, one row
Master the basics of data
analysis with Python in just
four hours…                     ← 3-line description
Data Science                    ← category
🕐 4 hours                      ← duration
```

**Seven facts per card**, separated by thin vertical rules, with the level indicator as a small bar-chart glyph rather than a word alone. This is the pattern worth taking — not the grid geometry.

## Course Cards
Technology icon → title → level badge → duration → 1-line description → rating. Compact, text-led, comparable at a glance.

## Course Detail Page
Title, a **fact strip** (duration, level, technology, prerequisites), "What you'll learn", a chapter accordion with per-chapter exercise counts, instructor card, and a right-rail CTA.

## Learning Experience
Split-screen: instructions/content left, an interactive code editor right, with a per-chapter progress bar in the header and XP/completion feedback. Highly regarded.

## Commerce
Subscription with a free tier. Pricing page has a clear tier comparison.

## Typography
Clean sans, moderate sizes, good hierarchy. Body 16px.

## Color
Green accent, dark navy for emphasis bands, white and pale grounds. Technology icons supply colour variety.

## Spacing
Moderate — 48–64px section gaps. **The right balance.**

## Components
Fact strip, chapter accordion with counts, level badge, duration label, technology icon, filter rail, progress bar, stat row, tier comparison.

## What Works
- **Seven facts per card in ~150px** — the density comes from card anatomy, not grid geometry.
- **Level + rating + count on one rule-separated row.**
- **Level as a glyph** (a small bar-chart mark) rather than only a word.
- **Live result count** ("778 Courses") beside the browse heading.
- **Chapter accordion with per-chapter exercise counts.**
- Role-based entry paths ("I want to become a…").

## What Does Not Work
- 8188px with pagination — a very long page for a two-column grid.
- Some marketing pages drift toward generic SaaS.

## What Practicable Should Borrow
1. **The card anatomy** — type eyebrow, title, a rule-separated metadata row, a clamped description, category, duration. Practicable's seven tag dimensions (effort, duration, cost, roi_horizon, tier, regulator_pressure, leadership_traits) are *far richer* than DataCamp's two, and are currently shown on question cards but on **no other card type**.
2. **Level/effort as a glyph plus a word.**
3. **Live result counts** on catalogue headings.
4. **Role-based entry paths** — "I'm a risk manager / CISO / compliance lead" alongside the question search.

> **Note on column count.** An earlier draft of this document claimed DataCamp runs 3–4 columns. It does not — it runs two. The recommendation for Practicable to move to 3 columns still stands, but it rests on Coursera's and Brilliant's catalogue grids and on Practicable's own card being ~600px wide at `sm:grid-cols-2`, **not** on DataCamp.

## Screenshots
- `screenshots/datacamp/homepage.png`
- `screenshots/datacamp/course-catalog.png` — **the catalogue density reference**
- `screenshots/datacamp/course-detail.png`
- `screenshots/datacamp/pricing.png`

---

# Pluralsight

## Overall Design Character
Enterprise-technical. Dark navy and pink/magenta accent, clean sans, skill-assessment-led. Positions itself around *measuring* skill, not just teaching it.

## Homepage
Enterprise-focused hero, role/skill paths, the "Skill IQ" assessment proposition, technology logos, and case studies.

## Course Discovery
Browse by technology/role with a filter rail. Skill paths are a first-class object — an ordered sequence of courses toward a role.

## Cards
Text-led: title, author, level, duration, and a small technology icon. Compact.

## Learning Experience
*Not captured.* Documented: video with a left table-of-contents rail, transcript search, playback speed, and per-course progress.

## Commerce
Subscription, individual and team tiers.

## Typography
Clean sans, moderate sizes, tight hierarchy.

## Color
Dark navy grounds with a magenta/pink accent. Distinctive — the accent is unusual enough to be memorable, which is worth noting given Practicable's blandness problem. **A single unexpected accent colour is a cheap and effective identity device.**

## Spacing
Moderate to tight.

## What Works
- **Skill paths** — an ordered, named sequence with visible progress toward a defined outcome.
- **Assessment-led positioning** — "find out what you don't know" is a strong entry point for professionals.
- A distinctive accent colour on a dark ground.

## What Practicable Should Borrow
1. **Paths.** Practicable's `ModuleQuestion` relationships and `related_products` already form an implicit graph: question → course → template. Naming and showing that as a **path** ("Risk register, start to finish") would make the product model legible — and `Store.tsx` already has a `BundleCard` doing exactly this commercially. The *pedagogical* version is missing.
2. **A diagnostic entry point** — "which of these is your situation?" as an alternative to search.
3. **Confidence in an accent colour on a dark ground** — Practicable's `--stage` + `--gold` pairing is already this, and works.

## What Practicable Should Avoid
- Enterprise-sales-led framing.

## Screenshots
- `screenshots/pluralsight/homepage.png`
- `screenshots/pluralsight/browse-library.png`
- `screenshots/pluralsight/pricing.png`

---

# 3. Platform Comparison

| Area | Coursera | Udemy | edX | Skillshare | Kajabi | **Best pattern** |
|---|---|---|---|---|---|---|
| **Homepage** | Promo-led, carousel-dense | Promo-led, carousel-dense | Search-led, spacious | Slab-architecture, 8397px | SaaS marketing | **Brilliant** — short, focused, proposition-led |
| **Navigation** | Two-tier + mega-menu | Single-tier, search-dominant | Two-tier + promo bar | Minimal | SaaS mega-menu | **Udemy** — search as the widest element |
| **Course discovery** | Filter sidebar + counts | Filter rail + sort | Filter sidebar + counts | Chips only | N/A | **DataCamp** — dense list, 3–4 across, filters that matter |
| **Course cards** | Image-led, no price | 8 data points, price | Image + partner | Image-dominant | N/A | **Maven / LinkedIn** — text-led, credential + price |
| **Course detail** | 6749px, tabbed | **3025px, dense** | 6943px, spacious | Moderate | N/A | **Udemy** structure + **edX** fact strip |
| **Video learning** | Rail + tabs | Rail + tabs | Rail + ribbon | Rail + projects | Plain player | **DataCamp** — split-screen, do-while-learning |
| **Dashboard** | *Not captured* | *Not captured* | *Not captured* | *Not captured* | Creator stats | **LinkedIn** — tabbed In Progress / Saved / History |
| **Search** | Prominent, wide | Dominant | Prominent | Present | N/A | **O'Reilly** — format as a first-class facet |
| **Filters** | Sidebar + live counts | Rail + counts | Sidebar + counts | Chips | N/A | **Coursera** — counts per option before clicking |
| **Typography** | Source Sans, safe | Tight, dense | Loose, academic | Rounded, large | Geometric, huge | **O'Reilly** — sans UI / serif content |
| **Color** | Blue + magenta promo | 5 competing accents | **Green + orange-red, disciplined** | Black + saturated | Gradients | **edX** — one CTA colour, used consistently |
| **CTAs** | Blue, repeated | Purple, sticky card | Orange-red, repeated 3× | Green, repeated | Filled + outline pair | **Udemy** — one sticky card, never repeated inline |
| **Pricing** | Discount-led | Permanent "sale" | Struck-through | Trial-led | **Tier + comparison table** | **Kajabi/Teachable** — table; **Maven** — plain confidence |
| **Checkout** | Multi-step | Single page + summary | Multi-step | Trial signup | Trial signup | **Udemy** — one page, order summary right |
| **Mobile UX** | Stacked, sticky CTA bar | Stacked, sticky buy bar | Stacked | Stacked | Stacked | **Udemy** — sticky bottom buy bar |

---

# 4. Page Length & Information Density

*(Required subsection per §15A.)*

Measured from the captured full-page screenshots at 1440px width.

### Coursera
- **Homepage: 6317px.** ~16 content groups. Density achieved through horizontal carousels and three-column mini-lists. Above the fold: promo cards only — the proposition is **not** above the fold, which is a real failure.
- **Course detail: 6749px.** Sticky tab nav makes it navigable. The fact strip puts four decision criteria in the first viewport.
- Groups use tabs (Data/Business/Sales/IT/Software) to carry five categories in one section.

### Udemy
- **Course detail: 3025px** — **less than half edX's height for comparable information.** Achieved by: dark hero band (no wasted hero), two-column outcomes box, curriculum accordion with counts, "Show more" prose truncation, sticky buy card outside the main column.
- Above the fold: title, subtitle, rating, review count, student count, instructor, last-updated, language — **eight decision facts plus a video preview.** The best above-the-fold in the set.
- Section gaps ~48px.

### edX
- **Course detail: 6943px** — the longest detail page, for less content than Udemy's.
- Cause: 72–96px section gaps, three repetitions of the same enrol CTA, a very large footer.
- Above the fold: title, description, start date, enrol CTA, enrolment count — good, but the **fact strip sits just below the fold**, which wastes its best asset.

### Skillshare
- **Homepage: 8397px** — longest page captured, least information.
- Nine full-width single-idea slabs with 96–128px padding.
- Above the fold: headline + signup card. No product information at all.
- **The direct anti-pattern for §15A.**

### Kajabi
- **Homepage: ~7000px.** Alternating text/screenshot feature blocks, one idea each. 96–120px gaps.
- Above the fold: headline, subhead, dual CTA, angled screenshot.

### Best patterns

1. **Dark hero band instead of a spacious hero** (Udemy) — hierarchy at zero vertical cost.
2. **Horizontal carousels/shelves** (Coursera, MasterClass) — 4–6 items in one card's vertical space.
3. **Tabs to carry N categories in one section** (Coursera) — five sections become one.
4. **Accordion with counts** (Udemy, DataCamp) — 374 items in ~700px, and you still know the shape.
5. **"Show more" prose truncation** (Udemy, edX) — long descriptions cost 4 lines, not 40.
6. **Sticky buy card outside the main column** (Udemy) — the CTA never needs repeating inline.
7. **Fact strip** (edX, Coursera, DataCamp) — 4–5 criteria in ~120px.
8. **3–4 column grids at desktop** (DataCamp) — not two.
9. **Section gaps of 48–64px** (Udemy, DataCamp), not 96–128px.

### What Practicable should do

| Rule | Current state | Target |
|---|---|---|
| Homepage major sections | 10 (`Home.tsx`: Hero, QuestionShowcase, FreeTemplateCta ×2, Finder, Domains, HowItWorks, GoFurther, About, FinalCta) | **6–7** — merge the two `FreeTemplateCta` placements into one, fold `AboutSection` into `HowItWorks`, and tab the domain/question sections together |
| Catalogue grid columns @1440px | `sm:grid-cols-2` | `sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` |
| Course detail sections | 3 (title, description, syllabus) — *too few, under-informative* | 5 with **accordion + fact strip**, still shorter in px |
| Dashboard blocks | 4 stacked full-width, 1 item each | Stat row + 2-col grid — **same content, ~40% of the height** |
| Section gap | `mt-9` (36px) / `mt-10` (40px) — *already good* | Keep 40–56px |
| Prose truncation | none | "Show more" past ~5 lines |
| Above the fold (Dashboard) | Title + search box only | Title + resume card + stat row |

**Practicable's current problem is not that pages are too long.** Most are *too short and too empty* — a `max-w-4xl` course page with three sections, or a dashboard with four items. The blandness is **low information density**, not excessive scroll. The §15A discipline still applies, but the corrective direction is: **more information in the same or less vertical space**, primarily by moving from 1–2 column stacks to 3–4 column grids and by adding the fact strips, badges and metadata the data model already supports.

---

# 5. Design System Analysis

## 5.1 Typography

### What the platforms do

| Platform | Family | H1 | H2 | Body | Meta |
|---|---|---|---|---|---|
| Coursera | Source Sans Pro | 36/1.2 semibold | 24 semibold | 16/1.5 | 14 |
| Udemy | Udemy Sans | 32/1.3 bold | 24 bold | 16/1.5 | 14 / 12 |
| edX | Inter-like + serif | 34/1.25 | 24 | 16/1.6 | 14 |
| Skillshare | Rounded geometric | 48+/1.1 | 32 | 18/1.6 | 14 |
| LinkedIn Learning | System sans | 24/1.3 | 20 | 14/1.5 | 12 |
| MasterClass | Display serif + sans | 60+/1.05 | 32 | 16/1.6 | 12 |
| O'Reilly | Sans UI + **serif content** | 28 | 20 | 16/1.6 | 13 |
| DataCamp | Clean sans | 40/1.2 | 28 | 16/1.6 | 14 |

**Patterns:** body is 16px almost universally (LinkedIn's 14px is the outlier and it hurts); heading line-heights tighten as size grows; metadata is 12–14px; **only O'Reilly and MasterClass use a serif, and both do it for the content that is meant to be read at length.**

### What Practicable should use

Practicable's existing scale is **already better than any of these** and needs no replacement — it is fluid, carries per-rung line-height and tracking, and pairs a news-publisher grotesque with a real reading serif. The changes needed are in **application**, not definition:

```
Display   --text-display   clamp(2.0rem → 2.75rem)/1.05, -0.03em   Schibsted Grotesk 500
H1        --text-h1        clamp(1.625rem → 2.125rem)/1.15, -0.02em  600
H2        --text-h2        clamp(1.375rem → 1.75rem)/1.2, -0.015em   600
H3        --text-h3        clamp(1.125rem → 1.3125rem)/1.3, -0.01em  600
H4        --text-h4        1.0625rem/1.4, -0.01em                    600
Lead      --text-lead      1.0625rem/1.5              Newsreader
Body      --text-body      1rem/1.55                  Schibsted Grotesk
Read      --text-read      1.125rem/1.7               Newsreader  ← long-form only
Small     --text-sm        0.875rem/1.5
Caption   --text-xs        0.75rem/1.4
Metadata  --text-xs        0.75rem/1.4, 0.16em, uppercase   Azeret Mono  ← the eyebrow device
Button    --text-sm        0.875rem, 500
```

**Required changes:**
1. **Add a `--text-stat` rung** — ~2rem/1, tabular-nums, for the fact-strip and stat-tile numbers. Currently these use ad-hoc `text-2xl`.
2. **Use `font-mono` (Azeret) for all numeric metadata** — durations, counts, prices, percentages. It is defined, it is distinctive, and it is currently used only for the eyebrow. This alone measurably reduces blandness at zero layout cost.
3. **Stop using `text-sm text-muted-foreground` as the default for everything.** `CourseDetail.tsx:160-163` renders author, module count, lesson count and access model as one run-on muted line. That is four facts styled as a footnote.

## 5.2 Color

### What the platforms do
- One dominant brand colour for all primary actions (all fourteen).
- Dark bands for hierarchy breaks (Udemy, edX, DataCamp, Pluralsight, Skillshare, MasterClass).
- Per-subject accent identity (Brilliant, and partially DataCamp via technology icons).
- Status colours conventional throughout (green success, red error).
- **Discipline correlates with perceived quality.** edX (2 accents) and MasterClass (0) read premium; Udemy (5) reads cheap.

### What Practicable should use

The palette in `theme.css` is correct and should be **kept in full**. The recommendation is **not** to introduce stronger accents globally, but to **spend the accents that already exist**:

```
Primary          #10213E   navy — brand, actions, links, focus
Accent           #1D5FA8   vivid blue — the one interactive accent (6.13:1 on ivory)
Gold             #C6A961   decorative only — rules, gradient stops, tile fills
Gold-strong      #7C5C14   text-safe gold — labels, small type, icons
Gold-soft        #F3E9D2   tinted surfaces
Background       #FBF9F4   warm ivory
Card             #FFFFFF
Muted            #F1ECE1 / #6E675A
Border           #E6DFD0   /  Border-strong #998E78
Stage            #10213E   the dark plane (never inverts)
Success          #067647   Warning #8A5300   Error #B3402E

Domain — currently under-used:
  Risk         #142E5C     Cyber        #1B5FA8
  Compliance   #1D6FA5     Resilience   #3D5A99
  AI           #46618C
```

**Verdict on "conservative vs. stronger accents":** stay conservative in *palette*, become far more assertive in *application*. Specifically:

1. **Extend `--domain-*` to every surface.** Course cards, template cards, library rows, dashboard cards, and pack cards should all carry a domain colour as a left rule, an icon tile tint, or a badge — as question cards already do. Five signature colours applied consistently across the product is the single largest available "less bland" win, and it costs nothing vertically.
2. **Use `--gold-strong` for metadata labels.** Gold is the brand's warmth and is currently almost invisible in the authenticated app.
3. **Use the `--stage` plane for more than the hero, footer, auth panel and sidebar.** A dark fact strip or a dark stat row on a light page is the Udemy hierarchy trick, and Practicable already has the token and the aurora to do it properly.
4. **Tint icon tiles by meaning.** `bg-muted text-muted-foreground` is the default for nearly every icon tile in the app (`CourseDetail.tsx:210`, `TemplatesCatalogue.tsx`, `Learn.tsx:187`). Course = accent, template = gold, question = domain colour, download = success.

## 5.3 Layout

| Property | Platform range | Practicable current | Recommendation |
|---|---|---|---|
| Max content width | 1128–1340px | `max-w-7xl` (1280px) | **Keep 1280px** |
| Reading column | 640–720px | `max-w-2xl` (672px) | **Keep 672px** |
| Detail page width | 1180–1340px | `max-w-4xl` (896px) on CourseDetail | **Widen to 1280px with a sidebar** |
| Catalogue columns @1440 | 3–4 | **2** | **3, or 4 for templates** |
| Card width | 230–340px | ~600px | **~300px** |
| Section gap | 48–128px | 36–40px | **Keep 40–56px** |
| Grid gap | 16–24px | 24px | **Keep 24px** |

**The single most impactful layout change:** `CourseDetail.tsx` uses `max-w-4xl` (896px) with no sidebar. Every competitor uses a two-column layout — content left, sticky facts/buy card right — at 1180px+. `ProductBuy.tsx` already does this correctly with `lg:grid-cols-[1fr_380px]`. **CourseDetail should match ProductBuy.**

## 5.4 Cards

### Why some cards feel more valuable and clickable

Reviewing all fourteen, the cards that feel valuable share four properties:

1. **They answer the decision question on the card.** Maven's credential line, DataCamp's level + duration, Udemy's price + rating. A card that requires a click to evaluate isn't a card, it's a link.
2. **They have a visual anchor** — a domain colour, an icon tile, a cover image, a portrait. Something that makes card A distinguishable from card B at a glance without reading.
3. **They are sized to their content.** A 600px-wide card with 80px of text reads as empty and unfinished. A 300px card with the same text reads as dense and considered. **This is the largest single contributor to Practicable's blandness.**
4. **Their metadata is typographically distinct from their title** — different family, size, case, or colour. Not the same grey at a smaller size.

### Practicable's card system

| Card | Current | Should carry |
|---|---|---|
| **Question** | ✅ Domain colour, 3 tags, serif preview, hover-lift | Good — the model for the others |
| **Course** | Eyebrow, title, subtitle, module/lesson count, owned badge. **No price, no domain colour, no duration, 600px wide** | Domain rule, cover or domain tile, title, 1-line outcome, **duration**, lesson count, **level/tier badge**, **price**, owned state |
| **Template** | Muted icon tile, title, description, price | Gold icon tile, **file format badge** (XLSX/PDF), title, 1-line use, **page/sheet count** (`page_count`, `sheet_count` exist), price |
| **Product/Pack** | Name, description, price, contents list | Domain rule, type badge, name, 1-line, **item count**, price, **saving vs. parts** |
| **Recommendation** | ✗ does not exist | Compact: type badge, title, 1 line, price |
| **Category/Domain** | ✅ on homepage only | Extend to catalogue filters |
| **Author** | ✗ does not exist | Photo, name, practitioner credential, 1-line bio |

## 5.5 Buttons and CTAs

Practicable's `Button.tsx` is already strong: five variants, three sizes with a documented 44px touch floor, a gradient-brand primary with an inset ring and a 1px hover lift, loading state with `aria-busy`, disabled handling, and semantic tokens throughout. It meets or exceeds every platform reviewed.

**Gaps:**
1. **No `link`/text-button variant.** "Show more", "View all", "Expand all" are needed by the recommendations here and are currently hand-rolled (`Library.tsx` uses a raw `<Link className="text-sm font-medium text-primary hover:underline">`).
2. **No icon-only variant** despite several existing in the layouts as raw `<button>` elements (`MemberLayout.tsx` sign-out, `Learn.tsx` menu/close).
3. **No sticky mobile action bar.** `ProductBuy.tsx` has one; CourseDetail and PackDetail don't.

CTA placement should follow Udemy: **one sticky buy card, never repeated inline.** edX's three identical enrol buttons are the pattern to avoid.

## 5.6 Navigation

Practicable's navigation is structurally sound: `MarketingLayout` for the public site, `MemberChrome` (a dark aurora rail) for signed-in users, and `CatalogueLayout` switching between them so public catalogue pages keep member chrome when signed in. That last decision is genuinely good and better than what most platforms do.

**Gaps against the platforms:**
1. **No breadcrumbs anywhere.** Coursera, Udemy and edX all have them on detail pages. Practicable's `/courses/:slug` and `/store/packs/:slug` have no way back to the parent except the browser.
2. **No global search in the member chrome.** The Dashboard has a finder; every other member page has nothing. O'Reilly, Udemy and Coursera all put search in the persistent chrome.
3. **No breadcrumb or in-page nav on long pages.**
4. **No notifications or saved-items entry.**

## 5.7 Learning UX

| Capability | Best platform | Practicable current |
|---|---|---|
| Course progress | LinkedIn (% in header) | ✅ `Learn.tsx` sidebar: bar + "45% · 6 of 14" |
| Lesson navigation | Udemy (rail + prev/next) | ✅ Both present |
| Video | All (Mux/HLS) | ✅ Mux Player, **captions on by default** — better than most |
| Reading | O'Reilly (serif, notes) | ✅ Serif at `--text-read`; ✗ no notes/highlights |
| Completion | Udemy (auto + manual) | ✅ Manual "Mark complete" |
| Next lesson | All | ✅ |
| Course outline | Udemy (accordion) | ⚠️ Flat list, not collapsible |
| Locked content | Udemy (lock + preview) | ✅ Lock icons + free preview |
| Recommendations | All | ✗ **`related_products` fetched, never rendered** |
| Downloads | MasterClass (workbook) | ✅ Present but under-emphasised |
| **Notes/highlights** | O'Reilly | ✗ absent |
| **Save/bookmark** | LinkedIn | ✗ **absent — the biggest gap** |

Practicable's `Learn.tsx` is genuinely competitive — a sticky independently-scrollable outline, progress in two places, per-lesson type icons, lock states, module-attached free questions in the rail, and a block-based content renderer supporting text/video/file/callout. The gaps are **save/bookmark**, **a collapsible outline**, and **completion celebration**.

---

# 6. The Psychology of These Interfaces

Grounded in observed UI, not speculation.

### Why they feel trustworthy
- **Named humans with verifiable credentials.** edX shows "Gordon McKay Professor of the Practice of Computer Science, Harvard University". Maven shows "Product Lead at Stripe". A name plus a checkable claim is the mechanism. *Practicable currently shows `By {author_name}` in 14px muted text — the credential is absent.*
- **Institutional co-signing.** Coursera and edX lead with university and company marks.
- **Visible negative information.** Coursera's review distribution shows the 1-star bar. A rating with no visible downside reads as marketing; one that shows its tail reads as data.
- **Currency signals.** Udemy's "Last updated 11/2025". *Practicable has `last_reviewed_at` and `VersionStamp.tsx` and doesn't surface them prominently — for compliance content this is a significant missed trust signal.*

### Why they feel premium
- **Restraint.** MasterClass uses almost no UI colour. edX uses two accents. Perceived quality tracks *inversely* with accent count across this set.
- **Typographic confidence.** Large, tight, well-tracked headings with real hierarchy.
- **Photography of people**, not stock illustration.
- **Space used deliberately** — not merely a lot of space, but space that separates *groups*, with density *within* them. Skillshare has more whitespace than anyone and feels cheap.

### Why they feel useful
- **Facts before prose.** The fact strip resolves the four questions a buyer has before any marketing copy appears.
- **Structure visible before commitment.** Udemy shows all 45 section titles, collapsed, before purchase.
- **Free preview.** Udemy's per-lecture "Preview", edX's "Audit course". *Practicable's free questions and free template are the same mechanism and are a genuine strength.*

### Why they feel motivating
- **Progress made visible and specific** — "6 of 14", 45%, a filled bar.
- **A resume point that names the next thing** — "Continue: Module 3, Lesson 2", not "Continue".
- **Completion states that persist.** Green checks that stay.

### Why they feel worth paying for
- **The takeaway artefact.** MasterClass's workbook, Udemy's downloadable resources. Something that outlives the session. *Practicable's templates are the strongest version of this in the set — a working file a practitioner uses at their job — and they are presented as a catalogue item rather than as the payoff.*
- **Specificity of outcome.** "Build 16 web development projects" beats "learn web development".
- **Price stated with confidence.** Maven's plain four-figure prices read as more valuable than Udemy's permanent "$19.99 (was $129.99)", which teaches the buyer the real price is zero.

### Cognitive load and friction
- **Progressive disclosure everywhere** — accordions, "Show more", tabs. The page presents a *summary* and lets the reader open what they need.
- **One primary action per viewport.** Udemy's sticky card means there is never a decision about which button to press.
- **Filters with counts before clicking** — Coursera and edX show "(1,247)" beside each option, eliminating dead-end filtering. *Practicable's `QuestionsCatalogue` has seven filter dimensions; adding counts would be high-value.*

### What this means for Practicable
The product's actual trust assets are: a **practising risk professional as author**, **100 real questions free to read**, **working templates**, **review dates on content**, and **plain one-time pricing with lifetime access**. Every one of these is stronger than what most platforms in this set offer — and **every one is currently under-presented in the UI**. The blandness is partly a *presentation-of-value* failure, not only a visual one.

---

# 7. What Makes Practicable Bland?

Audited against the actual source. Only issues genuinely present are listed.

### 7.1 Confirmed issues

**1. Card monoculture.**
`Card.tsx` is one `rounded-xl border border-border bg-card` div. `CoursesCatalogue`, `TemplatesCatalogue`, `Store`, `Dashboard` and `PackDetail` all render it near-identically. Different content types are visually indistinguishable.

**2. Two-column grids at desktop width.**
`CoursesCatalogue.tsx:76`, `TemplatesCatalogue.tsx:79` — `grid gap-6 sm:grid-cols-2` inside `max-w-7xl`. ~600px per card. Cards read empty.

**3. Metadata as an undifferentiated muted run-on.**
`CourseDetail.tsx:160-163`:
```tsx
<p className="mt-4 text-sm text-muted-foreground">
  By {course.author_name} · {course.modules.length} modules ·
  {course.lesson_count} lessons · lifetime access
</p>
```
Four purchase-decision facts as one 14px muted sentence. Every competitor gives these a fact strip.

**4. Icon tiles are all the same grey.**
`bg-muted text-muted-foreground` on `CourseDetail.tsx:210`, `TemplatesCatalogue.tsx:88`, `Learn.tsx:187`, `ProductBuy`. The domain, gold and accent tokens exist and are unused here.

**5. Domain colours stop at the marketing boundary.**
`--domain-risk/cyber/compliance/resilience/ai` are used in `Home.tsx` and on question cards. `CoursesCatalogue`, `TemplatesCatalogue`, `Library`, `Dashboard`, `Store` use none of them.

**6. The Dashboard is the blandest page in the product.**
Four stacked full-width blocks, one item each: search card, one question, one product, one sentence. No progress, no resume, no stats, no recommendations. It is the page members see most.

**7. No progress on the Dashboard.**
`Library.tsx` has an excellent animated `ProgressBar` with `role="progressbar"` and a `ContinueRail`. The Dashboard imports neither.

**8. `related_products` fetched and discarded.**
`CourseDetail.tsx:65` types it, `:128` reads `[0]` for the price, and the array is never rendered.

**9. Flat, non-collapsible syllabus.**
`CourseDetail.tsx:197-269` renders every module and every lesson expanded. A 10-module course is an enormous wall. No per-module counts, no durations at module level.

**10. CourseDetail is 896px wide with no sidebar.**
`max-w-4xl`. `ProductBuy.tsx` already implements the correct `lg:grid-cols-[1fr_380px]` sticky pattern.

**11. No save/bookmark anywhere.**
No way to mark a question, course or template for later. The strongest return-visit mechanism in the set is entirely absent.

**12. No breadcrumbs.**
No detail page has a path back to its parent.

**13. No author presence.**
`author_name` appears once as a text fragment. No photo, no credential, no bio. For a product whose core claim is *"written by a practising risk professional, not a vendor"* (`Home.tsx:120`), the author is invisible in the product.

**14. Trust signals buried.**
`VersionStamp.tsx`, `LicenceLine.tsx`, `EvidencePanel.tsx`, `last_reviewed_at`, `page_count`, `sheet_count`, `is_editable`, `has_macros` all exist — used only on `ProductBuy`. Absent from catalogue cards and course pages.

**15. No numeric type treatment.**
Counts, durations, percentages and prices use the body sans. `--font-mono` (Azeret Mono, "reads as data because it was chosen") is defined and used only for eyebrows.

**16. No empty/loading state variety.**
Catalogue skeletons are `h-52 animate-pulse rounded-xl bg-muted/40` — a grey block. Competent, characterless.

**17. Admin pages inherit page-level padding.**
`py-8/py-10` with card-based layouts on data-dense admin screens.

### 7.2 Explicitly NOT problems

To be accurate about what is already good:

- ✅ **The token system.** Better than any platform reviewed.
- ✅ **The homepage.** Dark aurora stage, Motion staggers, rotating placeholders, domain grid, honest live counts. Genuinely distinctive.
- ✅ **`Learn.tsx`.** Competitive with any player in the set.
- ✅ **`Library.tsx`.** The `ContinueRail` and progress bar are excellent — they just aren't used elsewhere.
- ✅ **`ProductBuy.tsx`.** Sticky two-column, mobile buy bar, evidence panel. The best-structured page in the app.
- ✅ **Accessibility.** Heading order enforced via `PageTitle`/`SectionHeading`, `sr-only` rungs where levels would skip, `role="progressbar"` with values, one global focus style, a documented 44px touch floor, `prefers-reduced-motion` backstop, measured contrast ratios. **Better than most commercial products.**
- ✅ **Honest content.** Live counts, no invented ratings, honest empty sections, "not yet available for purchase" instead of "coming soon". This is a real brand asset.
- ✅ **Auth layout.** Split-screen with the aurora panel — genuinely premium.

**The conclusion that matters: Practicable is not badly designed. It is a well-designed marketing site attached to an under-designed product.** The remedy is to extend the existing system inward, not to replace it.

---

# 8. Redesign Direction

## 8.1 Brand personality

Practicable should feel:

- **Authoritative** — written by someone who has done the job
- **Practical** — every page ends in something you can do
- **Dense** — respects the reader's time by putting facts on the surface
- **Editorial** — a publication, not a marketplace
- **Quietly premium** — restraint, not decoration
- **Legible under pressure** — usable at 4pm before a board paper is due

It should **not** feel: playful, gamified, urgent, salesy, enterprise-generic, or minimal-for-its-own-sake.

## 8.2 Design principles

1. **Facts on the surface.** Every card and page header states its decision-relevant facts before prose.
2. **Colour means something.** Domain, state, and type. Never decoration.
3. **Density is respect.** More information per viewport, not more viewports.
4. **The artefact is the payoff.** Templates and takeaways are the product; present them as such.
5. **The author is present.** A named practitioner, visible.
6. **Progressive disclosure over vertical growth.** Accordions, tabs, "show more".
7. **Never invent credibility.** No fake ratings, no urgency, no manufactured scarcity.

## 8.2a The root cause: subtractive accumulation

A second audit pass, reading `theme.css` and `DESIGN.md` as a *history* rather than a snapshot, produced a sharper diagnosis than the symptom list in §7 — and it is the framing the implementation follows.

**The design accumulated prohibitions faster than it accumulated character.** Every individual decision was defensible; the compound result is an interface with excellent manners and little to look at:

- Three palette reversals in a short window (recorded in `theme.css` comments dated 2026-08-12 and 2026-08-13) settled on the most cautious possible outcome — two colour families, used timidly.
- The type scale was **shrunk 25–30%** on 2026-08-15 ("reduce heading sizes considerably"). `--text-display` now tops out at 2.75rem / 44px. A 44px hero headline on a desktop marketing page is supporting-player size.
- **Elevation defaults to zero.** `Card.tsx`'s comment is explicit: "never a permanent heavy shadow on every card". Correct as a rule against shadow abuse; the effect is that every page is one flat plane with hairlines.
- **Motion is capped** — nothing loops, nothing exceeds 500ms, no scroll reveals.
- **No imagery system.** Course artwork is a provisional flat panel.
- **Domain identity was defanged** — five signature colours collapsed into blue shades and now differentiate mainly via small eyebrow text.
- **Gold is locked away** by a correct contrast rule, so the warmest colour in the brand appears only as hairlines and gradient stops. Pages read cool.

**This is not a token failure. It is compositional.** Range, layering, art direction and motion were each scoped out, one good decision at a time. The fix is to expand range *inside the settled system* — not to change the settlement.

## 8.2b The five moves

The implementation is organised around five moves rather than a flat list of fixes:

**M1 — Restore the voice.** Bring the display scale back to hero size (44px → ~68px at the top rung), keep the mono eyebrow device, reserve the serif for questions and reading bodies. Hierarchy by size contrast, not weight inflation.

**M2 — Band rhythm.** Introduce `--background-2` (#F4EFE4) and alternate planes down every marketing page: ivory → tinted → stage → ivory. Give every interior page at least one non-ivory plane. **This single change does more against "bland" than any colour addition**, and it costs no vertical space.

**M3 — Domain identity system.** Each of the five domains gets a tone (already audited), a tint (~8% on ivory), an icon, a generative artwork gradient, and a left-edge accent that appears on *every* card. Variety becomes systematic and effectively infinite without touching the palette rule.

**M4 — Layered surfaces.** Tinted panels for grouped information; corner-framed feature cards (`CornerFrame.tsx` already exists and is barely used); hover = 2px lift + border tone shift; restrained tinted shadows on elevated elements only. Borders keep grouping; depth returns for hierarchy.

**M5 — Metadata richness.** Every card gains an icon-metadata row — duration, lesson count, level, format + size for templates, price. Density *is* the value signal.

**Owner decision carried forward (2026-08-20):** `--primary` stays **#10213E**. An alternate proposal to lift it to #0F3E9C was declined — `--primary` is also `--stage`, so changing it repaints the hero, footer, auth panel and sidebar aurora and invalidates every contrast ratio measured in `theme.css`. The energy comes from M1–M5 instead. If hue separation for domains is ever wanted, the system survives it by swapping five tokens and nothing else.

## 8.3 Design system (proposed changes only)

`theme.css` stays; `--primary`, `--stage`, `--accent`, `--gold*` and all five `--domain-*` values are **unchanged**. Additions only:

```css
/* M2 — the alternating band plane. Sits between --background (#FBF9F4)
   and --muted (#F1ECE1) in luminance, so a band reads as a distinct
   plane without becoming a "disabled" surface. */
--background-2: #F4EFE4;   /* light */
--background-2: #1A150D;   /* dark — one step off --background (#141008) */

/* M4 — a raised panel inside a card, and a gold hairline for stage bands */
--card-2: #FAF7F0;         /* light */   /* dark: #221C13 */
--gold-border: #E3D3AC;    /* light */   /* dark: #4A3D22 */

/* M1 — display scale restored toward hero size.
   The 2026-08-15 pass shrank every rung 25–30%; this returns the top
   three rungs only. h4/lead/body/read/sm/xs are deliberately untouched,
   so reading rhythm and the reference-document register are preserved. */
--text-display: clamp(2.625rem, 1.9rem + 3.4vw, 4.25rem);  /* was 2.0→2.75rem */
--text-h1:      clamp(2rem, 1.55rem + 2vw, 3rem);          /* was 1.625→2.125rem */
--text-h2:      clamp(1.5rem, 1.3rem + 0.9vw, 2.125rem);   /* was 1.375→1.75rem */

/* M5 — the fact-strip / stat-tile figure */
--text-stat: clamp(1.5rem, 1.2rem + 1vw, 2rem);
--text-stat--line-height: 1.1;
--text-stat--letter-spacing: -0.02em;
```

**Motion — one scoped relaxation.** `DESIGN.md` §39's caps stay for product surfaces. Marketing surfaces only get a one-time scroll reveal (fade + 12px rise, 300ms, 40ms stagger, max 6 items), disabled under `prefers-reduced-motion`. `Home.tsx` already does exactly this via `staggerContainer`/`riseItem`/`inViewOnce`; the relaxation just permits extending it to the new bands.

**Spacing** — keep the existing 4px base. Standardise section rhythm at `mt-10` (40px) / `mt-12` (48px), replacing the current mix of `mt-6/8/9/10`.

**Radius** — keep. 4px badges, 6px inputs/buttons, 8px cards, 12px feature blocks. The 12px ceiling is correct.

**Shadows** — keep. Level 0 (hairline) at rest; `shadow-md` on hover-lift only; `shadow-xl` for overlays. Never a permanent heavy shadow.

**Icons** — Lucide, 1.5px stroke. Sizes: 14px inline metadata, 16px in buttons/rows, 20px in tiles, 24px in empty states. Tinted by meaning per §5.2.

## 8.4 New components required

| Component | Purpose |
|---|---|
| **`FactStrip`** | 3–5 icon+label+value cells in a bordered card. The highest-value addition. |
| **`StatTiles`** | 3–4 bordered number+label tiles, optionally on the stage plane. |
| **`Accordion`** | Collapsible sections with a count/summary in the header row. |
| **`ContentCard`** | One card with `type` variants (course/template/question/pack), carrying domain colour, badges, metadata and price. |
| **`AuthorCard`** | Photo, name, credential, bio. |
| **`RelatedRail`** | Horizontal scroll of compact cards. |
| **`Breadcrumb`** | Path back to the parent. |
| **`ProgressBar`** | Extracted from `Library.tsx` and shared. |
| **`Tabs`** | For Store and Library consolidation. |
| **`SaveButton`** | Bookmark toggle (requires a small backend addition). |
| **`Meta`** | Mono-set metadata row — the numeric type treatment. |
| **`ShowMore`** | Prose truncation with an expander. |

---

# 9. Prioritized Recommendations

| # | Change | User benefit | Design impact | Effort | Priority |
|---|---|---|---|---|---|
| 1 | **`FactStrip`** on CourseDetail, PackDetail, Template, ProductBuy | Purchase facts visible immediately | **Very high** | Low | **P0** |
| 2 | **Catalogue grids to 3–4 columns** | Compare more, scroll less | **Very high** | Very low | **P0** |
| 3 | **`ContentCard` with domain colour + metadata + price** | Cards become comparable and distinct | **Very high** | Medium | **P0** |
| 4 | **Dashboard rebuild** — resume + stats + 2-col grid | A reason to return | **Very high** | Medium | **P0** |
| 5 | **Syllabus accordion with per-module counts** | Scannable structure | High | Low | **P0** |
| 6 | **CourseDetail two-column + sticky buy card** | Matches ProductBuy; CTA always present | High | Medium | **P0** |
| 7 | **Numeric metadata in mono** | Distinctive at zero layout cost | High | Very low | **P1** |
| 8 | **Render `related_products`** | Built feature made visible | Medium | Very low | **P1** |
| 9 | **`AuthorCard`** | Surfaces the core trust asset | High | Low | **P1** |
| 10 | **Tinted icon tiles by meaning** | Visual variety, semantic | Medium | Very low | **P1** |
| 11 | **`StatTiles`** on Home + Dashboard | Credible scale | Medium | Low | **P1** |
| 12 | **Breadcrumbs on detail pages** | Orientation | Medium | Low | **P1** |
| 13 | **Surface review dates / version stamps** | Trust for compliance content | High | Low | **P1** |
| 14 | **`ShowMore` on long prose** | Shorter pages | Medium | Low | **P1** |
| 15 | **Filter counts on QuestionsCatalogue** | No dead-end filtering | Medium | Medium | **P2** |
| 16 | **Save/bookmark** | Return mechanism | High | **High** (backend) | **P2** |
| 17 | **Tabs on Store and Library** | Fewer sections | Medium | Medium | **P2** |
| 18 | **Global search in member chrome** | Faster lookup | Medium | Medium | **P2** |
| 19 | **Collapsible outline in Learn** | Long courses navigable | Low | Low | **P2** |
| 20 | **Completion celebration** | Motivation | Low | Low | **P3** |
| 21 | **Notes/highlights on lessons** | Reference value | Medium | **Very high** | **P3** |
| 22 | **Hover-preview on question cards** | Detail without navigation | Low | Medium | **P3** |
| 23 | **Admin density pass** | Faster editing | Low | Medium | **P3** |

---

# 10. Final Design Blueprint

### Visual direction
An editorial reference instrument. Warm ivory ground, midnight-navy structure, champagne emphasis, five domain signatures. Dark stage planes for hierarchy breaks. Grotesque for interface, serif for reading, mono for data. Dense, confident, and quiet.

### Design principles
Facts on the surface · Colour means something · Density is respect · The artefact is the payoff · The author is present · Progressive disclosure over vertical growth · Never invent credibility.

### Color system
`theme.css` unchanged. Domain colours extended to every content surface; gold-strong for metadata; stage plane for fact strips and stat rows; icon tiles tinted by meaning.

### Typography
Existing scale plus `--text-stat`. Mono for all numeric metadata. Serif reserved for long-form reading.

### Layout system
1280px page · 672px reading column · 3–4 column catalogue grids · two-column detail pages with a 380px sticky rail · 40–56px section rhythm · 24px grid gap.

### Component system
Existing primitives plus `FactStrip`, `StatTiles`, `Accordion`, `ContentCard`, `AuthorCard`, `RelatedRail`, `Breadcrumb`, `ProgressBar`, `Tabs`, `Meta`, `ShowMore`, `SaveButton`.

### Page hierarchy
Question → Answer → Learning → Template → Purchase → Apply, made visible on the homepage and reinforced by related-content rails on every detail page.

### Interaction principles
One primary action per viewport · sticky buy card, never repeated inline · accordions default collapsed past 5 items · 150ms transitions on the standard easing · 2px hover lift, no scale · all states designed (loading, empty, error, locked, completed, purchased).

### Responsive rules
Mobile: single column, sticky bottom action bar, sheet navigation, fact strip wraps to 2×2, accordions fully collapsed.
Tablet: 2 columns, sidebar becomes a sheet.
Desktop: 3–4 columns, persistent rail, sticky sidebars.

### Accessibility rules
Maintain the current standard — measured contrast, one focus style, heading order enforced by components, 44px touch targets, `role="progressbar"` with values, reduced-motion backstop, semantic landmarks. **Do not regress any of this during the redesign.**

### Implementation priorities
P0 first: fact strip, grid columns, content card, dashboard, accordion, course-detail layout. These six deliver the majority of the visible change.

---

*Screenshots referenced throughout are in `design-research/screenshots/`, organised by platform. Capture scripts (`capture-wave2.js`) are included for reproducibility.*


https://parley.framer.ai/
https://saazai.framer.website/
https://galilee.framer.ai/
https://fintechx-wbs.framer.website/
https://verity-template.framer.website/
https://utomic.framer.website/
https://verseo.framer.website/
https://dreammotion.framer.website/
https://grovia.framer.ai/
https://www.framer.com/community/marketplace/templates/
https://nicoburkart.notion.site/12-Free-Framer-Templates-for-Your-App-Landing-Page-3c293082ae3e8127854fc803705f40eb