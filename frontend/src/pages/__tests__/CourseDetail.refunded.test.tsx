/**
 * The refunded state on course detail.
 *
 * `/library` and the dashboard already handled a refund correctly, because both read
 * through the entitlement gate and a refunded course simply stops appearing. Course
 * detail is a **public** page, so it did not: a refunded buyer opening a course they used
 * to own got the ordinary buy page back, with nothing acknowledging they had ever owned
 * it. That reads as the site having lost their purchase, which is worse than the refund.
 *
 * Three things are pinned here, and each is a way the fix could regress into being wrong:
 *
 * 1. The notice appears ONLY when access actually ended. A stranger who never bought the
 * course must learn nothing about refunds from this page.
 * 2. It never appears for someone who currently owns the course — `owned` is the state
 * being communicated there, and showing a refund notice alongside it would be alarming
 * and false.
 * 3. The treatment stays `muted`, never `destructive`. A refund
 * the buyer asked for is a completed transaction, not an error; colouring it red tells
 * them something went wrong when nothing did.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CourseDetail } from '../CourseDetail'
import { api } from '@/lib/api/client'

vi.mock('@/lib/api/client', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}))

function course(overrides: Record<string, unknown> = {}) {
  return {
    id: 'course-1',
    slug: 'risk-register-fundamentals',
    title: 'Risk Register Fundamentals',
    subtitle: null,
    description: 'A course.',
    section: 'Risk',
    author_name: 'A. Author',
    owned: false,
    lesson_count: 5,
    first_lesson_slug: 'lesson-one',
    cover_image_url: null,
    modules: [],
    related_products: [],
    access_ended_at: null,
    ...overrides,
  }
}

function renderCourse() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/courses/risk-register-fundamentals']}>
        <Routes>
          <Route path="/courses/:slug" element={<CourseDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('CourseDetail — refunded state', () => {
  it('says access ended, with the date, when a refund removed it', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: course({ owned: false, access_ended_at: '2026-08-19T04:00:00Z' }),
    } as never)

    renderCourse()

    expect(await screen.findByText(/access ended — refunded/i)).toBeInTheDocument()
    // The date is rendered in en-AU long form, so assert on the parts rather than a
    // locale-formatted string a different ICU build might punctuate differently.
    const time = document.querySelector('time[datetime="2026-08-19T04:00:00Z"]')
    expect(time).not.toBeNull()
    expect(time?.textContent).toMatch(/2026/)
  })

  it('routes the buyer to their purchases rather than leaving a dead end', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: course({ owned: false, access_ended_at: '2026-08-19T04:00:00Z' }),
    } as never)

    renderCourse()

    const link = await screen.findByRole('link', { name: /see this in your purchases/i })
    expect(link).toHaveAttribute('href', '/purchases')
  })

  it('uses muted treatment, never destructive — a refund is not an error', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: course({ owned: false, access_ended_at: '2026-08-19T04:00:00Z' }),
    } as never)

    renderCourse()

    const heading = await screen.findByText(/access ended — refunded/i)
    const notice = heading.closest('div')
    expect(notice?.className ?? '').not.toMatch(/destructive/)
  })

  it('says nothing about refunds to a reader who never bought the course', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: course({ owned: false, access_ended_at: null }),
    } as never)

    renderCourse()

    // Scoped to the heading: the title also appears in the breadcrumb, so a bare
    // text query matches twice.
    await screen.findByRole('heading', { name: 'Risk Register Fundamentals', level: 1 })
    expect(screen.queryByText(/access ended/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/refunded/i)).not.toBeInTheDocument()
  })

  it('says nothing about refunds to a reader who currently owns the course', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: course({ owned: true, access_ended_at: null }),
    } as never)

    renderCourse()

    // Scoped to the heading: the title also appears in the breadcrumb, so a bare
    // text query matches twice.
    await screen.findByRole('heading', { name: 'Risk Register Fundamentals', level: 1 })
    expect(screen.queryByText(/access ended/i)).not.toBeInTheDocument()
  })
})
