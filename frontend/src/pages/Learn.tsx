import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react'
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
import { RichText } from '@/components/content/RichText'
import { Badge } from '@/components/ui/Badge'
import { EmailGateForm } from '@/components/content/EmailGateForm'
import { NotesPanel } from '@/components/ui/NotesPanel'
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

// One ordered piece of the lesson's content. `body`/`download`/`has_video` below stay
// populated too, for backfilled single-block lessons, but a new mixed lesson exists
// only here, as a sequence. The backend has already applied entitlement/free-template
// filtering to this list — whatever appears here is what this viewer is allowed to see.
// Exported (Phase 8, 8E test-coverage pass, 2026-08-21): LessonBlockData and
// LessonBlocks were file-local, which is why the prose_sanitized/plain-text branch
// choice below had no direct test — a full Learn.tsx render test would need routing,
// React Query and auth-store mocking just to reach code that itself needs none of
// that. Exporting the type and the pure render component lets LessonBlocks.test.tsx
// test the actual branch in isolation instead.
export interface LessonBlockData {
  id: string
  block_type: 'text' | 'video' | 'file' | 'callout'
  sort_order: number
  heading: string | null
  text_body: string | null
  prose_sanitized: string | null  // Phase 8 (8E): sanitized HTML, null for plain text
  video_ready: boolean | null
  file_name: string | null
  file_size_bytes: number | null
  file_is_free: boolean | null
}

interface LessonDetail {
  id: string
  slug: string
  title: string
  description: string | null
  lesson_type: LessonType
  body: string | null
  prose_sanitized: string | null  // Phase 8 (8E): sanitized HTML, null for plain-text lessons
  download: { file_name: string; file_size_bytes: number; is_free: boolean } | null
  blocks: LessonBlockData[]
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
  ref?: React.Ref<HTMLMediaElement>
  onError?: (e: Event) => void
}

const LESSON_ICON: Record<LessonType, typeof PlayCircle> = {
  video: PlayCircle,
  reading: FileText,
  download: Download,
  mixed: PlayCircle,
}

// `tokenUrl` is either the lesson-scoped endpoint (legacy single-video lessons) or a
// block-scoped one (`/lesson-blocks/{id}/playback-token`, for a mixed lesson with more
// than one video) — the entitlement check happened server-side before this ever runs;
// this component only knows which URL mints ITS token.
function VideoBlock({ tokenUrl, queryKey }: { tokenUrl: string; queryKey: readonly unknown[] }) {
  const [MuxPlayer, setMuxPlayer] = useState<ComponentType<MuxPlayerProps> | null>(null)
  const playerRef = useRef<HTMLMediaElement>(null)
  const [tokenExpired, setTokenExpired] = useState(false)

  const { data: playbackToken, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: () => api.get<PlaybackToken>(tokenUrl).then((res) => res.data),
  })

  // Dynamically imported — a large dependency most sessions never need, never at the
  // app root.
  useEffect(() => {
    import('@mux/mux-player-react').then((mod) => {
      setMuxPlayer(() => mod.default as ComponentType<MuxPlayerProps>)
    })
  }, [])

  // C4: Token-expiry handler — when the mux playback token expires mid-playback,
  // the player fires an error. We detect this, preserve the current position, refetch
  // a fresh token, and resume. Losing someone's place in a paid 40-minute lesson is
  // a refund-generator (Redesigning_decisions.md §C4).
  const handleTokenError = useCallback(() => {
    const position = playerRef.current?.currentTime ?? 0
    setTokenExpired(true)
    // Refetch the token; once the new token arrives, MuxPlayer re-renders with
    // the updated tokens prop and we restore the position.
    refetch().then(() => {
      setTokenExpired(false)
      // Restore position after the player re-mounts with the fresh token.
      requestAnimationFrame(() => {
        if (playerRef.current) {
          playerRef.current.currentTime = position
          playerRef.current.play().catch(() => {
            // Autoplay may be blocked — user can click play manually.
          })
        }
      })
    })
  }, [refetch])

  if (error) {
    return <p className="text-sm text-muted-foreground">The video couldn't be loaded — try refreshing.</p>
  }

  if (isLoading || !playbackToken || !MuxPlayer) {
    return <div className="aspect-video animate-pulse rounded-xl bg-muted" />
  }

  return (
    <div className="relative aspect-video overflow-hidden rounded-xl bg-black shadow-sm">
      <MuxPlayer
        ref={playerRef}
        playbackId={playbackToken.playback_id}
        tokens={{ playback: playbackToken.token }}
        autoPlay={false}
        defaultHiddenCaptions={false} // captions ON by default — DESIGN.md §25.2 [DECIDED]
        className="h-full w-full"
        onError={tokenExpired ? undefined : handleTokenError}
      />
      {/* C4: The token-expiry overlay — a normal case, not an edge case.
          Shows when the token expires and the refetch is in progress. */}
      {tokenExpired && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-center">
          <p className="text-sm font-medium text-white">Your session timed out.</p>
          <p className="mt-1 text-xs text-white/70">Refreshing your access…</p>
        </div>
      )}
    </div>
  )
}

