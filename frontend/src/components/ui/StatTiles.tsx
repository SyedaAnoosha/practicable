import { useEffect, useRef } from 'react'
import { useInView } from 'motion/react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useCountUp } from '@/lib/motion'

export interface Stat {
  icon?: LucideIcon
  value: string | number
  label: string
}

/**
 * A row of compact number+label tiles — exact counts (which read as verifiable) packed
 * into ~100px. Renders the numbers it's given, never invents them: a caller with
 * nothing to show passes an empty list and gets nothing.
 *
 * `on="stage"` puts the row on the dark plane. Stage tokens only there — never
 * `--primary`/`--card`, which invert between themes.
 */
export function StatTiles({
  stats,
  on = 'page',
  className,
}: {
  stats: Stat[]
  on?: 'page' | 'stage'
  className?: string
}) {
  if (stats.length === 0) return null
  const onStage = on === 'stage'

  return (
    <dl
      className={cn(
        'grid grid-cols-2 gap-3',
        stats.length === 3 && 'sm:grid-cols-3',
        stats.length >= 4 && 'sm:grid-cols-4',
        className,
      )}
    >
      {stats.map(({ icon: Icon, value, label }) => (
        <div
          key={label}
          className={cn(
            'flex flex-col gap-1 rounded-xl border p-4',
            onStage
              ? 'border-stage-foreground/15 bg-stage-foreground/5'
              : 'border-border bg-card',
          )}
        >
          {Icon && (
            <Icon
              className={cn(
                'mb-0.5 size-4 shrink-0',
                onStage ? 'text-gold' : 'text-gold-strong',
              )}
              aria-hidden="true"
            />
          )}
          {/* --text-stat, mono, tabular — the figure is the point of the tile. */}
          <StatValue value={value} onStage={onStage} />
          <dt
            className={cn(
              'text-xs',
              onStage ? 'text-stage-foreground/70' : 'text-muted-foreground',
            )}
          >
            {label}
          </dt>
        </div>
      ))}
    </dl>
  )
}

/**
 * The figure, counting up once when the tile first enters view.
 *
 * Only NUMERIC values animate. A string value ("Free", "v1.2") renders as-is rather
 * than being coerced — counting a string to a number would either print NaN or invent
 * a figure, and `useCountUp` is deliberately incapable of counting to a value the
 * caller did not supply (principle 7).
 *
 * `tabular-nums` is what stops the tile jittering while the digits change; without it
 * the label below would shift on every frame.
 */
function StatValue({ value, onStage }: { value: string | number; onStage: boolean }) {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.5 })
  const numeric = typeof value === 'number' ? value : null
  const { display, begin } = useCountUp(numeric)

  useEffect(() => {
    if (inView) begin()
    // `begin` is a fresh closure each render; depending on it would re-fire the count.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView])

  return (
    <dd
      ref={ref}
      className={cn(
        'font-mono text-stat font-semibold tabular-nums',
        onStage ? 'text-stage-foreground' : 'text-foreground',
      )}
    >
      {numeric === null ? value : (display ?? value)}
    </dd>
  )
}
