import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
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
        primary: 'bg-primary text-primary-foreground shadow-sm ring-1 ring-inset ring-primary-edge hover:-translate-y-px hover:shadow-md',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary-strong',
        outline: 'border border-border bg-background hover:border-border-strong hover:bg-muted',
        ghost: 'bg-transparent text-foreground hover:bg-muted',
        destructive: 'bg-destructive text-destructive-foreground hover:opacity-90',
      },
      size: {
        sm: 'h-9 px-3 text-sm rounded-md',
        md: 'h-11 px-4 text-sm rounded-md', // 44px — the touch-target floor, DESIGN.md §42.6
        lg: 'h-12 px-6 text-base rounded-lg',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

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
      className={cn(buttonVariants({ variant, size }), className)}
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
