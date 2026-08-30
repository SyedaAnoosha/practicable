import { Archive, CircleCheck, Eye, PenLine } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

/** The four-state editorial workflow (migration 012). Every state
 * carries a word, never colour alone (DESIGN.md §42), and the chip never changes size
 * between states: all four labels are padded to the widest so a state change can't
 * jump a table row. A click cycles draft → in_review → published → archived → draft,
 * the same forward-only order an editor reads left to right in §20.5's own table —
 * `onChange` fires the *next* state and the caller decides whether to actually commit
 * it (a `published` transition may be blocked server-side, e.g. "upload a file first").
 */
export type PublishStateValue = 'draft' | 'in_review' | 'published' | 'archived'

const ORDER: PublishStateValue[] = ['draft', 'in_review', 'published', 'archived']

const CONFIG: Record<PublishStateValue, { label: string; icon: typeof PenLine; className: string }> = {
  draft: { label: 'Draft', icon: PenLine, className: 'bg-warning/12 text-warning border-warning/30' },
  in_review: { label: 'In review', icon: Eye, className: 'bg-accent/10 text-accent border-accent/25' },
  published: { label: 'Published', icon: CircleCheck, className: 'bg-success/12 text-success border-success/30' },
  archived: { label: 'Archived', icon: Archive, className: 'bg-muted text-muted-foreground border-border' },
}

// Every label rendered once, invisibly, at the widest — pins the chip's width to
// "Published" (the longest word) so the box never resizes when the state does.
const WIDEST_LABEL = 'Published'

interface PublishStateChipProps {
  value: PublishStateValue
  onChange: (next: PublishStateValue) => void
  disabled?: boolean
  /** Visible label overrides — e.g. so a chip can't be clicked toward "Published"
   * while a required field is missing. The click still fires (so the caller's own
   * validation/error message can explain why), it just isn't silently allowed to
   * settle into a state the content doesn't support. */
  title?: string
}

export function PublishStateChip({ value, onChange, disabled, title }: PublishStateChipProps) {
  const { label, icon: Icon, className } = CONFIG[value]
  const next = ORDER[(ORDER.indexOf(value) + 1) % ORDER.length]

  return (
    <button
      type="button"
      disabled={disabled}
      title={title ?? `Click to move to ${CONFIG[next].label}`}
      onClick={() => onChange(next)}
      className={cn(
        'inline-flex items-center gap-1 rounded-sm border px-2 py-1 text-xs font-medium transition-colors duration-150',
        'disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
    >
      <Icon className="size-3 shrink-0" aria-hidden="true" />
      {/* A grid stack, not a fixed pixel width: both spans share one grid cell, so the
          cell's width is set by whichever is wider — always WIDEST_LABEL — while only
          the real label paints. That's how the chip holds a constant width across all
          four states without a magic-number min-width tied to one font/zoom level. */}
      <span className="grid">
        <span aria-hidden="true" className="invisible col-start-1 row-start-1">
          {WIDEST_LABEL}
        </span>
        <span className="col-start-1 row-start-1">{label}</span>
      </span>
    </button>
  )
}
