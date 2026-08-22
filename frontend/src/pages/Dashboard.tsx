import { useState, type CSSProperties, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  BookOpen,
  CircleCheck,
  Download,
  FileQuestion,
  FileText,
  GraduationCap,
  Layers,
  PlayCircle,
  Search,
  Tags,
} from 'lucide-react'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import { domainColorVar } from '@/lib/domainVisuals'
import { useAuthStore } from '@/stores/useAuthStore'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { PageTitle } from '@/components/ui/PageTitle'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { StatTiles, type Stat } from '@/components/ui/StatTiles'
import { TAG_VARIANT, cardTags } from '@/lib/tags'

// This page names no content: featured items come from the published lists
// (`/questions`, `/products`), so it shows what is actually live and renders nothing
// when something isn't, rather than a stale slug pointing at a 404'd or unpublished item.
// Each chip carries the real catalogue filter it stands for, matching
// QuestionsCatalogue's FILTER_PARAMS and the seeded tag vocabulary.
const FINDER_CHIPS = [
  { label: 'Do it in a fortnight', param: 'duration', value: 'S' },
  { label: 'Do it cheaply', param: 'cost', value: '$' },
  { label: 'Show your regulator', param: 'regulator_pressure', value: 'H' },
] as const

interface QuestionTag {
  dimension: string
  value: string
  display_label: string
}

interface QuestionSummary {
  id: string
  slug: string
  title: string
  subtitle?: string | null
  preview: string
  domain: string
  tags: QuestionTag[]
}

interface ProductContent {
  content_type: string
  label: string
  href: string | null
}

// The product API computes the right route per content_type; this just picks the
// icon that matches.
const CONTENT_ICON: Record<string, typeof PlayCircle> = {
  lesson: PlayCircle,
  template: Download,
  question_set: FileQuestion,
}

interface ProductData {
  id: string
  slug: string
  name: string
  description: string
  price_amount: number
  currency: string
  contents: ProductContent[]
}

// The library shape, reused from Library.tsx's endpoint — the dashboard's resume state
// comes from the same source of truth rather than a second computation.
interface LibraryCourse {
  kind: 'course'
  slug: string
  title: string
  subtitle?: string | null
  total_lessons: number
  completed_lessons: number
  percentage_complete: number
  resume_lesson_slug?: string | null
  resume_lesson_title?: string | null
}

interface LibraryTemplate {
  kind: 'template'
  id: string
  slug: string
  title: string
}

interface LibraryData {
  courses: LibraryCourse[]
  templates: LibraryTemplate[]
  reference: { slug: string; title: string; domain: string }[]
  is_empty: boolean
}

// Card rules live in lib/tags.ts (TAG_VARIANT + cardTags), so Home's featured question
// and this one render identical tags — one source of truth.

