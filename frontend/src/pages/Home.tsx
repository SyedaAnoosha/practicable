import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowRight, Search } from 'lucide-react'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'

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
  name: string
  description: string
  price_amount: number
  currency: string
  contents: ProductContent[]
}

export function Home() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  const { data: question } = useQuery({
    queryKey: queryKeys.questions.detail(WEEK1_QUESTION_SLUG),
    queryFn: () => api.get<QuestionData>(`/questions/${WEEK1_QUESTION_SLUG}`).then((res) => res.data),
  })

  const { data: product } = useQuery({
    queryKey: queryKeys.products.detail(WEEK1_PRODUCT_SLUG),
    queryFn: () => api.get<ProductData>(`/products/${WEEK1_PRODUCT_SLUG}`).then((res) => res.data),
  })

  // Only one real question exists in the catalogue today (the rest of the real
  // 100-question content, docs/questions/, hasn't been loaded into the database yet —
  // that's data entry, not a design gap). The finder is real, working navigation, not
  // a decorative input pretending to search a hundred rows that aren't there yet.
  const goToQuestion = (e?: FormEvent) => {
    e?.preventDefault()
    navigate(`/questions/${WEEK1_QUESTION_SLUG}`)
  }

  return (
    <>
      {/* Hero — DESIGN.md §18.2: the type, the claim and a working input are the hero.
          No image, no gradient. */}
      <section className="mx-auto w-full max-w-7xl px-5 pb-16 pt-20 text-center sm:px-8 sm:pt-28">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Deciding in the Dark
        </p>
        <h1
          tabIndex={-1}
          className="mt-4 font-sans font-semibold tracking-tight text-foreground outline-none"
          style={{ fontSize: 'var(--text-display)' }}
        >
          Practical answers to the questions risk leaders actually have.
        </h1>
        <p className="mx-auto mt-6 max-w-xl font-serif text-lead text-muted-foreground">
          100 real questions from risk practitioners, tagged by effort, cost, timescale and regulator
          pressure — so you can find the one you need in about thirty seconds.
        </p>

        <form onSubmit={goToQuestion} className="mx-auto mt-10 max-w-xl text-left">
          <label htmlFor="home-finder" className="sr-only">
            Search the questions
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="home-finder"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="What are you trying to solve?"
              className="h-14 rounded-xl pl-11 text-base"
            />
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
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
      </section>

      {/* Featured question — the one real question live today. DESIGN.md §18.1 calls
          for three, from different domains; showing one real one honestly beats
          padding the page with two invented ones while the rest of the catalogue is
          still being loaded. */}
      {question && (
        <section className="border-y border-border bg-muted/30 py-16">
          <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Live now · {question.domain}
            </p>
            <Card className="mt-4">
              <CardHeader>
                <CardTitle style={{ fontSize: 'var(--text-h3)' }}>{question.title}</CardTitle>
                {question.subtitle && <CardDescription>{question.subtitle}</CardDescription>}
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{question.preview}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {question.tags.slice(0, 4).map((tag) => (
                    <Badge key={`${tag.dimension}-${tag.value}`}>{tag.display_label}</Badge>
                  ))}
                </div>
                <Link to={`/questions/${WEEK1_QUESTION_SLUG}`} className="mt-6 inline-flex">
                  <Button>
                    Read the answer <ArrowRight className="size-4" aria-hidden="true" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      {/* How it works */}
      <section className="py-16">
        <div className="mx-auto w-full max-w-4xl px-5 text-center sm:px-8">
          <h2 className="font-sans font-semibold" style={{ fontSize: 'var(--text-h2)' }}>
            Find. Learn. Apply.
          </h2>
          <div className="mt-10 grid gap-10 sm:grid-cols-3">
            {[
              ['01', 'Find', "Start with the question you're trying to answer."],
              ['02', 'Learn', 'Read the guidance, or take the video lesson.'],
              ['03', 'Apply', 'Use the template to act on it the same day.'],
            ].map(([n, title, body]) => (
              <div key={n} className="flex flex-col items-center">
                <div className="flex size-10 items-center justify-center rounded-full border border-border font-mono text-xs text-muted-foreground">
                  {n}
                </div>
                <p className="mt-4 font-sans font-semibold">{title}</p>
                <p className="mt-2 text-sm text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured product — the one real product, real price (DESIGN.md §18.1 /
          §28.2: price always visible, never hidden behind a click). */}
      {product && (
        <section className="border-y border-border bg-muted/30 py-16">
          <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Get the template</p>
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>{product.name}</CardTitle>
                <CardDescription>{product.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
                  {product.contents.map((content) => (
                    <li key={content.label}>· {content.label}</li>
                  ))}
                </ul>
                <div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
                  <p className="font-sans text-2xl font-semibold">
                    {formatCurrency(product.price_amount, product.currency)}
                  </p>
                  <p className="text-xs text-muted-foreground">One-time purchase · lifetime access</p>
                  <Link to={`/buy/${WEEK1_PRODUCT_SLUG}`}>
                    <Button>See what's included</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      <LeadCaptureSection />

      {/* About — brand-level, not a fabricated founder bio/photo; those go in once
          the owner supplies real ones. */}
      <section className="border-t border-border py-16">
        <div className="mx-auto w-full max-w-2xl px-5 text-center sm:px-8">
          <h2 className="font-sans font-semibold" style={{ fontSize: 'var(--text-h2)' }}>
            Built from real questions risk practitioners face.
          </h2>
          <p className="mt-4 font-serif text-read text-muted-foreground">
            Practicable brings together practical guidance, learning and working resources for the people
            responsible for risk, compliance, security and governance.
          </p>
        </div>
      </section>
    </>
  )
}

function LeadCaptureSection() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const { mutate, isPending, isError } = useMutation({
    mutationFn: () => api.post('/leads', { email, source: 'homepage_free_pack' }),
    onSuccess: () => setSubmitted(true),
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    mutate()
  }

  return (
    <section className="py-16">
      <div className="mx-auto w-full max-w-xl px-5 text-center sm:px-8">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Not ready to buy?</p>
        <h2 className="mt-3 font-sans font-semibold" style={{ fontSize: 'var(--text-h2)' }}>
          Get notified as new questions go live
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          One question is live today; 99 more are on the way. Leave your email and we'll let you know as
          they publish — no spam, unsubscribe any time.
        </p>

        {submitted ? (
          <p className="mt-8 text-foreground" role="status">
            You're on the list.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mx-auto mt-8 flex max-w-md flex-col gap-3 sm:flex-row">
            <label htmlFor="lead-email" className="sr-only">
              Your email address
            </label>
            <Input
              id="lead-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email address"
              className="flex-1"
            />
            <Button type="submit" loading={isPending}>
              Get the free pack
            </Button>
          </form>
        )}
        {isError && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            Something went wrong — please try again.
          </p>
        )}
        <p className="mt-3 text-xs text-muted-foreground">No payment required.</p>
      </div>
    </section>
  )
}
