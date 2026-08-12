import { useMemo, useState, type CSSProperties } from 'react'
import { Link, useSearchParams } from 'react-router'
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
import { PageTitle } from '@/components/ui/PageTitle'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils/cn'

interface QuestionTag {
  dimension: string
  value: string
  display_label: string
  // The real ordinal scale (tag_values.sort_order): Quick < Mod. < Project < Trans.,
  // XS < S < M < L < XL. Filter options sort by this, not by encounter order.
  sort_order: number
}

interface QuestionSummary {
  id: string
  slug: string
  title: string
  subtitle: string | null
  preview: string
  domain: string
  tags: QuestionTag[]
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
const DIMENSION_ORDER = ['effort', 'duration', 'cost', 'roi_horizon', 'tier', 'regulator_pressure', 'leadership_traits']

// Real taxonomy values, not fuzzy text — a chip only ever matches a real tag row.
const QUICK_FILTERS = [
  { label: '2 weeks or less', dimension: 'duration', values: ['XS', 'S'] },
  { label: 'Low cost', dimension: 'cost', values: ['$'] },
  { label: 'Regulator pressure', dimension: 'regulator_pressure', values: ['M', 'H'] },
  { label: 'Leadership support', dimension: 'leadership_traits', values: ['1', '2', '3', '4', '5'] },
] as const

// One URL param per dimension (+domain), so filters are shareable and Home's domain
// blocks and quick filters can link straight in.
const FILTER_PARAMS = ['domain', ...DIMENSION_ORDER]

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
    if (next.get(param) === value) next.delete(param)
    else next.set(param, value)
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
          {/* Each domain gets its own signature colour + icon (theme.css's
              --domain-* tokens, domainVisuals.ts) — the one deliberate exception
              to "no per-dimension rainbow" (DESIGN.md §7.6/§37, still true for
              the seven tag dimensions below). Five named domains is a different,
              smaller problem than seven badges per row. */}
          <div className="mt-2.5 flex flex-col gap-0.5">
            {domainOptions.map((d) => {
              const active = searchParams.get('domain') === d
              const color = domainColorVar(d)
              const Icon = domainVisual(d).icon
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggle('domain', d)}
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
        // Regulator pressure keeps the one emphasis colour; every other tile is
        // secondary by design.
        const isUrgent = dim === 'regulator_pressure'
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
                  const active = searchParams.get(dim) === value
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => toggle(dim, value)}
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

// The /questions catalogue: an honest filter system where every option offered is
// derived from what's actually published, plus editorial result rows and a match
// explanation naming which active filters each visible result satisfies.
export function QuestionsCatalogue() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  const { data: questions, isLoading } = useQuery({
    queryKey: queryKeys.questions.list(),
    queryFn: () => api.get<QuestionSummary[]>('/questions').then((res) => res.data),
  })

  const activeFilters = useMemo(
    () =>
      FILTER_PARAMS.map((param) => ({ param, value: searchParams.get(param) })).filter(
        (f): f is { param: string; value: string } => f.value !== null,
      ),
    [searchParams],
  )

  const visible = useMemo(() => {
    if (!questions) return []
    const q = query.trim().toLowerCase()
    return questions.filter((item) => {
      const textOk = !q || item.title.toLowerCase().includes(q) || item.preview.toLowerCase().includes(q)
      const filtersOk = activeFilters.every(({ param, value }) => {
        if (param === 'domain') return item.domain === value
        return item.tags.some((t) => t.dimension === param && t.value === value)
      })
      return textOk && filtersOk
    })
  }, [questions, query, activeFilters])

  const activeFilterLabels = useMemo(() => {
    if (!questions) return []
    return activeFilters.map(({ param, value }) => {
      if (param === 'domain') return { param, value, label: value }
      const tag = questions.flatMap((q) => q.tags).find((t) => t.dimension === param && t.value === value)
      return { param, value, label: tag?.display_label ?? value }
    })
  }, [questions, activeFilters])

  const clearFilter = (param: string) => {
    const next = new URLSearchParams(searchParams)
    next.delete(param)
    setSearchParams(next)
  }
  const clearAll = () => setSearchParams({})

  const toggleQuickFilter = (dimension: string, values: readonly string[]) => {
    const next = new URLSearchParams(searchParams)
    const current = next.get(dimension)
    if (current && (values as readonly string[]).includes(current)) {
      next.delete(dimension)
    } else {
      next.set(dimension, values[0])
    }
    setSearchParams(next)
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8">
      <PageTitle
        eyebrow="Find"
        title="Questions"
        description="Real questions from risk leaders, each tagged by effort, cost, duration and more."
      />

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
            placeholder="Search the questions…"
            className="h-12 rounded-xl border-border-strong/60 pl-11 focus-visible:outline-primary"
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground" aria-hidden="true">
            I need something I can…
          </span>
          {QUICK_FILTERS.map((chip) => {
            const active = activeFilterLabels.some((f) => f.param === chip.dimension && (chip.values as readonly string[]).includes(f.value))
            return (
              <button
                key={chip.label}
                type="button"
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
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[220px_1fr]">
        {/* Desktop filter panel — stays visible, not collapsed behind a click
            (design_again.md §14). */}
        <aside className="hidden lg:block">
          {questions && <FilterPanel questions={questions} searchParams={searchParams} setSearchParams={setSearchParams} />}
        </aside>

        <div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {isLoading ? (
                'Loading…'
              ) : (
                <>
                  <span className="font-semibold tabular-nums text-primary">{visible.length}</span>{' '}
                  {visible.length === 1 ? 'question' : 'questions'}
                </>
              )}
            </p>
            <button
              type="button"
              onClick={() => setMobileFiltersOpen(true)}
              className={cn(
                'flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors lg:hidden',
                activeFilters.length > 0
                  ? 'border-primary/30 bg-primary/10 text-primary'
                  : 'border-border text-foreground hover:bg-secondary/60',
              )}
            >
              <Filter className="size-3.5" aria-hidden="true" />
              Filters {activeFilters.length > 0 && `(${activeFilters.length})`}
            </button>
          </div>

          {/* Active filters as primary-tinted pills — a visible "this is doing
              something" signal, not a neutral card-bg chip. */}
          {activeFilterLabels.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {activeFilterLabels.map((f) => (
                <button
                  key={f.param}
                  type="button"
                  onClick={() => clearFilter(f.param)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary transition-colors hover:border-primary/40 hover:bg-primary/15"
                >
                  {f.label}
                  <X className="size-3" aria-hidden="true" />
                </button>
              ))}
              <button type="button" onClick={clearAll} className="text-xs font-medium text-muted-foreground underline hover:text-foreground">
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

          {!isLoading && visible.length === 0 && (
            <EmptyState
              className="mt-6"
              icon={FileQuestion}
              title={activeFilters.length > 0 || query ? 'No questions matched' : 'No questions yet'}
              description={
                activeFilters.length > 0 || query
                  ? 'Try removing a filter or searching for a different term.'
                  : 'The first question is on its way — check back soon.'
              }
              action={
                activeFilters.length > 0 || query ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      clearAll()
                      setQuery('')
                    }}
                  >
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          )}

          {/* Editorial result rows (§36) — a left accent rule on hover/focus, in
              that result's own domain colour, rather than a Card. The colour is
              chosen from data per-row, so it's set as a CSS custom property via
              inline style and consumed through a literal Tailwind arbitrary-value
              class (`border-l-[var(--row-domain-color)]`) — that string is static
              in source, so the JIT compiler generates it normally; a runtime-
              interpolated class name like `border-l-${color}` would not. */}
          <ul className="mt-4 flex flex-col divide-y divide-border">
            {visible.map((question) => {
              const color = domainColorVar(question.domain)
              const DomainIcon = domainVisual(question.domain).icon
              return (
                <li key={question.slug}>
                  <Link
                    to={`/questions/${question.slug}`}
                    className="group -mx-4 block rounded-lg border-l-2 border-l-transparent px-4 py-6 transition-colors duration-150 hover:border-l-[var(--row-domain-color)] hover:bg-secondary/40 focus-visible:border-l-[var(--row-domain-color)] focus-visible:bg-secondary/40 focus-visible:outline-none"
                    style={{ '--row-domain-color': color } as CSSProperties}
                  >
                    <p className="eyebrow gap-1.5" style={{ color }}>
                      <DomainIcon className="size-3" aria-hidden="true" />
                      {question.domain}
                    </p>
                    <h3 className="mt-1.5 text-h4 font-semibold text-foreground group-hover:text-primary">
                      {question.title}
                    </h3>
                    {question.subtitle && <p className="mt-1 text-sm text-muted-foreground">{question.subtitle}</p>}
                    {/* <p className="mt-3 flex flex-wrap gap-1.5 text-xs">
                      {question.tags
                        .filter((t) => t.dimension !== 'leadership_traits')
                        .slice(0, 3)
                        .map((t) => (
                          <span
                            key={`${t.dimension}-${t.value}`}
                            className={cn(
                              'rounded-full px-2 py-0.5 font-medium',
                              t.dimension === 'regulator_pressure'
                                ? 'bg-accent/10 text-accent'
                                : 'bg-secondary text-secondary-foreground',
                            )}
                          >
                            {t.display_label}
                          </span>
                        ))}
                    </p> */}

                    {/* Match explanation — only once a filter is actually active, and
                        only restating filters this (necessarily fully-matching) result
                        satisfies, never a fabricated relevance score. */}
                    {activeFilterLabels.length > 0 && (
                      <ul className="mt-3 flex flex-col gap-1">
                        {activeFilterLabels.map((f) => (
                          <li key={f.param} className="flex items-center gap-1.5 text-xs text-success">
                            <span aria-hidden="true">✓</span> {f.label}
                          </li>
                        ))}
                      </ul>
                    )}

                    <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
                      Read the answer →
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      </div>

      {/* Mobile filter sheet — never a squeezed sidebar (§24.2's rule applied here
          too), same slide-over pattern used across the app. */}
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
            {activeFilters.length > 0 && (
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
