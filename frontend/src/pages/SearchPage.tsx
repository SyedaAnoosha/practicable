import { useState } from 'react'
import { useSearchParams, Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { FileSpreadsheet, GraduationCap, HelpCircle, MessageSquarePlus, Package, Search, Tag } from 'lucide-react'
import { api } from '@/lib/api/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageTitle } from '@/components/ui/PageTitle'

interface SearchResult {
  id: string
  slug: string
  title: string
  subtitle?: string | null
  type: string
  rank: number
}

interface SearchGroup {
  type: string
  total: number
  items: SearchResult[]
}

interface FallbackQuestion {
  id: string
  slug: string
  title: string
  preview: string
  domain: string
}

interface SuggestedDomain {
  name: string
  slug: string
}

interface SearchFallback {
  closest_questions: FallbackQuestion[]
  suggested_domains: SuggestedDomain[]
}

interface SearchResponse {
  query: string
  groups: SearchGroup[]
  fallback?: SearchFallback | null
}

const TYPE_CONFIG: Record<string, { icon: typeof HelpCircle; label: string; href: (item: SearchResult) => string }> = {
  course: {
    icon: GraduationCap,
    label: 'Courses',
    href: (item) => `/courses/${item.slug}`,
  },
  template: {
    icon: FileSpreadsheet,
    label: 'Templates',
    href: (item) => `/templates/${item.id}`,
  },
  question: {
    icon: HelpCircle,
    label: 'Questions',
    href: (item) => `/questions/${item.slug}`,
  },
  pack: {
    icon: Package,
    label: 'Packs',
    href: (item) => `/store/packs/${item.slug}`,
  },
}

const TYPE_ORDER = ['course', 'question', 'template', 'pack']

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const q = searchParams.get('q') || ''
  /* The field's text, stored WITH the query it was typed against — the same shape
     CommandPalette uses, and for the same reason. Resetting it from `q` inside an
     effect renders the stale text once and then corrects it: a render cascade, which
     `react-hooks/set-state-in-effect` exists to catch. Derived instead, so navigating
     to a new `?q=` shows the new term immediately with no intermediate frame. */
  const [typed, setTyped] = useState<{ forQuery: string; value: string }>({
    forQuery: q,
    value: q,
  })
  const draft = typed.forQuery === q ? typed.value : q
  const setDraft = (value: string) => setTyped({ forQuery: q, value })

  const { data, isLoading } = useQuery<SearchResponse>({
    queryKey: ['search', q],
    queryFn: () => api.get<SearchResponse>('/search', { params: { q } }).then((r) => r.data),
    enabled: q.length > 0,
  })

  const totalResults = data?.groups.reduce((sum, g) => sum + g.total, 0) ?? 0

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-8">
      <PageTitle
        eyebrow="Search"
        title={q ? `Results for "${q}"` : 'Search'}
        description={totalResults > 0 ? `${totalResults} result${totalResults === 1 ? '' : 's'} found` : undefined}
      />

      {/* A real search field on the results page itself.
          Without it this page was reachable only by editing the URL or reopening the
          command palette — a dead end for the exact person most likely to want to
          refine: someone looking at results that missed. `role="search"` is on the
          form so the landmark wraps the control, and the label is a real <label>,
          since a placeholder is not an accessible name. */}
      <form
        role="search"
        className="mt-6 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const next = draft.trim()
          if (next) setSearchParams({ q: next })
        }}
      >
        <label htmlFor="search-page-input" className="sr-only">
          Search questions, courses, templates, and packs
        </label>
        <input
          id="search-page-input"
          type="search"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Search questions, courses, templates…"
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
        <Button type="submit">Search</Button>
      </form>

      {/* The result count, announced. A sighted visitor reads it off the page; without
          this a screen-reader user gets silence after submitting and cannot tell
          whether anything matched. Kept out of the visual flow because PageTitle's
          description already states the same count on screen. */}
      <div role="status" aria-live="polite" className="sr-only">
        {isLoading
          ? 'Searching…'
          : q
            ? `${totalResults} result${totalResults === 1 ? '' : 's'} for ${q}`
            : ''}
      </div>

      {isLoading && (
        <p className="mt-6 text-sm text-muted-foreground">Searching…</p>
      )}

      {!isLoading && data && totalResults === 0 && (
        <div className="mt-8 space-y-8">
          {/* Header */}
          <div className="text-center">
            <Search className="mx-auto size-10 text-muted-foreground/40" aria-hidden="true" />
            <p className="mt-3 text-sm text-muted-foreground">
              We couldn't find an exact match for "{q}".
            </p>
          </div>

          {/* Closest matching questions */}
          {data.fallback?.closest_questions && data.fallback.closest_questions.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-foreground">Closest matching questions</h2>
              <div className="mt-3 flex flex-col gap-2">
                {data.fallback.closest_questions.map((question) => (
                  <Link
                    key={question.id}
                    to={`/questions/${question.slug}`}
                    className="group"
                  >
                    <Card className="flex items-center gap-3 p-4 transition-colors hover:border-primary/40">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        <HelpCircle className="size-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground group-hover:text-primary">
                          {question.title}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {question.preview}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {question.domain}
                      </span>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Suggested domains */}
          {data.fallback?.suggested_domains && data.fallback.suggested_domains.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-foreground">Browse by domain</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {data.fallback.suggested_domains.map((domain) => (
                  <Link
                    key={domain.slug}
                    to={`/questions?domain=${domain.slug}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
                  >
                    <Tag className="size-3" aria-hidden="true" />
                    {domain.name}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Submit a question CTA */}
          <div className="rounded-xl border border-dashed border-border py-6 text-center">
            <MessageSquarePlus className="mx-auto size-5 text-muted-foreground" aria-hidden="true" />
            <p className="mt-2 text-sm text-muted-foreground">
              Can't find what you're looking for?
            </p>
            <Link
              to="/contact"
              className="mt-3 inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:border-border-strong hover:bg-muted"
            >
              Submit a question
            </Link>
          </div>
        </div>
      )}

      {data && TYPE_ORDER.map((type) => {
        const group = data.groups.find((g) => g.type === type)
        if (!group || group.items.length === 0) return null
        const config = TYPE_CONFIG[type]
        const Icon = config.icon

        return (
          <section key={type} className="mt-8">
            <h2 className="text-sm font-medium text-foreground">
              {config.label}
              {group.total > group.items.length && (
                <span className="ml-2 text-xs text-muted-foreground">
                  ({group.total} total)
                </span>
              )}
            </h2>
            <div className="mt-3 flex flex-col gap-2">
              {group.items.map((item) => (
                <Link
                  key={item.id}
                  to={config.href(item)}
                  className="group"
                >
                  <Card className="flex items-center gap-3 p-4 transition-colors hover:border-primary/40">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground group-hover:text-primary">
                        {item.title}
                      </p>
                      {item.subtitle && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {item.subtitle}
                        </p>
                      )}
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
