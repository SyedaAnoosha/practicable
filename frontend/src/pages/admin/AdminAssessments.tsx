import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Edit3,
  Loader2,
  Plus,
  Trash2,
  XCircle,
} from 'lucide-react'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { cn } from '@/lib/utils/cn'
import { readError } from '@/lib/utils/readError'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { PageTitle } from '@/components/ui/PageTitle'
import { FieldError } from '@/components/ui/FieldError'
import { required, useFieldValidation } from '@/lib/useFieldValidation'

// ── Types matching backend API shapes ────────────────────────────────────────

interface AssessmentOptionRow {
  id: string
  label: string
  is_correct: boolean
  sort_order: number
}

interface AssessmentQuestionRow {
  id: string
  prompt: string
  sort_order: number
  question_type: string
  options: AssessmentOptionRow[]
}

interface AssessmentRow {
  id: string
  module_id: string
  course_id: string | null
  module_title: string | null
  course_title: string | null
  title: string
  description: string | null
  passing_score: number
  max_attempts: number
  published: boolean
  questions: AssessmentQuestionRow[]
  attempt_count: number
}

interface CourseOption {
  id: string
  title: string
  slug: string
}

interface ModuleOption {
  id: string
  title: string
  course_id: string
  course_title?: string
}

const inputClass =
  'w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

/**
 * `[ADDED 2026-08-25, owner direction: "improve assessment pages in admin pages"]`
 *
 * What makes an assessment safe to publish. Publishing is the moment a quiz starts
 * gating real learners' certificates, and until now the toggle would happily publish
 * a paper with no questions at all — or, worse, one whose questions have no correct
 * option, which `_mark`'s all-or-nothing comparison scores as permanently unanswerable.
 * A learner would burn every attempt on a quiz nobody could pass.
 *
 * These are exactly the conditions the marking code depends on, stated once here so the
 * detail view can show them as a checklist and the publish button can refuse.
 */
function publishBlockers(a: AssessmentRow): string[] {
  const blockers: string[] = []
  if (a.questions.length === 0) {
    blockers.push('Add at least one question.')
  }
  const noOptions = a.questions.filter((q) => q.options.length === 0)
  if (noOptions.length > 0) {
    blockers.push(
      `${noOptions.length} question${noOptions.length !== 1 ? 's have' : ' has'} no options.`,
    )
  }
  const noCorrect = a.questions.filter(
    (q) => q.options.length > 0 && !q.options.some((o) => o.is_correct),
  )
  if (noCorrect.length > 0) {
    blockers.push(
      `${noCorrect.length} question${noCorrect.length !== 1 ? 's have' : ' has'} no correct answer — nobody could pass.`,
    )
  }
  // Single-choice with several correct options can only be scored as "select them all",
  // which the learner UI renders as radio buttons and therefore cannot express.
  const multiCorrectSingle = a.questions.filter(
    (q) => q.question_type === 'single_choice' && q.options.filter((o) => o.is_correct).length > 1,
  )
  if (multiCorrectSingle.length > 0) {
    blockers.push(
      `${multiCorrectSingle.length} single-choice question${multiCorrectSingle.length !== 1 ? 's have' : ' has'} more than one correct answer.`,
    )
  }
  return blockers
}

// ── Question/Option editor ───────────────────────────────────────────────────

