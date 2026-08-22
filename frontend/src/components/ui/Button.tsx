import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { ArrowRight, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 font-sans font-medium',
    'transition-[color,background-color,border-color,box-shadow,transform] duration-150',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
    'disabled:pointer-events-none disabled:opacity-50',
  ].join(' '),
  {
    variants: {
      variant: {
        // The primary action is the brand moment: midnight navy with a faint
        // cream inner edge (the engraving), a warm resting shadow, and a 1px
        // lift + deepened shadow on hover — tactile, never bouncy (§39.2).
        primary: 'bg-gradient-brand text-primary-foreground shadow-sm ring-1 ring-inset ring-primary-edge hover:-translate-y-px hover:shadow-md',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary-strong',
        outline: 'border border-border bg-background hover:border-border-strong hover:bg-muted',
        ghost: 'bg-transparent text-foreground hover:bg-muted',
        destructive: 'bg-destructive text-destructive-foreground hover:opacity-90',
        /* `[ADDED 2026-08-22]` The dark pill CTA — Parley, Galilee and FintechX all
           use it (FRAMER_MOTION_REFERENCE.md §1.5). Fully rounded, and paired with
           `<PillArrow/>` for the circular arrow chip that nudges on hover. The lift is
           the same 1px as `primary` so the two do not feel like different products. */
        pill: 'rounded-full bg-primary text-primary-foreground shadow-sm ring-1 ring-inset ring-primary-edge hover:-translate-y-px hover:shadow-md',
      },
      size: {
        sm: 'h-9 px-3 text-sm rounded-md',
        md: 'h-11 px-4 text-sm rounded-md', // 44px — the touch-target floor, DESIGN.md §42.6
        lg: 'h-12 px-6 text-base rounded-lg',
      },
    },
    /* `rounded-full` on the pill variant and `rounded-md` on the size rung are both
       radius utilities, so which one wins is source order in the stylesheet, not the
       order they are listed here — a real footgun. Restated as a compound variant so
       the pill's radius is applied last and cannot be squared off by its size. Extra
       right padding leaves room for the arrow chip to sit inside the shape. */
    compoundVariants: [
      { variant: 'pill', size: 'sm', className: 'rounded-full pr-1.5' },
      { variant: 'pill', size: 'md', className: 'rounded-full pr-2' },
      { variant: 'pill', size: 'lg', className: 'rounded-full pr-2.5' },
    ],
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

/**
 * The circular arrow chip that sits inside a `pill` button. Separate from `Button` so
 * the pill can also be used without it (a pill with no onward motion, e.g. a filter),
 * and so the nudge belongs to the arrow rather than to the whole control.
 *
 * The nudge is a CSS group-hover transform rather than a Motion variant: the button is
 * a plain `<button>`, and wrapping it in a Motion component to move a 3px arrow would
 * cost more than it delivers. The global `prefers-reduced-motion` backstop in theme.css
 * collapses the transition, and a 3px arrow settling instantly is a non-event.
 */
export function PillArrow({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'ml-1 inline-flex size-7 shrink-0 items-center justify-center rounded-full',
        'bg-primary-foreground/15 transition-transform duration-150 group-hover:translate-x-[3px]',
        className,
      )}
    >
      <ArrowRight className="size-3.5" />
    </span>
  )
}

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean
}

// Definition of Done, DESIGN.md §34.1: default/hover/focus-visible/active/disabled/
// loading all present; semantic tokens only (no raw hex); keyboard-operable via
// native <button>; renders in both themes off the theme.css tokens alone.
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), variant === 'pill' && 'group', className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  ),
)
Button.displayName = 'Button'
