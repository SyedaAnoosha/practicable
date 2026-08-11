import { Link, useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { CircleCheck, Download, FileText, GraduationCap, HelpCircle, Lock, PlayCircle } from 'lucide-react'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { PageTitle } from '@/components/ui/PageTitle'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { EmptyState } from '@/components/ui/EmptyState'

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
  owned: boolean
  lesson_count: number
  first_lesson_slug: string | null
  modules: ModuleOut[]
  related_products: RelatedProduct[]
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

// DESIGN.md §23.3's course product page — the public syllabus a stranger reads before
// buying. Every lesson is listed with a type icon and a lock state whether or not
// they own the course; the one free-preview lesson is genuinely playable from here,
// logged in or not (§23.3: "not optional").
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
      <div className="mx-auto w-full max-w-2xl px-5 py-16 sm:px-8">
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

  // Nothing in the course is free (video and lessons are never free — only a
  // question's written guidance is), so the header action only ever offers a way
  // into content once it's actually owned. Not-owned visitors get the price/buy card
  // below instead of a button that would just land on a locked lesson.
  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-12 sm:px-8">
      <PageTitle
        eyebrow={course.section}
        title={course.title}
        description={course.subtitle ?? undefined}
        action={
          course.owned && startHref ? (
            <Link to={startHref}>
              <Button size="lg">Continue the course</Button>
            </Link>
          ) : undefined
        }
      />

      <p className="mt-6 max-w-2xl font-serif text-lead text-muted-foreground">{course.description}</p>
      <p className="mt-4 text-sm text-muted-foreground">
        By {course.author_name} · {course.modules.length} {course.modules.length === 1 ? 'module' : 'modules'} ·{' '}
        {course.lesson_count} {course.lesson_count === 1 ? 'lesson' : 'lessons'} · lifetime access
      </p>

      {/* §23.3's "Price · [Buy the course]" surface, resolved to whichever real
          product actually grants this course — never a hardcoded price. Hidden
          entirely once owned, per §23.2's "never show a price on something the user
          already owns." Same gold left-rule family as the question page's buy card
          and the dashboard product card: the price is the conversion moment, so it
          earns the accent. */}
      {!course.owned && primaryProduct && (
        <Card
          className="mt-8 border-l-4 shadow-sm transition-[box-shadow] duration-150 hover:shadow-md"
          style={{ borderLeftColor: 'var(--accent)' }}
        >
          <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent ring-1 ring-inset ring-accent/25">
                <GraduationCap className="size-4" aria-hidden="true" />
              </span>
              <div>
                {/* Gold like every other buy card — large marketing price, 24px,
                    large-text-safe (theme.css). Do not shrink it. */}
                <p className="text-2xl font-semibold tabular-nums text-accent">
                  {formatCurrency(primaryProduct.price_amount, primaryProduct.currency)}
                </p>
                <p className="text-xs text-muted-foreground">One-time purchase · lifetime access</p>
              </div>
            </div>
            <Link to={`/buy/${primaryProduct.slug}`}>
              <Button>See what's included</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <section className="mt-10">
        <SectionHeading>Full syllabus</SectionHeading>
        <div className="mt-4 flex flex-col gap-6">
          {course.modules.map((module) => (
            <div key={module.id}>
              <p className="eyebrow">{module.title}</p>
              {module.description && <p className="mt-1 text-sm text-muted-foreground">{module.description}</p>}
              <ul className="mt-3 flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                {module.lessons.map((lesson) => {
                  const Icon = LESSON_ICON[lesson.lesson_type]
                  const duration = formatDuration(lesson.duration_seconds)
                  const row = (
                    <div className="flex items-center gap-3 px-4 py-3.5">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        {lesson.completed ? (
                          <CircleCheck className="size-4 text-success" aria-hidden="true" />
                        ) : lesson.locked ? (
                          <Lock className="size-4" aria-hidden="true" />
                        ) : (
                          <Icon className="size-4" aria-hidden="true" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">{lesson.title}</span>
                        <span className="text-xs capitalize text-muted-foreground">
                          {lesson.lesson_type}
                          {duration ? ` · ${duration}` : ''}
                        </span>
                      </span>
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
                        <div className="opacity-60">{row}</div>
                      )}
                    </li>
                  )
                })}

                {/* Questions attached to this module (ModuleQuestion) — always free
                    and public, so these rows never carry a lock state. */}
                {module.questions.map((question) => (
                  <li key={question.id}>
                    <Link
                      to={`/questions/${question.slug}`}
                      className="flex items-center gap-3 px-4 py-3.5 transition-colors duration-150 hover:bg-muted/60"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        <HelpCircle className="size-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">{question.title}</span>
                        <span className="text-xs text-muted-foreground">Related question · free to read</span>
                      </span>
                      <Badge variant="outline" className="shrink-0">
                        Free
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
