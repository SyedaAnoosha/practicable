import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

export interface PillEyebrowProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode
  /** `stage` for use on the dark plane, `ground` on ivory. */
  tone?: 'ground' | 'stage'
}

/**
 * A bordered lozenge section label — present in all nine Framer references
 * (FRAMER_MOTION_REFERENCE.md §1.5).
 *
 * This is the enclosed sibling of the existing `.eyebrow` device in theme.css, not a
 * replacement for it: `.eyebrow` (mono, tracked, with a leading hairline rule) stays
 * the default for section openers on the ivory ground. `PillEyebrow` is for a label
 * that has to hold its own over a graphic, where a hairline rule disappears.
 *
 * Presentational only — never the sole heading for a section. The real `SectionHeading`
 * still carries the semantic level.
 */
export function PillEyebrow({ children, tone = 'ground', className, ...props }: PillEyebrowProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-3 py-1',
        'font-mono text-xs font-medium uppercase leading-none tracking-[0.16em]',
        tone === 'ground' && 'border-border-strong text-muted-foreground',
        // On the stage the border carries the shape and the text must stay legible
        // against the aurora, so it runs at full strength rather than muted.
        tone === 'stage' && 'border-stage-foreground/30 text-stage-foreground/80',
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}
