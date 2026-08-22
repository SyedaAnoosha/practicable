import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react'
import { Link, useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'

interface PlaybackToken {
  playback_id: string
  token: string
}

// Mux's props are wider than we use; this local shape is enough for what's rendered.
type MuxPlayerProps = {
  playbackId: string
  tokens: { playback: string }
  autoPlay?: boolean
  defaultHiddenCaptions?: boolean
  className?: string
  ref?: React.Ref<HTMLMediaElement>
  onError?: (e: Event) => void
}

export function Lesson() {
  const { lessonId } = useParams<{ lessonId: string }>()
  const [MuxPlayer, setMuxPlayer] = useState<ComponentType<MuxPlayerProps> | null>(null)

  const playerRef = useRef<HTMLMediaElement>(null)
  const [tokenExpired, setTokenExpired] = useState(false)

  const { data: playbackToken, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.lessons.playbackToken(lessonId ?? ''),
    queryFn: () => api.get<PlaybackToken>(`/lessons/${lessonId}/playback-token`).then((res) => res.data),
    enabled: !!lessonId,
  })

  // Dynamically imported — a large dependency most sessions never need
  // (DESIGN.md §43.1), never at the app root.
  useEffect(() => {
    import('@mux/mux-player-react').then((mod) => {
      setMuxPlayer(() => mod.default as ComponentType<MuxPlayerProps>)
    })
  }, [])

  // C4: Token-expiry handler — when the mux playback token expires mid-playback,
  // detect it, preserve position, refetch token, resume.
  // Must be declared before any early return to satisfy hooks rules.
  const handleTokenError = useCallback(() => {
    const position = playerRef.current?.currentTime ?? 0
    setTokenExpired(true)
    refetch().then(() => {
      setTokenExpired(false)
      requestAnimationFrame(() => {
        if (playerRef.current) {
          playerRef.current.currentTime = position
          playerRef.current.play().catch(() => {
            // Autoplay may be blocked — user can click play manually.
          })
        }
      })
    })
  }, [refetch])

  if (error) {
    return (
      <div className="mx-auto w-full max-w-2xl px-5 py-11 sm:px-8">
        <EmptyState
          title="This lesson is part of a course you don't have yet."
          description="The standalone lesson player only serves lessons tied to a product you own."
          action={
            <Link to="/courses">
              <Button>Browse courses</Button>
            </Link>
          }
        />
      </div>
    )
  }

  if (isLoading || !playbackToken || !MuxPlayer) {
    return (
      <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8">
        <div className="aspect-video animate-pulse rounded-xl bg-muted" />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8">
      <div className="relative aspect-video overflow-hidden rounded-xl bg-black shadow-sm">
        <MuxPlayer
          ref={playerRef}
          playbackId={playbackToken.playback_id}
          tokens={{ playback: playbackToken.token }}
          autoPlay={false}
          defaultHiddenCaptions={false} // captions ON by default — DESIGN.md §25.2 [DECIDED]
          className="h-full w-full"
          onError={tokenExpired ? undefined : handleTokenError}
        />
        {tokenExpired && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-center">
            <p className="text-sm font-medium text-white">Your session timed out.</p>
            <p className="mt-1 text-xs text-white/70">Refreshing your access…</p>
          </div>
        )}
      </div>
    </div>
  )
}
