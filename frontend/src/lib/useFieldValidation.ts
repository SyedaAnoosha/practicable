import { useCallback, useState } from 'react'

/** Inline validation on blur, not on submit; a valid field is never cleared because
 * another failed. Deliberately dependency-free — it owns only validity, never the field
 * values (each editor keeps those in its own `useState`), which is what guarantees the
 * "never cleared" behaviour.
 *
 * Usage:
 *   const v = useFieldValidation<{ title: string }>({
 *     title: (val) => (val.trim() ? null : 'Title is required.'),
 *   })
 *   <Input onBlur={() => v.onBlur('title', draft.title)} />
 *   <FieldError message={v.errorFor('title')} />
 *   // before mutate(): if (!v.validateAll(draft)) return
 */

type Validator<T> = (value: T) => string | null

export function useFieldValidation<Values extends Record<string, unknown>>(
  rules: Partial<{ [K in keyof Values]: Validator<Values[K]> }>,
) {
  const [errors, setErrors] = useState<Partial<Record<keyof Values, string>>>({})
  const [touched, setTouched] = useState<Partial<Record<keyof Values, boolean>>>({})

  const onBlur = useCallback(
    <K extends keyof Values>(field: K, value: Values[K]) => {
      const rule = rules[field]
      const message = rule ? rule(value) : null
      setTouched((prev) => ({ ...prev, [field]: true }))
      setErrors((prev) => ({ ...prev, [field]: message ?? undefined }))
    },
    [rules],
  )

  /** Run every rule at once — call before a mutation fires, so a field the admin
   * never visited (and so never blurred) still gets caught rather than silently
   * posted invalid. Returns whether the whole form passed. */
  const validateAll = useCallback(
    (values: Values): boolean => {
      const nextErrors: Partial<Record<keyof Values, string>> = {}
      const nextTouched: Partial<Record<keyof Values, boolean>> = {}
      let ok = true
      for (const key of Object.keys(rules) as (keyof Values)[]) {
        const rule = rules[key]
        if (!rule) continue
        nextTouched[key] = true
        const message = rule(values[key])
        if (message) {
          nextErrors[key] = message
          ok = false
        }
      }
      setTouched((prev) => ({ ...prev, ...nextTouched }))
      setErrors((prev) => ({ ...prev, ...nextErrors }))
      return ok
    },
    [rules],
  )

  const reset = useCallback(() => {
    setErrors({})
    setTouched({})
  }, [])

  // Only shown once a field has been visited — an untouched field stays quiet rather
  // than greeting a fresh "New question" form with a wall of red text.
  const errorFor = useCallback(
    <K extends keyof Values>(field: K): string | undefined => (touched[field] ? errors[field] : undefined),
    [touched, errors],
  )

  return { onBlur, validateAll, reset, errorFor }
}

// ── A few rules reused across editors, so "required" doesn't get five slightly
// different wordings across three files. ──────────────────────────────────────────
export const required =
  (label: string): Validator<string> =>
  (value) =>
    value.trim() ? null : `${label} is required.`

export const requiredSelect =
  (label: string): Validator<string> =>
  (value) =>
    value ? null : `Choose ${label}.`
