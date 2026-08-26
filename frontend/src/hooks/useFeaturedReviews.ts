/**
 * W5-R4: Hook for fetching featured (approved, is_featured) reviews
 * for a content item. Used by content detail pages to render testimonials.
 */
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'

export interface FeaturedReview {
  id: string
  rating: number
  body: string | null
  display_name: string | null
  is_featured: boolean
  created_at: string
}

export function useFeaturedReviews(contentType: string, contentId: string | undefined) {
  return useQuery<FeaturedReview[]>({
    queryKey: ['reviews', 'featured', contentType, contentId],
    queryFn: () =>
      api
        .get<FeaturedReview[]>('/reviews/featured', {
          params: { content_type: contentType, content_id: contentId },
        })
        .then((r) => r.data),
    enabled: !!contentId,
    staleTime: 10 * 60 * 1000,
  })
}

/**
 * `[ADDED 2026-08-25, owner direction]` Featured reviews across the whole catalogue,
 * for the landing page's testimonial section.
 *
 * Separate from the hook above rather than a flag on it: that one is disabled until a
 * `contentId` arrives, which is exactly the behaviour the site-wide call must NOT have.
 */
export function useSiteFeaturedReviews(limit = 6) {
  return useQuery<FeaturedReview[]>({
    queryKey: ['reviews', 'featured', 'site', limit],
    queryFn: () =>
      api.get<FeaturedReview[]>('/reviews/featured', { params: { limit } }).then((r) => r.data),
    staleTime: 10 * 60 * 1000,
  })
}