function QuestionEditor({
  assessmentId,
  question,
  onRefresh,
}: {
  assessmentId: string
  question: AssessmentQuestionRow
  onRefresh: () => void
}) {
  // A question that cannot be marked opens expanded: the fix — adding an option, or
  // ticking one as correct — is inside the collapsed panel, so leaving it shut hides
  // both the problem and its remedy behind a chevron.
  const correctCount = question.options.filter((o) => o.is_correct).length
  const needsAttention =
    question.options.length === 0 ||
    correctCount === 0 ||
    (question.question_type === 'single_choice' && correctCount > 1)

  const [expanded, setExpanded] = useState(needsAttention)
  const [editingPrompt, setEditingPrompt] = useState(false)
  const [promptValue, setPromptValue] = useState(question.prompt)
  const [newOptionLabel, setNewOptionLabel] = useState('')
  const [newOptionCorrect, setNewOptionCorrect] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const queryClient = useQueryClient()

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.admin.assessments() })
    void queryClient.invalidateQueries({ queryKey: queryKeys.admin.assessment(assessmentId) })
    onRefresh()
  }

  const savePrompt = useMutation({
    mutationFn: () =>
      api.patch<AssessmentRow>(`/admin/assessment-questions/${question.id}`, {
        prompt: promptValue,
      }),
    onSuccess: () => {
      setEditingPrompt(false)
      invalidate()
    },
    onError: (e: unknown) => setError(readError(e)),
  })

  const deleteQuestion = useMutation({
    mutationFn: () => api.delete<AssessmentRow>(`/admin/assessment-questions/${question.id}`),
    onSuccess: () => invalidate(),
    onError: (e: unknown) => setError(readError(e)),
  })

  const addOption = useMutation({
    mutationFn: () =>
      api.post<AssessmentRow>(`/admin/assessment-questions/${question.id}/options`, {
        label: newOptionLabel,
        is_correct: newOptionCorrect,
        sort_order: question.options.length,
      }),
    onSuccess: () => {
      setNewOptionLabel('')
      setNewOptionCorrect(false)
      invalidate()
    },
    onError: (e: unknown) => setError(readError(e)),
  })

  const toggleCorrect = useMutation({
    mutationFn: (opt: AssessmentOptionRow) =>
      api.patch<AssessmentRow>(`/admin/assessment-options/${opt.id}`, {
        is_correct: !opt.is_correct,
      }),
    onSuccess: () => invalidate(),
  })

  const deleteOption = useMutation({
    mutationFn: (optId: string) => api.delete<AssessmentRow>(`/admin/assessment-options/${optId}`),
    onSuccess: () => invalidate(),
  })

  return (
    <div
      className={cn(
        'rounded-md border p-3',
        needsAttention ? 'border-warning/40 bg-warning/5' : 'border-border bg-muted/30',
      )}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-0.5 text-muted-foreground hover:text-foreground"
          aria-label={expanded ? 'Collapse question' : 'Expand question'}
        >
          {expanded ? (
            <ChevronUp className="size-4" aria-hidden="true" />
          ) : (
            <ChevronDown className="size-4" aria-hidden="true" />
          )}
        </button>
        <div className="min-w-0 flex-1">
          {editingPrompt ? (
            <form
              className="flex gap-2"
              onSubmit={(e: FormEvent) => {
                e.preventDefault()
                savePrompt.mutate()
              }}
            >
              <Input
                autoFocus
                value={promptValue}
                onChange={(e) => setPromptValue(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" size="sm" loading={savePrompt.isPending}>
                Save
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditingPrompt(false)
                  setPromptValue(question.prompt)
                }}
              >
                Cancel
              </Button>
            </form>
          ) : (
            // `[FIXED 2026-08-25]` The prompt was `truncate`d on one line beside three
            // other elements, so anything longer than a few words was unreadable — on a
            // page whose entire purpose is reviewing question wording. It now wraps, and
            // the metadata sits on its own line beneath.
            <div>
              <div className="flex items-start gap-2">
                <p className="min-w-0 flex-1 text-sm font-medium text-foreground">
                  {question.prompt}
                </p>
                <button
                  type="button"
                  onClick={() => setEditingPrompt(true)}
                  className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground"
                  aria-label="Edit prompt"
                >
                  <Edit3 className="size-3.5" aria-hidden="true" />
                </button>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <Badge variant="muted">{question.question_type.replace('_', ' ')}</Badge>
                {question.options.length === 0 ? (
                  <Badge variant="warning">No options</Badge>
                ) : correctCount === 0 ? (
                  <Badge variant="warning">No correct answer</Badge>
                ) : question.question_type === 'single_choice' && correctCount > 1 ? (
                  <Badge variant="warning">{correctCount} correct on single choice</Badge>
                ) : (
                  <Badge variant="muted">
                    {correctCount} of {question.options.length} correct
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            if (window.confirm('Delete this question and all its options?')) {
              deleteQuestion.mutate()
            }
          }}
          disabled={deleteQuestion.isPending}
          className="text-destructive hover:text-destructive/80"
          aria-label="Delete question"
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </button>
      </div>

      {expanded && (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          {question.options.map((opt) => (
            <div
              key={opt.id}
              className={cn(
                'flex items-center gap-2 rounded-md border px-3 py-2 text-sm',
                opt.is_correct
                  ? 'border-success/40 bg-success/5'
                  : 'border-border bg-card',
              )}
            >
              <button
                type="button"
                onClick={() => toggleCorrect.mutate(opt)}
                className={cn(
                  'flex size-5 shrink-0 items-center justify-center rounded-sm border transition-colors',
                  opt.is_correct
                    ? 'border-success bg-success text-white'
                    : 'border-border bg-card text-muted-foreground hover:border-success/50',
                )}
                aria-label={opt.is_correct ? 'Mark incorrect' : 'Mark correct'}
              >
                {opt.is_correct && <CheckCircle className="size-3" aria-hidden="true" />}
              </button>
              <span className="min-w-0 flex-1 text-foreground">{opt.label}</span>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Delete this option?')) {
                    deleteOption.mutate(opt.id)
                  }
                }}
                disabled={deleteOption.isPending}
                className="text-muted-foreground hover:text-destructive"
                aria-label="Delete option"
              >
                <XCircle className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          ))}

          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e: FormEvent) => {
              e.preventDefault()
              if (!newOptionLabel.trim()) return
              addOption.mutate()
            }}
          >
            <label className="min-w-48 flex-1">
              <span className="text-xs font-medium text-muted-foreground">
                New option label
              </span>
              <Input
                required
                className="mt-1"
                value={newOptionLabel}
                onChange={(e) => setNewOptionLabel(e.target.value)}
                placeholder="e.g. Correct answer"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={newOptionCorrect}
                onChange={(e) => setNewOptionCorrect(e.target.checked)}
                className="size-4"
              />
              Correct
            </label>
            <Button type="submit" size="sm" loading={addOption.isPending} disabled={!newOptionLabel.trim()}>
              <Plus className="size-3.5" aria-hidden="true" /> Add option
            </Button>
          </form>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

