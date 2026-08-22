import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, FileText, Loader2, Plus, Tags } from 'lucide-react'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PageTitle } from '@/components/ui/PageTitle'
import { FieldError } from '@/components/ui/FieldError'
import { PublishStateChip, type PublishStateValue } from '@/components/admin/PublishStateChip'
import { required, useFieldValidation } from '@/lib/useFieldValidation'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import { dollarsToCents } from '@/lib/utils/dollarsToCents'
import { priceChangeConfirmMessage, priceChangeNeedsConfirm } from '@/lib/utils/priceChangeConfirm'

const inputClass =
  'w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

interface ContentItem {
  content_type: string
  content_id: string
  title: string
}

interface PackRow {
  id: string
  slug: string
  name: string
  description: string
  price_amount: number
  currency: string
  stripe_price_id: string | null
  published: boolean
  publish_state: PublishStateValue
  is_bundle: boolean
  template_count: number
  question_count: number
  contents: ContentItem[]
  readiness: string
  readiness_message: string
}

interface ContentOption {
  id: string
  title: string
  subtitle?: string | null
}

export function AdminPacks() {
  const queryClient = useQueryClient()
  const [isCreating, setIsCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [priceAmount, setPriceAmount] = useState('')
  const [currency, setCurrency] = useState('AUD')
  const [selectedContents, setSelectedContents] = useState<Array<{ content_type: string; content_id: string }>>([])
  const [error, setError] = useState<string | null>(null)

  const v = useFieldValidation<{ name: string; description: string; priceAmount: string }>({
    name: required('Name'),
    description: required('Description'),
    priceAmount: required('Price'),
  })

  const { data: packs, isLoading } = useQuery({
    queryKey: queryKeys.admin.products(), // reuse products cache key
    queryFn: () => api.get<PackRow[]>('/admin/packs').then((r) => r.data),
  })

  const { data: availableTemplates } = useQuery({
    queryKey: ['admin', 'packs', 'templates'] as const,
    queryFn: () => api.get<ContentOption[]>('/admin/packs/available-templates').then((r) => r.data),
  })

  const { data: availableQuestions } = useQuery({
    queryKey: ['admin', 'packs', 'questions'] as const,
    queryFn: () => api.get<ContentOption[]>('/admin/packs/available-questions').then((r) => r.data),
  })

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.admin.products() })
    void queryClient.invalidateQueries({ queryKey: ['admin', 'packs'] })
  }

  const readError = (e: unknown): string => {
    const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
    return detail ?? 'Something went wrong. Please try again.'
  }

  const reset = () => {
    setIsCreating(false)
    setEditingId(null)
    setName('')
    setDescription('')
    setPriceAmount('')
    setCurrency('AUD')
    setSelectedContents([])
    setError(null)
    v.reset()
  }

  const contentsPayload = () => selectedContents.map((c) => ({
    content_type: c.content_type,
    content_id: c.content_id,
  }))

  const createMutation = useMutation({
    mutationFn: () => api.post('/admin/packs', {
      name, description,
      price_amount: dollarsToCents(priceAmount),
      currency, contents: contentsPayload(),
    }),
    onSuccess: () => { reset(); invalidate() },
    onError: (e) => setError(readError(e)),
  })

  const updateMutation = useMutation({
    mutationFn: () => api.put(`/admin/packs/${editingId}`, {
      name, description, contents: contentsPayload(),
    }),
    onSuccess: () => { reset(); invalidate() },
    onError: (e) => setError(readError(e)),
  })

  const saveMutation = createMutation.isPending ? createMutation : updateMutation

  const setPublishState = useMutation({
    mutationFn: ({ id, state }: { id: string; state: PublishStateValue }) =>
      api.post(`/admin/packs/${id}/publish`, { published: state === 'published', publish_state: state }),
    onSuccess: invalidate,
    onError: (e) => setError(readError(e)),
  })

  // Phase 9A re-verification (2026-08-21): the create form set a price, but nothing
  // let an existing pack's price be *changed* afterward — courses and templates both
  // had this via POST /admin/products/{id}/price (one endpoint, three surfaces per
  // §9A step 3); packs was the one editor missing it. Same endpoint, same pattern.
  const [changePriceId, setChangePriceId] = useState<string | null>(null)
  const [changePriceAmount, setChangePriceAmount] = useState('')
  const changePrice = useMutation({
    mutationFn: (v: { productId: string; priceAmount: number }) =>
      api.post(`/admin/products/${v.productId}/price`, {
        price_amount: v.priceAmount,
        currency: 'AUD',
        reason: 'Price set from pack editor',
      }),
    onSuccess: () => {
      setChangePriceId(null)
      setChangePriceAmount('')
      invalidate()
    },
    onError: (e) => setError(readError(e)),
  })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!v.validateAll({ name, description, priceAmount: editingId ? '1' : priceAmount })) return
    setError(null)
    if (editingId) updateMutation.mutate()
    else createMutation.mutate()
  }

  const showEditor = isCreating || editingId !== null

  const toggleContent = (contentType: string, contentId: string) => {
    setSelectedContents((prev) => {
      const exists = prev.some((c) => c.content_type === contentType && c.content_id === contentId)
      if (exists) return prev.filter((c) => !(c.content_type === contentType && c.content_id === contentId))
      return [...prev, { content_type: contentType, content_id: contentId }]
    })
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageTitle
          eyebrow="Commerce editor"
          title="Packs"
          description="Reference packs and domain packs — bundles of templates and questions."
        />
        {!showEditor && (
          <Button onClick={() => { setIsCreating(true); setError(null); v.reset() }}>
            <Plus className="size-4" aria-hidden="true" /> New pack
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
          <h2 className="font-sans text-lg font-semibold">{editingId ? 'Edit pack' : 'New pack'}</h2>
          <div className="mt-5 flex flex-col gap-5">
            <label className="block">
              <span className="text-sm font-medium">Name</span>
              <Input required className="mt-1.5" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => v.onBlur('name', name)} error={v.errorFor('name')} placeholder="Vendor Risk Evaluation Pack" />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Description</span>
              <textarea required rows={4} className={cn(inputClass, 'mt-1.5')} value={description} onChange={(e) => setDescription(e.target.value)} onBlur={() => v.onBlur('description', description)} placeholder="Everything you need for a vendor risk evaluation…" />
              <FieldError message={v.errorFor('description')} />
            </label>

            {!editingId && (
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium">Price (in dollars)</span>
                  <Input required type="number" min="0" step="0.01" className="mt-1.5" value={priceAmount} onChange={(e) => setPriceAmount(e.target.value)} onBlur={() => v.onBlur('priceAmount', priceAmount)} error={v.errorFor('priceAmount')} placeholder="49.00" />
                  <FieldError message={v.errorFor('priceAmount')} />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Currency</span>
                  <select className={cn(inputClass, 'mt-1.5')} value={currency} onChange={(e) => setCurrency(e.target.value)}>
                    <option value="AUD">AUD</option>
                    <option value="USD">USD</option>
                  </select>
                </label>
              </div>
            )}

            {/* Templates */}
            <div>
              <p className="text-sm font-medium">Templates</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Select at least 1 template (the PDF).</p>
              <div className="mt-2 flex flex-col gap-1.5">
                {availableTemplates?.map((t) => {
                  const selected = selectedContents.some((c) => c.content_type === 'template' && c.content_id === t.id)
                  return (
                    <label key={t.id} className={cn('flex items-center gap-2 rounded-md border p-2.5 text-sm transition-colors', selected ? 'border-primary bg-primary/5' : 'border-border')}>
                      <input type="checkbox" checked={selected} onChange={() => toggleContent('template', t.id)} className="size-4 shrink-0 accent-[var(--accent)]" />
                      <FileText className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="truncate">{t.title}</span>
                    </label>
                  )
                })}
                {availableTemplates?.length === 0 && <p className="text-xs text-muted-foreground">No published templates yet.</p>}
              </div>
            </div>

            {/* Questions */}
            <div>
              <p className="text-sm font-medium">Questions</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Select at least 1 question set.</p>
              <div className="mt-2 max-h-60 flex flex-col gap-1.5 overflow-y-auto">
                {availableQuestions?.map((q) => {
                  const selected = selectedContents.some((c) => c.content_type === 'question_set' && c.content_id === q.id)
                  return (
                    <label key={q.id} className={cn('flex items-center gap-2 rounded-md border p-2.5 text-sm transition-colors', selected ? 'border-primary bg-primary/5' : 'border-border')}>
                      <input type="checkbox" checked={selected} onChange={() => toggleContent('question_set', q.id)} className="size-4 shrink-0 accent-[var(--accent)]" />
                      <Tags className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="truncate">{q.title}</span>
                    </label>
                  )
                })}
                {availableQuestions?.length === 0 && <p className="text-xs text-muted-foreground">No published questions yet.</p>}
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-5">
            <Button type="submit" loading={saveMutation.isPending}>
              {editingId ? 'Save changes' : 'Create pack'}
            </Button>
            <Button type="button" variant="outline" onClick={reset}>Cancel</Button>
          </div>
        </form>
      )}

      {!showEditor && (
        <>
          {isLoading ? (
            <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading packs…
            </p>
          ) : (
            <ul className="mt-8 flex flex-col divide-y divide-border border-t border-border">
              {packs?.map((p) => (
                <li key={p.id} className="flex flex-col gap-3 py-5">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-sans font-medium text-foreground">{p.name}</p>
                        <PublishStateChip value={p.publish_state} disabled={setPublishState.isPending && setPublishState.variables?.id === p.id} onChange={(state) => setPublishState.mutate({ id: p.id, state })} />
                      </div>
                      <p className="mt-0.5 text-sm text-muted-foreground">{p.description}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>{formatCurrency(p.price_amount, p.currency)}</span>
                        <span>{p.template_count} template{p.template_count === 1 ? '' : 's'}</span>
                        <span>{p.question_count} question{p.question_count === 1 ? '' : 's'}</span>
                        {p.readiness !== 'ready' && (
                          <span className="flex items-center gap-1 text-amber-600">
                            <AlertTriangle className="size-3" aria-hidden="true" /> {p.readiness_message}
                          </span>
                        )}
                      </div>
                      {/* Phase 9A: price control — stripe_price_id stays read-only
                          everywhere; this is the one endpoint that writes it. */}
                      {changePriceId === p.id && (
                        <div className="mt-2 flex items-end gap-2">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Price in dollars, e.g. 49.00"
                            className="w-40"
                            value={changePriceAmount}
                            onChange={(e) => setChangePriceAmount(e.target.value)}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const cents = dollarsToCents(changePriceAmount)
                              if (!Number.isFinite(cents) || cents <= 0) return
                              // Phase 8 (8B-7): fat-finger protection — a ±50% swing
                              // is confirmed before it charges a real card.
                              if (
                                priceChangeNeedsConfirm(p.price_amount, cents) &&
                                !window.confirm(priceChangeConfirmMessage(p.price_amount, cents, p.currency))
                              ) {
                                return
                              }
                              changePrice.mutate({ productId: p.id, priceAmount: cents })
                            }}
                            loading={changePrice.isPending && changePrice.variables?.productId === p.id}
                            disabled={!changePriceAmount}
                          >
                            Set price
                          </Button>
                          <Button size="sm" variant="ghost" type="button" onClick={() => { setChangePriceId(null); setChangePriceAmount('') }}>
                            Cancel
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {changePriceId !== p.id && (
                        <Button size="sm" variant="outline" onClick={() => { setChangePriceId(p.id); setChangePriceAmount('') }}>
                          Change price
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => {
                        setName(p.name)
                        setDescription(p.description)
                        setPriceAmount((p.price_amount / 100).toString())
                        setCurrency(p.currency)
                        setSelectedContents(p.contents.map((c) => ({ content_type: c.content_type, content_id: c.content_id })))
                        setEditingId(p.id)
                        setError(null)
                        v.reset()
                      }}>
                        Edit
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {packs?.length === 0 && (
            <p className="mt-8 text-sm text-muted-foreground">No packs yet. Create one to get started.</p>
          )}
        </>
      )}
    </div>
  )
}
