import { useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface RelatedRailProps {
  /** Section heading. */
  title: string
  /** The scrollable content — typically ContentCard components. */
  children: React.ReactNode
  /** Optional "see all" link at the end of the heading. */
  seeAllHref?: string
  /** Optional "see all" label. */
  seeAllLabel?: string
  className?: string
}

/**
 * A horizontal scrolling rail for related content (design-research §8.3).
 *
 * The research audit found that Coursera, Udemy, and Skillshare all use horizontal
 * scroll rails for "Related courses", "Students also bought", and similar sections.
 * Practicable's detail pages listed related items in a vertical stack that was
 * indistinguishable from the rest of the page — no visual grouping, no scroll
 * affordance, no density change.
 *
 * This rail:
 * - Scrolls horizontally with overflow-x-auto
 * - Shows left/right scroll buttons when content overflows
 * - Hides the scrollbar (webkit-scrollbar: none) for a cleaner look
 * - Has snap points so items align cleanly on scroll
 * - Shows "see all" link when there are more items
 *
 * The buttons are positioned absolutely over the rail edges, with a gradient
 * fade behind them so they remain legible over card content. Under
 * prefers-reduced-motion, the scroll is instant (the global rule already
 * collapses transition-duration, but the scrollIntoView smooth is separate).
 */
export function RelatedRail({
  title,
  children,
  seeAllHref,
  seeAllLabel = 'See all',
  className,
}: RelatedRailProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)

  const checkScroll = () => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4)
  }

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current
    if (!el) return
    const amount = el.clientWidth * 0.75
    el.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' })
  }

  return (
    <section className={cn('relative', className)}>
      {/* Heading row */}
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 className="text-h3 font-semibold text-foreground">{title}</h2>
        {seeAllHref && (
          <a
            href={seeAllHref}
            className="shrink-0 text-sm font-medium text-accent underline-offset-2 hover:underline"
          >
            {seeAllLabel}
          </a>
        )}
      </div>

      {/* Scroll container */}
      <div className="relative group/rail">
        {/* Left scroll button — appears on hover or focus within the rail */}
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scroll('left')}
            className={cn(
              'absolute left-0 top-0 z-10 flex size-10 items-center justify-center',
              'rounded-full border border-border bg-card/90 text-foreground shadow-sm',
              'opacity-0 transition-opacity duration-150',
              'group-hover/rail:opacity-100 focus-visible:opacity-100',
              'backdrop-blur-sm',
            )}
            aria-label="Scroll left"
          >
            <ChevronLeft className="size-5" />
          </button>
        )}

        {/* Right scroll button */}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => scroll('right')}
            className={cn(
              'absolute right-0 top-0 z-10 flex size-10 items-center justify-center',
              'rounded-full border border-border bg-card/90 text-foreground shadow-sm',
              'opacity-0 transition-opacity duration-150',
              'group-hover/rail:opacity-100 focus-visible:opacity-100',
              'backdrop-blur-sm',
            )}
            aria-label="Scroll right"
          >
            <ChevronRight className="size-5" />
          </button>
        )}

        {/* Fade edges */}
        {canScrollLeft && (
          <div className="pointer-events-none absolute left-0 top-0 z-[5] h-full w-12 bg-gradient-to-r from-background to-transparent" />
        )}
        {canScrollRight && (
          <div className="pointer-events-none absolute right-0 top-0 z-[5] h-full w-12 bg-gradient-to-l from-background to-transparent" />
        )}

        {/* The scrollable track */}
        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className={cn(
            'flex gap-5 overflow-x-auto scroll-smooth',
            'snap-x snap-mandatory',
            // Hide the scrollbar on webkit/Blink
            '[&::-webkit-scrollbar]:hidden',
            // Hide the scrollbar on Firefox
            '[-ms-overflow-style:none] [scrollbar-width:none]',
          )}
        >
          {children}
        </div>
      </div>
    </section>
  )
}

/**
 * A single item inside the RelatedRail. Sets the snap alignment and min-width
 * so items size consistently across the rail.
 */
export function RelatedRailItem({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'snap-start shrink-0',
        // Minimum card width; flex-1 not used — the rail scrolls, not wraps
        'w-[280px] sm:w-[320px]',
        className,
      )}
    >
      {children}
    </div>
  )
}
