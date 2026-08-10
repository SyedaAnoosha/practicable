import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

export interface PageTitleProps {
  eyebrow?: string
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

// One <h1> per page (DESIGN.md §42.1) — every route's title goes through this
// component so that rule can't be violated by accident, and so focus-on-navigation
// (§42.3) always has a real target: tabIndex={-1} on the h1 lets RootLayout's route
// change handler move focus here after every navigation.
export const PageTitle = ({ eyebrow, title, description, action, className }: PageTitleProps) => (
  <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', className)}>
    <div>
      {eyebrow && (
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{eyebrow}</p>
      )}
      <h1 tabIndex={-1} className="font-sans font-semibold tracking-tight text-foreground outline-none" style={{ fontSize: 'var(--text-h1)' }}>
        {title}
      </h1>
      {description && <p className="mt-2 max-w-2xl text-muted-foreground">{description}</p>}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
)
