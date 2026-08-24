import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { CircleCheck, FileSpreadsheet, Layers, Table2 } from 'lucide-react'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import { Badge } from '@/components/ui/Badge'
import { PageTitle } from '@/components/ui/PageTitle'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Meta, type MetaItem } from '@/components/ui/Meta'
import { StarRating } from '@/components/ui/StarRating'

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
  /** W5-R4 Stage B: null below the display threshold. */
  rating?: number | null
  review_count?: number
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
  // `[CHANGED 2026-08-22, F3 — P0]` See QuestionsCatalogue: without `isError` a failed
  // fetch rendered nothing at all.
  const { data: templates, isLoading, isError, refetch } = useQuery({
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

      {!isLoading && isError && (
        <ErrorState
          className="mt-6"
          title="We couldn't load the templates."
          description="Check your connection and try again."
          onRetry={() => void refetch()}
        />
      )}

      {!isLoading && !isError && templates?.length === 0 && (
        <EmptyState
          className="mt-6"
          icon={FileSpreadsheet}
          title="No templates yet"
          description="The first template is on its way — check back soon."
        />
      )}

      {/* Divided-columns grid — see CoursesCatalogue for the full note. `bg-border`
          plus `[&>*]:bg-card` left every unfilled track in the last row painted as a
          beige slab; `gap-px` shows the rule only between real cells. Also gated so the
          empty frame no longer sits under the loading, error and empty states. */}
      {!isLoading && !isError && !!templates?.length && (
      <div className="mt-6 grid gap-px overflow-hidden rounded-md border border-border bg-card sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 [&>*]:bg-card [&>*]:outline [&>*]:outline-1 [&>*]:-outline-offset-[0.5px] [&>*]:outline-border">
        {templates?.map((template) => {
          const kind = fileKind(template.file_name)
          return (
            /* `focus-visible:` classes `[FIXED 2026-08-23]`: the grid draws its cell
               dividers as `[&>*]:outline-1` on these links, which beats the global
               `:focus-visible` rule in theme.css and left focus invisible. Same defect
               and same fix as CoursesCatalogue — see the fuller note there. */
            <Link
              key={template.slug}
              to={`/templates/${template.id}`}
              className="group flex h-full flex-col bg-card transition-colors duration-150 hover:bg-card-2 focus-visible:relative focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
            >
              <div className="flex flex-1 flex-col px-4 pt-3 pb-4">
                <div className="flex items-center gap-2">
                  {kind && (
                    <span className="shrink-0 rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[0.625rem] font-medium tracking-wide text-muted-foreground">
                      {kind}
                    </span>
                  )}
                  {template.version && (
                    <span className="shrink-0 font-mono text-[0.625rem] text-muted-foreground">
                      v{template.version}
                    </span>
                  )}
                </div>

                {/* `[ADDED 2026-08-22, owner direction]` "the card title and description must
                    never affect the metadata and pricing + view/see-what's-included row".
                    `mt-auto` already pins the metadata+CTA pair to the card's bottom, but cards in
                    a CSS grid row stretch to the tallest, so one two-line title changed the height
                    of every card beside it. Both title and description are clamped to two lines and
                    the block reserves that height whether or not the text fills it — so the text
                    region is identical on every card, the cards sit a little taller (as asked), and
                    the bottom rows line up across the whole grid. */}
                <div className="min-h-[5.25rem]">
                  <h3 className="mt-2 text-sm font-semibold text-foreground decoration-1 underline-offset-4 group-hover:underline line-clamp-2">
                    {template.title}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{template.description}</p>
                </div>

                {/* `[FIXED 2026-08-22]` `mt-auto` moved from the footer up to here, so the
                    metadata and the price/CTA row form one bottom-anchored block and line up
                    across a row of cards regardless of title/description length. See
                    CoursesCatalogue for the full note. */}
                <Meta
                  className="mt-auto pt-2"
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

                <StarRating
                  rating={template.rating}
                  reviewCount={template.review_count}
                  className="pt-2"
                />
                <div className="flex items-center justify-between border-t border-border pt-2.5">
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
      )}
    </div>
  )
}
