import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Megaphone, Plus, Pencil, PowerOff, Power, Trash2 } from 'lucide-react'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { PageTitle } from '@/components/ui/PageTitle'
import { EmptyState } from '@/components/ui/EmptyState'
import { readError } from '@/lib/utils/readError'

interface PromotionRow {
  id: string
  code: string
  message: string
  percent_off: number
  starts_at: string
  ends_at: string | null
  active: boolean
  first_time_transaction: boolean
  minimum_amount: number | null
  max_redemptions: number | null
  stripe_coupon_id: string | null
  stripe_promotion_code_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  status: string
}

interface PromotionForm {
  code: string
  message: string
  percent_off: number
  starts_at: string
  ends_at: string
  active: boolean
  first_time_transaction: boolean
  minimum_amount: string
  max_redemptions: string
  sync_to_stripe: boolean
}

const EMPTY_FORM: PromotionForm = {
  code: '',
  message: '',
  percent_off: 15,
  starts_at: '',
  ends_at: '',
  active: true,
  first_time_transaction: false,
  minimum_amount: '',
  max_redemptions: '',
  sync_to_stripe: false,
}

// `secondary`, not `info`: Badge has no `info` variant, so this map was typed against
// a token that does not exist and every render of a scheduled promotion was a type
// error. `muted` is spoken for — theme.css documents it as "quiet/disabled fill", and a
// scheduled promotion is pending, not disabled — so `secondary` is the neutral that
// reads as a live state without claiming success or warning.
const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'secondary' | 'muted'> = {
  live: 'success',
  scheduled: 'secondary',
  expired: 'muted',
  inactive: 'warning',
}

function formatDT(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })
}

