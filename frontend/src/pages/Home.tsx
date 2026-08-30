import { Children, useEffect, useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  ArrowUpRight,
  Banknote,
  Clock,
  FileSpreadsheet,
  GraduationCap,
  Landmark,
  Layers,
  Library,
  ChevronLeft,
  ChevronRight,
  Download,
  Search,
  Sparkles,
  Star,
  TrendingUp,
} from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { Splide, SplideSlide, SplideTrack } from '@splidejs/react-splide'
import '@splidejs/react-splide/css/core'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { domainColorVar, domainVisual } from '@/lib/domainVisuals'
import { cardTags } from '@/lib/tags'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui/Button'
import { CourseArt } from '@/components/ui/CourseArt'
import { Input } from '@/components/ui/Input'
import {
  staggerContainer,
  riseItem,
  riseItemSm,
  inViewOnce,
  wordStagger,
  wordChild,
  useParallax,
} from '@/lib/motion'
import { TrustStrip } from '@/components/ui/TrustStrip'
import { PillEyebrow } from '@/components/ui/PillEyebrow'
import { TaxonomyCanvas } from '@/components/ui/TaxonomyCanvas'
import { useSiteFeaturedReviews } from '@/hooks/useFeaturedReviews'

const DOMAINS = [
  { name: 'Risk (Enterprise & op.)', label: 'Risk', description: 'How do we make risk useful to the people actually deciding?' },
  { name: 'Cyber (Tech & security)', label: 'Cyber', description: 'How should we deal with technology and security exposure?' },
  { name: 'Compliance (Regulatory)', label: 'Compliance', description: 'How do we turn obligations into practical action?' },
  { name: 'Resilience (Continuity)', label: 'Resilience', description: 'How do we keep operating when something breaks?' },
  { name: 'AI (Governance)', label: 'AI', description: 'How do we govern AI without stopping it?' },
] as const

const DIMENSIONS = ['effort', 'duration', 'cost', 'roi_horizon', 'tier', 'regulator_pressure', 'leadership_traits'] as const

/** Short human labels for the seven tag dimensions, for the card metadata block. A
 * value ("L (3-6 months)") is only meaningful once you know which question it answers,
 * and the dimension name is what turns a badge into data. */
const DIMENSION_LABEL: Record<string, string> = {
  effort: 'Effort',
  duration: 'Duration',
  cost: 'Cost',
  roi_horizon: 'Payback',
  tier: 'Tier',
  regulator_pressure: 'Regulator',
  leadership_traits: 'Leadership',
}

/** The hero headline, split for the word stagger. Kept as data next to the other hero
 * copy so the visual split and the announced string cannot drift apart. */
const HERO_HEADLINE = 'Have a difficult risk question? Start there.'
const HERO_WORDS = HERO_HEADLINE.split(' ')
/** Index from which the headline turns gold ("Start there."). */
const HERO_ACCENT_FROM = HERO_WORDS.length - 2

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
  { step: 'Learn', body: 'Where a problem needs more than a page, take a course that teaches the domain properly.' },
  { step: 'Template', body: 'Every answer links to the working file you need — the register, the framework, the checklist.' },
  { step: 'Apply', body: 'Use it at work this week. Every answer ends with what to do next, sized to the effort you have.' },
] as const

interface QuestionTag { dimension: string; value: string; display_label: string; sort_order: number }
interface QuestionSummary { id: string; slug: string; title: string; subtitle: string | null; preview: string; domain: string; domain_slug: string; tags: QuestionTag[]; featured: boolean; featured_sort: number | null }
interface CourseSummary { id: string; slug: string; title: string; subtitle: string | null; section: string; lesson_count: number }
interface TemplateSummary { id: string; slug: string; title: string; description: string; file_name: string; is_free: boolean; product: { slug: string; price_amount: number; currency: string } | null }
interface PackSummary { slug: string; name: string; description: string; domain_name: string | null; question_count: number; price_amount: number; currency: string; owned: boolean }

