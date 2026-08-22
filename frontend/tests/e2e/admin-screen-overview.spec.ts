import { test, expect, type Page } from '@playwright/test'

/**
 * `[ADDED 2026-08-22]` The admin half of the whole-surface screen sweep.
 *
 * `screen-overview.spec.ts` covers the public routes; nothing covered the admin ones,
 * and the admin panel is where several of this redesign's worst defects surfaced — raw
 * `snake_case` metric names shown to a person, revenue printed in cents, a sidebar that
 * scrolled horizontally with overlapping icons, raw `<p>` tags rendered as text in the
 * lesson writer. Every one of those was found by a human opening the page.
 *
 * Auth is stubbed rather than driven through a real sign-in, deliberately:
 * `adminAuth.ts` needs `E2E_ADMIN_EMAIL`/`E2E_ADMIN_PASSWORD` against the owner's real
 * Supabase project, which is not available unattended and which this suite must not
 * require to be useful.
 *
 * The stub replaces the app's own `lib/auth/supabase.ts` module as Vite serves it, so
 * `getSession`/`onAuthStateChange` hand back a session and `AdminLayout`'s guard is
 * satisfied by real code paths rather than by a faked store write. `/me/profile` is
 * fulfilled with `is_admin: true`.
 *
 * Admin API calls are stubbed too, and they have to be: the axios interceptor in
 * `lib/api/client.ts` correctly treats a 401 as "your session is gone" and sends the
 * browser to /sign-in, so a sweep that let the real (unauthenticated) backend answer
 * would audit the login page thirteen times over. Each admin endpoint returns an empty
 * but well-formed payload, which is also the more interesting state to assert: it is
 * the first-run, nothing-created-yet view that a new owner actually sees, and where
 * blank-page bugs hide.
 */

const VIEWPORT = { width: 1440, height: 900 }

const ADMIN_ROUTES = [
  '/admin',
  '/admin/questions',
  '/admin/courses',
  '/admin/templates',
  '/admin/packs',
  '/admin/media',
  '/admin/orders',
  '/admin/contact',
  '/admin/leads',
  '/admin/metrics',
  '/admin/users',
  '/admin/audit',
  '/admin/settings',
] as const

/** Member-side authenticated screens — the other half a real user actually sees. */
const MEMBER_ROUTES = [
  '/dashboard',
  '/library',
  '/purchases',
  '/account',
  '/store',
] as const

const IGNORED_ERROR_PATTERNS = [
  /favicon/i,
  /ResizeObserver loop/i,
  /Download the React DevTools/i,
  /\[vite\]/i,
  // The stubbed token is not a real one, so every data call legitimately fails auth.
  /\b(401|403)\b/,
  /Failed to load resource/i,
  /CORS/i,
  /Network Error/i,
  /AxiosError/i,
]

function isIgnorable(message: string): boolean {
  return IGNORED_ERROR_PATTERNS.some((re) => re.test(message))
}

/** Empty-but-well-formed payloads for the admin/member endpoints the pages call.
 *  Shapes mirror what each screen's TypeScript interface expects. */
const EMPTY_PAYLOADS: Array<[RegExp, unknown]> = [
  /* Order matters — first match wins, so the specific paths come before the general
     ones. Each shape is taken from the page's own TypeScript interface: a stub that
     returns the wrong *shape* (an array where the code destructures an object) produces
     a crash the real API could never cause, which is a false alarm, not a finding. */
  [/\/admin\/metrics\/revenue-series/, { data: [] }],
  [
    /\/admin\/metrics/,
    {
      metrics: [],
      generatedAt: new Date().toISOString(),
      revenueGrossCents: 0,
      revenueRefundedCents: 0,
      revenueNetCents: 0,
      enrollmentSplits: {},
      productRankings: [],
      downloadLinksIssued: 0,
      courseEnrollmentRankings: [],
      recommendationClicks: { question: 0, catalogue: 0, total: 0 },
      recommendationRankings: [],
    },
  ],
  // AdminQuestions' form-options: `tag_dimensions` is a Record, not a list.
  [/\/admin\/questions\/form-options/, { domains: [], tag_dimensions: {} }],
  // Leads and audit are plain `list[...]` responses (see backend routers), unlike the
  // paginated tables below — matching them against the paginated shape hands the page
  // an object where it maps an array.
  [/\/admin\/(leads|audit)/, []],
  // Paginated admin tables.
  [/\/admin\/(orders|users|questions)/, { items: [], total: 0, page: 1, page_size: 25 }],
  [/\/admin\/settings/, {}],
  // `/me/library` backs both Library and Dashboard, and both index into its arrays.
  [/\/me\/library/, { courses: [], templates: [], reference: [], is_empty: true }],
  [/\/me\/orders\/[^/]+\/refund-eligibility/, { eligible: false, status: 'not_eligible', reason: null }],
  // `/me/orders` is cursor-paginated and read via useInfiniteQuery.
  [/\/me\/orders/, { orders: [], has_more: false, next_cursor: null }],
  [/\/me\/(entitlements|purchases|progress|recommendations)/, []],
  [/\/me\/account/, {}],
  // Plain content collections.
  [/\/(admin\/)?(courses|templates|packs|media|contact|questions)/, []],
  [/\/(dashboard|library|store|products)/, []],
]

