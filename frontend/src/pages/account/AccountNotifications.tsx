import { useState } from 'react'
import { Link } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck, CheckCircle, FileText, Info, Loader2, Settings, Sparkles } from 'lucide-react'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'

// ── Types matching backend API shapes ────────────────────────────────────────

interface NotificationRow {
  id: string
  notification_type: string
  entity_type: string
  entity_id: string
  title: string
  message: string
  read: boolean
  created_at: string
  action_url?: string | null
  meta?: Record<string, unknown> | null
}

interface NotificationsResponse {
  notifications: NotificationRow[]
  unread_count: number
}

interface NotificationPrefs {
  notify_marketing: boolean
  notify_product_updates: boolean
  notify_sound: boolean
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

const TYPE_CONFIG: Record<string, { icon: typeof Bell; label: string; color: string }> = {
  template_version_update: { icon: Sparkles, label: 'Update', color: 'text-accent' },
  course_update: { icon: FileText, label: 'Course', color: 'text-primary' },
  system: { icon: Info, label: 'System', color: 'text-muted-foreground' },
}

function getNotificationIcon(type: string) {
  return TYPE_CONFIG[type] ?? { icon: Bell, label: 'Notification', color: 'text-muted-foreground' }
}

// ── Notification item ────────────────────────────────────────────────────────

function NotificationItem({
  notification,
  onMarkRead,
  markReadPending,
}: {
  notification: NotificationRow
  onMarkRead: (id: string) => void
  markReadPending: boolean
}) {
  const config = getNotificationIcon(notification.notification_type)
  const Icon = config.icon

  return (
    <div
      className={cn(
        'group flex gap-4 px-5 py-4 transition-colors',
        notification.read ? 'bg-transparent' : 'bg-muted/30',
      )}
    >
      {/* Icon */}
      <span className={cn('mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted', config.color)}>
        <Icon className="size-4" aria-hidden="true" />
      </span>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-foreground">{notification.title}</p>
              {!notification.read && (
                <span className="size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />
              )}
            </div>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{notification.message}</p>
          </div>
          <span className="shrink-0 text-xs text-muted-foreground/70">{timeAgo(notification.created_at)}</span>
        </div>

        {/* Actions */}
        <div className="mt-2 flex items-center gap-3">
          {!notification.read && (
            <button
              type="button"
              onClick={() => onMarkRead(notification.id)}
              disabled={markReadPending}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              {markReadPending ? (
                <Loader2 className="size-3 animate-spin" aria-hidden="true" />
              ) : (
                <CheckCircle className="size-3" aria-hidden="true" />
              )}
              Mark as read
            </button>
          )}
          {notification.read && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground/50">
              <CheckCircle className="size-3" aria-hidden="true" />
              Read
            </span>
          )}
          {/* Was a bare `<a href>`, which does a full document
              reload for what is always an in-app path — losing the SPA's auth session
              bootstrap and every warm query. `action_url` is produced by
              notification_service as an app-relative path, so it routes. */}
          {notification.action_url && (
            <Link
              to={notification.action_url}
              className="text-xs font-medium text-primary hover:underline"
            >
              View details →
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Email preferences section ────────────────────────────────────────────────

function EmailPreferences() {
  const queryClient = useQueryClient()
  const [success, setSuccess] = useState(false)
  const [marketing, setMarketing] = useState<boolean | null>(null)
  const [productUpdates, setProductUpdates] = useState<boolean | null>(null)
  const [sound, setSound] = useState<boolean | null>(null)

  const { data: prefs, isLoading, error } = useQuery({
    queryKey: ['me', 'notifications-prefs'] as const,
    queryFn: () => api.get<NotificationPrefs>('/me/account/notifications').then((r) => r.data),
  })

  const updateMutation = useMutation({
    mutationFn: (values: { notify_marketing: boolean; notify_product_updates: boolean; notify_sound: boolean }) =>
      api.patch('/me/account/notifications', values),
    onSuccess: () => {
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
      // Drop the local overrides so the checkboxes fall back to the refetched server
      // values. Without this the three `useState`s stay latched at whatever was last
      // clicked, and the form would keep showing them even if the PATCH came back with
      // something different.
      setMarketing(null)
      setProductUpdates(null)
      setSound(null)
      void queryClient.invalidateQueries({ queryKey: ['me', 'notifications-prefs'] })
    },
  })

  const currentMarketing = marketing ?? prefs?.notify_marketing ?? false
  const currentProductUpdates = productUpdates ?? prefs?.notify_product_updates ?? false
  const currentSound = sound ?? prefs?.notify_sound ?? true

  return (
    /* This whole card used to `return null` while the preferences
       request was in flight or if it failed — so on a slow connection the notifications
       page rendered with no preferences section at all and no indication one was coming,
       and on an error it silently rendered nothing forever. The heading and description
       are now unconditional; only the controls wait. */
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <Settings className="size-4 text-muted-foreground" aria-hidden="true" />
        <h3 className="text-sm font-medium text-foreground">Preferences</h3>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Control how you receive notifications. Receipts, access emails, and security alerts always arrive.
      </p>

      {isLoading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Loading your preferences…
        </div>
      ) : error ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Couldn't load your preferences. Reload the page to try again.
        </p>
      ) : (
      <div className="mt-4 flex flex-col gap-4">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={currentSound}
            onChange={(e) => setSound(e.target.checked)}
            className="mt-1 size-4 rounded border-input"
          />
          <div>
            <span className="text-sm font-medium text-foreground">Notification sound</span>
            <p className="text-xs text-muted-foreground">
              Play a sound when new notifications arrive
            </p>
          </div>
        </label>

        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={currentProductUpdates}
            onChange={(e) => setProductUpdates(e.target.checked)}
            className="mt-1 size-4 rounded border-input"
          />
          <div>
            <span className="text-sm font-medium text-foreground">Product updates</span>
            <p className="text-xs text-muted-foreground">
              Template or course revisions you own
            </p>
          </div>
        </label>

        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={currentMarketing}
            onChange={(e) => setMarketing(e.target.checked)}
            className="mt-1 size-4 rounded border-input"
          />
          <div>
            <span className="text-sm font-medium text-foreground">Occasional updates</span>
            <p className="text-xs text-muted-foreground">
              New questions and resources, a few times a year
            </p>
          </div>
        </label>

        <div className="flex items-center gap-3">
          <Button
            size="sm"
            loading={updateMutation.isPending}
            onClick={() =>
              updateMutation.mutate({
                notify_marketing: currentMarketing,
                notify_product_updates: currentProductUpdates,
                notify_sound: currentSound,
              })
            }
          >
            Save preferences
          </Button>
          {success && (
            <span className="flex items-center gap-1.5 text-sm text-primary">
              <CheckCircle className="size-4" /> Saved
            </span>
          )}
          {updateMutation.isError && (
            <span className="text-sm text-destructive">Couldn't save. Try again.</span>
          )}
        </div>
      </div>
      )}
    </div>
  )
}

// ── Main notifications page ──────────────────────────────────────────────────

export function AccountNotifications() {
  const queryClient = useQueryClient()

  // Fetch all notifications
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.me.notifications(),
    queryFn: () => api.get<NotificationsResponse>('/me/notifications?limit=50').then((r) => r.data),
  })

