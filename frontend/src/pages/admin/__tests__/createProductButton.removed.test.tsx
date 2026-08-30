/**
 * Owner instruction: "remove this Create product button from everywhere. prices must
 * be setteble while creating a course or template or product. This Create Product
 * button is completely unnecessary."
 *
 * Structural assertion, same pattern as AdminLayout.nav.test.tsx (this project's own
 * precedent for "X must not appear" claims that are cheaper and more reliable to
 * prove by reading the source than by mounting CourseBuilder/the templates list,
 * both of which need substantial query/router scaffolding for a claim this direct).
 *
 * Checks the visible button label is gone from both editors, while the underlying
 * `/create-product` API route itself is untouched — that endpoint still exists and
 * is still called, just transparently from the price control now, never as its own
 * labeled action a click could land on.
 */
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(__dirname, relativePath), 'utf-8')
}

describe('"Create Product" button removed from admin editors', () => {
  it('AdminCourses.tsx has no visible "Create Product" button text', () => {
    const content = readSource('../AdminCourses.tsx')
    expect(content).not.toMatch(/>\s*Create Product\s*</)
  })

  it('AdminTemplates.tsx has no visible "Create Product" button text', () => {
    const content = readSource('../AdminTemplates.tsx')
    expect(content).not.toMatch(/>\s*Create Product\s*</)
  })

  it('the create-product API route itself is still called by both editors — only the labeled button is gone', () => {
    // The endpoint is not deleted; it's called transparently by the price control's
    // "Set price" action the first time a course/template has no product yet.
    expect(readSource('../AdminCourses.tsx')).toContain('/create-product')
    expect(readSource('../AdminTemplates.tsx')).toContain('/create-product')
  })
})
