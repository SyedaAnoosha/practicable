import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { CircleCheck, FileText, Layers, HelpCircle } from 'lucide-react'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import { Badge } from '@/components/ui/Badge'
import { PageTitle } from '@/components/ui/PageTitle'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Meta } from '@/components/ui/Meta'

interface PackSummary {
  slug: string
  name: string
  description: string
  domain_name: string | null
  question_count: number
  price_amount: number
  currency: string
  owned: boolean
  is_bundle: boolean
}

/**
 * Pack catalogue — editorial divided-columns treatment.
 *
 * `[REDESIGNED 2026-08-22]` Was rounded cards with `border-l-4 border-l-accent` — the
 * AI card pattern. Now uses the broadsheet grid: border border-border bg-border,
 * each cell bg-card, square corners, title underlines on hover.
 */
export function PacksCatalogue() {
  // `[CHANGED 2026-08-22, F3 — P0]` See QuestionsCatalogue: without `isError` a failed
  // fetch rendered nothing at all.
  const { data: packs, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.packs.list(),
    queryFn: () => api.get<PackSummary[]>('/packs').then((res) => res.data),
  })

  return (
    <div className="relative isolate mx-auto w-full max-w-7xl px-5 py-8 sm:px-8">
      <div
        aria-hidden="true"
        className="page-wash absolute left-1/2 top-0 -z-10 h-[30rem] w-screen -translate-x-1/2"
      />
      <PageTitle
        eyebrow="Reference"
        title="Reference packs"
        description="Curated question packs with a downloadable reference document — domain-specific guidance bundles."
        action={
          packs && packs.length > 0 ? (
            <p className="font-mono text-sm tabular-nums text-muted-foreground">
              {packs.length} {packs.length === 1 ? 'pack' : 'packs'}
            </p>
          ) : undefined
        }
      />

      <h2 className="sr-only">Pack list</h2>

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
          title="We couldn't load the packs."
          description="Check your connection and try again."
          onRetry={() => void refetch()}
        />
      )}

      {!isLoading && !isError && packs?.length === 0 && (
        <EmptyState
          className="mt-6"
          icon={Layers}
          title="No packs yet"
          description="Reference packs will appear here as they're published."
        />
      )}

      {/* Divided-columns grid — see CoursesCatalogue for the full note. `bg-border`
          plus `[&>*]:bg-card` left every unfilled track in the last row painted as a
          beige slab; `gap-px` shows the rule only between real cells. Also gated so the
          empty frame no longer sits under the loading, error and empty states. */}
      {!isLoading && !isError && !!packs?.length && (
      <div className="mt-6 grid gap-px overflow-hidden rounded-md border border-border bg-card sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 [&>*]:bg-card [&>*]:outline [&>*]:outline-1 [&>*]:-outline-offset-[0.5px] [&>*]:outline-border">
        {packs?.map((pack) => (
          /* `focus-visible:` classes `[FIXED 2026-08-23]`: the grid draws its cell
             dividers as `[&>*]:outline-1` on these links, which beats the global
             `:focus-visible` rule in theme.css and left focus invisible. Same defect
             and same fix as CoursesCatalogue — see the fuller note there. */
          <Link
            key={pack.slug}
            to={`/store/packs/${pack.slug}`}
            className="group flex h-full flex-col bg-card transition-colors duration-150 hover:bg-card-2 focus-visible:relative focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
          >
            <div className="flex flex-1 flex-col px-4 pt-3 pb-4">
              <p className="eyebrow">{pack.domain_name ?? 'Reference'}</p>
              {/* `[ADDED 2026-08-22, owner direction]` "the card title and description must
                  never affect the metadata and pricing + view/see-what's-included row".
                  `mt-auto` already pins the metadata+CTA pair to the card's bottom, but cards in
                  a CSS grid row stretch to the tallest, so one two-line title changed the height
                  of every card beside it. Both title and description are clamped to two lines and
                  the block reserves that height whether or not the text fills it — so the text
                  region is identical on every card, the cards sit a little taller (as asked), and
                  the bottom rows line up across the whole grid. */}
              <div className="min-h-[5.25rem]">
                <h3 className="mt-1.5 text-sm font-semibold text-foreground decoration-1 underline-offset-4 group-hover:underline line-clamp-2">
                  {pack.name}
                </h3>
                {pack.description && (
                  <p className="mt-1 line-clamp-2 font-serif text-xs leading-relaxed text-muted-foreground">
                    {pack.description}
                  </p>
                )}
              </div>

              {/* `[FIXED 2026-08-22]` `mt-auto` moved from the footer up to here, so the
                  metadata and the price/CTA row form one bottom-anchored block and line up
                  across a row of cards regardless of title/description length. See
                  CoursesCatalogue for the full note. */}
              <Meta
                className="mt-auto pt-2"
                items={[
                  { icon: HelpCircle, value: String(pack.question_count), label: pack.question_count === 1 ? 'question' : 'questions' },
                  { icon: FileText, value: 'PDF', label: 'reference document', numeric: false },
                ]}
              />

              <div className="flex items-center justify-between border-t border-border pt-2.5">
                {pack.owned ? (
                  <Badge variant="success" className="gap-1 text-[0.625rem]">
                    <CircleCheck className="size-2.5" aria-hidden="true" /> Owned
                  </Badge>
                ) : (
                  <span className="font-mono text-xs tabular-nums text-foreground">
                    {formatCurrency(pack.price_amount, pack.currency)}
                  </span>
                )}
                <span className="text-xs font-medium text-accent">
                  {pack.owned ? 'Open' : 'View pack'}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
      )}
    </div>
  )
}
