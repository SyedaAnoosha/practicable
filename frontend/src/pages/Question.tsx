import { Link, useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  Banknote,
  BookOpen,
  Clock,
  Download,
  Gauge,
  Landmark,
  Layers,
  Lock,
  Play,
  Tag,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { domainColorVar, domainVisual } from '@/lib/domainVisuals'
import { useAuthStore } from '@/stores/useAuthStore'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageTitle } from '@/components/ui/PageTitle'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { RoutedProducts } from '@/components/content/RoutedProducts'

interface Tag {
  dimension: string
  value: string
  display_label: string
}

interface QuestionSummary {
  id: string
  slug: string
  title: string
  subtitle?: string
  preview: string
  domain: string
  tags: Tag[]
}

interface RelatedLesson {
  course_slug: string
  course_title: string
  lesson_slug: string
  lesson_title: string
  lesson_type: string
  owned: boolean
  // The cheapest product that unlocks THIS lesson, resolved per-lesson server-side.
  unlock_product_slug?: string | null
  unlock_product_name?: string | null
}

interface QuestionData {
  id: string
  slug: string
  title: string
  subtitle?: string
  preview: string
  // Always present — the written guidance is the free entry point, not the paid
  // product. `gated` below only describes the upsell card.
  body: string
  domain: string
  tags: Tag[]
  gated: boolean
  related_content: Array<{ slug: string; name: string; price_amount: number; currency: string }>
  related_questions: QuestionSummary[]
  // The course lesson(s) this question leads into, with entitlement state.
  related_lessons: RelatedLesson[]
}

const LESSON_TYPE_ICONS: Record<string, LucideIcon> = {
  video: Play,
  reading: BookOpen,
  download: Download,
  mixed: Layers,
}

// One icon per tag dimension (DESIGN.md §14.1).
const TAG_ICONS: Record<string, LucideIcon> = {
  effort: Gauge,
  duration: Clock,
  cost: Banknote,
  roi_horizon: TrendingUp,
  tier: Layers,
  regulator_pressure: Landmark,
  leadership_traits: Users,
}

// Sentence case, with "ROI" the one acronym keeping its caps. Falls back to the raw
// dimension name for anything new.
const TAG_LABELS: Record<string, string> = {
  effort: 'Effort',
  duration: 'Duration',
  cost: 'Cost',
  roi_horizon: 'ROI horizon',
  tier: 'Tier',
  regulator_pressure: 'Regulator pressure',
  leadership_traits: 'Leadership traits',
}

