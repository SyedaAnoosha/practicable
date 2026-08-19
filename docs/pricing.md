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
| Quality Risk Management Presentation | **A$29 AUD** | `[ADDED 2026-08-15, week3_plan.md Phase 3]` One `.ppt` file, uploaded and priced conservatively (unverified depth — legacy format, no reader available) — see §4. |
| **Vendor Risk Assessment Scorecard** | **A$39 AUD** | The scorecard file, and nothing else. The paid template — see below. |
| Risk Assessment Template | **A$39 AUD** | `[ADDED 2026-08-15]` One 18-page worked risk-assessment example (a NEBOSH IG2-style document — see §4 for provenance). |
| Risk Register Fundamentals | **A$49 AUD** | All 3 course lessons across both modules, **plus** the template file and Q001's guidance entitlement. |
| Risk (Enterprise & operational) — question pack | **A$49 AUD** | `[ADDED 2026-08-15]` The Risk domain pack, `db/seed/014` finally run: 1 PDF (60 questions, typeset and ordered) + all 60 questions' `question_set` grant. |
| TPRM Due Diligence Checklist | **A$49 AUD** | `[ADDED 2026-08-15]` One `.xlsx` task tracker (collect/screen/assess a vendor, with status/owner/dates), from the previously-unused vendor-risk file set. |
| **Risk Register, start to finish** (bundle) | **A$79 AUD** | `[ADDED 2026-08-15]` Decision #29: Risk Register Fundamentals + the Risk domain pack, A$98 separately → A$79, saving A$19 (19.4%). One ordinary product; `product_contents` is the live union of both parts' grants — no new entitlement mechanism (RS 5.6). |
| Complete TPRM Template Pack | **A$99 AUD** | `[ADDED 2026-08-15]` Two files, one product: a 15-item Vendor Risk Assessment Template (PDF) + a Vendor Evaluation with Scorecard (`.xlsx`) — the "multi-file pack" tier. |

A$49 is the bottom of §1's "short course" tier. **A$29 is back in use** — the
"individual template" tier now has two real occupants (§4) alongside the still-free,
still-unpublished Risk Register Template above.

**Catalogue count, 2026-08-15: 7 published products before the bundle, 8 with it** —
closing `week3_plan.md` W3-R2's "≥6 published products … plus one bundle" acceptance
line. Every price above is a real ladder rung, justified against §1's tiering rules by
each file's actual depth (page count, sheet structure, file count) — never copied from
this document's earlier illustrative table. See §4 for exactly which files these are
and where they came from.

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

---

## 4. §3's target catalogue, actually seeded (2026-08-15, week3_plan.md Phase 3)

The proposal above is no longer a target — it's what's live, at the exact prices §3
already named (Vendor Risk Assessment Template A$39, TPRM Due Diligence Checklist
A$49, Complete TPRM Template Pack A$99), plus the domain pack and the bundle. Real
content behind every price, per the standing rule, checked before pricing rather than
assumed from a filename:

**The six vendor-risk files (uploaded 2026-08-10, decision #28 confirmed the owner's
own, purchased/licensed for resale).** One (`IC-Vendor-Risk-Comparison-with-Scorecard-10772.xlsx`)
was already sold as the Vendor Risk Assessment Scorecard (§2). The other five, all now
sold:
- `IC-Sample-Vendor-Risk-Due-Diligence-Plan-10772.xlsx` — a task tracker (collect vendor
  info → screen the vendor → assess the risk, with status/owner/dates) → **TPRM Due
  Diligence Checklist, A$49**. Its PDF twin in the same upload batch
  (`..._PDF.pdf`) was used only to inspect the real content before writing the
  product description — not sold separately, to avoid selling the same material twice.
- `IC-Vendor-Risk-Assessment-10772_PDF.pdf` (a 15-item rated risk checklist) +
  `IC-Vendor-Evaluation-with-Scorecard-10772.xlsx` (a per-vendor evaluation form,
  content-checked against the already-sold Comparison scorecard to confirm it's
  genuinely different material, not a resell of the same sheet under a new name) →
  **Complete TPRM Template Pack, A$99** — two files, one product, the "multi-file pack"
  tier.

**Two templates uploaded via the admin panel on 2026-08-15**, while testing the
upload-bug fix (`handover.md` §1), left published with no product attached. Opening
`risk-assessment-template.pdf` to write an honest description found it isn't generic
vendor-risk material at all — it's an 18-page **NEBOSH Unit IG2 assessment** layout
(learner declaration, malpractice-policy notice), a different provenance than the six
files above and not covered by decision #28's confirmation. **Asked and confirmed live,
2026-08-15: the owner holds the rights to sell both this file and the companion `.ppt`
("Quality Risk Management Presentation").** Priced conservatively against what was
actually verifiable — A$39 for the worked-example PDF (real 18-page depth, confirmed by
reading it), A$29 for the presentation (legacy `.ppt` format, unreadable by any tool
available this session, so priced at the "simple template" floor rather than guessed
upward).

**The domain pack** (`db/seed/014`, held since Week 2 on "no PDF, no Stripe Price") —
both blockers closed this session: `scripts/build_domain_pack.py --domain Risk` run for
real (60 questions, 97,470-byte PDF, byte-identical to the size named in the seed
script's own docstring example), uploaded to Storage, a real test-mode Stripe
Price created, then the seed re-run with both. **Risk (Enterprise & operational) —
question pack, A$49** — the "professional checklist" tier, per §1.

**The bundle** (decision #29) — Risk Register Fundamentals + the Risk pack, A$98
separately, **A$79 together**. `db/seed/016_seed_bundle.sql` builds its
`product_contents` as the live `SELECT DISTINCT` union of both parts' own grants,
not a hand-copied id list — a future change to either part (a new lesson, a re-typeset
pack) is picked up the next time the seed runs, and the one question both parts already
shared (Q001, in both the course and the 60-question pack) collapses to one grant
rather than two.

Storage credentials (`SUPABASE_STORAGE_S3_ENDPOINT` etc.) and a live `rk_test_` Stripe
key were both actually present in `backend/.env` this session, despite `.env.example`'s
comment still marking storage as "STILL MISSING" — that comment is stale, not current
state; worth updating in the same pass that reconciles Render's env vars (`handover.md`
§4 item 15).
