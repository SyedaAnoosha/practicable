// TrustStrip is the FintechX device with its fabricated "4.9/5" removed. The absence
// rule is the whole point of the component, so it is what gets tested: a strip that
// can render "0 questions" from an unresolved query is the exact failure principle 7
// exists to prevent, and it would look like a deliberate claim.
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Search, Layers } from 'lucide-react'
import { TrustStrip } from '../TrustStrip'

describe('TrustStrip', () => {
  it('renders the facts it is given', () => {
    render(<TrustStrip facts={[{ icon: Search, value: 100, label: 'real questions' }]} />)
    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.getByText(/real questions/)).toBeInTheDocument()
  })

  it('drops a fact whose value is null, rather than showing a zero or a dash', () => {
    render(
      <TrustStrip
        facts={[
          { icon: Search, value: null, label: 'real questions' },
          { icon: Layers, value: 5, label: 'areas of risk' },
        ]}
      />,
    )
    expect(screen.queryByText(/real questions/)).not.toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('drops undefined and empty-string values too', () => {
    render(
      <TrustStrip
        facts={[
          { icon: Search, value: undefined, label: 'unresolved' },
          { icon: Layers, value: '', label: 'blank' },
          { icon: Layers, value: 7, label: 'real' },
        ]}
      />,
    )
    expect(screen.queryByText('unresolved')).not.toBeInTheDocument()
    expect(screen.queryByText('blank')).not.toBeInTheDocument()
    expect(screen.getByText(/real/)).toBeInTheDocument()
  })

  it('renders nothing at all when every fact is absent, not an empty rail', () => {
    const { container } = render(
      <TrustStrip facts={[{ icon: Search, value: null, label: 'a' }, { icon: Layers, value: null, label: 'b' }]} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('does render a real zero when zero is the actual answer', () => {
    // 0 is a fact; null is an absence. Conflating them would hide true empty states.
    render(<TrustStrip facts={[{ icon: Search, value: 0, label: 'templates yet' }]} />)
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('sets numbers in tabular mono so a live-updating count does not jitter', () => {
    render(<TrustStrip facts={[{ icon: Search, value: 100, label: 'questions' }]} />)
    expect(screen.getByText('100').className).toMatch(/tabular-nums/)
    expect(screen.getByText('100').className).toMatch(/font-mono/)
  })
})
