import { useState, type FormEvent } from 'react'
import { Download, AlertTriangle, CheckCircle } from 'lucide-react'
import { api } from '@/lib/api/client'
import { supabase } from '@/lib/auth/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { FieldError } from '@/components/ui/FieldError'
import { useFieldValidation } from '@/lib/useFieldValidation'

/** Data & privacy — export my data and close my account.
 * Export produces a real JSON file. Closure is deactivation (never hard delete),
 * password-confirmed, reusing the existing gate-wired path. */

export function AccountDataPrivacy() {
  // ── Export ──
  const [exportLoading, setExportLoading] = useState(false)
  const [exportError, setExportError] = useState('')

  const handleExport = async () => {
    setExportLoading(true)
    setExportError('')
    try {
      const response = await api.post('/me/account/export')
      const data = response.data
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `practicable-data-export-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      setExportError('Export failed. Please try again.')
    } finally {
      setExportLoading(false)
    }
  }

  // ── Closure ──
  const [showClosureForm, setShowClosureForm] = useState(false)
  const [closurePassword, setClosurePassword] = useState('')
  const [closureError, setClosureError] = useState('')
  const [closureSuccess, setClosureSuccess] = useState(false)
  const [closureLoading, setClosureLoading] = useState(false)

  const v = useFieldValidation({
    closurePassword: (val: string) => (!val ? 'Enter your password to close your account.' : null),
  })

  const handleClosure = async (e: FormEvent) => {
    e.preventDefault()
    setClosureError('')

    if (!v.validateAll({ closurePassword })) return

    setClosureLoading(true)

    // Verify password via Supabase
    const { data: profileData } = await api.get<{ email: string }>('/me/profile')
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: profileData.email,
      password: closurePassword,
    })
    if (signInError) {
      setClosureLoading(false)
      setClosureError("That isn't your current password.")
      return
    }

    // Close account via backend (deactivation)
    try {
      await api.post('/me/account/close')
      setClosureSuccess(true)
      // Sign out after closure
      await supabase.auth.signOut()
    } catch {
      setClosureLoading(false)
      setClosureError('Failed to close account. Please try again.')
    }
  }

  if (closureSuccess) {
    return (
      <div className="mx-auto max-w-md py-10 text-center">
        <CheckCircle className="mx-auto size-10 text-primary" />
        <h2 className="mt-4 text-h4 font-semibold text-foreground">Account closed</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account is closed. Contact us any time to restore it.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-10">
      <div>
        <h2 className="mb-1 text-h4 font-semibold text-foreground">Data &amp; privacy</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          Export your data or close your account.
        </p>
      </div>

      {/* ── Data export ── */}
      <section className="max-w-md">
        <h3 className="text-sm font-semibold text-foreground">Download your data</h3>
        <p className="mb-3 text-sm text-muted-foreground">
          Get a copy of your profile, purchases, and progress.
        </p>
        {exportError && (
          <p role="alert" className="mb-3 text-sm text-destructive">{exportError}</p>
        )}
        <Button
          size="sm"
          variant="outline"
          loading={exportLoading}
          onClick={handleExport}
        >
          <Download className="mr-1.5 size-4" /> Download your data
        </Button>
      </section>

      {/* ── Account closure ── */}
      <section className="max-w-md">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-5 text-destructive" />
          <h3 className="text-sm font-semibold text-foreground">Close your account</h3>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Closing your account signs you out and ends your access. Your purchase records
          are kept as required by law, and closing your account does not refund a purchase.
          Download your data first if you want a copy.
        </p>

        {!showClosureForm ? (
          <Button
            size="sm"
            variant="outline"
            className="mt-4"
            onClick={() => setShowClosureForm(true)}
          >
            Close account
          </Button>
        ) : (
          <form onSubmit={handleClosure} className="mt-4 flex max-w-sm flex-col gap-4">
            <label className="block">
              <span className="text-sm font-medium text-foreground">
                Enter your password to close your account.
              </span>
              <Input
                type="password"
                value={closurePassword}
                onChange={(e) => setClosurePassword(e.target.value)}
                onBlur={() => v.onBlur('closurePassword', closurePassword)}
                className="mt-1"
                autoComplete="current-password"
              />
              <FieldError message={v.errorFor('closurePassword')} />
            </label>

            {closureError && (
              <p role="alert" className="text-sm text-destructive">{closureError}</p>
            )}

            <div className="flex gap-2">
              <Button type="submit" size="sm" variant="destructive" loading={closureLoading}>
                Close my account
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setShowClosureForm(false)
                  setClosurePassword('')
                  setClosureError('')
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </section>
    </div>
  )
}