// `downloadUrl` is either the lesson-scoped endpoint or a block-scoped one
// (`/lesson-blocks/{id}/download-url`, for a mixed lesson with more than one file).
function DownloadBlock({ downloadUrl, fileName }: { downloadUrl: string; fileName: string }) {
  const [status, setStatus] = useState<'idle' | 'preparing' | 'downloaded' | 'error'>('idle')

  const handleDownload = async () => {
    setStatus('preparing')
    try {
      const { data } = await api.get<{ download_url: string; file_name: string }>(downloadUrl)
      // Fetch the presigned URL on click, use it immediately, discard it — never
      // render it as a visible href.
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

/** The free lead-magnet artefact shown inside a course the visitor hasn't bought. Same
 * soft gate as /templates and the free question, satisfied outright by being signed
 * in. Once cleared it hands off to the ordinary DownloadBlock. */
function FreeDownloadBlock({ downloadUrl, fileName }: { downloadUrl: string; fileName: string }) {
  const gate = useEmailGate('course_lesson_free_template')

  if (gate.unlocked) {
    return (
      <div className="flex flex-col gap-2">
        <Badge variant="success" className="self-start">
          Free
        </Badge>
        <DownloadBlock downloadUrl={downloadUrl} fileName={fileName} />
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

/** Renders `lesson.blocks` in order — the backend has already decided what belongs in
 * this list for the current viewer, so this component never re-checks entitlement
 * itself, only chooses how each block type renders.
 */
export function LessonBlocks({ blocks }: { blocks: LessonBlockData[] }) {
  return (
    <>
      {blocks.map((block) => {
        switch (block.block_type) {
          case 'text':
            return (
              <div key={block.id} className="flex flex-col gap-2">
                {block.heading && <h2 className="text-h4 font-semibold text-foreground">{block.heading}</h2>}
                {block.prose_sanitized ? (
                  <RichText html={block.prose_sanitized} />
                ) : block.text_body ? (
                  <p className="whitespace-pre-line font-serif text-read text-pretty text-foreground">
                    {block.text_body}
                  </p>
                ) : null}
              </div>
            )
          case 'callout':
            // An aside, not the main reading flow — earns a border and tint.
            return (
              <div
                key={block.id}
                className="flex flex-col gap-2 rounded-xl border-l-4 bg-accent/5 px-5 py-4"
                style={{ borderLeftColor: 'var(--accent)' }}
              >
                {block.heading && <p className="text-sm font-semibold text-foreground">{block.heading}</p>}
                {block.prose_sanitized ? (
                  <RichText html={block.prose_sanitized} />
                ) : block.text_body ? (
                  <p className="whitespace-pre-line font-serif text-read text-pretty text-foreground">
                    {block.text_body}
                  </p>
                ) : null}
              </div>
            )
          case 'video':
            return (
              <VideoBlock
                key={block.id}
                tokenUrl={`/lesson-blocks/${block.id}/playback-token`}
                queryKey={queryKeys.lessonBlocks.playbackToken(block.id)}
              />
            )
          case 'file':
            return block.file_is_free ? (
              <FreeDownloadBlock
                key={block.id}
                downloadUrl={`/lesson-blocks/${block.id}/download-url`}
                fileName={block.file_name ?? 'Download'}
              />
            ) : (
              <DownloadBlock
                key={block.id}
                downloadUrl={`/lesson-blocks/${block.id}/download-url`}
                fileName={block.file_name ?? 'Download'}
              />
            )
          default:
            return null
        }
      })}
    </>
  )
}

/** The completion moment (Redesigning_decisions.md C3): Mark complete → ✓ Completed,
 * the outline item ticks, the progress bar animates its width, and focus moves to
 * Next lesson. This is the psychological payoff that replaces certificates — it
 * needs to FEEL like something landed.
 *
 * The Undo affordance (C3 spec) requires a backend un-complete endpoint that does
 * not exist yet. Rather than a no-op button that silently ignores the click, this
 * shows a brief "Marking…" state during the mutation, then transitions cleanly to
 * the completed state. When the un-complete endpoint lands, the Undo button can be
 * wired in.
 *
 * Under reduced motion the transition is instant rather than animated (§39.4). */
function CompletionBar({
  lesson,
  onComplete,
  isPending,
  nextLesson,
  courseSlug,
}: {
  lesson: LessonDetail
  onComplete: () => void
  isPending: boolean
  nextLesson: LessonNav | null
  courseSlug: string
}) {
  const nextRef = useRef<HTMLAnchorElement>(null)

  const handleComplete = useCallback(() => {
    onComplete()
    // Focus moves to Next lesson — the psychological payoff (C3).
    setTimeout(() => nextRef.current?.focus(), 100)
  }, [onComplete])

  if (lesson.completed) {
    return (
      <div className="flex flex-col gap-4 border-t border-border pt-6">
        <div className="flex items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
            <CircleCheck className="size-4" aria-hidden="true" />
          </span>
          <p className="text-sm font-medium text-foreground">Completed</p>
        </div>
        {nextLesson && (
          <Link ref={nextRef} to={`/learn/${courseSlug}/${nextLesson.slug}`}>
            <Button>Next lesson →</Button>
          </Link>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 border-t border-border pt-6">
      <Button
        onClick={handleComplete}
        loading={isPending}
        className="self-start"
      >
        {isPending ? 'Marking…' : 'Mark complete'}
      </Button>
      {nextLesson && (
        <Link ref={nextRef} to={`/learn/${courseSlug}/${nextLesson.slug}`}>
          <Button variant="outline">Next lesson →</Button>
        </Link>
      )}
    </div>
  )
}

function OutlineList({ lesson, onNavigate }: { lesson: LessonDetail; onNavigate?: () => void }) {
  /* `[ADDED 2026-08-22, Redesing_decisions.md C2 — P1]` Scroll the current lesson into
   * view on load. The outline is independently scrollable and a long course pushes the
   * current lesson below the fold, so someone resuming lesson 22 of 30 opens the page
   * with the outline showing lesson 1 and no indication of where they are.
   *
   * `block: 'nearest'` deliberately: it scrolls only when the row is actually out of
   * view, so arriving at an early lesson does not yank a correctly-positioned outline.
   * `behavior: 'auto'` — this is a page-load correction, not a transition, and animating
   * it would both fight reduced-motion and draw the eye to movement that means nothing. */
  const currentRef = useRef<HTMLLIElement>(null)
  const currentId = lesson.modules.flatMap((m) => m.lessons).find((l) => l.is_current)?.id
  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'nearest' })
  }, [currentId])

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
                <Lock className="size-3.5 text-muted-foreground" aria-hidden="true" />
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
                        /* `[FIXED 2026-08-22, F4 — P0]` Was `text-muted-foreground/50`.
                         * Halving the alpha on a locked row puts it around 2.3:1 on the
                         * rail — below the 4.5:1 floor — and F4 is explicit that locked
                         * is "not broken and not an error": the title must stay legible,
                         * because reading what you don't have yet IS the persuasion.
                         * The lock icon already carries the state. */
                        : 'text-muted-foreground',
                  )}
                >
                  <span className="flex size-4 shrink-0 items-center justify-center">{stateIcon}</span>
                  <span className="truncate">{l.title}</span>
                </span>
              )
              return (
                <li key={l.id} ref={l.is_current ? currentRef : undefined}>
                  {reachable ? (
                    /* `aria-current="page"` — the highlight at `is_current` is a
                     * background tint and a weight change, neither of which reaches a
                     * screen reader. Without this the outline announces thirty
                     * identical links and "where am I" has no answer. */
                    <Link
                      to={`/learn/${lesson.course_slug}/${l.slug}`}
                      onClick={onNavigate}
                      aria-current={l.is_current ? 'page' : undefined}
                    >
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

// The member learning interface. A sticky, independently scrollable outline beside the
// active lesson's content — video, reading and downloadable-artefact lesson types all
// render from the same page, since which pieces exist is a property of the lesson's
// data, not a hard switch on lesson_type alone.
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
      <div className="mx-auto w-full max-w-2xl px-5 py-11 sm:px-8">
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
      <div className="mx-auto w-full max-w-2xl flex-1 px-5 pb-24 pt-10 sm:px-8 lg:pb-10">
        {lessonPosition && (
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Lesson {lessonPosition} of {totalLessons}
          </p>
        )}
        <h1 className="mt-1 text-h2 font-semibold text-foreground">{lesson.title}</h1>
        {lesson.description && <p className="mt-2 font-serif text-read text-pretty text-muted-foreground">{lesson.description}</p>}

        {!lesson.entitled ? (
          <div className="mt-8 flex flex-col gap-8">
            {/* The free template is free here too — the same file can't be free on
                /templates and locked here. The lesson's writing stays locked; only the
                download is exempt, and still asks for an email first. `blocks` is
                already filtered server-side to free-only content, so no extra check
                is needed here. */}
            {lesson.blocks.length > 0 ? (
              <LessonBlocks blocks={lesson.blocks} />
            ) : (
              lesson.download?.is_free && (
                <FreeDownloadBlock downloadUrl={`/lessons/${lesson.id}/download-url`} fileName={lesson.download.file_name} />
              )
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
            {/* `blocks` covers every current lesson — the has_video/body/download trio
                below is a fallback for the zero-block edge case only, never rendered
                alongside `blocks`, which would show the same content twice. */}
            {lesson.blocks.length > 0 ? (
              <LessonBlocks blocks={lesson.blocks} />
            ) : (
              <>
                {lesson.has_video && (
                  <VideoBlock
                    tokenUrl={`/lessons/${lesson.id}/playback-token`}
                    queryKey={queryKeys.lessons.playbackToken(lesson.id)}
                  />
                )}
                {lesson.prose_sanitized ? (
                  <RichText html={lesson.prose_sanitized} />
                ) : lesson.body ? (
                  <p className="whitespace-pre-line font-serif text-read text-pretty text-foreground">{lesson.body}</p>
                ) : null}
                {lesson.download && (
                  <DownloadBlock downloadUrl={`/lessons/${lesson.id}/download-url`} fileName={lesson.download.file_name} />
                )}
              </>
            )}

            <CompletionBar
                lesson={lesson}
                onComplete={() => completeMutation.mutate()}
                isPending={completeMutation.isPending}
                nextLesson={lesson.next}
                courseSlug={lesson.course_slug}
              />

            {/* W5-R5: personal notes for this lesson, autosaving. Only shown to
                entitled learners — notes are per-purchase. */}
            <NotesPanel lessonId={lesson.id} />
          </div>
        )}
      </div>

      {lesson.entitled && (
        <div
          className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur-sm lg:hidden"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <div className="flex items-center justify-between gap-3 px-5 py-3">
            {lesson.previous ? (
              <Link to={`/learn/${lesson.course_slug}/${lesson.previous.slug}`} className="min-w-0">
                <Button variant="ghost" size="sm" className="gap-1">
                  ← Prev
                </Button>
              </Link>
            ) : (<span />)}
            <Button
              onClick={() => completeMutation.mutate()}
              disabled={lesson.completed}
              loading={completeMutation.isPending}
              size="sm"
              className={lesson.completed ? 'bg-success/10 text-success' : ''}
            >
              {lesson.completed ? '✓ Done' : 'Mark complete'}
            </Button>
            {lesson.next ? (
              <Link to={`/learn/${lesson.course_slug}/${lesson.next.slug}`} className="min-w-0">
                <Button variant="ghost" size="sm" className="gap-1">
                  Next →
                </Button>
              </Link>
            ) : (<span />)}
          </div>
        </div>
      )}
    </div>
  )
}

