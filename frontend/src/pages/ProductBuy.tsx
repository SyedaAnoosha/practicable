import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Download, FileQuestion, PlayCircle, ShoppingCart } from 'lucide-react'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import { getActivePromoCode } from '@/lib/promo'
import { useCartStore } from '@/stores/useCartStore'
import { Button } from '@/components/ui/Button'
import { PageTitle } from '@/components/ui/PageTitle'
import { EmptyState } from '@/components/ui/EmptyState'
import { EvidencePanel } from '@/components/product/EvidencePanel'
import { WhyThis } from '@/components/product/WhyThis'
import { OBJECTION_BLOCK } from '@/lib/labels'
import type { Preview } from '@/components/product/PreviewGallery'

interface ProductContent {
  content_type: string
  label: string
  href: string | null
}

// See Dashboard.tsx for the backend side of this — products.py now computes the right route per content_type; this just picks the icon that matches.
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
  licence?: string
  search_title?: string
  version?: string
  last_reviewed_at?: string
  is_bundle?: boolean
  // Evidence layer (W4-R1) — present only when this product is exactly one template;
  // a multi-item product has no single set of file facts to show (absence rule).
  page_count?: number
  sheet_count?: number
  is_editable?: boolean
  has_macros?: boolean
  min_office_version?: string
  previews?: Preview[]
  format?: string
}

