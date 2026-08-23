import { Fragment } from 'react'
import { Link } from 'react-router'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export interface Crumb {
  label: string
  /** Omit on the current page — the last crumb is never a link. */
  to?: string
}

/**
 * The path back to the parent (design-research §5.6).
 *
 * Coursera, Udemy and edX all carry breadcrumbs on detail pages; the audit found
 * Practicable had none anywhere, so `/courses/:slug` and `/store/packs/:slug` offered no
 * way back to their catalogue except the browser's own button.
 *
 * The current page is rendered as text with `aria-current`, not as a link to itself.
 * `on="stage"` for the dark course header.
 *
 * `[FIXED 2026-08-23]` The current-page crumb carried `truncate`, but the box it was in
 * could never be smaller than its text: a flex child defaults to `min-width: auto`, and
 * neither the `<li>` nor this `<span>` opted out. `overflow: hidden` therefore had
 * nothing to hide and the crumb rendered at full intrinsic width. A 140-character
 * template title pushed `document.scrollWidth` to 806px inside a 375px viewport — the
 * whole page scrolled sideways. Every ancestor in the chain now sets `min-w-0`, and the
 * crumb is capped so a long title yields the row rather than owning it.
 */
export function Breadcrumb({
  items,
  on = 'page',
  className,
}: {
  items: Crumb[]
  on?: 'page' | 'stage'
  className?: string
}) {
  if (items.length === 0) return null
  const onStage = on === 'stage'

  return (
    <nav aria-label="Breadcrumb" className={cn('min-w-0 max-w-full', className)}>
      <ol className="flex min-w-0 max-w-full flex-wrap items-center gap-1.5 text-xs">
        {items.map((crumb, index) => {
          const isLast = index === items.length - 1
          return (
            <Fragment key={`${crumb.label}-${index}`}>
              <li className="flex min-w-0 items-center">
                {crumb.to && !isLast ? (
                  <Link
                    to={crumb.to}
                    className={cn(
                      'max-w-[16rem] truncate rounded transition-colors duration-150 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                      onStage
                        ? 'text-stage-foreground/70 hover:text-stage-foreground'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span
                    aria-current={isLast ? 'page' : undefined}
                    className={cn(
                      'min-w-0 truncate',
                      onStage ? 'text-stage-foreground/90' : 'text-foreground',
                    )}
                  >
                    {crumb.label}
                  </span>
                )}
              </li>
              {!isLast && (
                <li aria-hidden="true" className="flex shrink-0 items-center">
                  <ChevronRight
                    className={cn(
                      'size-3',
                      onStage ? 'text-stage-foreground/40' : 'text-muted-foreground/60',
                    )}
                  />
                </li>
              )}
            </Fragment>
          )
        })}
      </ol>
    </nav>
  )
}
