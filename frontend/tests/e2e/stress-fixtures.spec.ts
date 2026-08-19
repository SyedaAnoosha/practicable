import { test, expect } from '@playwright/test'

/**
 * week3_plan.md Phase 6 step 4 / DESIGN.md §49.2 — "every list and card component is
 * tested against a fixture set that deliberately includes" a 140-character title, a
 * one-word title, a question with only the required tags, a 2,400-word body, a course
 * with 12 modules and 60 lessons, and a 42-character author name.
 *
 * These are synthetic on purpose, not inserted into the real catalogue: §49.1's "real
 * content, always" rule means the live database never carries placeholder rows, so the
 * fixtures live here instead — DESIGN.md §49.2's own words, "these live in the repo as
 * fixtures" — and reach the page via `page.route()` interception rather than a real
 * round trip. Checked because the real catalogue, at time of writing, never approaches
 * any of these extremes (`SELECT max(length(title))` on live `questions` returns 49,
 * not 140) — a passing axe sweep and a clean `tsc` on real content prove nothing about
 * what happens when a genuinely long title or a 60-lesson course ships later.
 *
 * `MAX_SCROLL_TOLERANCE_PX` allows a few px of slack for scrollbar-width rounding
 * across browsers — the assertion is "no layout-breaking overflow", not zero-pixel
 * pixel-perfection.
 */

const MAX_SCROLL_TOLERANCE_PX = 2

// The API and the SPA share a path suffix by coincidence (`/questions/{slug}` is both
// a frontend route and the API path it fetches) — a bare `**/questions/{slug}**` glob
// matches the page's own document navigation too, on the frontend's own origin, and
// `route.fulfill()` on that hijacks page.goto() itself, replacing the real HTML shell
// with raw JSON. Scoping every mock to the API's actual origin (not the frontend's)
// is what keeps navigation and the intercepted fetch from colliding.
const API_ORIGIN = process.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(scrollWidth, `document.scrollWidth (${scrollWidth}) vs clientWidth (${clientWidth})`).toBeLessThanOrEqual(
    clientWidth + MAX_SCROLL_TOLERANCE_PX,
  )
}

const LONG_TITLE_140 =
  'Why Do Our Risk Committee Meetings Keep Drifting Off Agenda Into Unrelated Operational Detail Instead Of The Material Decisions The Board Actually Needs From Us'.slice(
    0,
    140,
  )
const ONE_WORD_TITLE = 'Escalation'
const LONG_BODY_2400_WORDS = Array.from(
  { length: 2400 },
  (_, i) => ['risk', 'governance', 'control', 'exposure', 'appetite', 'threshold', 'escalation', 'assurance'][i % 8],
).join(' ')
const LONG_AUTHOR_NAME_42 = 'Ms. Aoife Ní Bhraonáin-Whitfield Prendergast'.slice(0, 42)

test.describe('DESIGN.md §49.2 stress fixtures — 375px, no horizontal overflow', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('question catalogue: a 140-char title, a one-word title, and tags-only-required', async ({ page }) => {
    await page.route(`${API_ORIGIN}/questions/index**`, (route) =>
      route.fulfill({
        json: [
          {
            id: 'stress-1',
            slug: 'stress-long-title',
            title: LONG_TITLE_140,
            subtitle: null,
            preview: 'A stress fixture for card overflow, truncation and line-height collapse.',
            domain: 'Risk (Enterprise & op.)',
            domain_slug: 'risk',
            tags: [],
            featured: false,
            featured_sort: null,
          },
          {
            id: 'stress-2',
            slug: 'stress-one-word-title',
            title: ONE_WORD_TITLE,
            subtitle: null,
            preview: 'A stress fixture for cards that assume a two-line title and collapse with one.',
            domain: 'Risk (Enterprise & op.)',
            domain_slug: 'risk',
            tags: [],
            featured: false,
            featured_sort: null,
          },
        ],
      }),
    )
    await page.goto('/questions')
    await expect(page.getByText(LONG_TITLE_140)).toBeVisible()
    await expect(page.getByText(ONE_WORD_TITLE, { exact: true })).toBeVisible()
    await expectNoHorizontalOverflow(page)
  })

  test('question detail: a 140-char title and a 2,400-word body', async ({ page }) => {
    await page.route(`${API_ORIGIN}/questions/stress-long-detail**`, (route) =>
      route.fulfill({
        json: {
          id: 'stress-3',
          slug: 'stress-long-detail',
          title: LONG_TITLE_140,
          subtitle: 'A stress fixture, not a real question.',
          preview: 'Reading measure, scroll performance and prose spacing under a very long body.',
          body: LONG_BODY_2400_WORDS,
          domain: 'Risk (Enterprise & op.)',
          tags: [],
          gated: false,
          related_content: [],
          related_questions: [],
          related_lessons: [],
        },
      }),
    )
    await page.goto('/questions/stress-long-detail')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expectNoHorizontalOverflow(page)
  })

  test('course detail: 12 modules, 60 lessons, and a 42-character author name', async ({ page }) => {
    const modules = Array.from({ length: 12 }, (_, m) => ({
      id: `module-${m}`,
      title: `Module ${m + 1} — a stress fixture module title`,
      description: null,
      sort_order: m,
      lessons: Array.from({ length: 5 }, (_, l) => ({
        id: `lesson-${m}-${l}`,
        slug: `stress-lesson-${m}-${l}`,
        title: `Lesson ${m + 1}.${l + 1}`,
        lesson_type: 'video',
        sort_order: l,
        duration_seconds: 300,
        locked: true,
        completed: false,
      })),
      questions: [],
    }))
    await page.route(`${API_ORIGIN}/courses/stress-long-course**`, (route) =>
      route.fulfill({
        json: {
          id: 'stress-course-1',
          slug: 'stress-long-course',
          title: 'A Stress-Fixture Course',
          subtitle: 'Sidebar scrolling and sticky behaviour under real depth.',
          description: 'A stress fixture, not a real course.',
          section: 'Risk',
          author_name: LONG_AUTHOR_NAME_42,
          owned: false,
          lesson_count: 60,
          first_lesson_slug: 'stress-lesson-0-0',
          modules,
          related_products: [],
        },
      }),
    )
    await page.goto('/courses/stress-long-course')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByText(LONG_AUTHOR_NAME_42)).toBeVisible()
    await expectNoHorizontalOverflow(page)
  })
})
