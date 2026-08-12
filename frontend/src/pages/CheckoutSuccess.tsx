import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { CircleCheck } from 'lucide-react'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { useAuthStore } from '@/stores/useAuthStore'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
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
// purchase has no lesson to start, and telling someone who just bought a spreadsheet to
// "start the first lesson" sends them to a course they don't own.
//
// Order matters: a course that bundles a template is still a course, so `lesson` wins.
// `href` is computed server-side per content type (ProductContentOut), so this doesn't
// re-derive routes the API already knows.
function nextStep(contents: ProductContent[]): { label: string; href: string } {
  const lesson = contents.find((c) => c.content_type === 'lesson')
  if (lesson) return { label: 'Start the first lesson', href: lesson.href ?? '/dashboard' }

  const template = contents.find((c) => c.content_type === 'template')
  if (template) return { label: 'Download your template', href: template.href ?? '/library' }

  // question_set, or a product whose contents didn't load — the library lists
  // everything they own, so it is always a safe destination.
  return { label: 'Go to your library', href: '/library' }
}

const POLL_INTERVAL_MS = 1500
// Checked against a real production webhook round-trip (Stripe -> Render -> DB commit):
// it landed ~20s after the checkout session completed — right at this constant's old
// value, so a real paying user could hit the "still being set up" fallback moments
// before their entitlement actually arrived. Given headroom rather than the exact
// observed number, since that 20s isn't guaranteed to be the worst case.
const POLL_TIMEOUT_MS = 45_000

// DESIGN.md §29.4 [DECIDED] — "the webhook race". Stripe redirects here before the
// webhook that actually creates the entitlement necessarily arrives, so this page
// cannot assume access exists yet: it polls, shows a loading primary action while
// doing so, and — critically — never shows a locked screen or a bare spinner to
// someone who has already paid.
export function CheckoutSuccess() {
  const [searchParams] = useSearchParams()
  const productSlug = searchParams.get('product_slug') ?? ''
  const user = useAuthStore((s) => s.user)
  const [entitled, setEntitled] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  // Date.now() is impure — set in the polling effect below (where a side effect is
  // allowed), not here at render time.
  const startedAt = useRef<number | null>(null)

  const { data: product } = useQuery({
    queryKey: queryKeys.products.detail(productSlug),
    queryFn: () => api.get<ProductData>(`/products/${productSlug}`).then((res) => res.data),
    enabled: !!productSlug,
  })

  useEffect(() => {
    if (!product || entitled) return

    startedAt.current = Date.now()
    let cancelled = false
    const poll = async () => {
      try {
        const { data } = await api.get<{ product_ids: string[] }>('/me/entitlements')
        if (cancelled) return
        if (data.product_ids.includes(product.id)) {
          setEntitled(true)
          return
        }
      } catch {
        // transient failure — the interval below just tries again
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
  }, [product, entitled])

  const step = nextStep(product?.contents ?? [])

  return (
    <div className="mx-auto w-full max-w-xl px-5 py-12 sm:px-8">
      <Card>
        <CardHeader>
          {/* The success moment gets the same icon-tile treatment as the buy cards'
              accent-blue tiles — a status tile, not a bare checkmark glyph (§14's fixed
              icon map: CircleCheck is the one icon for completion). */}
          <span className="flex size-10 items-center justify-center rounded-full bg-success/10 text-success ring-1 ring-inset ring-success/25">
            <CircleCheck className="size-5" aria-hidden="true" />
          </span>
          <CardTitle className="mt-3">{entitled ? "You're in." : 'Payment confirmed.'}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {product && (
            <p className="text-foreground">
              {product.name}
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
