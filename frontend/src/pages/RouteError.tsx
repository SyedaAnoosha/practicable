import { Link, isRouteErrorResponse, useRouteError } from 'react-router'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { PageTitle } from '@/components/ui/PageTitle'
import { NotFound } from '@/pages/NotFound'

/**
 * `[ADDED 2026-08-22]` The router carried no `errorElement`, so anything thrown during
 * a route's render — a bad response shape, a null dereference in a page component —
 * surfaced react-router's built-in developer screen ("💿 Hey developer 👋") to whoever
 * happened to be using the site. Every page's own `isError` branch was carefully
 * written; the one case none of them could catch was a throw, and that was exactly the
 * case with no handling at all.
 *
 * A 404 routed here (a matched path that threw a 404 response) is a wrong address, not
 * a fault, so it hands off to `NotFound` rather than claiming something broke.
 * Everything else says plainly that this end broke, and offers a reload — because for a
 * transient render error, retrying genuinely is the right next action.
 *
 * The error itself goes to the console for whoever is debugging, and is never printed
 * on the page: a stack trace tells a visitor nothing and can carry internals.
 */
export function RouteError() {
  const error = useRouteError()

  if (isRouteErrorResponse(error) && error.status === 404) {
    return <NotFound />
  }

  if (import.meta.env.DEV) {
    console.error('[RouteError]', error)
  }

  const status = isRouteErrorResponse(error) ? error.status : null

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-16 sm:px-8">
      <div className="flex flex-col items-center text-center">
        <span
          className="flex size-12 items-center justify-center rounded-lg bg-secondary text-muted-foreground"
          aria-hidden="true"
        >
          <AlertTriangle className="size-6" />
        </span>
        <PageTitle
          className="mt-5"
          eyebrow={status ? `Error ${status}` : 'Error'}
          title="Something went wrong at our end"
          description="This page didn’t load properly. It isn’t anything you did — reloading usually clears it."
        />

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button onClick={() => window.location.reload()}>Reload the page</Button>
          <Link to="/">
            <Button variant="outline">Go to the home page</Button>
          </Link>
        </div>

        <p className="mt-8 border-t border-border pt-6 text-sm text-muted-foreground">
          If it keeps happening,{' '}
          <Link to="/contact" className="text-accent underline underline-offset-4">
            tell us what you were doing
          </Link>{' '}
          and we’ll look into it.
        </p>
      </div>
    </div>
  )
}
