import { type CSSProperties } from 'react'
import { Link, useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import {
  CircleCheck,
  Clock,
  Download,
  FileText,
  GraduationCap,
  HelpCircle,
  Infinity as InfinityIcon,
  Layers,
  Lock,
  PlayCircle,
  ReceiptText,
  User,
} from 'lucide-react'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import { ACCESS_ENDED_BODY, ACCESS_ENDED_HEADING } from '@/lib/labels'
import { domainColorVar } from '@/lib/domainVisuals'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { AuthorCard } from '@/components/ui/AuthorCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { FactStrip, type Fact } from '@/components/ui/FactStrip'
import { Accordion, type AccordionItemData } from '@/components/ui/Accordion'
import { CourseArt } from '@/components/ui/CourseArt'
import { ShowMore } from '@/components/ui/ShowMore'
import { TestimonialSection } from '@/components/ui/Testimonial'
import { BookmarkButton } from '@/components/ui/BookmarkButton'
import { useFeaturedReviews } from '@/hooks/useFeaturedReviews'

function FeaturedTestimonials({ contentType, contentId }: { contentType: string; contentId: string }) {
  const { data: reviews } = useFeaturedReviews(contentType, contentId)
  if (!reviews || reviews.length === 0) return null
  return <TestimonialSection reviews={reviews} />
}

type LessonType = 'video' | 'reading' | 'download' | 'mixed'

interface LessonOutline {
  id: string
  slug: string
  title: string
  lesson_type: LessonType
  sort_order: number
  duration_seconds: number | null
  locked: boolean
  completed: boolean
}

interface ModuleQuestionItem {
  id: string
  slug: string
  title: string
  sort_order: number
}

interface ModuleOut {
  id: string
  title: string
  description: string | null
  sort_order: number
  lessons: LessonOutline[]
  questions: ModuleQuestionItem[]
}

interface RelatedProduct {
  slug: string
  name: string
  price_amount: number
  currency: string
}

interface CourseDetailData {
  id: string
  slug: string
  title: string
  subtitle: string | null
  description: string
  section: string
  author_name: string
  /** B5: the credential line. Optional — not every author has a bio on file. */
  author_bio?: string | null
  owned: boolean
  lesson_count: number
  first_lesson_slug: string | null
  cover_image_url?: string | null
  modules: ModuleOut[]
  related_products: RelatedProduct[]
  /** ISO timestamp when a refund ended this reader's access to this course. Null in
   *  every other case, including a course they never bought (W4-R20, ledger row 92). */
  access_ended_at?: string | null
  /** W5-R2: whether this reader has completed every lesson in the course. */
  completed: boolean
  /** W5-R2: verification code for the reader's certificate, if one was issued. */
  certificate_verification_code?: string | null
}

const LESSON_ICON: Record<LessonType, typeof PlayCircle> = {
  video: PlayCircle,
  reading: FileText,
  download: Download,
  mixed: PlayCircle,
}

function formatDuration(seconds: number | null): string | null {
  if (!seconds) return null
  const minutes = Math.round(seconds / 60) || 1
  return `${minutes} min`
}

/** Total runtime across a module's lessons, as "1h 12m" / "37 min". Returns null when
 *  no lesson in the module carries a duration — an absent total is better than "0 min",
 *  which would read as a claim that the module is empty. */
function moduleDuration(module: ModuleOut): string | null {
  const total = module.lessons.reduce((sum, l) => sum + (l.duration_seconds ?? 0), 0)
  if (!total) return null
  const minutes = Math.round(total / 60)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours}h ${rest}m` : `${hours}h`
}

// DESIGN.md §23.3's course product page — the public syllabus a stranger reads before
// buying.
//
// `[REBUILT 2026-08-20, design-research/PLATFORM_UI_UX_RESEARCH.md §9 P0 items 1/5/6]`
// The previous version was a max-w-4xl single column: title, a run-on muted metadata
// line, a flat fully-expanded syllabus, and `related_products` fetched but never
// rendered. The research capture found every comparable page in the market uses a dark
// identity band, a fact strip, a collapsed curriculum accordion carrying per-module
// counts, and a sticky buy rail — Udemy fits a 374-lecture course into 3025px that way,
// against edX's 6943px for less. This adopts that structure in Practicable's own
// language: the `--stage` plane it already owns, the domain colour, and the mono face
// for figures.
export function CourseDetail() {
  const { slug } = useParams<{ slug: string }>()

  const {
    data: course,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.courses.detail(slug ?? ''),
    queryFn: () => api.get<CourseDetailData>(`/courses/${slug}`).then((res) => res.data),
    enabled: !!slug,
  })

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-label="Loading course">
        <div className="size-8 animate-spin rounded-full border-2 border-border border-t-primary" />
        <span className="sr-only">Loading course…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-2xl px-5 py-11 sm:px-8">
        <EmptyState
          title="We couldn't load this course."
          description="Check your connection and try again."
          action={<Button onClick={() => refetch()}>Try again</Button>}
        />
      </div>
    )
  }

  if (!course) return null

  const startHref = course.first_lesson_slug ? `/learn/${course.slug}/${course.first_lesson_slug}` : null
  const primaryProduct = course.related_products[0]
  // Everything after the first is genuinely "related" rather than the thing that sells
  // this course — the buy rail takes [0], this rail takes the rest.
  const alsoAvailable = course.related_products.slice(1)
  const tone = domainColorVar(course.section)

  const totalSeconds = course.modules
    .flatMap((m) => m.lessons)
    .reduce((sum, l) => sum + (l.duration_seconds ?? 0), 0)
  const totalMinutes = Math.round(totalSeconds / 60)
  const runtime =
    totalMinutes >= 60
      ? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`.replace(' 0m', '')
      : totalMinutes > 0
        ? `${totalMinutes} min`
        : null
  const downloadCount = course.modules
    .flatMap((m) => m.lessons)
    .filter((l) => l.lesson_type === 'download').length

  // The four facts a buyer decides on, each with the edX-style one-line explainer.
  // Runtime and downloads are omitted rather than shown as zero when the data has none
  // — the absence rule this codebase already applies to product evidence.
  const facts: Fact[] = [
    {
      icon: Layers,
      label: 'Structure',
      value: `${course.modules.length} ${course.modules.length === 1 ? 'module' : 'modules'}`,
      hint: `${course.lesson_count} ${course.lesson_count === 1 ? 'lesson' : 'lessons'} in total`,
      numeric: true,
    },
    ...(runtime
      ? [{ icon: Clock, label: 'Length', value: runtime, hint: 'Work at your own pace', numeric: true }]
      : []),
    ...(downloadCount > 0
      ? [
          {
            icon: Download,
            label: 'Includes',
            value: `${downloadCount} ${downloadCount === 1 ? 'template' : 'templates'}`,
            hint: 'Working files you keep',
            numeric: true,
          } as Fact,
        ]
      : []),
    {
      icon: InfinityIcon,
      label: 'Access',
      value: 'Lifetime',
      hint: 'One-time purchase, no subscription',
    },
  ]

  // Each module collapses to one row carrying its own counts, so a ten-module course is
  // scannable at a glance instead of a wall. The first module opens by default — the
  // reader should see the shape of a module without having to click.
  const syllabus: AccordionItemData[] = course.modules.map((module) => {
    const duration = moduleDuration(module)
    const itemCount = module.lessons.length + module.questions.length
    return {
      id: module.id,
      title: module.title,
      description: module.description,
      summary: [
        `${itemCount} ${itemCount === 1 ? 'item' : 'items'}`,
        duration,
      ]
        .filter(Boolean)
        .join(' · '),
      content: (
        <ul className="flex flex-col divide-y divide-border border-t border-border">
          {module.lessons.map((lesson) => {
            const Icon = LESSON_ICON[lesson.lesson_type]
            const duration = formatDuration(lesson.duration_seconds)
            const row = (
              <div className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  {lesson.completed ? (
                    <CircleCheck className="size-4 text-success" aria-hidden="true" />
                  ) : lesson.locked ? (
                    <Lock className="size-3.5" aria-hidden="true" />
                  ) : (
                    <Icon className="size-4" aria-hidden="true" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-foreground">{lesson.title}</span>
                  <span className="text-xs capitalize text-muted-foreground">{lesson.lesson_type}</span>
                </span>
                {duration && (
                  <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                    {duration}
                  </span>
                )}
              </div>
            )
            return (
              <li key={lesson.id}>
                {!lesson.locked ? (
                  <Link
                    to={`/learn/${course.slug}/${lesson.slug}`}
                    className="block transition-colors duration-150 hover:bg-muted/60"
                  >
                    {row}
                  </Link>
                ) : (
                  /* `[FIXED 2026-08-22, Redesing_decisions.md F4 — P0]` This was
                   * `opacity-60`, which is precisely the treatment F4 forbids: "never a
                   * greyed-out, disabled-looking title — the user should read clearly
                   * what they're missing; that's the persuasive mechanism."
                   *
                   * Fading a locked lesson makes the syllabus harder to evaluate, which
                   * is the opposite of what the docs' own rule wants ("every lesson
                   * shown, all locked — a course whose syllabus you can't see is harder
                   * to evaluate, not more exclusive"). Dimming also drags the title
                   * under 4.5:1 against the card.
                   *
                   * The row now renders at full contrast and says WHY it is locked. */
                  <div className="flex items-center justify-between gap-3 pr-4">
                    {row}
                    <span className="shrink-0 text-xs text-muted-foreground">
                      Included with the course
                    </span>
                  </div>
                )}
              </li>
            )
          })}

          {/* Questions attached to this module (ModuleQuestion) — always free and
              public, so these rows never carry a lock state. */}
          {module.questions.map((question) => (
            <li key={question.id}>
              <Link
                to={`/questions/${question.slug}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-muted/60"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <HelpCircle className="size-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-foreground">{question.title}</span>
                  <span className="text-xs text-muted-foreground">Related question</span>
                </span>
                <Badge variant="outline" className="shrink-0">
                  Free
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      ),
    }
  })

  return (
    <div>
      {/* ── Identity band, on the dark stage plane ──
          The research's most consistent structural finding for detail pages: put course
          identity on a dark plane and the content on light below it, and the page is
          hierarchically resolved before the reader scrolls at all. Practicable already
          owns this plane — it just had never been used on an interior page. */}
      <div className="relative isolate overflow-hidden bg-stage text-stage-foreground">
        <div aria-hidden="true" className="stage-aurora stage-aurora--quiet -z-10" />
        <div className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
          <Breadcrumb
            on="stage"
            items={[
              { label: 'Courses', to: '/courses' },
              { label: course.title },
            ]}
          />

          <div className="mt-5 grid gap-8 lg:grid-cols-[1fr_360px]">
            <div className="min-w-0">
              <p className="eyebrow text-stage-foreground/70" style={{ '--eyebrow-rule-color': tone } as CSSProperties}>
                {course.section}
              </p>
              <h1 tabIndex={-1} className="mt-3 max-w-3xl text-balance text-h1 font-semibold outline-none">
                {course.title}
              </h1>
              {course.subtitle && (
                <p className="mt-3 max-w-2xl font-serif text-lead text-stage-foreground/75">
                  {course.subtitle}
                </p>
              )}

              {/* W5-R5: save for later. Renders nothing for a signed-out visitor —
                  there is no account to save against, and a control that 401s on
                  click is worse than one that isn't offered. */}
              <BookmarkButton
                contentType="course"
                contentId={course.id}
                title={course.title}
                className="mt-4"
              />

              {/* The author, as a person rather than a fragment of a metadata line.
                  §6 of the research: authority is transmitted by a named human, and
                  this product's core claim is that the answers come from a practising
                  professional rather than a vendor. */}
              <div className="mt-5 flex items-center gap-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-stage-foreground/12 text-stage-foreground/85 ring-1 ring-inset ring-stage-foreground/20">
                  <User className="size-4" aria-hidden="true" />
                </span>
                <p className="text-sm text-stage-foreground/85">
                  Written by <span className="font-medium text-stage-foreground">{course.author_name}</span>
                </p>
              </div>

              {/* W5-R2: when the course is completed, show a certificate link instead
                  of the "Continue the course" CTA. A completed course with no certificate
                  is an edge case (certificate generation failed) — show Continue so the
                  learner can re-trigger completion. */}
              {course.owned && course.completed && course.certificate_verification_code && (
                <div className="mt-6 flex items-center gap-3">
                  <span className="inline-flex items-center gap-2 rounded-full bg-success/15 px-3 py-1.5 text-sm font-medium text-success ring-1 ring-inset ring-success/25">
                    <CircleCheck className="size-4" aria-hidden="true" />
                    Completed
                  </span>
                  <Link
                    to={`/verify/${course.certificate_verification_code}`}
                    className="text-sm font-medium text-stage-foreground underline decoration-stage-foreground/30 underline-offset-2 transition-colors hover:decoration-stage-foreground/70"
                  >
                    View certificate
                  </Link>
                </div>
              )}
              {course.owned && startHref && !course.completed && (
                <Link to={startHref} className="mt-6 inline-flex">
                  <Button size="lg">Continue the course</Button>
                </Link>
              )}

              {/* W4-R20 / ledger row 92 — the fourth state. Without this a refunded
                  buyer saw an ordinary buy page and was never told what happened.
                  `muted`, never `destructive`: a refund they asked for is a completed
                  transaction, not an error. The buy rail below stays exactly as it is,
                  so buying again is one scroll away rather than a dead end. */}
              {!course.owned && course.access_ended_at && (
                <div className="mt-6 max-w-prose rounded-lg border border-border bg-card/70 p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <ReceiptText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    {ACCESS_ENDED_HEADING}{' '}
                    <time dateTime={course.access_ended_at} className="font-normal text-muted-foreground">
                      {new Date(course.access_ended_at).toLocaleDateString('en-AU', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </time>
                  </p>
                  <p className="mt-1.5 text-sm text-muted-foreground">{ACCESS_ENDED_BODY}</p>
                  <Link
                    to="/purchases"
                    className="mt-3 inline-block text-sm font-medium text-foreground underline decoration-border underline-offset-2 transition-colors hover:decoration-gold-strong"
                  >
                    See this in your purchases
                  </Link>
                </div>
              )}
            </div>

            {/* Course artwork, echoing the aurora's corner-anchored composition. An
                uploaded cover still wins where one exists. */}
            <div className="hidden lg:block">
              <CourseArt
                slug={course.slug}
                domain={course.section}
                src={course.cover_image_url}
                alt={`Cover image for ${course.title}`}
                className="aspect-[16/10] rounded-xl ring-1 ring-inset ring-stage-foreground/15"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="min-w-0">
            <FactStrip facts={facts} tone={tone} />

            <section className="mt-8">
              <SectionHeading>About this course</SectionHeading>
              <ShowMore lines={5} className="mt-3 max-w-2xl">
                <p className="font-serif text-read text-pretty text-muted-foreground">
                  {course.description}
                </p>
              </ShowMore>
            </section>

            <section className="mt-8">
              <SectionHeading>Full syllabus</SectionHeading>
              <p className="mt-2 text-sm text-muted-foreground">
                Every lesson is listed whether or not you own the course. Questions attached to a
                module are free to read for everyone.
              </p>
              <Accordion
                className="mt-4"
                items={syllabus}
                defaultOpen={syllabus.length > 0 ? [syllabus[0].id] : []}
              />
            </section>

            {/* W5-R4 Stage A: featured testimonials */}
            <FeaturedTestimonials
              contentType="course"
              contentId={course.id}
            />

            {/* `[ADDED 2026-08-22, Redesing_decisions.md B5 — P1]` The hero already
                names the author on the stage plane, but a name alone is an assertion.
                The credential is what makes it evidence, and `AuthorCard` — built for
                exactly this and until now used on no page at all — carries it.

                It sits here, after the syllabus and BEFORE the upsell: someone who has
                read what the course contains is deciding whether to trust whoever wrote
                it, and that question has to be answered before they are offered
                something else to buy.

                Rendered only when a bio exists. The absence rule (§4.5) — an author with
                no credential on file gets the hero byline and nothing further, rather
                than an empty card advertising the gap. */}
            {course.author_bio && (
              <section className="mt-8">
                <SectionHeading>The author</SectionHeading>
                <AuthorCard className="mt-4" name={course.author_name} bio={course.author_bio} />
              </section>
            )}

            {/* Fetched by the API since this page was written, and until now dropped on
                the floor — the audit's finding 8. Every platform reviewed carries a
                related-content rail. */}
            {alsoAvailable.length > 0 && (
              <section className="mt-8">
                <SectionHeading>Also available</SectionHeading>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {alsoAvailable.map((product) => (
                    <Link key={product.slug} to={`/buy/${product.slug}`} className="group">
                      <Card className="hover-lift flex h-full items-center justify-between gap-4 p-4">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{product.name}</p>
                          <p className="mt-0.5 font-mono text-xs tabular-nums text-muted-foreground">
                            {formatCurrency(product.price_amount, product.currency)}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-medium text-accent group-hover:underline">
                          View
                        </span>
                      </Card>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* ── Sticky buy rail ──
              The same structure ProductBuy.tsx already uses (lg:grid-cols-[1fr_380px]),
              which the audit noted was the best-built page in the app while this one had
              no rail at all. Hidden entirely once owned, per §23.2's "never show a price
              on something the user already owns". */}
          {/* `[ADDED 2026-08-22]` A published course with no published product rendered
              *nothing* here — no price, no CTA, no explanation — and the mobile buy bar
              disappeared with it. A visitor reached a full syllabus and had no way to
              tell whether they had missed a button, whether the page was broken, or
              whether the course simply wasn't for sale. Six of the seven courses
              currently in the database are in exactly that state.
              The honest answer is the one the templates page already gives: say it
              isn't on sale, and offer the way back. */}
          {!course.owned && !primaryProduct && (
            <aside className="lg:sticky lg:top-6 lg:self-start">
              <Card className="shadow-sm">
                <CardContent className="flex flex-col gap-3 pt-6">
                  <p className="text-sm font-medium text-foreground">Not on sale yet</p>
                  <p className="text-sm text-muted-foreground">
                    This course is published so you can read the syllabus, but it
                    isn&rsquo;t available to buy at the moment.
                  </p>
                  <Link to="/courses" className="block">
                    <Button variant="outline" className="w-full">
                      Browse the other courses
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </aside>
          )}

          {!course.owned && primaryProduct && (
            <aside className="lg:sticky lg:top-6 lg:self-start">
              <Card
                className="border-l-4 shadow-sm"
                style={{ borderLeftColor: 'var(--accent)' }}
              >
                <CardContent className="flex flex-col gap-4 pt-6">
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent ring-1 ring-inset ring-accent/25">
                      <GraduationCap className="size-4" aria-hidden="true" />
                    </span>
                    <div>
                      {/* Accent-blue like every other buy card — large marketing price,
                          24px, large-text-safe (theme.css). Do not shrink it. */}
                      <p className="font-mono text-2xl font-semibold tabular-nums text-accent">
                        {formatCurrency(primaryProduct.price_amount, primaryProduct.currency)}
                      </p>
                      <p className="text-xs text-muted-foreground">One-time purchase · lifetime access</p>
                    </div>
                  </div>

                  <Link to={`/buy/${primaryProduct.slug}`} className="block">
                    <Button className="w-full">See what's included</Button>
                  </Link>

                  <ul className="flex flex-col gap-2 border-t border-border pt-4 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                      {course.lesson_count} {course.lesson_count === 1 ? 'lesson' : 'lessons'} across{' '}
                      {course.modules.length} {course.modules.length === 1 ? 'module' : 'modules'}
                    </li>
                    {downloadCount > 0 && (
                      <li className="flex items-start gap-2">
                        <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                        {downloadCount} downloadable {downloadCount === 1 ? 'template' : 'templates'}
                      </li>
                    )}
                    <li className="flex items-start gap-2">
                      <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                      Lifetime access, including updates
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </aside>
          )}
        </div>
      </div>

      {/* Mobile buy bar — the primary action always within thumb reach on a long page,
          matching the pattern ProductBuy.tsx already ships. Respects the iOS home
          indicator via env(safe-area-inset-bottom). */}
      {!course.owned && primaryProduct && (
        <div
          className="sticky bottom-0 z-30 flex items-center justify-between gap-3 border-t border-border bg-background/95 px-5 py-3 backdrop-blur-sm lg:hidden"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
          <div>
            <p className="font-mono text-lg font-semibold tabular-nums text-accent">
              {formatCurrency(primaryProduct.price_amount, primaryProduct.currency)}
            </p>
            <p className="text-xs text-muted-foreground">Lifetime access</p>
          </div>
          <Link to={`/buy/${primaryProduct.slug}`} className="shrink-0">
            <Button>See what's included</Button>
          </Link>
        </div>
      )}
    </div>
  )
}
