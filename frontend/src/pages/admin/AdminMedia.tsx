import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Loader2, Video } from 'lucide-react'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { PageTitle } from '@/components/ui/PageTitle'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'
import { TokenizedVideoPreview } from '@/components/admin/TokenizedVideoPreview'

// The third TokenizedVideoPreview placement — "the lesson editor,
// the block editor, and the media library." Every uploaded video in one place,
// including ones attached via the legacy paste-a-playback-id flow, which is exactly
// where a still-encoding or Mux-lost asset is most likely to surface.

interface MediaLibraryRow {
  id: string
  mux_asset_id: string | null
  mux_playback_id: string | null
  status: string
  duration_seconds: number | null
  lesson_id: string
  lesson_title: string
  lesson_slug: string
  created_at: string
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function formatDuration(seconds: number | null): string | null {
  if (!seconds) return null
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

const STATUS_VARIANTS: Record<string, 'success' | 'warning' | 'destructive' | 'muted'> = {
  ready: 'success',
  uploading: 'warning',
  error: 'destructive',
}

export function AdminMedia() {
  const { data: rows, isLoading } = useQuery({
    queryKey: queryKeys.admin.media(),
    queryFn: () => api.get<MediaLibraryRow[]>('/admin/media').then((r) => r.data),
  })

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6">
      <PageTitle
        eyebrow="Admin"
        title="Media"
        description="Every video uploaded through the admin panel, wherever it's attached."
      />

      {isLoading ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading media…
        </p>
      ) : (
        <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {rows?.map((m) => (
            <li key={m.id} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
              <TokenizedVideoPreview playbackId={m.mux_playback_id} assetId={m.mux_asset_id} />
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={STATUS_VARIANTS[m.status] ?? 'muted'}>{m.status}</Badge>
                {formatDuration(m.duration_seconds) && (
                  <span className="text-xs text-muted-foreground">{formatDuration(m.duration_seconds)}</span>
                )}
              </div>
              <Link
                to={`/admin/courses`}
                className="truncate text-sm font-medium text-foreground hover:underline"
                title={m.lesson_title}
              >
                {m.lesson_title}
              </Link>
              <span className="text-xs text-muted-foreground">Uploaded {formatDate(m.created_at)}</span>
            </li>
          ))}
        </ul>
      )}

      {rows?.length === 0 && (
        <EmptyState
          className="mt-8"
          icon={Video}
          title="No media uploaded yet."
          description="Videos attached to a lesson or block appear here."
        />
      )}
    </div>
  )
}
