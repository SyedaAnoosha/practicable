// Originally written for Phase 6B DoD's "the page renders with both PostHog keys
// unset". PostHog has since been removed from the project entirely (no client-side
// analytics of any kind), which makes the original premise moot — kept as a general
// AdminMetrics render smoke test instead, since it's still real coverage of the page
// rendering its data end to end.
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AdminMetrics } from '../AdminMetrics'

const mockMetricsData = {
  metrics: [
    {
      name: 'second_purchase_rate',
      numerator: 1,
      denominator: 2,
      description: 'Buyers with 2+ orders / total buyers',
    },
    {
      name: 'total_revenue',
      numerator: 4900,
      denominator: 1,
      description: 'Total revenue in cents (all time)',
    },
    {
      name: 'enrollments',
      numerator: 3,
      denominator: 1,
      description: 'Active enrollments',
    },
    {
      name: 'download_links_issued',
      numerator: 0,
      denominator: 1,
      description: 'Links issued',
    },
  ],
  generated_at: '2026-08-20T00:00:00Z',
  revenue_gross_cents: 4900,
  revenue_refunded_cents: 0,
  revenue_net_cents: 4900,
  enrollment_splits: { purchase: 3 },
  product_rankings: [
    { id: '1', name: 'Product A', units: 1, revenue_cents: 4900, revenue_dollars: 49.0 },
  ],
  download_links_issued: 0,
  course_enrollment_rankings: [
    { id: '1', title: 'Course A', enrolled: 3, started: 2, completed: 1 },
  ],
}

// Mock both API endpoints
vi.mock('@/lib/api/client', () => ({
  api: {
    get: vi.fn().mockImplementation((url: string) => {
      if (url.includes('revenue-series')) {
        return Promise.resolve({
          data: { data: [], period: 'daily' },
        })
      }
      return Promise.resolve({ data: mockMetricsData })
    }),
  },
}))

describe('AdminMetrics', () => {
  it('renders the metrics page end to end from real data', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <AdminMetrics />
      </QueryClientProvider>,
    )

    // The page title renders immediately (doesn't depend on data)
    const heading = await screen.findByRole('heading', { name: /metrics/i })
    expect(heading).toBeInTheDocument()

    // Wait for data to load — verify key sections render
    await waitFor(() => {
      expect(screen.getByText('Gross revenue')).toBeInTheDocument()
    })

    expect(screen.getByText('Net revenue')).toBeInTheDocument()
    expect(screen.getByText('Refunded')).toBeInTheDocument()
    expect(screen.getByText('purchase enrollments')).toBeInTheDocument()
    expect(screen.getByText('Product A')).toBeInTheDocument()
    expect(screen.getByText('Course A')).toBeInTheDocument()

    // The chart section exists with the trends heading
    expect(screen.getByText('Trends')).toBeInTheDocument()

    // No uncaught errors anywhere in the render tree — if one occurred, we'd see an
    // error boundary, not these elements.
    expect(screen.getByText('Key performance indicators for the platform.')).toBeInTheDocument()
  })
})