  // Mark single notification as read
  const markRead = useMutation({
    mutationFn: (id: string) => api.post(`/me/notifications/${id}/read`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.me.notifications() })
    },
  })

  // Mark all as read
  const markAllRead = useMutation({
    mutationFn: () => api.post('/me/notifications/read-all'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.me.notifications() })
    },
  })

  const notifications = data?.notifications ?? []
  const unreadCount = data?.unread_count ?? 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-h4 font-semibold text-foreground">Notifications</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {unreadCount > 0
              ? `You have ${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`
              : 'All caught up'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            size="sm"
            variant="outline"
            loading={markAllRead.isPending}
            onClick={() => markAllRead.mutate()}
          >
            <CheckCheck className="size-4" aria-hidden="true" />
            Mark all read
          </Button>
        )}
      </div>

      {/* Notification list */}
      {isLoading ? (
        <div className="flex min-h-[20vh] items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
        </div>
      ) : error ? (
        <EmptyState
          title="Couldn't load notifications"
          description="Check your connection and try again."
          action={<Button onClick={() => void queryClient.invalidateQueries({ queryKey: queryKeys.me.notifications() })}>Retry</Button>}
        />
      ) : notifications.length === 0 ? (
        <div className="rounded-xl border border-border bg-card py-16 text-center">
          <Bell className="mx-auto size-8 text-muted-foreground/40" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium text-foreground">No notifications yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            When something changes with your templates or courses, you'll see it here.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {notifications.map((n) => (
            <NotificationItem
              key={n.id}
              notification={n}
              onMarkRead={(id) => markRead.mutate(id)}
              markReadPending={markRead.isPending}
            />
          ))}
        </div>
      )}

      {/* Email preferences */}
      <EmailPreferences />
    </div>
  )
}
