import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

export interface EmptyStateProps {
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

// DESIGN.md §36: an invitation, not a dead end — states what would be here and gives
// the one action that puts something here.
export const EmptyState = ({ title, description, action, className }: EmptyStateProps) => (
  <div className={cn('flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-16 text-center', className)}>
    <p className="font-sans font-medium text-foreground">{title}</p>
    {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
    {action && <div className="mt-2">{action}</div>}
  </div>
)
