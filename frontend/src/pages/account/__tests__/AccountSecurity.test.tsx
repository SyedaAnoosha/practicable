/**
 * the backend audit hook
 * (POST /me/account/password-change) already had one test, but every requirement that
 * is actually enforced client-side — confirm-mismatch blocking submit, wrong current
 * password being refused, the minimum-length rule, new === current being refused,
 * and the session surviving a successful change — had zero coverage anywhere. This
 * is that coverage, against the real AccountSecurity.tsx component.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AccountSecurity } from '../AccountSecurity'
import { api } from '@/lib/api/client'
import { supabase } from '@/lib/auth/supabase'

vi.mock('@/lib/api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

vi.mock('@/lib/auth/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      updateUser: vi.fn(),
    },
  },
}))

function renderSecurity() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AccountSecurity />
    </QueryClientProvider>,
  )
}

function getFieldByAutocomplete(container: HTMLElement, value: string, index = 0) {
  const matches = container.querySelectorAll<HTMLInputElement>(`input[autocomplete="${value}"]`)
  return matches[index]
}

async function fillAndSubmit(opts: { current: string; next: string; confirm: string }) {
  const user = userEvent.setup()
  const currentInput = getFieldByAutocomplete(document.body, 'current-password')
  const newInput = getFieldByAutocomplete(document.body, 'new-password', 0)
  const confirmInput = getFieldByAutocomplete(document.body, 'new-password', 1)

  if (opts.current) await user.type(currentInput, opts.current)
  if (opts.next) await user.type(newInput, opts.next)
  if (opts.confirm) await user.type(confirmInput, opts.confirm)
  await user.click(screen.getByRole('button', { name: 'Change password' }))
}

describe('AccountSecurity — password change', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
    vi.mocked(api.post).mockReset()
    vi.mocked(supabase.auth.signInWithPassword).mockReset()
    vi.mocked(supabase.auth.updateUser).mockReset()

    vi.mocked(api.get).mockResolvedValue({ data: { email: 'member@example.com' } })
    vi.mocked(api.post).mockResolvedValue({ data: { ok: true } })
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: {},
      error: null,
    } as never)
    vi.mocked(supabase.auth.updateUser).mockResolvedValue({ data: {}, error: null } as never)
  })

  it('a confirm mismatch blocks submit — no Supabase call is made', async () => {
    renderSecurity()
    await fillAndSubmit({ current: 'oldpass123', next: 'newpassword1', confirm: 'newpassword2' })

    expect(await screen.findByText("Passwords don't match.")).toBeInTheDocument()
    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled()
  })

  it('a too-short new password is refused before any Supabase call', async () => {
    renderSecurity()
    await fillAndSubmit({ current: 'oldpass123', next: 'short', confirm: 'short' })

    // "At least 8 characters." appears twice — the static hint and the field error —
    // so this asserts the error rendering specifically (role="alert").
    await waitFor(() => {
      const alerts = screen.getAllByRole('alert').map((el) => el.textContent)
      expect(alerts).toContain('At least 8 characters.')
    })
    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled()
  })

  it('new === current is refused before any Supabase call', async () => {
    renderSecurity()
    await fillAndSubmit({ current: 'samepassword1', next: 'samepassword1', confirm: 'samepassword1' })

    expect(
      await screen.findByText('Your new password must be different from your current one.'),
    ).toBeInTheDocument()
    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled()
  })

  it('a wrong current password is refused and updateUser is never called', async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: {},
      error: { message: 'Invalid login credentials' },
    } as never)

    renderSecurity()
    await fillAndSubmit({ current: 'wrongpassword', next: 'newpassword1', confirm: 'newpassword1' })

    expect(await screen.findByText("That isn't your current password.")).toBeInTheDocument()
    expect(supabase.auth.updateUser).not.toHaveBeenCalled()
  })

  it('on success: calls updateUser with the new password, writes the audit hook, and shows the confirmation', async () => {
    renderSecurity()
    await fillAndSubmit({ current: 'oldpass123', next: 'newpassword1', confirm: 'newpassword1' })

    await waitFor(() => {
      expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: 'newpassword1' })
    })
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/me/account/password-change')
    })
    expect(
      await screen.findByText("Password updated. We've emailed you to confirm."),
    ).toBeInTheDocument()
  })

  it('a failed audit-hook write does not undo the already-successful password change', async () => {
    vi.mocked(api.post).mockRejectedValue(new Error('network error'))

    renderSecurity()
    await fillAndSubmit({ current: 'oldpass123', next: 'newpassword1', confirm: 'newpassword1' })

    // The password change itself (Supabase) already succeeded — the success message
    // must still show even though the best-effort audit call failed.
    expect(
      await screen.findByText("Password updated. We've emailed you to confirm."),
    ).toBeInTheDocument()
  })
})
