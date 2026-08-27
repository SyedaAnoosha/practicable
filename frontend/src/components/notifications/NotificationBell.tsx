import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck, Loader2 } from 'lucide-react'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { useToast } from '@/stores/useToastStore'
import { cn } from '@/lib/utils/cn'

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

// Poll interval for unread count — 60 s, long enough to not hammer the server,
// short enough that a version-bump notification shows up promptly.
const POLL_MS = 60_000

// ── Notification sound (Web Audio API — no external file needed) ──────────────
let audioCtx: AudioContext | null = null

function playNotificationSound() {
  try {
    if (!audioCtx) audioCtx = new AudioContext()
    // Short two-tone chime: first tone 880 Hz, second 1320 Hz, 120 ms each
    const now = audioCtx.currentTime
    for (const [freq, start] of [[880, 0], [1320, 0.12]] as const) {
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.15, now + start)
      gain.gain.exponentialRampToValueAtTime(0.001, now + start + 0.2)
      osc.connect(gain).connect(audioCtx.destination)
      osc.start(now + start)
      osc.stop(now + start + 0.25)
    }
  } catch {
    /* AudioContext not available — silently ignore */
  }
}

interface NotificationPrefs {
  notify_sound: boolean
}

// Relative-time helper — "2h ago", "3d ago", etc.
function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

// ── The bell + dropdown ──────────────────────────────────────────────────────

