import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { api } from '@/lib/api/client'
import { track } from '@/lib/analytics'
import { queryKeys } from '@/lib/query/keys'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

interface RelatedProduct {
  slug: string
  name: string
  price_amount: number
  currency: string
}

interface SituationProductsProps {
  questionIds: string[]
  /** The titles of the questions the user filtered by — rendered in the panel
   *  explanation so the recommendation names real questions, per week4_plan.md
   *  W4-R4 acceptance: "Every recommendation states at least one real question
   *  it routes through, by title, as a link." */
  questionTitles: string[]
  /** Same questions' slugs, same order as `questionIds`/`questionTitles` — kept
   *  separate from `questionIds` because the analytics contract's `question_slug`
   *  field is a slug, not the question's database id, and the two must never be
   *  conflated in a tracked event. */
  questionSlugs: string[]
}

export function SituationProducts({ questionIds, questionTitles, questionSlugs }: SituationProductsProps) {
  const { data: products, isLoading } = useQuery({
    queryKey: queryKeys.products.forQuestions(questionIds),
    queryFn: () => {
      if (questionIds.length === 0) return Promise.resolve([])
      // FastAPI's `ids: List[str] = Query(...)` expects a REPEATED query param
      // (?ids=a&ids=b), not one comma-joined value — a single `ids=a,b,c` parses as a
      // one-element list containing the literal string "a,b,c", which then fails
      // uuid.UUID(...) server-side with a 400 on every real multi-question request.
      // URLSearchParams with `append` per id produces the repeated form.
      const params = new URLSearchParams()
      for (const id of questionIds) params.append('ids', id)
      return api
        .get<RelatedProduct[]>(`/products/for-questions?${params.toString()}`)
        .then((r) => r.data)
    },
    enabled: questionIds.length > 0,
  })

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <div className="h-6 w-48 rounded bg-muted" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="h-4 w-full rounded bg-muted" />
            <div className="h-4 w-3/4 rounded bg-muted" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!products || products.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Products for your situation</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">
          We're suggesting these because they address{' '}
          {questionTitles.length <= 3 ? (
            questionTitles.map((title, i) => (
              <span key={title}>
                {i > 0 && (i === questionTitles.length - 1 ? ' and ' : ', ')}
                <strong>{title}</strong>
              </span>
            ))
          ) : (
            <>
              <strong>{questionTitles[0]}</strong>,{' '}
              <strong>{questionTitles[1]}</strong>, and{' '}
              {questionTitles.length - 2} other question
              {questionTitles.length - 2 > 1 ? 's' : ''}
            </>
          )}{' '}
          — which match your constraints.
        </p>
        <div className="space-y-3">
          {products.map((product) => (
            <div
              key={product.slug}
              className="flex items-center justify-between rounded-lg border border-border bg-secondary/40 p-4"
            >
              <div className="min-w-0 flex-1">
                <Link
                  to={`/buy/${product.slug}`}
                  className="font-medium text-foreground underline-offset-2 hover:underline"
                  onClick={() =>
                    track('recommendation_clicked', {
                      // A real slug, not a question id — this panel can be driven by
                      // several matched questions at once, so the first stands in for
                      // "which situation drove this", same as questionTitles[0] does
                      // in the explanation copy above.
                      question_slug: questionSlugs[0] ?? '',
                      product_slug: product.slug,
                    })
                  }
                >
                  {product.name}
                </Link>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatCurrency(product.price_amount, product.currency)}
                </p>
              </div>
              <Link to={`/buy/${product.slug}`}>
                <Button size="sm">View</Button>
              </Link>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
