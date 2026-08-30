import type { HTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils/cn'

// Semantic mapping only, never decorative colour (DESIGN.md §33/§7.6): "outline" for
// ROI horizon, "accent" for regulator pressure (the one emphasised dimension), "muted"
// for everything else. Colour is never the only signal — every badge carries text.
const badgeVariants = cva('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium', {
  variants: {
    variant: {
      muted: 'bg-muted text-muted-foreground',
      secondary: 'bg-secondary text-secondary-foreground',
      accent: 'bg-accent text-accent-foreground',
      outline: 'border border-primary text-primary',
      success: 'bg-success text-success-foreground',
      warning: 'bg-warning text-warning-foreground',
      destructive: 'bg-destructive text-destructive-foreground',
      /* For badges on the stage plane or on glass. Every variant
         above is measured against the IVORY planes and several are unreadable on a
         dark scrim — `outline` is `text-primary` (#10213E), which lands at 1.16:1 on
         glass over the aurora. Measured for this variant: stage-foreground on a
         stage-foreground/12 chip over the glass composite is 8.8:1 at the aurora's
         mid-ramp, its realistic worst case.

         Colour still carries no meaning here (§33) — the dimension is in the text, as
         with every other badge. This variant exists so the plane does not silently
         destroy the label. */
      stage: 'bg-stage-foreground/12 text-stage-foreground/90 ring-1 ring-inset ring-stage-foreground/20',
    },
  },
  defaultVariants: { variant: 'muted' },
})

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export const Badge = ({ className, variant, ...props }: BadgeProps) => (
  <span className={cn(badgeVariants({ variant }), className)} {...props} />
)
