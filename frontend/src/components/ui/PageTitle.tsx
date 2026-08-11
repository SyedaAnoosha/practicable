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
      {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
      {/* text-h1 carries the §10 size, line-height and tracking from theme.css — the
          inline fontSize style this used before is gone now that the token exists. */}
      <h1 tabIndex={-1} className="text-balance text-h1 font-semibold text-foreground outline-none">
        {title}
      </h1>
      {description && <p className="mt-2 max-w-2xl text-muted-foreground">{description}</p>}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
)
