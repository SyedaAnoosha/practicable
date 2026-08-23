import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router'
import { Menu, Search, X } from 'lucide-react'
import { ProductsMenu } from '@/components/nav/ProductsMenu'
import { useAuthStore } from '@/stores/useAuthStore'
import { Button } from '@/components/ui/Button'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { cn } from '@/lib/utils/cn'
import { motion } from 'motion/react'
import { staggerContainer, riseItem, inViewOnce } from '@/lib/motion'
import { StatusDot } from '@/components/ui/StatusDot'
import { NewsletterForm } from '@/components/marketing/NewsletterForm'
import { CartButton } from '@/components/cart/CartButton'
import { CommandPalette } from '@/components/ui/CommandPalette'
import { useCommandPalette } from '@/lib/useCommandPalette'
import { DiscountBanner } from '@/components/ui/DiscountBanner'
import { CookieConsent } from '@/components/ui/CookieConsent'

const DOMAINS = ['Risk', 'Cyber', 'Compliance', 'Resilience', 'AI']

// Phase 8 (8G): header is `Products` (the ProductsMenu dropdown rendered just above
// this list, not a NAV_ITEMS entry) · `About`. Courses, Templates and Reference packs
// moved into that menu; Questions stays a top-level link — the flagship free
// discovery surface, not just another shopping link buried inside the menu.
// (Superseded the prior comment here, which described Courses/Templates folding into
// Store — that was true before 8G moved them into ProductsMenu instead.)
const NAV_ITEMS = [
  // { to: '/questions', label: 'Questions' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
] as const

