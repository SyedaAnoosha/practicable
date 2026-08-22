import { useCallback, useState } from 'react'
import { Link, NavLink, Navigate, Outlet } from 'react-router'
import {
  ArrowLeft,
  BarChart3,
  ClipboardList,
  FileText,
  GraduationCap,
  LogOut,
  Mail,
  Package,
  Receipt,
  Settings,
  ShieldCheck,
  Tags,
  UserPlus,
  Users,
  Video,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { cn } from '@/lib/utils/cn'
import { useAuthStore } from '@/stores/useAuthStore'
import { supabase } from '@/lib/auth/supabase'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { FullPageSpinner } from './MemberLayout'

export interface Profile {
  id: string
  email: string
  name?: string | null
  role: string
  is_admin: boolean
}

// Phase 9: grouped into Content · Commerce · System — same structure as before,
// now rendered in a collapsible sidebar rather than a horizontal top bar.
const ADMIN_NAV_GROUPS = [
  {
    label: 'Content',
    items: [
      { to: '/admin/questions', label: 'Questions', icon: Tags, end: false },
      { to: '/admin/courses', label: 'Courses', icon: GraduationCap, end: false },
      { to: '/admin/templates', label: 'Templates', icon: FileText, end: false },
      { to: '/admin/packs', label: 'Packs', icon: Package, end: false },
      { to: '/admin/media', label: 'Media', icon: Video, end: false },
    ],
  },
  {
    label: 'Commerce',
    items: [
      { to: '/admin/orders', label: 'Orders', icon: Receipt, end: false },
      { to: '/admin/contact', label: 'Contact', icon: Mail, end: false },
      { to: '/admin/leads', label: 'Leads', icon: UserPlus, end: false },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/admin/metrics', label: 'Analytics', icon: BarChart3, end: false },
      { to: '/admin/users', label: 'Users', icon: Users, end: false },
      { to: '/admin/audit', label: 'Audit', icon: ClipboardList, end: false },
      { to: '/admin/settings', label: 'Settings', icon: Settings, end: false },
    ],
  },
] as const

const ADMIN_SIDEBAR_KEY = 'practicable:admin-sidebar-collapsed'

function readAdminCollapsed(): boolean {
  try {
    return window.localStorage.getItem(ADMIN_SIDEBAR_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * One rail row — identical pattern to MemberLayout's RailLink but without the
 * stage surface. Admin uses the standard background, not the dark stage.
 */
function AdminRailLink({
  to,
  label,
  icon: Icon,
  end,
  collapsed,
  onNavigate,
}: {
  to: string
  label: string
  icon: LucideIcon
  end: boolean
  collapsed: boolean
  onNavigate?: () => void
}) {
  return (
    <div className="group relative">
      <NavLink
        to={to}
        end={end}
        onClick={onNavigate}
        className={({ isActive }) =>
          cn(
            'flex items-center rounded-lg py-2.5 text-sm font-medium transition-colors duration-150',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            collapsed ? 'justify-center px-0' : 'gap-3 px-3',
            isActive
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )
        }
      >
        <Icon className="size-[18px] shrink-0" aria-hidden="true" />
        <span className={cn(collapsed && 'sr-only')}>{label}</span>
      </NavLink>

      {collapsed && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs font-medium text-popover-foreground opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
        >
          {label}
        </span>
      )}
    </div>
  )
}

/** Section heading — same pattern as MemberLayout's RailSectionHeading. */
function AdminRailSectionHeading({ children, collapsed }: { children: React.ReactNode; collapsed?: boolean }) {
  if (collapsed) {
    return (
      <>
        <span className="sr-only">{children}</span>
        <hr aria-hidden="true" className="mx-3 my-2 border-t border-border first:hidden" />
      </>
    )
  }
  return (
    <h2 className="px-3 pb-1.5 pt-5 font-mono text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-muted-foreground/60 first:pt-1">
      {children}
    </h2>
  )
}

function AdminSidebarNav({
  onNavigate,
  collapsed = false,
}: {
  onNavigate?: () => void
  collapsed?: boolean
}) {
  return (
    <nav className={cn('flex flex-1 flex-col', collapsed ? 'px-2' : 'px-3')} aria-label="Admin">

      {ADMIN_NAV_GROUPS.map(({ label, items }) => (
        <div key={label} className="flex flex-col gap-1">
          <AdminRailSectionHeading collapsed={collapsed}>{label}</AdminRailSectionHeading>
          {items.map(({ to, label, icon, end }) => (
            <AdminRailLink
              key={to}
              to={to}
              label={label}
              icon={icon}
              end={end}
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      ))}
    </nav>
  )
}

function AdminSidebarBrand({ collapsed, onToggleCollapse }: { collapsed: boolean; onToggleCollapse?: () => void }) {
  return (
    <div className={cn('flex items-center py-5', collapsed ? 'justify-center px-0' : 'px-5')}>
      <Link
        to="/dashboard"
        className="flex min-w-0 items-center gap-2 font-sans text-base font-semibold tracking-tight text-foreground"
      >
        <ShieldCheck className="size-5 shrink-0 text-primary" aria-hidden="true" />
        {!collapsed && <span className="truncate">Admin Panel</span>}
      </Link>
      {onToggleCollapse && (
        <button
          type="button"
          onClick={onToggleCollapse}
          className={cn(
            'ml-auto flex shrink-0 items-center justify-center rounded-md text-muted-foreground/50 transition-colors duration-150 hover:bg-muted hover:text-foreground/80',
            collapsed ? 'mt-2 size-8' : 'size-7',
          )}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="size-4" aria-hidden="true" />
          ) : (
            <ChevronLeft className="size-4" aria-hidden="true" />
          )}
        </button>
      )}
    </div>
  )
}

function AdminSidebarFooter({ collapsed }: { collapsed: boolean }) {
  return (
    /* `[FIXED 2026-08-22]` `px-3` on the outer box plus three 36px controls in a row
       exceeded the 64px collapsed rail, overlapping the icons and forcing a horizontal
       scrollbar. Collapsed drops the horizontal padding and stacks the controls. */
    <div className={cn('border-t border-border py-4', collapsed ? 'px-0' : 'px-3')}>
      <div
        className={cn(
          'rounded-lg py-2',
          collapsed
            ? 'flex flex-col items-center gap-1 px-0'
            : 'flex items-center gap-2 px-3',
        )}
      >
        {!collapsed && (
          <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">Admin</p>
        )}
        <ThemeToggle className="text-muted-foreground hover:text-foreground" />
        <Link
          to="/dashboard"
          className={cn(
            'flex items-center gap-2 rounded-md text-sm text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground',
            collapsed ? 'size-9 justify-center' : 'px-2 py-1.5',
          )}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {!collapsed && <span>Dashboard</span>}
        </Link>
        <button
          type="button"
          onClick={() => void supabase.auth.signOut()}
          className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

/**
 * Phase 9: Admin panel with a collapsible sidebar, matching the MemberLayout
 * pattern. The role check is UX, not security — every /admin/* API route is
 * guarded by `require_admin` server-side.
 */
export default function AdminLayout() {
  const user = useAuthStore((s) => s.user)
  const authLoading = useAuthStore((s) => s.loading)
  const [collapsed, setCollapsed] = useState(readAdminCollapsed)

  const { data: profile, isLoading } = useQuery({
    queryKey: queryKeys.me.profile(),
    queryFn: () => api.get<Profile>('/me/profile').then((r) => r.data),
    enabled: !!user,
  })

  const toggleCollapse = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev
      try {
        window.localStorage.setItem(ADMIN_SIDEBAR_KEY, next ? '1' : '0')
      } catch { /* private mode */ }
      return next
    })
  }, [])

  if (authLoading || (user && isLoading)) return <FullPageSpinner />
  if (!user) return <Navigate to="/sign-in" replace />

  if (profile && !profile.is_admin) {
    return (
      <div className="mx-auto w-full max-w-2xl px-5 py-11 sm:px-8">
        <EmptyState
          title="This area is for administrators."
          description="Your account doesn't have admin access. If you think that's wrong, whoever runs this site can change your role."
          action={
            <Link to="/dashboard">
              <Button variant="outline">
                <ArrowLeft className="size-4" aria-hidden="true" /> Back to your dashboard
              </Button>
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Admin sidebar — same collapsible pattern as MemberLayout. Uses standard
          bg-background instead of the dark stage surface, so it reads as the app's
          native chrome rather than a separate environment. */}
      <aside
        className={cn(
          'hidden shrink-0 flex-col overflow-y-auto overflow-x-hidden overscroll-y-contain border-r border-border md:sticky md:top-0 md:flex md:h-screen transition-[width] duration-200 ease-[var(--ease-standard)]',
          collapsed ? 'w-16' : 'w-60',
        )}
      >
        <AdminSidebarBrand collapsed={collapsed} onToggleCollapse={toggleCollapse} />
        <AdminSidebarNav collapsed={collapsed} />
        <AdminSidebarFooter collapsed={collapsed} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-x-clip">
        <main id="main" className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
