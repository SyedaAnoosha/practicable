import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Search } from 'lucide-react'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import { useAuthStore } from '@/stores/useAuthStore'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { PageTitle } from '@/components/ui/PageTitle'

// Week 1 scope guardrail: one reachable question and one reachable product, not the
// discovery/filter UI (deferred to Week 2 — week1_plan.md Scope guardrails).
const WEEK1_QUESTION_SLUG = 'we-have-a-risk-register-but-no-one-uses-it'
const WEEK1_PRODUCT_SLUG = 'risk-register-template'

const FINDER_CHIPS = ['Do it in a fortnight', 'Do it cheaply', 'Show your regulator']

interface QuestionTag {
  dimension: string
  value: string
  display_label: string
}

interface QuestionData {
  title: string
  subtitle?: string
  preview: string
  domain: string
  tags: QuestionTag[]
}

interface ProductContent {
  content_type: string
  label: string
}

interface ProductData {
  id: string
  name: string
  description: string
  price_amount: number
  currency: string
  contents: ProductContent[]
}

// The signed-in home page (/dashboard) — this is where "templates, courses,
// questions" actually live, split out from the public landing page (Home.tsx), which
// exists only to get someone to create an account or log in.
export function Dashboard() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const user = useAuthStore((s) => s.user)
  const firstName = (user?.user_metadata?.name as string | undefined)?.split(' ')[0]

  const { data: question } = useQuery({
    queryKey: queryKeys.questions.detail(WEEK1_QUESTION_SLUG),
    queryFn: () => api.get<QuestionData>(`/questions/${WEEK1_QUESTION_SLUG}`).then((res) => res.data),
  })

  const { data: product } = useQuery({
    queryKey: queryKeys.products.detail(WEEK1_PRODUCT_SLUG),
    queryFn: () => api.get<ProductData>(`/products/${WEEK1_PRODUCT_SLUG}`).then((res) => res.data),
  })

  // Without this, the product card here still showed "See what's included" / price
  // even for someone who already bought it — ProductBuy.tsx got this same fix, but
  // this card is a separate render path and needed it too.
  const { data: entitlements } = useQuery({
    queryKey: queryKeys.me.entitlements(),
    queryFn: () => api.get<{ product_ids: string[] }>('/me/entitlements').then((res) => res.data),
  })
  const alreadyOwnsProduct = !!product && !!entitlements?.product_ids.includes(product.id)

  // Only one real question exists in the catalogue today (the rest of the real
  // 100-question content, docs/questions/, hasn't been loaded into the database yet —
  // that's data entry, not a design gap). The finder is real, working navigation, not
  // a decorative input pretending to search a hundred rows that aren't there yet.
  const goToQuestion = (e?: FormEvent) => {
    e?.preventDefault()
    navigate(`/questions/${WEEK1_QUESTION_SLUG}`)
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-8">
      <PageTitle
        eyebrow="Your home"
        title={firstName ? `Welcome back, ${firstName}` : 'Welcome back'}
        description="Find the question you're trying to answer, then learn and apply it."
      />

      <form onSubmit={goToQuestion} className="mx-auto mt-10 max-w-xl">
        <label htmlFor="dashboard-finder" className="sr-only">
          Search the questions
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="dashboard-finder"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="What are you trying to solve?"
            className="h-14 rounded-xl pl-11 text-base"
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {FINDER_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => goToQuestion()}
              className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {chip}
            </button>
          ))}
        </div>
      </form>

      {/* Questions */}
      {question && (
        <section className="mt-14">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Live now · {question.domain}
          </p>
          <Card className="mt-4 border-l-4" style={{ borderLeftColor: 'var(--primary)' }}>
            <CardHeader>
              <CardTitle style={{ fontSize: 'var(--text-h3)' }}>{question.title}</CardTitle>
              {question.subtitle && <CardDescription>{question.subtitle}</CardDescription>}
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{question.preview}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {question.tags.slice(0, 4).map((tag) => (
                  <Badge key={`${tag.dimension}-${tag.value}`} variant="accent">
                    {tag.display_label}
                  </Badge>
                ))}
              </div>
              <Link to={`/questions/${WEEK1_QUESTION_SLUG}`} className="mt-6 inline-flex">
                <Button>
                  Read the answer <ArrowRight className="size-4" aria-hidden="true" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Templates & courses */}
      {product && (
        <section className="mt-14">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Templates & tools</p>
          <Card className="mt-4">
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>{product.name}</CardTitle>
                <Badge variant={alreadyOwnsProduct ? 'success' : 'outline'}>
                  {alreadyOwnsProduct ? '✓ Owned' : 'Most popular'}
                </Badge>
              </div>
              <CardDescription>{product.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
                {product.contents.map((content) => (
                  <li key={content.label}>· {content.label}</li>
                ))}
              </ul>
              {alreadyOwnsProduct ? (
                <p className="shrink-0 text-sm text-foreground sm:text-right" role="status">
                  You already own this — lifetime access.
                </p>
              ) : (
                <div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
                  <p className="font-sans text-2xl font-semibold">
                    {formatCurrency(product.price_amount, product.currency)}
                  </p>
                  <p className="text-xs text-muted-foreground">One-time purchase · lifetime access</p>
                  <Link to={`/buy/${WEEK1_PRODUCT_SLUG}`}>
                    <Button>See what's included</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      <p className="mt-14 text-center text-sm text-muted-foreground">
        One question and one template are live today — more are added weekly.
      </p>
    </div>
  )
}
