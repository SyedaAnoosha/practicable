import { NavLink, Outlet } from 'react-router'
import { User, ShieldCheck, ReceiptText, Bell, Download } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { PageTitle } from '@/components/ui/PageTitle'

/** Routed sub-pages for the account shell.
 * Decision #44 default: routed sub-pages, not a Tabs primitive.
 * Each section is its own form with its own save action. */

const ACCOUNT_SECTIONS = [
  { to: '/account/profile', label: 'Profile', icon: User },
  { to: '/account/security', label: 'Security', icon: ShieldCheck },
  { to: '/account/purchases', label: 'Purchases', icon: ReceiptText },
  { to: '/account/notifications', label: 'Notifications', icon: Bell },
  { to: '/account/data', label: 'Data & privacy', icon: Download },
] as const

export function AccountShell() {
  return (
    /* `PageTitle` (not a hand-rolled h1) so the title gets its own rung above the
     * section `<h2>`s, plus the eyebrow and the `tabIndex={-1}` focus target
     * route-change focus management needs. `max-w-3xl` so the form sits under its
     * heading rather than being stranded left of a dead band. */
    <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8">
      <PageTitle className="mb-8" eyebrow="Your account" title="Account" />
      <div className="flex flex-col gap-8 md:flex-row">
        {/* Tab strip — a nav landmark the kit already handles */}
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
