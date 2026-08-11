# Pricing

A living document — the pricing *policy* is decided; the *catalogue* is deliberately
not, because most of it doesn't have real content behind it yet. Last updated:
2026-08-11.

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
| Risk Register Template | **A$29 AUD** | The template file, the full "Risk Register Fundamentals" course (all 3 lessons across both modules — module 2's two lessons were linked into `product_contents` this pass, closing a real gap where they existed and were listed but nothing actually granted access to them), and Q001's full guidance. |

That A$29 figure already matches the proposed ladder's "individual template" tier
exactly — no change needed there.

**Deliberately not done:** creating a second, separately-priced "course" product for
the same course. At its current real depth — one ~3-minute video, one ~650-word
reading lesson, one download that's the same file the template product already sells —
it doesn't yet match what the ladder's "short course" tier (A$39–59) implies, let
alone a standalone A$79 course. Selling it separately at a price implying more
substance than it has is the wrong kind of shortcut. Once the course has real,
distinct multi-lesson depth (see `docs/handover.md` §5's "load the real 100-question
catalogue" / "load a second real course" — the actual gating factor), split it out as
its own product at the tier its real length earns.

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

- **Templates:** Risk Register Template (live) → Vendor Risk Assessment Template
  (A$39) → TPRM Due Diligence Checklist (A$49) → Complete TPRM Template Pack (A$99).
- **Courses:** Risk Register Fundamentals (live, bundled) → a second real course once
  authored, priced by its real length against §1's tiering rules, not against a name
  borrowed from this proposal.
- **Bundles:** only once there are ≥2 real products worth bundling with a genuine
  discount.

Each new template/course should be priced by finding its row in §1's tiering rules
against its *actual* depth (file count, lesson count, run time) — not by copying a
number from this proposal's example table, which was illustrative, not a commitment
to those exact product names.
