/**
 * week4_plan.md Phase 8 "8E-continued" (`[OWNER INSTRUCTION 2026-08-21]`) — the
 * lesson-body and block-text/callout "Write" editors moved from a centred modal to a
 * full-screen route. This covers the route's own contract, which the old modal never
 * needed a test for (it was inline JSX inside AdminCourses.tsx, not independently
 * reachable by URL): the right lesson/block loads from the cached course query, Save
 * calls the same PUT the old modal called and then navigates back to
 * `/admin/courses?open={courseId}`, and Cancel navigates back without saving.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LessonBodyWriteScreen, BlockTextWriteScreen } from '../LessonWriteScreen'
import { api } from '@/lib/api/client'

vi.mock('@/lib/api/client', () => ({
  api: {
    get: vi.fn(),
    put: vi.fn(),
  },
}))

const mockCourse = {
  id: 'course-1',
  slug: 'course-1',
  title: 'Test Course',
  description: 'desc',
  published: false,
  publish_state: 'draft',
  modules: [
    {
      id: 'module-1',
      title: 'Module 1',
      sort_order: 0,
      lessons: [
        {
          id: 'lesson-1',
          slug: 'lesson-1',
          title: 'A Reading Lesson',
          lesson_type: 'reading',
          body: 'Plain legacy body.',
          prose_sanitized: null,
          sort_order: 0,
          published: false,
          publish_state: 'draft',
          is_ready: true,
          blocks: [],
        },
        {
          id: 'lesson-2',
          slug: 'lesson-2',
          title: 'A Mixed Lesson',
          lesson_type: 'mixed',
          sort_order: 1,
          published: false,
          publish_state: 'draft',
          is_ready: true,
          blocks: [
            {
              id: 'block-1',
              block_type: 'text',
              sort_order: 0,
              heading: 'Existing heading',
              text_body: 'legacy text',
              prose_sanitized: '<p>Already formatted.</p>',
            },
          ],
        },
      ],
    },
  ],
  readiness: 'ready',
  readiness_message: '',
  product_id: null,
  price_amount: null,
  currency: null,
}

function renderLessonWrite(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/admin/courses/:courseId/lessons/:lessonId/write" element={<LessonBodyWriteScreen />} />
          <Route path="/admin/courses/:courseId/blocks/:blockId/write" element={<BlockTextWriteScreen />} />
          <Route path="/admin/courses" element={<p>Course editor page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('LessonWriteScreen', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockResolvedValue({ data: mockCourse })
    vi.mocked(api.put).mockResolvedValue({ data: mockCourse })
  })

  it('loads the correct lesson by id and shows its title', async () => {
    renderLessonWrite('/admin/courses/course-1/lessons/lesson-1/write')
    expect(await screen.findByRole('heading', { name: 'A Reading Lesson' })).toBeInTheDocument()
  })

  it('Back navigates to /admin/courses?open={courseId} without saving', async () => {
    const user = userEvent.setup()
    renderLessonWrite('/admin/courses/course-1/lessons/lesson-1/write')
    await screen.findByRole('heading', { name: 'A Reading Lesson' })

    await user.click(screen.getByRole('button', { name: 'Back to course editor' }))

    expect(await screen.findByText('Course editor page')).toBeInTheDocument()
    expect(api.put).not.toHaveBeenCalled()
  })

  it('Cancel navigates back without saving', async () => {
    const user = userEvent.setup()
    renderLessonWrite('/admin/courses/course-1/lessons/lesson-1/write')
    await screen.findByRole('heading', { name: 'A Reading Lesson' })

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(await screen.findByText('Course editor page')).toBeInTheDocument()
    expect(api.put).not.toHaveBeenCalled()
  })

  it('Save calls PUT /admin/lessons/{id} and then navigates back', async () => {
    const user = userEvent.setup()
    renderLessonWrite('/admin/courses/course-1/lessons/lesson-1/write')
    await screen.findByRole('heading', { name: 'A Reading Lesson' })

    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith('/admin/lessons/lesson-1', expect.objectContaining({
        title: 'A Reading Lesson',
        lesson_type: 'reading',
      }))
    })
    expect(await screen.findByText('Course editor page')).toBeInTheDocument()
  })

  it('block mode loads the block heading field pre-filled from the existing block', async () => {
    renderLessonWrite('/admin/courses/course-1/blocks/block-1/write')
    await screen.findByRole('heading', { name: 'A Mixed Lesson' })
    expect(screen.getByLabelText('Heading (optional)')).toHaveValue('Existing heading')
  })

  it('block Save calls PUT /admin/lesson-blocks/{id}', async () => {
    const user = userEvent.setup()
    renderLessonWrite('/admin/courses/course-1/blocks/block-1/write')
    await screen.findByRole('heading', { name: 'A Mixed Lesson' })

    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith('/admin/lesson-blocks/block-1', expect.objectContaining({
        block_type: 'text',
        heading: 'Existing heading',
      }))
    })
  })

  it('shows a not-found message and a way back when the lesson id does not exist in the course', async () => {
    renderLessonWrite('/admin/courses/course-1/lessons/does-not-exist/write')
    expect(await screen.findByText('This lesson no longer exists in this course.')).toBeInTheDocument()
  })
})
