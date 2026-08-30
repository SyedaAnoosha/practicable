/**
 * The post-authentication return path.
 *
 * Without this, MemberLayout's guard would redirect a logged-out visitor to /sign-in
 * with no record of where they were going, and SignIn/SignUp would navigate
 * unconditionally to /dashboard — so a reader who clicked a buy CTA lands on an empty
 * dashboard with the product they wanted forgotten.
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
 * A SECURITY boundary: `next` is attacker-controlled via the URL, so without this
 * `/sign-in?next=https://evil.example` turns our own sign-in form into an open redirect.
 *
 * Accepted: same-document absolute paths only (one leading slash, then anything).
 * Rejected: `//host` (protocol-relative), `https://…` (absolute), backslash variants
 * browsers normalise to `/`, `javascript:` URLs, bare relative paths, and the
 * `/sign-in`/`/sign-up` routes themselves (would bounce the visitor back to the form
 * they just completed).
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
 * `from` is not somewhere we would return to anyway. */
export function signInUrlFor(from: string): string {
  const safe = safeNextPath(from)
  return safe ? `/sign-in?${NEXT_PARAM}=${encodeURIComponent(safe)}` : '/sign-in'
}

/** Read the validated return path out of a `?next=` query string, or the default. */
export function resolveNextPath(search: string): string {
  return safeNextPath(new URLSearchParams(search).get(NEXT_PARAM)) ?? DEFAULT_AFTER_AUTH
}
