import { useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { CheckCircle } from 'lucide-react'
import { api } from '@/lib/api/client'
import { supabase } from '@/lib/auth/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { FieldError } from '@/components/ui/FieldError'
import { useFieldValidation } from '@/lib/useFieldValidation'

/** Phase 10B: Security — password change.
 *  Client-side: verify with signInWithPassword, then updateUser({ password }).
 *  After success: write an audit row via POST /me/account/password-change. */

const MIN_PASSWORD_LENGTH = 8

export function AccountSecurity() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [success, setSuccess] = useState(false)

  const v = useFieldValidation({
    currentPassword: (val: string) => (!val ? 'Enter your current password.' : null),
    newPassword: (val: string) => {
      const p = val as string
      if (!p) return 'Enter a new password.'
      if (p.length < MIN_PASSWORD_LENGTH) return `At least ${MIN_PASSWORD_LENGTH} characters.`
      return null
    },
    confirmPassword: (val: string) => {
      const c = val as string
      if (!c) return 'Confirm your new password.'
      if (c !== newPassword) return "Passwords don't match."
      if (c === currentPassword) return 'Your new password must be different from your current one.'
      return null
    },
  })

  const [serverError, setServerError] = useState('')

  const auditMutation = useMutation({
    mutationFn: () => api.post('/me/account/password-change'),
  })

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setServerError('')
    setSuccess(false)

    if (!v.validateAll({ currentPassword, newPassword, confirmPassword })) return

    // 1. Verify current password via Supabase
    const { data: profileData } = await api.get<{ email: string }>('/me/profile')
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: profileData.email,
      password: currentPassword,
    })
    if (signInError) {
      setServerError("That isn't your current password.")
      return
    }

    // 2. Update password via Supabase
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
    if (updateError) {
      setServerError(updateError.message)
      return
    }

    // 3. Write audit row + send security alert via backend
    try {
      await auditMutation.mutateAsync()
    } catch {
      // Audit failure must not undo the password change that already succeeded
    }

    setSuccess(true)
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
  }

  return (
    <div>
      <h2 className="mb-1 text-h4 font-semibold text-foreground">Security</h2>
      <p className="mb-6 text-sm text-muted-foreground">Change your password.</p>

      <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4">
        <label className="block">
          <span className="text-sm font-medium text-foreground">Current password</span>
          <Input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            onBlur={() => v.onBlur('currentPassword', currentPassword)}
            className="mt-1"
            autoComplete="current-password"
          />
          <FieldError message={v.errorFor('currentPassword')} />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-foreground">New password</span>
          <Input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            onBlur={() => v.onBlur('newPassword', newPassword)}
            className="mt-1"
            autoComplete="new-password"
          />
          <FieldError message={v.errorFor('newPassword')} />
          <p className="mt-1 text-xs text-muted-foreground">At least 8 characters.</p>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-foreground">Confirm new password</span>
          <Input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onBlur={() => v.onBlur('confirmPassword', confirmPassword)}
            className="mt-1"
            autoComplete="new-password"
          />
          <FieldError message={v.errorFor('confirmPassword')} />
        </label>

        {serverError && (
          <p role="alert" className="text-sm text-destructive">{serverError}</p>
        )}

        {success && (
          <p className="flex items-center gap-1.5 text-sm text-primary">
            <CheckCircle className="size-4" /> Password updated. We&apos;ve emailed you to confirm.
          </p>
        )}

        <Button type="submit" size="sm">
          Change password
        </Button>
      </form>
    </div>
  )
}
