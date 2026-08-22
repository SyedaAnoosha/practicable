import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, Download, Receipt } from 'lucide-react'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { PageTitle } from '@/components/ui/PageTitle'
import { EmptyState } from '@/components/ui/EmptyState'
import { ManualGrantDialog, type ManualGrantTarget } from '@/components/admin/ManualGrantDialog'
import { RefundDialog, type RefundTarget } from '@/components/admin/RefundDialog'

interface AdminOrderRow {
  order_id: string
  date: string
  customer_email: string
  product_id: string
  product_name: string
  amount: number
  currency: string
  stripe_reference: string
  entitlement_status: 'granted' | 'missing'
  user_id: string
  order_status: 'pending' | 'completed' | 'failed' | 'refunded'
  order_total_amount_cents: number
  cursor: string
}

/** The Stripe reference column, copyable on click with a `Copied` confirmation
 * (§20.8) — mono, since it's data, not prose. */
function StripeRefCell({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        } catch {
          // Clipboard API unavailable (permissions, non-secure context) — the
          // reference is still visible and selectable by hand, so this fails quiet.
        }
      }}
      className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground transition-colors duration-150 hover:text-foreground"
      title="Copy Stripe reference"
    >
      {copied ? <Check className="size-3 text-success" aria-hidden="true" /> : <Copy className="size-3" aria-hidden="true" />}
      {value}
    </button>
  )
}

