import { FileText, Laptop, PenLine, Table2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { PreviewGallery, type Preview } from './PreviewGallery'
import { LicenceLine } from './LicenceLine'
import { VersionStamp } from './VersionStamp'

interface EvidencePanelProps {
  id?: string
  format?: string
  pageCount?: number
  sheetCount?: number
  isEditable?: boolean
  hasMacros?: boolean
  minOfficeVersion?: string
  previews?: Preview[]
  version?: string
  lastReviewedAt?: string
  licence?: string
  title?: string
  className?: string
}

interface FactRow {
  icon: typeof FileText
  label: string
  value: string
}

/** week4_plan.md §20.1 — the ninety seconds before payment. A bare `<section>`, not a
 * `Card` (DESIGN.md §36: this is metadata about the item you're already on, not a
 * distinct item). The absence rule is the whole component: a fact whose column is
 * unset does not render its row at all — no `—`, no "Not specified". */
export const EvidencePanel = ({
  id,
  format,
  pageCount,
  sheetCount,
  isEditable,
  hasMacros,
  minOfficeVersion,
  previews,
  version,
  lastReviewedAt,
  licence,
  title = 'this product',
  className,
}: EvidencePanelProps) => {
  const facts: FactRow[] = []

  if (format) facts.push({ icon: FileText, label: 'Format', value: format })

  if (pageCount) {
    facts.push({ icon: Table2, label: 'Size', value: `${pageCount} page${pageCount === 1 ? '' : 's'}` })
  } else if (sheetCount) {
    facts.push({ icon: Table2, label: 'Size', value: `${sheetCount} sheet${sheetCount === 1 ? '' : 's'}` })
  }

  if (isEditable !== undefined) {
    facts.push({
      icon: PenLine,
      label: 'Editable',
      value: isEditable ? (hasMacros ? 'Yes — contains macros' : 'Yes — no macros') : 'No',
    })
  }

  if (minOfficeVersion) facts.push({ icon: Laptop, label: 'Opens in', value: minOfficeVersion })

  const hasPreviews = !!previews?.length
  const hasVersion = !!(version || lastReviewedAt)
  const hasLicence = !!licence

  // Empty state (§20.1): no evidence at all -> the panel is absent, not a shell with
  // nothing in it. The page doesn't degrade; it just doesn't gain anything.
  if (facts.length === 0 && !hasPreviews && !hasVersion && !hasLicence) return null

  return (
    <section
      id={id}
      aria-label={`What you get with ${title}`}
      className={cn('rounded-lg border border-border bg-gold-soft p-5 sm:p-6', className)}
    >
      {facts.length > 0 && (
        <>
          <p className="eyebrow">What you get</p>
          <dl className="mt-3">
            {facts.map((fact, i) => (
              <div
                key={fact.label}
                className={cn(
                  'flex items-center justify-between gap-4 py-2.5',
                  i < facts.length - 1 && 'border-b border-border',
                )}
              >
                <dt className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <fact.icon className="size-4 shrink-0 text-gold-strong" strokeWidth={1.75} aria-hidden="true" />
                  {fact.label}
                </dt>
                <dd className="text-right text-sm text-foreground tabular-nums">{fact.value}</dd>
              </div>
            ))}
          </dl>
        </>
      )}

      {hasPreviews && (
        <div className={cn(facts.length > 0 && 'mt-5')}>
          <p className="eyebrow">Sample pages</p>
          <div className="mt-3">
            <PreviewGallery previews={previews!} title={title} />
          </div>
        </div>
      )}

      {(hasVersion || hasLicence) && (
        <div className={cn('flex flex-col gap-2', (facts.length > 0 || hasPreviews) && 'mt-5')}>
          {hasVersion && <VersionStamp version={version} lastReviewedAt={lastReviewedAt} />}
          {hasLicence && <LicenceLine licence={licence!} />}
        </div>
      )}
    </section>
  )
}

/** Loading placeholder — same row count as the last known shape, or three rows if
 * unknown. Never a spinner in a reference panel (§20.1's own rule). */
export const EvidencePanelSkeleton = ({ rows = 3 }: { rows?: number }) => (
  <div className="animate-pulse rounded-lg border border-border bg-gold-soft p-5 sm:p-6" aria-hidden="true">
    <div className="h-3 w-24 rounded bg-muted" />
    <div className="mt-4 flex flex-col gap-2.5">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between border-b border-border py-2.5 last:border-b-0">
          <div className="h-3.5 w-20 rounded bg-muted" />
          <div className="h-3.5 w-28 rounded bg-muted" />
        </div>
      ))}
    </div>
  </div>
)
