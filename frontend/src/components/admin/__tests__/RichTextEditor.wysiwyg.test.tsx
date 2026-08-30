/**
 * The editor pane must be styled by the SAME class the reading page uses.
 *
 * Owner report: *"if i am selecting h2, bullets, bold nothing is shown in the
 * actual reading lesson."* The main fault was server-side (see
 * `backend/tests/test_lesson_prose_round_trip.py`), but tracing it surfaced a second,
 * quieter problem in the editor itself: the pane carried `prose prose-sm` alongside
 * `.rich-text`.
 *
 * Those two classes come from `@tailwindcss/typography`, which this project deliberately
 * does not use — its defaults would introduce a second type scale beside DESIGN.md
 * §13.1's — and which **is not installed**. They were dead classes that read, to anyone
 * maintaining this file, as though the editor rendered at a smaller size than the reading
 * page. It never did.
 *
 * This test pins the invariant that actually matters: `.rich-text` is present (so the
 * editor and the reading page share one set of styles, which is what makes the editor
 * WYSIWYG at all), and no `prose*` class has crept back in.
 */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { RichTextEditor } from '../RichTextEditor'

describe('RichTextEditor — the pane shares the reading page’s styling', () => {
  it('applies .rich-text to the editable area, so what the author sees is what the reader gets', async () => {
    const { container } = render(
      <RichTextEditor content="<h2>A heading</h2><p>Body</p>" onChange={vi.fn()} />,
    )

    const editable = await vi.waitFor(() => {
      const el = container.querySelector('.ProseMirror')
      expect(el).not.toBeNull()
      return el as HTMLElement
    })

    expect(editable.classList.contains('rich-text')).toBe(true)
  })

  it('carries no @tailwindcss/typography `prose` class — the plugin is not installed', async () => {
    const { container } = render(<RichTextEditor content="<p>x</p>" onChange={vi.fn()} />)

    const editable = await vi.waitFor(() => {
      const el = container.querySelector('.ProseMirror')
      expect(el).not.toBeNull()
      return el as HTMLElement
    })

    const proseClasses = Array.from(editable.classList).filter(
      (c) => c === 'prose' || c.startsWith('prose-'),
    )
    expect(proseClasses).toEqual([])
  })

  it('renders the content it was given, headings and all', async () => {
    const { container } = render(
      <RichTextEditor content="<h2>A heading</h2><ul><li>a bullet</li></ul>" onChange={vi.fn()} />,
    )

    await vi.waitFor(() => {
      expect(container.querySelector('.ProseMirror h2')).not.toBeNull()
      expect(container.querySelector('.ProseMirror ul li')).not.toBeNull()
    })
  })
})
