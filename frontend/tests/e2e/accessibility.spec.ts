import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/**
 * week2_plan.md Phase 1 / DESIGN.md §42.9 — axe on every public route, in CI, from
 * Phase 1 (the full accessibility audit stays a Week 4 item; this is the floor).
 *
 * `/store` added 2026-08-14 (Phase 4); the three `/legal/*` pages added the same day
 * (Phase 5). `/pricing` (added 2026-08-15, week3_plan.md Phase 3 step 9) was removed
 * 2026-08-16 by owner direction — no standalone pricing page, one-time prices for
 * every product live on `/store` instead (Store.tsx's bundle card + footer text).
 *
 * Read-only: every route below is a GET against published, public content — no sign-up,
 * no purchase, no write of any kind against the real backend this suite points at.
 */
const PUBLIC_ROUTES = [
  '/',
  '/questions',
  '/courses',
  '/templates',
  '/contact',
  '/store',
  '/legal/terms',
  '/legal/privacy',
  '/legal/refunds',
] as const

for (const route of PUBLIC_ROUTES) {
  test(`axe: ${route} has no violations`, async ({ page }) => {
    await page.goto(route)
    // Every one of these routes fetches its content via React Query after mount, and
    // the pre-data loading state (a bare spinner, per DESIGN.md §40.2) legitimately has
    // no `<h1>` yet — analysing before that resolves catches the LOADING state, not the
    // page, and produces a false "no level-one heading" violation. Wait for the real
    // heading (every page routes through PageTitle, DESIGN.md §42.1) before auditing.
    await expect(page.locator('h1')).toBeVisible()
    // Both themes are in scope (DESIGN.md §7.6/§45 — contrast tokens are audited per
    // theme), so this checks the default (light) render only; a dark-mode pass is a
    // second, deliberately separate run rather than doubling every route here.
    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([])
  })
}

// week3_plan.md Phase 6 step 7 / §62's "both themes checked" — the deliberately
// separate dark-mode run the comment above promises, rather than doubling every route
// in the light-mode loop. `useThemeStore.ts` reads its persisted choice from
// `localStorage['practicable:theme']` before first paint (index.html's own inline
// script does the same, to avoid a light→dark flash) — `addInitScript` sets it before
// any app code runs, which is the only point that's early enough for the app to boot
// straight into dark rather than toggle into it after axe has already scanned the
// light render.
test.describe('dark theme', () => {
  test.use({
    colorScheme: 'dark',
  })

  for (const route of PUBLIC_ROUTES) {
    test(`axe: ${route} has no violations (dark)`, async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem('practicable:theme', 'dark')
      })
      await page.goto(route)
      await expect(page.locator('h1')).toBeVisible()
      const results = await new AxeBuilder({ page }).analyze()
      expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([])
    })
  }
})

test('axe: a real question detail page has no violations', async ({ page }) => {
  // Slug resolved from the live catalogue rather than hard-coded, so this doesn't drift
  // out of sync with whichever question is actually first in the published set.
  await page.goto('/questions')
  const firstQuestionLink = page.locator('a[href^="/questions/"]').first()
  await expect(firstQuestionLink).toBeVisible()
  const href = await firstQuestionLink.getAttribute('href')
  expect(href).toBeTruthy()

  await page.goto(href!)
  // The question body arrives via React Query after mount (Question.tsx's `isLoading`
  // branch renders a spinner with no `<h1>` at all) — analysing the DOM before that
  // resolves catches the LOADING state, not the page, and axe correctly flags a
  // transient "no level-one heading" that was never real. Wait for the actual heading.
  await expect(page.locator('h1')).toBeVisible()
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([])
})
