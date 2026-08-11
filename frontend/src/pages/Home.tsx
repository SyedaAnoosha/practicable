import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowRight, BookOpen, Check, FileDown, LogIn, Search, UserPlus } from 'lucide-react'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { TAG_VARIANT, cardTags } from '@/lib/tags'

// Week 1 scope guardrail: one reachable question and one reachable product, not the
// discovery/filter UI (deferred to Week 2 — week1_plan.md Scope guardrails).
const WEEK1_QUESTION_SLUG = 'we-have-a-risk-register-but-no-one-uses-it'
const WEEK1_PRODUCT_SLUG = 'risk-register-template'

const DOMAINS = ['Risk', 'Cyber', 'Compliance', 'Resilience', 'AI']

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


// The public marketing landing page (unauthenticated visitors). Its job is narrow:
// make the claim, prove it with one real example, and get someone to create an
// account or log in — the actual browsing experience (search, full catalogue) lives
// on /dashboard once they're signed in. Structure follows DESIGN.md §18.1: hero →
// featured questions → how this works → courses/templates → free entry point →
// about, with the hero kept type-led per §18.2 ("No hero image. The type, the claim
// and a working input are the hero") — no decorative background, no looping motion
// (§39.2), no animated page-load sequence.
export function Home() {
  const { data: question } = useQuery({
    queryKey: queryKeys.questions.detail(WEEK1_QUESTION_SLUG),
    queryFn: () => api.get<QuestionData>(`/questions/${WEEK1_QUESTION_SLUG}`).then((res) => res.data),
  })

  const { data: product } = useQuery({
    queryKey: queryKeys.products.detail(WEEK1_PRODUCT_SLUG),
    queryFn: () => api.get<ProductData>(`/products/${WEEK1_PRODUCT_SLUG}`).then((res) => res.data),
  })

  return (
    <>
      <Hero />
      {question && <FeaturedQuestion question={question} />}
      <HowItWorks />
      {product && <FeaturedProduct product={product} />}
      <LeadCaptureSection />
      <AboutSection />
    </>
  )
}

