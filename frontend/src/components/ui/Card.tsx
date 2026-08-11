import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils/cn'

// §12.2/§12.3: the default surface is a 1px hairline border, elevation level 0 —
// "never a permanent heavy shadow on every card". Cards lift (hover:shadow-md)
// where a page's hover treatment asks for it, and only there.
export const Card = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('rounded-xl border border-border bg-card text-card-foreground', className)} {...props} />
)

export const CardHeader = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />
)

// text-h3 carries the §10 size, line-height (1.25) and tracking from theme.css — the
// inline fontSize + leading-none this used before made multi-line titles cramped and
// ignored the spec's type rhythm.
export const CardTitle = ({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={cn('text-h3 font-semibold', className)} {...props} />
)

export const CardDescription = ({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn('text-sm text-muted-foreground', className)} {...props} />
)

export const CardContent = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('p-6 pt-0', className)} {...props} />
)

export const CardFooter = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex items-center p-6 pt-0', className)} {...props} />
)
