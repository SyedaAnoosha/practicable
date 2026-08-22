import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { isAxiosError } from 'axios'
import { ShoppingCart, X } from 'lucide-react'
import { api } from '@/lib/api/client'
import { useAuthStore } from '@/stores/useAuthStore'
import { signInUrlFor } from '@/lib/utils/nextPath'
import { useCartStore } from '@/stores/useCartStore'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import { getActivePromoCode } from '@/lib/promo'
import { Button } from '@/components/ui/Button'

// week3_plan.md W3-R11 — a drawer, same slide-over pattern MarketingLayout's mobile
// menu and MemberLayout's mobile sheet already use (overlay + right-docked panel,
// Escape-to-close, autoFocus on the close button), rather than a new one-off pattern.
export function CartDrawer() {
  const isOpen = useCartStore((s) => s.isOpen)
  const close = useCartStore((s) => s.close)
  const items = useCartStore((s) => s.items)
  const removeItem = useCartStore((s) => s.removeItem)
  const user = useAuthStore((s) => s.user)
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, close])

  if (!isOpen) return null

  const total = items.reduce((sum, i) => sum + i.price_amount, 0)
  const currency = items[0]?.currency ?? 'AUD'

  const handleCheckout = async () => {
    if (items.length === 0) return
    setError('')
    if (!user) {
      // Same guard /buy/:slug relies on (MemberLayout redirects signed-out visitors
      // to /sign-in) — the cart drawer is reachable from public pages, so it has to
      // check for itself rather than assume the route already gated it.
      // .assign(), not `.href =` — the react-hooks/immutability rule flags a property
      // write to the module-level `window` global as if it were outer-scope mutation;
      // the method call is the same navigation with no such false positive.
      // `[CHANGED 2026-08-21, USER_FLOW_AUDIT.md §3]` Come back to the page the drawer
      // was opened over. The cart itself survives regardless (localStorage), but
      // returning to /dashboard made the visitor re-find the page and reopen the drawer.
      window.location.assign(signInUrlFor(`${window.location.pathname}${window.location.search}`))
      return
    }
    setIsCheckingOut(true)
    try {
      const { data } = await api.post<{ checkout_url: string }>('/checkout/session', {
        product_ids: items.map((i) => i.id),
        discount_code: getActivePromoCode(),
      })
      window.location.assign(data.checkout_url)
      // Deliberately NOT clearing the cart here — it drains only once the webhook
      // confirms, on the success page. Clearing on redirect and having the webhook
      // fail behind it would show an empty cart for a purchase that never completed.
    } catch (err) {
      setIsCheckingOut(false)
      if (isAxiosError(err) && err.response?.status === 409) {
        const detail = err.response.data?.detail
        const message = typeof detail === 'object' && detail !== null ? (detail as { message?: string }).message : undefined
        setError(message ?? 'You already own one of these — remove it and try again.')
      } else {
        setError("We couldn't start checkout. Please try again.")
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={close} aria-hidden="true" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Cart"
        className="absolute inset-y-0 right-0 flex w-full max-w-sm flex-col bg-card shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <p className="flex items-center gap-2 font-sans text-base font-semibold tracking-tight text-foreground">
            <ShoppingCart className="size-[18px]" aria-hidden="true" />
            Your cart
          </p>
          <button
            type="button"
            onClick={close}
            className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            aria-label="Close cart"
            autoFocus
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nothing in your cart yet. Add a template, course or pack to buy several things in one checkout.
            </p>
          ) : (
            <ul className="flex flex-col gap-4">
              {items.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                    <p className="text-sm tabular-nums text-muted-foreground">
                      {formatCurrency(item.price_amount, item.currency)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="shrink-0 text-xs text-muted-foreground underline underline-offset-2 transition-colors duration-150 hover:text-foreground"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-border px-5 py-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="text-xl font-semibold tabular-nums text-accent">
                {formatCurrency(total, currency)}
              </span>
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button onClick={handleCheckout} loading={isCheckingOut} className="w-full">
              {user ? 'Checkout' : 'Sign in to checkout'}
            </Button>
            <Link to="/store" onClick={close} className="text-center text-xs text-muted-foreground underline underline-offset-2">
              See everything else on sale
            </Link>
          </div>
        )}
      </aside>
    </div>
  )
}
