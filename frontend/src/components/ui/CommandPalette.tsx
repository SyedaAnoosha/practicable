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
import { queryKeys } from '@/lib/query/keys'
import { cn } from '@/lib/utils/cn'

// ─── Data shapes ──────────────────────────────────────────────────────────────

interface QuestionSummary {
  id: string
  slug: string
  title: string
  domain: string
}

interface CourseSummary {
  id: string
  slug: string
  title: string
  section: string
}

interface TemplateSummary {
  id: string
  title: string
  description: string
}

interface SearchResult {
  type: 'question' | 'course' | 'template' | 'lesson'
  title: string
  subtitle: string
  href: string
  icon: typeof HelpCircle
}

// ─── Type config ──────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<SearchResult['type'], { icon: typeof HelpCircle; label: string }> = {
  question: { icon: HelpCircle, label: 'Questions' },
  course: { icon: GraduationCap, label: 'Courses' },
  template: { icon: FileSpreadsheet, label: 'Templates' },
  lesson: { icon: BookOpen, label: 'Lessons' },
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
  const listRef = useRef<HTMLDivElement>(null)

  // Fetch all content types in parallel
  const { data: questions } = useQuery({
    queryKey: queryKeys.questions.list(),
    queryFn: () => api.get<QuestionSummary[]>('/questions/index').then((r) => r.data),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  })
  const { data: courses } = useQuery({
    queryKey: queryKeys.courses.list(),
    queryFn: () => api.get<CourseSummary[]>('/courses').then((r) => r.data),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  })
  const { data: templates } = useQuery({
    queryKey: queryKeys.templates.list(),
    queryFn: () => api.get<TemplateSummary[]>('/templates').then((r) => r.data),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  })

  // Build search results
  const results = useMemo<SearchResult[]>(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []

    const items: SearchResult[] = []

    for (const question of questions ?? []) {
      if (
        question.title.toLowerCase().includes(q) ||
        question.domain.toLowerCase().includes(q)
      ) {
        items.push({
          type: 'question',
          title: question.title,
          subtitle: question.domain,
          href: `/questions/${question.slug}`,
          icon: HelpCircle,
        })
      }
    }

    for (const course of courses ?? []) {
      if (course.title.toLowerCase().includes(q) || course.section.toLowerCase().includes(q)) {
        items.push({
          type: 'course',
          title: course.title,
          subtitle: course.section,
          href: `/courses/${course.slug}`,
          icon: GraduationCap,
        })
      }
    }

    for (const template of templates ?? []) {
      if (
        template.title.toLowerCase().includes(q) ||
        template.description.toLowerCase().includes(q)
      ) {
        items.push({
          type: 'template',
          title: template.title,
          subtitle: template.description,
          href: `/templates/${template.id}`,
          icon: FileSpreadsheet,
        })
      }
    }

    return items
  }, [query, questions, courses, templates])

  // Group results by type
  const grouped = useMemo(() => {
    const groups: Record<string, SearchResult[]> = {}
    for (const item of results) {
      const key = item.type
      if (!groups[key]) groups[key] = []
      groups[key].push(item)
    }
    return groups
  }, [results])

  // Flat list for keyboard navigation
  const flatResults = useMemo(() => results, [results])

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
      } else if (e.key === 'Enter' && flatResults[activeIndex]) {
        e.preventDefault()
        handleSelect(flatResults[activeIndex].href)
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

      {/* Palette */}
      <div className="relative z-10 flex w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl">
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search questions, courses, templates…"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            aria-label="Search"
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
            const config = TYPE_CONFIG[type as SearchResult['type']]
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