// The public header: logo → nav → Sign in → Get started. Get started routes to the
// free entry point, not to sign-up — the free thing is the better first ask.
export default function MarketingLayout() {
  const user = useAuthStore((s) => s.user)
  const location = useLocation()
  // Mobile slide-over: the nav is too wide for phones, so it becomes a sheet.
  const [menuOpen, setMenuOpen] = useState(false)
  const { open: paletteOpen, setOpen: setPaletteOpen } = useCommandPalette()
  // Escape closes the sheet, matching dialog conventions.
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])
  // The header gains shadow-sm after 8px of scroll. Initialised from the current
  // scroll position so a mid-page reload doesn't flash an un-shadowed header.
  const [scrolled, setScrolled] = useState(() => window.scrollY > 8)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Deep links to in-page anchors work from any public page: navigate home first,
  // then scroll. Assumes Home renders those sections synchronously.
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
      <DiscountBanner />
      <header
        className={cn(
          'sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md transition-[box-shadow] duration-200',
          scrolled && 'shadow-sm',
        )}
      >
        {/* The gilt edge: a 2px navy-to-blue hairline along the very top of the
            page — the one decorative device the marketing surfaces get. */}
        <div aria-hidden="true" className="h-0.5 w-full bg-linear-to-r from-primary via-primary/70 to-accent" />
        {/* py-3.5/gap-5 — a tighter rhythm than a typical marketing-site header. */}
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-5 px-5 py-3.5 sm:px-8">
          <Link to="/" className="flex items-center gap-2.5 font-sans text-base font-semibold tracking-tight">
            <span className="size-2.5 rounded-[3px] bg-primary ring-1 ring-inset ring-primary-edge" aria-hidden="true" />
            Practicable
          </Link>
          <nav className="hidden items-center gap-5 md:flex" aria-label="Main">
            <ProductsMenu />
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
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="hidden items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:flex"
              aria-label="Search (Ctrl+K)"
            >
              <Search className="size-3.5" aria-hidden="true" />
              <span className="hidden lg:inline">Search</span>
              <kbd className="ml-1 rounded border border-border bg-background px-1 py-0.5 text-[0.6rem] font-medium">⌘K</kbd>
            </button>
            <CartButton />
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
      </header>      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <CookieConsent />

      {/* Mobile slide-over, same sheet pattern as MemberLayout: an overlay + left-
          docked panel with the nav items as tall touch targets. */}
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
              {/* 8G-7: Mobile has no dropdown — the Products group is expanded under a heading */}
              <p className="px-3 pt-3 pb-1 font-mono text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Products
              </p>
              {[
                { to: '/questions', label: 'Questions — free to read' },
                { to: '/courses', label: 'Courses' },
                { to: '/templates', label: 'Templates' },
                { to: '/packs', label: 'Reference packs' },
                { to: '/store', label: 'All products' },
              ].map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors duration-150 hover:bg-muted"
                >
                  {item.label}
                </Link>
              ))}
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

      {/* Three columns plus a legal row. The domain list signals the product covers
          more than one subject. */}
      <motion.footer
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={inViewOnce}
        className="relative isolate overflow-hidden bg-stage text-stage-foreground"
      >
        {/* The hero's own blue aurora on the `--quiet` variant, since this surface has
            content in all four corners. Plus a dotted grid layer. */}
        <div aria-hidden="true" className="stage-aurora stage-aurora--quiet -z-10" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 opacity-[0.07]"
          style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, white 1.5px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        />

        {/* Newsletter row: pulsing status dot over a headline on the left, an inline
            joined input+button on the right, sharing one row with no gap so it reads
            as a single object. */}
        <div className="mx-auto w-full max-w-7xl px-5 pb-12 pt-11 sm:px-8">
          <div className="flex flex-col gap-8 border-b border-stage-foreground/15 pb-12 lg:flex-row lg:items-end lg:justify-between">
            <motion.div variants={riseItem} className="flex max-w-xl flex-col gap-5">
              <StatusDot label="One question a fortnight" tone="gold" on="stage" />
              <h2 className="text-3xl font-light leading-tight tracking-tight sm:text-4xl">
                A real question from a risk leader, and one thing to do about it.
              </h2>
            </motion.div>

            <motion.div variants={riseItem} className="w-full max-w-md">
              <NewsletterForm />
            </motion.div>
          </div>
        </div>

        <div className="mx-auto w-full max-w-7xl px-5 pb-9 sm:px-8">
          <div className="grid grid-cols-2 gap-10 sm:grid-cols-4">
            <div className="col-span-2">
              <p className="flex items-center gap-2 font-sans text-lg font-semibold tracking-tight">
                {/* Gold, not `bg-primary` like the header's copy: --primary and --stage
                    are the same navy in light mode, so that would be invisible here. */}
                <span className="size-2.5 rounded-[3px] bg-gold ring-1 ring-inset ring-stage-foreground/20" aria-hidden="true" />
                Practicable
              </p>
              <p className="mt-3 max-w-xs text-sm text-stage-foreground/65">
                Practical answers for risk practitioners — real questions, real guidance, real tools you can
                use today.
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-stage-foreground/50">Domains</p>
              <ul className="mt-3 flex flex-col gap-2 text-sm text-stage-foreground/65">
                {DOMAINS.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-stage-foreground/50">Company</p>
              <ul className="mt-3 flex flex-col gap-2 text-sm">
                <li>
                  {/* A real page rather than a `mailto:`, which dead-ends on a machine
                      with no mail client wired to the browser. */}
                  <Link to="/contact" className="text-stage-foreground/65 transition-colors duration-150 hover:text-stage-foreground">
                    Contact
                  </Link>
                </li>
                {/* Each legal page carries its own [DRAFT — FOR REVIEW] banner; the
                    footer link doesn't need to repeat that. */}
                <li>
                  <Link to="/legal/terms" className="text-stage-foreground/65 transition-colors duration-150 hover:text-stage-foreground">
                    Terms
                  </Link>
                </li>
                <li>
                  <Link to="/legal/privacy" className="text-stage-foreground/65 transition-colors duration-150 hover:text-stage-foreground">
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link to="/legal/refunds" className="text-stage-foreground/65 transition-colors duration-150 hover:text-stage-foreground">
                    Refunds
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2 border-t border-stage-foreground/15 pt-6 text-xs text-stage-foreground/55 sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} Practicable. All rights reserved.</p>
            {/* One-time purchase / lifetime access is confirmed; a specific refund
                window is not — that needs an explicit owner call before it's stated
                as policy anywhere a buyer can see it. */}
            <p>One-time purchase · lifetime access.</p>
          </div>
        </div>
      </motion.footer>
    </div>
  )
}
