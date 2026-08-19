import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { motion } from 'motion/react'
import { supabase } from '@/lib/auth/supabase'
import { Button } from '@/components/ui/Button'
import { AuthField } from '@/components/ui/AuthField'
import { springItem } from '@/lib/motion'
import { Lock, Mail } from 'lucide-react'

/** Sign in — the right-hand column of AuthLayout's split screen (auth-08 / auth-10).
 *
 * The card wrapper is gone: in both references the form sits directly on the panel,
 * because the panel already IS the container. A card inside a half-screen column is a
 * box inside a box.
 *
 * Each field is a `riseItem` under AuthLayout's stagger container, which is auth-10's
 * treatment — the fields arrive in sequence rather than all at once.
 */
export function SignIn() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)

    if (signInError) {
      // Supabase's real message here is the terse "Email not confirmed" — worth
      // spelling out what to actually do about it, since it's reachable any time
      // "Confirm email" is on (the project default) and someone hasn't clicked the
      // link yet.
      setError(
        signInError.message === 'Email not confirmed'
          ? "You haven't confirmed your email yet — check your inbox for the confirmation link."
          : signInError.message,
      )
      return
    }
    navigate('/dashboard')
  }

  return (
    <>
      <motion.div variants={springItem} className="mb-8">
        {/* The one h1 on the page (§42.1). auth-10 sets its heading at the same weight
            and negative tracking as the hero, so the two surfaces read as one product. */}
        <h1 className="text-3xl font-medium tracking-[-0.02em] text-foreground">Welcome back</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to reach your library, your courses and anything you&apos;ve downloaded.
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

        <AuthField
          label="Password"
          icon={Lock}
          type="password"
          placeholder="Your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />

        <Link
          to="/forgot-password"
          className="-mt-2 self-end text-sm font-medium text-accent underline-offset-4 hover:underline"
        >
          Forgot your password?
        </Link>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <motion.div variants={springItem} className="mt-1">
          <Button type="submit" className="w-full" loading={loading}>
            Sign in
          </Button>
        </motion.div>

        <motion.p variants={springItem} className="text-center text-sm text-muted-foreground">
          No account?{' '}
          <Link to="/sign-up" className="font-medium text-accent underline-offset-4 hover:underline">
            Create one — it&apos;s free
          </Link>
        </motion.p>
      </form>
    </>
  )
}
