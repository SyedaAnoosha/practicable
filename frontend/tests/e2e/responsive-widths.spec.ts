import { test, expect } from '@playwright/test'
import { hasAdminE2ECreds, adminE2ESkipReason, signInAsAdmin } from './adminAuth'

/**
 * DESIGN.md §62's responsive width table — 375 · 390 · 430 · 768 · 1024 · 1280 · 1440,
 * no clipping. 375 is the floor: a common real device width and where a two-column card
 * grid, a seven-column admin table and a 14-character price all break.
 *
 * This checks the seven required widths against the real, live public routes (unlike
 * stress-fixtures.spec.ts, which checks synthetic extreme content at 375px only) — the
 * two suites are complementary: one is "does real content ever overflow at any
 * breakpoint", the other is "does deliberately extreme content overflow at the floor".
 *
 * Against the live backend (no route mocking) since the point is what real, current
 * content looks like at each width, not an isolated fixture. Read-only GETs only.
 */

const WIDTHS = [375, 390, 430, 768, 1024, 1280, 1440] as const

const MAX_SCROLL_TOLERANCE_PX = 2

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page, label: string) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(
    scrollWidth,
    `${label}: document.scrollWidth (${scrollWidth}) vs clientWidth (${clientWidth})`,
  ).toBeLessThanOrEqual(clientWidth + MAX_SCROLL_TOLERANCE_PX)
}

// The public routes most likely to carry the widest content: card grids, the longest
// real title in each catalogue, and the two-column store grid.
//
// Two of the evidence layer's product-detail routes are checked here against real seeded
// rows rather than mocked data. `/buy/:slug` is deliberately NOT here — it sits behind
// the signed-in layout (App.tsx), so it isn't a public route this anonymous sweep can
// reach; its own coverage is the mocked `/templates/:id` stress fixture (same
// `EvidencePanel`) plus the authenticated e2e suites. These two slugs name real rows in
// the seeded catalogue (`db/seed/`); if the referenced template or pack is ever
// unpublished, point these at another published one rather than deleting the coverage.
const ROUTES = [
  '/',
  '/questions',
  '/courses',
  '/templates',
  '/packs',
  '/store',
  '/about',
  '/contact',
  '/search?q=risk',
  '/verify/test-code',
  '/templates/4935c92a-3138-4dd4-9c70-1d23beb0a8b4',
  '/store/packs/risk-register-fundamentals',
] as const

for (const width of WIDTHS) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 900 } })

    for (const route of ROUTES) {
      test(`no horizontal overflow: ${route}`, async ({ page }) => {
        await page.goto(route)
        await expect(page.locator('h1')).toBeVisible()
        await expectNoHorizontalOverflow(page, route)
      })
    }
  })
}

// /admin/metrics carries a seven-column-ish tile grid, a ranked-products table, and the
// recharts TrendChart, none of which the anonymous ROUTES loop above can reach (it
// requires a real admin sign-in). Same gated-real-account pattern as
// accessibility.spec.ts's admin coverage and gating.spec.ts's signed-in test.
for (const width of WIDTHS) {
  test.describe(`${width}px — /admin/metrics (admin-only)`, () => {
    test.use({ viewport: { width, height: 900 } })

    test('no horizontal overflow', async ({ page }) => {
      test.skip(!hasAdminE2ECreds, adminE2ESkipReason)
      await signInAsAdmin(page)
      await page.goto('/admin/metrics')
      await expect(page.getByRole('heading', { name: /metrics/i })).toBeVisible()
      await expect(page.getByText('Gross revenue')).toBeVisible()
      await expectNoHorizontalOverflow(page, '/admin/metrics')
    })
  })
}

// The two dynamic detail routes need a real slug resolved from the live catalogue
// first, same pattern accessibility.spec.ts already uses for "a real question detail
// page has no violations" — not hard-coded, so it can't drift from whichever content
// is actually first in the published set.
for (const width of WIDTHS) {
  test(`no horizontal overflow: a real question detail page at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/questions')
    const firstQuestionLink = page.locator('a[href^="/questions/"]').first()
    await expect(firstQuestionLink).toBeVisible()
    const href = await firstQuestionLink.getAttribute('href')
    expect(href).toBeTruthy()

    await page.goto(href!)
    await expect(page.locator('h1')).toBeVisible()
    await expectNoHorizontalOverflow(page, href!)
  })

  test(`no horizontal overflow: a real course detail page at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/courses')
    const firstCourseLink = page.locator('a[href^="/courses/"]').first()
    await expect(firstCourseLink).toBeVisible()
    const href = await firstCourseLink.getAttribute('href')
    expect(href).toBeTruthy()

    await page.goto(href!)
    await expect(page.locator('h1')).toBeVisible()
    await expectNoHorizontalOverflow(page, href!)
  })
}

// Question -> product routing, against the real backend, not mocked: a mocked
// `page.route()` would always match whatever URL the frontend sent and could never catch
// a client/server query-shape mismatch. The regression guarded here is that
// `SituationProducts.tsx` must send repeated `?ids=a&ids=b` params, not a comma-joined
// `?ids=a,b,c` value — FastAPI's `ids: List[str] = Query(...)` only accepts the repeated
// form, and the comma-joined form 400s on every multi-question filter.
// `effort=mod` is a real filter value against the live seed data (`db/seed/`) with enough
// matches to assert on; if the seed changes, point this at another filter combination
// that still yields exact matches rather than deleting the coverage.
test('SituationProducts resolves real product recommendations for an active filter', async ({ page }) => {
  await page.goto('/questions?effort=mod')
  await expect(page.getByText('Products for your situation')).toBeVisible()
  // Not stuck on the loading skeleton, and not silently empty — a real product card,
  // named and priced, is what proves the request round-tripped successfully.
  await expect(page.getByRole('link', { name: 'View' }).first()).toBeVisible()
})

// Not "the first question in the index" — most questions have no product that grants
// them (RoutedProducts correctly renders nothing for those), so this names a specific
// real slug known to be granted by a published product, same reasoning as the two
// hardcoded slugs in ROUTES above. If this question is ever unpublished or its granting
// product changes, point this at another question a real product includes.
test('RoutedProducts resolves real product recommendations on a question detail page', async ({ page }) => {
  await page.goto('/questions/we-have-a-risk-register-but-no-one-uses-it')
  await expect(page.getByText('Products that include this question')).toBeVisible()
  await expect(page.getByRole('link', { name: 'View' }).first()).toBeVisible()
})
