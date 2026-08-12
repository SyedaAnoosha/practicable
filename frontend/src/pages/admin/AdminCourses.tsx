import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowLeft, Check, Loader2, Plus, Video, X } from 'lucide-react'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { PageTitle } from '@/components/ui/PageTitle'

interface CourseRow {
  id: string
  slug: string
  title: string
  subtitle?: string | null
  published: boolean
  module_count: number
  lesson_count: number
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

  const { data: course, isLoading } = useQuery({
    queryKey: queryKeys.admin.course(courseId),
    queryFn: () => api.get<CourseDetail>(`/admin/courses/${courseId}`).then((r) => r.data),
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
                <li key={lesson.id} className="flex flex-wrap items-center gap-3 py-3">
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
                            : 'Needs a video attached'}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {(lesson.lesson_type === 'video' || lesson.lesson_type === 'mixed') && (
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
                    {(lesson.lesson_type === 'reading' || lesson.lesson_type === 'mixed') && (
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
            <h3 className="font-sans text-lg font-semibold">{bodyDraft.lesson.title}</h3>
            <textarea
              autoFocus
              rows={16}
              className={cn(inputClass, 'mt-4 font-serif leading-relaxed')}
              value={bodyDraft.text}
              onChange={(e) => setBodyDraft({ ...bodyDraft, text: e.target.value })}
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
