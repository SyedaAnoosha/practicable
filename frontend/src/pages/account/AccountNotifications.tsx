import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle } from 'lucide-react'
import { useState } from 'react'
import { api } from '@/lib/api/client'
import { Button } from '@/components/ui/Button'

/** Phase 10E: Notification preferences.
 *  Two toggles: product updates (default on) and marketing (default off).
 *  Transactional mail (receipt, access granted, password reset, security alerts)
 *  is NEVER gated by these flags. The page says so. */

interface NotificationPrefs {
  notify_marketing: boolean
  notify_product_updates: boolean
}

export function AccountNotifications() {
  const queryClient = useQueryClient()
  const [success, setSuccess] = useState(false)

  const { data: prefs, isLoading } = useQuery({
    queryKey: ['me', 'notifications'] as const,
    queryFn: () => api.get<NotificationPrefs>('/me/account/notifications').then((r) => r.data),
  })

  const [marketing, setMarketing] = useState<boolean | null>(null)
  const [productUpdates, setProductUpdates] = useState<boolean | null>(null)

  const updateMutation = useMutation({
    mutationFn: (values: { notify_marketing: boolean; notify_product_updates: boolean }) =>
      api.patch('/me/account/notifications', values),
    onSuccess: () => {
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
      void queryClient.invalidateQueries({ queryKey: ['me', 'notifications'] as const })
    },
  })

  if (isLoading || !prefs) {
    return (
      <div className="flex min-h-[20vh] items-center justify-center">
        <div className="size-6 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    )
  }

  const currentMarketing = marketing ?? prefs.notify_marketing
  const currentProductUpdates = productUpdates ?? prefs.notify_product_updates

  return (
    <div>
      <h2 className="mb-1 text-h4 font-semibold text-foreground">Notifications</h2>
      <p className="mb-6 text-sm text-muted-foreground">Email preferences.</p>

      <div className="flex max-w-md flex-col gap-6">
        {/* Product updates — default on */}
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={currentProductUpdates}
            onChange={(e) => setProductUpdates(e.target.checked)}
            className="mt-1 size-4 rounded border-input"
          />
          <div>
            <span className="text-sm font-medium text-foreground">Product updates</span>
            <p className="text-sm text-muted-foreground">
              Tell me when a template or course I own is revised.
            </p>
          </div>
        </label>

        {/* Marketing — default off */}
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={currentMarketing}
            onChange={(e) => setMarketing(e.target.checked)}
            className="mt-1 size-4 rounded border-input"
          />
          <div>
            <span className="text-sm font-medium text-foreground">Occasional updates</span>
            <p className="text-sm text-muted-foreground">
              New questions and resources, a few times a year.
            </p>
          </div>
        </label>

        {/* Reassurance */}
        <p className="text-sm text-muted-foreground">
          Receipts, access emails, and security alerts always arrive — those aren&apos;t marketing.
        </p>

        <div className="flex items-center gap-3">
          <Button
            size="sm"
            loading={updateMutation.isPending}
            onClick={() =>
              updateMutation.mutate({
                notify_marketing: currentMarketing,
                notify_product_updates: currentProductUpdates,
              })
            }
          >
            Save preferences
          </Button>
          {success && (
            <span className="flex items-center gap-1.5 text-sm text-primary">
              <CheckCircle className="size-4" /> Preferences saved.
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
