import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils/cn'

/**
 * The progress track — shared by the dashboard, the library and the course pages so
 * they can't drift apart.
 *
 * The fill animates from 0 on mount (once per mount; instant under
 * prefers-reduced-motion). `role="progressbar"` with `aria-valuenow` is required — the
 * percentage is meaning-bearing and the visual bar alone doesn't carry it.
 */
export function ProgressBar({
  value,
  label,
  caption,
  showPercent = true,
  size = 'md',
  className,
}: {
  /** 0–100. Clamped, because a bad server value should not paint outside the track. */
  value: number
  /** Accessible name — "Risk Register Fundamentals progress". */
  label: string
  /** Left-hand caption, e.g. "6 of 14 lessons". */
  caption?: string
  showPercent?: boolean
  size?: 'sm' | 'md'
  className?: string
}) {
  const target = Math.max(0, Math.min(100, Math.round(value)))
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const frame = requestAnimationFrame(() => setWidth(target))
    return () => cancelAnimationFrame(frame)
  }, [target])

  return (
    <div className={className}>
      {(caption || showPercent) && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          {caption ? <span>{caption}</span> : <span />}
          {showPercent && <span className="font-mono tabular-nums">{target}%</span>}
        </div>
      )}
      <div
        className={cn(
          'mt-1.5 w-full overflow-hidden rounded-full bg-secondary',
          size === 'sm' ? 'h-1' : 'h-1.5',
        )}
        role="progressbar"
        aria-valuenow={target}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className="h-full rounded-full bg-gradient-brand transition-[width] duration-[400ms] ease-[var(--ease-entrance)]"
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  )
}
