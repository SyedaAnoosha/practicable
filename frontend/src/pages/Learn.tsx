import { useEffect, useMemo, useState, type ComponentType } from 'react'
import { Link, useParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import {
  ArrowLeft,
  CircleCheck,
  Download,
  FileText,
  HelpCircle,
  Lock,
  Menu,
  PlayCircle,
  X,
} from 'lucide-react'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'
import { EmailGateForm } from '@/components/content/EmailGateForm'
import { useEmailGate } from '@/lib/emailGate'

type LessonType = 'video' | 'reading' | 'download' | 'mixed'

interface SidebarLesson {
  id: string
  slug: string
  title: string
  lesson_type: LessonType
  sort_order: number
  locked: boolean
  completed: boolean
  is_current: boolean
}

interface SidebarQuestion {
  id: string
  slug: string
  title: string
  sort_order: number
}

interface SidebarModule {
  id: string
  title: string
  sort_order: number
  lessons: SidebarLesson[]
  questions: SidebarQuestion[]
}

interface LessonNav {
  slug: string
  title: string
}

interface LessonDetail {
  id: string
  slug: string
  title: string
  description: string | null
  lesson_type: LessonType
  body: string | null
  download: { file_name: string; file_size_bytes: number; is_free: boolean } | null
  has_video: boolean
  entitled: boolean
  completed: boolean
  course_slug: string
  course_title: string
  progress_percent: number
  modules: SidebarModule[]
  previous: LessonNav | null
  next: LessonNav | null
}

interface PlaybackToken {
  playback_id: string
  token: string
}

type MuxPlayerProps = {
  playbackId: string
  tokens: { playback: string }
  autoPlay?: boolean
  defaultHiddenCaptions?: boolean
  className?: string
}

const LESSON_ICON: Record<LessonType, typeof PlayCircle> = {
  video: PlayCircle,
  reading: FileText,
  download: Download,
  mixed: PlayCircle,
}

function VideoBlock({ lessonId }: { lessonId: string }) {
  const [MuxPlayer, setMuxPlayer] = useState<ComponentType<MuxPlayerProps> | null>(null)

  const { data: playbackToken, isLoading, error } = useQuery({
    queryKey: queryKeys.lessons.playbackToken(lessonId),
    queryFn: () => api.get<PlaybackToken>(`/lessons/${lessonId}/playback-token`).then((res) => res.data),
  })

  // Dynamically imported — a large dependency most sessions never need
  // (DESIGN.md §43.1), never at the app root.
  useEffect(() => {
    import('@mux/mux-player-react').then((mod) => {
      setMuxPlayer(() => mod.default as ComponentType<MuxPlayerProps>)
    })
  }, [])

  if (error) {
    return <p className="text-sm text-muted-foreground">The video couldn't be loaded — try refreshing.</p>
  }

  if (isLoading || !playbackToken || !MuxPlayer) {
    return <div className="aspect-video animate-pulse rounded-xl bg-muted" />
  }

  return (
    <div className="aspect-video overflow-hidden rounded-xl bg-black shadow-sm">
      <MuxPlayer
        playbackId={playbackToken.playback_id}
        tokens={{ playback: playbackToken.token }}
        autoPlay={false}
        defaultHiddenCaptions={false} // captions ON by default — DESIGN.md §25.2 [DECIDED]
        className="h-full w-full"
      />
    </div>
  )
}

function DownloadBlock({ lessonId, fileName }: { lessonId: string; fileName: string }) {
  const [status, setStatus] = useState<'idle' | 'preparing' | 'downloaded' | 'error'>('idle')

  const handleDownload = async () => {
    setStatus('preparing')
    try {
      const { data } = await api.get<{ download_url: string; file_name: string }>(
        `/lessons/${lessonId}/download-url`,
      )
      // DESIGN.md §26.4/§26.5: fetch the presigned URL on click, use it immediately,
      // discard it — never render it as a visible href.
      const fileResponse = await fetch(data.download_url)
      if (!fileResponse.ok) throw new Error('Download failed')
      const blob = await fileResponse.blob()
      const objectUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = data.file_name
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(objectUrl)
      document.body.removeChild(a)
      setStatus('downloaded')
      setTimeout(() => setStatus('idle'), 4000)
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card px-5 py-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Download className="size-4" aria-hidden="true" />
        </span>
        <p className="text-sm font-medium text-foreground">{fileName}</p>
      </div>
      <Button onClick={handleDownload} loading={status === 'preparing'} variant="outline" size="sm">
        {status === 'downloaded' ? 'Downloaded ✓' : status === 'error' ? 'Try again' : 'Download'}
      </Button>
    </div>
  )
}

/** The free lead-magnet artefact shown inside a course the visitor has not bought.
 *
 * Same soft gate as /templates and the free question: one email, once, shared across
 * every entry point — and satisfied outright by being signed in. Once cleared it hands
 * off to the ordinary DownloadBlock, so there is exactly one download implementation.
 */
function FreeDownloadBlock({ lessonId, fileName }: { lessonId: string; fileName: string }) {
  const gate = useEmailGate('course_lesson_free_template')

  if (gate.unlocked) {
    return (
      <div className="flex flex-col gap-2">
        <Badge variant="success" className="self-start">
          Free
        </Badge>
        <DownloadBlock lessonId={lessonId} fileName={fileName} />
      </div>
    )
  }

  return (
    <EmailGateForm
      heading="This template is free"
      description="Enter your email and it downloads straight away — you don't need to buy the course for this one."
      submitLabel="Get the template"
      email={gate.email}
      onEmailChange={gate.setEmail}
      onSubmit={gate.submit}
      isPending={gate.isPending}
      isError={gate.isError}
    />
  )
}

function OutlineList({ lesson, onNavigate }: { lesson: LessonDetail; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-6 px-4 py-5" aria-label="Course outline">
      {lesson.modules.map((module) => (
        <div key={module.id}>
          <p className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{module.title}</p>
          <ul className="mt-2 flex flex-col gap-0.5">
            {module.lessons.map((l) => {
              const Icon = LESSON_ICON[l.lesson_type]
              const reachable = !l.locked
              const stateIcon = l.completed ? (
                <CircleCheck className="size-4 text-success" aria-hidden="true" />
              ) : l.locked ? (
                <Lock className="size-3.5 text-muted-foreground/60" aria-hidden="true" />
              ) : (
                <Icon className={cn('size-4', l.is_current ? 'text-primary' : 'text-muted-foreground')} aria-hidden="true" />
              )
              const row = (
                <span
                  className={cn(
                    'flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors duration-150',
                    l.is_current
                      ? 'bg-primary/10 font-medium text-foreground'
                      : reachable
                        ? 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        : 'text-muted-foreground/50',
                  )}
                >
                  <span className="flex size-4 shrink-0 items-center justify-center">{stateIcon}</span>
                  <span className="truncate">{l.title}</span>
                </span>
              )
              return (
                <li key={l.id}>
                  {reachable ? (
                    <Link to={`/learn/${lesson.course_slug}/${l.slug}`} onClick={onNavigate}>
                      {row}
                    </Link>
                  ) : (
                    row
                  )}
                </li>
              )
            })}
            {/* Questions attached to this module (ModuleQuestion) — always free, so
                they link straight out to /questions/:slug rather than into /learn. */}
            {module.questions.map((q) => (
              <li key={q.id}>
                <Link
                  to={`/questions/${q.slug}`}
                  className="flex items-center gap-2.5 rounded-md px-2 py-2 text-sm text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
                >
                  <span className="flex size-4 shrink-0 items-center justify-center">
                    <HelpCircle className="size-4" aria-hidden="true" />
                  </span>
                  <span className="truncate">{q.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

// DESIGN.md §24.1: the member learning interface. A sticky, independently scrollable
// outline beside the active lesson's content — video, reading and downloadable-
// artefact lesson types all render from the same page, since which pieces exist is a
// property of the lesson's data (has_video/body/download), not of a hard switch on
// lesson_type alone (a "mixed" lesson can legitimately carry more than one).
export function Learn() {
  const { courseSlug, lessonSlug } = useParams<{ courseSlug: string; lessonSlug: string }>()
  const queryClient = useQueryClient()
  const [outlineOpen, setOutlineOpen] = useState(false)

  const { data: lesson, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.lessons.inCourse(courseSlug ?? '', lessonSlug ?? ''),
    queryFn: () =>
      api.get<LessonDetail>(`/courses/${courseSlug}/lessons/${lessonSlug}`).then((res) => res.data),
    enabled: !!courseSlug && !!lessonSlug,
  })

  const completeMutation = useMutation({
    mutationFn: () => api.post(`/lessons/${lesson?.id}/complete`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.lessons.inCourse(courseSlug ?? '', lessonSlug ?? '') })
      void queryClient.invalidateQueries({ queryKey: queryKeys.courses.detail(courseSlug ?? '') })
    },
  })

  const totalLessons = useMemo(() => lesson?.modules.flatMap((m) => m.lessons).length ?? 0, [lesson])
  const lessonPosition = useMemo(() => {
    if (!lesson) return null
    const flat = lesson.modules.flatMap((m) => m.lessons)
    const idx = flat.findIndex((l) => l.slug === lesson.slug)
    return idx === -1 ? null : idx + 1
  }, [lesson])

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-label="Loading lesson">
        <div className="size-8 animate-spin rounded-full border-2 border-border border-t-primary" />
        <span className="sr-only">Loading lesson…</span>
      </div>
    )
  }

  if (error) {
    const notFound = isAxiosError(error) && error.response?.status === 404
    return (
      <div className="mx-auto w-full max-w-2xl px-5 py-16 sm:px-8">
        <EmptyState
          title={notFound ? "We couldn't find this lesson." : "We couldn't load this lesson."}
          description={notFound ? 'It may have moved or been unpublished.' : 'Check your connection and try again.'}
          action={!notFound ? <Button onClick={() => refetch()}>Try again</Button> : undefined}
        />
      </div>
    )
  }

  if (!lesson) return null

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Sticky top bar: back to the course, plus progress (DESIGN.md §24.1's
          "← Course  45% · 6 of 14"). */}
      <div className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-background/90 px-5 py-3 backdrop-blur-sm lg:hidden">
        <button
          type="button"
          onClick={() => setOutlineOpen(true)}
          className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          aria-label="Open course outline"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>
        <p className="min-w-0 flex-1 truncate text-center text-sm font-medium text-foreground">{lesson.course_title}</p>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{lesson.progress_percent}%</span>
      </div>

      {/* Desktop outline: sticky, independently scrollable (§24.1). */}
      <aside className="hidden w-72 shrink-0 border-r border-border lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <div className="border-b border-border px-4 py-4">
          <Link
            to={`/courses/${lesson.course_slug}`}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            {lesson.course_title}
          </Link>
          <div className="mt-3 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${lesson.progress_percent}%` }} />
            </div>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {lesson.progress_percent}% · {lessonPosition ?? '–'} of {totalLessons}
            </span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <OutlineList lesson={lesson} />
        </div>
      </aside>

      {/* Mobile outline sheet. */}
      {outlineOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOutlineOpen(false)} aria-hidden="true" />
          <aside className="absolute inset-y-0 left-0 flex w-80 flex-col overflow-y-auto bg-background shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-4">
              <p className="text-sm font-semibold text-foreground">{lesson.course_title}</p>
              <button
                type="button"
                onClick={() => setOutlineOpen(false)}
                className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                aria-label="Close outline"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <OutlineList lesson={lesson} onNavigate={() => setOutlineOpen(false)} />
          </aside>
        </div>
      )}

      {/* Lesson content. */}
      <div className="mx-auto w-full max-w-2xl flex-1 px-5 py-10 sm:px-8">
        {lessonPosition && (
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Lesson {lessonPosition} of {totalLessons}
          </p>
        )}
        <h1 className="mt-1 text-h2 font-semibold text-foreground">{lesson.title}</h1>
        {lesson.description && <p className="mt-2 font-serif text-read text-pretty text-muted-foreground">{lesson.description}</p>}

        {!lesson.entitled ? (
          <div className="mt-8 flex flex-col gap-8">
            {/* The free template is free here too. This lesson's artefact IS the
                standalone lead magnet, so paywalling it inside the course would mean
                the same file was free on /templates and locked here — an inconsistency
                a buyer spots immediately. The lesson's writing stays locked; only the
                download is exempt, and it still asks for an email first. */}
            {lesson.download?.is_free && (
              <FreeDownloadBlock
                lessonId={lesson.id}
                fileName={lesson.download.file_name}
              />
            )}
            <EmptyState
              title="This lesson is part of a course you don't have yet."
              description="Buy the course to unlock every module — video and lessons are only available to buyers."
              action={
                <Link to={`/courses/${lesson.course_slug}`}>
                  <Button>See what's included</Button>
                </Link>
              }
            />
          </div>
        ) : (
          <div className="mt-8 flex flex-col gap-8">
            {lesson.has_video && <VideoBlock lessonId={lesson.id} />}
            {lesson.body && (
              /* text-read carries the §10 serif rhythm (1.7 line-height); the old
                 leading-relaxed override silently flattened it — same fix as
                 EmailGatedBody. text-pretty for even paragraph shaping. */
              <p className="whitespace-pre-line font-serif text-read text-pretty text-foreground">{lesson.body}</p>
            )}
            {lesson.download && <DownloadBlock lessonId={lesson.id} fileName={lesson.download.file_name} />}

            <div className="flex flex-col gap-4 border-t border-border pt-6">
              <Button
                onClick={() => completeMutation.mutate()}
                disabled={lesson.completed}
                loading={completeMutation.isPending}
                variant={lesson.completed ? 'outline' : 'primary'}
                className="self-start"
              >
                {lesson.completed && <CircleCheck className="size-4" aria-hidden="true" />}
                {lesson.completed ? 'Completed' : 'Mark complete'}
              </Button>

              <div className="flex items-center justify-between gap-3">
                {lesson.previous ? (
                  <Link to={`/learn/${lesson.course_slug}/${lesson.previous.slug}`}>
                    <Button variant="ghost" size="sm">
                      ← {lesson.previous.title}
                    </Button>
                  </Link>
                ) : (
                  <span />
                )}
                {lesson.next ? (
                  <Link to={`/learn/${lesson.course_slug}/${lesson.next.slug}`}>
                    <Button variant="outline" size="sm">
                      {lesson.next.title} →
                    </Button>
                  </Link>
                ) : (
                  <span />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
