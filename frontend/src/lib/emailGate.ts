import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import { useAuthStore } from '@/stores/useAuthStore'

// One shared flag, not one per item: giving an email once unlocks every free entry
// point. Kept in one place so gated components can't quietly disagree about what
// "unlocked" means.
export const UNLOCK_STORAGE_KEY = 'practicable:email_unlocked'

export function readUnlocked(): boolean {
  try {
    return window.localStorage.getItem(UNLOCK_STORAGE_KEY) === 'true'
  } catch {
    // Private browsing / storage disabled — fail closed to "not unlocked" rather than
    // throwing.
    return false
  }
}

/** Shared state for every email-capture gate.
 *
 * `source` records which entry point earned the address, and is stored on the lead row
 * — the whole reason the gate exists is to learn which door people came through.
 */
export function useEmailGate(source: string) {
  const [emailGiven, setEmailGiven] = useState(readUnlocked)
  const [email, setEmail] = useState('')

  // Being signed in satisfies the gate outright: an account is stronger evidence than
  // the lead form collects. Keying off localStorage alone re-prompted signed-up users,
  // who then couldn't clear the gate at all.
  const signedIn = useAuthStore((s) => s.user) !== null
  const unlocked = signedIn || emailGiven

  const mutation = useMutation({
    mutationFn: () => api.post('/leads', { email, source }),
    onSuccess: () => {
      try {
        window.localStorage.setItem(UNLOCK_STORAGE_KEY, 'true')
      } catch {
        // Storage unavailable — still unlock this render via state below.
      }
      setEmailGiven(true)
    },
  })

  return {
    unlocked,
    email,
    setEmail,
    submit: () => mutation.mutate(),
    isPending: mutation.isPending,
    isError: mutation.isError,
  }
}
