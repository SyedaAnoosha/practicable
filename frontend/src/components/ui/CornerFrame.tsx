import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

/** Four L-shaped brackets at the corners of a block — a purely structural ornament: it
 * frames without drawing a full box, for "this is an instrument panel" moments rather
 * than ordinary cards. Uses `--border-strong` so it survives the light/dark swap.
 * `aria-hidden` throughout, since this is decoration.
 */
export function CornerFrame({
  children,
  className,
  inset = false,
}: {
  children: ReactNode
  className?: string
  /** Pull the brackets inside the bounds — for content that already has padding. */
  inset?: boolean
}) {
  const arm = cn(
    'pointer-events-none absolute z-20 size-5 border-border-strong',
    inset ? 'm-2' : '',
  )

  return (
    <div className={cn('relative', className)}>
      <span aria-hidden="true" className={cn(arm, 'left-0 top-0 border-l-[1.6px] border-t-[1.6px]')} />
      <span aria-hidden="true" className={cn(arm, 'right-0 top-0 border-r-[1.6px] border-t-[1.6px]')} />
      <span aria-hidden="true" className={cn(arm, 'bottom-0 left-0 border-b-[1.6px] border-l-[1.6px]')} />
      <span aria-hidden="true" className={cn(arm, 'bottom-0 right-0 border-b-[1.6px] border-r-[1.6px]')} />
      {children}
    </div>
  )
}
