import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useQueries } from '@tanstack/react-query'
import { CircleCheck } from 'lucide-react'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { useAuthStore } from '@/stores/useAuthStore'
import { useCartStore } from '@/stores/useCartStore'
import { clearActivePromoCode } from '@/lib/promo'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { PageTitle } from '@/components/ui/PageTitle'
import { SUPPORT_MAILTO } from '@/lib/support'

interface ProductContent {
  content_type: string
  label: string
  href: string | null
}

interface ProductData {
  id: string
  slug: string
  name: string
  contents: ProductContent[]
}

// What the buyer should do next depends on what they actually bought. A template-only
// purchase has no lesson to start. Order matters: a course that bundles a template is
// still a course, so `lesson` wins. `href` is computed server-side per content type.
function nextStep(contents: ProductContent[]): { label: string; href: string } {
  const lesson = contents.find((c) => c.content_type === 'lesson')
  if (lesson) return { label: 'Start the first lesson', href: lesson.href ?? '/dashboard' }

  const template = contents.find((c) => c.content_type === 'template')
  if (template) return { label: 'Download your template', href: template.href ?? '/library' }

  // Falls back to the library, which is always a safe destination.
  return { label: 'Go to your library', href: '/library' }
}

const POLL_INTERVAL_MS = 1500
// A production webhook round-trip landed ~20s after checkout completed, so this is
// given headroom above that rather than the exact observed number.
const POLL_TIMEOUT_MS = 45_000

// The webhook race: Stripe redirects here before the webhook that creates the
// entitlement necessarily arrives, so this page polls rather than assuming access
// exists, and never shows a locked screen or bare spinner to someone who already paid.
//
// `product_slugs` (plural, comma-joined) replaces the old
// singular `product_slug`; a direct "Buy" is just the one-slug case of the same param,
// not a second code path (checkout.py builds this same query string either way).
export function CheckoutSuccess() {
  const [searchParams] = useSearchParams()
  const productSlugs = (searchParams.get('product_slugs') ?? searchParams.get('product_slug') ?? '')
    .split(',')
    .filter(Boolean)
  const user = useAuthStore((s) => s.user)
  const clearCart = useCartStore((s) => s.clear)
  const [entitled, setEntitled] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  // Date.now() is impure — set in the polling effect below, not at render time.
  const startedAt = useRef<number | null>(null)

  const productQueries = useQueries({
    queries: productSlugs.map((slug) => ({
      queryKey: queryKeys.products.detail(slug),
      queryFn: () => api.get<ProductData>(`/products/${slug}`).then((res) => res.data),
    })),
  })
  const products = productQueries.map((q) => q.data).filter((p): p is ProductData => !!p)
  const allProductsLoaded = products.length === productSlugs.length && productSlugs.length > 0

  useEffect(() => {
    if (!allProductsLoaded || entitled) return

    startedAt.current = Date.now()
    let cancelled = false
    const poll = async () => {
      try {
        const { data } = await api.get<{ product_ids: string[] }>('/me/entitlements')
        if (cancelled) return
        // ALL products in the cart, not just one — the cart drains only once the
        // whole order is confirmed, never partway through (W3-R11's ordering rule).
        if (products.every((p) => data.product_ids.includes(p.id))) {
          setEntitled(true)
          clearCart()
          // Same gate as the cart: the suggested promo code is forgotten only once
          // the whole order is confirmed, so a first-order-only code is not re-sent
          // on the next checkout.
          clearActivePromoCode()
          return
        }
      } catch {
        // Transient failure — the interval below just tries again
      }
      if (Date.now() - (startedAt.current ?? Date.now()) >= POLL_TIMEOUT_MS) {
        if (!cancelled) setTimedOut(true)
        return
      }
      if (!cancelled) timeoutId = setTimeout(poll, POLL_INTERVAL_MS)
    }

    let timeoutId = setTimeout(poll, 0)
    return () => {
      cancelled = true
      clearTimeout(timeoutId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `products` is derived fresh every render from productQueries; re-keying on it would re-run the poll loop on every tick.
  }, [allProductsLoaded, entitled, clearCart])

  const step = nextStep(products.flatMap((p) => p.contents))
  const isCart = productSlugs.length > 1

  return (
    <div className="mx-auto w-full max-w-xl px-5 py-8 sm:px-8">
      <Card>
        <CardHeader>
          {/* The success moment gets the same icon-tile treatment as the buy cards'
              accent-blue tiles — a status tile, not a bare checkmark glyph (§14's fixed
              icon map: CircleCheck is the one icon for completion). */}
          <span className="flex size-10 items-center justify-center rounded-full bg-success/10 text-success ring-1 ring-inset ring-success/25">
            <CircleCheck className="size-5" aria-hidden="true" />
          </span>
          <PageTitle className="mt-3" title={entitled ? "You're in." : 'Payment confirmed.'} />
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {products.length > 0 && (
            <p className="text-foreground">
              {isCart ? products.map((p) => p.name).join(', ') : products[0].name}
              <br />
              <span className="text-sm text-muted-foreground">
                Payment confirmed
                {user?.email ? ` · Receipt sent to ${user.email}` : ''}
              </span>
            </p>
          )}

          {!timedOut && (
            <Link to={step.href}>
              <Button loading={!entitled} className="w-full">
                {entitled ? step.label : 'Setting up your access…'}
              </Button>
            </Link>
          )}

          {timedOut && !entitled && (
            <>
              <p className="text-sm text-muted-foreground">
                Your access is still being set up — this usually takes a few seconds. We've emailed your
                receipt and we'll email again the moment it's ready.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="outline" className="sm:flex-1" onClick={() => window.location.reload()}>
                  Refresh
                </Button>
                <a href={SUPPORT_MAILTO} className="sm:flex-1">
                  <Button variant="ghost" className="w-full">
                    Contact us
                  </Button>
                </a>
              </div>
            </>
          )}

          <Link to="/library" className="text-center text-sm text-muted-foreground underline">
            Or browse everything in your library
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
