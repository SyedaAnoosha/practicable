import { type FormEvent, useId } from 'react'
import { Mail } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/utils/cn'

interface EmailGateFormProps {
  /** Which entry point this is — already bound by the caller's useEmailGate(source). */
  heading: string
  description: string
  submitLabel: string
  email: string
  onEmailChange: (value: string) => void
  onSubmit: () => void
  isPending: boolean
  isError: boolean
  className?: string
}

/**
 * The email capture shared by every free entry point. A gradient fade from readable
 * text into the form (not a bordered card) so the gate reads as the content continuing.
 * Copy differs per placement; the shape, gold treatment and reassurance line are fixed.
 * Gold, not blue — a warm invitation, not a system action.
 */
export function EmailGateForm({
  heading,
  description,
  submitLabel,
  email,
  onEmailChange,
  onSubmit,
  isPending,
  isError,
  className,
}: EmailGateFormProps) {
  const inputId = useId()

  return (
    <div className={cn('relative', className)}>
      {/* The gradient fade: content fades into the form, so the gate reads as an
          invitation rather than a wall. The gradient sits above the form and fades
          from the page background to transparent — the visual signal that "there's
          more, you just need to say where to send it." */}
      <div
        aria-hidden="true"
        className="pointer-events-none -mb-8 h-16 bg-gradient-to-b from-background to-transparent"
      />
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault()
          onSubmit()
        }}
        className="relative rounded-xl border border-gold/30 bg-gold-soft/40 p-6 text-center"
      >
        <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-gold-soft text-gold-strong ring-1 ring-inset ring-gold/40">
          <Mail className="size-5" aria-hidden="true" />
        </span>
        <p className="mt-3 font-sans font-semibold text-foreground">{heading}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        <label htmlFor={inputId} className="sr-only">
          Your email address
        </label>
        <Input
          id={inputId}
          type="email"
          required
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          placeholder="you@example.com"
          className="mt-4"
        />
        <Button type="submit" loading={isPending} className="mt-3 w-full">
          {submitLabel}
        </Button>
        {isError && (
          <p role="alert" className="mt-2 text-xs text-destructive">
            Something went wrong — please try again.
          </p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">No spam, unsubscribe any time.</p>
      </form>
    </div>
  )
}
