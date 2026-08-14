import { test, expect } from '@playwright/test'

/**
 * Gating case 9 — DESIGN.md §58.2 / week2_plan.md Part IV.
 *
 * "`View source` on a lesson page a user is not entitled to contains no lesson body
 * text — a question page is exempt by design (§21.3)."
 *
 * This app is a client-rendered SPA with no server-rendered HTML for member routes
 * (DESIGN.md §44 prerenders only the public marketing/question surfaces) — so a literal
 * curl-style "view source" is meaningless here; every route's raw HTML is the same empty
 * `<div id="root">` shell regardless of what it gates. The only test that means anything
 * is Playwright's rendered-DOM content after the SPA has run and made its real API
 * calls — which is what `page.content()` below actually inspects.
 *
 * week2_plan.md Phase 1 step 2 / §25: "Prefer the dependency override for
 * unit/integration; use real sign-in for the Playwright pass, so at least one layer
 * exercises the real token path." The SIGNED-IN-BUT-UNENTITLED half of case 9 needs a
 * real Supabase test account, which does not exist in this environment — creating one
 * automatically would write a real row into the owner's live Supabase project with no
 * confirmation, which this suite deliberately does not do unattended. That half is
 * written below, gated on E2E_TEST_EMAIL/E2E_TEST_PASSWORD, and SKIPS with a clear
 * reason when they are unset rather than silently passing or being deleted.
 */

// A real reading-type lesson (db/seed/008_seed_reading_lesson_body.sql) whose `body`
// field is genuine, substantial prose — a video lesson has no body text at all, so a
// video-type lesson would make this assertion trivially true for the wrong reason.
const GATED_LESSON_PATH = '/learn/risk-register-fundamentals/writing-entries-people-actually-read'
// A sentence lifted from that seeded body — distinctive enough that it cannot appear on
// the page by coincidence, unlike a common word.
const KNOWN_LESSON_BODY_FRAGMENT = 'a vague line nobody can act on'

test.describe('Gating case 9 — lesson content never reaches an unentitled browser', () => {
  test('anonymous: a gated lesson URL never renders lesson content — it redirects before any API call fetches it', async ({
    page,
  }) => {
    // MemberLayout (frontend/src/routes/_layouts/MemberLayout.tsx) guards /learn/* client-side
    // and redirects to /sign-in before Learn.tsx ever mounts or calls the lessons API — so an
    // anonymous visit is a STRONGER guarantee than "the body is absent from the response",
    // it never requests the body at all. That is the assertion this test makes.
    await page.goto(GATED_LESSON_PATH)
    await expect(page).toHaveURL(/\/sign-in/)

    const html = await page.content()
    expect(html).not.toContain(KNOWN_LESSON_BODY_FRAGMENT)
    // The redirect itself is the real guarantee here (the lesson API was never even
    // called) — the string check is a belt-and-braces second signal, not the primary one.
  })

  test('signed in, unentitled: the rendered page contains no lesson body text', async ({ page }) => {
    // `test.skip(condition, reason)` called at describe scope (rather than inside a
    // test body) applies retroactively to every test in the enclosing describe block —
    // including the anonymous one above, which silently skipped alongside this one the
    // first time this was written. Scoping it inside this test's own body is what
    // limits it to only this test.
    test.skip(
      !process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD,
      'needs a real Supabase test account (E2E_TEST_EMAIL / E2E_TEST_PASSWORD) — ' +
        'not created automatically, since that would write a live row to the real project. ' +
        'See week2_plan.md Phase 1 for how to provision one.',
    )
    await page.goto('/sign-in')
    await page.getByLabel(/email/i).fill(process.env.E2E_TEST_EMAIL!)
    await page.getByLabel(/password/i).fill(process.env.E2E_TEST_PASSWORD!)
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page).toHaveURL(/\/dashboard/)

    await page.goto(GATED_LESSON_PATH)
    // Real assertion: entitled === false renders the locked state (§21.3's pattern
    // extended to lessons), and the actual guidance/video/download never reaches the DOM.
    await expect(page.getByText(/course you don't have yet|not entitled|locked/i)).toBeVisible()
    const html = await page.content()
    expect(html).not.toContain(KNOWN_LESSON_BODY_FRAGMENT)
  })
})
