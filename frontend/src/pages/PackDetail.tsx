import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { Download, FileText, FileSpreadsheet, Info, Layers, Lock } from 'lucide-react'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import { PageTitle } from '@/components/ui/PageTitle'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { ErrorState } from '@/components/ui/ErrorState'
import { EvidencePanel } from '@/components/product/EvidencePanel'
import { WhyThis } from '@/components/product/WhyThis'
import { OBJECTION_BLOCK } from '@/lib/labels'
import { Accordion, type AccordionItemData } from '@/components/ui/Accordion'
import { FactStrip, type Fact } from '@/components/ui/FactStrip'
import { TestimonialSection } from '@/components/ui/Testimonial'
import { useFeaturedReviews } from '@/hooks/useFeaturedReviews'
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

/** How many of the pack's questions to render before the expander. Enough to show the
 *  shape and range of what's inside — a reader can tell a foundations-heavy pack from a
 *  regulator-heavy one well inside twelve rows — without turning a product page into a
 *  directory listing. */
const QUESTION_PAGE_SIZE = 12

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
function FeaturedTestimonials({ contentType, contentId }: { contentType: string; contentId: string }) {
  const { data: reviews } = useFeaturedReviews(contentType, contentId)
  if (!reviews || reviews.length === 0) return null
  return <TestimonialSection reviews={reviews} />
}

