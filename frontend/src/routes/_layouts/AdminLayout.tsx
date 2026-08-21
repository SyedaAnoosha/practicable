import { Link, NavLink, Navigate, Outlet } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, BarChart3, ClipboardList, DollarSign, FileText, GraduationCap, Mail, Package, Receipt, Settings, ShieldCheck, Tags, UserPlus, Users } from 'lucide-react'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { cn } from '@/lib/utils/cn'
import { useAuthStore } from '@/stores/useAuthStore'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { FullPageSpinner } from './MemberLayout'

export interface Profile {
  id: string
  email: string
  name?: string | null
  role: string
  is_admin: boolean
}

// Phase 6C (W4-R13): grouped into Content · Commerce · System — nine entries
// in a flat list were unreadable; three labelled groups make the admin panel's
// structure visible at a glance.
const ADMIN_NAV_GROUPS = [
  {
    label: 'Content',
    items: [
      { to: '/admin/questions', label: 'Questions', icon: Tags },
      { to: '/admin/courses', label: 'Courses', icon: GraduationCap },
      { to: '/admin/templates', label: 'Templates', icon: FileText },
      { to: '/admin/packs', label: 'Packs', icon: Package },
    ],
  },
  {
    label: 'Commerce',
    items: [
      { to: '/admin/products', label: 'Products', icon: DollarSign },
      { to: '/admin/orders', label: 'Orders', icon: Receipt },
      { to: '/admin/contact', label: 'Contact', icon: Mail },
      { to: '/admin/leads', label: 'Leads', icon: UserPlus },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/admin/metrics', label: 'Analytics', icon: BarChart3 },
      { to: '/admin/users', label: 'Users', icon: Users },
      { to: '/admin/audit', label: 'Audit', icon: ClipboardList },
      { to: '/admin/settings', label: 'Settings', icon: Settings },
    ],
  },
] as const

/**
 * The content editor's shell (product spec §9's admin interface).
 *
 * The role check here is UX, not security. Every `/admin/*` API route is guarded
 * independently by `require_admin` server-side at the router level
 * (`app/api/v1/admin/router.py`), so a member who forces their way to this URL gets
 * a page whose every request 403s — this component just makes that a clear message
 * instead of a wall of failed fetches. Nothing is protected by hiding it.
 */
export default function AdminLayout() {
  const user = useAuthStore((s) => s.user)
  const authLoading = useAuthStore((s) => s.loading)

  const { data: profile, isLoading } = useQuery({
    queryKey: queryKeys.me.profile(),
    queryFn: () => api.get<Profile>('/me/profile').then((r) => r.data),
    enabled: !!user,
  })

  if (authLoading || (user && isLoading)) return <FullPageSpinner />
  if (!user) return <Navigate to="/sign-in" replace />

  if (profile && !profile.is_admin) {
    return (
      <div className="mx-auto w-full max-w-2xl px-5 py-11 sm:px-8">
        <EmptyState
          title="This area is for content editors."
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
    <div className="flex min-h-screen flex-col bg-background">
      {/* A visually distinct bar, deliberately: the one thing worse than no admin UI
          is an admin UI you can't tell you're in. Publishing and unpublishing live
          here, and those act on what customers see. */}
      <header className="sticky top-0 z-40 border-b border-border bg-primary text-primary-foreground">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-5 py-3 sm:px-8">
          <p className="flex items-center gap-2 font-sans text-sm font-semibold">
            <ShieldCheck className="size-4" aria-hidden="true" />
            Content editor
          </p>
          <nav className="flex items-center gap-4" aria-label="Admin">
            {ADMIN_NAV_GROUPS.map((group) => (
              <div key={group.label} className="flex items-center gap-1">
                <span className="text-[10px] font-medium uppercase tracking-widest text-primary-foreground/40 mr-1">
                  {group.label}
                </span>
                {group.items.map(({ to, label, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors duration-150',
                        isActive
                          ? 'bg-primary-foreground/15 font-medium text-primary-foreground'
                          : 'text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground',
                      )
                    }
                  >
                    <Icon className="size-4" aria-hidden="true" />
                    {label}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>
          <Link
            to="/dashboard"
            className="ml-auto text-sm text-primary-foreground/70 transition-colors hover:text-primary-foreground"
          >
            Leave editor
          </Link>
        </div>
      </header>

      <main id="main" className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}
