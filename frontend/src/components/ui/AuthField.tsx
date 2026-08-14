import { useId, useState, type ComponentPropsWithoutRef } from 'react'
import { motion } from 'motion/react'
import { Eye, EyeOff, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { springItem } from '@/lib/motion'

/** The auth-08 field: a leading icon inside the input, and — for passwords — a trailing
 * reveal toggle.
 *
 * auth-08 uses @hugeicons/react, which is not a dependency here and would be a new
 * package for four glyphs; lucide-react is already installed and carries equivalents.
 *
 * Two accessibility corrections to the reference:
 *  1. auth-08's toggle is labelled "Toggle password visibility" permanently, so a screen
 *     reader never learns the current state. Here the label says what pressing it will
 *     do, and `aria-pressed` carries the state.
 *  2. Its decorative icon has no `aria-hidden`, so it can surface as an unlabelled
 *     graphic. Hidden here — the visible <label> already names the field.
 */
type AuthFieldProps = ComponentPropsWithoutRef<'input'> & {
  label: string
  icon: LucideIcon
  hint?: string
}

export function AuthField({ label, icon: Icon, hint, type = 'text', className, ...props }: AuthFieldProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const [revealed, setRevealed] = useState(false)
  const isPassword = type === 'password'
  const resolvedType = isPassword && revealed ? 'text' : type

  return (
    <motion.div variants={springItem} className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <div className="relative">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-muted-foreground"
        >
          <Icon className="size-5" />
        </span>
        <input
          id={id}
          type={resolvedType}
          aria-describedby={hint ? hintId : undefined}
          className={cn(
            'w-full rounded-lg border border-border bg-muted/40 py-3.5 pl-11 text-sm text-foreground',
            'placeholder:text-muted-foreground/70',
            'focus:border-border-strong focus:bg-card focus:outline-none focus:ring-1 focus:ring-ring',
            isPassword ? 'pr-11' : 'pr-4',
            className,
          )}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-pressed={revealed}
            aria-label={revealed ? 'Hide password' : 'Show password'}
            className="absolute inset-y-0 right-0 flex items-center pr-4 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {revealed ? <EyeOff className="size-5" aria-hidden="true" /> : <Eye className="size-5" aria-hidden="true" />}
          </button>
        )}
      </div>
      {hint && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </motion.div>
  )
}
