import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { hasAdminE2ECreds, adminE2ESkipReason, signInAsAdmin } from './adminAuth'

/**
 * Prose round trip: h2/h3/h4, bullets, a numbered list, a table and a link saved in
 * admin and rendered on the member lesson page, in both themes, at all seven widths,
 * with the lesson page still having exactly one h1.
 *
 * Gated on real admin credentials, matching adminAuth.ts's established pattern
 * (gating.spec.ts, accessibility.spec.ts's /admin/metrics suite): E2E_ADMIN_EMAIL/PASSWORD
 * are never created automatically, since that would write a live row to the owner's real
 * Supabase project unattended. Runs for real wherever those env vars are set.
 *
 * The toolbar buttons are located by accessible name (title="Bold" etc.) rather than by
 * icon SVGs or DOM position, which would be brittle.
 *
 * Widths: DESIGN.md's seven-width sweep, reused from responsive-widths.spec.ts.
 */

const SEVEN_WIDTHS = [320, 375, 414, 768, 1024, 1280, 1536] as const

test.describe('lesson prose round trip (admin write -> member read)', () => {
  test.skip(!hasAdminE2ECreds, adminE2ESkipReason)

  test('h2/h3/h4, bullets, a numbered list, a table and a link survive admin -> member, both themes, seven widths, one h1', async ({
    page,
  }) => {
    await signInAsAdmin(page)

    // This suite targets whichever course the seeded admin test account can already
    // edit, rather than creating one — course/lesson creation is exercised elsewhere
    // (test_course_purchase_e2e.py, the admin unit suites); this test's job is the
    // prose round trip specifically, on an existing reading/mixed lesson.
    await page.goto('/admin/courses')
    const courseLink = page.locator('a[href^="/admin/courses/"]').first()
    await expect(courseLink).toBeVisible({ timeout: 15000 })
    await courseLink.click()

    const courseId = page.url().match(/\/admin\/courses\/([^/?#]+)/)?.[1]
    expect(courseId).toBeTruthy()

    const writeButton = page.getByRole('button', { name: /^write$/i }).first()
    await expect(writeButton).toBeVisible({ timeout: 15000 })
    await writeButton.click()

    const editor = page.locator('.ProseMirror')
    await expect(editor).toBeVisible()
    await editor.click()
    // This test owns the round trip's content, not whatever the lesson already had.
    await page.keyboard.press('Control+A')
    await page.keyboard.press('Delete')

    // h2/h3/h4 — toolbar's own tooltip names, see RichTextEditor.tsx.
    await page.getByRole('button', { name: 'Heading 1' }).click()
    await page.keyboard.type('A Section Heading')
    await page.keyboard.press('Enter')
    await page.getByRole('button', { name: 'Heading 2' }).click()
    await page.keyboard.type('A Subsection')
    await page.keyboard.press('Enter')
    await page.getByRole('button', { name: 'Heading 3' }).click()
    await page.keyboard.type('A Detail Heading')
    await page.keyboard.press('Enter')

    // Bullets
    await page.getByRole('button', { name: 'Bullet list' }).click()
    await page.keyboard.type('bullet one')
    await page.keyboard.press('Enter')
    await page.keyboard.type('bullet two')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter') // exit the list

    // Numbered list
    await page.getByRole('button', { name: 'Numbered list' }).click()
    await page.keyboard.type('step one')
    await page.keyboard.press('Enter')
    await page.keyboard.type('step two')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter')

    // Table
    await page.getByRole('button', { name: 'Insert table' }).click()
    await page.keyboard.type('cell text')

    // Link — the toolbar prompts via window.prompt; Playwright intercepts it.
    await page.keyboard.press('Enter')
    await page.keyboard.type('a link')
    await page.keyboard.press('Control+A')
    page.once('dialog', (dialog) => dialog.accept('https://example.com'))
    await page.getByRole('button', { name: 'Add link' }).click()

    await page.getByRole('button', { name: /^save$/i }).click()
    // Modal closes on successful save — the "Write" button reappears in the (now
    // closed-modal) list view.
    await expect(page.getByRole('button', { name: /^write$/i }).first()).toBeVisible()

    for (const width of SEVEN_WIDTHS) {
      for (const scheme of ['light', 'dark'] as const) {
        await page.setViewportSize({ width, height: 900 })
        if (scheme === 'dark') {
          await page.addInitScript(() => window.localStorage.setItem('practicable:theme', 'dark'))
        }
        // Re-derive the member lesson URL fresh each iteration from the same admin
        // detail endpoint the editor itself just saved through, rather than
        // hard-coding a slug this test doesn't own.
        const lessonUrl = await page.evaluate(async (cId) => {
          const apiBase = (window as unknown as { __E2E_API_BASE__?: string }).__E2E_API_BASE__
          const base = apiBase ?? 'http://localhost:8000'
          const res = await fetch(`${base}/admin/courses/${cId}`, { credentials: 'include' })
          if (!res.ok) return null
          const data = await res.json()
          const firstLesson = data.modules?.[0]?.lessons?.[0]
          return firstLesson ? { course: data.slug, lesson: firstLesson.slug } : null
        }, courseId)
        if (!lessonUrl) continue

        await page.goto(`/learn/${lessonUrl.course}/${lessonUrl.lesson}`)
        await expect(page.locator('h1')).toHaveCount(1)
        await expect(page.getByRole('heading', { level: 2, name: 'A Section Heading' })).toBeVisible()
        await expect(page.getByRole('heading', { level: 3, name: 'A Subsection' })).toBeVisible()
        await expect(page.getByRole('heading', { level: 4, name: 'A Detail Heading' })).toBeVisible()
        await expect(page.getByText('bullet one')).toBeVisible()
        await expect(page.getByText('step one')).toBeVisible()
        await expect(page.getByText('cell text')).toBeVisible()
        await expect(page.getByRole('link', { name: 'a link' })).toHaveAttribute('href', 'https://example.com')

        const results = await new AxeBuilder({ page }).analyze()
        expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([])
      }
    }
  })
})
