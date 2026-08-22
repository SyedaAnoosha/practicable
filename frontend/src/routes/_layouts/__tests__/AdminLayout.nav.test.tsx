/**
 * Phase 9A DoD: No `/admin/products` nav entry in AdminLayout.
 *
 * week4_plan.md §9A step 4: "Delete `/admin/products` from `App.tsx`, the
 * `AdminProducts` import, and the `ADMIN_NAV` entry in `AdminLayout.tsx`.
 * Keep `admin/products.py` and its router registration — the editors call it."
 */
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('AdminLayout nav — no /admin/products', () => {
  it('AdminLayout.tsx has no /admin/products nav entry', () => {
    const filePath = path.resolve(__dirname, '../AdminLayout.tsx')
    const content = fs.readFileSync(filePath, 'utf-8')

    // The literal string /admin/products should not appear in a nav item
    expect(content).not.toMatch(/to:\s*['"]\/admin\/products['"]/)
  })

  it('App.tsx has no /admin/products route', () => {
    const appPath = path.resolve(__dirname, '../../../App.tsx')
    const content = fs.readFileSync(appPath, 'utf-8')

    // The literal string /admin/products should not appear as a route
    expect(content).not.toMatch(/path:\s*['"]\/admin\/products['"]/)
  })

  it('App.tsx does not import AdminProducts', () => {
    const appPath = path.resolve(__dirname, '../../../App.tsx')
    const content = fs.readFileSync(appPath, 'utf-8')

    // AdminProducts should not be imported (removed from UI, API kept)
    expect(content).not.toMatch(/import.*AdminProducts/)
  })
})
