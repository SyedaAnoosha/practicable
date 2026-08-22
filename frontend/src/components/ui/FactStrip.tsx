import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export interface Fact {
  icon: LucideIcon
  /** The quiet label above the value — "Format", "Length", "Level". */
  label: string
  /** The value itself. Set in mono when `numeric`, since a figure that carries a
   *  decision is data (see theme.css's note on --font-mono). */
  value: string
  /** One line of context under the value, edX-style ("No prior experience required").
   *  Optional — omit rather than pad, an absent explainer is better than a filler one. */
  hint?: string
  /** Renders the value in the mono face with tabular figures. Use for counts,
   *  durations, percentages, sizes — anything a reader might compare across cards. */
  numeric?: boolean
}

/**
 * The fact strip — the single highest-value pattern found in the platform research
 * (design-research/PLATFORM_UI_UX_RESEARCH.md §1, §5.4).
 *
 * Every serious learning platform puts 3–5 decision criteria in one horizontal row
 * directly under the title: edX renders it as a bordered card (the cleanest execution,
 * and the model here), Coursera as a panel overlapping the hero, Udemy as an inline
 * metadata line. The audit found Practicable had the same data — author, module count,
 * lesson count, access model — rendered as a single run-on line of 14px muted text
 * (`CourseDetail.tsx`, before this pass). Four purchase-decision facts styled as a
 * footnote.
 *
 * Layout is a grid rather than flex so the cells align into columns down the strip
 * regardless of value length, and the dividers land on the grid lines. Two columns on
 * mobile (a 4-fact strip becomes 2×2 rather than a 4-deep stack), then N across from
 * `sm`.
 */
export function FactStrip({
  facts,
  className,
  tone,
}: {
  facts: Fact[]
  className?: string
  /** Optional CSS colour for the icons — a question or course passes its domain
   *  colour so the strip carries the same identity as the card it came from. */
  tone?: string
}) {
  if (facts.length === 0) return null

  return (
    <dl
      className={cn(
        'grid grid-cols-2 overflow-hidden rounded-xl border border-border bg-card',
        facts.length === 3 && 'sm:grid-cols-3',
        facts.length === 4 && 'sm:grid-cols-4',
        facts.length >= 5 && 'sm:grid-cols-5',
        className,
      )}
    >
      {facts.map(({ icon: Icon, label, value, hint, numeric }) => (
        <div
          key={label}
          // Hairlines drawn per-cell rather than with divide-x, which can't express
          // "no left border on the first cell of each row" once the grid wraps.
          className="flex flex-col gap-1 border-border p-4 [&:not(:nth-child(2n+1))]:border-l sm:[&:not(:first-child)]:border-l sm:[&:nth-child(2n+1)]:border-l-0 sm:[&:not(:first-child)]:border-l"
        >
          <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Icon
              className="size-3.5 shrink-0"
              aria-hidden="true"
              style={tone ? { color: tone } : undefined}
            />
            {label}
          </dt>
          <dd
            className={cn(
              'text-sm font-semibold text-foreground',
              numeric && 'font-mono tabular-nums',
            )}
          >
            {value}
          </dd>
          {hint && <p className="text-xs leading-snug text-muted-foreground">{hint}</p>}
        </div>
      ))}
    </dl>
  )
}
