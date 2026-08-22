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
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex flex-wrap items-center gap-1.5 text-xs">
        {items.map((crumb, index) => {
          const isLast = index === items.length - 1
          return (
            <Fragment key={`${crumb.label}-${index}`}>
              <li className="flex items-center">
                {crumb.to && !isLast ? (
                  <Link
                    to={crumb.to}
                    className={cn(
                      'rounded transition-colors duration-150 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
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
                      'truncate',
                      onStage ? 'text-stage-foreground/90' : 'text-foreground',
                    )}
                  >
                    {crumb.label}
                  </span>
                )}
              </li>
              {!isLast && (
                <li aria-hidden="true" className="flex items-center">
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
