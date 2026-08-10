import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils/cn'

export const Card = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('rounded-xl border border-border bg-card text-card-foreground shadow-sm', className)} {...props} />
)

export const CardHeader = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />
)

export const CardTitle = ({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={cn('font-sans font-semibold leading-none tracking-tight', className)} style={{ fontSize: 'var(--text-h3)' }} {...props} />
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
