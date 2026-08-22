import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { PageTitle } from '@/components/ui/PageTitle'
import { EmptyState } from '@/components/ui/EmptyState'
import { MetricTile } from '@/components/admin/MetricTile'
import { TrendChart } from '@/components/admin/TrendChart'
import { BarChart3 } from 'lucide-react'

interface Metric {
  name: string
  numerator: number | null
  denominator: number | null
  description: string
}

interface ProductRanking {
  id: string
  name: string
  units: number
  revenueCents: number
  revenueDollars: number
}

interface CourseEnrollmentRanking {
  id: string
  title: string
  enrolled: number
  started: number
  completed: number
}

interface MetricsResponse {
  metrics: Metric[]
  generatedAt: string
  revenueGrossCents: number
  revenueRefundedCents: number
  revenueNetCents: number
  /* Optional in the TYPE because the component must survive their absence (see the
     hardening note in the body). The API populates all of them today. */
  enrollmentSplits?: Record<string, number>
  productRankings?: ProductRanking[]
  downloadLinksIssued: number
  courseEnrollmentRankings?: CourseEnrollmentRanking[]
  recommendationClicks?: { question: number; catalogue: number; total: number }
  recommendationRankings?: RecommendationRanking[]
}

interface RecommendationRanking {
  productSlug: string
  clicks: number
}

/** §20.7a: Fetches revenue-series data and renders the TrendChart.
 * Separate from the main tile grid because it has its own loading state.
 */
function TrendChartWrapper() {
  const { data: seriesData, isLoading } = useQuery({
    queryKey: queryKeys.admin.revenueSeries(90),
    queryFn: () =>
      api
        .get<{ data: Array<{ date: string; revenueCents: number; orderCount: number }> }>(
          '/admin/metrics/revenue-series?days=90'
        )
        .then((r) => r.data),
  })

  if (isLoading) {
    return (
      <div className="h-64 animate-pulse rounded-lg border border-border bg-muted/40" />
    )
  }

  const chartData = (seriesData?.data ?? []).map((d) => ({
    date: d.date,
    revenue: d.revenueCents,
    orders: d.orderCount,
  }))

  return (
    <TrendChart
      title="Revenue & Orders Over Time"
      data={chartData}
    />
  )
}

