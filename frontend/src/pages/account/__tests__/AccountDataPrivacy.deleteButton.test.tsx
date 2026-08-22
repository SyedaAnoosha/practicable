/**
 * Phase 10 (§10F re-verification, 2026-08-22): "no Delete Account button hard-deletes
 * anything" — the DoD's own required test. A UI *absence* claim can't be proven by
 * mounting the component (there's nothing to assert away), so this follows this
 * project's own established precedent for that shape of claim (AdminLayout.nav.test.tsx,
 * createProductButton.removed.test.tsx): read the real source and grep for it.
 * Paired with the backend half in test_account_selfserve.py
 * (test_no_hard_delete_path_exists_anywhere_for_a_user_account), which proves the user
 * row survives POST /me/account/close end-to-end.
 */
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(__dirname, relativePath), 'utf-8')
}

describe('No hard-delete control exists on the account page', () => {
  it('AccountDataPrivacy.tsx has no "Delete Account" (or similar hard-delete) button text', () => {
    const content = readSource('../AccountDataPrivacy.tsx')
    expect(content).not.toMatch(/>\s*Delete\s+(my\s+)?[Aa]ccount\s*</)
    expect(content).not.toMatch(/>\s*Delete\s+permanently\s*</i)
  })

  it('the only account-closure action calls the deactivation endpoint, never a delete route', () => {
    const content = readSource('../AccountDataPrivacy.tsx')
    expect(content).toContain('/me/account/close')
    expect(content).not.toMatch(/api\.delete\(/)
  })

  it('the closure copy itself describes deactivation, not deletion', () => {
    const content = readSource('../AccountDataPrivacy.tsx')
    expect(content).toMatch(/closed/i)
    expect(content).not.toMatch(/permanently delet/i)
  })
})
