import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { CircleCheck, GraduationCap, Layers, PlayCircle } from 'lucide-react'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { PageTitle } from '@/components/ui/PageTitle'
import { EmptyState } from '@/components/ui/EmptyState'

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
}

// The course catalogue (DESIGN.md §41's /courses route) — the piece that was
// entirely missing before this pass: a course existed in the database but nothing
// in the app could reach it. §23.1's card shape (eyebrow, title, outcome line,
// module/lesson count, access state) drives this grid.
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
      />

      {/* week3_plan.md Phase 6 step 7 / DESIGN.md §42's "headings in order, no skipped
          levels" — the card grid's titles are h3 (Card.tsx's CardTitle, §10's "cards
          inside need h3, that is the whole hierarchy"), so the section between the h1
          and those h3s needs an h2 to not skip a level. Visually nothing changes; this
          is purely the missing rung for screen-reader heading navigation. */}
      <h2 className="sr-only">Course list</h2>

      {isLoading && (
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-52 animate-pulse rounded-xl border border-border bg-muted/40" />
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

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        {courses?.map((course) => (
          <Link key={course.slug} to={`/courses/${course.slug}`} className="group">
            <Card className="flex h-full flex-col transition-[transform,box-shadow] duration-150 group-hover:-translate-y-0.5 group-hover:shadow-md">
              {course.cover_image_url && (
                <img
                  src={course.cover_image_url}
                  alt={`Cover image for ${course.title}`}
                  className="w-full rounded-t-xl object-cover sm:h-36"
                />
              )}
              <CardHeader>
                <p className="eyebrow">{course.section}</p>
                <CardTitle className="mt-1.5">{course.title}</CardTitle>
                {course.subtitle && (
                  <CardDescription className="mt-1 font-serif text-read text-muted-foreground">
                    {course.subtitle}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="mt-auto flex items-center justify-between gap-3">
                <p className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Layers className="size-3.5" aria-hidden="true" />
                    {course.module_count} {course.module_count === 1 ? 'module' : 'modules'}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <PlayCircle className="size-3.5" aria-hidden="true" />
                    {course.lesson_count} {course.lesson_count === 1 ? 'lesson' : 'lessons'}
                  </span>
                </p>
                {course.owned && (
                  <Badge variant="success" className="shrink-0 gap-1">
                    <CircleCheck className="size-3" aria-hidden="true" />
                    In your library
                  </Badge>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
