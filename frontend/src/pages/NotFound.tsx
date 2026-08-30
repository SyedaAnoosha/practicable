import { Link } from 'react-router'
import { Compass } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { PageTitle } from '@/components/ui/PageTitle'

/**
 * The catch-all page for unmatched URLs. Without it, react-router's built-in developer
 * error screen ("💿 Hey developer 👋 …") shipped to real visitors — framework-leaking,
 * wrong audience, no way back. Follows the same rule as the product's other dead ends
 * (`EmptyState`, `ErrorState`): say what happened, don't blame the visitor, offer
 * specific next steps rather than a bare "go home".
 */
export function NotFound() {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-16 sm:px-8">
      <div className="flex flex-col items-center text-center">
        <span
          className="flex size-12 items-center justify-center rounded-lg bg-secondary text-muted-foreground"
          aria-hidden="true"
        >
          <Compass className="size-6" />
        </span>
        <PageTitle
          className="mt-5"
          eyebrow="404"
          title="That page isn’t here"
          description="The link may be out of date, or the address may have a typo in it. Nothing is broken — this address just doesn’t point at anything."
        />

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link to="/">
            <Button>Go to the home page</Button>
          </Link>
          <Link to="/questions">
            <Button variant="outline">Browse the questions</Button>
          </Link>
        </div>

        <nav aria-label="Other places to look" className="mt-10 w-full border-t border-border pt-6">
          <p className="text-sm text-muted-foreground">Or head straight to:</p>
          <ul className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
            {[
              { to: '/courses', label: 'Courses' },
              { to: '/templates', label: 'Templates' },
              { to: '/packs', label: 'Reference packs' },
              { to: '/pricing', label: 'Pricing' },
              { to: '/contact', label: 'Contact us' },
            ].map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className="text-accent underline-offset-4 hover:underline focus-visible:underline"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  )
}
