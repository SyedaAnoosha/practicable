import { useAdminPlaybackToken } from '@/hooks/useAdminPlaybackToken'
import { VideoPreview } from './VideoPreview'

/**
 * VideoPreview that automatically fetches the admin playback token and the asset's
 * live Mux encoding state.
 *
 * The raw VideoPreview accepts the token/state as props, but every admin call site
 * would need to independently fetch them. This wrapper fetches from
 * /admin/media/playback-token and passes everything through, so the three admin
 * placements (lesson editor, block editor, media library) all get the same four
 * distinct failure states without repeating the fetch logic.
 */
export function TokenizedVideoPreview({
  playbackId,
  assetId,
  className,
}: {
  playbackId: string | null | undefined
  assetId?: string | null | undefined
  className?: string
}) {
  const { token, state, message, isLoading, isError } = useAdminPlaybackToken(playbackId, assetId)

  return (
    <VideoPreview
      playbackId={playbackId ?? undefined}
      playbackToken={token}
      className={className}
      state={state}
      message={message}
      tokenLoading={isLoading}
      tokenError={isError}
      noPlaybackId={!playbackId}
    />
  )
}
