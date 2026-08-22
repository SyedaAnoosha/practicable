import { type CSSProperties } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { CircleCheck, Clock, GraduationCap, Layers, PlayCircle, SlidersHorizontal } from 'lucide-react'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import { domainColorVar } from '@/lib/domainVisuals'
import { Badge } from '@/components/ui/Badge'
import { PageTitle } from '@/components/ui/PageTitle'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { CourseArt } from '@/components/ui/CourseArt'
import { Meta } from '@/components/ui/Meta'

interface RelatedProduct {
  slug: string
  name: string
  price_amount: number
  currency: string
}

interface CourseSummary {
  id: string
  slug: string
  title: string
  subtitle: string | null
  description: string
  section: string
  module_count: number
  lesson_count: number
  owned: boolean
  cover_image_url?: string | null
  level?: string | null
  estimated_duration_minutes?: number | null
  product?: RelatedProduct | null
}

// The course catalogue (DESIGN.md §41's /courses route). §23.1's card shape (eyebrow,
// title, outcome line, module/lesson count, access state) drives this grid.
//
// `[REBUILT 2026-08-20, design-research/PLATFORM_UI_UX_RESEARCH.md §9 P0 items 2/3]`
// Two changes, both from the audit. First, the grid was `sm:grid-cols-2` inside a
// max-w-7xl container — roughly 600px per card for content needing about 340, which is
// what made these cards read empty. Second, the cards carried no domain colour, no
// artwork, no duration and no price, so a course was indistinguishable from a template
// at a glance and could not be compared against another course at all. DataCamp fits
// seven facts into ~150px of card; this was carrying three.
const LEVELS = ['Beginner', 'Intermediate', 'Advanced'] as const
const DURATION_BUCKETS = [
  { label: 'Under 30 min', min: 0, max: 30 },
  { label: '30–60 min', min: 30, max: 60 },
  { label: '1–2 hours', min: 60, max: 120 },
  { label: 'Over 2 hours', min: 120, max: undefined },
] as const

