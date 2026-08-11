import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { supabase } from '@/lib/auth/supabase'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { FormField } from '@/components/ui/Input'

export function SignUp() {
  const navigate = useNavigate()
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

    // `options.data` lands in the JWT's user_metadata claim — app/core/security.py
    // reads it back out so app/core/deps.py's get_current_user can set users.name on
    // the row it creates the first time this person calls the API, instead of that
    // column staying permanently NULL for every real signup.
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    })
    setLoading(false)

    if (signUpError) {
      setError(signUpError.message)
      return
    }

    // With "Confirm email" on (Supabase project default), signUp() succeeds without
    // error but returns no session until the confirmation link is clicked — was
    // navigating to /dashboard regardless, which MemberLayout's guard then correctly
    // bounced straight back out of (no session = no user), reading as "sign up is
    // broken" when it had actually worked, just not logged anyone in yet.
    if (!data.session) {
      setAwaitingConfirmation(true)
      return
    }
    navigate('/dashboard')
  }

  if (awaitingConfirmation) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle style={{ fontSize: 'var(--text-h2)' }}>Check your email</CardTitle>
          <CardDescription>
            We've sent a confirmation link to {email}. Click it, then{' '}
            <Link to="/sign-in" className="text-primary underline-offset-4 hover:underline">
              sign in
            </Link>
            .
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle style={{ fontSize: 'var(--text-h2)' }}>Create an account</CardTitle>
        <CardDescription>Enter your email and password to create your account</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField
            label="Name"
            type="text"
            placeholder="Jane Smith"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
          />
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
            minLength={6}
            autoComplete="new-password"
          />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" loading={loading}>
            Create account
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Already have an account? <Link to="/sign-in" className="text-primary underline-offset-4 hover:underline">Sign in</Link>
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
