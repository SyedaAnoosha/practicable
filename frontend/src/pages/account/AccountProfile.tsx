import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle } from 'lucide-react'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { supabase } from '@/lib/auth/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { FieldError } from '@/components/ui/FieldError'
import { useFieldValidation } from '@/lib/useFieldValidation'

/** Profile — name and email editing.
 * Email change goes through Supabase's confirm-new-address flow;
 * the user must enter their current password first. */

interface Profile {
  id: string
  email: string
  name: string | null
  role: string
  is_admin: boolean
}

export function AccountProfile() {
  const queryClient = useQueryClient()

  const { data: profile, isLoading } = useQuery({
    queryKey: queryKeys.me.profile(),
    queryFn: () => api.get<Profile>('/me/profile').then((r) => r.data),
  })

  const [name, setName] = useState('')
  const [nameTouched, setNameTouched] = useState(false)
  const [nameSuccess, setNameSuccess] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailSuccess, setEmailSuccess] = useState('')

  const v = useFieldValidation({
    name: (val: string) => {
      const trimmed = (val as string).trim()
      if (!trimmed) return 'Name cannot be empty.'
      if (trimmed.length > 100) return 'Name must be 100 characters or fewer.'
      return null
    },
  })

  const nameMutation = useMutation({
    mutationFn: (fullName: string) =>
      api.patch('/me/profile', { full_name: fullName }),
    onSuccess: () => {
      setNameSuccess(true)
      setTimeout(() => setNameSuccess(false), 3000)
      void queryClient.invalidateQueries({ queryKey: queryKeys.me.profile() })
    },
  })

  const handleNameSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!v.validateAll({ name })) return
    nameMutation.mutate(name.trim())
  }

  const handleEmailChange = async (e: FormEvent) => {
    e.preventDefault()
    setEmailError('')
    setEmailSuccess('')

    if (!currentPassword) {
      setEmailError('Enter your current password to change your email.')
      return
    }
    if (!newEmail || !newEmail.includes('@')) {
      setEmailError('Enter a valid email address.')
      return
    }
    if (newEmail === profile?.email) {
      setEmailError('This is already your email address.')
      return
    }

    setEmailLoading(true)

    // Verify current password via Supabase
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: profile?.email ?? '',
      password: currentPassword,
    })
    if (signInError) {
      setEmailLoading(false)
      setEmailError("That isn't your current password.")
      return
    }

    // Request email change — Supabase sends a confirmation link
    const { error: updateError } = await supabase.auth.updateUser({ email: newEmail })
    setEmailLoading(false)

    if (updateError) {
      setEmailError(updateError.message)
      return
    }

    setEmailSuccess(`Confirmation sent to ${newEmail}. Check your inbox to finish the change.`)
    setCurrentPassword('')
    setNewEmail('')
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[20vh] items-center justify-center">
        <div className="size-6 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    )
  }

  // Pre-populate name when profile loads
  if (profile && !name && !nameTouched) {
    setName(profile.name ?? '')
  }

  return (
    <div className="space-y-10">
      {/* ── Name section ── */}
      <section>
        <h2 className="mb-1 text-h4 font-semibold text-foreground">Profile</h2>
        <p className="mb-4 text-sm text-muted-foreground">Your display name and email address.</p>

        <form onSubmit={handleNameSubmit} className="flex max-w-md flex-col gap-4">
          <label className="block">
            <span className="text-sm font-medium text-foreground">Full name</span>
            <Input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setNameTouched(true)
              }}
              onBlur={() => v.onBlur('name', name)}
              maxLength={100}
              className="mt-1"
              autoComplete="name"
            />
            <FieldError message={v.errorFor('name')} />
          </label>

          <div className="flex items-center gap-3">
            <Button type="submit" size="sm" loading={nameMutation.isPending}>
              Save name
            </Button>
            {nameSuccess && (
              <span className="flex items-center gap-1.5 text-sm text-primary">
                <CheckCircle className="size-4" /> Name updated.
              </span>
            )}
            {nameMutation.isError && (
              <span className="text-sm text-destructive">Something went wrong. Please try again.</span>
            )}
          </div>
        </form>
      </section>

      {/* ── Email section ── */}
      <section>
        <h2 className="mb-1 text-h4 font-semibold text-foreground">Email</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Changing your email sends a confirmation link to the new address. Your sign-in
          email doesn&apos;t change until you confirm it.
        </p>

        <form onSubmit={handleEmailChange} className="flex max-w-md flex-col gap-4">
          <label className="block">
            <span className="text-sm font-medium text-foreground">Current email</span>
            <Input
              type="email"
              value={profile?.email ?? ''}
              disabled
              className="mt-1 bg-muted"
              readOnly
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-foreground">New email address</span>
            <Input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="mt-1"
              autoComplete="email"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-foreground">Current password</span>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="mt-1"
              autoComplete="current-password"
            />
          </label>

          {emailError && (
            <p role="alert" className="text-sm text-destructive">{emailError}</p>
          )}

          {emailSuccess && (
            <p className="flex items-center gap-1.5 text-sm text-primary">
              <CheckCircle className="size-4" /> {emailSuccess}
            </p>
          )}

          <Button type="submit" size="sm" loading={emailLoading}>
            Change email
          </Button>
        </form>
      </section>
    </div>
  )
}
