import { useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { ArrowRight, Check, Mail } from 'lucide-react'
import { api } from '@/lib/api/client'
import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui/Button'
import { Label } from '@/components/ui/Input'
import { StatusDot } from '@/components/ui/StatusDot'
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from '@/lib/support'
import { staggerContainer, riseItem, riseItemSm } from '@/lib/motion'

const ENQUIRY_OPTIONS = [
  { value: 'question', label: 'A question about the content' },
  { value: 'order', label: 'An order or a receipt' },
  { value: 'access', label: 'Trouble signing in or downloading' },
  { value: 'team', label: 'Buying for a team' },
  { value: 'other', label: 'Something else' },
] as const

/** The contact page: a centred dot-and-label pill over a large heading, one rounded
 * card holding the form, two blurred polygon blobs behind the section.
 *
 * No phone field — there's no number to call and no one staffing one. The agreement
 * checkbox is a plain sentence instead: a one-line privacy statement, not a decision.
 * `<form>` posts to the real `/contact` endpoint, which persists the message and emails
 * the owner. Card and fields are solid colour, not translucent — axe measured a
 * translucent card compositing with the blurred blobs behind it down to 1.65:1 on
 * placeholder text, well under AA's 4.5:1.
 */
export function Contact() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [enquiryType, setEnquiryType] = useState<string>('')
  const [message, setMessage] = useState('')

  const { mutate, isPending, isSuccess, isError } = useMutation({
    mutationFn: () =>
      api.post('/contact', {
        name: name.trim(),
        email: email.trim(),
        // Starts unchosen rather than defaulting to the first option, so an untouched
        // field records "they didn't say" instead of a silent guess.
        enquiry_type: enquiryType || null,
        message: message.trim(),
      }),
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    mutate()
  }

  const fieldClass =
    'h-12 w-full rounded-xl border border-input bg-background px-4 text-sm text-foreground ' +
    'placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 ' +
    'focus-visible:outline-offset-2 focus-visible:outline-ring'

  return (
    <section className="relative isolate w-full overflow-hidden py-9 sm:py-28">
      {/* `overflow-hidden` on the section keeps these from widening the page — a
          blurred element pushed off-canvas still counts toward scroll width. */}
      <Blob position="left-[max(-9rem,calc(50%-52rem))]" gradient="from-accent to-accent/50" />
      <Blob position="left-[max(45rem,calc(50%+8rem))]" gradient="from-gold to-gold/40" />

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="mx-auto w-full max-w-7xl px-5 sm:px-8"
      >
        <motion.div variants={riseItem} className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <StatusDot label="Usually answered within two working days" />
          <h1 className="mt-5 text-h1 font-semibold text-foreground">Ask a real person</h1>
          <p className="mt-4 max-w-xl text-lead text-muted-foreground">
            Questions about the content, an order, or buying for a team — this reaches the person
            who writes it, not a queue.
          </p>
        </motion.div>

        <motion.div variants={riseItem} className="mx-auto mt-9 max-w-2xl">
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-10">
            {isSuccess ? (
              /* Replaces the form rather than sitting above it. Leaving a filled-in form
                 on screen after a successful send is how people send the same message
                 three times. */
              <div role="status" className="flex flex-col items-center py-6 text-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-success/12">
                  <Check className="size-6 text-success" aria-hidden="true" />
                </span>
                <h2 className="mt-5 text-h3 font-semibold text-foreground">Message sent</h2>
                <p className="mt-2 max-w-sm text-muted-foreground">
                  Thanks — it landed. You&apos;ll get a reply at{' '}
                  <span className="font-medium text-foreground">{email}</span>, usually within two
                  working days.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="grid gap-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor="contact-name">Your name</Label>
                    <input
                      id="contact-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      autoComplete="name"
                      placeholder="Alex Moreau"
                      className={fieldClass}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="contact-email">Email address</Label>
                    <input
                      id="contact-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      placeholder="you@example.com"
                      className={fieldClass}
                    />
                  </div>
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="contact-enquiry">What&apos;s this about?</Label>
                  <select
                    id="contact-enquiry"
                    value={enquiryType}
                    onChange={(e) => setEnquiryType(e.target.value)}
                    className={fieldClass}
                  >
                    <option value="">Choose one — optional</option>
                    {ENQUIRY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="contact-message">Message</Label>
                  <textarea
                    id="contact-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                    maxLength={5000}
                    rows={6}
                    placeholder="Tell me what you're trying to work out."
                    className="min-h-[150px] w-full resize-y rounded-xl border border-input bg-background p-4 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  />
                </div>

                <p className="text-sm text-muted-foreground">
                  Your address is used to reply to this message and nothing else — it isn&apos;t
                  added to the newsletter.
                </p>

                {isError && (
                  <p role="alert" className="text-sm text-destructive">
                    That didn&apos;t send. Please try again, or email{' '}
                    <a href={SUPPORT_MAILTO} className="font-medium underline underline-offset-4">
                      {SUPPORT_EMAIL}
                    </a>{' '}
                    directly.
                  </p>
                )}

                <div className="flex justify-center pt-1">
                  <Button type="submit" size="lg" loading={isPending} className="w-full gap-2 sm:w-auto sm:px-10">
                    Send message
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              </form>
            )}
          </div>
        </motion.div>

        {/* The escape hatch. A contact page whose only route is a form it might fail to
            submit leaves someone with nowhere to go. */}
        <motion.p
          variants={riseItemSm}
          className="mt-8 flex items-center justify-center gap-2 text-sm text-muted-foreground"
        >
          <Mail className="size-4" aria-hidden="true" />
          Or write directly to{' '}
          <a
            href={SUPPORT_MAILTO}
            className="font-medium text-accent underline-offset-4 hover:underline"
          >
            {SUPPORT_EMAIL}
          </a>
        </motion.p>
      </motion.div>
    </section>
  )
}

/** A blurred polygon with a torn-paper silhouette, rather than a plain ellipse. */
function Blob({ position, gradient }: { position: string; gradient: string }) {
  return (
    <div aria-hidden="true" className={cn('absolute top-1/2 -z-10 -translate-y-1/2 transform-gpu blur-2xl', position)}>
      <div
        style={{
          clipPath:
            'polygon(74.8% 41.9%, 97.2% 73.2%, 100% 34.9%, 92.5% 0.4%, 87.5% 0%, 75% 28.6%, 58.5% 54.6%, 50.1% 56.8%, 46.9% 44%, 48.3% 17.4%, 24.7% 53.9%, 0% 27.9%, 11.9% 74.2%, 24.9% 54.1%, 68.6% 100%, 74.8% 41.9%)',
        }}
        className={cn('aspect-[577/310] w-[36rem] bg-gradient-to-r opacity-[0.12]', gradient)}
      />
    </div>
  )
}
