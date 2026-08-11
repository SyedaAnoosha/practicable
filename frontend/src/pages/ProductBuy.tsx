import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'

interface ProductContent {
  content_type: string
  label: string
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

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading…</div>
  if (!product) return <div className="p-8 text-destructive">We couldn't find that product.</div>

  return (
    <div className="mx-auto w-full max-w-xl px-5 py-12 sm:px-8">
      <Card>
        <CardHeader>
          <CardTitle>{product.name}</CardTitle>
          <CardDescription>{product.description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <ul className="flex flex-col gap-1 text-sm text-foreground">
            {product.contents.map((c) => (
              <li key={`${c.content_type}-${c.label}`} className="flex items-center gap-2">
                <span aria-hidden="true">·</span> {c.label}
              </li>
            ))}
          </ul>

          <div className="flex items-baseline justify-between border-t border-border pt-4">
            <span className="text-sm text-muted-foreground">Subtotal</span>
            <span className="font-sans text-lg font-semibold">
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
