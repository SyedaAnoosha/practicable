import { test, expect } from '@playwright/test'

/**
 * week3_plan.md Phase 6 step 7 / DESIGN.md §62's "Responsive — 375 · 390 · 430 · 768 ·
 * 1024 · 1280 · 1440 · ... no clipping" and §49's own width table (line 2650): "375 is
 * the floor and it is not optional — it is still a very common real device width and it
 * is where a two-column card grid, a seven-column admin table and a 14-character price
 * all break."
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

// The public routes most likely to carry the widest content: card grids (§49's own
// example), the longest real title in each catalogue, and the two-column store grid.
//
// week4_plan.md Phase 3 step 7: two of the evidence layer's product-detail routes,
// added here against real seeded rows rather than mocked data — same "what real,
// current content looks like" rule the rest of this file follows. `/buy/:slug` is
// deliberately NOT here — it sits behind the signed-in layout (App.tsx), so it isn't a
// public route this anonymous sweep can reach; its own coverage is the mocked
// `/templates/:id` stress fixture (same `EvidencePanel`) plus the authenticated e2e
// suites. These two slugs name real rows in the seeded catalogue (`db/seed/`); if the
// referenced template or pack is ever unpublished or removed, point these at another
// published one rather than deleting the coverage.
const ROUTES = [
  '/',
  '/questions',
  '/courses',
  '/templates',
  '/store',
  '/contact',
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
