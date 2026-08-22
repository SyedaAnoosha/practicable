import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils/cn'

/**
 * The progress track — extracted from Library.tsx so the dashboard, the library and the
 * course pages cannot drift apart (design-research §7 finding 7).
 *
 * The audit found Library.tsx had a genuinely good progress bar — animated fill,
 * `role="progressbar"` with real values, a live "N of M" line — and that the Dashboard,
 * the page a member sees most, imported neither it nor anything like it. Every
 * competitor's signed-in home leads with resume state; Practicable's led with a search
 * box.
 *
 * The fill animates from 0 on mount rather than snapping to its value: unknown progress
 * becoming known progress. Plays once per mount, and collapses to an instant state
 * change under prefers-reduced-motion via theme.css's global rule.
 *
 * `role="progressbar"` with aria-valuenow is not optional here — the percentage is
 * meaning-bearing, and the visual bar alone carries it for nobody using a screen reader.
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
