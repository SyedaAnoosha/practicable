import { Link, Outlet } from 'react-router'
import { useAuthStore } from '@/stores/useAuthStore'
import { Button } from '@/components/ui/Button'

const DOMAINS = ['Risk', 'Cyber', 'Compliance', 'Resilience', 'AI']

export default function MarketingLayout() {
  const user = useAuthStore((s) => s.user)

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <Link to="/" className="font-sans text-lg font-semibold tracking-tight">
            Practicable
          </Link>
          <nav className="flex items-center gap-3">
            {user ? (
              <Link to="/dashboard">
                <Button variant="outline" size="sm">
                  My account
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/sign-in">
                  <Button variant="ghost" size="sm">
                    Log in
                  </Button>
                </Link>
                <Link to="/sign-up">
                  <Button variant="primary" size="sm">
                    Create account
                  </Button>
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

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
              <p className="font-sans text-lg font-semibold tracking-tight">Practicable</p>
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
                  <a href="mailto:hello@practicable.com.au" className="text-muted-foreground hover:text-foreground">
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
