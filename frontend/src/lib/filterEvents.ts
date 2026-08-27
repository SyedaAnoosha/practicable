/**
 * Client-side filter event recording.
 *
 * Called from QuestionsCatalogue.tsx where filter_applied already fires.
 * Failure is silent and never blocks a filter tap.
 * The call is debounced so dragging through five values records the one
 * the reader settled on, not five.
 */
import { api } from '@/lib/api/client'

interface FilterEventPayload {
  domain?: string
  effort?: string
  duration?: string
  cost?: string
  roi_horizon?: string
  regulator_pressure?: string
  tier?: string[]
  leadership_traits?: string[]
  query_text?: string
  result_count?: number
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null
const DEBOUNCE_MS = 500

/**
 * Record a filter event. Debounced — rapid successive calls collapse into one.
 * Fire-and-forget: never throws, never blocks.
 */
export function recordFilterEvent(payload: FilterEventPayload): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }

  debounceTimer = setTimeout(() => {
    api.post('/filter-events', payload).catch(() => {
      // Wrap and swallow — the contract is fire-and-forget, never blocks a filter tap.
    })
  }, DEBOUNCE_MS)
}
