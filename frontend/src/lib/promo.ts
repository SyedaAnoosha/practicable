/**
 * Active promo code — set when the user copies it from the discount banner,
 * read at checkout time. Stored in localStorage so it survives navigation
 * but is scoped to this browser.
 */
const PROMO_KEY = 'practicable:active-promo'

export function getActivePromoCode(): string | null {
  try {
    return localStorage.getItem(PROMO_KEY)
  } catch {
    return null
  }
}

export function setActivePromoCode(code: string): void {
  try {
    localStorage.setItem(PROMO_KEY, code)
  } catch { /* private mode */ }
}

/**
 * Forget the stored code. Called once an order is confirmed on the success page.
 *
 * Without this the banner code was sticky for the life of the browser profile: a
 * first-order-only code such as WELCOME15 was re-sent on the buyer's second and
 * every later checkout. Stripe now refuses a code whose restrictions do not hold,
 * so this is no longer the thing enforcing the rule — it just stops the site from
 * suggesting a code the buyer has already used.
 */
export function clearActivePromoCode(): void {
  try {
    localStorage.removeItem(PROMO_KEY)
  } catch { /* private mode */ }
}
