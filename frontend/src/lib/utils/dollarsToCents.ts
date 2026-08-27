// The field takes dollars and stores cents, with the conversion in exactly one place.
// A price editor that is off by 100 is the most expensive typo
// available in this codebase — and `parseInt(str, 10) * 100` truncates rather than
// rounds a value with cents in it (parseInt("99.995", 10) * 100 === 9900, not 10000).
//
// The counterpart to formatCurrency.ts, which goes the other way.
export function dollarsToCents(dollars: string | number): number {
  const value = typeof dollars === 'string' ? Number(dollars) : dollars
  if (!Number.isFinite(value)) return NaN
  if (value < 0) throw new RangeError('Price cannot be negative')
  return Math.round(value * 100)
}
