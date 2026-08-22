/**
 * Phase 9A DoD: Questions editor has no commerce controls, asserted by test.
 *
 * week4_plan.md §30A.5: "Questions carry no commerce controls. Every question is
 * free to read and always will be. A price field on a question editor would be a
 * control that must never be used, which is worse than no control."
 *
 * This test verifies the component doesn't render price, Stripe, or create-product
 * elements. It's a structural assertion — if someone adds a price field to the
 * questions editor, this test catches it.
 */
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AdminQuestions } from '../AdminQuestions'

function renderQuestions() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/admin/questions']}>
        <AdminQuestions />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('AdminQuestions — no commerce controls', () => {
  it('has no price input, Stripe field, or create-product button', () => {
    const { container } = renderQuestions()

    // Check for price-related text that would indicate commerce controls
    const allText = container.textContent?.toLowerCase() ?? ''

    // These strings should never appear in the questions editor
    expect(allText).not.toContain('price')
    expect(allText).not.toContain('stripe')
    expect(allText).not.toContain('create product')
    expect(allText).not.toContain('make purchasable')

    // No input with type="number" that could be a price field
    // (questions have sort_order as a number, but that's not a price)
    const numberInputs = container.querySelectorAll('input[type="number"]')
    for (const input of numberInputs) {
      const label = input.getAttribute('aria-label')?.toLowerCase() ?? ''
      const placeholder = input.getAttribute('placeholder')?.toLowerCase() ?? ''
      expect(label).not.toContain('price')
      expect(placeholder).not.toContain('price')
    }
  })
})
