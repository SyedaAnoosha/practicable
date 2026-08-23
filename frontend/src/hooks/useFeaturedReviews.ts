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
