# DESIGN THE COMPLETE "DECIDING IN THE DARK" PLATFORM

Act as a **senior product designer, UI/UX designer, design-system architect, and SaaS product strategist**.

Design the complete production-ready web application for **Deciding in the Dark**, a paid professional knowledge and learning platform for risk, compliance, governance, cyber, resilience, and AI practitioners.

Do not design this as a generic LMS, generic SaaS dashboard, online course marketplace, or marketing template.

The product should feel like:

**professional publishing + practical decision tool + premium learning platform**

The core product idea is:

> **A practitioner has a real problem. They find the right question. They get a useful answer. They see what else can help. They can buy a template or course and continue learning.**

The platform is built around **100 real practitioner questions**, each structured using seven dimensions:

* Effort
* Duration
* Cost
* ROI horizon
* Tier
* Regulator pressure
* Leadership traits

The questions are the primary discovery mechanism. Courses, lessons, templates, and paid products are the delivery and monetisation layer around that knowledge.

---

# 1. PRODUCT POSITIONING

Brand:

**Deciding in the Dark**

Parent/product brand:

**Practicable**

Tagline:

**Practical answers for risk practitioners**

Primary users:

* Risk managers
* CROs
* Risk analysts
* Compliance professionals
* Governance professionals
* Audit professionals
* Risk and governance consultants
* Security/risk leaders

Primary jobs:

1. Find a relevant answer to a risk problem they are dealing with now.
2. Find a practical template or framework they can use.
3. Build their knowledge through structured learning.

The user is busy, experienced, and impatient with unnecessary UI.

Design for someone who thinks:

> "I have a problem. I need a useful answer. Don't make me browse a course catalogue for 10 minutes."

---

# 2. CORE UX PRINCIPLE

Everything must support this loop:

```text
PROBLEM
   ↓
QUESTION
   ↓
ANSWER
   ↓
PRACTICAL ACTION
   ↓
RELATED CONTENT
   ↓
TEMPLATE / COURSE
   ↓
PURCHASE
   ↓
LEARN / APPLY
   ↓
RETURN FOR ANOTHER QUESTION
```

The question discovery experience is the most important part of the product.

Do not make the course catalogue the centre of gravity.

Do not make the dashboard the centre of gravity.

Do not make the homepage a generic marketing page.

The platform should feel like a **professional decision library that also contains courses and practical tools**.

---

# 3. VISUAL DIRECTION

Create a restrained, editorial, professional interface.

The visual character should combine:

* Serious professional publication
* Modern digital knowledge product
* High-quality learning platform
* Practical business tool

The interface should feel:

* Calm
* Direct
* Experienced
* Credible
* Human
* Useful
* Content-first
* Premium without appearing luxurious
* Mature
* Quietly confident

Avoid:

* Generic SaaS aesthetics
* Startup landing-page clichés
* Excessive gradients
* Glassmorphism
* Neon colours
* Giant decorative illustrations
* Excessive shadows
* Excessive rounded cards
* Huge dashboard statistics
* Excessive badges
* Gamification
* Loud animation
* Generic stock photography
* Corporate blue everywhere
* "AI startup" visual language
* Over-designed course thumbnails
* Excessive floating elements

The interface must NOT look like:

```text
Kajabi
+
Teachable
+
Corporate dashboard
+
Generic SaaS template
```

Instead, it should feel closer to:

```text
Professional journal
+
Decision reference
+
Modern learning product
```

---

# 4. BRAND CONCEPT

Use the idea behind the name **"Deciding in the Dark"** subtly.

Do not literally use dark imagery everywhere.

The concept should communicate:

> People often have to make important decisions without having perfect information.

The product provides:

* context
* practical answers
* frameworks
* tools
* learning

Use subtle visual motifs around:

* clarity
* signal
* focus
* evidence
* decision points
* structured information

Do not use literal moon/night graphics, stars, dark-room imagery, or cheesy "light in darkness" illustrations.

---

# 5. TYPOGRAPHY

Use a strong editorial typography system.

Recommended:

### Display / editorial

Use a high-quality serif for major question titles, editorial headlines, and long-form reading.

Example direction:

* Source Serif 4
* Georgia
* another similarly credible editorial serif

### UI / navigation / controls

Use a clean sans-serif.

Example direction:

* Bricolage Grotesque
* Inter
* system sans

### Metadata / taxonomy

Use a restrained mono or compact sans-serif.

Example:

```text
RISK / GOVERNANCE
6–12 WEEKS
LOW INVESTMENT
QUICK ROI
```

Typography hierarchy must be obvious without relying on colour.

Major question titles should feel like editorial headlines rather than SaaS card titles.

