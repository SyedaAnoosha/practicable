import { useState, useCallback } from 'react'
import { Cookie, X } from 'lucide-react'

const CONSENT_KEY = 'practicable:cookie-consent'

/**
 * GDPR cookie consent banner.
 *
 * Shows once until the user accepts or dismisses. Stored in localStorage.
 * Practicable uses only essential cookies (Supabase auth, cart state, preferences)
 * and no third-party tracking cookies — so the consent is a notice, not a choice
 * between "essential" and "analytics". The banner states this plainly.
 */
export function CookieConsent() {
  const [consented, setConsented] = useState(() => {
    try {
      return localStorage.getItem(CONSENT_KEY) === '1'
    } catch {
      return false
    }
  })

  const accept = useCallback(() => {
    setConsented(true)
    try {
      localStorage.setItem(CONSENT_KEY, '1')
    } catch { /* private mode */ }
  }, [])

  if (consented) return null

  return (
    <div
      role="complementary"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 px-5 py-4 shadow-lg backdrop-blur-sm sm:bottom-4 sm:left-4 sm:right-auto sm:max-w-md sm:rounded-xl sm:border sm:px-6"
      style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
    >
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gold-soft text-gold-strong" aria-hidden="true">
          <Cookie className="size-[18px]" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">We use minimal cookies</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Only essential cookies for authentication, your cart, and display preferences.
            No tracking, no analytics, no third-party cookies.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={accept}
              className="rounded-lg bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Got it
            </button>
            <a
              href="/legal/privacy"
              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Privacy policy
            </a>
          </div>
        </div>
        <button
          type="button"
          onClick={accept}
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          aria-label="Dismiss"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
