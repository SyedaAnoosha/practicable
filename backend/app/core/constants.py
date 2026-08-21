"""Phase 9A (W4-R19): Named sentinel for a product whose Stripe Price has never been
resolved to a real Stripe object. Three guard sites reference this — `publish_guard.py`,
`admin/products.py` (twice) — and must not drift from each other.

The string was formerly a bare `"placeholder_update_in_stripe"` literal in each file.
Phase 8A rewrote the code paths that *wrote* it onto new products (they now call
`create_price()` instead), but the three *read* sites remained as guard sentinels:
if the price is still the placeholder, refuse to publish or refuse to change price.

This module is the single import point. `grep -rn 'placeholder_update_in_stripe'
backend/app` should find exactly these three files plus this constant's definition
and the tests that exercise the guards — never a new assignment.
"""

STRIPE_PRICE_UNSET = "placeholder_update_in_stripe"
