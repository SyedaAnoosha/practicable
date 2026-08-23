import { test, expect, type Page } from '@playwright/test'

/**
 * `[ADDED 2026-08-22]` A whole-surface sweep of the real, live public screens.
 *
 * The existing e2e suites each check one property in depth (axe on a11y, widths on
 * responsive, entitlement on gating). None of them answers the question that kept
 * producing user-visible defects through this redesign: *does every screen actually
 * render something sensible when you open it*. Three separate bugs shipped past
 * tsc, eslint and 235 unit tests because nothing ever loaded the page:
 *
 *   - `ErrorState`, `AuthorCard` and `LockedState` were built, documented as done, and
 *     had zero call sites.
 *   - `/templates/:id` ran to 3,213px in a single narrow column while every sibling
 *     product page used a sticky two-column rail.
 *   - Course cards rendered a bare `<span />` where the price belongs.
 *
 * So this file asserts the cheap, high-signal things a human notices in the first
 * second of looking at a screen, across every public route at once:
 *
 *   1. It reaches a 200 and paints real content (not a blank body, not an error boundary).
 *   2. Exactly one `<h1>`, and it is not empty — the single most common redesign slip.
 *   3. No horizontal scroll.
 *   4. No uncaught console errors or failed requests while the screen settles.
 *   5. Page height stays within a sane number of viewports — the regression that
 *      produced the `/questions` and `/templates/:id` fixes.
 *   6. No raw HTML tags leaking as visible text (the LessonWriteScreen `<p>` bug).
 *   7. No obviously-unstyled placeholder text ("undefined", "NaN", "[object Object]").
 *
 * Read-only, anonymous, against the live backend — same rule as responsive-widths.
 */

const VIEWPORT = { width: 1440, height: 900 }

/** Above this, a page is a scroll marathon rather than a screen. Tuned to the routes
 *  below: the home page is a deliberate long-form marketing surface and the question
 *  index is a long list, so they carry their own higher budgets. */
const DEFAULT_MAX_VIEWPORTS = 4

interface RouteCase {
  path: string
  /** Substring that must appear in the rendered page — proves real data arrived, not
   *  just an empty shell. */
  expectText?: string | RegExp
  maxViewports?: number
}

const ROUTES: RouteCase[] = [
  { path: '/', expectText: /risk|decision/i, maxViewports: 8 },
  { path: '/questions', expectText: /question/i, maxViewports: 8 },
  { path: '/courses', expectText: /course/i },
  { path: '/templates', expectText: /template/i },
  { path: '/packs', expectText: /pack/i },
  { path: '/pricing', maxViewports: 5 },
  { path: '/contact' },
  { path: '/about' },
  // Legal pages live under /legal/*.
  { path: '/legal/terms' },
  { path: '/legal/privacy' },
  { path: '/legal/refunds' },
  { path: '/sign-in' },
  { path: '/sign-up' },
  // W5-R3: search page (public, no auth required)
  { path: '/search?q=risk' },
  // W5-R2: certificate verification (public, no auth required).
  //
  // `test-code` is deliberately not a real certificate, so the API answers 404 by
  // design and the browser logs that response. What this sweep is checking here is the
  // NOT-FOUND screen — the one a stranger following a stale or mistyped link actually
  // lands on. It still has to paint a sound page rather than a blank body, so the
  // expected 404 is allowed through while every other console error still fails.
  { path: '/verify/test-code', allowNotFound: true },
]

/** Unmatched URLs must reach the product's own not-found page, never react-router's
 *  built-in developer screen — which is what shipped until this sweep caught it. */
const NOT_FOUND_PATH = '/this-route-does-not-exist-2026'

/** Console/network noise that is not a defect in the thing under test. */
const IGNORED_ERROR_PATTERNS = [
  /favicon/i,
  /ResizeObserver loop/i,
  /Download the React DevTools/i,
  /\[vite\]/i,
  // Anonymous sweep: "who am I" and entitlement probes legitimately 401/403.
  /\b(401|403)\b/,
]

function isIgnorable(message: string): boolean {
  return IGNORED_ERROR_PATTERNS.some((re) => re.test(message))
}

interface Collected {
  consoleErrors: string[]
  pageErrors: string[]
  failedRequests: string[]
}

function collect(page: Page): Collected {
  const out: Collected = { consoleErrors: [], pageErrors: [], failedRequests: [] }

  page.on('console', (msg) => {
    if (msg.type() !== 'error') return
    const text = msg.text()
    if (!isIgnorable(text)) out.consoleErrors.push(text)
  })
  page.on('pageerror', (err) => {
    const text = String(err)
    if (!isIgnorable(text)) out.pageErrors.push(text)
  })
  page.on('response', (res) => {
    if (res.status() < 500) return // 4xx on an anonymous sweep is expected; 5xx never is
    out.failedRequests.push(`${res.status()} ${res.url()}`)
  })

  return out
}

