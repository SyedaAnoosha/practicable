import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import { recordRecommendationClick } from '@/lib/recommendationEvents'
import { QuestionLink } from './QuestionLink'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

interface RelatedProduct {
  slug: string
  name: string
  price_amount: number
  currency: string
}

interface RoutedProductsProps {
  questionSlug: string
  /** The question's title — rendered in the panel explanation so the recommendation
   *  names a real question, per week4_plan.md Phase 4 DoD item 1. */
  questionTitle: string
}

export function RoutedProducts({ questionSlug, questionTitle }: RoutedProductsProps) {
  const { data: products, isLoading } = useQuery({
    queryKey: queryKeys.questions.relatedProducts(questionSlug),
    queryFn: () => api.get<RelatedProduct[]>(`/questions/${questionSlug}/related-products`).then((r) => r.data),
    enabled: !!questionSlug,
  })

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <div className="h-6 w-32 rounded bg-muted" />
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

  // W4-R4 item 6: both routes to the product record the click, because a reader who
  // taps the title and a reader who taps the button followed the same recommendation.
  const onRecommendationClick = (productSlug: string) =>
    recordRecommendationClick({ surface: 'question', productSlug, questionSlug })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Products that include this question</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">
          We're suggesting this because it addresses{' '}
          <QuestionLink question={{ slug: questionSlug, title: questionTitle }} /> — the
          question you're viewing. Buying any of these gives you this question and
          everything else the product includes.
        </p>
        <div className="space-y-3">
          {products.map((product, index) => (
            <div
              key={product.slug}
              className="flex items-center justify-between rounded-lg border border-border bg-secondary/40 p-4"
              style={{ animationDelay: `${index * 50}ms` }}
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