Example:

> **We Have a Risk Register, But No One Uses It**

should be visually powerful.

---

# 6. TYPOGRAPHY SCALE

Use a responsive scale.

Suggested base:

```text
xs       12px
sm       14px
base     16px
lg       20px
xl       25px
2xl      31px
3xl      39px
4xl      48px
5xl      60px
```

Use fluid scaling for major headlines.

Body text should remain highly readable.

Long-form reading measure:

```text
60–72 characters per line
```

Do not create giant paragraphs spanning the entire browser.

---

# 7. COLOUR SYSTEM

Use semantic CSS variables.

Primary visual direction:

### Light

* Warm off-white background
* Very dark navy primary text
* Deep navy primary action
* Soft blue secondary surfaces
* Restrained blue accent
* Very light neutral borders
* Muted grey secondary text

### Dark

* Very dark navy background
* Slightly lighter card surfaces
* Soft off-white text
* Muted cool-grey text
* Blue accent
* Very restrained borders

Use the existing project palette as the implementation source, but improve visual balance rather than applying every colour equally.

Primary colours should be used sparingly.

Do not make every button blue.

Do not make every section colourful.

Colour should communicate hierarchy and state.

---

# 8. SHAPE LANGUAGE

Move away from overly rounded SaaS UI.

Use:

* 6px–12px radius for most controls
* Larger radius only for major product surfaces
* Thin borders
* Almost no shadows
* Strong whitespace
* Flat editorial sections

Cards should have a purpose.

Do not put every section inside a card.

A question result can be a bordered row.

A course can be a card.

A paragraph should never be inside a card simply because it is a "section".

---

# 9. LAYOUT SYSTEM

Use a strong responsive grid.

Desktop:

```text
max width: approximately 1280–1440px
outer padding: 32–64px
```

Reading pages:

```text
main reading width: approximately 680–760px
```

Discovery pages:

```text
filters + results
```

Learning pages:

```text
sidebar + content
```

Admin:

```text
sidebar + dense content workspace
```

Use generous whitespace but avoid wasting vertical space.

The product should feel spacious, not empty.

---

# 10. NAVIGATION

## Public desktop navigation

```text
DECIDING
IN THE DARK

Questions
Courses
Templates
About

Search

Sign in

[Get started]
```

Keep the header compact.

Do not create a giant marketing navigation.

## Public mobile

```text
Logo

Search icon
Menu icon
```

Menu opens a clean sheet.

## Member navigation

Use:

```text
My learning
Questions
Courses
Templates
Downloads
Purchases
Account
```

Do not over-emphasise the word "Dashboard".

The member area should feel like a personal library, not enterprise software.

---

# 11. HOMEPAGE

The homepage must communicate the product within seconds.

Do NOT build a generic:

```text
Hero
Features
Testimonials
Pricing
CTA
```

marketing page.

Instead, make the question system the centre.

## Homepage structure

```text
HEADER

HERO

QUESTION FINDER

DOMAIN ENTRY POINTS

POPULAR QUESTIONS

HOW THE PLATFORM WORKS

COURSES + TEMPLATES

AUTHOR / CREDIBILITY

FREE ENTRY POINT

FOOTER
```

---

# 12. HOMEPAGE HERO

Create a strong editorial hero.

Example structure:

```text
DECIDING IN THE DARK

Practical answers for the questions
risk practitioners actually face.

[ Search 100 practical questions... ]
```

Below search:

```text
Find something you can:

[ Do in 2 weeks ]
[ Do cheaply ]
[ Address regulator pressure ]
[ Get leadership behind ]
```

The search box should be visually dominant.

The hero should not contain a giant illustration.

Use typography and whitespace.

---

# 13. QUESTION FINDER

This is the most important component on the homepage.

Create a large search experience:

```text
What are you trying to solve?

┌───────────────────────────────────────────────┐
│ Search the questions...                    ⌕ │
└───────────────────────────────────────────────┘
```

Below it:

```text
I need something I can...

[Do quickly]
[Do cheaply]
[Show my regulator]
[Get leadership support]
```

Clicking a quick filter should immediately update the question library.

The system must support:

* Keyword search
* Domain
* Effort
* Duration
* Cost
* ROI horizon
* Tier
* Regulator pressure
* Leadership traits

---

# 14. QUESTION LIBRARY

Design this as the signature screen of the platform.

Desktop layout:

