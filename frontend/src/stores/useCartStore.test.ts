import { beforeEach, describe, expect, it } from 'vitest'
import { useCartStore } from './useCartStore'

const itemA = { id: 'a', slug: 'template-a', name: 'Template A', price_amount: 4900, currency: 'AUD' }
const itemB = { id: 'b', slug: 'course-b', name: 'Course B', price_amount: 19900, currency: 'AUD' }

beforeEach(() => {
  // Every product here is a one-time purchase and the store is a module-level
  // singleton — without a reset, the previous test's items leak into the next one.
  useCartStore.setState({ items: [], isOpen: false })
  localStorage.clear()
})

describe('useCartStore', () => {
  it('starts empty', () => {
    expect(useCartStore.getState().items).toEqual([])
  })

  it('adds an item', () => {
    useCartStore.getState().addItem(itemA)
    expect(useCartStore.getState().items).toEqual([itemA])
  })

  it('adding the same id twice is a no-op, not a second line', () => {
    // The cart holds distinct products, not quantities — there is no "buy this twice"
    // for a lifetime-access purchase.
    useCartStore.getState().addItem(itemA)
    useCartStore.getState().addItem(itemA)
    expect(useCartStore.getState().items).toHaveLength(1)
  })

  it('adds two distinct items', () => {
    useCartStore.getState().addItem(itemA)
    useCartStore.getState().addItem(itemB)
    expect(useCartStore.getState().items.map((i) => i.id)).toEqual(['a', 'b'])
  })

  it('removes an item by id', () => {
    useCartStore.getState().addItem(itemA)
    useCartStore.getState().addItem(itemB)
    useCartStore.getState().removeItem('a')
    expect(useCartStore.getState().items).toEqual([itemB])
  })

  it('removing an id not in the cart is a no-op', () => {
    useCartStore.getState().addItem(itemA)
    useCartStore.getState().removeItem('not-in-cart')
    expect(useCartStore.getState().items).toEqual([itemA])
  })

  it('clear empties the cart', () => {
    useCartStore.getState().addItem(itemA)
    useCartStore.getState().addItem(itemB)
    useCartStore.getState().clear()
    expect(useCartStore.getState().items).toEqual([])
  })

  it('has() reflects membership', () => {
    useCartStore.getState().addItem(itemA)
    expect(useCartStore.getState().has('a')).toBe(true)
    expect(useCartStore.getState().has('b')).toBe(false)
  })

  it('open/close toggle isOpen without touching items', () => {
    useCartStore.getState().addItem(itemA)
    useCartStore.getState().open()
    expect(useCartStore.getState().isOpen).toBe(true)
    useCartStore.getState().close()
    expect(useCartStore.getState().isOpen).toBe(false)
    expect(useCartStore.getState().items).toEqual([itemA])
  })

  it('persists only items to localStorage, never isOpen', () => {
    // Partialize: (state) => ({ items: state.items }) — a drawer that snaps open on
    // every page reload is the bug this guards against.
    useCartStore.getState().addItem(itemA)
    useCartStore.getState().open()

    const raw = localStorage.getItem('practicable:cart')
    expect(raw).toBeTruthy()
    const persisted = JSON.parse(raw as string)
    expect(persisted.state.items).toEqual([itemA])
    expect(persisted.state.isOpen).toBeUndefined()
  })
})
