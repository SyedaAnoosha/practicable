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

/** `[ADDED 2026-08-22]` Every section on this page hand-rolled the same
 * `<h3 className="mb-4 text-lg font-semibold">` and nothing else — no explanation of
 * what the group of numbers below it means, and no visual separation between one
 * group and the next, so the page read as one long undifferentiated column of tiles
 * and tables. A section now states what it is *for*, and is separated by a rule, so
 * an owner scanning the page can find the part they came for.
 */
function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="border-t border-border pt-8 first:border-t-0 first:pt-0">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  )
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

  /* `[FIXED 2026-08-22]` `metricsData.metrics.length` threw
     "Cannot read properties of undefined (reading 'length')" whenever the response
     arrived without a `metrics` array, taking the whole admin metrics page down to an
     error screen. The note below already hardened four *other* fields the same way, but
     missed the one field this very guard dereferences — and it is the first thing
     touched after the fetch, so it fails before any of that hardening can help.
     An admin dashboard must degrade to "no metrics yet", never to a crash. */
  if (!metricsData?.metrics?.length) {
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

      {/* No `space-y` here: `Section` already carries `pt-8` above its own divider
          rule, and stacking the two produced a 64px trench between every group. Each
          section owns the space above itself, so the rhythm stays even whichever
          sections the data happens to render. */}
      <div className="mt-8">
        {userMetrics.length > 0 && (
          <Section title="People" description="Who has signed up, and how far they get.">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {userMetrics.map((metric) => (
                <MetricTile key={metric.name} {...metric} />
              ))}
            </div>
          </Section>
        )}

        {orderMetrics.length > 0 && (
          <Section title="Orders" description="Purchases, repeat buyers and refunds.">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {orderMetrics.map((metric) => (
                <MetricTile key={metric.name} {...metric} />
              ))}
            </div>
          </Section>
        )}

        {contentMetrics.length > 0 && (
          <Section title="Content" description="What is published and available to buy.">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {contentMetrics.map((metric) => (
                <MetricTile key={metric.name} {...metric} />
              ))}
            </div>
          </Section>
        )}

        {otherMetrics.length > 0 && (
          <Section title="Everything else">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {otherMetrics.map((metric) => (
                <MetricTile key={metric.name} {...metric} />
              ))}
            </div>
          </Section>
        )}

        {/* Revenue Breakdown
            `[FIXED 2026-08-22]` All three of these printed raw cents. `MetricTile`
            decided money-ness by testing `name === 'total_revenue'`, and these pass
            display strings, so A$177.00 rendered as "17700" — and the descriptions
            said "(cents)" out loud, which documented the leak rather than fixing it.
            An owner's revenue figure being wrong by 100x, in the overstating
            direction, is the worst number on this page to get wrong. `money` is now
            declared by the caller, which is the only place that actually knows. */}
        <Section title="Revenue" description="Completed orders, in dollars.">
          <div className="grid gap-4 sm:grid-cols-3">
            <MetricTile
              name="Gross revenue"
              money
              numerator={metricsData.revenueGrossCents}
              denominator={1}
              description="Total from completed orders."
            />
            <MetricTile
              name="Refunded"
              money
              numerator={metricsData.revenueRefundedCents}
              denominator={1}
              description="Total refunded to buyers."
            />
            <MetricTile
              name="Net revenue"
              money
              numerator={metricsData.revenueNetCents}
              denominator={1}
              description="Gross minus refunded — what you actually kept."
            />
          </div>
        </Section>

        {Object.keys(enrollmentSplits).length > 0 && (
          <Section
            title="Enrolments"
            description="Active entitlements, by how the person came to hold one."
          >
            <div className="grid gap-4 sm:grid-cols-3">
              {Object.entries(enrollmentSplits).map(([key, count]) => (
                <MetricTile
                  key={key}
                  name={`${key} enrollments`}
                  numerator={count}
                  denominator={1}
                  description={`Active entitlements granted via ${key}.`}
                />
              ))}
            </div>
          </Section>
        )}

        {productRankings.length > 0 && (
          <Section title="Top products by revenue" description="Highest earning first.">
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
          </Section>
        )}

        {/* Course Enrollment Rankings — 8C-2 */}
        {courseEnrollmentRankings.length > 0 && (
          <Section
            title="Courses by enrolment"
            description="How many people hold each course, and how many actually opened it."
          >
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
          </Section>
        )}

        {/* W4-R4 item 6 — whether routing a reader from a question to a product actually
            works. Rendered unconditionally, unlike the ranking tables above: "no reader
            has followed a recommendation yet" is itself the answer to the question this
            section exists to ask, and hiding the section would read as "we don't
            measure this" instead. */}
        <Section
          title="Recommendations followed"
          description="Whether routing a reader from a question to a product actually works."
        >
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
        </Section>

        {/* Trend Chart — Recharts via shadcn chart block.
            §20.7a: revenue (area, --chart-1) and orders (line, --chart-2) over time.
            Revenue-series endpoint exists and is tested (Phase 8C-4). */}
        <Section title="Trends" description="Revenue and orders over the last 90 days.">
          <TrendChartWrapper />
        </Section>

        <p className="mt-8 border-t border-border pt-4 text-xs text-muted-foreground">
          Last updated: {new Date(metricsData.generatedAt).toLocaleString()}
        </p>
      </div>
    </div>
  )
}
