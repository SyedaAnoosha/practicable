import { useEffect, useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  Clock,
  FileDown,
  FileSpreadsheet,
  Gift,
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
  {
    name: 'Risk (Enterprise & op.)',
    label: 'Risk',
    description: 'How do we make risk useful to the people actually deciding?',
  },
  {
    name: 'Cyber (Tech & security)',
    label: 'Cyber',
    description: 'How should we deal with technology and security exposure?',
  },
  {
    name: 'Compliance (Regulatory)',
    label: 'Compliance',
    description: 'How do we turn obligations into practical action?',
  },
  {
    name: 'Resilience (Continuity)',
    label: 'Resilience',
    description: 'How do we keep operating when something breaks?',
  },
  { name: 'AI (Governance)', label: 'AI', description: 'How do we govern AI without stopping it?' },
] as const

/** The seven tag dimensions, in catalogue order, so the "seven ways to filter" claim
 *  is counted from the same list the filter panel is built from. */
const DIMENSIONS = [
  'effort',
  'duration',
  'cost',
  'roi_horizon',
  'tier',
  'regulator_pressure',
  'leadership_traits',
] as const

/** Placeholder problems, rotated while the field is empty — demonstrating what the box
 * is for. Paused as soon as the visitor types, and under prefers-reduced-motion. */
const PLACEHOLDER_PROBLEMS = [
  'We have a risk register, but nobody actually uses it…',
  'The board keeps asking about emerging risk. What do we show them?',
  'Everyone wants AI governance. Where do we start?',
  'Our third parties are a black box…',
]

/** Suggested searches. `term` is the substring actually sent to the search, and every
 * one was checked against the live catalogue to actually return results — a plausible
 * short token like `ai` matches on stray substrings ("dom*ai*n") rather than the AI
 * domain, so it's avoided here. `Hero` additionally drops any term the live list can't
 * answer, so this can degrade but never lie. */
const TRY_TERMS = [
  { label: 'Risk register', term: 'risk register' },
  { label: 'Incidents', term: 'incident' },
  { label: 'Board reporting', term: 'board' },
  { label: 'Third parties', term: 'third-part' },
  { label: 'Risk appetite', term: 'appetite' },
  { label: 'Audit actions', term: 'audit' },
] as const

/** The finder demo's chips. Every one is a single real `(dimension, value)` row from
 *  the taxonomy, so the count shown here matches /questions after following the link.
 *  Chip values are checked against real result counts, deliberately excluding any
 *  dimension value with only one or two matching questions — a chip that opens on a
 *  near-empty result teaches the visitor the filter doesn't work. */
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
  {
    step: 'Question',
    body: 'Start with the problem in the words you would actually use at work.',
  },
  {
    step: 'Answer',
    body: 'Read a practical answer written by a practising risk professional, not a vendor.',
  },
  {
    step: 'Action',
    body: 'Every answer ends with what to do next, sized to the effort and budget you have.',
  },
  {
    step: 'Resource',
    body: 'Where a course or a working template exists for that answer, it is linked from it.',
  },
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
  domain_slug: string
  tags: QuestionTag[]
  // The homepage's curated picks (week3_plan.md §20.6) — carried on every question
  // summary, not fetched separately, since Home already holds the full list.
  featured: boolean
  featured_sort: number | null
}

interface CourseSummary {
  id: string
  slug: string
  title: string
  subtitle: string | null
  section: string
  lesson_count: number
}

interface TemplateSummary {
  id: string
  slug: string
  title: string
  description: string
  // Used only to derive a short "XLSX"/"PDF" kind badge next to the free template CTA
  // below — never displayed as a raw filename.
  file_name: string
  is_free: boolean
  product: { slug: string; price_amount: number; currency: string } | null
}

// A pack is a product, not a content row (see Store.tsx's own note on this) — it
// carries its price and description directly rather than through a nested `product`.
interface PackSummary {
  slug: string
  name: string
  description: string
  question_count: number
  price_amount: number
  currency: string
  owned: boolean
}