// ═══════════════════════════════════════════════════════════════════════════════
// Home — richness front-loaded: a maximal hero, then the page goes calm. Six sections:
//   1. Hero — dark stage (aurora + parallax + ambient drift), word-staggered H1,
//      search, TrustStrip (the three live counts, no separate stats band), outline word
//   2. Questions — featured question cards      4. How it works — 4-step grid
//   3. Explore — finder chips + domains         5. Products — courses/templates/packs
//   6. Final CTA — search + email
//
// Motion below the hero is entrance-only; the ambient loop and parallax are
// hero-exclusive.
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

      {/* 2. Questions — light, featured cards */}
      <QuestionShowcase questions={questions} />

      {/* 3. Explore — band, finder + domains merged */}
      <ExploreSection questions={questions} />

      {/* 4. How it works — light, 4-step grid */}
      <HowItWorks />

      {/* 5. Products — band, courses/templates/packs */}
      <ProductSection courses={courses} templates={templates} packs={packs} />

      {/* 6. Testimonials — light, featured reviews from across the catalogue.
          Placed after the products and before the CTA: social proof lands hardest
          immediately after what it is proof OF, and immediately before the ask. */}
      <TestimonialsSection />

      {/* 7. Final CTA — light, search + email */}
      <FinalCta />
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Testimonials — featured reviews, site-wide
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The featured-reviews section on the landing page. Renders nothing when there are no
 * featured reviews — an empty testimonial section advertises the absence of customers.
 *
 * Star ratings are shown per quote here (unlike the detail-page `TestimonialSection`,
 * which suppresses them behind the aggregate gate) — an individual reviewer's score
 * isn't an average and needs no threshold.
 */
function TestimonialsSection() {
  const { data: reviews } = useSiteFeaturedReviews(12)

  // A rating floor on top of `is_featured`. Featuring is an editorial act, but it is
  // also reversible-by-accident: the admin list features and unfeatures with one
  // toggle, and a 3-star "I was expecting more depth" quote reaching the landing page
  // is a marketing failure, not a moderation one. 4+ only, so the section can never
  // argue against the product it sits above. Over-fetch so the floor still leaves
  // enough to fill the grid.
  const withBody = (reviews ?? []).filter((r) => r.body && r.rating >= 4).slice(0, 6)
  if (withBody.length === 0) return null

  return (
    <section
      className="py-10 sm:py-12"
      aria-label="What learners say"
    >
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <SectionOpener
          eyebrow="Testimonials"
          title="What people do with it once they have it."
          lead="From risk leads who bought the thing and used it the same week."
        />
        {/* Built in the QuestionCard language
            rather than as generic quote boxes: full-bleed coloured top rule, a mono
            eyebrow row with an index numeral, the quote as the card's body, and a ruled
            mono metadata block pinned to the bottom by `mt-auto`. One card grammar
            across the page instead of two.

            `gap-px` over a `bg-border` grid draws the dividing hairlines, so adjacent
            cards share one rule rather than stacking two borders — the same treatment
            HowItWorks uses. */}
        <div className="mt-6 grid items-stretch gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {withBody.map((review, index) => (
            <figure
              key={review.id}
              className="group relative flex h-full flex-col bg-card px-5 pb-5 pt-4 transition-colors duration-150 hover:bg-card-2"
            >
              {/* Gold rather than a domain tone: a testimonial has no domain, and gold
                  is the product's own accolade colour (it is what the certificate and
                  the brand mark use). */}
              <span
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-1 bg-gold transition-[height] duration-150 group-hover:h-1.5"
              />

              <div className="flex items-baseline justify-between gap-3">
                <p className="flex items-center gap-1.5 font-mono text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  <Star className="size-3 shrink-0 fill-gold text-gold" aria-hidden="true" />
                  Verified purchase
                </p>
                {/* Position in this shelf, not a stable id — decorative, so aria-hidden. */}
                <span aria-hidden="true" className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                  {String(index + 1).padStart(2, '0')}
                </span>
              </div>

              <blockquote className="mt-3 font-serif text-sm leading-relaxed text-foreground">
                &ldquo;{review.body}&rdquo;
              </blockquote>

              {/* Same ruled metadata block as QuestionCard's dimensions — one label/value
                  row per line, mono, hairline above, pushed to the bottom so every card
                  in the row aligns on it regardless of quote length. */}
              <dl className="mt-auto space-y-1 border-t border-border pt-3">
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="font-mono text-[0.625rem] uppercase tracking-[0.1em] text-muted-foreground">
                    Reviewer
                  </dt>
                  <dd className="truncate text-right font-mono text-[0.6875rem] text-foreground">
                    {review.display_name ?? 'Anonymous'}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="font-mono text-[0.625rem] uppercase tracking-[0.1em] text-muted-foreground">
                    Rating
                  </dt>
                  <dd
                    className="flex shrink-0 items-center gap-0.5"
                    aria-label={`Rated ${review.rating} out of 5`}
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        aria-hidden="true"
                        className={cn(
                          'size-3',
                          n <= review.rating ? 'fill-gold text-gold' : 'fill-none text-border',
                        )}
                      />
                    ))}
                  </dd>
                </div>
              </dl>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Section opener — eyebrow + heading pair