```text
┌─────────────────────────────────────────────────────────┐
│ QUESTIONS                                               │
│                                                         │
│ What are you trying to solve?                           │
│ [ Search questions...                                ]  │
│                                                         │
├──────────────────┬──────────────────────────────────────┤
│ FILTERS           │ 24 QUESTIONS                         │
│                  │                                      │
│ Domain            │ Sort: Best match                    │
│ Duration          │                                      │
│ Cost              │ Question result                      │
│ ROI horizon       │                                      │
│ Tier              │ Question result                      │
│ Regulator         │ Question result                      │
│ Leadership        │ Question result                      │
└──────────────────┴──────────────────────────────────────┘
```

Desktop filters should remain visible.

Mobile filters should become a bottom/side sheet.

---

# 15. QUESTION RESULTS

Do not make every question a huge colourful card.

Use editorial result rows.

Each result should include:

```text
DOMAIN / SUBDOMAIN

Question title

Short practical preview

6–12 weeks · Low investment · Quick ROI

Read answer →
```

Example:

```text
RISK / GOVERNANCE

We Have a Risk Register, But No One Uses It

Most risk registers fail because they become
a parallel compliance artefact...

6–12 weeks · Low investment · Quick ROI

Read the answer →
```

Hover should provide subtle feedback.

No dramatic scale animations.

---

# 16. QUESTION MATCHING

When filters are applied, show why a result matches.

Example:

```text
BEST MATCH

We Have a Risk Register, But No One Uses It

Matches your priorities:

✓ Short timeframe
✓ Low investment
✓ Relevant to regulator pressure
```

This makes the taxonomy useful rather than decorative.

---

# 17. FILTER UX

Do not expose seven complicated controls immediately on mobile.

Desktop:

```text
Domain
Duration
Cost
ROI horizon
Tier
Regulator pressure
Leadership traits
```

Mobile:

```text
[Filters 3]

Domain
Duration
Cost
...
```

Show active filters as removable chips.

Example:

```text
2 weeks or less ×
Low cost ×
High regulator pressure ×
```

Include:

```text
Clear all
```

Always show result count.

---

# 18. QUESTION DETAIL PAGE

This should feel like reading a professional article.

Structure:

```text
Breadcrumb

RISK / GOVERNANCE

We Have a Risk Register,
But No One Uses It

How do you make a risk register
that people actually use?

AT A GLANCE

Time
6–12 weeks

Investment
Low

ROI
Quick

Regulator
Low pressure

Tier
Foundational

────────────────────

THE ANSWER

Editorial content...

────────────────────

WHAT TO DO

01
Link every risk to a live objective.

02
Assign ownership to the business.

03
Put the top risks into operating meetings.

04
Embed the register into decision points.

05
Archive stale risks.

────────────────────

RELATED QUESTIONS

────────────────────

USEFUL WITH THIS ANSWER

Template
Course
```

The question title should dominate the page.

---

# 19. QUESTION CONTENT

Do not make the answer look like a blog post with endless text.

Use:

* Short answer
* Key takeaway
* Main guidance
* Numbered practical steps
* Pull quotes where appropriate
* Frameworks
* Examples
* Related questions
* Related products

The content should feel written by a practitioner.

Avoid marketing language.

---

# 20. FREE QUESTION MODEL

Current product direction:

**Question body is public.**

The email capture is a soft conversion mechanism, not the security boundary.

Design:

```text
Question content

[Read the full answer]

↓ near natural conversion point

Want the practical tools behind this?

Enter your email

[Get the tools]
```

Do not blur the entire article.

Do not create an annoying popup immediately.

Do not block the useful answer before demonstrating value.

---

# 21. QUESTION TO PRODUCT CONNECTION

Every question should naturally connect to useful paid content.

Example:

```text
IF THIS IS YOUR PROBLEM

You may also need:

┌─────────────────────────────────┐
│ Risk Review Template            │
│ Practical worksheet             │
│ $39                             │
│                                 │
│ [View template]                 │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ Risk Leadership                 │
│ 6 modules · 2h 40m              │
│ $149                            │
│                                 │
│ [View course]                   │
└─────────────────────────────────┘
```

Do not aggressively sell.

The product should feel like the logical next step.

---

# 22. DOMAIN PAGES

Five current domains:

1. Risk
2. Cyber
3. Compliance
4. Resilience
5. AI

Use the approved domain labels from the existing data.

Domain page:

```text
RISK

Enterprise & operational risk

20 questions

Find answers about:

Risk ownership
Governance
Decision-making
Reporting
Risk appetite

[Browse questions]
```

Do not create five giant colourful cards.

Use typography, numbering, subtle visual distinction.

---

# 23. COURSES PAGE

Courses are secondary to questions.

The catalogue should feel like a professional learning library.

Each course should show:

* Course title
* Outcome
* Audience
* Author
* Duration
* Modules
* Lesson types
* Included resources
* Price
* Access status

