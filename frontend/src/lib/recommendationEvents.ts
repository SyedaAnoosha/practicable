/**
 * Recommendation-click recording — server-side, so the admin metrics page works with no
 * PostHog key.
 *
 * NOT debounced (unlike `filterEvents.ts`): a click happens once and is immediately
 * followed by a navigation, so a debounce would drop the event. Failure is silent and
 * never blocks the navigation.
 */
import { api } from '@/lib/api/client'

/** `RoutedProducts` sits on a question page; `SituationProducts` sits on a
 * filtered catalogue. Kept distinct because a click from a question the reader is
 * actually reading and a click from a filter result set are different signals, and
 * averaging them would hide which one works. */
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
