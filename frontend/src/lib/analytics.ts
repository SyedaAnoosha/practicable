import posthog from 'posthog-js'

/** week2_plan.md Phase 5 / W2-R8 — the PostHog wrapper, typed against a reconciled
 * nine-event schema (see the note below on why it's a reconciliation, not a literal
 * transcription of Phase 5 step 7's own list).
 *
 * **No event property carries anything beyond a user id, ever** — no email, no name,
 * no free-text search query, no message body. Do Not Track is honoured: if the
 * browser sends it, `init()` never loads the PostHog script at all, so nothing is
 * capturable regardless of what a call site later passes.
 *
 * **Reconciling a contradiction in week2_plan.md itself:** Phase 5 step 7 lists nine
 * *client-side* event names in its code block, then step 8 says "four of these are
 * server-side" and names four DIFFERENT events (`purchase_completed`,
 * `entitlement_delay`, `download_failed`, `refund_issued`) that appear nowhere in
 * step 7's list — taking both literally would mean 9 + 4 = 13 events, not nine.
 * `BACKEND.md §6.5` (higher precedence than this plan per §0.3) commits to exactly
 * those four names for the server half, so this file treats them as fixed and picks
 * five client-side events from step 7's list that most directly answer the two
 * questions W2-R8 actually states — Product Spec §9's "what's viewed, what's bought,
 * by content type, and where people drop off" and step 7's own inline "is the
 * seven-tag system actually used" — rather than instrumenting all nine of step 7's
 * names on top of the server four. `checkout_completed` is dropped as redundant with
 * the server-side `purchase_completed`; `checkout_abandoned` is dropped as an
 * unreliable client-side signal, better read as the gap between `checkout_started`
 * and `purchase_completed` in PostHog directly; `lesson_started`/`lesson_completed`
 * are dropped because that same "where do people drop off in a course" question is
 * already answerable from `lesson_progress` rows in the product database itself,
 * unlike the other five, which have no record at all if the visitor never converts.
 */

type ContentType = 'question' | 'course' | 'template' | 'pack'

interface AnalyticsEvents {
  content_viewed: { type: ContentType; slug: string }
  filter_applied: { dimension: string; value: string }
  // `source` matches whatever string `useEmailGate(source)` was called with
  // (emailGate.ts) — today that's just `course_lesson_free_template`, the only live
  // gate, but the shape stays open rather than a two-value union so a second gate
  // doesn't need this file edited to stay typed.
  email_gate_shown: { source: string }
  email_captured: { source: string }
  checkout_started: { product_slug: string; price: number }
}

let initialized = false

function doNotTrackRequested(): boolean {
  // Three different places browsers have put this over the years.
  const dnt = navigator.doNotTrack ?? (window as unknown as { doNotTrack?: string }).doNotTrack
  return dnt === '1' || dnt === 'yes'
}

/** Call once, at app start. No-ops (never throws) if the project key isn't
 * configured or the visitor has Do Not Track set — in the DNT case, the PostHog
 * script is never loaded at all, not merely told not to send. */
export function initAnalytics() {
  if (initialized) return
  const key = import.meta.env.VITE_POSTHOG_KEY
  if (!key || doNotTrackRequested()) return

  posthog.init(key, {
    api_host: import.meta.env.VITE_POSTHOG_HOST ?? 'https://us.i.posthog.com',
    // We capture route changes ourselves (`trackPageview` below, from RootLayout's
    // existing route-change effect) rather than PostHog's history-API autocapture,
    // so a page view is timed with the rest of this app's own navigation handling.
    capture_pageview: false,
    // Autocapture would record every click's DOM text/attributes by default — this
    // product's own nine-event discipline (§48: "twelve well-propertied events beat
    // sixty bare ones") applies exactly as much to what PostHog auto-collects as to
    // what this file calls explicitly.
    autocapture: false,
  })
  initialized = true
}

/** Associates future events with a real user id — never an email or name, per
 * W2-R8's "no PII beyond a user id". Call on sign-in; no call needed for anonymous
 * visitors, who keep PostHog's own anonymous distinct id. */
export function identifyUser(userId: string) {
  if (!initialized) return
  posthog.identify(userId)
}

export function trackPageview(path: string) {
  if (!initialized) return
  posthog.capture('$pageview', { $current_url: path })
}

export function track<E extends keyof AnalyticsEvents>(event: E, properties: AnalyticsEvents[E]) {
  if (!initialized) return
  posthog.capture(event, properties)
}
