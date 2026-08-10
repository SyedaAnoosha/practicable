import { Link, Outlet } from 'react-router'
import { useAuthStore } from '@/stores/useAuthStore'
import { Button } from '@/components/ui/Button'

export default function MarketingLayout() {
  const user = useAuthStore((s) => s.user)

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <Link to="/" className="font-sans text-lg font-semibold tracking-tight">
            Practicable
          </Link>
          <nav className="flex items-center gap-3">
            <Link to={user ? '/dashboard' : '/sign-in'}>
              <Button variant="outline" size="sm">
                {user ? 'My account' : 'Sign in'}
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      <main id="main" className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto w-full max-w-7xl px-5 py-8 text-sm text-muted-foreground sm:px-8">
          Practicable — practical answers for risk practitioners.
        </div>
      </footer>
    </div>
  )
}
