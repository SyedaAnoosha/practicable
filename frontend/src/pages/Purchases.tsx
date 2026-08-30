import { useState } from 'react'
import { Link } from 'react-router'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, Loader2, ReceiptText, X } from 'lucide-react'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { cn } from '@/lib/utils/cn'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import { Button } from '@/components/ui/Button'
import { PageTitle } from '@/components/ui/PageTitle'
import { EmptyState } from '@/components/ui/EmptyState'
import { ReceiptView } from '@/components/purchases/ReceiptView'
import { SkeletonState } from '@/components/ui/SkeletonState'

interface OrderItem {
  product_id: string
  product_name: string
  price_amount_cents: number
}

interface OrderRow {
  id: string
  created_at: string
  status: string
  total_amount_cents: number
  currency: string
  items: OrderItem[]
  buyer_refund_amount_cents: number | null
  buyer_refunded_at: string | null
}

interface OrdersResponse {
  orders: OrderRow[]
  has_more: boolean
  next_cursor: string | null
}

interface RefundEligibility {
  eligible: boolean
  refund_amount_cents: number | null
  kept_amount_cents: number | null
  progress_percent: number | null
  reason_code: string | null
}

const REASON_OPTIONS = [
  { value: 'changed_mind', label: 'Changed my mind' },
  { value: 'not_useful', label: 'Not useful for my situation' },
  { value: 'wrong_product', label: 'Wrong product' },
  { value: 'other', label: 'Other' },
]

const INELIGIBLE_MESSAGES: Record<string, string> = {
  already_refunded: 'This order has already been refunded.',
  no_course_in_order: "This order doesn't include a course. Contact us and we'll sort it out.",
  order_not_completed: 'This order is still being processed.',
  progress_exceeded: "You've completed more than 15% of this course — past the point where change-of-mind refunds apply. If something is materially wrong with it, contact us: your consumer-guarantee rights still apply.",
}

/** The refusal, with the buyer's real number in it where we have one.
 *
 * The eligible branch already said "You've completed 33% of this
 * course"; the INELIGIBLE branch — the one place a buyer actually wants to check the
 * figure — said only "more than 15%". A refusal a reader cannot check against their own
 * progress is a refusal they can only accept or dispute, never verify. The server
 * already returns `progress_percent`, so there is no reason to round it away here.
 *
 * Falls back to the generic sentence when the server sent no number, rather than
 * inventing one — the same absence rule the evidence panel follows. */
function ineligibleMessage(reasonCode: string | null, progressPercent: number | null): string {
  if (reasonCode === 'progress_exceeded' && progressPercent != null) {
    return (
      `You've completed ${progressPercent}% of this course — past the 15% point where ` +
      'change-of-mind refunds apply. If something is materially wrong with it, contact us: ' +
      'your consumer-guarantee rights still apply.'
    )
  }
  return INELIGIBLE_MESSAGES[reasonCode ?? ''] ?? 'Not eligible for a self-serve refund.'
}

/** Purchases page — shows order history and lets eligible orders start a refund. */
/** This component serves two mounts: the standalone `/purchases`
 * route, and the Account shell's Purchases section. Rendering the page version inside
 * the shell put a full `PageTitle` — an `<h1>` at the page rung — underneath the
 * shell's own "Account" `<h1>`. That is two `<h1>`s on one page (a WCAG heading-order
 * failure the docs call out as J4), and visually the section heading came out LARGER
 * than the page title above it, so "Your purchases" read as the name of the page and
 * "Account" as a stray label.
 *
 * `embedded` renders the section as a section: an `<h2>` at the same rung as every
 * other account section, and no page container, since the shell already provides one. */
export function Purchases({ embedded = false }: { embedded?: boolean } = {}) {
  const Shell = ({ children }: { children: React.ReactNode }) =>
    embedded ? (
      <div>
        <h2 className="mb-1 text-h4 font-semibold text-foreground">Your purchases</h2>
        <p className="mb-6 text-sm text-muted-foreground">Order history and refund requests.</p>
        {children}
      </div>
    ) : (
      <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8">
        <PageTitle title="Your purchases" description="Order history and refund requests." />
        {children}
      </div>
    )
  return <PurchasesBody Shell={Shell} />
}

