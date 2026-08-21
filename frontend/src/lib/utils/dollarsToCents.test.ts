// week4_plan.md Phase 8 (8B-6): "the field takes dollars and stores cents, with the
// conversion in exactly one place ... a value with three decimals" among the named
// cases. The regression this guards: `parseInt(str, 10) * 100` (the pattern that was
// duplicated across AdminProducts.tsx, AdminPacks.tsx and AdminCourses.tsx/
// AdminTemplates.tsx's price controls) truncates a fractional-cent input instead of
// rounding it.
import { describe, expect, it } from 'vitest'
import { dollarsToCents } from './dollarsToCents'

describe('dollarsToCents', () => {
  it('converts a whole-dollar amount', () => {
    expect(dollarsToCents(99)).toBe(9900)
  })

  it('converts zero', () => {
    expect(dollarsToCents(0)).toBe(0)
  })

  it('converts a large amount', () => {
    expect(dollarsToCents(1000)).toBe(100000)
  })

  it('converts a value already in cents-precision', () => {
    expect(dollarsToCents(0.99)).toBe(99)
  })

  it('rounds a three-decimal value up rather than truncating it', () => {
    // parseInt("99.999", 10) * 100 === 9900 — off by 99 cents. The correct answer
    // rounds the fractional cent instead of discarding everything after the decimal.
    expect(dollarsToCents(99.999)).toBe(10000)
  })

  it('rounds a half-cent value up', () => {
    expect(dollarsToCents(99.995)).toBe(10000)
  })

  it('accepts a string input straight from a form field', () => {
    expect(dollarsToCents('49.90')).toBe(4990)
  })

  it('refuses a negative price', () => {
    expect(() => dollarsToCents(-10)).toThrow(/negative/)
  })
})
