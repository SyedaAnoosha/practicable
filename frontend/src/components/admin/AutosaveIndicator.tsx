import { AlertTriangle, Check } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error'

/** "the highest-value gap in §31.8." Sticky in the editor
 * header, never a floating toast that covers a field.
 *
 * ```
 * ✓ Saved 14:22 idle, after a successful save
 * Saving… in flight
 * ⚠ Not saved — retrying on failure
 * ```
 */
export function AutosaveIndicator({ status, savedAt }: { status: AutosaveStatus; savedAt: Date | null }) {
  if (status === 'idle' && !savedAt) return null

  return (
    <p className={cn('flex items-center gap-1.5 text-sm', status === 'error' ? 'text-warning' : 'text-muted-foreground')}>
      {status === 'saving' && 'Saving…'}
      {status === 'error' && (
        <>
          <AlertTriangle className="size-3.5" aria-hidden="true" />
          Not saved — retrying
        </>
      )}
      {(status === 'idle' || status === 'saved') && savedAt && (
        <>
          <Check className="size-3.5 text-success" aria-hidden="true" />
          {/* mono for the timestamp — it's data, per §20.8's own face table. */}
          Saved <span className="font-mono">{savedAt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
        </>
      )}
    </p>
  )
}
