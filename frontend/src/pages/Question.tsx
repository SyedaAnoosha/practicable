import { Link, useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  Banknote,
  BookOpen,
  Clock,
  Download,
  Gauge,
  Landmark,
  Layers,
  Lock,
  Play,
  Tag,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { domainColorVar, domainVisual } from '@/lib/domainVisuals'
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

interface QuestionSummary {
  id: string
  slug: string
  title: string
  subtitle?: string
  preview: string
  domain: string
  tags: Tag[]
}

interface RelatedLesson {
  course_slug: string
  course_title: string
  lesson_slug: string
  lesson_title: string
  lesson_type: string
  owned: boolean
  // The product that actually unlocks THIS lesson (cheapest, if several do), resolved
  // per-lesson server-side. Null when nothing sells it yet.
  unlock_product_slug?: string | null
  unlock_product_name?: string | null
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
  // §21.1: up to 3 related questions — a real query (curated relations, falling back
  // to same-domain questions), so it renders empty rather than fabricated when the
  // library is this small (§49.1).
  related_questions: QuestionSummary[]
  // §21.1 / §23.4: the course lesson(s) this question leads into, with entitlement
  // state — a signpost to the course, never a second player on this page.
  related_lessons: RelatedLesson[]
}

const LESSON_TYPE_ICONS: Record<string, LucideIcon> = {
  video: Play,
  reading: BookOpen,
  download: Download,
  mixed: Layers,
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

  // This question's domain colour + icon (domainVisuals.ts, 2026-08-11
  // liveliness pass) — carried through the breadcrumb, the eyebrow/hairline
  // rule, and the tag grid's dimension tiles below.
  const domainColor = domainColorVar(question.domain)
  const DomainIcon = domainVisual(question.domain).icon

  return (
    // §13.1's reading container: the question page is editorial mode, so the whole
    // column is capped at 68ch — the guidance body gets the same measure (§20.3),
    // and everything above it sits in the same quiet column. Title, subtitle,
    // domain, the seven-tag grid and the guidance all stay in this one scroll —
    // no tabs, no accordion, nothing collapsed behind an interaction.
    <div className="relative mx-auto w-full max-w-7xl px-5 py-12 sm:px-8">
      {/* A quiet domain-tinted wash behind the header block only (not the whole
          page) — the liveliness pass's answer to "more colour" here without
          touching the guidance section's pure-reading contrast. Full-bleed to
          the viewport edge (the `left-1/2 … w-screen` technique — this element
          sits inside a max-w-7xl container, so `inset-x-0` alone would stop at
          the container edge, not the viewport). Static; kept out of the a11y tree.

          [FIXED, 2026-08-11 — visible in a real screenshot, three defects]
          1. Hard top edge: the gradient's centre sat *above* the container
             (`at 20% -15%`), so the tint was at near-full strength exactly at
             the container's top edge — a visible horizontal line under the
             header. Now the centre is on the top edge (`at 50% 0%`) and a
             `mask-image` fades the first ~12% in, so it emerges from the
             background instead of starting abruptly (and still leaves the
             sliver of plain background above the breadcrumb).
          2. Hard bottom edge: the ellipse was 26rem tall inside an 18rem
             (`h-72`) container, so it was clipped mid-gradient — a second
             visible line above the tag grid. The container is taller now and
             the same mask fades the last third out, so the gradient can never
             be cut off by its own box regardless of viewport width.
          3. It read grey, not blue: at 10%, a very dark domain colour (Risk is
             #142E5C) desaturates to grey over ivory. The wash now mixes the
             domain colour halfway toward the vivid `--accent` before applying
             opacity, so every domain reads as *blue* while still shifting hue
             per domain. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 h-[30rem] w-screen -translate-x-1/2"
        style={{
          // Two layers, and the second one is the point. A wash built only from blue
          // reads GREY over ivory no matter how it's mixed — the third attempt at
          // this proved it (the domain hues are dark navies; at any opacity low
          // enough to read as a wash, they desaturate). Champagne gold, the secondary
          // brand colour, is what makes it read as a deliberate warm tint rather than
          // a dirty smudge, and it's why the palette went back to two colours.
          //
          // Both layers are LINEAR, not radial. Every previous version used a radial
          // ellipse, and an ellipse inside a fixed-height box always shows its own
          // edge somewhere — that was the visible curved seam under the tag grid in
          // the screenshots. A vertical linear gradient has no edge to expose; the
          // horizontal one just leans the colour to one side.
          backgroundImage: [
            `linear-gradient(180deg, color-mix(in srgb, ${domainColor} 22%, var(--accent)) 0%, transparent 65%)`,
            `linear-gradient(115deg, transparent 30%, color-mix(in srgb, var(--gold) 55%, transparent) 100%)`,
          ].join(','),
          // Low enough that body text over it is unaffected; the mask does the rest.
          opacity: 0.16,
          // Fades in from nothing (so the header keeps its own edge and a sliver of
          // plain ivory sits above the breadcrumb, as asked) and out to nothing well
          // before the box ends — so the wash can never be clipped by its own
          // container at any viewport width.
          maskImage: 'linear-gradient(to bottom, transparent 0%, black 14%, black 42%, transparent 92%)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 14%, black 42%, transparent 92%)',
        }}
      />

      <div className="relative">
        {/* §21.1: breadcrumb. "Questions" links home (there is no index page yet — the
            homepage is where the finder will live); the domain is current, not a dead link. */}
        <nav aria-label="Breadcrumb" className="animate-enter mb-8">
          <ol className="flex items-center gap-2 text-xs text-muted-foreground">
            <li>
              <Link to="/" className="transition-colors duration-150 hover:text-foreground">
                Questions
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="flex items-center gap-1.5 font-medium" style={{ color: domainColor }}>
              <DomainIcon className="size-3.5" aria-hidden="true" />
              {question.domain}
            </li>
          </ol>
        </nav>

        {/* variant="editorial": the question page is the product's flagship content
            type (owner design critique, 2026-08-11 — "a professional reference
            library, not a course platform"), so its title gets the serif treatment
            no other page uses. eyebrowColor carries this question's domain colour
            (2026-08-11 liveliness pass) through the eyebrow and its hairline rule.
            The title itself stays solid-coloured, not gradient-filled — a long,
            wrapping editorial headline is exactly where a gradient fill starts
            fighting legibility instead of adding life; the wash above and the
            eyebrow rule already carry the colour here. */}
        <div className="animate-enter" style={{ animationDelay: '60ms' }}>
          <PageTitle
            eyebrow={question.domain}
            eyebrowColor={domainColor}
            title={question.title}
            description={question.subtitle}
            variant="editorial"
          />
        </div>

        {/* §21.1: the short answer — serif lead, fully public (§21.3). */}
        <p className="animate-enter mt-6 font-serif text-lead text-muted-foreground" style={{ animationDelay: '110ms' }}>
          {question.preview}
        </p>

        {/* §21.2: all seven tags as a spec-sheet grid of cells — the structure that is
            the product, made tactile. Each dimension gets its own hairline-bordered
            cell (mono dimension label above, value below), deliberately not a row of
            badges. Regulator pressure keeps its accent-blue emphasis (§7.1); every other
            tile now carries this question's own domain colour at low opacity
            (2026-08-11 liveliness pass) — the grid reads as *this question's*
            structure, not a generic grey spec sheet, while accent-blue still stands out
            as the one genuinely urgent signal.

            [DENSITY PASS, 2026-08-11] Dropped the per-dimension bordered card
            (border+p-4 box) in favour of a plain icon+label+value row — still a
            definition grid (DESIGN.md §21.2: "not a row of badges"), just without
            each cell paying for its own card chrome. Three/four columns instead
            of two on wider screens uses the width this page already has instead
            of stacking seven cells into four tall rows. */}
        <dl className="animate-enter mt-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-4" style={{ animationDelay: '160ms' }}>
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
              <div key={dimension} className="flex items-start gap-2.5">
                <span
                  className={cn(
                    'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md',
                    // Solid accent fill, not a light tint — regulator pressure is
                    // the one dimension DESIGN.md §7.1/§20.2 mark for emphasis,
                    // and every other tile is now also a shade of blue (the
                    // palette constraint), so a matching light tint here made it
                    // blend in instead of standing out (caught live, 2026-08-11:
                    // it read as just another muted tile). A full-strength fill
                    // is the only way "the urgent one" still reads as different
                    // within a single-hue palette.
                    isUrgent && 'bg-accent text-accent-foreground shadow-sm',
                  )}
                  style={
                    isUrgent
                      ? undefined
                      : { backgroundColor: `color-mix(in srgb, ${domainColor} 12%, transparent)`, color: domainColor }
                  }
                >
                  <Icon className="size-3.5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <dt className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                    {TAG_LABELS[dimension] ??
                      dimension.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())}
                  </dt>
                  {/* Leadership traits is the one multi-select dimension, so its single
                      row carries every value, comma-joined — one field like the rest. */}
                  <dd className="text-sm font-medium leading-snug text-foreground">
                    {tags.map((tag) => tag.display_label).join(', ')}
                  </dd>
                </div>
              </div>
            )
          })}
        </dl>

      {/* §13.1: editorial mode is capped at 68ch — the guidance body gets the
          reading measure the spec's serif rhythm (§10 read = 1.7) is designed for,
          rather than running the full width of the page column. */}
      <section className="mt-10 max-w-7xl">
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
        /* The conversion moment (§21.4): same accent-blue left-rule family as the featured
           cards, the price promoted to its own accent-blue display line (large text, so the
           accent-blue passes contrast), and the CTA as the one primary action. */
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
            {/* Was "The working template and video lesson that go with this
                guidance" — true only while one product bundled both. After the
                template/course split the cheapest related product is the template
                alone, so promising a video lesson here would have been selling
                something this A$29 purchase no longer grants. */}
            <CardDescription>
              The working tool that goes with this guidance.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {/* Accent-blue price, but only because this is 24px — the accent-blue token is
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

      {/* §21.1 "Related lessons": a signpost to the course this question leads into,
          not a second player — playback only happens on the course/lesson page
          itself. Locked rows stay visible with a lock icon, never hidden or greyed
          out (§23.4, §40.4): a course whose syllabus you can't see is harder to
          evaluate, not more exclusive. */}
      {question.related_lessons.length > 0 && (
        <section className="mt-12 border-t border-border pt-8">
          <SectionHeading>From the related course</SectionHeading>
          <ul className="mt-4 flex flex-col divide-y divide-border">
            {question.related_lessons.map((lesson) => {
              const Icon = LESSON_TYPE_ICONS[lesson.lesson_type] ?? Play
              return (
                <li key={lesson.lesson_slug} className="flex items-center gap-4 py-4 first:pt-0">
                  <span
                    className={cn(
                      'flex size-9 shrink-0 items-center justify-center rounded-md',
                      lesson.owned ? 'bg-success/10 text-success' : 'bg-secondary/70 text-muted-foreground',
                    )}
                  >
                    {lesson.owned ? <Icon className="size-4" aria-hidden="true" /> : <Lock className="size-4" aria-hidden="true" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{lesson.lesson_title}</p>
                    <p className="text-xs text-muted-foreground">{lesson.course_title}</p>
                  </div>
                  {lesson.owned ? (
                    <Link
                      to={`/learn/${lesson.course_slug}/${lesson.lesson_slug}`}
                      className="shrink-0 text-sm font-medium text-primary hover:underline"
                    >
                      Continue
                    </Link>
                  ) : lesson.unlock_product_slug ? (
                    // Buys by *product* slug, not the course's own slug (§21.4), and
                    // specifically the product that unlocks THIS lesson — not
                    // related_content[0]. That shortcut was correct only while one
                    // bundle sold everything; after the template/course split
                    // (db/seed/012) it sent a locked course lesson to the A$29
                    // template checkout, which would have charged the buyer and left
                    // the lesson exactly as locked as before.
                    <Link
                      to={`/buy/${lesson.unlock_product_slug}`}
                      className="shrink-0 text-sm font-medium text-muted-foreground hover:text-foreground"
                    >
                      {lesson.unlock_product_name ?? 'Unlock'}
                    </Link>
                  ) : (
                    <span className="shrink-0 text-sm text-muted-foreground">Locked</span>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* §21.1 "Related questions" — real curated relations, falling back to same-
          domain questions server-side; omitted entirely when empty rather than
          padded with anything invented (§49.1). */}
      {question.related_questions.length > 0 && (
        <section className="mt-12 border-t border-border pt-8">
          <SectionHeading>Related questions</SectionHeading>
          <ul className="mt-4 flex flex-col divide-y divide-border">
            {question.related_questions.map((rq) => (
              <li key={rq.slug} className="py-5 first:pt-0">
                <Link to={`/questions/${rq.slug}`} className="group block">
                  <p className="eyebrow">{rq.domain}</p>
                  <h3 className="mt-1 text-base font-semibold text-foreground group-hover:text-primary">
                    {rq.title}
                  </h3>
                  {rq.subtitle && <p className="mt-1 text-sm text-muted-foreground">{rq.subtitle}</p>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      </div>
    </div>
  )
}
