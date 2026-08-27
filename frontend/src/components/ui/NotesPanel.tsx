/**
 * NotesPanel component (W5-R5).
 *
 * Autosaving notes for a lesson, using the existing useAutosave pattern.
 * One note per lesson per learner, edited in place.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { StickyNote, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useNotes, useUpsertNote, useDeleteNote } from '@/hooks/useNotes'
import { useAutosave } from '@/lib/useAutosave'
import { AutosaveIndicator } from '@/components/admin/AutosaveIndicator'

interface NotesPanelProps {
  lessonId: string
  className?: string
}

export function NotesPanel({ lessonId, className }: NotesPanelProps) {
  const { data: notes } = useNotes()
  const upsertNote = useUpsertNote()
  const deleteNote = useDeleteNote()

  const existingNote = notes?.find((n) => n.lesson_id === lessonId)
  const [body, setBody] = useState(existingNote?.body ?? '')
  const bodyRef = useRef(body)

  // Sync local state when the note loads (or its saved body changes), derived during
  // render rather than in an effect — tracking the body we last synced from avoids
  // clobbering in-progress edits on every re-render while still picking up a genuinely
  // new/changed note in the same render that introduces it. The ref itself is not
  // touched here (refs can't be written during render) — the effect below picks up
  // the `body` change and syncs `bodyRef` from it.
  const [syncedBody, setSyncedBody] = useState(existingNote?.body)
  if (existingNote && existingNote.body !== syncedBody) {
    setSyncedBody(existingNote.body)
    setBody(existingNote.body)
  }

  // Keep ref in sync with state
  useEffect(() => {
    bodyRef.current = body
  }, [body])

  const save = useCallback(async () => {
    const value = bodyRef.current
    if (value.trim()) {
      await upsertNote.mutateAsync({ lessonId, body: value })
    } else if (existingNote) {
      await deleteNote.mutateAsync(lessonId)
    }
  }, [lessonId, existingNote, upsertNote, deleteNote])

  const autosave = useAutosave({
    value: body,
    onSave: save,
    delayMs: 1500,
  })

  return (
    <div className={cn('rounded-lg border border-border bg-card p-4', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StickyNote className="size-4 text-muted-foreground" aria-hidden="true" />
          <h3 className="text-sm font-medium text-foreground">Notes</h3>
        </div>
        <div className="flex items-center gap-2">
          {existingNote && (
            <AutosaveIndicator status={autosave.status} savedAt={autosave.savedAt} />
          )}
          {existingNote && (
            <button
              type="button"
              onClick={() => {
                setBody('')
                bodyRef.current = ''
                deleteNote.mutate(lessonId)
              }}
              className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              aria-label="Delete note"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Add a note about this lesson…"
        className="mt-3 w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        rows={3}
        aria-label="Lesson notes"
      />
    </div>
  )
}