export function PackDetail() {
  const { slug } = useParams<{ slug: string }>()
  const [status, setStatus] = useState<DownloadStatus>('idle')
  const [showAllQuestions, setShowAllQuestions] = useState(false)

  const { data: pack, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.packs.detail(slug ?? ''),
    queryFn: () => api.get<PackDetail>(`/packs/${slug}`).then((r) => r.data),
    enabled: !!slug,
  })

  // A 404 genuinely means the pack is gone; anything else is a transport failure and
  // gets a retry rather than an eviction notice (same idiom as Learn.tsx:546).
  const isNotFound = isAxiosError(error) && error.response?.status === 404

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

  /* `[ADDED 2026-08-22, F3 — P0]` A network failure is not a missing pack. Without
   * this branch a timeout fell through to "That pack doesn't exist" — telling someone
   * the thing they were about to buy has been withdrawn, when the truth is a dropped
   * request and a retry would fix it. A 404 still lands on the not-found copy below. */
  if (isError && !isNotFound) {
    return (
      <div className="mx-auto w-full max-w-2xl px-5 py-11 sm:px-8">
        <ErrorState
          title="We couldn't load this pack."
          description="Check your connection and try again. The questions inside are free to read either way."
          onRetry={() => void refetch()}
        />
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


  // Build accordion items from the questions list
  const questionAccordionItems: AccordionItemData[] = pack.questions.map((q) => ({
    id: q.slug,
    title: q.title,
    summary: [q.tier, q.effort].filter(Boolean).join(' · '),
    content: (
      <div className="px-4 py-3">
        <Link
          to={`/questions/${q.slug}`}
          className="text-sm font-medium text-primary underline-offset-2 hover:underline"
        >
          Read this question →
        </Link>
      </div>
    ),
  }))

  const visibleQuestions = showAllQuestions
    ? questionAccordionItems
    : questionAccordionItems.slice(0, QUESTION_PAGE_SIZE)
  const hiddenQuestionCount = questionAccordionItems.length - visibleQuestions.length

  return (
    <div className="mx-auto w-full max-w-5xl px-5 pb-24 pt-8 sm:px-8 sm:pb-8 lg:px-12">
      <Breadcrumb
        className="animate-enter mb-6"
        items={[
          { label: 'Reference packs', to: '/packs' },
          { label: pack.name },
        ]}
      />

      <PageTitle eyebrow="Reference pack" title={pack.name} description={pack.description} />

      {/* D1: The fact strip — the four purchase-decision facts in one horizontal row.
          For a pack: question count, format, file size, and access type. */}
      {(() => {
        const facts: Fact[] = [
          {
            icon: Layers,
            label: 'Contents',
            value: `${pack.question_count} ${pack.question_count === 1 ? 'question' : 'questions'}`,
            hint: 'Free to read on the site',
            numeric: true,
          },
          ...(pack.format
            ? [{ icon: FileSpreadsheet, label: 'Format', value: pack.format }]
            : []),
          ...(pack.file_size_bytes
            ? [{
                icon: FileText,
                label: 'File size',
                value: formatBytes(pack.file_size_bytes),
                numeric: true,
              }]
            : []),
          {
            icon: Lock,
            label: 'Access',
            value: 'Lifetime',
            hint: 'One-time purchase, no subscription',
          },
        ]
        return <FactStrip facts={facts} className="mt-6" />
      })()}

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
            {/* `[CHANGED 2026-08-22]` Said "All {question_count} questions" while the
                list below now renders the first {QUESTION_PAGE_SIZE} until expanded.
                This page's whole argument is that it does not hide what it is selling,
                so the sentence has to match what is actually on screen — a collapsed
                list is fine, a sentence that misdescribes it is not. */}
            {hiddenQuestionCount > 0
              ? `The first ${visibleQuestions.length} of ${pack.question_count} questions`
              : `All ${pack.question_count} questions`}
            , in the pack’s working order: foundations before ambition, regulator-exposed before
            not, cheap before expensive. Every question is free to read on the site — the pack is
            the formatted PDF and the working order.
          </p>

          {/* `[FIXED 2026-08-22]` Every question in the pack rendered as its own
              accordion row, all at once. The 61-question pack measured 6,345px — seven
              full viewports at 1440x900, of which ~4,900px was this list — so the buy
              rail scrolled away long before a reader reached the end, and the page read
              as a directory rather than a product.

              Not virtualised, for the same reasons as the question index: a windowed
              list breaks find-in-page, tab order and scroll restoration, all of which
              matter more here than the render cost of a few dozen collapsed rows. The
              first {QUESTION_PAGE_SIZE} establish what the pack contains; the rest are
              one click away, and the count is stated so nothing looks hidden. */}
          <Accordion
            className="mt-6"
            items={visibleQuestions}
            defaultOpen={visibleQuestions.length > 0 ? [visibleQuestions[0].id] : []}
            expandAllLabel="Expand all questions"
            collapseAllLabel="Collapse all questions"
          />

          {hiddenQuestionCount > 0 && (
            <Button
              variant="outline"
              className="mt-4 w-full"
              onClick={() => setShowAllQuestions(true)}
            >
              Show the other {hiddenQuestionCount} {hiddenQuestionCount === 1 ? 'question' : 'questions'}
            </Button>
          )}

          {/* `[MOVED 2026-08-22]` These two panels used to sit inside the buy rail,
              between the evidence panel and the button. Measured, they were 815px and
              612px, which pushed "Buy the pack" roughly 2,000px down a sticky column —
              so the one control the rail exists to present was below the fold on every
              screen size, and the rail's stickiness bought nothing.
              A buy rail should carry the commitment (price, file, evidence, button);
              the argument for buying belongs in the reading column, where the reader
              already is. Nothing is removed — both panels are still on the page, in the
              order a reader meets them. */}
          <WhyThis className="mt-10" />

          {/* Objection block (8F-4) */}
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
          <FeaturedTestimonials contentType="pack" contentId={pack.slug} />
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

      {/* E3: Sticky bottom action bar on mobile — the buy/download button
          follows the scroll so the reader never has to hunt for it on a long page.
          Respects env(safe-area-inset-bottom) for notched devices. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-5 py-3 backdrop-blur-sm lg:hidden"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-center justify-between gap-3">
          {!pack.owned && (
            <p className="text-sm font-semibold tabular-nums text-foreground">
              {formatCurrency(pack.price_amount, pack.currency)}
            </p>
          )}
          <div className="ml-auto">
            {pack.owned ? (
              <Button onClick={handleDownload} loading={status === 'preparing'} size="sm">
                {status === 'idle' && <><Download className="size-4" aria-hidden="true" /> Download</>}
                {status === 'preparing' && 'Preparing…'}
                {status === 'downloaded' && 'Downloaded ✓'}
                {(status === 'error' || status === 'not-entitled') && 'Download again'}
              </Button>
            ) : (
              <Link to={`/buy/${pack.slug}`}><Button size="sm">Buy the pack</Button></Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
