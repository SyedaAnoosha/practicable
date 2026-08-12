import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Loader2, Plus, Search, X } from 'lucide-react'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { PageTitle } from '@/components/ui/PageTitle'

interface QuestionRow {
  id: string
  slug: string
  title: string
  subtitle?: string | null
  domain: string
  published: boolean
  preview: string
}

interface QuestionDetail extends QuestionRow {
  body: string
  domain_id: string
  tags: Record<string, string>
  leadership_trait_ids: string[]
}

interface TagOption {
  id: string
  value: string
  display_label: string
  sort_order: number
}

interface FormOptions {
  domains: { id: string; name: string }[]
  tag_dimensions: Record<string, TagOption[]>
}

// The six single-select dimensions, in the order the spec lists them. Leadership
// traits is the seventh and is multi-select, handled separately below.
const SINGLE_SELECT: { key: string; label: string }[] = [
  { key: 'effort', label: 'Effort' },
  { key: 'duration', label: 'Duration' },
  { key: 'cost', label: 'Cost' },
  { key: 'roi_horizon', label: 'ROI horizon' },
  { key: 'tier', label: 'Tier' },
  { key: 'regulator_pressure', label: 'Regulator pressure' },
]

const EMPTY_DRAFT = {
  title: '',
  subtitle: '',
  body: '',
  preview: '',
  domain_id: '',
  tags: {} as Record<string, string>,
  leadership_trait_ids: [] as string[],
}

type Draft = typeof EMPTY_DRAFT

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {hint && <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>}
      <div className="mt-1.5">{children}</div>
    </label>
  )
}

const selectClass =
  'w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

/** Add or edit a question — the 7-tag taxonomy as a form, so growing the catalogue
 * stops requiring a hand-written SQL seed file. */
