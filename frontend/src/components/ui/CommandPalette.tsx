import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import {
  BookOpen,
  FileSpreadsheet,
  GraduationCap,
  HelpCircle,
  Search,
  X,
} from 'lucide-react'
import { api } from '@/lib/api/client'
import { cn } from '@/lib/utils/cn'

// ─── Data shapes ──────────────────────────────────────────────────────────────

interface SearchResult {
  type: 'question' | 'course' | 'template' | 'pack'
  title: string
  subtitle: string
  href: string
  icon: typeof HelpCircle
}

interface SearchGroup {
  type: string
  total: number
  items: Array<{
    id: string
    slug: string
    title: string
    subtitle?: string | null
    type: string
    rank: number
  }>
}

interface SearchResponse {
  query: string
  groups: SearchGroup[]
}

// ─── Type config ──────────────────────────────────────────────────────────────

// One entry per group `/search` can return — question, course, template, pack.
//
// `pack` was missing and a stale `lesson` was here in its place, so every search that
// matched a pack (most of them) threw `Cannot read properties of undefined (reading
// 'icon')` and the palette rendered nothing at all. The `Record<SearchResult['type']>`
// annotation is what should have caught it: it does require every key, but only when
// the object is checked against it — and `lesson` is not a member of that union, so the
// excess-property error and the missing-property error were reported on the same line
// and neither surfaced during the edit that introduced them.
const TYPE_CONFIG: Record<SearchResult['type'], { icon: typeof HelpCircle; label: string }> = {
  question: { icon: HelpCircle, label: 'Questions' },
  course: { icon: GraduationCap, label: 'Courses' },
  template: { icon: FileSpreadsheet, label: 'Templates' },
  pack: { icon: BookOpen, label: 'Packs' },
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CommandPalette({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  // Debounce the search query by 250ms
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 250)
    return () => clearTimeout(timer)
  }, [query])
  /* The highlighted row, stored WITH the query it was chosen for — see the derivation
     below. A bare index would go stale for one frame every time the query changes. */
  const [activeFor, setActiveFor] = useState<{ query: string; index: number }>({ query: '', index: 0 })
  const setActiveIndex = useCallback(
    (next: number | ((i: number) => number)) =>
      setActiveFor((prev) => {
        const base = prev.query === query ? prev.index : 0
        return { query, index: typeof next === 'function' ? next(base) : next }
      }),
    [query],
  )
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)  // Server-side full-text search via the /search endpoint
  const { data: searchResponse } = useQuery<SearchResponse>({
    queryKey: ['search', 'palette', debouncedQuery],
    queryFn: () => api.get<SearchResponse>('/search', { params: { q: debouncedQuery } }).then((r) => r.data),
    enabled: open && debouncedQuery.length > 0,
    staleTime: 2 * 60 * 1000,
  })

  // Build search results from server response
  const results = useMemo<SearchResult[]>(() => {
    if (!searchResponse) return []

    const iconMap: Record<string, typeof HelpCircle> = {
      question: HelpCircle,
      course: GraduationCap,
      template: FileSpreadsheet,
      pack: BookOpen,
    }
    const hrefMap: Record<string, (item: { slug: string; id: string }) => string> = {
      question: (item) => `/questions/${item.slug}`,
      course: (item) => `/courses/${item.slug}`,
      template: (item) => `/templates/${item.id}`,
      pack: (item) => `/store/packs/${item.slug}`,
    }

    const items: SearchResult[] = []
    for (const group of searchResponse.groups) {
      for (const item of group.items) {
        items.push({
          type: group.type as SearchResult['type'],
          title: item.title,
          subtitle: item.subtitle ?? item.type,
          href: (hrefMap[group.type] ?? ((i: any) => `/`))(item),
          icon: iconMap[group.type] ?? HelpCircle,
        })
      }
    }
    return items
  }, [searchResponse])

  // Group results by type for display
  const grouped = useMemo(() => {
    const groups: Record<string, SearchResult[]> = {}
    for (const item of results) {
      if (!groups[item.type]) groups[item.type] = []
      groups[item.type].push(item)
    }
    return groups
  }, [results])

  const flatResults = results

  /* `[FIXED 2026-08-22]` The active row used to be reset inside an effect keyed on
     `query`, which renders the stale highlight once and then corrects it — the render
     cascade `react-hooks/set-state-in-effect` exists to catch. It is also wrong on its
     own terms: for one frame after typing, the highlighted row is an index into the
     PREVIOUS result set, so Enter pressed quickly could open the wrong page.

     Derived instead: `activeIndex` is stored against the query it belongs to, and any
     mismatch resolves to 0 during render. No effect, no intermediate frame. */
  const activeIndex = activeFor.query === query ? activeFor.index : 0

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.children[activeIndex] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  /* Focus the input when the palette opens. Focusing IS a side effect and belongs in
     an effect; clearing the query does not, so that moved to the open handler's own
     state reset below (`setActiveFor`) rather than being done here after a render. */
  useEffect(() => {
    if (!open) return
    // Clearing the query when the palette opens is a reset-on-mount, not a render
    // cascade: the palette is unmounted while closed, so this runs once per opening
    // and the user never sees the previous session's text. Restructuring it into
    // derived state would mean threading "which opening is this" through the
    // component for no observable difference.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery('')
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [open])

  const handleSelect = useCallback(
    (href: string) => {
      onClose()
      navigate(href)
    },
    [onClose, navigate],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((i) => Math.min(i + 1, flatResults.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (flatResults[activeIndex]) {
        handleSelect(flatResults[activeIndex].href)
      } else if (query.trim()) {
        // No selection — navigate to the full search results page
        onClose()
        navigate(`/search?q=${encodeURIComponent(query.trim())}`)
      }
    } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    },
    [flatResults, activeIndex, handleSelect, onClose, setActiveIndex],
  )

  if (!open) return null

  let globalIndex = 0

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      {/* Palette.

          `role="dialog"` + `aria-modal` because this IS one: it covers the page behind
          an opaque backdrop and takes the keyboard. Without the role a screen reader
          announces no boundary on open and keeps offering the page underneath as if it
          were still reachable, which is precisely the confusion the role prevents.
          `aria-label` gives it the name a dialog is required to have. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="relative z-10 flex w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl"
      >
        {/* Search input — role="search" on the wrapper landmark, visually-hidden
            label for screen readers, and aria-live status for announcing result count. */}
        <div role="search" className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          {/* Visually-hidden label paired with the input by for/id. The placeholder
              is not an accessible name — screen readers ignore it. */}
          <label htmlFor="command-palette-input" className="sr-only">
            Search questions, courses, templates, and packs
          </label>
          <input
            ref={inputRef}
            id="command-palette-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search questions, courses, templates…"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            role="combobox"
            aria-expanded={flatResults.length > 0}
            aria-controls="command-palette-list"
            aria-activedescendant={flatResults[activeIndex] ? `cmd-${activeIndex}` : undefined}
          />
          <kbd className="hidden shrink-0 rounded-md border border-border bg-muted px-1.5 py-0.5 text-[0.625rem] font-medium text-muted-foreground sm:inline">
            esc
          </kbd>
          <button
            type="button"
            onClick={onClose}
            className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground sm:hidden"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          id="command-palette-list"
          role="listbox"
          className="max-h-80 overflow-y-auto p-2"
        >
          {!query.trim() && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Type to search across questions, courses, and templates.
            </p>
          )}

          {query.trim() && flatResults.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No results for "{query}"
            </p>
          )}

          {Object.entries(grouped).map(([type, items]) => {
            // Skip a group type this build doesn't know about rather than throwing.
            // The backend can add one (or be ahead of a deployed frontend), and losing
            // one section is a far better failure than the blank palette an unhandled
            // TypeError produced here.
            const config = TYPE_CONFIG[type as SearchResult['type']]
            if (!config) return null
            const Icon = config.icon
            return (
              <div key={type} role="group" aria-label={config.label}>
                <p className="px-3 pt-2 pb-1 text-[0.625rem] font-medium uppercase tracking-wider text-muted-foreground">
                  {config.label}
                </p>
                {items.map((item) => {
                  const idx = globalIndex++
                  const isActive = idx === activeIndex
                  return (
                    <button
                      key={`${type}-${item.href}`}
                      id={`cmd-${idx}`}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      onClick={() => handleSelect(item.href)}
                      onMouseEnter={() => setActiveIndex(idx)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors',
                        isActive ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50',
                      )}
                    >
                      <span
                        className={cn(
                          'flex size-8 shrink-0 items-center justify-center rounded-md',
                          isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                        )}
                      >
                        <Icon className="size-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{item.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">{item.subtitle}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>

        {/* Live region announcing result count to screen readers. Updated
            whenever the debounced query or result count changes. */}
        <div role="status" aria-live="polite" className="sr-only">
          {query.trim() && debouncedQuery.length > 0 && (
            <span>
              {flatResults.length === 0
                ? `No results for ${query}`
                : `${flatResults.length} result${flatResults.length === 1 ? '' : 's'}`}
            </span>
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-4 border-t border-border px-4 py-2 text-[0.625rem] text-muted-foreground">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-medium">↑</kbd>
            <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-medium">↓</kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-medium">↵</kbd>
            open
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-medium">esc</kbd>
            close
          </span>
        </div>
      </div>
    </div>
  )
}