export function NotificationBell({
  on = 'stage',
  className,
}: {
  /** 'stage' for the dark member sidebar, 'background' for light surfaces. */
  on?: 'stage' | 'background'
  className?: string
}) {
  const queryClient = useQueryClient()
  const { addToast } = useToast()
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Fetch notifications (with unread_count) on a poll interval so the badge
  // stays current without a page refresh.
  const { data } = useQuery({
    queryKey: queryKeys.me.notifications(),
    queryFn: () => api.get<NotificationsResponse>('/me/notifications?limit=10').then((r) => r.data),
    refetchInterval: POLL_MS,
    staleTime: POLL_MS,
  })

  const unread = data?.unread_count ?? 0
  // Memoized so an effect keyed on `notifications` doesn't see a "new" array (and
  // re-fire) on every render when `data` is undefined — the fallback `[]` would
  // otherwise be a fresh reference each time.
  const notifications = useMemo(() => data?.notifications ?? [], [data?.notifications])

  // Fetch notification preferences (sound toggle)
  const { data: prefs } = useQuery({
    queryKey: ['me', 'notifications-prefs'] as const,
    queryFn: () => api.get<NotificationPrefs>('/me/account/notifications').then((r) => r.data),
    staleTime: 300_000,
  })

  // Track previous unread count to detect new notifications arriving
  const prevUnreadRef = useRef(unread)
  const [justPulsed, setJustPulsed] = useState(false)

  // Track which notification IDs we've already toasted, to avoid repeat toasts
  // across re-renders with the same data.
  const toastedIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (unread > prevUnreadRef.current) {
      // New notifications arrived — trigger a brief pulse animation
      setJustPulsed(true)
      const timer = setTimeout(() => setJustPulsed(false), 1500)

      // Play sound if enabled
      if (prefs?.notify_sound) {
        playNotificationSound()
      }

      // Show toast for each NEW notification we haven't already toasted.
      // Cap at 3 toasts at once — no one wants a wall of popups.
      const newOnes = notifications.filter(
        (n) => !n.read && !toastedIdsRef.current.has(n.id),
      )
      for (const n of newOnes.slice(0, 3)) {
        toastedIdsRef.current.add(n.id)
        addToast({
          title: n.title,
          description: n.message,
          variant: 'info',
          duration: 6000,
          action: n.action_url
            ? { label: 'View', onClick: () => { /* navigation handled by link */ } }
            : undefined,
        })
      }

      return () => clearTimeout(timer)
    }
    prevUnreadRef.current = unread
  }, [unread, prefs?.notify_sound, notifications, addToast])

  // ── Mark-as-read mutations ───────────────────────────────────────────────

  const markRead = useMutation({
    mutationFn: (id: string) => api.post(`/me/notifications/${id}/read`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.me.notifications() })
    },
  })

  const markAllRead = useMutation({
    mutationFn: () => api.post('/me/notifications/read-all'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.me.notifications() })
    },
  })

  // ── Click-outside to close ──────────────────────────────────────────────

  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    },
    [],
  )

  useEffect(() => {
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open, handleClickOutside])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  // ── Styles per surface ─────────────────────────────────────────────────

  const isStage = on === 'stage'
  const iconColor = isStage
    ? 'text-stage-foreground/70 hover:bg-stage-foreground/8 hover:text-stage-foreground'
    : 'text-muted-foreground hover:bg-muted hover:text-foreground'

  // Compute dropdown position from the button's bounding rect so we can portal
  // it outside the sidebar's overflow container.
  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    if (!open || !buttonRef.current) return

    // `[CHANGED 2026-08-25]` Prefer opening downward. The bell now lives in AppHeader
    // at the top of the viewport, where there is almost never 384px above it — the old
    // "upward unless it doesn't fit" preference was written for the bell's previous
    // home at the bottom of the member sidebar, and in the header it made the panel
    // flip on every open depending on scroll position. Downward-first, flipping up only
    // when the panel genuinely would not fit below.
    const PANEL_H = 384 // max-h-96
    const PANEL_W = 320 // w-80
    const GAP = 8

    const place = () => {
      const btn = buttonRef.current
      if (!btn) return
      const rect = btn.getBoundingClientRect()
      const fitsBelow = window.innerHeight - rect.bottom >= PANEL_H + GAP
      const top = fitsBelow
        ? rect.bottom + GAP
        : Math.max(GAP, rect.top - PANEL_H - GAP)
      // Right-align to the bell, then clamp into the viewport so a bell near either
      // edge cannot push the panel off-screen.
      const left = Math.max(GAP, Math.min(rect.right - PANEL_W, window.innerWidth - PANEL_W - GAP))
      setPanelPos({ top, left })
    }

    place()
    // The panel is `position: fixed`, so it does not travel with the sticky header on
    // scroll or with a resize — recompute rather than let it drift away from the bell.
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'relative flex size-9 shrink-0 items-center justify-center rounded-md transition-colors duration-150',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          iconColor,
          justPulsed && 'animate-[shake_0.5s_ease-in-out] motion-reduce:animate-none',
          className,
        )}
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Bell className="size-4" aria-hidden="true" />
        {unread > 0 && (
          <span
            className={cn(
              'absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full text-[10px] font-bold leading-none',
              'bg-destructive text-destructive-foreground',
              'animate-[pulse_2s_ease-in-out_infinite] motion-reduce:animate-none',
            )}
            aria-hidden="true"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
        {unread > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 size-4 rounded-full bg-destructive/40 animate-[ping_2s_ease-in-out_infinite] motion-reduce:animate-none"
            aria-hidden="true"
          />
        )}
      </button>

      {open && panelPos && createPortal(
        <div
          ref={panelRef}
          role="menu"
          aria-label="Notifications"
          style={{ position: 'fixed', top: panelPos.top, left: panelPos.left }}
          className={cn(
            'z-[9999] w-80 max-h-96 overflow-hidden rounded-xl border shadow-xl',
            'border-border bg-card text-foreground',
            'flex flex-col',
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold">Notifications</h3>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                {markAllRead.isPending ? (
                  <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                ) : (
                  <CheckCheck className="size-3" aria-hidden="true" />
                )}
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                No notifications yet.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {notifications.map((n) => (
                  <li
                    key={n.id}
                    className={cn(
                      'group flex gap-3 px-4 py-3 transition-colors',
                      n.read ? 'bg-transparent' : 'bg-muted/40',
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-snug text-foreground">
                        {n.title}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {n.message}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground/70">
                          {timeAgo(n.created_at)}
                        </span>
                        {!n.read && (
                          <button
                            type="button"
                            onClick={() => markRead.mutate(n.id)}
                            disabled={markRead.isPending}
                            className="text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-50"
                          >
                            Mark read
                          </button>
                        )}
                        {n.action_url && (
                          <Link
                            to={n.action_url}
                            onClick={() => setOpen(false)}
                            className="text-[11px] text-primary hover:underline"
                          >
                            View
                          </Link>
                        )}
                      </div>
                    </div>
                    {!n.read && (
                      <span
                        className="mt-1.5 size-2 shrink-0 rounded-full bg-primary"
                        aria-hidden="true"
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-border px-4 py-2.5">
            <Link
              to="/account/notifications"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-primary hover:underline"
            >
              Notification settings
            </Link>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
