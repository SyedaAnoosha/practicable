"""Shared copy that must read identically wherever it appears — week3_plan.md Phase 4
step 1: "the same sentence, defined once, not three independent drafts."

This is the backend half of `frontend/src/lib/labels.ts`'s `REFUND_POSITION_TEXT`.
Jinja2 (the receipt email) can't import a TypeScript module, so the frontend is the
canonical source and this is a byte-identical copy — if one changes, change the other
in the same commit. `/pricing`, `/legal/refunds` and the receipt email all render this
exact sentence; each surface adds its own pointer/link around it rather than baking one
into the shared string itself.

Decision #17 stays deliberately open (owner instruction, "keep the refund window as it
is") — this text states the consumer-guarantee position and never invents a day-count
`/legal/refunds` doesn't (yet) finally state.
"""

REFUND_POSITION_TEXT = (
    "You're covered by your consumer-guarantee rights, regardless of anything else stated here."
)