// ─────────────────────────────────────────────────────────────────────────────

function SectionOpener({ eyebrow, title, lead, className, onStage = false }: { eyebrow: string; title: string; lead?: string; className?: string; onStage?: boolean }) {
  return (
    <div className={cn('max-w-2xl', className)}>
      {/* On the stage the hairline-ruled `.eyebrow` loses its rule against the aurora,
          so the enclosed pill carries the label instead. */}
      {onStage ? (
        <PillEyebrow tone="stage">{eyebrow}</PillEyebrow>
      ) : (
        <p className="eyebrow">{eyebrow}</p>
      )}
      <h2 className={cn('mt-4 text-balance text-h2 font-semibold', onStage ? 'text-stage-foreground' : 'text-foreground')}>{title}</h2>
      {lead && <p className={cn('mt-4 font-serif text-read', onStage ? 'text-stage-foreground/75' : 'text-muted-foreground')}>{lead}</p>}
    </div>
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

  const { ref: parallaxRef, y: auroraY } = useParallax(0.08)

  const total = questions?.length ?? 0
  const searching = query.trim().length > 0

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    navigate(q ? `/questions?q=${encodeURIComponent(q)}` : '/questions')
  }

  return (
    <section
      ref={parallaxRef as React.RefObject<HTMLElement>}
      className="relative isolate overflow-hidden bg-stage px-5 pb-10 pt-14 text-stage-foreground sm:px-8 sm:pb-12 sm:pt-16"
    >
      {/* The aurora now moves on two independent axes: `ambient-drift` walks the
          gradient core on a 24s loop (atmosphere), and `useParallax` translates the
          whole layer at 8% of scroll (depth). Both stop dead under
          prefers-reduced-motion — the drift via its own CSS guard, the parallax
          because useParallax returns a static 0. Neither is covered by MotionConfig. */}
      <div
        aria-hidden="true"
        style={{ y: auroraY }}
        initial={{ opacity: 0, scale: 1.06 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.4, ease: 'easeOut' }}
        className="stage-aurora ambient-drift -z-10"
      />

      {/* The TaxonomyCanvas — the hero graphic that makes this page unmistakably
          Practicable's. 99 nodes in 5 domain clusters,
          gold connective lines, ambient drift. Driven by the real API count, never
          hardcoded. Degrades to a static SVG under reduced motion.

          Positioned as a full-bleed layer between the aurora and the content, at
          low opacity so it reads as atmosphere rather than data. The copy column
          sits on top; the canvas fills the empty stage to the right and below. */}
      <TaxonomyCanvas
        questions={questions}
        className="absolute inset-0 -z-[5] opacity-30"
      />

      {/* Utomic's outline word, bottom-left where the copy column has already ended.
          Decorative and aria-hidden: "RISK" is stated in the headline, the eyebrow and
          the trust strip, so nothing is lost when it is not announced. */}
      {/* The `OutlineWord` device (Utomic's oversized outline
          word) was built and placed here, then taken out after looking at the rendered
          hero rather than the plan.

          Two things it could not satisfy at once. The hero's copy column already runs
          to ~16ch of 93px type, so the only empty stage left is the bottom-left strip —
          which is ~120px tall, far too short for a 180px word, and the section's
          `overflow-hidden` clipped it to a sliver that read as a rendering artifact.
          Shrinking it to fit made it a faint smudge instead: still decoration, no
          longer force. Utomic's word works because that hero is mostly empty; ours is
          not, and this hero does not need a second graphic to carry it.

          The component is kept (components/ui/OutlineWord.tsx) — it is correct and
          costs nothing unused. Reach for it on a page with real empty plane. */}
      <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="relative mx-auto flex w-full max-w-7xl flex-col">
        <motion.div variants={riseItem}>
          <PillEyebrow tone="stage">Deciding in the Dark — the 100-question collection</PillEyebrow>
        </motion.div>

        {/* Word-level stagger (all nine Framer references open this way; we faded whole
            blocks).

            ⚠ The split is for animation only and MUST NOT change what the heading says.
            An earlier form wrapped each word in an inline-block and spaced them with a
            margin, which reads correctly but strips the spaces from the accessible
            name: `textContent` became "Haveadifficultriskquestion?" — caught by reading
            the rendered DOM, not the source. Real space characters are therefore
            emitted between the words, and `inline-block` is kept only on the animated
            span so the transform still applies.

            `aria-label` additionally pins the announced string, so a future refactor of
            the visual split cannot silently degrade it again. */}
        <motion.h1
          variants={wordStagger}
          tabIndex={-1}
          aria-label={HERO_HEADLINE}
          className="mt-6 max-w-[16ch] text-balance text-display font-medium outline-none"
        >
          {HERO_WORDS.map((word, i) => (
            <span key={`${word}-${i}`}>
              <motion.span
                variants={wordChild}
                className={cn('inline-block', i >= HERO_ACCENT_FROM && 'text-gold')}
              >
                {word}
              </motion.span>
              {i < HERO_WORDS.length - 1 ? ' ' : null}
            </span>
          ))}
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

        {/* The trust strip, absorbing the separate stats band that used to be section 2
            (7 sections down to 6). Same facts, no extra
            plane, and they now sit directly under the CTA where the reference set puts
            them rather than in a strip the reader has to scroll to.

            Every value is a live count. `total` is null-guarded inside TrustStrip, so
            before the questions query resolves the row is simply absent rather than
            reading "0 questions" — the failure principle 7 exists to prevent. */}
        <motion.div variants={riseItem} className="mt-9 border-t border-stage-foreground/15 pt-6">
          <TrustStrip
            tone="stage"
            facts={[
              { icon: Search, value: total > 0 ? total : null, label: 'real questions from risk leaders' },
              { icon: Layers, value: DOMAINS.length, label: 'areas of risk' },
              { icon: Clock, value: DIMENSIONS.length, label: 'ways to filter them' },
            ]}
          />
        </motion.div>
      </motion.div>
    </section>
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
    /* This section used to continue the dark
       stage under the hero and float glass cards over it (the Galilee device). Rejected
       on sight of the rendered page: two dark planes stacked read as one indistinct
       dark mass, the hero's aurora bled straight into the section, and the boundary
       between "the hero" and "the product" vanished.

       It now sits on `.band-cool` (--background-3), a pale blue drawn from the
       primary/accent family. It separates from the stage above it AND from the warm
       ivory/band planes below, so the page reads as four distinct surfaces rather than
       two. The hero keeps the atmosphere; this section gets legibility, which is what
       a grid of four questions actually needs. */
    <section
      className="band-cool relative isolate pb-12 pt-10 sm:pb-14 sm:pt-12"
    >
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <SectionOpener
          eyebrow="Questions people actually ask"
          title="Real problems, in the words people use at work."
          lead="Not topics. Not chapter titles. The thing someone said out loud in a meeting before they went looking for help."
        />

        {/* 4 across at xl, not 2. The research audit measured ~600px per card in the
            old `sm:grid-cols-2` inside max-w-7xl — content that needs ~340px, so the
            cards read empty. */}
        {/* Divided columns, not floating boxes: one hairline between adjacent cards
            rather than a gap plus four borders. This is how a broadsheet sets parallel
            columns, and it removes 8 visible edges from the composition. */}
        <div className="mt-6 grid overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2 xl:grid-cols-4 [&>*]:bg-card gap-px">
          {featured.map((question, i) => (
            <div key={question.slug}>
              <QuestionCard question={question} index={i} />
            </div>
          ))}
        </div>

        <div className="mt-8">
          <Link to="/questions" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline">
            See all {questions.length} questions <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  )
}

