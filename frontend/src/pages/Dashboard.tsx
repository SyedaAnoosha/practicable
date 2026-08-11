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
  href: string | null
}

// The actual bug this fixes: content items had no href at all, so "watch the video"
// and "download the template" were unreachable regardless of ownership — the product
// API only ever returned a label. app/api/v1/commerce/products.py now computes the
// right route per content_type; this just picks the icon that matches.
const CONTENT_ICON: Record<string, typeof PlayCircle> = {
  lesson: PlayCircle,
  template: Download,
  question_set: FileQuestion,
}

interface ProductData {
  id: string
  name: string
  description: string
  price_amount: number
  currency: string
  contents: ProductContent[]
}

// §20.2's card rules live in lib/tags.ts (TAG_VARIANT + cardTags) so Home's featured
// question and this one render identical tags — one source of truth, no drift.

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

      {/* §19.1's finder, contained so it reads as the page's centrepiece rather than a
          bare input: visible label, the question-as-placeholder, and the preset chips
          with the spec's "Try:" prefix. All of it is honest navigation — it goes to the
          one question that actually exists. */}
      <form onSubmit={goToQuestion} className="mx-auto mt-10 max-w-2xl">
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
        </div>
      </form>

      {/* Questions — §20.2's card: three decision-relevant tags with the semantic
          variants, serif preview, §19.3's left-rule treatment, and the spec's 2px
          hover lift (§39.2). The eyebrow doubles as the h2 so the CardTitle h3 below
          it lands in sequence (§42.1). */}
      {question && (
        <section className="mt-14">
          <h2 className="eyebrow">Live now · {question.domain}</h2>
          <Card
            className="mt-4 border-l-4 transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-md"
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
              <Link to={`/questions/${WEEK1_QUESTION_SLUG}`} className="mt-6 inline-flex">
                <Button>
                  Read the answer <ArrowRight className="size-4" aria-hidden="true" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Templates & courses — §23.2's access states: owned shows the library state and
          never a price; not owned shows the price and the buy path. The content list
          links (with per-type icons) are real routes computed by the products API. */}
      {product && (
        <section className="mt-14">
          <h2 className="eyebrow">Templates & tools</h2>
          <Card className="mt-4 transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-md">
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
                  // Lesson/template links 403 gracefully with a clear "not entitled
                  // yet" message (Lesson.tsx/Template.tsx already handle that state),
                  // so it's safe to always link — not just once alreadyOwnsProduct is
                  // confirmed — rather than leave content unreachable in between.
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
                  {/* Accent-blue like the question-page buy card — large marketing price,
                      the one figure allowed to be the accent (24px, large-text-safe). */}
                  <p className="text-2xl font-semibold tabular-nums text-accent">
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
