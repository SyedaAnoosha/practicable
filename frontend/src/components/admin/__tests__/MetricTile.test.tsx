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
    expect(screen.getByText('(0 / 5)')).toBeInTheDocument()
    expect(screen.queryByText('Not enough data yet')).not.toBeInTheDocument()
  })

  it('renders a plain count (not a ratio) when denominator is 1', () => {
    render(
      <MetricTile name="total_revenue" numerator={4900} denominator={1} description="Total revenue in cents" />,
    )
    expect(screen.getByText('4,900')).toBeInTheDocument()
  })
})
