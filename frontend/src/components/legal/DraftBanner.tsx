import { TriangleAlert } from 'lucide-react'

// week2_plan.md §20.7 — required, verbatim placement, on all three legal pages.
// `--warning`, not `--destructive`: the page is not broken and the reader has done
// nothing wrong — it's provisional, which is exactly what `--warning` means in this
// system (§15.2's locked-state rule, same logic).
export function DraftBanner() {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-warning bg-warning/10 px-4 py-4 sm:px-5">
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
      <div>
        <p className="font-mono text-xs font-medium uppercase tracking-[0.16em] text-warning">Draft — for review</p>
        <p className="mt-1 text-sm text-foreground">
          This page has not been reviewed by a lawyer and is not published on the author's authority.
        </p>
      </div>
    </div>
  )
}
