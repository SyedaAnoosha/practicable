import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import { recordRecommendationClick } from '@/lib/recommendationEvents'
import { QuestionLink, type RoutedQuestion } from './QuestionLink'
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
  /** The questions the reader filtered to, named and linked in the explanation so the
   *  recommendation is checkable rather than asserted (W4-R4 acceptance 2). */
  questions: RoutedQuestion[]
}

export function SituationProducts({ questionIds, questions }: SituationProductsProps) {
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

  // W4-R4 item 6: both routes to the product record the click. No questionSlug — this
  // surface routes from a filter result set, not from one question, and inventing one
  // would make the metric lie about where the reader came from.
  const onRecommendationClick = (productSlug: string) =>
    recordRecommendationClick({ surface: 'catalogue', productSlug })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Products for your situation</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">
          We're suggesting these because they address{' '}
          {questions.length <= 3 ? (
            questions.map((q, i) => (
              <span key={q.slug}>
                {i > 0 && (i === questions.length - 1 ? ' and ' : ', ')}
                <QuestionLink question={q} />
              </span>
            ))
          ) : (
            <>
              <QuestionLink question={questions[0]} />,{' '}
              <QuestionLink question={questions[1]} />, and{' '}
              {questions.length - 2} other question
              {questions.length - 2 > 1 ? 's' : ''}
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
                  onClick={() => onRecommendationClick(product.slug)}
                  className="font-medium text-foreground underline-offset-2 hover:underline"
                >
                  {product.name}
                </Link>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatCurrency(product.price_amount, product.currency)}
                </p>
              </div>
              <Link to={`/buy/${product.slug}`} onClick={() => onRecommendationClick(product.slug)}>
                <Button size="sm">View</Button>
              </Link>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
