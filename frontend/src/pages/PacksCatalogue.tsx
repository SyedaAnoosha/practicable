import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { CircleCheck, FileText, Layers, HelpCircle } from 'lucide-react'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import { Card } from '@/components/ui/Card'
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
 * Phase 8 (8G-2): The standalone /packs catalogue page.
 *
 * Previously, packs were only shown as a section inside /store. The Products menu
 * (8G) needs four distinct destinations, and a menu item that scrolls to a section
 * of a different page is the kind of half-link that makes navigation feel broken.
 *
 * This page follows the same pattern as CoursesCatalogue.tsx: page-wash header,
 * grid of cards, domain colour on each card, metadata row, price/owned state.
 * The /packs list endpoint already exists (content/packs.py:204).
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
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-56 animate-pulse rounded-xl border border-border bg-muted/40" />
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

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {packs?.map((pack) => (
          <Link key={pack.slug} to={`/store/packs/${pack.slug}`} className="group">
            <Card className="hover-lift flex h-full flex-col overflow-hidden border-l-4 border-l-accent">
              <div className="flex flex-1 flex-col p-5">
                <p className="eyebrow">{pack.domain_name ?? 'Reference'}</p>
                <h3 className="mt-2 text-h4 font-semibold text-foreground">{pack.name}</h3>
                {pack.description && (
                  <p className="mt-1.5 line-clamp-2 font-serif text-sm text-muted-foreground">
                    {pack.description}
                  </p>
                )}

                <Meta
                  className="mt-3"
                  items={[
                    {
                      icon: HelpCircle,
                      value: String(pack.question_count),
                      label: pack.question_count === 1 ? 'question' : 'questions',
                    },
                    {
                      icon: FileText,
                      value: 'PDF',
                      label: 'reference document',
                      numeric: false,
                    },
                  ]}
                />

                <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                  {pack.owned ? (
                    <Badge variant="success" className="gap-1">
                      <CircleCheck className="size-3" aria-hidden="true" />
                      In your library
                    </Badge>
                  ) : (
                    <p className="font-mono text-sm font-semibold tabular-nums text-foreground">
                      {formatCurrency(pack.price_amount, pack.currency)}
                    </p>
                  )}
                  <span className="shrink-0 text-sm font-medium text-accent group-hover:underline">
                    {pack.owned ? 'Open' : 'View pack'}
                  </span>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
