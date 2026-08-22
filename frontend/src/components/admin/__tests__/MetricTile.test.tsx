// Regression coverage for a real bug found during Phase 6B verification
// (week4_plan.md): non-negotiable #15 says "unknown is null, zero is 0, and
// the two are different", but MetricTile always rendered a bare number —
// there was no branch that ever rendered an empty sentence, so a metric with
// nothing to compute from (denominator 0) looked identical to a metric that
// was genuinely, meaningfully zero.
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MetricTile } from '../MetricTile'

describe('MetricTile', () => {
  it('renders an empty sentence, not a bare 0, when numerator/denominator are null', () => {
    render(
      <MetricTile
        name="second_purchase_rate"
        numerator={null}
        denominator={null}
        description="Buyers with 2+ orders / total buyers — no buyers yet"
      />,
    )
    expect(screen.getByText('Not enough data yet')).toBeInTheDocument()
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('renders a real ratio, including a genuine 0-of-N, when data exists', () => {
    render(
      <MetricTile
        name="second_purchase_rate"
        numerator={0}
        denominator={5}
        description="Buyers with 2+ orders / total buyers"
      />,
    )
    expect(screen.getByText('0.0%')).toBeInTheDocument()
    // `[UPDATED 2026-08-22]` Was `'(0 / 5)'`. The redesign drops the parentheses — the
    // counts now sit beside the percentage as their own muted element rather than as a
    // parenthetical. What this test is actually for is that a genuine 0-of-5 shows the
    // underlying counts and is not confused with "no data", and that still holds.
    expect(screen.getByText('0 / 5')).toBeInTheDocument()
    expect(screen.queryByText('Not enough data yet')).not.toBeInTheDocument()
  })

  it('renders a plain count (not a ratio) when denominator is 1', () => {
    // Was written against `total_revenue`, which is now formatted as currency — the
    // subject of this test is the plain-count path, so it uses a genuine count.
    render(
      <MetricTile name="enrollments" numerator={4900} denominator={1} description="Active enrolments" />,
    )
    expect(screen.getByText('4,900')).toBeInTheDocument()
  })

  it('renders total_revenue as money, not as a raw cent count', () => {
    // The regression this guards: cents printed verbatim read as dollars, so A$49.00
    // of takings displayed as "4,900" — a 100x overstatement on the owner's dashboard.
    render(
      <MetricTile name="total_revenue" numerator={4900} denominator={1} description="Total revenue" />,
    )
    expect(screen.getByText(/49\.00/)).toBeInTheDocument()
    expect(screen.queryByText('4,900')).not.toBeInTheDocument()
  })

  it('renders any money-flagged tile in dollars, whatever its label', () => {
    /* `[ADDED 2026-08-22]` The regression this guards is the one the owner actually
       hit: money-ness was inferred from `name === 'total_revenue'`, so the Revenue
       Breakdown tiles — which pass display strings like "Gross revenue" — fell through
       to the integer branch and printed raw cents. A$177.00 showed as "17700" under a
       heading that says Revenue. The unit is now declared by the caller. */
    render(
      <MetricTile
        name="Gross revenue"
        money
        numerator={17700}
        denominator={1}
        description="Total from completed orders."
      />,
    )
    expect(screen.getByText(/177\.00/)).toBeInTheDocument()
    expect(screen.queryByText('17,700')).not.toBeInTheDocument()
  })

  it('does not treat an ordinary count as money just because it is large', () => {
    render(
      <MetricTile name="download_links_issued" numerator={17700} denominator={1} description="Links" />,
    )
    expect(screen.getByText('17,700')).toBeInTheDocument()
    expect(screen.queryByText(/177\.00/)).not.toBeInTheDocument()
  })

  it('shows a written label rather than the machine name', () => {
    render(
      <MetricTile
        name="second_purchase_rate"
        numerator={1}
        denominator={4}
        description="Buyers with 2+ orders / total buyers"
      />,
    )
    expect(screen.getByText('Repeat buyers')).toBeInTheDocument()
    expect(screen.queryByText('second_purchase_rate')).not.toBeInTheDocument()
  })

  it('de-snakes an unknown metric name instead of dropping it', () => {
    // A metric added to the backend tomorrow must still read as words, not vanish.
    render(
      <MetricTile name="brand_new_metric" numerator={3} denominator={1} description="Something new" />,
    )
    expect(screen.getByText('Brand new metric')).toBeInTheDocument()
  })
})
