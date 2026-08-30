import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui/Button'

/**
 * A scoped error state — three things, in order: what failed, whether the user must
 * act, what to try (DESIGN.md §40.3).
 *
 * Errors explain and instruct; they don't apologise (§6.1). Scoped to what failed —
 * a failed recommendation block doesn't blank the lesson.
 *
 * `role="alert"` so a screen reader announces it immediately (§42.8).
 */
export function ErrorState({
  title,
  description,
  onRetry,
  contactHref = '/contact',
  className,
}: {
  /** What failed — e.g. "We couldn't load these questions." */
  title: string
  /** Whether the user must act — e.g. "Check your connection." */
  description?: string
  /** Retry callback. If provided, a "Try again" button is shown. */
  onRetry?: () => void
  /** Link for persistent issues. Defaults to /contact. */
  contactHref?: string
  className?: string
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center gap-3 rounded-xl border border-border bg-card py-10 text-center',
        className,
      )}
    >
      <span
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-warning/10 text-warning ring-1 ring-inset ring-warning/20"
        aria-hidden="true"
      >
        <AlertTriangle className="size-5" />
      </span>
      <p className="font-sans font-medium text-foreground">{title}</p>
      {description && (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      <div className="mt-1 flex flex-wrap items-center justify-center gap-3">
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            Try again
          </Button>
        )}
        <a
          href={contactHref}
          className="text-sm text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
        >
          Contact us
        </a>
      </div>
    </div>
  )
}
