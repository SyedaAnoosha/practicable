# Week 1 · Day 1 — schema sign-off and blockers

**Status: schema drafted and ready for your review. Not yet migrated.**

Per the plan, Day 1 does not close until you have reviewed the domain names and
the seven tag enum values *in the actual schema*, not in a proposal. That review
is the first item below.

---

## 1. What was built today

| Artefact | File | State |
|---|---|---|
| Full database schema — all 18 entities | `db/migrations/001_schema.sql` | Ready for your review |
| Row Level Security policies | `db/migrations/002_rls.sql` | Ready |
| Seven tag dimensions, seeded from your values | `db/seed/001_tag_values.sql` | Ready for your review |
| Week 1 slice content — section, 5 domains, Q001, course/module/lesson, template, product | `db/seed/002_slice_content.sql` | Partially blocked, see §3 |
| FastAPI service — config, pool, auth and entitlement dependencies, routers, Mux/R2/Resend services | `api/` | Ready; needs credentials to run |
| React foundations — theme tokens, types, API client, auth store, scoring | `web/src/` | Ready; needs credentials to run |
| Match-scoring logic and its tests | `web/src/lib/scoring.ts`, `__tests__/` | Ready, 6 cases passing |

The whole content hierarchy exists in the schema even though Week 1 populates a
fraction of it. That is deliberate: a second course, domain or product type in
Week 2 should be data entry, not a migration.

---

## 2. Needs your sign-off before the migration runs

### 2.1 Domain names

Your list gave a short name and a parenthetical. I have modelled these as two
fields, because the short name is what fits a card eyebrow and a filter row,
and the qualifier is useful on the domain page but too long everywhere else.

| Slug | `title` | `qualifier` |
|---|---|---|
| `risk` | Risk | Enterprise and operational |
| `cyber` | Cyber | Technology and security |
| `compliance` | Compliance | Regulatory |
| `resilience` | Resilience | Continuity |
| `ai` | AI | Governance |

**Confirm or correct.** Changing these after content is loaded is a migration.

One thing to check: Q001's domain was given as "Risk Management", which does
not match any of the five exactly. I have filed it under **Risk**. Confirm
that is right.

### 2.2 The seven dimensions

Transcribed exactly as supplied. Two notes where I had to make a judgement:

**Payback.** Your codes were Q / M / S. I have stored the values as explicit
ranges (`under_6m`, `from_6_to_18m`, `over_18m`) and kept your letters as the
display label, because `S` means "Over 18 months" in Payback and "Strategic
uplift" in Tier. Two dimensions sharing a letter is a support ticket waiting to
happen, and a filter chip reading just `S` is unreadable. **The UI will show
the letter; the database stores the meaning.** Say if you would rather it
showed the range.

**Ordering.** Each dimension has a numeric `ordinal` because the match-scoring
model needs a scale — that is what lets "close matches" work rather than a
filter returning nothing. Ordinals ascend with *more* of the thing: more
effort, longer duration, higher cost, longer payback, more pressure. For payback
that means **1 is the good end**, so the filter must be labelled "Payback:
under 6 months", never "Payback: low".

### 2.3 Q001

Body text is reproduced verbatim. Two fields I had to draft, both marked
`[AUTHOR REVIEW]` in the seed file:

- **`preview`** (158 chars) — the line that appears on cards, in search results,
  and as the page's meta description. It has to be authored rather than cut from
  the first paragraph, because a machine cut mid-clause misrepresents published
  work. My draft: *"Registers fail when they sit beside the business instead of
  inside it. Five moves put yours back into the decisions people are already
  making."*
- **`short_answer`** — the public 2–3 sentences above the paywall, drawn from
  your opening. This is the part a non-buyer reads, so it matters commercially.

Both are yours to rewrite. Nothing goes public until you have.

---

## 3. Blockers — these stop specific days, not just tidiness

