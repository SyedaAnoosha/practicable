import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Cart state is localStorage-persisted, matching emailGate.ts's existing pattern, and
// NOT synced server-side or across devices: a page refresh must not lose the cart, but
// nothing more than that is promised. zustand's own `persist` middleware is used here
// rather than
// useThemeStore's hand-rolled localStorage read/write, since the cart is an array that
// needs real (de)serialisation rather than a single string value.
export interface CartItem {
  id: string
  slug: string
  name: string
  price_amount: number
  currency: string
}

interface CartState {
  items: CartItem[]
  isOpen: boolean
  addItem: (item: CartItem) => void
  removeItem: (id: string) => void
  clear: () => void
  open: () => void
  close: () => void
  has: (id: string) => boolean
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      // Adding something already in the cart is a no-op rather than a second line —
      // the cart holds distinct products, not quantities (every product here is a
      // one-time, lifetime-access purchase; there is no "buy this twice").
      addItem: (item) =>
        set((state) => (state.items.some((i) => i.id === item.id) ? state : { items: [...state.items, item] })),
      removeItem: (id) => set((state) => ({ items: state.items.filter((i) => i.id !== id) })),
      clear: () => set({ items: [] }),
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      has: (id) => get().items.some((i) => i.id === id),
    }),
    {
      name: 'practicable:cart',
      // Only `items` persists — `isOpen` is UI state that should never survive a
      // reload as "true" (a drawer snapping open on every page load).
      partialize: (state) => ({ items: state.items }),
    },
  ),
)