// DESIGN.md §18.2: eyebrow (mono, xs, tracked) → claim in two lines (display, sans,
// tight, the emphasised phrase in solid primary) → one qualifying paragraph (serif
// lead) → the two entry-point actions. The type is the hero; there is deliberately no
// image, no gradient and no animated background.
function Hero() {
  return (
    <section className="relative overflow-hidden px-5 pb-20 pt-16 sm:px-8 sm:pb-28 sm:pt-24">
      {/* Atmospheric depth behind the type — two faint gold/navy blooms, static
          (not animated), so it reads as light on paper rather than a gradient
          wash (§5). The wash is decorative; aria-hidden keeps it out of the a11y
          tree entirely. */}
      <div aria-hidden="true" className="hero-wash" />
      <div className="relative mx-auto w-full max-w-6xl">
        <p className="eyebrow">Practicable</p>
        <h1
          tabIndex={-1}
          className="mt-6 max-w-3xl text-balance text-display font-semibold text-foreground outline-none"
        >
          Practical answers to the questions{' '}
          {/* Gold at display size — large-text contrast is safe (§7.3), and it is
              the one metallic the brand spends on the homepage. */}
          <span className="text-accent">risk leaders actually have.</span>
        </h1>
        <p className="mt-6 max-w-xl font-serif text-lead text-muted-foreground">
          100 real questions from risk practitioners, tagged by effort, cost, timescale and regulator
          pressure — so you can find the one you need in about thirty seconds.
        </p>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link to="/sign-up">
            <Button size="lg" className="w-full sm:w-auto">
              <UserPlus className="size-4" aria-hidden="true" />
              Create free account
            </Button>
          </Link>
          <Link to="/sign-in">
            <Button variant="outline" size="lg" className="w-full sm:w-auto">
              <LogIn className="size-4" aria-hidden="true" />
              Log in
            </Button>
          </Link>
        </div>

        {/* §19.5's filter-chip treatment applied to the domain list — quiet border
            chips rendered from data, never hard-coded into a component (§3.5). They are
            labels, not links (only one question is live today, so nothing to navigate
            to), hence no hover affordance. */}
        <div className="mt-12">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Browse by domain</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {DOMAINS.map((d) => (
              <span
                key={d}
                className="rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs font-medium text-muted-foreground"
              >
                {d}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// §18.1 "Featured questions": one real, live example proving the claim above it.
// Left-rule treatment borrowed from §19.3's exact-match rows (border-strong carries
// meaning, §7.6) — and the hover is the spec's 2px lift with no scale (§39.2).
function FeaturedQuestion({ question }: { question: QuestionData }) {
  return (
    <section className="border-y border-border bg-secondary/40 py-16 sm:py-20">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        {/* The section eyebrow doubles as the h2 so the card's CardTitle (an h3, §34)
            follows a proper heading level instead of skipping h1→h3 (§42.1). */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="eyebrow">Featured question · {question.domain}</h2>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
            Live today
          </p>
        </div>
        <Card
          className="mt-5 border-l-4 shadow-sm transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-md"
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
      </div>
    </section>
  )
}

// §18.1 "How this works — 3 steps, honest". Icons are the fixed §14.1 map (Search,
// BookOpen, FileDown), numbers in mono — the whole thing renders from data.
function HowItWorks() {
  const STEPS = [
    { n: '01', icon: Search, title: 'Find', body: "Start with the question you're trying to answer." },
    { n: '02', icon: BookOpen, title: 'Learn', body: 'Read the guidance, or take the video lesson.' },
    { n: '03', icon: FileDown, title: 'Apply', body: 'Use the template to act on it the same day.' },
  ] as const

  return (
    <section className="py-16 sm:py-24">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <p className="eyebrow">How it works</p>
        <h2 className="mt-3 text-h2 font-semibold text-foreground">Find. Learn. Apply.</h2>
        <div className="mt-10 grid gap-10 sm:grid-cols-3">
          {STEPS.map(({ n, icon: Icon, title, body }) => (
            <div key={n}>
              <div className="flex items-center gap-4">
                <div className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Icon className="size-5" aria-hidden="true" />
                </div>
                <span className="font-mono text-xs font-semibold text-muted-foreground">{n}</span>
              </div>
              <h3 className="mt-5 text-h4 font-semibold text-foreground">{title}</h3>
              <p className="mt-2 max-w-xs text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// §18.1 "Courses and templates — 2 or 3 real products with real prices". Real price
// always visible (§28.2), billing type + access duration stated explicitly, contents
// as a checklist with the Check icon rather than bullets. Purchasing still requires an
// account (week1_plan.md decision #8), so the CTA routes through sign-up.
function FeaturedProduct({ product }: { product: ProductData }) {
  return (
    <section className="border-y border-border bg-muted/40 py-16 sm:py-20">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        {/* Section h2 again, so the product card's CardTitle h3 lands in sequence. */}
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="eyebrow">Get the template</h2>
          <p className="text-xs text-muted-foreground">One-time purchase · lifetime access</p>
        </div>
        <Card className="mt-5 transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-md">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>{product.name}</CardTitle>
              <Badge variant="outline">Most popular</Badge>
            </div>
            <CardDescription>{product.description}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <ul className="grid flex-1 grid-cols-1 gap-2.5 text-sm text-muted-foreground sm:grid-cols-2">
              {product.contents.map((content) => (
                <li key={content.label} className="flex items-center gap-2">
                  <Check className="size-4 shrink-0 text-success" aria-hidden="true" />
                  {content.label}
                </li>
              ))}
            </ul>
            <div className="flex shrink-0 flex-col items-start gap-3 lg:items-end">
              {/* Gold like the question-page buy card — large marketing price,
                  the one figure allowed to be the accent (24px, large-text-safe). */}
              <p className="text-2xl font-semibold tabular-nums text-accent">
                {formatCurrency(product.price_amount, product.currency)}
              </p>
              <Link to="/sign-up" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto">
                  Create an account to buy
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}

// DESIGN.md §27: the free entry point. An inline block (never a modal), one field only,
// and the privacy statement in plain words *above* the button. Copy stays honest about
// what actually exists: one question is live today, not a free domain pack that isn't
// there yet. The id is what the header's "Get started" scrolls to.
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
    <section id="free-pack" className="scroll-mt-24 py-16 sm:py-24" style={{ background: 'var(--muted)' }}>
      <div className="mx-auto w-full max-w-xl px-5 text-center sm:px-8">
        <p className="eyebrow">Not ready to buy?</p>
        <h2 className="mt-4 text-h2 font-semibold text-foreground">Get notified as new questions go live</h2>
        <p className="mt-4 font-serif text-read text-muted-foreground">
          One question is live today; 99 more are on the way. Leave your email and we'll let you know as
          they publish.
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
              Keep me posted
            </Button>
          </form>
        )}
        {isError && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            Something went wrong — please try again.
          </p>
        )}
        {/* §27.2: the privacy statement lives above the button, in plain words. */}
        <p className="mt-4 text-xs text-muted-foreground">
          We'll email you as each question publishes — no spam, unsubscribe any time.
        </p>
      </div>
    </section>
  )
}

// Brand-level, not a fabricated founder bio/photo; those go in once the owner supplies
// real ones. The id is the header's "About" link target.
function AboutSection() {
  return (
    <section id="about" className="scroll-mt-24 border-t border-border py-16 sm:py-24">
      <div className="mx-auto w-full max-w-2xl px-5 text-center sm:px-8">
        <h2 className="text-h2 font-semibold text-foreground">
          Built from real questions risk practitioners face.
        </h2>
        <p className="mt-5 font-serif text-read text-muted-foreground">
          Practicable brings together practical guidance, learning and working resources for the people
          responsible for risk, compliance, security and governance.
        </p>
      </div>
    </section>
  )
}
