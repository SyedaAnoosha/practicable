import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  Loader2,
  MessageSquareQuote,
  Plus,
  Trash2,
  Type,
  Video,
  X,
} from 'lucide-react'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { PageTitle } from '@/components/ui/PageTitle'
import { AutosaveIndicator } from '@/components/admin/AutosaveIndicator'
import { useAutosave } from '@/lib/useAutosave'

interface CourseRow {
  id: string
  slug: string
  title: string
  subtitle?: string | null
  published: boolean
  module_count: number
  lesson_count: number
}

interface AdminLessonBlock {
  id: string
  block_type: 'text' | 'video' | 'file' | 'callout'
  sort_order: number
  heading?: string | null
  text_body?: string | null
  media_id?: string | null
  mux_playback_id?: string | null
  template_id?: string | null
  template_file_name?: string | null
}

interface AdminLesson {
  id: string
  slug: string
  title: string
  description?: string | null
  lesson_type: string
  body?: string | null
  sort_order: number
  published: boolean
  download_template_id?: string | null
  mux_playback_id?: string | null
  is_ready: boolean
  blocks: AdminLessonBlock[]
}

interface TemplateOption {
  id: string
  title: string
  file_name: string
}

const BLOCK_ICON: Record<AdminLessonBlock['block_type'], typeof Type> = {
  text: Type,
  callout: MessageSquareQuote,
  video: Video,
  file: Download,
}

interface AdminModule {
  id: string
  title: string
  description?: string | null
  sort_order: number
  lessons: AdminLesson[]
}

interface CourseDetail {
  id: string
  slug: string
  title: string
  subtitle?: string | null
  description: string
  published: boolean
  modules: AdminModule[]
}

const LESSON_TYPES = [
  { value: 'video', label: 'Video' },
  { value: 'reading', label: 'Reading' },
  { value: 'download', label: 'Download' },
  { value: 'mixed', label: 'Mixed (video + reading)' },
]

const inputClass =
  'w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

const readError = (e: unknown): string => {
  const detail = (e as { response?: { data?: { detail?: { error?: { message?: string } } } } })?.response?.data
    ?.detail
  return detail?.error?.message ?? 'Something went wrong. Please try again.'
}

/** The ordered content-block list for one `mixed` lesson — add, reorder (up/down
 * buttons, not drag-and-drop, per week2_plan.md Phase 2's explicit choice), edit,
 * delete. Every mutation here comes from the parent (`CourseBuilder`), which already
 * owns the course-wide query cache the response refreshes.
 */