// The public landing page. Demonstrates the product rather than explaining it: ask a
// question → see real questions → take the free template → filter by what you actually
// have → the five areas → how it works → what you can buy (packs, courses, templates,
// evenly) → proof → take the free template again → ask again. Every count, tag and card
// below is read from the live API, so nothing here can claim something the catalogue
// doesn't have — including the free template CTA, which renders nothing if the
// catalogue happens to have none.
export function Home() {
  const { data: questions } = useQuery({
    queryKey: queryKeys.questions.list(),
    queryFn: () => api.get<QuestionSummary[]>('/questions/index').then((res) => res.data),
  })
  // Courses, templates and packs are fetched once here, at the top, rather than inside
  // GoFurther and the two FreeTemplateCta placements separately — three components
  // asking for the same `templates` query key just share React Query's cache, but
  // fetching once and passing down keeps that sharing obvious instead of implicit.
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
      <Hero questions={questions} />
      <QuestionShowcase questions={questions} />
      {/* CTA #1 — right after the real questions have made their case, and before the
          page returns to more question content (the finder, then the domains). Framed
          as proof-of-substance: "the questions are real, and so is this file." */}
      <FreeTemplateCta templates={templates} tone="proof" />
      <FinderSection questions={questions} />
      <DomainSection questions={questions} />
      <HowItWorks />
      <GoFurther courses={courses} templates={templates} packs={packs} />
      <AboutSection questions={questions} />
      {/* CTA #2 — the same template, the same destination, framed for a visitor who has
          seen the whole page and still hasn't taken anything: a low-commitment offer
          right before the page's last, highest-commitment ask (FinalCta's search + list
          signup). Two placements toward one goal, not two competing goals — see the
          component's own note. */}
      <FreeTemplateCta templates={templates} tone="exit" />
      <FinalCta />
    </>
  )
}

/** The eyebrow + heading pair every light section opens with — one component so the
 *  type steps below the hero can't drift section to section. */
