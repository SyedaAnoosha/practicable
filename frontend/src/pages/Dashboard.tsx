import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Award } from 'lucide-react'
import {
  ArrowRight,
  Banknote,
  BookOpen,
  Clock,
  Landmark,
  FileText,
  GraduationCap,
  Layers,
  Search,
  Tags,
} from 'lucide-react'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { useCertificates } from '@/hooks/useCertificates'
import { useAuthStore } from '@/stores/useAuthStore'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { PageTitle } from '@/components/ui/PageTitle'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { StatTiles, type Stat } from '@/components/ui/StatTiles'

// This page names no content: featured items come from the published lists
// (`/questions`, `/products`), so it shows what is actually live and renders nothing
// when something isn't, rather than a stale slug pointing at a 404'd or unpublished item.
// Each chip carries the real catalogue filter it stands for, matching
// QuestionsCatalogue's FILTER_PARAMS and the seeded tag vocabulary.
const FINDER_CHIPS = [
  { label: 'Do it in a fortnight', param: 'duration', value: 'S' },
  { label: 'Do it cheaply', param: 'cost', value: '$' },
  { label: 'Show your regulator', param: 'regulator_pressure', value: 'H' },
] as const

/** Routed entry points into the taxonomy, keyed to the constraint a practitioner
 *  actually arrives with. Each `param`/`value` pair is a real QuestionsCatalogue filter
 *  (matching FILTER_PARAMS and the seeded tag vocabulary), so every row lands on a
 *  populated result set rather than an empty one. */
const ROUTED_STEPS = [
  { label: 'Something I can finish in a fortnight', hint: 'Duration: 2-6 weeks', param: 'duration', value: 'S', icon: Clock },
  { label: 'Something that costs almost nothing', hint: 'Cost: low investment', param: 'cost', value: '$', icon: Banknote },
  { label: 'Something my regulator is asking about', hint: 'Regulator pressure: high', param: 'regulator_pressure', value: 'H', icon: Landmark },
  { label: 'The foundations, in order', hint: 'Tier: foundational', param: 'tier', value: 'F', icon: Layers },
] as const

interface QuestionTag {
  dimension: string
  value: string
  display_label: string
}

interface QuestionSummary {
  id: string
  slug: string
  title: string
  subtitle?: string | null
  preview: string
  domain: string
  tags: QuestionTag[]
}

interface ProductContent {
  content_type: string
  label: string
  href: string | null
}

interface ProductData {
  id: string
  slug: string
  name: string
  description: string
  price_amount: number
  currency: string
  contents: ProductContent[]
}

// The library shape, reused from Library.tsx's endpoint — the dashboard's resume state
// comes from the same source of truth rather than a second computation.
interface LibraryCourse {
  kind: 'course'
  slug: string
  title: string
  subtitle?: string | null
  total_lessons: number
  completed_lessons: number
  percentage_complete: number
  estimated_duration_minutes?: number | null
  resume_lesson_slug?: string | null
  resume_lesson_title?: string | null
}

interface LibraryTemplate {
  kind: 'template'
  id: string
  slug: string
  title: string
}

interface LibraryData {
  courses: LibraryCourse[]
  templates: LibraryTemplate[]
  reference: { slug: string; title: string; domain: string }[]
  is_empty: boolean
}

// Card rules live in lib/tags.ts (TAG_VARIANT + cardTags), so Home's featured question
// and this one render identical tags — one source of truth.

// The signed-in home page, split out from the public landing page (Home.tsx), which
// exists only to get someone to create an account or log in.
//
// `[REBUILT 2026-08-20, design-research/PLATFORM_UI_UX_RESEARCH.md §9 P0 item 4]`
// The audit named this the blandest page in the product and the one a paying member sees
// most: four stacked full-width blocks carrying one item each (search, one question, one
// product, one sentence), with no progress, no resume, no stats and no recommendations —
// while Library.tsx already had an excellent animated ContinueRail this page never
// imported. Every competitor's signed-in home leads with resume state; §6 of the research
// found progress shown far from the next action does not move behaviour.
//
// Restructured to: resume first (the verb), then a compact stat row, then a two-column
// grid for discovery. Same content, roughly 40% of the previous height.
/**
 * Fetch the certificate's short-lived presigned URL, then open it.
 *
 * Two reasons this is not a plain `<a href download>`:
 *
 *  - `GET /me/certificates/{id}/download` returns JSON (`{download_url}`), not the
 *    file. It renders the PDF on first call and presigns it; the browser must follow
 *    the presigned URL it hands back, not the endpoint itself.
 *  - The endpoint is authenticated. An `<a>` sends no Authorization header, so the
 *    request would 401 — and the previous markup pointed at `/api/v1/…`, which is not
 *    even where the API lives (`VITE_API_BASE_URL` is the origin, with no `/api/v1`
 *    prefix), so it resolved against the SPA origin and returned the index page.
 */
