import { NavLink, Outlet } from 'react-router'
import { User, ShieldCheck, ReceiptText, Bell, Download } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

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
    <div className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-8">
      <h1 className="mb-8 text-h4 font-semibold text-foreground">Account</h1>
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
