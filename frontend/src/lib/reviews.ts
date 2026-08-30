/**
 * The aggregate-rating gate — below this many approved reviews the API returns
 * `rating: null` and the card shows no rating. The backend is the authority
 * (`MIN_REVIEWS_FOR_AGGREGATE` in `app/api/v1/content/reviews.py`); this copy is for
 * the rendering decision on counters the client already holds. If one moves, move both.
 */
export const MIN_REVIEWS_FOR_AGGREGATE = 8

/**
 * Compute the average rating from denormalised counters, or null if below threshold.
 */
export function computeRating(
  reviewCount: number,
  ratingSum: number,
): number | null {
  if (reviewCount < MIN_REVIEWS_FOR_AGGREGATE) return null
  return Math.round((ratingSum / reviewCount) * 10) / 10
}
