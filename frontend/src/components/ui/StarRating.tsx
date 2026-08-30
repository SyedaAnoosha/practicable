/**
 * The read-only rating aggregate on catalogue cards and product pages. Renders nothing
 * when `rating` is null — the API returns null below `MIN_REVIEWS_FOR_AGGREGATE`, so
 * "a handful of reviews" and "no reviews" look the same to a visitor.
 *
 * A static readout (one labelled element), not the interactive button-group picker in
 * `ReviewForm`.
 */
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface StarRatingProps {
  /** The aggregate, or null below the display threshold — null renders nothing. */
  rating: number | null | undefined
  /** Shown in parentheses and in the accessible name, so the score carries its weight. */
  reviewCount?: number
  /** `sm` for catalogue cards, `md` for a product page's header. */
  size?: 'sm' | 'md'
  className?: string
}

export function StarRating({ rating, reviewCount, size = 'sm', className }: StarRatingProps) {
  if (rating == null) return null

  const starSize = size === 'sm' ? 'size-3.5' : 'size-4'
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm'

  // One accessible name for the whole control. Five separate star nodes would be read
  // out as five things, and a partially-filled star has no meaning read aloud at all.
  // `toFixed` here too: the label must say what the eye sees. A raw `5` spoken
  // against a visible "5.0" is the same value described two ways, and the mismatch is
  // exactly what makes an accessible name feel like a separate, less-maintained string.
  const shownRating = rating.toFixed(1)
  const label =
    reviewCount != null
      ? `Rated ${shownRating} out of 5 from ${reviewCount} ${reviewCount === 1 ? 'review' : 'reviews'}`
      : `Rated ${shownRating} out of 5`

  return (
    <span
      className={cn('inline-flex items-center gap-1', textSize, className)}
      role="img"
      aria-label={label}
    >
      <Star className={cn(starSize, 'fill-warning text-warning')} aria-hidden="true" />
      <span className="font-medium tabular-nums text-foreground">{shownRating}</span>
      {reviewCount != null && (
        <span className="tabular-nums text-muted-foreground">({reviewCount})</span>
      )}
    </span>
  )
}
