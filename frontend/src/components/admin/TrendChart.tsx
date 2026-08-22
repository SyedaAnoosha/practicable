import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'

interface TrendChartProps {
  title: string
  data: Array<{ date: string; revenue: number; orders: number }>
  className?: string
}

/**
 * §20.7a TrendChart — revenue and orders over time.
 *
 * Two series, one axis pair:
 *   Revenue: Area, --chart-1 at 12% fill, 2px stroke, left Y axis
 *   Orders: Line, --chart-2, 2px, right Y axis
 *
 * States: populated (≥2 points), fewer-than-two-points (sentence), error.
 * §20.7a: "The fewest states this page will genuinely be in on the day it ships."
 */

const chartConfig = {
  revenue: {
    label: 'Revenue',
    color: 'var(--chart-1)',
  },
  orders: {
    label: 'Orders',
    color: 'var(--chart-2)',
  },
} satisfies ChartConfig

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

export function TrendChart({ title, data, className }: TrendChartProps) {
  // Empty state — §20.7a: "Returns [] for no data"
  if (!data || data.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No data available</p>
        </CardContent>
      </Card>
    )
  }

  // Fewer than two points — §20.7a: "renders the sentence, not the plot"
  // "A line drawn through one point is an invented trend"
  if (data.length < 2) {
    const point = data[0]
    const dateStr = formatDate(point.date)
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Not enough history to chart yet — {point.orders} order{point.orders !== 1 ? 's' : ''} since {dateStr}.
          </p>
        </CardContent>
      </Card>
    )
  }

  // Transform data for the chart: map revenue from cents to display format
  const chartData = data.map((d) => ({
    date: d.date,
    revenue: d.revenue,
    orders: d.orders,
  }))

  // Format for X axis display
  const shortDateFormat = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
  }

  // §20.7a: "Grid: horizontal rules only, --border at 50%. No vertical grid, no chart junk"
  // §20.7a: "accessibilityLayer" for keyboard navigation and screen reader support
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-64 w-full">
          <LineChart
            data={chartData}
            accessibilityLayer
          >
            <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.5} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={shortDateFormat}
              className="text-xs tabular-nums"
            />
            <YAxis
              yAxisId="revenue"
              orientation="left"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={formatCurrency}
              className="text-xs tabular-nums"
              width={60}
            />
            <YAxis
              yAxisId="orders"
              orientation="right"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              className="text-xs tabular-nums"
              width={40}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => formatDate(value as string)}
                  formatter={(value, name) => {
                    if (name === 'Revenue') return formatCurrency(value as number)
                    return String(value)
                  }}
                />
              }
            />
            <Line
              yAxisId="revenue"
              type="monotone"
              dataKey="revenue"
              stroke="var(--color-revenue)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2 }}
            />
            <Line
              yAxisId="orders"
              type="monotone"
              dataKey="orders"
              stroke="var(--color-orders)"
              strokeWidth={2}
              dot={false}
              strokeDasharray="4 2"
              activeDot={{ r: 4, strokeWidth: 2 }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
