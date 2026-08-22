import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { CircleCheck, FileSpreadsheet, Layers, Table2 } from 'lucide-react'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { formatCurrency } from '@/lib/utils/formatCurrency'
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

function fileKind(fileName: string): string | null {
  const ext = fileName.split('.').pop()
  if (!ext || ext === fileName || ext.length > 5) return null
  return ext.toUpperCase()
}

/**
 * Template catalogue — editorial divided-columns treatment.
 *
 * `[REDESIGNED 2026-08-22]` Was rounded cards with `hover-lift` — the AI card pattern.
 * Now uses the same broadsheet grid as the home QuestionCard and CoursesCatalogue:
 * border border-border bg-border gap-px, each cell bg-card, square corners, mono
 * format badge, title underlines on hover.
 */
export function TemplatesCatalogue() {
  const { data: templates, isLoading } = useQuery({
    queryKey: queryKeys.templates.list(),
    queryFn: () => api.get<TemplateSummary[]>('/templates').then((res) => res.data),
  })

  return (
    <div className="relative isolate mx-auto w-full max-w-7xl px-5 py-8 sm:px-8">
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

      <h2 className="sr-only">Template list</h2>

      {isLoading && (
        <div className="mt-6 grid overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 [&>*]:bg-card">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-40 animate-pulse bg-muted/40" />
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

      {/* Divided-columns grid: broadsheet treatment, not rounded cards. */}
      <div className="mt-6 grid overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 [&>*]:bg-card">
        {templates?.map((template) => {
          const kind = fileKind(template.file_name)
          return (
            <Link
              key={template.slug}
              to={`/templates/${template.id}`}
              className="group block border-b border-border bg-card last:border-b-0 transition-colors duration-150 hover:bg-card-2 sm:[&:nth-last-child(-n+4)]:border-b-0 sm:[&:nth-child(4n)]:border-b-0 lg:[&:nth-last-child(-n+3)]:border-b-0 lg:[&:nth-child(3n)]:border-b-0 xl:[&:nth-last-child(-n+4)]:border-b-0 xl:[&:nth-child(4n)]:border-b-0"
            >
              <div className="px-4 pt-3 pb-4">
                <div className="flex items-center gap-2">
                  {kind && (
                    <span className="shrink-0 rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[0.625rem] font-medium tracking-wide text-muted-foreground">
                      {kind}
                    </span>
                  )}
                  {template.version && (
                    <span className="shrink-0 font-mono text-[0.625rem] text-muted-foreground/70">
                      v{template.version}
                    </span>
                  )}
                </div>

                <h3 className="mt-2 text-sm font-semibold text-foreground decoration-1 underline-offset-4 group-hover:underline">
                  {template.title}
                </h3>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{template.description}</p>

                <Meta
                  className="mt-2"
                  items={[
                    template.format && { icon: Layers, value: template.format },
                    (template.page_count || template.sheet_count) && {
                      icon: Table2,
                      value: template.sheet_count
                        ? `${template.sheet_count} sheet${template.sheet_count === 1 ? '' : 's'}`
                        : `${template.page_count} page${template.page_count === 1 ? '' : 's'}`,
                    },
                  ].filter(Boolean) as MetaItem[]}
                />

                <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5">
                  {template.is_free ? (
                    <Badge variant="success" className="text-[0.625rem]">Free</Badge>
                  ) : template.owned ? (
                    <Badge variant="success" className="gap-1 text-[0.625rem]">
                      <CircleCheck className="size-2.5" aria-hidden="true" /> Owned
                    </Badge>
                  ) : template.product ? (
                    <span className="font-mono text-xs tabular-nums text-foreground">
                      {formatCurrency(template.product.price_amount, template.product.currency)}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Not yet for sale</span>
                  )}
                  <span className="text-xs font-medium text-accent">
                    {template.is_free ? 'Get free' : template.owned ? 'Download' : "See what's included"}
                  </span>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
