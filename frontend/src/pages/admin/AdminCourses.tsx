import { useCallback, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Download,
  Image,
  Loader2,
  MessageSquareQuote,
  Plus,
  Trash2,
  Type,
  Video,
} from 'lucide-react'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { cn } from '@/lib/utils/cn'
import { priceChangeConfirmMessage, priceChangeNeedsConfirm } from '@/lib/utils/priceChangeConfirm'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import { dollarsToCents } from '@/lib/utils/dollarsToCents'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { PageTitle } from '@/components/ui/PageTitle'
import { FieldError } from '@/components/ui/FieldError'
import { UploadField } from '@/components/admin/UploadField'
import { TokenizedVideoPreview } from '@/components/admin/TokenizedVideoPreview'
import { PublishStateChip, type PublishStateValue } from '@/components/admin/PublishStateChip'
import { InlineEditableTitle } from '@/components/admin/InlineEditableTitle'
import { required, requiredSelect, useFieldValidation } from '@/lib/useFieldValidation'
import { readError } from '@/lib/utils/readError'

// Exported for LessonWriteScreen.tsx (the full-screen "Write" route) — same course
// shape, same admin API, so it reuses these rather than a second copy that could drift.
export interface CourseRow {
  id: string
  slug: string
  title: string
  subtitle?: string | null
  published: boolean
  publish_state: PublishStateValue
  module_count: number
  lesson_count: number
  // Found 2026-08-21 (owner-flagged): the list showed no price at all — an admin had
  // to open every course to see what it charges. None until "Make purchasable" has
  // been called, same as the detail page's course.price_amount.
  price_amount?: number | null
  currency?: string | null
}

export interface AdminLessonBlock {
  id: string
  block_type: 'text' | 'video' | 'file' | 'callout'
  sort_order: number
  heading?: string | null
  text_body?: string | null
  // Found 2026-08-21 (8E editor round-trip bug): the API always returned this, but the
  // admin type never carried it, so RichTextEditor was initialized from text_body on
  // every open — the plain-text fallback field — even for a block already saved with
  // real formatting. Reopening a formatted block showed the wall-of-text plain
  // fallback, and any un-noticed re-save from there would have overwritten the
  // formatted version with it.
  prose_sanitized?: string | null
  media_id?: string | null
  mux_playback_id?: string | null
  mux_asset_id?: string | null
  template_id?: string | null
  template_file_name?: string | null
}