Example:

```text
RISK LEADERSHIP

Make risk part of the decisions
your organisation actually makes.

For risk managers and leaders.

6 modules · 2h 40m

Video · Reading · Templates

$149

[View course]
```

---

# 24. COURSE DETAIL PAGE

Make the outcome more important than the module count.

Structure:

```text
Course category

Course title

One-sentence outcome

Audience

Author

Duration

Price

[Start learning / Buy course]

WHAT YOU WILL BE ABLE TO DO

✓ ...
✓ ...
✓ ...

WHAT'S INCLUDED

Video
Reading
Templates
Questions

COURSE CONTENT

Module 01
Lesson
Lesson
Lesson

Module 02
...

AUTHOR

FAQ / ACCESS / REFUND
```

The course page must answer:

* What will I learn?
* Who is it for?
* How long does it take?
* What do I get?
* How much does it cost?
* What happens after purchase?
* Is access permanent?
* What is the refund position?

---

# 25. COURSE CONTENT PREVIEW

Public course syllabus should show all lessons.

Locked lessons should be visible but clearly locked.

Example:

```text
MODULE 01
Making risk useful

✓ Why risk registers fail
🔒 Making ownership real
🔒 Reporting that gets used
🔒 Decision gates
```

Do not make locked lessons look broken.

Use:

```text
🔒 Included with course
```

rather than vague disabled styling.

---

# 26. LEARNING EXPERIENCE

This is the member's main workspace.

Desktop:

```text
┌─────────────────────────────────────────────────────────────┐
│ Course title                                  62% complete │
├────────────────┬────────────────────────────────────────────┤
│ COURSE OUTLINE │                                            │
│                │ Lesson title                               │
│ Module 1       │                                            │
│ ✓ Lesson 1     │ Video / reading / download                │
│ ✓ Lesson 2     │                                            │
│ → Lesson 3     │ Content                                    │
│ ○ Lesson 4     │                                            │
│                │                                            │
│ Module 2       │ [Mark complete]                            │
│ ○ Lesson 5     │                                            │
│                │                                            │
└────────────────┴────────────────────────────────────────────┘
```

Sidebar:

* Sticky
* Independently scrollable
* Current lesson highlighted
* Completed lessons marked
* Locked lessons clearly shown
* Current lesson automatically visible

---

# 27. MOBILE LEARNING

Never squeeze the desktop sidebar onto mobile.

Mobile:

```text
← Course        Lesson 3 of 14       ☰

Lesson title

[Video]

Reading content

[Download worksheet]

[✓ Mark complete]

← Previous              Next →
```

The outline opens as a sheet.

The bottom action area can be sticky.

Respect mobile safe-area insets.

---

# 28. LESSON TYPES

Support:

### Video

```text
Video
Transcript / notes
Downloads
Mark complete
```

### Reading

Use a narrow serif reading column.

```text
Lesson title

Editorial body

Pull quote

Framework

Mark complete
```

### Download

```text
Lesson title

Why this file matters

┌────────────────────────────┐
│ Supplier Risk Checklist    │
│ XLSX · 2.4 MB              │
│                            │
│ [Download]                 │
└────────────────────────────┘

How to use it

Mark complete
```

### Mixed

Allow video + reading + download in one lesson.

---

# 29. VIDEO EXPERIENCE

Use a professional 16:9 player.

Requirements:

* Captions enabled by default
* Play/pause
* Volume
* Playback speed
* Fullscreen
* Keyboard control
* Poster image
* Loading state
* Error state
* Token expiry state

Do not build custom streaming infrastructure.

---

# 30. VIDEO ERROR STATES

Loading:

```text
Poster frame
Loading indicator
```

Failure:

```text
We couldn't load this video.

Check your connection and try again.

[Try again]
```

Token expiry:

```text
Your session for this video has expired.

[Continue watching]
```

The system should request fresh authorisation without losing the learner's place.

---

# 31. PROGRESS

Progress should be simple.

Use:

```text
62% complete

████████████░░░░░░

8 of 13 lessons
```

Use checkmarks in the course outline.

Completion is explicit through:

```text
[Mark complete]
```

Do not infer completion solely from video watch percentage or scrolling.

---

# 32. MEMBER HOME

Do not create a generic corporate dashboard.

Use:

```text
MY LEARNING

Continue where you left off

[Course]
[Progress]
[Continue lesson]


YOUR LIBRARY

Courses
Templates
Downloads


KEEP READING

Question cards


RECENTLY PURCHASED

Products
```

The first thing should always be the thing the user can continue.

---

# 33. TEMPLATES

