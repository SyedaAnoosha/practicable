/**
 * Phase 10 (§10A re-verification, 2026-08-22): POST /me/account/email-changed exists
 * on the backend and its own docstring says "After Supabase confirms the new email,
 * the frontend calls this" — but nothing did. AccountProfile.tsx's
 * `updateUser({ email })` only *requests* the change; the email does not actually
 * change until the confirmation link is clicked (Supabase re-signs the session then,
 * firing `onAuthStateChange`). RootLayout is the one app-wide place session state is
 * observed (its own comment: "every layout and page reads session state from
 * useAuthStore, never from Supabase directly"), so that's where the confirmed-email
 * transition is caught: compare the previous session's email to the incoming one on
 * every auth-state change, and fire the audit hook only when they differ.
 *
 * This test proves that behavior directly against `onAuthStateChange`, without
 * needing a real Supabase server: it mocks the client, captures the callback
 * RootLayout registers, then fires it twice — once with no real change (a same-email
 * USER_UPDATED, e.g. from a password change) and once with a genuine email
 * transition — asserting the hook fires only for the latter.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import RootLayout from '../RootLayout'
import { api } from '@/lib/api/client'
import { supabase } from '@/lib/auth/supabase'

vi.mock('@/lib/api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}))

type AuthStateCallback = (event: string, session: unknown) => void

let capturedCallback: AuthStateCallback | undefined
const unsubscribe = vi.fn()

vi.mock('@/lib/auth/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
    },
  },
}))

function makeSession(email: string) {
  return {
    access_token: 'token',
    user: { id: 'user-1', email },
  }
}

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <RootLayout />
    </MemoryRouter>,
  )
}

describe('RootLayout — email-change audit hook', () => {
  beforeEach(() => {
    vi.mocked(api.post).mockReset()
    vi.mocked(api.post).mockResolvedValue({ data: {} })
    capturedCallback = undefined

    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: makeSession('original@example.com') },
    } as never)

    vi.mocked(supabase.auth.onAuthStateChange).mockImplementation(((
      cb: AuthStateCallback,
    ) => {
      capturedCallback = cb
      return { data: { subscription: { unsubscribe } } }
    }) as never)
  })

  it('does not call the audit hook when the email is unchanged (e.g. a password-change USER_UPDATED event)', async () => {
    renderLayout()

    await waitFor(() => expect(capturedCallback).toBeDefined())

    await act(async () => {
      capturedCallback!('USER_UPDATED', makeSession('original@example.com'))
    })

    await waitFor(() => {
      expect(api.post).not.toHaveBeenCalled()
    })
  })

  it('calls POST /me/account/email-changed with the new address on a genuine email transition', async () => {
    renderLayout()

    await waitFor(() => expect(capturedCallback).toBeDefined())

    await act(async () => {
      capturedCallback!('USER_UPDATED', makeSession('new@example.com'))
    })

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/me/account/email-changed', {
        new_email: 'new@example.com',
      })
    })
  })

  it('does not fire twice for the same transition on a second identical event', async () => {
    renderLayout()

    await waitFor(() => expect(capturedCallback).toBeDefined())

    await act(async () => {
      capturedCallback!('USER_UPDATED', makeSession('new@example.com'))
    })
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1))

    await act(async () => {
      capturedCallback!('TOKEN_REFRESHED', makeSession('new@example.com'))
    })

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledTimes(1)
    })
  })
})
