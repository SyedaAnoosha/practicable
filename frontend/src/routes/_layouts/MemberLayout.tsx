import { useState } from 'react'
import { Link, NavLink, Navigate, Outlet } from 'react-router'
import { GraduationCap, LayoutDashboard, Library, LogOut, Menu, ShieldCheck, Sparkles, Store, Tags, X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { useAuthStore } from '@/stores/useAuthStore'
import { supabase } from '@/lib/auth/supabase'
import { cn } from '@/lib/utils/cn'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { CartButton } from '@/components/cart/CartButton'

export function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background" role="status" aria-label="Loading">
      <div className="size-8 animate-spin rounded-full border-2 border-border border-t-primary" />
    </div>
  )
}

// Member navigation as a persistent sidebar rather than a horizontal bar, so every
// section is one click away from anywhere in the member area.
//
// Grouped under headings `[CHANGED 2026-08-13, owner direction]` rather than run as one
// flat list. Five undifferentiated links make the reader work out the difference between
// "things I own" and "things I could own" from the labels alone; the headings say it.
// The split is the same one My Library exists to make (DESIGN.md §30.4).
const NAV_SECTIONS = [
  {
    heading: 'Your work',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/library', label: 'My Library', icon: Library, end: false },
    ],
  },
  {
    heading: 'Browse',
    items: [
      { to: '/questions', label: 'Questions', icon: Tags, end: false },
      // week2_plan.md Phase 4 — the store index, added alongside (not instead of)
      // the three catalogues below: the rail has no five-item ceiling the way the
      // marketing header does (§17.1), so there's no forcing reason to consolidate
      // links a signed-in member already has muscle memory for.
      { to: '/store', label: 'Store', icon: Store, end: false },
      { to: '/courses', label: 'Courses', icon: GraduationCap, end: false },
      { to: '/templates', label: 'Templates', icon: Sparkles, end: false },
    ],
  },
] as const

/** The rail's section label. Same typographic device as `.eyebrow` (mono, xs, uppercase,
 *  tracked) minus the 24px hairline rule — in a 256px column the rule eats a third of
 *  the line and reads as a divider rather than as part of the label.
 *
 *  DESIGN.md §6.1 puts every other string in this product in sentence case; the eyebrow
 *  is the one deliberate exception, and this is that device. */
function RailSectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="px-3 pb-1.5 pt-5 font-mono text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-stage-foreground/55 first:pt-1">
      {children}
    </h2>
  )
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  // A shortcut only: /admin is guarded independently on the client and, the part that
  // matters, on the server by require_admin.
  const user = useAuthStore((s) => s.user)
  const { data: profile } = useQuery({
    queryKey: queryKeys.me.profile(),
    queryFn: () => api.get<{ is_admin: boolean }>('/me/profile').then((r) => r.data),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  })

  // Every colour here is a `stage` token or an alpha of one, never a `sidebar-*` or
  // `primary` one — DESIGN.md §7.6. Those tokens invert between themes, and this rail is
  // now a dark plane in BOTH themes, so a `--sidebar-foreground` label would have been
  // correct in dark and near-invisible in light. That exact bug shipped seven times on
  // the hero and footer before `--stage` existed.
  //
  // Alphas are of `--stage-foreground`, not of `white`: §7.6 bans raw white outright,
  // and the stage foreground carries the plane's warm/cool cast (#F7F2E9 light,
  // #EAF1FA dark) so a 12% wash of it stays in the same colour story. This matches
  // what the footer and hero already do.
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150',
      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
      isActive
        ? 'bg-stage-foreground/12 text-stage-foreground'
        : 'text-stage-foreground/80 hover:bg-stage-foreground/6 hover:text-stage-foreground',
    )

  return (
    <nav className="flex flex-1 flex-col px-3" aria-label="Member">
      {NAV_SECTIONS.map(({ heading, items }) => (
        <div key={heading} className="flex flex-col gap-1">
          <RailSectionHeading>{heading}</RailSectionHeading>
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} onClick={onNavigate} className={linkClass}>
              <Icon className="size-[18px] shrink-0" aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </div>
      ))}

      {profile?.is_admin && (
        <div className="flex flex-col gap-1">
          <RailSectionHeading>Manage</RailSectionHeading>
          <NavLink to="/admin/questions" onClick={onNavigate} className={linkClass}>
            <ShieldCheck className="size-[18px] shrink-0" aria-hidden="true" />
            Content editor
          </NavLink>
        </div>
      )}
    </nav>
  )
}

