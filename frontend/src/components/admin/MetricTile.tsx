import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { cn } from '@/lib/utils/cn'

interface MetricTileProps {
  name: string
  // `null` means "nothing to compute a rate from yet" (e.g. zero total buyers) — a
  // distinct state from a real `0`, which is a fact, not an absence. Non-negotiable
  // #15: unknown is null, zero is 0, and the two must not render the same way.
  numerator: number | null
  denominator: number | null
  description: string
  className?: string
}

export function MetricTile({ name, numerator, denominator, description, className }: MetricTileProps) {
  const hasData = numerator !== null && denominator !== null

  // Calculate percentage if denominator > 1
  const isRatio = hasData && denominator > 1
  const percentage = isRatio && denominator > 0 ? ((numerator / denominator) * 100).toFixed(1) : null
  const displayValue = hasData
    ? isRatio
      ? `${numerator.toLocaleString()} / ${denominator.toLocaleString()}`
      : numerator.toLocaleString()
    : null

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{name}</CardTitle>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <div className="text-2xl font-semibold tabular-nums text-foreground">
            {isRatio && percentage !== null ? (
              <>
                <span className="text-3xl">{percentage}%</span>
                <span className="ml-2 text-sm text-muted-foreground">
                  ({displayValue})
                </span>
              </>
            ) : (
              displayValue
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Not enough data yet</p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}