/** Wait for the app to settle: React Query resolved, skeletons gone, heading painted.
 *
 * `networkidle` alone is not enough on the detail pages. Their data fetch starts after
 * mount, so there is a window where the network has gone quiet, the route component has
 * rendered its loading branch, and the real content — including the `<h1>` — does not
 * exist yet. Waiting for the heading is waiting for the thing every assertion below is
 * actually about. */
async function settle(page: Page) {
  await page.waitForLoadState('networkidle').catch(() => {
    /* long-poll or a slow asset — the assertions below are the real gate */
  })
  await page
    .waitForFunction(() => document.querySelectorAll('.animate-pulse').length === 0, null, {
      timeout: 5_000,
    })
    .catch(() => {
      /* a page with a permanently-animating element is not itself a failure */
    })
  await page
    .waitForFunction(
      () => {
        const h1 = document.querySelector('h1')
        return !!h1 && (h1 as HTMLElement).innerText.trim().length > 0
      },
      null,
      { timeout: 8_000 },
    )
    .catch(() => {
      /* Deliberately swallowed: a page that genuinely never paints a heading is a real
         defect, and the explicit `<h1>` assertion below reports it far better than a
         timeout stack would. */
    })
}

test.describe('screen overview — every public route paints correctly', () => {
  test.use({ viewport: VIEWPORT })

  for (const route of ROUTES) {
    test(`${route.path} renders a sound screen`, async ({ page }) => {
      const collected = collect(page)

      const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' })
      expect(response?.status(), `${route.path}: HTTP status`).toBeLessThan(400)

      await settle(page)

      // ── 1. Real content, not a blank body or an error boundary ──────────────
      const bodyText = (await page.locator('body').innerText()).trim()
      expect(bodyText.length, `${route.path}: rendered text length`).toBeGreaterThan(50)
      expect(bodyText, `${route.path}: error boundary visible`).not.toMatch(
        /something went wrong|application error|unhandled/i,
      )

      if (route.expectText) {
        expect(bodyText, `${route.path}: expected content marker`).toMatch(
          typeof route.expectText === 'string'
            ? new RegExp(route.expectText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
            : route.expectText,
        )
      }

      // ── 2. Exactly one non-empty <h1> ───────────────────────────────────────
      const h1s = page.locator('h1')
      const h1Count = await h1s.count()
      expect(h1Count, `${route.path}: <h1> count`).toBe(1)
      expect((await h1s.first().innerText()).trim().length, `${route.path}: <h1> text`).toBeGreaterThan(0)

      // ── 3. No horizontal scroll ─────────────────────────────────────────────
      const { scrollWidth, clientWidth, scrollHeight } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollHeight: document.documentElement.scrollHeight,
      }))
      expect(scrollWidth, `${route.path}: horizontal overflow`).toBeLessThanOrEqual(clientWidth + 2)

      // ── 5. Page length within budget ────────────────────────────────────────
      const viewports = scrollHeight / VIEWPORT.height
      const budget = route.maxViewports ?? DEFAULT_MAX_VIEWPORTS
      expect(
        viewports,
        `${route.path}: ${scrollHeight}px = ${viewports.toFixed(1)} viewports (budget ${budget})`,
      ).toBeLessThanOrEqual(budget)

      // ── 6/7. No leaked markup or placeholder junk in visible text ───────────
      expect(bodyText, `${route.path}: raw HTML tags visible as text`).not.toMatch(
        /<\/?(p|div|span|h[1-6]|ul|ol|li|strong|em|br)\b[^>]*>/i,
      )
      expect(bodyText, `${route.path}: placeholder junk`).not.toMatch(
        /\bundefined\b|\bNaN\b|\[object Object\]/,
      )

      // ── 4. Console / network health ─────────────────────────────────────────
      expect(collected.pageErrors, `${route.path}: uncaught exceptions`).toEqual([])

      // A route flagged `allowNotFound` is being visited with an id that intentionally
      // does not exist, so the browser logs the 404 the API correctly returned. Only
      // that one message is forgiven — anything else still fails the route.
      const consoleErrors = route.allowNotFound
        ? collected.consoleErrors.filter((m) => !/\b404\b/.test(m))
        : collected.consoleErrors
      expect(consoleErrors, `${route.path}: console errors`).toEqual([])
      expect(collected.failedRequests, `${route.path}: 5xx responses`).toEqual([])
    })
  }
})