/**
 * The question card, as an editorial index entry: a domain-coloured hairline across the
 * top (not a left bar), square corners, a mono metadata line instead of pill badges,
 * and a mono index numeral. The whole card is one link (§36) — no inline arrow button —
 * and the title underlines on hover.
 */
function QuestionCard({ question, index }: { question: QuestionSummary; index: number }) {
  const color = domainColorVar(question.domain)
  const DomainIcon = domainVisual(question.domain).icon
  const tags = cardTags(question.tags)

  return (
    <Link
      to={`/questions/${question.slug}`}
      className="group relative flex h-full flex-col bg-card px-5 pb-5 pt-4 transition-colors duration-150 hover:bg-card-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      style={{ '--domain-color': color } as CSSProperties}
    >
      {/* The domain rule: 2px across the top, full bleed. Thickens on hover rather than
          the card moving — a grid of four columns that each lift 2px is restless. */}
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-1 transition-[height] duration-150 group-hover:h-1.5"
        style={{ backgroundColor: color }}
      />

      <div className="flex items-baseline justify-between gap-3">
        <p className="flex items-center gap-1.5 font-mono text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          <DomainIcon className="size-3 shrink-0" aria-hidden="true" style={{ color }} />
          {question.domain}
        </p>
        {/* The index numeral. Decorative ordering only — it is the card's position in
            this shelf, not a stable question ID, so it is aria-hidden rather than
            announced as though it meant something. */}
        <span aria-hidden="true" className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
          {String(index + 1).padStart(2, '0')}
        </span>
      </div>

      <h3 className="mt-3 text-h4 font-semibold text-foreground decoration-1 underline-offset-4 group-hover:underline">
        {question.title}
      </h3>

      {question.subtitle && (
        <p className="mt-2 line-clamp-3 font-serif text-sm leading-relaxed text-muted-foreground">
          {question.subtitle}
        </p>
      )}

      {/* The three card-level tags as one mono metadata line rather than three pills
          (H1/H3: metadata is its own tier, and mono is the signal that a string is
          data). The dimension values are already short codes — "L (3-6 months)" — so
          they set compactly on one or two lines. */}
      {tags.length > 0 && (
        /* A ruled metadata block, not a wrapping middot list. At four columns each
            card is ~280px, so a middot-separated line wrapped to one value per row and
            the separators fell to the start of each line, where they read as bullets.
            A hairline above and one value per row is the catalogue-entry treatment and
            it is legible at any column width. */
        <dl className="mt-auto space-y-1 border-t border-border pt-3">
          {tags.map((tag) => (
            <div key={`${tag.dimension}-${tag.value}`} className="flex items-baseline justify-between gap-2">
              <dt className="font-mono text-[0.625rem] uppercase tracking-[0.1em] text-muted-foreground">
                {DIMENSION_LABEL[tag.dimension] ?? tag.dimension}
              </dt>
              <dd className="text-right font-mono text-[0.6875rem] tabular-nums text-foreground">
                {tag.display_label}
              </dd>
            </div>
          ))}
        </dl>
      )}
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
    <section className="band py-10 sm:py-12">
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <SectionOpener
          eyebrow="Find something you can actually do"
          title="Filter by the time, money and effort you actually have."
          lead={`Every question is tagged ${DIMENSIONS.length} ways — effort, duration, cost, payback, tier, regulator pressure and the leadership traits it needs.`}
        />

        {/* Finder chips */}
        <div className="mt-6 grid items-start gap-8 rounded-xl border border-border bg-card p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:gap-12">
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
        </div>

        {/* Domain cards — compact grid below the finder */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {DOMAINS.map((domain) => {
            const inDomain = questions?.filter((q) => q.domain === domain.name) ?? []
            const color = domainColorVar(domain.name)
            const Icon = domainVisual(domain.name).icon
            const sample = inDomain[0]
            return (
              <div key={domain.name}>
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
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. How it works — light, 4-step grid
// ─────────────────────────────────────────────────────────────────────────────

function HowItWorks() {
  return (
    <section className="py-10 sm:py-12">
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <SectionOpener eyebrow="How it works" title="From the problem to the thing you hand over." />
        <ol className="mt-6 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map((item, i) => (
            <li key={item.step} className="flex flex-col bg-card p-6">
              <span className="font-mono text-xs font-medium tabular-nums text-gold-strong">{String(i + 1).padStart(2, '0')}</span>
              <h3 className="mt-3 text-h4 font-semibold text-foreground">{item.step}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Products — band, courses/templates/packs
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Product carousel — Splide
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The product carousel, on Splide — a real carousel (pointer/touch drag, paging,
 * arrow/Home/End keys, focus management, ARIA) replacing a hand-rolled `overflow-x-auto`
 * track. `perMove: 1` with a per-breakpoint `perPage` gives one card of travel per
 * press. Longer `speed` with an ease-out so slides settle; `reducedMotion` turns the
 * transition off entirely.
 */
function ProductScrollRow({ children, label }: { children: ReactNode; label: string }) {
  const slides = Children.toArray(children)
  const prefersReducedMotion = useReducedMotion()

  return (
    <Splide
      hasTrack={false}
      options={{
        // `autoWidth` keeps each card at its own natural width, exactly as the previous
        // flex track did — the cards are not a uniform size and forcing them to be
        // would change every card on the page.
        autoWidth: true,
        gap: '1.25rem',
        perMove: 1,
        pagination: false,
        arrows: slides.length > 1,
        // Never scroll past the last card into empty space.
        trimSpace: true,
        omitEnd: true,
        drag: true,
        // A slow, eased settle rather than a snap. 0 with reduced motion: the position
        // still changes, it just does not animate.
        speed: prefersReducedMotion ? 0 : 520,
        easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
        flickPower: 300,
        waitForTransition: false,
        keyboard: 'focused',
        /* Splide puts `role="group"` on every `<li>`, which axe flags as
           `aria-allowed-role` — `group` is not a permitted role for a list item. The
           attributes are stripped after mount (see `onMounted` below) rather than via
           a `role` option, which targets the carousel ROOT and not the slides. */
        slideFocus: false,
        /* Every carousel used to declare `label: 'Products'`,
           so the three of them landed as three identically-named landmarks — axe's
           `landmark-is-unique`, and for a screen-reader user a landmark list reading
           "Products, Products, Products" with no way to tell which is which. Each now
           carries the row's own name ("Courses", "Reference packs", "Templates"). */
        label,
      }}
      onMounted={(splide) => {
        /* Strip Splide's `role="group"` / `aria-roledescription="slide"` from each
           `<li>`. The cards inside are real links, already reachable and announced on
           their own, so nothing is lost — and an invalid role is a genuine parse
           problem for assistive tech, not a lint nicety. */
        splide.root.querySelectorAll('.splide__slide').forEach((li) => {
          li.removeAttribute('role')
          li.removeAttribute('aria-roledescription')
        })
      }}
      className="practicable-splide group/scroll relative"
    >
      {/* `hasTrack={false}` so the arrows can be positioned against the row rather than
          inside the clipped track — the same hover-revealed treatment the hand-rolled
          version had, kept because it stays out of the way until wanted. */}
      <SplideTrack>
        {slides.map((child, i) => (
          <SplideSlide key={i}>{child}</SplideSlide>
        ))}
      </SplideTrack>

      <div className="splide__arrows">
        <button
          className="splide__arrow splide__arrow--prev absolute -left-1 top-1/2 z-10 flex size-8 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card/90 text-foreground shadow-sm opacity-0 backdrop-blur-sm transition-opacity duration-150 group-hover/scroll:opacity-100 focus-visible:opacity-100 disabled:pointer-events-none disabled:opacity-0"
          type="button"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </button>
        <button
          className="splide__arrow splide__arrow--next absolute -right-1 top-1/2 z-10 flex size-8 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card/90 text-foreground shadow-sm opacity-0 backdrop-blur-sm transition-opacity duration-150 group-hover/scroll:opacity-100 focus-visible:opacity-100 disabled:pointer-events-none disabled:opacity-0"
          type="button"
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </div>
    </Splide>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Mini product cards for the bento carousels
// ─────────────────────────────────────────────────────────────────────────────

function MiniCourseCard({ course }: { course: CourseSummary }) {
  const tone = domainColorVar(course.section)
  return (
    <Link
      to={`/courses/${course.slug}`}
      className="group snap-start shrink-0 w-48 sm:w-56 rounded-lg border border-border bg-background transition-colors hover:bg-card-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <CourseArt slug={course.slug} domain={course.section} className="aspect-[16/9] rounded-t-lg" />
      <div className="px-3 pb-3 pt-2.5">
        <p className="eyebrow" style={{ '--eyebrow-rule-color': tone } as CSSProperties}>{course.section}</p>
        <h4 className="mt-1 text-sm font-semibold text-foreground line-clamp-2 decoration-1 underline-offset-4 group-hover:underline">
          {course.title}
        </h4>
        <p className="mt-1 font-mono text-xs text-muted-foreground">
          {course.lesson_count} {course.lesson_count === 1 ? 'lesson' : 'lessons'}
        </p>
      </div>
    </Link>
  )
}

function MiniPackCard({ pack }: { pack: PackSummary }) {
  return (
    <Link
      to={`/store/packs/${pack.slug}`}
      className="group snap-start shrink-0 w-48 sm:w-56 rounded-lg border border-border bg-background transition-colors hover:bg-card-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {/* This was a flat
          `accent/12 → accent/4` wash behind a `text-accent/30` icon — at those opacities
          on the ivory plane it rendered as an empty grey box, so a row of pack cards
          looked like unloaded images sitting next to fully-illustrated course cards.

          `CourseArt` is the generative artwork the course cards use, and its own
          docstring calls it "course/pack artwork" — it was built for both and simply
          never wired up here. Seeded by slug, so every pack gets a distinct, stable
          composition with no image request and no broken-image state. */}
      <CourseArt slug={pack.slug} domain={pack.domain_name} className="aspect-[16/9] rounded-t-lg" />
      <div className="px-3 pb-3 pt-2.5">
        <p className="eyebrow">Reference pack</p>
        <h4 className="mt-1 text-sm font-semibold text-foreground line-clamp-2 decoration-1 underline-offset-4 group-hover:underline">
          {pack.name}
        </h4>
        {pack.description && (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{pack.description}</p>
        )}
        <p className="mt-1 font-mono text-xs text-muted-foreground">
          {pack.question_count} {pack.question_count === 1 ? 'question' : 'questions'}
        </p>
      </div>
    </Link>
  )
}

function MiniTemplateCard({ template }: { template: TemplateSummary }) {
  const ext = template.file_name.split('.').pop()?.toUpperCase()
  return (
    <Link
      to={`/templates/${template.id}`}
      className="group snap-start shrink-0 w-48 sm:w-56 rounded-lg border border-border bg-background transition-colors hover:bg-card-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <div className="flex aspect-[16/9] items-center justify-center rounded-t-lg bg-gradient-to-br from-gold-soft to-gold/5">
        {ext ? (
          <span className="rounded-md bg-gold/15 px-2.5 py-1 font-mono text-xs font-semibold text-gold-strong">
            {ext}
          </span>
        ) : (
          <FileSpreadsheet className="size-8 text-gold/30" aria-hidden="true" />
        )}
      </div>
      <div className="px-3 pb-3 pt-2.5">
        <p className="eyebrow">Template</p>
        <h4 className="mt-1 text-sm font-semibold text-foreground line-clamp-2 decoration-1 underline-offset-4 group-hover:underline">
          {template.title}
        </h4>
        {template.description && (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {template.description}
          </p>
        )}
        <p className="mt-1 font-mono text-xs text-foreground">
          {template.is_free ? 'Free' : template.product ? formatCurrency(template.product.price_amount, template.product.currency) : null}
        </p>
      </div>
    </Link>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Bento tile — header + horizontal scroll + see-all link
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// 5. Products — editorial rows, no boxes
// ─────────────────────────────────────────────────────────────────────────────

/** A single product row — editorial treatment, not a card.
 * Large type label on the left, description, scrollable items, see-all link.
 * Each row is separated by a hairline, not a box boundary. */
function ProductRow({
  icon: Icon,
  label,
  description,
  accentColor,
  seeAllHref,
  seeAllLabel,
  children,
}: {
  icon: typeof Library
  label: string
  description: string
  accentColor: string
  seeAllHref: string
  seeAllLabel: string
  children: ReactNode
}) {
  return (
    <div className="border-t border-border pt-6">
      <div className="flex items-baseline justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: `color-mix(in srgb, ${accentColor} 12%, transparent)`, color: accentColor }}
          >
            <Icon className="size-4" aria-hidden="true" />
          </span>
          <h3 className="text-h3 font-semibold text-foreground">{label}</h3>
        </div>
        <Link
          to={seeAllHref}
          className="group hidden items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline sm:inline-flex"
        >
          {seeAllLabel}
          <ArrowRight className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
      </div>
      <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{description}</p>

      {/* Horizontal scroll of items — full width, no card wrapper */}
      <div className="mt-4">
        <ProductScrollRow label={label}>{children}</ProductScrollRow>
      </div>

      {/* Mobile see-all — hidden on desktop where it sits in the header row */}
      <Link
        to={seeAllHref}
        className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline sm:hidden"
      >
        {seeAllLabel}
        <ArrowRight className="size-3.5" aria-hidden="true" />
      </Link>
    </div>
  )
}

function ProductSection({ courses, templates, packs }: { courses: CourseSummary[] | undefined; templates: TemplateSummary[] | undefined; packs: PackSummary[] | undefined }) {
  const hasCourses = (courses?.length ?? 0) > 0
  const hasTemplates = (templates?.length ?? 0) > 0
  const hasPacks = (packs?.length ?? 0) > 0
  if (!hasCourses && !hasTemplates && !hasPacks) return null

  const freeTemplate = templates?.find((t) => t.is_free)

  return (
    <section className="band py-10 sm:py-12">
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <SectionOpener
          eyebrow="When the answer isn't enough"
          title="Go further — learn it, use it, or take the whole domain."
          lead="The questions and answers are free. Where a problem needs more than a page, that is what the packs, courses and templates below are."
        />

        {/* Editorial rows — each product type is a full-width section, not a box */}
        <div className="mt-6 space-y-2">
          {hasCourses && (
            <ProductRow
              icon={GraduationCap}
              label="Courses"
              description="Video, reading and downloadable working files in one guided path."
              accentColor="var(--color-primary)"
              seeAllHref="/courses"
              seeAllLabel="All courses"
            >
              {courses!.map((course) => (
                <MiniCourseCard key={course.slug} course={course} />
              ))}
            </ProductRow>
          )}

          {hasPacks && (
            <ProductRow
              icon={Library}
              label="Reference packs"
              description="Every question in a domain, formatted as one PDF in a working order."
              accentColor="var(--color-accent)"
              seeAllHref="/store"
              seeAllLabel="All reference packs"
            >
              {packs!.map((pack) => (
                <MiniPackCard key={pack.slug} pack={pack} />
              ))}
            </ProductRow>
          )}

          {hasTemplates && (
            <ProductRow
              icon={FileSpreadsheet}
              label="Templates"
              description="Ready-to-use working files — the practical companion to the guidance."
              accentColor="var(--color-gold-strong)"
              seeAllHref="/templates"
              seeAllLabel="All templates"
            >
              {templates!.map((template) => (
                <MiniTemplateCard key={template.id} template={template} />
              ))}
            </ProductRow>
          )}
        </div>

        {/* Free template CTA */}
        {freeTemplate && (
          <div className="mt-6 border-t border-border pt-6">
            <Link
              to={`/templates/${freeTemplate.id}`}
              className="group flex items-center gap-4 rounded-xl border border-gold/30 bg-gold/5 px-5 py-4 transition-colors hover:bg-gold/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold sm:items-center sm:gap-5 sm:px-6 sm:py-5"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-gold/15 text-gold-strong">
                <Download className="size-5" aria-hidden="true" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-foreground">Try a free template</h4>
                  <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-[0.625rem] font-medium text-gold-strong">
                    <Sparkles className="size-2.5" aria-hidden="true" /> Free
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground line-clamp-1">
                  {freeTemplate.description || freeTemplate.title} — no account needed.
                </p>
              </div>
              <span className="hidden shrink-0 text-sm font-medium text-gold-strong transition-transform duration-150 group-hover:translate-x-0.5 sm:inline">
                Get it free
              </span>
              <ArrowRight className="size-4 shrink-0 text-gold-strong transition-transform duration-150 group-hover:translate-x-0.5 sm:hidden" aria-hidden="true" />
            </Link>
          </div>
        )}
      </div>
    </section>
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
    <section id="free-pack" className="scroll-mt-24 py-10 sm:py-12">
      <div className="mx-auto w-full max-w-4xl px-5 text-center sm:px-8">
        <h2 className="text-balance text-h2 font-semibold text-foreground">
          What risk problem are you dealing with?
        </h2>
        <p className="mx-auto mt-4 max-w-xl font-serif text-read text-muted-foreground">
          All of the questions and answers are free to read. Start with the one that sounds like your week.
        </p>

        <form onSubmit={handleSearch} className="mx-auto mt-8 max-w-xl">
          <div className="flex flex-col gap-3 sm:relative sm:gap-0">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-primary/70" aria-hidden="true" />
              <label htmlFor="closing-finder" className="sr-only">Search the questions</label>
              <Input id="closing-finder" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="What are you trying to solve?" className="h-14 rounded-xl border-border-strong/60 bg-card pl-11 pr-4 text-base sm:pr-36" />
            </div>
            <Button type="submit" size="lg" className="w-full sm:absolute sm:right-2 sm:top-2 sm:h-10 sm:w-auto sm:px-4 sm:text-sm">Find an answer</Button>
          </div>
        </form>

        <div className="mt-6 border-t border-border pt-8">
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
        </div>
      </div>
    </section>
  )
}
