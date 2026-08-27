import { Loader2, X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import { Button } from '@/components/ui/Button'

interface ReceiptLine {
  product_name: string
  price_amount_cents: number
}

interface Receipt {
  order_id: string
  order_date: string
  status: string
  currency: string
  total_amount_cents: number
  lines: ReceiptLine[]
  buyer_refund_amount_cents: number | null
  buyer_refunded_at: string | null
  seller_legal_name: string | null
}

/** No Stripe invoice id is ever persisted on an order, so this regenerates a receipt
 * from the order's own data instead of linking a Stripe invoice that may not exist.
 * Order id is the honest reference here — never a fabricated invoice number. Inline
 * panel under the order row, same expand-in-place pattern the refund flow already
 * uses in Purchases.tsx, rather than a new modal component. */
export function ReceiptView({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['me', 'receipt', orderId] as const,
    queryFn: () => api.get<Receipt>(`/me/orders/${orderId}/receipt`).then((r) => r.data),
  })

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm print:border-none print:shadow-none">
      <div className="flex items-center justify-between print:hidden">
        <p className="text-sm font-medium">Receipt</p>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-muted-foreground hover:text-foreground"
          aria-label="Close receipt"
        >
          <X className="size-4" />
        </button>
      </div>

      {isLoading && (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading receipt…
        </p>
      )}

      {isError && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          We couldn't load this receipt. Please try again.
        </p>
      )}

      {data && (
        <div className="mt-3 flex flex-col gap-3 text-sm">
          <div>
            <p className="font-medium text-foreground">
              {data.seller_legal_name || 'Effective Risk Management'}
            </p>
            <p className="text-muted-foreground">Order reference: {data.order_id}</p>
            <p className="text-muted-foreground">Date: {formatDate(data.order_date)}</p>
          </div>

          <ul className="flex flex-col gap-1 border-t border-border pt-3">
            {data.lines.map((line, i) => (
              <li key={i} className="flex items-center justify-between gap-2">
                <span className="truncate text-foreground">{line.product_name}</span>
                <span className="tabular-nums text-muted-foreground">
                  {formatCurrency(line.price_amount_cents, data.currency)}
                </span>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between border-t border-border pt-3 font-medium text-foreground">
            <span>Total</span>
            <span className="tabular-nums">{formatCurrency(data.total_amount_cents, data.currency)}</span>
          </div>

          {data.buyer_refunded_at && (
            <p className="text-muted-foreground">
              Refunded {formatCurrency(data.buyer_refund_amount_cents ?? data.total_amount_cents, data.currency)} ·{' '}
              {formatDate(data.buyer_refunded_at)}
            </p>
          )}

          <div className="print:hidden">
            <Button size="sm" variant="outline" onClick={() => window.print()}>
              Print
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
