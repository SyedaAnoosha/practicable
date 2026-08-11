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
    <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8">
      <PageTitle
        eyebrow="Learn"
        title="Courses"
        description="Structured, multi-lesson courses — video, reading and downloadable templates, in one guided path."
      />

      {isLoading && (
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-52 animate-pulse rounded-xl border border-border bg-muted/40" />
          ))}
        </div>
      )}

      {!isLoading && courses?.length === 0 && (
        <EmptyState
          className="mt-10"
          icon={GraduationCap}
          title="No courses yet"
          description="The first course is on its way — check back soon."
        />
      )}

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        {courses?.map((course) => (
          <Link key={course.slug} to={`/courses/${course.slug}`} className="group">
            <Card className="flex h-full flex-col transition-[transform,box-shadow] duration-150 group-hover:-translate-y-0.5 group-hover:shadow-md">
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
