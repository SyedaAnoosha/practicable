import type { ComponentType, ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

export interface EmptyStateProps {
  title: string
  description?: string
  /** Icon rendered in a quiet tile above the title — the visual hook that makes the
   * empty state feel like an invitation, not an error (§36). Fixed §14.1 icons only. */
  icon?: ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>
  action?: ReactNode
  className?: string
}

// DESIGN.md §36: an invitation, not a dead end — states what would be here and gives
// the one action that puts something here. The icon tile follows the same quiet
// tile language as the tag grid and buy cards (muted, hairline-adjacent) so an
// empty state never outshouts the action that fills it.
export const EmptyState = ({ title, description, icon: Icon, action, className }: EmptyStateProps) => (
  <div
    className={cn(
      'flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-16 text-center',
      className,
    )}
  >
    {Icon && (
      <span
        className="mb-2 flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground ring-1 ring-inset ring-border"
        aria-hidden="true"
      >
        <Icon className="size-5" aria-hidden="true" />
      </span>
    )}
    <p className="font-sans font-medium text-foreground">{title}</p>
    {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
    {action && <div className="mt-2">{action}</div>}
  </div>
)
