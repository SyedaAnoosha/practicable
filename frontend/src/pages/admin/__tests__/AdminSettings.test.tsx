// Regression coverage for a real gap found during Phase 6C verification
// (week4_plan.md): step 8 says /admin/settings uses `useAutosave` and
// `useFieldValidation`, but the page used a hand-rolled dirty/Save-button
// flow with no validation at all — a required field (frontend_url) could be
// emptied and saved with no error shown. Fixed by wiring both established
// hooks in, matching the pattern AdminCourses.tsx/AdminProducts.tsx already
// use elsewhere in this codebase.
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AdminSettings } from '../AdminSettings'

const mockConfigStatus = [
  { name: 'frontend_url', required: true, is_set: true },
  { name: 'seller_legal_name', required: false, is_set: false },
]

const mockSettings = [
  { key: 'frontend_url', value: 'https://example.com', updated_at: null, updated_by: null },
  { key: 'seller_legal_name', value: '', updated_at: null, updated_by: null },
]

const putMock = vi.fn().mockResolvedValue({ data: {} })

vi.mock('@/lib/api/client', () => ({
  api: {
    get: vi.fn().mockImplementation((url: string) => {
      if (url.includes('status')) return Promise.resolve({ data: mockConfigStatus })
      return Promise.resolve({ data: mockSettings })
    }),
    put: (url: string, body: unknown) => putMock(url, body),
  },
}))

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AdminSettings />
    </QueryClientProvider>,
  )
}

describe('AdminSettings', () => {
  it('shows a validation error when the required field is blurred empty, and does not save', async () => {
    const user = userEvent.setup()
    renderPage()

    const input = await screen.findByLabelText(/frontend url/i)
    await user.clear(input)
    await user.tab() // blur

    expect(await screen.findByText(/frontend url is required/i)).toBeInTheDocument()
  })

  it('has no validation rule blocking an optional field', async () => {
    const user = userEvent.setup()
    renderPage()

    const input = await screen.findByLabelText(/seller legal name/i)
    await user.clear(input)
    await user.tab()

    expect(screen.queryByText(/seller legal name is required/i)).not.toBeInTheDocument()
  })
})
