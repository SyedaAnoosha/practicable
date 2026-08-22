import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { CircleCheck, FileSpreadsheet, Layers, Table2 } from 'lucide-react'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { PageTitle } from '@/components/ui/PageTitle'
import { EmptyState } from '@/components/ui/EmptyState'
import { Meta, type MetaItem } from '@/components/ui/Meta'

interface TemplateProduct {
  slug: string
  name: string
  price_amount: number
  currency: string
}

interface TemplateSummary {
  id: string
  slug: string
  title: string
  description: string
  file_name: string
  owned: boolean
  product: TemplateProduct | null
  is_free: boolean
  format?: string | null
  page_count?: number | null
  sheet_count?: number | null
  version?: string | null
}

/** The file's extension as a short kind badge — "XLSX", "PDF", "DOCX". Derived from the
 *  filename rather than a separate column, and never shown as the raw filename itself
 *  (which leaks storage naming into the catalogue). Returns null for a name with no
 *  usable extension, so the badge is absent rather than empty. */
function fileKind(fileName: string): string | null {
  const ext = fileName.split('.').pop()
  if (!ext || ext === fileName || ext.length > 5) return null
  return ext.toUpperCase()
}

// The template catalogue (DESIGN.md §41's /templates) — the sidebar's third destination.
// Owned templates link straight to the download page; not-owned ones link to the real
// pre-checkout summary for whichever product actually sells them.
//
// `[REBUILT 2026-08-20, design-research/PLATFORM_UI_UX_RESEARCH.md §9 P0 items 2/3]`
// Same two fixes as the course catalogue: three columns instead of two (a template card
// carries less than a course card and was the emptiest surface in the app at ~600px
// wide), and a real metadata line — the format badge the audit found was derivable from
// data already on the response and simply never shown. Gold icon tile rather than the
// default grey, so a template is distinguishable from a course at a glance (§7 finding 4).
export function TemplatesCatalogue() {
  const { data: templates, isLoading } = useQuery({
    queryKey: queryKeys.templates.list(),
    queryFn: () => api.get<TemplateSummary[]>('/templates').then((res) => res.data),
  })

  return (
    <div className="relative isolate mx-auto w-full max-w-7xl px-5 py-8 sm:px-8">
      {/* Catalogue header atmosphere (theme.css .page-wash). Full-bleed to the viewport
          edge via `left-1/2 … w-screen`, since this sits inside a max-w container where
          `inset-x-0` would stop at the container edge. Decorative, so out of the a11y
          tree. */}
      <div aria-hidden="true" className="page-wash absolute left-1/2 top-0 -z-10 h-[30rem] w-screen -translate-x-1/2" />
      <PageTitle
        eyebrow="Use"
        title="Templates"
        description="Ready-to-use working files — the practical companion to the guidance and courses."
        action={
          templates && templates.length > 0 ? (
            <p className="font-mono text-sm tabular-nums text-muted-foreground">
              {templates.length} {templates.length === 1 ? 'template' : 'templates'}
            </p>
          ) : undefined
        }
      />

      {/* week3_plan.md Phase 6 step 7 / DESIGN.md §42's "headings in order, no skipped
          levels" — see CoursesCatalogue.tsx for the full rationale; same fix, same
          reason (the card grid's titles are h3). */}
      <h2 className="sr-only">Template list</h2>

      {isLoading && (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-52 animate-pulse rounded-xl border border-border bg-muted/40" />
          ))}
        </div>
      )}

      {!isLoading && templates?.length === 0 && (
        <EmptyState
          className="mt-6"
          icon={FileSpreadsheet}
          title="No templates yet"
          description="The first template is on its way — check back soon."
        />
      )}

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {templates?.map((template) => {
          const kind = fileKind(template.file_name)
          return (
            <Card key={template.slug} className="hover-lift flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                {/* Gold tile, not the default muted grey: gold is this system's
                    "artefact you take away" colour, and the audit found every icon tile
                    in the app rendering the same neutral. */}
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-gold-soft text-gold-strong ring-1 ring-inset ring-gold/40">
                  <FileSpreadsheet className="size-4" aria-hidden="true" />
                </span>
                {kind && (
                  <span className="shrink-0 rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[0.6875rem] font-medium tracking-wide text-muted-foreground">
                    {kind}
                  </span>
                )}
              </div>

              <h3 className="mt-3 text-h4 font-semibold text-foreground">{template.title}</h3>
              <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{template.description}</p>

              <Meta
                className="mt-3"
                items={[
                  template.format && { icon: Layers, value: template.format },
                  (template.page_count || template.sheet_count) && {
                    icon: Table2,
                    value: template.sheet_count
                      ? `${template.sheet_count} sheet${template.sheet_count === 1 ? '' : 's'}`
                      : `${template.page_count} page${template.page_count === 1 ? '' : 's'}`,
                  },
                  template.version && { value: `v${template.version}` },
                ].filter(Boolean) as MetaItem[]}
              />

              <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                {/* Free is checked BEFORE owned: the free template has no product and no
                    entitlement, so an `owned` branch would never fire for it and a
                    `product` branch would fall through to "not yet available for
                    purchase" — which is the opposite of true. */}
                {template.is_free ? (
                  <>
                    <Badge variant="success">Free</Badge>
                    <Link to={`/templates/${template.id}`}>
                      <Button size="sm">Get it free</Button>
                    </Link>
                  </>
                ) : template.owned ? (
                  <>
                    <Badge variant="success" className="gap-1">
                      <CircleCheck className="size-3" aria-hidden="true" />
                      In your library
                    </Badge>
                    <Link to={`/templates/${template.id}`}>
                      <Button size="sm">Download</Button>
                    </Link>
                  </>
                ) : template.product ? (
                  <>
                    <p className="font-mono text-sm font-semibold tabular-nums text-foreground">
                      {formatCurrency(template.product.price_amount, template.product.currency)}
                    </p>
                    <Link to={`/buy/${template.product.slug}`}>
                      <Button size="sm" variant="outline">
                        See what's included
                      </Button>
                    </Link>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">Not yet available for purchase</p>
                )}
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
