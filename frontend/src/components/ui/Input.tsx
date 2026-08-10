import { forwardRef, useId, type InputHTMLAttributes, type LabelHTMLAttributes } from 'react'
import { cn } from '@/lib/utils/cn'

export const Label = ({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) => (
  <label className={cn('text-sm font-medium leading-none', className)} {...props} />
)

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Rendered as the field's error message; sets aria-invalid + aria-describedby
   * (DESIGN.md §42.7). */
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, id, error, ...props }, ref) => {
    const generatedId = useId()
    const inputId = id ?? generatedId
    const errorId = `${inputId}-error`

    return (
      <>
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
            'placeholder:text-muted-foreground',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-destructive',
            className,
          )}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          {...props}
        />
        {error && (
          <p id={errorId} role="alert" className="mt-1 text-sm text-destructive">
            {error}
          </p>
        )}
      </>
    )
  },
)
Input.displayName = 'Input'

/** A Label + Input pair sharing a generated id, so callers don't have to wire
 * htmlFor/id by hand on every field (DESIGN.md §34.1's a11y requirement, made hard
 * to get wrong rather than easy to forget). */
export const FormField = forwardRef<
  HTMLInputElement,
  InputProps & { label: string }
>(({ label, id, ...props }, ref) => {
  const generatedId = useId()
  const inputId = id ?? generatedId
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={inputId}>{label}</Label>
      <Input ref={ref} id={inputId} {...props} />
    </div>
  )
})
FormField.displayName = 'FormField'
