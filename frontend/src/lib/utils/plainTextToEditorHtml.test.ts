// Found live 2026-08-21: the admin "Write" modal handed Tiptap a raw plain-text lesson
// body as `content` — Tiptap expects HTML, so every paragraph break collapsed into a
// single wall-of-text block (seen directly in the admin UI: a multi-paragraph lesson
// with numbered lists rendered as one unbroken run-on paragraph). This is the fix.
import { describe, expect, it } from 'vitest'
import { plainTextToEditorHtml } from './plainTextToEditorHtml'

describe('plainTextToEditorHtml', () => {
  it('wraps a single paragraph in <p>', () => {
    expect(plainTextToEditorHtml('Hello world.')).toBe('<p>Hello world.</p>')
  })

  it('splits blank-line-separated text into separate <p> tags — the actual bug', () => {
    const input = 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.'
    expect(plainTextToEditorHtml(input)).toBe(
      '<p>First paragraph.</p><p>Second paragraph.</p><p>Third paragraph.</p>',
    )
  })

  it('a single newline within a paragraph becomes a <br>, not a new paragraph', () => {
    const input = 'Line one\nLine two'
    expect(plainTextToEditorHtml(input)).toBe('<p>Line one<br>Line two</p>')
  })

  it('escapes HTML special characters instead of reinterpreting them as tags', () => {
    // week4_plan.md §8E step 2's own rule for the migration itself — "no backfill
    // reinterprets old text as HTML, an existing body containing a < would silently
    // change meaning" — applied here to the editor's load path too.
    const input = 'Risk < Reward & the "as low as reasonably practicable" test'
    const result = plainTextToEditorHtml(input)
    expect(result).toContain('&lt;')
    expect(result).toContain('&amp;')
    expect(result).not.toContain('<Reward')
  })

  it('empty string produces empty output, not an empty <p>', () => {
    expect(plainTextToEditorHtml('')).toBe('')
  })

  it('collapses multiple consecutive blank lines to one paragraph break, not empty paragraphs', () => {
    const input = 'One.\n\n\n\nTwo.'
    expect(plainTextToEditorHtml(input)).toBe('<p>One.</p><p>Two.</p>')
  })

  it('trims leading and trailing whitespace from each paragraph', () => {
    const input = '  Padded paragraph.  \n\n  Another.  '
    expect(plainTextToEditorHtml(input)).toBe('<p>Padded paragraph.</p><p>Another.</p>')
  })
})
