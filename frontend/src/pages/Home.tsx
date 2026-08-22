import { useEffect, useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  Clock,
  FileSpreadsheet,
  GraduationCap,
  Landmark,
  Layers,
  Library,
  Search,
  TrendingUp,
} from 'lucide-react'
import { motion } from 'motion/react'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { domainColorVar, domainVisual } from '@/lib/domainVisuals'
import { cardTags, TAG_VARIANT } from '@/lib/tags'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import { cn } from '@/lib/utils/cn'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { staggerContainer, riseItem, riseItemSm, inViewOnce } from '@/lib/motion'

const DOMAINS = [
  { name: 'Risk (Enterprise & op.)', label: 'Risk', description: 'How do we make risk useful to the people actually deciding?' },
  { name: 'Cyber (Tech & security)', label: 'Cyber', description: 'How should we deal with technology and security exposure?' },
  { name: 'Compliance (Regulatory)', label: 'Compliance', description: 'How do we turn obligations into practical action?' },
  { name: 'Resilience (Continuity)', label: 'Resilience', description: 'How do we keep operating when something breaks?' },
  { name: 'AI (Governance)', label: 'AI', description: 'How do we govern AI without stopping it?' },
] as const

const DIMENSIONS = ['effort', 'duration', 'cost', 'roi_horizon', 'tier', 'regulator_pressure', 'leadership_traits'] as const

const PLACEHOLDER_PROBLEMS = [
  'We have a risk register, but nobody actually uses it…',
  'The board keeps asking about emerging risk. What do we show them?',
  'Everyone wants AI governance. Where do we start?',
  'Our third parties are a black box…',
]

const TRY_TERMS = [
  { label: 'Risk register', term: 'risk register' },
  { label: 'Incidents', term: 'incident' },
  { label: 'Board reporting', term: 'board' },
  { label: 'Third parties', term: 'third-part' },
  { label: 'Risk appetite', term: 'appetite' },
  { label: 'Audit actions', term: 'audit' },
] as const

const FINDER_GROUPS = [
  {
    prompt: 'I have',
    chips: [
      { label: '2–6 weeks', dimension: 'duration', value: 's', icon: Clock },
      { label: '6–12 weeks', dimension: 'duration', value: 'm', icon: Clock },
      { label: 'A small budget', dimension: 'cost', value: 'low', icon: Banknote },
      { label: 'Real budget', dimension: 'cost', value: 'medium', icon: Banknote },
    ],
  },
  {
    prompt: 'And I need',
    chips: [
      { label: 'A regulator answered', dimension: 'regulator_pressure', value: 'h', icon: Landmark },
      { label: 'A quick payback', dimension: 'roi_horizon', value: 'quick', icon: TrendingUp },
      { label: 'The basics fixed first', dimension: 'tier', value: 'f', icon: Layers },
    ],
  },
] as const

const STEPS = [
  { step: 'Question', body: 'Start with the problem in the words you would actually use at work.' },
  { step: 'Answer', body: 'Read a practical answer written by a practising risk professional, not a vendor.' },
  { step: 'Action', body: 'Every answer ends with what to do next, sized to the effort and budget you have.' },
  { step: 'Resource', body: 'Where a course or a working template exists for that answer, it is linked from it.' },
] as const

interface QuestionTag { dimension: string; value: string; display_label: string; sort_order: number }
interface QuestionSummary { id: string; slug: string; title: string; subtitle: string | null; preview: string; domain: string; domain_slug: string; tags: QuestionTag[]; featured: boolean; featured_sort: number | null }
interface CourseSummary { id: string; slug: string; title: string; subtitle: string | null; section: string; lesson_count: number }
interface TemplateSummary { id: string; slug: string; title: string; description: string; file_name: string; is_free: boolean; product: { slug: string; price_amount: number; currency: string } | null }
interface PackSummary { slug: string; name: string; description: string; question_count: number; price_amount: number; currency: string; owned: boolean }

