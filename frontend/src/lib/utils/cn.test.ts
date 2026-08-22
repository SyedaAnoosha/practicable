// `cn()` silently deleted every custom font-size utility that appeared alongside a
// text colour, because tailwind-merge classified unknown `text-*` rungs as colours.
// The visible symptom was the question page's serif headline — the product's stated
// credibility anchor — rendering at the inherited 16px instead of 56px.
//
// Nothing caught it: the CSS was correct, tsc was clean, eslint was clean, and the
// source read as intended. Only the computed `className` in a browser showed it.
// These tests are the standing guard, one per rung, because a rung missing from the
// registration does not error — it just stops applying.
import { describe, expect, it } from 'vitest'
import { cn } from './cn'

const RUNGS = ['display', 'outline', 'h1', 'h2', 'h3', 'h4', 'stat', 'lead', 'read', 'body', 'sm', 'xs']

describe('cn — custom font-size rungs survive alongside a colour', () => {
  for (const rung of RUNGS) {
    it(`keeps text-${rung} when a text colour is also applied`, () => {
      const out = cn(`text-${rung}`, 'text-foreground')
      expect(out).toContain(`text-${rung}`)
      expect(out).toContain('text-foreground')
    })
  }

  it('keeps the size when the colour is written first', () => {
    // Order must not decide which one survives — the original bug dropped whichever
    // came first, so both orderings are pinned.
    expect(cn('text-foreground', 'text-h1')).toContain('text-h1')
    expect(cn('text-h1', 'text-foreground')).toContain('text-h1')
  })

  it('reproduces the exact PageTitle string that regressed', () => {
    const out = cn('text-balance text-h1 text-foreground outline-none', 'font-serif font-medium')
    expect(out).toContain('text-h1')
    expect(out).toContain('font-serif')
  })

  it('still deduplicates two real font sizes, keeping the last', () => {
    // The registration must not disable conflict resolution — that is what `cn` is for.
    expect(cn('text-sm', 'text-lead')).toBe('text-lead')
    expect(cn('text-h1', 'text-h2')).toBe('text-h2')
  })

  it('still deduplicates two real text colours, keeping the last', () => {
    expect(cn('text-foreground', 'text-muted-foreground')).toBe('text-muted-foreground')
  })

  it('does not treat an unrelated text-* utility as a size', () => {
    // `text-balance` is text-wrap, `text-center` is alignment — neither should be
    // dropped by, or drop, a size or a colour.
    const out = cn('text-balance text-center text-h2 text-primary')
    for (const c of ['text-balance', 'text-center', 'text-h2', 'text-primary']) {
      expect(out).toContain(c)
    }
  })
})