// The signed-in home page, split out from the public landing page (Home.tsx), which
// exists only to get someone to create an account or log in.
//
// `[REBUILT 2026-08-20, design-research/PLATFORM_UI_UX_RESEARCH.md §9 P0 item 4]`
// The audit named this the blandest page in the product and the one a paying member sees
// most: four stacked full-width blocks carrying one item each (search, one question, one
// product, one sentence), with no progress, no resume, no stats and no recommendations —
// while Library.tsx already had an excellent animated ContinueRail this page never
// imported. Every competitor's signed-in home leads with resume state; §6 of the research
// found progress shown far from the next action does not move behaviour.
//
// Restructured to: resume first (the verb), then a compact stat row, then a two-column
// grid for discovery. Same content, roughly 40% of the previous height.
export function Dashboard() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const user = useAuthStore((s) => s.user)
  const firstName = (user?.user_metadata?.name as string | undefined)?.split(' ')[0]

  // The list endpoint, not a detail fetch: `/questions` already returns everything
  // this card needs, and the finder below reuses the same cached list.
  const { data: questions } = useQuery({
    queryKey: queryKeys.questions.list(),
    queryFn: () => api.get<QuestionSummary[]>('/questions/index').then((res) => res.data),
  })
  const question = questions?.[0]

  const { data: products } = useQuery({
    queryKey: queryKeys.products.list(),
    queryFn: () => api.get<ProductData[]>('/products').then((res) => res.data),
  })
  // Newest published product — "featured" is recency, not a real editorial flag.
  const product = products?.[0]

  // ProductBuy.tsx got this same fix; this card is a separate render path.
  const { data: entitlements } = useQuery({
    queryKey: queryKeys.me.entitlements(),
    queryFn: () => api.get<{ product_ids: string[] }>('/me/entitlements').then((res) => res.data),
  })
  const alreadyOwnsProduct = !!product && !!entitlements?.product_ids.includes(product.id)

  // Shares Library.tsx's query key, so the two pages hit React Query's cache rather
  // than the network twice and can never disagree about progress.
  const { data: library } = useQuery({
    queryKey: queryKeys.me.library(),
    queryFn: () => api.get<LibraryData>('/me/library').then((res) => res.data),
  })

  // The one course to resume: furthest along without being finished. A member with
  // nothing in progress gets no panel rather than an empty one.
  const resumeCourse = library?.courses
    .filter((c) => c.resume_lesson_slug && c.completed_lessons > 0)
    .sort((a, b) => b.percentage_complete - a.percentage_complete)[0]

  // Counted from the responses rather than written down. This line has already been
  // wrong twice — it said "one question and one template" after the 100-question seed
  // landed, then "100 questions, one template, one course" after the catalogue moved on
  // again. A hand-maintained count of a database is a claim that goes stale silently, on
  // the page where a paying member is deciding whether to trust what else it says.
  const stats: Stat[] = [
    ...(questions ? [{ icon: Tags, value: questions.length, label: 'Questions live' }] : []),
    ...(library ? [{ icon: GraduationCap, value: library.courses.length, label: 'Courses owned' }] : []),
    ...(library ? [{ icon: FileText, value: library.templates.length, label: 'Templates owned' }] : []),
    ...(products ? [{ icon: Layers, value: products.length, label: 'In the store' }] : []),
  ]

  // Real navigation: a typed query goes to the catalogue with the search applied;
  // an empty submit just opens the catalogue.
  const goToQuestion = (e?: FormEvent) => {
    e?.preventDefault()
    const q = query.trim()
    navigate(q ? `/questions?q=${encodeURIComponent(q)}` : '/questions')
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-8">
      <PageTitle
        eyebrow="Your home"
        title={firstName ? `Welcome back, ${firstName}` : 'Welcome back'}
        description="Find the question you're trying to answer, then learn and apply it."
      />

      {/* ── Resume first ──
          The dashboard's job is to help the member ACT, not to report. When something is
          in progress, that is the only thing that belongs at the top — and it names the
          specific next lesson rather than saying "Continue", because §6 of the research
          found a resume point that names the next thing is what makes the action
          concrete. On the stage plane so it reads as the page's one anchor. */}
      {resumeCourse && (
        <section className="relative isolate mt-6 overflow-hidden rounded-2xl bg-stage p-5 text-stage-foreground sm:p-6">
          <div aria-hidden="true" className="stage-aurora stage-aurora--quiet -z-10" />
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="eyebrow text-stage-foreground/70">Continue where you left off</p>
              <p className="mt-2.5 text-sm text-stage-foreground/75">{resumeCourse.title}</p>
              <p className="mt-0.5 truncate text-h3 font-semibold text-stage-foreground">
                {resumeCourse.resume_lesson_title}
              </p>
              <div className="mt-4 max-w-sm">
                {/* The bar is on a dark plane here; the track uses a stage alpha rather
                    than --secondary, which is a light champagne and would glow. */}
                <div className="flex items-center justify-between text-xs text-stage-foreground/70">
                  <span>
                    {resumeCourse.completed_lessons} of {resumeCourse.total_lessons} lessons
                  </span>
                  <span className="font-mono tabular-nums">{resumeCourse.percentage_complete}%</span>
                </div>
                <div
                  className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-stage-foreground/15"
                  role="progressbar"
                  aria-valuenow={resumeCourse.percentage_complete}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${resumeCourse.title} progress`}
                >
                  <div
                    className="h-full rounded-full bg-gold transition-[width] duration-[400ms] ease-[var(--ease-entrance)]"
                    style={{ width: `${resumeCourse.percentage_complete}%` }}
                  />
                </div>
              </div>
            </div>
            <Link
              to={`/learn/${resumeCourse.slug}/${resumeCourse.resume_lesson_slug}`}
              className="shrink-0"
            >
              <Button size="lg">
                Continue <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            </Link>
          </div>
        </section>
      )}

      {/* ── The finder ──
          Still the page's centrepiece for a member with nothing in progress; one step
          down the page for one who has. Contained so it reads as a deliberate surface
          rather than a bare input. All of it is honest navigation. */}
      <form onSubmit={goToQuestion} className="mt-6">
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
              <Link
                key={chip.label}
                to={`/questions?${chip.param}=${encodeURIComponent(chip.value)}`}
                className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {chip.label}
              </Link>
            ))}
          </div>
        </div>
      </form>

      {/* Four counted facts in one row — the sentence that used to close this page,
          rendered as data. Still counted from the API, never written down. */}
      {stats.length > 0 && <StatTiles stats={stats} className="mt-6" />}

      {/* ── Discovery, two across ──
          Previously two full-width stacked blocks carrying one item each. The content is
          unchanged; the height is roughly halved. */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {question && (
          <section className="flex flex-col">
            <SectionHeading>Live now · {question.domain}</SectionHeading>
            <Card
              className="hover-lift mt-4 flex flex-1 flex-col border-l-4"
              style={{ borderLeftColor: domainColorVar(question.domain) } as CSSProperties}
            >
              <CardHeader>
                <CardTitle>{question.title}</CardTitle>
                {question.subtitle && <CardDescription>{question.subtitle}</CardDescription>}
              </CardHeader>
              <CardContent className="flex flex-1 flex-col">
                <p className="font-serif text-read text-muted-foreground line-clamp-3">
                  {question.preview}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {cardTags(question.tags).map((tag) => (
                    <Badge key={`${tag.dimension}-${tag.value}`} variant={TAG_VARIANT[tag.dimension]}>
                      {tag.display_label}
                    </Badge>
                  ))}
                </div>
                <Link to={`/questions/${question.slug}`} className="mt-auto inline-flex pt-5">
                  <Button>
                    Read the answer <ArrowRight className="size-4" aria-hidden="true" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </section>
        )}

        {/* Templates & courses — access states: owned shows the library state and never
            a price; not owned shows the price and the buy path. The content list links
            (with per-type icons) are real routes computed by the products API. */}
        {product && (
          <section className="flex flex-col">
            <SectionHeading>Templates &amp; tools</SectionHeading>
            <Card className="hover-lift mt-4 flex flex-1 flex-col">
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle>{product.name}</CardTitle>
                  <Badge variant={alreadyOwnsProduct ? 'success' : 'outline'}>
                    {alreadyOwnsProduct ? 'In your library' : 'Most popular'}
                  </Badge>
                </div>
                <CardDescription>{product.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col">
                <ul className="flex flex-col gap-2 text-sm">
                  {product.contents.map((content) => {
                    const Icon = CONTENT_ICON[content.content_type] ?? FileQuestion
                    // Lesson/template links 403 gracefully with a clear message, so it's
                    // safe to always link rather than leave content unreachable.
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
                <div className="mt-auto pt-5">
                  {alreadyOwnsProduct ? (
                    <p className="flex items-center gap-2 text-sm text-foreground" role="status">
                      <CircleCheck className="size-4 shrink-0 text-success" aria-hidden="true" />
                      In your library — lifetime access.
                    </p>
                  ) : (
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <div>
                        {/* Accent-blue like the question-page buy card: large marketing
                            price, the one figure allowed to be the accent (24px,
                            large-text-safe). */}
                        <p className="font-mono text-2xl font-semibold tabular-nums text-accent">
                          {formatCurrency(product.price_amount, product.currency)}
                        </p>
                        <p className="text-xs text-muted-foreground">One-time purchase · lifetime access</p>
                      </div>
                      <Link to={`/buy/${product.slug}`}>
                        <Button>See what's included</Button>
                      </Link>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </section>
        )}
      </div>

      {/* A member with things in the library gets a way back into them without going to
          another page first. Rendered only when there is something to show. */}
      {library && !library.is_empty && (
        <section className="mt-8">
          <SectionHeading>In your library</SectionHeading>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {library.courses.slice(0, 3).map((course) => (
              <Link key={course.slug} to={`/courses/${course.slug}`} className="group">
                <Card className="hover-lift flex h-full flex-col p-4">
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent">
                      <GraduationCap className="size-4" aria-hidden="true" />
                    </span>
                    <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                      {course.title}
                    </p>
                  </div>
                  <ProgressBar
                    className="mt-3"
                    size="sm"
                    value={course.percentage_complete}
                    label={`${course.title} progress`}
                    caption={`${course.completed_lessons} of ${course.total_lessons}`}
                  />
                </Card>
              </Link>
            ))}
            {library.templates.slice(0, 3 - Math.min(library.courses.length, 3)).map((t) => (
              <Link key={t.id} to={`/templates/${t.id}`} className="group">
                <Card className="hover-lift flex h-full items-center gap-2.5 p-4">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-gold-soft text-gold-strong ring-1 ring-inset ring-gold/40">
                    <FileText className="size-4" aria-hidden="true" />
                  </span>
                  <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{t.title}</p>
                </Card>
              </Link>
            ))}
          </div>
          <Link
            to="/library"
            className="mt-4 inline-flex items-center gap-1.5 rounded text-sm font-medium text-accent transition-colors hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <BookOpen className="size-4" aria-hidden="true" />
            Open my library
          </Link>
        </section>
      )}

      {/* Kept as a caption rather than a paragraph block — the counts now live in the
          stat row above, so this only carries the cadence claim. */}
      {questions && questions.length > 0 && (
        <p className="mt-8 text-center text-sm text-muted-foreground">
          More questions, templates and courses are added weekly.
        </p>
      )}
    </div>
  )
}
