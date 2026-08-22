/**
 * Recommendation-click recording — week4_plan.md W4-R4 item 6, ledger row 29.
 *
 * §22 claims that routing a reader from a question to a product helps them. This makes
 * that claim measurable instead of asserted, and it does so server-side so the admin
 * metrics page keeps answering with no PostHog project key set (the W4-R10 amendment's
 * whole point).
 *
 * Deliberately NOT debounced, unlike `filterEvents.ts`. A filter is dragged through
 * five values and only the settled one is interesting; a recommendation click happens
 * once and is immediately followed by a navigation, so a 500ms debounce would drop the
 * very event it was meant to record.
 *
 * Failure is silent and never blocks the navigation: the reader asked to go somewhere,
 * and a metrics write has no business standing in the way of that.
 */
import { api } from '@/lib/api/client'

/** §20.5 `RoutedProducts` sits on a question page; §20.6 `SituationProducts` sits on a
 *  filtered catalogue. Kept distinct because a click from a question the reader is
 *  actually reading and a click from a filter result set are different signals, and
 *  averaging them would hide which one works. */
export type RecommendationSurface = 'question' | 'catalogue'

interface RecommendationClick {
  surface: RecommendationSurface
  productSlug: string
  /** Absent on the catalogue surface, which routes from a filter set, not one question. */
  questionSlug?: string
}

export function recordRecommendationClick({
  surface,
  productSlug,
  questionSlug,
}: RecommendationClick): void {
  // Fire-and-forget. The `.catch` is the contract, not defensive noise: without it an
  // unhandled rejection surfaces in the console on every offline click.
  api
    .post('/recommendation-events', {
      surface,
      product_slug: productSlug,
      ...(questionSlug ? { question_slug: questionSlug } : {}),
    })
    .catch(() => {
      /* Swallowed by design — never cost the reader their click. */
    })
}
