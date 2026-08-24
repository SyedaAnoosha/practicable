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
import { StarRating } from '@/components/ui/StarRating'

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
  /** W5-R4 Stage B: null below the display threshold, so the card shows nothing. */
  rating?: number | null
  review_count?: number
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

/** Three letters, title case — "beginner" → "Beg", "intermediate" → "Int".
 *
 *  Only for the catalogue card's four-fact row, where the full word is what pushed
 *  `duration` onto a second line. Every other surface (filter chips, course detail,
 *  the API itself) keeps the whole word, and the whole word is still what a screen
 *  reader announces here — see the `label` passed alongside this value. */
function abbreviateLevel(level: string): string {
  const trimmed = level.trim()
  if (!trimmed) return '—'
  return trimmed.slice(0, 3).charAt(0).toUpperCase() + trimmed.slice(1, 3).toLowerCase()
}

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
            /* `[FIXED 2026-08-23]` WCAG 2.4.7 — focus was invisible on every card.
               The grid draws its cell dividers as `[&>*]:outline-1 outline-border` on
               these very links, and a utility class on the element beats the global
               `:focus-visible { outline: 2px }` rule in theme.css. Focused and unfocused
               cards therefore computed to identical styles — measured directly,
               `outline: solid 1px rgb(230,223,208)` and `box-shadow: none` in BOTH
               states — so a keyboard user could not tell which card they were on.

               Restated at `focus-visible` so it wins by specificity, and kept in the
               outline slot at a larger width and the ring colour: the divider and the
               focus ring both want that slot, and focus is the one that must win while
               it is held. `z-10` lifts the focused card so its ring is not clipped by
               the neighbouring cell's own outline. */
            <Link
              key={course.slug}
              to={`/courses/${course.slug}`}
              className="group block h-full focus-visible:relative focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
            >
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
                  {/* `[FIXED 2026-08-23]` Four facts on one line that never wraps, and
                      all four always rendered.

                      Two separate things made this row ragged. The layout was a
                      wrapping flex line, so `level` — a word of unpredictable width
                      between two short figures — pushed `duration` onto a second line
                      at a different point on each card (see Meta's `singleLine` note).
                      And level/duration were conditional, so a course missing either
                      dropped the cell entirely and shifted every fact to its right,
                      which meant no two cards agreed on where a given figure sat.

                      Both are fixed now: the row is a single non-wrapping line, and an
                      absent level or duration renders an em-dash rather than
                      collapsing. A gap is stated where it would have been filled,
                      which is honest and keeps the four facts in the same order on
                      every card.

                      `level` is abbreviated to three letters here rather than at the
                      source. The full word is what the filter chips and the course
                      detail page say, and it is what the API returns; this row is the
                      one place where four facts share ~250px, and "Int" in a card that
                      also says "10 lessons · 3h" is unambiguous in context. The
                      unabbreviated word stays in the accessible name via `label`, so
                      nothing is lost to a screen reader. */}
                  <Meta
                    className="mt-auto pt-2"
                    tone={tone}
                    singleLine
                    items={[
                      { icon: Layers, value: String(course.module_count), label: course.module_count === 1 ? 'module' : 'modules' },
                      { icon: PlayCircle, value: String(course.lesson_count), label: course.lesson_count === 1 ? 'lesson' : 'lessons' },
                      { icon: GraduationCap, value: course.level ? abbreviateLevel(course.level) : '—', numeric: false, label: course.level ? `level: ${course.level}` : 'level not set' },
                      { icon: Clock, value: formatDuration(course.estimated_duration_minutes) || '—', label: course.estimated_duration_minutes ? 'duration' : 'duration not set' },
                    ]}
                  />
                  {/* Above the price row, not inside it: the bottom row is a
                      two-item flex (state left, CTA right) and a third child would
                      push the CTA off its edge. Renders nothing below the threshold. */}
                  <StarRating
                    rating={course.rating}
                    reviewCount={course.review_count}
                    className="pt-2"
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