function PurchasesBody({ Shell }: { Shell: (p: { children: React.ReactNode }) => React.ReactElement }) {
  const queryClient = useQueryClient()
  const [refundingOrderId, setRefundingOrderId] = useState<string | null>(null)
  const [reasonCode, setReasonCode] = useState('')
  const [reasonText, setReasonText] = useState('')
  const [viewingReceiptId, setViewingReceiptId] = useState<string | null>(null)

  const {
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: queryKeys.me.orders(),
    queryFn: ({ pageParam }: { pageParam: string | null }) =>
      api
        .get<OrdersResponse>('/me/orders', { params: pageParam ? { cursor: pageParam } : undefined })
        .then((r) => r.data),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => (lastPage.has_more ? lastPage.next_cursor : undefined),
  })

  const eligibilityQuery = useQuery({
    queryKey: ['me', 'refund-eligibility', refundingOrderId] as const,
    queryFn: () => api.get<RefundEligibility>(`/me/orders/${refundingOrderId}/refund-eligibility`).then((r) => r.data),
    enabled: !!refundingOrderId,
  })

  const refundMutation = useMutation({
    mutationFn: () =>
      api.post(`/me/orders/${refundingOrderId}/refund`, {
        reason_code: reasonCode,
        reason_text: reasonText || null,
      }),
    onSuccess: () => {
      // This used to also call
      // setRefundingOrderId(null) here, which collapses the whole panel — including
      // the "Your refund has been processed" message it's meant to show — in the
      // same tick the mutation resolves. The confirmation was never actually
      // visible. Left open (isRefunding stays true) so the success message renders;
      // the row itself still updates in place once the invalidated query refetches
      // and shows the real refunded state.
      void queryClient.invalidateQueries({ queryKey: queryKeys.me.orders() })
    },
  })

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })

  if (isLoading) {
    return (
      <Shell>
        <SkeletonState className="mt-8" variant="row" rows={4} />
      </Shell>
    )
  }

  if (isError) {
    return (
      <Shell>
        <EmptyState
          title="We couldn't load your purchases."
          description="Check your connection and try again."
          action={<Button onClick={() => refetch()}>Try again</Button>}
        />
      </Shell>
    )
  }

  /* `flatMap((page) => page.orders)` on a page object without
     an `orders` key yields `[undefined]`, not `[]` — so the list below then rendered a
     row for a non-existent order and threw on `order.status`, taking the whole page to
     the error boundary. The `?? []` on the outer expression looks like it covers this
     and does not: it only guards `data` being absent, never a page whose array is.
     One malformed page must not cost the buyer their entire purchase history. */
  const orders = data?.pages.flatMap((page) => page?.orders ?? []) ?? []

  return (
    <Shell>
      {orders.length === 0 ? (
        <EmptyState
          title="No purchases yet."
          description="When you buy something, your orders will appear here."
          action={
            <Link to="/store">
              <Button variant="outline">Browse products</Button>
            </Link>
          }
        />
      ) : (
        <ul className="mt-8 flex flex-col divide-y divide-border border-t border-border">
          {orders.map((order) => {
            const isRefunded = order.status === 'refunded' || !!order.buyer_refunded_at
            const isRefunding = refundingOrderId === order.id
            const elig = isRefunding ? eligibilityQuery.data : null

            return (
              <li key={order.id} className="flex flex-col gap-3 py-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ReceiptText
                      className={cn('size-4', isRefunded ? 'text-muted-foreground' : 'text-gold-strong')}
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                    <span className="text-sm text-muted-foreground">{formatDate(order.created_at)}</span>
                  </div>
                  <span className="text-sm font-medium tabular-nums text-foreground">
                    {formatCurrency(order.total_amount_cents, order.currency)}
                  </span>
                </div>

                <ul className="flex flex-col gap-1">
                  {order.items.map((item) => (
                    <li key={item.product_id} className="flex items-center gap-2 text-sm text-foreground">
                      <span className="truncate">{item.product_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatCurrency(item.price_amount_cents, order.currency)}
                      </span>
                    </li>
                  ))}
                </ul>

                {isRefunded && (
                  <p className="text-sm text-muted-foreground">
                    Refunded {formatCurrency(order.buyer_refund_amount_cents ?? order.total_amount_cents, order.currency)}
                    {order.buyer_refunded_at && ` · ${formatDate(order.buyer_refunded_at)}`}
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setViewingReceiptId(viewingReceiptId === order.id ? null : order.id)}
                  >
                    {viewingReceiptId === order.id ? 'Hide receipt' : 'Receipt'}
                  </Button>

                  {order.status === 'completed' && !isRefunded && !isRefunding && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setRefundingOrderId(order.id)
                        setReasonCode('')
                        setReasonText('')
                      }}
                    >
                      Request a refund
                    </Button>
                  )}
                </div>

                {viewingReceiptId === order.id && (
                  <ReceiptView orderId={order.id} onClose={() => setViewingReceiptId(null)} />
                )}

                {/* Refund dialog */}
                {isRefunding && (
                  <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Refund request</p>
                      <button
                        type="button"
                        onClick={() => setRefundingOrderId(null)}
                        className="rounded p-1 text-muted-foreground hover:text-foreground"
                        aria-label="Cancel refund request"
                      >
                        <X className="size-4" />
                      </button>
                    </div>

                    {eligibilityQuery.isLoading ? (
                      <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" /> Checking eligibility…
                      </p>
                    ) : elig?.eligible === false ? (
                      <p className="mt-3 text-sm text-muted-foreground">
                        {ineligibleMessage(elig.reason_code, elig.progress_percent)}
                      </p>
                    ) : elig?.eligible ? (
                      <>
                        <p className="mt-3 text-sm text-muted-foreground">
                          You've completed {elig.progress_percent}% of this course. We keep 15% (
                          {formatCurrency(elig.kept_amount_cents ?? 0, order.currency)}) and refund{' '}
                          {formatCurrency(elig.refund_amount_cents ?? 0, order.currency)} to your original payment
                          method.
                        </p>

                        <label className="mt-3 block">
                          <span className="text-sm font-medium">Reason</span>
                          <select
                            className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground"
                            value={reasonCode}
                            onChange={(e) => setReasonCode(e.target.value)}
                          >
                            <option value="">Select a reason…</option>
                            {REASON_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="mt-3 block">
                          <span className="text-sm font-medium">Additional details (optional)</span>
                          <textarea
                            rows={2}
                            className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground"
                            value={reasonText}
                            onChange={(e) => setReasonText(e.target.value)}
                          />
                        </label>

                        {refundMutation.isError && (
                          <p role="alert" className="mt-3 text-sm text-destructive">
                            {(refundMutation.error as { response?: { data?: { detail?: string } } })?.response?.data
                              ?.detail ?? 'Something went wrong. Please try again.'}
                          </p>
                        )}

                        {refundMutation.isSuccess ? (
                          <div className="mt-4 flex items-center gap-2 rounded-md bg-primary/10 p-3 text-sm text-primary">
                            <CheckCircle className="size-4 shrink-0" />
                            Your refund has been processed. We've emailed you a confirmation.
                          </div>
                        ) : (
                          <div className="mt-4 flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              loading={refundMutation.isPending}
                              disabled={!reasonCode}
                              onClick={() => refundMutation.mutate()}
                            >
                              Confirm refund
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setRefundingOrderId(null)}>
                              Cancel
                            </Button>
                          </div>
                        )}
                      </>
                    ) : null}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {hasNextPage && (
        <div className="mt-6 flex justify-center">
          <Button variant="outline" loading={isFetchingNextPage} onClick={() => fetchNextPage()}>
            Load more
          </Button>
        </div>
      )}
    </Shell>
  )
}
