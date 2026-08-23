import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { cn } from '@/lib/utils/cn'

interface MetricTileProps {
  name: string
  // `null` means "nothing to compute a rate from yet" (e.g. zero total buyers) — a
  // distinct state from a real `0`, which is a fact, not an absence. Non-negotiable
  // #15: unknown is null, zero is 0, and the two must not render the same way.
  numerator: number | null | undefined
  denominator: number | null | undefined
  description: string
  className?: string
  /** `[ADDED 2026-08-22]` Money-ness used to be inferred from `name === 'total_revenue'`,
   * which only ever worked for the one tile whose name happened to match. The Revenue
   * Breakdown section passes display strings ("Gross revenue", "Refunded", "Net
   * revenue"), so all three fell through to the integer branch and printed raw cents —
   * A$177.00 of takings shown as "17700" under a heading that says Revenue.
   * Inferring a value's *unit* from its *label* was the bug; the caller knows, so the
   * caller says. `total_revenue` still defaults to true for the API-driven grid. */
  money?: boolean
}

/** `[ADDED 2026-08-22]` The API sends a metric's machine name (`second_purchase_rate`)
 * and the tile printed it verbatim, so the admin read as a database dump —
 * `signup_to_purchase_days`, `download_links_issued`, `free_to_paid`. Nothing else in
 * the product shows a raw identifier to a person.
 *
 * Known names get a written label; anything unrecognised falls back to de-snaking the
 * identifier rather than hiding, so a metric added to the backend tomorrow reads as
 * "New Metric Name" instead of disappearing from the page. */
const METRIC_LABELS: Record<string, string> = {
  total_revenue: 'Total revenue',
  second_purchase_rate: 'Repeat buyers',
  free_to_paid: 'Free to paid',
  refund_rate: 'Refund rate',
  signup_to_purchase_days: 'Signup to purchase',
  enrollments: 'Enrolments',
  download_links_issued: 'Download links issued',
  recommendation_clicks: 'Recommendation clicks',
}

function humanise(name: string): string {
  const known = METRIC_LABELS[name]
  if (known) return known
  const spaced = name.replace(/_/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

export function MetricTile({
  name,
  numerator,
  denominator,
  description,
  className,
  money,
}: MetricTileProps) {
  /* `[FIXED 2026-08-22]` Was `!== null`, which `undefined` walks straight past — and
     an absent field from a partial API response arrives as `undefined`, not `null`.
     The tile then called `.toLocaleString()` on it and threw, crashing the entire
     admin metrics page rather than rendering one tile as unknown.
     `== null` catches both, which is the behaviour the comment above always described. */
  const hasData = numerator != null && denominator != null

  // Calculate percentage if denominator > 1
  const isRatio = hasData && denominator > 1
  const percentage = isRatio && denominator > 0 ? ((numerator / denominator) * 100).toFixed(1) : null

  /* `[FIXED 2026-08-22]` `total_revenue` is stored in cents, and the tile printed the
   * integer — so A$177.00 of takings displayed as a bold "17,700" under the heading
   * "Orders & Revenue". Every plausible misreading of that is a large overstatement of
   * the business, which is the worst direction for a number on an owner's dashboard to
   * be wrong in. Money is now formatted as money. */
  const isMoney = money ?? name === 'total_revenue'
  const displayValue = !hasData
    ? null
    : isMoney
      ? (numerator / 100).toLocaleString(undefined, { style: 'currency', currency: 'AUD' })
      : isRatio
        ? `${numerator.toLocaleString()} / ${denominator.toLocaleString()}`
        : numerator.toLocaleString()

  const showsPercentage = !isMoney && isRatio && percentage !== null

  /* `[REDESIGNED 2026-08-22]` The tile was a default Card with a `pb-2` header and a
   * `text-2xl` number — the label read at the same weight as the figure, and the
   * description sat 4px under the value with no separation, so a grid of these was a
   * wall of undifferentiated grey text. The number is the reason the tile exists, so
   * it now carries the visual weight: small uppercase label above, large tabular
   * figure, description held apart on its own rule below. */
  return (
    <Card className={cn('transition-colors hover:border-border-strong', className)}>
      <CardHeader className="pb-1">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {humanise(name)}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {hasData ? (
          <div className="flex items-baseline gap-2">
            {showsPercentage ? (
              <>
                <span className="font-mono text-3xl font-semibold tabular-nums leading-none text-foreground">
                  {percentage}%
                </span>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {displayValue}
                </span>
              </>
            ) : (
              <span className="font-mono text-3xl font-semibold tabular-nums leading-none text-foreground">
                {displayValue}
              </span>
            )}
          </div>
        ) : (
          /* Non-negotiable #15: unknown is not zero, and must not look like it. */
          <p className="text-sm text-muted-foreground">Not enough data yet</p>
        )}
        <p className="border-t border-border pt-2.5 text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      </CardContent>
    </Card>
  )
}
