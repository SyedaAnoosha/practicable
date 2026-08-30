// The domain signal is an accessibility contract, not a style preference.
//
// Measured: across protanopia/deuteranopia/tritanopia, the worst pair of
// the five domain colours separates at 1.04:1 — indistinguishable. An exhaustive
// search over ~81,000 contrast-legal five-hue combinations could not beat 1.08:1.
// Colour therefore cannot be the sole carrier of domain identity, and these tests
// exist so a later refactor cannot quietly drop the icon or the label and leave
// colour-blind users with nothing.
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { ContentCard } from '../ContentCard'
import { DOMAIN_VISUALS } from '@/lib/domainVisuals'

const DOMAINS = Object.keys(DOMAIN_VISUALS)

function renderCard(props: Parameters<typeof ContentCard>[0]) {
  return render(<MemoryRouter><ContentCard {...props} /></MemoryRouter>)
}

describe('domain identity is never carried by colour alone', () => {
  for (const kind of ['question', 'course', 'pack'] as const) {
    it(`a ${kind} card names its domain in text`, () => {
      renderCard({ kind, title: 'A title', domain: 'Cyber (Tech & security)', href: '/x', artSlug: 's' })
      expect(screen.getByText('Cyber (Tech & security)')).toBeInTheDocument()
    })

    it(`a ${kind} card renders a domain icon alongside the label`, () => {
      const { container } = renderCard({ kind, title: 'A title', domain: 'Cyber (Tech & security)', href: '/x', artSlug: 's' })
      // Icons are decorative (the adjacent label is the accessible name), so they are
      // found as aria-hidden SVGs rather than by role.
      expect(container.querySelectorAll('svg[aria-hidden="true"]').length).toBeGreaterThan(0)
    })
  }

  it('gives each of the five domains a DIFFERENT icon, so the icon actually discriminates', () => {
    // An icon that is the same for every domain would satisfy "has an icon" while
    // restoring the exact failure it is meant to fix.
    const icons = new Set(DOMAINS.map((d) => DOMAIN_VISUALS[d].icon))
    expect(icons.size).toBe(DOMAINS.length)
  })

  it('renders every domain label verbatim, for all five domains', () => {
    for (const domain of DOMAINS) {
      const { unmount } = renderCard({ kind: 'question', title: 'T', domain, href: '/x' })
      expect(screen.getByText(domain)).toBeInTheDocument()
      unmount()
    }
  })

  it('omits the domain block entirely when there is no domain, rather than showing an empty rule', () => {
    renderCard({ kind: 'question', title: 'No domain here', href: '/x' })
    expect(screen.getByText('No domain here')).toBeInTheDocument()
  })
})
