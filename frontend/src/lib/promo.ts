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
