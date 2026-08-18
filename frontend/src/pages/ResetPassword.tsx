import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { motion } from 'motion/react'
import { Lock } from 'lucide-react'
import { supabase } from '@/lib/auth/supabase'
import { useAuthStore } from '@/stores/useAuthStore'
import { Button } from '@/components/ui/Button'
import { AuthField } from '@/components/ui/AuthField'
import { springItem } from '@/lib/motion'

/** Where the emailed reset link lands. Supabase's JS client auto-detects the recovery
 * token in the URL fragment on load (`detectSessionInUrl`, the client default) and
 * RootLayout's single `onAuthStateChange` listener (routes/_layouts/RootLayout.tsx)
 * writes the resulting session into useAuthStore before this component ever renders —
 * there is deliberately no second listener here.
 *
 * A session present means the link was valid; `updateUser` is what actually changes
 * the password, called directly against Supabase like sign-in/sign-up already are
 * (RS 6.3 — FastAPI never issues or mutates sessions, only verifies the JWT).
 */
export function ResetPassword() {
  const navigate = useNavigate()
  const session = useAuthStore((s) => s.session)
  const authLoading = useAuthStore((s) => s.loading)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError("Those passwords don't match.")
      return
    }

    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (updateError) {
      setError(updateError.message)
      return
    }
    navigate('/dashboard')
  }

  // RootLayout's getSession() call resolves quickly, but the recovery session isn't
  // established until Supabase's client parses the URL fragment — both settle inside
  // the same effect, so a brief loading state avoids a false "invalid link" flash.
  if (authLoading) {
    return null
  }

  if (!session) {
    return (
      <motion.div variants={springItem} role="alert">
        <h1 className="text-3xl font-medium tracking-[-0.02em] text-foreground">This link isn&apos;t valid</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          It may have expired, or already been used. Reset links are good for one use, for an hour.
        </p>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link to="/forgot-password" className="font-medium text-accent underline-offset-4 hover:underline">
            Request a new link
          </Link>
        </p>
      </motion.div>
    )
  }

  return (
    <>
      <motion.div variants={springItem} className="mb-8">
        <h1 className="text-3xl font-medium tracking-[-0.02em] text-foreground">Choose a new password</h1>
        <p className="mt-2 text-sm text-muted-foreground">This replaces your current password immediately.</p>
      </motion.div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <AuthField
          label="New password"
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
        <AuthField
          label="Confirm new password"
          icon={Lock}
          type="password"
          placeholder="Type it again"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
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
            Set new password
          </Button>
        </motion.div>
      </form>
    </>
  )
}
