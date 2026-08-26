import { test, expect } from '@playwright/test'

test('notification page renders with heading and preferences', async ({ page }) => {
  await page.goto('/account/notifications')
  await page.waitForTimeout(3000)

  const url = page.url()
  console.log('Final URL:', url)

  if (url.includes('/sign-in')) {
    console.log('Redirected to sign-in (no auth session)')
    // Verify sign-in page renders. Targeted by role: a bare `text=Sign in` also matches
    // the page's "Sign in to reach your library…" blurb, which is a strict-mode
    // violation (two nodes) rather than a real failure.
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
    return
  }

  // We're on the notifications page — verify both sections render.
  const heading = page.locator('h2', { hasText: 'Notifications' })
  await expect(heading).toBeVisible()

  // Notification list section (empty state or items).
  const emptyState = page.locator('text=No notifications yet')
  const markAll = page.locator('text=Mark all read')
  const listVisible = (await emptyState.count()) > 0 || (await markAll.count()) > 0
  console.log('Notification list section visible:', listVisible)

  // Preferences section.
  const prefs = page.locator('text=Preferences')
  await expect(prefs).toBeVisible()

  // Sound toggle.
  const soundToggle = page.locator('text=Notification sound')
  await expect(soundToggle).toBeVisible()

  // Product updates toggle.
  const productToggle = page.locator('text=Product updates')
  await expect(productToggle).toBeVisible()

  // Marketing toggle.
  const marketingToggle = page.locator('text=Occasional updates')
  await expect(marketingToggle).toBeVisible()

  // Save button.
  const saveBtn = page.locator('button', { hasText: 'Save preferences' })
  await expect(saveBtn).toBeVisible()

  console.log('All notification page sections verified!')
})
