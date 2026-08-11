import { Link, useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  Banknote,
  Clock,
  Gauge,
  Landmark,
  Layers,
  Lock,
  Tag,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { useAuthStore } from '@/stores/useAuthStore'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageTitle } from '@/components/ui/PageTitle'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { EmailGatedBody } from '@/components/content/EmailGatedBody'

interface Tag {
  dimension: string
  value: string
  display_label: string
}

interface QuestionData {
  id: string
  slug: string
  title: string
  subtitle?: string
  preview: string
  // Always present now (app/api/v1/content/questions.py) — the written guidance is
  // the free entry point, not the paid product; `gated` below now only describes the
  // template/lesson upsell, not whether body is included in the response.
  body: string
  domain: string
  tags: Tag[]
  gated: boolean
  related_content: Array<{ slug: string; name: string; price_amount: number; currency: string }>
}

// DESIGN.md §14.1's fixed icon map, one icon per tag dimension. The detail page shows
// all seven tags as a definition grid (§21.2), so every row carries its dimension's
// icon — the structure of the product rendered as structure.
const TAG_ICONS: Record<string, LucideIcon> = {
  effort: Gauge,
  duration: Clock,
  cost: Banknote,
  roi_horizon: TrendingUp,
  tier: Layers,
  regulator_pressure: Landmark,
  leadership_traits: Users,
}

// Human-written labels per §6's voice rules (sentence case; "ROI" is the one acronym
// that keeps its caps). Falls back to the raw dimension for anything new.
const TAG_LABELS: Record<string, string> = {
  effort: 'Effort',
  duration: 'Duration',
  cost: 'Cost',
  roi_horizon: 'ROI horizon',
  tier: 'Tier',
  regulator_pressure: 'Regulator pressure',
  leadership_traits: 'Leadership traits',
}

