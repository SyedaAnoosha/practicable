import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { motion } from 'motion/react'
import { Lock, Mail, MailCheck, User } from 'lucide-react'
import { supabase } from '@/lib/auth/supabase'
import { Button } from '@/components/ui/Button'
import { AuthField } from '@/components/ui/AuthField'
import { springItem } from '@/lib/motion'
import { resolveNextPath, signInUrlFor } from '@/lib/utils/nextPath'

export function SignUp() {
  const navigate = useNavigate()
  // See SignIn for why this is a query
  // parameter. Sign-up is the COMMON path for a first purchase, so losing the
  // destination here is the more expensive of the two cases.
  const { search } = useLocation()
  const next = resolveNextPath(search)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // `options.data` lands in the JWT's user_metadata claim, which get_current_user
    // reads back out to set users.name on first sight.
    // emailRedirectTo overrides Supabase's dashboard-configured "Site URL" fallback,
    // which must otherwise be kept in sync manually. The target still has to be in
    // Supabase's Redirect URLs allow-list or it's rejected outright.
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      // The confirmation link lands back on /sign-in, so the destination has to ride
      // along on it or it is lost the moment the visitor leaves for their inbox.
      options: { data: { name }, emailRedirectTo: `${window.location.origin}${signInUrlFor(next)}` },
    })
    setLoading(false)

    if (signUpError) {
      setError(signUpError.message)
      return
    }

    // With "Confirm email" on, signUp() succeeds without error but returns no session
    // until the link is clicked, so this must not navigate to /dashboard yet.
    if (!data.session) {
      setAwaitingConfirmation(true)
      return
    }
    navigate(next)
  }

  if (awaitingConfirmation) {
    return (
      <motion.div variants={springItem} role="status">
        <span className="flex size-11 items-center justify-center rounded-full bg-gold-soft text-gold-strong ring-1 ring-inset ring-gold/40">
          <MailCheck className="size-5" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-3xl font-medium tracking-[-0.02em] text-foreground">Check your email</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          We&apos;ve sent a confirmation link to <span className="font-medium text-foreground">{email}</span>.
          Click it, then{' '}
          <Link to={signInUrlFor(next)} className="font-medium text-accent underline-offset-4 hover:underline">
            sign in
          </Link>
          .
        </p>
      </motion.div>
    )
  }

  return (
    <>
      <motion.div variants={springItem} className="mb-8">
        <h1 className="text-3xl font-medium tracking-[-0.02em] text-foreground">Get started</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Free to create. The 100 questions and the risk register template are yours straight away.
        </p>
      </motion.div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <AuthField
          label="Name"
          icon={User}
          type="text"
          placeholder="Jane Smith"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoComplete="name"
        />
        <AuthField
          label="Email"
          icon={Mail}
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <AuthField
          label="Password"
          icon={Lock}
          type="password"
          placeholder="At least 6 characters"
          hint="Minimum length is 6 characters."
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          autoComplete="new-password"
        />
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <motion.div variants={springItem} className="mt-1">
          <Button type="submit" className="w-full" loading={loading}>
            Create account
          </Button>
        </motion.div>

        <motion.p variants={springItem} className="text-[13px] leading-relaxed text-muted-foreground">
          By creating an account you agree to our terms. We&apos;ll occasionally send you
          account-related emails — never marketing you didn&apos;t ask for.
        </motion.p>

        <motion.p variants={springItem} className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link to={signInUrlFor(next)} className="font-medium text-accent underline-offset-4 hover:underline">
            Sign in
          </Link>
        </motion.p>
      </form>
    </>
  )
}