async function downloadCertificate(certificateId: string) {
  try {
    const { data } = await api.get<{ download_url: string }>(
      `/me/certificates/${certificateId}/download`,
    )
    // `noopener` because this is a third-party storage origin.
    window.open(data.download_url, '_blank', 'noopener,noreferrer')
  } catch {
    // Deliberately quiet: a failed download must not throw inside the dashboard. The
    // learner still has the certificate, and the next click retries the render.
  }
}

function CertificatesSection() {
  // Via the shared hook rather than an inline useQuery. Both existed, with *different*
  // cache keys (`['me','certificates']` here vs the hook's library-scoped one), so a
  // second consumer would have fetched and cached the same data twice and neither copy
  // would have been invalidated by the other.
  const { data: certificates } = useCertificates()

  if (!certificates || certificates.length === 0) return null

  return (
    <section className="mt-8">
      <SectionHeading>Your certificates</SectionHeading>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {certificates.map((cert) => (
          <Card key={cert.id} className="flex items-center gap-3 p-4">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-gold-soft text-gold-strong ring-1 ring-inset ring-gold/40">
              <Award className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{cert.course_title}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(cert.issued_at).toLocaleDateString('en-AU', { dateStyle: 'medium' })}
              </p>
            </div>
            {!cert.revoked && (
              <button
                type="button"
                onClick={() => downloadCertificate(cert.id)}
                className="shrink-0 rounded text-xs font-medium text-accent hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Download
              </button>
            )}
            {cert.revoked && (
              <span className="shrink-0 rounded bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                Revoked
              </span>
            )}
          </Card>
        ))}
      </div>
    </section>
  )
}

