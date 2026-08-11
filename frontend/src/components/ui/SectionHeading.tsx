import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils/cn'

// The one section-heading treatment in the product: a 24px champagne hairline
// before an h4-sized h2. Previously hand-rolled inline in Question.tsx (Guidance)
// and missing entirely from CourseDetail.tsx — one component so the gilt rule and
// the heading level (h2, so CardTitle h3s below it land in sequence, §42.1) can't
// drift between pages.
export const SectionHeading = ({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
  <h2 className={cn('flex items-center gap-3 text-h4 font-semibold text-foreground', className)} {...props}>
    <span aria-hidden="true" className="h-px w-6 shrink-0 bg-accent" />
    <span className="flex-1">{children}</span>
  </h2>
)
