import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Download, FileQuestion, PlayCircle } from 'lucide-react'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'

interface ProductContent {
  content_type: string
  label: string
  href: string | null
}

// See Dashboard.tsx for the backend side of this — products.py now computes the
// right route per content_type; this just picks the icon that matches.
const CONTENT_ICON: Record<string, typeof PlayCircle> = {
  lesson: PlayCircle,
  template: Download,
  question_set: FileQuestion,
}

interface ProductData {
  id: string
  slug: string
  name: string
  description: string
  price_amount: number
  currency: string
  contents: ProductContent[]
}

// DESIGN.md §29.1: the pre-redirect summary. Stripe owns the actual card form (C2) —
// this is the moment right before the handoff, not a catalogue page to browse through
// (week1_plan.md Phase 4 step 9: the buy surface routes straight here, one click).
export function ProductBuy() {
  const { slug } = useParams<{ slug: string }>()
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [error, setError] = useState('')

  const { data: product, isLoading } = useQuery({
    queryKey: queryKeys.products.detail(slug ?? ''),
    queryFn: () => api.get<ProductData>(`/products/${slug}`).then((res) => res.data),
    enabled: !!slug,
  })

  // Without this check, someone who already bought the product and comes back to
  // this page (e.g. clicking "See what's included" again from the dashboard) was
  // always shown "Continue to secure checkout" and sent through Stripe a second
  // time — reading as "it's asking me to pay/confirm again" even though they
  // already own it.
  const { data: entitlements } = useQuery({
    queryKey: queryKeys.me.entitlements(),
    queryFn: () => api.get<{ product_ids: string[] }>('/me/entitlements').then((res) => res.data),
  })
  const alreadyOwned = !!product && !!entitlements?.product_ids.includes(product.id)

  const handleCheckout = async () => {
    if (!product) return
    setIsRedirecting(true)
    setError('')
    try {
      const { data } = await api.post<{ checkout_url: string }>('/checkout/session', {
        product_id: product.id,
      })
      window.location.href = data.checkout_url
    } catch {
      setIsRedirecting(false)
      setError("We couldn't start checkout. Please try again.")
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-label="Loading product">
        <div className="size-8 animate-spin rounded-full border-2 border-border border-t-primary" />
        <span className="sr-only">Loading product…</span>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="mx-auto w-full max-w-2xl px-5 py-16 sm:px-8">
        <EmptyState
          title="We couldn't find that product."
          description="It may have been moved or unpublished."
          action={
            <Link to="/dashboard">
              <Button variant="outline">Back to your library</Button>
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-xl px-5 py-12 sm:px-8">
      {/* Same gold left-rule family as the question page's buy card and the course
          buy surface — the conversion moment earns the accent. */}
      <Card
        className="border-l-4 shadow-sm transition-[box-shadow] duration-150 hover:shadow-md"
        style={{ borderLeftColor: 'var(--accent)' }}
      >
        <CardHeader>
          <CardTitle>{product.name}</CardTitle>
          <CardDescription>{product.description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <ul className="flex flex-col gap-2 text-sm text-foreground">
            {product.contents.map((c) => {
              const Icon = CONTENT_ICON[c.content_type] ?? FileQuestion
              // Lesson/template links 403 gracefully with a clear "not entitled yet"
              // message (Lesson.tsx/Template.tsx already handle that state) — safe to
              // always link, not just once alreadyOwned is confirmed.
              if (c.href) {
                return (
                  <li key={`${c.content_type}-${c.label}`}>
                    <Link
                      to={c.href}
                      className="flex items-center gap-2 transition-colors hover:text-primary"
                    >
                      <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
                      {c.label}
                    </Link>
                  </li>
                )
              }
              return (
                <li key={`${c.content_type}-${c.label}`} className="flex items-center gap-2">
                  <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  {c.label}
                </li>
              )
            })}
          </ul>

          <div className="flex items-baseline justify-between border-t border-border pt-4">
            <span className="text-sm text-muted-foreground">Subtotal</span>
            {/* Gold, but only because this is 24px — the gold token is
                large-text-only on light surfaces (theme.css). Do not shrink it. */}
            <span className="text-2xl font-semibold tabular-nums text-accent">
              {formatCurrency(product.price_amount, product.currency)}
            </span>
          </div>

          {alreadyOwned ? (
            <>
              <p className="text-sm text-foreground" role="status">
                You already own this — no need to pay again.
              </p>
              <Link to="/dashboard">
                <Button className="w-full">Go to your library</Button>
              </Link>
            </>
          ) : (
            <Button onClick={handleCheckout} loading={isRedirecting} className="w-full">
              Continue to secure checkout
            </Button>
          )}

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <p className="text-center text-xs text-muted-foreground">
            Payment is handled by Stripe. We never see your card details.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