// ── Assessment detail/edit view ──────────────────────────────────────────────

function AssessmentDetail({
  assessmentId,
  onBack,
}: {
  assessmentId: string
  onBack: () => void
}) {
  const queryClient = useQueryClient()
  const [editingMeta, setEditingMeta] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [passingScore, setPassingScore] = useState('')
  const [maxAttempts, setMaxAttempts] = useState('')
  const [newQuestionPrompt, setNewQuestionPrompt] = useState('')
  const [newQuestionType, setNewQuestionType] = useState('single_choice')
  const [error, setError] = useState<string | null>(null)

  const v = useFieldValidation<{ title: string }>({
    title: required('Title'),
  })

  const { data: assessment, isLoading } = useQuery({
    queryKey: queryKeys.admin.assessment(assessmentId),
    queryFn: () => api.get<AssessmentRow>(`/admin/assessments/${assessmentId}`).then((r) => r.data),
  })

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.admin.assessments() })
    void queryClient.invalidateQueries({ queryKey: queryKeys.admin.assessment(assessmentId) })
  }

  const saveMeta = useMutation({
    mutationFn: () =>
      api.patch<AssessmentRow>(`/admin/assessments/${assessmentId}`, {
        title: title || assessment?.title,
        description: description || null,
        passing_score: passingScore ? Number(passingScore) : undefined,
        max_attempts: maxAttempts ? Number(maxAttempts) : undefined,
      }),
    onSuccess: () => {
      setEditingMeta(false)
      invalidate()
    },
    onError: (e: unknown) => setError(readError(e)),
  })

  const togglePublish = useMutation({
    mutationFn: (published: boolean) =>
      api.post<AssessmentRow>(`/admin/assessments/${assessmentId}/publish`, { published }),
    onSuccess: () => invalidate(),
    onError: (e: unknown) => setError(readError(e)),
  })

  const addQuestion = useMutation({
    mutationFn: () =>
      api.post<AssessmentRow>(`/admin/assessments/${assessmentId}/questions`, {
        prompt: newQuestionPrompt,
        sort_order: assessment?.questions.length ?? 0,
        question_type: newQuestionType,
      }),
    onSuccess: () => {
      setNewQuestionPrompt('')
      invalidate()
    },
    onError: (e: unknown) => setError(readError(e)),
  })

  if (isLoading || !assessment) {
    return (
      <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading assessment…
      </p>
    )
  }

  const blockers = publishBlockers(assessment)

  return (
    /* `[FIXED 2026-08-25]` The detail view had no page padding of its own — it rendered
       flush against the viewport edge, unlike every other admin page and unlike the
       list view it replaces. Same container as AdminAssessments below. */
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> All assessments
      </button>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <PageTitle eyebrow="Assessment" title={assessment.title} />
          {/* Which course and module this belongs to — the detail view showed the quiz
              title alone, so "Final Assessment" gave no clue what it was attached to. */}
          <p className="mt-1 text-sm text-foreground">
            {assessment.course_title ?? 'Unknown course'}
            <span className="text-muted-foreground"> › </span>
            {assessment.module_title ?? 'Unknown module'}
          </p>
          {assessment.description && (
            <p className="mt-1 text-sm text-muted-foreground">{assessment.description}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={() => {
              // Unpublishing is always allowed — it is the safe direction. Publishing
              // is refused while the paper is unmarkable (see `publishBlockers`).
              if (!assessment.published && blockers.length > 0) return
              if (
                assessment.published &&
                assessment.attempt_count > 0 &&
                !window.confirm(
                  `${assessment.attempt_count} learner attempt${assessment.attempt_count !== 1 ? 's have' : ' has'} already been recorded. Unpublishing hides this assessment and blocks certificates for anyone who hasn't passed it yet. Continue?`,
                )
              ) {
                return
              }
              togglePublish.mutate(!assessment.published)
            }}
            disabled={togglePublish.isPending || (!assessment.published && blockers.length > 0)}
            title={
              !assessment.published && blockers.length > 0
                ? 'Resolve the issues below before publishing'
                : assessment.published
                  ? 'Unpublish this assessment'
                  : 'Publish this assessment'
            }
            className={cn(
              'inline-flex items-center gap-1 rounded-sm border px-2.5 py-1 text-xs font-medium transition-colors',
              'disabled:cursor-not-allowed disabled:opacity-60',
              assessment.published
                ? 'border-success/30 bg-success/12 text-success'
                : 'border-warning/30 bg-warning/12 text-warning',
            )}
          >
            {togglePublish.isPending ? (
              <Loader2 className="size-3 animate-spin" aria-hidden="true" />
            ) : assessment.published ? (
              <CheckCircle className="size-3" aria-hidden="true" />
            ) : (
              <XCircle className="size-3" aria-hidden="true" />
            )}
            {assessment.published ? 'Published' : 'Draft'}
          </button>
          <span className="text-xs text-muted-foreground">
            {assessment.attempt_count} attempt{assessment.attempt_count !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Readiness. Shown while the paper cannot be published, and as a confirmation
          once it can — an admin editing a live quiz needs to know the moment an edit
          makes it unmarkable, not at the next publish attempt. */}
      {blockers.length > 0 ? (
        <div className="mt-4 rounded-lg border border-warning/30 bg-warning/8 p-4">
          <p className="flex items-center gap-1.5 text-sm font-medium text-warning">
            <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
            {assessment.published
              ? 'This published assessment has problems'
              : 'Not ready to publish'}
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-8 text-sm text-foreground">
            {blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      ) : (
        !assessment.published && (
          <p className="mt-4 flex items-center gap-1.5 text-sm text-muted-foreground">
            <CheckCircle className="size-4 shrink-0 text-success" aria-hidden="true" />
            Ready to publish — {assessment.questions.length} question
            {assessment.questions.length !== 1 ? 's' : ''}, {assessment.passing_score}% to pass.
          </p>
        )
      )}

      {/* Metadata */}
      <div className="mt-6 rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground">Settings</h3>
          {!editingMeta && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setTitle(assessment.title)
                setDescription(assessment.description ?? '')
                setPassingScore(String(assessment.passing_score))
                setMaxAttempts(String(assessment.max_attempts))
                setEditingMeta(true)
              }}
            >
              Edit
            </Button>
          )}
        </div>
        {editingMeta ? (
          <form
            className="mt-3 space-y-3"
            onSubmit={(e: FormEvent) => {
              e.preventDefault()
              if (!v.validateAll({ title })) return
              saveMeta.mutate()
            }}
          >
            <label>
              <span className="text-xs font-medium text-muted-foreground">Title</span>
              <Input
                required
                className="mt-1"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => v.onBlur('title', title)}
                error={v.errorFor('title')}
              />
            </label>
            <label>
              <span className="text-xs font-medium text-muted-foreground">Description</span>
              <textarea
                className={cn(inputClass, 'mt-1')}
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <div className="flex flex-wrap gap-4">
              <label className="w-32">
                <span className="text-xs font-medium text-muted-foreground">Pass mark (%)</span>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  className="mt-1"
                  value={passingScore}
                  onChange={(e) => setPassingScore(e.target.value)}
                />
              </label>
              <label className="w-32">
                <span className="text-xs font-medium text-muted-foreground">Max attempts</span>
                <Input
                  type="number"
                  min={1}
                  className="mt-1"
                  value={maxAttempts}
                  onChange={(e) => setMaxAttempts(e.target.value)}
                />
              </label>
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" loading={saveMeta.isPending}>
                Save
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setEditingMeta(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-foreground">
            <span>
              Pass mark: <strong>{assessment.passing_score}%</strong>
            </span>
            <span>
              Max attempts: <strong>{assessment.max_attempts}</strong>
            </span>
            <span>
              Questions: <strong>{assessment.questions.length}</strong>
            </span>
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* Questions */}
      <div className="mt-6">
        <h3 className="text-sm font-medium text-foreground">Questions</h3>
        <div className="mt-3 flex flex-col gap-3">
          {assessment.questions
            .slice()
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((q) => (
              <QuestionEditor
                key={q.id}
                assessmentId={assessmentId}
                question={q}
                onRefresh={invalidate}
              />
            ))}
        </div>

        {/* Add question form */}
        <form
          className="mt-4 flex flex-wrap items-end gap-3 rounded-md border border-dashed border-border p-3"
          onSubmit={(e: FormEvent) => {
            e.preventDefault()
            if (!newQuestionPrompt.trim()) return
            addQuestion.mutate()
          }}
        >
          <label className="min-w-64 flex-1">
            <span className="text-xs font-medium text-muted-foreground">New question prompt</span>
            <Input
              required
              className="mt-1"
              value={newQuestionPrompt}
              onChange={(e) => setNewQuestionPrompt(e.target.value)}
              placeholder="e.g. What is the capital of France?"
            />
          </label>
          <label>
            <span className="text-xs font-medium text-muted-foreground">Type</span>
            <select
              className={cn(inputClass, 'mt-1 w-auto')}
              value={newQuestionType}
              onChange={(e) => setNewQuestionType(e.target.value)}
            >
              <option value="single_choice">Single choice</option>
              <option value="multi_choice">Multi choice</option>
            </select>
          </label>
          <Button type="submit" size="sm" loading={addQuestion.isPending} disabled={!newQuestionPrompt.trim()}>
            <Plus className="size-3.5" aria-hidden="true" /> Add question
          </Button>
        </form>
      </div>
    </div>
  )
}

