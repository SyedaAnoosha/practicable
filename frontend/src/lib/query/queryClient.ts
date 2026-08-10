import { QueryClient } from '@tanstack/react-query'

// DESIGN.md §79. One instance, imported everywhere a query/mutation is used.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})
