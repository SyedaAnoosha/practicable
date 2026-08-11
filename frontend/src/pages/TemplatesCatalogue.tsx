import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { CircleCheck, FileSpreadsheet } from 'lucide-react'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { PageTitle } from '@/components/ui/PageTitle'
import { EmptyState } from '@/components/ui/EmptyState'

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
}

// The template catalogue (DESIGN.md §41's /templates) — the sidebar's third
// destination. Owned templates link straight to the download page; not-owned ones
// link to the real pre-checkout summary for whichever product actually sells them.
export function TemplatesCatalogue() {
  const { data: templates, isLoading } = useQuery({
    queryKey: queryKeys.templates.list(),
    queryFn: () => api.get<TemplateSummary[]>('/templates').then((res) => res.data),
  })

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8">
      <PageTitle
        eyebrow="Use"
        title="Templates"
        description="Ready-to-use working files — the practical companion to the guidance and courses."
      />

      {isLoading && (
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-44 animate-pulse rounded-xl border border-border bg-muted/40" />
          ))}
        </div>
      )}

      {!isLoading && templates?.length === 0 && (
        <EmptyState
          className="mt-10"
          icon={FileSpreadsheet}
          title="No templates yet"
          description="The first template is on its way — check back soon."
        />
      )}

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        {templates?.map((template) => (
          <Card key={template.slug} className="flex flex-col transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-md">
            <CardHeader>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <FileSpreadsheet className="size-4" aria-hidden="true" />
              </span>
              <CardTitle className="mt-3">{template.title}</CardTitle>
              <CardDescription>{template.description}</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto flex items-center justify-between gap-3">
              {template.owned ? (
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
                  <p className="text-sm font-semibold tabular-nums text-foreground">
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
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