/** Stub the app's supabase module and every API call the swept screens make. */
async function stubAdminSession(page: Page, { admin }: { admin: boolean }) {
  const uid = '00000000-0000-4000-8000-000000000001'

  /* Replacing the module Vite serves is the least invasive way in: the guard, the
     store and RootLayout's effect all run their real code, and no product file is
     touched. Seeding Supabase's localStorage entry does NOT work — the v2 client
     validates the stored token and discards it. */
  await page.route('**/src/lib/auth/supabase.ts', (route) =>
    route.fulfill({
      status: 200,
      headers: { 'content-type': 'application/javascript' },
      body: `
const user = { id: ${JSON.stringify(uid)}, aud: 'authenticated', role: 'authenticated',
  email: 'e2e@example.test', app_metadata: {}, user_metadata: { name: 'E2E Admin' },
  created_at: new Date().toISOString() };
const session = { access_token: 'e2e-stub', token_type: 'bearer', expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r', user };
export const supabase = { auth: {
  getSession: async () => ({ data: { session }, error: null }),
  getUser: async () => ({ data: { user }, error: null }),
  onAuthStateChange: (cb) => { setTimeout(() => cb('SIGNED_IN', session), 0);
    return { data: { subscription: { unsubscribe() {} } } }; },
  signOut: async () => ({ error: null }),
} };
`,
    }),
  )

  await page.route(/\/me\/profile/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: uid, email: 'e2e@example.test', name: 'E2E Admin', is_admin: admin }),
    }),
  )

  /* Everything else on the API origin. A 401 here would be indistinguishable from a
     dead session to `client.ts`'s interceptor, which redirects to /sign-in — so an
     un-stubbed call silently turns this into a sweep of the login page. */
  await page.route('**://localhost:8000/**', (route) => {
    const url = route.request().url()
    if (/\/me\/profile/.test(url)) return route.fallback()
    const match = EMPTY_PAYLOADS.find(([re]) => re.test(url))
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(match ? match[1] : []),
    })
  })
}

interface Collected {
  pageErrors: string[]
  serverErrors: string[]
}

function collect(page: Page): Collected {
  const out: Collected = { pageErrors: [], serverErrors: [] }
  page.on('pageerror', (err) => {
    const text = String(err)
    if (!isIgnorable(text)) out.pageErrors.push(text)
  })
  page.on('response', (res) => {
    if (res.status() >= 500) out.serverErrors.push(`${res.status()} ${res.url()}`)
  })
  return out
}

async function settle(page: Page) {
  await page.waitForLoadState('networkidle').catch(() => {})
  await page
    .waitForFunction(() => document.querySelectorAll('.animate-pulse').length === 0, null, {
      timeout: 6_000,
    })
    .catch(() => {})
  await page.waitForTimeout(400)
}