Templates are practical products.

Template catalogue:

```text
TEMPLATES

Practical tools you can use this week.

[Search templates]

All
Risk
Cyber
Compliance
Resilience
AI
```

Template cards:

```text
TEMPLATE

Vendor Risk Review Pack

XLSX + DOCX

Practical supplier assessment tools.

$39

[View template]
```

---

# 34. TEMPLATE DETAIL

Show:

* Title
* What it solves
* File formats
* File size
* Number of files
* Preview images where appropriate
* What is included
* How to use it
* Related question
* Related course
* Price
* CTA

Example:

```text
VENDOR RISK REVIEW PACK

A practical set of worksheets for
reviewing third-party risk.

Includes

✓ Supplier assessment
✓ Evidence tracker
✓ Risk summary
✓ Review checklist

XLSX · DOCX

$39

[Buy template]
```

---

# 35. PRODUCT ACCESS STATES

Every paid product must have clear states.

### Not signed in

```text
Sign in to purchase
```

### Signed in, not purchased

```text
$39

[Buy template]
```

### Purchased

```text
✓ Purchased

[Download]
```

### Course in progress

```text
68% complete

[Continue learning]
```

### Processing

```text
Your purchase is being confirmed...

```

### Error

```text
Something went wrong.

Your payment was not confirmed.

[Try again]
```

---

# 36. PRICING

Keep pricing simple.

Potential product structure:

```text
FREE
Questions

TEMPLATE
Practical tool
$X

COURSE
Structured learning
$X
```

Do not invent multiple subscription tiers.

The current system uses one-time purchases.

Make the value clear rather than adding visual pricing tricks.

---

# 37. CHECKOUT HANDOFF

Do not design a custom card-entry interface.

Before redirecting to hosted checkout:

```text
YOUR ORDER

Risk Leadership Course

$149 AUD

Includes:
✓ 6 modules
✓ Video lessons
✓ Reading lessons
✓ Templates
✓ Lifetime access

[Continue to secure checkout]
```

Then redirect to the payment provider.

---

# 38. PURCHASE SUCCESS

Design a calm confirmation screen.

```text
You're in.

Risk Leadership

Purchase confirmed.

Your content is ready.

[Start learning]

Receipt sent to
user@email.com
```

Do not use confetti.

Do not use huge celebration graphics.

---

# 39. PURCHASE HISTORY

Member:

```text
PURCHASES

Risk Leadership
12 Aug 2026
$149
✓ Paid

[View content]

Vendor Risk Review Pack
10 Aug 2026
$39
✓ Paid

[Download]
```

---

# 40. DOWNLOADS

```text
MY DOWNLOADS

Risk Review Checklist
XLSX · 2.4 MB
[Download]

Vendor Assessment Pack
PDF · 8.1 MB
[Download]
```

Clearly show file type.

Handle expired access gracefully.

---

# 41. AUTHENTICATION

Screens:

* Sign up
* Sign in
* Forgot password
* Reset password
* Email verification if required
* Account settings

Keep registration short.

Do not ask for information that isn't needed.

Visual direction:

Editorial, simple, centred form.

Example:

```text
DECIDING IN THE DARK

Sign in

Email
[________________]

Password
[________________]

[Sign in]

Forgot password?

New here?
Create an account
```

---

# 42. ADMIN

Admin is functional, but still needs professional UX.

The admin user must be able to manage:

```text
Questions
Domains
Tags
Courses
Modules
Lessons
Videos
Templates
Products
Prices
Users
Orders
Authors
Sections
```

Use a dense professional workspace.

Do not copy the public site's editorial layout into admin.

---

# 43. ADMIN NAVIGATION

```text
OVERVIEW

CONTENT
Questions
Courses
Lessons
Templates
Videos

COMMERCE
Products
Orders

PEOPLE
Users

STRUCTURE
Domains
Sections
Authors
Tags

SETTINGS
```

---

# 44. ADMIN DASHBOARD

Show useful operational information only:

```text
CONTENT

100 Questions
6 Courses
24 Templates
42 Lessons

COMMERCE

Orders this month
Revenue
Pending orders

RECENT ACTIVITY

New question published
New course published
Purchase received
```

Avoid decorative analytics.

---

# 45. QUESTION ADMIN EDITOR

Fields:

```text
Question title
Subtitle
Preview
Full guidance

Domain

Effort
Duration
Cost
ROI horizon
Tier
Regulator pressure
Leadership traits

Related questions
Related templates
Related courses

Status
```

Use structured controls for all seven dimensions.

Do not allow free-form taxonomy values.

---

# 46. COURSE ADMIN EDITOR

