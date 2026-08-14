// Loaded once before every Vitest file (vitest.config.ts's setupFiles).
import '@testing-library/jest-dom/vitest'

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
