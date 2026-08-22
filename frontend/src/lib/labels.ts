// Shared copy that must read identically wherever it appears — week3_plan.md Phase 4
// step 1: "the same sentence, defined once, not three independent drafts." /store,
// /legal/refunds (components/legal/pages/Refunds.tsx) and the receipt email
// (backend/app/core/labels.py — Jinja2 can't import a TS module, so that file carries
// a byte-identical Python copy, cross-referenced in both directions) all render this
// exact sentence; each surface adds its OWN pointer/link around it rather than baking
// one into the shared string, since "see the full policy" reads oddly ON the full
// policy page itself.
//
// Decision #17 stays deliberately open (owner instruction, "keep the refund window as
// it is") — this text states the consumer-guarantee position and never invents a
// day-count /legal/refunds doesn't (yet) finally state.
export const REFUND_POSITION_TEXT =
  "You're covered by your consumer-guarantee rights, regardless of anything else stated here."

// ── Refunded access, said out loud (W4-R20, ledger row 92) ──────────────────────
// Before this, a refunded buyer opening a course they used to own saw an ordinary buy
// page: the entitlement gate had correctly removed access, and nothing on the page
// acknowledged it. That reads as the site losing their purchase, which is worse than
// the refund itself.
//
// Tone is deliberate and matches week4_plan.md 9B step 7: `muted`, never `destructive`.
// A refund the buyer asked for is a completed transaction, not an error — colouring it
// red would tell them something went wrong when nothing did. It also never implies the
// refund was a mistake or invites them to justify it.
export const ACCESS_ENDED_HEADING = 'Access ended — refunded'
export const ACCESS_ENDED_BODY =
  'This course was refunded, so it is no longer in your library. You can buy it again at any time, and your progress is kept if you do.'

// DESIGN.md §28.2 — stated before the Stripe redirect, not discovered on it.
export const TAX_STATEMENT_TEXT = 'Prices are in AUD. GST is included for Australian customers.'

export const BILLING_TYPE_TEXT = 'one-time · lifetime access'

// ── Phase 8F: WhyThis claims (W4-R16) ───────────────────────────────────────────
// Every claim traces to a column or a guard. Zero social-proof claims.
// No line makes a claim about other buyers (non-negotiable #13).
export const WHY_BUY_CLAIMS = [
  {
    label: 'Lifetime access',
    detail:
      'One purchase. No subscription, no recurring charge. Access includes future updates to the same course or template.',
    // Backed by: `terms_of_service` + `orders` (one-time payment, no renewal)
  },
  {
    label: 'Consumer guarantees',
    detail:
      'You are covered by Australian Consumer Law guarantees regardless of anything else stated here.',
    // Backed by: consumer-guarantee guard, `legal/refunds`
  },
  {
    label: 'Internal use licence',
    detail:
      'Use and adapt inside your own organisation. A licence tier for client delivery is available if you need it.',
    // Backed by: `products.licence` column, `LicenceLine.tsx`
  },
  {
    label: 'Versioned and reviewed',
    detail:
      'Every product shows its version and last review date. You see exactly how current the material is before you pay.',
    // Backed by: `products.version`, `products.last_reviewed_at`, `templates.version`
  },
  {
    label: 'Downloadable formats',
    detail:
      'Templates open in standard office software. The format, size and editability are shown before purchase.',
    // Backed by: `templates.page_count`, `sheet_count`, `is_editable`, `min_office_version`
  },
  {
    label: 'Immediate access',
    detail:
      'After payment you can download immediately. A receipt arrives by email. Access does not expire.',
    // Backed by: checkout → webhook → entitlement → download path
  },
] as const

// The objection block — five things, four of which are columns.
// Placed below WhyThis on product pages.
export const OBJECTION_BLOCK = [
  {
    label: 'Refund policy',
    detail:
      'Change-of-mind refunds are available up to 15% course completion. Consumer-guarantee rights always apply.',
  },
  {
    label: 'Licence terms',
    detail:
      'Use and adapt inside your own organisation. Full terms on the legal page.',
    href: '/legal/terms',
  },
  {
    label: 'Version and updates',
    detail:
      'The version and last review date are shown on every product page. Updates to the same product are included.',
  },
  {
    label: 'What it opens in',
    detail:
      'Templates: standard office software (Word, Excel, or compatible). Courses: your browser, with video and reading.',
  },
  {
    label: 'After payment',
    detail:
      'Download immediately. Receipt by email. Access does not expire.',
  },
] as const
