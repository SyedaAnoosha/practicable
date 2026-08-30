import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus } from 'lucide-react'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PageTitle } from '@/components/ui/PageTitle'
import { FieldError } from '@/components/ui/FieldError'
import { required, useFieldValidation } from '@/lib/useFieldValidation'
import { PublishStateChip, type PublishStateValue } from '@/components/admin/PublishStateChip'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import { dollarsToCents } from '@/lib/utils/dollarsToCents'
import { priceChangeConfirmMessage, priceChangeNeedsConfirm } from '@/lib/utils/priceChangeConfirm'

interface ProductRow {
  id: string
  slug: string
  name: string
  description: string
  stripe_price_id: string
  price_amount: number
  currency: string
  published: boolean
  publish_state: PublishStateValue
  licence?: string
  search_title?: string
  version?: string
  last_reviewed_at?: string
  is_bundle?: boolean
}

const inputClass =
  'w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

export function AdminProducts() {
  const queryClient = useQueryClient()
  const [isCreating, setIsCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [priceAmount, setPriceAmount] = useState('')
  const [currency, setCurrency] = useState('AUD')
  const [licence, setLicence] = useState('')
  const [searchTitle, setSearchTitle] = useState('')
  const [version, setVersion] = useState('')
  const [isBundle, setIsBundle] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const v = useFieldValidation<{ name: string; description: string; priceAmount: string }>({
    name: required('Name'),
    description: required('Description'),
    priceAmount: required('Price'),
  })

  const { data: products, isLoading } = useQuery({
    queryKey: queryKeys.admin.products(),
    queryFn: () => api.get<ProductRow[]>('/admin/products').then((r) => r.data),
  })

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.admin.products() })
    void queryClient.invalidateQueries({ queryKey: queryKeys.products.list() })
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
    setLicence('')
    setSearchTitle('')
    setVersion('')
    setIsBundle(false)
    setError(null)
    v.reset()
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Price is deliberately NOT sent from this form when editing —
      // it goes through the dedicated "Change price" control below, via the one
      // /price endpoint, from all three surfaces. stripe_price_id/price_amount are
      // still required by the schema (it also serves create), so the existing values
      // round-trip unchanged; the backend ignores them on PUT.
      const editing = products?.find((p) => p.id === editingId)
      const body = {
        name,
        description,
        stripe_price_id: editing?.stripe_price_id ?? 'unused',
        price_amount: editingId ? editing?.price_amount ?? 1 : dollarsToCents(priceAmount),
        currency,
        licence: licence || null,
        search_title: searchTitle || null,
        version: version || null,
        is_bundle: isBundle,
      }
      return editingId ? api.put(`/admin/products/${editingId}`, body) : api.post('/admin/products', body)
    },
    onSuccess: () => {
      reset()
      invalidate()
    },
    onError: (e) => setError(readError(e)),
  })

  const setPublishState = useMutation({
    mutationFn: ({ id, state }: { id: string; state: PublishStateValue }) =>
      api.post(`/admin/products/${id}/publish`, { published: state === 'published', publish_state: state }),
    onSuccess: invalidate,
    onError: (e) => setError(readError(e)),
  })

  // The one price-change endpoint, third surface (AdminCourses
  // and AdminTemplates already use it against a course's/template's linked product).
  const [changePriceId, setChangePriceId] = useState<string | null>(null)
  const [newPriceAmount, setNewPriceAmount] = useState('')
  const changePrice = useMutation({
    mutationFn: (v: { productId: string; priceAmount: number; currency: string }) =>
      api.post(`/admin/products/${v.productId}/price`, {
        price_amount: v.priceAmount,
        currency: v.currency,
        reason: 'Price set from product editor',
      }),
    onSuccess: () => {
      setChangePriceId(null)
      setNewPriceAmount('')
      invalidate()
    },
    onError: (e) => setError(readError(e)),
  })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!v.validateAll({ name, description, priceAmount: editingId ? '1' : priceAmount })) return
    setError(null)
    saveMutation.mutate()
  }

  const showEditor = isCreating || editingId !== null

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageTitle
          eyebrow="Commerce editor"
          title="Products"
          description="Sellable bundles of content. Create the entry, add contents, then publish."
        />
        {!showEditor && (
          <Button
            onClick={() => {
              setName('')
              setDescription('')
              setPriceAmount('')
              setCurrency('AUD')
              setLicence('')
              setSearchTitle('')
              setVersion('')
              setIsBundle(false)
              setIsCreating(true)
              setError(null)
              v.reset()
            }}
          >
            <Plus className="size-4" aria-hidden="true" /> New product
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
          <h2 className="font-sans text-lg font-semibold">{editingId ? 'Edit product' : 'New product'}</h2>
          <div className="mt-5 flex flex-col gap-5">
            <label className="block">
              <span className="text-sm font-medium">Name</span>
              <Input
                required
                className="mt-1.5"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => v.onBlur('name', name)}
                error={v.errorFor('name')}
                placeholder="Risk Register Bundle"
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
                placeholder="A complete risk management toolkit…"
              />
              <FieldError message={v.errorFor('description')} />
            </label>
            <div className="grid gap-5 sm:grid-cols-2">
              {!editingId && (
                <label className="block">
                  <span className="text-sm font-medium">Price (in dollars)</span>
                  <Input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    className="mt-1.5"
                    value={priceAmount}
                    onChange={(e) => setPriceAmount(e.target.value)}
                    onBlur={() => v.onBlur('priceAmount', priceAmount)}
                    error={v.errorFor('priceAmount')}
                    placeholder="49.00"
                  />
                  <FieldError message={v.errorFor('priceAmount')} />
                </label>
              )}
              <label className="block">
                <span className="text-sm font-medium">Currency</span>
                <select
                  className={cn(inputClass, 'mt-1.5')}
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  <option value="AUD">AUD</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
              </label>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium">Licence</span>
                <select
                  className={cn(inputClass, 'mt-1.5')}
                  value={licence}
                  onChange={(e) => setLicence(e.target.value)}
                >
                  <option value="">None</option>
                  <option value="standard">Standard</option>
                  <option value="commercial">Commercial</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-medium">Version</span>
                <Input
                  className="mt-1.5"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  placeholder="1.0"
                />
              </label>
            </div>
            <label className="block">
              <span className="text-sm font-medium">Search title (optional)</span>
              <Input
                className="mt-1.5"
                value={searchTitle}
                onChange={(e) => setSearchTitle(e.target.value)}
                placeholder="Alternative name for search"
              />
            </label>
            <label className="flex items-start gap-3 rounded-lg border border-border bg-secondary/40 p-4">
              <input
                type="checkbox"
                checked={isBundle}
                onChange={(e) => setIsBundle(e.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
              />
              <span>
                <span className="text-sm font-medium text-foreground">Bundle</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  This product contains multiple content items (templates, lessons, question sets).
                </span>
              </span>
            </label>
          </div>
          <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-5">
            <Button type="submit" loading={saveMutation.isPending}>
              {editingId ? 'Save changes' : 'Create product'}
            </Button>
            <Button type="button" variant="outline" onClick={reset}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {!showEditor && (
        <>
          {isLoading ? (
            <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading products…
            </p>
          ) : (
            <ul className="mt-8 flex flex-col divide-y divide-border border-t border-border">
              {products?.map((p) => (
                <li key={p.id} className="flex flex-col gap-3 py-5">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-sans font-medium text-foreground">{p.name}</p>
                        <PublishStateChip
                          value={p.publish_state}
                          disabled={setPublishState.isPending && setPublishState.variables?.id === p.id}
                          onChange={(state) => setPublishState.mutate({ id: p.id, state })}
                        />
                        {p.is_bundle && <span className="text-xs text-muted-foreground">Bundle</span>}
                      </div>
                      <p className="mt-0.5 text-sm text-muted-foreground">{p.description}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>{formatCurrency(p.price_amount, p.currency)}</span>
                        {p.licence && <span>Licence: {p.licence}</span>}
                        {p.version && <span>v{p.version}</span>}
                      </div>
                      {/* Price change — one endpoint, third surface. */}
                      {changePriceId === p.id ? (
                        <div className="mt-3 flex items-end gap-2">
                          <label className="block">
                            <span className="sr-only">New price in dollars</span>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              className="w-32"
                              placeholder="49.00"
                              value={newPriceAmount}
                              onChange={(e) => setNewPriceAmount(e.target.value)}
                              autoFocus
                            />
                          </label>
                          <Button
                            size="sm"
                            disabled={!newPriceAmount}
                            loading={changePrice.isPending}
                            onClick={() => {
                              const cents = dollarsToCents(newPriceAmount)
                              if (!cents || cents <= 0) return
                              if (
                                priceChangeNeedsConfirm(p.price_amount, cents) &&
                                !window.confirm(priceChangeConfirmMessage(p.price_amount, cents, p.currency))
                              ) {
                                return
                              }
                              changePrice.mutate({ productId: p.id, priceAmount: cents, currency: p.currency })
                            }}
                          >
                            Save price
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setChangePriceId(null)
                              setNewPriceAmount('')
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setChangePriceId(p.id)
                          setNewPriceAmount('')
                          setError(null)
                        }}
                      >
                        Change price
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setName(p.name)
                          setDescription(p.description)
                          setCurrency(p.currency)
                          setLicence(p.licence || '')
                          setSearchTitle(p.search_title || '')
                          setVersion(p.version || '')
                          setIsBundle(p.is_bundle || false)
                          setEditingId(p.id)
                          setError(null)
                          v.reset()
                        }}
                      >
                        Edit
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {products?.length === 0 && (
            <p className="mt-8 text-sm text-muted-foreground">
              No products yet. Create one to get started.
            </p>
          )}
        </>
      )}
    </div>
  )
}
