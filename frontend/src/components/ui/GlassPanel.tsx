import { forwardRef, type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils/cn'

export interface GlassPanelProps extends HTMLAttributes<HTMLDivElement> {
  /** `md` is the default card. `sm` for a chip-sized surface, `lg` for a hero panel. */
  padding?: 'sm' | 'md' | 'lg'
}

/**
 * A frosted surface that floats OVER the stage plane: content floats over a rich
 * background, rather than sitting in a bordered box on a flat field.
 *
 * ⚠ Only valid on `--stage` or over the aurora — on the ivory ground the dark fill is
 * a black box, not glass. A placement rule with no runtime guard (a component can't see
 * its own backdrop).
 *
 * The fill is a dark scrim, not a light wash: over the aurora's bright corner a light
 * wash drives `--stage-foreground` text to 1.43:1 where the scrim holds 7.68:1. See the
 * `--glass-*` token comments in theme.css.
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
