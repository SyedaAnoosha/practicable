/**
 * Reviews constants.
 *
 * MIN_REVIEWS_FOR_AGGREGATE is the aggregate-rating gate — below this threshold
 * the API returns `rating: null` and the card renders no rating element at all.
 * When the Nth review on an item is approved, stars appear for that item
 * with no deploy.
 *
 * The backend is the authority: `MIN_REVIEWS_FOR_AGGREGATE` in
 * `app/api/v1/content/reviews.py` applies the same gate before serialising, so
 * GET /reviews/rating already returns `rating: null` below the threshold and no
 * rating ever reaches the wire for the client to hide. This copy exists for the
 * rendering decision on counters the client already holds. If one moves, move both.
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