| # | Blocked item | Stops | Notes |
|---|---|---|---|
| 1 | **The real template file** | Day 3 upload to R2, Day 4 sale | Plan Open Decision #7 said "will provide before starting". Not received. |
| 2 | **The real video** (or a script I can film informally) | Day 3 Mux upload, and the whole video half of the slice | Same decision. |
| 3 | **The template's real price** | Day 4 — the Stripe Price object cannot be created without it | The product row is seeded at `price_cents = 0` and `status = 'draft'` so nothing can accidentally sell at that price. This is the one I would unblock first. |
| 4 | **Author name, bio, credentials** | Anything public; the about page and the question byline | Seeded as `PENDING`. |
| 5 | **Legal entity name and address** | Day 4 receipt email | You said "I personally", which is fine, but a receipt someone submits to their finance team needs a legal name and an address on it — and if you are Australian and registered, an ABN. |

**Day 1 can complete without #1–#4.** Day 3 cannot start without #1 and #2, and
Day 4 cannot complete without #3 and #5.

---

## 4. Two things in the plan I would change

### 4.1 Currency — ship AUD only

The plan says *"AUD by default, with options for USD, GBP, EUR."* I would do AUD
only for v1, and here is the cost of the alternative:

Multi-currency is not a display setting. Stripe needs a separate Price object per
currency per product, the checkout has to pick one, receipts and refunds are
denominated in whichever was used, and tax treatment differs by buyer location.
That is a day of work and a category of bug, spent on a problem you do not have
until you have overseas customers.

The schema is already built for it — `currency` is a column on both `products`
and `orders`, not a constant — so adding USD later is configuration and a Stripe
Price, not a migration. **My recommendation: launch AUD, add currencies when a
real overseas buyer asks.** Overrule me if you already have that demand.

### 4.2 Design tokens — not placeholders

The plan calls for "placeholder design tokens, swapped later". I have used the
finalised set from `DESIGN.md` v2.0 instead, because it is already decided and
because six values in the originally supplied palette failed accessibility
checks in dark mode — including the focus ring at 1.65:1 against the background,
which makes keyboard navigation effectively invisible. Those are corrected in
`web/src/styles/theme.css` and each fix is annotated with the old value.

Nothing here blocks a later brand change: every colour is one CSS variable in
one file.

---

## 5. Where the security actually lives

Worth being explicit, because it is the brief's hardest requirement and it is
easy to assume RLS is doing more than it is.

- **RLS denies by default and grants back only what is safe.** There is
  deliberately **no read policy on `questions`, `lessons` or `templates`**,
  because RLS is row-level and a select policy would expose `body`,
  `mux_playback_id` and `r2_object_key` to anyone holding the anon key — which
  is public, and always will be, because it ships in the JS bundle.
- **`entitlements` has no insert policy for anyone.** Only the service role
  writes it. A user cannot grant themselves access because nothing they hold can
  write to that table at all.
- **The real check is `api/app/deps.py`.** It runs *before* Mux or R2 are
  called, never after. A credential that is minted and then discarded is still a
  credential that existed.
- **403 responses are uniform** whether the content is missing or merely
  unowned, so the endpoints cannot be used to enumerate the paid catalogue.

---

## 6. Next actions

**You:**
1. Confirm or correct the five domains and the tag values in §2.
2. Confirm the Q001 domain mapping, and rewrite the two drafted fields.
3. Send the price (#3 above) — this is the one blocking the most.
4. Send the template file and the video or script.
5. Decide on AUD-only (§4.1).

**Me, once §2 is confirmed:**
1. Run the three migrations against Supabase and verify the row counts.
2. Stand up both services locally, prove the frontend reaches `/health`
   cross-origin.
3. Deploy blank to Vercel and Render.
4. Day 2: Supabase Auth, and prove the 401 on a protected endpoint with a real
   request rather than by clicking around in the UI.

I will send the daily note at the end of each day: what moved, what is blocked,
what I decided.
