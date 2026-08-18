import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { motion } from 'motion/react'
import { Mail, MailCheck } from 'lucide-react'
import { api } from '@/lib/api/client'
import { Button } from '@/components/ui/Button'
import { AuthField } from '@/components/ui/AuthField'
import { springItem } from '@/lib/motion'

/** Request a password reset — the frontend half of week3_plan.md W3-R1's password
 * reset email. Posts to the backend rather than calling
 * `supabase.auth.resetPasswordForEmail()` directly, so the email goes out through our
 * own Mailjet-branded template (backend/app/api/v1/auth.py has the full reasoning).
 *
 * Always shows the same "check your email" state on submit, whether or not the address
 * has an account — the backend is deliberately vague for the same reason, so this page
 * can't leak it either by branching on the response.
 */
export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/auth/request-password-reset', { email })
    } finally {
      // Even a network failure lands on the same state: retrying doesn't tell an
      // attacker anything either, and a genuine sender-side failure is invisible to
      // the person asking regardless of what this page says.
      setLoading(false)
      setSubmitted(true)
    }
  }

  if (submitted) {
    return (
      <motion.div variants={springItem} role="status">
        <span className="flex size-11 items-center justify-center rounded-full bg-gold-soft text-gold-strong ring-1 ring-inset ring-gold/40">
          <MailCheck className="size-5" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-3xl font-medium tracking-[-0.02em] text-foreground">Check your email</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          If <span className="font-medium text-foreground">{email}</span> has an account, a reset link is on its
          way. It expires in an hour.
        </p>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link to="/sign-in" className="font-medium text-accent underline-offset-4 hover:underline">
            Back to sign in
          </Link>
        </p>
      </motion.div>
    )
  }

  return (
    <>
      <motion.div variants={springItem} className="mb-8">
        <h1 className="text-3xl font-medium tracking-[-0.02em] text-foreground">Reset your password</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter the email address on your account and we&apos;ll send you a link to choose a new password.
        </p>
      </motion.div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <AuthField
          label="Email address"
          icon={Mail}
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />

        <motion.div variants={springItem} className="mt-1">
          <Button type="submit" className="w-full" loading={loading}>
            Send reset link
          </Button>
        </motion.div>

        <motion.p variants={springItem} className="text-center text-sm text-muted-foreground">
          <Link to="/sign-in" className="font-medium text-accent underline-offset-4 hover:underline">
            Back to sign in
          </Link>
        </motion.p>
      </form>
    </>
  )
}
