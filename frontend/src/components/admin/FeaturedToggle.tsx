import { Star } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

/** A star toggle plus a sort-order number, in the admin question
 * list. `onChange` hands back the pair together (never a lone `featured: true` with no
 * order) so the caller can't end up with a featured row whose sort silently falls back
 * to whatever `NULL` sorts as. */
interface FeaturedToggleProps {
  featured: boolean
  featuredSort: number | null
  onChange: (next: { featured: boolean; featuredSort: number | null }) => void
  disabled?: boolean
}

export function FeaturedToggle({ featured, featuredSort, onChange, disabled }: FeaturedToggleProps) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        disabled={disabled}
        aria-pressed={featured}
        aria-label={featured ? 'Remove from homepage' : 'Feature on homepage'}
        title={featured ? 'Featured — click to remove from the homepage' : 'Feature this on the homepage'}
        onClick={() => onChange({ featured: !featured, featuredSort: featured ? null : (featuredSort ?? 0) })}
        className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Star
          className={cn('size-4', featured ? 'fill-[var(--gold-strong)] text-[var(--gold-strong)]' : 'text-muted-foreground')}
          aria-hidden="true"
        />
      </button>
      {featured && (
        <label className="flex items-center gap-1 text-xs text-muted-foreground">
          <span className="sr-only">Homepage order</span>
          <input
            type="number"
            disabled={disabled}
            value={featuredSort ?? 0}
            onChange={(e) => onChange({ featured: true, featuredSort: Number(e.target.value) })}
            className="w-12 rounded-md border border-input bg-card px-1.5 py-0.5 text-center text-xs tabular-nums text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          />
        </label>
      )}
    </div>
  )
}

interface FeaturedSummaryProps {
  /** Titles already sorted into the order the homepage will show them. */
  featuredTitles: string[]
}

/** The "4 questions featured, in this order" line above the list (§20.6) — stated, not
 * silent, so the owner sees the front page before anyone else does, and the empty case
 * names its own fallback instead of just showing nothing. */
export function FeaturedSummary({ featuredTitles }: FeaturedSummaryProps) {
  if (featuredTitles.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        Nothing featured — the homepage falls back to the first question in each domain.
      </p>
    )
  }
  return (
    <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
      <span className="font-medium text-foreground">
        {featuredTitles.length} question{featuredTitles.length === 1 ? '' : 's'} featured.
      </span>{' '}
      The homepage shows them in this order: {featuredTitles.join(' · ')}
    </p>
  )
}
