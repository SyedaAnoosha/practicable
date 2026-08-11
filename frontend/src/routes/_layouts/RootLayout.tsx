import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router'
import { supabase } from '@/lib/auth/supabase'
import { useAuthStore } from '@/stores/useAuthStore'

/** Announces the new page on every route change for screen-reader users, who
 * otherwise get told nothing when a SPA navigates (DESIGN.md §42.2).
 *
 * The message is derived during render rather than synced through an effect: an
 * aria-live region only announces when its text actually changes, so a navigation
 * (which changes the text via the new pathname) still produces exactly one
 * announcement — without the setState-in-effect pattern lint forbids. */
function RouteAnnouncer() {
  // Subscribes this component to navigation: a pathname change re-renders it,
  // which recomputes the announcement text below. The location object itself is
  // not read — the re-render (and the aria-live text change) is the point.
  useLocation()
  const message = `${document.title} — page loaded`

  return (
    <div role="status" aria-live="polite" className="sr-only">
      {message}
    </div>
  )
}

// Providers, the skip link, and the one place the Supabase session is subscribed to —
// every layout and page reads session state from useAuthStore, never from Supabase
// directly (DESIGN.md §80, §42.4).
export default function RootLayout() {
  const setSession = useAuthStore((s) => s.setSession)
  const setLoading = useAuthStore((s) => s.setLoading)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
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
      <Outlet />
    </>
  )
}
