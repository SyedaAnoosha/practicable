import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { hasAdminE2ECreds, adminE2ESkipReason, signInAsAdmin } from './adminAuth'

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
// week4_plan.md Phase 3 step 7: two of the evidence-layer product-detail routes, added
// against real seeded rows (see responsive-widths.spec.ts's identical note on that
// coupling and on why `/buy/:slug` isn't here — it requires sign-in, so it's out of
// scope for this anonymous-GET sweep) — each renders `EvidencePanel`'s `<dl>`,
// `PreviewGallery`'s lightbox and `LicenceLine`, none of which axe had ever scanned
// before this pass.
const PUBLIC_ROUTES = [
  '/',
  '/questions',
  '/courses',
  '/templates',
  '/packs',
  '/contact',
  '/store',
  '/legal/terms',
  '/legal/privacy',
  '/legal/refunds',
  '/checkout/success',
  '/templates/4935c92a-3138-4dd4-9c70-1d23beb0a8b4',
  '/store/packs/risk-register-fundamentals',
  // W5-R3/W5-R2 (week5_plan.md Phase 6 step 4). Both are public and anonymous, so they
  // belong in this sweep like any other public route. `/verify/:code` is scanned with a
  // deliberately unknown code: its not-found state is the one a stranger following a
  // bad link actually lands on, and an unaudited error state is exactly where contrast
  // and heading-order slips survive.
  '/search?q=risk',
  '/verify/not-a-real-certificate-code',
] as const

/** `[ADDED 2026-08-22]` Wait for entry animations to finish before auditing.
 *
 * Every page fades and rises in on mount (`animate-enter`, motion's `riseItem`). While
 * that runs, an element's *computed* colour is a partway blend of its final colour and
 * the background — so axe measured `#8b867b` where the resting colour is the token's
 * `#6e675a`, and reported a 3.59:1 contrast failure against a control that actually
 * renders at 4.61:1 and passes. Four routes failed this way in both themes.
 *
 * Waiting for `<h1>` visibility (which this file already did) is not enough: the
 * heading becomes visible at the *start* of the fade, not the end. This waits for the
 * document's own animations to settle, which is the real precondition for measuring a
 * colour, and falls back to a short fixed delay where the API is unavailable.
 */
async function settleAnimations(page: import('@playwright/test').Page) {
  await page
    .waitForFunction(
      () =>
        document.getAnimations === undefined ||
        document.getAnimations().every((a) => a.playState !== 'running'),
      null,
      { timeout: 5_000 },
    )
    .catch(() => {
      /* An indefinitely-running decorative animation must not fail the a11y audit. */
    })
  // One extra frame so the final committed styles are what axe reads.
  await page.waitForTimeout(150)
}

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
    await settleAnimations(page)
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
      await settleAnimations(page)
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
  await settleAnimations(page)
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([])
})

test('axe: a real template detail page has no violations', async ({ page }) => {
  // Dynamic template ID resolution, avoids hardcoded ID drift.
  await page.goto('/templates')
  const firstTemplateLink = page.locator('a[href^="/templates/"]').first()
  await expect(firstTemplateLink).toBeVisible()
  const href = await firstTemplateLink.getAttribute('href')
  expect(href).toBeTruthy()

  await page.goto(href!)
  await expect(page.locator('h1')).toBeVisible()
  await settleAnimations(page)
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([])
})

// week4_plan.md Phase 6B step 13 — the chart (TrendChart, recharts) is a graphical
// object with its own contrast/keyboard-tooltip requirements the anonymous PUBLIC_ROUTES
// loop above can never reach, since /admin/metrics requires a real admin sign-in.
test.describe('axe: /admin/metrics (admin-only)', () => {
  test('light theme has no violations', async ({ page }) => {
    test.skip(!hasAdminE2ECreds, adminE2ESkipReason)
    await signInAsAdmin(page)
    await page.goto('/admin/metrics')
    await expect(page.getByRole('heading', { name: /metrics/i })).toBeVisible()
    // The revenue tiles arrive via React Query after mount, same reasoning as the
    // question/template detail checks above — wait past the loading skeleton.
    await expect(page.getByText('Gross revenue')).toBeVisible()
    await settleAnimations(page)
    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([])
  })

  test('dark theme has no violations', async ({ page }) => {
    test.skip(!hasAdminE2ECreds, adminE2ESkipReason)
    await page.addInitScript(() => {
      window.localStorage.setItem('practicable:theme', 'dark')
    })
    await signInAsAdmin(page)
    await page.goto('/admin/metrics')
    await expect(page.getByRole('heading', { name: /metrics/i })).toBeVisible()
    await expect(page.getByText('Gross revenue')).toBeVisible()
    await settleAnimations(page)
    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([])
  })
})

// week4_plan.md §8G-11's own DoD line: "axe clean with the menu open" — the state a
// closed-only audit never reaches. The PUBLIC_ROUTES loop above already scans `/` with
// ProductsMenu closed; this is the deliberately separate open-state run that line calls
// for. Real Playwright automation (unlike the jsdom unit suite in ProductsMenu.test.tsx)
// has no synthetic-click limitation here, so this is a genuine click, not a workaround.
//
// Scoped to the trigger + open menu region, not the whole page: a full-page scan here
// would duplicate the PUBLIC_ROUTES `/` check above and fail on an unrelated, pre-existing
// contrast issue in Home.tsx's stat strip (`.band` / `--muted-foreground`, nothing to do
// with the menu — confirmed failing on the *closed*-menu `/` test too, so it predates and
// is independent of this test). What §8G-11 actually asks about is the menu's own
// accessibility, which this scan covers precisely.
test('axe: Products menu has no violations when open', async ({ page }) => {
  await page.goto('/')
  const trigger = page.getByRole('button', { name: /products/i })
  await expect(trigger).toBeVisible()
  await trigger.click()
  const menu = page.getByRole('region', { name: 'Products' })
  await expect(menu).toBeVisible()
  const results = await new AxeBuilder({ page })
    .include('nav[aria-label="Main"]')
    .analyze()
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([])
})