export interface AdminLesson {
  id: string
  slug: string
  title: string
  description?: string | null
  lesson_type: string
  body?: string | null
  // See AdminLessonBlock.prose_sanitized — same bug, same fix, lesson-body modal.
  prose_sanitized?: string | null
  sort_order: number
  published: boolean
  publish_state: PublishStateValue
  download_template_id?: string | null
  mux_playback_id?: string | null
  mux_asset_id?: string | null
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

export interface AdminModule {
  id: string
  title: string
  description?: string | null
  sort_order: number
  lessons: AdminLesson[]
}

export type ReadinessState = 'no_product' | 'price_unset' | 'stripe_price_unresolved' | 'unpublished' | 'ready'

export interface CourseDetail {
  id: string
  slug: string
  title: string
  subtitle?: string | null
  description: string
  published: boolean
  publish_state: PublishStateValue
  cover_image_url?: string | null
  modules: AdminModule[]
  // Phase 8 (8A-6): server-derived — never inferred client-side from published/price.
  readiness: ReadinessState
  readiness_message: string
  product_id: string | null
  price_amount: number | null
  currency: string | null
}

const LESSON_TYPES = [
  { value: 'video', label: 'Video' },
  { value: 'reading', label: 'Reading' },
  { value: 'download', label: 'Download' },
  { value: 'mixed', label: 'Mixed (video + reading)' },
]

const inputClass =
  'w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'



/** Course cover image upload — same presigned-URL pattern as templates, but talks
 * to the course-specific endpoints. A single image, not a gallery, so no alt text
 * prompt (it's a marketing cover, not a document page).
 */
function CoverImageUpload({
  courseId,
  coverImageUrl,
  onUploadComplete,
  onRemove,
}: {
  courseId: string
  coverImageUrl: string | null
  onUploadComplete: (url: string) => void
  onRemove: () => void
}) {
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'error'>('idle')
  const [progress, setProgress] = useState(0)
  const [errorMessage, setErrorMessage] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const putWithProgress = useCallback((url: string, file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('PUT', url)
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100))
      }
      xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)))
      xhr.onerror = () => reject(new Error('Upload failed — check your connection and try again.'))
      xhr.send(file)
    })
  }, [])

  const handleFile = useCallback(async (file: File) => {
    if (file.size > 8 * 1024 * 1024) {
      setPhase('error')
      setErrorMessage(`That file is ${(file.size / (1024 * 1024)).toFixed(0)}MB. The ceiling is 8MB.`)
      return
    }
    setProgress(0)
    setErrorMessage('')
    setPhase('uploading')
    try {
      const { data: target } = await api.post<{
        upload_url: string
        storage_key: string
      }>(`/admin/courses/${courseId}/cover/upload-url`, {
        file_name: file.name,
        content_type: file.type || 'application/octet-stream',
        file_size_bytes: file.size,
      })
      await putWithProgress(target.upload_url, file)
      const { data } = await api.post<{ cover_image_url: string | null }>(
        `/admin/courses/${courseId}/cover/upload-url/confirm`,
        { storage_key: target.storage_key, file_name: file.name },
      )
      setPhase('idle')
      if (data.cover_image_url) onUploadComplete(data.cover_image_url)
    } catch (err) {
      setPhase('error')
      const message = (err as { response?: { data?: { detail?: { error?: { message?: string } } | string } } })?.response
        ?.data?.detail
      const readable = typeof message === 'object' ? message?.error?.message : typeof message === 'string' ? message : undefined
      setErrorMessage(readable ?? 'Something went wrong. Please try again.')
    }
  }, [courseId, putWithProgress, onUploadComplete])

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) void handleFile(file)
  }

  if (coverImageUrl) {
    return (
      <div className="relative">
        {/* `[ADDED 2026-08-22, Redesing_decisions.md K2]` The height is pinned by
            `h-40`, so this never shifted layout; width/height still go on for the
            decode-time aspect ratio, and `loading="lazy"` keeps an uploaded cover off
            the critical path of a list the editor may not scroll to. */}
        <img
          src={coverImageUrl}
          alt="Course cover"
          width={640}
          height={160}
          loading="lazy"
          decoding="async"
          className="h-40 w-full rounded-lg object-cover"
        />
        <div className="mt-2 flex gap-2">
          <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
            Replace
          </Button>
          <Button size="sm" variant="ghost" onClick={onRemove}>
            <Trash2 className="size-3.5" aria-hidden="true" /> Remove
          </Button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) void handleFile(file)
          }}
        />
      </div>
    )
  }

  if (phase === 'uploading') {
    return (
      <div className="rounded-md border border-border bg-muted/30 p-4">
        <p className="flex items-center gap-2 text-sm text-foreground">
          <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
          Uploading cover image…
        </p>
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-[400ms] ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="tabular-nums text-xs text-muted-foreground">{progress}%</span>
        </div>
      </div>
    )
  }

  return (
    <div>
      <label
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          'flex flex-col items-center gap-2 rounded-md border-2 border-dashed border-border p-6 text-center transition-colors duration-150',
          'cursor-pointer',
          dragOver && 'border-border-strong bg-muted',
          phase === 'error' && 'border-destructive',
        )}
      >
        <Image className="size-6 text-muted-foreground" aria-hidden="true" />
        <span className="text-sm font-medium text-foreground">Drop an image, or choose one</span>
        <span className="text-xs text-muted-foreground">PNG, JPEG or WebP — up to 8 MB</span>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) void handleFile(file)
          }}
        />
      </label>
      {phase === 'error' && (
        <div className="mt-2 flex items-center justify-between gap-2 rounded-md bg-destructive/10 px-3 py-2">
          <p role="alert" className="text-sm text-destructive">{errorMessage}</p>
          <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
            Try again
          </Button>
        </div>
      )}
    </div>
  )
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
                {block.block_type === 'video' && block.mux_playback_id && (
                  <div className="mt-2">
                    <TokenizedVideoPreview
                      playbackId={block.mux_playback_id}
                      assetId={block.mux_asset_id}
                      className="max-h-32"
                    />
                  </div>
                )}
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
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [newModuleTitle, setNewModuleTitle] = useState('')
  const [lessonDraft, setLessonDraft] = useState<{ moduleId: string; title: string; type: string } | null>(null)
  const [videoDraft, setVideoDraft] = useState<{ lessonId: string; assetId: string; playbackId: string } | null>(
    null,
  )
  // Lesson-body and block-text/callout prose editing moved to a full-screen route
  // (LessonWriteScreen.tsx, week4_plan.md Phase 8 "8E-continued",
  // `[OWNER INSTRUCTION 2026-08-21]`) — no more bodyDraft/blockTextDraft modal state
  // here; the "Write" buttons below navigate instead.

  // Block-editor drafts — one lesson (mixed-content, week2_plan.md Phase 2) can hold
  // several of each, so these key off the block's own id rather than the lesson's.
  const [blockVideoDraft, setBlockVideoDraft] = useState<{ blockId: string; assetId: string; playbackId: string } | null>(
    null,
  )
  const [blockFileDraft, setBlockFileDraft] = useState<{ blockId: string; templateId: string } | null>(null)

  // week2_plan.md §20.8 / W2-R9 — one small validator per form, matching the fields
  // that form actually holds. Kept separate rather than one giant shape because these
  // modals are mutually exclusive (only one draft is ever open at a time) and each
  // needs its own touched/error state reset when it opens.
  const moduleV = useFieldValidation<{ title: string }>({ title: required('Module title') })
  const lessonV = useFieldValidation<{ title: string }>({ title: required('Lesson title') })
  const videoV = useFieldValidation<{ assetId: string; playbackId: string }>({
    assetId: required('Mux asset ID'),
    playbackId: required('Mux playback ID'),
  })
  const blockVideoV = useFieldValidation<{ assetId: string; playbackId: string }>({
    assetId: required('Mux asset ID'),
    playbackId: required('Mux playback ID'),
  })
  const blockFileV = useFieldValidation<{ templateId: string }>({
    templateId: requiredSelect('a template'),
  })

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
    // Takes its variables explicitly (`v`), not from `videoDraft` closure state — the
    // caller (UploadField's onComplete) sets state and fires this mutation in the same
    // tick, and a state update isn't visible in this render's closures until the next
    // render. Reading `v` instead sidesteps that race entirely.
    mutate((v: { lessonId: string; assetId: string; playbackId: string }) =>
      api.put<CourseDetail>(`/admin/lessons/${v.lessonId}/video`, {
        mux_asset_id: v.assetId,
        mux_playback_id: v.playbackId,
      }),
    ),
  )
  const setLessonPublishState = useMutation(
    mutate((v: { id: string; state: PublishStateValue }) =>
      api.post<CourseDetail>(`/admin/lessons/${v.id}/publish`, {
        published: v.state === 'published',
        publish_state: v.state,
      }),
    ),
  )
  const setCoursePublishState = useMutation(
    mutate((v: { state: PublishStateValue }) =>
      api.post<CourseDetail>(`/admin/courses/${courseId}/publish`, {
        published: v.state === 'published',
        publish_state: v.state,
      }),
    ),
  )

  // Title editing (extends 8E's rich-text work — course/module/lesson titles had no
  // edit path in the UI at all before this). Each PUT carries the endpoint's full
  // required payload, not just the title — these routes replace the row's writable
  // fields wholesale, so the other fields are read back off the current course data
  // to avoid clobbering them.
  const saveCourseTitle = useMutation(
    mutate((title: string) =>
      api.put<CourseDetail>(`/admin/courses/${courseId}`, {
        title,
        subtitle: course?.subtitle ?? null,
        description: course?.description ?? null,
      }),
    ),
  )
  const saveModuleTitle = useMutation(
    mutate((v: { moduleId: string; title: string; description: string | null }) =>
      api.put<CourseDetail>(`/admin/modules/${v.moduleId}`, {
        title: v.title,
        description: v.description,
      }),
    ),
  )
  const saveLessonTitle = useMutation(
    mutate((v: { lesson: AdminLesson; title: string }) =>
      api.put<CourseDetail>(`/admin/lessons/${v.lesson.id}`, {
        title: v.title,
        lesson_type: v.lesson.lesson_type,
        description: v.lesson.description ?? null,
        body: v.lesson.body ?? null,
        download_template_id: v.lesson.download_template_id ?? null,
      }),
    ),
  )

  // ── Block editor mutations (week2_plan.md Phase 2) ─────────────────────────────
  const addBlock = useMutation(
    mutate((v: { lessonId: string; blockType: AdminLessonBlock['block_type'] }) =>
      api.post<CourseDetail>(`/admin/lessons/${v.lessonId}/blocks`, { block_type: v.blockType }),
    ),
  )
  // Autosave for block-text/callout prose now lives in LessonWriteScreen.tsx, next
  // to the mutation it saves — see the note above bodyDraft's removal.
  const setBlockVideo = useMutation(
    // Same stale-closure fix as `setVideo` above — UploadField's onComplete fires this
    // mutation with explicit variables rather than relying on `blockVideoDraft` state,
    // which isn't updated in this render's closures yet.
    mutate((v: { blockId: string; assetId: string; playbackId: string }) =>
      api.put<CourseDetail>(`/admin/lesson-blocks/${v.blockId}/video`, {
        mux_asset_id: v.assetId,
        mux_playback_id: v.playbackId,
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
  // Phase 9A re-verification (2026-08-21): now takes the admin's own price directly
  // — "Create Product" as a separate button is gone; the price control below calls
  // this transparently the first time a price is set on a course with no product yet.
  const createCourseProduct = useMutation(
    mutate((v: { courseId: string; priceAmount: number }) =>
      api.post<CourseDetail>(`/admin/courses/${v.courseId}/create-product`, {
        price_amount: v.priceAmount,
        currency: 'AUD',
      }),
    ),
  )
  // Phase 9A: price control — POST /admin/products/{id}/price (one endpoint, three
  // surfaces). Fixed 2026-08-21: this previously went through the shared `mutate()`
  // helper, which unconditionally calls `applyCourse(r.data)` on success — but this
  // endpoint returns ProductOut (a flat product record, no `modules`), not
  // CourseDetail. `applyCourse` overwrote the course-detail cache with a ProductOut,
  // and the next render crashed on `course.modules.map(...)` (`modules` is undefined
  // on a ProductOut). Kept off `mutate()` on purpose — the explicit
  // invalidateQueries below is what actually refreshes the course with its real
  // shape, by refetching CourseDetail rather than trusting this response's shape.
  const [priceAmount, setPriceAmount] = useState('')
  const changePrice = useMutation({
    mutationFn: (v: { productId: string; priceAmount: number }) =>
      api.post(`/admin/products/${v.productId}/price`, {
        price_amount: v.priceAmount,
        currency: 'AUD',
        reason: 'Price set from course editor',
      }),
    onError: (e: unknown) => setError(readError(e)),
  })
  const removeCoverImage = useMutation(
    mutate(() => api.post<CourseDetail>(`/admin/courses/${courseId}/cover/remove`)),
  )

  if (isLoading || !course) {
    return (
      <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
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
        <div className="flex items-start gap-2">
          {/* PageTitle renders the page's one <h1> and is shared by every route in the
              app; editing lives beside it rather than inside it so this control
              changes nothing about that component. hideText avoids showing the title
              twice — the edit affordance is just the pencil until clicked, then an
              input takes the same visual slot. */}
          <PageTitle eyebrow="Course" title={course.title} description={course.subtitle ?? undefined} />
          <InlineEditableTitle
            value={course.title}
            onSave={(title) => saveCourseTitle.mutateAsync(title)}
            hideText
            inputClassName="text-h1 font-semibold px-2 py-1"
            editLabel="Edit course title"
          />
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <PublishStateChip
              value={course.publish_state}
              disabled={setCoursePublishState.isPending}
              onChange={(state) => setCoursePublishState.mutate({ state })}
            />
          </div>
          {/* Phase 8 (8A-6): server-derived readiness — never inferred client-side,
              since only the server knows whether the Stripe price actually resolves. */}
          {course.readiness !== 'ready' && (
            <span className="flex items-center gap-1 text-xs text-amber-600">
              <AlertTriangle className="size-3" aria-hidden="true" /> {course.readiness_message}
            </span>
          )}
        </div>
      </div>

      {/* Phase 9A re-verification (2026-08-21, owner-flagged): "Create Product" used
          to be a separate button before a price could be set at all — removed. This
          control now always shows, and creates the product transparently (via
          create-product, passing the admin's own price) the first time a price is
          set on a course that doesn't have one yet. */}
      <div className="mt-4 rounded-lg border border-border bg-card p-4">
        <p className="text-sm font-medium text-foreground">Price</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {course.price_amount != null
            ? `Currently ${formatCurrency(course.price_amount, course.currency ?? 'AUD')}. `
            : ''}
          Set in dollars. This updates the Stripe Price that charges buyers.
        </p>
        <div className="mt-3 flex items-end gap-3">
          <label className="flex-1">
            <span className="sr-only">Price in dollars</span>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g. 99.00"
              value={priceAmount}
              onChange={(e) => setPriceAmount(e.target.value)}
            />
          </label>
          <Button
            size="sm"
            onClick={() => {
              const cents = dollarsToCents(priceAmount)
              if (!Number.isFinite(cents) || cents <= 0) return

              const onDone = () => {
                setPriceAmount('')
                void queryClient.invalidateQueries({ queryKey: queryKeys.admin.courses() })
                // The list invalidation above doesn't touch this page's own
                // CourseDetail query — without this, the price shown here
                // stays stale until a manual reload.
                void queryClient.invalidateQueries({ queryKey: queryKeys.admin.course(courseId) })
              }

              if (!course.product_id) {
                // First price ever set on this course — create-product now takes
                // the price directly, one action instead of two.
                createCourseProduct.mutate(
                  { courseId: course.id, priceAmount: cents },
                  { onSuccess: onDone },
                )
                return
              }

              // Phase 8 (8B-7): fat-finger protection — a ±50% swing or a drop to
              // zero (not reachable via this positive-only field, but the helper
              // covers it) is confirmed before it charges a real card.
              const oldCents = course.price_amount ?? 0
              if (
                priceChangeNeedsConfirm(oldCents, cents) &&
                !window.confirm(priceChangeConfirmMessage(oldCents, cents, course.currency ?? 'AUD'))
              ) {
                return
              }
              changePrice.mutate(
                { productId: course.product_id, priceAmount: cents },
                { onSuccess: onDone },
              )
            }}
            loading={changePrice.isPending || createCourseProduct.isPending}
            disabled={!priceAmount}
          >
            Set price
          </Button>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* Cover image upload — §16.2's course artwork, like Coursera/edX/Udemy */}
      <div className="mt-6">
        <p className="text-sm font-medium text-foreground">Cover image</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Shown on the course catalogue and detail page. PNG, JPEG or WebP, up to 8 MB.
        </p>
        <div className="mt-3">
          <CoverImageUpload
            courseId={courseId}
            coverImageUrl={course.cover_image_url ?? null}
            onUploadComplete={() => {
              void queryClient.invalidateQueries({ queryKey: queryKeys.admin.course(courseId) })
              void queryClient.invalidateQueries({ queryKey: queryKeys.courses.list() })
            }}
            onRemove={() => removeCoverImage.mutate(undefined as never)}
          />
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-6">
        {course.modules.map((module) => (
          <section key={module.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <InlineEditableTitle
              value={module.title}
              onSave={(title) =>
                saveModuleTitle.mutateAsync({ moduleId: module.id, title, description: module.description ?? null })
              }
              as="h3"
              className="font-sans font-semibold text-foreground"
              inputClassName="font-sans font-semibold"
              editLabel="Edit module title"
            />

            <ul className="mt-4 flex flex-col divide-y divide-border border-t border-border">
              {module.lessons.map((lesson) => (
                <li key={lesson.id} className="flex flex-col gap-3 py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <InlineEditableTitle
                        value={lesson.title}
                        onSave={(title) => saveLessonTitle.mutateAsync({ lesson, title })}
                        as="p"
                        className="text-sm font-medium text-foreground"
                        editLabel="Edit lesson title"
                      />
                      <Badge variant="muted">{lesson.lesson_type}</Badge>
                      <PublishStateChip
                        value={lesson.publish_state}
                        disabled={setLessonPublishState.isPending && setLessonPublishState.variables?.id === lesson.id}
                        title={!lesson.is_ready ? "Add this lesson's content before publishing it." : undefined}
                        onChange={(state) => setLessonPublishState.mutate({ id: lesson.id, state })}
                      />
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
                    {lesson.lesson_type === 'video' && lesson.mux_playback_id && (
                      <div className="mt-2">
                        <TokenizedVideoPreview
                          playbackId={lesson.mux_playback_id}
                          assetId={lesson.mux_asset_id}
                          className="max-h-32"
                        />
                      </div>
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
                        onClick={() => {
                          videoV.reset()
                          setVideoDraft({ lessonId: lesson.id, assetId: '', playbackId: '' })
                        }}
                      >
                        <Video className="size-4" aria-hidden="true" />
                        {lesson.mux_playback_id ? 'Replace video' : 'Add video'}
                      </Button>
                    )}
                    {lesson.lesson_type === 'reading' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/admin/courses/${courseId}/lessons/${lesson.id}/write`)}
                      >
                        Write
                      </Button>
                    )}
                  </div>
                </div>

                {lesson.lesson_type === 'mixed' && (
                  <BlockEditor
                    lesson={lesson}
                    templateOptions={templateOptions}
                    onAddBlock={(blockType) => addBlock.mutate({ lessonId: lesson.id, blockType })}
                    addBlockPending={addBlock.isPending}
                    onEditText={(block) =>
                      navigate(`/admin/courses/${courseId}/blocks/${block.id}/write`)
                    }
                    onEditVideo={(blockId) => {
                      blockVideoV.reset()
                      setBlockVideoDraft({ blockId, assetId: '', playbackId: '' })
                    }}
                    onEditFile={(blockId) => {
                      blockFileV.reset()
                      setBlockFileDraft({
                        blockId,
                        templateId: lesson.blocks.find((b) => b.id === blockId)?.template_id ?? '',
                      })
                    }}
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
                  if (!lessonV.validateAll({ title: lessonDraft.title })) return
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
                    onBlur={() => lessonV.onBlur('title', lessonDraft.title)}
                    error={lessonV.errorFor('title')}
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
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setLessonDraft(null)
                    lessonV.reset()
                  }}
                >
                  Cancel
                </Button>
              </form>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="mt-4"
                onClick={() => {
                  lessonV.reset()
                  setLessonDraft({ moduleId: module.id, title: '', type: 'video' })
                }}
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
          if (!moduleV.validateAll({ title: newModuleTitle })) return
          addModule.mutate(undefined as never, {
            onSuccess: () => {
              setNewModuleTitle('')
              moduleV.reset()
            },
          })
        }}
      >
        <label className="min-w-56 flex-1">
          <span className="text-xs font-medium text-muted-foreground">New module title</span>
          <Input
            required
            className="mt-1"
            value={newModuleTitle}
            onChange={(e) => setNewModuleTitle(e.target.value)}
            onBlur={() => moduleV.onBlur('title', newModuleTitle)}
            error={moduleV.errorFor('title')}
            placeholder="Module 3 — Reporting"
          />
        </label>
        <Button type="submit" variant="outline" loading={addModule.isPending}>
          <Plus className="size-4" aria-hidden="true" /> Add module
        </Button>
      </form>

      {/* week3_plan.md Phase 5 step 1 — a real upload replaces pasting two ids copied
          from the Mux dashboard. UploadField hands back the finished asset directly;
          this dialog attaches it the moment it's ready, no separate "Attach" click. */}
      {videoDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setVideoDraft(null)}
            aria-hidden="true"
          />
          <div className="relative w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
            <h3 className="font-sans text-lg font-semibold">Attach a video</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload the file directly — Mux encodes it, and it attaches automatically once ready.
            </p>
            <div className="mt-4">
              <UploadField
                kind="video"
                accept="video/*"
                acceptedTypesText="Any video file Mux accepts (mp4, mov and most others)."
                onComplete={(result) => {
                  if (result.kind !== 'video') return
                  const vars = { lessonId: videoDraft.lessonId, assetId: result.muxAssetId, playbackId: result.muxPlaybackId }
                  setVideo.mutate(vars, { onSuccess: () => setVideoDraft(null) })
                }}
              />
            </div>
            <div className="mt-5 flex justify-end">
              <Button type="button" variant="outline" onClick={() => setVideoDraft(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Lesson-body and block-text/callout "Write" modals removed 2026-08-21 — both
          now navigate to LessonWriteScreen.tsx's full-screen route instead (see the
          "Write" button onClick handlers above). Block editor's remaining two modals
          — video, file — keep the modal pattern; a single picked id has nothing to
          lose mid-typing, so a full screen buys nothing there. */}

      {blockVideoDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setBlockVideoDraft(null)}
            aria-hidden="true"
          />
          <div className="relative w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
            <h3 className="font-sans text-lg font-semibold">Attach a video</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload the file directly — Mux encodes it, and it attaches automatically once ready.
            </p>
            <div className="mt-4">
              <UploadField
                kind="video"
                accept="video/*"
                acceptedTypesText="Any video file Mux accepts (mp4, mov and most others)."
                onComplete={(result) => {
                  if (result.kind !== 'video') return
                  const vars = { blockId: blockVideoDraft.blockId, assetId: result.muxAssetId, playbackId: result.muxPlaybackId }
                  setBlockVideo.mutate(vars, { onSuccess: () => setBlockVideoDraft(null) })
                }}
              />
            </div>
            <div className="mt-5 flex justify-end">
              <Button type="button" variant="outline" onClick={() => setBlockVideoDraft(null)}>
                Cancel
              </Button>
            </div>
          </div>
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
              if (!blockFileV.validateAll({ templateId: blockFileDraft.templateId })) return
              setBlockFile.mutate(undefined as never, {
                onSuccess: () => {
                  setBlockFileDraft(null)
                  blockFileV.reset()
                },
              })
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
                onBlur={() => blockFileV.onBlur('templateId', blockFileDraft.templateId)}
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
              <FieldError message={blockFileV.errorFor('templateId')} />
            </label>
            <div className="mt-6 flex gap-2">
              <Button type="submit" loading={setBlockFile.isPending}>
                Attach
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setBlockFileDraft(null)
                  blockFileV.reset()
                }}
              >
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
  const [searchParams] = useSearchParams()
  // LessonWriteScreen.tsx's Back/Cancel/Save all return here as
  // `/admin/courses?open={courseId}` (week4_plan.md Phase 8 "8E-continued") — course
  // selection itself is otherwise local state, not a URL param, so this is the one
  // place that state needs seeding from the URL rather than always starting at null.
  const [openCourseId, setOpenCourseId] = useState<string | null>(() => searchParams.get('open'))
  const [isCreating, setIsCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const v = useFieldValidation<{ title: string; description: string }>({
    title: required('Title'),
    description: required('Description'),
  })

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
      v.reset()
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
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageTitle
          eyebrow="Content editor"
          title="Courses"
          description="Structured, sequential learning paths — modules, then lessons, with video and readings."
        />
        {!isCreating && (
          <Button
            onClick={() => {
              v.reset()
              setIsCreating(true)
            }}
          >
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
            if (!v.validateAll({ title, description })) return
            setError(null)
            createCourse.mutate()
          }}
        >
          <h2 className="font-sans text-lg font-semibold">New course</h2>
          <label className="mt-5 block">
            <span className="text-sm font-medium">Title</span>
            <Input
              required
              className="mt-1.5"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => v.onBlur('title', title)}
              error={v.errorFor('title')}
            />
          </label>
          <label className="mt-4 block">
            <span className="text-sm font-medium">Description</span>
            <textarea
              required
              rows={4}
              className={cn(inputClass, 'mt-1.5')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => v.onBlur('description', description)}
            />
            <FieldError message={v.errorFor('description')} />
          </label>
          <div className="mt-6 flex gap-2 border-t border-border pt-5">
            <Button type="submit" loading={createCourse.isPending}>
              Create and add modules
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsCreating(false)
                v.reset()
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {!isCreating && (
        <>
          {isLoading ? (
            <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading courses…
            </p>
          ) : (
            <ul className="mt-8 flex flex-col divide-y divide-border border-t border-border">
              {courses?.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-4 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-sans font-medium text-foreground">{c.title}</p>
                      {/* Read-only here — this row has no course-scoped mutation of its
                          own; "Open" below drops into CourseBuilder, where the same chip
                          is the live, clickable one. `disabled` keeps the visual language
                          identical without implying a click does anything on this row. */}
                      <PublishStateChip value={c.publish_state} disabled onChange={() => {}} />
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {c.module_count} module{c.module_count === 1 ? '' : 's'} · {c.lesson_count} lesson
                      {c.lesson_count === 1 ? '' : 's'}
                      {c.price_amount != null && (
                        <> · {formatCurrency(c.price_amount, c.currency ?? 'AUD')}</>
                      )}
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