function SectionOpener({
  eyebrow,
  title,
  lead,
  className,
}: {
  eyebrow: string
  title: string
  lead?: string
  className?: string
}) {
  return (
    <motion.div variants={riseItem} className={cn('max-w-2xl', className)}>
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="mt-4 text-balance text-h2 font-semibold text-foreground">{title}</h2>
      {lead && <p className="mt-4 font-serif text-read text-muted-foreground">{lead}</p>}
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 01. Hero — the question box, at the size the product deserves
// ─────────────────────────────────────────────────────────────────────────────

function Hero({ questions }: { questions: QuestionSummary[] | undefined }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [placeholderIndex, setPlaceholderIndex] = useState(0)

  // Rotation stops the moment there's anything to read in the field, and never starts
  // under reduced motion — this is a text swap, not an animation, so the global CSS
  // rule can't help here.
  useEffect(() => {
    if (query) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = window.setInterval(
      () => setPlaceholderIndex((i) => (i + 1) % PLACEHOLDER_PROBLEMS.length),
      4200,
    )
    return () => window.clearInterval(id)
  }, [query])

  const matches = useMemo(() => {
    if (!questions) return []
    const q = query.trim().toLowerCase()
    if (!q) return []
    return questions.filter(
      (item) => item.title.toLowerCase().includes(q) || item.preview.toLowerCase().includes(q),
    )
  }, [questions, query])

  // Only suggest a term the live catalogue can actually answer.
  const suggestions = useMemo(() => {
    if (!questions) return []
    return TRY_TERMS.filter(({ term }) =>
      questions.some(
        (q) => q.title.toLowerCase().includes(term) || q.preview.toLowerCase().includes(term),
      ),
    ).slice(0, 5)
  }, [questions])

  const total = questions?.length ?? 0
  const searching = query.trim().length > 0

  // Hands off to the catalogue with the query pre-applied, rather than guessing which
  // single result the visitor meant.
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    navigate(q ? `/questions?q=${encodeURIComponent(q)}` : '/questions')
  }

  return (
    /* Dark full-bleed stage, left-aligned brand and headline, a bottom meta row. The
       headline is a question rather than a claim, and the finder is a full-width panel
       rather than a small field, since "type your problem here" is the product. */
    <section className="relative isolate overflow-hidden bg-stage px-5 pb-9 pt-14 text-stage-foreground sm:px-8 sm:pb-9 sm:pt-14">
      <motion.div
        aria-hidden="true"
        initial={{ opacity: 0, scale: 1.06 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.4, ease: 'easeOut' }}
        className="stage-aurora -z-10"
      />

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="relative mx-auto flex w-full max-w-7xl flex-col"
      >
        {/* Practicable is the registered brand (header and footer); "Deciding in the
            Dark" is the collection inside it — the relationship is stated on the line
            rather than implied by placement. */}
        <motion.p variants={riseItem} className="eyebrow text-stage-foreground/60">
          Deciding in the Dark — the 100-question collection
        </motion.p>

        <motion.h1
          variants={riseItem}
          tabIndex={-1}
          className="mt-6 max-w-[16ch] text-balance text-display font-medium outline-none"
        >
          Have a difficult risk question? <span className="text-gold">Start there.</span>
        </motion.h1>

        <motion.p
          variants={riseItem}
          className="mt-6 max-w-2xl font-serif text-lead text-stage-foreground/75"
        >
          Practical answers for the problems risk practitioners actually deal with at work.
        </motion.p>

        {/* The finder panel: prompt, field and submit share a single frame. */}
        <motion.form variants={riseItem} onSubmit={handleSubmit} className="mt-9 w-full max-w-3xl">
          <div className="rounded-xl border border-stage-foreground/25 bg-stage-foreground/8 p-2 backdrop-blur-sm transition-colors focus-within:border-gold/70">
            <label
              htmlFor="home-finder"
              className="block px-4 pt-2.5 text-xs font-medium uppercase tracking-[0.14em] text-stage-foreground/55"
            >
              What are you trying to solve?
            </label>
            <div className="flex items-end gap-2">
              <Input
                id="home-finder"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={PLACEHOLDER_PROBLEMS[placeholderIndex]}
                className="h-14 border-0 bg-transparent px-4 text-base text-stage-foreground placeholder:text-stage-foreground/45 focus-visible:outline-none sm:text-lead"
              />
              <button
                type="submit"
                className="mb-1 mr-1 flex size-12 shrink-0 items-center justify-center rounded-lg bg-gold text-stage transition-colors duration-150 hover:bg-gold/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                aria-label="Find an answer"
              >
                <ArrowRight className="size-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          {suggestions.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs text-stage-foreground/50">Try:</span>
              {suggestions.map(({ label, term }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setQuery(term.trim())}
                  className="rounded-full border border-stage-foreground/25 px-3 py-1.5 text-xs font-medium text-stage-foreground/75 transition-colors hover:border-gold/70 hover:text-stage-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </motion.form>

        {/* Live results — the moment the page stops being a brochure. */}
        {searching && (
          <motion.div variants={riseItemSm} className="mt-6 w-full max-w-3xl text-left">
            {matches.length === 0 ? (
              <div className="rounded-lg border border-stage-foreground/20 bg-stage-foreground/5 px-5 py-6">
                <p className="font-medium text-stage-foreground">No questions match yet</p>
                <p className="mt-1 text-sm text-stage-foreground/70">
                  Try one of the suggestions above, or browse the full list.
                </p>
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
                      <Link
                        to={`/questions/${q.slug}`}
                        className="block border-l-2 border-l-transparent px-5 py-4 transition-colors duration-150 hover:border-l-gold hover:bg-stage-foreground/10"
                      >
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

        {/* Secondary by design. The review's CTA-hierarchy point: browsing must not
            compete with asking, so this is a text action, not the filled pill it was. */}
        <motion.div variants={riseItem} className="mt-8">
          <Link
            to="/questions"
            className="group inline-flex items-center gap-2 text-sm font-medium text-stage-foreground/80 underline-offset-4 transition-colors hover:text-stage-foreground hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            Or browse {total > 0 ? `all ${total}` : 'the'} questions — free
            <ArrowUpRight
              className="size-4 transition-transform duration-300 ease-out group-hover:-translate-y-[2px] group-hover:translate-x-[2px]"
              aria-hidden="true"
            />
          </Link>
        </motion.div>

        {/* The supporting numbers, moved out of the headline's way and into the meta
            row where hero-1 puts its description. */}
        <motion.div
          variants={riseItem}
          className="mt-9 flex flex-col gap-6 border-t border-stage-foreground/15 pt-6 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-sm text-stage-foreground/60">
            {total > 0 ? `${total} real questions` : 'Real questions'} from risk leaders ·{' '}
            {DOMAINS.length} areas of risk · {DIMENSIONS.length} ways to filter them
          </p>
          <div
            aria-hidden="true"
            className="hidden items-center gap-3 text-sm text-stage-foreground/60 sm:flex"
          >
            <span>Scroll to explore</span>
            <motion.span
              animate={{ y: [0, 4, 0] }}
              transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
            >
              <ArrowDown className="size-4" strokeWidth={1.5} />
            </motion.span>
          </div>
        </motion.div>
      </motion.div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 02. Real questions, immediately
// ─────────────────────────────────────────────────────────────────────────────

/** Four real questions as cards, directly under the hero: a visitor who reads one real
 * question understands the product faster than one who reads five category names. */
function QuestionShowcase({ questions }: { questions: QuestionSummary[] | undefined }) {
  if (!questions || questions.length === 0) return null

  // week3_plan.md §20.6 — the owner's curated picks (`/admin/questions`'s
  // `FeaturedToggle`), in the order they set, win whenever any exist.
  const curated = questions
    .filter((q) => q.featured)
    .sort((a, b) => (a.featured_sort ?? Number.POSITIVE_INFINITY) - (b.featured_sort ?? Number.POSITIVE_INFINITY))
    .slice(0, 4)

  // The named fallback `FeaturedSummary` in `/admin/questions` promises the owner:
  // "the homepage falls back to the first question in each domain." This is that
  // promise kept, not a second, undocumented heuristic — one from each of the first
  // four domains where possible, so the sample still reads as a range with zero
  // curation done.
  const featured =
    curated.length > 0
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
    <motion.section
      variants={staggerContainer}
      initial="hidden"
      whileInView="visible"
      viewport={inViewOnce}
      className="border-t border-border py-11 sm:py-11"
    >
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
          <Link
            to="/questions"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            See all {questions.length} questions <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </motion.div>
      </div>
    </motion.section>
  )
}

/** The shared question card: domain identity, title, framing, and the three most
 *  decision-relevant tags — the same selection the dashboard and catalogue use. */
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
      <h3 className="mt-2.5 text-h3 font-semibold text-foreground transition-colors duration-150 group-hover:text-primary">
        {question.title}
      </h3>
      {question.subtitle && (
        <p className="mt-2 font-serif text-read text-muted-foreground">{question.subtitle}</p>
      )}

      <div className="mt-4 flex flex-wrap gap-1.5">
        {cardTags(question.tags).map((tag) => (
          <Badge key={`${tag.dimension}-${tag.value}`} variant={TAG_VARIANT[tag.dimension]}>
            {tag.display_label}
          </Badge>
        ))}
      </div>

      <span className="mt-5 inline-flex items-center gap-1.5 pt-1 text-sm font-medium text-primary">
        Read the answer
        <ArrowRight
          className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </span>
    </Link>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 03. The free template — the second free thing, said twice
// ─────────────────────────────────────────────────────────────────────────────

/** "risk-register-tracker.xlsx" → "XLSX". Decoration only, next to the free template's
 *  name — never invented if the filename carries no extension. */
function fileKind(fileName: string): string | null {
  const ext = fileName.split('.').pop()
  return ext && ext !== fileName ? ext.toUpperCase() : null
}

/** The free template, surfaced twice (`tone="proof"` after the question showcase,
 *  `tone="exit"` before the closing CTA) — same data, same destination, different
 *  framing for where the visitor is in the scroll. This is deliberately two placements
 *  of *one* CTA rather than two different asks: the design research behind this pass
 *  is consistent that competing CTAs toward different goals split attention and convert
 *  worse, while the same CTA repeated at points that match the visitor's hesitation
 *  (proof, then exit) does not carry that penalty.
 *
 *  Renders nothing if the catalogue has no free template — the same honest-empty-state
 *  rule GoFurther and Store.tsx's EmptySection already follow. There is exactly one
 *  free template today, so both placements currently show the same file; if a second
 *  ever ships, both still show the first `is_free` row in catalogue order rather than
 *  disagreeing with each other. */
function FreeTemplateCta({
  templates,
  tone,
}: {
  templates: TemplateSummary[] | undefined
  tone: 'proof' | 'exit'
}) {
  const template = templates?.find((t) => t.is_free)
  if (!template) return null
  const kind = fileKind(template.file_name)

  return (
    <motion.section
      variants={staggerContainer}
      initial="hidden"
      whileInView="visible"
      viewport={inViewOnce}
      className="border-t border-border py-9"
    >
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        {/* The gold border/wash is the one recurring visual signal for "this is the free
            thing" — identical chrome at both placements, so the CTA reads as one offer
            said twice rather than two different promotions. `tone` only ever changes
            copy, never colour. */}
        <motion.div
          variants={riseItem}
          className="flex flex-col items-start gap-6 rounded-xl border border-gold/40 bg-gold-soft/40 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8"
        >
          <div className="flex items-start gap-4">
            <span
              className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-gold-soft text-gold-strong"
              aria-hidden="true"
            >
              <Gift className="size-5" />
            </span>
            <div>
              <p className="eyebrow text-gold-strong">
                {tone === 'proof' ? 'Free — no card, no catch' : 'Before you go'}
              </p>
              <h3 className="mt-1.5 text-h3 font-semibold text-foreground">
                {tone === 'proof'
                  ? `The questions are real. So is this: ${template.title}.`
                  : `Not ready to buy anything? Start with ${template.title} — free.`}
              </h3>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                {template.description}
                {kind && <span className="ml-1.5 text-xs text-muted-foreground/75">({kind})</span>}
              </p>
            </div>
          </div>
          <Link to={`/templates/${template.id}`} className="w-full shrink-0 sm:w-auto">
            <Button size="lg" className="w-full sm:w-auto">
              Get it free
              <FileDown className="size-4" aria-hidden="true" />
            </Button>
          </Link>
        </motion.div>
      </div>
    </motion.section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 04. The finder — the differentiator, working, on the page
// ─────────────────────────────────────────────────────────────────────────────

/** The seven-way taxonomy, demonstrated rather than described: a real filter, running
 * against the real list, showing a real count, handing off to /questions with the exact
 * same parameters so the two numbers can't disagree. The one champagne band in the
 * page's dark → light → light → dark rhythm, hence `bg-secondary/40`. */
function FinderSection({ questions }: { questions: QuestionSummary[] | undefined }) {
  // Opens with two filters already applied — an empty finder showing "all questions
  // match" demonstrates nothing. Narrow enough to look like a filter did something,
  // wide enough that a third chip still returns results.
  const [selection, setSelection] = useState<Record<string, string>>({
    duration: 's',
    cost: 'low',
  })

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
    return questions.filter((q) =>
      active.every(([dimension, value]) =>
        q.tags.some((t) => t.dimension === dimension && t.value === value),
      ),
    )
    // `active` is derived from `selection` each render; depending on `selection`
    // directly keeps the memo from recomputing on every unrelated re-render.
  }, [questions, selection]) // eslint-disable-line react-hooks/exhaustive-deps

  const href = active.length > 0 ? `/questions?${new URLSearchParams(selection)}` : '/questions'

  return (
    <motion.section
      variants={staggerContainer}
      initial="hidden"
      whileInView="visible"
      viewport={inViewOnce}
      className="border-t border-border bg-secondary/40 py-11 sm:py-11"
    >
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <SectionOpener
          eyebrow="Find something you can actually do"
          title="Filter by the time, money and effort you actually have."
          lead={`Every question is tagged ${DIMENSIONS.length} ways — effort, duration, cost, payback, tier, regulator pressure and the leadership traits it needs. No PDF can answer "what can I fix in a fortnight, cheaply, that my regulator cares about?" This can.`}
        />

        <motion.div
          variants={riseItem}
          className="mt-6 grid items-start gap-8 rounded-xl border border-border bg-card p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:gap-12"
        >
          <div className="flex flex-col gap-6">
            {FINDER_GROUPS.map((group) => (
              <div key={group.prompt}>
                <p className="text-sm font-medium text-foreground">{group.prompt}:</p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {group.chips.map((chip) => {
                    const isActive = selection[chip.dimension] === chip.value
                    const Icon = chip.icon
                    return (
                      <button
                        key={chip.label}
                        type="button"
                        onClick={() => toggle(chip.dimension, chip.value)}
                        aria-pressed={isActive}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                          isActive
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-background text-muted-foreground hover:border-primary hover:text-primary',
                        )}
                      >
                        <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                        {chip.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* `aria-live` because the number changes without navigation. */}
          <div className="flex flex-col items-start gap-3 border-t border-border pt-6 lg:min-w-56 lg:border-l lg:border-t-0 lg:pl-12 lg:pt-0">
            <p aria-live="polite" className="flex items-baseline gap-2">
              <span className="text-h1 font-semibold tabular-nums text-primary">
                {questions ? matches.length : '—'}
              </span>
              <span className="text-sm text-muted-foreground">
                {matches.length === 1 ? 'question matches' : 'questions match'}
              </span>
            </p>
            {questions && matches.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing in the catalogue fits that combination — remove a filter to widen it.
              </p>
            ) : (
              <Link to={href}>
                <Button>
                  See the matches
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Button>
              </Link>
            )}
          </div>
        </motion.div>
      </div>
    </motion.section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 05. The five areas — as content, not navigation
// ─────────────────────────────────────────────────────────────────────────────

/** Five domains, each carrying its real count and a real question from inside it. A
 * taxonomy that hides how much is behind it reads as a menu, so the count is the
 * loudest thing in the row. */
function DomainSection({ questions }: { questions: QuestionSummary[] | undefined }) {
  return (
    <motion.section
      variants={staggerContainer}
      initial="hidden"
      whileInView="visible"
      viewport={inViewOnce}
      className="border-t border-border py-11 sm:py-11"
    >
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <SectionOpener
          eyebrow="Or start with an area"
          title="Five areas of risk, one way of working."
        />

        <ul className="mt-6 flex flex-col divide-y divide-border border-y border-border">
          {DOMAINS.map((domain) => {
            const inDomain = questions?.filter((q) => q.domain === domain.name) ?? []
            const sample = inDomain[0]
            const color = domainColorVar(domain.name)
            const Icon = domainVisual(domain.name).icon
            return (
              <motion.li key={domain.name} variants={riseItemSm}>
                <Link
                  // The catalogue filters by `domain_slug`, the stable identifier, not
                  // the display name — an empty domain has nothing to filter to anyway.
                  to={sample ? `/questions?domain=${encodeURIComponent(sample.domain_slug)}` : '/questions'}
                  className="group -mx-4 flex flex-col gap-4 rounded-lg border-l-2 border-l-transparent px-4 py-7 transition-[color,background-color,border-color,transform] duration-150 hover:translate-x-1 hover:border-l-[var(--row-domain-color)] hover:bg-secondary/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:flex-row sm:items-center sm:gap-8"
                  style={{ '--row-domain-color': color } as CSSProperties}
                >
                  <span
                    className="flex size-11 shrink-0 items-center justify-center rounded-lg transition-transform duration-150 group-hover:-translate-y-0.5"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`,
                      color,
                    }}
                  >
                    <Icon className="size-5" aria-hidden="true" />
                  </span>

                  <span className="flex-1">
                    <span className="block text-h3 font-semibold text-foreground transition-colors duration-150 group-hover:text-primary">
                      {domain.label}
                    </span>
                    <span className="mt-1 block font-serif text-read text-muted-foreground">
                      {domain.description}
                    </span>
                    {sample && (
                      <span className="mt-2 block text-sm text-muted-foreground/85">
                        e.g. “{sample.title}”
                      </span>
                    )}
                  </span>

                  <span
                    className="flex shrink-0 items-baseline gap-2 sm:flex-col sm:items-end sm:gap-0"
                    style={{ color }}
                  >
                    {/* An em dash, not `0`, while the catalogue is still loading or
                        unreachable. "Risk — 0 questions" is a statement about the
                        product; "Risk — —" is a statement about the request, and only
                        one of those is true when the API is down. */}
                    <span className="text-h2 font-semibold tabular-nums leading-none">
                      {questions ? inDomain.length : '—'}
                    </span>
                    <span className="text-xs font-medium uppercase tracking-wide sm:mt-1.5">
                      {inDomain.length === 1 ? 'question' : 'questions'}
                    </span>
                  </span>

                  <ArrowRight
                    className="hidden size-4 shrink-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100 sm:block"
                    style={{ color }}
                    aria-hidden="true"
                  />
                </Link>
              </motion.li>
            )
          })}
        </ul>
      </div>
    </motion.section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 06. How it works — the loop, stated once
// ─────────────────────────────────────────────────────────────────────────────

/** Question → Answer → Action → Resource: the commercial model in four steps, giving
 * courses and templates a reason to exist rather than listing them side by side.
 * `GoFurther` below is step four made concrete. */
function HowItWorks() {
  return (
    <motion.section
      variants={staggerContainer}
      initial="hidden"
      whileInView="visible"
      viewport={inViewOnce}
      className="border-t border-border py-11 sm:py-11"
    >
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <SectionOpener eyebrow="How it works" title="From the problem to the thing you hand over." />

        <ol className="mt-6 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((item, i) => (
            <motion.li key={item.step} variants={riseItemSm} className="flex flex-col bg-card p-6">
              <span className="font-mono text-xs font-medium tabular-nums text-gold-strong">
                {String(i + 1).padStart(2, '0')}
              </span>
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
// 07. Go further — what the answer leads to
// ─────────────────────────────────────────────────────────────────────────────

/** One column shape, shared by all three product types below — same header, same list
 *  pattern, same "see all" link — so the three read as siblings rather than two built
 *  features and a bolted-on third. Mirrors Store.tsx's per-type sections (same order:
 *  packs, courses, templates) rather than inventing a fourth layout for the same data. */
function GoFurtherColumn({
  icon: Icon,
  eyebrow,
  title,
  body,
  seeAllHref,
  seeAllLabel,
  children,
}: {
  icon: typeof Library
  eyebrow: string
  title: string
  body: string
  seeAllHref: string
  seeAllLabel: string
  children: ReactNode
}) {
  return (
    <motion.div variants={riseItemSm} className="flex flex-col rounded-xl border border-border bg-card p-6">
      <p className="eyebrow">
        <Icon className="size-3.5" aria-hidden="true" />
        {eyebrow}
      </p>
      <h3 className="mt-3 text-h4 font-semibold text-foreground">{title}</h3>
      <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
      <ul className="mt-5 flex flex-1 flex-col divide-y divide-border border-t border-border">{children}</ul>
      <Link
        to={seeAllHref}
        className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        {seeAllLabel} <ArrowRight className="size-3.5" aria-hidden="true" />
      </Link>
    </motion.div>
  )
}

/** One row inside a GoFurtherColumn: a title/subtitle pair on the left, a short fact on
 *  the right — the shape every one of the three lists below already shares. */
function GoFurtherRow({
  href,
  title,
  subtitle,
  meta,
}: {
  href: string
  title: string
  subtitle?: string | null
  meta?: string | null
}) {
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

/** The paid layer, framed as the end of the chain rather than as a shop. All three
 * catalogues — packs, courses, templates — get equal billing here (the review this pass
 * was built from found the previous two-column version quietly dropped reference packs
 * from the homepage entirely). Each column is a real API read and renders only if that
 * catalogue actually has content — the honest-empty-state rule Store.tsx already uses. */
function GoFurther({
  courses,
  templates,
  packs,
}: {
  courses: CourseSummary[] | undefined
  templates: TemplateSummary[] | undefined
  packs: PackSummary[] | undefined
}) {
  const hasCourses = (courses?.length ?? 0) > 0
  const hasTemplates = (templates?.length ?? 0) > 0
  const hasPacks = (packs?.length ?? 0) > 0
  if (!hasCourses && !hasTemplates && !hasPacks) return null

  return (
    <motion.section
      variants={staggerContainer}
      initial="hidden"
      whileInView="visible"
      viewport={inViewOnce}
      className="border-t border-border bg-secondary/40 py-11 sm:py-11"
    >
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <SectionOpener
          eyebrow="When the answer isn't enough"
          title="Go further — learn it, use it, or take the whole domain."
          lead="The questions and answers are free. Where a problem needs more than a page — a formatted reference for a whole domain, a structured walkthrough, or a document you can put in front of a committee tomorrow — that is what the packs, courses and templates below are."
        />

        <div className="mt-6 grid gap-5 lg:grid-cols-3">
          {hasPacks && (
            <GoFurtherColumn
              icon={Library}
              eyebrow="Look it up"
              title="Reference packs"
              body="Every question in a domain, formatted as one PDF in a working order — the questions stay free; this is the artefact."
              seeAllHref="/store"
              seeAllLabel="All reference packs"
            >
              {packs!.slice(0, 2).map((pack) => (
                <GoFurtherRow
                  key={pack.slug}
                  href={`/store/packs/${pack.slug}`}
                  title={pack.name}
                  subtitle={pack.description}
                  meta={pack.owned ? 'Owned' : formatCurrency(pack.price_amount, pack.currency)}
                />
              ))}
            </GoFurtherColumn>
          )}

          {hasCourses && (
            <GoFurtherColumn
              icon={GraduationCap}
              eyebrow="Learn it"
              title="Courses"
              body="Video, reading and downloadable working files in one guided path."
              seeAllHref="/courses"
              seeAllLabel="All courses"
            >
              {courses!.slice(0, 2).map((course) => (
                <GoFurtherRow
                  key={course.slug}
                  href={`/courses/${course.slug}`}
                  title={course.title}
                  subtitle={course.subtitle}
                  meta={`${course.lesson_count} ${course.lesson_count === 1 ? 'lesson' : 'lessons'}`}
                />
              ))}
            </GoFurtherColumn>
          )}

          {hasTemplates && (
            <GoFurtherColumn
              icon={FileSpreadsheet}
              eyebrow="Use it"
              title="Templates"
              body="Ready-to-use working files — the practical companion to the guidance."
              seeAllHref="/templates"
              seeAllLabel="All templates"
            >
              {templates!.slice(0, 2).map((template) => (
                <GoFurtherRow
                  key={template.id}
                  href={`/templates/${template.id}`}
                  title={template.title}
                  subtitle={template.description}
                  meta={
                    template.is_free
                      ? 'Free'
                      : template.product
                        ? formatCurrency(template.product.price_amount, template.product.currency)
                        : null
                  }
                />
              ))}
            </GoFurtherColumn>
          )}
        </div>
      </div>
    </motion.section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 08. The claim, with the evidence next to it
// ─────────────────────────────────────────────────────────────────────────────

/** The header's "About" target. The claim is backed by numbers underneath it, counted
 * from the live catalogue except one fixed statement of intent. */
function AboutSection({ questions }: { questions: QuestionSummary[] | undefined }) {
  const stats = [
    { value: questions?.length ?? null, label: 'real workplace questions' },
    { value: DOMAINS.length, label: 'areas of risk' },
    { value: DIMENSIONS.length, label: 'ways to filter what matters now' },
    { value: 1, label: 'goal: know what to do next' },
  ]

  return (
    <motion.section
      variants={staggerContainer}
      initial="hidden"
      whileInView="visible"
      viewport={inViewOnce}
      id="about"
      className="scroll-mt-24 border-t border-border py-11 sm:py-11"
    >
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <motion.div variants={riseItem} className="max-w-2xl">
          <span className="block h-0.5 w-10 rounded-full bg-primary" aria-hidden="true" />
          <h2 className="mt-6 text-balance text-h2 font-semibold text-foreground">
            Built from real questions risk practitioners face.
          </h2>
          <p className="mt-4 font-serif text-read text-muted-foreground">
            Practicable brings together practical guidance, learning and working resources for the
            people responsible for risk, compliance, security and governance. Written by a
            practising risk professional — no stock photography, no filler, no vendor pitch.
          </p>
        </motion.div>

        <dl className="mt-8 grid gap-8 border-t border-border pt-10 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <motion.div key={stat.label} variants={riseItemSm}>
              <dt className="text-display font-semibold tabular-nums leading-none text-primary">
                {stat.value ?? '—'}
              </dt>
              <dd className="mt-3 max-w-40 text-sm text-muted-foreground">{stat.label}</dd>
            </motion.div>
          ))}
        </dl>
      </div>
    </motion.section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 09. Ask again — the closing CTA
// ─────────────────────────────────────────────────────────────────────────────

/** The `#free-pack` anchor — the header's and footer's "Get started" target. Closes on
 * the same search gesture the page opened with. The email row underneath is the lead
 * capture, kept at the same endpoint/source but demoted below the search: a visitor who
 * came this far should be sent into the catalogue first and onto a list second.
 * Champagne, not dark, so the page doesn't stack two dark bands against the footer. */
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
    <motion.section
      variants={staggerContainer}
      initial="hidden"
      whileInView="visible"
      viewport={inViewOnce}
      id="free-pack"
      className="scroll-mt-24 border-t border-border bg-secondary/40 py-11 sm:py-11"
    >
      <div className="mx-auto w-full max-w-4xl px-5 text-center sm:px-8">
        <motion.h2 variants={riseItem} className="text-balance text-h2 font-semibold text-foreground">
          What risk problem are you dealing with?
        </motion.h2>
        <motion.p variants={riseItem} className="mx-auto mt-4 max-w-xl font-serif text-read text-muted-foreground">
          All of the questions and answers are free to read. Start with the one that sounds like
          your week.
        </motion.p>

        <motion.form variants={riseItem} onSubmit={handleSearch} className="mx-auto mt-8 max-w-xl">
          {/* Stacked below 640px, overlaid above it. "Find an answer" needs ~132px, which
              left too little room for the placeholder at 375px — it read as "What are you
              trying t…" with the button sitting on top of it. Found on the real-device
              walkthrough, 2026-08-14. Stacking matches the newsletter form below, so the
              two forms in this section read as one pattern rather than two. */}
          <div className="flex flex-col gap-3 sm:relative sm:gap-0">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-primary/70"
                aria-hidden="true"
              />
              <label htmlFor="closing-finder" className="sr-only">
                Search the questions
              </label>
              <Input
                id="closing-finder"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="What are you trying to solve?"
                className="h-14 rounded-xl border-border-strong/60 bg-card pl-11 pr-4 text-base sm:pr-36"
              />
            </div>
            <Button
              type="submit"
              size="lg"
              className="w-full sm:absolute sm:right-2 sm:top-2 sm:h-10 sm:w-auto sm:px-4 sm:text-sm"
            >
              Find an answer
            </Button>
          </div>
        </motion.form>

        {/* Secondary, and visibly so. */}
        <motion.div variants={riseItemSm} className="mt-6 border-t border-border pt-8">
          {submitted ? (
            <p className="text-sm text-foreground" role="status">
              You're on the list.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Or get told when new questions, courses and templates go live.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  mutate()
                }}
                className="mx-auto mt-4 flex max-w-md flex-col gap-3 sm:flex-row"
              >
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
                  className="flex-1 bg-card"
                />
                <Button type="submit" variant="outline" loading={isPending}>
                  Keep me posted
                </Button>
              </form>
              <p className="mt-3 text-xs text-muted-foreground">No spam, unsubscribe any time.</p>
            </>
          )}
          {isError && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              Something went wrong — please try again.
            </p>
          )}
        </motion.div>
      </div>
    </motion.section>
  )
}
