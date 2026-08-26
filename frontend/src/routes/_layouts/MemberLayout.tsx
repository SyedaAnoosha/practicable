import { useCallback, useState } from 'react'
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router'
import { Bookmark, GraduationCap, LayoutDashboard, Layers, Library, ShieldCheck, Sparkles, Settings, Store, Tags, X, ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { useAuthStore } from '@/stores/useAuthStore'
import { cn } from '@/lib/utils/cn'
import { RailTooltip } from '@/components/ui/RailTooltip'
import { CommandPalette } from '@/components/ui/CommandPalette'
import { useCommandPalette } from '@/lib/useCommandPalette'
import { CookieConsent } from '@/components/ui/CookieConsent'
import { AppHeader } from '@/components/layout/AppHeader'
import { signInUrlFor } from '@/lib/utils/nextPath'

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
      // W5-R5. "Your work" rather than "Products": saved items are things the learner
      // marked, like their library, not things they could buy. Without this row the
      // /saved route exists but nothing points at it, which is the same shape of gap
      // that left bookmarks write-only in the first place.
      { to: '/saved', label: 'Saved', icon: Bookmark, end: false },
    ],
  },
  {
    heading: 'Products',
    items: [
      { to: '/questions', label: 'Questions', icon: Tags, end: false },
      { to: '/courses', label: 'Courses', icon: GraduationCap, end: false },
      { to: '/templates', label: 'Templates', icon: Sparkles, end: false },
      { to: '/packs', label: 'Reference packs', icon: Layers, end: false },
      { to: '/store', label: 'All products', icon: Store, end: false },
    ],
  },
] as const

/**
 * One rail row.
 *
 * `[ADDED 2026-08-22, owner direction]` Collapsed, the rail shows icons only and the
 * label appears on hover. Two details that make that safe rather than merely smaller:
 *
 *  1. **The label is always in the DOM**, hidden with `sr-only` when collapsed rather
 *     than removed. An icon-only nav whose labels do not exist is unusable with a
 *     screen reader, and `title` alone does not reliably produce an accessible name.
 *     So the link is always properly named; only the VISUAL label is conditional.
 *
 *  2. **The flyout is CSS-only** (`group-hover` / `group-focus-visible`), so it appears
 *     on keyboard focus as well as pointer hover. A hover-only affordance would put the
 *     collapsed rail out of reach of the keyboard entirely.
 *
 * Clicking the icon navigates — it does not expand the rail first. The owner asked for
 * both behaviours on one control; navigating is the one that matches every other link
 * in the product, and the chevron is the dedicated, discoverable way to expand.
 */
function RailLink({
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
    <RailTooltip label={label} collapsed={collapsed}>
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
              ? 'bg-stage-foreground/12 text-stage-foreground'
              : 'text-stage-foreground/80 hover:bg-stage-foreground/6 hover:text-stage-foreground',
          )
        }
      >
        <Icon className="size-[18px] shrink-0" aria-hidden="true" />
        <span className={cn(collapsed && 'sr-only')}>{label}</span>
      </NavLink>

    </RailTooltip>
  )
}

/** The rail's section label. Same typographic device as `.eyebrow` (mono, xs, uppercase,
 *  tracked) minus the 24px hairline rule — in a 256px column the rule eats a third of
 *  the line and reads as a divider rather than as part of the label.
 *
 *  DESIGN.md §6.1 puts every other string in this product in sentence case; the eyebrow
 *  is the one deliberate exception, and this is that device. */
function RailSectionHeading({ children, collapsed }: { children: React.ReactNode; collapsed?: boolean }) {
  // Collapsed, the heading becomes a rule: a 64px column cannot hold "Your work" at
  // 0.16em tracking, and truncating it to "You…" is worse than a divider. The text
  // stays in the DOM (sr-only) so the nav's grouping survives for screen readers —
  // the grouping is the whole reason these headings exist.
  if (collapsed) {
    return (
      <>
        <span className="sr-only">{children}</span>
        <hr aria-hidden="true" className="mx-3 my-2 border-t border-stage-foreground/12 first:hidden" />
      </>
    )
  }
  return (
    <h2 className="px-3 pb-1.5 pt-5 font-mono text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-stage-foreground/55 first:pt-1">
      {children}
    </h2>
  )
}

