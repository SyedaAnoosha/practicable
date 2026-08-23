// The Saved page (W5-R5) — the browse half of bookmarks.
//
// Bookmarks shipped with a working API, a working toggle button, and nothing that let
// a learner see what they had saved. Saving was a write-only gesture. These tests run
// the page against responses shaped like the real endpoint, because the previous
// bookmarks defects all survived a green suite by living between "the API is right"
// and "a person can use this".
//
// The link targets are asserted per type on purpose: the three routes genuinely differ
// (`/courses/:slug`, `/templates/:templateId`, `/store/packs/:slug`) and the uniform
// `/{type}/{slug}` shape that looks obvious is wrong for two of the three.
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'

import { Saved } from '../Saved'
import { api } from '@/lib/api/client'

vi.mock('@/lib/api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}))

const mockGet = vi.mocked(api.get)
const mockDelete = vi.mocked(api.delete)

// Shaped exactly like GET /me/bookmarks, including the resolved title/slug/available
// fields the list endpoint adds.
const BOOKMARKS = [
  {
    id: 'b1',
    content_type: 'course',
    content_id: 'c1',
    created_at: '2026-08-23T10:00:00Z',
    title: 'Deciding in the Dark',
    slug: 'deciding-in-the-dark',
    available: true,
  },
  {
    id: 'b2',
    content_type: 'template',
    content_id: 't1',
    created_at: '2026-08-22T10:00:00Z',
    title: 'Risk Register',
    slug: 'risk-register',
    available: true,
  },
  {
    id: 'b3',
    content_type: 'pack',
    content_id: 'p1',
    created_at: '2026-08-21T10:00:00Z',
    title: 'Operational Risk Pack',
    slug: 'operational-risk',
    available: true,
  },
]

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Saved />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Saved', () => {
  it('lists every saved item', async () => {
    mockGet.mockResolvedValue({ data: BOOKMARKS } as never)
    renderPage()

    expect(await screen.findByText('Deciding in the Dark')).toBeInTheDocument()
    expect(screen.getByText('Risk Register')).toBeInTheDocument()
    expect(screen.getByText('Operational Risk Pack')).toBeInTheDocument()
  })

  it('links each type to its own real route', async () => {
    mockGet.mockResolvedValue({ data: BOOKMARKS } as never)
    renderPage()

    // Course: by slug.
    expect(await screen.findByRole('link', { name: 'Deciding in the Dark' })).toHaveAttribute(
      'href',
      '/courses/deciding-in-the-dark',
    )
    // Template: by ID, not slug — the route reads `:templateId`.
    expect(screen.getByRole('link', { name: 'Risk Register' })).toHaveAttribute(
      'href',
      '/templates/t1',
    )
    // Pack: under the store.
    expect(screen.getByRole('link', { name: 'Operational Risk Pack' })).toHaveAttribute(
      'href',
      '/store/packs/operational-risk',
    )
  })

  it('groups by type with a heading and a count', async () => {
    mockGet.mockResolvedValue({ data: BOOKMARKS } as never)
    renderPage()

    const courses = await screen.findByRole('region', { name: /course/i })
    expect(within(courses).getByText('Deciding in the Dark')).toBeInTheDocument()
  })

  it('shows an unavailable item as text rather than a link that would 404', async () => {
    // An item deleted or unpublished after it was saved. Keeping the row visible is
    // deliberate: dropping it would make things vanish with no explanation.
    mockGet.mockResolvedValue({
      data: [
        {
          id: 'b9',
          content_type: 'course',
          content_id: 'gone',
          created_at: '2026-08-23T10:00:00Z',
          title: null,
          slug: null,
          available: false,
        },
      ],
    } as never)
    renderPage()

    expect(await screen.findByText(/no longer available/i)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /no longer available/i })).not.toBeInTheDocument()
  })

  it('offers an empty state that says how to put something here', async () => {
    mockGet.mockResolvedValue({ data: [] } as never)
    renderPage()

    expect(await screen.findByText(/nothing saved yet/i)).toBeInTheDocument()
    // An empty state that only says "nothing here" is a dead end.
    expect(screen.getByRole('link', { name: /browse courses/i })).toHaveAttribute('href', '/courses')
  })

  it('removes an item', async () => {
    mockGet.mockResolvedValue({ data: BOOKMARKS } as never)
    mockDelete.mockResolvedValue({ data: null } as never)
    const user = userEvent.setup()
    renderPage()

    await user.click(
      await screen.findByRole('button', { name: /remove deciding in the dark from saved items/i }),
    )
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('/me/bookmarks/b1'))
  })

  it('names the item in each Remove button', async () => {
    // In a list of Remove buttons, "Remove" alone tells a screen-reader user nothing
    // about which row they are on.
    mockGet.mockResolvedValue({ data: BOOKMARKS } as never)
    renderPage()

    expect(
      await screen.findByRole('button', { name: /remove risk register from saved items/i }),
    ).toBeInTheDocument()
  })

  it('announces how many items are saved', async () => {
    mockGet.mockResolvedValue({ data: BOOKMARKS } as never)
    renderPage()

    // Waits for the list before querying: the loading skeleton is itself a
    // `role="status"`, so an immediate lookup matches "Loading…" instead.
    await screen.findByText('Deciding in the Dark')
    expect(screen.getByRole('status')).toHaveTextContent('3 saved items')
  })

  it('says so when the list fails to load rather than showing an empty page', async () => {
    // An error rendered as "nothing saved" would tell the learner their items are gone.
    mockGet.mockRejectedValue(new Error('network'))
    renderPage()

    expect(await screen.findByText(/couldn't load your saved items/i)).toBeInTheDocument()
  })
})
