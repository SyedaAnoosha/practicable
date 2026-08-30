import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { LayoutDashboard, LogOut, Menu, Receipt, Search, Settings, Shield, User as UserIcon } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { useAuthStore } from '@/stores/useAuthStore'
import { supabase } from '@/lib/auth/supabase'
import { cn } from '@/lib/utils/cn'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { CartButton } from '@/components/cart/CartButton'
import { NotificationBell } from '@/components/notifications/NotificationBell'

/**
 * The persistent signed-in header — account settings, theme toggle, logout, cart, and
 * notifications, top-right and identical in both the member and admin shells (these
 * controls previously lived only at the bottom of the member sidebar).
 *
 * Sticky, not fixed: it participates in the content column's layout, so it never
 * overlaps page content and needs no body offset.
 */
export function AppHeader({
  onOpenMenu,
  onOpenSearch,
  /** Extra content pinned to the left, before the spacer — a page title or breadcrumb. */
  children,
}: {
  onOpenMenu?: () => void
  onOpenSearch?: () => void
  children?: React.ReactNode
}) {
  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/85 px-4 backdrop-blur-sm sm:px-6">
      {/* Mobile nav trigger. Hidden on desktop, where the rail is always present. */}
      {onOpenMenu && (
        <button
          type="button"
          onClick={onOpenMenu}
          className="-ml-1 flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:hidden"
          aria-label="Open menu"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>
      )}

      {children}

      <div className="ml-auto flex items-center gap-1">
        {onOpenSearch && (
          <button
            type="button"
            onClick={onOpenSearch}
            className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            aria-label="Search"
            title="Search"
          >
            <Search className="size-[18px]" aria-hidden="true" />
          </button>
        )}
        <CartButton on="surface" />
        <NotificationBell on="background" />
        <ThemeToggle className="border-transparent hover:bg-muted" />
        <AccountMenu />
      </div>
    </header>
  )
}

/**
 * Avatar button + dropdown: account settings, purchases, admin (when entitled), sign out.
 *
 * Sign-out lives in here rather than as its own always-visible icon. A one-click
 * destructive-ish action sitting permanently beside the theme toggle is easy to hit by
 * accident; behind the avatar it is exactly where people look for it and takes one
 * deliberate extra click.
 */
function AccountMenu() {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const email = user?.email
  const name = (user?.user_metadata?.name as string | undefined) ?? email
  const initial = (name ?? '?').slice(0, 1).toUpperCase()

  const { data: profile } = useQuery({
    queryKey: queryKeys.me.profile(),
    queryFn: () => api.get<{ is_admin: boolean }>('/me/profile').then((r) => r.data),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  })

  // Close on outside click and on Escape. Both are registered only while open, so the
  // closed header adds no document-level listeners.
  const onDocMouseDown = useCallback((e: MouseEvent) => {
    if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onDocMouseDown])

  const go = (to: string) => {
    setOpen(false)
    void navigate(to)
  }

  if (!user) return null

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="ml-1 flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground transition-colors duration-150 hover:bg-border focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        aria-label="Account menu"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {initial}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Account"
          className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-xl border border-border bg-card shadow-xl"
        >
          <div className="border-b border-border px-4 py-3">
            <p className="truncate text-sm font-medium text-foreground">{name ?? 'Your account'}</p>
            {email && name !== email && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{email}</p>
            )}
          </div>

          <div className="py-1">
            <MenuItem icon={LayoutDashboard} label="Dashboard" onSelect={() => go('/dashboard')} />
            <MenuItem icon={UserIcon} label="Account settings" onSelect={() => go('/account')} />
            <MenuItem icon={Receipt} label="Purchases" onSelect={() => go('/account/purchases')} />
            <MenuItem icon={Settings} label="Notifications" onSelect={() => go('/account/notifications')} />
            {profile?.is_admin && (
              <MenuItem icon={Shield} label="Admin panel" onSelect={() => go('/admin/questions')} />
            )}
          </div>

          <div className="border-t border-border py-1">
            <MenuItem
              icon={LogOut}
              label="Sign out"
              destructive
              onSelect={() => {
                setOpen(false)
                void supabase.auth.signOut()
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function MenuItem({
  icon: Icon,
  label,
  onSelect,
  destructive,
}: {
  icon: typeof LogOut
  label: string
  onSelect: () => void
  destructive?: boolean
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm transition-colors duration-150',
        destructive
          ? 'text-destructive hover:bg-destructive/10'
          : 'text-foreground hover:bg-muted',
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      {label}
    </button>
  )
}

/** Re-exported so layouts can render a title in the header's left slot consistently. */
export function AppHeaderTitle({ to, children }: { to?: string; children: React.ReactNode }) {
  const content = (
    <span className="truncate font-sans text-sm font-semibold tracking-tight text-foreground">
      {children}
    </span>
  )
  return to ? (
    <Link to={to} className="flex min-w-0 items-center gap-2">
      {content}
    </Link>
  ) : (
    content
  )
}
