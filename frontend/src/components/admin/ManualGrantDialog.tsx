import { useEffect, useId, useRef, useState } from 'react'
import { KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Label } from '@/components/ui/Input'

export interface ManualGrantTarget {
  userId: string
  customerEmail: string
  productId: string
  productName: string
}

/** week2_plan.md §20.8 — the escape hatch for "the payment succeeded but the webhook
 * failed." No Radix in this project (no `@radix-ui/*` dependency exists), so this
 * follows the same hand-rolled accessible-overlay pattern already used for
 * MarketingLayout's and MemberLayout's mobile menu sheets — a real `role="dialog"`,
 * Escape to close, and (stricter than those two, per §20.8) a focus trap plus
 * returning focus to the row that opened it.
 */
export function ManualGrantDialog({
  target,
  onClose,
  onSubmit,
  isPending,
  isError,
}: {
  target: ManualGrantTarget
  onClose: () => void
  onSubmit: (reason: string) => void
  isPending: boolean
  isError: boolean
}) {
  const [reason, setReason] = useState('')
  const reasonId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const triggerElement = useRef<Element | null>(null)

  useEffect(() => {
    triggerElement.current = document.activeElement
    // First focusable field, not the dialog container — a screen-reader user typing
    // a reason should land in the field they're about to fill in.
    const first = dialogRef.current?.querySelector<HTMLElement>('textarea, button')
    first?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab' || !dialogRef.current) return
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      // §20.8: "focus returned to the triggering row on close."
      if (triggerElement.current instanceof HTMLElement) triggerElement.current.focus()
    }
  }, [onClose])

  const trimmedReason = reason.trim()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${reasonId}-title`}
        className="relative w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg"
      >
        <p id={`${reasonId}-title`} className="flex items-center gap-2 font-sans text-h4 font-semibold text-foreground">
          <KeyRound className="size-[18px] text-muted-foreground" aria-hidden="true" />
          Grant an entitlement manually
        </p>

        <dl className="mt-4 flex flex-col gap-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Customer</dt>
            <dd className="text-foreground">{target.customerEmail}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Product</dt>
            <dd className="text-foreground">{target.productName}</dd>
          </div>
        </dl>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (trimmedReason) onSubmit(trimmedReason)
          }}
          className="mt-5"
        >
          <Label htmlFor={reasonId}>
            Reason <span aria-hidden="true">*</span>
            <span className="sr-only">(required)</span>
          </Label>
          <textarea
            id={reasonId}
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="mt-1.5 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            placeholder="e.g. Stripe payment succeeded (pi_...) but the webhook never fired — confirmed in the Stripe dashboard."
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Why this grant is being made. Recorded in the audit log with your name and the time.
          </p>

          {isError && (
            <p role="alert" className="mt-2 text-sm text-destructive">
              Something went wrong — the entitlement was not granted. Please try again.
            </p>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={isPending} disabled={!trimmedReason}>
              Grant the entitlement
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
