import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

/**
 * week4_plan.md Phase 6B step 13 — real admin sign-in for the axe/responsive sweep of
 * /admin/metrics, mirroring gating.spec.ts's established pattern exactly: a real
 * Supabase test account gated on env vars, never seeded automatically (that would write
 * a live row to the owner's real project unattended, which this suite deliberately does
 * not do). Callers must call `test.skip(!hasAdminE2ECreds, adminE2ESkipReason)` inside
 * each test body (not at describe scope — see gating.spec.ts's own comment on why a
 * describe-level skip silently swallows sibling tests).
 */
export const hasAdminE2ECreds = Boolean(process.env.E2E_ADMIN_EMAIL && process.env.E2E_ADMIN_PASSWORD)

export const adminE2ESkipReason =
  'needs a real Supabase admin test account (E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD) — ' +
  'not created automatically, since that would write a live row to the real project. ' +
  'See gating.spec.ts for the same pattern used for the non-admin test account.'

export async function signInAsAdmin(page: Page): Promise<void> {
  await page.goto('/sign-in')
  await page.getByLabel(/email/i).fill(process.env.E2E_ADMIN_EMAIL!)
  await page.getByLabel(/password/i).fill(process.env.E2E_ADMIN_PASSWORD!)
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL(/\/dashboard/)
}
