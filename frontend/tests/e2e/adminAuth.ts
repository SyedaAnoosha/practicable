import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

/**
 * Real admin sign-in for the axe/responsive sweep of /admin/metrics, mirroring
 * gating.spec.ts's pattern: a real Supabase test account gated on env vars, never seeded
 * automatically (that would write a live row to the owner's real project). Callers must
 * call `test.skip(!hasAdminE2ECreds, adminE2ESkipReason)` inside each test body, not at
 * describe scope — see gating.spec.ts's comment on why a describe-level skip silently
 * swallows sibling tests.
 */
export const hasAdminE2ECreds = Boolean(process.env.E2E_ADMIN_EMAIL && process.env.E2E_ADMIN_PASSWORD)

export const adminE2ESkipReason =
  'needs a real Supabase admin test account (E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD) — ' +
  'not created automatically, since that would write a live row to the real project. ' +
  'See gating.spec.ts for the same pattern used for the non-admin test account.'

export async function signInAsAdmin(page: Page): Promise<void> {
  await page.goto('/sign-in')
  // `getByRole('textbox')` rather than `getByLabel(/password/i)`: the field sits beside
  // a "Show password" toggle button, so a bare /password/i label lookup matches two
  // elements and fails as a strict-mode violation before it ever types anything.
  await page.getByRole('textbox', { name: /email/i }).fill(process.env.E2E_ADMIN_EMAIL!)
  await page.getByRole('textbox', { name: /^password$/i }).fill(process.env.E2E_ADMIN_PASSWORD!)
  await page.getByRole('button', { name: /^sign in$/i }).click()
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 })
}
