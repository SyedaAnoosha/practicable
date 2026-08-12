import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowRight, Search } from 'lucide-react'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { domainColorVar, domainVisual } from '@/lib/domainVisuals'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'

const DOMAINS = [
  { name: 'Risk (Enterprise & op.)', label: 'Risk', description: 'Ownership, decision-making and risk appetite.' },
  { name: 'Cyber (Tech & security)', label: 'Cyber', description: 'Threat exposure, controls and incident readiness.' },
  { name: 'Compliance (Regulatory)', label: 'Compliance', description: 'Obligations, audits and regulator relationships.' },
  { name: 'Resilience (Continuity)', label: 'Resilience', description: 'Continuity planning and operational shock.' },
  { name: 'AI (Governance)', label: 'AI', description: 'Model risk, oversight and responsible use.' },
] as const

// The real tag vocabulary (Duration: XS/S/M/L/XL, Cost: $/$$/$$$, Regulator pressure:
// N/L/M/H). A chip only ever matches a real tag row, never fuzzy text.
const FINDER_CHIPS = [
  { label: '2 weeks or less', test: (t: QuestionTag) => t.dimension === 'duration' && (t.value === 'XS' || t.value === 'S') },
  { label: 'Low cost', test: (t: QuestionTag) => t.dimension === 'cost' && t.value === '$' },
  { label: 'Regulator pressure', test: (t: QuestionTag) => t.dimension === 'regulator_pressure' && (t.value === 'M' || t.value === 'H') },
] as const

interface QuestionTag {
  dimension: string
  value: string
  display_label: string
  sort_order: number
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

// The public marketing landing page. Leads with a working question finder rather than
// a claim about one, since question discovery is the differentiator; courses and
// templates get their own catalogue pages instead of being pitched here.
export function Home() {
  const { data: questions } = useQuery({
    queryKey: queryKeys.questions.list(),
    queryFn: () => api.get<QuestionSummary[]>('/questions').then((res) => res.data),
  })

  return (
    <>
      <Hero questions={questions} />
      <DomainSection questions={questions} />
      <QuestionsTeaser questions={questions} />
      <LeadCaptureSection />
      <AboutSection />
    </>
  )
}

// The finder is the hero: a working input above the fold rather than a CTA pair. Chips
// filter the already-fetched question list by real tag rows, never by fuzzy text.
function Hero({ questions }: { questions: QuestionSummary[] | undefined }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [activeChip, setActiveChip] = useState<string | null>(null)

  const activeTest = FINDER_CHIPS.find((c) => c.label === activeChip)?.test

  const matches = useMemo(() => {
    if (!questions) return []
    const q = query.trim().toLowerCase()
    return questions.filter((item) => {
      const textOk = !q || item.title.toLowerCase().includes(q) || item.preview.toLowerCase().includes(q)
      const chipOk = !activeTest || item.tags.some(activeTest)
      return textOk && chipOk
    })
  }, [questions, query, activeTest])

  const searching = query.trim().length > 0 || activeChip !== null

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (matches[0]) navigate(`/questions/${matches[0].slug}`)
  }