Structure visually:

```text
COURSE

Title
Description
Audience
Author
Price/product

MODULES

01 Module
   Lesson
   Lesson
   Lesson

02 Module
   Lesson
   Lesson

[Add module]
```

Allow drag/reorder where practical.

---

# 47. LESSON ADMIN EDITOR

Support:

```text
Title
Description
Lesson type
Duration

VIDEO
Upload/select video

READING
Rich text editor

DOWNLOAD
Select template

RELATED QUESTIONS

Publish status
```

Allow:

```text
Save draft
Preview
Publish
Unpublish
```

Do not allow accidental publishing.

---

# 48. CONTENT STATES

Every content item should support:

```text
Draft
Published
Archived
```

Use clear status badges.

Do not use colour alone.

---

# 49. EMPTY STATES

Every list needs a real empty state.

Example:

```text
NO COURSES YET

Your courses will appear here
once they are published.

[Browse questions]
```

Admin:

```text
NO QUESTIONS

Create your first question to
start building the library.

[Create question]
```

Search:

```text
NO QUESTIONS MATCHED

Try removing one filter or searching
for a different term.

[Clear filters]
```

---

# 50. LOADING STATES

Use skeletons for:

* Question results
* Course cards
* Template cards
* Dashboard
* Lesson outline

Do not show large spinners for normal page loading.

Preserve layout dimensions to prevent layout shift.

---

# 51. ERROR STATES

Design:

* 404
* 500
* Network failure
* Failed API request
* Failed video
* Failed download
* Failed payment
* Expired session
* Unauthorised access

Example:

```text
WE COULDN'T LOAD THIS

Something went wrong while loading
this content.

[Try again]
```

Keep error copy direct.

---

# 52. ACCESS DENIED

Never make inaccessible content appear broken.

Example:

```text
THIS LESSON IS LOCKED

This lesson is included with
Risk Leadership.

[View course]
```

For downloads:

```text
PURCHASE REQUIRED

This template is available after purchase.

[View template]
```

---

# 53. SEARCH

Global search should search:

* Questions
* Courses
* Templates

Search result sections:

```text
QUESTIONS
...

COURSES
...

TEMPLATES
...
```

Question results should receive the strongest visual priority.

---

# 54. GLOBAL SEARCH UI

Desktop:

```text
⌕ Search
```

Click opens command-style search.

```text
Search Deciding in the Dark

[________________________________]

Questions
Courses
Templates
```

Keyboard support:

```text
⌘K / Ctrl+K
```

if implemented.

---

# 55. RECOMMENDATIONS

Recommendations must explain themselves.

Never simply say:

```text
Recommended for you
```

Instead:

```text
Because you were reading about risk reporting

How do I know whether my risk reporting
is actually useful?

[Read answer]
```

This explanation creates trust.

---

# 56. ACCOUNT

Account page:

```text
PROFILE
Name
Email

SECURITY
Password
Sign-in settings

PREFERENCES
Email preferences

PURCHASES
Purchase history

ACCOUNT
Sign out
```

Keep it simple.

---

# 57. LEGAL PAGES

Create:

* Terms
* Privacy
* Refund policy

Use a highly readable document layout.

No giant decorative hero.

---

# 58. ABOUT PAGE

The About page should establish authority.

Use:

* Author
* Professional background
* Why the questions exist
* What the platform is for
* Editorial philosophy

Do not write generic startup copy.

The author's credibility is a key trust signal.

---

# 59. DESIGN SYSTEM

Create a complete reusable design system.

Include:

### Foundations

* Colour tokens
* Typography
* Spacing
* Radius
* Shadows
* Borders
* Breakpoints
* Motion

### Components

* Buttons
* Inputs
* Selects
* Search
* Tabs
* Badges
* Cards
* Tables
* Dialogs
* Sheets
* Toasts
* Breadcrumbs
* Pagination
* Progress
* Skeletons
* Alerts
* Dropdowns

### Product components

* QuestionCard
* QuestionFilters
* QuestionReader
* QuestionMeta
* SearchResults
* CourseCard
* CourseProgress
* CourseOutline
* LessonHeader
* VideoLesson
* ReadingLesson
* DownloadLesson
* LessonNavigation
* TemplateCard
* PricingCard
* ProductCard
* PurchaseSummary
* EntitlementGate
* RecommendationCard
* AdminContentEditor
* PublishStatus

---

# 60. COMPONENT STATES

Every interactive component must define:

```text
Default
Hover
Focus
Active
Disabled
Loading
Success
Error
Empty
Locked
```

Paid content additionally:

```text
Available
Not entitled
Processing
Expired
Purchased
```

