import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link, useSearchParams } from 'react-router'
import { motion } from 'motion/react'
import { useQuery } from '@tanstack/react-query'
import {
  Banknote,
  Clock,
  FileQuestion,
  Filter,
  Gauge,
  Landmark,
  Layers,
  Search,
  TrendingUp,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import { api } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/keys'
import { domainColorVar, domainVisual } from '@/lib/domainVisuals'
import { track } from '@/lib/analytics'
import { PageTitle } from '@/components/ui/PageTitle'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'
import {
  MULTI_DIMENSIONS,
  ORDINAL_DIMENSIONS,
  buildTagLookup,
  partitionQuestions,
  rankRelaxationCandidates,
  type MultiDimension,
  type OrdinalDimension,
  type QuestionFilters,
  type ScoredQuestion,
  type TagRef,
} from '@/lib/scoring'

interface QuestionSummary {
  id: string
  slug: string
  title: string
  subtitle: string | null
  preview: string
  domain: string
  domain_slug: string
  tags: TagRef[]
}

function isMultiDimension(dim: string): dim is MultiDimension {
  return (MULTI_DIMENSIONS as readonly string[]).includes(dim)
}

// Same icon/label map as Question.tsx's definition grid — one dimension, one icon.
const DIMENSION_ICONS: Record<string, LucideIcon> = {
  effort: Gauge,
  duration: Clock,
  cost: Banknote,
  roi_horizon: TrendingUp,
  tier: Layers,
  regulator_pressure: Landmark,
  leadership_traits: Users,
}
const DIMENSION_LABELS: Record<string, string> = {
  effort: 'Effort',
  duration: 'Duration',
  cost: 'Cost',
  roi_horizon: 'ROI horizon',
  tier: 'Tier',
  regulator_pressure: 'Regulator pressure',
  leadership_traits: 'Leadership traits',
}
// Practitioner-reasoning order: where do I work, how long, what can I spend, how
// much of my own time, does anyone external care, how fast does it pay off, how
// foundational vs transformational.
const DIMENSION_ORDER = [...ORDINAL_DIMENSIONS, 'tier', 'leadership_traits']

// Real taxonomy values, not fuzzy text — a chip only ever matches a real tag row.
// `toggleQuickFilter` below only handles one dimension at a time, so a chip mixing
// a single-select and a multi-select dimension isn't supported yet.
const QUICK_FILTERS: { label: string; dimension: string; values: readonly string[] }[] = [
  { label: 'Do it in a fortnight', dimension: 'duration', values: ['s'] },
  { label: 'Do it cheaply', dimension: 'cost', values: ['low'] },
  { label: 'Show your regulator', dimension: 'regulator_pressure', values: ['h'] },
  { label: 'Quick payback', dimension: 'roi_horizon', values: ['quick'] },
]

// One URL param per dimension (+domain), so filters are shareable and Home's domain
// blocks and quick filters can link straight in. Multi-select dims (tier,
// leadership_traits) use REPEATED params (`?tier=a&tier=b`), read with `getAll`.
const SINGLE_FILTER_PARAMS: readonly ('domain' | OrdinalDimension)[] = ['domain', ...ORDINAL_DIMENSIONS]
const ALL_FILTER_PARAMS: readonly string[] = [...SINGLE_FILTER_PARAMS, ...MULTI_DIMENSIONS]

function filtersFromSearchParams(searchParams: URLSearchParams): QuestionFilters {
  // A narrowly-typed intermediate object, since QuestionFilters mixes string and
  // string[] fields and can't be safely index-assigned through a loop variable.
  const single: Partial<Record<'domain' | OrdinalDimension, string>> = {}
  for (const dim of SINGLE_FILTER_PARAMS) {
    const value = searchParams.get(dim)
    if (value) single[dim] = value
  }
  return {
    ...single,
    tier: searchParams.getAll('tier'),
    leadership_traits: searchParams.getAll('leadership_traits'),
  }
}

/** `12 exact · +9 close` — tabular-nums so digits don't jitter, aria-live so a screen
 * reader announces the recount on every tap. */
function ResultCount({
  exactCount,
  closeCount,
  hasFilters,
  totalCount,
}: {
  exactCount: number
  closeCount: number
  hasFilters: boolean
  totalCount: number
}) {
  return (
    <p className="text-sm text-muted-foreground" aria-live="polite">
      {!hasFilters ? (
        <>
          <span className="font-semibold tabular-nums text-primary">{totalCount}</span>{' '}
          {totalCount === 1 ? 'question' : 'questions'}
        </>
      ) : (
        <>
          <span className="font-semibold tabular-nums text-primary">{exactCount}</span> exact
          {closeCount > 0 && (
            <>
              {' '}
              · <span className="font-semibold tabular-nums text-foreground">+{closeCount}</span> close
            </>
          )}
        </>
      )}
    </p>
  )
}

/** A close row's badge — informational, never an error: no `--destructive`, no
 * warning icon, text is never dimmed (§19.3). Names the dimension that missed and
 * the question's actual value on it, e.g. "Duration: 3-6 months". */
function MatchBadge({ dimension, actual, tagLookup }: { dimension: string; actual: unknown; tagLookup: Map<string, TagRef> }) {
  const label = DIMENSION_LABELS[dimension] ?? dimension
  const values = Array.isArray(actual) ? actual : actual != null ? [actual as string] : []
  if (values.length === 0) return null
  const text = values.map((v) => tagLookup.get(`${dimension}:${v}`)?.display_label ?? v).join(', ')
  return (
    <Badge variant="secondary">
      {label}: {text}
    </Badge>
  )
}

/** Suggested relaxations, computed from the cached index: rank active filters by how
 * few questions each admits alone, and offer the two most restrictive as one-tap
 * recoveries. */
function ZeroResults({
  candidates,
  filters,
  tagLookup,
  onRelax,
  onClearAll,
}: {
  candidates: string[]
  filters: QuestionFilters
  tagLookup: Map<string, TagRef>
  onRelax: (dimension: string) => void
  onClearAll: () => void
}) {
  const label = (dim: string): string => {
    if (dim === 'domain') return filters.domain ?? dim
    if (isMultiDimension(dim)) {
      const values = filters[dim]
      return values.map((v) => tagLookup.get(`${dim}:${v}`)?.display_label ?? v).join(', ')
    }
    // `dim` is a plain string here, not a narrowed literal, so it's resolved through
    // a switch rather than an index-signature cast (see filtersFromSearchParams).
    const value: string | undefined =
      dim === 'effort'
        ? filters.effort
        : dim === 'duration'
          ? filters.duration
          : dim === 'cost'
            ? filters.cost
            : dim === 'roi_horizon'
              ? filters.roi_horizon
              : dim === 'regulator_pressure'
                ? filters.regulator_pressure
                : undefined
    return value ? (tagLookup.get(`${dim}:${value}`)?.display_label ?? value) : dim
  }

  return (
    <EmptyState
      className="mt-6"
      icon={FileQuestion}
      title="No questions match every filter."
      description={
        candidates.length > 0
          ? `The tightest constraint is ${DIMENSION_LABELS[candidates[0]] ?? candidates[0]}: ${label(candidates[0])}. Try relaxing it, or another, below.`
          : 'Try removing a filter or searching for a different term.'
      }
      action={
        <div className="flex flex-wrap items-center justify-center gap-2">
          {candidates.slice(0, 2).map((dim) => (
            <Button key={dim} variant="outline" size="sm" onClick={() => onRelax(dim)}>
              Relax {DIMENSION_LABELS[dim] ?? dim}
            </Button>
          ))}
          <Button variant="ghost" size="sm" onClick={onClearAll}>
            Clear all
          </Button>
        </div>
      }
    />
  )
}

function FilterPanel({
  questions,
  searchParams,
  setSearchParams,
}: {
  questions: QuestionSummary[]
  searchParams: URLSearchParams
  setSearchParams: (params: URLSearchParams) => void
}) {
  // Only offer values actually present in the data, so no option returns zero results.
  const domainOptions = useMemo(() => [...new Set(questions.map((q) => q.domain))].sort(), [questions])
  const domainSlugByName = useMemo(() => {
    const map = new Map<string, string>()
    for (const q of questions) map.set(q.domain, q.domain_slug)
    return map
  }, [questions])
  const dimensionOptions = useMemo(() => {
    const byDimension = new Map<string, Map<string, { label: string; sortOrder: number }>>()
    for (const q of questions) {
      for (const tag of q.tags) {
        if (!byDimension.has(tag.dimension)) byDimension.set(tag.dimension, new Map())
        byDimension.get(tag.dimension)!.set(tag.value, { label: tag.display_label, sortOrder: tag.sort_order })
      }
    }
    return byDimension
  }, [questions])

  const toggle = (param: string, value: string) => {
    const next = new URLSearchParams(searchParams)
    if (next.get(param) === value) {
      next.delete(param)
    } else {
      next.set(param, value)
      // Fired on APPLY, not on clear — tracking which filters get reached for.
      track('filter_applied', { dimension: param, value })
    }
    setSearchParams(next)
  }

  // Multi-select (tier, leadership_traits): repeated query params, toggled
  // independently, "any of these" semantics at the scoring layer.
  const toggleMulti = (param: string, value: string) => {
    const next = new URLSearchParams(searchParams)
    const current = next.getAll(param)
    next.delete(param)
    const adding = !current.includes(value)
    const updated = adding ? [...current, value] : current.filter((v) => v !== value)
    for (const v of updated) next.append(param, v)
    if (adding) track('filter_applied', { dimension: param, value })
    setSearchParams(next)
  }

  return (
    <div className="flex flex-col gap-6">
      {domainOptions.length > 0 && (
        <div>
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <span className="flex size-5 items-center justify-center rounded bg-secondary text-secondary-foreground">
              <Layers className="size-3" aria-hidden="true" />
            </span>
            Domain
          </p>
          {/* Each domain gets its own signature colour and icon — the one exception
              to "no per-dimension rainbow" (still true for
              the seven tag dimensions below). Five named domains is a different,
              smaller problem than seven badges per row. */}
          <div className="mt-2.5 flex flex-col gap-0.5">
            {domainOptions.map((d) => {
              const slug = domainSlugByName.get(d) ?? d
              const active = searchParams.get('domain') === slug
              const color = domainColorVar(d)
              const Icon = domainVisual(d).icon
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggle('domain', slug)}
                  aria-pressed={active}
                  className={cn(
                    'flex items-center gap-2 rounded-md border-l-2 px-2.5 py-1.5 text-left text-sm transition-colors duration-150',
                    active ? 'font-medium' : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
                  )}
                  style={
                    active
                      ? { borderLeftColor: color, backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)`, color }
                      : { borderLeftColor: 'transparent' }
                  }
                >
                  <Icon className="size-3.5 shrink-0" aria-hidden="true" style={{ color: active ? color : undefined }} />
                  {d}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {DIMENSION_ORDER.filter((dim) => dimensionOptions.has(dim)).map((dim) => {
        const Icon = DIMENSION_ICONS[dim] ?? Filter
        const values = dimensionOptions.get(dim)!
        const multi = isMultiDimension(dim)
        // Regulator pressure keeps the one emphasis colour; every other tile is
        // secondary by design.
        const isUrgent = dim === 'regulator_pressure'
        const activeMultiValues = multi ? searchParams.getAll(dim) : []
        return (
          <div key={dim}>
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <span
                className={cn(
                  'flex size-5 items-center justify-center rounded',
                  isUrgent ? 'bg-accent/15 text-accent' : 'bg-secondary text-secondary-foreground',
                )}
              >
                <Icon className="size-3" aria-hidden="true" />
              </span>
              {DIMENSION_LABELS[dim] ?? dim}
            </p>
            <div className="mt-2.5 flex flex-col gap-0.5">
              {/* Sorted by the real ordinal scale (tag_values.sort_order), not by
                  whichever value happened to appear first in the question list. */}
              {[...values.entries()]
                .sort(([, a], [, b]) => a.sortOrder - b.sortOrder)
                .map(([value, { label }]) => {
                  const active = multi ? activeMultiValues.includes(value) : searchParams.get(dim) === value
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => (multi ? toggleMulti(dim, value) : toggle(dim, value))}
                      aria-pressed={active}
                      className={cn(
                        'rounded-md border-l-2 px-2.5 py-1.5 text-left text-sm transition-colors duration-150',
                        active
                          ? isUrgent
                            ? 'border-l-accent bg-accent/10 font-medium text-accent'
                            : 'border-l-primary bg-primary/10 font-medium text-primary'
                          : 'border-l-transparent text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
                      )}
                    >
                      {/* A checkbox glyph, not a radio dot, on the two multi-select
                          groups — the semantics really are "any of these", and the
                          UI should say so without needing a legend. */}
                      {multi && <span aria-hidden="true">{active ? '☑ ' : '☐ '}</span>}
                      {label}
                    </button>
                  )
                })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

const CLOSE_PREVIEW_COUNT = 3

function QuestionRow({
  scored,
  showBadges,
  showMatchList,
  activeFilterLabels,
  tagLookup,
}: {
  scored: ScoredQuestion<QuestionSummary>
  showBadges: boolean
  showMatchList: boolean
  activeFilterLabels: { param: string; label: string }[]
  tagLookup: Map<string, TagRef>
}) {
  const question = scored.question
  const color = domainColorVar(question.domain)
  const DomainIcon = domainVisual(question.domain).icon
  return (
    <li>
      <Link
        to={`/questions/${question.slug}`}
        className={cn(
          'group -mx-4 block rounded-lg border-l-2 px-4 py-6 transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--accent)_6%,var(--card))] focus-visible:bg-[color-mix(in_srgb,var(--accent)_6%,var(--card))] focus-visible:outline-none',
          // Close rows carry a lighter left rule than exact rows — the only
          // structural difference besides the badge.
          showBadges
            ? 'border-l-border'
            : 'border-l-transparent hover:border-l-[var(--row-domain-color)] focus-visible:border-l-[var(--row-domain-color)]',
        )}
        style={{ '--row-domain-color': color } as CSSProperties}
      >
        <p className="eyebrow gap-1.5" style={{ color }}>
          <DomainIcon className="size-3" aria-hidden="true" />
          {question.domain}
        </p>
        <h3 className="mt-1.5 text-h4 font-semibold text-foreground group-hover:text-primary">{question.title}</h3>
        {question.subtitle && <p className="mt-1 text-sm text-muted-foreground">{question.subtitle}</p>}

        {showBadges && scored.misses.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {scored.misses.map((m) => (
              <MatchBadge key={m.dimension} dimension={m.dimension} actual={m.actual} tagLookup={tagLookup} />
            ))}
          </div>
        )}

        {/* Match explanation for exact rows — restating filters this result satisfies,
            never a fabricated relevance score. */}
        {showMatchList && activeFilterLabels.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1">
            {activeFilterLabels.map((f) => (
              <li key={f.param} className="flex items-center gap-1.5 text-xs text-success">
                <span aria-hidden="true">✓</span> {f.label}
              </li>
            ))}
          </ul>
        )}

        <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">Read the answer →</span>
      </Link>
    </li>
  )
}

// The /questions catalogue: every filter option offered is derived from what's
// actually published, results are a RANKING (exact + close, with a divider between
// them) rather than a strict gate that can return nothing, and the live count updates
// on every tap with zero round trips — the whole index is fetched once and scored
// client-side.
export function QuestionsCatalogue() {
  const [searchParams, setSearchParams] = useSearchParams()
  // Seeded from `?q=` so a search started elsewhere arrives here already applied.
  // Debounced back into the URL below (search only, never a filter tap) rather than
  // on every keystroke, so typing doesn't spam browser history.
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '')
  const [debouncedQuery, setDebouncedQuery] = useState(query)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  // Which settled query the "show all close matches" expansion was opened against,
  // derived rather than reset by an effect: when `debouncedQuery` moves, the equality
  // below stops holding and the list collapses on its own.
  const [expandedFor, setExpandedFor] = useState<string | null>(null)
  const showAllClose = expandedFor === debouncedQuery

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 250)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (debouncedQuery) next.set('q', debouncedQuery)
        else next.delete('q')
        return next
      },
      { replace: true },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery])

  const { data: questions, isLoading } = useQuery({
    queryKey: queryKeys.questions.list(),
    queryFn: () => api.get<QuestionSummary[]>('/questions/index').then((res) => res.data),
  })

  const filters = useMemo(() => filtersFromSearchParams(searchParams), [searchParams])
  const tagLookup = useMemo(() => buildTagLookup(questions?.flatMap((q) => q.tags) ?? []), [questions])

  const { exact, close, hasFilters } = useMemo(() => {
    if (!questions)
      return {
        exact: [] as ScoredQuestion<QuestionSummary>[],
        close: [] as ScoredQuestion<QuestionSummary>[],
        hasFilters: false,
      }
    const term = debouncedQuery.trim().toLowerCase()
    const searched = term
      ? questions.filter((item) => item.title.toLowerCase().includes(term) || item.preview.toLowerCase().includes(term))
      : questions
    return partitionQuestions(searched, filters, tagLookup)
  }, [questions, filters, tagLookup, debouncedQuery])

  const relaxationCandidates = useMemo(() => {
    if (!questions || !hasFilters || exact.length > 0 || close.length > 0) return []
    const term = debouncedQuery.trim().toLowerCase()
    const searched = term
      ? questions.filter((item) => item.title.toLowerCase().includes(term) || item.preview.toLowerCase().includes(term))
      : questions
    return rankRelaxationCandidates(searched, filters)
  }, [questions, filters, hasFilters, exact.length, close.length, debouncedQuery])

  const activeFilterCount = ALL_FILTER_PARAMS.reduce((n, p) => n + (searchParams.getAll(p).length > 0 ? 1 : 0), 0)

  const activeFilterLabels = useMemo(() => {
    const labels: { param: string; value: string; label: string }[] = []
    for (const param of SINGLE_FILTER_PARAMS) {
      const value = searchParams.get(param)
      if (!value) continue
      if (param === 'domain') {
        const question = questions?.find((q) => q.domain_slug === value)
        labels.push({ param, value, label: question?.domain ?? value })
      } else {
        labels.push({ param, value, label: tagLookup.get(`${param}:${value}`)?.display_label ?? value })
      }
    }
    for (const param of MULTI_DIMENSIONS) {
      for (const value of searchParams.getAll(param)) {
        labels.push({ param, value, label: tagLookup.get(`${param}:${value}`)?.display_label ?? value })
      }
    }
    return labels
  }, [searchParams, questions, tagLookup])

  const clearFilter = (param: string, value?: string) => {
    const next = new URLSearchParams(searchParams)
    if (value && isMultiDimension(param)) {
      const remaining = next.getAll(param).filter((v) => v !== value)
      next.delete(param)
      for (const v of remaining) next.append(param, v)
    } else {
      next.delete(param)
    }
    setSearchParams(next)
  }
  const clearAll = () => setSearchParams({})

  const toggleQuickFilter = (dimension: string, values: readonly string[]) => {
    const next = new URLSearchParams(searchParams)
    const current = next.get(dimension)
    if (current && values.includes(current)) {
      next.delete(dimension)
    } else {
      next.set(dimension, values[0])
    }
    setSearchParams(next)
  }

  const visibleClose = showAllClose ? close : close.slice(0, CLOSE_PREVIEW_COUNT)
  const isZeroResults = hasFilters && exact.length === 0 && close.length === 0

  return (
    <div className="relative isolate mx-auto w-full max-w-7xl px-5 py-8 sm:px-8">
      {/* Catalogue header atmosphere, full-bleed via `left-1/2 … w-screen`. Decorative,
          so kept out of the a11y tree. */}
      <div aria-hidden="true" className="page-wash absolute left-1/2 top-0 -z-10 h-[30rem] w-screen -translate-x-1/2" />
      <PageTitle
        eyebrow="Find"
        title="What are you trying to solve?"
        description="Real questions from risk leaders, each tagged by effort, cost, duration and more."
      />

      {/* week3_plan.md Phase 6 step 7 / DESIGN.md §42's "headings in order, no skipped
          levels" — see CoursesCatalogue.tsx for the full rationale; same fix, same
          reason (each QuestionRow's title below is h3). */}
      <h2 className="sr-only">Question results</h2>

      <div className="mx-auto mt-8 max-w-7xl">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-primary/70"
            aria-hidden="true"
          />
          <label htmlFor="library-search" className="sr-only">
            Search the questions
          </label>
          <Input
            id="library-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the 100 questions…"
            className="h-12 rounded-xl border-border-strong/60 pl-11 focus-visible:outline-primary"
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground" aria-hidden="true">
            I need something I can…
          </span>
          {QUICK_FILTERS.map((chip) => {
            const active = activeFilterLabels.some((f) => f.param === chip.dimension && chip.values.includes(f.value))
            return (
              // A one-shot press state on tap, not a hover scale — this app has no
              // scale-on-hover anywhere.
              <motion.button
                key={chip.label}
                type="button"
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.15 }}
                onClick={() => toggleQuickFilter(chip.dimension, chip.values)}
                aria-pressed={active}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                  active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-secondary/50 text-muted-foreground hover:border-primary hover:text-primary',
                )}
              >
                {chip.label}
              </motion.button>
            )
          })}
        </div>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[220px_1fr]">
        {/* Desktop filter panel — stays visible, never collapsed behind a click. */}
        <aside className="hidden lg:block">
          {questions && <FilterPanel questions={questions} searchParams={searchParams} setSearchParams={setSearchParams} />}
        </aside>

        <div>
          <div className="flex items-center justify-between gap-3">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <ResultCount
                exactCount={exact.length}
                closeCount={close.length}
                hasFilters={hasFilters}
                totalCount={questions?.length ?? 0}
              />
            )}
            <button
              type="button"
              onClick={() => setMobileFiltersOpen(true)}
              className={cn(
                'flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors lg:hidden',
                activeFilterCount > 0
                  ? 'border-primary/30 bg-primary/10 text-primary'
                  : 'border-border text-foreground hover:bg-secondary/60',
              )}
            >
              <Filter className="size-3.5" aria-hidden="true" />
              Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
            </button>
          </div>

          {/* Active filters as primary-tinted pills — a visible "this is doing
              something" signal, not a neutral card-bg chip. */}
          {activeFilterLabels.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {activeFilterLabels.map((f) => (
                <button
                  key={`${f.param}-${f.value}`}
                  type="button"
                  onClick={() => clearFilter(f.param, f.value)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary transition-colors hover:border-primary/40 hover:bg-primary/15"
                >
                  {f.label}
                  <X className="size-3" aria-hidden="true" />
                </button>
              ))}
              <button
                type="button"
                onClick={clearAll}
                className="text-xs font-medium text-muted-foreground underline hover:text-foreground"
              >
                Clear all
              </button>
            </div>
          )}

          {isLoading && (
            <div className="mt-6 flex flex-col gap-4">
              {[0, 1].map((i) => (
                <div key={i} className="h-28 animate-pulse rounded-lg border border-border bg-muted/40" />
              ))}
            </div>
          )}

          {!isLoading && questions && questions.length === 0 && (
            <EmptyState
              className="mt-6"
              icon={FileQuestion}
              title="No questions yet"
              description="The first question is on its way — check back soon."
            />
          )}

          {!isLoading && questions && questions.length > 0 && isZeroResults && (
            <ZeroResults
              candidates={relaxationCandidates}
              filters={filters}
              tagLookup={tagLookup}
              onRelax={(dim) => clearFilter(dim)}
              onClearAll={() => {
                clearAll()
                setQuery('')
              }}
            />
          )}

          {!isLoading && !isZeroResults && (exact.length > 0 || close.length > 0) && (
            <>
              {/* No "N exact matches" header in the unfiltered state — that
                  language only makes sense once there's something to be exact
                  ABOUT. ResultCount above already covers the plain count. */}
              {hasFilters && (
                <p className="mt-6 text-sm font-medium text-foreground">
                  {exact.length} exact match{exact.length === 1 ? '' : 'es'}
                </p>
              )}
              <ul
                className={cn(
                  'flex flex-col divide-y divide-border',
                  hasFilters ? 'mt-2 border-t border-border' : 'mt-4',
                )}
              >
                {exact.map((scored) => (
                  <QuestionRow
                    key={scored.question.slug}
                    scored={scored}
                    showBadges={false}
                    showMatchList={hasFilters}
                    activeFilterLabels={activeFilterLabels}
                    tagLookup={tagLookup}
                  />
                ))}
              </ul>

              {close.length > 0 && (
                <>
                  <div className="mt-8">
                    <p className="text-sm font-medium text-foreground">
                      {close.length} close match{close.length === 1 ? '' : 'es'}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Relax one filter to see these as exact.</p>
                  </div>
                  <ul className="mt-2 flex flex-col divide-y divide-border border-t border-border">
                    {visibleClose.map((scored) => (
                      <QuestionRow
                        key={scored.question.slug}
                        scored={scored}
                        showBadges
                        showMatchList={false}
                        activeFilterLabels={activeFilterLabels}
                        tagLookup={tagLookup}
                      />
                    ))}
                  </ul>
                  {!showAllClose && close.length > CLOSE_PREVIEW_COUNT && (
                    <Button variant="outline" size="sm" className="mt-4" onClick={() => setExpandedFor(debouncedQuery)}>
                      Show all {close.length} close matches
                    </Button>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Mobile filter sheet, never a squeezed sidebar. Changes apply live, per tap —
          it reuses the same toggle handlers as the desktop rail. */}
      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileFiltersOpen(false)} aria-hidden="true" />
          <aside className="absolute inset-y-0 right-0 flex w-80 flex-col overflow-y-auto bg-background shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <p className="text-sm font-semibold text-foreground">Filters</p>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                className="flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary/60"
                aria-label="Close filters"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <div className="p-5">
              {questions && <FilterPanel questions={questions} searchParams={searchParams} setSearchParams={setSearchParams} />}
            </div>
            {activeFilterCount > 0 && (
              <div className="border-t border-border p-5">
                <Button variant="outline" className="w-full" onClick={clearAll}>
                  Clear all filters
                </Button>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}