function BlockEditor({
  lesson,
  templateOptions,
  onAddBlock,
  addBlockPending,
  onEditText,
  onEditVideo,
  onEditFile,
  onMove,
  onDelete,
  movePending,
  deletePending,
}: {
  lesson: AdminLesson
  templateOptions: TemplateOption[] | undefined
  onAddBlock: (blockType: AdminLessonBlock['block_type']) => void
  addBlockPending: boolean
  onEditText: (block: AdminLessonBlock) => void
  onEditVideo: (blockId: string) => void
  onEditFile: (blockId: string) => void
  onMove: (blockId: string, direction: 'up' | 'down') => void
  onDelete: (blockId: string) => void
  movePending?: string
  deletePending?: string
}) {
  const blocks = [...lesson.blocks].sort((a, b) => a.sort_order - b.sort_order)
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border bg-muted/30 p-3 sm:ml-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Content blocks</p>
      {blocks.length === 0 && <p className="text-xs text-muted-foreground">No blocks yet — add one below.</p>}
      <ul className="flex flex-col gap-1.5">
        {blocks.map((block, idx) => {
          const Icon = BLOCK_ICON[block.block_type]
          const attached =
            block.block_type === 'video'
              ? !!block.mux_playback_id
              : block.block_type === 'file'
                ? !!block.template_id
                : true
          return (
            <li
              key={block.id}
              className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card px-3 py-2"
            >
              <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-foreground">
                  {block.block_type === 'text' || block.block_type === 'callout'
                    ? block.heading || block.text_body?.slice(0, 60) || 'Empty — click Edit'
                    : block.block_type === 'video'
                      ? block.mux_playback_id
                        ? `Video attached (${block.mux_playback_id})`
                        : 'No video attached yet'
                      : block.template_file_name || 'No file attached yet'}
                </p>
              </div>
              {!attached && <AlertTriangle className="size-3.5 shrink-0 text-warning" aria-hidden="true" />}
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  aria-label="Move block up"
                  disabled={idx === 0 || movePending === block.id}
                  onClick={() => onMove(block.id, 'up')}
                  className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted disabled:opacity-30"
                >
                  <ChevronUp className="size-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label="Move block down"
                  disabled={idx === blocks.length - 1 || movePending === block.id}
                  onClick={() => onMove(block.id, 'down')}
                  className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted disabled:opacity-30"
                >
                  <ChevronDown className="size-4" aria-hidden="true" />
                </button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    block.block_type === 'video'
                      ? onEditVideo(block.id)
                      : block.block_type === 'file'
                        ? onEditFile(block.id)
                        : onEditText(block)
                  }
                >
                  Edit
                </Button>
                <button
                  type="button"
                  aria-label="Delete block"
                  disabled={deletePending === block.id}
                  onClick={() => onDelete(block.id)}
                  className="flex size-7 items-center justify-center rounded-md text-destructive hover:bg-destructive/10 disabled:opacity-30"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </div>
            </li>
          )
        })}
      </ul>
      <div className="mt-1 flex flex-wrap gap-2">
        <Button size="sm" variant="ghost" loading={addBlockPending} onClick={() => onAddBlock('text')}>
          <Type className="size-3.5" aria-hidden="true" /> Text
        </Button>
        <Button size="sm" variant="ghost" loading={addBlockPending} onClick={() => onAddBlock('callout')}>
          <MessageSquareQuote className="size-3.5" aria-hidden="true" /> Callout
        </Button>
        <Button size="sm" variant="ghost" loading={addBlockPending} onClick={() => onAddBlock('video')}>
          <Video className="size-3.5" aria-hidden="true" /> Video
        </Button>
        <Button size="sm" variant="ghost" loading={addBlockPending} onClick={() => onAddBlock('file')}>
          <Download className="size-3.5" aria-hidden="true" /> File
        </Button>
      </div>
      {templateOptions !== undefined && templateOptions.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No templates exist yet to attach as a file block — add one on the Templates page first.
        </p>
      )}
    </div>
  )
}

