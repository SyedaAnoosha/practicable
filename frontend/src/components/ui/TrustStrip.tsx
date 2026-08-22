import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export interface TrustFact {
  icon: LucideIcon
  /** The number or short value. Pass `null`/`undefined` when unknown — the fact is
   *  then dropped entirely rather than rendered as a zero or a dash. */
  value: string | number | null | undefined
  /** The word that makes the value mean something ("questions", "domains"). */
  label: string
}

export interface TrustStripProps {
  facts: TrustFact[]
  tone?: 'ground' | 'stage'
  className?: string
}

/**
 * Honest facts under the hero CTA — Parley's logo row and FintechX's trust strip
 * (FRAMER_MOTION_REFERENCE.md §1.5), with FintechX's fabricated `4.9/5` deliberately
 * absent.
 *
 * The absence rule is enforced HERE rather than left to each call site: a fact whose
 * value is null is filtered out, so it is not possible to render "0 questions" or
 * "— reviews" because an API field was empty. Principle 7 ("never invent credibility")
 * and the same reasoning that declined product ratings (REDESIGN_SUMMARY.md §9).
 *
 * If every fact is absent the component renders nothing at all, rather than an empty
 * bordered rail — a strip of nothing is worse than no strip.
 */
export function TrustStrip({ facts, tone = 'ground', className }: TrustStripProps) {
  const shown = facts.filter((f) => f.value !== null && f.value !== undefined && f.value !== '')
  if (shown.length === 0) return null

  return (
    <ul
      className={cn(
        'flex flex-wrap items-center gap-x-6 gap-y-3',
        tone === 'stage' ? 'text-stage-foreground/70' : 'text-muted-foreground',
        className,
      )}
    >
      {shown.map(({ icon: Icon, value, label }) => (
        <li key={label} className="flex items-center gap-2">
          <Icon
            className={cn('size-4 shrink-0', tone === 'stage' ? 'text-gold' : 'text-gold-strong')}
            aria-hidden="true"
          />
          <span className="text-sm">
            {/* Mono + tabular for the number (H1/H2: a number that carries a decision is
                data), plain sans for the word that qualifies it. */}
            <span className="font-mono font-medium tabular-nums text-current">{value}</span>{' '}
            {label}
          </span>
        </li>
      ))}
    </ul>
  )
}
