import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ImageOff, Loader2, Plus, Trash2, Upload } from 'lucide-react'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { cn } from '@/lib/utils/cn'
import { priceChangeConfirmMessage, priceChangeNeedsConfirm } from '@/lib/utils/priceChangeConfirm'
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

// Kept in sync by hand with ALLOWED_PREVIEW_MIME_TYPES / MAX_PREVIEW_UPLOAD_BYTES in
// backend/app/api/v1/admin/templates.py.
const ACCEPTED_PREVIEW_TYPES = '.png,.jpg,.jpeg,.webp'
const MAX_PREVIEW_BYTES = 8 * 1024 * 1024

interface PreviewImageRow {
  storage_key: string
  url: string
  alt: string
}

type ReadinessState = 'no_product' | 'price_unset' | 'stripe_price_unresolved' | 'unpublished' | 'ready'

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
  // Phase 8 (8A-6): server-derived — never inferred client-side from published/price.
  // Free templates have no product and no readiness concept; the field is still
  // present (backend always returns it) but the row never renders it when is_free.
  readiness: ReadinessState
  readiness_message: string
  product_id: string | null
  price_amount: number | null
  currency: string | null
  // ── W4-R1 evidence fields ─────────────────────────────────────────────────
  page_count: number | null
  sheet_count: number | null
  is_editable: boolean | null
  has_macros: boolean
  min_office_version: string | null
  preview_images: PreviewImageRow[]
  version: string | null
  last_reviewed_at: string | null
  format: string | null
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
  // Same one-at-a-time pattern as uploadRowId, for the preview-images manager.
  const [previewsRowId, setPreviewsRowId] = useState<string | null>(null)

  // ── W4-R1 evidence fields (edit mode only — a template needs to exist first) ──
  const [pageCount, setPageCount] = useState('')
  const [sheetCount, setSheetCount] = useState('')
  const [isEditable, setIsEditable] = useState<'' | 'yes' | 'no'>('')
  const [hasMacros, setHasMacros] = useState(false)
  const [minOfficeVersion, setMinOfficeVersion] = useState('')
  const [version, setVersion] = useState('')
  const [lastReviewedAt, setLastReviewedAt] = useState('')

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
    setPageCount('')
    setSheetCount('')
    setIsEditable('')
    setHasMacros(false)
    setMinOfficeVersion('')
    setVersion('')
    setLastReviewedAt('')
    setError(null)
    v.reset()
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const evidence = {
        page_count: pageCount ? Number(pageCount) : null,
        sheet_count: sheetCount ? Number(sheetCount) : null,
        is_editable: isEditable === '' ? null : isEditable === 'yes',
        has_macros: hasMacros,
        min_office_version: minOfficeVersion || null,
        version: version || null,
        last_reviewed_at: lastReviewedAt ? new Date(lastReviewedAt).toISOString() : null,
      }
      // On create, evidence is always at its just-reset default (nothing to have
      // opened the file about yet) — sent anyway so both branches share one payload
      // shape rather than the backend seeing two different request bodies.
      return editingId
        ? api.put(`/admin/templates/${editingId}`, { title, description, is_free: isFree, ...evidence })
        : api.post('/admin/templates', { title, description, is_free: isFree, ...evidence })
    },
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

  const removePreviewMutation = useMutation({
    mutationFn: ({ id, storageKey }: { id: string; storageKey: string }) =>
      api.post(`/admin/templates/${id}/preview/remove`, { storage_key: storageKey }),
    onSuccess: invalidate,
    onError: (e) => setError(readError(e)),
  })

  // Phase 8 (8A-5): the same "make purchasable" path courses have.
  const createTemplateProduct = useMutation({
    mutationFn: (id: string) => api.post(`/admin/templates/${id}/create-product`),
    onSuccess: invalidate,
    onError: (e) => setError(readError(e)),
  })

  // Phase 9A: price control — POST /admin/products/{id}/price (one endpoint, three surfaces)
  const [priceAmount, setPriceAmount] = useState('')
  const changePrice = useMutation({
    mutationFn: (v: { productId: string; priceAmount: number }) =>
      api.post(`/admin/products/${v.productId}/price`, {
        price_amount: v.priceAmount,
        currency: 'AUD',
        reason: 'Price set from template editor',
      }),
    onSuccess: () => {
      setPriceAmount('')
      invalidate()
    },
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

            {/* W4-R1 evidence fields — only meaningful once the row exists, since the
                pre-purchase panel that reads them (EvidencePanel §20.1) is keyed off a
                real template. */}
            {editingId && (
              <div className="rounded-lg border border-border bg-secondary/40 p-4">
                <p className="text-sm font-medium text-foreground">What the buyer sees before paying</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Open the file and read these off it — don't guess (week4_plan.md §32). Leave a field
                  blank and its row just doesn't show; no fact is claimed unless it's set here.
                </p>
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-medium">Page count</span>
                    <Input
                      type="number" min={0} className="mt-1.5" value={pageCount}
                      onChange={(e) => setPageCount(e.target.value)}
                      placeholder="e.g. 12 (for a PDF or document)"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium">Sheet count</span>
                    <Input
                      type="number" min={0} className="mt-1.5" value={sheetCount}
                      onChange={(e) => setSheetCount(e.target.value)}
                      placeholder="e.g. 4 (for a spreadsheet)"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium">Editable</span>
                    <select
                      className={cn(inputClass, 'mt-1.5')}
                      value={isEditable}
                      onChange={(e) => setIsEditable(e.target.value as '' | 'yes' | 'no')}
                    >
                      <option value="">Unknown — don't show this row</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium">Minimum Office version</span>
                    <Input
                      className="mt-1.5" value={minOfficeVersion}
                      onChange={(e) => setMinOfficeVersion(e.target.value)}
                      placeholder="e.g. Excel 2016 and later"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium">Version</span>
                    <Input
                      className="mt-1.5" value={version}
                      onChange={(e) => setVersion(e.target.value)}
                      placeholder="e.g. 1.2"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium">Last reviewed</span>
                    <Input
                      type="date" className="mt-1.5" value={lastReviewedAt}
                      onChange={(e) => setLastReviewedAt(e.target.value)}
                    />
                  </label>
                </div>
                <label className="mt-4 flex items-start gap-3 rounded-lg border border-border bg-card p-3">
                  <input
                    type="checkbox"
                    checked={hasMacros}
                    onChange={(e) => setHasMacros(e.target.checked)}
                    className="mt-0.5 size-4 shrink-0 accent-[var(--destructive)]"
                  />
                  <span>
                    <span className="text-sm font-medium text-foreground">Contains macros</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      `new_additions.md` §3: "No macros in any sold artefact. Ever." — checking this
                      makes the file impossible to publish until it's fixed and unchecked.
                    </span>
                  </span>
                </label>
              </div>
            )}
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
                    {/* Phase 8 (8A-6): server-derived readiness. Free templates have no
                        product and no price to be ready about, so the line never shows
                        for them. */}
                    {!t.is_free && t.readiness !== 'ready' && (
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-amber-600">
                        <AlertTriangle className="size-3.5" aria-hidden="true" />
                        {t.readiness_message}
                      </p>
                    )}
                    {/* Phase 9A: price control — appears after product is created */}
                    {!t.is_free && t.product_id && (
                      <div className="mt-2 flex items-end gap-2">
                        <Input
                          type="number"
                          min="0"
                          step="100"
                          placeholder="Price (cents, e.g. 4900)"
                          className="w-40"
                          value={priceAmount}
                          onChange={(e) => setPriceAmount(e.target.value)}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const cents = parseInt(priceAmount, 10)
                            if (!cents || cents <= 0) return
                            // Phase 8 (8B-7): fat-finger protection — a ±50% swing
                            // is confirmed before it charges a real card.
                            const oldCents = t.price_amount ?? 0
                            if (
                              priceChangeNeedsConfirm(oldCents, cents) &&
                              !window.confirm(priceChangeConfirmMessage(oldCents, cents, t.currency ?? 'AUD'))
                            ) {
                              return
                            }
                            changePrice.mutate({ productId: t.product_id!, priceAmount: cents })
                          }}
                          loading={changePrice.isPending}
                          disabled={!priceAmount}
                        >
                          Set price
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    {!t.is_free && !t.product_id && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => createTemplateProduct.mutate(t.id)}
                        loading={createTemplateProduct.isPending && createTemplateProduct.variables === t.id}
                      >
                        <Plus className="size-4" aria-hidden="true" />
                        Create Product
                      </Button>
                    )}
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
                      onClick={() => setPreviewsRowId(previewsRowId === t.id ? null : t.id)}
                    >
                      {t.preview_images.length === 0 ? (
                        <ImageOff className="size-4" aria-hidden="true" />
                      ) : null}
                      Previews {t.preview_images.length > 0 && `(${t.preview_images.length})`}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setTitle(t.title)
                        setDescription(t.description)
                        setIsFree(t.is_free)
                        setPageCount(t.page_count?.toString() ?? '')
                        setSheetCount(t.sheet_count?.toString() ?? '')
                        setIsEditable(t.is_editable === null ? '' : t.is_editable ? 'yes' : 'no')
                        setHasMacros(t.has_macros)
                        setMinOfficeVersion(t.min_office_version ?? '')
                        setVersion(t.version ?? '')
                        setLastReviewedAt(t.last_reviewed_at ? t.last_reviewed_at.slice(0, 10) : '')
                        setEditingId(t.id)
                        setError(null)
                        v.reset()
                      }}
                    >
                      Edit
                    </Button>
                  </div>
                </div>

                {/* A paid template needs >=2 previews to publish at all (the same
                    publish guard `check_preview_images` enforces server-side) — stated
                    here too, plainly, before the owner discovers it at publish time. */}
                {t.preview_images.length > 0 && t.preview_images.length < 2 && !t.is_free && (
                  <p className="flex items-center gap-1.5 text-xs text-warning">
                    <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
                    Only {t.preview_images.length} of the 2 required preview images uploaded.
                  </p>
                )}

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

                {previewsRowId === t.id && (
                  <div className="rounded-lg border border-border bg-secondary/40 p-4">
                    <p className="text-sm font-medium text-foreground">Sample pages</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Real pages from the actual file — a paid template needs at least two before it can
                      publish.
                    </p>
                    {t.preview_images.length > 0 && (
                      <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {t.preview_images.map((p) => (
                          <li key={p.storage_key} className="relative">
                            <img
                              src={p.url}
                              alt={p.alt || '(no alt text set)'}
                              className="aspect-[3/4] w-full rounded-md border border-border object-cover object-top"
                            />
                            <p className="mt-1 truncate text-xs text-muted-foreground" title={p.alt}>
                              {p.alt || '(no alt text — this shouldn\'t happen)'}
                            </p>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="mt-1 w-full"
                              disabled={removePreviewMutation.isPending}
                              onClick={() => removePreviewMutation.mutate({ id: t.id, storageKey: p.storage_key })}
                            >
                              <Trash2 className="size-3.5" aria-hidden="true" /> Remove
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-4">
                      <UploadField
                        kind="preview"
                        templateId={t.id}
                        accept={ACCEPTED_PREVIEW_TYPES}
                        acceptedTypesText={`Accepted: ${ACCEPTED_PREVIEW_TYPES.replaceAll('.', ' .').trim()}. Up to ${MAX_PREVIEW_BYTES / (1024 * 1024)}MB.`}
                        maxSizeBytes={MAX_PREVIEW_BYTES}
                        onComplete={() => invalidate()}
                      />
                    </div>
                  </div>
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
