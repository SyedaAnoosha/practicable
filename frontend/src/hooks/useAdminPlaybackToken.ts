import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'

// Phase 8 (8D-3/8D-5): one of the four states the admin preview must tell apart —
// "still encoding" and "Mux lost the asset" are as real as a working player, and a
// player that fails silently on either reads as broken software, not a video that
// isn't ready yet.
export type PlaybackState = 'ready' | 'encoding' | 'asset_error' | 'asset_unknown'

interface PlaybackTokenResult {
  token: string | undefined
  state: PlaybackState | undefined
  message: string | undefined
  isLoading: boolean
  isError: boolean
}

/**
 * Phase 8 (8D-2): Fetch a signed Mux playback token for admin video preview, plus the
 * asset's live encoding state (8D-3/8D-5) — `Media.status` in the database is set
 * optimistically at attach time and isn't kept in sync with Mux afterward, so only a
 * live check can answer "is this actually ready to play."
 *
 * The member-facing Learn.tsx fetches from /lessons/{id}/playback-token; the admin
 * panel uses /admin/media/playback-token with a bare playback_id (+ optional asset_id).
 */
export function useAdminPlaybackToken(
  playbackId: string | null | undefined,
  assetId: string | null | undefined,
): PlaybackTokenResult {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'playback-token', playbackId, assetId],
    queryFn: () =>
      api
        .post<{ token: string; state: PlaybackState; message: string | null }>(
          '/admin/media/playback-token',
          { playback_id: playbackId, asset_id: assetId },
        )
        .then((r) => r.data),
    enabled: !!playbackId,
    // Tokens are short-lived (30 min) but we don't need to refresh mid-preview;
    // the admin will re-mount the component if they navigate away and back. An
    // "encoding" result is intentionally not exempted from this — the admin can
    // reopen the editor to re-check, same as the upload widget's own polling model.
    staleTime: 10 * 60 * 1000,
  })
  return { token: data?.token, state: data?.state, message: data?.message ?? undefined, isLoading, isError }
}
