// formatCurrency is a pure function with real logic and no DOM. Assertions strip
// locale-dependent symbol/grouping (Intl.NumberFormat's
// output varies by the test runner's default locale) and check the digit string it
// produced instead — that's the part this function is actually responsible for
// getting right; the symbol placement is Intl's job, not ours.
import { describe, expect, it } from 'vitest'
import { formatCurrency } from './formatCurrency'

const digits = (s: string) => s.replace(/[^0-9.]/g, '')

describe('formatCurrency', () => {
  it('converts whole-dollar cents to two decimal places', () => {
    expect(digits(formatCurrency(4900, 'AUD'))).toBe('49.00')
  })

  it('converts cents with a non-zero remainder', () => {
    expect(digits(formatCurrency(4999, 'AUD'))).toBe('49.99')
  })

  it('formats zero as 0.00, not an empty string', () => {
    expect(digits(formatCurrency(0, 'AUD'))).toBe('0.00')
  })

  it('formats a large amount with its decimal places intact', () => {
    expect(digits(formatCurrency(999999, 'AUD'))).toBe('9999.99') // thousands grouping stripped, decimals preserved
  })

  it('never truncates a trailing zero cent (49.90, not 49.9)', () => {
    expect(digits(formatCurrency(4990, 'AUD'))).toBe('49.90')
  })

  it('respects the currency argument rather than hard-coding one', () => {
    // Same amount, two ISO codes — Intl.NumberFormat renders a different symbol/code
    // for each, so a formatter that ignored `currency` (i.e. hard-coded a symbol)
    // would produce identical output for both. It must not.
    expect(formatCurrency(1000, 'AUD')).not.toBe(formatCurrency(1000, 'USD'))
  })

  it('rounds a fractional cent rather than dropping it silently', () => {
    // price_amount_cents is documented as always integer, but a caller passing a
    // fractional value should still get a sane two-decimal result, not NaN.
    expect(digits(formatCurrency(4950.4, 'AUD'))).toBe('49.50')
  })
})