export function Question() {
  const { slug } = useParams<{ slug: string }>()
  const user = useAuthStore((s) => s.user)

  const { data: question, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.questions.detail(slug ?? ''),
    queryFn: () => api.get<QuestionData>(`/questions/${slug}`).then((res) => res.data),
    enabled: !!slug,
  })

  // DESIGN.md §40.2: a loading state that says what is loading, not a bare string.
  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-label="Loading question">
        <div className="size-8 animate-spin rounded-full border-2 border-border border-t-primary" />
        <span className="sr-only">Loading question…</span>
      </div>
    )
  }

  // §40.3: generic error state, no detail leaked, with the one action that retries.
  if (error) {
    return (
      <div className="mx-auto w-full max-w-2xl px-5 py-16 sm:px-8">
        <EmptyState
          title="We couldn't load this question."
          description="Check your connection and try again."
          action={<Button onClick={() => refetch()}>Try again</Button>}
        />
      </div>
    )
  }

  if (!question) return null

  return (
    // §13.1's reading container: the question page is editorial mode, so the whole
    // column is capped at 68ch — the guidance body gets the same measure (§20.3),
    // and everything above it sits in the same quiet column.
    <div className="mx-auto w-full max-w-7xl px-5 py-12 sm:px-8">
      {/* §21.1: breadcrumb. "Questions" links home (there is no index page yet — the
          homepage is where the finder will live); the domain is current, not a dead link. */}
      <nav aria-label="Breadcrumb" className="mb-8">
        <ol className="flex items-center gap-2 text-xs text-muted-foreground">
          <li>
            <Link to="/" className="transition-colors duration-150 hover:text-foreground">
              Questions
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page">{question.domain}</li>
        </ol>
      </nav>

      <PageTitle eyebrow={question.domain} title={question.title} description={question.subtitle} />

      {/* §21.1: the short answer — serif lead, fully public (§21.3). */}
      <p className="mt-6 font-serif text-lead text-muted-foreground">{question.preview}</p>

      {/* §21.2: all seven tags as a spec-sheet grid of cells — the structure that is
          the product, made tactile. Each dimension gets its own hairline-bordered
          cell (mono dimension label above, value below), deliberately not a row of
          badges. Regulator pressure is the one dimension allowed emphasis (§7.1) —
          its icon tile carries the gold; the rest stay quiet so the hierarchy
          survives at a glance. */}
      <dl className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Array.from(
          question.tags
            .reduce((byDimension, tag) => {
              const group = byDimension.get(tag.dimension)
              if (group) group.push(tag)
              else byDimension.set(tag.dimension, [tag])
              return byDimension
            }, new Map<string, Tag[]>()),
        ).map(([dimension, tags]) => {
          const Icon = TAG_ICONS[dimension] ?? Tag
          const isUrgent = dimension === 'regulator_pressure'
          return (
            <div
              key={dimension}
              className="rounded-lg border border-border bg-card/60 p-4"
            >
              <dt className="flex items-center gap-3">
                <span
                  className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-md',
                    isUrgent
                      ? 'bg-accent/10 text-accent ring-1 ring-inset ring-accent/25'
                      : 'bg-secondary/70 text-muted-foreground',
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 font-mono text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  {TAG_LABELS[dimension] ??
                    dimension.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())}
                </span>
              </dt>
              {/* Leadership traits is the one multi-select dimension, so its single row
                  carries every value — one field like the rest, not a row per trait.
                  pl-12 = icon tile (36px) + gap (12px), so the value aligns exactly
                  under the label — change size-9/gap-3 above and this must follow. */}
              <dd className="mt-2 pl-12 text-sm font-medium text-foreground">
                {tags.map((tag) => tag.display_label).join(', ')}
              </dd>
            </div>
          )
        })}
      </dl>

      {/* §13.1: editorial mode is capped at 68ch — the guidance body gets the
          reading measure the spec's serif rhythm (§10 read = 1.7) is designed for,
          rather than running the full width of the page column. */}
      <section className="mt-10 max-w-[68ch]">
        <SectionHeading>Guidance</SectionHeading>

        {/* The written guidance is free to read, soft-gated behind an email rather
            than a purchase — the intern brief's "free entry point that earns an
            email address." §20.3's serif-at-text-read treatment lives inside
            EmailGatedBody itself now. `gated` below no longer controls whether any
            text is shown — only whether the template/lesson upsell card underneath
            does. */}
        <EmailGatedBody body={question.body} />
      </section>

      {/* The actual paid product — a direct buy surface (§21.3/§21.4), shown
          alongside the free guidance above, not instead of it. */}
      {question.gated && question.related_content[0] && (
        /* The conversion moment (§21.4): same gold left-rule family as the featured
           cards, the price promoted to its own gold display line (large text, so the
           gold passes contrast), and the CTA as the one primary action. */
        <Card
          className="mt-8 border-l-4 shadow-sm transition-[box-shadow] duration-150 hover:shadow-md"
          style={{ borderLeftColor: 'var(--accent)' }}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent ring-1 ring-inset ring-accent/25">
                <Lock className="size-4" aria-hidden="true" />
              </span>
              Put it into practice with {question.related_content[0].name}
            </CardTitle>
            <CardDescription>
              The working template and video lesson that go with this guidance.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {/* Gold price, but only because this is 24px — the gold token is
                large-text-only on light surfaces (theme.css), and this line is the
                one place a price is allowed to be the accent. Do not shrink it. */}
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-2xl font-semibold tabular-nums text-accent">
                {formatCurrency(question.related_content[0].price_amount, question.related_content[0].currency)}
              </span>
              <span className="text-sm text-muted-foreground">
                One-time purchase · lifetime access
              </span>
            </div>

            {/* §21.4 / week1_plan.md Phase 4 step 9: a direct buy surface, not a link
                into a catalogue — one click to the pre-checkout summary for the one
                product that unlocks this. /buy/:slug lives under MemberLayout, whose
                auth guard redirects a logged-out click to sign-in. */}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link to={`/buy/${question.related_content[0].slug}`} className="sm:flex-1">
                <Button className="w-full">
                  See what's included <ArrowRight className="size-4" aria-hidden="true" />
                </Button>
              </Link>
              {!user && (
                <Link to="/sign-in" className="sm:flex-1">
                  <Button variant="outline" className="w-full">
                    Already bought it? Sign in
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* §21.1 / §21.4: related templates, for the entitled view. Ownership is only
          provable when a single product is listed: the gate passes only through a
          granting product, so a one-item list is necessarily owned — show the owned
          badge, never the price (§23.2). With several related products the API returns
          no ids to check against, so we stay neutral: no badge, no price (§23.2's
          inverse — never claim what isn't owned). */}
      {!question.gated && question.related_content.length > 0 && (
        <section className="mt-12 border-t border-border pt-8">
          <SectionHeading>Related templates</SectionHeading>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {question.related_content.map((p) => (
              <Card key={p.slug}>
                <CardHeader>
                  <CardTitle>{p.name}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center justify-between gap-3">
                  {question.related_content.length === 1 && <Badge variant="success">In your library</Badge>}
                  <Link to={`/buy/${p.slug}`}>
                    <Button variant="outline" size="sm">
                      View
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
