"""Named sentinel for a product whose Stripe Price has never been resolved to a real
Stripe object. Referenced by `publish_guard.py` and `admin/products.py` (twice), which
must not drift from each other, so this module is the single import point: if the price
is still the placeholder, refuse to publish or refuse to change price.

Nothing writes this value onto new products anymore (those paths call `create_price()`);
it survives only as a read-side guard sentinel.
"""

STRIPE_PRICE_UNSET = "placeholder_update_in_stripe"
