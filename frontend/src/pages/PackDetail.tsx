import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { Download, FileText, Info } from 'lucide-react'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { track } from '@/lib/analytics'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import { PageTitle } from '@/components/ui/PageTitle'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EvidencePanel } from '@/components/product/EvidencePanel'
import type { Preview } from '@/components/product/PreviewGallery'

interface PackQuestion {
  slug: string
  title: string
  tier: string | null
  effort: string | null
}

interface PackDetail {
  slug: string
  name: string
  description: string
  domain_name: string | null
  question_count: number
  price_amount: number
  currency: string
  owned: boolean
  template_id: string | null
  file_name: string | null
  file_size_bytes: number | null
  honesty_notice: string
  questions: PackQuestion[]
  licence?: string
  search_title?: string
  version?: string
  last_reviewed_at?: string
  is_bundle?: boolean
  page_count?: number
  sheet_count?: number
  is_editable?: boolean
  has_macros?: boolean
  min_office_version?: string
  previews?: Preview[]
  format?: string
}

interface DownloadUrlResponse {
  download_url: string
  file_name: string
  file_size_bytes: number
}

type DownloadStatus = 'idle' | 'preparing' | 'downloaded' | 'error' | 'not-entitled'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** The domain-pack product page (week2_plan.md W2-R6, §20.6).
 *
 * The load-bearing decision on this page is the honesty notice, and it is deliberately
 * the FIRST thing under the title rather than a footnote. §20.6 and the risk watchlist
 * both name "a domain pack that sells something already free" as the fastest possible
 * way to lose buyer trust — so the page says the questions are free, lists every one of
 * them, and links each to its free page. Hiding the list while claiming openness would
 * be the same dishonesty in a quieter voice.
 *
 * The notice text comes from the API (`honesty_notice`), not from a string here, so it
 * cannot drift from the PDF cover, which makes the same promise. */
export function PackDetail() {
  const { slug } = useParams<{ slug: string }>()
  const [status, setStatus] = useState<DownloadStatus>('idle')

  const { data: pack, isLoading } = useQuery({
    queryKey: queryKeys.packs.detail(slug ?? ''),
    queryFn: () => api.get<PackDetail>(`/packs/${slug}`).then((r) => r.data),
    enabled: !!slug,
  })

  useEffect(() => {
    if (pack) track('content_viewed', { type: 'pack', slug: pack.slug })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pack?.slug])

  // Same contract as Template.tsx: fetch the presigned URL on click, use it
  // immediately, discard it. Never rendered as a visible href — a 60-second URL
  // sitting in the DOM is a link a backgrounded tab will hit after it expired.
  const handleDownload = async () => {
    if (!pack?.template_id) return
    setStatus('preparing')
    try {
      const { data } = await api.get<DownloadUrlResponse>(`/templates/${pack.template_id}/download-url`)
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
      if (isAxiosError(err) && (err.response?.status === 403 || err.response?.status === 401)) {
        setStatus('not-entitled')
      } else {
        setStatus('error')
      }
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-label="Loading pack">
        <div className="size-8 animate-spin rounded-full border-2 border-border border-t-primary" />
        <span className="sr-only">Loading pack…</span>
      </div>
    )
  }

  if (!pack) {
    return (
      <div className="mx-auto w-full max-w-2xl px-5 py-11 text-center sm:px-8">
        <h1 className="text-h2 font-semibold text-foreground">That pack doesn’t exist</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          It may not be on sale yet. The questions are free to read either way.
        </p>
        <Link to="/questions" className="mt-6 inline-block">
          <Button variant="outline">Browse the questions</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 lg:px-12">
      <PageTitle eyebrow="Reference pack" title={pack.name} description={pack.description} />

      {/* §20.6's honesty notice — above the price, above the fold, never fine print. */}
      <div className="mt-8 flex gap-4 rounded-lg border border-border bg-secondary/40 p-5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent/12 text-accent" aria-hidden="true">
          <Info className="size-[18px]" />
        </span>
        <div>
          <p className="text-sm font-medium text-foreground">What you’re buying, plainly</p>
          <p className="mt-1 max-w-[68ch] text-sm text-muted-foreground">{pack.honesty_notice}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_20rem]">
        {/* ── What's inside ──────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-h3 font-semibold text-foreground">What’s inside</h2>
          <p className="mt-2 max-w-[68ch] text-sm text-muted-foreground">
            All {pack.question_count} questions, in the pack’s working order: foundations before
            ambition, regulator-exposed before not, cheap before expensive. Every title below links
            to its free page.
          </p>

          <ol className="mt-6 divide-y divide-border rounded-lg border border-border">
            {pack.questions.map((q, i) => (
              <li key={q.slug} className="flex items-baseline gap-4 px-4 py-3">
                <span className="w-6 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/questions/${q.slug}`}
                    className="text-sm font-medium text-foreground underline-offset-2 hover:underline"
                  >
                    {q.title}
                  </Link>
                  {(q.tier || q.effort) && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {[q.tier, q.effort].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* ── Buy / download ─────────────────────────────────────────────────── */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-lg border border-border bg-card p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent/12 text-accent" aria-hidden="true">
                <FileText className="size-5" />
              </span>
              {pack.owned && <Badge variant="success">In your library</Badge>}
            </div>

            {!pack.owned && (
              <p className="mt-4 text-h2 font-semibold tabular-nums text-foreground">
                {formatCurrency(pack.price_amount, pack.currency)}
              </p>
            )}

            {pack.file_name && (
              <p className="mt-2 font-mono text-xs text-muted-foreground">
                {pack.file_name}
                {pack.file_size_bytes ? ` · ${formatBytes(pack.file_size_bytes)}` : ''}
              </p>
            )}

            <EvidencePanel
              format={pack.format}
              pageCount={pack.page_count}
              sheetCount={pack.sheet_count}
              isEditable={pack.is_editable}
              hasMacros={pack.has_macros}
              minOfficeVersion={pack.min_office_version}
              previews={pack.previews}
              licence={pack.licence}
              version={pack.version}
              lastReviewedAt={pack.last_reviewed_at}
              title={pack.name}
              className="mt-5 border-0 bg-transparent p-0"
            />

            <div className="mt-5">
              {pack.owned ? (
                <>
                  <Button onClick={handleDownload} loading={status === 'preparing'} className="w-full">
                    {status === 'idle' && (
                      <>
                        <Download className="size-4" aria-hidden="true" /> Download the PDF
                      </>
                    )}
                    {status === 'preparing' && 'Preparing…'}
                    {status === 'downloaded' && 'Downloaded ✓'}
                    {status === 'error' && 'Download again'}
                    {status === 'not-entitled' && 'Download again'}
                  </Button>
                  {status === 'error' && (
                    <p role="alert" className="mt-2 text-sm text-destructive">
                      That link expired. Press download again.
                    </p>
                  )}
                  {status === 'not-entitled' && (
                    <p role="alert" className="mt-2 text-sm text-destructive">
                      You don’t have access to this pack yet.
                    </p>
                  )}
                </>
              ) : (
                <Link to={`/buy/${pack.slug}`} className="block">
                  <Button className="w-full">Buy the pack</Button>
                </Link>
              )}
            </div>

            <p className="mt-4 border-t border-border pt-4 text-xs text-muted-foreground">
              One payment, lifetime access, including updates to this pack.
            </p>
          </div>

          <Link to="/questions" className="mt-4 block">
            <Button variant="outline" className="w-full">
              Or read them free
            </Button>
          </Link>
        </aside>
      </div>
    </div>
  )
}