// ═══════════════════════════════════════════════════════════════════════════════
// Home — 7 sections, band rhythm, stat tiles
//
// Section plan (design-research §8.2b "band rhythm"):
//   1. Hero       — dark stage (already has aurora)
//   2. Stats      — band plane, compact stat tiles
//   3. Questions  — light, featured question cards
//   4. Explore    — band, finder chips + domains merged
//   5. How it works — light, 4-step grid
//   6. Products   — band, courses/templates/packs
//   7. Final CTA  — light, search + email
// ═══════════════════════════════════════════════════════════════════════════════

export function Home() {
  const { data: questions } = useQuery({
    queryKey: queryKeys.questions.list(),
    queryFn: () => api.get<QuestionSummary[]>('/questions/index').then((res) => res.data),
  })
  const { data: courses } = useQuery({
    queryKey: queryKeys.courses.list(),
    queryFn: () => api.get<CourseSummary[]>('/courses').then((res) => res.data),
  })
  const { data: templates } = useQuery({
    queryKey: queryKeys.templates.list(),
    queryFn: () => api.get<TemplateSummary[]>('/templates').then((res) => res.data),
  })
  const { data: packs } = useQuery({
    queryKey: queryKeys.packs.list(),
    queryFn: () => api.get<PackSummary[]>('/packs').then((res) => res.data),
  })

  return (
    <>
      {/* 1. Hero — dark stage with aurora, search, suggestions */}
      <Hero questions={questions} />

      {/* 2. Stats band — compact stat tiles on the alternating plane */}
      <StatsBand questions={questions} />

      {/* 3. Questions — light, featured cards */}
      <QuestionShowcase questions={questions} />

      {/* 4. Explore — band, finder + domains merged */}
      <ExploreSection questions={questions} />

      {/* 5. How it works — light, 4-step grid */}
      <HowItWorks />

      {/* 6. Products — band, courses/templates/packs */}
      <ProductSection courses={courses} templates={templates} packs={packs} />

      {/* 7. Final CTA — light, search + email */}
      <FinalCta />
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Section opener — eyebrow + heading pair
// ─────────────────────────────────────────────────────────────────────────────

function SectionOpener({ eyebrow, title, lead, className }: { eyebrow: string; title: string; lead?: string; className?: string }) {
  return (
    <motion.div variants={riseItem} className={cn('max-w-2xl', className)}>
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="mt-4 text-balance text-h2 font-semibold text-foreground">{title}</h2>
      {lead && <p className="mt-4 font-serif text-read text-muted-foreground">{lead}</p>}
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Hero — dark stage, search box, suggestions
// ─────────────────────────────────────────────────────────────────────────────

function Hero({ questions }: { questions: QuestionSummary[] | undefined }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [placeholderIndex, setPlaceholderIndex] = useState(0)

  useEffect(() => {
    if (query) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = window.setInterval(() => setPlaceholderIndex((i) => (i + 1) % PLACEHOLDER_PROBLEMS.length), 4200)
    return () => window.clearInterval(id)
  }, [query])

  const matches = useMemo(() => {
    if (!questions) return []
    const q = query.trim().toLowerCase()
    if (!q) return []
    return questions.filter((item) => item.title.toLowerCase().includes(q) || item.preview.toLowerCase().includes(q))
  }, [questions, query])

  const suggestions = useMemo(() => {
    if (!questions) return []
    return TRY_TERMS.filter(({ term }) => questions.some((q) => q.title.toLowerCase().includes(term) || q.preview.toLowerCase().includes(term))).slice(0, 5)
  }, [questions])

  const total = questions?.length ?? 0
  const searching = query.trim().length > 0

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    navigate(q ? `/questions?q=${encodeURIComponent(q)}` : '/questions')
  }

  return (
    <section className="relative isolate overflow-hidden bg-stage px-5 pb-9 pt-14 text-stage-foreground sm:px-8 sm:pb-9 sm:pt-14">
      <motion.div aria-hidden="true" initial={{ opacity: 0, scale: 1.06 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.4, ease: 'easeOut' }} className="stage-aurora -z-10" />

      <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="relative mx-auto flex w-full max-w-7xl flex-col">
        <motion.p variants={riseItem} className="eyebrow text-stage-foreground/60">
          Deciding in the Dark — the 100-question collection
        </motion.p>

        <motion.h1 variants={riseItem} tabIndex={-1} className="mt-6 max-w-[16ch] text-balance text-display font-medium outline-none">
          Have a difficult risk question? <span className="text-gold">Start there.</span>
        </motion.h1>

        <motion.p variants={riseItem} className="mt-6 max-w-2xl font-serif text-lead text-stage-foreground/75">
          Practical answers for the problems risk practitioners actually deal with at work.
        </motion.p>

        <motion.form variants={riseItem} onSubmit={handleSubmit} className="mt-9 w-full max-w-3xl">
          <div className="rounded-xl border border-stage-foreground/25 bg-stage-foreground/8 p-2 backdrop-blur-sm transition-colors focus-within:border-gold/70">
            <label htmlFor="home-finder" className="block px-4 pt-2.5 text-xs font-medium uppercase tracking-[0.14em] text-stage-foreground/55">
              What are you trying to solve?
            </label>
            <div className="flex items-end gap-2">
              <Input id="home-finder" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={PLACEHOLDER_PROBLEMS[placeholderIndex]} className="h-14 border-0 bg-transparent px-4 text-base text-stage-foreground placeholder:text-stage-foreground/45 focus-visible:outline-none sm:text-lead" />
              <button type="submit" className="mb-1 mr-1 flex size-12 shrink-0 items-center justify-center rounded-lg bg-gold text-stage transition-colors duration-150 hover:bg-gold/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold" aria-label="Find an answer">
                <ArrowRight className="size-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          {suggestions.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs text-stage-foreground/50">Try:</span>
              {suggestions.map(({ label, term }) => (
                <button key={label} type="button" onClick={() => setQuery(term.trim())} className="rounded-full border border-stage-foreground/25 px-3 py-1.5 text-xs font-medium text-stage-foreground/75 transition-colors hover:border-gold/70 hover:text-stage-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold">
                  {label}
                </button>
              ))}
            </div>
          )}
        </motion.form>

        {searching && (
          <motion.div variants={riseItemSm} className="mt-6 w-full max-w-3xl text-left">
            {matches.length === 0 ? (
              <div className="rounded-lg border border-stage-foreground/20 bg-stage-foreground/5 px-5 py-6">
                <p className="font-medium text-stage-foreground">No questions match yet</p>
                <p className="mt-1 text-sm text-stage-foreground/70">Try one of the suggestions above, or browse the full list.</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-stage-foreground/70">
                  <span className="font-semibold tabular-nums text-gold">{matches.length}</span>{' '}
                  {matches.length === 1 ? 'question matches' : 'questions match'}
                </p>
                <ul className="mt-3 flex flex-col divide-y divide-stage-foreground/15 overflow-hidden rounded-lg border border-stage-foreground/20 bg-stage-foreground/5">
                  {matches.slice(0, 5).map((q) => (
                    <li key={q.slug}>
                      <Link to={`/questions/${q.slug}`} className="block border-l-2 border-l-transparent px-5 py-4 transition-colors duration-150 hover:border-l-gold hover:bg-stage-foreground/10">
                        <p className="eyebrow text-gold">{q.domain}</p>
                        <p className="mt-1 font-medium text-stage-foreground">{q.title}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </motion.div>
        )}

        <motion.div variants={riseItem} className="mt-8">
          <Link to="/questions" className="group inline-flex items-center gap-2 text-sm font-medium text-stage-foreground/80 underline-offset-4 transition-colors hover:text-stage-foreground hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold">
            Or browse {total > 0 ? `all ${total}` : 'the'} questions — free
            <ArrowUpRight className="size-4 transition-transform duration-300 ease-out group-hover:-translate-y-[2px] group-hover:translate-x-[2px]" aria-hidden="true" />
          </Link>
        </motion.div>

        <motion.div variants={riseItem} className="mt-9 flex flex-col gap-6 border-t border-stage-foreground/15 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-stage-foreground/60">
            {total > 0 ? `${total} real questions` : 'Real questions'} from risk leaders · {DOMAINS.length} areas of risk · {DIMENSIONS.length} ways to filter them
          </p>
          <div aria-hidden="true" className="hidden items-center gap-3 text-sm text-stage-foreground/60 sm:flex">
            <span>Scroll to explore</span>
            <motion.span animate={{ y: [0, 4, 0] }} transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}>
              <ArrowDown className="size-4" strokeWidth={1.5} />
            </motion.span>
          </div>
        </motion.div>
      </motion.div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Stats band — compact stat tiles on the alternating plane
// ─────────────────────────────────────────────────────────────────────────────

function StatsBand({ questions }: { questions: QuestionSummary[] | undefined }) {
  const stats = [
    { value: questions?.length ?? null, label: 'questions', accent: true },
    { value: DOMAINS.length, label: 'areas of risk' },
    { value: DIMENSIONS.length, label: 'ways to filter' },
    { value: 1, label: 'goal: know what to do next' },
  ]

  return (
    <motion.section
      variants={staggerContainer}
      initial="hidden"
      whileInView="visible"
      viewport={inViewOnce}
      className="band"
    >
      <div className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
        <dl className="grid grid-cols-2 gap-6 sm:grid-cols-4 sm:gap-8">
          {stats.map((stat) => (
            <motion.div key={stat.label} variants={riseItemSm} className="text-center sm:text-left">
              <dt className={cn(
                'text-stat font-semibold tabular-nums leading-none',
                stat.accent ? 'text-primary' : 'text-foreground',
              )}>
                {stat.value ?? '—'}
              </dt>
              <dd className="mt-2 text-sm text-muted-foreground">{stat.label}</dd>
            </motion.div>
          ))}
        </dl>
      </div>
    </motion.section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Questions — light, featured cards
// ─────────────────────────────────────────────────────────────────────────────

function QuestionShowcase({ questions }: { questions: QuestionSummary[] | undefined }) {
  if (!questions || questions.length === 0) return null

  const curated = questions
    .filter((q) => q.featured)
    .sort((a, b) => (a.featured_sort ?? Number.POSITIVE_INFINITY) - (b.featured_sort ?? Number.POSITIVE_INFINITY))
    .slice(0, 4)

  const featured = curated.length > 0
    ? curated
    : (() => {
        const picked: QuestionSummary[] = []
        for (const domain of DOMAINS) {
          const match = questions.find((q) => q.domain === domain.name && !picked.includes(q))
          if (match) picked.push(match)
          if (picked.length === 4) break
        }
        while (picked.length < 4) {
          const next = questions.find((q) => !picked.includes(q))
          if (!next) break
          picked.push(next)
        }
        return picked
      })()

  return (
    <motion.section variants={staggerContainer} initial="hidden" whileInView="visible" viewport={inViewOnce} className="py-10 sm:py-12">
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <SectionOpener
          eyebrow="Questions people actually ask"
          title="Real problems, in the words people use at work."
          lead="Not topics. Not chapter titles. The thing someone said out loud in a meeting before they went looking for help."
        />

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          {featured.map((question) => (
            <motion.div key={question.slug} variants={riseItemSm}>
              <QuestionCard question={question} />
            </motion.div>
          ))}
        </div>

        <motion.div variants={riseItemSm} className="mt-8">
          <Link to="/questions" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline">
            See all {questions.length} questions <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </motion.div>
      </div>
    </motion.section>
  )
}

function QuestionCard({ question }: { question: QuestionSummary }) {
  const color = domainColorVar(question.domain)
  const DomainIcon = domainVisual(question.domain).icon

  return (
    <Link
      to={`/questions/${question.slug}`}
      className="group hover-lift hover-lift-domain flex h-full flex-col rounded-xl border border-border bg-card p-6 transition-[border-color] duration-150 hover:border-[var(--card-domain-color)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      style={{ '--card-domain-color': color } as CSSProperties}
    >
      <p className="eyebrow gap-1.5" style={{ color }}>
        <DomainIcon className="size-3" aria-hidden="true" />
        {question.domain}
      </p>
      <h3 className="mt-2.5 text-h3 font-semibold text-foreground transition-colors duration-150 group-hover:text-primary">{question.title}</h3>
      {question.subtitle && <p className="mt-2 font-serif text-read text-muted-foreground">{question.subtitle}</p>}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {cardTags(question.tags).map((tag) => (
          <Badge key={`${tag.dimension}-${tag.value}`} variant={TAG_VARIANT[tag.dimension]}>{tag.display_label}</Badge>
        ))}
      </div>
      <span className="mt-5 inline-flex items-center gap-1.5 pt-1 text-sm font-medium text-primary">
        Read the answer <ArrowRight className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
      </span>
    </Link>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Explore — band, finder chips + domains merged
// ─────────────────────────────────────────────────────────────────────────────

function ExploreSection({ questions }: { questions: QuestionSummary[] | undefined }) {
  const [selection, setSelection] = useState<Record<string, string>>({ duration: 's', cost: 'low' })

  const toggle = (dimension: string, value: string) =>
    setSelection((current) => {
      const next = { ...current }
      if (next[dimension] === value) delete next[dimension]
      else next[dimension] = value
      return next
    })

  const active = Object.entries(selection)

  const matches = useMemo(() => {
    if (!questions) return []
    return questions.filter((q) => active.every(([dimension, value]) => q.tags.some((t) => t.dimension === dimension && t.value === value)))
  }, [questions, selection]) // eslint-disable-line react-hooks/exhaustive-deps

  const href = active.length > 0 ? `/questions?${new URLSearchParams(selection)}` : '/questions'

  return (
    <motion.section variants={staggerContainer} initial="hidden" whileInView="visible" viewport={inViewOnce} className="band py-10 sm:py-12">
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <SectionOpener
          eyebrow="Find something you can actually do"
          title="Filter by the time, money and effort you actually have."
          lead={`Every question is tagged ${DIMENSIONS.length} ways — effort, duration, cost, payback, tier, regulator pressure and the leadership traits it needs.`}
        />

        {/* Finder chips */}
        <motion.div variants={riseItem} className="mt-6 grid items-start gap-8 rounded-xl border border-border bg-card p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:gap-12">
          <div className="flex flex-col gap-6">
            {FINDER_GROUPS.map((group) => (
              <div key={group.prompt}>
                <p className="text-sm font-medium text-foreground">{group.prompt}:</p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {group.chips.map((chip) => {
                    const isActive = selection[chip.dimension] === chip.value
                    const Icon = chip.icon
                    return (
                      <button key={chip.label} type="button" onClick={() => toggle(chip.dimension, chip.value)} aria-pressed={isActive}
                        className={cn('inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                          isActive ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-muted-foreground hover:border-primary hover:text-primary')}>
                        <Icon className="size-3.5 shrink-0" aria-hidden="true" />{chip.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col items-start gap-3 border-t border-border pt-6 lg:min-w-56 lg:border-l lg:border-t-0 lg:pl-12 lg:pt-0">
            <p aria-live="polite" className="flex items-baseline gap-2">
              <span className="text-h1 font-semibold tabular-nums text-primary">{questions ? matches.length : '—'}</span>
              <span className="text-sm text-muted-foreground">{matches.length === 1 ? 'question matches' : 'questions match'}</span>
            </p>
            {questions && matches.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing fits that combination — remove a filter to widen it.</p>
            ) : (
              <Link to={href}><Button>See the matches<ArrowRight className="size-4" aria-hidden="true" /></Button></Link>
            )}
          </div>
        </motion.div>

        {/* Domain cards — compact grid below the finder */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {DOMAINS.map((domain) => {
            const inDomain = questions?.filter((q) => q.domain === domain.name) ?? []
            const color = domainColorVar(domain.name)
            const Icon = domainVisual(domain.name).icon
            const sample = inDomain[0]
            return (
              <motion.div key={domain.name} variants={riseItemSm}>
                <Link
                  to={sample ? `/questions?domain=${encodeURIComponent(sample.domain_slug)}` : '/questions'}
                  className="group flex flex-col rounded-xl border border-border bg-card p-4 transition-[border-color,transform] duration-150 hover:-translate-y-0.5 hover:border-[var(--domain-color)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  style={{ '--domain-color': color } as CSSProperties}
                >
                  <span className="flex size-9 items-center justify-center rounded-lg" style={{ backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`, color }}>
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <p className="mt-3 text-sm font-semibold text-foreground group-hover:text-primary">{domain.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{domain.description}</p>
                  <p className="mt-auto pt-3 font-mono text-xs tabular-nums" style={{ color }}>
                    {questions ? inDomain.length : '—'} {inDomain.length === 1 ? 'question' : 'questions'}
                  </p>
                </Link>
              </motion.div>
            )
          })}
        </div>
      </div>
    </motion.section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. How it works — light, 4-step grid
// ─────────────────────────────────────────────────────────────────────────────

function HowItWorks() {
  return (
    <motion.section variants={staggerContainer} initial="hidden" whileInView="visible" viewport={inViewOnce} className="py-10 sm:py-12">
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <SectionOpener eyebrow="How it works" title="From the problem to the thing you hand over." />
        <ol className="mt-6 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((item, i) => (
            <motion.li key={item.step} variants={riseItemSm} className="flex flex-col bg-card p-6">
              <span className="font-mono text-xs font-medium tabular-nums text-gold-strong">{String(i + 1).padStart(2, '0')}</span>
              <h3 className="mt-3 text-h4 font-semibold text-foreground">{item.step}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
            </motion.li>
          ))}
        </ol>
      </div>
    </motion.section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Products — band, courses/templates/packs
// ─────────────────────────────────────────────────────────────────────────────

function GoFurtherColumn({ icon: Icon, eyebrow, title, body, seeAllHref, seeAllLabel, children }: { icon: typeof Library; eyebrow: string; title: string; body: string; seeAllHref: string; seeAllLabel: string; children: ReactNode }) {
  return (
    <motion.div variants={riseItemSm} className="flex flex-col rounded-xl border border-border bg-card p-6">
      <p className="eyebrow"><Icon className="size-3.5" aria-hidden="true" />{eyebrow}</p>
      <h3 className="mt-3 text-h4 font-semibold text-foreground">{title}</h3>
      <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
      <ul className="mt-5 flex flex-1 flex-col divide-y divide-border border-t border-border">{children}</ul>
      <Link to={seeAllHref} className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline">{seeAllLabel} <ArrowRight className="size-3.5" aria-hidden="true" /></Link>
    </motion.div>
  )
}

function GoFurtherRow({ href, title, subtitle, meta }: { href: string; title: string; subtitle?: string | null; meta?: string | null }) {
  return (
    <li>
      <Link to={href} className="group flex items-baseline justify-between gap-4 py-3.5 transition-colors duration-150">
        <span>
          <span className="block font-medium text-foreground group-hover:text-primary">{title}</span>
          {subtitle && <span className="mt-0.5 block text-sm text-muted-foreground">{subtitle}</span>}
        </span>
        {meta && <span className="shrink-0 whitespace-nowrap text-xs font-medium text-muted-foreground">{meta}</span>}
      </Link>
    </li>
  )
}

function ProductSection({ courses, templates, packs }: { courses: CourseSummary[] | undefined; templates: TemplateSummary[] | undefined; packs: PackSummary[] | undefined }) {
  const hasCourses = (courses?.length ?? 0) > 0
  const hasTemplates = (templates?.length ?? 0) > 0
  const hasPacks = (packs?.length ?? 0) > 0
  if (!hasCourses && !hasTemplates && !hasPacks) return null

  return (
    <motion.section variants={staggerContainer} initial="hidden" whileInView="visible" viewport={inViewOnce} className="band py-10 sm:py-12">
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <SectionOpener
          eyebrow="When the answer isn't enough"
          title="Go further — learn it, use it, or take the whole domain."
          lead="The questions and answers are free. Where a problem needs more than a page, that is what the packs, courses and templates below are."
        />

        <div className="mt-6 grid gap-5 lg:grid-cols-3">
          {hasPacks && (
            <GoFurtherColumn icon={Library} eyebrow="Look it up" title="Reference packs" body="Every question in a domain, formatted as one PDF in a working order." seeAllHref="/store" seeAllLabel="All reference packs">
              {packs!.slice(0, 2).map((pack) => (
                <GoFurtherRow key={pack.slug} href={`/store/packs/${pack.slug}`} title={pack.name} subtitle={pack.description} meta={pack.owned ? 'Owned' : formatCurrency(pack.price_amount, pack.currency)} />
              ))}
            </GoFurtherColumn>
          )}
          {hasCourses && (
            <GoFurtherColumn icon={GraduationCap} eyebrow="Learn it" title="Courses" body="Video, reading and downloadable working files in one guided path." seeAllHref="/courses" seeAllLabel="All courses">
              {courses!.slice(0, 2).map((course) => (
                <GoFurtherRow key={course.slug} href={`/courses/${course.slug}`} title={course.title} subtitle={course.subtitle} meta={`${course.lesson_count} ${course.lesson_count === 1 ? 'lesson' : 'lessons'}`} />
              ))}
            </GoFurtherColumn>
          )}
          {hasTemplates && (
            <GoFurtherColumn icon={FileSpreadsheet} eyebrow="Use it" title="Templates" body="Ready-to-use working files — the practical companion to the guidance." seeAllHref="/templates" seeAllLabel="All templates">
              {templates!.slice(0, 2).map((template) => (
                <GoFurtherRow key={template.id} href={`/templates/${template.id}`} title={template.title} subtitle={template.description}
                  meta={template.is_free ? 'Free' : template.product ? formatCurrency(template.product.price_amount, template.product.currency) : null} />
              ))}
            </GoFurtherColumn>
          )}
        </div>
      </div>
    </motion.section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Final CTA — light, search + email
// ─────────────────────────────────────────────────────────────────────────────

function FinalCta() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const { mutate, isPending, isError } = useMutation({
    mutationFn: () => api.post('/leads', { email, source: 'homepage_free_pack' }),
    onSuccess: () => setSubmitted(true),
  })

  const handleSearch = (e: FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    navigate(q ? `/questions?q=${encodeURIComponent(q)}` : '/questions')
  }

  return (
    <motion.section variants={staggerContainer} initial="hidden" whileInView="visible" viewport={inViewOnce} id="free-pack" className="scroll-mt-24 py-10 sm:py-12">
      <div className="mx-auto w-full max-w-4xl px-5 text-center sm:px-8">
        <motion.h2 variants={riseItem} className="text-balance text-h2 font-semibold text-foreground">
          What risk problem are you dealing with?
        </motion.h2>
        <motion.p variants={riseItem} className="mx-auto mt-4 max-w-xl font-serif text-read text-muted-foreground">
          All of the questions and answers are free to read. Start with the one that sounds like your week.
        </motion.p>

        <motion.form variants={riseItem} onSubmit={handleSearch} className="mx-auto mt-8 max-w-xl">
          <div className="flex flex-col gap-3 sm:relative sm:gap-0">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-primary/70" aria-hidden="true" />
              <label htmlFor="closing-finder" className="sr-only">Search the questions</label>
              <Input id="closing-finder" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="What are you trying to solve?" className="h-14 rounded-xl border-border-strong/60 bg-card pl-11 pr-4 text-base sm:pr-36" />
            </div>
            <Button type="submit" size="lg" className="w-full sm:absolute sm:right-2 sm:top-2 sm:h-10 sm:w-auto sm:px-4 sm:text-sm">Find an answer</Button>
          </div>
        </motion.form>

        <motion.div variants={riseItemSm} className="mt-6 border-t border-border pt-8">
          {submitted ? (
            <p className="text-sm text-foreground" role="status">You're on the list.</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">Or get told when new questions, courses and templates go live.</p>
              <form onSubmit={(e) => { e.preventDefault(); mutate() }} className="mx-auto mt-4 flex max-w-md flex-col gap-3 sm:flex-row">
                <label htmlFor="lead-email" className="sr-only">Your email address</label>
                <Input id="lead-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your email address" className="flex-1 bg-card" />
                <Button type="submit" variant="outline" loading={isPending}>Keep me posted</Button>
              </form>
              <p className="mt-3 text-xs text-muted-foreground">No spam, unsubscribe any time.</p>
            </>
          )}
          {isError && <p role="alert" className="mt-3 text-sm text-destructive">Something went wrong — please try again.</p>}
        </motion.div>
      </div>
    </motion.section>
  )
}
