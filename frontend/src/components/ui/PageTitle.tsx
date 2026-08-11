import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

export interface PageTitleProps {
  eyebrow?: string
  // Optional override for the eyebrow's colour and the leading hairline rule
  // (a CSS colour value, e.g. `var(--domain-risk)`) — used on the question page
  // to carry that question's domain colour (domainVisuals.ts, 2026-08-11
  // liveliness pass). Every other page leaves this unset and keeps the default
  // muted eyebrow.
  eyebrowColor?: string
  title: string
  description?: string
  action?: ReactNode
  className?: string
  // 'product' (default): sans, the UI/commerce register — dashboards, catalogues,
  // buy pages. 'editorial': serif, for pages whose content *is* the product —
  // currently just the question page. DESIGN.md §36/owner design critique
  // (2026-08-11): typography should carry more of the "professional reference
  // library, not a course platform" distinction than a shared sans h1 can.
  variant?: 'product' | 'editorial'
}

// One <h1> per page (DESIGN.md §42.1) — every route's title goes through this
// component so that rule can't be violated by accident, and so focus-on-navigation
// (§42.3) always has a real target: tabIndex={-1} on the h1 lets RootLayout's route
// change handler move focus here after every navigation.
export const PageTitle = ({ eyebrow, eyebrowColor, title, description, action, className, variant = 'product' }: PageTitleProps) => (
  <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', className)}>
    <div>
      {eyebrow && (
        <p
          className="eyebrow mb-2"
          style={eyebrowColor ? ({ color: eyebrowColor, '--eyebrow-rule-color': eyebrowColor } as CSSProperties) : undefined}
        >
          {eyebrow}
        </p>
      )}
      {/* text-h1 carries the §10 size, line-height and tracking from theme.css — the
          inline fontSize style this used before is gone now that the token exists. */}
      <h1
        tabIndex={-1}
        className={cn(
          'text-balance text-h1 text-foreground outline-none',
          variant === 'editorial' ? 'font-serif font-medium' : 'font-semibold',
        )}
      >
        {title}
      </h1>
      {description && (
        <p
          className={cn(
            'mt-2 max-w-2xl text-muted-foreground',
            variant === 'editorial' && 'font-serif text-lead',
          )}
        >
          {description}
        </p>
      )}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
)
