/**
 * Phase 10 (§10E re-verification, 2026-08-22): the backend side of this page had
 * good coverage; the page itself had none. This proves the two toggles round-trip
 * to the real PATCH payload and that transactional-mail reassurance copy is present
 * (the DoD's own "the page says so" requirement).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AccountNotifications } from '../AccountNotifications'
import { api } from '@/lib/api/client'

vi.mock('@/lib/api/client', () => ({
  api: {
    get: vi.fn(),
    patch: vi.fn(),
  },
}))

function renderNotifications() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AccountNotifications />
    </QueryClientProvider>,
  )
}

describe('AccountNotifications', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
    vi.mocked(api.patch).mockReset()
    vi.mocked(api.get).mockResolvedValue({
      data: { notify_marketing: false, notify_product_updates: true },
    })
    vi.mocked(api.patch).mockResolvedValue({ data: {} })
  })

  it('marketing defaults off, product updates defaults on — matches the checkbox state', async () => {
    renderNotifications()

    const marketing = await screen.findByRole('checkbox', { name: /Occasional updates/ })
    const productUpdates = screen.getByRole('checkbox', { name: /Product updates/ })

    expect(marketing).not.toBeChecked()
    expect(productUpdates).toBeChecked()
  })

  it('states plainly that transactional mail is never suppressed', async () => {
    renderNotifications()
    expect(
      await screen.findByText(/Receipts, access emails, and security alerts always arrive/),
    ).toBeInTheDocument()
  })

  it('toggling marketing on and saving sends the real PATCH payload', async () => {
    renderNotifications()
    const user = userEvent.setup()

    const marketing = await screen.findByRole('checkbox', { name: /Occasional updates/ })
    await user.click(marketing)
    await user.click(screen.getByRole('button', { name: 'Save preferences' }))

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/me/account/notifications', {
        notify_marketing: true,
        notify_product_updates: true,
      })
    })
  })
})
