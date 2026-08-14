import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import { useAuthStore } from '@/stores/useAuthStore'
import { track } from '@/lib/analytics'

// One shared flag, not one per item: giving an email once unlocks every free entry
// point — the free question's guidance, the free template's download page, and the same
// template when it appears as a lesson inside the course. The point is capturing the
// address, not counting how many times we can ask for it.
//
// This key and the unlock rule used to be copy-pasted into each gated component, which
// meant three places could quietly disagree about what "unlocked" meant. They are here
// now so that cannot happen.
export const UNLOCK_STORAGE_KEY = 'practicable:email_unlocked'

export function readUnlocked(): boolean {
  try {
    return window.localStorage.getItem(UNLOCK_STORAGE_KEY) === 'true'
  } catch {
    // Private browsing / storage disabled — fail closed to "not unlocked" rather than
    // throwing. The gate is a conversion device, so the cost of being wrong is a
    // re-prompt, not a lockout.
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
  // the lead form collects, and the backend records a `signup` lead for every new user
  // anyway (app/core/deps.py). Keying off localStorage alone re-prompted signed-up
  // users, who then could not clear the gate at all — submitting just posted another
  // lead for an address already on file.
  const signedIn = useAuthStore((s) => s.user) !== null
  const unlocked = signedIn || emailGiven

  // week2_plan.md Phase 5 — fires once per gate actually being SHOWN (not once per
  // render): a ref rather than a dependency-array effect, because `unlocked` flipping
  // true is exactly the transition that must NOT re-fire this.
  const shown = useRef(false)
  useEffect(() => {
    if (!unlocked && !shown.current) {
      shown.current = true
      track('email_gate_shown', { source })
    }
  }, [unlocked, source])

  const mutation = useMutation({
    mutationFn: () => api.post('/leads', { email, source }),
    onSuccess: () => {
      try {
        window.localStorage.setItem(UNLOCK_STORAGE_KEY, 'true')
      } catch {
        // Storage unavailable — still unlock this render via state below.
      }
      setEmailGiven(true)
      track('email_captured', { source })
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
