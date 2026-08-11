import { Link, useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { useAuthStore } from '@/stores/useAuthStore'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { PageTitle } from '@/components/ui/PageTitle'

interface Tag {
  dimension: string
  value: string
  display_label: string
}

interface QuestionData {
  id: string
  slug: string
  title: string
  subtitle?: string
  preview: string
  body?: string
  domain: string
  tags: Tag[]
  gated: boolean
  related_content: Array<{ slug: string; name: string; price_amount: number; currency: string }>
}

// DESIGN.md §21.3's badge-variant semantics: outline for ROI horizon, accent for
// regulator pressure (the only emphasised dimension), muted for everything else.
const TAG_VARIANT: Record<string, 'outline' | 'accent' | 'muted'> = {
  roi_horizon: 'outline',
  regulator_pressure: 'accent',
}

export function Question() {
  const { slug } = useParams<{ slug: string }>()
  const user = useAuthStore((s) => s.user)

  const { data: question, isLoading, error } = useQuery({
    queryKey: queryKeys.questions.detail(slug ?? ''),
    queryFn: () => api.get<QuestionData>(`/questions/${slug}`).then((res) => res.data),
    enabled: !!slug,
  })

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading…</div>
  if (error) return <div className="p-8 text-destructive">We couldn't load this question. Check your connection and try again.</div>
  if (!question) return null

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-12 sm:px-8">
      <PageTitle eyebrow={question.domain} title={question.title} description={question.subtitle} />

      <p className="mt-6 text-lg text-muted-foreground">{question.preview}</p>

      {/* DESIGN.md §21.2: the seven tags as a definition grid, not a row of badges */}
      <dl className="mt-8 grid grid-cols-1 gap-4 border-y border-border py-6 sm:grid-cols-2">
        {question.tags.map((tag) => (
          <div key={`${tag.dimension}-${tag.value}`}>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">{tag.dimension.replace('_', ' ')}</dt>
            <dd className="mt-1">
              <Badge variant={TAG_VARIANT[tag.dimension] ?? 'muted'}>{tag.display_label}</Badge>
            </dd>
          </div>
        ))}
      </dl>

      <section className="mt-8">
        <h2 className="font-sans font-semibold" style={{ fontSize: 'var(--text-h4)' }}>
          Guidance
        </h2>

        {question.gated ? (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle style={{ fontSize: 'var(--text-h4)' }}>🔒 The rest of this guidance is part of a paid product</CardTitle>
              <CardDescription>
                {question.related_content[0]
                  ? `${question.related_content[0].name} — ${formatCurrency(
                      question.related_content[0].price_amount,
                      question.related_content[0].currency,
                    )}. Unlocks the full answer and the related template.`
                  : 'Unlock the full answer and the related template.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 sm:flex-row">
              {question.related_content[0] && (
                // DESIGN.md §21.4 / week1_plan.md Phase 4 step 9: this is a direct buy
                // surface, not a link into a catalogue — one click to the pre-checkout
                // summary for the one product that unlocks this. /buy/:slug lives under
                // MemberLayout, whose auth guard redirects a logged-out click to sign-in.
                <Link to={`/buy/${question.related_content[0].slug}`} className="sm:flex-1">
                  <Button className="w-full">See what's included</Button>
                </Link>
              )}
              {!user && (
                <Link to="/sign-in" className="sm:flex-1">
                  <Button variant="outline" className="w-full">
                    Already bought it? Sign in
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          <p className="mt-4 whitespace-pre-line font-serif text-read leading-relaxed text-foreground">{question.body}</p>
        )}
      </section>
    </div>
  )
}
