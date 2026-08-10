import { useEffect, useState, type ComponentType } from 'react'
import { useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'

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
}

export function Lesson() {
  const { lessonId } = useParams<{ lessonId: string }>()
  const [MuxPlayer, setMuxPlayer] = useState<ComponentType<MuxPlayerProps> | null>(null)

  const { data: playbackToken, isLoading, error } = useQuery({
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

  if (error) {
    return (
      <div className="mx-auto w-full max-w-3xl px-5 py-12 text-center sm:px-8">
        <p className="text-foreground">This lesson is part of a course you don't have yet.</p>
      </div>
    )
  }

  if (isLoading || !playbackToken || !MuxPlayer) {
    return (
      <div className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-8">
        <div className="aspect-video animate-pulse rounded-xl bg-muted" />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-8">
      <div className="aspect-video overflow-hidden rounded-xl bg-black">
        <MuxPlayer
          playbackId={playbackToken.playback_id}
          tokens={{ playback: playbackToken.token }}
          autoPlay={false}
          defaultHiddenCaptions={false} // captions ON by default — DESIGN.md §25.2 [DECIDED]
          className="h-full w-full"
        />
      </div>
    </div>
  )
}
