import { useCallback, useRef, useState, type ReactNode } from 'react'

/**
 * The label flyout for a collapsed sidebar rail.
 *
 * `position: fixed`, not `absolute left-full`: the containing `<aside>` is a scroll
 * container, which clips absolutely-positioned descendants (the tooltip never showed)
 * and counts their width toward its scroll extent (spurious horizontal scroll). Fixed
 * escapes both. The trade-off is that `top` no longer resolves against the row, so it
 * is measured from the trigger on pointer-enter, which also stays correct after the
 * rail is scrolled.
 *
 * Renders its own wrapper with the `group relative` and pointer handlers so callers
 * don't have to.
 */
export function RailTooltip({
  label,
  collapsed,
  /** Distance from the viewport's left edge to the collapsed rail's right edge.
   * Defaults to the shared `w-16` rail width. */
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