function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null) return ''
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export function CoursesCatalogue() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeLevel = searchParams.get('level') ?? ''
  const activeDuration = searchParams.get('duration') ?? ''

  const queryParams: Record<string, string> = {}
  if (activeLevel) queryParams.level = activeLevel
  if (activeDuration) {
    const bucket = DURATION_BUCKETS.find((b) => b.label === activeDuration)
    if (bucket) {
      if (bucket.min > 0) queryParams.min_duration = String(bucket.min)
      if (bucket.max != null) queryParams.max_duration = String(bucket.max)
    }
  }

  const qs = new URLSearchParams(queryParams).toString()
  const url = `/courses${qs ? `?${qs}` : ''}`

  // `[CHANGED 2026-08-22, F3 — P0]` See QuestionsCatalogue: without `isError` a failed
  // fetch rendered nothing at all — `courses?.length === 0` is falsy when undefined.
  const { data: courses, isLoading, isError, refetch } = useQuery({
    queryKey: [...queryKeys.courses.list(), queryParams],
    queryFn: () => api.get<CourseSummary[]>(url).then((res) => res.data),
  })

  const toggleLevel = (level: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (next.get('level') === level) next.delete('level')
      else next.set('level', level)
      return next
    })
  }

  const toggleDuration = (label: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (next.get('duration') === label) next.delete('duration')
      else next.set('duration', label)
      return next
    })
  }

  const clearFilters = () => setSearchParams(new URLSearchParams())

  return (
    <div className="relative isolate mx-auto w-full max-w-7xl px-5 py-8 sm:px-8">
      {/* Catalogue header atmosphere (theme.css .page-wash). Full-bleed to the viewport
          edge via `left-1/2 … w-screen`, since this sits inside a max-w container where
          `inset-x-0` would stop at the container edge. `-z-10` inside the parent's
          `isolate` keeps it behind the content without wrapping every child in a
          positioned div. Decorative, so out of the a11y tree. */}
      <div aria-hidden="true" className="page-wash absolute left-1/2 top-0 -z-10 h-[30rem] w-screen -translate-x-1/2" />
      <PageTitle
        eyebrow="Learn"
        title="Courses"
        description="Structured, multi-lesson courses — video, reading and downloadable templates, in one guided path."
        action={
          courses && courses.length > 0 ? (
            <p className="font-mono text-sm tabular-nums text-muted-foreground">
              {courses.length} {courses.length === 1 ? 'course' : 'courses'}
            </p>
          ) : undefined
        }
      />

      {/* Filter controls — level and duration. Chips toggle URL params so the
          filter state survives page refreshes and back-navigation. */}
      {(LEVELS.length > 0 || DURATION_BUCKETS.length > 0) && (
        <div className="mt-6 flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="size-4 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-medium text-foreground">Filter</p>
            {(activeLevel || activeDuration) && (
              <button type="button" onClick={clearFilters} className="ml-auto text-xs font-medium text-primary hover:underline">
                Clear all
              </button>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:gap-6">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Level</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {LEVELS.map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => toggleLevel(l)}
                    aria-pressed={activeLevel === l}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      activeLevel === l
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border text-muted-foreground hover:border-primary hover:text-primary'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground">Duration</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {DURATION_BUCKETS.map((b) => (
                  <button
                    key={b.label}
                    type="button"
                    onClick={() => toggleDuration(b.label)}
                    aria-pressed={activeDuration === b.label}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      activeDuration === b.label
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border text-muted-foreground hover:border-primary hover:text-primary'
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <h2 className="sr-only">Course list</h2>

      {isLoading && (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-72 animate-pulse rounded-xl border border-border bg-muted/40" />
          ))}
        </div>
      )}

      {!isLoading && isError && (
        <ErrorState
          className="mt-6"
          title="We couldn't load the courses."
          description="Check your connection and try again."
          onRetry={() => void refetch()}
        />
      )}

      {!isLoading && !isError && courses?.length === 0 && (
        <EmptyState
          className="mt-6"
          icon={GraduationCap}
          title="No courses yet"
          description="The first course is on its way — check back soon."
        />
      )}

      {/* Divided-columns grid: broadsheet treatment, not rounded cards.
       *
       * `[FIXED 2026-08-22]` Two defects, both visible with a short catalogue:
       *
       * 1. The container painted `bg-border` and relied on `[&>*]:bg-card` to cover it,
       *    so every UNFILLED track in the last row stayed border-coloured — two courses
       *    in a four-column grid rendered a large beige slab beside them. The divider
       *    is now drawn with `gap-px` over a `bg-border` that only shows THROUGH the
       *    gaps, so unfilled tracks show the page, not the rule.
       * 2. It rendered unconditionally, so the empty grid frame appeared during loading
       *    and underneath the error and empty states. */}
      {!isLoading && !isError && !!courses?.length && (
      <div className="mt-6 grid gap-px overflow-hidden rounded-md border border-border bg-card sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 [&>*]:bg-card [&>*]:outline [&>*]:outline-1 [&>*]:-outline-offset-[0.5px] [&>*]:outline-border">
        {courses?.map((course) => {
          const tone = domainColorVar(course.section)
          return (
            /* The `nth-child` border juggling that used to live here is gone: it
               existed to suppress the bottom rule on the last row at each breakpoint,
               which `gap-px` now handles for every row and column at once. */
            /* `h-full` + flex column all the way down: a two-line title next to a
               one-line title used to push its own price row lower than its neighbour's,
               so the footers formed a ragged edge across the row. The footer is now
               pinned to the bottom of every card with `mt-auto`, independent of how
               long the title and subtitle run. */
            <Link key={course.slug} to={`/courses/${course.slug}`} className="group block h-full">
              <div className="relative flex h-full flex-col bg-card transition-colors duration-150 hover:bg-card-2">
                {/* Domain top rule: 2px, full-bleed. Same treatment as the Home QuestionCard. */}
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 top-0 h-0.5 transition-[height] duration-150 group-hover:h-[3px]"
                  style={{ backgroundColor: tone }}
                />
                <CourseArt
                  slug={course.slug}
                  domain={course.section}
                  src={course.cover_image_url}
                  alt={`Cover image for ${course.title}`}
                  className="aspect-[16/9]"
                />
                <div className="flex flex-1 flex-col px-4 pt-3 pb-4">
                  <p className="eyebrow" style={{ '--eyebrow-rule-color': tone } as CSSProperties}>
                    {course.section}
                  </p>
                  {/* `[ADDED 2026-08-22, owner direction]` "the card title and description must
                      never affect the metadata and pricing + view/see-what's-included row".
                      `mt-auto` already pins the metadata+CTA pair to the card's bottom, but cards in
                      a CSS grid row stretch to the tallest, so one two-line title changed the height
                      of every card beside it. Both title and description are clamped to two lines and
                      the block reserves that height whether or not the text fills it — so the text
                      region is identical on every card, the cards sit a little taller (as asked), and
                      the bottom rows line up across the whole grid. */}
                  <div className="min-h-[5.25rem]">
                    <h3 className="mt-1.5 text-sm font-semibold text-foreground decoration-1 underline-offset-4 group-hover:underline line-clamp-2">
                      {course.title}
                    </h3>
                    {course.subtitle && (
                      <p className="mt-1 line-clamp-2 font-serif text-xs leading-relaxed text-muted-foreground">
                        {course.subtitle}
                      </p>
                    )}
                  </div>
                  {/* `[FIXED 2026-08-22]` The metadata row sat directly under the
                      description with the `mt-auto` on the footer below it, so on a
                      card with a short title the metadata floated in the middle of the
                      card while the price row sat at the bottom — the two halves of the
                      same summary, separated by a variable gap. Owner direction: the
                      metadata belongs immediately above the price/CTA row on every
                      card. Moving `mt-auto` up to the metadata makes those two a single
                      bottom-anchored block, so they line up across a row of cards
                      whatever the title and description lengths are. */}
                  <Meta
                    className="mt-auto pt-2"
                    tone={tone}
                    items={[
                      { icon: Layers, value: String(course.module_count), label: course.module_count === 1 ? 'module' : 'modules' },
                      { icon: PlayCircle, value: String(course.lesson_count), label: course.lesson_count === 1 ? 'lesson' : 'lessons' },
                      ...(course.level ? [{ icon: GraduationCap, value: course.level }] : []),
                      ...(course.estimated_duration_minutes ? [{ icon: Clock, value: formatDuration(course.estimated_duration_minutes) }] : []),
                    ]}
                  />
                  <div className="flex items-center justify-between border-t border-border pt-2.5">
                    {course.owned ? (
                      <Badge variant="success" className="gap-1 text-[0.625rem]">
                        <CircleCheck className="size-2.5" aria-hidden="true" /> Owned
                      </Badge>
                    ) : course.product ? (
                      <span className="font-mono text-xs tabular-nums text-foreground">
                        {formatCurrency(course.product.price_amount, course.product.currency)}
                      </span>
                    ) : (
                      /* `[ADDED 2026-08-22]` This was a bare `<span />`: a card for a
                         course with no published product showed a blank where every
                         other card shows a price, which reads as a rendering fault
                         rather than a fact about the course. Saying it plainly costs
                         one line and is the same answer the detail page now gives. */
                      <span className="text-xs text-muted-foreground">Not on sale yet</span>
                    )}
                    <span className="text-xs font-medium text-accent">
                      {course.owned ? 'Open' : 'View course'}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
      )}
    </div>
  )
}