export function Question() {
  const { slug } = useParams<{ slug: string }>()
  const user = useAuthStore((s) => s.user)

  const { data: question, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.questions.detail(slug ?? ''),
    queryFn: () => api.get<QuestionData>(`/questions/${slug}`).then((res) => res.data),
    enabled: !!slug,
  })

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-label="Loading question">
        <div className="size-8 animate-spin rounded-full border-2 border-border border-t-primary" />
        <span className="sr-only">Loading question…</span>
      </div>
    )
  }

  // Generic error state — no detail leaked, one action that retries.
  if (error) {
    return (
      <div className="mx-auto w-full max-w-2xl px-5 py-11 sm:px-8">
        <EmptyState
          title="We couldn't load this question."
          description="Check your connection and try again."
          action={<Button onClick={() => refetch()}>Try again</Button>}
        />
      </div>
    )
  }

  if (!question) return null

  // Carried through the breadcrumb, the eyebrow rule, and the tag grid below.
  const domainColor = domainColorVar(question.domain)
  const DomainIcon = domainVisual(question.domain).icon

  return (
    // Editorial mode: everything stays in one scroll — no tabs, no accordion.
    <div className="relative mx-auto w-full max-w-7xl px-5 py-8 sm:px-8">
      {/* A quiet domain-tinted wash behind the header block only, full-bleed to the
          viewport edge via the `left-1/2 … w-screen` technique (this sits inside a
          max-w-7xl container, so `inset-x-0` would stop at the container edge).
          Static, and kept out of the a11y tree. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 h-[30rem] w-screen -translate-x-1/2"
        style={{
          // Two layers: the domain blue desaturates to grey over ivory on its own, so
          // the champagne gold is what keeps it reading as a deliberate warm tint.
          // Both are linear, not radial — an ellipse in a fixed-height box always
          // exposes its own edge somewhere.
          backgroundImage: [
            `linear-gradient(180deg, color-mix(in srgb, ${domainColor} 22%, var(--accent)) 0%, transparent 65%)`,
            `linear-gradient(115deg, transparent 30%, color-mix(in srgb, var(--gold) 55%, transparent) 100%)`,
          ].join(','),
          // Low enough that body text over it is unaffected; the mask does the rest.
          opacity: 0.16,
          // Fades in and out to nothing well before the box ends, so the wash is never
          // clipped by its own container at any viewport width.
          maskImage: 'linear-gradient(to bottom, transparent 0%, black 14%, black 42%, transparent 92%)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 14%, black 42%, transparent 92%)',
        }}
      />

      <div className="relative">
        {/* "Questions" links home; the domain is the current page, not a link. */}
        <nav aria-label="Breadcrumb" className="animate-enter mb-8">
          <ol className="flex items-center gap-2 text-xs text-muted-foreground">
            <li>
              <Link to="/" className="transition-colors duration-150 hover:text-foreground">
                Questions
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="flex items-center gap-1.5 font-medium" style={{ color: domainColor }}>
              <DomainIcon className="size-3.5" aria-hidden="true" />
              {question.domain}
            </li>
          </ol>
        </nav>

        {/* Variant="editorial" gives this page the serif title treatment no other page
            uses. The title stays solid-coloured — a long wrapping headline is where a
            gradient fill fights legibility, and the wash above already carries colour. */}
        <div className="animate-enter" style={{ animationDelay: '60ms' }}>
          <PageTitle
            eyebrow={question.domain}
            eyebrowColor={domainColor}
            title={question.title}
            description={question.subtitle}
            variant="editorial"
          />
        </div>

        {/* The short answer — serif lead, fully public. */}
        <p className="animate-enter mt-6 font-serif text-lead text-muted-foreground" style={{ animationDelay: '110ms' }}>
          {question.preview}
        </p>

        {/* All seven tags as a definition grid, deliberately not a row of badges. Every
            tile carries this question's domain colour; regulator pressure keeps the
            accent blue so the one urgent signal still stands out.

            Not a real `<dl>`: per the HTML spec a `<dl>`'s (or its wrapping div's)
            children may only be dt/dd groups, and an icon `<span>` sibling trips axe's
            `definition-list`/`dlitem`/`only-dlitems` rules. These are labelled metadata
            values, not a glossary of defined terms,
            so a plain div structure is the more accurate semantic fit anyway, not just
            the expedient fix. */}
        <div className="animate-enter mt-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-4" style={{ animationDelay: '160ms' }}>
          {Array.from(
            question.tags
              .reduce((byDimension, tag) => {
                const group = byDimension.get(tag.dimension)
                if (group) group.push(tag)
                else byDimension.set(tag.dimension, [tag])
                return byDimension
              }, new Map<string, Tag[]>()),
          ).map(([dimension, tags]) => {
            const Icon = TAG_ICONS[dimension] ?? Tag
            const isUrgent = dimension === 'regulator_pressure'
            return (
              <div key={dimension} className="flex items-start gap-2.5">
                <span
                  className={cn(
                    'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md',
                    // Solid fill, not a light tint: every other tile is also a shade
                    // of blue, so only full strength still reads as "the urgent one".
                    isUrgent && 'bg-accent text-accent-foreground shadow-sm',
                  )}
                  style={
                    isUrgent
                      ? undefined
                      : { backgroundColor: `color-mix(in srgb, ${domainColor} 12%, transparent)`, color: domainColor }
                  }
                >
                  <Icon className="size-3.5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                    {TAG_LABELS[dimension] ??
                      dimension.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())}
                  </p>
                  {/* Leadership traits is multi-select, so its row comma-joins values. */}
                  <p className="text-sm font-medium leading-snug text-foreground">
                    {tags.map((tag) => tag.display_label).join(', ')}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

      <section className="mt-6 max-w-7xl">
        <SectionHeading>Guidance</SectionHeading>

        {/* Free to read, no gate at all — not even a soft email prompt. `gated`
            below controls only the upsell card, never whether this text is shown. */}
        <p className="mt-4 whitespace-pre-line font-serif text-read text-pretty text-foreground">
          {question.body}
        </p>
      </section>

      {/* The paid product — a direct buy surface shown alongside the free guidance
          above, not instead of it. */}
      {question.gated && question.related_content[0] && (
        <Card
          className="mt-8 border-l-4 shadow-sm transition-[box-shadow] duration-150 hover:shadow-md"
          style={{ borderLeftColor: 'var(--accent)' }}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent ring-1 ring-inset ring-accent/25">
                <Lock className="size-4" aria-hidden="true" />
              </span>
              Put it into practice with {question.related_content[0].name}
            </CardTitle>
            {/* Names no specific contents: the cheapest related product is the template
                alone, so promising a video lesson would oversell what this grants. */}
            <CardDescription>
              The working tool that goes with this guidance.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {/* Accent-blue only because this is 24px — the token is large-text-only on
                light surfaces (theme.css). Do not shrink it. */}
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-2xl font-semibold tabular-nums text-accent">
                {formatCurrency(question.related_content[0].price_amount, question.related_content[0].currency)}
              </span>
              <span className="text-sm text-muted-foreground">
                One-time purchase · lifetime access
              </span>
            </div>

            {/* One click to the pre-checkout summary, not into a catalogue. /buy/:slug
                sits under MemberLayout, whose guard redirects a logged-out click. */}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link to={`/buy/${question.related_content[0].slug}`} className="sm:flex-1">
                <Button className="w-full">
                  See what's included <ArrowRight className="size-4" aria-hidden="true" />
                </Button>
              </Link>
              {!user && (
                <Link to="/sign-in" className="sm:flex-1">
                  <Button variant="outline" className="w-full">
                    Already bought it? Sign in
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Related templates, entitled view. Ownership is only provable with a single
          listed product (the gate passes through a granting product, so a one-item list
          is necessarily owned); with several, stay neutral — no badge, no price. */}
      {!question.gated && question.related_content.length > 0 && (
        <section className="mt-8 border-t border-border pt-8">
          <SectionHeading>Related templates</SectionHeading>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {question.related_content.map((p) => (
              <Card key={p.slug}>
                <CardHeader>
                  <CardTitle>{p.name}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center justify-between gap-3">
                  {question.related_content.length === 1 && <Badge variant="success">In your library</Badge>}
                  <Link to={`/buy/${p.slug}`}>
                    <Button variant="outline" size="sm">
                      View
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Products that include this question - routed upsell panel */}
      <RoutedProducts questionSlug={question.slug} questionTitle={question.title} />

      {/* A signpost to the course this question leads into, not a second player. Locked
          rows stay visible with a lock icon rather than being hidden. */}
      {question.related_lessons.length > 0 && (
        <section className="mt-8 border-t border-border pt-8">
          <SectionHeading>From the related course</SectionHeading>
          <ul className="mt-4 flex flex-col divide-y divide-border">
            {question.related_lessons.map((lesson) => {
              const Icon = LESSON_TYPE_ICONS[lesson.lesson_type] ?? Play
              return (
                <li key={lesson.lesson_slug} className="flex items-center gap-4 py-4 first:pt-0">
                  <span
                    className={cn(
                      'flex size-9 shrink-0 items-center justify-center rounded-md',
                      lesson.owned ? 'bg-success/10 text-success' : 'bg-secondary/70 text-muted-foreground',
                    )}
                  >
                    {lesson.owned ? <Icon className="size-4" aria-hidden="true" /> : <Lock className="size-4" aria-hidden="true" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{lesson.lesson_title}</p>
                    <p className="text-xs text-muted-foreground">{lesson.course_title}</p>
                  </div>
                  {lesson.owned ? (
                    <Link
                      to={`/learn/${lesson.course_slug}/${lesson.lesson_slug}`}
                      className="shrink-0 text-sm font-medium text-primary hover:underline"
                    >
                      Continue
                    </Link>
                  ) : lesson.unlock_product_slug ? (
                    // The product that unlocks THIS lesson, not related_content[0] —
                    // which can be a cheaper product that leaves the lesson locked.
                    <Link
                      to={`/buy/${lesson.unlock_product_slug}`}
                      className="shrink-0 text-sm font-medium text-muted-foreground hover:text-foreground"
                    >
                      {lesson.unlock_product_name ?? 'Unlock'}
                    </Link>
                  ) : (
                    <span className="shrink-0 text-sm text-muted-foreground">Locked</span>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* Omitted entirely when empty rather than padded with anything invented. */}
      {question.related_questions.length > 0 && (
        <section className="mt-8 border-t border-border pt-8">
          <SectionHeading>Related questions</SectionHeading>
          <ul className="mt-4 flex flex-col divide-y divide-border">
            {question.related_questions.map((rq) => (
              <li key={rq.slug} className="py-5 first:pt-0">
                <Link to={`/questions/${rq.slug}`} className="group block">
                  <p className="eyebrow">{rq.domain}</p>
                  <h3 className="mt-1 text-base font-semibold text-foreground group-hover:text-primary">
                    {rq.title}
                  </h3>
                  {rq.subtitle && <p className="mt-1 text-sm text-muted-foreground">{rq.subtitle}</p>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      </div>
    </div>
  )
}