// ── Main list view ───────────────────────────────────────────────────────────

export function AdminAssessments() {
  const queryClient = useQueryClient()
  const [isCreating, setIsCreating] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [selectedModuleId, setSelectedModuleId] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [newPassingScore, setNewPassingScore] = useState('70')
  const [newMaxAttempts, setNewMaxAttempts] = useState('3')
  const [error, setError] = useState<string | null>(null)

  const v = useFieldValidation<{ title: string; moduleId: string }>({
    title: required('Title'),
    moduleId: required('Module'),
  })

  const { data: assessments, isLoading } = useQuery({
    queryKey: queryKeys.admin.assessments(),
    queryFn: () => api.get<AssessmentRow[]>('/admin/assessments').then((r) => r.data),
  })

  const { data: courses } = useQuery({
    queryKey: queryKeys.admin.courses(),
    queryFn: () => api.get<CourseOption[]>('/admin/courses').then((r) => r.data),
  })

  // Fetch modules for selected course
  const { data: modules } = useQuery({
    queryKey: ['admin', 'modules', selectedCourseId] as const,
    queryFn: () => api.get<ModuleOption[]>(`/admin/courses/${selectedCourseId}`).then((r) => {
      const course = r.data as unknown as { title: string; modules?: Array<{ id: string; title: string }> };
      return (course.modules ?? []).map((m) => ({ ...m, course_id: selectedCourseId, course_title: course.title }));
    }),
    enabled: !!selectedCourseId,
  })

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.admin.assessments() })
  }

  const createAssessment = useMutation({
    mutationFn: () =>
      api.post<AssessmentRow>('/admin/assessments', {
        module_id: selectedModuleId,
        title: newTitle,
        passing_score: Number(newPassingScore) || 70,
        max_attempts: Number(newMaxAttempts) || 3,
      }),
    onSuccess: (r) => {
      setIsCreating(false)
      setSelectedCourseId('')
      setSelectedModuleId('')
      setNewTitle('')
      setNewPassingScore('70')
      setNewMaxAttempts('3')
      setError(null)
      v.reset()
      invalidate()
      setDetailId(r.data.id)
    },
    onError: (e: unknown) => setError(readError(e)),
  })

  const deleteAssessment = useMutation({
    mutationFn: ({ id, force }: { id: string; force: boolean }) =>
      api.delete(`/admin/assessments/${id}${force ? '?force=true' : ''}`),
    onSuccess: () => {
      setError(null)
      invalidate()
    },
    onError: (e: unknown) => setError(readError(e)),
  })

  /**
   * Two-step delete. The first call omits `force`, so the API refuses with 409
   * `assessment_has_attempts` if learners have already sat the quiz — deleting it would
   * erase their attempts and can withdraw certificates that a passing attempt earned.
   * Only then do we ask a second, specific question naming that consequence.
   *
   * The client never decides this on its own: `attempt_count` is in the row, but the
   * server is the thing that actually knows, and it is the server that enforces it.
   */
  const handleDelete = async (a: AssessmentRow) => {
    if (!window.confirm(`Delete "${a.title}"? Its questions and options go with it.`)) return
    try {
      await deleteAssessment.mutateAsync({ id: a.id, force: false })
    } catch (e: unknown) {
      const message = readError(e)
      if (!message.toLowerCase().includes('attempt')) return
      if (
        window.confirm(
          `${message}\n\nDelete "${a.title}" anyway, including ${a.attempt_count} learner attempt(s)?`,
        )
      ) {
        deleteAssessment.mutate({ id: a.id, force: true })
      }
    }
  }

  if (detailId) {
    return <AssessmentDetail assessmentId={detailId} onBack={() => setDetailId(null)} />
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        {/* `[FIXED 2026-08-25]` Said "One quiz per course", which stopped being true at
            migration 038 — assessments have been per-module since. An admin reading
            this would look for a course-level quiz that no longer exists. */}
        <PageTitle
          eyebrow="Content"
          title="Assessments"
          description="One quiz per module — pass mark, attempt cap, and publish toggle. A learner must pass every published assessment in a course before its certificate is issued."
        />
        {!isCreating && (
          <Button onClick={() => setIsCreating(true)}>
            <Plus className="size-4" aria-hidden="true" /> New assessment
          </Button>
        )}
      </div>

      {isCreating && (
        <form
          className="mt-6 rounded-lg border border-border bg-card p-5 shadow-sm"
          onSubmit={(e: FormEvent) => {
            e.preventDefault()
            if (!v.validateAll({ title: newTitle, moduleId: selectedModuleId })) return
            createAssessment.mutate()
          }}
        >
          <h3 className="font-sans text-base font-semibold text-foreground">
            Create assessment
          </h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">              <label className="sm:col-span-2">
              <span className="text-xs font-medium text-muted-foreground">Course</span>
              <select
                required
                className={cn(inputClass, 'mt-1')}
                value={selectedCourseId}
                onChange={(e) => {
                  setSelectedCourseId(e.target.value)
                  setSelectedModuleId('')
                }}
              >
                <option value="" disabled>
                  Choose a course
                </option>
                {(courses ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="sm:col-span-2">
              <span className="text-xs font-medium text-muted-foreground">Module</span>
              <select
                required
                className={cn(inputClass, 'mt-1')}
                value={selectedModuleId}
                onChange={(e) => setSelectedModuleId(e.target.value)}
                onBlur={() => v.onBlur('moduleId', selectedModuleId)}
                disabled={!selectedCourseId}
              >
                <option value="" disabled>
                  {selectedCourseId ? 'Choose a module' : 'Select a course first'}
                </option>
                {(modules ?? []).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>
              <FieldError message={v.errorFor('moduleId')} />
            </label>
            <label className="sm:col-span-2">
              <span className="text-xs font-medium text-muted-foreground">Title</span>
              <Input
                required
                className="mt-1"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onBlur={() => v.onBlur('title', newTitle)}
                error={v.errorFor('title')}
                placeholder="e.g. Final Assessment"
              />
            </label>
            <label>
              <span className="text-xs font-medium text-muted-foreground">Pass mark (%)</span>
              <Input
                type="number"
                min={0}
                max={100}
                className="mt-1"
                value={newPassingScore}
                onChange={(e) => setNewPassingScore(e.target.value)}
              />
            </label>
            <label>
              <span className="text-xs font-medium text-muted-foreground">Max attempts</span>
              <Input
                type="number"
                min={1}
                className="mt-1"
                value={newMaxAttempts}
                onChange={(e) => setNewMaxAttempts(e.target.value)}
              />
            </label>
          </div>
          {error && (
            <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>
          )}
          <div className="mt-4 flex gap-2">
            <Button type="submit" loading={createAssessment.isPending}>
              Create
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setIsCreating(false)
                setError(null)
                v.reset()
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {isLoading ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading assessments…
        </p>
      ) : !assessments?.length ? (
        <div className="mt-12 text-center">
          <p className="text-sm text-muted-foreground">
            No assessments yet. Create one to gate certificates on a quiz.
          </p>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {assessments.map((a) => {
            const rowBlockers = publishBlockers(a)
            return (
            <div
              key={a.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4 shadow-sm transition-colors hover:bg-muted/30"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDetailId(a.id)}
                    className="truncate text-sm font-medium text-foreground hover:underline"
                  >
                    {a.title}
                  </button>
                  {a.published ? (
                    <Badge variant="success">Published</Badge>
                  ) : (
                    <Badge variant="muted">Draft</Badge>
                  )}
                  {/* The list is where an admin scans for what still needs work, so the
                      readiness state belongs here and not only inside the detail view. */}
                  {rowBlockers.length > 0 && (
                    <Badge variant="warning">
                      {rowBlockers.length} issue{rowBlockers.length !== 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
                {/* `[ADDED 2026-08-25, owner direction]` Where this assessment lives.
                    Every row used to read the literal words "Module assessment", so with
                    several courses each holding a "Final Assessment" the list gave no way
                    to tell them apart. */}
                <p className="mt-1 text-xs text-foreground">
                  {a.course_title ?? 'Unknown course'}
                  <span className="text-muted-foreground"> › </span>
                  {a.module_title ?? 'Unknown module'}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {a.questions.length} question{a.questions.length !== 1 ? 's' : ''}
                  {' · '}
                  {a.passing_score}% pass · {a.max_attempts} attempts max
                  {a.attempt_count > 0 && ` · ${a.attempt_count} attempt${a.attempt_count !== 1 ? 's' : ''}`}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDetailId(a.id)}
              >
                Edit
              </Button>
              <button
                type="button"
                onClick={() => handleDelete(a)}
                disabled={deleteAssessment.isPending}
                className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                aria-label={`Delete ${a.title}`}
                title="Delete assessment"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
