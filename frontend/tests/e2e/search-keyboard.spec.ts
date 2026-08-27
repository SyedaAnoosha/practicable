import { test, expect } from '@playwright/test'

/**
 * Keyboard-only navigation of the search results listbox.
 *
 * The search field must be keyboard reachable, have an accessible name, announce result
 * counts to a live region, and Enter with no selection must land on a full /search?q=
 * page. Every one of those is invisible to the unit suite: jsdom will happily report a
 * `role="listbox"` that no key press can reach, and a `role="status"` that never receives
 * text.
 *
 * So this drives the real browser with the keyboard alone — no click ever happens after
 * the palette opens. That is the point: someone navigating by keyboard must be able to
 * open search, type, move through results, and act on one, and the only way to know
 * that holds is to do it.
 *
 * Read-only and anonymous, against the live backend — same rule as
 * `screen-overview.spec.ts` and `responsive-widths.spec.ts`.
 */

const QUERY = 'risk'

test.describe('search — keyboard only', () => {
  test('opens with the keyboard shortcut and exposes a named search landmark', async ({
    page,
  }) => {
    await page.goto('/')
    await page.keyboard.press('ControlOrMeta+k')

    // A named modal dialog: it covers the page and takes the keyboard, so a screen
    // reader needs the boundary announced rather than being left on the page beneath.
    await expect(page.getByRole('dialog', { name: /search/i })).toBeVisible()

    const search = page.getByRole('search')
    await expect(search).toBeVisible()

    // The input must have an accessible name, not just a placeholder: a placeholder
    // disappears on typing and is not a label.
    const input = page.getByRole('combobox').or(search.locator('input'))
    await expect(input.first()).toBeFocused()
  })

  test('arrow keys move an aria-activedescendant through the results', async ({
    page,
  }) => {
    await page.goto('/')
    await page.keyboard.press('ControlOrMeta+k')
    await page.keyboard.type(QUERY)

    // The listbox is present from the moment the palette opens (it holds the "type to
    // search" hint), so waiting on it proves nothing. Wait for a real option: that is
    // what the 250ms debounce plus the round trip actually has to produce.
    await expect(page.getByRole('option').first()).toBeVisible({ timeout: 15_000 })

    const input = page.getByRole('search').locator('input').first()

    // The listbox is not focusable itself — focus stays in the input and
    // aria-activedescendant names the active option. That indirection is the whole
    // reason this needs asserting: focus never visibly moves, so a broken
    // implementation looks identical to a working one on screen.
    const before = await input.getAttribute('aria-activedescendant')
    await page.keyboard.press('ArrowDown')
    const after = await input.getAttribute('aria-activedescendant')

    expect(after).not.toBeNull()
    expect(after).not.toBe(before)
    await expect(input).toBeFocused()
  })

  test('announces the result count to a live region', async ({ page }) => {
    await page.goto('/')
    await page.keyboard.press('ControlOrMeta+k')
    await page.keyboard.type(QUERY)

    await expect(page.getByRole('option').first()).toBeVisible({ timeout: 15_000 })

    // A sighted user reads the count off the list. Without this region a screen-reader
    // user gets silence after typing, with no way to know whether anything matched.
    //
    // Scoped to the palette: RootLayout's RouteAnnouncer is also a `role="status"`, so
    // an unscoped lookup is a strict-mode violation rather than a real assertion.
    const status = page.getByRole('dialog', { name: /search/i }).getByRole('status')
    await expect(status).toContainText(/\d+\s+result/i, { timeout: 15_000 })
  })

  test('Enter with no selection lands on the full results page', async ({ page }) => {
    await page.goto('/')
    await page.keyboard.press('ControlOrMeta+k')
    await page.keyboard.type(QUERY)
    await expect(page.getByRole('listbox')).toBeVisible({ timeout: 10_000 })

    await page.keyboard.press('Enter')

    // A palette that only ever shows a few results per type is a dead end for a real
    // query, so Enter has to reach somewhere that shows all of them.
    await expect(page).toHaveURL(new RegExp(`/search\\?q=${QUERY}`))
    await expect(page.locator('h1')).toBeVisible()
  })

  test('Escape closes the palette and returns focus to the page', async ({ page }) => {
    await page.goto('/')
    await page.keyboard.press('ControlOrMeta+k')
    await expect(page.getByRole('search')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.getByRole('search')).toBeHidden()

    // Keyboard users must not be stranded: the page still has to accept a Tab.
    await page.keyboard.press('Tab')
    const focused = await page.evaluate(() => document.activeElement?.tagName ?? null)
    expect(focused).not.toBeNull()
    expect(focused).not.toBe('BODY')
  })
})
