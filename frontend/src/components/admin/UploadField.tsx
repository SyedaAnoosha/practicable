import { useCallback, useEffect, useRef, useState } from 'react'
import { CircleCheck, Loader2, UploadCloud } from 'lucide-react'
import { api } from '@/lib/api/client'
import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui/Button'

/** week3_plan.md §20.4 — one component, two configurations, so a second upload widget
 * (and a second upload bug) never has to happen. `kind` picks which admin endpoints it
 * talks to and which finished-state fields it hands back; everything else — the drop
 * zone, the progress bar, the honest `Uploading -> Processing -> Ready` states — is
 * shared.
 *
 * Video's `Processing` step exists because Mux hasn't finished encoding when the PUT
 * completes; a template's `Processing` step is skipped entirely — Storage has the
 * bytes the moment the PUT resolves, so `finalize()` for that kind is a single
 * confirm call, not a poll loop.
 */
export type UploadResult =
  | { kind: 'template'; storageKey: string; fileName: string }
  | { kind: 'video'; muxAssetId: string; muxPlaybackId: string; durationSeconds: number | null }

interface UploadFieldProps {
  kind: 'template' | 'video'
  /** Template: the template row the file attaches to. Video: unused — the caller
   * attaches the finished asset to a lesson itself, since a video upload can start
   * before a lesson decision is finalised. */
  templateId?: string
  accept: string
  acceptedTypesText: string
  maxSizeBytes?: number
  existingFileLabel?: string
  onComplete: (result: UploadResult) => void
}

type Phase = 'idle' | 'uploading' | 'processing' | 'ready' | 'error'

const POLL_INTERVAL_MS = 5000
const POLL_TIMEOUT_MS = 10 * 60 * 1000 // Mux encoding genuinely can take minutes.

export function UploadField({
  kind, templateId, accept, acceptedTypesText, maxSizeBytes, existingFileLabel, onComplete,
}: UploadFieldProps) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState(0)
  const [fileName, setFileName] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const cancelled = useRef(false)

  useEffect(() => () => {
    cancelled.current = true
  }, [])

  const putWithProgress = useCallback((url: string, file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('PUT', url)
      // Storage's presigned URL binds Content-Type into its signature (§ storage_client.py
      // generate_presigned_upload_url) — Mux's direct-upload URL doesn't care, and
      // setting an arbitrary one there is harmless.
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100))
      }
      xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)))
      xhr.onerror = () => reject(new Error('Upload failed — check your connection and try again.'))
      xhr.send(file)
    })
  }, [])

  const pollMedia = useCallback(async (uploadId: string): Promise<void> => {
    const startedAt = Date.now()
    for (;;) {
      if (cancelled.current) return
      const { data } = await api.get<{
        status: string
        mux_asset_id: string | null
        mux_playback_id: string | null
        duration_seconds: number | null
        error_message: string | null
      }>(`/admin/media/${uploadId}`)

      if (data.status === 'ready' && data.mux_asset_id && data.mux_playback_id) {
        setPhase('ready')
        onComplete({
          kind: 'video',
          muxAssetId: data.mux_asset_id,
          muxPlaybackId: data.mux_playback_id,
          durationSeconds: data.duration_seconds,
        })
        return
      }
      if (data.status === 'error') {
        setPhase('error')
        setErrorMessage(data.error_message || 'Mux could not process this video.')
        return
      }
      setPhase(data.status === 'processing' ? 'processing' : 'uploading')
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        setPhase('error')
        setErrorMessage("This is taking longer than expected. It's still processing on Mux's side — check back shortly.")
        return
      }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
    }
  }, [onComplete])

  const handleFile = useCallback(
    async (file: File) => {
      if (maxSizeBytes && file.size > maxSizeBytes) {
        setPhase('error')
        setErrorMessage(`That file is ${(file.size / (1024 * 1024)).toFixed(0)}MB. The ceiling is ${(maxSizeBytes / (1024 * 1024)).toFixed(0)}MB.`)
        return
      }
      setFileName(file.name)
      setProgress(0)
      setErrorMessage('')
      setPhase('uploading')

      try {
        if (kind === 'template') {
          if (!templateId) throw new Error('No template selected.')
          const { data: target } = await api.post<{ upload_url: string; storage_key: string }>(
            `/admin/templates/${templateId}/upload-url`,
            { file_name: file.name, content_type: file.type || 'application/octet-stream', file_size_bytes: file.size },
          )
          await putWithProgress(target.upload_url, file)
          await api.post(`/admin/templates/${templateId}/upload-url/confirm`, {
            storage_key: target.storage_key,
            file_name: file.name,
          })
          setPhase('ready')
          onComplete({ kind: 'template', storageKey: target.storage_key, fileName: file.name })
        } else {
          const { data: target } = await api.post<{ upload_id: string; upload_url: string }>('/admin/media/upload-url')
          await putWithProgress(target.upload_url, file)
          setPhase('processing')
          await pollMedia(target.upload_id)
        }
      } catch (err) {
        if (cancelled.current) return
        setPhase('error')
        const message = (err as { response?: { data?: { detail?: { error?: { message?: string } } | string } } })?.response
          ?.data?.detail
        const readable = typeof message === 'object' ? message?.error?.message : typeof message === 'string' ? message : undefined
        setErrorMessage(readable ?? (err instanceof Error ? err.message : 'Something went wrong. Please try again.'))
      }
    },
    [kind, templateId, maxSizeBytes, putWithProgress, pollMedia, onComplete],
  )

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) void handleFile(file)
  }

  if (phase === 'ready') {
    return (
      <div className="flex items-center gap-2 rounded-md border border-success/30 bg-success/5 p-3 text-sm">
        <CircleCheck className="size-4 shrink-0 text-success" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-foreground">{fileName || existingFileLabel}</span>
        <Button size="sm" variant="outline" onClick={() => { setPhase('idle'); inputRef.current?.click() }}>
          Replace
        </Button>
      </div>
    )
  }

  if (phase === 'uploading' || phase === 'processing') {
    return (
      <div className="rounded-md border border-border bg-muted/30 p-4">
        <p className="flex items-center gap-2 text-sm text-foreground">
          <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
          {phase === 'uploading' ? `Uploading ${fileName}…` : 'Mux is processing this video. This usually takes a few minutes — you can leave this page.'}
        </p>
        {phase === 'uploading' && (
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-[400ms] ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="tabular-nums text-xs text-muted-foreground">{progress}%</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <label
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          'flex cursor-pointer flex-col items-center gap-2 rounded-md border-2 border-dashed border-border p-8 text-center transition-colors duration-150',
          dragOver && 'border-border-strong bg-muted',
          phase === 'error' && 'border-destructive',
        )}
      >
        <UploadCloud className="size-6 text-muted-foreground" aria-hidden="true" />
        <span className="text-sm font-medium text-foreground">Drop a file, or choose one</span>
        <span className="text-xs text-muted-foreground">{acceptedTypesText}</span>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) void handleFile(file)
          }}
        />
      </label>
      {phase === 'error' && (
        <div className="mt-2 flex items-center justify-between gap-2 rounded-md bg-destructive/10 px-3 py-2">
          <p role="alert" className="text-sm text-destructive">{errorMessage}</p>
          <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
            Try again
          </Button>
        </div>
      )}
    </div>
  )
}
