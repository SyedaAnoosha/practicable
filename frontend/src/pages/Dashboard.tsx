import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, CircleCheck, Download, FileQuestion, PlayCircle, Search } from 'lucide-react'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import { useAuthStore } from '@/stores/useAuthStore'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { PageTitle } from '@/components/ui/PageTitle'
import { TAG_VARIANT, cardTags } from '@/lib/tags'

// This page names no content: featured items come from the published lists
// (`/questions`, `/products`), so it shows what is actually live and renders nothing
// when something isn't, rather than a stale slug pointing at a 404'd or unpublished item.
// Each chip carries the real catalogue filter it stands for, matching
// QuestionsCatalogue's FILTER_PARAMS and the seeded tag vocabulary.
const FINDER_CHIPS = [
  { label: 'Do it in a fortnight', param: 'duration', value: 'S' },
  { label: 'Do it cheaply', param: 'cost', value: '$' },
  { label: 'Show your regulator', param: 'regulator_pressure', value: 'H' },
] as const

interface QuestionTag {
  dimension: string
  value: string
  display_label: string
}

interface QuestionSummary {
  id: string
  slug: string
  title: string
  subtitle?: string | null
  preview: string
  domain: string
  tags: QuestionTag[]
}

interface ProductContent {
  content_type: string
  label: string
  href: string | null
}

// The product API computes the right route per content_type; this just picks the
// icon that matches.
const CONTENT_ICON: Record<string, typeof PlayCircle> = {
  lesson: PlayCircle,
  template: Download,
  question_set: FileQuestion,
}

interface ProductData {
  id: string
  slug: string
  name: string
  description: string
  price_amount: number
  currency: string
  contents: ProductContent[]
}

// Card rules live in lib/tags.ts (TAG_VARIANT + cardTags), so Home's featured question
// and this one render identical tags — one source of truth.

