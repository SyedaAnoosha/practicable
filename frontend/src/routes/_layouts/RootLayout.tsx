import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigationType } from 'react-router'
import { supabase } from '@/lib/auth/supabase'
import { useAuthStore } from '@/stores/useAuthStore'
import { CartDrawer } from '@/components/cart/CartDrawer'
import { api } from '@/lib/api/client'

/** Announces the new page on every route change for screen-reader users, who otherwise
 * get told nothing when a SPA navigates.
 *
 * Reads the page's real `<h1>` (via `PageTitle`, the single `<h1>` per route) rather
 * than `document.title` — nothing sets the title per-route, so an aria-live region
 * keyed off it would never change and never announce. `document.title` is then updated
 * from the same string so the tab and the announcement agree.
 *
 * A `MutationObserver`, not a render-time read: the route component's `<h1>` mounts
 * after this one and most pages fetch their title before showing it, so a render-time
 * read would catch the previous page's heading or nothing. */
function RouteAnnouncer() {
  const { pathname } = useLocation()
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false

    const read = () => {
      const heading = document.querySelector('h1')?.textContent?.trim()
      if (!heading || cancelled) return false
      // Guard against announcing the OUTGOING page's heading: the effect runs on
      // pathname change, but the new route may not have painted yet.
      const next = `${heading} — page loaded`
      setMessage((prev) => (prev === next ? prev : next))
      document.title = `${heading} · Practicable`
      return true
    }

    // Try immediately (a cached route paints synchronously), then watch for the real
    // heading to arrive. Disconnects as soon as it does, so this is not a standing cost.
    if (!read()) {
      const observer = new MutationObserver(() => {
        if (read()) observer.disconnect()
      })
      observer.observe(document.body, { childList: true, subtree: true, characterData: true })
      return () => {
        cancelled = true
        observer.disconnect()
      }
    }

    return () => {
      cancelled = true
    }
  }, [pathname])

  return (
    <div role="status" aria-live="polite" className="sr-only">
      {message}
    </div>
  )
}

/** Focuses the new page's h1 after every route change so keyboard-only users
 * land on the page heading rather than staying wherever they were.
 *
 * WCAG 2.4.3 (Focus Order) requires that focus moves to the content of the new page
 * after user-initiated navigation. The RouteAnnouncer already reads the h1 for
 * screen-reader users; this targets keyboard users who tab through the page after a
 * click.
 *
 * Left alone: hash navigation (focus to an anchor), POP (back/forward), and
 * query-string-only changes (the reader is still on the same page). */
function FocusH1() {
  const { pathname, hash } = useLocation()
  const navigationType = useNavigationType()

  useEffect(() => {
    if (navigationType === 'POP' || hash) return
    // Defer to the next frame so the new route's h1 is in the DOM.
    const id = requestAnimationFrame(() => {
      const h1 = document.querySelector('h1')
      if (h1 && !h1.hasAttribute('tabindex')) {
        h1.setAttribute('tabindex', '-1')
        h1.focus({ preventScroll: true })
      }
    })
    return () => cancelAnimationFrame(id)
  }, [pathname, hash, navigationType])

  return null
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
    // POST /me/account/email-changed must be called after Supabase confirms the new
    // email. AccountProfile.tsx's updateUser({ email }) only *requests* the change;
    // Supabase's email does not change until the confirmation link is clicked. This is
    // the one app-wide place that already observes every session change, so it's where
    // the confirmed-email moment is actually observable — comparing the previous
    // session's email to the incoming one catches exactly that transition, without
    // firing on unrelated USER_UPDATED events (e.g. a password change, which touches
    // the user object but never the email).
    //
    // previousEmail starts as `undefined`, not read from the Zustand store: the
    // store's own session is populated by this same effect's getSession() call
    // below, which resolves asynchronously — reading it synchronously here would
    // race that resolution and silently miss the very first real transition after
    // a fresh page load. Leaving it undefined until getSession() (or the first
    // onAuthStateChange firing, whichever the client delivers first) actually
    // reports a session means the first comparison is always against a real
    // baseline, never a guess.
    let previousEmail: string | undefined

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (previousEmail === undefined) previousEmail = session?.user.email
      setSession(session)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)

      const newEmail = session?.user.email
      if (newEmail && previousEmail && newEmail !== previousEmail) {
        void api.post('/me/account/email-changed', { new_email: newEmail }).catch(() => {
          // Best-effort, matching every other post-action audit hook in this app —
          // a failed audit write must never block the sign-in state update above,
          // which has already happened by this point.
        })
      }
      previousEmail = newEmail
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
      <FocusH1 />
      <Outlet />
      {/* One instance for the whole app — every layout's CartButton just calls
          useCartStore.open() rather than rendering its own drawer, so the cart can
          never desync between the marketing header and the member sidebar. */}
      <CartDrawer />
    </>
  )
}
