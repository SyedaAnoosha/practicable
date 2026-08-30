import { Link } from 'react-router'
import { Package, ShoppingCart } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import { useCartStore } from '@/stores/useCartStore'
import { Button } from '@/components/ui/Button'

export interface BundlePart {
  name: string
  price_amount: number
}

export interface BundleCardProps {
  eyebrow?: string
  title: string
  description: string
  parts: BundlePart[]
  bundlePriceAmount: number
  currency: string
  product: { id: string; slug: string; name: string; price_amount: number; currency: string }
  /** True if the buyer already owns every part separately — the bundle stops being
   * offered at that point (§20.2: selling someone something they own is the fastest
   * way to owe a refund). */
  ownsEveryPart?: boolean
  owned?: boolean
  /** The heading level this card's title renders at.
   *
   * It was hard-coded `<h3>`. On /store the card is the page's featured item and sits
   * directly under the `<h1>`, with the first `<h2>` ("Reference packs") only appearing
   * further down — so the document jumped h1 → h3, which axe reports as `heading-order`
   * and which makes the outline wrong for anyone navigating by headings.
   *
   * Defaulted to `h3` so any future in-section use is unchanged; /store passes `h2`,
   * which is what it actually is there. */
  headingLevel?: 'h2' | 'h3'
}

// The saving is shown as a real dollar amount computed from the
// two real parts, never a hard-coded "Save $X" string that could drift from the actual
// arithmetic if either part's price ever changes.
export function BundleCard({
  eyebrow = 'Bundle', title, description, parts, bundlePriceAmount, currency, product, ownsEveryPart, owned,
  headingLevel: Heading = 'h3',
}: BundleCardProps) {
  const addItem = useCartStore((s) => s.addItem)
  const openCart = useCartStore((s) => s.open)
  const inCart = useCartStore((s) => s.has(product.id))

  if (ownsEveryPart && !owned) {
    // Both parts already held separately, just not as this exact bundle product —
    // nothing left to sell here.
    return null
  }

  const separately = parts.reduce((sum, p) => sum + p.price_amount, 0)
  const saving = separately - bundlePriceAmount

  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-card p-6 pl-7 sm:p-7 sm:pl-8">
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px] bg-gold" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <Heading className="mt-1 text-h3 font-semibold text-foreground">{title}</Heading>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">{description}</p>
        </div>
        <Package className="size-5 shrink-0 text-gold-strong" aria-hidden="true" />
      </div>

      <div className="mt-6 flex flex-col gap-2 text-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Includes</p>
        {parts.map((part) => (
          <div key={part.name} className="flex items-baseline justify-between">
            <span className="text-foreground">· {part.name}</span>
            <span className="tabular-nums text-muted-foreground">{formatCurrency(part.price_amount, currency)}</span>
          </div>
        ))}
        <div className="mt-2 border-t border-border pt-2">
          <div className="flex items-baseline justify-between">
            <span className="text-muted-foreground">Separately</span>
            <span className="tabular-nums text-muted-foreground line-through">
              {formatCurrency(separately, currency)}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="font-medium text-foreground">Bundle</span>
            <span className="text-2xl font-semibold tabular-nums text-gold-strong">
              {formatCurrency(bundlePriceAmount, currency)}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="font-medium text-foreground">You save</span>
            <span className="font-semibold tabular-nums text-success">{formatCurrency(saving, currency)}</span>
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
        {owned ? (
          <Link to="/library">
            <Button variant="secondary">In your library →</Button>
          </Link>
        ) : (
          <>
            <Button
              variant="outline"
              onClick={() => {
                addItem(product)
                openCart()
              }}
              disabled={inCart}
            >
              <ShoppingCart className="size-4" aria-hidden="true" />
              {inCart ? 'In your cart' : 'Add to cart'}
            </Button>
            <Link to={`/buy/${product.slug}`}>
              <Button className="w-full sm:w-auto">Buy the bundle</Button>
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
