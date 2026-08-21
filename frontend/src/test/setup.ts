// Loaded once before every Vitest file (vitest.config.ts's setupFiles).
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// `globals: false` in vitest.config.ts means testing-library's own auto-cleanup (which
// relies on the global `afterEach` jest/vitest normally installs) never registers —
// found during Phase 6B verification (week4_plan.md) when a second `render()` in the
// same test file left the first render's DOM mounted, so `queryByText` in the second
// test matched leftover markup from the first. Explicit `afterEach(cleanup)` restores
// real per-test isolation for every component test in this suite, not just the one
// that happened to surface it.
afterEach(() => {
  cleanup()
})

// jsdom 30 under this Node/Vitest combination leaves `window.localStorage` undefined
// even with a real (non-opaque) origin — confirmed by direct inspection, not assumed.
// Node 22+'s own experimental global `localStorage` (a no-op unless
// --localstorage-file is passed) appears to make jsdom skip installing its usual
// working implementation. Anything using it — zustand's `persist` middleware
// (useCartStore, emailGate.ts) chief among them — throws on first write with no
// error at import time. A minimal in-memory Storage polyfill, installed on both
// `window` and the bare global before any test module imports a persisted store,
// restores real (same-object-identity, cross-call) storage semantics under test.
if (typeof window !== 'undefined' && !window.localStorage) {
  const backing = new Map<string, string>()
  const memoryStorage: Storage = {
    getItem: (key) => (backing.has(key) ? backing.get(key)! : null),
    setItem: (key, value) => {
      backing.set(key, String(value))
    },
    removeItem: (key) => {
      backing.delete(key)
    },
    clear: () => {
      backing.clear()
    },
    key: (index) => Array.from(backing.keys())[index] ?? null,
    get length() {
      return backing.size
    },
  }
  for (const target of [window, globalThis] as const) {
    Object.defineProperty(target, 'localStorage', { value: memoryStorage, configurable: true })
  }
}

// jsdom has no matchMedia; `<MotionConfig reducedMotion="user">` in main.tsx and
// useThemeStore both read it on mount, so any component test that renders through
// either would throw with no shim.
if (!window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as unknown as MediaQueryList
}
