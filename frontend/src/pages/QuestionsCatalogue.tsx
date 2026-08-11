import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { FileQuestion } from 'lucide-react'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { PageTitle } from '@/components/ui/PageTitle'
import { EmptyState } from '@/components/ui/EmptyState'
import { TAG_VARIANT, cardTags } from '@/lib/tags'

interface QuestionTag {
  dimension: string
  value: string
  display_label: string
}

interface QuestionSummary {
  id: string
  slug: string
  title: string
  subtitle: string | null
  preview: string
  domain: string
  tags: QuestionTag[]
}

// The question index (DESIGN.md §41's /questions) — every question's written
// guidance is free to read (the email-gate lives on the detail page, not here), so
// this list needs no entitlement handling at all.
export function QuestionsCatalogue() {
  const { data: questions, isLoading } = useQuery({
    queryKey: queryKeys.questions.list(),
    queryFn: () => api.get<QuestionSummary[]>('/questions').then((res) => res.data),
  })

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8">
      <PageTitle
        eyebrow="Find"
        title="Questions"
        description="Real questions from risk leaders, each tagged by effort, cost, duration and more."
      />

      {isLoading && (
        <div className="mt-10 flex flex-col gap-4">
          {[0, 1].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl border border-border bg-muted/40" />
          ))}
        </div>
      )}

      {!isLoading && questions?.length === 0 && (
        <EmptyState
          className="mt-10"
          icon={FileQuestion}
          title="No questions yet"
          description="The first question is on its way — check back soon."
        />
      )}

      <div className="mt-10 flex flex-col gap-4">
        {questions?.map((question) => (
          <Link key={question.slug} to={`/questions/${question.slug}`} className="group">
            <Card
              className="border-l-4 transition-[transform,box-shadow] duration-150 group-hover:-translate-y-0.5 group-hover:shadow-md"
              style={{ borderLeftColor: 'var(--accent)' }}
            >
              <CardHeader>
                <p className="eyebrow">{question.domain}</p>
                <CardTitle className="mt-1">{question.title}</CardTitle>
                {question.subtitle && <CardDescription>{question.subtitle}</CardDescription>}
              </CardHeader>
              <CardContent>
                <p className="max-w-3xl font-serif text-read text-muted-foreground">{question.preview}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {cardTags(question.tags).map((tag) => (
                    <Badge key={`${tag.dimension}-${tag.value}`} variant={TAG_VARIANT[tag.dimension]}>
                      {tag.display_label}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
