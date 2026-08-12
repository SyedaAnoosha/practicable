import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, BookOpen, CheckCircle2, Download, FileText, GraduationCap, Tags } from 'lucide-react'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageTitle } from '@/components/ui/PageTitle'
import { SectionHeading } from '@/components/ui/SectionHeading'

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
  description: string
  file_name: string
}

interface LibraryReference {
  kind: 'reference'
  slug: string
  title: string
  domain: string
}

interface LibraryData {
  courses: LibraryCourse[]
  templates: LibraryTemplate[]
  reference: LibraryReference[]
  is_empty: boolean
}

/** The "continue where you left off" rail (product spec §2 step 6: it sits at the TOP,
 * above the full library). Only courses can be partway through — a template has no
 * progress, and reference content has no fixed order by design (spec §4.1) — so this
 * is deliberately courses-only rather than a mixed feed that would have to invent a
 * notion of progress for two content types that don't have one. */
function ContinueRail({ courses }: { courses: LibraryCourse[] }) {
  const inProgress = courses.filter((c) => c.resume_lesson_slug && c.completed_lessons > 0)
  if (inProgress.length === 0) return null

  return (
    <section className="mt-10">
      <SectionHeading>Continue where you left off</SectionHeading>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {inProgress.map((course) => (
          <div
            key={course.slug}
            className="rounded-xl border border-border bg-card p-5 shadow-sm transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-md"
          >
            <p className="eyebrow">{course.title}</p>
            <p className="mt-2 font-sans font-semibold text-foreground">{course.resume_lesson_title}</p>
            <ProgressBar course={course} />
            <Link to={`/learn/${course.slug}/${course.resume_lesson_slug}`} className="mt-4 inline-block">
              <Button size="sm">
                Continue <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            </Link>
          </div>
        ))}
      </div>
    </section>
  )
}

