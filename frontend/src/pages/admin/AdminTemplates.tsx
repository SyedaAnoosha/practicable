import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Loader2, Plus, Upload } from 'lucide-react'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { PageTitle } from '@/components/ui/PageTitle'
import { FieldError } from '@/components/ui/FieldError'
import { required, useFieldValidation } from '@/lib/useFieldValidation'
import { UploadField } from '@/components/admin/UploadField'
import { PublishStateChip, type PublishStateValue } from '@/components/admin/PublishStateChip'

// Kept in sync by hand with ALLOWED_MIME_TYPES in backend/app/api/v1/admin/templates.py.
const ACCEPTED_TEMPLATE_TYPES = '.xlsx,.xls,.docx,.doc,.pptx,.ppt,.pdf,.csv,.zip'
const MAX_TEMPLATE_BYTES = 25 * 1024 * 1024

interface TemplateRow {
  id: string
  slug: string
  title: string
  description: string
  file_name: string
  file_size_bytes: number
  mime_type: string
  published: boolean
  publish_state: PublishStateValue
  is_free: boolean
  has_file: boolean
}

const inputClass =
  'w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

function formatBytes(bytes: number): string {
  if (bytes === 0) return '—'
  const units = ['B', 'KB', 'MB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`
}

export function AdminTemplates() {
  const queryClient = useQueryClient()
  const [isCreating, setIsCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isFree, setIsFree] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Which row's UploadField is expanded — one at a time, collapsed back to the
  // compact row view once a file lands (week3_plan.md Phase 5 step 2/3).
  const [uploadRowId, setUploadRowId] = useState<string | null>(null)

  // week2_plan.md §20.8 / W2-R9 — blur, not submit.
  const v = useFieldValidation<{ title: string; description: string }>({
    title: required('Title'),
    description: required('Description'),
  })

  const { data: templates, isLoading } = useQuery({
    queryKey: queryKeys.admin.templates(),
    queryFn: () => api.get<TemplateRow[]>('/admin/templates').then((r) => r.data),
  })

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.admin.templates() })
    void queryClient.invalidateQueries({ queryKey: queryKeys.templates.list() })
  }

  const readError = (e: unknown): string => {
    const detail = (e as { response?: { data?: { detail?: { error?: { message?: string } } } } })?.response?.data
      ?.detail
    return detail?.error?.message ?? 'Something went wrong. Please try again.'
  }

  const reset = () => {
    setIsCreating(false)
    setEditingId(null)
    setTitle('')
    setDescription('')
    setIsFree(false)
    setError(null)
    v.reset()
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      editingId
        ? api.put(`/admin/templates/${editingId}`, { title, description, is_free: isFree })
        : api.post('/admin/templates', { title, description, is_free: isFree }),
    onSuccess: () => {
      reset()
      invalidate()
    },
    onError: (e) => setError(readError(e)),
  })

  const setPublishState = useMutation({
    mutationFn: ({ id, state }: { id: string; state: PublishStateValue }) =>
      api.post(`/admin/templates/${id}/publish`, { published: state === 'published', publish_state: state }),
    onSuccess: invalidate,
    onError: (e) => setError(readError(e)),
  })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!v.validateAll({ title, description })) return
    setError(null)
    saveMutation.mutate()
  }

  const showEditor = isCreating || editingId !== null

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageTitle
          eyebrow="Content editor"
          title="Templates"
          description="Standalone downloadable artefacts, sold on their own. Create the entry, upload the file, then publish."
        />
        {!showEditor && (
          <Button
            onClick={() => {
              setTitle('')
              setDescription('')
              setIsCreating(true)
              setError(null)
              v.reset()
            }}
          >
            <Plus className="size-4" aria-hidden="true" /> New template
          </Button>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-6 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {showEditor && (
        <form onSubmit={onSubmit} className="mt-8 rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="font-sans text-lg font-semibold">{editingId ? 'Edit template' : 'New template'}</h2>
          <div className="mt-5 flex flex-col gap-5">
            <label className="block">
              <span className="text-sm font-medium">Title</span>
              <Input
                required
                className="mt-1.5"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => v.onBlur('title', title)}
                error={v.errorFor('title')}
                placeholder="Risk Register Template"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Description</span>
              <textarea
                required
                rows={4}
                className={cn(inputClass, 'mt-1.5')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={() => v.onBlur('description', description)}
                placeholder="A ready-to-use risk register spreadsheet…"
              />
              <FieldError message={v.errorFor('description')} />
            </label>
            {/* Free is a real product decision, not the absence of a price, so it is
                an explicit control. A template with no product attached is a draft;
                a free one is a deliberate lead magnet (product spec §9). */}
            <label className="flex items-start gap-3 rounded-lg border border-border bg-secondary/40 p-4">
              <input
                type="checkbox"
                checked={isFree}
                onChange={(e) => setIsFree(e.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
              />
              <span>
                <span className="text-sm font-medium text-foreground">Free — capture an email instead of a payment</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Anyone can download it after entering an email address. It is never sold, and any price
                  attached to it stops being shown.
                </span>
              </span>
            </label>
          </div>
          <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-5">
            <Button type="submit" loading={saveMutation.isPending}>
              {editingId ? 'Save changes' : 'Create template'}
            </Button>
            <Button type="button" variant="outline" onClick={reset}>
              Cancel
            </Button>
            {!editingId && (
              <p className="w-full text-xs text-muted-foreground">
                You'll upload the file on the next screen. Templates can't be published without one.
              </p>
            )}
          </div>
        </form>
      )}

      {!showEditor && (
        <>
          {isLoading ? (
            <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading templates…
            </p>
          ) : (
            <ul className="mt-8 flex flex-col divide-y divide-border border-t border-border">
              {templates?.map((t) => (
                <li key={t.id} className="flex flex-col gap-3 py-5">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-sans font-medium text-foreground">{t.title}</p>
                      <PublishStateChip
                        value={t.publish_state}
                        disabled={setPublishState.isPending && setPublishState.variables?.id === t.id}
                        title={!t.has_file ? 'Upload the file before publishing it.' : undefined}
                        onChange={(state) => setPublishState.mutate({ id: t.id, state })}
                      />
                      {t.is_free && <Badge>Free</Badge>}
                    </div>
                    {t.has_file ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {t.file_name} · {formatBytes(t.file_size_bytes)}
                      </p>
                    ) : (
                      // Stated plainly rather than left to be discovered at publish
                      // time — this is the state that would otherwise produce a paid
                      // download that 404s.
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-warning">
                        <AlertTriangle className="size-3.5" aria-hidden="true" />
                        No file uploaded yet
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setUploadRowId(uploadRowId === t.id ? null : t.id)}
                    >
                      <Upload className="size-4" aria-hidden="true" />
                      {t.has_file ? 'Replace file' : 'Upload file'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setTitle(t.title)
                        setDescription(t.description)
                        setIsFree(t.is_free)
                        setEditingId(t.id)
                        setError(null)
                        v.reset()
                      }}
                    >
                      Edit
                    </Button>
                  </div>
                </div>

                {uploadRowId === t.id && (
                  <UploadField
                    kind="template"
                    templateId={t.id}
                    accept={ACCEPTED_TEMPLATE_TYPES}
                    acceptedTypesText={`Accepted: ${ACCEPTED_TEMPLATE_TYPES.replaceAll('.', ' .').trim()}. Up to ${MAX_TEMPLATE_BYTES / (1024 * 1024)}MB.`}
                    maxSizeBytes={MAX_TEMPLATE_BYTES}
                    existingFileLabel={t.has_file ? `${t.file_name} · ${formatBytes(t.file_size_bytes)}` : undefined}
                    onComplete={() => {
                      invalidate()
                      setUploadRowId(null)
                    }}
                  />
                )}
                </li>
              ))}
            </ul>
          )}
          {templates?.length === 0 && (
            <p className="mt-8 text-sm text-muted-foreground">
              No templates yet. Create one to get started.
            </p>
          )}
        </>
      )}
    </div>
  )
}
