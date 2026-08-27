// A confirmation step for a change over ±50% or to zero, naming both figures.
import { describe, expect, it } from 'vitest'
import { priceChangeConfirmMessage, priceChangeNeedsConfirm } from './priceChangeConfirm'

describe('priceChangeNeedsConfirm', () => {
  it('does not confirm a small increase', () => {
    expect(priceChangeNeedsConfirm(9900, 10900)).toBe(false)
  })

  it('does not confirm a small decrease', () => {
    expect(priceChangeNeedsConfirm(9900, 8900)).toBe(false)
  })

  it('confirms a drop to less than half the old price', () => {
    expect(priceChangeNeedsConfirm(9900, 4900)).toBe(true)
  })

  it('confirms a jump to more than 1.5x the old price', () => {
    expect(priceChangeNeedsConfirm(9900, 20000)).toBe(true)
  })

  it('confirms a change to zero even from a small old price', () => {
    expect(priceChangeNeedsConfirm(100, 0)).toBe(true)
  })

  it('does not confirm exactly at the 50% boundary', () => {
    expect(priceChangeNeedsConfirm(10000, 5000)).toBe(false)
  })

  it('does not confirm exactly at the 150% boundary', () => {
    expect(priceChangeNeedsConfirm(10000, 15000)).toBe(false)
  })

  it('does not confirm when there is no prior price to compare against', () => {
    expect(priceChangeNeedsConfirm(0, 9900)).toBe(false)
  })
})

describe('priceChangeConfirmMessage', () => {
  it('names both figures in dollars, old then new', () => {
    const msg = priceChangeConfirmMessage(9900, 990, 'AUD')
    expect(msg).toContain('99.00')
    expect(msg).toContain('9.90')
    expect(msg.indexOf('99.00')).toBeLessThan(msg.indexOf('9.90'))
    expect(msg).toContain('Change the price?')
  })
})
