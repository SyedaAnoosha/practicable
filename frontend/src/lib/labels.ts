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

// DESIGN.md §28.2 — stated before the Stripe redirect, not discovered on it.
export const TAX_STATEMENT_TEXT = 'Prices are in AUD. GST is included for Australian customers.'

export const BILLING_TYPE_TEXT = 'one-time · lifetime access'
