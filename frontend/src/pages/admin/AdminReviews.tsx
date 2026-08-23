/**
 * AdminReviews — moderation queue for W5-R4.
 *
 * Follows AdminContact.tsx: filter buttons, a list of items, and action
 * buttons for each review. Every moderation transition updates denormalised
 * counters in the same transaction as the state change.
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Loader2, Star, X } from 'lucide-react'
import { api } from '@/lib/api/client'
import { PageTitle } from '@/components/ui/PageTitle'
import { Badge } from '@/components/ui/Badge'

interface ReviewItem {
  id: string
  user_id: string
  content_type: string
  content_id: string
  rating: number
  body: string | null
  display_name: string | null
  state: string
  is_featured: boolean
  moderated_by: string | null
  moderated_at: string | null
  created_at: string
}

type StateFilter = 'pending' | 'approved' | 'rejected' | null

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`size-3 ${i < rating ? 'fill-gold text-gold' : 'text-muted-foreground/30'}`}
          aria-hidden="true"
        />
      ))}
      <span className="ml-1 text-xs text-muted-foreground">{rating}/5</span>
    </span>
  )
}

export function AdminReviews() {
  const queryClient = useQueryClient()
  const [stateFilter, setStateFilter] = useState<StateFilter>('pending')

  const { data: reviews, isLoading } = useQuery<ReviewItem[]>({
    queryKey: ['admin', 'reviews', stateFilter],
    queryFn: () => {
      const params = stateFilter ? `?state=${stateFilter}` : ''
      return api.get<ReviewItem[]>(`/admin/reviews${params}`).then((r) => r.data)
    },
  })

  const moderateMutation = useMutation({
    mutationFn: ({ id, state, is_featured }: { id: string; state: string; is_featured?: boolean }) =>
      api.patch(`/admin/reviews/${id}`, { state, is_featured }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'reviews'] })
    },
  })

  const handleApprove = (id: string) => {
    moderateMutation.mutate({ id, state: 'approved' })
  }

  const handleReject = (id: string) => {
    moderateMutation.mutate({ id, state: 'rejected' })
  }

  const handleFeature = (id: string, currentFeatured: boolean) => {
    moderateMutation.mutate({ id, state: 'approved', is_featured: !currentFeatured })
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6">
      <PageTitle
        eyebrow="Moderation"
        title="Reviews"
        description="Moderate buyer-submitted reviews. Approve reviews to make them visible; feature the best ones as testimonials."
      />

      <div className="mt-6 flex flex-wrap gap-2">
        {([null, 'pending', 'approved', 'rejected'] as const).map((filter) => (
          <button
            key={filter ?? 'all'}
            onClick={() => setStateFilter(filter)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              stateFilter === filter
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            }`}
          >
            {filter === null ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading reviews…
        </p>
      ) : (
        <ul className="mt-8 flex flex-col divide-y divide-border border-t border-border">
          {reviews?.map((r) => (
            <li key={r.id} className="py-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-sans font-medium text-foreground">
                      {r.display_name ?? 'Anonymous'}
                    </p>
                    <Badge
                      variant={
                        r.state === 'approved'
                          ? 'success'
                          : r.state === 'rejected'
                          ? 'destructive'
                          : 'warning'
                      }
                    >
                      {r.state}
                    </Badge>
                    {r.is_featured && <Badge variant="info">Featured</Badge>}
                    <span className="text-xs text-muted-foreground">
                      {r.content_type} · {r.content_id.slice(0, 8)}
                    </span>
                  </div>
                  <div className="mt-1">
                    <StarRating rating={r.rating} />
                  </div>
                  {r.body && (
                    <p className="mt-2 text-sm text-foreground">{r.body}</p>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    {formatDate(r.created_at)}
                    {r.moderated_by && ` · Moderated by ${r.moderated_by}`}
                  </p>
                </div>

                {/* Action buttons */}
                <div className="flex shrink-0 gap-2">
                  {r.state === 'pending' && (
                    <>
                      <button
                        onClick={() => handleApprove(r.id)}
                        disabled={moderateMutation.isPending}
                        className="inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
                      >
                        <Check className="size-3" /> Approve
                      </button>
                      <button
                        onClick={() => handleReject(r.id)}
                        disabled={moderateMutation.isPending}
                        className="inline-flex items-center gap-1 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                      >
                        <X className="size-3" /> Reject
                      </button>
                    </>
                  )}
                  {r.state === 'approved' && (
                    <button
                      onClick={() => handleFeature(r.id, r.is_featured)}
                      disabled={moderateMutation.isPending}
                      className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                        r.is_featured
                          ? 'bg-gold/20 text-gold hover:bg-gold/30'
                          : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                      }`}
                    >
                      <Star className="size-3" />
                      {r.is_featured ? 'Unfeature' : 'Feature'}
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {reviews?.length === 0 && (
        <p className="mt-8 text-sm text-muted-foreground">
          {stateFilter === 'pending'
            ? 'No pending reviews.'
            : stateFilter === 'approved'
            ? 'No approved reviews.'
            : stateFilter === 'rejected'
            ? 'No rejected reviews.'
            : 'No reviews yet.'}
        </p>
      )}
    </div>
  )
}
