import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'

interface ActivePromotion {
  code: string
  message: string
  percent_off: number
  ends_at: string | null
  /** True when Stripe will only honour this code on the buyer's first order. */
  first_time_transaction: boolean
}

/**
 * Fetch the one active promotion for the banner. Public, unauthenticated.
 *
 * `staleTime: 5 * 60 * 1000` — a banner does not need second-level freshness,
 * and this keeps the request off every navigation.
 */
export function useActivePromotion() {
  return useQuery<ActivePromotion | null>({
    queryKey: queryKeys.promotions.active(),
    queryFn: async () => {
      try {
        const { data } = await api.get<ActivePromotion>('/promotions/active')
        return data
      } catch {
        // On error, return null — the banner renders nothing.
        // A failing promotions endpoint must not break the page layout.
        return null
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}
