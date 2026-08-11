import { Link, Outlet } from 'react-router'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

export default function AuthLayout() {
  return (
    <div id="main" className="relative flex min-h-screen flex-col items-center justify-center bg-background p-4">
      {/* The same gilt edge as the marketing header — a visitor on the sign-in page
          should never have to guess which product they're signing into. */}
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 w-full bg-linear-to-r from-primary via-primary/70 to-accent" />
      <div className="absolute right-5 top-5">
        <ThemeToggle />
      </div>
      {/* Brand anchor above the form card — the auth surfaces are the only chrome-less
          pages, so the wordmark is the one thing tying them to the product. */}
      <Link
        to="/"
        className="mb-8 flex items-center gap-2.5 font-sans text-lg font-semibold tracking-tight"
      >
        <span className="size-2.5 rounded-[3px] bg-primary ring-1 ring-inset ring-primary-edge" aria-hidden="true" />
        Practicable
      </Link>
      <Outlet />
    </div>
  )
}
