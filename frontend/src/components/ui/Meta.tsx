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
 * The icon-metadata row (design-research §5.4 M5, "metadata richness").
 *
 * The research finding was that valuable-feeling cards answer the decision question on
 * the card — DataCamp fits seven facts in ~150px, Udemy eight in ~330px — while
 * Practicable's course and template cards carried two or three, styled identically to
 * the body text around them. This is the row that fixes that.
 *
 * Numbers set in the mono face by default. theme.css chose Azeret Mono because it
 * "reads as data because it was chosen, not because it was the default mono", and then
 * used it only for the eyebrow. Spending it on counts and durations is the cheapest
 * visual differentiation available in the system — no layout change, no new colour.
 */
export function Meta({
  items,
  className,
  tone,
}: {
  items: (MetaItem | null | undefined | false)[]
  className?: string
  /** Optional CSS colour for the icons (a domain colour). */
  tone?: string
}) {
  // Callers build these lists inline with && guards, so falsy entries are expected
  // rather than a mistake — filtering here keeps every call site from repeating it.
  const visible = items.filter((i): i is MetaItem => Boolean(i))
  if (visible.length === 0) return null

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
