import type { ReactNode } from 'react'
import { Lock } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

/**
 * A locked/paywall state (DESIGN.md §40.4).
 *
 * Locked is not broken and not an error. Muted surface, dashed border, lock icon,
 * the name of what unlocks it, and its price — **never** a greyed-out, disabled-
 * looking title. The user should read clearly what they're missing; that's the
 * persuasive mechanism.
 *
 * Locked never uses `--destructive` (§7.1). The surface is `--muted`, the border
 * is `--border` (dashed), and the text stays fully opaque.
 */
export function LockedState({
  title,
  productName,
  price,
  action,
  className,
}: {
  /** What is locked — e.g. "This lesson is part of a course." */
  title: string
  /** The product that unlocks it — e.g. "Risk Management Fundamentals" */
  productName?: string
  /** Price display — e.g. "$49" */
  price?: string
  /** CTA — typically a Link to /buy/:slug wrapped in a Button */
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-dashed border-border bg-muted/40 p-6 text-center',
        className,
      )}
    >
      <span
        className="mx-auto flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground ring-1 ring-inset ring-border"
        aria-hidden="true"
      >
        <Lock className="size-4" />
      </span>
      <p className="mt-3 font-sans font-medium text-foreground">{title}</p>
      {productName && (
        <p className="mt-1.5 text-sm text-muted-foreground">
          Unlock it with{' '}
          <span className="font-medium text-foreground">{productName}</span>
          {price && (
            <span className="ml-1 font-mono text-xs tabular-nums text-muted-foreground">
              — {price}
            </span>
          )}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
