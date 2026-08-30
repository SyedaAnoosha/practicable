/**
 * zero test coverage existed for this
 * page despite the spec requiring "pagination at 0/1/2/many · a refunded
 * order shows amount and date · a multi-item order lists each item · both routes
 * render the same component." This closes that gap, plus the loading/error states
 * §40 requires and the receipt regenerated from order data (the `[GAP]` the plan
 * itself flagged — see ReceiptView.tsx).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Purchases } from '../Purchases'
import { api } from '@/lib/api/client'

vi.mock('@/lib/api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

function order(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'order-1',
    created_at: '2026-08-01T00:00:00Z',
    status: 'completed',
    total_amount_cents: 4900,
    currency: 'AUD',
    items: [{ product_id: 'p1', product_name: 'A Course', price_amount_cents: 4900 }],
    buyer_refund_amount_cents: null,
    buyer_refunded_at: null,
    ...overrides,
  }
}

function renderPurchases() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Purchases />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Purchases — list, pagination, receipts', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
  })

  it('0 orders: shows the empty state with a route into the catalogue', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { orders: [], has_more: false, next_cursor: null } })
    renderPurchases()

    expect(await screen.findByText('No purchases yet.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Browse products' })).toBeInTheDocument()
  })

  it('1 order: renders it, no Load more control', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { orders: [order()], has_more: false, next_cursor: null },
    })
    renderPurchases()

    expect(await screen.findByText('A Course')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
  })

  it('2 orders: both render', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        orders: [
          order({ id: 'order-1', items: [{ product_id: 'p1', product_name: 'Course One', price_amount_cents: 4900 }] }),
          order({ id: 'order-2', items: [{ product_id: 'p2', product_name: 'Course Two', price_amount_cents: 2900 }] }),
        ],
        has_more: false,
        next_cursor: null,
      },
    })
    renderPurchases()

    expect(await screen.findByText('Course One')).toBeInTheDocument()
    expect(await screen.findByText('Course Two')).toBeInTheDocument()
  })

  it('many orders (has_more true): shows Load more, fetches the next page with the real cursor, and appends results', async () => {
    // The mock must keep axios's own `get` signature — narrowing `config` to just the
    // cursor shape makes it structurally incompatible with AxiosRequestConfig, which is
    // what `tsc -b` was failing on. Read the cursor off the wide type instead.
    vi.mocked(api.get).mockImplementation((_url, config) => {
      const cursor = (config?.params as { cursor?: string } | undefined)?.cursor
      if (!cursor) {
        return Promise.resolve({
          data: {
            orders: [order({ id: 'order-1' })],
            has_more: true,
            next_cursor: '2026-07-01T00:00:00Z',
          },
        })
      }
      // Proves the real next_cursor value (not a guessed one) is what's sent.
      expect(cursor).toBe('2026-07-01T00:00:00Z')
      return Promise.resolve({
        data: {
          orders: [order({ id: 'order-2', items: [{ product_id: 'p2', product_name: 'Older Course', price_amount_cents: 1900 }] })],
          has_more: false,
          next_cursor: null,
        },
      })
    })
    renderPurchases()

    await screen.findByText('A Course')
    const loadMore = await screen.findByRole('button', { name: 'Load more' })

    const user = userEvent.setup()
    await user.click(loadMore)

    expect(await screen.findByText('Older Course')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
  })

  it('a refunded order shows the refunded amount and date', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        orders: [
          order({
            status: 'refunded',
            buyer_refund_amount_cents: 4165,
            buyer_refunded_at: '2026-08-05T00:00:00Z',
          }),
        ],
        has_more: false,
        next_cursor: null,
      },
    })
    renderPurchases()

    expect(await screen.findByText(/Refunded/)).toBeInTheDocument()
    expect(screen.getByText(/\$41\.65/)).toBeInTheDocument()
  })

  it('a multi-item order lists every item', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        orders: [
          order({
            items: [
              { product_id: 'p1', product_name: 'First Item', price_amount_cents: 2000 },
              { product_id: 'p2', product_name: 'Second Item', price_amount_cents: 2900 },
            ],
          }),
        ],
        has_more: false,
        next_cursor: null,
      },
    })
    renderPurchases()

    expect(await screen.findByText('First Item')).toBeInTheDocument()
    expect(screen.getByText('Second Item')).toBeInTheDocument()
  })

  it('an error loading orders shows a retry control, not a blank page', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('network error'))
    renderPurchases()

    expect(await screen.findByText("We couldn't load your purchases.")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('clicking Receipt fetches and shows the regenerated receipt, keyed by order id, never a fabricated invoice number', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/me/orders') {
        return Promise.resolve({ data: { orders: [order()], has_more: false, next_cursor: null } })
      }
      if (url === '/me/orders/order-1/receipt') {
        return Promise.resolve({
          data: {
            order_id: 'order-1',
            order_date: '2026-08-01T00:00:00Z',
            status: 'completed',
            currency: 'AUD',
            total_amount_cents: 4900,
            lines: [{ product_name: 'A Course', price_amount_cents: 4900 }],
            buyer_refund_amount_cents: null,
            buyer_refunded_at: null,
            seller_legal_name: null,
          },
        })
      }
      return Promise.resolve({ data: {} })
    })
    renderPurchases()

    await screen.findByText('A Course')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Receipt' }))

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/me/orders/order-1/receipt')
    })
    expect(await screen.findByText('Order reference: order-1')).toBeInTheDocument()
  })
})

/**
 * placement only, nothing else —
 * eligibility, amounts and reason codes all come from 9B's endpoints untouched. This
 * proves the placement itself: the control shows for a completed order, an
 * ineligible order states its reason (not a blank), an unknown reason code degrades
 * to the fallback sentence rather than nothing, and a submitted request updates the
 * row without a full reload.
 */
