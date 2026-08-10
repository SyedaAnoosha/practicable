import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { supabase } from '@/lib/auth/supabase'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { FormField } from '@/components/ui/Input'

export function SignUp() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error: signUpError } = await supabase.auth.signUp({ email, password })
    setLoading(false)

    if (signUpError) {
      setError(signUpError.message)
      return
    }
    navigate('/dashboard')
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
