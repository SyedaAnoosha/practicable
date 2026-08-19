import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

export interface PageTitleProps {
  eyebrow?: string
  // Optional override for the eyebrow's colour and hairline rule (a CSS colour value)
  // — used on the question page to carry its domain colour. Every other page keeps
  // the default muted eyebrow.
  eyebrowColor?: string
  title: string
  description?: string
  action?: ReactNode
  className?: string
  // 'product' (default): sans, for dashboards, catalogues, buy pages. 'editorial':
  // serif, for pages whose content is the product — currently just the question page.
  variant?: 'product' | 'editorial'
}

// One <h1> per page — every route's title goes through this component so that rule
// can't be violated by accident, and tabIndex={-1} gives focus-on-navigation a target.
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
      {/* text-h1 carries the size, line-height and tracking from theme.css. */}
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
