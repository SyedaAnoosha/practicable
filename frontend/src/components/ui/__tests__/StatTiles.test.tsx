// StatTiles gained countUp. The risk the tests cover is that an animation wrapper
// silently changes what the tile SAYS — a stat tile that shows 0, NaN, or a value the
// API never returned is a fabricated fact on the page a paying member trusts.
import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatTiles } from '../StatTiles'

function stubReducedMotion(matches: boolean) {
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    matches, media: '', addEventListener: () => {}, removeEventListener: () => {},
  })))
}

describe('StatTiles', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('renders nothing when there are no stats, rather than an empty row', () => {
    const { container } = render(<StatTiles stats={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the real value under reduced motion, with no count', () => {
    stubReducedMotion(true)
    render(<StatTiles stats={[{ value: 100, label: 'Questions live' }]} />)
    expect(screen.getByText('100')).toBeInTheDocument()
  })

  it('never coerces a string value into a number', () => {
    // "Free" must render as "Free", not NaN and not 0.
    stubReducedMotion(true)
    render(<StatTiles stats={[{ value: 'Free', label: 'Price' }]} />)
    expect(screen.getByText('Free')).toBeInTheDocument()
    expect(screen.queryByText('NaN')).not.toBeInTheDocument()
  })

  it('keeps the figure in a dd and the label in a dt, so the pair stays a definition', () => {
    stubReducedMotion(true)
    const { container } = render(<StatTiles stats={[{ value: 7, label: 'Courses owned' }]} />)
    expect(container.querySelector('dd')?.textContent).toBe('7')
    expect(container.querySelector('dt')?.textContent).toBe('Courses owned')
  })

  it('sets figures tabular so counting digits do not shift the label', () => {
    stubReducedMotion(true)
    const { container } = render(<StatTiles stats={[{ value: 12, label: 'x' }]} />)
    expect(container.querySelector('dd')?.className).toMatch(/tabular-nums/)
  })
})
