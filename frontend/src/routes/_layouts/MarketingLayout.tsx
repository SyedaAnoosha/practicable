import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router'
import { Menu, X } from 'lucide-react'
import { useAuthStore } from '@/stores/useAuthStore'
import { Button } from '@/components/ui/Button'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { cn } from '@/lib/utils/cn'
import { SUPPORT_MAILTO } from '@/lib/support'

const DOMAINS = ['Risk', 'Cyber', 'Compliance', 'Resilience', 'AI']

// DESIGN.md §17.1's exact nav: Questions, Courses, Templates, About — four items,
// each a real catalogue now that /questions, /courses and /templates all exist
// (previously this linked straight to the one hardcoded question, since nothing else
// was reachable yet).
const NAV_ITEMS = [
  { to: '/questions', label: 'Questions' },
  { to: '/courses', label: 'Courses' },
  { to: '/templates', label: 'Templates' },
  { to: '/#about', label: 'About' },
] as const

// DESIGN.md §17.1: the public header is logo → nav (five items max) → Sign in →
// Get started, and Get started routes to the free entry point (§27), not to sign-up —
// the free thing is the better first ask.
export default function MarketingLayout() {
  const user = useAuthStore((s) => s.user)
  const location = useLocation()
  // Mobile slide-over (§17.1's menu-collapse rule at five items — the nav is too
  // wide for phones, so it becomes a sheet, same pattern as MemberLayout's).
  const [menuOpen, setMenuOpen] = useState(false)
  // Escape closes the sheet (matching dialog conventions); the scroll handler below
  // is the only other effect on this page, so a second listener is cheap.
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])
  // DESIGN.md §13.3: the public header gains shadow-sm after 8px of scroll — the
  // one surface that earns a permanent hairline border plus a scroll shadow.
  // Initialised from the current scroll position so a mid-page reload doesn't
  // flash an un-shadowed header.
  const [scrolled, setScrolled] = useState(() => window.scrollY > 8)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Deep links to in-page anchors (#free-pack, #about) work from any public page:
  // navigate home first, then scroll — instantly under prefers-reduced-motion.
  // This assumes Home renders those sections synchronously (both do, today); if one
  // ever becomes data-gated, the one-shot lookup below would need a retry.
  useEffect(() => {
    const id = location.hash.slice(1)
    if (!id) return
    const el = document.getElementById(id)
    if (el) {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
    }
  }, [location.pathname, location.hash])

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header
        className={cn(
          'sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md transition-[box-shadow] duration-200',
          scrolled && 'shadow-sm',
        )}
      >
        {/* The gilt edge: a 2px navy-to-blue hairline along the very top of the
            page — the one decorative device the marketing surfaces get. */}
        <div aria-hidden="true" className="h-0.5 w-full bg-linear-to-r from-primary via-primary/70 to-accent" />
        {/* Tightened, 2026-08-11 (owner design critique) — py-4/gap-6 read a shade
            too roomy for a reference-tool header; py-3.5/gap-5 is the same
            structure, just less "marketing site." */}
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-5 px-5 py-3.5 sm:px-8">
          <Link to="/" className="flex items-center gap-2.5 font-sans text-base font-semibold tracking-tight">
            <span className="size-2.5 rounded-[3px] bg-primary ring-1 ring-inset ring-primary-edge" aria-hidden="true" />
            Practicable
          </Link>
          <nav className="hidden items-center gap-5 md:flex" aria-label="Main">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {user ? (
              <Link to="/dashboard" className="hidden sm:block">
                <Button variant="outline" size="sm">
                  My account
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/sign-in" className="hidden sm:block">
                  <Button variant="ghost" size="sm">
                    Log in
                  </Button>
                </Link>
                <Link to="/#free-pack" className="hidden sm:block">
                  <Button size="sm">Get started</Button>
                </Link>
              </>
            )}
            {/* Mobile-only menu trigger — the nav items live in the sheet below. */}
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:hidden"
              aria-label="Open menu"
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
            >
              <Menu className="size-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile slide-over (§17.1) — same sheet pattern as MemberLayout: an
          overlay + left-docked panel with the nav items as tall touch targets. */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenuOpen(false)} aria-hidden="true" />
          <aside
            id="mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="absolute inset-y-0 right-0 flex w-80 flex-col bg-card shadow-xl"
          >
            <div className="flex items-center justify-between px-5 py-4">
              <p className="font-sans text-base font-semibold tracking-tight">Menu</p>
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              aria-label="Close menu"
              autoFocus
            >
              <X className="size-5" aria-hidden="true" />
            </button>
            </div>
            <nav className="flex flex-1 flex-col gap-1 px-3" aria-label="Mobile">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-lg px-3 py-3 text-sm font-medium text-foreground transition-colors duration-150 hover:bg-muted"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="flex flex-col gap-2 border-t border-border p-4">
              {user ? (
                <Link to="/dashboard" onClick={() => setMenuOpen(false)}>
                  <Button className="w-full">My account</Button>
                </Link>
              ) : (
                <>
                  <Link to="/sign-in" onClick={() => setMenuOpen(false)}>
                    <Button variant="outline" className="w-full">
                      Log in
                    </Button>
                  </Link>
                  <Link to="/#free-pack" onClick={() => setMenuOpen(false)}>
                    <Button className="w-full">Get started</Button>
                  </Link>
                </>
              )}
            </div>
          </aside>
        </div>
      )}

      <main id="main" className="flex-1">
        <Outlet />
      </main>

      {/* DESIGN.md §17.4: three columns plus a legal row. The domain list is the
          extensibility signal (§3.5) — burying it would teach the next visitor this is
          a single-subject product, which it isn't. Terms/Privacy are marked coming
          soon rather than linked to pages that don't exist yet — a labelled gap, not a
          dead click pretending to work. */}
      <footer className="border-t border-border">
        <div className="mx-auto w-full max-w-6xl px-5 py-14 sm:px-8">
          <div className="grid grid-cols-2 gap-10 sm:grid-cols-4">
            <div className="col-span-2">
              <p className="flex items-center gap-2 font-sans text-lg font-semibold tracking-tight">
                <span className="size-2.5 rounded-[3px] bg-primary ring-1 ring-inset ring-primary-edge" aria-hidden="true" />
                Practicable
              </p>
              <p className="mt-3 max-w-xs text-sm text-muted-foreground">
                Practical answers for risk practitioners — real questions, real guidance, real tools you can
                use today.
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Domains</p>
              <ul className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground">
                {DOMAINS.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Company</p>
              <ul className="mt-3 flex flex-col gap-2 text-sm">
                <li>
                  <a href={SUPPORT_MAILTO} className="text-muted-foreground transition-colors duration-150 hover:text-foreground">
                    Contact
                  </a>
                </li>
                <li className="text-muted-foreground/50">Terms — coming soon</li>
                <li className="text-muted-foreground/50">Privacy — coming soon</li>
              </ul>
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-2 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} Practicable. All rights reserved.</p>
            {/* One-time purchase / lifetime access is a confirmed decision
                (week1_plan.md decision #8 area); a specific refund window is not — that
                still needs an explicit owner call before it's stated as a real policy
                anywhere a buyer can see it. */}
            <p>One-time purchase · lifetime access.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