Show these states in the design system.

---

# 61. BUTTON SYSTEM

Primary:

```text
[Start learning]
[Read the answer]
[Buy template]
[Continue lesson]
```

Secondary:

```text
[View course]
[See details]
```

Tertiary:

```text
Learn more →
View all →
```

Danger:

```text
Delete
Archive
Unpublish
```

Do not use multiple competing primary buttons.

---

# 62. ICON SYSTEM

Use Lucide icons.

Keep icons:

* 16px for compact controls
* 18px normal controls
* 20px navigation
* 24px feature-level icons

Do not use icons purely for decoration.

---

# 63. MOTION

Motion should be subtle.

Use:

* 150–250ms transitions
* Small opacity/translate changes
* Button press feedback
* Filter result transitions
* Progress bar movement
* Sheet/dialog transitions

Do not use:

* Constant looping animation
* Dramatic card scaling
* Parallax
* Animated gradients
* Confetti
* Excessive page transitions

Respect reduced-motion preferences.

---

# 64. RESPONSIVE DESIGN

Design explicitly for:

```text
375px
390px
430px
768px
1024px
1280px
1440px
```

Do not simply shrink desktop.

### Mobile priorities

* Question discovery remains easy
* Search remains prominent
* Filters become a sheet
* Course outline becomes a sheet
* Video remains full-width
* Typography remains readable
* Buttons remain easy to tap
* Tables become scrollable or stacked
* Admin remains usable

Minimum touch target:

```text
44 × 44px
```

---

# 65. ACCESSIBILITY

Target WCAG AA.

Include:

* Keyboard navigation
* Visible focus states
* Correct heading hierarchy
* Form labels
* Accessible error messages
* Screen-reader labels
* Sufficient contrast
* No colour-only meaning
* Captions
* Reduced motion
* Proper modal focus management
* Skip link
* Route-change focus management

---

# 66. DARK MODE

Support light and dark themes.

Dark mode should be intentionally designed, not colour inversion.

Use semantic tokens:

```text
background
foreground
card
muted
muted-foreground
border
primary
primary-foreground
accent
```

Avoid hard-coded colours in components.

---

# 67. IMAGES

Use imagery sparingly.

Good uses:

* Author portrait
* Course cover
* Template preview
* Editorial image
* Brand illustration

Avoid:

* Generic office people
* Generic handshake images
* Generic business stock photos
* Decorative photos with no purpose

Course artwork should have a consistent visual language.

---

# 68. DATA-DRIVEN DESIGN

Do not hard-code:

* Domain names
* Authors
* Courses
* Question titles
* Tags
* Product names
* Prices
* Sections

The system must support additional subjects, authors, audiences, courses, questions and products without redesigning the UI.

The current product is only the first section.

---

# 69. COMMERCE UX

The system uses one-time purchases and hosted checkout.

Design:

```text
Product view
↓
Purchase summary
↓
Hosted checkout
↓
Payment success
↓
Entitlement granted
↓
Content available
```

Never design a custom credit-card form.

---

# 70. SECURITY UX

Paid content must be protected server-side.

The UI may communicate access state but is never the authority.

Design the following states:

```text
Not signed in
Signed in
Not entitled
Entitled
Processing
Expired
Error
```

Direct access to protected content must fail safely.

---

# 71. EMAIL DESIGN

Use the same visual language for transactional email.

Emails:

* Purchase receipt
* Access granted
* Welcome
* Password reset
* Purchase confirmation

Keep emails simple:

```text
Brand

You're in.

Your purchase is confirmed.

Product details

[Start learning]

Receipt information
```

One primary CTA.

No heavy graphics.

---

# 72. ANALYTICS-AWARE DESIGN

Design the funnel around:

```text
Landing
↓
Question search
↓
Question opened
↓
Product viewed
↓
Checkout started
↓
Purchase
↓
First lesson
↓
Completion
↓
Download
```

Important events:

* question_search
* question_filter_applied
* question_opened
* course_viewed
* course_started
* lesson_started
* lesson_completed
* template_viewed
* checkout_started
* purchase_completed
* download_started
* video_started
* video_completed

The interface should make these meaningful user actions easy to identify.

---

# 73. PERFORMANCE

Design with performance in mind.

Avoid:

* Giant hero images
* Autoplay video
* Huge client-side bundles
* Unnecessary animation
* Loading all questions on homepage
* Large decorative backgrounds

Prefer:

* Lightweight UI
* Lazy images
* Paginated question results
* Managed video streaming
* Skeleton loading
* Small interaction payloads

---

# 74. COMPLETE PAGE INVENTORY

Design all of these.

