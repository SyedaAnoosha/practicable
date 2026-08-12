import { useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Mail } from 'lucide-react'
import { api } from '@/lib/api/client'
import { useAuthStore } from '@/stores/useAuthStore'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

// One shared flag, not per-question: giving an email once unlocks every free question.
const UNLOCK_STORAGE_KEY = 'practicable:email_unlocked'
const PREVIEW_CHAR_TARGET = 350

function readUnlocked(): boolean {
  try {
    return window.localStorage.getItem(UNLOCK_STORAGE_KEY) === 'true'
  } catch {
    // Private-browsing/storage-disabled — fail open to "not unlocked" rather than throw.
    return false
  }
}

// Length-based, not paragraph-based: real question bodies are often one long block with
// no newlines, where splitting on paragraph breaks finds none and gates nothing. Cuts at
// a sentence boundary at or after the target length, so it never lands mid-word.
function splitPreview(body: string): [preview: string, rest: string] {
  if (body.length <= PREVIEW_CHAR_TARGET) return [body, '']
  const periodIndex = body.indexOf('. ', PREVIEW_CHAR_TARGET)
  const splitAt = periodIndex === -1 ? body.length : periodIndex + 1
  return [body.slice(0, splitAt).trim(), body.slice(splitAt).trim()]
}

// The free entry point that earns an email address. Deliberately a soft gate, not a
// security boundary — the backend already sends the full body to every visitor, and the
// paid product is the template/lesson bundle, not the written question.
export function EmailGatedBody({ body }: { body: string }) {
  const [emailGiven, setEmailGiven] = useState(readUnlocked)
  const [email, setEmail] = useState('')

  // Being signed in satisfies the gate outright — it's stronger evidence than the lead
  // form collects. Keying off localStorage alone re-prompted signed-up users, who then
  // couldn't clear the gate at all, since the form posts a new lead.
  const signedIn = useAuthStore((s) => s.user) !== null
  const unlocked = signedIn || emailGiven

  const [previewText, restText] = splitPreview(body)

  const { mutate, isPending, isError } = useMutation({
    mutationFn: () => api.post('/leads', { email, source: 'question_email_gate' }),
    onSuccess: () => {
      try {
        window.localStorage.setItem(UNLOCK_STORAGE_KEY, 'true')
      } catch {
        // Storage unavailable — still unlock this render via state below.
      }
      setEmailGiven(true)
    },
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    mutate()
  }

  // Short questions with nothing left after the preview don't need a gate at all.
  if (unlocked || !restText) {
    return <p className="mt-4 whitespace-pre-line font-serif text-read text-pretty text-foreground">{body}</p>
  }

  return (
    <div>
      <p className="mt-4 whitespace-pre-line font-serif text-read text-pretty text-foreground">{previewText}</p>

      {/* The teaser and the form card are siblings in normal flow: the teaser gets a
          fixed max height (so it reads as "there's more" at every width), and the card
          is pulled up over its faded tail with a negative margin. The card must not
          live inside this `overflow-hidden` block — its height varies with viewport
          width, which clipped the submit button off the page on desktop. */}
      <div
        aria-hidden="true"
        className="relative mt-4 max-h-44 overflow-hidden rounded-lg sm:max-h-56"
      >
        {/* Decorative only — just to show there's more. */}
        <p className="pointer-events-none select-none whitespace-pre-line font-serif text-read text-pretty text-foreground/30 blur-[3px]">
          {restText}
        </p>
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(180deg, transparent 20%, var(--background) 92%)' }}
        />
      </div>

      <form
        onSubmit={handleSubmit}
        className="relative z-10 mx-auto -mt-20 w-full max-w-sm rounded-xl border border-border bg-card p-6 text-center shadow-lg sm:-mt-24"
      >
        {/* Gold, not blue: this is a warm invitation rather than a system action. */}
        <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-gold-soft text-gold-strong ring-1 ring-inset ring-gold/40">
          <Mail className="size-5" aria-hidden="true" />
        </span>
        <p className="mt-3 font-sans font-semibold">Keep reading — free</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter your email to unlock the rest of this guidance.
        </p>
        <label htmlFor="gate-email" className="sr-only">
          Your email address
        </label>
        <Input
          id="gate-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="mt-4"
        />
        <Button type="submit" loading={isPending} className="mt-3 w-full">
          Unlock the rest
        </Button>
        {isError && (
          <p role="alert" className="mt-2 text-xs text-destructive">
            Something went wrong — please try again.
          </p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">No spam, unsubscribe any time.</p>
      </form>
    </div>
  )
}
