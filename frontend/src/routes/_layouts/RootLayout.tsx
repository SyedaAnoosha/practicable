import { useEffect } from 'react'
import { Outlet, useLocation, useNavigationType } from 'react-router'
import { supabase } from '@/lib/auth/supabase'
import { useAuthStore } from '@/stores/useAuthStore'
import { identifyUser, trackPageview } from '@/lib/analytics'
import { CartDrawer } from '@/components/cart/CartDrawer'

/** Announces the new page on every route change for screen-reader users, who
 * otherwise get told nothing when a SPA navigates.
 *
 * The message is derived during render rather than synced through an effect: an
 * aria-live region only announces when its text actually changes, so a navigation
 * still produces exactly one announcement without a setState-in-effect. */
function RouteAnnouncer() {
  const location = useLocation()
  const message = `${document.title} — page loaded`

  // Page views are tracked from here rather than PostHog's own autocapture (disabled
  // in analytics.ts), in the same place that already re-renders on pathname change.
  useEffect(() => {
    trackPageview(location.pathname)
  }, [location.pathname])

  return (
    <div role="status" aria-live="polite" className="sr-only">
      {message}
    </div>
  )
}

/** Puts a new page at the top of itself. A browser does this for free on a full page
 * load; a SPA does not, so following a footer link from the bottom of a long page
 * landed the reader at the bottom of the next one.
 *
 * Three navigations are left alone: back/forward (`POP`, returning to where the
 * reader was), an in-page anchor (a hash is a request to scroll somewhere specific),
 * and a query-string-only change (keyed on `pathname` alone, since /questions holds
 * its whole filter state in the URL and would otherwise reset scroll on every tap). */
function ScrollToTop() {
  const { pathname, hash } = useLocation()
  const navigationType = useNavigationType()

  useEffect(() => {
    if (navigationType === 'POP' || hash) return
    window.scrollTo(0, 0)
  }, [pathname, hash, navigationType])

  return null
}

// Providers, the skip link, and the one place the Supabase session is subscribed to —
// every layout and page reads session state from useAuthStore, never from Supabase
// directly.
export default function RootLayout() {
  const setSession = useAuthStore((s) => s.setSession)
  const setLoading = useAuthStore((s) => s.setLoading)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
      // A user id only — never the email getSession() also returns.
      if (session?.user) identifyUser(session.user.id)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session?.user) identifyUser(session.user.id)
    })

    return () => subscription.unsubscribe()
  }, [setSession, setLoading])

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-card focus:px-4 focus:py-2 focus:outline focus:outline-2 focus:outline-ring"
      >
        Skip to content
      </a>
      <RouteAnnouncer />
      <ScrollToTop />
      <Outlet />
      {/* One instance for the whole app — every layout's CartButton just calls
          useCartStore.open() rather than rendering its own drawer, so the cart can
          never desync between the marketing header and the member sidebar. */}
      <CartDrawer />
    </>
  )
}
