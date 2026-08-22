import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

/**
 * Prose truncation with an expander (design-research §4 "best patterns", Udemy/edX).
 *
 * Both Udemy and edX clamp a long description to a few lines behind a "Show more"
 * link — a long description costs four lines of the page instead of forty, and the
 * reader chooses. This is the §15A discipline applied to text rather than to sections.
 *
 * Uses line-clamp rather than slicing the string: the full text stays in the DOM, so
 * find-in-page and screen readers reach all of it, and nothing depends on guessing where
 * a character count lands mid-word. `aria-expanded` on the control describes the state.
 */
export function ShowMore({
  children,
  lines = 5,
  className,
  moreLabel = 'Show more',
  lessLabel = 'Show less',
}: {
  children: ReactNode
  /** Lines shown when collapsed. Tailwind ships line-clamp-1..6. */
  lines?: 3 | 4 | 5 | 6
  className?: string
  moreLabel?: string
  lessLabel?: string
}) {
  const [expanded, setExpanded] = useState(false)

  const clamp = {
    3: 'line-clamp-3',
    4: 'line-clamp-4',
    5: 'line-clamp-5',
    6: 'line-clamp-6',
  }[lines]

  return (
    <div className={className}>
      <div className={cn(!expanded && clamp)}>{children}</div>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
        className="mt-2 rounded text-sm font-medium text-accent transition-colors duration-150 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {expanded ? lessLabel : moreLabel}
      </button>
    </div>
  )
}
