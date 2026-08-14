import { useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { ArrowUpRight, Check } from 'lucide-react'
import { api } from '@/lib/api/client'

/** The joined input + button from footer-7 / footer-19.
 *
 * The device is one 48px row with no gap and squared inner corners, so the pair reads
 * as a single control rather than a field standing next to a button. footer-19 gets
 * this with `border-r-0` on the input; kept here for the same reason.
 *
 * It posts to the real `/leads` endpoint with its own `source`, not a demo
 * `onSubmit={(e) => e.preventDefault()}` like both reference blocks. A newsletter form
 * that silently discards the address is worse than no form: it spends the one moment a
 * visitor was willing to give you something.
 */
export function NewsletterForm() {
  const [email, setEmail] = useState('')

  const { mutate, isPending, isSuccess, isError } = useMutation({
    mutationFn: (value: string) => api.post('/leads', { email: value, source: 'footer_newsletter' }),
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (email.trim()) mutate(email.trim())
  }

  if (isSuccess) {
    return (
      <div
        role="status"
        className="flex h-14 items-center gap-3 border border-gold/40 bg-gold/10 px-5 text-sm text-stage-foreground"
      >
        <Check className="size-4 shrink-0 text-gold" aria-hidden="true" />
        You&apos;re on the list — the next question lands in your inbox.
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="flex h-14 w-full">
        <label htmlFor="footer-newsletter" className="sr-only">
          Your email address
        </label>
        <input
          id="footer-newsletter"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="min-w-0 flex-1 border border-r-0 border-stage-foreground/25 bg-stage-foreground/5 px-5 text-sm text-stage-foreground placeholder:text-stage-foreground/45 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-gold"
        />
        <button
          type="submit"
          disabled={isPending}
          className="group flex h-full shrink-0 cursor-pointer items-center gap-2 border border-gold bg-gold px-5 text-sm font-semibold text-stage transition-colors hover:bg-gold/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:opacity-70"
        >
          {isPending ? 'Sending…' : 'Subscribe'}
          <ArrowUpRight
            className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </button>
      </div>
      {isError && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          Something went wrong — please try again.
        </p>
      )}
      <p className="mt-2 text-xs text-stage-foreground/50">No spam, unsubscribe any time.</p>
    </form>
  )
}
