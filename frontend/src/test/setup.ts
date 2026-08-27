// Loaded once before every Vitest file (vitest.config.ts's setupFiles).
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// `globals: false` in vitest.config.ts means testing-library's own auto-cleanup (which
// relies on the global `afterEach` jest/vitest normally installs) never registers —
// without an explicit cleanup, a second `render()` in the same test file leaves the
// first render's DOM mounted, so `queryByText` in the second test matches leftover
// markup from the first. Explicit `afterEach(cleanup)` restores
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

// jsdom implements no IntersectionObserver, and Motion's `useInView` (used by
// StatTiles' countUp, and by anything else that reveals on scroll) constructs one
// during its mount effect. Without this, any test that renders such a component dies
// with "IntersectionObserver is not defined" — a crash in the TEST environment for a
// component that is correct in a browser.
//
// The stub reports the element as immediately intersecting. That is the right default
// for a jsdom test: there is no layout and no scrolling, so "in view" is the only
// state that can be meaningfully asserted, and it means countUp resolves to its final
// value rather than hanging at its start.
if (typeof globalThis.IntersectionObserver === 'undefined') {
  class StubIntersectionObserver {
    readonly root: Element | Document | null = null
    readonly rootMargin: string = '0px'
    readonly thresholds: ReadonlyArray<number> = [0]
    private readonly callback: IntersectionObserverCallback

    constructor(callback: IntersectionObserverCallback) {
      this.callback = callback
    }

    observe(target: Element) {
      this.callback(
        [{ isIntersecting: true, intersectionRatio: 1, target } as IntersectionObserverEntry],
        this as unknown as IntersectionObserver,
      )
    }

    unobserve() {}
    disconnect() {}
    takeRecords(): IntersectionObserverEntry[] {
      return []
    }
  }

  globalThis.IntersectionObserver =
    StubIntersectionObserver as unknown as typeof IntersectionObserver
}