export function Dashboard() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const user = useAuthStore((s) => s.user)
  const firstName = (user?.user_metadata?.name as string | undefined)?.split(' ')[0]

  // The list endpoint, not a detail fetch: the finder, the stat row and the
  // recommendation all read this one cached list.
  const { data: questions } = useQuery({
    queryKey: queryKeys.questions.list(),
    queryFn: () => api.get<QuestionSummary[]>('/questions/index').then((res) => res.data),
  })

  // Still fetched for the "in the store" count in the stat row. The featured-product
  // CARD that used to consume this is gone (see the two-column section below), and with
  // it the entitlements query that existed only to decide that card's owned/unowned
  // state — the library query already carries what this page needs.
  const { data: products } = useQuery({
    queryKey: queryKeys.products.list(),
    queryFn: () => api.get<ProductData[]>('/products').then((res) => res.data),
  })

  // Shares Library.tsx's query key, so the two pages hit React Query's cache rather
  // than the network twice and can never disagree about progress.
  const { data: library } = useQuery({
    queryKey: queryKeys.me.library(),
    queryFn: () => api.get<LibraryData>('/me/library').then((res) => res.data),
  })

  // The one course to resume: furthest along without being finished. A member with
  // nothing in progress gets no panel rather than an empty one.
  /* `[HARDENED 2026-08-22]` `library?.courses` guards `library` being absent but not
     a `library` that arrived without its arrays — `?.courses.filter(...)` then throws
     on `undefined.filter`. Same class as the Purchases `flatMap` fix: the optional
     chain stops one level too early. A member's whole dashboard should not depend on
     one field of one response being present. */
  const resumeCourse = (library?.courses ?? [])
    .filter((c) => c.resume_lesson_slug && c.completed_lessons > 0)
    .sort((a, b) => b.percentage_complete - a.percentage_complete)[0]

  /**
   * One recommendation, with the reason it was chosen.
   *
   * The rule is that the REASON must be true and checkable, not that the pick must be
   * clever. In order of confidence:
   *   1. A course already started but not finished — the strongest signal there is.
   *   2. A question in the same domain as a course the member owns.
   * With neither, this returns null and the panel says so, rather than degrading to
   * "most popular" — an unverifiable claim is worse than an honest absence
   * (principle 7).
   */
  const recommendation = (() => {
    const unfinished = (library?.courses ?? []).find(
      (c) => c.resume_lesson_slug && c.percentage_complete < 100 && c !== resumeCourse,
    )
    if (unfinished) {
      return {
        reason: `You are ${unfinished.percentage_complete}% through this course.`,
        title: unfinished.title,
        subtitle: null as string | null,
        href: `/courses/${unfinished.slug}`,
        cta: 'Keep going',
      }
    }

    const ownedCourse = (library?.courses ?? [])[0]
    if (ownedCourse && questions) {
      // The course taxonomy (`section.name`) and the question taxonomy (`domain.name`)
      // are separate tables bridged by leading keyword — the same bridge
      // domainVisuals.ts uses. A course whose section does not lead with a domain word
      // simply matches nothing here, which is the correct outcome: no match, no claim.
      const keyword = ownedCourse.title.trim().split(/[\s(]+/)[0]?.toLowerCase()
      const related = questions.find((q) => q.domain.toLowerCase().startsWith(keyword ?? ' '))
      if (related) {
        return {
          reason: `In the same area as ${ownedCourse.title}, which is in your library.`,
          title: related.title,
          subtitle: related.subtitle ?? null,
          href: `/questions/${related.slug}`,
          cta: 'Read the answer',
        }
      }
    }

    return null
  })()

  // Counted from the responses rather than written down. This line has already been
  // wrong twice — it said "one question and one template" after the 100-question seed
  // landed, then "100 questions, one template, one course" after the catalogue moved on
  // again. A hand-maintained count of a database is a claim that goes stale silently, on
  // the page where a paying member is deciding whether to trust what else it says.
  const stats: Stat[] = [
    ...(questions ? [{ icon: Tags, value: questions.length, label: 'Questions live' }] : []),
    ...(library ? [{ icon: GraduationCap, value: library.courses?.length ?? 0, label: 'Courses owned' }] : []),
    ...(library ? [{ icon: FileText, value: library.templates?.length ?? 0, label: 'Templates owned' }] : []),
    ...(products ? [{ icon: Layers, value: products.length, label: 'In the store' }] : []),
  ]

  // Real navigation: a typed query goes to the catalogue with the search applied;
  // an empty submit just opens the catalogue.
  const goToQuestion = (e?: FormEvent) => {
    e?.preventDefault()
    const q = query.trim()
    navigate(q ? `/questions?q=${encodeURIComponent(q)}` : '/questions')
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-8">
      <PageTitle
        eyebrow="Your home"
        title={firstName ? `Welcome back, ${firstName}` : 'Welcome back'}
        description="Find the question you're trying to answer, then learn and apply it."
      />

      {/* ── Resume first ──
          The dashboard's job is to help the member ACT, not to report. When something is
          in progress, that is the only thing that belongs at the top — and it names the
          specific next lesson rather than saying "Continue", because §6 of the research
          found a resume point that names the next thing is what makes the action
          concrete. On the stage plane so it reads as the page's one anchor. */}
      {/* `[ADDED 2026-08-22, E6.1]` The first-run state.
          Both this panel and the library grid below were conditional, so a NEW ACCOUNT
          saw neither — the emptiest screen in the product, and precisely where the
          Phase 0 buy-flow fix now delivers people intentionally after they sign up to
          purchase. A dashboard whose job is to give a reason to return cannot open with
          nothing.

          It is not an "empty state" in the apologetic sense: it names what will appear
          here once there is progress, and offers the one action that starts it. Same
          stage plane and same shape as the resume panel it stands in for, so the page
          does not restructure itself the moment a member starts a course. */}
      {!resumeCourse && (
        <section className="relative isolate mt-6 overflow-hidden rounded-2xl bg-stage p-5 text-stage-foreground sm:p-6">
          <div aria-hidden="true" className="stage-aurora stage-aurora--quiet -z-10" />
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="eyebrow text-stage-foreground/70">Start here</p>
              <p className="mt-2.5 text-h3 font-semibold text-stage-foreground">
                Nothing in progress yet
              </p>
              <p className="mt-2 max-w-prose text-sm text-stage-foreground/75">
                When you start a course, this panel becomes your resume point — it names the
                next lesson and tracks how far through you are. Every question on the site is
                free to read, so the quickest way in is the one you are already trying to answer.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:items-end">
              <Link to="/questions">
                <Button size="lg">
                  Browse the questions <ArrowRight className="size-4" aria-hidden="true" />
                </Button>
              </Link>
              <Link
                to="/courses"
                className="rounded text-sm font-medium text-stage-foreground/80 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
              >
                See the courses
              </Link>
            </div>
          </div>
        </section>
      )}

      {resumeCourse && (
        <section className="relative isolate mt-6 overflow-hidden rounded-2xl bg-stage p-5 text-stage-foreground sm:p-6">
          <div aria-hidden="true" className="stage-aurora stage-aurora--quiet -z-10" />
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="eyebrow text-stage-foreground/70">Continue where you left off</p>
              <p className="mt-2.5 text-sm text-stage-foreground/75">{resumeCourse.title}</p>
              <p className="mt-0.5 truncate text-h3 font-semibold text-stage-foreground">
                {resumeCourse.resume_lesson_title}
              </p>
              <div className="mt-4 max-w-sm">
                {/* The bar is on a dark plane here; the track uses a stage alpha rather
                    than --secondary, which is a light champagne and would glow. */}
                <div className="flex items-center justify-between text-xs text-stage-foreground/70">
                  <span>
                    {resumeCourse.completed_lessons} of {resumeCourse.total_lessons} lessons
                    {resumeCourse.estimated_duration_minutes != null && resumeCourse.percentage_complete < 100 && (
                      <> · ~{Math.max(1, Math.round(resumeCourse.estimated_duration_minutes * (resumeCourse.total_lessons - resumeCourse.completed_lessons) / resumeCourse.total_lessons))} min left</>
                    )}
                  </span>
                  <span className="font-mono tabular-nums">{resumeCourse.percentage_complete}%</span>
                </div>
                <div
                  className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-stage-foreground/15"
                  role="progressbar"
                  aria-valuenow={resumeCourse.percentage_complete}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${resumeCourse.title} progress`}
                >
                  <div
                    className="h-full rounded-full bg-gold transition-[width] duration-[400ms] ease-[var(--ease-entrance)]"
                    style={{ width: `${resumeCourse.percentage_complete}%` }}
                  />
                </div>
              </div>
            </div>
            <Link
              to={`/learn/${resumeCourse.slug}/${resumeCourse.resume_lesson_slug}`}
              className="shrink-0"
            >
              <Button size="lg">
                Continue <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            </Link>
          </div>
        </section>
      )}

      {/* ── The finder ──
          Still the page's centrepiece for a member with nothing in progress; one step
          down the page for one who has. Contained so it reads as a deliberate surface
          rather than a bare input. All of it is honest navigation. */}
      <form onSubmit={goToQuestion} className="mt-6">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <label htmlFor="dashboard-finder" className="text-sm font-medium text-foreground">
            What are you trying to solve?
          </label>
          <div className="relative mt-3">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="dashboard-finder"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search the questions…"
              className="h-14 rounded-xl pl-11 text-base"
            />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground" aria-hidden="true">
              Try:
            </span>
            {FINDER_CHIPS.map((chip) => (
              <Link
                key={chip.label}
                to={`/questions?${chip.param}=${encodeURIComponent(chip.value)}`}
                className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {chip.label}
              </Link>
            ))}
          </div>
        </div>
      </form>

      {/* Four counted facts in one row — the sentence that used to close this page,
          rendered as data. Still counted from the API, never written down. */}
      {stats.length > 0 && <StatTiles stats={stats} className="mt-6" />}

      {/* ── Two columns: pick up the taxonomy, and one explained recommendation ──

          `[REPLACED 2026-08-22, owner direction: "I don't like the Live Now and Tools
          and Templates sections on Dashboard"]` — and the objection is right on both.

          "Live now" showed ONE arbitrary question from the catalogue. It was not chosen
          for this member, not related to anything they own, and not new; it was the
          first item the API happened to return. A signed-in member has already found
          the site — a random question is marketing shown to someone who has converted.

          "Templates & tools" was worse: a product pitch carrying a `Most popular` badge
          that nothing in the data supports. That is invented credibility (principle 7),
          the same device that got ratings declined, and it sat on the page a paying
          member sees every session.

          Replaced with the two things REDESIGN_SUMMARY §7.2 actually asks for — routed
          next steps, and recommendations that state their reason. A recommendation
          whose basis is shown ("because it is in the domain you have been reading") is
          checkable; a bare ranking asks for trust it has not earned. */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Left: routed entry into the taxonomy by the constraint the member actually
            has. These are the real catalogue filters, so each one lands on a populated
            result set rather than a guess. */}
        <section className="flex flex-col">
          <SectionHeading>Pick up where the work is</SectionHeading>
          <Card className="mt-4 flex flex-1 flex-col p-5">
            <p className="text-sm text-muted-foreground">
              Every question is filtered by what it costs you — time, money, and how hard your
              regulator is pushing. Start from the constraint you have.
            </p>
            <ul className="mt-4 flex flex-1 flex-col divide-y divide-border">
              {ROUTED_STEPS.map(({ label, hint, param, value, icon: Icon }) => (
                <li key={label}>
                  <Link
                    to={`/questions?${param}=${encodeURIComponent(value)}`}
                    className="group flex items-center gap-3 py-3 transition-colors hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-foreground group-hover:text-primary">{label}</span>
                      <span className="block text-xs text-muted-foreground">{hint}</span>
                    </span>
                    <ArrowRight
                      className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </section>

        {/* Right: recommendations WITH their reason (LinkedIn Learning's device, §7.2).
            The reason is computed from what the member owns, so it is a statement of
            fact rather than a ranking. When there is nothing to base it on, the section
            says so plainly instead of falling back to "popular". */}
        <section className="flex flex-col">
          <SectionHeading>{recommendation ? 'Because of what you own' : 'Where to start'}</SectionHeading>
          <Card className="mt-4 flex flex-1 flex-col p-5">
            {recommendation ? (
              <>
                <p className="text-xs text-muted-foreground">{recommendation.reason}</p>
                <Link
                  to={recommendation.href}
                  className="group mt-3 block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <p className="text-h4 font-semibold text-foreground group-hover:underline">
                    {recommendation.title}
                  </p>
                  {recommendation.subtitle && (
                    <p className="mt-1.5 line-clamp-2 font-serif text-sm text-muted-foreground">
                      {recommendation.subtitle}
                    </p>
                  )}
                </Link>
                <Link to={recommendation.href} className="mt-auto inline-flex pt-5">
                  <Button variant="outline" size="sm">
                    {recommendation.cta} <ArrowRight className="size-4" aria-hidden="true" />
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Once you have read a few questions or started a course, this panel points at the
                  next thing in the same area — and tells you why it picked it.
                </p>
                <Link to="/questions" className="mt-auto inline-flex pt-5">
                  <Button variant="outline" size="sm">
                    Browse all questions <ArrowRight className="size-4" aria-hidden="true" />
                  </Button>
                </Link>
              </>
            )}
          </Card>
        </section>
      </div>

      {/* `[ADDED 2026-08-22, E6.1]` The library block also rendered nothing when empty.
          Every panel on this page now has a designed state — F1: name what would be
          here, and the one action that puts something here. Never a blank region. */}
      {library && library.is_empty && (
        <section className="mt-8">
          <SectionHeading>In your library</SectionHeading>
          <div className="mt-4 rounded-xl border border-dashed border-border bg-muted/40 px-5 py-8 text-center">
            <p className="text-sm font-medium text-foreground">Nothing in your library yet.</p>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
              Courses and templates you buy appear here, with your progress through each one.
            </p>
            <Link to="/store" className="mt-4 inline-block">
              <Button variant="outline" size="sm">Browse the store</Button>
            </Link>
          </div>
        </section>
      )}

      {library && !library.is_empty && (
        <section className="mt-8">
          <SectionHeading>In your library</SectionHeading>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {library.courses.slice(0, 3).map((course) => (
              <Link key={course.slug} to={`/courses/${course.slug}`} className="group">
                <Card className="hover-lift flex h-full flex-col p-4">
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent">
                      <GraduationCap className="size-4" aria-hidden="true" />
                    </span>
                    <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                      {course.title}
                    </p>
                  </div>
                  <ProgressBar
                    className="mt-3"
                    size="sm"
                    value={course.percentage_complete}
                    label={`${course.title} progress`}
                    caption={`${course.completed_lessons} of ${course.total_lessons}${course.estimated_duration_minutes && course.percentage_complete < 100 ? ` · ~${Math.max(1, Math.round(course.estimated_duration_minutes * (course.total_lessons - course.completed_lessons) / course.total_lessons))} min left` : ''}`}
                  />
                </Card>
              </Link>
            ))}
            {library.templates.slice(0, 3 - Math.min(library.courses.length, 3)).map((t) => (
              <Link key={t.id} to={`/templates/${t.id}`} className="group">
                <Card className="hover-lift flex h-full items-center gap-2.5 p-4">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-gold-soft text-gold-strong ring-1 ring-inset ring-gold/40">
                    <FileText className="size-4" aria-hidden="true" />
                  </span>
                  <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{t.title}</p>
                </Card>
              </Link>
            ))}
          </div>
          <Link
            to="/library"
            className="mt-4 inline-flex items-center gap-1.5 rounded text-sm font-medium text-accent transition-colors hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <BookOpen className="size-4" aria-hidden="true" />
            Open my library
          </Link>
        </section>
      )}

      {/* ── Certificates ──
          Shows earned certificates with a link to download each one. Only rendered
          when the learner has at least one. */}
      <CertificatesSection />

      {/* Kept as a caption rather than a paragraph block — the counts now live in the
          stat row above, so this only carries the cadence claim. */}
      {questions && questions.length > 0 && (
        <p className="mt-8 text-center text-sm text-muted-foreground">
          More questions, templates and courses are added weekly.
        </p>
      )}
    </div>
  )
}
