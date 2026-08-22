/**
 * The post-authentication return path.
 *
 * `[ADDED 2026-08-21, design-research/USER_FLOW_AUDIT.md §2]` Before this, MemberLayout's
 * guard redirected a logged-out visitor to /sign-in with no record of where they were
 * going, and SignIn/SignUp navigated unconditionally to /dashboard. A reader who clicked
 * any of the 16 buy CTAs was therefore delivered to an empty dashboard with the product
 * they wanted forgotten — on the revenue path.
 *
 * Carried as a `?next=` QUERY PARAMETER rather than router state on purpose: CartDrawer
 * signs a visitor in via `window.location.assign('/sign-in')`, a full document load that
 * discards router state entirely. A query parameter survives it, and survives the
 * confirmation-email round trip in SignUp (`emailRedirectTo` → /sign-in) as well.
 */

/** The name of the query parameter, in one place so the three call sites cannot drift. */
export const NEXT_PARAM = 'next'

/** Where a visitor lands when there is no valid `next` to return to. */
export const DEFAULT_AFTER_AUTH = '/dashboard'

/**
 * Validate a candidate return path, returning `null` for anything unsafe.
 *
 * This is a SECURITY boundary, not a convenience check. `next` arrives from the URL, so
 * it is attacker-controlled: without validation, `/sign-in?next=https://evil.example`
 * would turn our own sign-in form into an open redirect — a credible phishing primitive,
 * because the victim really is on the genuine domain reading a genuine form right up to
 * the moment they are thrown off it.
 *
 * Accepted: same-document absolute paths only — one leading slash, then anything.
 * Rejected, each for its own reason:
 *   - `//evil.example`     protocol-relative; browsers treat it as cross-origin
 *   - `https://evil…`      absolute URL
 *   - `http:/\/\evil…`     backslashes, which several browsers normalise to `/`
 *   - `javascript:…`       script URL
 *   - `dashboard`          relative; resolves against the current path, so it cannot be
 *                          reasoned about here and is not worth accepting
 *   - `/sign-in`, `/sign-up`  auth routes themselves — returning to one after a
 *                          successful auth would bounce the visitor straight back to the
 *                          form they just completed
 */
export function safeNextPath(candidate: string | null | undefined): string | null {
  if (!candidate) return null

  // Reject control characters and whitespace outright rather than trimming them away: a
  // leading "\n/evil" or an embedded tab is never a legitimate path, and normalising it
  // into one risks smuggling a value past the checks below.
  // eslint-disable-next-line no-control-regex -- matching them is the point here.
  if (/[\u0000-\u0020\u007F]/.test(candidate)) return null

  // One leading slash, and the next character must not be another slash or a backslash.
  if (!candidate.startsWith('/')) return null
  if (candidate.length > 1 && (candidate[1] === '/' || candidate[1] === '\\')) return null

  // Belt and braces: resolve against a throwaway origin and confirm nothing escaped it.
  // This catches anything the string checks above did not anticipate.
  let url: URL
  try {
    url = new URL(candidate, 'https://practicable.invalid')
  } catch {
    return null
  }
  if (url.origin !== 'https://practicable.invalid') return null

  // Never return to an auth route — see the doc comment.
  if (/^\/(sign-in|sign-up|forgot-password|reset-password)(\/|$)/.test(url.pathname)) return null

  return `${url.pathname}${url.search}${url.hash}`
}

/** Build the sign-in URL that remembers `from`. Falls back to a bare `/sign-in` when
 *  `from` is not somewhere we would return to anyway. */
export function signInUrlFor(from: string): string {
  const safe = safeNextPath(from)
  return safe ? `/sign-in?${NEXT_PARAM}=${encodeURIComponent(safe)}` : '/sign-in'
}

/** Read the validated return path out of a `?next=` query string, or the default. */
export function resolveNextPath(search: string): string {
  return safeNextPath(new URLSearchParams(search).get(NEXT_PARAM)) ?? DEFAULT_AFTER_AUTH
}
