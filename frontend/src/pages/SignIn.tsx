import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { supabase } from '@/lib/auth/supabase'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { FormField } from '@/components/ui/Input'

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
    <Card className="w-full max-w-md">
      <CardHeader>
        {/* text-h2 carries the §10 size/line-height from theme.css — the inline
            fontSize this used bypassed the type system entirely. */}
        <CardTitle className="text-h2">Sign in</CardTitle>
        <CardDescription>Enter your email and password to access your account</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField
            label="Email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <FormField
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" loading={loading}>
            Sign in
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            No account? <Link to="/sign-up" className="text-primary underline-offset-4 hover:underline">Sign up</Link>
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
