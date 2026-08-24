/**
 * StarRating (W5-R4 Stage B) — the read-only aggregate shown on catalogue cards and
 * product pages.
 *
 * Renders nothing when `rating` is null. That is the whole Stage B gate: the API
 * returns null below `MIN_REVIEWS_FOR_AGGREGATE`, and "a handful of reviews" and "no
 * reviews" are deliberately indistinguishable to a visitor — a 5.0 from two people is
 * not evidence, and showing it would be the kind of thin social proof §2.4 exists to
 * avoid. Callers pass the field straight through and do not need the threshold.
 *
 * Not to be confused with the interactive picker inside `ReviewForm` — that one is a
 * group of buttons that sets a value. This is a static readout, so it renders as a
 * single labelled element rather than five focusable things a keyboard user must tab
 * through on every card.
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
  const label =
    reviewCount != null
      ? `Rated ${rating} out of 5 from ${reviewCount} ${reviewCount === 1 ? 'review' : 'reviews'}`
      : `Rated ${rating} out of 5`

  return (
    <span
      className={cn('inline-flex items-center gap-1', textSize, className)}
      role="img"
      aria-label={label}
    >
      <Star className={cn(starSize, 'fill-warning text-warning')} aria-hidden="true" />
      <span className="font-medium tabular-nums text-foreground">{rating.toFixed(1)}</span>
      {reviewCount != null && (
        <span className="tabular-nums text-muted-foreground">({reviewCount})</span>
      )}
    </span>
  )
}