// The signed-in home page, split out from the public landing page (Home.tsx), which
// exists only to get someone to create an account or log in.
export function Dashboard() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const user = useAuthStore((s) => s.user)
  const firstName = (user?.user_metadata?.name as string | undefined)?.split(' ')[0]

  // The list endpoint, not a detail fetch: `/questions` already returns everything
  // this card needs, and the finder below reuses the same cached list.
  const { data: questions } = useQuery({
    queryKey: queryKeys.questions.list(),
    queryFn: () => api.get<QuestionSummary[]>('/questions/index').then((res) => res.data),
  })
  const question = questions?.[0]

  const { data: products } = useQuery({
    queryKey: queryKeys.products.list(),
    queryFn: () => api.get<ProductData[]>('/products').then((res) => res.data),
  })
  // Newest published product — "featured" is recency, not a real editorial flag.
  const product = products?.[0]

  // ProductBuy.tsx got this same fix; this card is a separate render path.
  const { data: entitlements } = useQuery({
    queryKey: queryKeys.me.entitlements(),
    queryFn: () => api.get<{ product_ids: string[] }>('/me/entitlements').then((res) => res.data),
  })
  const alreadyOwnsProduct = !!product && !!entitlements?.product_ids.includes(product.id)

  // Real navigation: a typed query goes to the catalogue with the search applied;
  // an empty submit just opens the catalogue.
  const goToQuestion = (e?: FormEvent) => {
    e?.preventDefault()
    const q = query.trim()
    navigate(q ? `/questions?q=${encodeURIComponent(q)}` : '/questions')
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-8">
      <PageTitle
        eyebrow="Your home"
        title={firstName ? `Welcome back, ${firstName}` : 'Welcome back'}
        description="Find the question you're trying to answer, then learn and apply it."
      />

      {/* The finder, contained so it reads as the page's centrepiece rather than a
          bare input: visible label, the question-as-placeholder, and the preset chips
          with the spec's "Try:" prefix. All of it is honest navigation — it goes to the
          one question that actually exists. */}
      <form onSubmit={goToQuestion} className="mx-auto mt-6 max-w-2xl">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <label htmlFor="dashboard-finder" className="text-sm font-medium text-foreground">
            What are you trying to solve?
          </label>
          <div className="relative mt-3">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="dashboard-finder"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search the questions…"
              className="h-14 rounded-xl pl-11 text-base"
            />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground" aria-hidden="true">
              Try:
            </span>
            {FINDER_CHIPS.map((chip) => (
              <Link
                key={chip.label}
                to={`/questions?${chip.param}=${encodeURIComponent(chip.value)}`}
                className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {chip.label}
              </Link>
            ))}
          </div>
        </div>
      </form>

      {/* Questions — the card shows three decision-relevant tags with the semantic
          variants, serif preview, §19.3's left-rule treatment, and the spec's 2px
          hover lift (§39.2). The eyebrow doubles as the h2 so the CardTitle h3 below
          it lands in sequence (§42.1). */}
      {question && (
        <section className="mt-9">
          <h2 className="eyebrow">Live now · {question.domain}</h2>
          <Card
            className="hover-lift mt-4 border-l-4"
            style={{ borderLeftColor: 'var(--accent)' }}
          >
            <CardHeader>
              <CardTitle>{question.title}</CardTitle>
              {question.subtitle && <CardDescription>{question.subtitle}</CardDescription>}
            </CardHeader>
            <CardContent>
              <p className="max-w-3xl font-serif text-read text-muted-foreground">{question.preview}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {cardTags(question.tags).map((tag) => (
                  <Badge key={`${tag.dimension}-${tag.value}`} variant={TAG_VARIANT[tag.dimension]}>
                    {tag.display_label}
                  </Badge>
                ))}
              </div>
              <Link to={`/questions/${question.slug}`} className="mt-6 inline-flex">
                <Button>
                  Read the answer <ArrowRight className="size-4" aria-hidden="true" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Templates & courses — access states: owned shows the library state and
          never a price; not owned shows the price and the buy path. The content list
          links (with per-type icons) are real routes computed by the products API. */}
      {product && (
        <section className="mt-9">
          <h2 className="eyebrow">Templates & tools</h2>
          <Card className="hover-lift mt-4">
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>{product.name}</CardTitle>
                <Badge variant={alreadyOwnsProduct ? 'success' : 'outline'}>
                  {alreadyOwnsProduct ? 'In your library' : 'Most popular'}
                </Badge>
              </div>
              <CardDescription>{product.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <ul className="flex flex-col gap-2 text-sm">
                {product.contents.map((content) => {
                  const Icon = CONTENT_ICON[content.content_type] ?? FileQuestion
                  // Lesson/template links 403 gracefully with a clear message, so it's
                  // safe to always link rather than leave content unreachable.
                  if (content.href) {
                    return (
                      <li key={content.label}>
                        <Link
                          to={content.href}
                          className="flex items-center gap-2 text-foreground transition-colors hover:text-primary"
                        >
                          <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
                          {content.label}
                        </Link>
                      </li>
                    )
                  }
                  return (
                    <li key={content.label} className="flex items-center gap-2 text-muted-foreground">
                      <Icon className="size-4 shrink-0" aria-hidden="true" />
                      {content.label}
                    </li>
                  )
                })}
              </ul>
              {alreadyOwnsProduct ? (
                <p className="flex shrink-0 items-center gap-2 text-sm text-foreground sm:text-right" role="status">
                  <CircleCheck className="size-4 shrink-0 text-success" aria-hidden="true" />
                  In your library — lifetime access.
                </p>
              ) : (
                <div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
                  {/* Accent-blue like the question-page buy card: large marketing price,
                      the one figure allowed to be the accent (24px, large-text-safe). */}
                  <p className="text-2xl font-semibold tabular-nums text-accent">
                    {formatCurrency(product.price_amount, product.currency)}
                  </p>
                  <p className="text-xs text-muted-foreground">One-time purchase · lifetime access</p>
                  <Link to={`/buy/${product.slug}`}>
                    <Button>See what's included</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {/* Counted from the response rather than written down. This line has already been
          wrong twice — it said "one question and one template" after the 100-question
          seed landed, then "100 questions, one template, one course" after the catalogue
          moved on again. A hand-maintained count of a database is a claim that goes
          stale silently, on the page where a paying member is deciding whether to trust
          what else it says. */}
      {questions && questions.length > 0 && (
        <p className="mt-9 text-center text-sm text-muted-foreground">
          {questions.length === 1 ? '1 question is' : `All ${questions.length} questions are`} live
          today
          {products && products.length > 0 && (
            <>
              , plus {products.length} {products.length === 1 ? 'product' : 'products'} in the store
            </>
          )}
          {' '}— more are added weekly.
        </p>
      )}
    </div>
  )
}
