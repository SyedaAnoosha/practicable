import { ShoppingCart } from 'lucide-react'
import { useCartStore } from '@/stores/useCartStore'
import { cn } from '@/lib/utils/cn'

// A trigger for CartDrawer (rendered once in RootLayout), used in both
// MarketingLayout's header and MemberLayout's sidebar account row — same icon+badge,
// different surrounding chrome, so the two never drift into two different cart affordances.
export function CartButton({ className, on = 'surface' }: { className?: string; on?: 'surface' | 'stage' }) {
  const count = useCartStore((s) => s.items.length)
  const open = useCartStore((s) => s.open)

  return (
    <button
      type="button"
      onClick={open}
      className={cn(
        'relative flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        className,
      )}
      aria-label={count > 0 ? `Cart, ${count} item${count === 1 ? '' : 's'}` : 'Cart'}
    >
      <ShoppingCart className="size-[18px]" aria-hidden="true" />
      {count > 0 && (
        <span
          aria-hidden="true"
          className={cn(
            'absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums',
            // `--accent` flips between themes and is only safe on a surface that flips
            // with it (DESIGN.md §7.6) — MemberLayout's sidebar is a `--stage` plane
            // that never flips, so it takes the gold pairing StatusDot already
            // established as stage-safe instead.
            on === 'stage' ? 'bg-gold text-stage' : 'bg-accent text-accent-foreground',
          )}
        >
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  )
}