## PUBLIC

```text
Home
Questions
Question detail
Domain page
Courses
Course detail
Templates
Template detail
Pricing
About
Global search
Sign in
Sign up
Forgot password
Reset password
Terms
Privacy
Refund policy
404
500
```

## MEMBER

```text
My Learning
Course library
Course progress
Lesson
Downloads
Purchases
Account
Access denied
Purchase success
Purchase processing
Purchase failure
```

## ADMIN

```text
Admin overview
Questions list
Create question
Edit question
Courses list
Create course
Edit course
Modules
Lessons
Create lesson
Edit lesson
Templates
Products
Pricing
Orders
Users
Authors
Sections
Domains
Tags
Settings
404
Empty states
Error states
```

---

# 75. DESIGN DELIVERABLE

Generate a **complete, coherent UI system**, not isolated screens.

The design should include:

1. Global design system
2. Typography system
3. Colour system
4. Navigation
5. Buttons
6. Forms
7. Cards
8. Search
9. Filters
10. Question library
11. Question detail
12. Domain pages
13. Course catalogue
14. Course detail
15. Learning interface
16. Lesson types
17. Progress system
18. Template catalogue
19. Template detail
20. Pricing
21. Purchase flow
22. Purchase confirmation
23. Downloads
24. Member area
25. Authentication
26. Admin
27. Empty states
28. Loading states
29. Error states
30. Locked states
31. Mobile layouts
32. Dark mode
33. Accessibility states

---

# 76. PROTOTYPE THE CORE JOURNEY

The most important prototype should work as this sequence:

```text
Home
 ↓
Search question
 ↓
Apply filters
 ↓
Open question
 ↓
Read answer
 ↓
See related course/template
 ↓
Open product
 ↓
Purchase
 ↓
Purchase confirmation
 ↓
Member area
 ↓
Start course
 ↓
Open lesson
 ↓
Watch video / read / download
 ↓
Mark complete
 ↓
Progress updates
```

Prototype this journey before spending time on secondary screens.

---

# 77. VISUAL PRIORITY

Rank the interface hierarchy:

### Priority 1

Question discovery

### Priority 2

Question reading

### Priority 3

Practical product connection

### Priority 4

Course learning

### Priority 5

Commerce

### Priority 6

Member library

### Priority 7

Admin

This hierarchy should be obvious visually.

---

# 78. WHAT TO AVOID

Do NOT produce:

* Generic LMS homepage
* Huge hero illustration
* Excessive purple gradients
* Excessive blue cards
* Glassmorphism
* 3D graphics
* Giant statistics
* Circular progress everywhere
* Excessive pills
* Every section inside a card
* Seven taxonomy badges on every result
* Giant course thumbnails
* Gamification
* Confetti
* AI chatbot as the hero
* Generic "Welcome to your dashboard" SaaS copy
* Fake testimonials
* Fake user counts
* Fake reviews
* Fake metrics
* Placeholder lorem ipsum
* Placeholder course titles
* Placeholder pricing
* "Test test" content

Use realistic project content.

---

# 79. REAL CONTENT TO USE

Use this real question as the primary demonstration:

**Title**

> We Have a Risk Register, But No One Uses It

**Subtitle**

> How do you make a risk register that people actually use?

Use its actual guidance content and actual taxonomy values from the project data.

Do not replace it with placeholder copy.

Use realistic course and template names consistent with the project.

---

# 80. FINAL DESIGN TEST

Before considering the design complete, ask:

### In 5 seconds

Can a stranger understand:

* What is this?
* Who is it for?
* What can I do here?

### In 15 seconds

Can they find a question?

### In 30 seconds

Can they understand the answer?

### In 60 seconds

Can they understand what paid product would help them?

### In 2 minutes

Can they purchase something?

### After purchase

Can they immediately access what they bought?

### While learning

Can they understand:

* Where they are
* What they completed
* What comes next
* What remains

### On mobile

Can they do all of the above without fighting the interface?

---

# 81. FINAL CREATIVE DIRECTION

The finished interface should make a user think:

> "This was made by people who understand risk practitioners."

It should not make them think:

> "This is another online course website."

The strongest visual idea is:

**EDITORIAL CREDIBILITY + PRACTICAL DECISION MAKING + SIMPLE DIGITAL LEARNING**

Use hierarchy, typography, whitespace, structured information, and restrained colour to create the feeling.

Do not try to make the product look expensive.

Make it look **worth trusting**.

The product should consistently lead the user back to:

```text
I have a problem.
        ↓
Find the question.
        ↓
Get the answer.
        ↓
Take the next practical step.
```

Design the entire system around that principle.
