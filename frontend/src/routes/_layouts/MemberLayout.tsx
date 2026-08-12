import { useState } from 'react'
import { Link, NavLink, Navigate, Outlet } from 'react-router'
import { GraduationCap, LayoutDashboard, Library, LogOut, Menu, ShieldCheck, Sparkles, Tags, X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { useAuthStore } from '@/stores/useAuthStore'
import { supabase } from '@/lib/auth/supabase'
import { cn } from '@/lib/utils/cn'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

export function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background" role="status" aria-label="Loading">
      <div className="size-8 animate-spin rounded-full border-2 border-border border-t-primary" />
    </div>
  )
}

// DESIGN.md §17.2's member navigation, as a persistent sidebar rather than a
// horizontal bar — four destinations plus account is already past the point the spec
// says to collapse ("until the item count exceeds seven, then a collapsible
// sidebar"), and a standing sidebar is what makes "I can't find the courses" stop
// being true: every section is one click away from anywhere in the member area, not
// just from cards buried on the dashboard.
const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  // "My Library" sits directly under Dashboard, above the catalogue links: the three
  // below are places to *find* things, this is the one place that holds what you
  // already own (product spec §2 step 6). A buyer looking for something they paid for
  // should not have to work out which catalogue it came from.
  { to: '/library', label: 'My Library', icon: Library, end: false },
  { to: '/courses', label: 'Courses', icon: GraduationCap, end: false },
  { to: '/templates', label: 'Templates', icon: Sparkles, end: false },
  { to: '/questions', label: 'Questions', icon: Tags, end: false },
] as const

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  // Shown only to admins — and only as a shortcut. /admin is guarded independently on
  // both the client (AdminLayout) and, the part that actually matters, the server
  // (require_admin on every /admin/* route). A member who never sees this link and
  // types the URL still gets nothing.
  const user = useAuthStore((s) => s.user)
  const { data: profile } = useQuery({
    queryKey: queryKeys.me.profile(),
    queryFn: () => api.get<{ is_admin: boolean }>('/me/profile').then((r) => r.data),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  })

  return (
    <nav className="flex flex-1 flex-col gap-1 px-3" aria-label="Member">
      {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150',
              isActive
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
            )
          }
        >
          <Icon className="size-[18px] shrink-0" aria-hidden="true" />
          {label}
        </NavLink>
      ))}

      {profile?.is_admin && (
        <NavLink
          to="/admin/questions"
          onClick={onNavigate}
          className="mt-2 flex items-center gap-3 rounded-lg border-t border-sidebar-border px-3 pb-2.5 pt-4 text-sm font-medium text-sidebar-foreground/70 transition-colors duration-150 hover:text-sidebar-accent-foreground"
        >
          <ShieldCheck className="size-[18px] shrink-0" aria-hidden="true" />
          Content editor
        </NavLink>
      )}
    </nav>
  )
}

function SidebarBrand() {
  return (
    <Link
      to="/dashboard"
      className="flex items-center gap-2 px-6 py-6 font-sans text-base font-semibold tracking-tight text-sidebar-foreground"
    >
      <span className="size-2.5 rounded-[3px] bg-sidebar-primary ring-1 ring-inset ring-sidebar-accent" aria-hidden="true" />
      Practicable
    </Link>
  )
}

function SidebarAccount() {
  const user = useAuthStore((s) => s.user)
  const email = user?.email
  const name = (user?.user_metadata?.name as string | undefined) ?? email

  return (
    <div className="border-t border-sidebar-border px-3 py-4">
      <div className="flex items-center gap-2 rounded-lg px-3 py-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">
          {(name ?? '?').slice(0, 1).toUpperCase()}
        </span>
        <p className="min-w-0 flex-1 truncate text-sm font-medium text-sidebar-foreground">{name ?? 'Your account'}</p>
        <ThemeToggle className="border-sidebar-border text-sidebar-foreground/70 hover:border-sidebar-accent hover:text-sidebar-accent-foreground" />
        <button
          type="button"
          onClick={() => void supabase.auth.signOut()}
          className="flex size-9 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/60 transition-colors duration-150 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

/** The signed-in chrome — sidebar, mobile sheet, `<Outlet/>` — with NO auth guard.
 *
 * Split out from MemberLayout below (2026-08-11, owner-reported: "clicking on
 * Courses, Templates and Questions is making the sidebar disappear"). The cause was
 * that those three destinations are *public* routes registered under
 * MarketingLayout, while the sidebar linking to them lives in MemberLayout — so
 * every click from the sidebar navigated out of the layout that drew the sidebar.
 *
 * The fix is not to move those routes behind the auth guard (they must stay
 * publicly reachable — a visitor has to be able to browse the catalogue before
 * buying). It's that the *chrome* should follow who is signed in, not which route
 * is being viewed. CatalogueLayout.tsx picks between this and MarketingLayout on
 * exactly that basis; this component is the half that needs to render without
 * asserting anything about auth. */
export function MemberChrome() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop: a persistent left sidebar (DESIGN.md §17.2/§24.1's fixed-rail
          pattern), using the theme's dedicated --sidebar tokens so it reads as a
          distinct, quieter plane from the content beside it — not just the page
          background with a border tacked on. */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:sticky md:top-0 md:flex md:h-screen">
        <SidebarBrand />
        <SidebarNav />
        <SidebarAccount />
      </aside>

      {/* Mobile: a full-height sheet, same pattern as MarketingLayout's mobile menu
          (§17.1) — a slide-over triggered from the top bar, not a squeezed sidebar
          (§24.2 rules that out for the learning outline specifically; the same logic
          holds for the section-level nav). */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} aria-hidden="true" />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-sidebar shadow-xl">
            <div className="flex items-center justify-between px-2 py-2">
              <SidebarBrand />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="mr-2 flex size-9 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                aria-label="Close menu"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <SidebarNav onNavigate={() => setMobileOpen(false)} />
            <SidebarAccount />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/80 px-5 py-3 backdrop-blur-sm md:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            aria-label="Open menu"
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>
          <Link to="/dashboard" className="flex items-center gap-2 font-sans text-sm font-semibold tracking-tight text-foreground">
            <span className="size-2 rounded-[3px] bg-primary ring-1 ring-inset ring-primary-edge" aria-hidden="true" />
            Practicable
          </Link>
        </header>

        <main id="main" className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

// The auth guard, checked once here rather than re-implemented per page
// (DESIGN.md §78's auth guard pattern). A client-side redirect is a UX nicety, not a
// security control — every route this wraps still calls a FastAPI endpoint that
// checks entitlement server-side (week1_plan.md Non-negotiable #3).
export default function MemberLayout() {
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)

  if (loading) return <FullPageSpinner />
  if (!user) return <Navigate to="/sign-in" replace />

  return <MemberChrome />
}
