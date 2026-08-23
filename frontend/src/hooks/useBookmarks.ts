/**
 * W5-R5: Bookmarks hook — add, remove, and list bookmarks.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api/client'

export type BookmarkContentType = 'course' | 'template' | 'pack'

export interface Bookmark {
  id: string
  content_type: string
  content_id: string
  created_at: string
  /** Resolved by the list endpoint. Absent on the create/delete responses, and null
   * when the saved item no longer exists — see `available`. */
  title?: string | null
  slug?: string | null
  /** False when the item was deleted or unpublished after it was saved. The bookmark
   * is still listed (dropping it would make things vanish unexplained) but must not
   * be rendered as a link. */
  available?: boolean
}

export function useBookmarks() {
  return useQuery<Bookmark[]>({
    queryKey: ['me', 'bookmarks'],
    queryFn: () => api.get<Bookmark[]>('/me/bookmarks').then((r) => r.data),
  })
}

export function useAddBookmark() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ contentType, contentId }: { contentType: string; contentId: string }) =>
      api.post<Bookmark>('/me/bookmarks', { content_type: contentType, content_id: contentId }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me', 'bookmarks'] })
    },
  })
}

export function useRemoveBookmark() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (bookmarkId: string) =>
      api.delete(`/me/bookmarks/${bookmarkId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me', 'bookmarks'] })
    },
  })
}

/** Where a saved item lives, by type.
 *
 * The three routes genuinely differ, and guessing a uniform `/{type}/{slug}` shape
 * gets two of the three wrong: templates are addressed by **id** (`/templates/:templateId`,
 * see `TemplatesCatalogue`), and packs live under the store (`/store/packs/:slug`).
 * Only courses take the plain slug. Verified against `App.tsx` and how each catalogue
 * builds its own links, so the Saved page cannot drift from them.
 *
 * Kept beside the hook so any future surface reuses these rather than re-deriving them.
 */
export function bookmarkHref(bookmark: Bookmark): string | null {
  switch (bookmark.content_type) {
    case 'course':
      return bookmark.slug ? `/courses/${bookmark.slug}` : null
    case 'template':
      // By id, not slug — the template route reads `:templateId`.
      return `/templates/${bookmark.content_id}`
    case 'pack':
      return bookmark.slug ? `/store/packs/${bookmark.slug}` : null
    default:
      return null
  }
}

export const BOOKMARK_TYPE_LABELS: Record<string, string> = {
  course: 'Course',
  template: 'Template',
  pack: 'Pack',
}