function QuestionEditor({
  draft,
  setDraft,
  options,
  onSubmit,
  onCancel,
  isSaving,
  error,
  isNew,
}: {
  draft: Draft
  setDraft: (d: Draft) => void
  options: FormOptions
  onSubmit: (e: FormEvent) => void
  onCancel: () => void
  isSaving: boolean
  error: string | null
  isNew: boolean
}) {
  const traits = options.tag_dimensions['leadership_traits'] ?? []

  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h2 className="font-sans text-lg font-semibold">{isNew ? 'New question' : 'Edit question'}</h2>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Title">
            <Input
              required
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="We Have a Risk Register, But No One Uses It"
            />
          </Field>
        </div>

        <div className="sm:col-span-2">
          <Field label="Subtitle" hint="The question itself, phrased as a question.">
            <Input
              value={draft.subtitle}
              onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })}
              placeholder="How do you make a risk register that people actually use?"
            />
          </Field>
        </div>

        <Field label="Domain">
          <select
            required
            className={selectClass}
            value={draft.domain_id}
            onChange={(e) => setDraft({ ...draft, domain_id: e.target.value })}
          >
            <option value="">Choose a domain…</option>
            {options.domains.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Preview"
          hint={`Optional — derived from the body if left blank. ${draft.preview.length}/160`}
        >
          <Input
            maxLength={160}
            value={draft.preview}
            onChange={(e) => setDraft({ ...draft, preview: e.target.value })}
            placeholder="One-sentence answer, shown on cards and in search."
          />
        </Field>

        <div className="sm:col-span-2">
          <Field label="Guidance" hint="The full written answer. This is free for everyone to read.">
            <textarea
              required
              rows={12}
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              className={cn(selectClass, 'font-serif leading-relaxed')}
              placeholder="Most risk registers fail because…"
            />
          </Field>
        </div>
      </div>

      <fieldset className="mt-6 border-t border-border pt-5">
        <legend className="sr-only">Tags</legend>
        <p className="text-sm font-medium text-foreground">Tags</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          These drive the whole filter system — a question with no tags can't be found by anyone
          browsing by effort or cost.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SINGLE_SELECT.map(({ key, label }) => (
            <Field key={key} label={label}>
              <select
                className={selectClass}
                value={draft.tags[key] ?? ''}
                onChange={(e) => {
                  const next = { ...draft.tags }
                  if (e.target.value) next[key] = e.target.value
                  else delete next[key]
                  setDraft({ ...draft, tags: next })
                }}
              >
                <option value="">—</option>
                {(options.tag_dimensions[key] ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.display_label}
                  </option>
                ))}
              </select>
            </Field>
          ))}
        </div>

        {traits.length > 0 && (
          <div className="mt-5">
            <p className="text-sm font-medium text-foreground">Leadership traits</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              The one multi-select dimension — pick any that apply.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {traits.map((t) => {
                const active = draft.leadership_trait_ids.includes(t.id)
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        leadership_trait_ids: active
                          ? draft.leadership_trait_ids.filter((id) => id !== t.id)
                          : [...draft.leadership_trait_ids, t.id],
                      })
                    }
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-xs transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                      active
                        ? 'border-accent bg-accent text-accent-foreground'
                        : 'border-border text-muted-foreground hover:border-accent hover:text-accent',
                    )}
                  >
                    {t.display_label}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </fieldset>

      {error && (
        <p role="alert" className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-5">
        <Button type="submit" loading={isSaving}>
          {isNew ? 'Create question' : 'Save changes'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        {isNew && (
          <p className="w-full text-xs text-muted-foreground">
            New questions are created unpublished — nothing appears on the site until you publish it.
          </p>
        )}
      </div>
    </form>
  )
}

export function AdminQuestions() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [publishedFilter, setPublishedFilter] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [error, setError] = useState<string | null>(null)

  const { data: options } = useQuery({
    queryKey: queryKeys.admin.questionFormOptions(),
    queryFn: () => api.get<FormOptions>('/admin/questions/form-options').then((r) => r.data),
  })

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.admin.questions(search, publishedFilter),
    queryFn: () =>
      api
        .get<{ items: QuestionRow[]; total: number }>('/admin/questions', {
          params: {
            ...(search ? { search } : {}),
            ...(publishedFilter ? { published: publishedFilter === 'published' } : {}),
          },
        })
        .then((r) => r.data),
  })

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'questions'] })
    // The public catalogue is a different cache entry and would otherwise keep
    // showing pre-edit content until it expired on its own.
    void queryClient.invalidateQueries({ queryKey: ['questions'] })
  }

  // Axios puts the server's error envelope on response.data; surfacing its message is
  // what makes the "you used a duration value as effort" validation actually useful.
  const readError = (e: unknown): string => {
    const detail = (e as { response?: { data?: { detail?: { error?: { message?: string } } } } })?.response?.data
      ?.detail
    return detail?.error?.message ?? 'Something went wrong. Please try again.'
  }

  const buildPayload = (d: Draft) => ({
    title: d.title,
    subtitle: d.subtitle || null,
    body: d.body,
    preview: d.preview || null,
    domain_id: d.domain_id,
    tags: d.tags,
    leadership_trait_ids: d.leadership_trait_ids,
  })

  const createMutation = useMutation({
    mutationFn: () => api.post('/admin/questions', buildPayload(draft)),
    onSuccess: () => {
      setIsCreating(false)
      setDraft(EMPTY_DRAFT)
      setError(null)
      invalidate()
    },
    onError: (e) => setError(readError(e)),
  })

  const updateMutation = useMutation({
    mutationFn: () => api.put(`/admin/questions/${editingId}`, buildPayload(draft)),
    onSuccess: () => {
      setEditingId(null)
      setDraft(EMPTY_DRAFT)
      setError(null)
      invalidate()
    },
    onError: (e) => setError(readError(e)),
  })

  const publishMutation = useMutation({
    mutationFn: ({ id, published }: { id: string; published: boolean }) =>
      api.post(`/admin/questions/${id}/publish`, { published }),
    onSuccess: invalidate,
    onError: (e) => setError(readError(e)),
  })

  const startEditing = async (id: string) => {
    setError(null)
    const detail = await api.get<QuestionDetail>(`/admin/questions/${id}`).then((r) => r.data)
    setDraft({
      title: detail.title,
      subtitle: detail.subtitle ?? '',
      body: detail.body,
      preview: detail.preview ?? '',
      domain_id: detail.domain_id,
      tags: detail.tags,
      leadership_trait_ids: detail.leadership_trait_ids,
    })
    setEditingId(id)
    setIsCreating(false)
  }

  const showEditor = isCreating || editingId !== null

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageTitle
          eyebrow="Content editor"
          title="Questions"
          description="The reference library. Add, edit, tag and publish — no code required."
        />
        {!showEditor && (
          <Button
            onClick={() => {
              setDraft(EMPTY_DRAFT)
              setIsCreating(true)
              setError(null)
            }}
          >
            <Plus className="size-4" aria-hidden="true" /> New question
          </Button>
        )}
      </div>

      {showEditor && options && (
        <div className="mt-8">
          <QuestionEditor
            draft={draft}
            setDraft={setDraft}
            options={options}
            isNew={isCreating}
            isSaving={createMutation.isPending || updateMutation.isPending}
            error={error}
            onCancel={() => {
              setIsCreating(false)
              setEditingId(null)
              setDraft(EMPTY_DRAFT)
              setError(null)
            }}
            onSubmit={(e) => {
              e.preventDefault()
              setError(null)
              if (isCreating) createMutation.mutate()
              else updateMutation.mutate()
            }}
          />
        </div>
      )}

      {!showEditor && (
        <>
          <form
            className="mt-8 flex flex-wrap items-center gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              setSearch(searchInput)
            }}
          >
            <div className="relative min-w-64 flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search titles…"
                className="pl-9"
                aria-label="Search questions"
              />
            </div>
            <select
              className={cn(selectClass, 'w-auto')}
              value={publishedFilter}
              onChange={(e) => setPublishedFilter(e.target.value)}
              aria-label="Filter by publish state"
            >
              <option value="">All</option>
              <option value="published">Published</option>
              <option value="draft">Drafts</option>
            </select>
            <Button type="submit" variant="outline">
              Search
            </Button>
          </form>

          {isLoading ? (
            <p className="mt-10 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading questions…
            </p>
          ) : (
            <>
              <p className="mt-6 text-sm text-muted-foreground">
                Showing {data?.items.length ?? 0} of {data?.total ?? 0}
              </p>
              <ul className="mt-3 flex flex-col divide-y divide-border border-t border-border">
                {data?.items.map((q) => (
                  <li key={q.id} className="flex flex-wrap items-center gap-4 py-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-sans font-medium text-foreground">{q.title}</p>
                        {q.published ? (
                          <Badge variant="success">Live</Badge>
                        ) : (
                          <Badge variant="muted">Draft</Badge>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{q.domain}</p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button size="sm" variant="outline" onClick={() => void startEditing(q.id)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant={q.published ? 'ghost' : 'primary'}
                        loading={publishMutation.isPending && publishMutation.variables?.id === q.id}
                        onClick={() => publishMutation.mutate({ id: q.id, published: !q.published })}
                      >
                        {q.published ? (
                          <>
                            <X className="size-4" aria-hidden="true" /> Unpublish
                          </>
                        ) : (
                          <>
                            <Check className="size-4" aria-hidden="true" /> Publish
                          </>
                        )}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
              {data?.items.length === 0 && (
                <p className="mt-8 text-sm text-muted-foreground">No questions match that search.</p>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
