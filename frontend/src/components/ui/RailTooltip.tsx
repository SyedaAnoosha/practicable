import { useCallback, useRef, useState, type ReactNode } from 'react'

/**
 * `[ADDED 2026-08-22]` The label flyout for a collapsed sidebar rail.
 *
 * Extracted because the same block was written out three times — twice in
 * `MemberLayout`, once in `AdminLayout` — and all three carried the same bug:
 *
 *     className="... absolute left-full top-1/2 ..."
 *
 * `left-full` deliberately puts the tooltip *outside* its parent, but the `<aside>`
 * that contains it is `overflow-y-auto overflow-x-hidden`, and a scroll container clips
 * absolutely positioned descendants. So:
 *
 *   - the tooltip never appeared. A collapsed rail was a column of unlabelled icons
 *     with no way to discover what any of them did; and
 *   - every hidden label still contributed its full width to the aside's scroll extent.
 *     Measured on the admin rail: 63px wide, 142px scrollWidth — which is exactly the
 *     "horizontal scroll" in the bug report, and why the icons looked like they
 *     overlapped.
 *
 * `position: fixed` takes the tooltip out of the scroll container entirely, so it both
 * escapes the clip and stops contributing to scrollWidth. The trade-off is that `top`
 * no longer resolves against the row, so it is measured from the trigger on
 * pointer-enter — which also keeps it correct after the rail has been scrolled, as a
 * static offset would not.
 *
 * Renders its own wrapper so the caller does not have to remember the `group relative`
 * and the pointer handlers that make it work.
 */
export function RailTooltip({
  label,
  collapsed,
  /** Distance from the viewport's left edge to the collapsed rail's right edge.
   *  Defaults to the shared `w-16` rail width. */
  offset = '4rem',
  children,
}: {
  label: string
  collapsed: boolean
  offset?: string
  children: ReactNode
}) {
  const [top, setTop] = useState<number | undefined>(undefined)
  const rowRef = useRef<HTMLDivElement>(null)

  const align = useCallback(() => {
    const r = rowRef.current?.getBoundingClientRect()
    if (r) setTop(r.top + r.height / 2)
  }, [])

  return (
    <div
      ref={rowRef}
      className="group relative"
      onPointerEnter={collapsed ? align : undefined}
      onFocus={collapsed ? align : undefined}
    >
      {children}
      {collapsed && (
        <span
          aria-hidden="true"
          style={{ left: `calc(${offset} + 0.5rem)`, top }}
          className="pointer-events-none fixed z-50 -translate-y-1/2 whitespace-nowrap rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs font-medium text-popover-foreground opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
        >
          {label}
        </span>
      )}
    </div>
  )
}
