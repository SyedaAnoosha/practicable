import { useState, useEffect, useCallback } from 'react'
import { Copy, X, Check } from 'lucide-react'
import { useActivePromotion } from '@/hooks/useActivePromotion'
import { setActivePromoCode } from '@/lib/promo'

/**
 * A site-wide promotional banner offering a discount code at checkout.
 *
 * Fetches the active promotion from GET /promotions/active. When loading,
 * rendering nothing (not a skeleton) to avoid a CLS regression against the
 * DESIGN.md §43 budget of 0.05. When there is no promotion or the fetch
 * fails, the banner is absent and the page layout does not shift.
 *
 * Dismissible — once closed, stays closed for this browser (localStorage).
 * The dismissal key is keyed on the promotion code so a *new* offer is not
 * pre-dismissed for everyone who closed the old one.
 */
export function DiscountBanner() {
  const { data: promotion, isLoading } = useActivePromotion()

  // Key the dismissal on the code, not a static key — a new offer must not
  // inherit the dismissal of a previous one. Comment it because this is the
  // non-obvious part.
  const dismissKey = promotion
    ? `practicable:discount-banner-dismissed:${promotion.code}`
    : 'practicable:discount-banner-dismissed'

  const [dismissed, setDismissed] = useState(() => {
    if (!promotion) return false
    try {
      return localStorage.getItem(dismissKey) === '1'
    } catch {
      return false
    }
  })

  // Reset dismissed state when the promotion changes (e.g., a new code arrives).
  useEffect(() => {
    if (!promotion) return
    try {
      setDismissed(localStorage.getItem(dismissKey) === '1')
    } catch {
      setDismissed(false)
    }
  }, [dismissKey, promotion])

  const [copied, setCopied] = useState(false)

  const dismiss = useCallback(() => {
    setDismissed(true)
    try {
      localStorage.setItem(dismissKey, '1')
    } catch { /* private mode */ }
  }, [dismissKey])

  // Reset the "copied" state after 2 seconds
  useEffect(() => {
    if (!copied) return
    const id = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(id)
  }, [copied])

  // While loading, render nothing — not a skeleton. A banner that appears a
  // beat after paint pushes the whole page down, which is a CLS regression.
  if (isLoading) return null
  // On error (promotion is null from the hook), render nothing.
  if (!promotion) return null
  if (dismissed) return null

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(promotion.code)
      setCopied(true)
      setActivePromoCode(promotion.code)
    } catch {
      // Fallback: select the text
      const el = document.getElementById('promo-code')
      if (el) {
        const range = document.createRange()
        range.selectNodeContents(el)
        const sel = window.getSelection()
        sel?.removeAllRanges()
        sel?.addRange(range)
      }
      setActivePromoCode(promotion.code)
    }
  }

  return (
    /* `role="banner"` was wrong here: it is the landmark for the page header, and the
       site already has one on <header>. Two `banner` landmarks make a screen-reader
       landmark list ambiguous — the user cannot tell which is the site header.
       This is a complementary region instead, with a name so it is identifiable. */
    <div
      role="region"
      aria-label="Promotional offer"
      className="relative isolate flex items-center justify-center gap-3 border-b border-gold/20 bg-gold/10 px-4 py-2.5 text-sm"
    >
      <p className="text-foreground">
        <span className="font-semibold">{promotion.percent_off}% off</span>{' '}
        {promotion.message} — use code{' '}
        <button
          type="button"
          onClick={copyCode}
          className="inline-flex items-center gap-1 rounded-md border border-gold/40 bg-gold/10 px-2 py-0.5 font-mono text-xs font-semibold text-gold-strong transition-colors hover:bg-gold/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          title="Click to copy"
        >
          <span id="promo-code">{promotion.code}</span>
          {copied ? (
            <Check className="size-3 text-success" aria-hidden="true" />
          ) : (
            <Copy className="size-3" aria-hidden="true" />
          )}
        </button>{' '}
        at checkout
      </p>
      {/* The copy confirmation is a visual tick on the button; without a live region a
          screen-reader user gets no feedback that the click did anything. */}
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? `Code ${promotion.code} copied to clipboard` : ''}
      </span>
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-gold/15 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        aria-label="Dismiss discount banner"
      >
        <X className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  )
}
