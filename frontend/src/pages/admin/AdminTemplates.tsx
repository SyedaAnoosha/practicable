import { useRef, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Check, Loader2, Plus, Upload, X } from 'lucide-react'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { PageTitle } from '@/components/ui/PageTitle'

interface TemplateRow {
  id: string
  slug: string
  title: string
  description: string
  file_name: string
  file_size_bytes: number
  mime_type: string
  published: boolean
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
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({})

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

  const publishMutation = useMutation({
    mutationFn: ({ id, published }: { id: string; published: boolean }) =>
      api.post(`/admin/templates/${id}/publish`, { published }),
    onSuccess: invalidate,
    onError: (e) => setError(readError(e)),
  })

  // multipart/form-data, not JSON — the file goes through our admin-guarded endpoint
  // rather than a presigned browser upload, so the bucket holding paid artefacts never
  // accepts a direct write. Content-Type is left unset deliberately: the browser must
  // add the multipart boundary itself, and setting it by hand strips that.
  const uploadMutation = useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const form = new FormData()
      form.append('file', file)
      return api.post(`/admin/templates/${id}/file`, form)
    },
    onSuccess: () => {
      setUploadingId(null)
      invalidate()
    },
    onError: (e) => {
      setUploadingId(null)
      setError(readError(e))
    },
  })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
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
                placeholder="A ready-to-use risk register spreadsheet…"
              />
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
            <p className="mt-10 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading templates…
            </p>
          ) : (
            <ul className="mt-8 flex flex-col divide-y divide-border border-t border-border">
              {templates?.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-4 py-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-sans font-medium text-foreground">{t.title}</p>
                      {t.published ? <Badge variant="success">Live</Badge> : <Badge variant="muted">Draft</Badge>}
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
                    <input
                      type="file"
                      className="sr-only"
                      ref={(el) => {
                        fileInputs.current[t.id] = el
                      }}
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        setError(null)
                        setUploadingId(t.id)
                        uploadMutation.mutate({ id: t.id, file })
                        e.target.value = ''
                      }}
                      aria-label={`Upload file for ${t.title}`}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      loading={uploadingId === t.id}
                      onClick={() => fileInputs.current[t.id]?.click()}
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
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant={t.published ? 'ghost' : 'primary'}
                      disabled={!t.published && !t.has_file}
                      title={!t.published && !t.has_file ? 'Upload the file first' : undefined}
                      loading={publishMutation.isPending && publishMutation.variables?.id === t.id}
                      onClick={() => publishMutation.mutate({ id: t.id, published: !t.published })}
                    >
                      {t.published ? (
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
