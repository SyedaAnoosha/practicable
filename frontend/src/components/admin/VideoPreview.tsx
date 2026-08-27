import { useState, useEffect, type ComponentType } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { PlaybackState } from '@/hooks/useAdminPlaybackToken'

type MuxPlayerProps = {
  playbackId?: string
  playbackToken?: string
  autoPlay?: boolean
}

// Failure text says which failure it is — no token, asset not ready, asset id unknown
// to Mux, player script failed to load. Four distinct messages, not one generic
// "Failed to load video player" covering all of them.
const STATE_MESSAGES: Record<Exclude<PlaybackState, 'ready'>, string> = {
  encoding: 'Video is still encoding — Mux takes a few minutes after upload.',
  asset_error: "Mux couldn't encode this video. Try re-uploading it.",
  asset_unknown: "Mux doesn't recognize this video. It may have been deleted there.",
}

interface VideoPreviewProps {
  playbackId?: string
  playbackToken?: string
  className?: string
  /** The live state from useAdminPlaybackToken, when known. */
  state?: PlaybackState
  message?: string
  /** True while the token/state request is still in flight. */
  tokenLoading?: boolean
  /** True if the token/state request itself failed (distinct from a bad state). */
  tokenError?: boolean
  /** True when no playback id exists at all yet — "no token" is a category error
   * ("there is nothing to preview"), not a Mux-side failure. */
  noPlaybackId?: boolean
}

export function VideoPreview({
  playbackId,
  playbackToken,
  className,
  state,
  message,
  tokenLoading,
  tokenError,
  noPlaybackId,
}: VideoPreviewProps) {
  const [MuxPlayer, setMuxPlayer] = useState<ComponentType<MuxPlayerProps> | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [playerLoadFailed, setPlayerLoadFailed] = useState(false)

  // Dynamically import Mux player
  useEffect(() => {
    import('@mux/mux-player-react')
      .then((mod) => {
        setMuxPlayer(() => mod.default as ComponentType<MuxPlayerProps>)
        setIsLoading(false)
      })
      .catch(() => {
        setPlayerLoadFailed(true)
        setIsLoading(false)
      })
  }, [])

  const errorBox = (text: string) => (
    <div className={cn('aspect-video rounded-lg bg-muted flex items-center justify-center p-4', className)}>
      <p className="text-center text-sm text-muted-foreground">{text}</p>
    </div>
  )

  const spinnerBox = () => (
    <div className={cn('aspect-video rounded-lg bg-muted flex items-center justify-center', className)}>
      <div className="text-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground mx-auto mb-2" />
        {state === 'encoding' && <p className="text-sm text-muted-foreground">{STATE_MESSAGES.encoding}</p>}
      </div>
    </div>
  )

  // Failure mode 1: no playback id at all — nothing to preview.
  if (noPlaybackId) {
    return errorBox('No video attached yet.')
  }

  // Failure mode 2: the token/status request itself failed (network, 5xx, admin
  // session issue) — distinct from a state the request successfully determined.
  if (tokenError) {
    return errorBox('Could not check this video with Mux. Try reloading the page.')
  }

  // Failure modes 3-4: the request succeeded and told us the asset isn't playable.
  if (state === 'encoding') return spinnerBox()
  if (state === 'asset_error') return errorBox(STATE_MESSAGES.asset_error)
  if (state === 'asset_unknown') return errorBox(STATE_MESSAGES.asset_unknown)

  // Failure mode 5: the player script itself failed to load (CDN down, ad blocker).
  if (playerLoadFailed) {
    return errorBox('The video player failed to load. Check your connection and reload.')
  }

  if (isLoading || !MuxPlayer || tokenLoading) {
    return (
      <div className={cn('aspect-video rounded-lg bg-muted flex items-center justify-center', className)}>
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // A signed asset with no token yet (still fetching, or fetch simply hasn't run) —
  // Mux would refuse to play it silently; say so instead of handing Mux a bad request.
  if (playbackId && !playbackToken) {
    return errorBox('No playback token yet for this video.')
  }

  return (
    <div className={cn('aspect-video overflow-hidden rounded-lg bg-black', className)}>
      <MuxPlayer playbackId={playbackId} playbackToken={playbackToken} autoPlay={false} />
      {message && state !== 'ready' && (
        <p className="mt-1 text-xs text-muted-foreground">{message}</p>
      )}
    </div>
  )
}
