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
 * The path back to the parent. The current page is text with `aria-current`, not a
 * self-link; `on="stage"` for the dark course header.
 *
 * Every ancestor sets `min-w-0` and the current-page crumb is capped: without it a flex
 * child's `min-width: auto` means `truncate` has nothing to hide, so a long title
 * renders at full width and scrolls the page sideways.
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
