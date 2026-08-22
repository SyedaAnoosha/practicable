import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export interface Stat {
  icon?: LucideIcon
  value: string | number
  label: string
}

/**
 * A row of compact number+label tiles (design-research §2 Skillshare, §5).
 *
 * Skillshare's homepage is the length anti-pattern in the research — 8397px of
 * single-idea slabs — but one block in it is genuinely good: four bordered tiles on a
 * dark ground carrying "425k+ members / 30k+ classes / 9k+ teachers / 4.8★", roughly
 * 100px for four credibility facts. The research §6 note on trust is that specificity is
 * the mechanism: an exact count reads as verifiable in a way a claim does not.
 *
 * Practicable's numbers are real and already counted from the API rather than written
 * down (Dashboard.tsx has a standing comment about a hand-maintained count going stale
 * twice). This renders them; it never invents them — a caller with nothing to show
 * passes an empty list and gets nothing.
 *
 * `on="stage"` puts the row on the dark plane, where the same content reads as a
 * deliberate composition rather than another card. Stage tokens and alphas of them
 * only — never `--primary` or `--card`, which invert between themes (§7.6).
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
          <dd
            className={cn(
              'font-mono text-stat font-semibold tabular-nums',
              onStage ? 'text-stage-foreground' : 'text-foreground',
            )}
          >
            {value}
          </dd>
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