function SidebarNav({ onNavigate, collapsed = false }: { onNavigate?: () => void; collapsed?: boolean }) {
  const user = useAuthStore((s) => s.user)
  const { data: profile } = useQuery({
    queryKey: queryKeys.me.profile(),
    queryFn: () => api.get<{ is_admin: boolean }>('/me/profile').then((r) => r.data),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  })

  return (
    <nav className={cn('flex flex-1 flex-col', collapsed ? 'px-2' : 'px-3')} aria-label="Member">

      {NAV_SECTIONS.map(({ heading, items }) => (
        <div key={heading} className="flex flex-col gap-1">
          <RailSectionHeading collapsed={collapsed}>{heading}</RailSectionHeading>
          {items.map(({ to, label, icon, end }) => (
            <RailLink
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

      {profile?.is_admin && (
        <div className="flex flex-col gap-1">
          <RailSectionHeading collapsed={collapsed}>Manage</RailSectionHeading>
          <RailLink
            to="/admin/questions"
            label="Admin Panel"
            icon={ShieldCheck}
            end={false}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
        </div>
      )}
    </nav>
  )
}

function SidebarBrand({ collapsed, onToggleCollapse }: { collapsed: boolean; onToggleCollapse?: () => void }) {
  return (
    /* `[FIXED 2026-08-22]` Collapsed, this row was `justify-center` while the toggle
       below carried `ml-auto` — so in a 64px column the brand mark was jammed against
       the left edge and the chevron against the right, with neither centred and the two
       nearly touching. They are stacked when collapsed: mark above, toggle below, both
       centred, which is what the rest of the collapsed rail does. */
      <div className={cn('flex py-6', collapsed ? 'flex-col items-center gap-2 px-0' : 'items-center px-6')}>
      <Link
        to="/dashboard"
        className="flex min-w-0 items-center gap-2 font-sans text-base font-semibold tracking-tight text-stage-foreground"
      >
        {/* `[FIXED 2026-08-22]` The brand mark read as a dim olive smudge rather than
            gold. Three things compounded at this size: `--gold` (#C6A961) is a muted
            champagne chosen for rules and gradient stops, `size-2.5` is only 10px, and
            an inset `ring-stage-foreground/20` laid a pale wash over the whole of that
            10px — on a small solid the inset ring is a large fraction of the visible
            area, so it desaturated the fill instead of edging it.
            Now 12px with the ring *outside* the fill, so the gold is unmodified. The
            ring colour is stated literally rather than as `--gold-strong`, because that
            token flips to a dark brown (#7C5C14) in the light theme — and this rail is
            the dark stage in BOTH themes, so a theme-reactive token would go muddy on
            exactly the surface it needs to read on. */}
        <span
          className="size-3 shrink-0 rounded-[3px] bg-gold ring-1 ring-[#E3CB92]/40"
          aria-hidden="true"
        />
        {!collapsed && <span className="truncate">Practicable</span>}
      </Link>
      {onToggleCollapse && (
        <button
          type="button"
          onClick={onToggleCollapse}
          className={cn(
            'flex shrink-0 items-center justify-center rounded-md text-stage-foreground/40 transition-colors duration-150 hover:bg-stage-foreground/8 hover:text-stage-foreground/80',
            collapsed ? 'size-8' : 'ml-auto size-7',
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

function SidebarAccount({ collapsed }: { collapsed: boolean }) {
  const user = useAuthStore((s) => s.user)
  const email = user?.email
  const name = (user?.user_metadata?.name as string | undefined) ?? email

  return (
    <div className="border-t border-stage-foreground/15 px-3 py-4">
      {/* Account settings link — sits above the identity row, beside theme/signout.
          Owner direction: Account settings are chrome, not work. Every product
          measured puts them next to the avatar, not in the primary nav. */}
      <div className={cn('mb-2', collapsed ? 'flex justify-center' : 'px-1')}>
        <RailTooltip label="Account settings" collapsed={collapsed}>
        <NavLink
          to="/account"
          className={({ isActive }) =>
            cn(
              'flex items-center rounded-lg py-2 text-sm font-medium transition-colors duration-150',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              collapsed ? 'justify-center px-0' : 'gap-2.5 px-2',
              isActive
                ? 'bg-stage-foreground/12 text-stage-foreground'
                : 'text-stage-foreground/65 hover:bg-stage-foreground/6 hover:text-stage-foreground',
            )
          }
        >
          <Settings className="size-[18px] shrink-0" aria-hidden="true" />
          <span className={cn(collapsed && 'sr-only')}>Account settings</span>
        </NavLink>
        </RailTooltip>
      </div>

      {/* Identity only.
       *
       * `[CHANGED 2026-08-25, owner direction]` Cart, notifications, theme and sign-out
       * used to sit in this row. They now live in AppHeader's top-right cluster, in the
       * same place in both the member and admin shells. Keeping a second copy here would
       * mean two bells with two unread badges to keep in sync, and it was this row —
       * four ~36px controls inside a 64px collapsed rail — that produced the crowding
       * the 2026-08-22 stacking fix was working around. With only the avatar left, that
       * problem is gone rather than mitigated. */}
      <div
        className={cn(
          'flex items-center rounded-lg py-2',
          collapsed ? 'justify-center px-0' : 'gap-2 px-3',
        )}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-stage-foreground/12 text-xs font-semibold text-stage-foreground">
          {(name ?? '?').slice(0, 1).toUpperCase()}
        </span>
        {!collapsed && (
          <p className="min-w-0 flex-1 truncate text-sm font-medium text-stage-foreground/85">{name ?? 'Your account'}</p>
        )}
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
const SIDEBAR_KEY = 'practicable:sidebar-collapsed'

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_KEY) === '1'
  } catch {
    return false
  }
}

export function MemberChrome() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const { open: paletteOpen, setOpen: setPaletteOpen } = useCommandPalette()

  const toggleCollapse = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev
      try {
        window.localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0')
      } catch { /* private mode */ }
      return next
    })
  }, [])

  // Clicking a nav link in collapsed mode should expand the sidebar so the user
  // can see where they are. `onNavigate` on RailLink is the hook for this.
  const handleNavInCollapsed = useCallback(() => {
    if (collapsed) {
      setCollapsed(false)
      try {
        window.localStorage.setItem(SIDEBAR_KEY, '0')
      } catch { /* private mode */ }
    }
  }, [collapsed])

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar — collapsible. When collapsed: 64px, icons only, tooltips on
          hover. When expanded: 256px, full labels. Width transitions smoothly. */}
      <aside
        className={cn(
          /* `overflow-x-hidden` — the rail scrolls vertically by design, but a child
             that momentarily exceeds 64px (mid-transition, or a long label before
             `sr-only` applies) must never produce a horizontal scrollbar across the
             navigation. */
          'relative isolate hidden shrink-0 flex-col overflow-y-auto overflow-x-hidden overscroll-y-contain scrollbar-none border-r border-stage-foreground/15 bg-stage md:sticky md:top-0 md:flex md:h-screen transition-[width] duration-200 ease-[var(--ease-standard)]',
          collapsed ? 'w-16' : 'w-64',
        )}
      >
        <div aria-hidden="true" className="stage-aurora stage-aurora--rail -z-10" />
        <SidebarBrand collapsed={collapsed} onToggleCollapse={toggleCollapse} />
        <SidebarNav
          collapsed={collapsed}
          onNavigate={handleNavInCollapsed}
        />
        <SidebarAccount collapsed={collapsed} />
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
          <aside className="absolute inset-y-0 left-0 isolate flex w-72 flex-col overflow-y-auto overscroll-y-contain bg-stage shadow-xl">
            <div aria-hidden="true" className="stage-aurora stage-aurora--rail -z-10" />
            <div className="flex items-center justify-between px-2 py-2">
              <SidebarBrand collapsed={false} onToggleCollapse={() => setMobileOpen(false)} />
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
            <SidebarAccount collapsed={false} />
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
        {/* `[CHANGED 2026-08-25, owner direction]` This was `md:hidden` — a mobile-only
            bar. It is now the one persistent header on every signed-in page, carrying
            cart, notifications, theme and the account menu at top right on all
            breakpoints. The brand mark stays mobile-only, because on desktop the rail
            already shows it and repeating it puts the word "Practicable" twice on one
            screen. */}
        <AppHeader onOpenMenu={() => setMobileOpen(true)} onOpenSearch={() => setPaletteOpen(true)}>
          <Link
            to="/dashboard"
            className="flex items-center gap-2 font-sans text-sm font-semibold tracking-tight text-foreground md:hidden"
          >
            <span className="size-2 rounded-[3px] bg-primary ring-1 ring-inset ring-primary-edge" aria-hidden="true" />
            Practicable
          </Link>
        </AppHeader>

        <main id="main" className="flex-1">
          <Outlet />
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <CookieConsent />
    </div>
  )
}

// The auth guard, checked once here rather than per page. A client-side redirect is a
// UX nicety, not a security control — the API checks entitlement server-side.
export default function MemberLayout() {
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)
  const location = useLocation()

  if (loading) return <FullPageSpinner />
  // `[CHANGED 2026-08-21, USER_FLOW_AUDIT.md §2]` Carry where they were going.
  // /buy/:slug sits behind this guard, so a logged-out click on any of the 16 buy CTAs
  // used to land on /sign-in and then, unconditionally, on an empty /dashboard — losing
  // the product on the revenue path. `signInUrlFor` validates the destination before it
  // becomes a URL (open-redirect boundary; see nextPath.ts).
  if (!user) {
    return <Navigate to={signInUrlFor(`${location.pathname}${location.search}`)} replace />
  }

  return <MemberChrome />
}
