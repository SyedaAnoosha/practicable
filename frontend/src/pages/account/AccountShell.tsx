import { NavLink, Outlet } from 'react-router'
import { User, ShieldCheck, ReceiptText, Bell, Download } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { PageTitle } from '@/components/ui/PageTitle'

/** Phase 10 §2 — routed sub-pages for the account shell.
 *  Decision #44 default: routed sub-pages, not a Tabs primitive.
 *  Each section is its own form with its own save action. */

const ACCOUNT_SECTIONS = [
  { to: '/account/profile', label: 'Profile', icon: User },
  { to: '/account/security', label: 'Security', icon: ShieldCheck },
  { to: '/account/purchases', label: 'Purchases', icon: ReceiptText },
  { to: '/account/notifications', label: 'Notifications', icon: Bell },
  { to: '/account/data', label: 'Data & privacy', icon: Download },
] as const

export function AccountShell() {
  return (
    /* `[FIXED 2026-08-22]` Was `max-w-4xl` with a hand-rolled `text-h4` h1.
     *
     * Two problems, both visible on one screenshot. The h1 was set at the SAME rung as
     * the `<h2>` each section renders inside it, so "Account" and "Security" were the
     * same size and the page had no visual hierarchy — the title read as a stray label
     * rather than the name of the page. Every other page in the product goes through
     * `PageTitle`, which owns the rung, the eyebrow and the `tabIndex={-1}` focus
     * target that route-change focus management depends on; hand-rolling the heading
     * here opted this page out of all three.
     *
     * The container is also narrowed to `max-w-3xl`: with a 192px nav rail and forms
     * capped at `max-w-md`, `max-w-4xl` left a large dead band of empty page to the
     * right of every field. Narrowing the shell pulls the form back under its own
     * heading instead of stranding it. */
    <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8">
      <PageTitle className="mb-8" eyebrow="Your account" title="Account" />
      <div className="flex flex-col gap-8 md:flex-row">
        {/* Tab strip — a nav landmark the kit already handles (§2) */}
        <nav aria-label="Account sections" className="w-full shrink-0 md:w-48">
          <ul className="flex flex-row gap-1 overflow-x-auto md:flex-col">
            {ACCOUNT_SECTIONS.map((section) => (
              <li key={section.to}>
                <NavLink
                  to={section.to}
                  end
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )
                  }
                >
                  <section.icon className="size-4 shrink-0" aria-hidden="true" />
                  {section.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        {/* Section content */}
        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
