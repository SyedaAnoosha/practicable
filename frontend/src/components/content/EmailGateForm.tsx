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

/** The email capture shared by every free entry point.
 *
 * Copy differs per placement ("keep reading" vs "where should we send it") but the
 * shape, the gold treatment and the reassurance line are fixed, so a visitor meets the
 * same object wherever they hit it. Gold rather than blue throughout: this is a warm
 * invitation, not a system action (theme.css §7.5 — gold is decorative only, and
 * `--gold-strong` is the one text-safe gold).
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
  // Unique per instance: a lesson page can render this alongside other labelled inputs,
  // and a duplicated id would point every label at the first field on the page.
  const inputId = useId()

  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault()
        onSubmit()
      }}
      className={cn('rounded-lg border border-border bg-secondary/40 p-5 text-center', className)}
    >
      <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-gold-soft text-gold-strong ring-1 ring-inset ring-gold/40">
        <Mail className="size-5" aria-hidden="true" />
      </span>
      <p className="mt-3 font-sans font-semibold">{heading}</p>
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
  )
}
