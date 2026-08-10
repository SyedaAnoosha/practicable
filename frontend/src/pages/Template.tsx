import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { isAxiosError } from 'axios'
import { api } from '@/lib/api/client'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'

interface DownloadUrlResponse {
  download_url: string
  file_name: string
  file_size_bytes: number
}

type DownloadStatus = 'idle' | 'preparing' | 'downloaded' | 'error' | 'not-entitled'

export function Template() {
  const { templateId } = useParams<{ templateId: string }>()
  const [status, setStatus] = useState<DownloadStatus>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  // DESIGN.md §26.4/§26.5: fetch the presigned URL on click, use it immediately,
  // discard it — never render it as a visible href. A 60-second URL sitting in the
  // DOM is a link a backgrounded tab or a "save link as" will hit after it's expired.
  const handleDownload = async () => {
    if (!templateId) return

    setStatus('preparing')
    setErrorMessage('')

    try {
      const { data } = await api.get<DownloadUrlResponse>(`/templates/${templateId}/download-url`)

      const fileResponse = await fetch(data.download_url)
      if (!fileResponse.ok) throw new Error('Download failed')

      const blob = await fileResponse.blob()
      const objectUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = data.file_name
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(objectUrl)
      document.body.removeChild(a)

      setStatus('downloaded')
      setTimeout(() => setStatus('idle'), 4000)
    } catch (err) {
      // A 403 here is "not entitled" (app/core/entitlements.py) — a real, distinct
      // outcome from a merely-expired presigned URL, and telling a non-buyer their
      // "link expired" is actively misleading about what they need to do next.
      if (isAxiosError(err) && err.response?.status === 403) {
        setStatus('not-entitled')
      } else {
        setStatus('error')
        setErrorMessage('That link expired. Press download again.')
      }
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-8">
      <Card>
        <CardHeader>
          <CardTitle>Template download</CardTitle>
          <CardDescription>Download the template file to your device.</CardDescription>
        </CardHeader>
        <CardContent>
          {status !== 'not-entitled' && (
            <Button onClick={handleDownload} loading={status === 'preparing'} className="w-full">
              {status === 'idle' && 'Download'}
              {status === 'preparing' && 'Preparing…'}
              {status === 'downloaded' && 'Downloaded ✓'}
              {status === 'error' && 'Download again'}
            </Button>
          )}
          {errorMessage && (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {errorMessage}
            </p>
          )}
          {status === 'not-entitled' && (
            <p role="alert" className="text-sm text-foreground">
              This template is part of a product you don't have yet.{' '}
              <Link to="/" className="underline">
                Find it from the related question
              </Link>{' '}
              to buy it.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
