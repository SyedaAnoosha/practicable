import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export interface MetaItem {
  icon?: LucideIcon
  /** Screen-reader label for the value — "4 modules" reads as "4" alone otherwise. */
  label?: string
  value: string
  /** Mono + tabular figures. Default true: this row exists for data. */
  numeric?: boolean
}

/**
 * The icon-metadata row — the decision facts (counts, durations, level) packed onto a
 * card. Numbers set in the mono face by default (the cheapest visual differentiation in
 * the system: no layout change, no new colour).
 */
export function Meta({
  items,
  className,
  tone,
  singleLine,
}: {
  items: (MetaItem | null | undefined | false)[]
  className?: string
  /** Optional CSS colour for the icons (a domain colour). */
  tone?: string
  /** Lay the row out as a single non-wrapping line whose cells size to their content,
   * instead of a wrapping flex line. Use where the same facts appear on every card in a
   * grid: a wrapping row breaks at a different item per card and leaves a stray leading
   * hairline on line two. Cells size to content (not equal `1fr` columns, which would
   * truncate "beginner" to "be…"); separators stay evenly spaced without forcing
   * identical x-positions across cards. */
  singleLine?: boolean
}) {
  // Callers build these lists inline with && guards, so falsy entries are expected
  // rather than a mistake — filtering here keeps every call site from repeating it.
  const visible = items.filter((i): i is MetaItem => Boolean(i))
  if (visible.length === 0) return null

  if (singleLine) {
    return (
      <ul className={cn('flex items-center', className)}>
        {visible.map(({ icon: Icon, label, value, numeric = true }, index) => (
          <li
            key={`${label ?? ''}-${value}`}
            className={cn(
              'flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground',
              index > 0 && 'ml-3 border-l border-border pl-3',
            )}
          >
            {Icon && (
              <Icon
                className="size-3.5 shrink-0"
                aria-hidden="true"
                style={tone ? { color: tone } : undefined}
              />
            )}
            <span className={cn(numeric && 'font-mono tabular-nums')}>
              {value}
              {label && <span className="sr-only"> {label}</span>}
            </span>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <ul className={cn('flex flex-wrap items-center gap-x-3 gap-y-1.5', className)}>
      {visible.map(({ icon: Icon, label, value, numeric = true }, index) => (
        <li
          key={`${label ?? ''}-${value}`}
          className={cn(
            'flex items-center gap-1.5 text-xs text-muted-foreground',
            // A hairline rule before every item but the first — the DataCamp
            // separator treatment, which groups the row as one unit instead of
            // letting the items float apart.
            index > 0 && 'border-l border-border pl-3',
          )}
        >
          {Icon && (
            <Icon
              className="size-3.5 shrink-0"
              aria-hidden="true"
              style={tone ? { color: tone } : undefined}
            />
          )}
          <span className={cn(numeric && 'font-mono tabular-nums')}>
            {value}
            {label && <span className="sr-only"> {label}</span>}
          </span>
        </li>
      ))}
    </ul>
  )
}
