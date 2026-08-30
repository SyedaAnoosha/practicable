import { cn } from '@/lib/utils/cn'

export interface OutlineWordProps {
  children: string
  className?: string
  /** `stage` strokes in the stage foreground; `ground` in the page ink. */
  tone?: 'ground' | 'stage'
}

/**
 * An oversized outlined word sitting BEHIND real content.
 *
 * Purely decorative and always `aria-hidden`. It must never be the only place a word
 * appears on the page: a screen reader will not read it, and neither will anyone who
 * turns off the stroke. Treat it as texture that happens to be legible.
 *
 * `select-none` because a stray triple-click selecting a giant background word is a
 * confusing interaction with no purpose.
 */
export function OutlineWord({ children, className, tone = 'stage' }: OutlineWordProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'pointer-events-none select-none whitespace-nowrap font-sans font-semibold uppercase',
        'text-outline text-transparent',
        className,
      )}
      style={{
        // -webkit-text-stroke has no standard longhand with real support; it is the
        // only reliable way to get an outline face without shipping a second font.
        WebkitTextStroke: `1.5px ${
          tone === 'stage'
            ? 'color-mix(in srgb, var(--stage-foreground) 14%, transparent)'
            : 'color-mix(in srgb, var(--foreground) 10%, transparent)'
        }`,
      }}
    >
      {children}
    </span>
  )
}
