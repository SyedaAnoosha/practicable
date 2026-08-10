// DESIGN.md §28.2: "Format prices with Intl.NumberFormat using the currency the API
// returns. Never hard-code a symbol." price_amount_cents is always integer cents.
export function formatCurrency(amountCents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amountCents / 100)
}
