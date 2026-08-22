/**
 * LessonWriteScreen — full-screen lesson/block prose editor (week4_plan.md Phase 8,
 * "8E-continued", `[OWNER INSTRUCTION 2026-08-21]`).
 *
 * Replaces the centred `max-w-2xl` modal AdminCourses.tsx used to render for both the
 * lesson-body "Write" button and the block text/callout "Write" button — cramped for
 * sustained writing, and not addressable by its own URL (no Back button semantics, no
 * refresh-safety, no direct link). This is a real route instead: its own screen, its
 * own Back control, Save and Cancel both return to the course editor.
 *
 * Deliberately reuses `admin.course(courseId)` — the same query AdminCourses.tsx's
 * CourseBuilder already populates — rather than fetching a lesson/block individually.
 * There is no single-lesson or single-block admin GET endpoint; the course detail
 * response is the only place either one lives, and it's already cached from the course
 * list flow the admin came from, so this loads instantly rather than showing a second
 * spinner for data already in memory.
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { plainTextToEditorHtml } from '@/lib/utils/plainTextToEditorHtml'
import { Button } from '@/components/ui/Button'
import { AutosaveIndicator } from '@/components/admin/AutosaveIndicator'
import { RichTextEditor } from '@/components/admin/RichTextEditor'
import { useAutosave } from '@/lib/useAutosave'
import {
  readError,
  type AdminLesson,
  type AdminLessonBlock,
  type CourseDetail,
} from '@/pages/admin/AdminCourses'

function findLesson(course: CourseDetail | undefined, lessonId: string | undefined): AdminLesson | null {
  if (!course || !lessonId) return null
  for (const module of course.modules) {
    const lesson = module.lessons.find((l) => l.id === lessonId)
    if (lesson) return lesson
  }
  return null
}

function findBlock(
  course: CourseDetail | undefined,
  blockId: string | undefined,
): { lesson: AdminLesson; block: AdminLessonBlock } | null {
  if (!course || !blockId) return null
  for (const module of course.modules) {
    for (const lesson of module.lessons) {
      const block = lesson.blocks.find((b) => b.id === blockId)
      if (block) return { lesson, block }
    }
  }
  return null
}

/** Shared shell: back button, title, autosave indicator, editor, save/cancel row.
 * Both lesson-body and block-text modes render through this so the two screens stay
 * visually identical — the only real difference between them is which mutation fires
 * and what the heading says.
 */
function WriteShell({
  courseId,
  heading,
  subheading,
  autosaveStatus,
  autosaveSavedAt,
  content,
  onChange,
  onSave,
  saving,
  error,
  extraField,
}: {
  courseId: string
  heading: string
  subheading?: string
  autosaveStatus: ReturnType<typeof useAutosave>['status']
  autosaveSavedAt: Date | null
  content: string
  onChange: (text: string) => void
  onSave: () => void
  saving: boolean
  error?: string | null
  extraField?: React.ReactNode
}) {
  const navigate = useNavigate()
  const goBack = () => navigate(`/admin/courses?open=${courseId}`)

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Sticky header — Back on the left (returns to the course editor, per the
          instruction: "leading to course editing page", not the bare courses list),
          Save/Cancel and the autosave status on the right. Sticky so both stay reachable
          without scrolling back up through a long lesson. */}
      <div className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={goBack}
              aria-label="Back to course editor"
            >
              <ArrowLeft className="size-4" aria-hidden="true" /> Back
            </Button>
            <div>
              <h1 className="font-sans text-lg font-semibold text-foreground">{heading}</h1>
              {subheading && <p className="text-xs text-muted-foreground">{subheading}</p>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <AutosaveIndicator status={autosaveStatus} savedAt={autosaveSavedAt} />
            <Button type="button" variant="outline" onClick={goBack}>
              Cancel
            </Button>
            <Button type="button" loading={saving} onClick={onSave}>
              Save
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-4xl flex-1 px-5 py-6 sm:px-8">
        {error && (
          <p role="alert" className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        {extraField}
        <RichTextEditor content={content} onChange={onChange} className="min-h-[70vh]" />
      </div>
    </div>
  )
}

/** Mode: editing a reading lesson's own body. */
function LessonWriteMode({ courseId, lessonId }: { courseId: string; lessonId: string }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const { data: course, isLoading } = useQuery({
    queryKey: queryKeys.admin.course(courseId),
    queryFn: () => api.get<CourseDetail>(`/admin/courses/${courseId}`).then((r) => r.data),
  })

  const lesson = findLesson(course, lessonId)

  // Seeded once from the loaded lesson, same precedence AdminCourses.tsx's own
  // draft-openers use: prefer prose_sanitized (already HTML, round-trips exactly),
  // only fall back to plainTextToEditorHtml() for genuine legacy plain text.
  const initialText = useMemo(
    () => lesson?.prose_sanitized ?? plainTextToEditorHtml(lesson?.body ?? ''),
    [lesson?.id], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const [text, setText] = useState(initialText)
  useEffect(() => setText(initialText), [initialText])

  const [error, setError] = useState<string | null>(null)
  const saveBody = useMutation({
    mutationFn: () =>
      api.put<CourseDetail>(`/admin/lessons/${lessonId}`, {
        title: lesson?.title,
        lesson_type: lesson?.lesson_type,
        description: lesson?.description ?? null,
        body: text,
        download_template_id: lesson?.download_template_id ?? null,
      }),
    onSuccess: (r) => {
      queryClient.setQueryData(queryKeys.admin.course(courseId), r.data)
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.courses() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.courses.list() })
      setError(null)
    },
    onError: (e: unknown) => setError(readError(e)),
  })

  const autosave = useAutosave({
    value: text,
    onSave: () => saveBody.mutateAsync(),
    enabled: lesson !== null,
  })

  if (isLoading || !course) {
    return <p className="p-8 text-sm text-muted-foreground">Loading…</p>
  }
  if (!lesson) {
    return (
      <div className="p-8">
        <p className="text-sm text-destructive">This lesson no longer exists in this course.</p>
        <Button className="mt-4" variant="outline" onClick={() => navigate(`/admin/courses?open=${courseId}`)}>
          Back to course
        </Button>
      </div>
    )
  }

  return (
    <WriteShell
      courseId={courseId}
      heading={lesson.title}
      subheading="Lesson body"
      autosaveStatus={autosave.status}
      autosaveSavedAt={autosave.savedAt}
      content={text}
      onChange={setText}
      saving={saveBody.isPending}
      error={error}
      onSave={() => {
        saveBody.mutate(undefined, { onSuccess: () => navigate(`/admin/courses?open=${courseId}`) })
      }}
    />
  )
}