/** The checks that apply to any authenticated screen, admin or member. */
async function assertSoundScreen(page: Page, label: string, collected: Collected) {
  const bodyText = (await page.locator('body').innerText()).trim()

  // A real screen, not a blank shell and not the framework's crash page.
  expect(bodyText.length, `${label}: rendered text length`).toBeGreaterThan(40)
  expect(bodyText, `${label}: react-router developer screen`).not.toMatch(
    /Hey developer|Unexpected Application Error/i,
  )

  /* `[ADDED 2026-08-22]` The product's own error boundary must not be what renders.
     This caught a real crash the other assertions all walked straight past: when
     AdminMetrics threw, react-router swapped in `RouteError`, which has exactly one
     `<h1>`, plenty of text, no overflow and no `pageerror` — so every check below
     passed on a page that had actually blown up. A boundary is the right thing to
     have and the wrong thing to see. */
  expect(bodyText, `${label}: rendered the error boundary instead of the screen`).not.toMatch(
    /Something went wrong at our end/i,
  )

  // Not bounced to sign-in — the stub must actually satisfy the guard, otherwise this
  // whole sweep would silently be auditing the login page thirteen times.
  expect(page.url(), `${label}: redirected away`).not.toMatch(/\/sign-in/)

  // Exactly one non-empty <h1>.
  const h1s = page.locator('h1')
  expect(await h1s.count(), `${label}: <h1> count`).toBe(1)
  expect((await h1s.first().innerText()).trim().length, `${label}: <h1> text`).toBeGreaterThan(0)

  // No horizontal scroll — the collapsed-sidebar defect was exactly this.
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(scrollWidth, `${label}: horizontal overflow`).toBeLessThanOrEqual(clientWidth + 2)

  // No raw markup leaking as visible text (the lesson-writer `<p>` bug).
  expect(bodyText, `${label}: raw HTML tags visible as text`).not.toMatch(
    /<\/?(p|div|span|h[1-6]|ul|ol|li|strong|em|br)\b[^>]*>/i,
  )

  // No placeholder junk, and no machine identifiers shown to a person — the admin
  // metrics page printed `second_purchase_rate` and `signup_to_purchase_days` verbatim.
  expect(bodyText, `${label}: placeholder junk`).not.toMatch(/\bundefined\b|\[object Object\]/)
  expect(bodyText, `${label}: snake_case identifier shown as a label`).not.toMatch(
    /\b[a-z]+_[a-z]+(_[a-z]+)*\b(?![^<]*@)/,
  )

  expect(collected.pageErrors, `${label}: uncaught exceptions`).toEqual([])
  expect(collected.serverErrors, `${label}: 5xx responses`).toEqual([])
}

test.describe('screen overview — admin panel', () => {
  test.use({ viewport: VIEWPORT })

  for (const route of ADMIN_ROUTES) {
    test(`${route} renders a sound screen`, async ({ page }) => {
      const collected = collect(page)
      await stubAdminSession(page, { admin: true })

      await page.goto(route, { waitUntil: 'domcontentloaded' })
      await settle(page)

      await assertSoundScreen(page, route, collected)
    })
  }

  test('the collapsed sidebar does not scroll horizontally or overlap its icons', async ({
    page,
  }) => {
    /* The reported defect, in its own test because it only appears in the collapsed
       state: "sidebar when closing is worst possible design. The horizontal scroll and
       the multiple icons overlap". */
    const collected = collect(page)
    await stubAdminSession(page, { admin: true })
    await page.goto('/admin/metrics', { waitUntil: 'domcontentloaded' })
    await settle(page)

    const collapse = page.getByRole('button', { name: /collapse|expand/i }).first()
    if ((await collapse.count()) === 0) test.skip(true, 'no sidebar collapse control found')
    await collapse.click()
    await page.waitForTimeout(500)

    const aside = page.locator('aside').first()
    const overflow = await aside.evaluate((el) => el.scrollWidth - el.clientWidth)
    expect(overflow, 'collapsed sidebar scrolls horizontally').toBeLessThanOrEqual(1)

    /* No two nav *controls* may occupy the same space. Measured per control, not per
       `<svg>`: the theme toggle legitimately stacks a sun and a moon in one button and
       crossfades them, so comparing raw SVG boxes reports that intentional pair as an
       overlap. What the bug report was about is two different destinations sitting on
       top of each other, and that is what this checks. */
    const boxes = await aside.locator('a, button').evaluateAll((els) =>
      els
        .filter((e) => (e as HTMLElement).offsetParent !== null)
        .map((e) => {
          const r = e.getBoundingClientRect()
          return { x: r.x, y: r.y, w: r.width, h: r.height }
        })
        .filter((r) => r.w > 0 && r.h > 0),
    )
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]
        const b = boxes[j]
        const overlaps =
          a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
        expect(overlaps, `collapsed sidebar icons ${i} and ${j} overlap`).toBe(false)
      }
    }

    expect(collected.pageErrors).toEqual([])
  })
})

test.describe('screen overview — signed-in member screens', () => {
  test.use({ viewport: VIEWPORT })

  for (const route of MEMBER_ROUTES) {
    test(`${route} renders a sound screen`, async ({ page }) => {
      const collected = collect(page)
      await stubAdminSession(page, { admin: false })

      await page.goto(route, { waitUntil: 'domcontentloaded' })
      await settle(page)

      await assertSoundScreen(page, route, collected)
    })
  }
})
