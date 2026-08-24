/**
 * Testimonial component (W5-R4 Stage A).
 *
 * Renders ``is_featured`` approved reviews as named quotes with no star
 * aggregate. The aggregate is gated behind MIN_REVIEWS_FOR_AGGREGATE (Stage B)
 * and rendered separately on catalogue cards.
 */
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface Review {
  id: string
  rating: number
  body: string | null
  display_name: string | null
}

interface TestimonialProps {
  review: Review
  /** When provided, shows a rating badge alongside the quote (Stage B) */
  aggregateRating?: number | null
  aggregateCount?: number
  className?: string
}

export function Testimonial({
  review,
  aggregateRating,
  aggregateCount,
  className,
}: TestimonialProps) {
  if (!review.body) return null

  return (
    <blockquote
      className={cn(
        'relative rounded-lg border border-border bg-card p-5',
        className,
      )}
    >
      {/* Gold accent bar — matches the stage-aurora gold used elsewhere */}
      <div
        aria-hidden="true"
        className="absolute left-0 top-0 h-full w-1 rounded-l-lg bg-gold"
      />

      <p className="text-sm leading-relaxed text-foreground">
        &ldquo;{review.body}&rdquo;
      </p>

      <footer className="mt-3 flex items-center justify-between">
        <cite className="text-xs not-italic text-muted-foreground">
          {review.display_name ?? 'Anonymous'}
        </cite>

        {/* Stage B: rating badge — only shown when aggregateRating is non-null */}
        {aggregateRating != null && aggregateCount != null && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Star className="size-3 fill-gold text-gold" aria-hidden="true" />
            <span className="font-medium text-foreground">
              {aggregateRating.toFixed(1)}
            </span>
            <span>({aggregateCount})</span>
          </span>
        )}
      </footer>
    </blockquote>
  )
}

/**
 * Renders a set of featured testimonials for a content item.
 */
export function TestimonialSection({
  reviews,
  aggregateRating,
  aggregateCount,
}: {
  reviews: Review[]
  aggregateRating?: number | null
  aggregateCount?: number
}) {
  if (reviews.length === 0) return null

  return (
    <section aria-label="Testimonials" className="mt-8">
      <h2 className="text-sm font-medium text-foreground">
        What learners say
      </h2>
      <div className="mt-4 flex flex-col gap-3">
        {reviews.map((review) => (
          <Testimonial
            key={review.id}
            review={review}
            aggregateRating={aggregateRating}
            aggregateCount={aggregateCount}
          />
        ))}
      </div>
    </section>
  )
}
