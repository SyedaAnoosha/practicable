import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/**
 * week2_plan.md Phase 1 / DESIGN.md §42.9 — axe on every public route, in CI, from
 * Phase 1 (the full accessibility audit stays a Week 4 item; this is the floor).
 *
 * `/store` added 2026-08-14 (Phase 4); the three `/legal/*` pages added the same day
 * (Phase 5), each the day it shipped.
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
