import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

// A separate file, not `test:` bolted onto vite.config.ts: the webfont-download plugin
// in vite.config.ts makes a real network call at config-load time (week2_plan.md §Phase 1
// step 1), which has no business running for every `vitest` invocation. `mergeConfig`
// still reuses the `@` alias and the React/Tailwind plugins so component tests resolve
// imports identically to the real app.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      // jsdom only implements localStorage for a real (non-opaque) origin — without an
      // explicit url it defaults to one that leaves `window.localStorage` undefined,
      // which broke every zustand `persist` store (useCartStore, emailGate.ts) under
      // test with no error at import time, only a crash on first write.
      environmentOptions: { jsdom: { url: 'http://localhost:3000' } },
      globals: false,
      setupFiles: ['./src/test/setup.ts'],
      // Playwright's *.spec.ts live under tests/e2e and run through `playwright test`,
      // not vitest — excluding them here is what keeps `npm run test` fast and keeps
      // vitest from trying to execute Playwright's `test()` API as if it were its own.
      exclude: ['**/node_modules/**', 'tests/e2e/**', 'dist/**'],
    },
  }),
)
