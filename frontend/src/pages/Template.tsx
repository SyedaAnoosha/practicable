import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { Download, FileSpreadsheet, Layers, Lock, Mail, Table2 } from 'lucide-react'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { useAuthStore } from '@/stores/useAuthStore'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { PageTitle } from '@/components/ui/PageTitle'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { EvidencePanel } from '@/components/product/EvidencePanel'
import type { Preview } from '@/components/product/PreviewGallery'
import { WhyThis } from '@/components/product/WhyThis'
import { OBJECTION_BLOCK } from '@/lib/labels'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import { FactStrip, type Fact } from '@/components/ui/FactStrip'
import { TestimonialSection } from '@/components/ui/Testimonial'
import { useFeaturedReviews } from '@/hooks/useFeaturedReviews'
import { ReviewForm } from '@/components/ui/ReviewForm'

interface DownloadUrlResponse {
  download_url: string
  file_name: string
  file_size_bytes: number
}

interface TemplateDetail {
  id: string
  slug: string
  title: string
  description: string
  file_name: string
  owned: boolean
  is_free: boolean
  product: { slug: string; name: string; price_amount: number; currency: string } | null
  page_count?: number
  sheet_count?: number
  is_editable?: boolean
  has_macros?: boolean
  min_office_version?: string
  previews?: Preview[]
  version?: string
  last_reviewed_at?: string
  format?: string
}

type DownloadStatus = 'idle' | 'preparing' | 'downloaded' | 'error' | 'not-entitled'

// Historically shared with the free question's reading gate, which has since been
// removed — questions are unconditionally free to read now (no email prompt at all).
// This key lives on for the free template's own download gate, the one remaining
// place that still asks for an email before handing over a file.
const UNLOCK_STORAGE_KEY = 'practicable:email_unlocked'

