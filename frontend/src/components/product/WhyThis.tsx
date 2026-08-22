import { CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { WHY_BUY_CLAIMS } from '@/lib/labels'

interface WhyThisProps {
  className?: string
}

/** Phase 8F (W4-R16) — the argument for why this product is worth the price.
 *  Placed below EvidencePanel on /buy/:slug, /templates/:templateId and
 *  /store/packs/:slug. Every claim traces to a column or a guard; the copy
 *  deck in labels.ts is the permitted vocabulary. Zero social-proof claims. */
export const WhyThis = ({ className }: WhyThisProps) => {
  return (
    <section
      aria-label="Why Practicable"
      className={cn(
        'rounded-lg border border-border bg-card p-5 sm:p-6',
        className,
      )}
    >
      <p className="eyebrow">Why Practicable</p>
      <ul className="mt-4 flex flex-col gap-3">
        {WHY_BUY_CLAIMS.map((claim) => (
          <li key={claim.label} className="flex items-start gap-3">
            <CheckCircle
              className="mt-0.5 size-4 shrink-0 text-gold-strong"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-medium text-foreground">
                {claim.label}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {claim.detail}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
