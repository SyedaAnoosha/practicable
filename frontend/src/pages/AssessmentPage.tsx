import { useCallback, useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  FileText,
  Info,
  Trophy,
  XCircle,
} from 'lucide-react'
import { api } from '@/lib/api/client'
import { cn } from '@/lib/utils/cn'
import { readError } from '@/lib/utils/readError'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'

// ── Types matching backend API shapes ────────────────────────────────────────

interface AssessmentOption {
  id: string
  label: string
  sort_order: number
}

interface AssessmentQuestion {
  id: string
  prompt: string
  sort_order: number
  question_type: string
  options: AssessmentOption[]
}

interface AssessmentPaper {
  id: string
  module_id: string
  course_slug: string
  title: string
  description: string | null
  passing_score: number
  max_attempts: number
  questions: AssessmentQuestion[]
  attempts_used: number
  attempts_remaining: number
  passed: boolean
}

interface AttemptResult {
  id: string
  attempt_number: number
  score: number
  passed: boolean
  submitted_at: string
  attempts_remaining: number
}

interface AttemptHistory {
  id: string
  attempt_number: number
  score: number
  passed: boolean
  submitted_at: string
  attempts_remaining: number
}

// ── Question card ────────────────────────────────────────────────────────────

function QuestionCard({
  question,
  selected,
  onChange,
  disabled,
}: {
  question: AssessmentQuestion
  selected: string[]
  onChange: (optionIds: string[]) => void
  disabled: boolean
}) {
  const isMulti = question.question_type === 'multi_choice'

  const toggle = (optionId: string) => {
    if (disabled) return
    if (isMulti) {
      onChange(
        selected.includes(optionId)
          ? selected.filter((id) => id !== optionId)
          : [...selected, optionId],
      )
    } else {
      onChange([optionId])
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
          {question.sort_order + 1}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-relaxed text-foreground">
            {question.prompt}
          </p>
          {isMulti && (
            <p className="mt-1 text-xs text-muted-foreground">
              Select all that apply
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {question.options.map((opt) => {
          const isSelected = selected.includes(opt.id)
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => toggle(opt.id)}
              disabled={disabled}
              className={cn(
                'flex items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-all duration-150',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                isSelected
                  ? 'border-primary bg-primary/5 text-foreground ring-1 ring-primary/30'
                  : 'border-border bg-background text-foreground hover:border-border-strong hover:bg-muted/30',
                disabled && 'cursor-default opacity-70',
              )}
            >
              {/* Radio or checkbox indicator */}
              <span
                className={cn(
                  'flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                  isSelected
                    ? 'border-primary bg-primary'
                    : 'border-border',
                )}
                aria-hidden="true"
              >
                {isSelected && (
                  isMulti ? (
                    <CheckCircle className="size-3 text-white" />
                  ) : (
                    <span className="size-2 rounded-full bg-white" />
                  )
                )}
              </span>
              <span className="flex-1">{opt.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Attempt history ──────────────────────────────────────────────────────────

function AttemptHistoryList({ attempts }: { attempts: AttemptHistory[] }) {
  if (attempts.length === 0) return null

  return (
    <div className="mt-8">
      <h3 className="text-sm font-medium text-foreground">Previous attempts</h3>
      <div className="mt-3 flex flex-col gap-2">
        {attempts.map((a) => (
          <div
            key={a.id}
            className={cn(
              'flex items-center gap-3 rounded-lg border px-4 py-3',
              a.passed
                ? 'border-success/30 bg-success/5'
                : 'border-border bg-card',
            )}
          >
            {a.passed ? (
              <CheckCircle className="size-4 shrink-0 text-success" aria-hidden="true" />
            ) : (
              <XCircle className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm text-foreground">
                Attempt {a.attempt_number} —{' '}
                <span className={cn('font-semibold', a.passed ? 'text-success' : 'text-foreground')}>
                  {a.score}%
                </span>
                {a.passed && <span className="ml-2 text-success">Passed</span>}
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(a.submitted_at).toLocaleDateString('en-AU', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
            <span className="text-xs text-muted-foreground">
              {a.attempts_remaining} attempt{a.attempts_remaining !== 1 ? 's' : ''} left
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main assessment page ─────────────────────────────────────────────────────

export default function AssessmentPage() {
  const { moduleId } = useParams<{ moduleId: string }>()
  const queryClient = useQueryClient()

  // Quiz state
  const [answers, setAnswers] = useState<Record<string, string[]>>({})
  const [submitted, setSubmitted] = useState<AttemptResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Fetch assessment paper
  const { data: assessment, isLoading, error: fetchError } = useQuery({
    queryKey: ['assessment', 'paper', moduleId] as const,
    queryFn: () =>
      api.get<AssessmentPaper>(`/modules/${moduleId}/assessment`).then((r) => r.data),
    enabled: !!moduleId,
  })

  // Fetch attempt history
  const { data: attempts } = useQuery({
    queryKey: ['assessment', 'attempts', moduleId] as const,
    queryFn: () =>
      api.get<AttemptHistory[]>(`/modules/${moduleId}/assessment/attempts`).then((r) => r.data),
    enabled: !!moduleId,
  })

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: () => {
      const payload = {
        answers: Object.entries(answers).map(([question_id, option_ids]) => ({
          question_id,
          option_ids,
        })),
      }
      return api
        .post<AttemptResult>(`/modules/${moduleId}/assessment/attempts`, payload)
        .then((r) => r.data)
    },
    onSuccess: (result) => {
      setSubmitted(result)
      setError(null)
      // Refresh the paper (attempts_used/remaining changed) and history
      void queryClient.invalidateQueries({ queryKey: ['assessment', 'paper', moduleId] })
      void queryClient.invalidateQueries({ queryKey: ['assessment', 'attempts', moduleId] })
    },
    onError: (e: unknown) => {
      setError(readError(e))
    },
  })

  const totalAnswered = useMemo(
    () => Object.values(answers).filter((ids) => ids.length > 0).length,
    [answers],
  )

  const allAnswered = assessment && totalAnswered === assessment.questions.length

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault()
      setError(null)
      submitMutation.mutate()
    },
    [submitMutation],
  )

  const handleRetake = useCallback(() => {
    setAnswers({})
    setSubmitted(null)
    setError(null)
  }, [])

  // ── Loading / error states ────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-label="Loading assessment">
        <div className="size-8 animate-spin rounded-full border-2 border-border border-t-primary" />
        <span className="sr-only">Loading assessment…</span>
      </div>
    )
  }

  if (fetchError) {
    const notFound = isAxiosError(fetchError) && fetchError.response?.status === 404
    const noAssessment =
      isAxiosError(fetchError) &&
      fetchError.response?.data?.detail?.error?.code === 'no_assessment'
    return (
      <div className="mx-auto w-full max-w-2xl px-5 py-11 sm:px-8">
        <EmptyState
          title={
            noAssessment
              ? 'No assessment for this module'
              : notFound
                ? "We couldn't find this assessment."
                : "We couldn't load this assessment."
          }
          description={
            noAssessment
              ? 'This module does not have a published assessment yet.'
              : notFound
                ? 'It may have been unpublished or removed.'
                : 'Check your connection and try again.'
          }
          action={
            <Button variant="outline" onClick={() => window.history.back()}>
              <ArrowLeft className="size-4" aria-hidden="true" /> Go back
            </Button>
          }
        />
      </div>
    )
  }

  if (!assessment) return null

  // ── Already passed ──────────────────────────────────────────────────────

  if (assessment.passed) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-11 sm:px-8">
        <Link
          to={`/courses/${assessment.course_slug}`}
          className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" /> Back to course
        </Link>

        <div className="mt-8 rounded-xl border border-success/30 bg-success/5 p-8 text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-success/10">
            <Trophy className="size-7 text-success" aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-h3 font-semibold text-foreground">Assessment passed!</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You've already passed this assessment. If you've completed all lessons,
            your certificate is ready.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to={`/courses/${assessment.course_slug}`}>
              <Button variant="outline">Back to course</Button>
            </Link>
          </div>
        </div>

        <AttemptHistoryList attempts={attempts ?? []} />
      </div>
    )
  }

  // ── Result screen ───────────────────────────────────────────────────────

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-11 sm:px-8">
        <Link
          to={`/courses/${assessment.course_slug}`}
          className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" /> Back to course
        </Link>

        <div
          className={cn(
            'mt-8 rounded-xl border p-8 text-center',
            submitted.passed
              ? 'border-success/30 bg-success/5'
              : 'border-warning/30 bg-warning/5',
          )}
        >
          {submitted.passed ? (
            <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-success/10">
              <CheckCircle className="size-7 text-success" aria-hidden="true" />
            </span>
          ) : (
            <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-warning/10">
              <Info className="size-7 text-warning" aria-hidden="true" />
            </span>
          )}

          <h1 className="mt-4 text-h3 font-semibold text-foreground">
            {submitted.passed ? 'Well done!' : 'Not quite there yet'}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You scored{' '}
            <span className={cn('font-semibold', submitted.passed ? 'text-success' : 'text-foreground')}>
              {submitted.score}%
            </span>{' '}
            (pass mark: {assessment.passing_score}%)
          </p>

          {submitted.passed ? (
            <p className="mt-3 text-sm text-success">
              You've passed the assessment! If you've completed all lessons,
              your certificate should be ready.
            </p>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              {submitted.attempts_remaining > 0
                ? `You have ${submitted.attempts_remaining} attempt${submitted.attempts_remaining !== 1 ? 's' : ''} remaining.`
                : 'No attempts remaining.'}
            </p>
          )}

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {submitted.attempts_remaining > 0 && !submitted.passed && (
              <Button onClick={handleRetake}>Try again</Button>
            )}
            <Link to={`/courses/${assessment.course_slug}`}>
              <Button variant="outline">Back to course</Button>
            </Link>
          </div>
        </div>

        <AttemptHistoryList attempts={attempts ?? []} />
      </div>
    )
  }

  // ── Quiz form ───────────────────────────────────────────────────────────

  // No attempts remaining
  if (assessment.attempts_remaining <= 0) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-11 sm:px-8">
        <Link
          to={`/courses/${assessment.course_slug}`}
          className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" /> Back to course
        </Link>

        <div className="mt-8 rounded-xl border border-border bg-card p-8 text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-muted">
            <Clock className="size-7 text-muted-foreground" aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-h3 font-semibold text-foreground">No attempts remaining</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You've used all {assessment.max_attempts} attempts for this assessment.
          </p>
          <div className="mt-6">
            <Link to={`/courses/${assessment.course_slug}`}>
              <Button variant="outline">Back to course</Button>
            </Link>
          </div>
        </div>

        <AttemptHistoryList attempts={attempts ?? []} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-11 sm:px-8">
      <Link
        to={`/courses/${assessment.course_slug}`}
        className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> Back to course
      </Link>

      {/* Header */}
      <div className="mt-6">
        <div className="flex items-center gap-2">
          <FileText className="size-5 text-primary" aria-hidden="true" />
          <h1 className="text-h2 font-semibold text-foreground">{assessment.title}</h1>
        </div>
        {assessment.description && (
          <p className="mt-2 font-serif text-read text-pretty text-muted-foreground">
            {assessment.description}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-3 text-sm text-muted-foreground">
          <span>
            Pass mark: <strong className="text-foreground">{assessment.passing_score}%</strong>
          </span>
          <span>·</span>
          <span>
            {assessment.questions.length} question{assessment.questions.length !== 1 ? 's' : ''}
          </span>
          <span>·</span>
          <span>
            {assessment.attempts_remaining} of {assessment.max_attempts} attempts remaining
          </span>
        </div>
      </div>

      {/* Quiz form */}
      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
        {assessment.questions
          .slice()
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((q) => (
            <QuestionCard
              key={q.id}
              question={q}
              selected={answers[q.id] ?? []}
              onChange={(ids) => setAnswers((prev) => ({ ...prev, [q.id]: ids }))}
              disabled={submitMutation.isPending}
            />
          ))}

        {error && (
          <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {/* Submit bar */}
        <div className="sticky bottom-0 z-10 flex items-center justify-between gap-4 border-t border-border bg-background/95 px-1 py-4 backdrop-blur-sm">
          <p className="text-sm text-muted-foreground">
            {totalAnswered} of {assessment.questions.length} answered
          </p>
          <Button
            type="submit"
            loading={submitMutation.isPending}
            disabled={!allAnswered || submitMutation.isPending}
          >
            {submitMutation.isPending ? 'Submitting…' : 'Submit answers'}
          </Button>
        </div>
      </form>

      <AttemptHistoryList attempts={attempts ?? []} />
    </div>
  )
}
