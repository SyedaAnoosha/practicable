import { useId, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export interface AccordionItemData {
  id: string
  title: string
  /** The right-hand summary on the closed row — "9 lessons · 37 min". This is what
   *  makes a collapsed accordion useful rather than merely short: the reader still
   *  knows the shape of what's inside without opening it (Udemy's pattern). */
  summary?: string
  /** Optional line under the title, shown open or closed. */
  description?: string | null
  content: ReactNode
}

/**
 * Collapsible sections with a count in the header row (design-research §1 pattern 3,
 * §4 "best patterns").
 *
 * The research measured Udemy fitting 374 lectures across 45 sections into ~700px by
 * collapsing every section to a row carrying its own counts ("9 lectures • 37min"), with
 * one section open and an "Expand all" control. Practicable's syllabus rendered every
 * module and every lesson expanded, with no per-module counts — so a ten-module course
 * was a wall, and the reader could not see the course's shape at all.
 *
 * Multiple sections may be open at once: this is a syllabus a buyer scans and compares
 * across, not a FAQ where one-at-a-time keeps the page short.
 *
 * Native <button> headers, `aria-expanded`/`aria-controls` wired to the region, and the
 * panel kept in the DOM only while open — a closed panel's links must not be reachable
 * by keyboard, which is what `hidden` alone would get wrong.
 */
export function Accordion({
  items,
  defaultOpen = [],
  className,
  expandAllLabel = 'Expand all',
  collapseAllLabel = 'Collapse all',
  showExpandAll = true,
}: {
  items: AccordionItemData[]
  /** Ids open on first render — pass the first module's id for a syllabus. */
  defaultOpen?: string[]
  className?: string
  expandAllLabel?: string
  collapseAllLabel?: string
  showExpandAll?: boolean
}) {
  const [open, setOpen] = useState<Set<string>>(() => new Set(defaultOpen))
  const baseId = useId()

  if (items.length === 0) return null

  const allOpen = open.size === items.length
  const toggleAll = () => setOpen(allOpen ? new Set() : new Set(items.map((i) => i.id)))

  return (
    <div className={className}>
      {showExpandAll && items.length > 1 && (
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            onClick={toggleAll}
            className="rounded-md text-xs font-medium text-accent transition-colors duration-150 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {allOpen ? collapseAllLabel : expandAllLabel}
          </button>
        </div>
      )}

      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {items.map((item) => {
          const isOpen = open.has(item.id)
          const panelId = `${baseId}-${item.id}-panel`
          const headerId = `${baseId}-${item.id}-header`

          return (
            <div key={item.id}>
              <h3>
                <button
                  type="button"
                  id={headerId}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() =>
                    setOpen((prev) => {
                      const next = new Set(prev)
                      if (next.has(item.id)) next.delete(item.id)
                      else next.add(item.id)
                      return next
                    })
                  }
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors duration-150 hover:bg-muted/60 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                >
                  <ChevronDown
                    className={cn(
                      'size-4 shrink-0 text-muted-foreground transition-transform duration-150',
                      isOpen && 'rotate-180',
                    )}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-foreground">{item.title}</span>
                    {item.description && (
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {item.description}
                      </span>
                    )}
                  </span>
                  {item.summary && (
                    <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                      {item.summary}
                    </span>
                  )}
                </button>
              </h3>
              {isOpen && (
                <div id={panelId} role="region" aria-labelledby={headerId}>
                  {item.content}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
