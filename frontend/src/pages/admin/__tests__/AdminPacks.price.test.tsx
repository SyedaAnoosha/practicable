/**
 * Phase 9A re-verification (2026-08-21): "Price editable from the course, template
 * and pack editors, through one endpoint" — but AdminPacks.tsx only ever let a price
 * be set at pack *creation*; there was no control to change an existing pack's price
 * afterward (courses and templates both had one, via POST /admin/products/{id}/price).
 * This is that control and this is the test proving it calls the one shared endpoint.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AdminPacks } from '../AdminPacks'
import { api } from '@/lib/api/client'

vi.mock('@/lib/api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}))

const mockPack = {
  id: 'pack-1',
  slug: 'test-pack',
  name: 'Test Pack',
  description: 'A pack under test.',
  price_amount: 4900,
  currency: 'AUD',
  stripe_price_id: 'price_existing',
  published: true,
  publish_state: 'published',
  is_bundle: true,
  template_count: 1,
  question_count: 1,
  contents: [],
  readiness: 'ready',
  readiness_message: 'Pack is published and ready',
}

function renderPacks() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/admin/packs']}>
        <AdminPacks />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('AdminPacks — price control on an existing pack', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/admin/packs') return Promise.resolve({ data: [mockPack] })
      if (url === '/admin/packs/available-templates') return Promise.resolve({ data: [] })
      if (url === '/admin/packs/available-questions') return Promise.resolve({ data: [] })
      return Promise.resolve({ data: [] })
    })
    vi.mocked(api.post).mockResolvedValue({ data: {} })
  })

  it('changing an existing pack price calls POST /admin/products/{id}/price with dollars converted to cents — the one shared endpoint, dollars in the UI per project convention', async () => {
    const user = userEvent.setup()
    renderPacks()

    await waitFor(() => expect(screen.getByText('Test Pack')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Change price' }))

    // The admin types dollars, not cents — this is the actual defect this test guards:
    // the field previously took raw cents (label read "Price (cents, e.g. 4900)"),
    // inconsistent with every other price field in the app.
    const priceInput = screen.getByPlaceholderText('Price in dollars, e.g. 49.00')
    await user.type(priceInput, '55.00')
    await user.click(screen.getByRole('button', { name: 'Set price' }))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/admin/products/pack-1/price',
        expect.objectContaining({ price_amount: 5500, currency: 'AUD' }),
      )
    })
  })
})