/** Mode: editing one text/callout block inside a `mixed` lesson. */
function BlockWriteMode({ courseId, blockId }: { courseId: string; blockId: string }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const { data: course, isLoading } = useQuery({
    queryKey: queryKeys.admin.course(courseId),
    queryFn: () => api.get<CourseDetail>(`/admin/courses/${courseId}`).then((r) => r.data),
  })

  const found = findBlock(course, blockId)

  const initialText = useMemo(
    () => found?.block.prose_sanitized ?? plainTextToEditorHtml(found?.block.text_body ?? ''),
    [found?.block.id], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const [text, setText] = useState(initialText)
  const [heading, setHeading] = useState(found?.block.heading ?? '')
  useEffect(() => {
    setText(initialText)
    setHeading(found?.block.heading ?? '')
  }, [initialText, found?.block.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const [error, setError] = useState<string | null>(null)
  const saveBlockText = useMutation({
    mutationFn: () =>
      api.put<CourseDetail>(`/admin/lesson-blocks/${blockId}`, {
        block_type: found?.block.block_type,
        heading: heading || null,
        text_body: text,
      }),
    onSuccess: (r) => {
      queryClient.setQueryData(queryKeys.admin.course(courseId), r.data)
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.courses() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.courses.list() })
      setError(null)
    },
    onError: (e: unknown) => setError(readError(e)),
  })

  const autosave = useAutosave({
    value: `${heading} ${text}`,
    onSave: () => saveBlockText.mutateAsync(),
    enabled: found !== null,
  })

  if (isLoading || !course) {
    return <p className="p-8 text-sm text-muted-foreground">Loading…</p>
  }
  if (!found) {
    return (
      <div className="p-8">
        <p className="text-sm text-destructive">This block no longer exists in this course.</p>
        <Button className="mt-4" variant="outline" onClick={() => navigate(`/admin/courses?open=${courseId}`)}>
          Back to course
        </Button>
      </div>
    )
  }

  return (
    <WriteShell
      courseId={courseId}
      heading={found.lesson.title}
      subheading={found.block.block_type === 'callout' ? 'Callout block' : 'Text block'}
      autosaveStatus={autosave.status}
      autosaveSavedAt={autosave.savedAt}
      content={text}
      onChange={setText}
      saving={saveBlockText.isPending}
      error={error}
      onSave={() => {
        saveBlockText.mutate(undefined, { onSuccess: () => navigate(`/admin/courses?open=${courseId}`) })
      }}
      extraField={
        <label className="mb-4 block">
          <span className="text-sm font-medium text-foreground">Heading (optional)</span>
          <input
            className="mt-1.5 w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            value={heading}
            onChange={(e) => setHeading(e.target.value)}
          />
        </label>
      }
    />
  )
}

export function LessonBodyWriteScreen() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>()
  if (!courseId || !lessonId) return null
  return <LessonWriteMode courseId={courseId} lessonId={lessonId} />
}

export function BlockTextWriteScreen() {
  const { courseId, blockId } = useParams<{ courseId: string; blockId: string }>()
  if (!courseId || !blockId) return null
  return <BlockWriteMode courseId={courseId} blockId={blockId} />
}