function ProgressBar({ course }: { course: LibraryCourse }) {
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {course.completed_lessons} of {course.total_lessons} lessons
        </span>
        <span className="tabular-nums">{course.percentage_complete}%</span>
      </div>
      {/* role="progressbar" rather than a bare div: the percentage is meaning-bearing,
          and the visual bar alone carries it for nobody using a screen reader. */}
      <div
        className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-secondary"
        role="progressbar"
        aria-valuenow={course.percentage_complete}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${course.title} progress`}
      >
        <div
          className="h-full rounded-full bg-gradient-brand transition-[width] duration-300"
          style={{ width: `${course.percentage_complete}%` }}
        />
      </div>
    </div>
  )
}

/**
 * My Library — product spec §9's "purchased items across all types, clearly labeled,
 * with progress and resume where relevant", and §2 steps 6 and 9.
 *
 * The organising idea from the spec is that this page holds things of DIFFERENT
 * shapes and must not flatten them into one: a course has progress and a resume
 * point, a template has neither and just needs to download, reference content is a
 * lookup tool with no order at all. So each type keeps its own row treatment and its
 * own verb ("Continue" / "Download" / "Read"), rather than every purchase being
 * rendered as a card with a generic "Open" button.
 */
export function Library() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.me.library(),
    queryFn: () => api.get<LibraryData>('/me/library').then((res) => res.data),
  })

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-label="Loading your library">
        <div className="size-8 animate-spin rounded-full border-2 border-border border-t-primary" />
        <span className="sr-only">Loading your library…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-2xl px-5 py-16 sm:px-8">
        <EmptyState
          title="We couldn't load your library."
          description="Check your connection and try again."
          action={<Button onClick={() => refetch()}>Try again</Button>}
        />
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-8">
      <PageTitle
        eyebrow="Your library"
        title="Everything you've bought"
        description="Courses, templates and reference guidance — all in one place, yours to come back to."
      />

      {data.is_empty ? (
        // Distinguished from the error state above on purpose: nothing is broken here,
        // there is simply nothing bought yet, so this offers the way forward rather
        // than a retry button that would do nothing.
        <div className="mt-12">
          <EmptyState
            title="Your library is empty."
            description="Anything you buy — a course, a template, a reference pack — appears here permanently, with your progress saved."
            action={
              <Link to="/templates">
                <Button>
                  Browse templates <ArrowRight className="size-4" aria-hidden="true" />
                </Button>
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <ContinueRail courses={data.courses} />

          {data.courses.length > 0 && (
            <section className="mt-12 border-t border-border pt-8">
              <SectionHeading>Courses</SectionHeading>
              <ul className="mt-4 flex flex-col divide-y divide-border">
                {data.courses.map((course) => {
                  const finished = course.resume_lesson_slug === null
                  return (
                    <li key={course.slug} className="flex flex-col gap-4 py-5 first:pt-0 sm:flex-row sm:items-center">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                        <GraduationCap className="size-5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-sans font-semibold text-foreground">{course.title}</p>
                          <Badge variant="success">Course</Badge>
                          {finished && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                              <CheckCircle2 className="size-3.5" aria-hidden="true" /> Completed
                            </span>
                          )}
                        </div>
                        {course.subtitle && (
                          <p className="mt-0.5 text-sm text-muted-foreground">{course.subtitle}</p>
                        )}
                        <div className="max-w-md">
                          <ProgressBar course={course} />
                        </div>
                      </div>
                      <div className="shrink-0">
                        <Link
                          to={
                            course.resume_lesson_slug
                              ? `/learn/${course.slug}/${course.resume_lesson_slug}`
                              : `/courses/${course.slug}`
                          }
                        >
                          <Button variant={finished ? 'outline' : 'primary'} size="sm">
                            {finished ? 'Review' : course.completed_lessons > 0 ? 'Continue' : 'Start'}
                          </Button>
                        </Link>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {data.templates.length > 0 && (
            <section className="mt-12 border-t border-border pt-8">
              <SectionHeading>Templates</SectionHeading>
              {/* No progress bar, no resume, no lesson wrapper — spec §2 step 8's
                  "different content type, different, simpler experience". The only
                  verb a template needs is download. */}
              <ul className="mt-4 flex flex-col divide-y divide-border">
                {data.templates.map((t) => (
                  <li key={t.id} className="flex flex-col gap-4 py-5 first:pt-0 sm:flex-row sm:items-center">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-gold-soft text-gold-strong ring-1 ring-inset ring-gold/40">
                      <FileText className="size-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-sans font-semibold text-foreground">{t.title}</p>
                        <Badge>Template</Badge>
                      </div>
                      <p className="mt-0.5 truncate text-sm text-muted-foreground">{t.file_name}</p>
                    </div>
                    <div className="shrink-0">
                      <Link to={`/templates/${t.id}`}>
                        <Button variant="outline" size="sm">
                          <Download className="size-4" aria-hidden="true" /> Download
                        </Button>
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {data.reference.length > 0 && (
            <section className="mt-12 border-t border-border pt-8">
              <SectionHeading>Reference</SectionHeading>
              {/* Worth being straight about: question guidance is free for everyone
                  (DESIGN.md §21.3), so this section is a record of what a purchase
                  included rather than an access list. The copy says so instead of
                  implying these are unlocked by the purchase. */}
              <p className="mt-2 text-sm text-muted-foreground">
                Included with your purchases. These are free to read for everyone — they're listed here so
                you can see exactly what each purchase covered.
              </p>
              <ul className="mt-4 flex flex-col divide-y divide-border">
                {data.reference.map((q) => (
                  <li key={q.slug} className="flex items-center gap-4 py-4 first:pt-0">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                      <Tags className="size-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-sans font-medium text-foreground">{q.title}</p>
                      <p className="text-xs text-muted-foreground">{q.domain}</p>
                    </div>
                    <Link
                      to={`/questions/${q.slug}`}
                      className="shrink-0 text-sm font-medium text-primary hover:underline"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <BookOpen className="size-4" aria-hidden="true" /> Read
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}
