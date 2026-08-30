/**
 * Render test for ProductsMenu: menu items must be `<a href>` elements — the
 * regression that would otherwise ship silently.
 *
 * Every item must be a real anchor — cmd-click, middle-click and "copy link address"
 * must all still work. This matters because it is exactly what a hand-rolled
 * menu breaks.
 *
 * This suite previously claimed this suite asserted <a href> elements when it never
 * actually opened the menu — found and fixed. `userEvent.click` genuinely
 * cannot open the menu in jsdom (confirmed directly): its click sequence fires its own
 * `mousedown` first, which the outside-click listener (`mousedown` on `document`) sees
 * and closes the menu on, before the `click` handler that would open it ever runs.
 * `fireEvent.click` fires only the `click` event and sidesteps that race — used below
 * for exactly the open-state assertions the suite claimed already existed.
 */
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { ProductsMenu } from '../ProductsMenu'

function renderMenu() {
  return render(
    <MemoryRouter>
      <ProductsMenu />
    </MemoryRouter>,
  )
}

describe('ProductsMenu', () => {
  it('renders a trigger button labelled "Products"', () => {
    renderMenu()
    expect(screen.getByRole('button', { name: /products/i })).toBeInTheDocument()
  })

  it('trigger has aria-expanded and aria-controls', () => {
    renderMenu()
    const trigger = screen.getByRole('button', { name: /products/i })
    expect(trigger).toHaveAttribute('aria-expanded')
    expect(trigger).toHaveAttribute('aria-controls', 'products-menu')
  })

  it('does not use role="menu" or role="menuitem"', () => {
    renderMenu()
    // These ARIA roles would strip link affordances — the component must NOT use them
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument()
  })

  it('component exports and renders without error', () => {
    // Verify the component is importable and renders
    const { container } = renderMenu()
    expect(container.firstChild).toBeTruthy()
  })

  it('menu is closed by default — no links in the document until opened', () => {
    renderMenu()
    expect(screen.queryAllByRole('link')).toHaveLength(0)
  })

  it('clicking the trigger opens the menu with five real <a href> items, in order', () => {
    renderMenu()
    fireEvent.click(screen.getByRole('button', { name: /products/i }))
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(5)
    expect(links.map((l) => l.getAttribute('href'))).toEqual([
      '/questions',
      '/courses',
      '/templates',
      '/packs',
      '/store',
    ])
    // Every item is a genuine anchor with a real href — cmd-click, middle-click and
    // "copy link address" all depend on this, which role="menuitem" would strip.
    links.forEach((link) => expect(link.tagName).toBe('A'))
  })

  it('Questions is first and is labelled free to read', () => {
    renderMenu()
    fireEvent.click(screen.getByRole('button', { name: /products/i }))
    const links = screen.getAllByRole('link')
    expect(links[0]).toHaveAttribute('href', '/questions')
    expect(links[0]).toHaveTextContent(/free to read/i)
  })

  it('clicking a menu item closes the menu (aria-expanded reflects it)', () => {
    renderMenu()
    const trigger = screen.getByRole('button', { name: /products/i })
    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(screen.getAllByRole('link')[0])
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('Escape closes the menu and returns focus to the trigger', () => {
    renderMenu()
    const trigger = screen.getByRole('button', { name: /products/i })
    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).toHaveFocus()
  })
})
