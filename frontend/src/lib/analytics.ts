import posthog from 'posthog-js'

/** The PostHog wrapper, typed against a small, deliberate event schema.
 *
 * No event property carries anything beyond a user id, ever — no email, no name, no
 * free-text search query, no message body. Do Not Track is honoured: if the browser
 * sends it, `init()` never loads the PostHog script at all.
 *
 * Six client-side events are tracked here; four server-side events
 * (`purchase_completed`, `entitlement_delay`, `download_failed`, `refund_issued`) are
 * tracked from the backend instead. `checkout_completed`/`checkout_abandoned` are
 * dropped as redundant with `purchase_completed` and the gap PostHog already shows
 * between `checkout_started` and it; lesson start/complete are dropped because that
 * question is already answerable from `lesson_progress` rows in the database.
 */

type ContentType = 'question' | 'course' | 'template' | 'pack'

interface AnalyticsEvents {
  content_viewed: { type: ContentType; slug: string }
  filter_applied: { dimension: string; value: string }
  // `source` matches whatever string `useEmailGate(source)` was called with. Left as
  // an open string rather than a union so a second gate needs no edit here to stay typed.
  email_gate_shown: { source: string }
  email_captured: { source: string }
  // week3_plan.md W3-R11 — a cart checkout fires the same event with `cart_size > 1`
  // and `product_slug` joined by comma, rather than a second event name: it is still
  // the same funnel step PostHog measures the gap to `purchase_completed` from.
  checkout_started: { product_slug: string; price: number; cart_size?: number }
  // week4_plan.md Phase 4 step 4 — a routed recommendation was clicked, linking
  // the source question to the product it surfaced. §22's own claim is measurable
  // rather than asserted.
  recommendation_clicked: { question_slug: string; product_slug: string }
}

let initialized = false

function doNotTrackRequested(): boolean {
  // Three different places browsers have put this over the years.
  const dnt = navigator.doNotTrack ?? (window as unknown as { doNotTrack?: string }).doNotTrack
  return dnt === '1' || dnt === 'yes'
}

/** Call once, at app start. No-ops if the project key isn't configured or the visitor
 * has Do Not Track set — in the DNT case, the PostHog script never loads at all. */
export function initAnalytics() {
  if (initialized) return
  const key = import.meta.env.VITE_POSTHOG_KEY
  if (!key || doNotTrackRequested()) return

  posthog.init(key, {
    api_host: import.meta.env.VITE_POSTHOG_HOST ?? 'https://us.i.posthog.com',
    // Route changes are captured ourselves (`trackPageview`, from RootLayout), not
    // via PostHog's history-API autocapture.
    capture_pageview: false,
    // Autocapture would record every click's DOM text/attributes by default — this
    // file's deliberate event discipline applies to what PostHog auto-collects too.
    autocapture: false,
  })
  initialized = true
}

/** Associates future events with a real user id — never an email or name. Call on
 * sign-in; anonymous visitors keep PostHog's own anonymous distinct id. */
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
