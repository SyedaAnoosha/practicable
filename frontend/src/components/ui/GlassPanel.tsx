import { forwardRef, type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils/cn'

export interface GlassPanelProps extends HTMLAttributes<HTMLDivElement> {
  /** `md` is the default card. `sm` for a chip-sized surface, `lg` for a hero panel. */
  padding?: 'sm' | 'md' | 'lg'
}

/**
 * A frosted surface that floats OVER the stage plane — the Galilee device
 * (FRAMER_MOTION_REFERENCE.md §1.1: "content floats over a rich background, rather
 * than sitting in a bordered box on a flat field").
 *
 * ⚠ Only valid on `--stage` or over the aurora. On the ivory ground the fill is a dark
 * scrim, which is not glass — it is a black box. There is no runtime guard for this
 * because a component cannot see its own backdrop; it is a placement rule.
 *
 * The fill is dark rather than the light wash REDESIGN_SUMMARY §3.3 originally
 * specified. That was changed on measurement, not preference: over the aurora's bright
 * corner a light wash drives `--stage-foreground` text to 1.43:1, whereas the dark
 * scrim holds 7.68:1 at the same point. See the `--glass-*` token comments in
 * theme.css for the full table.
 */
export const GlassPanel = forwardRef<HTMLDivElement, GlassPanelProps>(
  ({ className, padding = 'md', ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'glass rounded-xl text-stage-foreground',
        padding === 'sm' && 'p-4',
        padding === 'md' && 'p-5 sm:p-6',
        padding === 'lg' && 'p-6 sm:p-8',
        className,
      )}
      {...props}
    />
  ),
)
GlassPanel.displayName = 'GlassPanel'