function readUnlocked(): boolean {
  try {
    return window.localStorage.getItem(UNLOCK_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function FeaturedTestimonials({ contentType, contentId }: { contentType: string; contentId: string }) {
  const { data: reviews } = useFeaturedReviews(contentType, contentId)
  if (!reviews || reviews.length === 0) return null
  return <TestimonialSection reviews={reviews} />
}

export function Template() {
  const { templateId } = useParams<{ templateId: string }>()
  const [status, setStatus] = useState<DownloadStatus>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [emailGiven, setEmailGiven] = useState(readUnlocked)
  const [email, setEmail] = useState('')

  // Being signed in is stronger evidence than the lead form collects, so it satisfies
  // the gate outright.
  const signedIn = useAuthStore((s) => s.user) !== null

  const { data: template, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.templates.detail(templateId ?? ''),
    queryFn: () => api.get<TemplateDetail>(`/templates/${templateId}`).then((r) => r.data),
    enabled: !!templateId,
  })

  const leadMutation = useMutation({
    mutationFn: () => api.post('/leads', { email, source: 'free_template' }),
    onSuccess: () => {
      try {
        window.localStorage.setItem(UNLOCK_STORAGE_KEY, 'true')
      } catch {
        // Storage unavailable — still unlock this render via state.
      }
      setEmailGiven(true)
    },
  })

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
      // 403 = not entitled, 401 = not signed in. Both are "you need to do something
      // else first", and neither is an expired link — telling a non-buyer their
      // "link expired" is actively misleading about what they need to do next.
      if (isAxiosError(err) && (err.response?.status === 403 || err.response?.status === 401)) {
        setStatus('not-entitled')
      } else {
        setStatus('error')
        setErrorMessage('That link expired. Press download again.')
      }
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-label="Loading template">
        <div className="size-8 animate-spin rounded-full border-2 border-border border-t-primary" />
        <span className="sr-only">Loading template…</span>
      </div>
    )
  }

  /* `[CHANGED 2026-08-22, F3 — P0]` This was `if (!template) return null` — a failed
   * fetch rendered a literally blank page: no message, no retry, no way to tell a dead
   * link from a dropped request. A 404 keeps the honest not-found copy; everything else
   * gets a retry. */
  if (isError) {
    const notFound = isAxiosError(error) && error.response?.status === 404
    return (
      <div className="mx-auto w-full max-w-2xl px-5 py-11 sm:px-8">
        {notFound ? (
          <EmptyState
            icon={FileSpreadsheet}
            title="That template doesn’t exist"
            description="It may have been renamed or withdrawn."
            action={
              <Link to="/templates">
                <Button variant="outline">Browse the templates</Button>
              </Link>
            }
          />
        ) : (
          <ErrorState
            title="We couldn't load this template."
            description="Check your connection and try again."
            onRetry={() => void refetch()}
          />
        )}
      </div>
    )
  }

  if (!template) return null

  const unlocked = signedIn || emailGiven
  // The free template is gated only by the email capture; paid ones by entitlement.
  const canDownload = template.is_free ? unlocked : template.owned

  const downloadButton = (
    <>
      <Button onClick={handleDownload} loading={status === 'preparing'} className="w-full">
        {status === 'idle' && (
          <>
            <Download className="size-4" aria-hidden="true" /> Download
          </>
        )}
        {status === 'preparing' && 'Preparing…'}
        {status === 'downloaded' && 'Downloaded ✓'}
        {status === 'error' && 'Download again'}
      </Button>
      {errorMessage && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {errorMessage}
        </p>
      )}
    </>
  )

  /* `[REDESIGNED 2026-08-22, D6]` This page used to be a single `max-w-2xl` column
   * with everything — fact strip, evidence, why-this, objections, download — stacked
   * inside one Card. Measured at 1440px it ran to 3,213px: 3.6 viewports for a product
   * whose entire purchase decision is "what is it, and what does it cost". Every other
   * product surface (ProductBuy, PackDetail, CourseDetail) already uses the two-column
   * sticky-rail layout the docs mandate, so this was the last holdout.
   *
   * Content left, commitment right: the rail carries the price, the file, the download
   * or gate, and the evidence panel — the things a buyer looks at repeatedly — and it
   * stays on screen while the objection block and description scroll under it. */
  return (
    <div className="mx-auto w-full max-w-5xl px-5 pb-24 pt-8 sm:px-8 sm:pb-8 lg:px-12">
      <Breadcrumb
        className="animate-enter mb-6"
        items={[
          { label: 'Templates', to: '/templates' },
          { label: template.title },
        ]}
      />

      <div className="flex items-start justify-between gap-3">
        <PageTitle eyebrow="Template" title={template.title} description={template.description} />
        {template.is_free && <Badge variant="success" className="mt-1 shrink-0">Free</Badge>}
      </div>

      {/* D1: Fact strip — the purchase-decision facts in one horizontal row.
          For a template: format, page/sheet count, access type. */}
      {(() => {
        const facts: Fact[] = [
          ...(template.format
            ? [{ icon: Layers, label: 'Format', value: template.format }]
            : []),
          ...((template.page_count || template.sheet_count)
            ? [{
                icon: Table2,
                label: template.sheet_count ? 'Sheets' : 'Pages',
                value: String(template.sheet_count ?? template.page_count),
                numeric: true,
              }]
            : []),
          {
            icon: Lock,
            label: 'Access',
            value: template.is_free ? 'Free forever' : 'Lifetime',
            hint: template.is_free ? 'No account needed' : 'One-time purchase, no subscription',
          },
        ]
        return <FactStrip facts={facts} className="mt-6" />
      })()}

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_20rem] lg:items-start">
        {/* ── Why this template ──────────────────────────────────────────────── */}
        <section>
          <h2 className="text-h3 font-semibold text-foreground">Why this template</h2>
          <WhyThis className="mt-4" />

          {/* Objection block (8F-4) — the things a buyer wants settled before they
              commit. Left column, because it is read once, not referred back to. */}
          <div className="mt-6 rounded-lg border border-border bg-card p-5 sm:p-6">
            <p className="eyebrow">Before you decide</p>
            <ul className="mt-4 flex flex-col gap-3">
              {OBJECTION_BLOCK.map((item) => (
                <li key={item.label}>
                  <p className="text-sm font-medium text-foreground">
                    {'href' in item && item.href ? (
                      <a href={item.href} className="underline underline-offset-2 hover:text-primary">
                        {item.label}
                      </a>
                    ) : (
                      item.label
                    )}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{item.detail}</p>
                </li>
              ))}
            </ul>
          </div>

          {/* W5-R4 Stage A: featured testimonials */}
          <FeaturedTestimonials contentType="template" contentId={template.id} />

          {template.owned && (
            <ReviewForm
              className="mt-8"
              contentType="template"
              contentId={template.id}
              contentTitle={template.title}
            />
          )}
        </section>

        {/* ── Get the file ───────────────────────────────────────────────────── */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-lg border border-border bg-card p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-gold-soft text-gold-strong ring-1 ring-inset ring-gold/40">
                <FileSpreadsheet className="size-5" aria-hidden="true" />
              </span>
              {template.owned && <Badge variant="success">In your library</Badge>}
            </div>

            {template.is_free ? (
              <p className="mt-4 text-h2 font-semibold text-foreground">Free</p>
            ) : !template.owned && template.product ? (
              <p className="mt-4 text-h2 font-semibold tabular-nums text-foreground">
                {formatCurrency(template.product.price_amount, template.product.currency)}
              </p>
            ) : null}

            <p className="mt-2 font-mono text-xs text-muted-foreground">{template.file_name}</p>

            <EvidencePanel
              format={template.format}
              pageCount={template.page_count}
              sheetCount={template.sheet_count}
              isEditable={template.is_editable}
              hasMacros={template.has_macros}
              minOfficeVersion={template.min_office_version}
              previews={template.previews}
              version={template.version}
              lastReviewedAt={template.last_reviewed_at}
              title={template.title}
              className="mt-5 border-0 bg-transparent p-0"
            />

            {canDownload && <div className="mt-5">{downloadButton}</div>}

            {/* The free lead magnet (product spec §9). Same soft gate as the free
                question: one email, once, and it is a conversion device rather than a
                boundary — the API serves a free template to anyone who asks, so no
                claim is made here that this protects the file. It doesn't, and it
                isn't meant to. */}
            {template.is_free && !unlocked && (
              <form
                onSubmit={(e: FormEvent) => {
                  e.preventDefault()
                  leadMutation.mutate()
                }}
                className="mt-5 rounded-lg border border-border bg-secondary/40 p-5 text-center"
              >
                <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-gold-soft text-gold-strong ring-1 ring-inset ring-gold/40">
                  <Mail className="size-5" aria-hidden="true" />
                </span>
                <p className="mt-3 font-sans font-semibold">Where should we send it?</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Enter your email and the template downloads straight away — no payment, no account.
                </p>
                <label htmlFor="template-gate-email" className="sr-only">
                  Your email address
                </label>
                <Input
                  id="template-gate-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="mt-4"
                />
                <Button type="submit" loading={leadMutation.isPending} className="mt-3 w-full">
                  Get the template
                </Button>
                {leadMutation.isError && (
                  <p role="alert" className="mt-2 text-xs text-destructive">
                    Something went wrong — please try again.
                  </p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">No spam, unsubscribe any time.</p>
              </form>
            )}

            {/* Paid, and this visitor doesn't have it. */}
            {!template.is_free && !template.owned && (
              <div className="mt-5">
                {template.product ? (
                  <Link to={`/buy/${template.product.slug}`} className="block">
                    <Button className="w-full">See what&rsquo;s included</Button>
                  </Link>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    It isn&rsquo;t on sale at the moment.{' '}
                    <Link to="/templates" className="underline">
                      Browse the other templates
                    </Link>
                    .
                  </p>
                )}
              </div>
            )}

            {status === 'not-entitled' && (
              <p role="alert" className="mt-3 text-sm text-destructive">
                You don&rsquo;t have access to this template yet.
              </p>
            )}

            {!template.is_free && (
              <p className="mt-4 border-t border-border pt-4 text-xs text-muted-foreground">
                One payment, lifetime access, including updates to this template.
              </p>
            )}
          </div>

          <Link to="/templates" className="mt-4 block">
            <Button variant="outline" className="w-full">
              Browse the other templates
            </Button>
          </Link>
        </aside>
      </div>

      {/* E3: Sticky bottom action bar on mobile — the download/buy button
          follows the scroll so the reader never has to hunt for it. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-5 py-3 backdrop-blur-sm lg:hidden"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-center justify-between gap-3">
          {!template.is_free && !template.owned && template.product && (
            <p className="text-sm font-semibold tabular-nums text-foreground">
              {formatCurrency(template.product.price_amount, template.product.currency)}
            </p>
          )}
          {template.is_free && <span className="text-sm font-medium text-success">Free</span>}
          <div className="ml-auto">
            {canDownload ? (
              <Button onClick={handleDownload} loading={status === 'preparing'} size="sm">
                {status === 'idle' && <><Download className="size-4" aria-hidden="true" /> Download</>}
                {status === 'preparing' && 'Preparing…'}
                {status === 'downloaded' && 'Downloaded ✓'}
                {status === 'error' && 'Download again'}
              </Button>
            ) : template.product ? (
              <Link to={`/buy/${template.product.slug}`}><Button size="sm">Buy the template</Button></Link>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
