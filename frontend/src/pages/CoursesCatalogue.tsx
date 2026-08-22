import type { CSSProperties } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { CircleCheck, GraduationCap, Layers, PlayCircle } from 'lucide-react'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import { domainColorVar } from '@/lib/domainVisuals'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { PageTitle } from '@/components/ui/PageTitle'
import { EmptyState } from '@/components/ui/EmptyState'
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
  // Present on the list response for the store; used here so a catalogue card can show
  // a price the way every comparable platform's card does.
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
export function CoursesCatalogue() {
  const { data: courses, isLoading } = useQuery({
    queryKey: queryKeys.courses.list(),
    queryFn: () => api.get<CourseSummary[]>('/courses').then((res) => res.data),
  })

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

      {/* week3_plan.md Phase 6 step 7 / DESIGN.md §42's "headings in order, no skipped
          levels" — the card grid's titles are h3 (§10's "cards inside need h3, that is
          the whole hierarchy"), so the section between the h1 and those h3s needs an h2
          to not skip a level. Visually nothing changes; this is purely the missing rung
          for screen-reader heading navigation. */}
      <h2 className="sr-only">Course list</h2>

      {isLoading && (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-72 animate-pulse rounded-xl border border-border bg-muted/40" />
          ))}
        </div>
      )}

      {!isLoading && courses?.length === 0 && (
        <EmptyState
          className="mt-6"
          icon={GraduationCap}
          title="No courses yet"
          description="The first course is on its way — check back soon."
        />
      )}

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {courses?.map((course) => {
          const tone = domainColorVar(course.section)
          return (
            <Link key={course.slug} to={`/courses/${course.slug}`} className="group">
              {/* The domain colour as a left rule — the same treatment question cards
                  already use, extended to the content type that had none. This is M3
                  ("domain identity") applied where the audit found it stopped. */}
              <Card
                className="hover-lift hover-lift-domain flex h-full flex-col overflow-hidden border-l-4"
                style={
                  {
                    borderLeftColor: tone,
                    '--card-domain-color': tone,
                  } as CSSProperties
                }
              >
                <CourseArt
                  slug={course.slug}
                  domain={course.section}
                  src={course.cover_image_url}
                  alt={`Cover image for ${course.title}`}
                  className="aspect-[16/9]"
                />

                <div className="flex flex-1 flex-col p-5">
                  <p className="eyebrow" style={{ '--eyebrow-rule-color': tone } as CSSProperties}>
                    {course.section}
                  </p>
                  <h3 className="mt-2 text-h4 font-semibold text-foreground">{course.title}</h3>
                  {course.subtitle && (
                    <p className="mt-1.5 line-clamp-2 font-serif text-sm text-muted-foreground">
                      {course.subtitle}
                    </p>
                  )}

                  <Meta
                    className="mt-3"
                    tone={tone}
                    items={[
                      {
                        icon: Layers,
                        value: String(course.module_count),
                        label: course.module_count === 1 ? 'module' : 'modules',
                      },
                      {
                        icon: PlayCircle,
                        value: String(course.lesson_count),
                        label: course.lesson_count === 1 ? 'lesson' : 'lessons',
                      },
                    ]}
                  />

                  {/* Access state and price, pinned to the card's foot so every card in
                      the row aligns regardless of title length. Never a price on
                      something already owned (§23.2). */}
                  <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                    {course.owned ? (
                      <Badge variant="success" className="gap-1">
                        <CircleCheck className="size-3" aria-hidden="true" />
                        In your library
                      </Badge>
                    ) : course.product ? (
                      <p className="font-mono text-sm font-semibold tabular-nums text-foreground">
                        {formatCurrency(course.product.price_amount, course.product.currency)}
                      </p>
                    ) : (
                      <span />
                    )}
                    <span className="shrink-0 text-sm font-medium text-accent group-hover:underline">
                      {course.owned ? 'Open' : 'View course'}
                    </span>
                  </div>
                </div>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
