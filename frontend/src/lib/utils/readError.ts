/**
 * Extract a human-readable error message from an API error response.
 * Shared across admin pages to avoid duplicating the extraction logic.
 */
export const readError = (e: unknown): string => {
  const detail = (e as { response?: { data?: { detail?: { error?: { message?: string } } } } })?.response?.data
    ?.detail
  return detail?.error?.message ?? 'Something went wrong. Please try again.'
}
