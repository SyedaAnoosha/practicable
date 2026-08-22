/**
 * W4-R4 item 6 (ledger row 29) and W4-R4 acceptance 2, on the client side.
 *
 * Two properties that are easy to break silently and impossible to notice by looking:
 *
 *  1. **Both routes to the product record the click.** Each panel renders the product
 *     name as a link AND a "View" button pointing at the same place. A reader who taps
 *     the name followed the same recommendation as one who taps the button; wiring only
 *     the button would undercount by however many people prefer the title.
 *  2. **The question titles are links, not `<strong>`.** W4-R4's acceptance says "by
 *     title, as a link", and the link is what makes the explanation checkable — a reader
 *     who doubts the recommendation can open the question and judge for themselves.
 *     Both panels rendered inert `<strong>` before 2026-08-22.
 *
 * The event contract is fire-and-forget, so the assertions are about what was SENT.
 * Nothing here should ever assert that a failed post surfaces to the reader — the
 * opposite is the requirement.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RoutedProducts } from '../RoutedProducts'
import { SituationProducts } from '../SituationProducts'
import { api } from '@/lib/api/client'

vi.mock('@/lib/api/client', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}))

const PRODUCT = {
  slug: 'risk-register-fundamentals',
  name: 'Risk Register Fundamentals',
  price_amount: 4900,
  currency: 'AUD',
}

function renderWithProviders(ui: React.ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.mocked(api.get).mockResolvedValue({ data: [PRODUCT] } as never)
  vi.mocked(api.post).mockResolvedValue({ data: { ok: true } } as never)
  vi.clearAllMocks()
  vi.mocked(api.get).mockResolvedValue({ data: [PRODUCT] } as never)
  vi.mocked(api.post).mockResolvedValue({ data: { ok: true } } as never)
})

describe('RoutedProducts — the question surface', () => {
  it('records the click with the source question when the product NAME is followed', async () => {
    renderWithProviders(
      <RoutedProducts questionSlug="how-do-i-start-a-risk-register" questionTitle="How do I start a risk register?" />,
    )

    await userEvent.click(await screen.findByRole('link', { name: PRODUCT.name }))

    expect(api.post).toHaveBeenCalledWith('/recommendation-events', {
      surface: 'question',
      product_slug: PRODUCT.slug,
      question_slug: 'how-do-i-start-a-risk-register',
    })
  })

  it('records the click when the View BUTTON is followed', async () => {
    renderWithProviders(
      <RoutedProducts questionSlug="how-do-i-start-a-risk-register" questionTitle="How do I start a risk register?" />,
    )

    await userEvent.click(await screen.findByRole('button', { name: /view/i }))

    expect(api.post).toHaveBeenCalledWith(
      '/recommendation-events',
      expect.objectContaining({ surface: 'question', product_slug: PRODUCT.slug }),
    )
  })

  it('renders the source question as a link to the question, not as inert text', async () => {
    renderWithProviders(
      <RoutedProducts questionSlug="how-do-i-start-a-risk-register" questionTitle="How do I start a risk register?" />,
    )

    const link = await screen.findByRole('link', { name: 'How do I start a risk register?' })
    expect(link).toHaveAttribute('href', '/questions/how-do-i-start-a-risk-register')
  })

  it('renders nothing at all when the join produces no products (never "no recommendations yet")', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] } as never)
    const { container } = renderWithProviders(
      <RoutedProducts questionSlug="orphan-question" questionTitle="An orphan question" />,
    )

    await vi.waitFor(() => expect(container.textContent).not.toMatch(/loading/i))
    expect(container.textContent).not.toMatch(/no recommendation/i)
    expect(screen.queryByRole('link', { name: PRODUCT.name })).not.toBeInTheDocument()
  })
})

describe('SituationProducts — the catalogue surface', () => {
  const QUESTIONS = [
    { slug: 'controls-owned-by-people-who-left', title: 'Controls owned by people who left' },
    { slug: 'risk-committee-drift', title: 'Risk committee meetings drift off agenda' },
  ]

  it('records the click with NO question slug — it routes from a filter set, not one question', async () => {
    renderWithProviders(<SituationProducts questionIds={['id-1', 'id-2']} questions={QUESTIONS} />)

    await userEvent.click(await screen.findByRole('link', { name: PRODUCT.name }))

    expect(api.post).toHaveBeenCalledWith('/recommendation-events', {
      surface: 'catalogue',
      product_slug: PRODUCT.slug,
    })
  })

  it('renders every named question as a link, so the explanation is checkable', async () => {
    renderWithProviders(<SituationProducts questionIds={['id-1', 'id-2']} questions={QUESTIONS} />)

    for (const q of QUESTIONS) {
      const link = await screen.findByRole('link', { name: q.title })
      expect(link).toHaveAttribute('href', `/questions/${q.slug}`)
    }
  })
})