export function AdminMetrics() {
  const { data: metricsData, isLoading } = useQuery({
    queryKey: queryKeys.admin.metrics(),
    queryFn: () => api.get<MetricsResponse>('/admin/metrics').then((r) => r.data),
  })

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-[1600px] px-4 py-10 sm:px-6">
        <PageTitle eyebrow="Admin" title="Metrics" description="Key performance indicators for the platform." />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-lg border border-border bg-muted/40" />
          ))}
        </div>
      </div>
    )
  }

  if (!metricsData || metricsData.metrics.length === 0) {
    return (
      <div className="mx-auto w-full max-w-[1600px] px-4 py-10 sm:px-6">
        <PageTitle eyebrow="Admin" title="Metrics" description="Key performance indicators for the platform." />
        <EmptyState
          className="mt-8"
          icon={BarChart3}
          title="No metrics available"
          description="Metrics will appear here once there's activity on the platform."
        />
      </div>
    )
  }

  const metrics = metricsData.metrics

  /* `[HARDENED 2026-08-22]` These four sections each dereferenced a field the type
     declares as required, and `AdminMetrics` crashed outright (`Cannot convert
     undefined or null to object`) when one was absent — taking the whole admin page
     down, including the revenue tiles above it that had loaded fine.

     The backend does populate all four today, so this is defence against a partial or
     older response rather than a known bug. But an admin dashboard is exactly where a
     single missing aggregate must degrade to "that section is absent", not to a blank
     screen. `recommendationClicks` below was already guarded this way; these four now
     match it. */
  const enrollmentSplits = metricsData.enrollmentSplits ?? {}
  const productRankings = metricsData.productRankings ?? []
  const courseEnrollmentRankings = metricsData.courseEnrollmentRankings ?? []

  // Group metrics into categories
  const userMetrics = metrics.filter((m) => m.name.includes('user'))
  const orderMetrics = metrics.filter((m) => m.name.includes('order') || m.name.includes('revenue'))
  const contentMetrics = metrics.filter((m) => m.name.includes('published'))
  const otherMetrics = metrics.filter(
    (m) => !userMetrics.includes(m) && !orderMetrics.includes(m) && !contentMetrics.includes(m)
  )

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-10 sm:px-6">
      <PageTitle
        eyebrow="Admin"
        title="Metrics"
        description="Key performance indicators for the platform."
      />

      <div className="mt-8 space-y-8">
        {/* User Metrics */}
        {userMetrics.length > 0 && (
          <section>
            <h3 className="mb-4 text-lg font-semibold text-foreground">User Metrics</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {userMetrics.map((metric) => (
                <MetricTile key={metric.name} {...metric} />
              ))}
            </div>
          </section>
        )}

        {/* Order & Revenue Metrics */}
        {orderMetrics.length > 0 && (
          <section>
            <h3 className="mb-4 text-lg font-semibold text-foreground">Orders & Revenue</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {orderMetrics.map((metric) => (
                <MetricTile key={metric.name} {...metric} />
              ))}
            </div>
          </section>
        )}

        {/* Content Metrics */}
        {contentMetrics.length > 0 && (
          <section>
            <h3 className="mb-4 text-lg font-semibold text-foreground">Content</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {contentMetrics.map((metric) => (
                <MetricTile key={metric.name} {...metric} />
              ))}
            </div>
          </section>
        )}

        {/* Other Metrics */}
        {otherMetrics.length > 0 && (
          <section>
            <h3 className="mb-4 text-lg font-semibold text-foreground">Other</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {otherMetrics.map((metric) => (
                <MetricTile key={metric.name} {...metric} />
              ))}
            </div>
          </section>
        )}

        {/* Revenue Breakdown */}
        <section>
          <h3 className="mb-4 text-lg font-semibold text-foreground">Revenue</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <MetricTile
              name="Gross revenue"
              numerator={metricsData.revenueGrossCents}
              denominator={1}
              description="Total from completed orders (cents)"
            />
            <MetricTile
              name="Refunded"
              numerator={metricsData.revenueRefundedCents}
              denominator={1}
              description="Total refunded (cents)"
            />
            <MetricTile
              name="Net revenue"
              numerator={metricsData.revenueNetCents}
              denominator={1}
              description="Gross minus refunded (cents)"
            />
          </div>
        </section>

        {/* Enrollment Splits */}
        {Object.keys(enrollmentSplits).length > 0 && (
          <section>
            <h3 className="mb-4 text-lg font-semibold text-foreground">Enrollments</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              {Object.entries(enrollmentSplits).map(([key, count]) => (
                <MetricTile
                  key={key}
                  name={`${key} enrollments`}
                  numerator={count}
                  denominator={1}
                  description={`Active entitlements granted via ${key}`}
                />
              ))}
            </div>
          </section>
        )}

        {/* Product Rankings */}
        {productRankings.length > 0 && (
          <section>
            <h3 className="mb-4 text-lg font-semibold text-foreground">Top products by revenue</h3>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 text-left">Product</th>
                    <th scope="col" className="px-4 py-2.5 text-right">Units</th>
                    <th scope="col" className="px-4 py-2.5 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {productRankings.map((p) => (
                    <tr key={p.id} className="border-t border-border">
                      <td className="px-4 py-2.5 text-foreground">{p.name}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{p.units}</td>
                      <td className="px-4 py-2.5 text-right font-medium tabular-nums text-foreground">
                        ${p.revenueDollars.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Course Enrollment Rankings — 8C-2 */}
        {courseEnrollmentRankings.length > 0 && (
          <section>
            <h3 className="mb-4 text-lg font-semibold text-foreground">Courses by enrollment</h3>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 text-left">Course</th>
                    <th scope="col" className="px-4 py-2.5 text-right">Enrolled</th>
                    <th scope="col" className="px-4 py-2.5 text-right">Started</th>
                    <th scope="col" className="px-4 py-2.5 text-right">Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {courseEnrollmentRankings.map((c) => (
                    <tr key={c.id} className="border-t border-border">
                      <td className="px-4 py-2.5 text-foreground">{c.title}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-foreground">{c.enrolled}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{c.started}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{c.completed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* W4-R4 item 6 — whether routing a reader from a question to a product actually
            works. Rendered unconditionally, unlike the ranking tables above: "no reader
            has followed a recommendation yet" is itself the answer to the question this
            section exists to ask, and hiding the section would read as "we don't
            measure this" instead. */}
        <section>
          <h3 className="mb-4 text-lg font-semibold text-foreground">Recommendations followed</h3>
          {(metricsData.recommendationClicks?.total ?? 0) === 0 ? (
            <p className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
              No routed recommendation has been followed yet. This fills once a reader
              opens a product from a question page or a filtered catalogue.
            </p>
          ) : (
            <>
              <p className="mb-3 text-sm text-muted-foreground">
                <span className="font-medium text-foreground tabular-nums">
                  {metricsData.recommendationClicks?.question ?? 0}
                </span>{' '}
                from a question page ·{' '}
                <span className="font-medium text-foreground tabular-nums">
                  {metricsData.recommendationClicks?.catalogue ?? 0}
                </span>{' '}
                from a filtered catalogue
              </p>
              {(metricsData.recommendationRankings?.length ?? 0) > 0 && (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/60 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th scope="col" className="px-4 py-2.5 text-left">Product</th>
                        <th scope="col" className="px-4 py-2.5 text-right">Clicks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(metricsData.recommendationRankings ?? []).map((r) => (
                        <tr key={r.productSlug} className="border-t border-border">
                          <td className="px-4 py-2.5 text-foreground">{r.productSlug}</td>
                          <td className="px-4 py-2.5 text-right font-medium tabular-nums text-foreground">
                            {r.clicks}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>

        {/* Trend Chart — Recharts via shadcn chart block.
            §20.7a: revenue (area, --chart-1) and orders (line, --chart-2) over time.
            Revenue-series endpoint exists and is tested (Phase 8C-4). */}
        <section>
          <h3 className="mb-4 text-lg font-semibold text-foreground">Trends</h3>
          <TrendChartWrapper />
        </section>

        <p className="text-xs text-muted-foreground">
          Last updated: {new Date(metricsData.generatedAt).toLocaleString()}
        </p>
      </div>
    </div>
  )
}
