import { useEffect, useId, useRef, useState } from 'react'
import { CircleAlert } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Label } from '@/components/ui/Input'
import { FieldError } from '@/components/ui/FieldError'
import { useFieldValidation, required } from '@/lib/useFieldValidation'
import { formatCurrency } from '@/lib/utils/formatCurrency'

export interface RefundTarget {
  orderId: string
  customerEmail: string
  amount: number
  currency: string
  /** Real product names on this order, resolved from the same rows the table already
   * has — never a generic "your purchase" sentence (week3_plan.md §20.3). */
  productNames: string[]
}

/** week3_plan.md §20.3 — admin, destructive. Same hand-rolled accessible-overlay
 * pattern as `ManualGrantDialog` (no Radix dependency in this project), with the
 * differences the spec calls out for a money-destructive action specifically: Cancel
 * is the default focus (not the first field), the confirm button is `--destructive`,
 * the in-flight state is not cancellable, and a failure renders inline — never a
 * toast, which would disappear before a refund failure is actually read.
 */
export function RefundDialog({
  target,
  onClose,
  onSubmit,
  isPending,
  isError,
}: {
  target: RefundTarget
  onClose: () => void
  onSubmit: (reason: string) => void
  isPending: boolean
  isError: boolean
}) {
  const [reason, setReason] = useState('')
  const titleId = useId()
  const reasonId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const triggerElement = useRef<Element | null>(null)
  const v = useFieldValidation<{ reason: string }>({ reason: required('A reason') })

  useEffect(() => {
    triggerElement.current = document.activeElement
    // Cancel gets initial focus, not the reason field — this is destructive, and the
    // safe action should be one keypress away by default (§20.3).
    cancelRef.current?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      // Not cancellable mid-refund (§20.3: "a half-refund is worse than a slow one").
      if (e.key === 'Escape') {
        if (!isPending) onClose()
        return
      }
      if (e.key !== 'Tab' || !dialogRef.current) return
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not(:disabled), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
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
      if (triggerElement.current instanceof HTMLElement) triggerElement.current.focus()
    }
  }, [onClose, isPending])

  const trimmedReason = reason.trim()
  const amountDisplay = formatCurrency(target.amount, target.currency)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={() => !isPending && onClose()} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg"
      >
        <p id={titleId} className="text-h4 font-semibold text-foreground">
          Refund this order?
        </p>

        <dl className="mt-4 flex flex-col gap-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Order</dt>
            <dd className="font-mono text-xs text-foreground">{target.orderId}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Customer</dt>
            <dd className="text-foreground">{target.customerEmail}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Amount</dt>
            <dd className="tabular-nums text-foreground">{amountDisplay}</dd>
          </div>
        </dl>

        <p className="mt-4 rounded-md bg-muted/60 p-3 text-sm text-foreground">
          This refunds <span className="tabular-nums">{amountDisplay}</span> through Stripe and removes their access
          to: {target.productNames.join(', ')}.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (v.validateAll({ reason: trimmedReason })) onSubmit(trimmedReason)
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
            onBlur={() => v.onBlur('reason', reason.trim())}
            rows={3}
            disabled={isPending}
            className="mt-1.5 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="e.g. Buyer contacted support, hadn't started the course, requested a refund within 14 days."
          />
          <FieldError message={v.errorFor('reason')} />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Recorded in the audit log with your name and the time.
          </p>

          {isError && (
            <div className="mt-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
              <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
              <div className="flex flex-col gap-2">
                <p role="alert" className="text-sm text-destructive">
                  Stripe declined the refund. Nothing has changed.
                </p>
                <Button type="button" size="sm" variant="outline" onClick={() => onSubmit(trimmedReason)}>
                  Try again
                </Button>
              </div>
            </div>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <Button ref={cancelRef} type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" loading={isPending} disabled={!trimmedReason || isPending}>
              {isPending ? 'Refunding…' : 'Refund and revoke access'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
