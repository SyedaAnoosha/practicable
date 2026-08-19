import { useCallback, useEffect, useRef, useState } from 'react'
import type { AutosaveStatus } from '@/components/admin/AutosaveIndicator'

/** A genuine fixed interval, not a debounce that resets on every keystroke: it's set
 * up once and reads the latest `value`/`onSave` through refs, so typing continuously
 * doesn't push the save further away.
 *
 * `value` is whatever string the caller wants watched for "has this changed since the
 * last save" — a JSON-stringified draft for a multi-field form, or raw text for one.
 *
 * Never throws into the caller and never clears `value` on failure — the draft stays
 * as the admin left it; only `status` flips to `'error'`.
 */
export function useAutosave({
  value,
  onSave,
  delayMs = 20_000,
  enabled = true,
}: {
  value: string
  onSave: () => Promise<unknown>
  delayMs?: number
  enabled?: boolean
}) {
  const [status, setStatus] = useState<AutosaveStatus>('idle')
  const [savedAt, setSavedAt] = useState<Date | null>(null)

  const lastSavedValue = useRef(value)
  const valueRef = useRef(value)
  const onSaveRef = useRef(onSave)
  const savingRef = useRef(false)

  // React Compiler forbids writing a ref during render, so these syncs move to an
  // effect, which still runs before the next interval tick can read them.
  useEffect(() => {
    valueRef.current = value
    onSaveRef.current = onSave
  })

  const saveNow = useCallback(async () => {
    if (savingRef.current) return
    if (lastSavedValue.current === valueRef.current) return // nothing dirty
    savingRef.current = true
    setStatus('saving')
    try {
      await onSaveRef.current()
      lastSavedValue.current = valueRef.current
      setSavedAt(new Date())
      setStatus('saved')
    } catch {
      setStatus('error')
    } finally {
      savingRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    const interval = setInterval(() => {
      void saveNow()
    }, delayMs)
    return () => clearInterval(interval)
  }, [enabled, delayMs, saveNow])

  return { status, savedAt, saveNow }
}
