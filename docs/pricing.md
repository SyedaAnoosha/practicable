# Pricing

A living document — the pricing *policy* is decided; the *catalogue* is deliberately
not, because most of it doesn't have real content behind it yet. Last updated:
2026-08-12.

---

## 1. The policy (adopted, 2026-08-11)

Owner-proposed pricing ladder, adopted as the standing rule for every future product —
clean anchor points instead of arbitrary figures like A$73 or A$117:

```text
FREE        Free question / resource
A$29        Individual template
A$49        Professional checklist
A$79        Short practical course
A$99        Template pack
A$149       Full professional course
A$199       Course + resources
A$279       Practitioner bundle
A$399       Complete programme
```

### Tiering rules

**Templates**
| Depth | Price |
|---|---|
| Simple single-file template | A$19–29 |
| More useful professional template | A$39–49 |
| Multi-file pack | A$59–99 |

**Courses**
| Length | Price |
|---|---|
| Short (30–60 min) | A$39–59 |
| Standard practical (1–3 hrs) | A$79–129 |
| Professional (3–6+ hrs) | A$149–199 |
| Large programme (multiple courses/modules + resources) | A$199–299 |

**Bundles** — priced at a visible discount vs. buying the pieces separately (research
spec Part Four §"Bundles": a bundle at $149 vs. $79+$99=$178 separately is the whole
point — it has to be a real, legible saving, not a token one).

**Currency:** AUD throughout, per decision #5 (week1_plan.md) — matches what's already
live in Stripe.

**Access model:** one-time purchase, lifetime access, for every tier — templates,
courses, and bundles alike, including future updates to whatever was purchased. No
change to the existing entitlement architecture; a bundle is still just a product with
multiple `product_contents` rows (`app/core/entitlements.py`'s own model).

---

## 2. What's actually priced today

Only what has real content behind it — the standing project rule (intern brief:
"real prices... no placeholder junk") applies to pricing exactly as much as it applies
to video and file content. A dozen invented SKUs with no real template file or lesson
behind them would be the same category of problem as a fake receipt or a stub video.

| Product | Price | Grants |
|---|---:|---|
| ~~Risk Register Template~~ | ~~A$29 AUD~~ | **Unpublished 2026-08-12** — the template became the free lead magnet (below), so this product would have charged for two things anyone can have. Not deleted; reversible in one flag. |
| **Vendor Risk Assessment Scorecard** | **A$39 AUD** | The scorecard file, and nothing else. The paid template — see below. |
| Risk Register Fundamentals | **A$49 AUD** | All 3 course lessons across both modules, **plus** the template file and Q001's guidance entitlement. |

A$49 is the bottom of §1's "short course" tier. A$29 remains the ladder's "individual
template" tier for the *next* template — it is simply not in use while the only
template that exists is free.

### The commercial model `[OWNER-DECIDED, 2026-08-12]`

```
Questions                        — free
One template (Risk Register)     — free, but ask for an email first
Other templates                  — paid
Courses                          — paid
```

**The paid template (added 2026-08-12, `db/seed/013`).** The intern brief's Week 1 slice
requires "one template behind a paywall". Making the Risk Register Template free left
that leg with no instance: a free template, a paid course, and no paid template at all.
Rather than reverse the free-template decision, a second real artefact was added —
Vendor Risk Assessment Scorecard, A$39, matching §1's "more useful professional
template" tier and the figure §3 below already assigns to the next vendor-risk product.

It grants **only** its own file. It is deliberately not attached to the course, unlike
the risk register (whose file *is* one of the course's lessons) — a standalone paid
template is exactly the shape the brief asks for, and the only thing that gives the
entitlement suite a paywalled download no other purchase can unlock.

The file was already in Supabase Storage (uploaded 2026-08-10, one of six unused
vendor-risk artefacts) — a genuine 398 KB working spreadsheet, not a stub. The other
five are available for the next templates.

The free template is a lead magnet, not an unpriced draft — `templates.is_free`
(migration `007`) is an explicit flag precisely so those two states cannot be confused.
Its download endpoint serves it with no account and no entitlement check; the email
form is a conversion device, not a boundary (`DESIGN.md` §27.4).

### The split (2026-08-11) — and the hold it overrides

Until this date there was **one** product at A$29 carrying five `product_contents`
rows: the template, all three lessons, and Q001. So "the template" and "the course"
were never separate purchasables at all — buying the A$29 template silently granted
the entire course. Owner-reported as "a real major bug", and correctly so.

This was a *catalogue* defect, not an entitlements defect: `app/core/entitlements.py`
did exactly what it documents (a product grants whatever its `product_contents` rows
point at). `db/seed/012_split_template_and_course_products.sql` fixes the data.

The asymmetry is deliberate and one-directional:

- **Template does NOT unlock the course.** This is the rule that was asked for.
- **Course DOES include the template.** Its Module 2 lesson
  `download-the-register-template` *is* that file, so a course buyer who couldn't open
  the template would hit a locked lesson inside the course they just bought.

**This overrides an earlier hold recorded here.** The previous version of this section
argued *against* pricing the course separately, on the grounds that its real depth
(one ~3-minute video, one ~650-word reading, one download that is the template) does
not yet earn the A$39–59 short-course tier. That reasoning still stands on the merits
and is worth re-reading before marketing the course as substantial — the owner's
instruction to price templates and courses separately simply takes precedence over it.
A$49 is the *bottom* of the tier rather than a number invented to fill the gap. The
honest position: the split is right, the price is defensible, and the course still
needs more real lessons before it is worth what it now costs.

Existing buyers were **grandfathered** — anyone holding the A$29 product before the
split also received the course product (`granted_via='manual'`), because they paid at
a price that genuinely included it. Revoking that retroactively to fix a catalogue
mistake would have been the wrong repair.

---

## 3. The proposed full catalogue — kept as a target, not seeded

The owner's proposal (templates from A$29–99, courses from A$49–249, four tiers of
bundle) is a legitimate, well-reasoned target catalogue — internally consistent, and
it directly matches the ladder above. It is **not** reflected in the database, because
none of it corresponds to content that exists yet: no second template file has been
uploaded, no second course has been authored, no bundle has two real products to
combine. Seeding those rows now would mean real Stripe Products/Prices selling nothing
real behind them, which is the one thing this project has been strict about avoiding
all the way through (real video, real files, real transactions, never a stub).

The proposed 8-product "launch catalogue" and the two-product Stripe-test
recommendation are worth keeping as the literal next step *once* the content exists:

- **Templates:** Risk Register Template (live, **free** — the lead magnet) → Vendor Risk Assessment Template
  (A$39) → TPRM Due Diligence Checklist (A$49) → Complete TPRM Template Pack (A$99).
- **Courses:** Risk Register Fundamentals (live, now sold separately at A$49) → a
  second real course once authored, priced by its real length against §1's tiering
  rules, not against a name borrowed from this proposal.
- **Bundles:** only once there are ≥2 real products worth bundling with a genuine
  discount.

Each new template/course should be priced by finding its row in §1's tiering rules
against its *actual* depth (file count, lesson count, run time) — not by copying a
number from this proposal's example table, which was illustrative, not a commitment
to those exact product names.
