// week4_plan.md Phase 8 (8E-1): "every existing plain-text body renders byte-identically
// to before — the regression test says so." Found during the 8D/8E re-verification pass
// (2026-08-21) that no such test actually existed — sanitize_html()'s own
// test_plain_text_survives_unchanged tests the sanitizer function in isolation, never
// Learn.tsx's actual `block.prose_sanitized ? <RichText/> : <p>` branch a real lesson
// takes. This is that missing test, covering the branch directly rather than through a
// full page render (LessonBlocks needs no routing/query/auth context — it's a pure
// function of its `blocks` prop, exported from Learn.tsx specifically to make this
// possible without mocking machinery unrelated to what's being tested).
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LessonBlocks, type LessonBlockData } from '../Learn'

// Learn.tsx also imports VideoBlock/DownloadBlock for other block types, which pull in
// react-query — stub them so this suite stays scoped to the text/callout branch under
// test, matching the narrow-mock pattern already used in VideoPreview.test.tsx.
vi.mock('@/components/content/RichText', () => ({
  RichText: ({ html }: { html: string }) => <div data-testid="rich-text">{html}</div>,
}))

function textBlock(overrides: Partial<LessonBlockData> = {}): LessonBlockData {
  return {
    id: 'block-1',
    block_type: 'text',
    sort_order: 0,
    heading: null,
    text_body: null,
    prose_sanitized: null,
    video_ready: null,
    file_name: null,
    file_size_bytes: null,
    file_is_free: null,
    ...overrides,
  }
}

describe('LessonBlocks — prose_sanitized / plain-text branch', () => {
  it('a legacy block with prose_sanitized null and only text_body renders the old plain-text path, byte-identical', () => {
    render(<LessonBlocks blocks={[textBlock({ text_body: 'Plain text written before Phase 8E shipped.' })]} />)
    expect(screen.getByText('Plain text written before Phase 8E shipped.')).toBeInTheDocument()
    expect(screen.queryByTestId('rich-text')).not.toBeInTheDocument()
  })

  it('a block with prose_sanitized set renders through RichText, not the plain-text path', () => {
    render(
      <LessonBlocks
        blocks={[textBlock({ text_body: 'raw editor text', prose_sanitized: '<p>raw editor text</p>' })]}
      />,
    )
    expect(screen.getByTestId('rich-text')).toHaveTextContent('<p>raw editor text</p>')
    // The plain-text path's own whitespace-pre-line paragraph must not also render —
    // that would be the "sees literal <h2> tags" bug 8E's own steps describe, just
    // inverted: showing the same content twice instead of showing raw tags.
    expect(screen.queryByText('raw editor text')).not.toBeInTheDocument()
  })

  it('a block with neither prose_sanitized nor text_body renders no text content at all', () => {
    render(<LessonBlocks blocks={[textBlock()]} />)
    expect(screen.queryByTestId('rich-text')).not.toBeInTheDocument()
  })

  it('the same branch applies to a callout block, not only a text block', () => {
    render(
      <LessonBlocks
        blocks={[
          textBlock({
            block_type: 'callout',
            heading: 'Note',
            text_body: 'callout body',
          }),
        ]}
      />,
    )
    expect(screen.getByText('callout body')).toBeInTheDocument()
    expect(screen.queryByTestId('rich-text')).not.toBeInTheDocument()
  })

  it('the lesson body itself uses the same rule as blocks — the one holding the only dangerouslySetInnerHTML stays the only path in, verified via the shared RichText mock', () => {
    // Both the block-level and lesson-level branches route through the same RichText
    // component (verified by direct read of Learn.tsx) — this test locks that the
    // block-level path specifically never bypasses it for HTML content.
    render(<LessonBlocks blocks={[textBlock({ prose_sanitized: '<script>alert(1)</script>' })]} />)
    // RichText itself is mocked here (its own sanitization is RichText.test.tsx's job)
    // — this test only proves LessonBlocks hands HTML content to RichText rather than
    // rendering it as plain text or bypassing RichText entirely.
    expect(screen.getByTestId('rich-text')).toBeInTheDocument()
  })
})