  return (
    <section className="relative overflow-hidden px-5 pb-16 pt-16 sm:px-8 sm:pb-20 sm:pt-24">
      {/* Atmospheric depth behind the type — a static three-stop gradient wash in
          shades of blue. Decorative, so it stays out of the a11y tree. */}
      <div aria-hidden="true" className="hero-wash" />
      <div className="relative mx-auto w-full max-w-3xl text-center">
        <p className="eyebrow animate-enter justify-center">Deciding in the Dark</p>
        <h1
          tabIndex={-1}
          className="text-gradient-brand animate-enter mt-6 text-balance text-display font-semibold outline-none"
          style={{ animationDelay: '60ms' }}
        >
          Practical answers for risk practitioners.
        </h1>
        <p className="animate-enter mt-5 font-serif text-lead text-muted-foreground" style={{ animationDelay: '120ms' }}>
          What are you trying to solve right now?
        </p>

        <form onSubmit={handleSubmit} className="animate-enter mx-auto mt-8 max-w-xl" style={{ animationDelay: '180ms' }}>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-primary/70"
              aria-hidden="true"
            />
            <label htmlFor="home-finder" className="sr-only">
              Search the questions
            </label>
            <Input
              id="home-finder"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search the questions…"
              className="h-14 rounded-xl border-border-strong/60 pl-11 text-base shadow-sm focus-visible:outline-primary"
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs text-muted-foreground" aria-hidden="true">
              Try:
            </span>
            {FINDER_CHIPS.map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => setActiveChip((current) => (current === chip.label ? null : chip.label))}
                aria-pressed={activeChip === chip.label}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                  activeChip === chip.label
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-secondary/50 text-muted-foreground hover:border-primary hover:text-primary'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </form>

        {/* Live results, appearing only once the visitor has asked for something. */}
        {searching && (
          <div className="mx-auto mt-6 max-w-xl text-left">
            {matches.length === 0 ? (
              <EmptyState
                title="No questions match yet"
                description="Try a different search, or clear the filter to see everything live today."
              />
            ) : (
              <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border-strong/60 bg-card shadow-sm">
                {matches.slice(0, 6).map((q) => (
                  <li key={q.slug}>
                    <Link
                      to={`/questions/${q.slug}`}
                      className="block border-l-2 border-l-transparent px-5 py-4 transition-colors duration-150 hover:border-l-primary hover:bg-secondary/50"
                    >
                      <p className="eyebrow text-primary/80">{q.domain}</p>
                      <p className="mt-1 font-medium text-foreground">{q.title}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

// A numbered list with real per-domain counts, computed from the same fetched list the
// finder uses rather than a second request. Each domain's signature colour is applied
// via inline CSS variables, not a Tailwind class string: the colour is chosen from data
// at render time, and Tailwind's JIT only generates classes it can see literally.
function DomainSection({ questions }: { questions: QuestionSummary[] | undefined }) {
  return (
    <section className="border-t border-border py-16 sm:py-20">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <p className="eyebrow">Or start with a domain</p>
        <div className="mt-8 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {DOMAINS.map((domain, i) => {
            const count = questions?.filter((q) => q.domain === domain.name).length ?? 0
            const domainColor = domainColorVar(domain.name)
            const Icon = domainVisual(domain.name).icon
            return (
              <Link
                key={domain.name}
                to={`/questions?domain=${encodeURIComponent(domain.name)}`}
                className="group animate-enter"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <span
                  className="flex size-10 items-center justify-center rounded-lg transition-transform duration-150 group-hover:-translate-y-0.5"
                  style={{ backgroundColor: `color-mix(in srgb, ${domainColor} 14%, transparent)`, color: domainColor }}
                >
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="mt-3 text-h4 font-semibold text-foreground transition-colors duration-150 group-hover:text-primary">
                  {domain.label}
                </h3>
                <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">{domain.description}</p>
                <p
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                  style={{ color: domainColor }}
                >
                  {count} {count === 1 ? 'question' : 'questions'} <ArrowRight className="size-3" aria-hidden="true" />
                </p>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// A compact teaser — plain title lines, not a card grid. The full filterable list lives
// at /questions; this is a proof point, not a catalogue.
function QuestionsTeaser({ questions }: { questions: QuestionSummary[] | undefined }) {
  if (!questions || questions.length === 0) return null

  return (
    <section className="border-t border-border py-16 sm:py-20">
      <div className="mx-auto w-full max-w-3xl px-5 sm:px-8">
        <p className="eyebrow">Questions people actually ask</p>
        <ul className="mt-6 flex flex-col gap-5">
          {questions.slice(0, 3).map((q) => (
            <li key={q.slug}>
              <Link
                to={`/questions/${q.slug}`}
                className="group flex items-baseline justify-between gap-4 border-b border-border pb-4 transition-colors duration-150 hover:border-b-primary/40"
              >
                <span className="font-serif text-lead text-foreground group-hover:text-primary">{q.title}</span>
                <ArrowRight
                  className="size-4 shrink-0 text-primary opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
        <Link to="/questions" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
          Browse all questions <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
    </section>
  )
}

// The free entry point that earns an email address. One field, with the privacy
// statement above the button. The id is what the header's "Get started" and the footer
// both link to.
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
    <section id="free-pack" className="scroll-mt-24 border-t border-border bg-secondary/40 py-14 sm:py-16">
      <div className="mx-auto w-full max-w-lg px-5 text-center sm:px-8">
        <p className="text-sm font-medium text-foreground">Get notified as new questions go live</p>
        <p className="mt-2 text-sm text-muted-foreground">
          All 100 questions are live today — new templates and courses are on the way.
        </p>

        {submitted ? (
          <p className="mt-6 text-foreground" role="status">
            You're on the list.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mx-auto mt-5 flex max-w-md flex-col gap-3 sm:flex-row">
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
        <p className="mt-3 text-xs text-muted-foreground">No spam, unsubscribe any time.</p>
      </div>
    </section>
  )
}

// Brand-level rather than a fabricated founder bio. The header's "About" link target.
function AboutSection() {
  return (
    <section id="about" className="scroll-mt-24 border-t border-border py-16 sm:py-20">
      <div className="mx-auto w-full max-w-2xl px-5 text-center sm:px-8">
        <span className="mx-auto block h-0.5 w-10 rounded-full bg-primary" aria-hidden="true" />
        <h2 className="mt-6 text-h3 font-semibold text-foreground">
          Built from real questions risk practitioners face.
        </h2>
        <p className="mt-4 font-serif text-read text-muted-foreground">
          Practicable brings together practical guidance, learning and working resources for the people
          responsible for risk, compliance, security and governance.
        </p>
      </div>
    </section>
  )
}