function SidebarBrand() {
  return (
    <Link
      to="/dashboard"
      className="flex items-center gap-2 px-6 py-6 font-sans text-base font-semibold tracking-tight text-stage-foreground"
    >
      {/* `bg-gold`, not `bg-sidebar-primary`. The old token is midnight navy in the light
          theme, which on this now-dark rail would render an invisible navy square on
          navy — the precise defect DESIGN.md §7.6 records from the footer mark. Gold is
          decorative here, which is the only role `--gold` is ever allowed (§7.5.2). */}
      <span className="size-2.5 rounded-[3px] bg-gold ring-1 ring-inset ring-stage-foreground/20" aria-hidden="true" />
      Practicable
    </Link>
  )
}

function SidebarAccount() {
  const user = useAuthStore((s) => s.user)
  const email = user?.email
  const name = (user?.user_metadata?.name as string | undefined) ?? email

  // Stage tokens and alphas of them only, for the same reason as SidebarNav (§7.6).
  return (
    <div className="border-t border-stage-foreground/15 px-3 py-4">
      <div className="flex items-center gap-2 rounded-lg px-3 py-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-stage-foreground/12 text-xs font-semibold text-stage-foreground">
          {(name ?? '?').slice(0, 1).toUpperCase()}
        </span>
        <p className="min-w-0 flex-1 truncate text-sm font-medium text-stage-foreground/85">{name ?? 'Your account'}</p>
        <CartButton
          on="stage"
          className="text-stage-foreground/70 hover:bg-stage-foreground/8 hover:text-stage-foreground"
        />
        <ThemeToggle className="border-stage-foreground/20 text-stage-foreground/70 hover:border-stage-foreground/40 hover:text-stage-foreground" />
        <button
          type="button"
          onClick={() => void supabase.auth.signOut()}
          className="flex size-9 shrink-0 items-center justify-center rounded-md text-stage-foreground/65 transition-colors duration-150 hover:bg-stage-foreground/8 hover:text-stage-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
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
 * Split out from MemberLayout below so public catalogue routes can render member chrome
 * without requiring an account. CatalogueLayout picks between this and MarketingLayout
 * based on who is signed in; this half must render without asserting anything about
 * auth. */
export function MemberChrome() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop: a persistent left sidebar (DESIGN.md §17.2/§24.1's fixed-rail pattern).
          `[CHANGED 2026-08-13, owner direction]` The rail now stands on the same dark
          `--stage` plane as the hero, the auth panel and the footer, carrying the same
          aurora — so the member chrome belongs to the brand rather than reading as a
          separate, quieter admin shell.

          This is a plane change, not a colour tweak: `--sidebar-*` inverts between
          themes and `--stage` does not, so every child had to move to stage tokens in
          the same pass (§7.6). Leaving one behind is how the footer shipped an invisible
          navy mark on navy.

          `isolate` scopes the aurora's `-z-10`; `relative` positions it. */}
      <aside className="relative isolate hidden w-64 shrink-0 flex-col overflow-hidden border-r border-stage-foreground/15 bg-stage md:sticky md:top-0 md:flex md:h-screen">
        <div aria-hidden="true" className="stage-aurora stage-aurora--rail -z-10" />
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
          {/* Same plane and same aurora as the desktop rail — a mobile sheet that read as
              a different surface would make the app look like two products. */}
          {/* `absolute` (not `relative`) is both the positioning inside the overlay and
              the containing block the aurora's `inset-0` resolves against. */}
          <aside className="absolute inset-y-0 left-0 isolate flex w-72 flex-col overflow-hidden bg-stage shadow-xl">
            <div aria-hidden="true" className="stage-aurora stage-aurora--rail -z-10" />
            <div className="flex items-center justify-between px-2 py-2">
              <SidebarBrand />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="mr-2 flex size-9 shrink-0 items-center justify-center rounded-md text-stage-foreground/70 transition-colors duration-150 hover:bg-stage-foreground/8 hover:text-stage-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
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

      {/* `overflow-x-clip` confines full-bleed page decoration to this column.
          Pages paint their header wash with `left-1/2 w-screen -translate-x-1/2` to
          reach the viewport edge, which is correct in the marketing layout but wrong
          here: this column is inset by the 256px sidebar, so a 100vw box centred on it
          hangs past its left edge and tints the sidebar. Clipping is the fix rather
          than narrowing the wash, because the column's width is not knowable from
          inside the page.

          Deliberately `clip`, not `hidden`: `overflow: hidden` would make this element
          a scroll container and break `position: sticky` on the mobile header below and
          on the learning outline. `overflow: clip` cuts the paint without that side
          effect, and clipping one axis does not force the other to `auto`. */}
      <div className="flex min-w-0 flex-1 flex-col overflow-x-clip">
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

// The auth guard, checked once here rather than per page. A client-side redirect is a
// UX nicety, not a security control — the API checks entitlement server-side.
export default function MemberLayout() {
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)

  if (loading) return <FullPageSpinner />
  if (!user) return <Navigate to="/sign-in" replace />

  return <MemberChrome />
}