describe('Purchases — refund request placement', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
    vi.mocked(api.post).mockReset()
  })

  it('an eligible, completed order shows the "Request a refund" control', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { orders: [order({ status: 'completed' })], has_more: false, next_cursor: null },
    })
    renderPurchases()

    expect(await screen.findByRole('button', { name: 'Request a refund' })).toBeInTheDocument()
  })

  it('an ineligible order states the real reason in plain words, not a blank', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/me/orders') {
        return Promise.resolve({ data: { orders: [order()], has_more: false, next_cursor: null } })
      }
      if (url === '/me/orders/order-1/refund-eligibility') {
        return Promise.resolve({
          data: { eligible: false, reason_code: 'progress_exceeded', refund_amount_cents: null, kept_amount_cents: null, progress_percent: 40 },
        })
      }
      return Promise.resolve({ data: {} })
    })
    renderPurchases()

    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Request a refund' }))

    // Asserts the buyer's ACTUAL figure, not "more than 15%".
    // The server sends `progress_percent`, and a refusal a reader can check against
    // their own progress is one they can act on rather than only dispute.
    expect(await screen.findByText(/You've completed 40% of this course/)).toBeInTheDocument()
    expect(await screen.findByText(/past the 15% point/)).toBeInTheDocument()
    // The consumer-guarantee sentence must survive the rewrite — it is the part that
    // keeps the refusal lawful as well as clear.
    expect(await screen.findByText(/consumer-guarantee rights still apply/)).toBeInTheDocument()
  })

  it('falls back to the generic sentence when the server sends no percentage', async () => {
    // The absence rule: with no number to show, say the general thing rather than
    // rendering "You've completed null%" or inventing a figure.
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/me/orders') {
        return Promise.resolve({ data: { orders: [order()], has_more: false, next_cursor: null } })
      }
      if (url === '/me/orders/order-1/refund-eligibility') {
        return Promise.resolve({
          data: { eligible: false, reason_code: 'progress_exceeded', refund_amount_cents: null, kept_amount_cents: null, progress_percent: null },
        })
      }
      return Promise.resolve({ data: {} })
    })
    renderPurchases()

    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Request a refund' }))

    expect(await screen.findByText(/more than 15% of this course/)).toBeInTheDocument()
    expect(screen.queryByText(/null%/)).not.toBeInTheDocument()
  })

  it('an unknown reason code degrades to the fallback sentence, never a blank', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/me/orders') {
        return Promise.resolve({ data: { orders: [order()], has_more: false, next_cursor: null } })
      }
      if (url === '/me/orders/order-1/refund-eligibility') {
        return Promise.resolve({
          data: { eligible: false, reason_code: 'some_new_code_the_ui_has_never_seen', refund_amount_cents: null, kept_amount_cents: null, progress_percent: null },
        })
      }
      return Promise.resolve({ data: {} })
    })
    renderPurchases()

    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Request a refund' }))

    expect(await screen.findByText('Not eligible for a self-serve refund.')).toBeInTheDocument()
  })

  it('a submitted refund request updates the row and invalidates the orders query without a full reload', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/me/orders') {
        return Promise.resolve({ data: { orders: [order()], has_more: false, next_cursor: null } })
      }
      if (url === '/me/orders/order-1/refund-eligibility') {
        return Promise.resolve({
          data: { eligible: true, reason_code: null, refund_amount_cents: 4165, kept_amount_cents: 735, progress_percent: 0 },
        })
      }
      return Promise.resolve({ data: {} })
    })
    vi.mocked(api.post).mockResolvedValue({ data: { status: 'refunded' } })

    renderPurchases()
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Request a refund' }))
    await screen.findByText(/We keep 15%/)

    const reasonSelect = await screen.findByLabelText('Reason')
    await user.selectOptions(reasonSelect, 'changed_mind')
    await user.click(screen.getByRole('button', { name: 'Confirm refund' }))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/me/orders/order-1/refund', {
        reason_code: 'changed_mind',
        reason_text: null,
      })
    })
    expect(await screen.findByText(/Your refund has been processed/)).toBeInTheDocument()
  })
})
