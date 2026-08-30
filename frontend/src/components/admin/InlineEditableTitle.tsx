import { useEffect, useRef, useState, type ElementType } from 'react'
import { Check, Loader2, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

/**
 * Click-to-edit for course/module/lesson titles: save-on-blur/Enter, revert-on-Escape.
 * A single field needs no modal or interval-based autosave. Stays uncontrolled while
 * editing (typing updates only local state) so a parent re-render from an unrelated
 * mutation can't stomp on a title mid-edit.
 */
interface InlineEditableTitleProps {
  value: string
  onSave: (next: string) => Promise<unknown>
  /** The element/class the read-only text renders as — a course title reads as an
   * h2-ish heading, a lesson title as a small paragraph, so this isn't one style. */
  as?: ElementType
  className?: string
  inputClassName?: string
  /** Accessible label for the edit control, since its only visible content is an icon. */
  editLabel?: string
  /** When the caller already renders `value` itself (e.g. the course title going
   * through the shared PageTitle <h1>), showing it a second time here would read as
   * two different-looking titles on the same page. This renders only the pencil
   * trigger and, once clicked, the input in its place — no duplicate text line. */
  hideText?: boolean
}

export function InlineEditableTitle({
  value,
  onSave,
  as: As = 'span',
  className,
  inputClassName,
  editLabel = 'Edit title',
  hideText = false,
}: InlineEditableTitleProps) {
  const [editing, setEditing] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const inputRef = useRef<HTMLInputElement>(null)

  /* The draft used to be reset from an effect
   * (`useEffect(() => { if (!editing) setDraft(value) })`), which is a render-then-
   * correct: for one commit after `value` changed, the field still held the previous
   * title. It was also the repo's last outstanding lint error.
   *
   * The rule the effect was expressing is simply "the prop is the source of truth
   * whenever the user is not editing", and that is a derivation, not a synchronisation.
   * `editDraft` holds keystrokes only while editing; the displayed draft falls back to
   * the prop the moment editing ends, so a save elsewhere or a parent refetch is
   * reflected immediately instead of one render late. */
  const [editDraft, setEditDraft] = useState(value)
  const draft = editing ? editDraft : value
  const setDraft = setEditDraft

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const commit = async () => {
    const trimmed = draft.trim()
    if (!trimmed) {
      // Empty title isn't a valid save — revert rather than send it.
      setDraft(value)
      setEditing(false)
      return
    }
    if (trimmed === value) {
      setEditing(false)
      return
    }
    setStatus('saving')
    try {
      await onSave(trimmed)
      setStatus('saved')
      setEditing(false)
    } catch {
      setStatus('error')
      // Stay in edit mode on failure so the admin's edit isn't silently lost.
    }
  }

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <input
          ref={inputRef}
          className={cn(
            'rounded-md border border-border bg-background px-2 py-0.5 text-sm outline-none focus:ring-2 focus:ring-ring',
            inputClassName,
          )}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => void commit()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void commit()
            } else if (e.key === 'Escape') {
              setDraft(value)
              setEditing(false)
            }
          }}
        />
        {status === 'saving' && <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-hidden="true" />}
        {status === 'error' && (
          <span className="text-xs text-warning" role="alert">
            Not saved — try again
          </span>
        )}
      </span>
    )
  }

  return (
    <span className={cn('group inline-flex items-center gap-1.5', hideText && 'inline')}>
      {!hideText && <As className={className}>{value}</As>}
      <button
        type="button"
        className={cn(
          'rounded p-0.5 text-muted-foreground transition-opacity hover:text-foreground focus-visible:opacity-100',
          // Hovering *this* button is the only way to reveal it in hideText mode —
          // there's no sibling text to hover instead, so it can't start invisible.
          hideText ? 'opacity-60 hover:opacity-100' : 'opacity-0 group-hover:opacity-100',
        )}
        onClick={() => {
          setStatus('idle')
          setDraft(value)
          setEditing(true)
        }}
        aria-label={editLabel}
      >
        <Pencil className="size-3.5" aria-hidden="true" />
      </button>
      {status === 'saved' && <Check className="size-3.5 text-success" aria-hidden="true" />}
    </span>
  )
}
