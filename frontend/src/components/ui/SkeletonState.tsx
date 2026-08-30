import { cn } from '@/lib/utils/cn'

/**
 * A loading skeleton that matches the real layout's dimensions so nothing shifts when
 * data arrives (DESIGN.md §40.2).
 *
 * Delay rule: if a load resolves in under 200ms, show nothing. Consumers handle this
 * by conditionally rendering SkeletonState only after a timeout — the component itself
 * is always instant.
 *
 * `animate-pulse` is the standard Tailwind pulse, collapsed to instant state changes
 * by the global `prefers-reduced-motion` rule in theme.css.
 */
export function SkeletonState({ className, rows = 3, variant = 'card' }: {
  className?: string
  /** Number of skeleton rows/cards to render. */
  rows?: number
  /** The shape of the skeleton — 'card' for catalogue items, 'text' for prose,
   * 'stat' for a stat row, 'row' for a list row. */
  variant?: 'card' | 'text' | 'stat' | 'row'
}) {
  return (
    <div className={cn('animate-pulse', className)} role="status" aria-label="Loading">
      <span className="sr-only">Loading…</span>
      {variant === 'card' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="h-32 bg-muted/40" />
              <div className="p-5">
                <div className="h-3 w-16 rounded bg-muted/60" />
                <div className="mt-3 h-4 w-3/4 rounded bg-muted/40" />
                <div className="mt-2 h-3 w-full rounded bg-muted/30" />
                <div className="mt-2 h-3 w-2/3 rounded bg-muted/30" />
              </div>
            </div>
          ))}
        </div>
      )}
      {variant === 'text' && (
        <div className="space-y-3">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="h-4 rounded bg-muted/40" style={{ width: `${85 - i * 12}%` }} />
          ))}
        </div>
      )}
      {variant === 'stat' && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: rows || 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4">
              <div className="h-3 w-12 rounded bg-muted/40" />
              <div className="mt-2 h-6 w-16 rounded bg-muted/60" />
              <div className="mt-1 h-3 w-20 rounded bg-muted/30" />
            </div>
          ))}
        </div>
      )}
      {variant === 'row' && (
        <div className="divide-y divide-border">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-4">
              <div className="size-9 shrink-0 rounded-md bg-muted/40" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-3/4 rounded bg-muted/40" />
                <div className="h-3 w-1/2 rounded bg-muted/30" />
              </div>
              <div className="h-4 w-16 shrink-0 rounded bg-muted/30" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
