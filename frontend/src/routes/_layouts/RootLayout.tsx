import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigationType } from 'react-router'
import { supabase } from '@/lib/auth/supabase'
import { useAuthStore } from '@/stores/useAuthStore'
import { CartDrawer } from '@/components/cart/CartDrawer'
import { api } from '@/lib/api/client'

/** Announces the new page on every route change for screen-reader users, who
 * otherwise get told nothing when a SPA navigates.
 *
 * `[FIXED 2026-08-22, a11y-manual-checks.spec.ts]` **This announced nothing at all for
 * its entire life, and its own comment explained why.**
 *
 * The message used to be `` `${document.title} — page loaded` ``, and the comment
 * correctly noted that "an aria-live region only announces when its text actually
 * changes". Nothing in this application ever sets `document.title` — there is no
 * `useDocumentTitle`, no per-route title, and `index.html` hard-codes
 * `<title>Practicable</title>`. So the text was the identical string on every route,
 * the region never changed, and a screen-reader user navigating the whole product was
 * told nothing, ever. The region existed, was correctly configured, and was inert.
 *
 * The fix reads the page's real `<h1>`, which is the one string guaranteed to exist and
 * to differ per route: `PageTitle` is the single `<h1>` for every route by design
 * ("One <h1> per page — every route's title goes through this component so that rule
 * can't be violated by accident"). Deriving from it rather than adding titles to 45
 * page components keeps one source of truth instead of two that can drift.
 *
 * `document.title` is updated from the same string, so the browser tab and the
 * announcement cannot disagree — and the tab now says where the reader is too.
 *
 * A `MutationObserver` rather than a render-time read: the `<h1>` belongs to the route
 * component, which mounts AFTER this one renders, and most pages fetch their title
 * before they can show it. Reading during render would catch the previous page's
 * heading, or nothing at all. */
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
    // Phase 10 (§10A re-verification, 2026-08-22): me.py's own docstring for
    // POST /me/account/email-changed says "After Supabase confirms the new email,
    // the frontend calls this" — but nothing did. AccountProfile.tsx's
    // updateUser({ email }) only *requests* the change; Supabase's email does not
    // change until the confirmation link is clicked, per the page's own copy. This
    // is the one app-wide place that already observes every session change
    // (RootLayout's own comment above: "every layout and page reads session state
    // from useAuthStore, never from Supabase directly"), so it's where the
    // confirmed-email moment is actually observable — comparing the previous
    // session's email to the incoming one catches exactly that transition, without
    // firing on unrelated USER_UPDATED events (e.g. a password change, which
    // touches the user object but never the email).
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
      <Outlet />
      {/* One instance for the whole app — every layout's CartButton just calls
          useCartStore.open() rather than rendering its own drawer, so the cart can
          never desync between the marketing header and the member sidebar. */}
      <CartDrawer />
    </>
  )
}
