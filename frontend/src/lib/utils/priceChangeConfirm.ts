// A confirmation step for a change over ±50% or to zero, naming both figures
// ("A$99.00 → A$9.90. Change the price?") — fat-finger protection on the one field
// where a slip charges a real card the wrong amount.
import { formatCurrency } from './formatCurrency'

// True when the change from `oldCents` to `newCents` needs a confirmation prompt:
// a swing of more than 50% in either direction, or a drop to zero.
export function priceChangeNeedsConfirm(oldCents: number, newCents: number): boolean {
  if (newCents === 0) return true
  if (oldCents === 0) return false // nothing to compare a first-ever price against
  const ratio = newCents / oldCents
  return ratio > 1.5 || ratio < 0.5
}

// E.g. "A$99.00 → A$9.90. Change the price?"
export function priceChangeConfirmMessage(oldCents: number, newCents: number, currency: string): string {
  return `${formatCurrency(oldCents, currency)} → ${formatCurrency(newCents, currency)}. Change the price?`
}