export function AdminPromotions() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<PromotionForm>(EMPTY_FORM)

  const { data: promotions, isLoading } = useQuery({
    queryKey: queryKeys.admin.promotions(),
    queryFn: () => api.get<PromotionRow[]>('/admin/promotions').then((r) => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (payload: PromotionForm) =>
      api.post('/admin/promotions', {
        ...payload,
        ends_at: payload.ends_at || null,
        minimum_amount: payload.minimum_amount ? parseInt(payload.minimum_amount) * 100 : null,
        max_redemptions: payload.max_redemptions ? parseInt(payload.max_redemptions) : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.promotions() })
      resetForm()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...payload }: PromotionForm & { id: string }) =>
      api.patch(`/admin/promotions/${id}`, {
        ...payload,
        ends_at: payload.ends_at || null,
        minimum_amount: payload.minimum_amount ? parseInt(payload.minimum_amount) * 100 : null,
        max_redemptions: payload.max_redemptions ? parseInt(payload.max_redemptions) : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.promotions() })
      resetForm()
    },
  })

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => api.post(`/admin/promotions/${id}/deactivate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.promotions() })
    },
  })

  const activateMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/admin/promotions/${id}`, { active: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.promotions() })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/promotions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.promotions() })
    },
  })

  function resetForm() {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setShowForm(false)
  }

  function handleEdit(promo: PromotionRow) {
    setEditingId(promo.id)
    setForm({
      code: promo.code,
      message: promo.message,
      percent_off: promo.percent_off,
      starts_at: promo.starts_at.slice(0, 16),
      ends_at: promo.ends_at ? promo.ends_at.slice(0, 16) : '',
      active: promo.active,
      first_time_transaction: promo.first_time_transaction,
      minimum_amount: promo.minimum_amount ? String(promo.minimum_amount / 100) : '',
      max_redemptions: promo.max_redemptions ? String(promo.max_redemptions) : '',
      sync_to_stripe: false,
    })
    setShowForm(true)
  }

  function handleSubmit() {
    if (editingId) {
      updateMutation.mutate({ ...form, id: editingId })
    } else {
      createMutation.mutate(form)
    }
  }

  function handleDelete(promo: PromotionRow) {
    if (window.confirm("Are you sure you want to delete this promotion from both the system and Stripe?")) {
      deleteMutation.mutate(promo.id)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading promotions…
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6">
      <PageTitle
        eyebrow="Admin"
        title="Promotions"
        description="Manage discount codes shown in the site banner. Only one promotion is active at a time."
      />

      <div className="mt-6 flex justify-end">
        <Button
          size="sm"
          onClick={() => {
            resetForm()
            setShowForm(!showForm)
          }}
        >
          <Plus className="size-4" aria-hidden="true" /> New promotion
        </Button>
      </div>

      {/* Create / Edit form */}
      {showForm && (
        <div className="mt-4 rounded-lg border border-border p-4">
          <h3 className="text-sm font-medium text-foreground">
            {editingId ? 'Edit promotion' : 'Create promotion'}
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="promo-code" className="text-xs font-medium text-muted-foreground">
                Code <span className="text-destructive">*</span>
              </label>
              <input
                id="promo-code"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="WELCOME15"
              />
            </div>
            <div>
              <label htmlFor="promo-percent" className="text-xs font-medium text-muted-foreground">
                Percent off <span className="text-destructive">*</span>
              </label>
              <input
                id="promo-percent"
                type="number"
                min={1}
                max={100}
                value={form.percent_off}
                onChange={(e) => setForm({ ...form, percent_off: parseInt(e.target.value) || 0 })}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="promo-message" className="text-xs font-medium text-muted-foreground">
                Banner message <span className="text-destructive">*</span>
              </label>
              <input
                id="promo-message"
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Your next purchase"
              />
            </div>
            <div>
              <label htmlFor="promo-starts" className="text-xs font-medium text-muted-foreground">
                Starts at <span className="text-destructive">*</span>
              </label>
              <input
                id="promo-starts"
                type="datetime-local"
                value={form.starts_at}
                onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label htmlFor="promo-ends" className="text-xs font-medium text-muted-foreground">
                Ends at (optional)
              </label>
              <input
                id="promo-ends"
                type="datetime-local"
                value={form.ends_at}
                onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label htmlFor="promo-min-amount" className="text-xs font-medium text-muted-foreground">
                Minimum amount ($)
              </label>
              <input
                id="promo-min-amount"
                type="number"
                min={1}
                value={form.minimum_amount}
                onChange={(e) => setForm({ ...form, minimum_amount: e.target.value })}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="e.g. 50"
              />
            </div>
            <div>
              <label htmlFor="promo-max-redemptions" className="text-xs font-medium text-muted-foreground">
                Max redemptions
              </label>
              <input
                id="promo-max-redemptions"
                type="number"
                min={1}
                value={form.max_redemptions}
                onChange={(e) => setForm({ ...form, max_redemptions: e.target.value })}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Leave blank for unlimited"
              />
            </div>
            <div className="flex items-center gap-4 sm:col-span-2">
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  className="size-4 rounded border-border"
                />
                Active
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={form.first_time_transaction}
                  onChange={(e) => setForm({ ...form, first_time_transaction: e.target.checked })}
                  className="size-4 rounded border-border"
                />
                First-time order only
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={form.sync_to_stripe}
                  onChange={(e) => setForm({ ...form, sync_to_stripe: e.target.checked })}
                  className="size-4 rounded border-border"
                />
                Sync to Stripe
              </label>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button size="sm" disabled={isPending} loading={isPending} onClick={handleSubmit}>
              {editingId ? 'Save changes' : 'Create'}
            </Button>
            <Button size="sm" variant="outline" onClick={resetForm}>
              Cancel
            </Button>
          </div>
          {createMutation.isError && (
            <p className="mt-2 text-sm text-destructive">
              {readError(createMutation.error)}
            </p>
          )}
          {updateMutation.isError && (
            <p className="mt-2 text-sm text-destructive">
              {readError(updateMutation.error)}
            </p>
          )}
        </div>
      )}

      {/* Promotions list */}
      {promotions && promotions.length > 0 ? (
        <div className="mt-6 flex flex-col gap-3">
          {promotions.map((promo) => (
            <div
              key={promo.id}
              className="flex items-center justify-between rounded-lg border border-border p-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-foreground">
                    {promo.code}
                  </span>
                  <Badge variant={STATUS_VARIANT[promo.status] || 'muted'}>
                    {promo.status}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {promo.percent_off}% off — {promo.message}
                  {promo.first_time_transaction && (
                    <span className="ml-2 inline-block text-xs font-medium text-amber-500">
                      (First-time only)
                    </span>
                  )}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDT(promo.starts_at)} — {promo.ends_at ? formatDT(promo.ends_at) : 'open-ended'}
                  {promo.minimum_amount != null && ` • Min $${promo.minimum_amount / 100}`}
                  {promo.max_redemptions != null && ` • Max ${promo.max_redemptions} uses`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => handleEdit(promo)}>
                  <Pencil className="size-3" aria-hidden="true" /> Edit
                </Button>
                {promo.active ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => deactivateMutation.mutate(promo.id)}
                    disabled={deactivateMutation.isPending}
                  >
                    <PowerOff className="size-3" aria-hidden="true" /> Deactivate
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => activateMutation.mutate(promo.id)}
                    disabled={activateMutation.isPending}
                  >
                    <Power className="size-3" aria-hidden="true" /> Activate
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDelete(promo)}
                  disabled={deleteMutation.isPending}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="size-3" aria-hidden="true" /> Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          className="mt-8"
          icon={Megaphone}
          title="No promotions yet."
          description="Create a promotion to show a discount code in the site banner."
        />
      )}
    </div>
  )
}