test.describe('screen overview — unmatched URLs', () => {
  test.use({ viewport: VIEWPORT })

  test('an unknown URL reaches the product 404, not the framework error screen', async ({ page }) => {
    /* Until this sweep, the router had no catch-all and no errorElement, so any typo,
       stale link or old bookmark rendered react-router's developer screen — literally
       "Unexpected Application Error! ... Hey developer, You can provide a way better UX
       than this..." — to whoever was using the site. */
    const collected = collect(page)
    await page.goto(NOT_FOUND_PATH, { waitUntil: 'domcontentloaded' })
    await settle(page)

    const bodyText = await page.locator('body').innerText()

    expect(bodyText, 'react-router developer screen is visible').not.toMatch(
      /Hey developer|Unexpected Application Error|errorElement/i,
    )
    expect(bodyText).toMatch(/that page isn.t here/i)

    // Site chrome survives, so the fastest way out is the navigation already on screen.
    expect(await page.locator('header').count(), 'header missing on 404').toBeGreaterThan(0)
    expect(await page.locator('footer').count(), 'footer missing on 404').toBeGreaterThan(0)

    // And it is a real page, with a heading and a way onward.
    expect(await page.locator('h1').count()).toBe(1)
    expect(await page.getByRole('link', { name: /home page/i }).count()).toBeGreaterThan(0)

    expect(collected.pageErrors, '404 page threw').toEqual([])
  })
})

/**
 * Product detail pages, resolved from the live catalogue rather than hard-coded slugs,
 * so the sweep keeps working as content changes. These are the surfaces the redesign
 * touched most (D6 two-column rails, EvidencePanel, FactStrip, buy CTA).
 */
test.describe('screen overview — product detail pages', () => {
  test.use({ viewport: VIEWPORT })

  const CATALOGUES = [
    { list: '/courses', detailPrefix: '/courses/', apiPath: '/courses' },
    { list: '/templates', detailPrefix: '/templates/', apiPath: '/templates' },
    { list: '/packs', detailPrefix: '/store/packs/', apiPath: '/packs' },
  ] as const

  for (const cat of CATALOGUES) {
    test(`${cat.apiPath} detail page paints correctly`, async ({ page, request }) => {
      const apiBase = process.env.VITE_API_BASE_URL ?? 'http://localhost:8000'
      const res = await request.get(`${apiBase}${cat.apiPath}`)
      test.skip(!res.ok(), `${cat.apiPath} unavailable — backend not serving this catalogue`)

      const items = (await res.json()) as Array<{ slug: string }>
      test.skip(items.length === 0, `${cat.apiPath} is empty — nothing to open`)

      const collected = collect(page)
      const target = `${cat.detailPrefix}${items[0].slug}`

      const response = await page.goto(target, { waitUntil: 'domcontentloaded' })
      expect(response?.status(), `${target}: HTTP status`).toBeLessThan(400)
      await settle(page)

      const bodyText = (await page.locator('body').innerText()).trim()
      expect(bodyText.length, `${target}: rendered text length`).toBeGreaterThan(50)

      const h1Count = await page.locator('h1').count()
      expect(h1Count, `${target}: <h1> count`).toBe(1)

      const { scrollWidth, clientWidth, scrollHeight } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollHeight: document.documentElement.scrollHeight,
      }))
      expect(scrollWidth, `${target}: horizontal overflow`).toBeLessThanOrEqual(clientWidth + 2)

      /* D6: the two-column sticky-rail layout means a product page should never be a
         scroll marathon. `/templates/:id` measured 3.6 viewports before its rebuild and
         the 60-question pack measured 7.0 before its list was paged.
         The budget is 4.5 rather than 3 because the largest pack legitimately lands at
         4.0 once its question list is collapsed — the rail stays stuck to the viewport
         throughout, which was the actual defect, and is asserted separately below. */
      expect(
        scrollHeight / VIEWPORT.height,
        `${target}: ${scrollHeight}px = ${(scrollHeight / VIEWPORT.height).toFixed(1)} viewports`,
      ).toBeLessThanOrEqual(4.5)

      /* The property that actually matters on a long product page: the buy/download
         control follows the reader down. A rail that scrolls away is the bug the pack
         page had — its CTA sat ~2,000px into a 2,416px sticky column, so it was never
         on screen when a reader wanted it. */
      const railScrolls = await page.evaluate(() => {
        const aside = document.querySelector('aside')
        if (!aside) return null
        window.scrollTo(0, Math.min(2000, document.documentElement.scrollHeight - window.innerHeight))
        return new Promise<boolean>((resolve) => {
          requestAnimationFrame(() => {
            const r = aside.getBoundingClientRect()
            resolve(r.bottom > 0 && r.top < window.innerHeight)
          })
        })
      })
      if (railScrolls !== null) {
        expect(railScrolls, `${target}: buy rail left the viewport when scrolled`).toBe(true)
      }
      await page.evaluate(() => window.scrollTo(0, 0))

      // Every product page must state a commercial position — a price, an ownership
      // badge, a free marker, or an explicit "not on sale". A blank where the price
      // belongs is the defect this asserts against.
      expect(bodyText, `${target}: no commercial state stated`).toMatch(
        /\$|free|owned|in your library|not on sale/i,
      )

      expect(bodyText, `${target}: raw HTML tags visible as text`).not.toMatch(
        /<\/?(p|div|span|h[1-6]|ul|ol|li|strong|em|br)\b[^>]*>/i,
      )
      expect(collected.pageErrors, `${target}: uncaught exceptions`).toEqual([])
      expect(collected.failedRequests, `${target}: 5xx responses`).toEqual([])
    })
  }
})
