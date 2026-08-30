import { Scale } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface LicenceLineProps {
  licence: string
  className?: string
}

// "The refusal is the design": a licence tier the owner hasn't
// written precise terms for renders NOTHING, not the raw enum value — `new_additions.md`
// §20's own warning is that licence terms are exactly the kind of thing that must never
// be a casual "commercial use allowed" sentence made up on the spot.
const SENTENCE: Record<string, string> = {
  standard: 'Use and adapt this inside your own organisation.',
  // Client_delivery / multi_client: [OWNER #25] — not rendered until the decision
  // closes. Deliberately absent from this map rather than mapped to a placeholder.
}

export const LicenceLine = ({ licence, className }: LicenceLineProps) => {
  const sentence = SENTENCE[licence]
  if (!sentence) return null

  return (
    <p className={cn('flex items-start gap-2 text-sm text-muted-foreground', className)}>
      <Scale className="mt-0.5 size-4 shrink-0 text-gold-strong" strokeWidth={1.75} aria-hidden="true" />
      <span>
        {sentence}{' '}
        {/* A permanent underline, not text-primary alone — axe's link-in-text-block
            rule: this link sits inline inside muted body text, and `--primary` on
            `--muted-foreground` doesn't clear the 3:1 contrast a colour-only
            distinction would need. An underline works regardless of colour. */}
        <a href="/legal/terms" className="text-foreground underline underline-offset-2">
          Read the full terms
        </a>
      </span>
    </p>
  )
}
