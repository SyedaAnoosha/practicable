import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { CircleCheck, FileText, Layers, HelpCircle } from 'lucide-react'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import { Badge } from '@/components/ui/Badge'
import { PageTitle } from '@/components/ui/PageTitle'
import { EmptyState } from '@/components/ui/EmptyState'
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
  const { data: packs, isLoading } = useQuery({
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

      {!isLoading && packs?.length === 0 && (
        <EmptyState
          className="mt-6"
          icon={Layers}
          title="No packs yet"
          description="Reference packs will appear here as they're published."
        />
      )}

      {/* Divided-columns grid: broadsheet treatment, not rounded cards. */}
      <div className="mt-6 grid overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 [&>*]:bg-card">
        {packs?.map((pack) => (
          <Link
            key={pack.slug}
            to={`/store/packs/${pack.slug}`}
            className="group block border-b border-border bg-card last:border-b-0 transition-colors duration-150 hover:bg-card-2 sm:[&:nth-last-child(-n+4)]:border-b-0 sm:[&:nth-child(4n)]:border-b-0 lg:[&:nth-last-child(-n+3)]:border-b-0 lg:[&:nth-child(3n)]:border-b-0 xl:[&:nth-last-child(-n+4)]:border-b-0 xl:[&:nth-child(4n)]:border-b-0"
          >
            <div className="px-4 pt-3 pb-4">
              <p className="eyebrow">{pack.domain_name ?? 'Reference'}</p>
              <h3 className="mt-1.5 text-sm font-semibold text-foreground decoration-1 underline-offset-4 group-hover:underline">
                {pack.name}
              </h3>
              {pack.description && (
                <p className="mt-1 line-clamp-2 font-serif text-xs leading-relaxed text-muted-foreground">
                  {pack.description}
                </p>
              )}

              <Meta
                className="mt-2"
                items={[
                  { icon: HelpCircle, value: String(pack.question_count), label: pack.question_count === 1 ? 'question' : 'questions' },
                  { icon: FileText, value: 'PDF', label: 'reference document', numeric: false },
                ]}
              />

              <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5">
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
    </div>
  )
}
