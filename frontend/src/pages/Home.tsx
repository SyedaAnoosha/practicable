import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react'
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

/** The seven tag dimensions, in the order the catalogue lists them. Named here only so
 *  the "seven ways to filter" claim on this page is counted from the same list the
 *  filter panel is built from, rather than being a hardcoded numeral that can rot. */
const DIMENSIONS = [
  'effort',
  'duration',
  'cost',
  'roi_horizon',
  'tier',
  'regulator_pressure',
  'leadership_traits',
] as const

/** Placeholder problems, rotated while the field is empty.
 *
 * This replaces the headline typewriter that used to run here. The rotating clause was
 * decoration attached to a claim; the same device attached to the *input* demonstrates
 * what the box is for — which is the one thing the hero has to communicate. Paused as
 * soon as the visitor types, and under prefers-reduced-motion (see the effect below). */
const PLACEHOLDER_PROBLEMS = [
  'We have a risk register, but nobody actually uses it…',
  'The board keeps asking about emerging risk. What do we show them?',
  'Everyone wants AI governance. Where do we start?',
  'Our third parties are a black box…',
]

/** Suggested searches.
 *
 * `term` is the substring actually sent to the search, and every one was counted
 * against the live catalogue before it was put here (matches, 2026-08-13): risk
 * register 2, incident 9, board 5, third-part 2, appetite 3, audit 6.
 *
 * Two traps this list is written around. The hyphen: the question is titled
 * "Third-Party Risk Is a Black Box", so `third part` (with a space) matches nothing
 * and `third-part` matches both. And short tokens: `ai` looks like the obvious term
 * for the AI domain and matches 28 questions — almost all of them on "dom*ai*n" and
 * "expl*ai*n". A two-letter substring is not a search.
 *
 * `Hero` additionally drops any term the live list can't answer, so this can degrade
 * but never lie. */
const TRY_TERMS = [
  { label: 'Risk register', term: 'risk register' },
  { label: 'Incidents', term: 'incident' },
  { label: 'Board reporting', term: 'board' },
  { label: 'Third parties', term: 'third-part' },
  { label: 'Risk appetite', term: 'appetite' },
  { label: 'Audit actions', term: 'audit' },
] as const

/** The finder demo's chips. Every one is a single real `(dimension, value)` row from
 *  the taxonomy (db/seed/001), so the count shown here and the count on /questions after
 *  following the link are the same number by construction.
 *
 *  `[FIXED 2026-08-13]` The chips this replaces tested for `'XS'`, `'$'` and `'M'`.
 *  The seeded values are lowercase codes (`xs`, `low`, `m`), so every chip matched zero
 *  questions — the one interaction that proves the taxonomy works was silently dead,
 *  here and in QuestionsCatalogue's QUICK_FILTERS (fixed there too).
 *
 *  Which values appear here is a data decision, not a copywriting one. Counted against
 *  the live catalogue (2026-08-13): duration s 25 / m 40, cost low 73 / medium 27,
 *  regulator_pressure h 24, roi_horizon quick 59, tier f 34. Deliberately absent:
 *  `duration=xs` and `effort=quick` have ONE question each, so the obvious
 *  "fix it in a fortnight" chip would open this section on a near-empty result and
 *  teach the visitor the filter doesn't work. */
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
  is_free: boolean
  product: { slug: string; price_amount: number; currency: string } | null
}

// The public landing page.
//
// Restructured 2026-08-13 (owner page review). The previous version explained the
// platform — a headline claim, five category tiles, three title lines, an email box.
// This one demonstrates it, in the order the review asked for: ask a question → see
// real questions → filter by what you actually have → the five areas → how it works →
// what you can buy → proof → ask again. Every count, tag and card below is read from
// the live API, so nothing on this page can claim something the catalogue doesn't have.
export function Home() {
  const { data: questions } = useQuery({
    queryKey: queryKeys.questions.list(),
    queryFn: () => api.get<QuestionSummary[]>('/questions/index').then((res) => res.data),
  })

  return (
    <>
      <Hero questions={questions} />
      <QuestionShowcase questions={questions} />
      <FinderSection questions={questions} />
      <DomainSection questions={questions} />
      <HowItWorks />
      <GoFurther />
      <AboutSection questions={questions} />
      <FinalCta />
    </>
  )
}