// week2_plan.md Phase 6 / W2-R9's §20.8 `/admin/orders`: date, customer email,
// product, amount + currency, Stripe reference, entitlement status, CSV export, and
// the manual-grant escape hatch for a `missing` row.
export function AdminOrders() {
  const queryClient = useQueryClient()
  const [grantTarget, setGrantTarget] = useState<ManualGrantTarget | null>(null)
  const [refundTarget, setRefundTarget] = useState<RefundTarget | null>(null)
  const [exporting, setExporting] = useState(false)
  const [cursor, setCursor] = useState<string | null>(null)

  const { data: orders, isLoading } = useQuery({
    queryKey: queryKeys.admin.orders(),
    queryFn: () => {
      const params = cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''
      return api.get<AdminOrderRow[]>(`/admin/orders${params}`).then((r) => r.data)
    },
  })

  const grantMutation = useMutation({
    mutationFn: (reason: string) => {
      if (!grantTarget) throw new Error('No grant target selected')
      return api.post('/admin/entitlements/grant', {
        user_id: grantTarget.userId,
        product_id: grantTarget.productId,
        reason,
      })
    },
    onSuccess: () => {
      setGrantTarget(null)
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.orders() })
    },
  })

  // week3_plan.md W3-R5 — the refund itself is idempotent server-side (order_status
  // already `refunded` 409s before touching Stripe again), so this mutation only
  // needs to handle the happy path plus a declined-refund error the dialog renders
  // inline; it deliberately does NOT close the dialog on error (§20.3: the failure
  // state stays in the dialog with a [Try again], never a toast).
  const refundMutation = useMutation({
    mutationFn: (reason: string) => {
      if (!refundTarget) throw new Error('No refund target selected')
      return api.post(`/admin/orders/${refundTarget.orderId}/refund`, { reason })
    },
    onSuccess: () => {
      if (refundTarget) {
        setJustRefundedOrderId(refundTarget.orderId)
        setTimeout(() => setJustRefundedOrderId(null), 2000)
      }
      setRefundTarget(null)
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.orders() })
    },
  })

  // §20.8's "row's one-off background tint on transition" — set on a successful
  // refund, cleared after the tint has had time to play, so it fires once and never
  // loops (§39.2 — motion here marks a state becoming known, not ambient decoration).
  const [justRefundedOrderId, setJustRefundedOrderId] = useState<string | null>(null)

  const openRefundDialog = (orderId: string) => {
    // Real product names for this order — aggregated from the rows already on the
    // page, not a fresh request, and never a generic sentence (§20.3).
    const rowsForOrder = orders?.filter((r) => r.order_id === orderId) ?? []
    if (rowsForOrder.length === 0) return
    setRefundTarget({
      orderId,
      customerEmail: rowsForOrder[0].customer_email,
      amount: rowsForOrder[0].order_total_amount_cents,
      currency: rowsForOrder[0].currency,
      productNames: rowsForOrder.map((r) => r.product_name),
    })
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const { data } = await api.get('/admin/orders/export', { responseType: 'blob' })
      const url = window.URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = 'orders.csv'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-10 sm:px-6">
      <PageTitle
        eyebrow="Admin"
        title="Orders"
        description="Every order, whether the entitlement it should have granted actually landed."
        action={
          orders && orders.length > 0 ? (
            <Button variant="ghost" size="sm" loading={exporting} onClick={handleExport}>
              <Download className="size-4" aria-hidden="true" />
              Export CSV
            </Button>
          ) : undefined
        }
      />

      {isLoading && (
        <div className="mt-8 space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-11 animate-pulse rounded-sm border border-border bg-muted/40" />
          ))}
        </div>
      )}

      {!isLoading && orders?.length === 0 && (
        <EmptyState
          className="mt-8"
          icon={Receipt}
          title="No orders yet."
          description="Orders appear here as soon as someone buys something."
        />
      )}

      {!isLoading && orders && orders.length > 0 && (
        // §21's responsive rule for this page: horizontally scrollable inside its
        // own container; the page body itself never scrolls sideways.
        <div className="mt-8 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[840px] border-collapse text-sm">
            <thead className="sticky top-0 bg-muted/60 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2.5 text-left">Date</th>
                <th scope="col" className="px-4 py-2.5 text-left">Customer</th>
                <th scope="col" className="px-4 py-2.5 text-left">Product</th>
                <th scope="col" className="px-4 py-2.5 text-right">Amount</th>
                <th scope="col" className="px-4 py-2.5 text-left">Stripe ref</th>
                <th scope="col" className="px-4 py-2.5 text-left">Entitlement</th>
                <th scope="col" className="px-4 py-2.5 text-left">Refund</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((row, i) => {
                // The refund action applies to the whole ORDER, not one line item —
                // shown once per order (its first row), not once per item, so a
                // multi-product cart order doesn't get N confusing refund buttons.
                const isFirstRowForOrder = orders.findIndex((r) => r.order_id === row.order_id) === i
                const isRefunded = row.order_status === 'refunded'
                return (
                  <tr
                    key={`${row.order_id}-${row.product_id}`}
                    className={`border-t border-border transition-colors duration-1000 ${
                      justRefundedOrderId === row.order_id ? 'bg-destructive/5' : ''
                    }`}
                  >
                    {/* Row height 44px minimum — §20.8's touch-target floor for a table row. */}
                    <td className="h-11 whitespace-nowrap px-4 font-mono text-sm text-foreground">{row.date}</td>
                    <td className="max-w-[220px] truncate px-4 text-foreground" title={row.customer_email}>
                      {row.customer_email}
                    </td>
                    <td className="px-4 text-foreground">{row.product_name}</td>
                    <td className="whitespace-nowrap px-4 text-right font-medium tabular-nums text-foreground">
                      {formatCurrency(row.amount, row.currency)}
                    </td>
                    <td className="px-4">
                      <StripeRefCell value={row.stripe_reference} />
                    </td>
                    <td className="px-4">
                      {row.entitlement_status === 'granted' ? (
                        <Badge variant="success">Granted</Badge>
                      ) : isRefunded ? (
                        <Badge variant="muted">Refunded</Badge>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Badge variant="warning">Missing</Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setGrantTarget({
                                userId: row.user_id,
                                customerEmail: row.customer_email,
                                productId: row.product_id,
                                productName: row.product_name,
                              })
                            }
                          >
                            Grant
                          </Button>
                        </div>
                      )}
                    </td>
                    <td className="px-4">
                      {!isFirstRowForOrder ? null : isRefunded ? (
                        <span className="text-xs tabular-nums text-muted-foreground">
                          −{formatCurrency(row.order_total_amount_cents, row.currency)}
                        </span>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => openRefundDialog(row.order_id)}>
                          Refund
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Keyset pagination: load more button when we have data */}
      {!isLoading && orders && orders.length > 0 && (
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            onClick={() => {
              // Use the last row's cursor as the next page's cursor
              const lastCursor = orders[orders.length - 1].cursor
              setCursor(lastCursor)
            }}
          >
            Load more
          </Button>
        </div>
      )}

      {grantTarget && (
        <ManualGrantDialog
          target={grantTarget}
          onClose={() => setGrantTarget(null)}
          onSubmit={(reason) => grantMutation.mutate(reason)}
          isPending={grantMutation.isPending}
          isError={grantMutation.isError}
        />
      )}

      {refundTarget && (
        <RefundDialog
          target={refundTarget}
          onClose={() => {
            if (!refundMutation.isPending) setRefundTarget(null)
          }}
          onSubmit={(reason) => refundMutation.mutate(reason)}
          isPending={refundMutation.isPending}
          isError={refundMutation.isError}
        />
      )}
    </div>
  )
}