/** Builds a course: modules, then lessons inside them, then video/body on each. */
function CourseBuilder({ courseId, onBack }: { courseId: string; onBack: () => void }) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [newModuleTitle, setNewModuleTitle] = useState('')
  const [lessonDraft, setLessonDraft] = useState<{ moduleId: string; title: string; type: string } | null>(null)
  const [videoDraft, setVideoDraft] = useState<{ lessonId: string; assetId: string; playbackId: string } | null>(
    null,
  )
  const [bodyDraft, setBodyDraft] = useState<{ lesson: AdminLesson; text: string } | null>(null)

  // Block-editor drafts — one lesson (mixed-content, week2_plan.md Phase 2) can hold
  // several of each, so these key off the block's own id rather than the lesson's.
  const [blockTextDraft, setBlockTextDraft] = useState<{ block: AdminLessonBlock; heading: string; text: string } | null>(
    null,
  )
  const [blockVideoDraft, setBlockVideoDraft] = useState<{ blockId: string; assetId: string; playbackId: string } | null>(
    null,
  )
  const [blockFileDraft, setBlockFileDraft] = useState<{ blockId: string; templateId: string } | null>(null)

  const { data: course, isLoading } = useQuery({
    queryKey: queryKeys.admin.course(courseId),
    queryFn: () => api.get<CourseDetail>(`/admin/courses/${courseId}`).then((r) => r.data),
  })

  // Only fetched lazily (a file-block draft is rare relative to loading the course
  // itself), and only the fields the picker dropdown needs.
  const { data: templateOptions } = useQuery({
    queryKey: queryKeys.admin.templates(),
    queryFn: () => api.get<TemplateOption[]>('/admin/templates').then((r) => r.data),
    enabled: blockFileDraft !== null,
  })

  // Every mutation below returns the whole refreshed course, so one setQueryData keeps
  // the builder in sync without a second round trip.
  const applyCourse = (data: CourseDetail) => {
    queryClient.setQueryData(queryKeys.admin.course(courseId), data)
    void queryClient.invalidateQueries({ queryKey: queryKeys.admin.courses() })
    void queryClient.invalidateQueries({ queryKey: queryKeys.courses.list() })
  }

  const mutate = <TVars,>(fn: (v: TVars) => Promise<{ data: CourseDetail }>) => ({
    mutationFn: fn,
    onSuccess: (r: { data: CourseDetail }) => {
      applyCourse(r.data)
      setError(null)
    },
    onError: (e: unknown) => setError(readError(e)),
  })

  const addModule = useMutation(
    mutate(() => api.post<CourseDetail>(`/admin/courses/${courseId}/modules`, { title: newModuleTitle })),
  )
  const addLesson = useMutation(
    mutate(() =>
      api.post<CourseDetail>(`/admin/modules/${lessonDraft?.moduleId}/lessons`, {
        title: lessonDraft?.title,
        lesson_type: lessonDraft?.type,
      }),
    ),
  )
  const setVideo = useMutation(
    mutate(() =>
      api.put<CourseDetail>(`/admin/lessons/${videoDraft?.lessonId}/video`, {
        mux_asset_id: videoDraft?.assetId,
        mux_playback_id: videoDraft?.playbackId,
      }),
    ),
  )
  const saveBody = useMutation(
    mutate(() =>
      api.put<CourseDetail>(`/admin/lessons/${bodyDraft?.lesson.id}`, {
        title: bodyDraft?.lesson.title,
        lesson_type: bodyDraft?.lesson.lesson_type,
        description: bodyDraft?.lesson.description ?? null,
        body: bodyDraft?.text,
        download_template_id: bodyDraft?.lesson.download_template_id ?? null,
      }),
    ),
  )
  const publishLesson = useMutation(
    mutate((v: { id: string; published: boolean }) =>
      api.post<CourseDetail>(`/admin/lessons/${v.id}/publish`, { published: v.published }),
    ),
  )
  const publishCourse = useMutation(
    mutate((v: { published: boolean }) =>
      api.post<CourseDetail>(`/admin/courses/${courseId}/publish`, { published: v.published }),
    ),
  )

  // ── Block editor mutations (week2_plan.md Phase 2) ─────────────────────────────
  const addBlock = useMutation(
    mutate((v: { lessonId: string; blockType: AdminLessonBlock['block_type'] }) =>
      api.post<CourseDetail>(`/admin/lessons/${v.lessonId}/blocks`, { block_type: v.blockType }),
    ),
  )
  const saveBlockText = useMutation(
    mutate(() =>
      api.put<CourseDetail>(`/admin/lesson-blocks/${blockTextDraft?.block.id}`, {
        block_type: blockTextDraft?.block.block_type,
        heading: blockTextDraft?.heading || null,
        text_body: blockTextDraft?.text,
      }),
    ),
  )

  // week2_plan.md Phase 6 / §20.8's autosave, on the two rich-text drafts — "losing
  // 40 minutes of typed guidance" is the exact failure mode this closes, and typed
  // prose is what these two modals hold (video/file attachment below stay on their
  // existing explicit-save flow: a single picked id has nothing to lose mid-typing).
  // Called unconditionally (rules of hooks) even while the modal is closed;
  // `enabled` gates whether the interval actually runs.
  const bodyAutosave = useAutosave({
    value: bodyDraft?.text ?? '',
    onSave: () => saveBody.mutateAsync(undefined as never),
    enabled: bodyDraft !== null,
  })
  const blockTextAutosave = useAutosave({
    // Both fields watched — a heading-only edit with no body change still counts as
    // dirty.
    value: blockTextDraft ? `${blockTextDraft.heading} ${blockTextDraft.text}` : '',
    onSave: () => saveBlockText.mutateAsync(undefined as never),
    enabled: blockTextDraft !== null,
  })
  const setBlockVideo = useMutation(
    mutate(() =>
      api.put<CourseDetail>(`/admin/lesson-blocks/${blockVideoDraft?.blockId}/video`, {
        mux_asset_id: blockVideoDraft?.assetId,
        mux_playback_id: blockVideoDraft?.playbackId,
      }),
    ),
  )
  const setBlockFile = useMutation(
    mutate(() =>
      api.put<CourseDetail>(`/admin/lesson-blocks/${blockFileDraft?.blockId}`, {
        block_type: 'file',
        template_id: blockFileDraft?.templateId,
      }),
    ),
  )
  const moveBlock = useMutation(
    mutate((v: { blockId: string; direction: 'up' | 'down' }) =>
      api.post<CourseDetail>(`/admin/lesson-blocks/${v.blockId}/move`, { direction: v.direction }),
    ),
  )
  const deleteBlock = useMutation(
    mutate((v: { blockId: string }) => api.delete<CourseDetail>(`/admin/lesson-blocks/${v.blockId}`)),
  )

  if (isLoading || !course) {
    return (
      <p className="mt-10 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading course…
      </p>
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> All courses
      </button>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <PageTitle eyebrow="Course" title={course.title} description={course.subtitle ?? undefined} />
        <Button
          variant={course.published ? 'ghost' : 'primary'}
          loading={publishCourse.isPending}
          onClick={() => publishCourse.mutate({ published: !course.published })}
        >
          {course.published ? 'Unpublish course' : 'Publish course'}
        </Button>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="mt-8 flex flex-col gap-6">
        {course.modules.map((module) => (
          <section key={module.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h3 className="font-sans font-semibold text-foreground">{module.title}</h3>

            <ul className="mt-4 flex flex-col divide-y divide-border border-t border-border">
              {module.lessons.map((lesson) => (
                <li key={lesson.id} className="flex flex-col gap-3 py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{lesson.title}</p>
                      <Badge variant="muted">{lesson.lesson_type}</Badge>
                      {lesson.published ? <Badge variant="success">Live</Badge> : null}
                    </div>
                    {!lesson.is_ready && (
                      // The check that stops a paid course containing an empty player.
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-warning">
                        <AlertTriangle className="size-3.5" aria-hidden="true" />
                        {lesson.lesson_type === 'reading'
                          ? 'Needs written content'
                          : lesson.lesson_type === 'download'
                            ? 'Needs a file attached'
                            : lesson.lesson_type === 'mixed'
                              ? 'Needs at least one block, fully attached'
                              : 'Needs a video attached'}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {/* Video/Write edit the lesson's single legacy field, so they only
                        make sense for the lesson types that still author that way — a
                        `mixed` lesson is authored entirely through the block editor
                        below instead (a lesson can have more than one video block,
                        which the single "Add video" button here has no way to target). */}
                    {lesson.lesson_type === 'video' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setVideoDraft({ lessonId: lesson.id, assetId: '', playbackId: '' })
                        }
                      >
                        <Video className="size-4" aria-hidden="true" />
                        {lesson.mux_playback_id ? 'Replace video' : 'Add video'}
                      </Button>
                    )}
                    {lesson.lesson_type === 'reading' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setBodyDraft({ lesson, text: lesson.body ?? '' })}
                      >
                        Write
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant={lesson.published ? 'ghost' : 'primary'}
                      loading={publishLesson.isPending && publishLesson.variables?.id === lesson.id}
                      onClick={() => publishLesson.mutate({ id: lesson.id, published: !lesson.published })}
                    >
                      {lesson.published ? <X className="size-4" /> : <Check className="size-4" />}
                    </Button>
                  </div>
                </div>

                {lesson.lesson_type === 'mixed' && (
                  <BlockEditor
                    lesson={lesson}
                    templateOptions={templateOptions}
                    onAddBlock={(blockType) => addBlock.mutate({ lessonId: lesson.id, blockType })}
                    addBlockPending={addBlock.isPending}
                    onEditText={(block) =>
                      setBlockTextDraft({ block, heading: block.heading ?? '', text: block.text_body ?? '' })
                    }
                    onEditVideo={(blockId) => setBlockVideoDraft({ blockId, assetId: '', playbackId: '' })}
                    onEditFile={(blockId) =>
                      setBlockFileDraft({
                        blockId,
                        templateId: lesson.blocks.find((b) => b.id === blockId)?.template_id ?? '',
                      })
                    }
                    onMove={(blockId, direction) => moveBlock.mutate({ blockId, direction })}
                    onDelete={(blockId) => deleteBlock.mutate({ blockId })}
                    movePending={moveBlock.isPending ? moveBlock.variables?.blockId : undefined}
                    deletePending={deleteBlock.isPending ? deleteBlock.variables?.blockId : undefined}
                  />
                )}
                </li>
              ))}
            </ul>

            {lessonDraft?.moduleId === module.id ? (
              <form
                className="mt-4 flex flex-wrap items-end gap-3 border-t border-border pt-4"
                onSubmit={(e: FormEvent) => {
                  e.preventDefault()
                  addLesson.mutate(undefined as never, { onSuccess: () => setLessonDraft(null) })
                }}
              >
                <label className="min-w-48 flex-1">
                  <span className="text-xs font-medium text-muted-foreground">Lesson title</span>
                  <Input
                    required
                    autoFocus
                    className="mt-1"
                    value={lessonDraft.title}
                    onChange={(e) => setLessonDraft({ ...lessonDraft, title: e.target.value })}
                  />
                </label>
                <label>
                  <span className="text-xs font-medium text-muted-foreground">Type</span>
                  <select
                    className={cn(inputClass, 'mt-1 w-auto')}
                    value={lessonDraft.type}
                    onChange={(e) => setLessonDraft({ ...lessonDraft, type: e.target.value })}
                  >
                    {LESSON_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
                <Button type="submit" size="sm" loading={addLesson.isPending}>
                  Add
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setLessonDraft(null)}>
                  Cancel
                </Button>
              </form>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="mt-4"
                onClick={() => setLessonDraft({ moduleId: module.id, title: '', type: 'video' })}
              >
                <Plus className="size-4" aria-hidden="true" /> Add lesson
              </Button>
            )}
          </section>
        ))}
      </div>

      <form
        className="mt-6 flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          addModule.mutate(undefined as never, { onSuccess: () => setNewModuleTitle('') })
        }}
      >
        <label className="min-w-56 flex-1">
          <span className="text-xs font-medium text-muted-foreground">New module title</span>
          <Input
            required
            className="mt-1"
            value={newModuleTitle}
            onChange={(e) => setNewModuleTitle(e.target.value)}
            placeholder="Module 3 — Reporting"
          />
        </label>
        <Button type="submit" variant="outline" loading={addModule.isPending}>
          <Plus className="size-4" aria-hidden="true" /> Add module
        </Button>
      </form>

      {/* Mux ids are pasted rather than uploaded here — see the backend's LessonVideoIn
          docstring for why proxying video through this API would be worse. */}
      {videoDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setVideoDraft(null)}
            aria-hidden="true"
          />
          <form
            className="relative w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl"
            onSubmit={(e) => {
              e.preventDefault()
              setVideo.mutate(undefined as never, { onSuccess: () => setVideoDraft(null) })
            }}
          >
            <h3 className="font-sans text-lg font-semibold">Attach a video</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload the file in Mux, then paste its two ids here.
            </p>
            <label className="mt-4 block">
              <span className="text-sm font-medium">Mux asset ID</span>
              <Input
                required
                autoFocus
                className="mt-1.5"
                value={videoDraft.assetId}
                onChange={(e) => setVideoDraft({ ...videoDraft, assetId: e.target.value })}
              />
            </label>
            <label className="mt-4 block">
              <span className="text-sm font-medium">Mux playback ID</span>
              <Input
                required
                className="mt-1.5"
                value={videoDraft.playbackId}
                onChange={(e) => setVideoDraft({ ...videoDraft, playbackId: e.target.value })}
              />
            </label>
            <div className="mt-6 flex gap-2">
              <Button type="submit" loading={setVideo.isPending}>
                Attach
              </Button>
              <Button type="button" variant="outline" onClick={() => setVideoDraft(null)}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      {bodyDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5">
          <div className="absolute inset-0 bg-black/50" onClick={() => setBodyDraft(null)} aria-hidden="true" />
          <form
            className="relative flex w-full max-w-2xl flex-col rounded-xl border border-border bg-card p-6 shadow-xl"
            onSubmit={(e) => {
              e.preventDefault()
              saveBody.mutate(undefined as never, { onSuccess: () => setBodyDraft(null) })
            }}
          >
            {/* Sticky-in-header per §20.8; this modal has no separate scroll region so
                "sticky" here just means "always in the same visible spot," top of form. */}
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-sans text-lg font-semibold">{bodyDraft.lesson.title}</h3>
              <AutosaveIndicator status={bodyAutosave.status} savedAt={bodyAutosave.savedAt} />
            </div>
            <textarea
              autoFocus
              rows={16}
              className={cn(inputClass, 'mt-4 font-serif leading-relaxed')}
              value={bodyDraft.text}
              onChange={(e) => setBodyDraft({ ...bodyDraft, text: e.target.value })}
              onBlur={() => void bodyAutosave.saveNow()}
            />
            <div className="mt-5 flex gap-2">
              <Button type="submit" loading={saveBody.isPending}>
                Save
              </Button>
              <Button type="button" variant="outline" onClick={() => setBodyDraft(null)}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Block editor's three modals — text/callout, video, file — same pattern as
          videoDraft/bodyDraft above, keyed by block id instead of lesson id. */}
      {blockTextDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setBlockTextDraft(null)}
            aria-hidden="true"
          />
          <form
            className="relative flex w-full max-w-2xl flex-col rounded-xl border border-border bg-card p-6 shadow-xl"
            onSubmit={(e) => {
              e.preventDefault()
              saveBlockText.mutate(undefined as never, { onSuccess: () => setBlockTextDraft(null) })
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-sans text-lg font-semibold">
                {blockTextDraft.block.block_type === 'callout' ? 'Callout block' : 'Text block'}
              </h3>
              <AutosaveIndicator status={blockTextAutosave.status} savedAt={blockTextAutosave.savedAt} />
            </div>
            <label className="mt-4 block">
              <span className="text-sm font-medium">Heading (optional)</span>
              <Input
                autoFocus
                className="mt-1.5"
                value={blockTextDraft.heading}
                onChange={(e) => setBlockTextDraft({ ...blockTextDraft, heading: e.target.value })}
                onBlur={() => void blockTextAutosave.saveNow()}
              />
            </label>
            <textarea
              rows={12}
              className={cn(inputClass, 'mt-4 font-serif leading-relaxed')}
              value={blockTextDraft.text}
              onChange={(e) => setBlockTextDraft({ ...blockTextDraft, text: e.target.value })}
              onBlur={() => void blockTextAutosave.saveNow()}
            />
            <div className="mt-5 flex gap-2">
              <Button type="submit" loading={saveBlockText.isPending}>
                Save
              </Button>
              <Button type="button" variant="outline" onClick={() => setBlockTextDraft(null)}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      {blockVideoDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setBlockVideoDraft(null)}
            aria-hidden="true"
          />
          <form
            className="relative w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl"
            onSubmit={(e) => {
              e.preventDefault()
              setBlockVideo.mutate(undefined as never, { onSuccess: () => setBlockVideoDraft(null) })
            }}
          >
            <h3 className="font-sans text-lg font-semibold">Attach a video</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload the file in Mux, then paste its two ids here.
            </p>
            <label className="mt-4 block">
              <span className="text-sm font-medium">Mux asset ID</span>
              <Input
                required
                autoFocus
                className="mt-1.5"
                value={blockVideoDraft.assetId}
                onChange={(e) => setBlockVideoDraft({ ...blockVideoDraft, assetId: e.target.value })}
              />
            </label>
            <label className="mt-4 block">
              <span className="text-sm font-medium">Mux playback ID</span>
              <Input
                required
                className="mt-1.5"
                value={blockVideoDraft.playbackId}
                onChange={(e) => setBlockVideoDraft({ ...blockVideoDraft, playbackId: e.target.value })}
              />
            </label>
            <div className="mt-6 flex gap-2">
              <Button type="submit" loading={setBlockVideo.isPending}>
                Attach
              </Button>
              <Button type="button" variant="outline" onClick={() => setBlockVideoDraft(null)}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      {blockFileDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setBlockFileDraft(null)}
            aria-hidden="true"
          />
          <form
            className="relative w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl"
            onSubmit={(e) => {
              e.preventDefault()
              setBlockFile.mutate(undefined as never, { onSuccess: () => setBlockFileDraft(null) })
            }}
          >
            <h3 className="font-sans text-lg font-semibold">Attach a file</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Pick from the templates already uploaded on the Templates page.
            </p>
            <label className="mt-4 block">
              <span className="text-sm font-medium">Template</span>
              <select
                required
                autoFocus
                className={cn(inputClass, 'mt-1.5')}
                value={blockFileDraft.templateId}
                onChange={(e) => setBlockFileDraft({ ...blockFileDraft, templateId: e.target.value })}
              >
                <option value="" disabled>
                  Choose a template…
                </option>
                {templateOptions?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} ({t.file_name})
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-6 flex gap-2">
              <Button type="submit" loading={setBlockFile.isPending}>
                Attach
              </Button>
              <Button type="button" variant="outline" onClick={() => setBlockFileDraft(null)}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

export function AdminCourses() {
  const queryClient = useQueryClient()
  const [openCourseId, setOpenCourseId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)

  const { data: courses, isLoading } = useQuery({
    queryKey: queryKeys.admin.courses(),
    queryFn: () => api.get<CourseRow[]>('/admin/courses').then((r) => r.data),
  })

  const createCourse = useMutation({
    mutationFn: () => api.post<CourseDetail>('/admin/courses', { title, description }),
    onSuccess: (r) => {
      setIsCreating(false)
      setTitle('')
      setDescription('')
      setError(null)
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.courses() })
      setOpenCourseId(r.data.id)
    },
    onError: (e) => setError(readError(e)),
  })

  if (openCourseId) {
    return (
      <div className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-8">
        <CourseBuilder courseId={openCourseId} onBack={() => setOpenCourseId(null)} />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageTitle
          eyebrow="Content editor"
          title="Courses"
          description="Structured, sequential learning paths — modules, then lessons, with video and readings."
        />
        {!isCreating && (
          <Button onClick={() => setIsCreating(true)}>
            <Plus className="size-4" aria-hidden="true" /> New course
          </Button>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-6 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {isCreating && (
        <form
          className="mt-8 rounded-xl border border-border bg-card p-6 shadow-sm"
          onSubmit={(e) => {
            e.preventDefault()
            setError(null)
            createCourse.mutate()
          }}
        >
          <h2 className="font-sans text-lg font-semibold">New course</h2>
          <label className="mt-5 block">
            <span className="text-sm font-medium">Title</span>
            <Input required className="mt-1.5" value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="mt-4 block">
            <span className="text-sm font-medium">Description</span>
            <textarea
              required
              rows={4}
              className={cn(inputClass, 'mt-1.5')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <div className="mt-6 flex gap-2 border-t border-border pt-5">
            <Button type="submit" loading={createCourse.isPending}>
              Create and add modules
            </Button>
            <Button type="button" variant="outline" onClick={() => setIsCreating(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {!isCreating && (
        <>
          {isLoading ? (
            <p className="mt-10 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading courses…
            </p>
          ) : (
            <ul className="mt-8 flex flex-col divide-y divide-border border-t border-border">
              {courses?.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-4 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-sans font-medium text-foreground">{c.title}</p>
                      {c.published ? <Badge variant="success">Live</Badge> : <Badge variant="muted">Draft</Badge>}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {c.module_count} module{c.module_count === 1 ? '' : 's'} · {c.lesson_count} lesson
                      {c.lesson_count === 1 ? '' : 's'}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setOpenCourseId(c.id)}>
                    Open
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {courses?.length === 0 && (
            <p className="mt-8 text-sm text-muted-foreground">No courses yet.</p>
          )}
        </>
      )}
    </div>
  )
}