/** The eyebrow + heading pair every light section opens with. One component so the
 *  §10 type steps below the hero can't drift section to section — the review's point
 *  about too many things being visually similar was a hierarchy problem, and a
 *  hierarchy only holds if it is written down once. */
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

  // Rotation stops the moment there is anything to read in the field, and never starts
  // for a visitor who asked for reduced motion. theme.css's global reduced-motion block
  // can't help here — this is a text swap, not an animation.
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

  // Hands off to the catalogue with the query pre-applied rather than guessing which
  // single result the visitor meant. The live list below is for picking one directly.
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    navigate(q ? `/questions?q=${encodeURIComponent(q)}` : '/questions')
  }

  return (
    /* Structure still from Watermelon UI's hero-1 — dark full-bleed stage, left-aligned
       brand and headline, a bottom meta row — but the centre of gravity has moved. The
       headline is now a question rather than a claim, and the finder is a full-width
       panel instead of a 36px field, because "type your problem here" is the product
       and it was previously being staged as a site search. */
    <section className="relative isolate overflow-hidden bg-stage px-5 pb-14 pt-14 text-stage-foreground sm:px-8 sm:pb-20 sm:pt-20">
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
        {/* Brand hierarchy, settled: Practicable is the registered brand (it holds the
            header and the footer); "Deciding in the Dark" is the collection inside it.
            The review read the two as competing products, so the relationship is now
            stated on the line rather than implied by placement. */}
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

        {/* The finder panel. One object — prompt, field and submit share a frame — at
            roughly three times the visual weight of the old inline field. */}
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
          className="mt-14 flex flex-col gap-6 border-t border-stage-foreground/15 pt-6 sm:flex-row sm:items-center sm:justify-between"
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

/** Four real questions as cards, directly under the hero.
 *
 * This is the section that used to be three plain title lines two screens down, after
 * the domain grid. It is first now for the reason the review gave: a visitor who reads
 * one real question understands the product, and a visitor who reads five category
 * names does not. */
function QuestionShowcase({ questions }: { questions: QuestionSummary[] | undefined }) {
  if (!questions || questions.length === 0) return null

  // One from each of the first four domains where possible, so the sample reads as a
  // range rather than four variations on whatever sorts first.
  const featured = (() => {
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
      className="border-t border-border py-16 sm:py-24"
    >
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <SectionOpener
          eyebrow="Questions people actually ask"
          title="Real problems, in the words people use at work."
          lead="Not topics. Not chapter titles. The thing someone said out loud in a meeting before they went looking for help."
        />

        <div className="mt-10 grid gap-5 sm:grid-cols-2">
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

/** The shared question card: domain identity, title, the practitioner's framing, and
 *  the three most decision-relevant tags (lib/tags.ts, the same selection the dashboard
 *  and catalogue use). */
function QuestionCard({ question }: { question: QuestionSummary }) {
  const color = domainColorVar(question.domain)
  const DomainIcon = domainVisual(question.domain).icon

  return (
    <Link
      to={`/questions/${question.slug}`}
      className="group flex h-full flex-col rounded-xl border border-border bg-card p-6 transition-[transform,box-shadow,border-color] duration-150 hover:-translate-y-0.5 hover:border-[var(--card-domain-color)] hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
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
// 03. The finder — the differentiator, working, on the page
// ─────────────────────────────────────────────────────────────────────────────

/** The seven-way taxonomy, demonstrated rather than described.
 *
 * The review's sharpest point: the differentiator is not "100 risk questions", it is
 * "find the one that fits the fortnight and the budget you actually have" — and the
 * page was asserting that in a sentence. So this section is the real filter, running
 * against the real list, showing a real count, and handing off to /questions with the
 * exact same parameters. The number here and the number there cannot disagree.
 *
 * This is also the one champagne band in the middle of the page (the review's
 * dark → light → light → dark rhythm), which is why it carries `bg-secondary/40`. */
function FinderSection({ questions }: { questions: QuestionSummary[] | undefined }) {
  // Opens with two filters already applied — an empty finder showing "100 questions
  // match" demonstrates nothing. This pair lands on 25 of 100 today: narrow enough to
  // look like a filter did something, wide enough that adding a third chip still
  // returns results rather than dead-ending the demo on its first click.
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
      className="border-t border-border bg-secondary/40 py-16 sm:py-24"
    >
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <SectionOpener
          eyebrow="Find something you can actually do"
          title="Filter by the time, money and effort you actually have."
          lead={`Every question is tagged ${DIMENSIONS.length} ways — effort, duration, cost, payback, tier, regulator pressure and the leadership traits it needs. No PDF can answer "what can I fix in a fortnight, cheaply, that my regulator cares about?" This can.`}
        />

        <motion.div
          variants={riseItem}
          className="mt-10 grid items-start gap-8 rounded-xl border border-border bg-card p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:gap-12"
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

          {/* The result. `aria-live` because the number changes without navigation —
              a sighted visitor sees it tick, and this is how everyone else does. */}
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
// 04. The five areas — as content, not navigation
// ─────────────────────────────────────────────────────────────────────────────

/** Five domains, each carrying its real count and a real question from inside it.
 *
 * Previously five icons and a one-line description, which is a category list; the
 * counts were even hidden until hover. A taxonomy that hides how much is behind it
 * reads as a menu, so the count is now the loudest thing in the row. */
function DomainSection({ questions }: { questions: QuestionSummary[] | undefined }) {
  return (
    <motion.section
      variants={staggerContainer}
      initial="hidden"
      whileInView="visible"
      viewport={inViewOnce}
      className="border-t border-border py-16 sm:py-24"
    >
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <SectionOpener
          eyebrow="Or start with an area"
          title="Five areas of risk, one way of working."
        />

        <ul className="mt-10 flex flex-col divide-y divide-border border-y border-border">
          {DOMAINS.map((domain) => {
            const inDomain = questions?.filter((q) => q.domain === domain.name) ?? []
            const sample = inDomain[0]
            const color = domainColorVar(domain.name)
            const Icon = domainVisual(domain.name).icon
            return (
              <motion.li key={domain.name} variants={riseItemSm}>
                <Link
                  // The catalogue filters by `domain_slug` (the stable identifier —
                  // QuestionsCatalogue.tsx / scoring.ts), not the display name, so
                  // this link needs a real question's slug to land correctly. An
                  // empty domain (no sample yet) has nothing to filter to anyway.
                  to={sample ? `/questions?domain=${encodeURIComponent(sample.domain_slug)}` : '/questions'}
                  className="group -mx-4 flex flex-col gap-4 rounded-lg border-l-2 border-l-transparent px-4 py-7 transition-colors duration-150 hover:border-l-[var(--row-domain-color)] hover:bg-secondary/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:flex-row sm:items-center sm:gap-8"
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
// 05. How it works — the loop, stated once
// ─────────────────────────────────────────────────────────────────────────────

/** Question → Answer → Action → Resource.
 *
 * The commercial model in four steps. The review's point was that a "Courses" section
 * beside a "Templates" section never explains why anyone would buy either; the chain
 * that ends in them does. `GoFurther` below is step four made concrete. */
function HowItWorks() {
  return (
    <motion.section
      variants={staggerContainer}
      initial="hidden"
      whileInView="visible"
      viewport={inViewOnce}
      className="border-t border-border py-16 sm:py-24"
    >
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <SectionOpener eyebrow="How it works" title="From the problem to the thing you hand over." />

        <ol className="mt-10 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
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
// 06. Go further — what the answer leads to
// ─────────────────────────────────────────────────────────────────────────────

/** The paid layer, framed as the end of the chain rather than as two catalogues.
 *
 * Both lists are real API reads, and each half renders only if that catalogue has
 * something in it — an empty "Courses" heading on a landing page is a promise the
 * product hasn't kept yet. */
function GoFurther() {
  const { data: courses } = useQuery({
    queryKey: queryKeys.courses.list(),
    queryFn: () => api.get<CourseSummary[]>('/courses').then((res) => res.data),
  })
  const { data: templates } = useQuery({
    queryKey: queryKeys.templates.list(),
    queryFn: () => api.get<TemplateSummary[]>('/templates').then((res) => res.data),
  })

  const hasCourses = (courses?.length ?? 0) > 0
  const hasTemplates = (templates?.length ?? 0) > 0
  if (!hasCourses && !hasTemplates) return null

  return (
    <motion.section
      variants={staggerContainer}
      initial="hidden"
      whileInView="visible"
      viewport={inViewOnce}
      className="border-t border-border bg-secondary/40 py-16 sm:py-24"
    >
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <SectionOpener
          eyebrow="When the answer isn't enough"
          title="Go further, or just take the working file."
          lead="The questions and answers are free. Where a problem needs more than a page — a structured walkthrough, or a document you can put in front of a committee tomorrow — that is what the courses and templates are."
        />

        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          {hasCourses && (
            <motion.div
              variants={riseItemSm}
              className="flex flex-col rounded-xl border border-border bg-card p-6"
            >
              <p className="eyebrow">
                <GraduationCap className="size-3.5" aria-hidden="true" />
                Learn it
              </p>
              <h3 className="mt-3 text-h4 font-semibold text-foreground">Courses</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Video, reading and downloadable working files in one guided path.
              </p>
              <ul className="mt-5 flex flex-1 flex-col divide-y divide-border border-t border-border">
                {courses!.slice(0, 2).map((course) => (
                  <li key={course.slug}>
                    <Link
                      to={`/courses/${course.slug}`}
                      className="group flex items-baseline justify-between gap-4 py-3.5 transition-colors duration-150"
                    >
                      <span>
                        <span className="block font-medium text-foreground group-hover:text-primary">
                          {course.title}
                        </span>
                        {course.subtitle && (
                          <span className="mt-0.5 block text-sm text-muted-foreground">
                            {course.subtitle}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
                        {course.lesson_count} {course.lesson_count === 1 ? 'lesson' : 'lessons'}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                to="/courses"
                className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                All courses <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </motion.div>
          )}

          {hasTemplates && (
            <motion.div
              variants={riseItemSm}
              className="flex flex-col rounded-xl border border-border bg-card p-6"
            >
              <p className="eyebrow">
                <FileSpreadsheet className="size-3.5" aria-hidden="true" />
                Use it
              </p>
              <h3 className="mt-3 text-h4 font-semibold text-foreground">Templates</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Ready-to-use working files — the practical companion to the guidance.
              </p>
              <ul className="mt-5 flex flex-1 flex-col divide-y divide-border border-t border-border">
                {templates!.slice(0, 2).map((template) => (
                  <li key={template.id}>
                    <Link
                      to={`/templates/${template.id}`}
                      className="group flex items-baseline justify-between gap-4 py-3.5 transition-colors duration-150"
                    >
                      <span>
                        <span className="block font-medium text-foreground group-hover:text-primary">
                          {template.title}
                        </span>
                        <span className="mt-0.5 block text-sm text-muted-foreground">
                          {template.description}
                        </span>
                      </span>
                      <span className="shrink-0 whitespace-nowrap text-xs font-medium text-muted-foreground">
                        {template.is_free
                          ? 'Free'
                          : template.product
                            ? formatCurrency(template.product.price_amount, template.product.currency)
                            : null}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                to="/templates"
                className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                All templates <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </motion.div>
          )}
        </div>
      </div>
    </motion.section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 07. The claim, with the evidence next to it
// ─────────────────────────────────────────────────────────────────────────────

/** The header's "About" target.
 *
 * "Built from real questions risk practitioners face" was a claim standing in a large
 * empty band — which is exactly where the review said the page looked like content had
 * failed to load. The claim keeps its place; the numbers underneath it are now the
 * evidence, and all but one are counted from the live catalogue. */
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
      className="scroll-mt-24 border-t border-border py-16 sm:py-24"
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

        <dl className="mt-12 grid gap-8 border-t border-border pt-10 sm:grid-cols-2 lg:grid-cols-4">
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
// 08. Ask again — the closing CTA
// ─────────────────────────────────────────────────────────────────────────────

/** The `#free-pack` anchor (the header's and the footer's "Get started" target).
 *
 * It closes on the same gesture the page opened with, because that gesture is the
 * product. The email row underneath it is the old lead capture, kept — same endpoint,
 * same `homepage_free_pack` source, so the existing lead reporting is unbroken — but
 * demoted below the search, since a visitor who came this far should be sent into the
 * catalogue first and onto a list second.
 *
 * Deliberately champagne rather than the dark stage the review suggested: the footer
 * directly below is already a full-bleed dark plane carrying its own newsletter
 * headline, and two dark bands in a row is the same "one big block" problem the review
 * raised about the hero and footer. This gives dark → light → dark instead. */
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
      className="scroll-mt-24 border-t border-border bg-secondary/40 py-16 sm:py-24"
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
              className="h-14 rounded-xl border-border-strong/60 bg-card pl-11 pr-32 text-base"
            />
            <Button type="submit" className="absolute right-2 top-2 h-10">
              Find an answer
            </Button>
          </div>
        </motion.form>

        {/* Secondary, and visibly so. */}
        <motion.div variants={riseItemSm} className="mt-10 border-t border-border pt-8">
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
