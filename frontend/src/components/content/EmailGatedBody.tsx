import { useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Mail } from 'lucide-react'
import { api } from '@/lib/api/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

// One shared flag, not per-question: giving an email once should unlock every free
// question, not re-prompt on the next one — the point is capturing the email, not
// gatekeeping any specific article.
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

// Length-based, not paragraph-based — the real seeded question body is one 1,000+
// character block with zero newlines (confirmed directly against the live DB), so an
// earlier version of this that split on blank-line paragraph breaks found none, fell
// through to its "nothing to gate" branch, and showed the entire body unblurred with
// no gate at all. This instead finds a sentence boundary at or after the target
// length, so the cut lands after a period, never mid-word — works the same whether
// the source text has paragraph breaks or not.
function splitPreview(body: string): [preview: string, rest: string] {
  if (body.length <= PREVIEW_CHAR_TARGET) return [body, '']
  const periodIndex = body.indexOf('. ', PREVIEW_CHAR_TARGET)
  const splitAt = periodIndex === -1 ? body.length : periodIndex + 1
  return [body.slice(0, splitAt).trim(), body.slice(splitAt).trim()]
}

// The free entry point (intern brief: "at least one free entry point that earns an
// email address"). This is deliberately a soft gate, not a security boundary: the
// backend already sends the full body to every visitor (app/api/v1/content/
// questions.py) — the paid product is the template/lesson bundle, not the written
// question. Blur + email capture is a conversion device, matched to how virtually
// every content-marketing email-gate works; it would be the wrong tool if this body
// were the thing actually being sold.
export function EmailGatedBody({ body }: { body: string }) {
  const [unlocked, setUnlocked] = useState(readUnlocked)
  const [email, setEmail] = useState('')

  const [previewText, restText] = splitPreview(body)

  const { mutate, isPending, isError } = useMutation({
    mutationFn: () => api.post('/leads', { email, source: 'question_email_gate' }),
    onSuccess: () => {
      try {
        window.localStorage.setItem(UNLOCK_STORAGE_KEY, 'true')
      } catch {
        // Storage unavailable — still unlock this render via state below.
      }
      setUnlocked(true)
    },
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    mutate()
  }

  // Short questions with nothing left after the preview don't need a gate at all.
  // The serif reading rhythm is the §10 `read` token (1.7 line-height, carried by
  // text-read itself) — no leading override, text-pretty for even paragraph shaping.
  if (unlocked || !restText) {
    return <p className="mt-4 whitespace-pre-line font-serif text-read text-pretty text-foreground">{body}</p>
  }

  return (
    <div>
      <p className="mt-4 whitespace-pre-line font-serif text-read text-pretty text-foreground">{previewText}</p>
      <div className="relative mt-4 overflow-hidden rounded-lg">
        {/* Decorative only — not meant to be read, just to show there's more; the
            actual content lives behind the form below, not in this hidden text. */}
        <p
          aria-hidden="true"
          className="pointer-events-none select-none whitespace-pre-line font-serif text-read text-pretty text-foreground/30 blur-[3px]"
        >
          {restText}
        </p>
        <div
          className="absolute inset-0 flex items-start justify-center pt-6"
          style={{ background: 'linear-gradient(180deg, transparent, var(--background) 40%)' }}
        >
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-sm rounded-xl border border-border bg-card p-6 text-center shadow-lg"
          >
            <Mail className="mx-auto size-6 text-primary" aria-hidden="true" />
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
      </div>
    </div>
  )
}