// DESIGN.md §29.1: the pre-redirect summary. Stripe owns the actual card form (C2) —
// this is the moment right before the handoff, not a catalogue page to browse through
// (week1_plan.md Phase 4 step 9: the buy surface routes straight here, one click).
//
// week4_plan.md Phase 3 step 4: `lg:grid-cols-[1fr_380px]` — the description and
// contents list on the left, the evidence + price + buy surface sticky on the right
// from `lg`, and a mobile sticky buy bar below it (respecting the home-indicator safe
// area on iOS) so the primary action is always one thumb-reach away on a long page.
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

  const addItem = useCartStore((s) => s.addItem)
  const openCart = useCartStore((s) => s.open)
  const inCart = useCartStore((s) => (product ? s.has(product.id) : false))

  const handleCheckout = async () => {
    if (!product) return
    setIsRedirecting(true)
    setError('')
    try {
      // week3_plan.md W3-R11 — `product_ids` is always a list; a direct "Buy" here is
      // just the one-item case of the same cart checkout the drawer uses.
      const { data } = await api.post<{ checkout_url: string }>('/checkout/session', {
        product_ids: [product.id],
        discount_code: getActivePromoCode(),
      })
      window.location.href = data.checkout_url
    } catch {
      setIsRedirecting(false)
      setError("We couldn't start checkout. Please try again.")
    }
  }

  const handleAddToCart = () => {
    if (!product) return
    addItem({
      id: product.id, slug: product.slug, name: product.name,
      price_amount: product.price_amount, currency: product.currency,
    })
    openCart()
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
      <div className="mx-auto w-full max-w-2xl px-5 py-11 sm:px-8">
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

  const priceBlock = (
    <div className="flex items-baseline justify-between">
      <span className="text-sm text-muted-foreground">
        {product.is_bundle ? 'Bundle price' : 'Price'}
      </span>
      <span className="text-h3 font-semibold tabular-nums text-gold-strong">
        {formatCurrency(product.price_amount, product.currency)}
      </span>
    </div>
  )

  const buySurface = alreadyOwned ? (
    <>
      <p className="text-sm text-foreground" role="status">
        You already own this — no need to pay again.
      </p>
      <Link to="/dashboard">
        <Button className="w-full">Go to your library</Button>
      </Link>
    </>
  ) : (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Button onClick={handleCheckout} loading={isRedirecting} className="w-full sm:flex-1">
        Continue to secure checkout
      </Button>
      {/* Sits alongside, not instead of, Buy — a buyer who wants one thing still gets
          the one-click path (week3_plan.md W3-R11). */}
      <Button
        onClick={handleAddToCart}
        variant="outline"
        disabled={inCart}
        className="w-full sm:w-auto"
      >
        <ShoppingCart className="size-4" aria-hidden="true" />
        {inCart ? 'In your cart' : 'Add to cart'}
      </Button>
    </div>
  )

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 pb-28 sm:px-8 lg:pb-8">
      <div className="lg:grid lg:grid-cols-[1fr_380px] lg:items-start lg:gap-8">
        <div>
          <PageTitle title={product.name} description={product.description} />

          <ul className="mt-6 flex flex-col gap-2 text-sm text-foreground">
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
        </div>

        {/* Right column: evidence + the buy surface, sticky from `lg` so it stays in
            view on a long description. Hidden below `lg` in favour of the fixed
            mobile bar so the primary action never appears twice on screen at once. */}
        <div className="mt-8 hidden flex-col gap-5 lg:sticky lg:top-24 lg:mt-0 lg:flex">
          {/* CTA ladder (8F-3): Buy is the only primary. See sample pages scrolls to
              PreviewGallery inside EvidencePanel. Start with a free one is tertiary. */}
          <div className="flex flex-col gap-3">
            {alreadyOwned ? (
              <Link to="/dashboard">
                <Button className="w-full">Go to your library</Button>
              </Link>
            ) : (
              <>
                <Button onClick={handleCheckout} loading={isRedirecting} className="w-full">
                  Continue to secure checkout
                </Button>
                <Button
                  onClick={handleAddToCart}
                  variant="outline"
                  disabled={inCart}
                  className="w-full"
                >
                  <ShoppingCart className="size-4" aria-hidden="true" />
                  {inCart ? 'In your cart' : 'Add to cart'}
                </Button>
              </>
            )}
            {product.previews && product.previews.length > 0 && !alreadyOwned && (
              <a
                href="#evidence-panel"
                className="text-center text-sm text-primary underline underline-offset-2 hover:text-primary/80"
              >
                See the sample pages
              </a>
            )}
          </div>

          <EvidencePanel
            id="evidence-panel"
            format={product.format}
            pageCount={product.page_count}
            sheetCount={product.sheet_count}
            isEditable={product.is_editable}
            hasMacros={product.has_macros}
            minOfficeVersion={product.min_office_version}
            previews={product.previews}
            version={product.version}
            lastReviewedAt={product.last_reviewed_at}
            licence={product.licence}
            title={product.name}
          />

          <WhyThis />

          {/* Objection block (8F-4) — five things, four of which are columns. */}
          <div className="rounded-lg border border-border bg-card p-5 sm:p-6">
            <p className="eyebrow">Before you decide</p>
            <ul className="mt-4 flex flex-col gap-3">
              {OBJECTION_BLOCK.map((item) => (
                <li key={item.label}>
                  <p className="text-sm font-medium text-foreground">
                    {'href' in item && item.href ? (
                      <a href={item.href} className="underline underline-offset-2 hover:text-primary">
                        {item.label}
                      </a>
                    ) : (
                      item.label
                    )}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{item.detail}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 shadow-sm">
            {priceBlock}
            {buySurface}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <p className="text-center text-xs text-muted-foreground">
              Payment is handled by Stripe. We never see your card details.
            </p>
          </div>
        </div>

        {/* Mobile/tablet: evidence inline below the description, buy surface lives in
            the fixed bottom bar instead. */}
        <div className="mt-8 flex flex-col gap-5 lg:hidden">
          <EvidencePanel
            format={product.format}
            pageCount={product.page_count}
            sheetCount={product.sheet_count}
            isEditable={product.is_editable}
            hasMacros={product.has_macros}
            minOfficeVersion={product.min_office_version}
            previews={product.previews}
            version={product.version}
            lastReviewedAt={product.last_reviewed_at}
            licence={product.licence}
            title={product.name}
          />
          <WhyThis />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
      </div>

      {/* Fixed mobile buy bar — `env(safe-area-inset-bottom)` keeps the primary
          button clear of the home indicator on iOS rather than sitting flush
          against it. */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card px-5 py-3 shadow-[0_-2px_8px_rgba(0,0,0,0.06)] lg:hidden"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto flex w-full max-w-4xl items-center gap-3">
          <span className="whitespace-nowrap text-lg font-semibold tabular-nums text-gold-strong">
            {formatCurrency(product.price_amount, product.currency)}
          </span>
          <div className="flex-1">
            {alreadyOwned ? (
              <Link to="/dashboard">
                <Button className="w-full">Go to your library</Button>
              </Link>
            ) : (
              <Button onClick={handleCheckout} loading={isRedirecting} className="w-full">
                Continue to secure checkout
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
