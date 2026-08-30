import { Link, isRouteErrorResponse, useRouteError } from 'react-router'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { PageTitle } from '@/components/ui/PageTitle'
import { NotFound } from '@/pages/NotFound'

/**
 * The route `errorElement` — catches anything thrown during a route's render, which no
 * page's own `isError` branch can. A 404 routed here (a matched path that threw a 404)
 * hands off to `NotFound`; everything else says this end broke and offers a reload. The
 * error goes to the console only, never onto the page.
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
