import { useState, useEffect, useCallback } from 'react'
import { Copy, X, Check } from 'lucide-react'
import { setActivePromoCode } from '@/lib/promo'

const DISMISS_KEY = 'practicable:discount-banner-dismissed'
const PROMO_CODE = 'WELCOME15'
const DISCOUNT_PERCENT = 15

/**
 * A site-wide promotional banner offering a discount code at checkout.
 *
 * Dismissible — once closed, stays closed for this browser (localStorage).
 * The code is displayed prominently with a one-click copy button.
 * Gold-toned to match the brand's warm palette without competing with the
 * header's gilt edge.
 */
export function DiscountBanner() {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1'
    } catch {
      return false
    }
  })
  const [copied, setCopied] = useState(false)

  const dismiss = useCallback(() => {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch { /* private mode */ }
  }, [])

  // Reset the "copied" state after 2 seconds
  useEffect(() => {
    if (!copied) return
    const id = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(id)
  }, [copied])

  if (dismissed) return null

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(PROMO_CODE)
      setCopied(true)
      setActivePromoCode(PROMO_CODE)
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
      setActivePromoCode(PROMO_CODE)
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
        <span className="font-semibold">{DISCOUNT_PERCENT}% off</span> your first purchase — use code{' '}
        <button
          type="button"
          onClick={copyCode}
          className="inline-flex items-center gap-1 rounded-md border border-gold/40 bg-gold/10 px-2 py-0.5 font-mono text-xs font-semibold text-gold-strong transition-colors hover:bg-gold/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          title="Click to copy"
        >
          <span id="promo-code">{PROMO_CODE}</span>
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
        {copied ? `Code ${PROMO_CODE} copied to clipboard` : ''}
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
