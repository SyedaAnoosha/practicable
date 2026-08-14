import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

/** Four L-shaped brackets at the corners of a block — the signature device from
 * `docs/comps.md`'s BudgetCard.
 *
 * It is the one ornament in this design language that is purely structural: it frames
 * without drawing a full box, which suits a surface that already has its own border and
 * would look boxed-in with a second one. Used for "this is an instrument panel" moments
 * rather than ordinary cards.
 *
 * Two departures from the source, both deliberate:
 *  - The original hardcodes `border-black/20 dark:border-white/20`. This uses
 *    `--border-strong`, the token already carrying 3.2:1 on card for state-bearing
 *    borders, so the brackets survive the light/dark swap without a second rule.
 *  - The original nails the brackets to the viewport corners of an `absolute`-positioned
 *    parent. Here they are children of a `relative` wrapper so the component can be
 *    dropped around arbitrary content instead of the caller having to arrange it.
 *
 * `aria-hidden` throughout: this is decoration and has no place in the a11y tree.
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
